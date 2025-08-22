import { drizzle } from 'drizzle-orm/libsql';
import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';
import * as schema from './schema.js';

// Database connection factory - accepts env from Cloudflare Workers context
function createDatabase(env = {}) {
  // If we have a D1 binding (Cloudflare Workers environment), use it directly
  if (env.DB) {
    const drizzleDb = drizzleD1(env.DB, { schema });
    // Add count helper
    drizzleDb.count = () => sql`count(*)`;
    return drizzleDb;
  }
  
  // Otherwise, use libsql client for local development
  const client = createClient({
    url: env.DATABASE_URL || 'file:../../local.db',
    authToken: env.DATABASE_AUTH_TOKEN
  });

  const drizzleDb = drizzle(client, { schema });
  
  // Add count helper
  drizzleDb.count = () => sql`count(*)`;
  
  return drizzleDb;
}

// Default export for compatibility (local development)
// Note: Use createDatabase(env) in Workers context instead
export const db = null;

// Export factory function for Workers
export { createDatabase };

export { schema };