import './env.ts';
import app from './app.ts';
import db from './db/db.ts';
import { sql } from 'drizzle-orm';

const PORT = process.env.PORT || 5000;

async function assertDatabaseConnection() {
    try {
        // This sends a tiny "ping" packet to your local PostgreSQL
        await db.execute(sql`SELECT 1`);
        console.log('====================================');
        console.log('🟢 SUCCESS: Express is connected to PostgreSQL!');
        console.log('====================================');
    } catch (error) {
        console.log('====================================');
        console.log('🔴 CRITICAL: Database connection failed!');
        console.error(error);
        console.log('====================================');
        process.exit(1); // Safely shut down the server because it can't run without a database
    }
}

// Execute the connection check at boot time
await assertDatabaseConnection();

app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
});
