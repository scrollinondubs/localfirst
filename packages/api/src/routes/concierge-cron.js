import { Hono } from 'hono';
import { userPreferences, conciergeRecommendations, recommendationLogs, consumerProfiles } from '../db/schema.js';
import { eq, lte, and, isNotNull, gte, sql } from 'drizzle-orm';
import { MatchingEngine } from '../services/matching-engine.js';

const conciergeCron = new Hono();

/**
 * Process users in batches for AI recommendations
 */
class ConciergeProcessor {
  constructor(db, env) {
    this.db = db;
    this.env = env;
    this.batchSize = 50;
    this.maxProcessingTime = 25000; // 25 seconds
    this.startTime = Date.now();
  }

  /**
   * Check if we're approaching timeout limit
   */
  isApproachingTimeout() {
    return (Date.now() - this.startTime) > (this.maxProcessingTime - 5000);
  }

  /**
   * Get eligible users for recommendations
   */
  async getEligibleUsers(limit = 100) {
    const now = new Date().toISOString();
    const currentHour = new Date().getHours();
    const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    console.log(`[CONCIERGE-CRON] Checking for eligible users at ${now}, hour: ${currentHour}, day: ${currentDay}`);

    // Query users who:
    // 1. Have preferences configured
    // 2. Are due for next recommendation  
    // 3. Have sufficient profile completeness
    // 4. Are not in quiet hours
    const eligibleUsers = await this.db.select({
      userId: userPreferences.userId,
      notificationFrequency: userPreferences.notificationFrequency,
      notificationChannels: userPreferences.notificationChannels,
      quietHours: userPreferences.quietHours,
      preferredDays: userPreferences.preferredDays,
      locationSettings: userPreferences.locationSettings,
      searchRadius: userPreferences.searchRadius,
      weekendRadius: userPreferences.weekendRadius,
      lastRecommendationDate: userPreferences.lastRecommendationDate,
      nextRecommendationDue: userPreferences.nextRecommendationDue,
      profileCompleteness: consumerProfiles.profileCompleteness,
      interviewInsights: consumerProfiles.interviewInsights
    })
    .from(userPreferences)
    .leftJoin(consumerProfiles, eq(userPreferences.userId, consumerProfiles.userId))
    .where(and(
      // Must have profile with >30% completeness
      gte(consumerProfiles.profileCompleteness, 30),
      // Must have interview insights
      isNotNull(consumerProfiles.interviewInsights),
      // Must have location configured
      isNotNull(userPreferences.locationSettings),
      // Must be due for recommendation (or never received one)
      sql`(${userPreferences.nextRecommendationDue} IS NULL OR ${userPreferences.nextRecommendationDue} <= ${now})`
    ))
    .limit(limit);

    console.log(`[CONCIERGE-CRON] Found ${eligibleUsers.length} potentially eligible users`);

    // Filter users based on quiet hours and preferred days
    const filteredUsers = eligibleUsers.filter(user => {
      try {
        // Check quiet hours
        if (user.quietHours) {
          const quietHours = JSON.parse(user.quietHours);
          if (quietHours.enabled) {
            const startHour = parseInt(quietHours.start.split(':')[0]);
            const endHour = parseInt(quietHours.end.split(':')[0]);
            
            // Handle overnight quiet hours (e.g., 22:00 - 08:00)
            if (startHour > endHour) {
              if (currentHour >= startHour || currentHour <= endHour) {
                console.log(`[CONCIERGE-CRON] User ${user.userId} in quiet hours`);
                return false;
              }
            } else {
              if (currentHour >= startHour && currentHour <= endHour) {
                console.log(`[CONCIERGE-CRON] User ${user.userId} in quiet hours`);
                return false;
              }
            }
          }
        }

        // Check preferred days
        if (user.preferredDays) {
          const preferredDays = JSON.parse(user.preferredDays);
          if (preferredDays.length > 0 && !preferredDays.includes(currentDay)) {
            console.log(`[CONCIERGE-CRON] User ${user.userId} not on preferred day`);
            return false;
          }
        }

        return true;
      } catch (error) {
        console.error(`[CONCIERGE-CRON] Error filtering user ${user.userId}:`, error);
        return false;
      }
    });

    console.log(`[CONCIERGE-CRON] ${filteredUsers.length} users after filtering for timing preferences`);
    return filteredUsers;
  }

  /**
   * Calculate next recommendation due date based on frequency
   */
  calculateNextRecommendationDue(frequency) {
    const now = new Date();
    const next = new Date(now);
    
    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'twice_weekly':
        next.setDate(next.getDate() + 3.5);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'bi_weekly':
        next.setDate(next.getDate() + 14);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      default:
        next.setDate(next.getDate() + 7); // Default to weekly
    }
    
    return next.toISOString();
  }

  /**
   * Process a batch of users
   */
  async processBatch(users, batchId) {
    const results = {
      processed: 0,
      recommendations: 0,
      errors: []
    };

    console.log(`[CONCIERGE-CRON] Processing batch of ${users.length} users`);
    
    // Initialize matching engine
    const matchingEngine = new MatchingEngine(this.db, this.env);

    for (const user of users) {
      if (this.isApproachingTimeout()) {
        console.log(`[CONCIERGE-CRON] Approaching timeout, stopping batch processing`);
        break;
      }

      try {
        console.log(`[CONCIERGE-CRON] Processing user ${user.userId}`);
        
        // Generate recommendations using the matching engine
        const recommendations = await matchingEngine.generateRecommendations(user.userId);
        
        console.log(`[CONCIERGE-CRON] Generated ${recommendations.length} recommendations for user ${user.userId}`);
        
        // Save recommendations to database
        for (const recommendation of recommendations) {
          await this.saveRecommendation(user.userId, recommendation, batchId);
          results.recommendations++;
        }
        
        // Update user's next recommendation due date
        const nextDue = this.calculateNextRecommendationDue(user.notificationFrequency);
        
        await this.db.update(userPreferences)
          .set({
            lastRecommendationDate: new Date().toISOString(),
            nextRecommendationDue: nextDue,
            updatedAt: new Date().toISOString()
          })
          .where(eq(userPreferences.userId, user.userId));

        results.processed++;
        console.log(`[CONCIERGE-CRON] Completed processing user ${user.userId}: ${recommendations.length} recommendations, next due: ${nextDue}`);
        
      } catch (error) {
        console.error(`[CONCIERGE-CRON] Error processing user ${user.userId}:`, error);
        results.errors.push({
          userId: user.userId,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  /**
   * Save a recommendation to the database
   */
  async saveRecommendation(userId, recommendation, batchId) {
    try {
      const recommendationId = crypto.randomUUID();
      
      await this.db.insert(conciergeRecommendations).values({
        id: recommendationId,
        userId: userId,
        businessId: recommendation.id,
        recommendationType: 'regular',
        matchScore: recommendation.scoring.total,
        batchId: batchId,
        rationale: this.generateRationale(recommendation),
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
      
      console.log(`[CONCIERGE-CRON] Saved recommendation ${recommendationId}: ${recommendation.name} (score: ${recommendation.scoring.total.toFixed(3)})`);
      
    } catch (error) {
      console.error(`[CONCIERGE-CRON] Error saving recommendation:`, error);
      throw error;
    }
  }

  /**
   * Generate human-readable rationale for recommendation
   */
  generateRationale(recommendation) {
    const reasons = [];
    const scoring = recommendation.scoring;
    
    // Location-based reasoning
    if (scoring.distance < 5) {
      reasons.push(`Very close to you (${scoring.distance.toFixed(1)} miles away)`);
    } else if (scoring.distance < 15) {
      reasons.push(`Conveniently located ${scoring.distance.toFixed(1)} miles away`);
    }
    
    // Interest matching
    if (scoring.profileInterestMatch > 0.7) {
      reasons.push("Strongly matches your interests");
    } else if (scoring.profileInterestMatch > 0.4) {
      reasons.push("Aligns with your preferences");
    }
    
    // Quality indicators
    if (recommendation.verified) {
      reasons.push("Verified local business");
    }
    
    if (recommendation.enrichmentStatus === 'completed') {
      reasons.push("Quality business with detailed information");
    }
    
    // Business attributes
    if (recommendation.businessAttributes) {
      try {
        const attrs = JSON.parse(recommendation.businessAttributes);
        if (attrs.locally_owned) reasons.push("Locally owned");
        if (attrs.woman_owned) reasons.push("Woman-owned business");
        if (attrs.veteran_owned) reasons.push("Veteran-owned business");
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    // Default if no specific reasons
    if (reasons.length === 0) {
      reasons.push("Recommended based on your profile preferences");
    }
    
    return reasons.join(', ') + '.';
  }

  /**
   * Run the full processing pipeline
   */
  async run() {
    const batchId = crypto.randomUUID();
    const startTime = Date.now();
    
    console.log(`[CONCIERGE-CRON] Starting recommendation processing batch: ${batchId}`);

    // Create processing log entry
    await this.db.insert(recommendationLogs).values({
      id: crypto.randomUUID(),
      batchId: batchId,
      startedAt: new Date().toISOString(),
      status: 'running'
    });

    try {
      // Get eligible users
      const eligibleUsers = await this.getEligibleUsers(200);
      
      if (eligibleUsers.length === 0) {
        console.log(`[CONCIERGE-CRON] No eligible users found, completing batch`);
        
        await this.db.update(recommendationLogs)
          .set({
            usersEligible: 0,
            usersProcessed: 0,
            recommendationsGenerated: 0,
            processingTimeMs: Date.now() - startTime,
            completedAt: new Date().toISOString(),
            status: 'completed'
          })
          .where(eq(recommendationLogs.batchId, batchId));
          
        return { success: true, batchId, processed: 0, recommendations: 0 };
      }

      // Process users in batches
      let totalProcessed = 0;
      let totalRecommendations = 0;
      let allErrors = [];
      
      for (let i = 0; i < eligibleUsers.length; i += this.batchSize) {
        if (this.isApproachingTimeout()) {
          console.log(`[CONCIERGE-CRON] Timeout approaching, stopping processing`);
          break;
        }

        const batch = eligibleUsers.slice(i, i + this.batchSize);
        const results = await this.processBatch(batch, batchId);
        
        totalProcessed += results.processed;
        totalRecommendations += results.recommendations;
        allErrors = [...allErrors, ...results.errors];
        
        console.log(`[CONCIERGE-CRON] Batch ${Math.floor(i / this.batchSize) + 1}: processed ${results.processed}/${batch.length} users`);
      }

      // Update processing log
      await this.db.update(recommendationLogs)
        .set({
          usersEligible: eligibleUsers.length,
          usersProcessed: totalProcessed,
          recommendationsGenerated: totalRecommendations,
          processingTimeMs: Date.now() - startTime,
          errors: allErrors.length > 0 ? JSON.stringify(allErrors) : null,
          errorCount: allErrors.length,
          completedAt: new Date().toISOString(),
          status: allErrors.length > totalProcessed / 2 ? 'failed' : 'completed'
        })
        .where(eq(recommendationLogs.batchId, batchId));

      console.log(`[CONCIERGE-CRON] Batch ${batchId} completed: ${totalProcessed}/${eligibleUsers.length} users processed`);

      return {
        success: true,
        batchId,
        eligible: eligibleUsers.length,
        processed: totalProcessed,
        recommendations: totalRecommendations,
        errors: allErrors.length
      };

    } catch (error) {
      console.error(`[CONCIERGE-CRON] Fatal error in batch ${batchId}:`, error);
      
      // Update log with fatal error
      await this.db.update(recommendationLogs)
        .set({
          processingTimeMs: Date.now() - startTime,
          errors: JSON.stringify([{ error: error.message, timestamp: new Date().toISOString() }]),
          errorCount: 1,
          completedAt: new Date().toISOString(),
          status: 'failed'
        })
        .where(eq(recommendationLogs.batchId, batchId));

      throw error;
    }
  }
}

/**
 * Cron handler - triggered by Cloudflare Workers cron
 */
conciergeCron.post('/cron/match', async (c) => {
  try {
    console.log(`[CONCIERGE-CRON] Cron trigger received at ${new Date().toISOString()}`);
    
    const db = c.get('db');
    const processor = new ConciergeProcessor(db, c.env);
    
    const result = await processor.run();
    
    return c.json({
      success: true,
      message: 'AI Concierge processing completed',
      ...result
    });
    
  } catch (error) {
    console.error('[CONCIERGE-CRON] Fatal cron error:', error);
    return c.json({
      success: false,
      error: 'Processing failed',
      message: error.message
    }, 500);
  }
});

/**
 * Manual trigger endpoint (for testing and admin use)
 */
conciergeCron.post('/trigger', async (c) => {
  try {
    // TODO: Add admin authentication check here
    console.log(`[CONCIERGE-CRON] Manual trigger received at ${new Date().toISOString()}`);
    
    const db = c.get('db');
    const processor = new ConciergeProcessor(db, c.env);
    
    const result = await processor.run();
    
    return c.json({
      success: true,
      message: 'AI Concierge processing triggered manually',
      trigger: 'manual',
      ...result
    });
    
  } catch (error) {
    console.error('[CONCIERGE-CRON] Manual trigger error:', error);
    return c.json({
      success: false,
      error: 'Processing failed',
      message: error.message
    }, 500);
  }
});

/**
 * Get processing status and recent logs
 */
conciergeCron.get('/status', async (c) => {
  try {
    const db = c.get('db');
    
    // Get recent processing logs
    const recentLogs = await db.select()
      .from(recommendationLogs)
      .orderBy(sql`${recommendationLogs.startedAt} DESC`)
      .limit(10);

    // Get summary stats
    const stats = await db.select({
      totalRuns: sql`COUNT(*)`,
      successfulRuns: sql`COUNT(CASE WHEN ${recommendationLogs.status} = 'completed' THEN 1 END)`,
      failedRuns: sql`COUNT(CASE WHEN ${recommendationLogs.status} = 'failed' THEN 1 END)`,
      avgProcessingTime: sql`AVG(${recommendationLogs.processingTimeMs})`,
      totalUsersProcessed: sql`SUM(${recommendationLogs.usersProcessed})`,
      totalRecommendations: sql`SUM(${recommendationLogs.recommendationsGenerated})`
    })
    .from(recommendationLogs)
    .where(gte(recommendationLogs.startedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())); // Last 7 days

    return c.json({
      status: 'operational',
      recentLogs: recentLogs,
      stats: stats[0] || {},
      lastCheck: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[CONCIERGE-CRON] Status check error:', error);
    return c.json({
      status: 'error',
      error: error.message
    }, 500);
  }
});

export { conciergeCron, ConciergeProcessor };