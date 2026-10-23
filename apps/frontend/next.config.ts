// apps/frontend/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    images: {
        // 🟢 THE BULLETPROOF LOCK: Whitelists localhost on ALL paths and patterns!
        remotePatterns: [
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '5000',
                pathname: '**', // Matches anything, including double slashes or subfolders!
            },
        ],
    },
};

export default nextConfig;
