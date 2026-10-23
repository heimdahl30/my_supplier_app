require('dotenv').config()
import {defineConfig} from 'drizzle-kit'

const dbUrl = process.env.NODE_ENV === 'test'
  ? process.env.TEST_DATABASE_URL
  : process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error(`❌ Database connection URL is missing for environment: ${process.env.NODE_ENV}`);
}

export default defineConfig({
    schema: './src/db/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
        url: dbUrl!
    }
})