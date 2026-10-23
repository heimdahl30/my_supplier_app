import type { Request, Response, NextFunction } from 'express';

const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    // 1. Double check if user data exists on our scratchpad
    const user = res.locals.user;

    if (!user) {
        return res.status(401).json({ error: 'Unauthenticated.' });
    }

    // 2. Core Gatekeeper: Reject anyone who is not an admin
    if (user.role !== 'admin') {
        return res.status(403).json({
            error: 'Access Denied: Administrative permissions required.',
        });
    }

    // 3. If they are an admin, safely pass them to the next function
    next();
};

export default requireAdmin;
