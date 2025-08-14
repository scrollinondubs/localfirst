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
  findLocalAlternatives(chainBusiness, location) {
    console.log('BusinessMatcher: findLocalAlternatives called with:', chainBusiness, location, 'localBusinesses:', this.localBusinesses.length);
    if (!chainBusiness || !location || this.localBusinesses.length === 0) {
      console.log('BusinessMatcher: Early return - missing data');
      return [];
    }

    const category = chainBusiness.category || 'other';
    console.log('BusinessMatcher: Looking for category:', category);
    const categoryBusinesses = this.localBusinesses.filter(
      business => business.category === category || category === 'other'
    );
    console.log('BusinessMatcher: Found', categoryBusinesses.length, 'businesses in category:', categoryBusinesses);

    // Calculate distances for all businesses (don't filter by bounds to show all alternatives)
    const businessesInView = categoryBusinesses
      .filter(business => {
        // Only filter out businesses without coordinates
        return business.latitude && business.longitude;
      })
      .map(business => {
        const distance = this.calculateDistance(
          location.lat, location.lng,
          business.latitude, business.longitude
        );

        return {
          ...business,
          distance: distance,
        };
      })
      .sort((a, b) => a.distance - b.distance);

    console.log('BusinessMatcher: Found', businessesInView.length, 'local alternatives sorted by distance');
    return businessesInView;
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
      const matches = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+(?:\.\d+)?)z/);
      
      if (matches) {
        const lat = parseFloat(matches[1]);
        const lng = parseFloat(matches[2]);
        const zoom = parseFloat(matches[3]);
        
        // Calculate approximate bounds based on zoom level
        const latDelta = this.getLatDeltaFromZoom(zoom);
        const lngDelta = this.getLngDeltaFromZoom(zoom, lat);
        
        return {
          lat,
          lng,
          zoom,
          bounds: {
            north: lat + latDelta,
            south: lat - latDelta, 
            east: lng + lngDelta,
            west: lng - lngDelta
          }
        };
      }
      
      // Fallback: try without zoom
      const basicMatches = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (basicMatches) {
        return {
          lat: parseFloat(basicMatches[1]),
          lng: parseFloat(basicMatches[2]),
          bounds: null
        };
      }
      
      // Fallback: try to extract from search params
      const urlObj = new URL(url);
      const searchParams = urlObj.searchParams;
      
      const coords = searchParams.get('ll') || searchParams.get('center');
      if (coords) {
        const [lat, lng] = coords.split(',').map(parseFloat);
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng, bounds: null };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Failed to extract location from URL:', error);
      return null;
    }
  }

  /**
   * Get latitude delta from zoom level (approximate)
   */
  getLatDeltaFromZoom(zoom) {
    // More generous bounds - expand the area for finding alternatives
    // Base calculation with expansion factor
    const baseDelta = 180 / Math.pow(2, zoom + 1);
    
    // Expand bounds based on zoom level to ensure we find alternatives
    if (zoom >= 12) {
      // City level - expand significantly (3x)
      return baseDelta * 3;
    } else if (zoom >= 10) {
      // Metro area level - expand moderately (2x)
      return baseDelta * 2;
    } else {
      // Regional level - expand slightly (1.5x)
      return baseDelta * 1.5;
    }
  }

  /**
   * Get longitude delta from zoom level and latitude
   */
  getLngDeltaFromZoom(zoom, lat) {
    // More generous bounds - expand the area for finding alternatives
    const latRadians = (lat * Math.PI) / 180;
    const cosLat = Math.cos(latRadians);
    const baseDelta = (360 / Math.pow(2, zoom + 1)) * cosLat;
    
    // Expand bounds based on zoom level to ensure we find alternatives
    if (zoom >= 12) {
      // City level - expand significantly (3x)
      return baseDelta * 3;
    } else if (zoom >= 10) {
      // Metro area level - expand moderately (2x)
      return baseDelta * 2;
    } else {
      // Regional level - expand slightly (1.5x)
      return baseDelta * 1.5;
    }
  }

  /**
   * Check if a point is within map bounds
   */
  isWithinBounds(lat, lng, bounds) {
    if (!bounds) return true; // No bounds check if not available
    
    return lat >= bounds.south && 
           lat <= bounds.north && 
           lng >= bounds.west && 
           lng <= bounds.east;
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