import { CONFIG } from './constants.js';

/**
 * Business Matcher Utility
 * Handles matching business names against chain patterns and local businesses
 */
export class BusinessMatcher {
  constructor() {
    this.chainPatterns = [];
    this.lastChainUpdate = null;
    // Removed: localBusinesses array - now using dynamic API calls
  }

  /**
   * Update chain patterns for matching
   */
  updateChainPatterns(chains) {
    this.chainPatterns = chains || [];
    this.lastChainUpdate = Date.now();
    console.log(`BusinessMatcher: Updated with ${this.chainPatterns.length} chain patterns`);
    
    // DEBUG: Show sample chain patterns to verify we have the expected ones
    if (this.chainPatterns.length > 0) {
      console.log('BusinessMatcher: Sample chain patterns:', 
        this.chainPatterns.slice(0, 10).map(chain => ({
          name: chain.name,
          patterns: chain.patterns,
          category: chain.category,
          confidenceScore: chain.confidenceScore
        }))
      );
      
      // Check for specific chains we expect
      const expectedChains = ['Gap', 'Urban Outfitters', 'T.J. Maxx', 'H&M', 'TJ Maxx', 'Gap Factory'];
      const foundChains = expectedChains.filter(name => 
        this.chainPatterns.some(chain => 
          chain.name.toLowerCase().includes(name.toLowerCase()) ||
          (Array.isArray(chain.patterns) && chain.patterns.some(pattern => 
            pattern.toLowerCase().includes(name.toLowerCase())
          ))
        )
      );
      console.log(`BusinessMatcher: Found expected chains: ${foundChains.join(', ')}`);
    }
  }

  /**
   * Removed: updateLocalBusinesses() - No longer managing local business arrays
   * Local businesses are now fetched dynamically via API calls
   */

  /**
   * Check if a business name matches any chain patterns
   */
  isChainBusiness(businessName, confidenceThreshold = CONFIG.FILTERING.CONFIDENCE_THRESHOLD) {
    if (!businessName || this.chainPatterns.length === 0) {
      console.log('BusinessMatcher: No business name or no chain patterns', { businessName, patternCount: this.chainPatterns.length });
      return { isChain: false, confidence: 0, matchedChain: null };
    }

    const normalizedName = this.normalizeName(businessName);
    console.log(`BusinessMatcher: Checking "${businessName}" (normalized: "${normalizedName}") against ${this.chainPatterns.length} patterns with threshold ${confidenceThreshold}`);
    
    let bestMatch = { confidence: 0, chain: null, pattern: null };
    
    for (const chain of this.chainPatterns) {
      if (chain.confidenceScore < confidenceThreshold) {
        continue;
      }

      const patterns = Array.isArray(chain.patterns) ? chain.patterns : [chain.name];
      
      for (const pattern of patterns) {
        const confidence = this.calculateMatchConfidence(normalizedName, pattern);
        
        // Track best match for debugging
        if (confidence > bestMatch.confidence) {
          bestMatch = { confidence, chain, pattern };
        }
        
        if (confidence >= confidenceThreshold) {
          console.log(`BusinessMatcher: MATCH! "${businessName}" matched "${pattern}" (confidence: ${confidence})`);
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

    console.log(`BusinessMatcher: No match for "${businessName}". Best match was "${bestMatch.pattern}" with confidence ${bestMatch.confidence}`);
    return { isChain: false, confidence: 0, matchedChain: null };
  }

  /**
   * Removed: findLocalMatch() - No longer matching against local business arrays
   * Local business identification now happens via API-based search
   */

  /**
   * Find local alternatives using semantic search API
   */
  async findLocalAlternatives(chainBusiness, location) {
    console.log('BusinessMatcher: findLocalAlternatives called with:', chainBusiness, location);
    if (!chainBusiness || !location) {
      console.log('BusinessMatcher: Early return - missing chain business or location');
      return [];
    }

    // Extract the user's current search query from Google Maps
    const userQuery = this.extractUserSearchQuery();
    console.log('BusinessMatcher: Extracted user search query:', userQuery);

    try {
      // Use user's actual search query or fallback to category-based search
      const searchQuery = userQuery || this.generateFallbackQuery(chainBusiness.category || 'other');
      console.log(`BusinessMatcher: Using search query: "${searchQuery}"`);

      // Call semantic search API
      const apiResponse = await this.callSemanticSearchAPI(searchQuery, location);
      
      if (apiResponse && apiResponse.businesses && apiResponse.businesses.length > 0) {
        console.log(`BusinessMatcher: Found ${apiResponse.businesses.length} semantic alternatives via API`);
        console.log('BusinessMatcher: Top alternatives:', apiResponse.businesses.slice(0, 3).map(b => ({ name: b.name, score: b.relevanceScore })));
        return apiResponse.businesses.slice(0, 5); // Limit to top 5 alternatives
      } else {
        console.log('BusinessMatcher: No local alternatives found via semantic search API');
        return [];
      }
      
    } catch (error) {
      console.error('BusinessMatcher: Failed to search for local alternatives:', error);
      return [];
    }
  }

  /**
   * Extract the user's current search query from Google Maps URL or search box
   */
  extractUserSearchQuery() {
    try {
      // Method 1: Extract from URL
      const url = window.location.href;
      
      // Check for search in URL path (e.g., /maps/search/grocery+stores/)
      const searchMatch = url.match(/\/maps\/search\/([^\/\?]+)/);
      if (searchMatch) {
        const searchTerm = decodeURIComponent(searchMatch[1]).replace(/\+/g, ' ');
        console.log('BusinessMatcher: Found search in URL path:', searchTerm);
        return searchTerm;
      }
      
      // Method 2: Extract from search box
      const searchBox = document.querySelector('#searchboxinput, [data-value="Search"], input[placeholder*="Search"]');
      if (searchBox && searchBox.value && searchBox.value.trim()) {
        console.log('BusinessMatcher: Found search in search box:', searchBox.value);
        return searchBox.value.trim();
      }
      
      // Method 3: Extract from URL query parameters
      const urlObj = new URL(url);
      const query = urlObj.searchParams.get('q') || urlObj.searchParams.get('query');
      if (query) {
        console.log('BusinessMatcher: Found search in URL params:', query);
        return query;
      }
      
      console.log('BusinessMatcher: No user search query found');
      return null;
      
    } catch (error) {
      console.error('BusinessMatcher: Error extracting user search query:', error);
      return null;
    }
  }

  /**
   * Generate fallback search query based on chain business category
   */
  generateFallbackQuery(category) {
    const fallbackQueries = {
      'grocery': 'grocery stores',
      'restaurant': 'restaurants',
      'retail': 'stores shops',
      'professional_services': 'professional services',
      'health_wellness': 'health wellness services',
      'home_garden': 'home garden stores',
      'arts_entertainment': 'entertainment venues',
      'automotive': 'auto repair services',
      'financial': 'financial services',
      'other': 'local businesses'
    };
    
    return fallbackQueries[category] || 'local businesses';
  }

  /**
   * Call semantic search API via Chrome runtime messaging
   */
  async callSemanticSearchAPI(query, location) {
    try {
      console.log('BusinessMatcher: Calling semantic search API via runtime messaging');
      
      const message = {
        action: 'semanticSearch',
        data: {
          query: query,
          lat: location.lat,
          lng: location.lng,
          radius: 10, // 10 mile search radius
          limit: 8    // Get up to 8 alternatives
        }
      };
      
      console.log('BusinessMatcher: Sending message to service worker:', message);
      
      const response = await chrome.runtime.sendMessage(message);
      
      if (response && response.success) {
        console.log('BusinessMatcher: Semantic search API response:', response.data);
        return response.data;
      } else {
        throw new Error(response?.error || 'Unknown error from service worker');
      }
      
    } catch (error) {
      console.error('BusinessMatcher: Error calling semantic search API:', error);
      throw error;
    }
  }

  /**
   * Removed: extractBusinessesFromDocument() and extractCoordsFromContainer()
   * Now using semantic search API instead of DOM extraction
   */

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
   * Removed: PlaceID validation methods - No longer needed with dynamic API-based search
   * The API now returns businesses with proper linking information
   */

  /**
   * Get matcher status for debugging
   */
  getStatus() {
    return {
      chainPatterns: this.chainPatterns.length,
      lastChainUpdate: this.lastChainUpdate,
      dynamicBusinessSearch: true,
      apiBasedAlternatives: true,
    };
  }
}

// Create singleton instance
export const businessMatcher = new BusinessMatcher();