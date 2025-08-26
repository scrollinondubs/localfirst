import { Hono } from 'hono';
import { userFavorites, businesses } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

const favorites = new Hono();

// Apply authentication middleware to all routes
favorites.use('*', requireAuth);

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
 * GET /api/favorites
 * Get all favorite businesses for the authenticated user
 * Optional query params: lat, lng (for distance calculation)
 */
favorites.get('/', async (c) => {
  try {
    const db = c.get('db');
    const userId = c.get('userId');
    const lat = parseFloat(c.req.query('lat'));
    const lng = parseFloat(c.req.query('lng'));
    
    // Join userFavorites with businesses to get complete business data
    const favoritesQuery = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        address: businesses.address,
        latitude: businesses.latitude,
        longitude: businesses.longitude,
        phone: businesses.phone,
        website: businesses.website,
        category: businesses.category,
        primaryCategory: businesses.primaryCategory,
        subcategory: businesses.subcategory,
        lfaMember: businesses.lfaMember,
        verified: businesses.verified,
        favorited_at: userFavorites.createdAt
      })
      .from(userFavorites)
      .innerJoin(businesses, eq(userFavorites.businessId, businesses.id))
      .where(and(
        eq(userFavorites.userId, userId),
        eq(businesses.status, 'active')
      ))
      .orderBy(desc(userFavorites.createdAt));

    // Add distance calculation if coordinates are provided
    const favoritesWithDistance = favoritesQuery.map(business => {
      const result = { ...business };
      
      // Calculate distance if user provided coordinates
      if (!isNaN(lat) && !isNaN(lng)) {
        result.distance = calculateDistance(lat, lng, business.latitude, business.longitude);
      }
      
      return result;
    });

    // Sort by distance if coordinates were provided
    if (!isNaN(lat) && !isNaN(lng)) {
      favoritesWithDistance.sort((a, b) => a.distance - b.distance);
    }

    return c.json({
      success: true,
      favorites: favoritesWithDistance,
      total: favoritesWithDistance.length
    });

  } catch (error) {
    console.error('Error fetching user favorites:', error);
    return c.json({ error: 'Failed to fetch favorites' }, 500);
  }
});

/**
 * POST /api/favorites/:businessId
 * Add a business to user's favorites
 */
favorites.post('/:businessId', async (c) => {
  try {
    const db = c.get('db');
    const userId = c.get('userId');
    const businessId = c.req.param('businessId');

    if (!businessId || businessId.trim() === '') {
      return c.json({ error: 'Business ID is required' }, 400);
    }

    // Check if business exists and is active
    const business = await db
      .select()
      .from(businesses)
      .where(and(
        eq(businesses.id, businessId),
        eq(businesses.status, 'active')
      ))
      .limit(1);

    if (business.length === 0) {
      return c.json({ error: 'Business not found or inactive' }, 404);
    }

    // Check if already favorited
    const existingFavorite = await db
      .select()
      .from(userFavorites)
      .where(and(
        eq(userFavorites.userId, userId),
        eq(userFavorites.businessId, businessId)
      ))
      .limit(1);

    if (existingFavorite.length > 0) {
      return c.json({ 
        success: true,
        message: 'Business already in favorites',
        isFavorited: true,
        business: {
          id: business[0].id,
          name: business[0].name,
          address: business[0].address,
          category: business[0].category
        }
      });
    }

    // Add to favorites
    const favoriteId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(userFavorites).values({
      id: favoriteId,
      userId,
      businessId,
      createdAt: now,
      updatedAt: now
    });

    return c.json({
      success: true,
      message: 'Business added to favorites',
      isFavorited: true,
      business: {
        id: business[0].id,
        name: business[0].name,
        address: business[0].address,
        category: business[0].category
      },
      favorited_at: now
    }, 201);

  } catch (error) {
    console.error('Error adding business to favorites:', error);
    
    // Handle unique constraint violations
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return c.json({ 
        success: true,
        message: 'Business already in favorites',
        isFavorited: true
      });
    }

    return c.json({ error: 'Failed to add business to favorites' }, 500);
  }
});

/**
 * DELETE /api/favorites/:businessId
 * Remove a business from user's favorites
 */
favorites.delete('/:businessId', async (c) => {
  try {
    const db = c.get('db');
    const userId = c.get('userId');
    const businessId = c.req.param('businessId');

    if (!businessId || businessId.trim() === '') {
      return c.json({ error: 'Business ID is required' }, 400);
    }

    // Check if the favorite exists
    const existingFavorite = await db
      .select()
      .from(userFavorites)
      .where(and(
        eq(userFavorites.userId, userId),
        eq(userFavorites.businessId, businessId)
      ))
      .limit(1);

    if (existingFavorite.length === 0) {
      return c.json({ 
        success: true,
        message: 'Business not in favorites',
        isFavorited: false
      });
    }

    // Remove from favorites
    await db
      .delete(userFavorites)
      .where(and(
        eq(userFavorites.userId, userId),
        eq(userFavorites.businessId, businessId)
      ));

    // Get business info for response
    const business = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        address: businesses.address,
        category: businesses.category
      })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    return c.json({
      success: true,
      message: 'Business removed from favorites',
      isFavorited: false,
      business: business.length > 0 ? business[0] : { id: businessId }
    });

  } catch (error) {
    console.error('Error removing business from favorites:', error);
    return c.json({ error: 'Failed to remove business from favorites' }, 500);
  }
});

/**
 * GET /api/favorites/status/:businessId
 * Check if a business is in user's favorites
 */
favorites.get('/status/:businessId', async (c) => {
  try {
    const db = c.get('db');
    const userId = c.get('userId');
    const businessId = c.req.param('businessId');

    if (!businessId || businessId.trim() === '') {
      return c.json({ error: 'Business ID is required' }, 400);
    }

    // Check if the business is favorited
    const favorite = await db
      .select({
        favorited_at: userFavorites.createdAt
      })
      .from(userFavorites)
      .where(and(
        eq(userFavorites.userId, userId),
        eq(userFavorites.businessId, businessId)
      ))
      .limit(1);

    const isFavorited = favorite.length > 0;

    // Get business info for response
    const business = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        address: businesses.address,
        category: businesses.category,
        lfaMember: businesses.lfaMember
      })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (business.length === 0) {
      return c.json({ error: 'Business not found' }, 404);
    }

    return c.json({
      success: true,
      isFavorited,
      business: business[0],
      favorited_at: isFavorited ? favorite[0].favorited_at : null
    });

  } catch (error) {
    console.error('Error checking favorite status:', error);
    return c.json({ error: 'Failed to check favorite status' }, 500);
  }
});

export default favorites;