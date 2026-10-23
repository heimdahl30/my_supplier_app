import { Router } from 'express';
import db from '../db/db.ts';
import { customers, orders, customerAddresses } from '../db/schema.ts';
import bcrypt from 'bcrypt';
import authenticateToken from '../middlewares/auth.ts';
import { eq } from 'drizzle-orm';
import { publicCatalogLimiter, strictActionLimiter } from '../middlewares/rateLimiter.ts';

const customersRouter = Router();

customersRouter.get('/account', publicCatalogLimiter, authenticateToken, async (req, res) => {
    const { id } = res.locals.user;
    try {
        const customer = await db.query.customers.findFirst({
            where: eq(customers.id, Number(id)),
            with: {
                placedOrders: {
                    with: { orderItems: true },
                },
                addresses: {},
            },
        });

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        res.json(customer);
    } catch (error) {
        console.error('Error fetching customer:', error);
        res.status(500).json({ error: 'An error occurred while fetching the customer.' });
    }
});

customersRouter.put('/account', strictActionLimiter, authenticateToken, async (req, res) => {
    const { id } = res.locals.user;
    const { phone } = req.body;

    // 1. Create a completely standard, plain JavaScript object
    const updateFields: any = {};

    // 2. Only add fields if they are sent by the frontend
    if (phone) updateFields.phone = phone;

    if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    try {
        const [updatedCustomer] = await db
            .update(customers)
            .set(updateFields)
            .where(eq(customers.id, Number(id)))
            .returning();

        res.json(updatedCustomer);
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ error: 'An error occurred while updating the customer.' });
    }
});

customersRouter.post('/signup', strictActionLimiter, async (req, res) => {
    // 1. Destructure fields coming from the client input form
    const { name, phone, email, address, latitude, longitude, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);

    try {
        // 🚀 CRUCIAL STEP: Wrap this in a transaction block so if the address write fails, the user record is rolled back automatically!
        const newCustomerProfile = await db.transaction(async (tx) => {
            // Step A: Insert identity fields into primary customers table
            const [newCustomer] = await tx
                .insert(customers)
                .values({
                    name,
                    phone,
                    email,
                    passwordHash,
                })
                .returning();

            // Step B: Use the newly generated ID to insert the initial address row
            await tx.insert(customerAddresses).values({
                customerId: newCustomer.id,
                label: 'Home', // Tag their initial signup location as their default Home
                fullName: name,
                phone: phone,
                addressLine: address,
                latitude: Number(latitude),
                longitude: Number(longitude),
                isDefault: true, // Make this their primary shipping location automatically
            });

            return {
                id: newCustomer.id,
                name: newCustomer.name,
                email: newCustomer.email,
                role: newCustomer.role,
            };
        });

        res.status(201).json(newCustomerProfile);
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ error: 'An error occurred while creating the customer.' });
    }
});

// 🆕 ADD THIS NEW ALIGNED SUB-ROUTE PATH:
customersRouter.post('/addresses', strictActionLimiter, authenticateToken, async (req, res) => {
    const { id } = res.locals.user; // Securely verify who is making this request via JWT/Session token
    const { label, fullName, phone, addressLine, latitude, longitude } = req.body;

    try {
        const [newAddressRecord] = await db
            .insert(customerAddresses)
            .values({
                customerId: Number(id),
                label, // e.g., 'Office' or 'Parents House'
                fullName,
                phone,
                addressLine,
                latitude: Number(latitude),
                longitude: Number(longitude),
                isDefault: false, // Additional addresses shouldn't steal the default spot unless explicitly requested
            })
            .returning();

        res.status(201).json(newAddressRecord);
    } catch (error) {
        console.error('Error adding additional address:', error);
        res.status(500).json({ error: 'Failed to append location registry row.' });
    }
});

// 🌟 NEW: THE AUTHENTICATED ADDRESS BOOK READ REGISTRY ENDPOINT
customersRouter.get('/addresses', strictActionLimiter, authenticateToken, async (req, res) => {
    // 1. Securely pluck the active user ID injected by your authenticateToken middleware layer
    const customerId = res.locals.user.id;

    try {
        // 2. Query the PostgreSQL disk engine using the Core SQL API to fetch all matching location rows
        const addressBook = await db
            .select()
            .from(customerAddresses)
            .where(eq(customerAddresses.customerId, Number(customerId)));

        /*
        Relational API query

        const addressBook = await db.query.customerAddresses.findMany({
            where: eq(customerAddresses.customerId, Number(customerId)),
        });
        */

        // 3. 🚢 Stream the clean array back to your frontend Axios response.data payload container
        return res.json(addressBook);
    } catch (error) {
        console.error('Error fetching customer address records registry:', error);
        return res.status(500).json({
            error: 'An internal server execution error occurred while compiling your address book records.',
        });
    }
});

export default customersRouter;
