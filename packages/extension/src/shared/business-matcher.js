import { CONFIG } from './constants.js';

/**
 * Business Matcher Utility
 * Handles matching business names against chain patterns and local businesses
 */
export class BusinessMatcher {
  constructor() {
    this.chainPatterns = [];
    this.localBusinesses = [];
    this.lastChainUpdate = null;
    this.lastBusinessUpdate = null;
  }

  /**
   * Update chain patterns for matching
   */
  updateChainPatterns(chains) {
    this.chainPatterns = chains || [];
    this.lastChainUpdate = Date.now();
    console.log(`BusinessMatcher: Updated with ${this.chainPatterns.length} chain patterns`);
  }

  /**
   * Update local businesses for matching
   */
  updateLocalBusinesses(businesses) {
    this.localBusinesses = businesses || [];
    this.lastBusinessUpdate = Date.now();
    console.log(`BusinessMatcher: Updated with ${this.localBusinesses.length} local businesses`);
  }

  /**
   * Check if a business name matches any chain patterns
   */
  isChainBusiness(businessName, confidenceThreshold = CONFIG.FILTERING.CONFIDENCE_THRESHOLD) {
    if (!businessName || this.chainPatterns.length === 0) {
      return { isChain: false, confidence: 0, matchedChain: null };
    }

    const normalizedName = this.normalizeName(businessName);
    
    for (const chain of this.chainPatterns) {
      if (chain.confidenceScore < confidenceThreshold) {
        continue;
      }

      const patterns = Array.isArray(chain.patterns) ? chain.patterns : [chain.name];
      
      for (const pattern of patterns) {
        const confidence = this.calculateMatchConfidence(normalizedName, pattern);
        
        if (confidence >= confidenceThreshold) {
          return {
            isChain: true,
            confidence: confidence,
            matchedChain: {
              id: chain.id,
              name: chain.name,
              category: chain.category,
              parentCompany: chain.parentCompany,
              pattern: pattern,
            }
          };
        }
      }
    }

    return { isChain: false, confidence: 0, matchedChain: null };
  }

  /**
   * Find matching local business by name and location
   */
  findLocalMatch(businessName, location = null) {
    if (!businessName || this.localBusinesses.length === 0) {
      return null;
    }

    const normalizedName = this.normalizeName(businessName);
    let bestMatch = null;
    let bestScore = 0;

    for (const business of this.localBusinesses) {
      const businessNormalized = this.normalizeName(business.name);
      
      // Name similarity score
      const nameScore = this.calculateNameSimilarity(normalizedName, businessNormalized);
      
      // Location proximity score (if location provided)
      let locationScore = 0;
      if (location && business.latitude && business.longitude) {
        const distance = this.calculateDistance(
          location.lat, location.lng,
          business.latitude, business.longitude
        );
        locationScore = Math.max(0, 1 - (distance / 0.5)); // Within 0.5 miles gets full score
      }

      // Combined score (favor name similarity)
      const totalScore = nameScore * 0.8 + locationScore * 0.2;

      if (totalScore > bestScore && nameScore > 0.7) { // Minimum 70% name match
        bestScore = totalScore;
        bestMatch = {
          ...business,
          matchScore: totalScore,
          nameScore: nameScore,
          locationScore: locationScore,
        };
      }
    }

    return bestMatch;
  }

  /**
   * Find local alternatives in the same category
   */
  findLocalAlternatives(chainBusiness, location, maxResults = 3) {
    if (!chainBusiness || !location || this.localBusinesses.length === 0) {
      return [];
    }

    const category = chainBusiness.category || 'other';
    const categoryBusinesses = this.localBusinesses.filter(
      business => business.category === category || category === 'other'
    );

    // Calculate distances and sort by proximity
    const businessesWithDistance = categoryBusinesses
      .map(business => {
        if (!business.latitude || !business.longitude) {
          return null;
        }

        const distance = this.calculateDistance(
          location.lat, location.lng,
          business.latitude, business.longitude
        );

        return {
          ...business,
          distance: distance,
        };
      })
      .filter(business => business && business.distance <= 5) // Within 5 miles
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxResults);

    return businessesWithDistance;
  }

  /**
   * Calculate match confidence between business name and pattern
   */
  calculateMatchConfidence(businessName, pattern) {
    const normalizedPattern = this.normalizeName(pattern);
    
    // Exact match
    if (businessName === normalizedPattern) {
      return 100;
    }

    // Contains pattern
    if (businessName.includes(normalizedPattern)) {
      return 90;
    }

    // Pattern contains business name
    if (normalizedPattern.includes(businessName)) {
      return 85;
    }

    // Fuzzy match using Levenshtein distance
    const similarity = this.calculateNameSimilarity(businessName, normalizedPattern);
    
    if (similarity > 0.8) {
      return 80;
    } else if (similarity > 0.6) {
      return 70;
    } else if (similarity > 0.4) {
      return 60;
    }

    return 0;
  }

  /**
   * Calculate name similarity using Levenshtein distance
   */
  calculateNameSimilarity(name1, name2) {
    if (name1 === name2) return 1;
    
    const len1 = name1.length;
    const len2 = name2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len2 + 1).fill().map(() => Array(len1 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = name1[i - 1] === name2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,     // deletion
          matrix[j][i - 1] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return 1 - (matrix[len2][len1] / maxLen);
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
   * Normalize business name for matching
   */
  normalizeName(name) {
    if (!name) return '';
    
    return name
      .toLowerCase()
      .trim()
      // Remove common business suffixes
      .replace(/\b(llc|inc|corp|corporation|company|co|ltd|limited)\b/g, '')
      // Remove special characters and extra spaces
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract location from Google Maps URL or element
   */
  extractLocationFromUrl() {
    try {
      const url = window.location.href;
      const matches = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      
      if (matches) {
        return {
          lat: parseFloat(matches[1]),
          lng: parseFloat(matches[2])
        };
      }
      
      // Fallback: try to extract from search params
      const urlObj = new URL(url);
      const searchParams = urlObj.searchParams;
      
      // Look for various location parameters
      const coords = searchParams.get('ll') || searchParams.get('center');
      if (coords) {
        const [lat, lng] = coords.split(',').map(parseFloat);
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Failed to extract location from URL:', error);
      return null;
    }
  }

  /**
   * Get matcher status for debugging
   */
  getStatus() {
    return {
      chainPatterns: this.chainPatterns.length,
      localBusinesses: this.localBusinesses.length,
      lastChainUpdate: this.lastChainUpdate,
      lastBusinessUpdate: this.lastBusinessUpdate,
    };
  }
}

// Create singleton instance
export const businessMatcher = new BusinessMatcher();