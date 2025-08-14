import { CONFIG } from './constants.js';

/**
 * Business Matcher Utility
 * Handles LFA business search and location extraction for binary toggle system
 */
export class BusinessMatcher {
  constructor() {
    // Removed chain detection functionality - binary LFA/Google mode only
  }

  /**
   * Removed: Chain detection methods (isChainBusiness, findLocalAlternatives) 
   * - Binary LFA/Google mode doesn't need chain detection
   * - LFA mode shows only LFA businesses, Google mode shows only Google results
   */

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
   * Removed: Chain-related utility methods (generateFallbackQuery, callSemanticSearchAPI, 
   * calculateMatchConfidence, calculateNameSimilarity, calculateDistance) 
   * - Not needed for binary LFA/Google toggle system
   * - LFA business search uses dedicated findLFABusinesses method
   */

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
   * Find LFA businesses for a search query and location
   * This is the main method for LFA mode - returns all relevant local businesses
   */
  async findLFABusinesses(query, location) {
    try {
      console.log(`BusinessMatcher: Searching LFA businesses for "${query}" near ${location.lat}, ${location.lng}`);
      
      // Use semantic search to find LFA businesses matching the query
      const searchData = {
        query: query,
        lat: location.lat,
        lng: location.lng,
        radius: 15, // Larger radius for more comprehensive results
        limit: 20   // More businesses for LFA mode
      };
      
      const response = await chrome.runtime.sendMessage({
        action: 'semanticSearch',
        data: searchData
      });
      
      console.log('BusinessMatcher: Received response from service worker:', response);
      
      if (response && response.success && response.data && response.data.businesses) {
        const businesses = response.data.businesses;
        console.log(`BusinessMatcher: Found ${businesses.length} LFA businesses`);
        
        // Add display formatting for businesses
        return businesses.map(business => ({
          ...business,
          // Ensure we have proper display fields
          name: business.name || business.business_name || 'Local Business',
          address: business.address || business.formatted_address,
          category: business.category || business.business_type,
          description: business.description || business.about,
          phone: business.phone || business.phone_number,
          website: business.website || business.website_url,
          // Keep original data for map pins
          lat: business.lat || business.latitude,
          lng: business.lng || business.longitude
        }));
      } else {
        console.log('BusinessMatcher: No LFA businesses found');
        return [];
      }
      
    } catch (error) {
      console.error('BusinessMatcher: Error finding LFA businesses:', error);
      return [];
    }
  }

  /**
   * Get matcher status for debugging
   */
  getStatus() {
    return {
      mode: 'binary_lfa_google_toggle',
      lfaBusinessSearch: true,
      locationExtraction: true,
      queryExtraction: true,
    };
  }
}

// Create singleton instance
export const businessMatcher = new BusinessMatcher();