import { Router } from 'express';
import bcrypt from 'bcrypt';
import db from '../db/db.ts';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { refreshTokens } from '../db/schema.ts';
import { strictActionLimiter, tokenRefreshLimiter } from '../middlewares/rateLimiter.ts';

const loginRouter = Router();

loginRouter.post('/', strictActionLimiter, async (req, res) => {
    const { email, password } = req.body;

    try {
        const customer = await db.query.customers.findFirst({
            where: (customers, { eq }) => eq(customers.email, email),
        });

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // 🌟 THE SERVER TERMINAL PROBE:
        console.log('🐘 [POSTGRES RAW ROW MATCH]:', {
            database_id: customer.id,
            database_role: customer.role, // Let's see what Postgres is ACTUALLY returning to Express!
            database_subRole: customer.subRole,
            env_url_connected: process.env.DATABASE_URL ? 'URL Loaded' : 'MISSING KEY',
        });

        const isMatch = await bcrypt.compare(password, customer.passwordHash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const customerData = {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            role: customer.role,
            subRole: customer.subRole,
        };

        if (!process.env.SECRET) {
            throw new Error('JWT SECRET is not defined in environment variables');
        }

        const token = jwt.sign(customerData, process.env.SECRET, { expiresIn: '15m' });

        const refreshTokenValue = crypto.randomBytes(40).toString('hex');

        // 3. Save the Refresh Token to the database linked to the customer
        await db.insert(refreshTokens).values({
            customerId: customer.id,
            token: refreshTokenValue,
        });

        const isProd = process.env.NODE_ENV === 'production';

        res.cookie('auth_token', token, {
            httpOnly: true, // Prevents client-side JS from reading the cookie
            secure: process.env.NODE_ENV === 'production', // Sends over HTTPS only in production
            signed: true, // Uses your COOKIE_SECRET to sign the cookie value
            maxAge: 15 * 60 * 1000,
            sameSite: isProd ? ('none' as const) : ('lax' as const),
        });

        res.cookie('refresh_token', refreshTokenValue, {
            httpOnly: true,
            signed: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 10 * 365 * 24 * 60 * 60 * 1000, // 10 years
            sameSite: isProd ? ('none' as const) : ('lax' as const),
        });

        const { passwordHash, ...customerWithoutPassword } = customer;

        res.status(200).json({ message: 'Login successful', customer: customerWithoutPassword });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'An error occurred during login.' });
    }
});

// The dedicated refresh route that the frontend calls when auth_token is dead
loginRouter.post('/refresh-token', tokenRefreshLimiter, async (req, res) => {
    const clientRefreshToken = req.signedCookies.refresh_token;

    if (!clientRefreshToken) {
        console.warn(
            '⚠️ Token refresh aborted: No refresh_token token string found in browser cookie headers.'
        );
        return res.status(401).json({ error: 'Unauthenticated: No refresh token' });
    }

    try {
        // 1. Check if this token exists in your database
        const dbToken = await db.query.refreshTokens.findFirst({
            where: (tokens, { eq }) => eq(tokens.token, clientRefreshToken),
        });

        // Token has been manually deleted or session was revoked
        if (!dbToken) {
            return res.status(403).json({ error: 'Session expired or revoked' });
        }

        // 2. Fetch customer metadata to rebuild the core login session
        const customer = await db.query.customers.findFirst({
            where: (c, { eq }) => eq(c.id, dbToken.customerId),
        });

        if (!customer) {
            return res.status(404).json({ error: 'Customer no longer exists' });
        }

        const customerData = {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            role: customer.role,
            subRole: customer.subRole,
        };

        // 3. Re-issue a fresh short-lived access token
        const newAuthToken = jwt.sign(customerData, process.env.SECRET as string, {
            expiresIn: '15m',
        });

        const isProd = process.env.NODE_ENV === 'production';

        // 4. Update the short-lived browser cookie
        res.cookie('auth_token', newAuthToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            signed: true,
            sameSite: isProd ? ('none' as const) : ('lax' as const),
            maxAge: 15 * 60 * 1000,
        });

        return res.json({ message: 'Token refreshed successfully' });
    } catch (error) {
        console.error('Error during token refresh:', error);
        return res.status(500).json({ error: 'Internal server error during token refresh' });
    }
});

export default loginRouter;
