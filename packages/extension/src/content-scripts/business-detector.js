import { CONFIG } from '../shared/constants.js';

/**
 * Business Detector for Google Maps
 * Identifies and extracts business information from Google Maps DOM
 */
export class BusinessDetector {
  constructor() {
    this.selectors = this.initializeSelectors();
    this.lastScanTimestamp = 0;
    this.scanThrottle = 500; // Minimum ms between scans
    this.processedElements = new WeakSet();
  }

  /**
   * Initialize DOM selectors for different Google Maps views
   * These selectors may need updates as Google changes their DOM structure
   */
  initializeSelectors() {
    return {
      // Main business listing containers (search results, sidebar)
      businessContainers: [
        '[data-value="Directions"]', // Business cards with directions button
        '[role="article"]', // Article elements containing business info
        '[jsaction*="pane.kp.place"]', // Place-related actions
        '.section-result', // Search result sections
        '.section-result-content', // Content within results
        '[data-result-index]', // Indexed results
        '.section-layout-root', // Layout root sections
        '.hfpxzc', // Modern Google Maps business card class
        '.Nv2PK', // Another modern Maps class
        '.bJzME', // Search result container
        '.lI9IFe', // Business listing container
        'div[jsaction*="mouseover"]', // Interactive elements
        'div[data-value][data-dtype]', // Data elements with values
        '[data-value="Directions"][role="button"]', // Map pins with directions
        'button[data-value="Directions"]', // Map direction buttons
        '.section-result-action-container button', // Action buttons in results
        'div[role="button"][aria-label*="directions"]', // Accessible direction buttons
      ],

      // Business name elements
      businessNames: [
        '[data-value="Directions"] [role="heading"]',
        '[role="article"] [role="heading"]',
        '.section-result-title',
        '.section-result-content h3',
        '.section-result-content [role="heading"]',
        '[data-value="Directions"] h1',
        '[data-value="Directions"] h2',
        '[data-value="Directions"] h3',
        '.x3AX1-LfntMc-header-title', // Specific Maps title class
        '[jsaction*="pane.kp.place"] h1',
        '.hfpxzc .qBF1Pd', // Modern Maps business name
        '.hfpxzc .NrDZNb', // Alternative modern Maps business name
        '.bJzME .qBF1Pd', // Search result business name
        '.lI9IFe span[role="heading"]', // Business listing heading
        'span[data-value][data-dtype="d3bn"] span', // Business name with specific data attributes
      ],

      // Business address elements
      businessAddresses: [
        '[data-value="Address"]',
        '.section-result-location',
        '.section-result-content [data-value*="address"]',
        '[aria-label*="Address"]',
        '.rogA2c', // Specific Maps address class
      ],

      // Business category/type elements
      businessCategories: [
        '.section-result-content .section-result-details',
        '[jsaction*="category"]',
        '.DkEaL', // Maps category class
      ],

      // Map markers and pins
      mapMarkers: [
        '[role="button"][data-value="Directions"]',
        '[aria-label*="results on the map"]',
        '.section-result-action-container',
      ],

      // Sidebar business listings
      sidebarListings: [
        '#pane .section-result',
        '#pane [role="article"]',
        '.section-layout-root .section-result',
      ],

      // Individual business cards/panels
      businessCards: [
        '.section-result',
        '[role="article"]',
        '.place-result',
        '.section-layout-root',
      ],
    };
  }

  /**
   * Scan for business elements in the current DOM
   */
  scanForBusinesses() {
    // Throttle scans to avoid performance issues
    const now = Date.now();
    if (now - this.lastScanTimestamp < this.scanThrottle) {
      return [];
    }
    this.lastScanTimestamp = now;

    const businesses = [];
    const processedNames = new Set(); // Avoid duplicates

    try {
      // Find all potential business containers
      const containers = this.findBusinessContainers();
      console.log(`BusinessDetector: Found ${containers.length} potential containers`);
      
      // DEBUG: Log some container details
      containers.slice(0, 3).forEach((container, i) => {
        console.log(`Container ${i}:`, {
          tagName: container.tagName,
          className: container.className,
          textContent: container.textContent?.slice(0, 100),
          hasDirections: !!container.querySelector('[data-value="Directions"]'),
          hasHeadings: container.querySelectorAll('h1, h2, h3, h4, [role="heading"]').length
        });
      });
      
      for (const container of containers) {
        // Skip if already processed
        if (this.processedElements.has(container)) {
          continue;
        }

        const businessInfo = this.extractBusinessInfo(container);
        
        if (businessInfo && businessInfo.name && !processedNames.has(businessInfo.name)) {
          console.log(`BusinessDetector: Found business: ${businessInfo.name}`);
          businesses.push({
            ...businessInfo,
            element: container,
            timestamp: now,
          });
          
          processedNames.add(businessInfo.name);
          this.processedElements.add(container);
        } else if (businessInfo) {
          console.log(`BusinessDetector: Skipped business (no name or duplicate): ${businessInfo.name || 'unnamed'}`);
        }
      }

      console.log(`BusinessDetector: Found ${businesses.length} businesses`);
      return businesses;

    } catch (error) {
      console.error('BusinessDetector: Error during scan:', error);
      return [];
    }
  }

  /**
   * Find all business container elements
   */
  findBusinessContainers() {
    const containers = new Set();

    // Try each selector group
    for (const selectorList of Object.values(this.selectors)) {
      for (const selector of selectorList) {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => containers.add(el));
        } catch (error) {
          // Invalid selector, skip it
          console.warn(`Invalid selector: ${selector}`, error);
        }
      }
    }

    console.log(`BusinessDetector: Found ${containers.size} containers from selectors`);

    // If no containers found, try fallback approach
    if (containers.size === 0) {
      console.log('BusinessDetector: No containers found, trying fallback approach');
      this.addFallbackContainers(containers);
    }

    // Filter to only actual business containers
    const allContainers = Array.from(containers);
    const filteredContainers = allContainers.filter(container => {
      const isLikely = this.isLikelyBusinessContainer(container);
      
      // Enhanced debugging
      if (!isLikely) {
        console.log('BusinessDetector: Filtered out container:', {
          element: container,
          textContent: container.textContent?.slice(0, 100),
          hasDirections: !!container.querySelector('[data-value="Directions"]'),
          hasHeading: !!container.querySelector('[role="heading"]'),
          classList: Array.from(container.classList),
          attributes: container.attributes ? Array.from(container.attributes).map(attr => ({name: attr.name, value: attr.value})) : []
        });
      }
      
      return isLikely;
    });
    
    console.log(`BusinessDetector: After filtering, ${filteredContainers.length} containers remain`);
    
    // Temporary: if no containers pass filter, let's see what we have
    if (filteredContainers.length === 0 && allContainers.length > 0) {
      console.log('BusinessDetector: No containers passed filter, using first 3 unfiltered for debugging');
      return allContainers.slice(0, 3);
    }
    
    return filteredContainers;
  }

  /**
   * Fallback method to find business containers when normal selectors fail
   */
  addFallbackContainers(containers) {
    // Look for elements that contain business names like "safeway", "walmart", etc.
    const businessKeywords = ['safeway', 'walmart', 'frys', 'target', 'mcdonald', 'starbucks', 'cvs'];
    
    for (const keyword of businessKeywords) {
      try {
        // Use a safer approach - search all text nodes
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        
        let node;
        while (node = walker.nextNode()) {
          if (node.textContent.toLowerCase().includes(keyword)) {
            const element = node.parentElement;
            if (element) {
              containers.add(element);
              // Find the nearest business container
              const container = element.closest('[role="article"], div[jsaction], div[data-result-index], .hfpxzc, [data-value="Directions"]');
              if (container) {
                containers.add(container);
              }
            }
          }
        }
      } catch (error) {
        console.warn(`BusinessDetector: Error searching for keyword "${keyword}":`, error);
      }
    }
    
    console.log(`BusinessDetector: Fallback found ${containers.size} total containers`);
  }

  /**
   * Check if an element is likely a business container
   */
  isLikelyBusinessContainer(element) {
    if (!element || !element.textContent) {
      return false;
    }

    const text = element.textContent.toLowerCase();
    const hasBusinessIndicators = 
      element.querySelector('[data-value="Directions"]') ||
      element.querySelector('[role="heading"]') ||
      text.includes('directions') ||
      text.includes('call') ||
      text.includes('website') ||
      text.includes('reviews') ||
      text.includes('hours') ||
      element.hasAttribute('data-result-index') ||
      element.classList.contains('section-result');

    const isNotFooter = !element.closest('footer') && !element.closest('[role="contentinfo"]');
    const isNotNavigation = !element.closest('nav') && !element.closest('[role="navigation"]');
    
    return hasBusinessIndicators && isNotFooter && isNotNavigation;
  }

  /**
   * Extract business information from a container element
   */
  extractBusinessInfo(container) {
    try {
      const businessInfo = {
        name: this.extractBusinessName(container),
        address: this.extractBusinessAddress(container),
        category: this.extractBusinessCategory(container),
        element: container,
        url: window.location.href,
        elementId: this.generateElementId(container),
      };

      // Must have at least a name to be considered valid
      if (!businessInfo.name) {
        return null;
      }

      // Try to extract location if possible
      const location = this.extractLocation(container);
      if (location) {
        businessInfo.location = location;
      }

      // Capture Google Maps specific data attributes for pin correlation
      businessInfo.googleMapsData = this.extractGoogleMapsData(container);
      
      // Enhanced logging for debugging sidebar-to-pin relationships
      console.log('BusinessDetector: Enhanced business data extracted:', {
        name: businessInfo.name,
        googleMapsData: businessInfo.googleMapsData
      });

      return businessInfo;

    } catch (error) {
      console.error('BusinessDetector: Error extracting business info:', error);
      return null;
    }
  }

  /**
   * Extract business name from container
   */
  extractBusinessName(container) {
    // Try various heading selectors
    for (const selector of this.selectors.businessNames) {
      try {
        const nameElement = container.querySelector(selector);
        if (nameElement && nameElement.textContent.trim()) {
          const name = this.cleanBusinessName(nameElement.textContent.trim());
          console.log(`BusinessDetector: Found name "${name}" using selector "${selector}"`);
          
          // Skip generic/system terms
          if (this.isGenericTerm(name)) {
            console.log(`BusinessDetector: Skipping generic term: ${name}`);
            continue;
          }
          
          return name;
        }
      } catch (error) {
        // Skip invalid selectors
      }
    }

    // Fallback: look for any heading in the container
    const headings = container.querySelectorAll('h1, h2, h3, h4, [role="heading"]');
    for (const heading of headings) {
      const text = heading.textContent.trim();
      console.log(`BusinessDetector: Checking heading text: "${text}"`);
      
      if (text && text.length > 2 && text.length < 100 && !this.isGenericTerm(text)) {
        return this.cleanBusinessName(text);
      }
    }

    return null;
  }

  /**
   * Extract business address from container
   */
  extractBusinessAddress(container) {
    for (const selector of this.selectors.businessAddresses) {
      try {
        const addressElement = container.querySelector(selector);
        if (addressElement && addressElement.textContent.trim()) {
          return addressElement.textContent.trim();
        }
      } catch (error) {
        // Skip invalid selectors
      }
    }

    // Look for text patterns that might be addresses
    const textNodes = this.getTextNodes(container);
    for (const node of textNodes) {
      const text = node.textContent.trim();
      if (this.looksLikeAddress(text)) {
        return text;
      }
    }

    return null;
  }

  /**
   * Extract business category from container
   */
  extractBusinessCategory(container) {
    for (const selector of this.selectors.businessCategories) {
      try {
        const categoryElement = container.querySelector(selector);
        if (categoryElement && categoryElement.textContent.trim()) {
          return categoryElement.textContent.trim();
        }
      } catch (error) {
        // Skip invalid selectors
      }
    }

    return 'other';
  }

  /**
   * Extract location coordinates if available
   */
  extractLocation(container) {
    // Try to find coordinates in data attributes
    const coords = container.querySelector('[data-coords]');
    if (coords) {
      try {
        const coordsData = coords.getAttribute('data-coords');
        const [lat, lng] = coordsData.split(',').map(parseFloat);
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng };
        }
      } catch (error) {
        // Invalid coordinates
      }
    }

    // Look for coordinates in URLs within the container
    const links = container.querySelectorAll('a[href*="@"], a[href*="maps"]');
    for (const link of links) {
      const coords = this.extractCoordsFromUrl(link.href);
      if (coords) {
        return coords;
      }
    }

    return null;
  }

  /**
   * Extract coordinates from a Maps URL
   */
  extractCoordsFromUrl(url) {
    try {
      const matches = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (matches) {
        return {
          lat: parseFloat(matches[1]),
          lng: parseFloat(matches[2])
        };
      }
    } catch (error) {
      // Invalid URL
    }
    return null;
  }

  /**
   * Check if a term is too generic to be a business name
   */
  isGenericTerm(text) {
    if (!text) return true;
    
    const genericTerms = [
      'results', 'search results', 'map results',
      'loading', 'loading...', 'search',
      'directions', 'call', 'website', 'save',
      'more options', 'options', 'menu',
      'filter', 'filters', 'sort', 'view all',
      'show more', 'show less', 'expand', 'collapse'
    ];
    
    const lowerText = text.toLowerCase().trim();
    return genericTerms.includes(lowerText) || lowerText.length < 3;
  }

  /**
   * Clean and normalize business name
   */
  cleanBusinessName(name) {
    if (!name) return null;
    
    return name
      .trim()
      // Remove rating indicators
      .replace(/\d+\.\d+\s*★.*$/, '')
      .replace(/\(\d+\).*$/, '')
      // Remove common prefixes/suffixes
      .replace(/^(Sponsored|Ad)\s*[-·]?\s*/i, '')
      .replace(/\s*[-·]\s*(Sponsored|Ad)$/i, '')
      .trim();
  }

  /**
   * Check if text looks like an address
   */
  looksLikeAddress(text) {
    if (!text || text.length < 10 || text.length > 200) {
      return false;
    }

    // Look for address patterns
    const addressPatterns = [
      /\d+\s+\w+\s+(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|way|ct|court|pl|place)/i,
      /\d+\s+[nsew]\.?\s+\w+/i, // "123 N Main"
      /\w+,\s*[A-Z]{2}\s+\d{5}/, // "City, ST 12345"
    ];

    return addressPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Get all text nodes within an element
   */
  getTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.trim()) {
        textNodes.push(node);
      }
    }

    return textNodes;
  }

  /**
   * Extract Google Maps specific data for pin correlation
   */
  extractGoogleMapsData(container) {
    const googleData = {
      attributes: {},
      classes: [],
      jsActions: [],
      dataValues: [],
      coordinates: null,
      placeId: null,
      businessId: null
    };

    try {
      // Collect all data-* attributes
      if (container.attributes) {
        for (const attr of container.attributes) {
          if (attr.name.startsWith('data-')) {
            googleData.attributes[attr.name] = attr.value;
          }
        }
      }

      // Collect CSS classes
      googleData.classes = Array.from(container.classList);

      // Look for jsaction attributes (Google Maps uses these extensively)
      const jsActionElements = container.querySelectorAll('[jsaction], [data-jsaction]');
      jsActionElements.forEach(el => {
        const jsAction = el.getAttribute('jsaction') || el.getAttribute('data-jsaction');
        if (jsAction) {
          googleData.jsActions.push(jsAction);
        }
      });

      // Look for data-value attributes (common in Google Maps buttons)
      const dataValueElements = container.querySelectorAll('[data-value]');
      dataValueElements.forEach(el => {
        const dataValue = el.getAttribute('data-value');
        if (dataValue) {
          googleData.dataValues.push(dataValue);
        }
      });

      // Look for possible coordinates in various formats
      const coordinatePatterns = [
        /(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/, // "33.1234, -112.5678"
        /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/, // "@33.1234,-112.5678"
      ];

      const containerText = container.textContent;
      for (const pattern of coordinatePatterns) {
        const match = containerText.match(pattern);
        if (match) {
          googleData.coordinates = {
            lat: parseFloat(match[1]),
            lng: parseFloat(match[2])
          };
          break;
        }
      }

      // Look for possible Google Place IDs (format: ChI...)
      const placeIdMatch = containerText.match(/ChI[a-zA-Z0-9_-]+/);
      if (placeIdMatch) {
        googleData.placeId = placeIdMatch[0];
      }

      // Look for possible business/location IDs in href attributes
      const links = container.querySelectorAll('a[href]');
      links.forEach(link => {
        const href = link.getAttribute('href');
        
        // Extract place ID from Google Maps URLs
        const placeIdMatch = href.match(/place\/([^\/]+)/);
        if (placeIdMatch) {
          googleData.placeId = placeIdMatch[1];
        }

        // Extract other IDs from Maps URLs
        const idMatches = href.match(/@([^,]+),([^,]+),.*!(\w+)/);
        if (idMatches) {
          googleData.businessId = idMatches[3];
        }
      });

      // Look for map-specific element identifiers
      const mapElements = container.querySelectorAll('[role="button"], [aria-label*="directions"], [aria-label*="call"]');
      mapElements.forEach(el => {
        if (el.getAttribute('aria-label')) {
          // Store aria-labels that might help correlate with map pins
          if (!googleData.ariaLabels) {
            googleData.ariaLabels = [];
          }
          googleData.ariaLabels.push(el.getAttribute('aria-label'));
        }
      });

    } catch (error) {
      console.error('Error extracting Google Maps data:', error);
    }

    return googleData;
  }

  /**
   * Generate a unique ID for an element
   */
  generateElementId(element) {
    // Try to create a stable identifier
    const rect = element.getBoundingClientRect();
    const text = element.textContent.slice(0, 50).replace(/\s+/g, '');
    return `${text}_${Math.round(rect.top)}_${Math.round(rect.left)}`;
  }

  /**
   * Find business elements that have been added since last scan
   */
  findNewBusinessElements() {
    const allBusinesses = this.scanForBusinesses();
    return allBusinesses.filter(business => !this.processedElements.has(business.element));
  }

  /**
   * Clear processed elements cache (for when page navigates)
   */
  clearProcessedCache() {
    this.processedElements = new WeakSet();
    this.lastScanTimestamp = 0;
    console.log('BusinessDetector: Cleared processed elements cache');
  }

  /**
   * Get detector status for debugging
   */
  getStatus() {
    return {
      lastScan: this.lastScanTimestamp,
      scanThrottle: this.scanThrottle,
      selectorsCount: Object.values(this.selectors).flat().length,
    };
  }
}

// Create singleton instance
export const businessDetector = new BusinessDetector();