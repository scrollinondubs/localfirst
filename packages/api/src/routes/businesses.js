import { Hono } from 'hono';
import { businesses } from '../db/schema.js';
import { and, gte, lte, eq, sql } from 'drizzle-orm';

const router = new Hono();

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - First latitude
 * @param {number} lon1 - First longitude
 * @param {number} lat2 - Second latitude
 * @param {number} lon2 - Second longitude
 * @returns {number} Distance in miles
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
 * GET /api/businesses/nearby
 * Get LFA businesses within a radius of a location
 * Query params: lat, lng, radius (in miles, default 5)
 */
router.get('/nearby', async (c) => {
  try {
    const db = c.get('db');
    const lat = parseFloat(c.req.query('lat'));
    const lng = parseFloat(c.req.query('lng'));
    const radius = parseFloat(c.req.query('radius') || '5');

    // Validate parameters
    if (isNaN(lat) || isNaN(lng)) {
      return c.json({ error: 'Invalid latitude or longitude' }, 400);
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return c.json({ error: 'Latitude/longitude out of range' }, 400);
    }

    if (radius <= 0 || radius > 50) {
      return c.json({ error: 'Radius must be between 0 and 50 miles' }, 400);
    }

    // Calculate bounding box for initial filtering (rough approximation)
    const latDelta = radius / 69; // ~69 miles per degree latitude
    const lngDelta = radius / (69 * Math.cos(lat * Math.PI / 180));

    // Query businesses within bounding box
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
        eq(businesses.lfaMember, true), // Only return LFA members
        gte(businesses.latitude, lat - latDelta),
        lte(businesses.latitude, lat + latDelta),
        gte(businesses.longitude, lng - lngDelta),
        lte(businesses.longitude, lng + lngDelta)
      )
    );

    // Calculate exact distances and filter
    const businessesWithDistance = nearbyBusinesses
      .map(business => ({
        ...business,
        distance: calculateDistance(lat, lng, business.latitude, business.longitude)
      }))
      .filter(business => business.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

    return c.json({
      businesses: businessesWithDistance,
      total: businessesWithDistance.length,
      center: { lat, lng },
      radius
    });
  } catch (error) {
    console.error('Error fetching nearby businesses:', error);
    return c.json({ error: 'Failed to fetch businesses' }, 500);
  }
});

/**
 * GET /api/businesses/semantic-search
 * Find LFA businesses that semantically match a search query within map bounds
 * Query params: query, lat, lng, radius (optional), bounds (optional)
 */
router.get('/semantic-search', async (c) => {
  try {
    const db = c.get('db');
    const query = c.req.query('query');
    const lat = parseFloat(c.req.query('lat'));
    const lng = parseFloat(c.req.query('lng'));
    const radius = parseFloat(c.req.query('radius') || '10'); // Default 10 miles
    const limit = parseInt(c.req.query('limit') || '10');

    // Validate required parameters
    if (!query || query.trim().length === 0) {
      return c.json({ error: 'Query parameter is required' }, 400);
    }
    
    if (isNaN(lat) || isNaN(lng)) {
      return c.json({ error: 'Invalid latitude or longitude' }, 400);
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return c.json({ error: 'Latitude/longitude out of range' }, 400);
    }

    if (radius <= 0 || radius > 50) {
      return c.json({ error: 'Radius must be between 0 and 50 miles' }, 400);
    }

    console.log(`[SEARCH] Semantic search: "${query}" near ${lat},${lng} within ${radius} miles`);
    console.log(`[SEARCH] Database connection type:`, typeof db);

    // Calculate bounding box for geographic filtering
    const latDelta = radius / 69; // ~69 miles per degree latitude
    const lngDelta = radius / (69 * Math.cos(lat * Math.PI / 180));
    
    console.log(`[SEARCH] Search bounds: lat [${lat - latDelta}, ${lat + latDelta}], lng [${lng - lngDelta}, ${lng + lngDelta}]`);

    // Get all LFA businesses within geographic bounds
    console.log(`[SEARCH] Starting database query...`);
    
    // First, let's check if we have any businesses at all
    const totalBusinessesCount = await db.select({
      count: businesses.id
    }).from(businesses);
    console.log(`[SEARCH] Total businesses in database:`, totalBusinessesCount.length);
    
    const lfaBusinessesCount = await db.select({
      count: businesses.id
    }).from(businesses).where(eq(businesses.lfaMember, true));
    console.log(`[SEARCH] Total LFA businesses in database:`, lfaBusinessesCount.length);
    
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
      status: businesses.status,
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

    console.log(`[SEARCH] Raw query results: ${nearbyBusinesses.length} businesses found`);
    console.log(`[SEARCH] Sample businesses:`, nearbyBusinesses.slice(0, 3).map(b => ({ name: b.name, category: b.category, lat: b.latitude, lng: b.longitude })));

    // Apply semantic relevance scoring
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    console.log(`[SEARCH] Search terms extracted:`, searchTerms);
    
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

    console.log(`[SEARCH] Scoring complete: ${nearbyBusinesses.length} nearby businesses, ${scoredBusinesses.length} relevant matches`);
    console.log(`[SEARCH] Top 3 scored results:`, scoredBusinesses.slice(0, 3).map(b => ({ 
      name: b.name, 
      category: b.category, 
      relevanceScore: b.relevanceScore, 
      distance: b.distance,
      combinedScore: b.combinedScore 
    })));

    return c.json({
      businesses: scoredBusinesses,
      total: scoredBusinesses.length,
      center: { lat, lng },
      radius,
      query: query,
      searchTerms: searchTerms
    });

  } catch (error) {
    console.error('Error in semantic search:', error);
    return c.json({ error: 'Failed to perform semantic search' }, 500);
  }
});

/**
 * Calculate semantic relevance score for a business based on search query
 * @param {string} businessName - Name of the business
 * @param {string} businessCategory - Category of the business
 * @param {string[]} searchTerms - Array of search terms
 * @param {string} fullQuery - Full search query
 * @returns {number} Relevance score (0-100)
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

/**
 * GET /api/businesses/:id
 * Get a single business by ID (for admin/debugging)
 */
router.get('/:id', async (c) => {
  try {
    const db = c.get('db');
    const id = c.req.param('id');
    
    const business = await db.select()
      .from(businesses)
      .where(eq(businesses.id, id))
      .limit(1);

    if (business.length === 0) {
      return c.json({ error: 'Business not found' }, 404);
    }

    return c.json(business[0]);
  } catch (error) {
    console.error('Error fetching business:', error);
    return c.json({ error: 'Failed to fetch business' }, 500);
  }
});

export default router;