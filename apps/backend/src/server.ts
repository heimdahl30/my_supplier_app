import { createServer } from 'http';
import app from './app.ts';
import { connectRedis } from './db/redis.ts';

// Re-wrap or look up the listening server
const httpServer = createServer(app);

// 🚨 THE SERVER ENGINE START BOOT CHECKPOINT
const PORT = process.env.PORT || 5000;
// CRUCIAL: You MUST call httpServer.listen(), NOT app.listen().
// Calling app.listen() would bypass Socket.IO completely and cause your frontend connections to time out.

async function startServer() {
    // Trigger your cache layers before opening ports
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
