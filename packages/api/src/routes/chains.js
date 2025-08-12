import { Hono } from 'hono';
import { db } from '../db/index.js';
import { chainBusinesses } from '../db/schema.js';
import { gte } from 'drizzle-orm';

const router = new Hono();

/**
 * GET /api/chains
 * Get list of chain business patterns for filtering
 * This data is cached locally by the extension
 */
router.get('/', async (c) => {
  try {
    // Get all chain patterns with high confidence scores
    const chains = await db.select({
      id: chainBusinesses.id,
      name: chainBusinesses.name,
      patterns: chainBusinesses.patterns,
      category: chainBusinesses.category,
      parentCompany: chainBusinesses.parentCompany,
      confidenceScore: chainBusinesses.confidenceScore
    })
    .from(chainBusinesses)
    .where(gte(chainBusinesses.confidenceScore, 80)); // Only high confidence chains

    // Parse patterns JSON
    const chainsWithParsedPatterns = chains.map(chain => ({
      ...chain,
      patterns: chain.patterns ? JSON.parse(chain.patterns) : [chain.name]
    }));

    // Add cache headers for efficient client-side caching
    c.header('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    c.header('ETag', `"chains-${Date.now()}"`);

    return c.json({
      chains: chainsWithParsedPatterns,
      lastUpdated: new Date().toISOString(),
      total: chainsWithParsedPatterns.length
    });
  } catch (error) {
    console.error('Error fetching chain businesses:', error);
    return c.json({ error: 'Failed to fetch chain businesses' }, 500);
  }
});

export default router;