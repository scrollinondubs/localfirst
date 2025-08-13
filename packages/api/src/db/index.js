import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';
import * as schema from './schema.js';

// Database connection
const client = createClient({
  url: process.env.DATABASE_URL || 'file:../../local.db',
  authToken: process.env.DATABASE_AUTH_TOKEN
});

const drizzleDb = drizzle(client, { schema });

// Add count helper
drizzleDb.count = () => sql`count(*)`;

export const db = drizzleDb;

export { schema };