import express, { Router } from 'express';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import db from '../db/db.ts';
import { orders } from '../db/schema.ts';

const webhooksRouter = Router();

webhooksRouter.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['x-razorpay-signature'] as string;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;

    // Verify that this packet actually came from Razorpay and wasn't spoofed by a hacker
    const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(req.body)
        .digest('hex');

    if (signature !== expectedSignature) {
        console.warn(
            '⚠️ Security Alert: Incoming webhook signature check mismatch. Request aborted.'
        );
        return res.status(400).send('Invalid webhook signature token.');
    }

    const { event, payload } = req.body;

    // 🟢 Event Catch: Razorpay confirms the customer's card was successfully charged
    if (event === 'order.paid') {
        const razorpayOrderId = payload.payment.entity.order_id;
        const razorpay_payment_id = payload.payment.entity.id;

        // Update your PostgreSQL order record to advance the warehouse logistics state machine
        await db
            .update(orders)
            .set({
                billingStatus: 'Paid',
                status: 'Packing', // Sent safely to the packing warehouse team!
                billingGatewayId: razorpay_payment_id,
            })
            .where(eq(orders.billingGatewayId, razorpayOrderId));
    }

    return res.json({ status: 'captured' });
});

export default webhooksRouter;
