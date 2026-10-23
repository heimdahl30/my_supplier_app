import { Router } from 'express';
import db from '../db/db.ts';
import { refreshTokens } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { strictActionLimiter } from '../middlewares/rateLimiter.ts';

const logoutRouter = Router();

logoutRouter.post('/', strictActionLimiter, async (req, res) => {
    try {
        const refreshTokenValue = req.signedCookies['refresh_token'];
        if (refreshTokenValue) {
            await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshTokenValue));
        }

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            signed: true,
        };

        // Clear the auth_token and refresh_token cookies
        res.clearCookie('auth_token', cookieOptions);
        res.clearCookie('refresh_token', cookieOptions);

        res.json({ message: 'Logout successful' });
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default logoutRouter;
