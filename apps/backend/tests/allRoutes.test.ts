// tests/admin.test.ts
import 'dotenv/config';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import jwt from 'jsonwebtoken'; // Used to sign our mock test session cookie
import cookieSignature from 'cookie-signature';
import app, { io } from '../src/app.ts';
import db, { queryClient } from '../src/db/db.ts';
import { customers, customerAddresses, orders } from '../src/db/schema.ts';
import { sql, eq } from 'drizzle-orm';
import redisClient from '../src/db/redis.ts';

describe('All Routes Suite', () => {
    let warehouseStaffUser: any;
    let finalizedCookieStringWarehouse: string;

    let managerUser: any;
    let finalizedCookieStringManager: string;

    let driverUser: any;
    let finalizedCookieStringDriver: string;

    let customerUser: any;
    let finalizedCookieStringCustomer: string;

    // 2. RUN BOOTSTRAP AND DATA SEEDING

    // 1. ISOLATED BOOTSTRAP: Ensure tables are built for this suite's context
    before(async () => {
        console.log('⚡ [Admin Suite] Aligning sandbox database structures...');

        // 🟢 STEP 1: Explicitly open the dormant Redis network engine socket for your tests!
        if (redisClient && !redisClient.isOpen) {
            await redisClient.connect();
            console.log('🎭 Test Cache Environment cleanly linked to Docker container.');
        }

        const mockJwtSecret = process.env.SECRET || 'fallback_secret';
        const mockCookieSecret = process.env.COOKIE_SECRET || 'fallback_cookie_secret';

        // 🟢 1. SEED WAREHOUSE STAFF USER
        await db.transaction(async (tx) => {
            const [warehouseStaff] = await tx
                .insert(customers)
                .values({
                    name: 'Rahul Packer',
                    phone: '9876500001',
                    email: 'rahul@grocery.com',
                    passwordHash: 'mock_hash_value',
                    role: 'admin',
                    subRole: 'warehouse',
                })
                .returning();

            warehouseStaffUser = warehouseStaff;

            await tx.insert(customerAddresses).values({
                customerId: warehouseStaff.id,
                label: 'Home',
                fullName: warehouseStaff.name,
                phone: warehouseStaff.phone,
                addressLine: '123 Warehouse Logistics Hub, Jamshedpur',
                latitude: 22.8046,
                longitude: 86.2029,
                isDefault: true,
            });
        });

        // Sign & compile cookie string for warehouse staff
        const warehouseToken = jwt.sign(
            {
                id: warehouseStaffUser.id,
                name: warehouseStaffUser.name,
                email: warehouseStaffUser.email,
                role: 'admin',
                subRole: 'warehouse',
            },
            mockJwtSecret,
            { expiresIn: '15m' }
        );
        const signedTokenWarehouse = cookieSignature.sign(warehouseToken, mockCookieSecret);
        finalizedCookieStringWarehouse = `auth_token=s%3A${encodeURIComponent(signedTokenWarehouse)}`;

        // 🟢 2. SEED MANAGER USER
        await db.transaction(async (tx) => {
            const [manager] = await tx
                .insert(customers)
                .values({
                    name: 'The Manager',
                    phone: '909012345',
                    email: 'manager@example.com',
                    passwordHash: 'i_am_manager',
                    role: 'admin',
                    subRole: 'manager',
                })
                .returning();

            managerUser = manager;

            await tx.insert(customerAddresses).values({
                customerId: manager.id,
                label: 'Home',
                fullName: manager.name,
                phone: manager.phone,
                addressLine: '456 Command Headquarters, Jamshedpur',
                latitude: 22.805,
                longitude: 86.204,
                isDefault: true,
            });
        });

        // Sign & compile cookie string for manager
        const managerToken = jwt.sign(
            {
                id: managerUser.id,
                name: managerUser.name,
                email: managerUser.email,
                role: 'admin',
                subRole: 'manager',
            },
            mockJwtSecret,
            { expiresIn: '15m' }
        );
        const signedTokenManager = cookieSignature.sign(managerToken, mockCookieSecret);
        finalizedCookieStringManager = `auth_token=s%3A${encodeURIComponent(signedTokenManager)}`;

        // 🟢 3. SEED DRIVER USER
        await db.transaction(async (tx) => {
            const [driver] = await tx
                .insert(customers)
                .values({
                    name: 'The Driver',
                    phone: '909012346',
                    email: 'driver@example.com',
                    passwordHash: 'i_am_driver',
                    role: 'admin',
                    subRole: 'driver',
                })
                .returning();

            driverUser = driver;

            await tx.insert(customerAddresses).values({
                customerId: driver.id,
                label: 'Home',
                fullName: driver.name,
                phone: driver.phone,
                addressLine: '789 Central Transit Fleet Yard, Jamshedpur',
                latitude: 22.806,
                longitude: 86.205,
                isDefault: true,
            });
        });

        // Sign & compile cookie string for driver
        const driverToken = jwt.sign(
            {
                id: driverUser.id,
                name: driverUser.name,
                email: driverUser.email,
                role: 'admin',
                subRole: 'driver',
            },
            mockJwtSecret,
            { expiresIn: '15m' }
        );
        const signedTokenDriver = cookieSignature.sign(driverToken, mockCookieSecret);
        finalizedCookieStringDriver = `auth_token=s%3A${encodeURIComponent(signedTokenDriver)}`;

        // 🟢 4. SEED CUSTOMER USER
        await db.transaction(async (tx) => {
            const [customer] = await tx
                .insert(customers)
                .values({
                    name: 'The Customer',
                    phone: '909012347',
                    email: 'customer@example.com',
                    passwordHash: 'i_am_customer',
                    role: 'customer',
                })
                .returning();

            customerUser = customer;

            await tx.insert(customerAddresses).values({
                customerId: customer.id,
                label: 'Home',
                fullName: customer.name,
                phone: customer.phone,
                addressLine: '55 Residential Colony, Jamshedpur',
                latitude: 22.808,
                longitude: 86.207,
                isDefault: true,
            });
        });

        // Sign & compile cookie string for customer
        const customerToken = jwt.sign(
            {
                id: customerUser.id,
                name: customerUser.name,
                email: customerUser.email,
                role: 'customer',
                subRole: null,
            },
            mockJwtSecret,
            { expiresIn: '15m' }
        );
        const signedTokenCustomer = cookieSignature.sign(customerToken, mockCookieSecret);
        finalizedCookieStringCustomer = `auth_token=s%3A${encodeURIComponent(signedTokenCustomer)}`;
    });

    // 2. ISOLATED CLEANUP: Wipe everything clean when these tests finish
    after(async () => {
        console.log('🧹 [Admin Suite] Purging operational testing rows...');
        await db.execute(sql`TRUNCATE TABLE customers RESTART IDENTITY CASCADE;`);
        await db.execute(sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE;`);

        // 🟢 SHUT DOWN SOCKET.IO INTERVAL TIMERS INSTANTLY!
        if (io && typeof io.close === 'function') {
            try {
                await new Promise<void>((resolve) => {
                    io.close(() => {
                        console.log('🛑 [Socket.IO] Real-time engine timers closed.');
                        resolve();
                    });
                });
            } catch (err) {
                console.error('Socket.IO teardown skip:', err);
            }
        }

        if (redisClient && typeof redisClient.quit === 'function') {
            await redisClient.flushDb(); // Flushes Slot 1 only as opposed to flushAll which would clear all slots
            await redisClient.quit();
            console.log('🛑 [Admin Suite] Redis connection gracefully closed.');
        }

        // 🟢 TERMINATE THE DB PORT TUNNELS SHIELD
        if (queryClient) {
            try {
                await queryClient.end();
                console.log('🛑 PostgreSQL query client connection pool ended.');
            } catch (err) {
                console.error('PostgreSQL exit bypass:', err);
            }
        }

        // @ts-ignore - Accessing internal Node diagnostic array
        const handles = process._getActiveHandles();

        console.log(`📊 Count of open handles remaining: ${handles.length}`);

        handles.forEach((handle: any, index: number) => {
            console.log(`\n--- Handle #${index + 1} ---`);
            console.log(`Type: ${handle?.constructor?.name}`);

            // If it's a socket or server net handle, log its address parameters
            if (handle?.reading !== undefined)
                console.log(`Reading stream status: ${handle.reading}`);
            if (handle?._connectionKey)
                console.log(`Net Server Bound Key: ${handle._connectionKey}`);
            if (handle?.asyncId) console.log(`Async Hook Tracker ID: ${handle.asyncId}`);

            // If it's a timer loop (setInterval / setTimeout)
            if (handle?._idleTimeout) {
                console.log(`Timer Interval Delay: ${handle._idleTimeout}ms`);
                console.log(`Timer Callback Name: ${handle?._onTimeout?.name || 'anonymous'}`);
            }
        });

        setTimeout(() => {
            process.exit(0); // Safely passes an official success code 0 back to the runner queue!
        }, 100);
    });

    // 3. THE ADMINISTRATIVE PRIVILEGE TEST
    test('GET /api/v1/admin/orders should reject warehouse staff and allow only managers', async () => {
        // Step C: Fire the request using Supertest, mounting the token inside your signed cookie array
        const response = await request(app)
            .get('/api/v1/admin/orders')
            .set('Cookie', [finalizedCookieStringWarehouse]); // Simulated browser cookie transmission

        // 🛡️ THE SECURITY ASSERTION
        // Because a packer is trying to access the master overview list, your route must drop them with 403 Forbidden!
        assert.strictEqual(response.status, 403);
        assert.strictEqual(
            response.body.error,
            'Security Exception: Administrative ledger access is restricted to corporate managers only.'
        );
    });

    test('POST /api/v1/admin/products only managers can add products', async () => {
        const mockProduct = [
            {
                name: 'Test Product',
                category: 'Test Category',
                price: 19.99,
                stockKg: 100,
                desc: 'Pristine organic grocery testing item selection.',
            },
            {
                name: 'Test Product 2',
                category: 'Test Category',
                price: 29.99,
                stockKg: 200,
                desc: 'High-quality warehouse inventory testing inventory.',
            },
            {
                name: 'Test Product 3',
                category: 'Test Category',
                price: 9.99,
                stockKg: 50,
                desc: 'Lightweight sample dispatch item tracking parameters.',
            },
        ];

        // Step C: Fire the request using Supertest, mounting the token inside your signed cookie array
        const response = await request(app)
            .post('/api/v1/admin/products')
            .send(mockProduct)
            .set('Cookie', [finalizedCookieStringManager]); // Simulated browser cookie transmission

        assert.strictEqual(response.status, 201);
        assert.strictEqual(response.body.message, 'Product added to inventory successfully');
        assert.ok(
            response.body.products[0].id,
            'Database must return a valid inserted product entry row serial key identifier.'
        );
        assert.strictEqual(response.body.products[0].name, mockProduct[0].name);
    });

    test('POST /api/v1/orders/orderplacing customer places an order', async () => {
        const responseProd1 = await request(app).get('/api/v1/products/1');

        const profileResponse = await request(app)
            .get('/api/v1/customers/account')
            .set('Cookie', [finalizedCookieStringCustomer]);

        // Make sure your backend route includes your customer_addresses join references!
        // If it's empty, use '1' as a baseline fallback for your isolated row serials
        const targetAddressId = profileResponse.body.addresses?.[0]?.id || 1;

        const mockOrder = {
            items: [
                { productId: 1, quantityKg: 2 },
                { productId: 2, quantityKg: 3 },
            ],
            totalPrice: 50,
            deliveryNotes: 'Please deliver between 5-6 PM',
            addressId: targetAddressId,
        };

        const response = await request(app)
            .post('/api/v1/orders/orderplacing')
            .send(mockOrder)
            .set('Cookie', [finalizedCookieStringCustomer]); // Simulated browser cookie transmission

        assert.strictEqual(response.status, 201);
        assert.ok(
            response.body.orderId,
            'Database must return a valid inserted order entry row serial key identifier.'
        );

        const newlyCreatedOrderId = response.body.orderId;
        // 🟢 THE TESTING INTERCEPTION BRIDGE:
        // Forcefully transition the order row from 'Processing' to 'Packing' in the sandbox!
        // This perfectly simulates a successful Razorpay callback webhook!
        await db
            .update(orders)
            .set({ status: 'Packing', billingStatus: 'Paid' }) // Flip state columns instantly
            .where(eq(orders.id, newlyCreatedOrderId));

        assert.strictEqual(Number(response.body.amount), Number(mockOrder.totalPrice * 100)); // Razorpay stores price in paise

        const responseProd2 = await request(app).get('/api/v1/products/1');

        assert.strictEqual(
            responseProd2.body.stockKg,
            responseProd1.body.stockKg - 2,
            'Stock should be reduced by the ordered quantity.'
        );

        const responseAcc = await request(app)
            .get('/api/v1/customers/account')
            .set('Cookie', [finalizedCookieStringCustomer]);

        assert.ok(
            responseAcc.body.placedOrders.length > 0,
            'Customer account should reflect the new order.'
        );
    });

    test('GET /api/v1/customers/account customer can see their order history', async () => {
        const responseAcc = await request(app)
            .get('/api/v1/customers/account')
            .set('Cookie', [finalizedCookieStringCustomer]);

        assert.ok(
            responseAcc.body.placedOrders.length > 0,
            'Customer account should reflect the new order.'
        );
    });

    test('PUT /api/v1/customers/account customer can edit their phone number', async () => {
        const responseAcc = await request(app)
            .put('/api/v1/customers/account')
            .send({
                phone: '9999911111',
            })
            .set('Cookie', [finalizedCookieStringCustomer]);

        assert.strictEqual(
            Number(responseAcc.body.phone),
            Number('9999911111'),
            'Customer account should reflect the new phone number.'
        );
    });

    test('GET /api/v1/admin/orders only managers can see all orders', async () => {
        const responseManager = await request(app)
            .get('/api/v1/admin/orders')
            .set('Cookie', [finalizedCookieStringManager]);

        assert.strictEqual(
            responseManager.status,
            200,
            'Manager should be able to access all orders.'
        );
        assert.ok(responseManager.body.length > 0, 'Manager should see at least one order.');

        const responseWarehouse = await request(app)
            .get('/api/v1/admin/orders')
            .set('Cookie', [finalizedCookieStringWarehouse]);

        assert.strictEqual(
            responseWarehouse.status,
            403,
            'Warehouse staff should not be able to access all orders.'
        );
        assert.strictEqual(
            responseWarehouse.body.error,
            'Security Exception: Administrative ledger access is restricted to corporate managers only.'
        );
    });

    test('GET /api/v1/admin/orders/packing only managers and warehouse staff can see orders being packed', async () => {
        const responseWarehouse = await request(app)
            .get('/api/v1/admin/orders/packing')
            .set('Cookie', [finalizedCookieStringWarehouse]);

        assert.strictEqual(
            responseWarehouse.status,
            200,
            'Warehouse staff should be able to access all orders being packed.'
        );

        assert.ok(
            responseWarehouse.body.length === 1,
            'Warehouse staff should see one order that is now being packed.'
        );

        const responseDriver = await request(app)
            .get('/api/v1/admin/orders/packing')
            .set('Cookie', [finalizedCookieStringDriver]);

        assert.strictEqual(
            responseDriver.status,
            403,
            'Driver should not be able to access orders being packed.'
        );
        assert.strictEqual(
            responseDriver.body.error,
            'Security Exception: Only warehouse staff and managers can check orders that are being packed.'
        );
    });

    test('PATCH /api/v1/admin/orders/:id/packed only warehouse staff and managers can mark orders ready for delivery', async () => {
        const orderId = 1; // Assuming the first order has ID 1

        const responseWarehouse = await request(app)
            .patch(`/api/v1/admin/orders/${orderId}/packed`)
            .set('Cookie', [finalizedCookieStringWarehouse]);

        assert.strictEqual(
            responseWarehouse.status,
            201,
            'Warehouse staff should be able to mark order as packed.'
        );
        assert.strictEqual(
            responseWarehouse.body.status,
            'Packed',
            'Order status should be updated to "Packed".'
        );
    });

    test('GET /api/v1/admin/orders/available only drivers can see orders ready for delivery', async () => {
        const responseDriver = await request(app)
            .get('/api/v1/admin/orders/available')
            .set('Cookie', [finalizedCookieStringDriver]);

        assert.strictEqual(
            responseDriver.status,
            200,
            'Driver should be able to see available orders.'
        );
        assert.strictEqual(
            responseDriver.body[0].status,
            'Packed',
            'Order status should be "Packed".'
        );

        const responseWarehouse = await request(app)
            .get('/api/v1/admin/orders/available')
            .set('Cookie', [finalizedCookieStringWarehouse]);

        assert.strictEqual(
            responseWarehouse.status,
            403,
            'Warehouse staff should not be able to see available orders.'
        );
    });

    test('PATCH /api/v1/admin/orders/:id/claimed only drivers can claim orders for delivery', async () => {
        const orderId = 1; // Assuming the first order has ID 1
        const responseDriver = await request(app)
            .patch(`/api/v1/admin/orders/${orderId}/claimed`)
            .set('Cookie', [finalizedCookieStringDriver]);

        assert.strictEqual(responseDriver.status, 201, 'Driver should be able to claim the order.');
        assert.strictEqual(
            responseDriver.body.status,
            'Out for Delivery',
            'Order status should be updated to "Out for Delivery".'
        );

        const responseWarehouse = await request(app)
            .patch(`/api/v1/admin/orders/${orderId}/claimed`)
            .set('Cookie', [finalizedCookieStringWarehouse]);

        assert.strictEqual(
            responseWarehouse.status,
            403,
            'Warehouse staff should not be able to claim orders for delivery.'
        );
    });

    test('GET /api/v1/admin/orders/my-active-jobs after claiming an order, drivers can see their active jobs and it should not be in the available order list', async () => {
        const responseDriverJobs = await request(app)
            .get('/api/v1/admin/orders/my-active-jobs')
            .set('Cookie', [finalizedCookieStringDriver]);

        assert.strictEqual(
            responseDriverJobs.status,
            200,
            'Driver should be able to see their active jobs.'
        );
        assert.strictEqual(
            responseDriverJobs.body[0].status,
            'Out for Delivery',
            'Active job status should be "Out for Delivery".'
        );

        const responseDriverAvailable = await request(app)
            .get('/api/v1/admin/orders/available')
            .set('Cookie', [finalizedCookieStringDriver]);

        assert.strictEqual(
            responseDriverAvailable.status,
            200,
            'Driver should be able to see available orders.'
        );
        assert.strictEqual(
            responseDriverAvailable.body.length,
            0,
            'Claimed order should not appear in the available orders list.'
        );
    });

    test('PATCH /api/v1/admin/orders/:id/delivered only drivers can mark orders as delivered and it should not reflect in my-jobs', async () => {
        //Forcefully inject a mock Razorpay Sub-Account ID straight into the active Driver's profile row!
        // This instantly satisfies the backend check: if (!driverProfile?.razorpaySubAccountId) [1.13]
        await db
            .update(customers)
            .set({ razorpaySubAccountId: 'acc_dev_test_mock_driver_99' })
            .where(eq(customers.id, driverUser.id)); // Targets your seeded driver context variable

        const orderId = 1; // Assuming the first order has ID 1
        const responseDriver = await request(app)
            .patch(`/api/v1/admin/orders/${orderId}/delivered`)
            .set('Cookie', [finalizedCookieStringDriver]);

        assert.strictEqual(
            responseDriver.status,
            201,
            'Driver should be able to mark the order as delivered.'
        );
        assert.strictEqual(
            responseDriver.body.status,
            'Delivered',
            'Order status should be updated to "Delivered".'
        );

        const responseDriverJobs = await request(app)
            .get('/api/v1/admin/orders/my-active-jobs')
            .set('Cookie', [finalizedCookieStringDriver]);

        assert.strictEqual(
            responseDriverJobs.status,
            200,
            'Driver should be able to see their active jobs.'
        );
        assert.strictEqual(
            responseDriverJobs.body.length,
            0,
            'Delivered order should not appear in the active jobs list.'
        );

        const responseWarehouse = await request(app)
            .patch(`/api/v1/admin/orders/${orderId}/delivered`)
            .set('Cookie', [finalizedCookieStringWarehouse]);

        assert.strictEqual(
            responseWarehouse.status,
            403,
            'Warehouse staff should not be able to mark orders as delivered.'
        );
    });

    test('GET /api/v1/admin/orders/delivered only drivers can see orders they have delivered and managers can see the whole ledger of delivered orders', async () => {
        const responseDriver = await request(app)
            .get('/api/v1/admin/orders/delivered')
            .set('Cookie', [finalizedCookieStringDriver]);

        assert.strictEqual(
            responseDriver.status,
            200,
            'Driver should be able to see delivered orders.'
        );
        assert.strictEqual(
            responseDriver.body[0].status,
            'Delivered',
            'Order status should be "Delivered".'
        );
        assert.ok(
            !responseDriver.body[0].deliveryPartner,
            'Driver should not see their own details'
        );
        assert.ok(!responseDriver.body[0].orderDate, 'Driver should not see the order date');

        const responseWarehouse = await request(app)
            .get('/api/v1/admin/orders/delivered')
            .set('Cookie', [finalizedCookieStringWarehouse]);

        assert.strictEqual(
            responseWarehouse.status,
            403,
            'Warehouse staff should not be able to see delivered orders.'
        );
    });
});
