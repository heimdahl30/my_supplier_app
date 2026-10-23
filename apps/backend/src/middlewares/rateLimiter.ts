import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';

// 1. Create and connect the Redis client using your .env variable
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.connect().catch(console.error);

//Protects search/catalog routes from scrapping overload
export const publicCatalogLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute window
    max: 60, // Limit each IP to 60 requests per minute
    message: { error: 'Too many search requests. Please slow down.' },
    standardHeaders: true, // Return rate limit info in the 'RateLimit-*' headers
    legacyHeaders: false, // Disable the 'X-RateLimit-*' headers
    store: new RedisStore({
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
        prefix: 'rl:catalog:',
    }),
});

//Tight lock on heavy database transaction routes (Auth & Checkout)
export const strictActionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minute window
    max: 10, // Limit each IP to 10 attempts per 15 minutes
    message: {
        error: 'Too many sensitive requests from this IP. Please try again after 15 minutes.',
    },
    skip: (req, res) => process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development', // Skip rate limiting in test and development environments
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
        prefix: 'rl:strict:',
    }),
});

export const tokenRefreshLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minute window
    max: 30, // Allows up to 30 refreshes per 5 minutes (Safe for multi-tab users)
    message: { error: 'Too many session renewal attempts. Please log in again.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
        prefix: 'rl:refresh:',
    }),
});

export const adminWorkspaceLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute window
    max: 120, // Allows up to 120 internal network hits per minute per staff IP
    message: { error: 'Too many dashboard requests. Control panel locked momentarily.' },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
        prefix: 'rl:admin:',
    }),
});
