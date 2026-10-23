import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const isTestEnv = process.env.NODE_ENV === 'test';
const targetRedisUrl = isTestEnv ? process.env.TEST_REDIS_URL : process.env.REDIS_URL;

if (!targetRedisUrl) {
    throw new Error(
        `❌ Redis configuration parameters missing for: NODE_ENV=${process.env.NODE_ENV}`
    );
}

// 🟢 STEP 1: Create the client instance cleanly without connecting yet
const redisClient = createClient({
    url: targetRedisUrl,
});

redisClient.on('error', (err) => {
    if (isTestEnv) {
        console.error('🚨 CRITICAL: Redis Test Database Container is disconnected!');
        process.exit(1); // Forcefully kills the npm run test process instantly
    } else {
        console.error('Redis Client Error:', err);
    }
});

// 🟢 STEP 2: Control the connection lifecycle using a standalone export function
// Call this inside your main server.ts file during boot!
export async function connectRedis(): Promise<void> {
    // Prevent double-connection crashes if it's already active
    if (redisClient.isOpen) return;

    await redisClient.connect();
    if (!isTestEnv) {
        console.log(`🎉 Connected to live Redis Cache Engine successfully [${targetRedisUrl}].`);
    } else {
        console.log('🎭 Testing Cache Environment activated cleanly.');
    }
}

/* Self-invoking connection loop
(async () => {
    await redisClient.connect();
    if (!isTestEnv) {
        console.log(`🎉 Connected to live Redis Cache Engine successfully [${targetRedisUrl}].`);
    } else {
        console.log('🎭 Testing Cache Environment activated cleanly on Database Index Slot 1.');
    }
})();
*/

export default redisClient;
