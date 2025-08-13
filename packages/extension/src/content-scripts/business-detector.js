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
      
      for (const container of containers) {
        // Skip if already processed
        if (this.processedElements.has(container)) {
          continue;
        }

        const businessInfo = this.extractBusinessInfo(container);
        
        if (businessInfo && businessInfo.name && !processedNames.has(businessInfo.name)) {
          businesses.push({
            ...businessInfo,
            element: container,
            timestamp: now,
          });
          
          processedNames.add(businessInfo.name);
          this.processedElements.add(container);
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

    // Filter to only actual business containers
    return Array.from(containers).filter(container => {
      return this.isLikelyBusinessContainer(container);
    });
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
          return this.cleanBusinessName(nameElement.textContent.trim());
        }
      } catch (error) {
        // Skip invalid selectors
      }
    }

    // Fallback: look for any heading in the container
    const headings = container.querySelectorAll('h1, h2, h3, h4, [role="heading"]');
    for (const heading of headings) {
      const text = heading.textContent.trim();
      if (text && text.length > 2 && text.length < 100) {
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