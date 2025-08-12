import { Hono } from 'hono';
import { db } from '../db/index.js';
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
 * GET /api/businesses/:id
 * Get a single business by ID (for admin/debugging)
 */
router.get('/:id', async (c) => {
  try {
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