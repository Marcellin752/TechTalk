import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { config } from '../config/env.js';

const client = postgres(config.databaseUrl, { prepare: false });

export const db = drizzle(client, { schema });
