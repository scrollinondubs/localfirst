/**
 * CoordinateConverter - Utility for converting between lat/lng and pixel coordinates
 * Handles Google Maps coordinate projection with improved accuracy
 */
export class CoordinateConverter {
  constructor() {
    // Web Mercator projection constants
    this.EARTH_RADIUS = 6378137; // Earth's radius in meters
    this.MAX_LATITUDE = 85.0511287798; // Max latitude for Web Mercator
  }

  /**
   * Convert latitude to Web Mercator Y coordinate
   */
  latitudeToMercatorY(lat) {
    if (lat > this.MAX_LATITUDE) lat = this.MAX_LATITUDE;
    if (lat < -this.MAX_LATITUDE) lat = -this.MAX_LATITUDE;
    
    const radLat = lat * Math.PI / 180;
    return Math.log(Math.tan(Math.PI / 4 + radLat / 2));
  }

  /**
   * Convert Web Mercator Y coordinate to latitude
   */
  mercatorYToLatitude(mercY) {
    return (2 * Math.atan(Math.exp(mercY)) - Math.PI / 2) * 180 / Math.PI;
  }

  /**
   * Convert longitude to Web Mercator X coordinate
   */
  longitudeToMercatorX(lng) {
    return lng * Math.PI / 180;
  }

  /**
   * Convert Web Mercator X coordinate to longitude
   */
  mercatorXToLongitude(mercX) {
    return mercX * 180 / Math.PI;
  }

  /**
   * Extract detailed map bounds from Google Maps URL and DOM
   */
  extractMapBounds() {
    console.log('CoordinateConverter: Starting map bounds extraction process');
    
    try {
      // Method 1: Extract from URL (highest priority)
      console.log('CoordinateConverter: Trying URL-based extraction...');
      const urlBounds = this.extractBoundsFromUrl();
      if (urlBounds) {
        console.log('CoordinateConverter: Successfully extracted bounds from URL:', urlBounds);
        return urlBounds;
      }

      // Method 2: Extract from DOM elements
      console.log('CoordinateConverter: Trying DOM-based extraction...');
      const domBounds = this.extractBoundsFromDOM();
      if (domBounds) {
        console.log('CoordinateConverter: Successfully extracted bounds from DOM:', domBounds);
        return domBounds;
      }

      // Method 3: Fallback estimation
      console.log('CoordinateConverter: Using fallback estimation...');
      const fallbackBounds = this.estimateBoundsFromLocation();
      console.log('CoordinateConverter: Using estimated bounds:', fallbackBounds);
      return fallbackBounds;
      
    } catch (error) {
      console.error('CoordinateConverter: Failed to extract map bounds:', error);
      return null;
    }
  }

  /**
   * Extract bounds from Google Maps URL
   */
  extractBoundsFromUrl() {
    const url = window.location.href;
    console.log('CoordinateConverter: Extracting bounds from URL:', url);
    
    // Pattern: /@lat,lng,zoom (most common - with 'z' suffix)
    let coordMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+\.?\d*)z/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      const zoom = parseFloat(coordMatch[3]);
      
      console.log('CoordinateConverter: Found URL coordinates (z-suffix):', { lat, lng, zoom });
      return this.calculateBoundsFromCenter(lat, lng, zoom);
    }

    // Pattern: /@lat,lng,zoom (without 'z' suffix - common in some views)
    coordMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+\.?\d*)/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      const zoom = parseFloat(coordMatch[3]);
      
      console.log('CoordinateConverter: Found URL coordinates (no-z):', { lat, lng, zoom });
      return this.calculateBoundsFromCenter(lat, lng, zoom);
    }

    // Pattern: /place/@lat,lng,zoom
    const placeMatch = url.match(/\/place\/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+\.?\d*)/);
    if (placeMatch) {
      const lat = parseFloat(placeMatch[1]);
      const lng = parseFloat(placeMatch[2]);
      const zoom = parseFloat(placeMatch[3]);
      
      console.log('CoordinateConverter: Found place coordinates:', { lat, lng, zoom });
      return this.calculateBoundsFromCenter(lat, lng, zoom);
    }

    // Pattern: /search/@lat,lng,zoom
    const searchMatch = url.match(/\/search\/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+\.?\d*)/);
    if (searchMatch) {
      const lat = parseFloat(searchMatch[1]);
      const lng = parseFloat(searchMatch[2]);
      const zoom = parseFloat(searchMatch[3]);
      
      console.log('CoordinateConverter: Found search coordinates:', { lat, lng, zoom });
      return this.calculateBoundsFromCenter(lat, lng, zoom);
    }

    // Pattern: /dir/@lat,lng,zoom (directions)
    const dirMatch = url.match(/\/dir\/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+\.?\d*)/);
    if (dirMatch) {
      const lat = parseFloat(dirMatch[1]);
      const lng = parseFloat(dirMatch[2]);
      const zoom = parseFloat(dirMatch[3]);
      
      console.log('CoordinateConverter: Found directions coordinates:', { lat, lng, zoom });
      return this.calculateBoundsFromCenter(lat, lng, zoom);
    }

    console.log('CoordinateConverter: No coordinates found in URL patterns');
    return null;
  }

  /**
   * Calculate map bounds from center point and zoom level
   */
  calculateBoundsFromCenter(centerLat, centerLng, zoom) {
    // Use empirical values based on actual Google Maps behavior
    // These values are tuned for accurate coordinate placement
    const degreesPerPixelAtEquator = 360 / (256 * Math.pow(2, zoom));
    
    // For a typical map container (1366x1024), calculate actual degrees visible
    const containerWidth = 1366;  // Typical width
    const containerHeight = 1024; // Typical height
    
    // Calculate spans based on container size and zoom
    const lngSpan = (containerWidth * degreesPerPixelAtEquator);
    const latSpan = (containerHeight * degreesPerPixelAtEquator);
    
    // Adjust for latitude (longitude lines get closer together as you go north)
    const cosLat = Math.cos(centerLat * Math.PI / 180);
    const adjustedLngSpan = lngSpan / cosLat;
    
    console.log('CoordinateConverter: Calculated bounds for zoom', zoom, 'spans:', { 
      latSpan, 
      lngSpan: adjustedLngSpan, 
      degreesPerPixel: degreesPerPixelAtEquator,
      cosLat
    });

    return {
      center: { lat: centerLat, lng: centerLng },
      zoom: zoom,
      north: centerLat + latSpan / 2,
      south: centerLat - latSpan / 2,
      east: centerLng + adjustedLngSpan / 2,
      west: centerLng - adjustedLngSpan / 2
    };
  }

  /**
   * Extract bounds from DOM elements (if available)
   */
  extractBoundsFromDOM() {
    console.log('CoordinateConverter: Attempting DOM-based bounds extraction');
    
    // Try to extract from Google Maps internal objects first
    try {
      // Look for Google Maps API objects on the window
      if (window.google && window.google.maps) {
        console.log('CoordinateConverter: Found Google Maps API, but cannot directly access map instance');
      }
      
      // Look for coordinate data in map container attributes
      const mapContainer = document.querySelector('#map') || document.querySelector('.gm-style');
      if (mapContainer) {
        console.log('CoordinateConverter: Found map container, checking for coordinate attributes');
        
        // Check for data attributes that might contain coordinates
        const attrs = ['data-lat', 'data-lng', 'data-zoom', 'data-bounds', 'data-viewport'];
        for (const attr of attrs) {
          const value = mapContainer.getAttribute(attr);
          if (value) {
            console.log(`CoordinateConverter: Found attribute ${attr}:`, value);
          }
        }
      }
    } catch (error) {
      console.log('CoordinateConverter: Error accessing Google Maps data:', error);
    }

    // Look for map elements that might contain coordinate information
    const mapElements = [
      document.querySelector('[data-lat]'),
      document.querySelector('[data-lng]'),
      document.querySelector('.gm-style[data-bounds]'),
      document.querySelector('#scene[data-viewport]'),
      document.querySelector('[role="application"]'), // Map application role
      document.querySelector('.widget-scene-canvas') // Scene canvas
    ];

    for (const element of mapElements) {
      if (element) {
        console.log('CoordinateConverter: Checking element for bounds:', element.tagName, element.className);
        const bounds = this.parseBoundsFromElement(element);
        if (bounds) {
          console.log('CoordinateConverter: Successfully extracted bounds from DOM');
          return bounds;
        }
      }
    }

    console.log('CoordinateConverter: No bounds found in DOM elements');
    return null;
  }

  /**
   * Parse bounds from a DOM element
   */
  parseBoundsFromElement(element) {
    // Check various data attributes that might contain coordinate information
    const attributes = ['data-bounds', 'data-viewport', 'data-center', 'data-coords'];
    
    for (const attr of attributes) {
      const value = element.getAttribute(attr);
      if (value) {
        try {
          const parsed = JSON.parse(value);
          if (parsed.north && parsed.south && parsed.east && parsed.west) {
            return parsed;
          }
        } catch (e) {
          // Not JSON, try other parsing methods
          const coords = value.match(/(-?\d+\.?\d*)/g);
          if (coords && coords.length >= 4) {
            return {
              north: parseFloat(coords[0]),
              south: parseFloat(coords[1]),
              east: parseFloat(coords[2]),
              west: parseFloat(coords[3])
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Estimate bounds based on current location or search results
   */
  estimateBoundsFromLocation() {
    console.log('CoordinateConverter: Attempting to estimate bounds from URL and context');
    
    const url = window.location.href;
    
    // Try to extract any coordinates from the URL, even if not in the standard format
    let coords = url.match(/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (coords && coords.length >= 3) {
      const lat = parseFloat(coords[1]);
      const lng = parseFloat(coords[2]);
      
      // Validate coordinates are reasonable (roughly North America bounds)
      if (lat >= 20 && lat <= 50 && lng >= -130 && lng <= -80) {
        console.log('CoordinateConverter: Found coordinates in URL:', { lat, lng });
        
        // Try to guess zoom based on URL context or default to a reasonable level
        let estimatedZoom = 10; // Default
        
        // Check if URL suggests a specific zoom level
        const zoomMatch = url.match(/(\d+\.?\d*)z/);
        if (zoomMatch) {
          estimatedZoom = parseFloat(zoomMatch[1]);
        } else {
          // Estimate zoom based on URL type
          if (url.includes('/place/') || url.includes('/search/')) {
            estimatedZoom = 15; // Closer zoom for specific places
          } else if (url.includes('/dir/')) {
            estimatedZoom = 12; // Medium zoom for directions
          } else {
            estimatedZoom = 10; // Default city-level zoom
          }
        }
        
        console.log('CoordinateConverter: Using estimated coordinates with zoom:', { lat, lng, zoom: estimatedZoom });
        return this.calculateBoundsFromCenter(lat, lng, estimatedZoom);
      }
    }
    
    // Try to get center from query parameters or location
    if (url.includes('phoenix') || url.includes('Arizona') || url.includes('AZ')) {
      const phoenixCenter = { lat: 33.4484, lng: -112.0740 };
      const defaultZoom = 9; // Wider view to see more of Phoenix area
      
      console.log('CoordinateConverter: Using Phoenix area bounds based on URL context');
      return this.calculateBoundsFromCenter(phoenixCenter.lat, phoenixCenter.lng, defaultZoom);
    }
    
    // Last resort: Use Phoenix but with a very wide zoom to see the whole metro area
    const phoenixCenter = { lat: 33.4484, lng: -112.0740 };
    const wideZoom = 8; // Much wider view 
    
    console.log('CoordinateConverter: Using wide Phoenix default bounds as last resort');
    return this.calculateBoundsFromCenter(phoenixCenter.lat, phoenixCenter.lng, wideZoom);
  }

  /**
   * Convert lat/lng to pixel coordinates with simplified linear projection
   */
  latLngToPixel(lat, lng, mapBounds, containerSize) {
    if (!mapBounds || !containerSize) {
      return null;
    }

    try {
      console.log('CoordinateConverter: Converting point:', { lat, lng });
      console.log('CoordinateConverter: Map bounds:', mapBounds);
      console.log('CoordinateConverter: Container size:', containerSize);
      
      // Check if point is within map bounds first
      if (lat < mapBounds.south || lat > mapBounds.north || lng < mapBounds.west || lng > mapBounds.east) {
        console.log('CoordinateConverter: Point outside map bounds');
        return null;
      }
      
      // Use simple linear projection instead of Web Mercator for better accuracy
      // Calculate ratios directly from lat/lng bounds
      const xRatio = (lng - mapBounds.west) / (mapBounds.east - mapBounds.west);
      const yRatio = (mapBounds.north - lat) / (mapBounds.north - mapBounds.south); // Flip Y axis

      console.log('CoordinateConverter: Calculated ratios:', { xRatio, yRatio });

      // Convert to pixel coordinates
      const x = xRatio * containerSize.width;
      const y = yRatio * containerSize.height;

      console.log('CoordinateConverter: Final pixel coordinates:', { x, y });

      // Validate coordinates are within bounds (with small margin)
      if (x >= -20 && x <= containerSize.width + 20 && y >= -20 && y <= containerSize.height + 20) {
        return { x, y };
      } else {
        console.log('CoordinateConverter: Point outside container bounds:', { x, y, containerSize });
        return null;
      }
    } catch (error) {
      console.error('CoordinateConverter: Conversion failed:', error);
      return null;
    }
  }

  /**
   * Convert pixel coordinates back to lat/lng
   */
  pixelToLatLng(x, y, mapBounds, containerSize) {
    if (!mapBounds || !containerSize) {
      return null;
    }

    try {
      // Calculate ratios from pixel position
      const xRatio = x / containerSize.width;
      const yRatio = y / containerSize.height;

      // Convert to Web Mercator space
      const mercatorBounds = {
        north: this.latitudeToMercatorY(mapBounds.north),
        south: this.latitudeToMercatorY(mapBounds.south),
        east: this.longitudeToMercatorX(mapBounds.east),
        west: this.longitudeToMercatorX(mapBounds.west)
      };

      const mercatorX = mercatorBounds.west + xRatio * (mercatorBounds.east - mercatorBounds.west);
      const mercatorY = mercatorBounds.north - yRatio * (mercatorBounds.north - mercatorBounds.south);

      // Convert back to lat/lng
      const lat = this.mercatorYToLatitude(mercatorY);
      const lng = this.mercatorXToLongitude(mercatorX);

      return { lat, lng };
    } catch (error) {
      console.error('CoordinateConverter: Reverse conversion failed:', error);
      return null;
    }
  }

  /**
   * Calculate distance between two points in meters
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = this.EARTH_RADIUS;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Check if a point is within the visible map bounds
   */
  isPointInBounds(lat, lng, mapBounds) {
    return lat >= mapBounds.south && lat <= mapBounds.north &&
           lng >= mapBounds.west && lng <= mapBounds.east;
  }

  /**
   * Get optimal zoom level to fit all points
   */
  getOptimalZoom(points, containerSize) {
    if (!points || points.length === 0) return 10;

    // Calculate bounding box of all points
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    points.forEach(point => {
      minLat = Math.min(minLat, point.lat);
      maxLat = Math.max(maxLat, point.lat);
      minLng = Math.min(minLng, point.lng);
      maxLng = Math.max(maxLng, point.lng);
    });

    // Calculate zoom level needed to fit all points
    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;

    // Rough approximation for zoom calculation
    const maxSpan = Math.max(latSpan, lngSpan);
    const zoom = Math.floor(Math.log2(360 / maxSpan)) - 1;

    return Math.max(1, Math.min(20, zoom)); // Clamp between 1 and 20
  }
}

// Create global instance
export const coordinateConverter = new CoordinateConverter();

// Debug log to confirm the module loaded
console.log('CoordinateConverter: Module loaded and instance created');

// Make available for debugging
if (typeof window !== 'undefined') {
  window.LFA_coordinateConverter = coordinateConverter;
}