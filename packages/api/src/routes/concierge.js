import { Hono } from 'hono';
import { userPreferences, consumerProfiles, users, conversationSessions, conciergeRecommendations, businesses } from '../db/schema.js';
import { eq, and, ne, sql } from 'drizzle-orm';
import OpenAI from 'openai';

const concierge = new Hono();

// Initialize OpenAI dynamically per request (for Cloudflare Workers)
function createOpenAIClient(env) {
  try {
    if (env?.OPENAI_API_KEY) {
      return new OpenAI({
        apiKey: env.OPENAI_API_KEY
      });
    } else if (process.env.OPENAI_API_KEY) {
      return new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
    console.log('[CONCIERGE] No OpenAI API key found');
    return null;
  } catch (error) {
    console.error('Error initializing OpenAI:', error);
    return null;
  }
}

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
      businessDescription: businesses.businessDescription,
      businessCategory: businesses.category,
      businessLat: businesses.latitude,
      businessLng: businesses.longitude
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
          categories: r.businessCategory,
          lat: r.businessLat,
          lng: r.businessLng
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
    console.log('🎯 [RECS-GENERATE] POST /api/concierge/recommendations/generate received');
    console.log('🎯 [RECS-GENERATE] Headers:', Object.fromEntries(c.req.raw.headers.entries()));
    
    const userId = c.req.header('X-User-ID');
    console.log('🎯 [RECS-GENERATE] User ID:', userId);
    
    if (!userId) {
      console.log('🎯 [RECS-GENERATE] ERROR: No user ID provided');
      return c.json({ error: 'User ID required' }, 401);
    }

    // Import the matching engine
    const { MatchingEngine } = await import('../services/matching-engine.js');
    const db = c.get('db');
    const matchingEngine = new MatchingEngine(db, c.env);

    // Generate new recommendations
    const recommendations = await matchingEngine.generateRecommendations(userId);

    // Get user profile for AI rationale generation
    const userProfile = await db.select({
      userId: consumerProfiles.userId,
      personalDossier: consumerProfiles.personalDossier,
      interviewInsights: consumerProfiles.interviewInsights,
      interviewTranscript: consumerProfiles.interviewTranscript
    })
    .from(consumerProfiles)
    .where(eq(consumerProfiles.userId, userId))
    .limit(1);

    const profile = userProfile[0] || { userId };

    // Save recommendations to database
    const batchId = crypto.randomUUID();
    const savedRecommendations = [];

    for (const recommendation of recommendations) {
      const recommendationId = crypto.randomUUID();
      
      // Get full business data for AI rationale generation
      const businessData = await db.select({
        id: businesses.id,
        name: businesses.name,
        businessDescription: businesses.businessDescription,
        productsServices: businesses.productsServices,
        primaryCategory: businesses.primaryCategory,
        category: businesses.category
      })
      .from(businesses)
      .where(eq(businesses.id, recommendation.id))
      .limit(1);

      const business = businessData[0] || recommendation;
      
      // Generate AI-powered personalized rationale
      const rationale = await generateRationaleWithOpenAI(recommendation, profile, business, c.env);
      
      await db.insert(conciergeRecommendations).values({
        id: recommendationId,
        userId: userId,
        businessId: recommendation.id,
        recommendationType: 'manual',
        matchScore: recommendation.scoring.total,
        batchId: batchId,
        rationale: rationale,
        rationaleHighlights: JSON.stringify(recommendation.scoring.reasons || []),
        matchingFactors: JSON.stringify({
          profileInterestMatch: recommendation.scoring.profileInterestMatch,
          businessQuality: recommendation.scoring.businessQuality,
          locationProximity: recommendation.scoring.locationProximity,
          categoryDiversity: recommendation.scoring.categoryDiversity,
          temporalRelevance: recommendation.scoring.temporalRelevance,
          distance: recommendation.scoring.distance
        }),
        status: 'pending',
        generationTimeMs: recommendation.scoring.processingTimeMs,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      savedRecommendations.push({
        id: recommendationId,
        businessId: recommendation.id,
        businessName: recommendation.name,
        matchScore: recommendation.scoring.total,
        rationale: rationale
      });
    }

    return c.json({
      message: 'Recommendations generated and saved successfully',
      count: savedRecommendations.length,
      batchId: batchId,
      recommendations: savedRecommendations
    });

  } catch (error) {
    console.error('Error generating recommendations:', error);
    return c.json({ 
      error: 'Failed to generate recommendations',
      details: error.message 
    }, 500);
  }
});

/**
 * Generate AI-powered personalized rationale for recommendation
 */
async function generateRationaleWithOpenAI(recommendation, userProfile, business, env) {
  const openai = createOpenAIClient(env);
  
  if (!openai) {
    console.log('[CONCIERGE] No OpenAI available, using fallback rationale');
    return generateFallbackRationale(recommendation);
  }

  try {
    // Extract user context from personal dossier
    let userContext = 'No detailed profile available';
    if (userProfile.personalDossier) {
      const dossier = JSON.parse(userProfile.personalDossier);
      userContext = `User Profile: ${dossier.summary || ''}`;
      if (dossier.interests && dossier.interests.length > 0) {
        userContext += ` Interests: ${dossier.interests.join(', ')}.`;
      }
    }

    // Create rich business context
    let businessContext = `Business: ${business.name}`;
    if (business.businessDescription) {
      businessContext += `\nDescription: ${business.businessDescription}`;
    }
    if (business.productsServices) {
      try {
        const services = JSON.parse(business.productsServices);
        businessContext += `\nServices: ${JSON.stringify(services)}`;
      } catch (e) {
        businessContext += `\nServices: ${business.productsServices}`;
      }
    }
    if (business.primaryCategory || business.category) {
      businessContext += `\nCategory: ${business.primaryCategory || business.category}`;
    }

    // Create prompt for OpenAI
    const prompt = `You are an AI concierge creating personalized business recommendations. 

${userContext}

${businessContext}

Distance: ${recommendation.scoring.distance.toFixed(1)} miles away
Match Score: ${(recommendation.scoring.total * 100).toFixed(0)}%

Create a compelling, personalized rationale (2-3 sentences max) explaining why this business is specifically recommended for this user. Be specific about how the business aligns with their interests and lifestyle. Avoid generic phrases like "great match" - instead explain the specific connection.

Examples of good rationale:
- "This yoga studio aligns perfectly with your interest in wellness and outdoor activities, offering classes that complement your active lifestyle."
- "As a guitar enthusiast who enjoys live music, this venue's open mic nights and acoustic performances would be ideal for both performing and discovering new talent."

Your rationale:`;

    console.log('[CONCIERGE] Generating OpenAI rationale for:', business.name);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 150,
      temperature: 0.7
    });

    const rationale = response.choices[0].message.content.trim();
    console.log('[CONCIERGE] Generated OpenAI rationale:', rationale);
    
    return rationale;

  } catch (error) {
    console.error('[CONCIERGE] Error generating OpenAI rationale:', error);
    return generateFallbackRationale(recommendation);
  }
}

/**
 * Fallback rationale generation (rule-based)
 */
function generateFallbackRationale(recommendation) {
  const reasons = [];
  const scoring = recommendation.scoring;
  const business = recommendation;
  
  // Interest matching (lowered thresholds and more specific)
  if (scoring.profileInterestMatch > 0.4) {
    reasons.push('Great match for your interests and preferences');
  } else if (scoring.profileInterestMatch > 0.2) {
    reasons.push('Aligns well with your lifestyle');
  } else if (scoring.profileInterestMatch > 0.1) {
    reasons.push('Could be a good fit based on your profile');
  }
  
  // Quality indicators (lowered threshold)
  if (scoring.businessQuality > 0.5) {
    reasons.push('Well-regarded local business');
  } else if (scoring.businessQuality > 0.3) {
    reasons.push('Local business worth exploring');
  }
  
  // Location-based reasoning (more varied)
  if (scoring.distance < 3) {
    reasons.push(`Right nearby at ${scoring.distance.toFixed(1)} miles`);
  } else if (scoring.distance < 8) {
    reasons.push(`Close to you at ${scoring.distance.toFixed(1)} miles`);
  } else if (scoring.distance < 20) {
    reasons.push(`${scoring.distance.toFixed(1)} miles away - worth the drive`);
  } else {
    reasons.push(`${scoring.distance.toFixed(1)} miles away`);
  }
  
  // Add specific reasons from scoring (these come from interest matching)
  if (scoring.reasons && scoring.reasons.length > 0) {
    const specificReasons = scoring.reasons.slice(0, 1); // Take top 1 specific reason
    reasons.push(...specificReasons);
  }
  
  // Business-specific enhancements based on categories
  const category = (business.primaryCategory || business.category || '').toLowerCase();
  if (category.includes('restaurant') || category.includes('food')) {
    reasons.push('Perfect for trying something new');
  } else if (category.includes('music') || category.includes('entertainment')) {
    reasons.push('Great for entertainment and social activities');
  } else if (category.includes('outdoor') || category.includes('recreation')) {
    reasons.push('Ideal for active lifestyle pursuits');
  }
  
  // Ensure we have at least one reason
  if (reasons.length === 0) {
    reasons.push('Recommended based on your location and preferences');
  }
  
  return reasons.slice(0, 3).join('. ') + '.'; // Limit to top 3 reasons
}

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