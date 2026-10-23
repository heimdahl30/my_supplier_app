import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    // 🛡️ THE PREFLIGHT SHIELD: Allow OPTIONS handshakes to pass through completely unhindered!
    if (req.method === 'OPTIONS') {
        return next();
    }
    const token = req.signedCookies.auth_token;

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.SECRET as string);
        res.locals.user = decoded;
        next();
    } catch (error) {
        console.error('Token verification failed:', error);
        res.status(403).json({ error: 'Invalid token.' });
    }
};

export default authenticateToken;
