import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db/db.ts';
import { orders, orderItems, products, customerAddresses } from '../db/schema.ts';
import authenticateToken from '../middlewares/auth.ts';
import { eq } from 'drizzle-orm';
import { strictActionLimiter } from '../middlewares/rateLimiter.ts';
import redisClient from '../db/redis.ts';
import Razorpay from 'razorpay';

const ordersRouter = Router();

// Initialize your Razorpay control panel instance in server memory
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// 📸 1. DEFENSIVE UPLOAD STORAGE CONFIGURATION:
// Ensure a real physical storage folder directory exists inside the system runtime disk blocks
const uploadDir = path.join(process.cwd(), 'public/uploads/refunds');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Create an unique timestamp-prefixed filename string to prevent naming clashes
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `evidence-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Safety cap: 5MB maximum file size limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(
                new Error(
                    'Validation Exception: Only primitive image format file items are allowed.'
                ) as any,
                false
            );
        }
    },
});

ordersRouter.post('/orderplacing', strictActionLimiter, authenticateToken, async (req, res) => {
    const { totalPrice, items, deliveryNotes, addressId } = req.body;
    const customerId = res.locals.user.id;

    // 🟢 FIXED: Comprehensive structural validator guardrail prevents unhandled variables
    const parsedPrice = Number(totalPrice);
    if (!totalPrice || isNaN(parsedPrice) || parsedPrice <= 0) {
        return res.status(400).json({
            error: `Validation Failed: A valid non-zero totalPrice calculation is required. Received: ${totalPrice}`,
        });
    }

    if (!addressId) {
        return res
            .status(400)
            .json({ error: 'A valid target delivery address selection is required.' });
    }

    // 🧼 Clean Sorting: Organize array elements by ID string indices to eliminate Deadlock overlaps
    const sortedItems = [...items].sort((a, b) => a.productId - b.productId);

    try {
        // 1. FETCH THE LOCATION PROFILE: Pull address snapshots outside transaction loops
        const chosenAddress = await db.query.customerAddresses.findFirst({
            where: eq(customerAddresses.id, Number(addressId)),
        });

        if (!chosenAddress || chosenAddress.customerId !== customerId) {
            return res
                .status(404)
                .json({ error: 'Selected delivery address record not found or access denied.' });
        }

        // 2. THE AIR ZONE Handshake: Talk to Razorpay first over the web without opening DB locks
        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(Number(totalPrice) * 100), // Convert standard rupees into Paise subunits (₹500 = 50000 paise)
            currency: 'INR',
            receipt: `receipt_order_${Date.now()}`,
        });

        // 3. ENTER INTERCONNECTED HOUSING LAYERS: Open database transactional write locks
        const clientPaymentPayload = await db.transaction(async (tx) => {
            // Step A: STAMP THE MASTER INVOICE — Save base parameters under temporary unpaid statuses
            const [insertedOrder] = await tx
                .insert(orders)
                .values({
                    customerId,
                    totalPrice,
                    deliveryNotes,
                    status: 'Processing', // ⏳ Awaiting webhook authorization
                    billingStatus: 'Unpaid', // 💳 Marked Unpaid initially
                    billingGatewayId: razorpayOrder.id, // 🔗 Map the unique Razorpay billing string ID!

                    // AUDIT TRAIL DATA PERMANENCE:
                    deliveryAddressLine: chosenAddress.addressLine,
                    deliveryLatitude: chosenAddress.latitude,
                    deliveryLongitude: chosenAddress.longitude,
                    deliveryPhone: chosenAddress.phone,
                    deliveryRecipientName: chosenAddress.fullName,
                })
                .returning();

            const orderItemsPayload = [];

            // Step B: 🟢 THE ONE TRUE Life-Cycle Loop Queue (Predictable sequential order)
            for (const item of sortedItems) {
                // 1. Secure exclusive row-level write-locks on the product row
                const [product] = await tx
                    .select()
                    .from(products)
                    .where(eq(products.id, item.productId))
                    .for('update'); // 🔒 PostgreSQL blocks concurrent buyers right on this line

                // 2. The Check: Evaluate if flash-sale traffic drained the bin while Razorpay was processing
                if (!product || product.stockKg < item.quantityKg) {
                    throw new Error(`Insufficient stock for product ID ${item.productId}`);
                }

                // 3. The Action: Deduct inventory stock securely in database memory
                await tx
                    .update(products)
                    .set({ stockKg: product.stockKg - item.quantityKg })
                    .where(eq(products.id, item.productId));

                // 4. Clear Redis Catalog Caches: Force client views to show updated stock counts instantly
                const keys = await redisClient.keys('products:*');
                if (keys.length > 0) {
                    await redisClient.del(keys);
                }

                // 5. Package item record details for bulk insertion
                orderItemsPayload.push({
                    orderId: insertedOrder.id,
                    productId: item.productId,
                    quantityKg: item.quantityKg,
                });
            }

            // Step C: WRITE JUNCTION BRIDGES: Populate the relational items array rows
            await tx.insert(orderItems).values(orderItemsPayload);

            // Package metadata object parameters required by your frontend checkout overlay screens
            return {
                orderId: insertedOrder.id,
                razorpayOrderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                keyId: process.env.RAZORPAY_KEY_ID,
            };
        });

        // 4. SHIP CONTEXT DATA BACKWARD: Deliver tokens up to Next.js Axios response headers
        return res.status(201).json(clientPaymentPayload);
    } catch (error) {
        console.error('Error executing checkout transaction with Razorpay:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Catch stock exceptions thrown inside our sequential transaction loop
        if (errorMessage.includes('Insufficient stock')) {
            return res.status(400).json({ error: errorMessage });
        }

        return res
            .status(500)
            .json({ error: 'A systemic database failure aborted the checkout routine.' });
    }
});

// 🚀 LIGHTWEIGHT HISTORICAL TRACKER: Pulls only the orders list array for the active user session!
ordersRouter.get('/myHistory', authenticateToken, async (req, res) => {
    const { id: customerId } = res.locals.user; // Retain secure identity metrics from your bearer tokens
    console.log('customerId', customerId);

    try {
        const userOrdersList = await db.query.orders.findMany({
            where: (orders, { eq }) => eq(orders.customerId, Number(customerId)),
            orderBy: (orders, { desc }) => [desc(orders.orderDate)], // Orders freshest transactions first!
            with: {
                orderItems: {
                    with: {
                        product: true, // Include product details for each order item
                    },
                },
            },
        });

        console.log('userOrdersList', userOrdersList);

        return res.status(200).json(userOrdersList);
    } catch (error) {
        console.error('Failed to parse database transactional history lines:', error);
        return res.status(500).json({ error: 'Systemic exception pulling user order arrays.' });
    }
});

ordersRouter.post(
    '/:id/request-refund',
    authenticateToken,
    upload.array('evidencePhotos', 3),
    async (req, res) => {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = res.locals.user.id; // 🛡️ Grab the customer's verified session ID

        if (!id || isNaN(Number(id))) {
            return res
                .status(400)
                .json({ error: 'Bad Request: A valid numerical order reference ID is mandatory.' });
        }

        try {
            const orderIdNum = Number(id);

            // 🔒 Security Guard: Verify this customer actually owns this specific order!
            const orderCheck = await db.query.orders.findFirst({
                where: (orders, { and, eq }) =>
                    and(eq(orders.id, orderIdNum), eq(orders.customerId, userId)),
            });

            if (!orderCheck) {
                return res
                    .status(403)
                    .json({ error: 'Security Exception: Access denied to this order record.' });
            }

            if (orderCheck.status !== 'Delivered') {
                return res.status(400).json({
                    error: 'Validation Error: Only completed drop-offs can request a rollback.',
                });
            }

            // 🟢 3. MAP DYNAMIC FILE PATH STRINGS:
            // Read out the filenames uploaded by Multer, converting them into public browser URLs
            const uploadedFiles = (req.files as Express.Multer.File[]) || [];
            const imagePublicUrls = uploadedFiles.map(
                (file) => `/uploads/refunds/${file.filename}`
            );

            const serverTime = new Date();

            // 2. Convert 5 hours and 30 minutes into exact millisecond units (5.5 * 60 * 60 * 1000)
            const istOffsetMs = 5.5 * 60 * 60 * 1000;

            // 3. Inject the shifted value into a fresh Date object container
            const nowInIndia = new Date(serverTime.getTime() + istOffsetMs);

            // Commit the request parameters to the PostgreSQL column slots [I13]
            await db
                .update(orders)
                .set({
                    refundStatus: 'Requested',
                    refundRequestedAt: nowInIndia,
                    refundReason: reason
                        ? reason.trim()
                        : 'Customer flagged a general delivery issue.',
                    // 🟢 LOCK EVIDENCE LINK STRUCTURES:
                    refundEvidenceUrls: imagePublicUrls,
                })
                .where(eq(orders.id, orderIdNum));

            // Trigger your live Socket event to alert your Manager panel instantly [1.11]
            const io = req.app.get('io');
            if (io) io.emit('admin_order_alert');

            return res
                .status(200)
                .json({ message: 'Refund ticket successfully submitted to logistics ledger.' });
        } catch (error) {
            console.error('Request logging failure:', error);
            return res
                .status(500)
                .json({ error: 'Failed to write request log to database columns.' });
        }
    }
);

// 🚀 SECURE GET LANE: Fetches dynamic order metadata snapshots based on incoming URL parameters
ordersRouter.get('/:id', authenticateToken, async (req, res) => {
    // 🎣 Parameter Extraction: Pull the order ID straight off the incoming link segment
    const { id } = req.params;

    // Extract the logged-in user's identity values injected by your authenticateToken middleware shell
    const { id: customerId } = res.locals.user;

    if (!id || isNaN(Number(id))) {
        return res
            .status(400)
            .json({ error: 'The provided order reference parameter index is missing or invalid.' });
    }

    if (!customerId) {
        return res
            .status(401)
            .json({ error: 'Unauthenticated: Client identity credentials missing.' });
    }

    try {
        console.log(
            `📥 Querying logistics metadata tracking tokens for Order reference ID #${id}...`
        );

        // 🔍 DATABASE LOOKUP: Fetch the single matching record context out of your PostgreSQL pools
        const singleOrderRecord = await db.query.orders.findFirst({
            where: (ordersTable, { eq, and }) =>
                and(
                    eq(ordersTable.id, Number(id)),
                    eq(ordersTable.customerId, Number(customerId)) // 🛡️ PRIVACY SHIELD: Ensures a customer can ONLY scan their own order data rows!
                ),
        });

        // If the order belongs to a different client profile, drop out silently with an explicit 404 security mask
        if (!singleOrderRecord) {
            console.warn(
                `⚠️ Security Notice: Unauthorized access fallback or broken reference lookup triggered for Order reference #${id} by customer account #${customerId}.`
            );
            return res.status(404).json({
                error: 'Requested order logistical context not found on record registries.',
            });
        }

        // 📦 THE RESPONSE DISPATCH: Deliver the permanent audit trail elements straight up to the Axios frontend channel link!
        return res.status(200).json({
            id: singleOrderRecord.id,
            status: singleOrderRecord.status, // ⏳ e.g., 'Processing', 'Packed', 'Out for Delivery', 'Delivered'
            billingStatus: singleOrderRecord.billingStatus, // e.g., 'Paid' vs 'Unpaid'
            totalPrice: singleOrderRecord.totalPrice,

            // 🌟 SNAPSHOT PASS-THROUGH: Hand over the exact locked string values needed by your track map view!
            deliveryAddressLine: singleOrderRecord.deliveryAddressLine,
            deliveryRecipientName: singleOrderRecord.deliveryRecipientName,
            deliveryPhone: singleOrderRecord.deliveryPhone,

            createdAt: singleOrderRecord.orderDate,
        });
    } catch (error) {
        console.error(
            `Critical systemic exception captured during order row parameter lookup:`,
            error
        );
        return res
            .status(500)
            .json({ error: 'An unhandled database tracking lookup error aborted the request.' });
    }
});

export default ordersRouter;

/*
Multiple items order frontend code

import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5000/api',
    withCredentials: true // Crucial: Ensures cookies are sent with every request
});

// Response Interceptor: Catches errors globally before they reach your components
api.interceptors.response.use(
    (response) => response, // If the request succeeds, just return the response
    async (error) => {
        const originalRequest = error.config;

        // Check if the error is a 401 (Expired Access Token) AND we haven't tried refreshing yet
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true; // Mark request so we don't loop infinitely if refresh fails

            try {
                // 1. Silently request a new access token via cookies
                await axios.post('http://localhost:5000/api/refresh-token', {}, { withCredentials: true });

                // 2. Retry the original request that failed (e.g., placing the order)
                return api(originalRequest);
            } catch (refreshError) {
                // Both tokens are dead (or revoked). Redirect them to login page.
                window.location.href = '/login';
                throw refreshError;
            }
        }

        throw error;
    }
);

export default api;

*/

/* UI for orders

import { useState } from 'react';
import api from '../services/api';

interface CartItem {
  productId: number;
  name: string;
  quantityKg: number;
  pricePerKg: number;
}

export default function CheckoutPage() {
  // 1. Local frontend state holding the current items in the basket
  const [cartItems, setCartItems] = useState<CartItem[]>([
    { productId: 101, name: 'Fresh Apples', quantityKg: 2, pricePerKg: 150 },
    { productId: 102, name: 'Organic Onions', quantityKg: 5, pricePerKg: 40 }
  ]);

  // 2. The "Remove" function (Pure Frontend Logic)
  const handleRemoveItem = (productIdToRemove: number) => {
    // Keeps every item EXCEPT the one the user wants to delete
    const updatedCart = cartItems.filter(item => item.productId !== productIdToRemove);
    setCartItems(updatedCart);
  };

  // 3. The "Place Order" function (Sends the final filtered list to the Backend)
  const handlePlaceOrder = async () => {
    // Calculate total price dynamically from the current state
    const totalPrice = cartItems.reduce((sum, item) => sum + (item.pricePerKg * item.quantityKg), 0);

    // Format the payload exactly how your backend transaction expects it
    const orderPayload = {
      totalPrice,
      items: cartItems.map(item => ({
        productId: item.productId,
        quantityKg: item.quantityKg
      }))
    };

    try {
      // Fires the request to your ordersRouter.post('/orderplacing') route
      const response = await api.post('/orders/orderplacing', orderPayload);
      alert('Order placed successfully!');
      setCartItems([]); // Clear cart on success
    } catch (error) {
      alert('Failed to place order. Check stock levels.');
    }
  };

  return (
    <div className="cart-container">
      <h2>Your Basket</h2>
      {cartItems.map(item => (
        <div key={item.productId} className="cart-item">
          <span>{item.name} ({item.quantityKg}kg)</span>

          // Clicking this updates the frontend UI instantly without hitting the DB

          <button onClick={() => handleRemoveItem(item.productId)}>Remove</button>
        </div>
      ))}

      <button onClick={handlePlaceOrder} disabled={cartItems.length === 0}>
        Confirm & Pay
      </button>
    </div>
  );
}

*/
