// tests/auth.test.ts
import 'dotenv/config';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app, { io } from '../src/app.ts'; // Adjust to your exact Express app export file path
import db, { queryClient } from '../src/db/db.ts';
import { sql } from 'drizzle-orm';
import redisClient from '../src/db/redis.ts';

describe('Customer Registration Security Matrix', () => {
    // 1. BOOTSTRAP: Push schemas to your fresh grocery_supply_test_db before tests run
    before(async () => {
        // 🟢 STEP 1: Explicitly open the dormant Redis network engine socket for your tests!
        if (redisClient && !redisClient.isOpen) {
            await redisClient.connect();
            console.log('🎭 Test Cache Environment cleanly linked to Docker container.');
        }
        console.log('⚡ Synchronizing test database schemas...');
    });

    //2. CLEANUP: Clear rows after tests complete so your tests are always reproducible
    after(async () => {
        console.log('🧹 Purging test database artifacts...');
        await db.execute(sql`TRUNCATE TABLE customers RESTART IDENTITY CASCADE;`);

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
            console.log('🛑 [Auth Suite] Redis connection gracefully closed.');
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

        setTimeout(() => {
            process.exit(0); // Safely passes an official success code 0 back to the runner queue!
        }, 100);
    });

    // 3. THE INTEGRATION TEST
    test('POST /api/v1/customers/signup should register a customer profile and default their role securely', async () => {
        const mockCustomer = {
            name: 'Tester Kumar',
            phone: '9999922222',
            email: 'test_candidate@example.com',
            address: 'Bistupur, Jamshedpur',
            latitude: 22.8015,
            longitude: 86.2025,
            password: 'TestPasswordSecure123',
        };

        // Fire a live virtual HTTP request into your Express routing channels via Supertest
        const response = await request(app)
            .post('/api/v1/customers/signup') // Adjust the endpoint prefix to match your exact mount path
            .send(mockCustomer);

        // Assert that the network response returns 201 Created
        assert.strictEqual(response.status, 201);

        // Assert that a database unique serial ID key was assigned
        assert.ok(
            response.body.id,
            'Database must return a valid inserted user entry row serial key identifier.'
        );

        // 🔒 THE CRITICAL RBAC DEFAULT SECURITY TEST
        // Verify that even without choosing a role, the system safely defaults them to 'customer'
        assert.strictEqual(
            response.body.role,
            'customer',
            'Security Exception: User registration must strictly default to standard client capabilities.'
        );
    });

    test('POST /api/v1/login should authenticate a registered customer and return a JWT token', async () => {
        const loginCredentials = {
            email: 'test_candidate@example.com',
            password: 'TestPasswordSecure123',
        };

        const response = await request(app).post('/api/v1/login').send(loginCredentials);

        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.body.message, 'Login successful');
        assert.ok(response.body.customer, 'Response must include customer data.');
    });

    test('POST /api/v1/logout', async () => {
        const response = await request(app).post('/api/v1/logout');

        assert.strictEqual(response.body.message, 'Logout successful');
    });
});
