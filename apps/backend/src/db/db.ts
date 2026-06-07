import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is missing!');
}

// Prepare: false is safer for local dev and future cloud deployments
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
