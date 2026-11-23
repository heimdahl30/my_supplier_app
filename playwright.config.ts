import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/backend/.env') });

export default defineConfig({
    testDir: './e2e/tests',
    fullyParallel: false, // Run sequentially so database states don't collide
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: [['html', { open: 'never' }], ['list']],
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        // Automatically grant GPS permissions & set Jamshedpur coordinates in real Chromium!
        permissions: ['geolocation'],
        geolocation: { latitude: 22.8046, longitude: 86.2029 },
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    // Automatically starts Backend (test mode) + Next.js Frontend before tests run!
    webServer: [
        {
            command: 'pnpm --filter my-supply-app-express-backend dev:test',
            url: 'http://localhost:5000/api/v1/products',
            reuseExistingServer: !process.env.CI,
            timeout: 60000,
        },
        {
            command: 'pnpm --filter frontend dev',
            url: 'http://localhost:3000',
            env: {
                PORT: '3000',
            },
            reuseExistingServer: !process.env.CI,
            timeout: 60000,
        },
    ],
});
