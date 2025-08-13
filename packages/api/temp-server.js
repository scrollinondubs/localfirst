import { createServer } from 'http';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { chainBusinesses } from './src/db/schema.js';
import { gte } from 'drizzle-orm';

// Database connection - using absolute path
const client = createClient({
  url: 'file:/Users/sean/NodeJSprojs/localfirst/local.db',
});

const db = drizzle(client);

const server = createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:8787`);

  try {
    if (req.method === 'GET' && url.pathname === '/') {
      // Health check
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'ok',
        service: 'Local First Arizona API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/chains') {
      // Get chain patterns
      const chains = await db.select({
        id: chainBusinesses.id,
        name: chainBusinesses.name,
        patterns: chainBusinesses.patterns,
        category: chainBusinesses.category,
        parentCompany: chainBusinesses.parentCompany,
        confidenceScore: chainBusinesses.confidenceScore
      })
      .from(chainBusinesses)
      .where(gte(chainBusinesses.confidenceScore, 80));

      // Parse patterns JSON
      const chainsWithParsedPatterns = chains.map(chain => ({
        ...chain,
        patterns: chain.patterns ? JSON.parse(chain.patterns) : [chain.name]
      }));

      res.writeHead(200, {
        'Cache-Control': 'public, max-age=86400',
        'ETag': `"chains-${Date.now()}"`
      });
      
      res.end(JSON.stringify({
        chains: chainsWithParsedPatterns,
        lastUpdated: new Date().toISOString(),
        total: chainsWithParsedPatterns.length
      }));
      return;
    }

    // 404 for other routes
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not Found' }));

  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
});

const port = 8787;
server.listen(port, () => {
  console.log(`Local First Arizona API running on http://localhost:${port}`);
});