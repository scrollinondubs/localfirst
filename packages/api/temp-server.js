import { createServer } from 'http';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { chainBusinesses, businesses } from './src/db/schema.js';
import { gte, lte, eq, and } from 'drizzle-orm';

// Database connection - using absolute path
const dbPath = 'file:/Users/sean/NodeJSprojs/localfirst/local.db';
console.log('TEMP SERVER: Connecting to database at:', dbPath);
const client = createClient({
  url: dbPath,
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
      
      console.log(`TEMP SERVER: Found ${chains.length} chains in database`);
      console.log('TEMP SERVER: Sample chains:', chains.slice(0, 3).map(c => c.name));

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

    if (req.method === 'GET' && url.pathname === '/api/businesses/semantic-search') {
      // Semantic business search
      const query = url.searchParams.get('query');
      const lat = parseFloat(url.searchParams.get('lat'));
      const lng = parseFloat(url.searchParams.get('lng'));
      const radius = parseFloat(url.searchParams.get('radius') || '10');
      const limit = parseInt(url.searchParams.get('limit') || '10');

      // Validate parameters
      if (!query || query.trim().length === 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Query parameter is required' }));
        return;
      }
      
      if (isNaN(lat) || isNaN(lng)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid latitude or longitude' }));
        return;
      }

      console.log(`TEMP SERVER: Semantic search: "${query}" near ${lat},${lng} within ${radius} miles`);

      // Calculate bounding box for geographic filtering
      const latDelta = radius / 69; // ~69 miles per degree latitude
      const lngDelta = radius / (69 * Math.cos(lat * Math.PI / 180));

      // Get all LFA businesses within geographic bounds
      const nearbyBusinesses = await db.select({
        id: businesses.id,
        name: businesses.name,
        address: businesses.address,
        latitude: businesses.latitude,
        longitude: businesses.longitude,
        phone: businesses.phone,
        website: businesses.website,
        category: businesses.category,
        lfaMember: businesses.lfaMember,
        verified: businesses.verified,
      })
      .from(businesses)
      .where(
        and(
          eq(businesses.status, 'active'),
          eq(businesses.lfaMember, true),
          gte(businesses.latitude, lat - latDelta),
          lte(businesses.latitude, lat + latDelta),
          gte(businesses.longitude, lng - lngDelta),
          lte(businesses.longitude, lng + lngDelta)
        )
      );

      // Apply semantic relevance scoring
      const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
      const scoredBusinesses = nearbyBusinesses
        .map(business => {
          const relevanceScore = calculateRelevanceScore(business.name, business.category, searchTerms, query);
          const distance = calculateDistance(lat, lng, business.latitude, business.longitude);
          
          return {
            ...business,
            distance: distance,
            relevanceScore: relevanceScore,
            // Combined score: relevance (0-100) + distance penalty + verification bonus
            combinedScore: relevanceScore - (distance * 2) + (business.verified ? 10 : 0)
          };
        })
        .filter(business => business.relevanceScore > 10) // Only include somewhat relevant results
        .sort((a, b) => b.combinedScore - a.combinedScore) // Sort by combined score descending
        .slice(0, limit);

      console.log(`TEMP SERVER: Found ${nearbyBusinesses.length} nearby businesses, ${scoredBusinesses.length} relevant matches`);

      res.writeHead(200);
      res.end(JSON.stringify({
        businesses: scoredBusinesses,
        total: scoredBusinesses.length,
        center: { lat, lng },
        radius,
        query: query,
        searchTerms: searchTerms
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

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate semantic relevance score for a business based on search query
 */
function calculateRelevanceScore(businessName, businessCategory, searchTerms, fullQuery) {
  const name = businessName.toLowerCase();
  const category = businessCategory.toLowerCase();
  const query = fullQuery.toLowerCase();
  
  let score = 0;
  
  // Exact query match in name (highest score)
  if (name.includes(query)) {
    score += 80;
  }
  
  // Individual term matches in name
  const nameTermMatches = searchTerms.filter(term => name.includes(term)).length;
  score += nameTermMatches * 15;
  
  // Category relevance mapping
  const categoryMappings = {
    'restaurant': ['food', 'restaurant', 'dining', 'eat', 'cafe', 'bar', 'grill', 'kitchen', 'cook'],
    'grocery': ['grocery', 'market', 'food', 'supermarket', 'deli', 'fresh', 'organic'],
    'retail': ['shop', 'store', 'retail', 'buy', 'sell', 'boutique', 'outlet'],
    'professional_services': ['service', 'professional', 'business', 'office', 'consultant', 'agency'],
    'health_wellness': ['health', 'medical', 'wellness', 'fitness', 'clinic', 'doctor', 'spa'],
    'automotive': ['auto', 'car', 'vehicle', 'repair', 'garage', 'mechanic'],
    'home_garden': ['home', 'garden', 'hardware', 'improvement', 'repair', 'construction']
  };
  
  // Check if search terms match business category
  for (const [cat, keywords] of Object.entries(categoryMappings)) {
    if (category === cat || category.includes(cat)) {
      const matchingKeywords = searchTerms.filter(term => keywords.includes(term)).length;
      score += matchingKeywords * 10;
    }
  }
  
  // Business name indicates local/independent (bonus points)
  const localIndicators = ['local', 'family', 'neighborhood', 'corner', 'mom', 'pop', 'artisan', 'craft', 'homemade'];
  const localMatches = localIndicators.filter(indicator => name.includes(indicator)).length;
  score += localMatches * 5;
  
  // Fuzzy matching for common variations
  const synonyms = {
    'restaurant': ['eatery', 'bistro', 'diner', 'cafe'],
    'grocery': ['market', 'supermarket', 'food store'],
    'shop': ['store', 'boutique', 'outlet'],
    'repair': ['fix', 'service', 'maintenance']
  };
  
  for (const [base, variants] of Object.entries(synonyms)) {
    if (searchTerms.includes(base)) {
      const variantMatches = variants.filter(variant => name.includes(variant)).length;
      score += variantMatches * 8;
    }
  }
  
  // Ensure score doesn't exceed 100
  return Math.min(score, 100);
}

const port = 8787;
server.listen(port, () => {
  console.log(`Local First Arizona API running on http://localhost:${port}`);
});