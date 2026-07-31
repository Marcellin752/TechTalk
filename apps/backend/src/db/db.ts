import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { config } from '../config/env.js';

// Prepare: false is safer for local dev and future cloud deployments
const client = postgres(config.databaseUrl, { prepare: false });

export const db = drizzle(client, { schema });
