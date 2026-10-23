import { Router } from 'express';
import db from '../db/db.ts';
import { products, orders, customers } from '../db/schema.ts';
import authenticateToken from '../middlewares/auth.ts';
import requireAdmin from '../middlewares/admin.ts';
import { eq, and, sql } from 'drizzle-orm';
import { adminWorkspaceLimiter } from '../middlewares/rateLimiter.ts';
import redisClient from '../db/redis.ts';
import Razorpay from 'razorpay';

const adminRouter = Router();
adminRouter.use(adminWorkspaceLimiter);

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

adminRouter.get('/orders', authenticateToken, requireAdmin, async (req, res) => {
    const { subRole } = res.locals.user;

    if (subRole !== 'manager') {
        return res.status(403).json({
            error: 'Security Exception: Administrative ledger access is restricted to corporate managers only.',
        });
    }

    try {
        const allOrders = await db.query.orders.findMany({
            // 1. Sort by descending order date (newest first)
            orderBy: (orders, { desc }) => [desc(orders.orderDate)],

            // 2. Nest join the related customer record
            with: {
                customer: {
                    columns: {
                        passwordHash: false, // Excludes just this column, keeps everything else!
                    },
                },
            },
        });
        return res.status(200).json(allOrders);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Orders could not be fetched' });
    }
});

/*
adminRouter.patch('/orders/:id/status', authenticateToken, requireAdmin, async (req, res) => {
   const {status} = req.body;
   const {id} = req.params;
   const { subRole } = res.locals.user; // Securely read their corporate job function

   if (status === 'Ready for Delivery' && subRole !== 'warehouse' && subRole !== 'manager') {
        return res.status(403).json({ error: 'Security Exception: Only warehouse staff and managers can mark orders as ready for delivery.' });
    }

    if (status === 'Out for Delivery' && subRole !== 'driver' && subRole !== 'manager') {
        return res.status(403).json({ error: 'Security Exception: Only delivery partners can dispatch orders.' });
    }

    try {
    const [statusUpdated] = await db.update(orders).set({status}).where(eq(orders.id, Number(id))).returning()

    if (!statusUpdated) {
            return res.status(404).json({ error: 'Order record not found.' });
        }

        // 2. FIXED: Returned a structured JSON object instead of string templates
        return res.status(201).json({
            message: 'Order status updated successfully',
            order: statusUpdated
        });
}
catch(error){
    console.error(error)
    return res.status(500).json({error: "Status update failed"})
}
})
*/

// 📁 File: apps/backend/src/routes/admin.ts (Optimized Floor Staff Route) [I13]

adminRouter.get('/orders/packing', authenticateToken, requireAdmin, async (req, res) => {
    const user = res.locals.user;

    // 🔒 Security Guardrail: Block drivers from accessing the packaging queues
    if (user.subRole === 'driver') {
        return res.status(403).json({
            error: 'Security Exception: Only warehouse staff and managers can check orders that are being packed.',
        });
    }

    try {
        // 🛡️ ONE CLEAN, FLAT SCAN: Pulls only the live records that need packing right now [I13]
        const availableOrders = await db.query.orders.findMany({
            where: (orders, { eq }) => eq(orders.status, 'Packing'),
            with: {
                customer: {
                    columns: {
                        passwordHash: false, // Security Sanitation: Never leak hashes! [I13]
                    },
                },
            },
        });

        // Return a flat, fast array directly to the packing table rows mapping loop [I13]
        return res.status(200).json(availableOrders);
    } catch (error) {
        console.error('Warehouse queue fetch failure:', error);
        return res
            .status(500)
            .json({ error: 'Something went wrong while fetching available packing orders.' });
    }
});

adminRouter.get('/orders/available', authenticateToken, requireAdmin, async (req, res) => {
    const user = res.locals.user;

    if (user.subRole === 'warehouse') {
        return res.status(403).json({
            error: 'Security Exception: Only delivery partners and managers can check orders ready for delivery.',
        });
    }

    try {
        const availableOrders = await db.query.orders.findMany({
            where: (orders, { and, eq, isNull }) =>
                and(
                    eq(orders.status, 'Packed'),
                    isNull(orders.deliveryPartnerId) // No driver has claimed it yet!
                ),
            with: {
                customer: {
                    columns: {
                        passwordHash: false, // Excludes just this column, keeps everything else!
                    },
                },
            },
        });

        return res.status(200).json(availableOrders);
    } catch (error) {
        console.error(error);
        return res
            .status(500)
            .json({ error: 'Something went wrong while fetching available orders' });
    }
});

adminRouter.patch('/orders/:id/packed', authenticateToken, requireAdmin, async (req, res) => {
    const { subRole } = res.locals.user;
    const { id: orderId } = req.params;

    if (subRole === 'driver') {
        return res.status(403).json({
            error: 'Security Exception: Only warehouse staff and managers can mark orders ready for delivery.',
        });
    }

    const nowInIndia = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000);

    try {
        const [orderReady] = await db
            .update(orders)
            .set({ status: 'Packed', packedAt: nowInIndia })
            .where(eq(orders.id, Number(orderId)))
            .returning();

        if (!orderReady) {
            return res
                .status(400)
                .json({ error: 'This order has already been marked ready for delivery' });
        }

        const io = req.app.get('io');
        if (io) {
            // 🟢 Target 1: Trigger a fresh data synchronization on the customer's order history dashboard list!
            io.to(`customer_dashboard_${orderReady.customerId}`).emit('order_list_updated');
            console.log(
                `⚡ Live Event Broadcasted: Order #${orderId} marked as Packed for Customer #${orderReady.customerId}`
            );
        }

        return res.status(201).json(orderReady);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Order couldn't be readied" });
    }
});

adminRouter.patch('/orders/:id/claimed', authenticateToken, requireAdmin, async (req, res) => {
    const { id, subRole } = res.locals.user;
    const { id: orderId } = req.params;

    if (subRole === 'warehouse') {
        return res.status(403).json({
            error: 'Security Exception: Only drivers and managers can pick up orders for delivery.',
        });
    }

    const nowInIndia = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000);

    try {
        const [orderPicked] = await db
            .update(orders)
            .set({
                deliveryPartnerId: Number(id),
                status: 'Out for Delivery',
                claimedAt: nowInIndia,
            })
            .where(eq(orders.id, Number(orderId)))
            .returning();

        if (!orderPicked) {
            return res
                .status(400)
                .json({ error: 'This order has already been claimed by another driver.' });
        }

        const io = req.app.get('io');
        if (io) {
            // 🟢 Target 1: Trigger a fresh data synchronization on the customer's order history dashboard list!
            io.to(`customer_dashboard_${orderPicked.customerId}`).emit('order_list_updated');

            // 🟢 Target 2: Stream coordinates directly down to their dedicated single live map viewport room!
            io.to(`order_${orderId}`).emit('driver_location_updated', {
                latitude: 22.8046, // Initial Jamshedpur mapping coordinates baseline mount
                longitude: 86.2029,
                currentStatus: 'Packed',
            });

            console.log(
                `⚡ Live Event Broadcasted: Order #${orderId} marked as Packed for Customer #${orderPicked.customerId}`
            );
        }

        return res.status(201).json(orderPicked);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Order couldn't be assigned" });
    }
});

adminRouter.get('/orders/my-active-jobs', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = res.locals.user;

    try {
        const myActiveJobs = await db.query.orders.findMany({
            where: (orders, { and, eq, not }) =>
                and(
                    eq(orders.deliveryPartnerId, Number(id)),
                    not(eq(orders.status, 'Delivered')) // Show only what hasn't been completed yet
                ),
            with: {
                customer: {
                    columns: {
                        passwordHash: false,
                    },
                },
            },
        });

        return res.status(200).json(myActiveJobs);
    } catch (error) {
        console.error(error);
        return res
            .status(500)
            .json({ error: 'Something went wrong while fetching available orders' });
    }
});

function calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371; // Earth's absolute radius in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Returns absolute kilometers (e.g., 4.72)
}

adminRouter.patch('/orders/:id/delivered', authenticateToken, requireAdmin, async (req, res) => {
    const { id: driverId, subRole } = res.locals.user;
    const { id } = req.params;

    if (subRole === 'warehouse') {
        return res.status(403).json({
            error: 'Security Exception: Only drivers and managers can mark orders as delivered.',
        });
    }

    try {
        // 1. Fetch Order details along with the Customer's active address coordinates! [1.13]
        const orderRecord = await db.query.orders.findFirst({
            where: (orders, { eq }) => eq(orders.id, Number(id)),
        });

        const driverProfile = await db.query.customers.findFirst({
            where: (customers, { eq }) => eq(customers.id, Number(driverId)),
        });

        if (!orderRecord) return res.status(404).json({ error: 'Order record not found.' });
        if (!driverProfile?.razorpaySubAccountId) {
            return res
                .status(422)
                .json({ error: 'Configure bank settings inside your profile first.' });
        }

        // 🟢 2. DISTANCE PRICING MATRIX CALCULATION
        // Warehouse coordinates (Centred on your Jamshedpur hub)
        const warehouseLat = 22.8046;
        const warehouseLng = 86.2029;

        // Get the destination coordinates from the order snapshot or default to base targets if missing
        const customerLat = orderRecord.deliveryLatitude;
        const customerLng = orderRecord.deliveryLongitude;

        // Calculate total kilometers travelled
        const totalDistanceKm = calculateHaversineDistance(
            warehouseLat,
            warehouseLng,
            customerLat as number,
            customerLng as number
        );

        // Pricing Rule Variables
        const BASE_FARE = 40.0; // Fixed payout for the first 3 kms (in Rupees)
        const PER_KM_RATE = 12.0; // Extra incentive fee per kilometer after the 3 km ceiling
        const BASE_DISTANCE_LIMIT = 3.0;

        let calculatedDriverPayout = BASE_FARE;

        if (totalDistanceKm > BASE_DISTANCE_LIMIT) {
            const extraDistance = totalDistanceKm - BASE_DISTANCE_LIMIT;
            calculatedDriverPayout += extraDistance * PER_KM_RATE;
        }

        // Capture absolute UTC milliseconds right now (immune to server timezone switches) [1.22]
        const currentAbsoluteUtcMs = Date.now();

        // Convert the database date string cleanly into absolute UTC milliseconds [1.22]
        const orderPlacedAbsoluteUtcMs = new Date(orderRecord.orderDate).getTime();

        // Define your 45-minute delivery promise threshold window in pure milliseconds
        const PROMISE_WINDOW_MS = 45 * 60 * 1000;
        const maximumLateThresholdTime = orderPlacedAbsoluteUtcMs + PROMISE_WINDOW_MS;
        const isLate = currentAbsoluteUtcMs > maximumLateThresholdTime;

        if (isLate) {
            console.log(
                `⚠️ Run delayed. Applying a 20% timing penalty adjustment to payout value.`
            );
            calculatedDriverPayout = calculatedDriverPayout * 0.8;
        }

        // Convert the final computed value to Paise units for Razorpay processing (e.g., ₹76.40 = 7640 paise)
        const finalPayoutPaise = Math.round(calculatedDriverPayout * 100);

        console.log(
            `🚴 Mileage Result: ${totalDistanceKm.toFixed(2)} km. Total computed payout: ₹${calculatedDriverPayout.toFixed(2)}`
        );

        // 3. 🌐 THE LIVE SPLIT WIRE: Tell Razorpay to execute the dynamic transfer amount! [1.13]
        let razorpayTransferId = null;

        if (driverProfile.razorpaySubAccountId.startsWith('acc_dev_test_')) {
            console.log(
                `🛡️ Sandbox Transfer Activated: Bypassing Razorpay network rails for Mock ID: ${driverProfile.razorpaySubAccountId}`
            );

            // Simulate a successful gateway transfer reference tracking key token string
            razorpayTransferId = `trf_mock_payout_${Math.floor(100000 + Math.random() * 900000)}`;
        } else {
            try {
                const transfer = await razorpay.payments.transfer(orderRecord.billingGatewayId!, {
                    transfers: [
                        {
                            account: driverProfile.razorpaySubAccountId,
                            amount: finalPayoutPaise, // 🟢 Dynamic variable replaces the old fixed hardcoded value!
                            currency: 'INR',
                            notes: {
                                distanceTracked: `${totalDistanceKm.toFixed(2)} km`,
                                delayPenaltyApplied: isLate ? 'Yes' : 'No',
                            },
                        },
                    ],
                });
                razorpayTransferId = transfer.items?.[0]?.id || null;
            } catch (rzpErr: any) {
                console.error('Razorpay dynamic transfer failure:', rzpErr);
                return res
                    .status(422)
                    .json({ error: `Payment Rail Refusal: ${rzpErr.description}` });
            }
        }

        const nowInIndia = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000);
        const [orderDelivered] = await db
            .update(orders)
            .set({
                status: 'Delivered',
                deliveredAt: nowInIndia,
                payoutStatus: 'Paid',
                payoutAt: nowInIndia,
                payoutReferenceId: razorpayTransferId,
            })
            .where(
                and(
                    eq(orders.id, Number(id)),
                    eq(orders.deliveryPartnerId, Number(driverId)) // 🛡️ SHIELD: Driver A cannot hijack Driver B's deliveries!
                )
            )
            .returning();

        const io = req.app.get('io');
        if (io) {
            // 🟢 Target 1: Trigger a fresh data synchronization on the customer's order history dashboard list!
            io.to(`customer_dashboard_${orderDelivered.customerId}`).emit('order_list_updated');
            console.log(
                `⚡ Live Event Broadcasted: Order #${id} marked as Packed for Customer #${orderDelivered.customerId}`
            );
        }

        return res.status(201).json(orderDelivered);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Status update failed' });
    }
});

// 📁 File: apps/backend/src/routes/admin.ts (Simplified Driver-Only Route) [I13]

adminRouter.get('/orders/delivered', authenticateToken, async (req, res) => {
    const user = res.locals.user;

    // 🔒 Security Guardrail: Only delivery partners can access this specific personal log track!
    if (user.subRole !== 'driver') {
        return res.status(403).json({
            error: 'Security Exception: This specific route is optimized for delivery partners only.',
        });
    }

    try {
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        // 🛡️ ULTRA-FAST GEOMETRIC SEARCH: Pulls ONLY this driver's specific delivered rows! [I13, I20]
        const driverDeliveredRaw = await db.query.orders.findMany({
            where: (orders, { and, eq, or, gte }) =>
                and(
                    eq(orders.status, 'Delivered'),
                    eq(orders.deliveryPartnerId, Number(user.id)),
                    or(
                        eq(orders.payoutStatus, 'Unpaid'),
                        and(
                            eq(orders.payoutStatus, 'Paid'),
                            gte(orders.payoutAt, twentyFourHoursAgo)
                        )
                    )
                ),
            with: {
                customer: {
                    columns: {
                        passwordHash: false, // Security Sanitation: Never leak hashes! [I13]
                    },
                },
            },
        });

        // Format clean, concise payload packets for the driver's phone UI [I13]
        const driverDeliveredFormatted = driverDeliveredRaw.map((order) => ({
            id: order.id,
            status: order.status,
            totalPrice: order.totalPrice,
            deliveryNotes: order.deliveryNotes,
            timeline: {
                claimedAt: order.claimedAt,
                deliveredAt: order.deliveredAt,
            },
            customer: order.customer,
            payoutStatus: order.payoutStatus,
            payoutAt: order.payoutAt,
        }));

        return res.status(200).json(driverDeliveredFormatted);
    } catch (error) {
        console.error('Driver shift query collapse:', error);
        return res
            .status(500)
            .json({ error: 'Something went wrong while fetching driver delivery logs.' });
    }
});

// Securely handle adding new grocery items
adminRouter.post('/products', authenticateToken, requireAdmin, async (req, res) => {
    const productList = req.body;

    const { subRole } = res.locals.user;

    if (subRole !== 'manager') {
        return res
            .status(403)
            .json({ error: 'Security Exception: Only managers can add new products.' });
    }

    // 🛑 Array Validation Guardrail
    if (!Array.isArray(productList) || productList.length === 0) {
        return res.status(400).json({ error: 'Payload must be a non-empty array of products.' });
    }

    // 🔍 Validation Matrix Loop: Check every item in the batch before touching the DB
    for (const item of productList) {
        if (
            !item.name ||
            !item.category ||
            item.price === undefined ||
            item.stockKg === undefined ||
            item.desc === undefined
        ) {
            return res.status(400).json({
                error: `Validation Failed: Every product requires name, category, price, stockKg, and description.`,
            });
        }
    }

    try {
        // 🧼 Sanitize and Map the Array to fit your Drizzle schema
        const insertPayload = productList.map((item) => ({
            name: item.name,
            category: item.category,
            pricePerKg: item.price,
            stockKg: Number(item.stockKg),
            desc: item.desc,
        }));
        const newProducts = await db.insert(products).values(insertPayload).returning();

        if (newProducts) {
            // 🌟 DATA CONSISTENCY: Wipe catalog cache so new item appears instantly!
            const keys = await redisClient.keys('products:*');
            if (keys.length > 0) {
                await redisClient.del(keys);
                console.log('🧹 Stale product cache cleared for new inventory addition.');
            }
        }

        return res.status(201).json({
            message: 'Product added to inventory successfully',
            products: newProducts,
        });
    } catch (error) {
        console.error('Error adding admin product:', error);
        return res.status(500).json({ error: 'Failed to add product to inventory.' });
    }
});

adminRouter.put('/products/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { name, category, pricePerKg, stockKg } = req.body;

    const { id } = req.params;

    const updateFields: any = {};

    // 2. Only add fields if they are sent by the frontend
    if (name) updateFields.name = name;
    if (category) updateFields.category = category;
    if (pricePerKg) updateFields.pricePerKg = pricePerKg;
    if (stockKg) updateFields.stockKg = stockKg;

    if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    try {
        const [updatedProduct] = await db
            .update(products)
            .set(updateFields)
            .where(eq(products.id, Number(id)))
            .returning();

        if (updatedProduct) {
            // 🌟 THE DATA CONSISTENCY ACCELERATOR
            // Wipe out any cached product strings so the very next customer request is forced
            // to pull fresh, updated pricing directly from PostgreSQL!
            const keys = await redisClient.keys('products:*');
            if (keys.length > 0) {
                await redisClient.del(keys);
                console.log('🧹 Stale product cache cleared successfully by administrator action.');
            }
            return res.status(201).json({
                message: 'Product updated successfully',
                product: updatedProduct,
            });
        }
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'An error occurred while updating the product.' });
    }
});

// 🌟 Safe Admin Route for Managers
adminRouter.get('/customers/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { subRole } = res.locals.user;
    const { id } = req.params; // The ID of the customer being looked up

    // 1. Authorization Guardrail
    if (subRole !== 'manager') {
        return res.status(403).json({ error: 'Security Exception: Access denied.' });
    }

    try {
        // 2. Fetch the target customer's profile and order history
        const customerFile = await db.query.customers.findFirst({
            where: eq(customers.id, Number(id)),
            with: {
                placedOrders: {
                    with: { orderItems: true },
                },
            },
        });

        if (!customerFile) {
            return res.status(404).json({ error: 'Customer file not found.' });
        }

        // 3. Security Cleanse: Strip out sensitive password hashes before sending
        const { passwordHash, ...cleanCustomerFile } = customerFile;

        return res.json(cleanCustomerFile);
    } catch (error) {
        console.error('Error fetching customer file for manager:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

adminRouter.get('/orders/ledger-master', authenticateToken, requireAdmin, async (req, res) => {
    const { subRole } = res.locals.user;

    if (subRole !== 'manager') {
        return res.status(403).json({
            error: 'Security Exception: This operations command center is restricted to managers only.',
        });
    }

    const now = new Date();
    const twentyMinsAgo = new Date(now.getTime() - 20 * 60 * 1000); // Warehouse packing ceiling [I20]
    const ninetyMinsAgo = new Date(now.getTime() - 90 * 60 * 1000); // Transit SLA ceiling [I20]

    const getTrueIndianDate = (dbDate: Date): Date => {
        const istOffsetMs = 5.5 * 60 * 60 * 1000;
        return new Date(dbDate.getTime() - istOffsetMs);
    };

    try {
        // 🛡️ ONE SINGLE DATABASE FLIGHT: Pulls active and historic rows together [I13, I20]
        const allRowsRaw = await db.query.orders.findMany({
            orderBy: (orders, { desc }) => [desc(orders.orderDate)],
            with: {
                customer: { columns: { passwordHash: false }, with: { addresses: {} } },
                deliveryPartner: { columns: { id: true, name: true, phone: true } },
            },
        });

        const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000); // ⏱️ Shelf time boundary

        // 🧮 EXTRAORDINARILY FAST V8 POOL SPLITTING [I20]
        const packingPool = allRowsRaw.filter((row) => row.status === 'Packing');
        const transitPool = allRowsRaw.filter((row) => row.status === 'Out for Delivery');
        const deliveredPool = allRowsRaw.filter((row) => row.status === 'Delivered');

        // 🌟 NEW: Isolate orders sitting packed on the shelf! [I13]
        const shelfPool = allRowsRaw.filter((row) => row.status === 'Packed');

        // Segment Shelf Processing Delay Exceptions
        const criticalShelf = shelfPool.filter(
            (row) => row.packedAt && getTrueIndianDate(row.packedAt) < thirtyMinsAgo
        );
        const normalShelf = shelfPool.filter(
            (row) => !row.packedAt || getTrueIndianDate(row.packedAt) >= thirtyMinsAgo
        );

        // Segment Warehouse Processing Delay Exceptions
        const criticalPacking = packingPool.filter(
            (row) => getTrueIndianDate(row.orderDate) < twentyMinsAgo
        );
        const normalPacking = packingPool.filter(
            (row) => getTrueIndianDate(row.orderDate) >= twentyMinsAgo
        );

        // Segment Transit Overdue Exceptions
        const criticalTransit = transitPool.filter(
            (row) => row.claimedAt && getTrueIndianDate(row.claimedAt) < ninetyMinsAgo
        );
        const normalTransit = transitPool.filter(
            (row) => !row.claimedAt || getTrueIndianDate(row.claimedAt) >= ninetyMinsAgo
        );

        // Map and append historical efficiency metrics for Delivered records [I13]
        const historicalDeliveredFormatted = deliveredPool.map((order) => {
            let wasDeliveredOnTime = true;
            let efficiencyMinutes = 0;

            if (order.claimedAt && order.deliveredAt) {
                const claimedTime = getTrueIndianDate(order.claimedAt).getTime();
                const deliveredTime = getTrueIndianDate(order.deliveredAt).getTime();
                efficiencyMinutes = Math.round((deliveredTime - claimedTime) / (1000 * 60));
                if (efficiencyMinutes > 90) wasDeliveredOnTime = false; // SLA Breach!
            }

            return {
                ...order,
                efficiencyMinutes,
                wasDeliveredOnTime,
            };
        });

        const criticalDelivered = historicalDeliveredFormatted.filter(
            (row) => !row.wasDeliveredOnTime
        );

        const criticalDeliveredCount = criticalDelivered.length;
        const pendingRefundTickets = allRowsRaw.filter((row) => row.refundStatus === 'Requested'); // ◄── CATCHES INBOUND TICKETS

        // 📦 STREAM THE COMPREHENSIVE DOSSIER ENVELOPE OVER THE WIRES [I20]
        return res.status(200).json({
            grossPipelineValue: allRowsRaw.reduce(
                (acc, curr) => acc + parseFloat(curr.totalPrice),
                0
            ),
            packingMetrics: {
                total: packingPool.length,
                normal: normalPacking.length,
                critical: criticalPacking.length,
            },
            shelfMetrics: {
                total: shelfPool.length,
                normal: normalShelf.length,
                critical: criticalShelf.length,
            },
            transitMetrics: {
                total: transitPool.length,
                normal: normalTransit.length,
                critical: criticalTransit.length,
            },
            deliveryMetrics: {
                total: deliveredPool.length,
                normal: deliveredPool.length - criticalDeliveredCount,
                critical: criticalDeliveredCount,
            },

            pendingRefundCount: pendingRefundTickets.length,

            packingOrders: packingPool,
            criticalPackingOrders: criticalPacking,
            shelfOrders: shelfPool,
            criticalShelfOrders: criticalShelf,
            transitOrders: transitPool,
            criticalTransitOrders: criticalTransit,
            deliveredOrders: historicalDeliveredFormatted,
            criticalDeliveredOrders: criticalDelivered,
        });
    } catch (error) {
        console.error('Ledger consolidation collapse:', error);
        return res
            .status(500)
            .json({ error: 'Internal server exception compiling master operations matrix.' });
    }
});

adminRouter.post(
    '/orders/:id/refund-resolve',
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        const { id } = req.params;
        const { action, amount, managerRemarks } = req.body; // action: 'APPROVE' or 'REJECT'

        try {
            const orderIdNum = Number(id);
            const serverTime = new Date();
            const istOffsetMs = 5.5 * 60 * 60 * 1000; // 5 hours and 30 minutes

            // Mathematically forces the UTC clock forward to lock onto local Indian digits!
            const nowInIndia = new Date(serverTime.getTime() + istOffsetMs);
            const order = await db.query.orders.findFirst({
                where: (orders, { eq }) => eq(orders.id, orderIdNum),
            });

            if (!order)
                return res.status(404).json({ error: 'Fulfillment order record not found.' });
            if (order.refundStatus !== 'Requested') {
                return res.status(400).json({
                    error: 'Validation Error: This order has no active pending refund requests.',
                });
            }

            const totalOrderValue = parseFloat(order.totalPrice);

            // SCENARIO 1: MANAGER HITS THE REJECT BUTTON ❌
            if (action === 'REJECT') {
                const [rejectedOrder] = await db
                    .update(orders)
                    .set({
                        refundStatus: 'Rejected',
                        refundRejectedAt: nowInIndia, // ❌ Captured when manager hits reject
                        // Append why the manager turned it down directly into text log lanes
                        refundReason:
                            order.refundReason +
                            ` | REJECTION REMARKS: ${managerRemarks || 'Policy gap.'}`,
                    })
                    .where(eq(orders.id, orderIdNum))
                    .returning();

                if (!rejectedOrder) {
                    return res
                        .status(500)
                        .json({ error: 'Failed to update refund status to Rejected.' });
                }

                return res.status(200).json({
                    updatedOrder: rejectedOrder,
                    message: 'Refund ticket turned down. Timeline closed.',
                });
            }

            // SCENARIO 2: MANAGER HITS THE APPROVE BUTTON ✅
            const targetRefundAmount = amount ? parseFloat(amount) : totalOrderValue;

            if (targetRefundAmount <= 0 || targetRefundAmount > totalOrderValue) {
                return res.status(400).json({
                    error: `Invalid amount. Headline value ceiling is ₹${totalOrderValue.toFixed(2)}`,
                });
            }

            // 🛡️ REVENUE SAFEGUARDS: Check if we have the transaction identifiers in hand
            if (order.billingStatus !== 'Paid') {
                return res.status(400).json({
                    error: 'Cannot process payouts against unverified or unpaid invoices.',
                });
            }

            if (!order.billingGatewayId) {
                return res.status(422).json({
                    error: 'Missing Transaction Key: The exact card/UPI payment transaction token (pay_xyz) was not found on this order ledger.',
                });
            }

            let paymentIdToRefund = order.billingGatewayId;

            // If the string is a standard Order ID token (e.g., "Tl2vmaca..."), ask Razorpay to pull the captured payment! [1.13]
            if (!paymentIdToRefund.startsWith('pay_')) {
                console.log(
                    `🔍 Old order tracking key detected: ${paymentIdToRefund}. Running dynamic Razorpay lookup pass...`
                );
                try {
                    // Query Razorpay's log ledger directly for all transactions linked to this order token [1.13]
                    const paymentAttemptsList =
                        await razorpay.orders.fetchPayments(paymentIdToRefund);
                    const successfulCapture = paymentAttemptsList.items?.find(
                        (p: any) => p.status === 'captured'
                    );

                    if (!successfulCapture) {
                        return res.status(422).json({
                            error: `Fulfillment Exception: No successful captured payment transaction was found for Razorpay order reference ${paymentIdToRefund}.`,
                        });
                    }

                    paymentIdToRefund = successfulCapture.id; // Correctly unboxes and sets it to "pay_xyz"!
                    console.log(
                        `🎯 Successfully isolated active payment capture token: ${paymentIdToRefund}`
                    );
                } catch (lookupErr: any) {
                    console.error('Razorpay lookup failure:', lookupErr);
                    return res.status(422).json({
                        error: 'Failed to synchronize transaction records from Razorpay.',
                    });
                }
            }

            // 1. Calculate transaction fee units (Convert standard rupees to Paise subunits: ₹500 = 50000 paise)
            const finalRefundAmountPaise = Math.round(targetRefundAmount * 100);

            // 2. 🌐 THE LIVE REVERSAL WIRE: Tell Razorpay to push the cash back to the client's bank account
            // Uses the billingGatewayId (which should store the unique payment_id 'pay_...' captured from your webhook)
            const razorpayRefund = await razorpay.payments.refund(paymentIdToRefund, {
                amount: finalRefundAmountPaise,
                notes: {
                    orderId: String(id),
                    resolutionReason: managerRemarks || 'Authorized Admin Refund Resolve',
                },
            });

            // Update financial parameters and close out the approval timestamp slots
            const [approvedOrder] = await db
                .update(orders)
                .set({
                    refundedAmount: targetRefundAmount.toFixed(2),
                    refundStatus: 'Approved',
                    refundApprovedAt: nowInIndia, // ✅ Captured when payment gateway ping returns success! [I20]
                    billingGatewayId: paymentIdToRefund, // Store the unique 'pay_xyz' transaction ID for future reconciliation
                    refundReason:
                        order.refundReason +
                        ` | APPROVAL REMARKS: ${managerRemarks || 'Authorized.'}`,
                })
                .where(eq(orders.id, orderIdNum))
                .returning();

            if (!approvedOrder) {
                return res
                    .status(500)
                    .json({ error: 'Failed to update refund status to Approved.' });
            }

            return res.status(200).json({
                updatedOrder: approvedOrder,
                message: `Successfully authorized a refund of ₹${targetRefundAmount.toFixed(2)}.`,
                receiptId: razorpayRefund.id, // Returns the unique 'rfnd_...' tracking text code out of the bank object
            });
        } catch (error) {
            console.error('Audit routing crash:', error);
            return res.status(500).json({ error: 'Internal system fault processing audit lane.' });
        }
    }
);

export default adminRouter;
