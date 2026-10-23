import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

if (!process.env.DATABASE_URL) {
    throw new Error('❌ DATABASE_URL is missing!');
}

if (!process.env.TEST_DATABASE_URL) {
    throw new Error('❌ TEST_DATABASE_URL is missing!');
}

export const queryClient =
    process.env.NODE_ENV === 'test'
        ? postgres(process.env.TEST_DATABASE_URL, { max: 10 })
        : postgres(process.env.DATABASE_URL, { max: 10 });

const db = drizzle(queryClient, {
    schema,
    logger: process.env.NODE_ENV === 'development' ? true : false,
});

export default db;
