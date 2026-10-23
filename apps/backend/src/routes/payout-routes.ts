import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { customers } from '../db/schema.ts';
import Razorpay from 'razorpay';
import authenticateToken from '../middlewares/auth.ts';
import db from '../db/db.ts';

const payoutRouter = Router();
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

payoutRouter.patch('/payout-setup', authenticateToken, async (req, res) => {
    const { id: userId, subRole } = res.locals.user;
    const { accountHolderName, accountNumber, ifscCode, email, phone } = req.body;

    // Security Gate: Protect the endpoint from standard customers messing with it
    if (subRole !== 'driver') {
        return res.status(403).json({
            error: 'Access Denied: Only delivery partners can configure payout accounts.',
        });
    }

    try {
        let razorpaySubAccountId: string;

        if (process.env.NODE_ENV === 'development' || !process.env.RAZORPAY_KEY_ID) {
            console.log(
                `🛡️ Sandbox Onboarding Activated: Simulating Account Creation for Driver #${userId}...`
            );

            // Generate a valid-looking dummy tracking key string token container
            const randomSuffix = Math.floor(100000 + Math.random() * 900000);
            razorpaySubAccountId = `acc_dev_test_${randomSuffix}`;
        } else {
            // 1. Send the sensitive data variables to Razorpay's banking nodes
            const linkedAccount = await razorpay.accounts.create({
                type: 'route',
                email: email,
                phone: phone,
                legal_business_name: accountHolderName,
                business_type: 'individual',
                profile: {
                    category: 'logistics',
                    subcategory: 'delivery_service',
                },
            } as any);

            await (razorpay as any).products.request(linkedAccount, {
                product_name: 'route',
                tnc_accepted: true,
                settlements: {
                    account_number: accountNumber,
                    ifsc_code: ifscCode,
                    beneficiary_name: accountHolderName,
                },
            });
            razorpaySubAccountId = linkedAccount.id;
        }

        // 3. Write it straight onto their database row
        await db
            .update(customers)
            .set({ razorpaySubAccountId })
            .where(eq(customers.id, Number(userId)));

        return res
            .status(200)
            .json({ success: 'Payout wallet linked successfully.', mockId: razorpaySubAccountId });
    } catch (error) {
        console.error('Razorpay Account Linking Aborted:', error);
        return res.status(500).json({ error: 'Failed to configure sub-account on payment rails.' });
    }
});

export default payoutRouter;
