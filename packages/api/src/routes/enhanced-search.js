import { Hono } from 'hono';
import { businesses } from '../db/schema.js';
import { and, gte, lte, eq, isNotNull, sql, or, like } from 'drizzle-orm';

const router = new Hono();

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
 * Enhanced relevance scoring using enriched business data
 */
function calculateEnhancedRelevanceScore(business, searchTerms, fullQuery) {
  const query = fullQuery.toLowerCase();
  let score = 0;
  let matchReasons = [];
  let hasContentMatch = false; // Track if there's any actual content match
  
  // Business name matching (highest priority - enhanced for literal matching)
  const name = business.name.toLowerCase();
  
  
  // Exact query match in name (highest score)
  if (name.includes(query)) {
    score += 200;
    matchReasons.push(`Exact match in business name`);
    hasContentMatch = true;
  } 
  // Individual search term matching in name
  else {
    const nameMatches = searchTerms.filter(term => name.includes(term)).length;
    if (nameMatches > 0) {
      score += nameMatches * 40; // Increased from 20 to 40
      matchReasons.push(`${nameMatches} term(s) matched in business name`);
      hasContentMatch = true;
    }
  }
  
  // Additional fuzzy matching for partial word matches in name
  // This catches cases where search term is part of a word in the name
  for (const term of searchTerms) {
    if (term.length >= 3) { // Only for terms 3+ characters
      const words = name.split(/\s+/);
      for (const word of words) {
        if (word.includes(term) && !name.includes(term)) {
          score += 30;
          matchReasons.push(`Partial word match "${term}" in business name`);
          hasContentMatch = true;
          break; // Only count once per search term
        }
      }
    }
  }
  
  // Enhanced category matching with taxonomy
  if (business.primaryCategory && business.subcategory) {
    const categoryText = `${business.primaryCategory} ${business.subcategory}`.replace(/_/g, ' ').toLowerCase();
    
    if (categoryText.includes(query)) {
      score += 80;
      matchReasons.push(`Category match: ${business.primaryCategory} > ${business.subcategory}`);
      hasContentMatch = true;
    } else {
      const categoryMatches = searchTerms.filter(term => categoryText.includes(term)).length;
      if (categoryMatches > 0) {
        score += categoryMatches * 15;
        matchReasons.push(`${categoryMatches} term(s) matched in category`);
        hasContentMatch = true;
      }
    }
  }
  
  // Business description matching (new enhancement!)
  if (business.businessDescription) {
    const description = business.businessDescription.toLowerCase();
    if (description.includes(query)) {
      score += 60;
      matchReasons.push(`Match found in business description`);
      hasContentMatch = true;
    } else {
      const descriptionMatches = searchTerms.filter(term => description.includes(term)).length;
      if (descriptionMatches > 0) {
        score += descriptionMatches * 8;
        matchReasons.push(`${descriptionMatches} term(s) matched in description`);
        hasContentMatch = true;
      }
    }
  }
  
  // Keywords matching (new enhancement!)
  if (business.keywords) {
    const keywords = business.keywords.toLowerCase();
    if (keywords.includes(query)) {
      score += 50;
      matchReasons.push(`Match found in business keywords`);
      hasContentMatch = true;
    } else {
      const keywordMatches = searchTerms.filter(term => keywords.includes(term)).length;
      if (keywordMatches > 0) {
        score += keywordMatches * 10;
        matchReasons.push(`${keywordMatches} term(s) matched in keywords`);
        hasContentMatch = true;
      }
    }
  }
  
  // Products/Services matching (new enhancement!)
  if (business.productsServices) {
    try {
      const services = JSON.parse(business.productsServices);
      const servicesText = JSON.stringify(services).toLowerCase();
      
      if (servicesText.includes(query)) {
        score += 40;
        matchReasons.push(`Match found in products/services`);
        hasContentMatch = true;
      } else {
        const serviceMatches = searchTerms.filter(term => servicesText.includes(term)).length;
        if (serviceMatches > 0) {
          score += serviceMatches * 6;
          matchReasons.push(`${serviceMatches} term(s) matched in products/services`);
          hasContentMatch = true;
        }
      }
    } catch (e) {
      // Ignore JSON parsing errors
    }
  }
  
  // Business attributes bonus (only if query is relevant)
  if (business.businessAttributes) {
    try {
      const attributes = JSON.parse(business.businessAttributes);
      if (attributes.woman_owned && (query.includes('woman') || query.includes('female'))) {
        score += 15;
        hasContentMatch = true;
      }
      if (attributes.veteran_owned && (query.includes('veteran') || query.includes('military'))) {
        score += 15;
        hasContentMatch = true;
      }
      if (attributes.family_owned && (query.includes('family') || query.includes('local'))) {
        score += 10;
        hasContentMatch = true;
      }
    } catch (e) {
      // Ignore JSON parsing errors
    }
  }
  
  // Only award verification and enrichment bonuses if there's actual content match
  if (hasContentMatch) {
    // Verified business bonus
    if (business.verified) {
      score += 5;
      matchReasons.push('Verified business');
    }
    
    // Enriched business bonus (has quality data)
    if (business.primaryCategory && business.businessDescription) {
      score += 3;
      matchReasons.push('Enhanced business profile');
    }
  }
  
  return {
    score: Math.min(score, 150), // Cap at 150
    matchReasons: matchReasons,
    hasContentMatch: hasContentMatch
  };
}


/**
 * GET /api/enhanced-search
 * Enhanced semantic search using enriched business data
 * Query params: query, lat, lng, radius, limit, category_filter
 */
router.get('/', async (c) => {
  try {
    const db = c.get('db');
    const query = c.req.query('query')?.trim();
    const lat = parseFloat(c.req.query('lat'));
    const lng = parseFloat(c.req.query('lng'));
    const radius = parseFloat(c.req.query('radius') || '15'); // Default 15 miles
    const limit = parseInt(c.req.query('limit') || '20'); // Default 20 results
    const categoryFilter = c.req.query('category_filter'); // Optional category filter
    const includeUnenriched = c.req.query('include_unenriched') !== 'false'; // Default true

    // Validate required parameters
    if (!query || query.length === 0) {
      return c.json({ error: 'Query parameter is required' }, 400);
    }
    
    if (isNaN(lat) || isNaN(lng)) {
      return c.json({ error: 'Invalid latitude or longitude' }, 400);
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return c.json({ error: 'Latitude/longitude out of range' }, 400);
    }

    if (radius <= 0 || radius > 100) {
      return c.json({ error: 'Radius must be between 0 and 100 miles' }, 400);
    }

    console.log(`[ENHANCED-SEARCH] Query: "${query}" near ${lat},${lng} within ${radius} miles`);
    
    // Calculate bounding box for geographic filtering
    const latDelta = radius / 69; // ~69 miles per degree latitude
    const lngDelta = radius / (69 * Math.cos(lat * Math.PI / 180));
    
    
    // Query businesses directly with explicit conditions (avoiding array issues)
    let baseQuery = db.select({
      id: businesses.id,
      name: businesses.name,
      address: businesses.address,
      latitude: businesses.latitude,
      longitude: businesses.longitude,
      phone: businesses.phone,
      website: businesses.website,
      category: businesses.category, // Legacy category
      primaryCategory: businesses.primaryCategory,
      subcategory: businesses.subcategory,
      businessDescription: businesses.businessDescription,
      keywords: businesses.keywords,
      productsServices: businesses.productsServices,
      businessAttributes: businesses.businessAttributes,
      lfaMember: businesses.lfaMember,
      verified: businesses.verified,
      enrichmentStatus: businesses.enrichmentStatus,
      enrichmentDate: businesses.enrichmentDate
    })
    .from(businesses);

    // Build all WHERE conditions in one array like the test query
    let whereConditions = [
      eq(businesses.status, 'active'),
      eq(businesses.lfaMember, 1),
      gte(businesses.latitude, lat - latDelta),
      lte(businesses.latitude, lat + latDelta),
      gte(businesses.longitude, lng - lngDelta),
      lte(businesses.longitude, lng + lngDelta)
    ];
    
    // Add enrichment filter only if explicitly requested
    if (includeUnenriched === false) {
      whereConditions.push(isNotNull(businesses.primaryCategory));
    }
    
    // Add category filter if specified
    if (categoryFilter) {
      whereConditions.push(eq(businesses.primaryCategory, categoryFilter));
    }
    
    const nearbyBusinesses = await baseQuery.where(and(...whereConditions));

    console.log(`[ENHANCED-SEARCH] Found ${nearbyBusinesses.length} businesses in area`);
    

    // Apply enhanced semantic relevance scoring
    const searchTerms = query.toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 2)
      .map(term => term.replace(/[^a-z0-9]/g, ''));
    
    console.log(`[ENHANCED-SEARCH] Search terms:`, searchTerms);
    
    const scoredBusinesses = nearbyBusinesses
      .map(business => {
        const relevance = calculateEnhancedRelevanceScore(business, searchTerms, query);
        const distance = calculateDistance(lat, lng, business.latitude, business.longitude);
        
        // Enhanced combined scoring
        const distancePenalty = distance * 1.5; // Reduced distance penalty
        const enrichmentBonus = business.primaryCategory ? 10 : 0;
        const verificationBonus = business.verified ? 8 : 0;
        
        const combinedScore = relevance.score - distancePenalty + enrichmentBonus + verificationBonus;
        
        return {
          id: business.id,
          name: business.name,
          address: business.address,
          latitude: business.latitude,
          longitude: business.longitude,
          phone: business.phone,
          website: business.website,
          category: business.primaryCategory || business.category, // Use enriched category first
          subcategory: business.subcategory,
          businessDescription: business.businessDescription,
          keywords: business.keywords ? business.keywords.split(', ') : [],
          productsServices: business.productsServices ? JSON.parse(business.productsServices) : null,
          businessAttributes: business.businessAttributes ? JSON.parse(business.businessAttributes) : {},
          lfaMember: business.lfaMember,
          verified: business.verified,
          enrichmentStatus: business.enrichmentStatus,
          // Search metadata
          distance: Math.round(distance * 100) / 100,
          relevanceScore: relevance.score,
          combinedScore: Math.round(combinedScore * 100) / 100,
          matchReasons: relevance.matchReasons,
          isEnriched: !!business.primaryCategory
        };
      })
      .filter(business => {
        // Only include businesses that have actual content matches
        // This prevents random results for nonsensical queries like "asdf"
        const hasNameMatch = business.matchReasons.some(reason => 
          reason.includes('business name') || reason.includes('Partial word match')
        );
        const hasContentMatch = business.matchReasons.some(reason => 
          !reason.includes('Verified business') && !reason.includes('Enhanced business profile')
        );
        return hasContentMatch || hasNameMatch;
      })
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, limit);

    // Get category breakdown for faceted search
    const categoryBreakdown = {};
    scoredBusinesses.forEach(business => {
      const cat = business.category || 'other';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    });


    return c.json({
      businesses: scoredBusinesses,
      total: scoredBusinesses.length,
      query: query,
      searchTerms: searchTerms,
      center: { lat, lng },
      radius,
      categoryBreakdown,
      searchMetadata: {
        enhancedSearch: true,
        enrichedBusinessesCount: scoredBusinesses.filter(b => b.isEnriched).length,
        avgRelevanceScore: scoredBusinesses.length > 0 
          ? Math.round((scoredBusinesses.reduce((sum, b) => sum + b.relevanceScore, 0) / scoredBusinesses.length) * 100) / 100 
          : 0
      }
    });

  } catch (error) {
    console.error('Error in enhanced search:', error);
    return c.json({ error: 'Failed to perform enhanced search' }, 500);
  }
});

/**
 * GET /api/enhanced-search/categories
 * Get available categories from enriched businesses
 */
router.get('/categories', async (c) => {
  try {
    const db = c.get('db');
    
    const categories = await db.select({
      primaryCategory: businesses.primaryCategory,
      subcategory: businesses.subcategory,
      count: sql`count(*)`
    })
    .from(businesses)
    .where(and(
      eq(businesses.status, 'active'),
      eq(businesses.lfaMember, true),
      isNotNull(businesses.primaryCategory)
    ))
    .groupBy(businesses.primaryCategory, businesses.subcategory)
    .orderBy(sql`count(*) desc`);

    // Group by primary category
    const categoryGroups = {};
    categories.forEach(cat => {
      if (!categoryGroups[cat.primaryCategory]) {
        categoryGroups[cat.primaryCategory] = {
          name: cat.primaryCategory,
          displayName: cat.primaryCategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          subcategories: [],
          totalCount: 0
        };
      }
      
      if (cat.subcategory) {
        categoryGroups[cat.primaryCategory].subcategories.push({
          name: cat.subcategory,
          displayName: cat.subcategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          count: cat.count
        });
      }
      
      categoryGroups[cat.primaryCategory].totalCount += cat.count;
    });

    return c.json({
      categories: Object.values(categoryGroups).sort((a, b) => b.totalCount - a.totalCount)
    });

  } catch (error) {
    console.error('Error fetching categories:', error);
    return c.json({ error: 'Failed to fetch categories' }, 500);
  }
});

export default router;