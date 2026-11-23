import './env.ts';
import db from './db/db.ts';
import { connectRedis } from './db/redis.ts';
import { sql } from 'drizzle-orm';
import { httpServer } from './app.ts';

const PORT = process.env.PORT || 5000;

async function assertDatabaseConnection() {
    try {
        await db.execute(sql`SELECT 1`);
        console.log('====================================');
        console.log('🟢 SUCCESS: Express is connected to PostgreSQL!');
        console.log('====================================');
    } catch (error) {
        console.log('====================================');
        console.log('🔴 CRITICAL: Database connection failed!');
        console.error(error);
        console.log('====================================');
        process.exit(1);
    }
}

async function startServer() {
    await assertDatabaseConnection();
    await connectRedis();

    httpServer.listen(PORT, () => {
        console.log(
            `🚀 Production Core Running Flawlessly over Secure HTTP Pipeline Port: ${PORT}`
        );
        console.log(
            `📡 WebSocket Listener Node is active and listening for telemetry handshake actions...`
        );
    });
}

startServer().catch(console.error);
