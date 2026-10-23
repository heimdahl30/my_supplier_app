import { Router } from 'express';
import authenticateToken from '../middlewares/auth.ts';
import { strictActionLimiter } from '../middlewares/rateLimiter.ts';
import axios from 'axios';

const driversRouter = Router();

// Inside your driver location handler file (e.g., POST /api/v1/driver/location):
driversRouter.post('/location', strictActionLimiter, authenticateToken, async (req, res) => {
    const { orderId, latitude, longitude, status } = req.body;

    // 1. Process database writes, logs, or cache registers...

    // 2. Fetch our global websocket instance out of Express state arrays
    const io = req.app.get('io');

    if (io) {
        // 🚀 THE EVENT BLAST: Sends coordinates straight into that private room channel pool!
        // Your frontend socketInstance.on('driver_location_updated') interceptor catches this instantly!
        io.to(`order_${orderId}`).emit('driver_location_updated', {
            latitude: Number(latitude),
            longitude: Number(longitude),
            currentStatus: status, // e.g., 'Out for Delivery' or 'Delivered'
        });

        console.log(`⚡ Telemetry Broadcasted Streamed for Room order_${orderId}`);
    }

    return res.json({ status: 'success' });
});

// A memory map dictionary to prevent multiple overlapping loops against the same order index
const runningSimulationIntervals = new Map<number, NodeJS.Timeout>();

// 🟢 THE SIMULATOR INTERFACE ENDPOINT:
// This pretends to be the driver's phone continuously walking/biking down the road!
driversRouter.post('/simulate-driver-movement', async (req, res) => {
    const { orderId } = req.body;

    if (!orderId || isNaN(Number(orderId))) {
        return res.status(400).json({
            error: 'Bad Request: Missing target numerical order link identification parameter.',
        });
    }

    const orderIdNum = Number(orderId);

    // 1. Clear out any duplicate loops running on this order to prevent memory thread leaks
    if (runningSimulationIntervals.has(orderIdNum)) {
        clearInterval(runningSimulationIntervals.get(orderIdNum)!);
        runningSimulationIntervals.delete(orderIdNum);
        console.log(`🛑 Existing simulation loops terminated for Order #${orderIdNum}`);
    }

    // Starting baseline mapping variables (Centred near Jamshedpur)
    let currentLat = 22.8046;
    let currentLng = 86.2029;
    let stepCount = 0;

    console.log(
        `🚀 AUTOMATED SIMULATOR ACTIVATED: Generating fake driver pings for Order #${orderIdNum}...`
    );

    // 2. THE BACKGROUND SIMULATOR ENGINE:
    // This loop executes on your Node server and explicitly triggers your own POST route
    // every 3 seconds, mimicking an active mobile device tracking device!
    const simulatorTimer = setInterval(async () => {
        stepCount++;

        // Slightly increment coordinate parameters to move the delivery marker horizontally across the screen
        currentLat += 0.0003;
        currentLng += 0.0002;

        // 🟢 FIXED: Bypass HTTP, cookies, and rate-limiters completely!
        // Blast coordinates directly down the open Socket.io pipe from inside the server room.
        const io = req.app.get('io');
        if (io) {
            io.to(`order_${orderIdNum}`).emit('driver_location_updated', {
                latitude: currentLat,
                longitude: currentLng,
                currentStatus: 'Out for Delivery',
            });
            console.log(
                `📡 [SIMULATOR] Step ${stepCount}: Broadcasted coordinates directly over WebSockets.`
            );
        }

        // Safety Kill Switch: Shut down after 20 iterations
        if (stepCount >= 20) {
            console.log(`🏁 Simulation complete for Order #${orderIdNum}.`);
            clearInterval(simulatorTimer);
            runningSimulationIntervals.delete(orderIdNum);
        }
    }, 3000); // Fires a fresh telemetry packet to your route precisely every 3 seconds!

    // Cache the active background loop pointer handle securely
    runningSimulationIntervals.set(orderIdNum, simulatorTimer);

    return res.status(200).json({
        status: 'Success',
        message: `Fulfillment telemetry simulation engine successfully booted for Order #${orderIdNum}.`,
    });
});

export default driversRouter;
