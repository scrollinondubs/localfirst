import { businesses, conciergeRecommendations, userPreferences, consumerProfiles } from '../db/schema.js';
import { eq, and, isNotNull, sql, ne, gte, lte, notExists } from 'drizzle-orm';

/**
 * AI Concierge Matching Engine
 * Generates personalized business recommendations using sophisticated scoring algorithms
 */
export class MatchingEngine {
  constructor(db, env) {
    this.db = db;
    this.env = env;
    
    // Scoring weights as specified in GRID7-203
    this.weights = {
      profileInterestMatch: 0.4,      // 40%
      businessQuality: 0.2,           // 20%
      locationProximity: 0.15,        // 15%
      categoryDiversity: 0.1,         // 10%
      temporalRelevance: 0.1,         // 10%
      feedbackAdjustment: 0.05        // 5%
    };
    
    // Performance and diversity constraints
    this.maxRecommendationsPerUser = 5;
    this.maxProcessingTimeMs = 100;
    this.repeatAvoidanceDays = 30;
    this.maxDistanceMiles = 50;
  }

  /**
   * Parse user profile insights
   */
  parseUserProfile(userProfile) {
    try {
      const insights = JSON.parse(userProfile.interviewInsights || '{}');
      return {
        interests: insights.interests || [],
        upcomingNeeds: insights.upcomingNeeds || [],
        values: insights.values || [],
        giftGiving: insights.giftGiving || [],
        businessTypes: insights.businessTypes || [],
        budgetStyle: insights.budgetStyle || 'moderate',
        shoppingStyle: insights.shoppingStyle || 'balanced'
      };
    } catch (error) {
      console.error('[MATCHING-ENGINE] Error parsing insights:', error);
      return {
        interests: [],
        upcomingNeeds: [],
        values: [],
        giftGiving: [],
        businessTypes: [],
        budgetStyle: 'moderate',
        shoppingStyle: 'balanced'
      };
    }
  }

  /**
   * Generate search terms from user profile for business matching
   */
  generateSearchTerms(insights) {
    const terms = new Set();
    
    // Add interests
    insights.interests.forEach(interest => {
      terms.add(interest.toLowerCase());
      // Add related terms for common interests
      this.expandInterest(interest).forEach(term => terms.add(term));
    });
    
    // Add business types
    insights.businessTypes.forEach(type => {
      terms.add(type.toLowerCase());
    });
    
    // Add upcoming needs
    insights.upcomingNeeds.forEach(need => {
      terms.add(need.toLowerCase());
    });
    
    // Add gift giving contexts
    insights.giftGiving.forEach(gift => {
      terms.add(gift.toLowerCase());
    });
    
    return Array.from(terms).filter(term => term.length > 2);
  }

  /**
   * Expand interests to related business categories
   */
  expandInterest(interest) {
    const expansions = {
      'hiking': ['outdoor', 'gear', 'adventure', 'trail', 'nature'],
      'coffee': ['cafe', 'roastery', 'espresso', 'beans'],
      'beer': ['brewery', 'craft beer', 'taproom', 'pub'],
      'wine': ['winery', 'vineyard', 'tasting', 'cellar'],
      'fitness': ['gym', 'yoga', 'pilates', 'wellness', 'health'],
      'art': ['gallery', 'studio', 'creative', 'crafts', 'design'],
      'music': ['venue', 'instruments', 'record', 'concert'],
      'food': ['restaurant', 'dining', 'cuisine', 'chef', 'culinary'],
      'books': ['bookstore', 'library', 'reading', 'literature'],
      'fashion': ['boutique', 'clothing', 'style', 'apparel'],
      'home': ['furniture', 'decor', 'interior', 'garden'],
      'pets': ['veterinary', 'grooming', 'pet store', 'animal']
    };
    
    const key = interest.toLowerCase();
    return expansions[key] || [];
  }

  /**
   * Calculate temporal relevance based on time of year and user needs
   */
  calculateTemporalRelevance(businessCategory) {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    const dayOfWeek = now.getDay(); // 0-6
    
    let relevance = 1.0;
    
    // Seasonal adjustments
    const seasonalBoosts = {
      // Winter (Dec, Jan, Feb)
      'winter': [11, 0, 1],
      // Spring (Mar, Apr, May)  
      'spring': [2, 3, 4],
      // Summer (Jun, Jul, Aug)
      'summer': [5, 6, 7],
      // Fall (Sep, Oct, Nov)
      'fall': [8, 9, 10]
    };
    
    // Category seasonal relevance
    const categorySeasonality = {
      'fitness': { seasons: ['winter', 'spring'], boost: 1.2 },
      'outdoor': { seasons: ['spring', 'summer'], boost: 1.3 },
      'restaurants': { seasons: [], boost: 1.0 }, // Always relevant
      'retail': { seasons: ['fall'], boost: 1.1 }, // Holiday shopping
      'wellness': { seasons: ['winter'], boost: 1.2 }
    };
    
    // Check if current season matches business category
    for (const [category, info] of Object.entries(categorySeasonality)) {
      if (businessCategory.toLowerCase().includes(category)) {
        for (const season of info.seasons) {
          if (seasonalBoosts[season].includes(month)) {
            relevance *= info.boost;
            break;
          }
        }
      }
    }
    
    // Weekend boost for leisure categories
    const leisureCategories = ['restaurant', 'entertainment', 'retail', 'outdoor'];
    if ([0, 6].includes(dayOfWeek)) { // Weekend
      for (const leisure of leisureCategories) {
        if (businessCategory.toLowerCase().includes(leisure)) {
          relevance *= 1.1;
          break;
        }
      }
    }
    
    return Math.min(relevance, 2.0); // Cap at 2x boost
  }

  /**
   * Get candidate businesses near user location
   */
  async getCandidateBusinesses(userLocation, searchRadius) {
    const { lat, lng } = userLocation;
    
    // Calculate bounding box
    const latDelta = searchRadius / 69; // ~69 miles per degree latitude
    const lngDelta = searchRadius / (69 * Math.cos(lat * Math.PI / 180));
    
    console.log(`[MATCHING-ENGINE] Searching businesses within ${searchRadius} miles of ${lat},${lng}`);
    
    // Get businesses within radius, prioritizing enriched ones
    const candidates = await this.db.select({
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
      businessDescription: businesses.businessDescription,
      keywords: businesses.keywords,
      productsServices: businesses.productsServices,
      businessAttributes: businesses.businessAttributes,
      lfaMember: businesses.lfaMember,
      verified: businesses.verified,
      enrichmentStatus: businesses.enrichmentStatus
    })
    .from(businesses)
    .where(and(
      eq(businesses.status, 'active'),
      eq(businesses.lfaMember, true),
      gte(businesses.latitude, lat - latDelta),
      lte(businesses.latitude, lat + latDelta),
      gte(businesses.longitude, lng - lngDelta),
      lte(businesses.longitude, lng + lngDelta),
      isNotNull(businesses.primaryCategory) // Prioritize enriched businesses
    ))
    .limit(200); // Get more candidates for better scoring
    
    console.log(`[MATCHING-ENGINE] Found ${candidates.length} candidate businesses`);
    return candidates;
  }

  /**
   * Filter out recently recommended businesses
   */
  async filterRecentRecommendations(userId, candidateBusinesses) {
    const cutoffDate = new Date(Date.now() - this.repeatAvoidanceDays * 24 * 60 * 60 * 1000).toISOString();
    
    // Get recent recommendations for this user
    const recentRecommendations = await this.db.select({
      businessId: conciergeRecommendations.businessId
    })
    .from(conciergeRecommendations)
    .where(and(
      eq(conciergeRecommendations.userId, userId),
      gte(conciergeRecommendations.createdAt, cutoffDate)
    ));
    
    const recentBusinessIds = new Set(recentRecommendations.map(r => r.businessId));
    
    const filtered = candidateBusinesses.filter(business => !recentBusinessIds.has(business.id));
    
    console.log(`[MATCHING-ENGINE] Filtered out ${candidateBusinesses.length - filtered.length} recent recommendations`);
    return filtered;
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
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
   * Score a business against user profile
   */
  scoreBusiness(business, userProfile, userLocation, searchTerms, insights) {
    const startTime = Date.now();
    let scoring = {
      profileInterestMatch: 0,
      businessQuality: 0,
      locationProximity: 0,
      categoryDiversity: 0,
      temporalRelevance: 0,
      feedbackAdjustment: 0,
      total: 0,
      reasons: []
    };

    try {
      // 1. Profile Interest Match (40%)
      const interestResult = this.calculateInterestMatch(business, searchTerms, insights);
      scoring.profileInterestMatch = interestResult.score;
      scoring.reasons = [...scoring.reasons, ...interestResult.reasons];

      // 2. Business Quality Score (20%)
      scoring.businessQuality = this.calculateQualityScore(business);

      // 3. Location Proximity (15%)
      const distance = this.calculateDistance(
        userLocation.lat, userLocation.lng,
        business.latitude, business.longitude
      );
      scoring.locationProximity = this.calculateProximityScore(distance, userProfile.searchRadius);

      // 4. Temporal Relevance (10%)
      const category = business.primaryCategory || business.category;
      scoring.temporalRelevance = this.calculateTemporalRelevance(category);

      // 5. Calculate weighted total score
      scoring.total = (
        scoring.profileInterestMatch * this.weights.profileInterestMatch +
        scoring.businessQuality * this.weights.businessQuality +
        scoring.locationProximity * this.weights.locationProximity +
        scoring.temporalRelevance * this.weights.temporalRelevance
        // categoryDiversity and feedbackAdjustment calculated at batch level
      );

      // Add processing metadata
      scoring.processingTimeMs = Date.now() - startTime;
      scoring.distance = distance;

      return scoring;

    } catch (error) {
      console.error('[MATCHING-ENGINE] Error scoring business:', business.id, error);
      return {
        profileInterestMatch: 0,
        businessQuality: 0,
        locationProximity: 0,
        categoryDiversity: 0,
        temporalRelevance: 0,
        feedbackAdjustment: 0,
        total: 0,
        reasons: [],
        error: error.message
      };
    }
  }

  /**
   * Calculate interest match score between business and user profile
   */
  calculateInterestMatch(business, searchTerms, insights) {
    let score = 0;
    let matchReasons = [];

    // Business text fields to search
    const businessText = [
      business.name,
      business.businessDescription,
      business.keywords,
      business.primaryCategory,
      business.subcategory
    ].filter(Boolean).join(' ').toLowerCase();

    // Products/services matching
    let productsServicesText = '';
    if (business.productsServices) {
      try {
        const services = JSON.parse(business.productsServices);
        productsServicesText = JSON.stringify(services).toLowerCase();
      } catch (e) {
        // Ignore JSON parsing errors
      }
    }

    const fullBusinessText = businessText + ' ' + productsServicesText;

    // Direct search terms matching
    let termMatches = 0;
    searchTerms.forEach(term => {
      if (fullBusinessText.includes(term)) {
        termMatches++;
        matchReasons.push(`Matches term: ${term}`);
      }
    });

    if (termMatches > 0) {
      score += Math.min(termMatches / searchTerms.length, 1.0) * 0.6; // Max 60% from term matching
    }

    // Category alignment with user preferences
    const category = (business.primaryCategory || business.category || '').toLowerCase();
    const categoryScore = this.calculateCategoryAlignment(category, insights);
    score += categoryScore * 0.4; // Max 40% from category alignment

    if (categoryScore > 0) {
      matchReasons.push(`Category alignment: ${category}`);
    }

    // Business attributes bonus
    if (business.businessAttributes) {
      try {
        const attributes = JSON.parse(business.businessAttributes);
        if (insights.values.includes('supporting local') && attributes.locally_owned) {
          score += 0.1;
          matchReasons.push('Locally owned (matches values)');
        }
        if (insights.values.includes('sustainability') && attributes.eco_friendly) {
          score += 0.1;
          matchReasons.push('Eco-friendly (matches values)');
        }
      } catch (e) {
        // Ignore JSON parsing errors
      }
    }

    return {
      score: Math.min(score, 1.0),
      reasons: matchReasons
    };
  }

  /**
   * Calculate category alignment score
   */
  calculateCategoryAlignment(businessCategory, insights) {
    let score = 0;

    // Direct business type preferences
    insights.businessTypes.forEach(preferredType => {
      if (businessCategory.includes(preferredType.toLowerCase())) {
        score += 0.5;
      }
    });

    // Interest to category mapping
    const categoryMappings = {
      'food': ['restaurant', 'cafe', 'dining', 'culinary'],
      'fitness': ['gym', 'wellness', 'health', 'fitness'],
      'retail': ['shopping', 'store', 'boutique', 'market'],
      'entertainment': ['bar', 'venue', 'entertainment', 'recreation'],
      'services': ['salon', 'spa', 'repair', 'professional'],
      'automotive': ['car', 'auto', 'vehicle', 'motorcycle']
    };

    insights.interests.forEach(interest => {
      for (const [category, keywords] of Object.entries(categoryMappings)) {
        if (keywords.some(keyword => businessCategory.includes(keyword))) {
          score += 0.3;
          break;
        }
      }
    });

    return Math.min(score, 1.0);
  }

  /**
   * Calculate business quality score
   */
  calculateQualityScore(business) {
    let score = 0;

    // Enrichment status bonus
    if (business.enrichmentStatus === 'completed') {
      score += 0.4;
    }

    // Verification bonus
    if (business.verified) {
      score += 0.2;
    }

    // Has business description
    if (business.businessDescription && business.businessDescription.length > 50) {
      score += 0.2;
    }

    // Has website
    if (business.website) {
      score += 0.1;
    }

    // Has phone
    if (business.phone) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate proximity score based on distance
   */
  calculateProximityScore(distanceMiles, maxRadius) {
    if (distanceMiles > maxRadius) {
      return 0;
    }

    // Linear decay from 1.0 at distance 0 to 0.1 at maxRadius
    return Math.max(0.1, 1.0 - (distanceMiles / maxRadius) * 0.9);
  }

  /**
   * Apply category diversity scoring to ensure variety
   */
  applyCategoryDiversity(scoredBusinesses) {
    const categories = {};
    const diversityBonuses = {};

    // Count businesses per category
    scoredBusinesses.forEach((business, index) => {
      const category = business.primaryCategory || business.category || 'other';
      categories[category] = (categories[category] || 0) + 1;
    });

    // Apply diversity bonus (penalize over-representation)
    scoredBusinesses.forEach((business, index) => {
      const category = business.primaryCategory || business.category || 'other';
      const categoryCount = categories[category];
      
      // Bonus decreases with more businesses in same category
      let diversityScore = 1.0 / Math.sqrt(categoryCount);
      diversityBonuses[business.id] = diversityScore;

      // Update total score with diversity component
      business.scoring.categoryDiversity = diversityScore;
      business.scoring.total += diversityScore * this.weights.categoryDiversity;
    });

    return scoredBusinesses;
  }

  /**
   * Generate recommendations for a user
   */
  async generateRecommendations(userId) {
    const startTime = Date.now();
    
    try {
      console.log(`[MATCHING-ENGINE] Generating recommendations for user: ${userId}`);

      // Get user profile and preferences
      const userProfile = await this.db.select({
        userId: userPreferences.userId,
        locationSettings: userPreferences.locationSettings,
        searchRadius: userPreferences.searchRadius,
        weekendRadius: userPreferences.weekendRadius,
        profileCompleteness: consumerProfiles.profileCompleteness,
        interviewInsights: consumerProfiles.interviewInsights,
        interviewSummary: consumerProfiles.interviewSummary
      })
      .from(userPreferences)
      .leftJoin(consumerProfiles, eq(userPreferences.userId, consumerProfiles.userId))
      .where(eq(userPreferences.userId, userId))
      .limit(1);

      if (userProfile.length === 0) {
        throw new Error('User profile not found');
      }

      const profile = userProfile[0];
      const locationSettings = JSON.parse(profile.locationSettings);
      const currentLocation = locationSettings[locationSettings.current] || locationSettings.home;
      
      if (!currentLocation) {
        throw new Error('User location not configured');
      }

      // Parse profile insights
      const insights = this.parseUserProfile(profile);
      const searchTerms = this.generateSearchTerms(insights);
      
      console.log(`[MATCHING-ENGINE] Search terms:`, searchTerms);

      // Determine search radius (weekend vs weekday)
      const isWeekend = [0, 6].includes(new Date().getDay());
      const searchRadius = isWeekend ? profile.weekendRadius : profile.searchRadius;

      // Get candidate businesses
      let candidates = await this.getCandidateBusinesses(currentLocation, searchRadius);

      // Filter out recent recommendations
      candidates = await this.filterRecentRecommendations(userId, candidates);

      if (candidates.length === 0) {
        console.log(`[MATCHING-ENGINE] No candidate businesses found for user ${userId}`);
        return [];
      }

      // Score each business
      console.log(`[MATCHING-ENGINE] Scoring ${candidates.length} candidate businesses`);
      const scoredBusinesses = candidates.map(business => ({
        ...business,
        scoring: this.scoreBusiness(business, profile, currentLocation, searchTerms, insights)
      }));

      // Apply category diversity
      const diversifiedBusinesses = this.applyCategoryDiversity(scoredBusinesses);

      // Sort by total score and take top recommendations
      const topRecommendations = diversifiedBusinesses
        .filter(business => business.scoring.total > 0.1) // Minimum relevance threshold
        .sort((a, b) => b.scoring.total - a.scoring.total)
        .slice(0, this.maxRecommendationsPerUser);

      const processingTime = Date.now() - startTime;
      console.log(`[MATCHING-ENGINE] Generated ${topRecommendations.length} recommendations in ${processingTime}ms`);

      return topRecommendations;

    } catch (error) {
      console.error(`[MATCHING-ENGINE] Error generating recommendations for user ${userId}:`, error);
      throw error;
    }
  }
}

export default MatchingEngine;