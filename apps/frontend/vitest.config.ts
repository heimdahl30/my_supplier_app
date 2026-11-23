import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom', // Sets up virtual web browser variables
        globals: true,
        setupFiles: './vitest.setup.ts', // Bootstraps global matchers before running
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
