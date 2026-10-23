import express from 'express';
import cors from 'cors';
import appRouter from './routes/index.ts';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import webhooksRouter from './routes/webhooks.ts';
import { createServer } from 'http'; // 🚀 Native Node.js HTTP server constructor module
import { Server } from 'socket.io';

const app = express();

app.use(
    cors({
        origin: 'http://localhost:3000',
        credentials: true,
    })
);

app.use('/api/v1/razorpay', webhooksRouter);

app.use(express.json());

app.use(express.static('public'));

app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(morgan('dev'));

app.use('/api/v1', appRouter);

// 🚀 2. THE HTTP CORE COUPLING: Wrap the Express engine to bind socket network listeners
const httpServer = createServer(app);

// 🚀 3. INITIALIZE SOCKET.IO: Establish connection configurations and Cross-Origin policies
export const io = new Server(httpServer, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
    },
    transports: ['websocket'], // Forces direct WebSocket streams immediately, bypassing slower long-polling fallbacks [1.11]
});

// 🚀 4. MANAGEMENT OF REAL-TIME COMMUNICATIONS CHANNELS
io.on('connection', (socket) => {
    console.log(`🔌 New WebSocket Connection Established Client Socket ID: [${socket.id}]`);

    // 🟢 Event Catch: Front-end requests to enter an isolated, safe delivery room for a specific order
    socket.on('join_order_tracking_room', (payload: { orderId: number }) => {
        const { orderId } = payload;

        if (!orderId || isNaN(orderId)) {
            console.error(
                `⚠️ Room Entry Aborted: Invalid order ID token received from Client Socket ${socket.id}`
            );
            return;
        }

        // Establish an isolated, named communication room pool uniquely bound to this transaction
        const roomName = `order_${orderId}`;
        socket.join(roomName);

        console.log(
            `📡 Client Socket [${socket.id}] successfully entered Tracking Room channel: [${roomName}]`
        );
    });

    socket.on('join_customer_dashboard_room', (payload: { customerId: number }) => {
        const { customerId } = payload;

        if (!customerId || isNaN(customerId)) return;

        // Establish an isolated room for this specific logged-in user
        const userRoomName = `customer_dashboard_${customerId}`;
        socket.join(userRoomName);

        console.log(`📡 Customer [${socket.id}] entered Dashboard Room channel: [${userRoomName}]`);
    });

    // Handle clean disconnection routines to free up operating system processing memory threads
    socket.on('disconnect', (reason) => {
        console.log(`🔌 Client Socket [${socket.id}] dropped pipeline link. Reason: ${reason}`);
    });
});

// 🚀 5. GLOBAL EXPOSURE (Optional but highly recommended):
// We attach the 'io' object straight onto the express app instance so your regular
// HTTP routes (like your driver location update route) can tap in and broadcast coordinate updates later!
app.set('io', io);

export default app;
