import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';
import * as schema from './schema.js';

// Database connection factory - accepts env from Cloudflare Workers context
function createDatabase(env = {}) {
  const client = createClient({
    url: env.DATABASE_URL || 'file:../../local.db',
    authToken: env.DATABASE_AUTH_TOKEN
  });

  const drizzleDb = drizzle(client, { schema });
  
  // Add count helper
  drizzleDb.count = () => sql`count(*)`;
  
  return drizzleDb;
}

// Default export for compatibility
export const db = createDatabase();

// Export factory function for Workers
export { createDatabase };

export { schema };