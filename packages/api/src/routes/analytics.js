import { Hono } from 'hono';
import { analyticsEvents, userSessions } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const router = new Hono();

/**
 * POST /api/analytics/events
 * Record analytics events from the extension
 * Accepts batch events to minimize API calls
 */
router.post('/events', async (c) => {
  try {
    const db = c.get('db');
    const body = await c.req.json();
    const { extension_id, events } = body;

    // Validate input
    if (!extension_id || !events || !Array.isArray(events)) {
      return c.json({ error: 'Invalid request body' }, 400);
    }

    // Limit batch size
    if (events.length > 100) {
      return c.json({ error: 'Too many events (max 100)' }, 400);
    }

    // Process events
    const processedEvents = events.map(event => ({
      id: crypto.randomUUID(),
      extensionId: extension_id,
      eventType: event.type || 'unknown',
      businessId: event.business_id || null,
      metadata: event.metadata ? JSON.stringify(event.metadata) : null,
      timestamp: event.timestamp || new Date().toISOString()
    }));

    // Insert events
    if (processedEvents.length > 0) {
      await db.insert(analyticsEvents).values(processedEvents);
    }

    // Update or create user session
    await updateUserSession(extension_id, events, db);

    return c.json({
      success: true,
      processed: processedEvents.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error recording analytics events:', error);
    return c.json({ error: 'Failed to record events' }, 500);
  }
});

/**
 * Update user session data based on events
 */
async function updateUserSession(extensionId, events, db) {
  try {
    // Check if session exists
    const existingSessions = await db.select()
      .from(userSessions)
      .where(eq(userSessions.extensionId, extensionId))
      .limit(1);

    const sessionData = {
      totalInteractions: events.length,
      businessesViewed: events.filter(e => e.type === 'view').length,
      filtersToggled: events.filter(e => e.type === 'filter_toggle').length
    };

    if (existingSessions.length > 0) {
      // Update existing session
      const session = existingSessions[0];
      await db.update(userSessions)
        .set({
          totalInteractions: session.totalInteractions + sessionData.totalInteractions,
          businessesViewed: session.businessesViewed + sessionData.businessesViewed,
          filtersToggled: session.filtersToggled + sessionData.filtersToggled,
          sessionEnd: new Date().toISOString()
        })
        .where(eq(userSessions.id, session.id));
    } else {
      // Create new session
      await db.insert(userSessions).values({
        id: crypto.randomUUID(),
        extensionId: extensionId,
        ...sessionData,
        sessionStart: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error updating user session:', error);
    // Don't fail the request if session update fails
  }
}

/**
 * GET /api/analytics/summary
 * Get analytics summary (for debugging/monitoring)
 */
router.get('/summary', async (c) => {
  try {
    const db = c.get('db');
    // Get total events count
    const totalEvents = await db.select({
      count: db.count()
    })
    .from(analyticsEvents);

    // Get unique users count
    const uniqueUsers = await db.select({
      count: db.count()
    })
    .from(userSessions);

    return c.json({
      totalEvents: totalEvents[0]?.count || 0,
      uniqueUsers: uniqueUsers[0]?.count || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    return c.json({ error: 'Failed to fetch summary' }, 500);
  }
});

export default router;