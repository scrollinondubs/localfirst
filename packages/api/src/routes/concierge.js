import { Hono } from 'hono';
import { userPreferences, consumerProfiles, users, conversationSessions, conciergeRecommendations, businesses } from '../db/schema.js';
import { eq, and, ne, sql } from 'drizzle-orm';

const concierge = new Hono();

/**
 * GET /api/concierge/preferences
 * Get user preferences with defaults
 */
concierge.get('/preferences', async (c) => {
  try {
    const userId = c.req.header('X-User-ID');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const db = c.get('db');

    // Get existing preferences
    const existingPrefs = await db.select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (existingPrefs.length > 0) {
      const prefs = existingPrefs[0];
      return c.json({
        id: prefs.id,
        userId: prefs.userId,
        notificationFrequency: prefs.notificationFrequency,
        notificationChannels: prefs.notificationChannels ? JSON.parse(prefs.notificationChannels) : {
          in_app: true,
          push: false,
          email: false,
          sms: false
        },
        quietHours: prefs.quietHours ? JSON.parse(prefs.quietHours) : {
          enabled: false,
          start: "22:00",
          end: "08:00"
        },
        preferredDays: prefs.preferredDays ? JSON.parse(prefs.preferredDays) : ["monday", "wednesday", "friday"],
        locationSettings: prefs.locationSettings ? JSON.parse(prefs.locationSettings) : {
          current: "home",
          home: null,
          work: null
        },
        searchRadius: prefs.searchRadius,
        weekendRadius: prefs.weekendRadius,
        lastRecommendationDate: prefs.lastRecommendationDate,
        nextRecommendationDue: prefs.nextRecommendationDue,
        totalRecommendationsReceived: prefs.totalRecommendationsReceived,
        resultsPerNotification: prefs.resultsPerNotification,
        dataUsageConsent: prefs.dataUsageConsent,
        profileSharingLevel: prefs.profileSharingLevel,
        createdAt: prefs.createdAt,
        updatedAt: prefs.updatedAt
      });
    }

    // Return default preferences if none exist
    return c.json({
      userId: userId,
      notificationFrequency: 'weekly',
      notificationChannels: {
        in_app: true,
        push: false,
        email: false,
        sms: false
      },
      quietHours: {
        enabled: false,
        start: "22:00",
        end: "08:00"
      },
      preferredDays: ["monday", "wednesday", "friday"],
      locationSettings: {
        current: "home",
        home: null,
        work: null
      },
      searchRadius: 15,
      weekendRadius: 25,
      resultsPerNotification: 3,
      lastRecommendationDate: null,
      nextRecommendationDue: null,
      totalRecommendationsReceived: 0,
      dataUsageConsent: true,
      profileSharingLevel: 'minimal',
      isDefault: true
    });

  } catch (error) {
    console.error('Error fetching preferences:', error);
    return c.json({ error: 'Failed to fetch preferences' }, 500);
  }
});

/**
 * PUT /api/concierge/preferences
 * Create or update user preferences
 */
concierge.put('/preferences', async (c) => {
  try {
    const userId = c.req.header('X-User-ID');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const body = await c.req.json();
    const db = c.get('db');

    // Validate required fields
    const {
      notificationFrequency,
      notificationChannels,
      quietHours,
      preferredDays,
      locationSettings,
      searchRadius,
      weekendRadius,
      dataUsageConsent,
      profileSharingLevel,
      resultsPerNotification
    } = body;

    // Validate notification frequency
    const validFrequencies = ['daily', 'twice_weekly', 'weekly', 'bi_weekly', 'monthly'];
    if (notificationFrequency && !validFrequencies.includes(notificationFrequency)) {
      return c.json({ error: 'Invalid notification frequency' }, 400);
    }

    // Validate search radii
    if (searchRadius && (searchRadius < 1 || searchRadius > 100)) {
      return c.json({ error: 'Search radius must be between 1 and 100 miles' }, 400);
    }

    if (weekendRadius && (weekendRadius < 1 || weekendRadius > 100)) {
      return c.json({ error: 'Weekend radius must be between 1 and 100 miles' }, 400);
    }

    // Validate profile sharing level
    const validSharingLevels = ['minimal', 'standard', 'detailed'];
    if (profileSharingLevel && !validSharingLevels.includes(profileSharingLevel)) {
      return c.json({ error: 'Invalid profile sharing level' }, 400);
    }

    // Validate results per notification
    if (resultsPerNotification && (resultsPerNotification < 1 || resultsPerNotification > 5)) {
      return c.json({ error: 'Results per notification must be between 1 and 5' }, 400);
    }

    // Check if preferences exist
    const existingPrefs = await db.select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    const updateData = {
      userId: userId,
      notificationFrequency: notificationFrequency || 'weekly',
      notificationChannels: notificationChannels ? JSON.stringify(notificationChannels) : JSON.stringify({
        in_app: true,
        push: false,
        email: false,
        sms: false
      }),
      quietHours: quietHours ? JSON.stringify(quietHours) : JSON.stringify({
        enabled: false,
        start: "22:00",
        end: "08:00"
      }),
      preferredDays: preferredDays ? JSON.stringify(preferredDays) : JSON.stringify(["monday", "wednesday", "friday"]),
      locationSettings: locationSettings ? JSON.stringify(locationSettings) : JSON.stringify({
        current: "home",
        home: null,
        work: null
      }),
      searchRadius: searchRadius || 15,
      weekendRadius: weekendRadius || 25,
      resultsPerNotification: resultsPerNotification || 3,
      dataUsageConsent: dataUsageConsent !== undefined ? dataUsageConsent : true,
      profileSharingLevel: profileSharingLevel || 'minimal',
      updatedAt: new Date().toISOString()
    };

    if (existingPrefs.length > 0) {
      // Update existing preferences
      await db.update(userPreferences)
        .set(updateData)
        .where(eq(userPreferences.userId, userId));

      return c.json({ 
        message: 'Preferences updated successfully',
        updated: true
      });
    } else {
      // Create new preferences
      const prefId = crypto.randomUUID();
      await db.insert(userPreferences).values({
        id: prefId,
        ...updateData,
        createdAt: new Date().toISOString()
      });

      return c.json({ 
        message: 'Preferences created successfully',
        created: true,
        id: prefId
      });
    }

  } catch (error) {
    console.error('Error updating preferences:', error);
    return c.json({ error: 'Failed to update preferences' }, 500);
  }
});

/**
 * PATCH /api/concierge/preferences/location
 * Update only location settings (for permission flows)
 */
concierge.patch('/preferences/location', async (c) => {
  try {
    const userId = c.req.header('X-User-ID');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const body = await c.req.json();
    const { locationSettings } = body;

    if (!locationSettings) {
      return c.json({ error: 'Location settings required' }, 400);
    }

    const db = c.get('db');

    // Check if preferences exist
    const existingPrefs = await db.select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (existingPrefs.length > 0) {
      // Update existing location settings
      await db.update(userPreferences)
        .set({
          locationSettings: JSON.stringify(locationSettings),
          updatedAt: new Date().toISOString()
        })
        .where(eq(userPreferences.userId, userId));
    } else {
      // Create preferences with minimal defaults and the location
      const prefId = crypto.randomUUID();
      await db.insert(userPreferences).values({
        id: prefId,
        userId: userId,
        notificationFrequency: 'weekly',
        notificationChannels: JSON.stringify({
          in_app: true,
          push: false,
          email: false,
          sms: false
        }),
        quietHours: JSON.stringify({
          enabled: false,
          start: "22:00",
          end: "08:00"
        }),
        preferredDays: JSON.stringify(["monday", "wednesday", "friday"]),
        locationSettings: JSON.stringify(locationSettings),
        searchRadius: 15,
        weekendRadius: 25,
        dataUsageConsent: true,
        profileSharingLevel: 'minimal',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    return c.json({ 
      message: 'Location settings updated successfully',
      locationSettings: locationSettings
    });

  } catch (error) {
    console.error('Error updating location:', error);
    return c.json({ error: 'Failed to update location settings' }, 500);
  }
});

/**
 * GET /api/concierge/profile-dossier
 * Get AI-generated profile dossier for editing
 */
concierge.get('/profile-dossier', async (c) => {
  try {
    const userId = c.req.header('X-User-ID');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const db = c.get('db');

    // Get consumer profile with interview data
    const profile = await db.select()
      .from(consumerProfiles)
      .where(eq(consumerProfiles.userId, userId))
      .limit(1);

    if (profile.length === 0) {
      return c.json({ 
        error: 'No profile found. Complete your interview first.' 
      }, 404);
    }

    const userProfile = profile[0];

    return c.json({
      id: userProfile.id,
      userId: userProfile.userId,
      profileCompleteness: userProfile.profileCompleteness,
      lastInterviewDate: userProfile.lastInterviewDate,
      summary: userProfile.interviewSummary || 'No summary available',
      insights: userProfile.interviewInsights ? JSON.parse(userProfile.interviewInsights) : {
        interests: [],
        upcomingNeeds: [],
        values: [],
        giftGiving: [],
        businessTypes: [],
        budgetStyle: 'unknown',
        shoppingStyle: 'unknown'
      },
      preferences: userProfile.preferences ? JSON.parse(userProfile.preferences) : {},
      savedSearches: userProfile.savedSearches ? JSON.parse(userProfile.savedSearches) : [],
      locationPreferences: userProfile.locationPreferences ? JSON.parse(userProfile.locationPreferences) : {},
      createdAt: userProfile.createdAt,
      updatedAt: userProfile.updatedAt
    });

  } catch (error) {
    console.error('Error fetching profile dossier:', error);
    return c.json({ error: 'Failed to fetch profile dossier' }, 500);
  }
});

/**
 * PUT /api/concierge/profile-dossier
 * Update AI-generated profile dossier with user edits
 */
concierge.put('/profile-dossier', async (c) => {
  try {
    const userId = c.req.header('X-User-ID');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const body = await c.req.json();
    const db = c.get('db');

    // Get existing profile
    const existingProfile = await db.select()
      .from(consumerProfiles)
      .where(eq(consumerProfiles.userId, userId))
      .limit(1);

    if (existingProfile.length === 0) {
      return c.json({ error: 'No profile found' }, 404);
    }

    // Update profile with user edits
    const updateData = {
      updatedAt: new Date().toISOString()
    };

    if (body.summary) {
      updateData.interviewSummary = body.summary;
    }

    if (body.insights) {
      updateData.interviewInsights = JSON.stringify(body.insights);
    }

    if (body.preferences) {
      updateData.preferences = JSON.stringify(body.preferences);
    }

    if (body.savedSearches) {
      updateData.savedSearches = JSON.stringify(body.savedSearches);
    }

    if (body.locationPreferences) {
      updateData.locationPreferences = JSON.stringify(body.locationPreferences);
    }

    await db.update(consumerProfiles)
      .set(updateData)
      .where(eq(consumerProfiles.userId, userId));

    return c.json({ 
      message: 'Profile dossier updated successfully',
      updatedFields: Object.keys(updateData).filter(key => key !== 'updatedAt')
    });

  } catch (error) {
    console.error('Error updating profile dossier:', error);
    return c.json({ error: 'Failed to update profile dossier' }, 500);
  }
});

/**
 * GET /api/concierge/eligibility
 * Check if user is eligible for recommendations feature
 */
concierge.get('/eligibility', async (c) => {
  try {
    const userId = c.req.header('X-User-ID');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const db = c.get('db');

    // Check if user has valid preferences saved
    const preferences = await db.select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    const hasPreferences = preferences.length > 0;

    // Check if user has personal dossier with at least 100 characters
    const profile = await db.select({
      personalDossier: consumerProfiles.personalDossier
    })
      .from(consumerProfiles)
      .where(eq(consumerProfiles.userId, userId))
      .limit(1);

    const dossierText = profile.length > 0 ? profile[0].personalDossier : null;
    const hasDossier = dossierText && dossierText.length >= 100;
    const dossierLength = dossierText ? dossierText.length : 0;

    // Also check current interview progress for UI guidance
    const interviews = await db.select()
      .from(conversationSessions)
      .where(eq(conversationSessions.userId, userId))
      .limit(1);

    const messageCount = interviews[0]?.messageCount || 0;
    const userMessageCount = interviews.length > 0 ? 
      JSON.parse(interviews[0].messages || '[]').filter(msg => msg.role === 'user').length : 0;
    
    const hasCompletedInterview = userMessageCount >= 3;

    return c.json({
      eligible: hasPreferences && hasDossier && hasCompletedInterview,
      hasPreferences,
      hasDossier,
      hasCompletedInterview,
      dossierLength,
      messageCount,
      userMessageCount
    });

  } catch (error) {
    console.error('Error checking eligibility:', error);
    return c.json({ error: 'Failed to check eligibility' }, 500);
  }
});

/**
 * GET /api/concierge/recommendations
 * Fetch user's recommendations with business details
 */
concierge.get('/recommendations', async (c) => {
  try {
    const userId = c.req.header('X-User-ID');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    const db = c.get('db');

    // Get recommendations with business details, excluding dismissed ones
    const recommendations = await db.select({
      id: conciergeRecommendations.id,
      businessId: conciergeRecommendations.businessId,
      matchScore: conciergeRecommendations.matchScore,
      rationale: conciergeRecommendations.rationale,
      status: conciergeRecommendations.status,
      createdAt: conciergeRecommendations.createdAt,
      // Business details
      businessName: businesses.name,
      businessAddress: businesses.address,
      businessPhone: businesses.phone,
      businessWebsite: businesses.website,
      businessDescription: businesses.description,
      businessCategories: businesses.categories,
      businessLat: businesses.lat,
      businessLng: businesses.lng,
      businessRating: businesses.rating,
      businessImage: businesses.image
    })
    .from(conciergeRecommendations)
    .innerJoin(businesses, eq(conciergeRecommendations.businessId, businesses.id))
    .where(and(
      eq(conciergeRecommendations.userId, userId),
      ne(conciergeRecommendations.status, 'dismissed')
    ))
    .orderBy(sql`${conciergeRecommendations.createdAt} DESC`)
    .limit(50);

    return c.json({
      recommendations: recommendations.map(r => ({
        id: r.id,
        matchScore: r.matchScore,
        rationale: r.rationale,
        status: r.status,
        createdAt: r.createdAt,
        business: {
          id: r.businessId,
          name: r.businessName,
          address: r.businessAddress,
          phone: r.businessPhone,
          website: r.businessWebsite,
          description: r.businessDescription,
          categories: r.businessCategories,
          lat: r.businessLat,
          lng: r.businessLng,
          rating: r.businessRating,
          image: r.businessImage
        }
      }))
    });

  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return c.json({ error: 'Failed to fetch recommendations' }, 500);
  }
});

/**
 * POST /api/concierge/recommendations/generate
 * Manually trigger new recommendations generation
 */
concierge.post('/recommendations/generate', async (c) => {
  try {
    const userId = c.req.header('X-User-ID');
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    // Import the matching engine
    const { MatchingEngine } = await import('../services/matching-engine.js');
    const db = c.get('db');
    const matchingEngine = new MatchingEngine(db, c.env);

    // Generate new recommendations
    const recommendations = await matchingEngine.generateRecommendations(userId);

    return c.json({
      message: 'Recommendations generated successfully',
      count: recommendations.length,
      recommendations: recommendations.map(r => ({
        businessId: r.businessId,
        matchScore: r.matchScore,
        rationale: r.rationale
      }))
    });

  } catch (error) {
    console.error('Error generating recommendations:', error);
    return c.json({ error: 'Failed to generate recommendations' }, 500);
  }
});

/**
 * PATCH /api/concierge/recommendations/:id/dismiss
 * Mark recommendation as dismissed
 */
concierge.patch('/recommendations/:id/dismiss', async (c) => {
  try {
    const userId = c.req.header('X-User-ID');
    const recommendationId = c.req.param('id');
    
    if (!userId) {
      return c.json({ error: 'User ID required' }, 401);
    }

    if (!recommendationId) {
      return c.json({ error: 'Recommendation ID required' }, 400);
    }

    const db = c.get('db');

    // Verify recommendation belongs to user and update status
    const result = await db.update(conciergeRecommendations)
      .set({
        status: 'dismissed',
        updatedAt: new Date().toISOString()
      })
      .where(and(
        eq(conciergeRecommendations.id, recommendationId),
        eq(conciergeRecommendations.userId, userId)
      ));

    return c.json({
      message: 'Recommendation dismissed successfully',
      recommendationId
    });

  } catch (error) {
    console.error('Error dismissing recommendation:', error);
    return c.json({ error: 'Failed to dismiss recommendation' }, 500);
  }
});

export { concierge };