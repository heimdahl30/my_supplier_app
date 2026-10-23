import { Router } from 'express';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import db from '../db/db.ts'; // Adjust this pointing to your core drizzle client
import { orders } from '../db/schema.ts'; // Adjust this pointing to your SQL schemas

const paymentsRouter = Router();

paymentsRouter.post('/verify-signature', async (req, res) => {
    const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

    // 🚀 1. The Validation Shield: Ensure no blank payload packets crash your code loops
    if (!orderId || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
        return res
            .status(400)
            .json({ error: 'Missing mandatory cryptographic transaction tokens.' });
    }

    try {
        const secretKey = process.env.RAZORPAY_KEY_SECRET;
        if (!secretKey) {
            console.error(
                '❌ System Configuration Error: RAZORPAY_KEY_SECRET is missing from your .env variables.'
            );
            return res.status(500).json({ error: 'Server authentication keys are misconfigured.' });
        }

        // 🚀 2. THE CRYPTOGRAPHIC HANDSHAKE: Concatenate data parameters exactly as Razorpay mandates
        const expectedSignatureBody = `${razorpayOrderId}|${razorpayPaymentId}`;

        // Rebuild the signed hash securely inside private memory using HMAC hex SHA256 algorithms
        const generatedExpectedSignature = crypto
            .createHmac('sha256', secretKey)
            .update(expectedSignatureBody)
            .digest('hex');

        // 🚀 3. THE VERIFICATION VERDICT: Compare your local generation directly with what the client provided!
        if (generatedExpectedSignature !== razorpaySignature) {
            console.warn(
                `⚠️ Fraud Warning: Signature mismatch detected for local Order ID reference #${orderId}.`
            );
            return res.status(400).json({
                error: 'Transaction validation failed. Security checksum signature mismatch.',
            });
        }

        // 🚀 4. THE ACTION: Now that it's 100% verified, safely transition your database status rows!
        await db
            .update(orders)
            .set({
                status: 'Packing', // Pushes it directly into your warehouse incoming queue views!
                billingStatus: 'Paid',
            })
            .where(eq(orders.id, Number(orderId)));

        console.log(
            `🎉 Success: Payment verified and captured cleanly for Order reference ID #${orderId}!`
        );
        return res.status(200).json({
            status: 'Success',
            message: 'Payment authorization synchronized successfully.',
        });
    } catch (error) {
        console.error('System exception captured inside payment verification routine:', error);
        return res.status(500).json({ error: 'A systemic error prevented ledger record updates.' });
    }
});

export default paymentsRouter;
