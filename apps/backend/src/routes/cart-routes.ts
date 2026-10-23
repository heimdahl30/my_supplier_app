import { Router } from 'express';
import { eq } from 'drizzle-orm';
import db from '../db/db.ts'; // Adjust path to your Drizzle db client file
import { cartItems } from '../db/schema.ts';
import authenticateToken from '../middlewares/auth.ts'; // Adjust path to your auth middleware

const cartRouter = Router();

// 🚀 1. THE SYNC ROUTE: Overwrites the database snapshot with the current frontend basket state
cartRouter.post('/sync', authenticateToken, async (req, res) => {
    const { itemsDict } = req.body; // Expects shape: { [productId]: quantity }
    const customerId = res.locals.user.id;

    if (!itemsDict) {
        return res.status(400).json({ error: 'Missing items dictionary payload.' });
    }

    try {
        await db.transaction(async (tx) => {
            // A. The Hard Reset: Wipe old entries for this user to avoid duplicate key conflicts
            await tx.delete(cartItems).where(eq(cartItems.customerId, customerId));

            // B. Filter and Package: Only save items that have a positive quantity
            const newCartRows = Object.entries(itemsDict)
                .filter(([_, qty]) => Number(qty) > 0) // Defensive Guardrail: Removes accidental 0s
                .map(([productId, qty]) => ({
                    customerId,
                    productId: Number(productId),
                    quantityKg: Number(qty),
                }));

            // C. Insert Batch: If they have items left, write them cleanly as new rows
            if (newCartRows.length > 0) {
                await tx.insert(cartItems).values(newCartRows);
            }
        });

        return res
            .status(200)
            .json({ status: 'success', message: 'Cart synced to database profile.' });
    } catch (error) {
        console.error('Error syncing database cart:', error);
        return res.status(500).json({ error: 'Systemic database failure saving cart rows.' });
    }
});

// 🚀 2. THE FETCH ROUTE: Converts database rows back into a clean frontend state object
cartRouter.get('/fetch', authenticateToken, async (req, res) => {
    const customerId = res.locals.user.id;

    try {
        // Find all rows in the table matching this user's ID
        const dbRows = await db
            .select()
            .from(cartItems)
            .where(eq(cartItems.customerId, customerId));

        // Transform the flat rows array into the clean dictionary object format: { [productId]: quantity }
        const frontendCartState = dbRows.reduce(
            (acc, row) => {
                acc[row.productId] = row.quantityKg;
                return acc;
            },
            {} as Record<number, number>
        );

        return res.status(200).json(frontendCartState);
    } catch (error) {
        console.error('Error fetching database cart:', error);
        return res.status(500).json({ error: 'Internal server error pulling user cart profile.' });
    }
});

export default cartRouter;
