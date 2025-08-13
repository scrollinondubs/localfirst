(function() {
  "use strict";
  const CONFIG = {
    // API Configuration
    API_BASE_URL: (() => {
      var _a;
      if (typeof process !== "undefined" && ((_a = process.env) == null ? void 0 : _a.NODE_ENV) === "production") {
        return "https://api-localfirst-az.your-domain.workers.dev";
      }
      return "http://localhost:8787";
    })(),
    // Extension Identity
    EXTENSION_ID: (() => {
      if (typeof chrome !== "undefined" && chrome.runtime) {
        return chrome.runtime.id;
      }
      return "local-dev-extension";
    })(),
    // Data Sync Configuration
    SYNC_INTERVAL: 24 * 60 * 60 * 1e3,
    // 24 hours in milliseconds
    // Analytics Configuration
    ANALYTICS: {
      ENABLED: true,
      BATCH_SIZE: 10,
      // Number of events to batch before sending
      FLUSH_INTERVAL: 5 * 60 * 1e3,
      // 5 minutes
      MAX_RETRIES: 3
    },
    // Business Filtering Configuration
    FILTERING: {
      DEFAULT_RADIUS: 5,
      // miles
      MAX_RADIUS: 25,
      // maximum search radius
      MAX_RESULTS: 100,
      // maximum businesses to return
      CONFIDENCE_THRESHOLD: 80
      // minimum confidence for chain matching
    },
    // Storage Keys
    STORAGE_KEYS: {
      CHAINS: "lfa_chains",
      SETTINGS: "lfa_settings",
      ANALYTICS_QUEUE: "lfa_analytics_queue",
      LAST_SYNC: "lfa_last_sync",
      CACHED_BUSINESSES: "lfa_cached_businesses"
    },
    // Default Settings
    DEFAULT_SETTINGS: {
      enabled: true,
      filterLevel: "moderate",
      // strict, moderate, light
      showBadges: true,
      showAlternatives: true,
      anonymousAnalytics: true
    },
    // Filter Levels
    FILTER_LEVELS: {
      strict: {
        hideChains: true,
        dimChains: false,
        showAlternatives: true,
        confidenceThreshold: 70
      },
      moderate: {
        hideChains: false,
        dimChains: true,
        showAlternatives: true,
        confidenceThreshold: 80
      },
      light: {
        hideChains: false,
        dimChains: true,
        showAlternatives: false,
        confidenceThreshold: 90
      }
    },
    // Event Types for Analytics
    EVENT_TYPES: {
      INSTALL: "install",
      VIEW: "view",
      CLICK: "click",
      FILTER_TOGGLE: "filter_toggle",
      SETTINGS_CHANGE: "settings_change",
      ERROR: "error"
    },
    // Business Categories
    CATEGORIES: [
      "restaurant",
      "retail",
      "professional_services",
      "health_wellness",
      "home_garden",
      "arts_entertainment",
      "automotive",
      "financial",
      "other"
    ]
  };
  class BusinessMatcher {
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
              confidence,
              matchedChain: {
                id: chain.id,
                name: chain.name,
                category: chain.category,
                parentCompany: chain.parentCompany,
                pattern
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
        const nameScore = this.calculateNameSimilarity(normalizedName, businessNormalized);
        let locationScore = 0;
        if (location && business.latitude && business.longitude) {
          const distance = this.calculateDistance(
            location.lat,
            location.lng,
            business.latitude,
            business.longitude
          );
          locationScore = Math.max(0, 1 - distance / 0.5);
        }
        const totalScore = nameScore * 0.8 + locationScore * 0.2;
        if (totalScore > bestScore && nameScore > 0.7) {
          bestScore = totalScore;
          bestMatch = {
            ...business,
            matchScore: totalScore,
            nameScore,
            locationScore
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
      const category = chainBusiness.category || "other";
      const categoryBusinesses = this.localBusinesses.filter(
        (business) => business.category === category || category === "other"
      );
      const businessesWithDistance = categoryBusinesses.map((business) => {
        if (!business.latitude || !business.longitude) {
          return null;
        }
        const distance = this.calculateDistance(
          location.lat,
          location.lng,
          business.latitude,
          business.longitude
        );
        return {
          ...business,
          distance
        };
      }).filter((business) => business && business.distance <= 5).sort((a, b) => a.distance - b.distance).slice(0, maxResults);
      return businessesWithDistance;
    }
    /**
     * Calculate match confidence between business name and pattern
     */
    calculateMatchConfidence(businessName, pattern) {
      const normalizedPattern = this.normalizeName(pattern);
      if (businessName === normalizedPattern) {
        return 100;
      }
      if (businessName.includes(normalizedPattern)) {
        return 90;
      }
      if (normalizedPattern.includes(businessName)) {
        return 85;
      }
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
            matrix[j - 1][i] + 1,
            // deletion
            matrix[j][i - 1] + 1,
            // insertion
            matrix[j - 1][i - 1] + cost
            // substitution
          );
        }
      }
      const maxLen = Math.max(len1, len2);
      return 1 - matrix[len2][len1] / maxLen;
    }
    /**
     * Calculate distance between two points using Haversine formula
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
      const R = 3959;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }
    /**
     * Normalize business name for matching
     */
    normalizeName(name) {
      if (!name) return "";
      return name.toLowerCase().trim().replace(/\b(llc|inc|corp|corporation|company|co|ltd|limited)\b/g, "").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
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
        const urlObj = new URL(url);
        const searchParams = urlObj.searchParams;
        const coords = searchParams.get("ll") || searchParams.get("center");
        if (coords) {
          const [lat, lng] = coords.split(",").map(parseFloat);
          if (!isNaN(lat) && !isNaN(lng)) {
            return { lat, lng };
          }
        }
        return null;
      } catch (error) {
        console.error("Failed to extract location from URL:", error);
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
        lastBusinessUpdate: this.lastBusinessUpdate
      };
    }
  }
  const businessMatcher = new BusinessMatcher();
  class BusinessDetector {
    constructor() {
      this.selectors = this.initializeSelectors();
      this.lastScanTimestamp = 0;
      this.scanThrottle = 500;
      this.processedElements = /* @__PURE__ */ new WeakSet();
    }
    /**
     * Initialize DOM selectors for different Google Maps views
     * These selectors may need updates as Google changes their DOM structure
     */
    initializeSelectors() {
      return {
        // Main business listing containers (search results, sidebar)
        businessContainers: [
          '[data-value="Directions"]',
          // Business cards with directions button
          '[role="article"]',
          // Article elements containing business info
          '[jsaction*="pane.kp.place"]',
          // Place-related actions
          ".section-result",
          // Search result sections
          ".section-result-content",
          // Content within results
          "[data-result-index]",
          // Indexed results
          ".section-layout-root"
          // Layout root sections
        ],
        // Business name elements
        businessNames: [
          '[data-value="Directions"] [role="heading"]',
          '[role="article"] [role="heading"]',
          ".section-result-title",
          ".section-result-content h3",
          '.section-result-content [role="heading"]',
          '[data-value="Directions"] h1',
          '[data-value="Directions"] h2',
          '[data-value="Directions"] h3',
          ".x3AX1-LfntMc-header-title",
          // Specific Maps title class
          '[jsaction*="pane.kp.place"] h1'
        ],
        // Business address elements
        businessAddresses: [
          '[data-value="Address"]',
          ".section-result-location",
          '.section-result-content [data-value*="address"]',
          '[aria-label*="Address"]',
          ".rogA2c"
          // Specific Maps address class
        ],
        // Business category/type elements
        businessCategories: [
          ".section-result-content .section-result-details",
          '[jsaction*="category"]',
          ".DkEaL"
          // Maps category class
        ],
        // Map markers and pins
        mapMarkers: [
          '[role="button"][data-value="Directions"]',
          '[aria-label*="results on the map"]',
          ".section-result-action-container"
        ],
        // Sidebar business listings
        sidebarListings: [
          "#pane .section-result",
          '#pane [role="article"]',
          ".section-layout-root .section-result"
        ],
        // Individual business cards/panels
        businessCards: [
          ".section-result",
          '[role="article"]',
          ".place-result",
          ".section-layout-root"
        ]
      };
    }
    /**
     * Scan for business elements in the current DOM
     */
    scanForBusinesses() {
      const now = Date.now();
      if (now - this.lastScanTimestamp < this.scanThrottle) {
        return [];
      }
      this.lastScanTimestamp = now;
      const businesses = [];
      const processedNames = /* @__PURE__ */ new Set();
      try {
        const containers = this.findBusinessContainers();
        for (const container of containers) {
          if (this.processedElements.has(container)) {
            continue;
          }
          const businessInfo = this.extractBusinessInfo(container);
          if (businessInfo && businessInfo.name && !processedNames.has(businessInfo.name)) {
            businesses.push({
              ...businessInfo,
              element: container,
              timestamp: now
            });
            processedNames.add(businessInfo.name);
            this.processedElements.add(container);
          }
        }
        console.log(`BusinessDetector: Found ${businesses.length} businesses`);
        return businesses;
      } catch (error) {
        console.error("BusinessDetector: Error during scan:", error);
        return [];
      }
    }
    /**
     * Find all business container elements
     */
    findBusinessContainers() {
      const containers = /* @__PURE__ */ new Set();
      for (const selectorList of Object.values(this.selectors)) {
        for (const selector of selectorList) {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach((el) => containers.add(el));
          } catch (error) {
            console.warn(`Invalid selector: ${selector}`, error);
          }
        }
      }
      return Array.from(containers).filter((container) => {
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
      const hasBusinessIndicators = element.querySelector('[data-value="Directions"]') || element.querySelector('[role="heading"]') || text.includes("directions") || text.includes("call") || text.includes("website") || text.includes("reviews") || text.includes("hours") || element.hasAttribute("data-result-index") || element.classList.contains("section-result");
      const isNotFooter = !element.closest("footer") && !element.closest('[role="contentinfo"]');
      const isNotNavigation = !element.closest("nav") && !element.closest('[role="navigation"]');
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
          elementId: this.generateElementId(container)
        };
        if (!businessInfo.name) {
          return null;
        }
        const location = this.extractLocation(container);
        if (location) {
          businessInfo.location = location;
        }
        return businessInfo;
      } catch (error) {
        console.error("BusinessDetector: Error extracting business info:", error);
        return null;
      }
    }
    /**
     * Extract business name from container
     */
    extractBusinessName(container) {
      for (const selector of this.selectors.businessNames) {
        try {
          const nameElement = container.querySelector(selector);
          if (nameElement && nameElement.textContent.trim()) {
            return this.cleanBusinessName(nameElement.textContent.trim());
          }
        } catch (error) {
        }
      }
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
        }
      }
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
        }
      }
      return "other";
    }
    /**
     * Extract location coordinates if available
     */
    extractLocation(container) {
      const coords = container.querySelector("[data-coords]");
      if (coords) {
        try {
          const coordsData = coords.getAttribute("data-coords");
          const [lat, lng] = coordsData.split(",").map(parseFloat);
          if (!isNaN(lat) && !isNaN(lng)) {
            return { lat, lng };
          }
        } catch (error) {
        }
      }
      const links = container.querySelectorAll('a[href*="@"], a[href*="maps"]');
      for (const link of links) {
        const coords2 = this.extractCoordsFromUrl(link.href);
        if (coords2) {
          return coords2;
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
      }
      return null;
    }
    /**
     * Clean and normalize business name
     */
    cleanBusinessName(name) {
      if (!name) return null;
      return name.trim().replace(/\d+\.\d+\s*★.*$/, "").replace(/\(\d+\).*$/, "").replace(/^(Sponsored|Ad)\s*[-·]?\s*/i, "").replace(/\s*[-·]\s*(Sponsored|Ad)$/i, "").trim();
    }
    /**
     * Check if text looks like an address
     */
    looksLikeAddress(text) {
      if (!text || text.length < 10 || text.length > 200) {
        return false;
      }
      const addressPatterns = [
        /\d+\s+\w+\s+(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|way|ct|court|pl|place)/i,
        /\d+\s+[nsew]\.?\s+\w+/i,
        // "123 N Main"
        /\w+,\s*[A-Z]{2}\s+\d{5}/
        // "City, ST 12345"
      ];
      return addressPatterns.some((pattern) => pattern.test(text));
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
      const rect = element.getBoundingClientRect();
      const text = element.textContent.slice(0, 50).replace(/\s+/g, "");
      return `${text}_${Math.round(rect.top)}_${Math.round(rect.left)}`;
    }
    /**
     * Find business elements that have been added since last scan
     */
    findNewBusinessElements() {
      const allBusinesses = this.scanForBusinesses();
      return allBusinesses.filter((business) => !this.processedElements.has(business.element));
    }
    /**
     * Clear processed elements cache (for when page navigates)
     */
    clearProcessedCache() {
      this.processedElements = /* @__PURE__ */ new WeakSet();
      this.lastScanTimestamp = 0;
      console.log("BusinessDetector: Cleared processed elements cache");
    }
    /**
     * Get detector status for debugging
     */
    getStatus() {
      return {
        lastScan: this.lastScanTimestamp,
        scanThrottle: this.scanThrottle,
        selectorsCount: Object.values(this.selectors).flat().length
      };
    }
  }
  const businessDetector = new BusinessDetector();
  class UIInjector {
    constructor() {
      this.injectedElements = /* @__PURE__ */ new WeakMap();
      this.styleSheet = null;
      this.initializeStyles();
    }
    /**
     * Initialize CSS styles for the extension
     */
    initializeStyles() {
      if (this.styleSheet) {
        return;
      }
      const style = document.createElement("style");
      style.id = "lfa-extension-styles";
      style.textContent = `
      /* Local First Arizona Extension Styles */
      
      /* LFA Badge Styles */
      .lfa-badge {
        display: inline-flex;
        align-items: center;
        background: linear-gradient(135deg, #2E7D32, #4CAF50);
        color: white;
        font-size: 11px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 8px;
        margin: 2px 4px 2px 0;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        z-index: 1000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        position: relative;
        animation: lfa-badge-appear 0.3s ease-out;
      }

      .lfa-badge::before {
        content: '🏪';
        margin-right: 3px;
        font-size: 10px;
      }

      .lfa-badge-member {
        background: linear-gradient(135deg, #1565C0, #2196F3);
      }

      .lfa-badge-verified {
        background: linear-gradient(135deg, #E65100, #FF9800);
      }

      .lfa-badge-verified::before {
        content: '✓';
        font-size: 9px;
        margin-right: 2px;
      }

      /* Chain Business Dimming */
      .lfa-chain-business {
        opacity: 0.4 !important;
        filter: grayscale(50%) !important;
        transition: opacity 0.3s ease, filter 0.3s ease !important;
        position: relative;
      }

      .lfa-chain-business::after {
        content: 'Chain Store';
        position: absolute;
        top: 2px;
        right: 2px;
        background: rgba(255, 152, 0, 0.9);
        color: white;
        font-size: 9px;
        padding: 1px 4px;
        border-radius: 3px;
        z-index: 1001;
        font-weight: 500;
      }

      .lfa-chain-business:hover {
        opacity: 0.7 !important;
        filter: grayscale(25%) !important;
      }

      /* Chain Business Hiding */
      .lfa-chain-hidden {
        display: none !important;
      }

      /* Local Alternative Suggestions */
      .lfa-alternatives {
        background: #f8f9fa;
        border: 1px solid #e8eaed;
        border-radius: 8px;
        padding: 8px;
        margin: 4px 0;
        font-size: 12px;
        position: relative;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }

      .lfa-alternatives-header {
        font-weight: 600;
        color: #2E7D32;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
      }

      .lfa-alternatives-header::before {
        content: '🏪';
        margin-right: 4px;
        font-size: 11px;
      }

      .lfa-alternative-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 0;
        border-bottom: 1px solid #f0f0f0;
      }

      .lfa-alternative-item:last-child {
        border-bottom: none;
      }

      .lfa-alternative-name {
        font-weight: 500;
        color: #1a73e8;
        cursor: pointer;
        flex: 1;
      }

      .lfa-alternative-name:hover {
        text-decoration: underline;
      }

      .lfa-alternative-distance {
        font-size: 10px;
        color: #70757a;
        margin-left: 8px;
      }

      /* Filter Status Indicator */
      .lfa-filter-status {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        z-index: 10000;
        backdrop-filter: blur(10px);
        transition: opacity 0.3s ease;
        pointer-events: none;
      }

      .lfa-filter-status.hidden {
        opacity: 0;
      }

      /* Animations */
      @keyframes lfa-badge-appear {
        from {
          opacity: 0;
          transform: scale(0.8);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      @keyframes lfa-pulse {
        0%, 100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.05);
        }
      }

      .lfa-badge-new {
        animation: lfa-pulse 2s ease-in-out;
      }

      /* Responsive adjustments */
      @media (max-width: 768px) {
        .lfa-badge {
          font-size: 10px;
          padding: 1px 4px;
        }
        
        .lfa-alternatives {
          font-size: 11px;
          padding: 6px;
        }
        
        .lfa-filter-status {
          bottom: 10px;
          right: 10px;
          font-size: 11px;
          padding: 6px 10px;
        }
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .lfa-badge {
          border: 2px solid white;
        }
        
        .lfa-chain-business {
          border: 2px solid orange;
        }
      }
    `;
      document.head.appendChild(style);
      this.styleSheet = style;
      console.log("UIInjector: Styles initialized");
    }
    /**
     * Add LFA badge to a business element
     */
    addLFABadge(element, businessInfo) {
      if (this.injectedElements.has(element)) {
        return;
      }
      try {
        const badge = this.createLFABadge(businessInfo);
        const insertionPoint = this.findBestInsertionPoint(element);
        if (insertionPoint) {
          insertionPoint.appendChild(badge);
          this.injectedElements.set(element, { badge, type: "lfa-badge" });
          console.log(`UIInjector: Added LFA badge for ${businessInfo.name}`);
        }
      } catch (error) {
        console.error("UIInjector: Failed to add LFA badge:", error);
      }
    }
    /**
     * Create LFA badge element
     */
    createLFABadge(businessInfo) {
      const badge = document.createElement("span");
      badge.className = "lfa-badge lfa-badge-new";
      if (businessInfo.verified) {
        badge.classList.add("lfa-badge-verified");
        badge.textContent = "Verified Local";
        badge.title = "Verified Local First Arizona Member";
      } else {
        badge.classList.add("lfa-badge-member");
        badge.textContent = "Local";
        badge.title = "Local First Arizona Member";
      }
      badge.addEventListener("click", (e) => {
        e.stopPropagation();
        this.handleBadgeClick(businessInfo);
      });
      setTimeout(() => {
        badge.classList.remove("lfa-badge-new");
      }, 2e3);
      return badge;
    }
    /**
     * Apply chain business filtering
     */
    applyChainFiltering(element, chainInfo, filterLevel) {
      if (this.injectedElements.has(element)) {
        return;
      }
      try {
        const settings = CONFIG.FILTER_LEVELS[filterLevel] || CONFIG.FILTER_LEVELS.moderate;
        if (settings.hideChains) {
          element.classList.add("lfa-chain-hidden");
          this.injectedElements.set(element, { type: "chain-hidden", chainInfo });
        } else if (settings.dimChains) {
          element.classList.add("lfa-chain-business");
          this.injectedElements.set(element, { type: "chain-dimmed", chainInfo });
        }
        console.log(`UIInjector: Applied ${filterLevel} filtering to ${chainInfo.name}`);
      } catch (error) {
        console.error("UIInjector: Failed to apply chain filtering:", error);
      }
    }
    /**
     * Show local alternatives when chain is filtered
     */
    showLocalAlternatives(element, chainInfo, alternatives) {
      if (!alternatives || alternatives.length === 0) {
        return;
      }
      try {
        const alternativesElement = this.createAlternativesElement(alternatives, chainInfo);
        const insertionPoint = this.findAlternativesInsertionPoint(element);
        if (insertionPoint) {
          insertionPoint.appendChild(alternativesElement);
          if (this.injectedElements.has(element)) {
            this.injectedElements.get(element).alternatives = alternativesElement;
          } else {
            this.injectedElements.set(element, { alternatives: alternativesElement, type: "alternatives" });
          }
          console.log(`UIInjector: Added ${alternatives.length} alternatives for ${chainInfo.name}`);
        }
      } catch (error) {
        console.error("UIInjector: Failed to show alternatives:", error);
      }
    }
    /**
     * Create local alternatives element
     */
    createAlternativesElement(alternatives, chainInfo) {
      const container = document.createElement("div");
      container.className = "lfa-alternatives";
      const header = document.createElement("div");
      header.className = "lfa-alternatives-header";
      header.textContent = `Local alternatives nearby:`;
      container.appendChild(header);
      alternatives.forEach((business) => {
        const item = document.createElement("div");
        item.className = "lfa-alternative-item";
        const name = document.createElement("span");
        name.className = "lfa-alternative-name";
        name.textContent = business.name;
        name.addEventListener("click", () => {
          this.handleAlternativeClick(business, chainInfo);
        });
        const distance = document.createElement("span");
        distance.className = "lfa-alternative-distance";
        distance.textContent = `${business.distance.toFixed(1)} mi`;
        item.appendChild(name);
        item.appendChild(distance);
        container.appendChild(item);
      });
      return container;
    }
    /**
     * Find the best place to insert a badge
     */
    findBestInsertionPoint(element) {
      const headings = element.querySelectorAll('h1, h2, h3, h4, [role="heading"]');
      if (headings.length > 0) {
        return headings[0].parentElement || headings[0];
      }
      const titleContainers = element.querySelectorAll(".section-result-title, .section-result-content");
      if (titleContainers.length > 0) {
        return titleContainers[0];
      }
      return element;
    }
    /**
     * Find place to insert alternatives
     */
    findAlternativesInsertionPoint(element) {
      const infoContainers = element.querySelectorAll(".section-result-content, .section-result");
      if (infoContainers.length > 0) {
        return infoContainers[0].parentElement || infoContainers[0];
      }
      return element;
    }
    /**
     * Show filter status indicator
     */
    showFilterStatus(filterLevel, chainsFiltered = 0, businessesHighlighted = 0) {
      this.hideFilterStatus();
      const status = document.createElement("div");
      status.className = "lfa-filter-status";
      status.id = "lfa-filter-status";
      let statusText = `Filter: ${filterLevel}`;
      if (chainsFiltered > 0) {
        statusText += ` • ${chainsFiltered} chains filtered`;
      }
      if (businessesHighlighted > 0) {
        statusText += ` • ${businessesHighlighted} local highlighted`;
      }
      status.textContent = statusText;
      document.body.appendChild(status);
      setTimeout(() => {
        this.hideFilterStatus();
      }, 3e3);
    }
    /**
     * Hide filter status indicator
     */
    hideFilterStatus() {
      const existing = document.getElementById("lfa-filter-status");
      if (existing) {
        existing.remove();
      }
    }
    /**
     * Handle badge click for analytics
     */
    handleBadgeClick(businessInfo) {
      chrome.runtime.sendMessage({
        action: "trackEvent",
        data: {
          type: CONFIG.EVENT_TYPES.CLICK,
          businessId: businessInfo.id,
          metadata: {
            businessName: businessInfo.name,
            clickType: "badge",
            url: window.location.href
          }
        }
      }).catch((error) => {
        console.error("Failed to track badge click:", error);
      });
      console.log("Badge clicked:", businessInfo.name);
    }
    /**
     * Handle alternative business click
     */
    handleAlternativeClick(business, chainInfo) {
      chrome.runtime.sendMessage({
        action: "trackEvent",
        data: {
          type: CONFIG.EVENT_TYPES.CLICK,
          businessId: business.id,
          metadata: {
            businessName: business.name,
            clickType: "alternative",
            chainName: chainInfo.name,
            url: window.location.href
          }
        }
      }).catch((error) => {
        console.error("Failed to track alternative click:", error);
      });
      this.openBusinessInMaps(business);
    }
    /**
     * Open business in Google Maps
     */
    openBusinessInMaps(business) {
      try {
        let url;
        if (business.latitude && business.longitude) {
          url = `https://maps.google.com/maps?q=${business.latitude},${business.longitude}`;
        } else {
          const query = encodeURIComponent(`${business.name} ${business.address || ""}`);
          url = `https://maps.google.com/maps?q=${query}`;
        }
        window.open(url, "_blank");
      } catch (error) {
        console.error("Failed to open business in maps:", error);
      }
    }
    /**
     * Remove all injected UI elements from an element
     */
    removeInjectedElements(element) {
      const injected = this.injectedElements.get(element);
      if (injected) {
        try {
          if (injected.badge && injected.badge.parentElement) {
            injected.badge.parentElement.removeChild(injected.badge);
          }
          if (injected.alternatives && injected.alternatives.parentElement) {
            injected.alternatives.parentElement.removeChild(injected.alternatives);
          }
          element.classList.remove("lfa-chain-business", "lfa-chain-hidden");
          this.injectedElements.delete(element);
        } catch (error) {
          console.error("UIInjector: Failed to remove injected elements:", error);
        }
      }
    }
    /**
     * Clear all injected elements (for page navigation)
     */
    clearAllInjectedElements() {
      this.hideFilterStatus();
      document.querySelectorAll(".lfa-chain-business, .lfa-chain-hidden").forEach((element) => {
        element.classList.remove("lfa-chain-business", "lfa-chain-hidden");
      });
      document.querySelectorAll(".lfa-badge, .lfa-alternatives").forEach((element) => {
        element.remove();
      });
      this.injectedElements = /* @__PURE__ */ new WeakMap();
      console.log("UIInjector: Cleared all injected elements");
    }
    /**
     * Get injector status for debugging
     */
    getStatus() {
      return {
        hasStyleSheet: !!this.styleSheet,
        injectedElementsCount: this.injectedElements.size || "unknown"
        // WeakMap doesn't have size
      };
    }
  }
  const uiInjector = new UIInjector();
  class MapsModifier {
    constructor() {
      this.isInitialized = false;
      this.isEnabled = true;
      this.settings = CONFIG.DEFAULT_SETTINGS;
      this.observer = null;
      this.lastProcessedUrl = "";
      this.processThrottle = 1e3;
      this.lastProcessTime = 0;
      this.retryCount = 0;
      this.maxRetries = 3;
      this.stats = {
        businessesProcessed: 0,
        chainsFiltered: 0,
        localHighlighted: 0,
        lastUpdate: Date.now()
      };
    }
    /**
     * Initialize the Maps Modifier
     */
    async init() {
      if (this.isInitialized) {
        return;
      }
      console.log("MapsModifier: Initializing...");
      try {
        await this.loadSettings();
        await this.loadChainPatterns();
        this.setupMutationObserver();
        this.setupMessageListener();
        this.setupNavigationListener();
        await this.processCurrentPage();
        this.isInitialized = true;
        console.log("MapsModifier: Initialized successfully");
        this.trackEvent("init", {
          url: window.location.href,
          userAgent: navigator.userAgent
        });
      } catch (error) {
        console.error("MapsModifier: Initialization failed:", error);
        this.retryCount++;
        if (this.retryCount < this.maxRetries) {
          console.log(`MapsModifier: Retrying initialization (${this.retryCount}/${this.maxRetries})`);
          setTimeout(() => this.init(), 2e3 * this.retryCount);
        } else {
          console.error("MapsModifier: Max retries reached, giving up");
        }
      }
    }
    /**
     * Load extension settings
     */
    async loadSettings() {
      try {
        const response = await chrome.runtime.sendMessage({ action: "getSettings" });
        if (response && response.success) {
          this.settings = { ...CONFIG.DEFAULT_SETTINGS, ...response.data };
          this.isEnabled = this.settings.enabled;
          console.log("MapsModifier: Settings loaded", this.settings);
        }
      } catch (error) {
        console.error("MapsModifier: Failed to load settings:", error);
        this.settings = CONFIG.DEFAULT_SETTINGS;
      }
    }
    /**
     * Load chain patterns from background script
     */
    async loadChainPatterns() {
      try {
        const response = await chrome.runtime.sendMessage({ action: "getChainPatterns" });
        if (response && response.success && response.data.chains) {
          businessMatcher.updateChainPatterns(response.data.chains);
          console.log(`MapsModifier: Loaded ${response.data.chains.length} chain patterns`);
        }
      } catch (error) {
        console.error("MapsModifier: Failed to load chain patterns:", error);
      }
    }
    /**
     * Set up mutation observer to watch for DOM changes
     */
    setupMutationObserver() {
      if (this.observer) {
        this.observer.disconnect();
      }
      this.observer = new MutationObserver((mutations) => {
        this.handleMutations(mutations);
      });
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false
        // We don't need attribute changes for this use case
      });
      console.log("MapsModifier: Mutation observer set up");
    }
    /**
     * Handle DOM mutations
     */
    handleMutations(mutations) {
      if (!this.isEnabled) {
        return;
      }
      const hasSignificantChanges = mutations.some(
        (mutation) => mutation.addedNodes.length > 0 && Array.from(mutation.addedNodes).some(
          (node) => node.nodeType === Node.ELEMENT_NODE && (node.querySelector && (node.querySelector('[role="article"]') || node.querySelector(".section-result") || node.querySelector('[data-value="Directions"]')))
        )
      );
      if (hasSignificantChanges) {
        const now = Date.now();
        if (now - this.lastProcessTime > this.processThrottle) {
          this.lastProcessTime = now;
          this.processCurrentPage();
        }
      }
    }
    /**
     * Set up message listener for communication with background script
     */
    setupMessageListener() {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
        return true;
      });
    }
    /**
     * Handle messages from background script
     */
    async handleMessage(message, sender, sendResponse) {
      try {
        const { action, data } = message;
        switch (action) {
          case "settingsChanged":
            await this.handleSettingsChange(data);
            sendResponse({ success: true });
            break;
          case "refresh":
            await this.processCurrentPage();
            sendResponse({ success: true });
            break;
          case "getStats":
            sendResponse({ success: true, data: this.getStats() });
            break;
          case "toggle":
            this.toggleExtension(data.enabled);
            sendResponse({ success: true });
            break;
          default:
            sendResponse({ success: false, error: "Unknown action" });
        }
      } catch (error) {
        console.error("MapsModifier: Error handling message:", error);
        sendResponse({ success: false, error: error.message });
      }
    }
    /**
     * Handle settings changes
     */
    async handleSettingsChange(newSettings) {
      const oldSettings = { ...this.settings };
      this.settings = { ...this.settings, ...newSettings };
      this.isEnabled = this.settings.enabled;
      console.log("MapsModifier: Settings changed", this.settings);
      if (oldSettings.filterLevel !== this.settings.filterLevel) {
        uiInjector.clearAllInjectedElements();
        await this.processCurrentPage();
      }
      this.trackEvent("settings_change", {
        oldSettings,
        newSettings: this.settings
      });
    }
    /**
     * Set up navigation listener to detect page changes
     */
    setupNavigationListener() {
      let currentUrl = window.location.href;
      const checkUrlChange = () => {
        if (window.location.href !== currentUrl) {
          currentUrl = window.location.href;
          this.handleNavigation();
        }
      };
      setInterval(checkUrlChange, 1e3);
      window.addEventListener("popstate", () => {
        this.handleNavigation();
      });
    }
    /**
     * Handle page navigation
     */
    handleNavigation() {
      console.log("MapsModifier: Navigation detected");
      uiInjector.clearAllInjectedElements();
      businessDetector.clearProcessedCache();
      this.resetStats();
      setTimeout(() => {
        this.processCurrentPage();
      }, 1e3);
    }
    /**
     * Process the current page
     */
    async processCurrentPage() {
      var _a, _b;
      if (!this.isEnabled) {
        console.log("MapsModifier: Extension disabled, skipping processing");
        return;
      }
      console.log("MapsModifier: Processing current page...");
      try {
        const currentLocation = businessMatcher.extractLocationFromUrl();
        if (currentLocation) {
          await this.loadNearbyBusinesses(currentLocation);
        }
        const businesses = businessDetector.scanForBusinesses();
        console.log(`MapsModifier: Found ${businesses.length} businesses to process`);
        let chainsFiltered = 0;
        let localHighlighted = 0;
        for (const business of businesses) {
          try {
            await this.processBusiness(business, currentLocation);
            if ((_a = business.processed) == null ? void 0 : _a.isChain) {
              chainsFiltered++;
            }
            if ((_b = business.processed) == null ? void 0 : _b.isLocal) {
              localHighlighted++;
            }
          } catch (error) {
            console.error(`MapsModifier: Error processing business ${business.name}:`, error);
          }
        }
        this.stats.businessesProcessed += businesses.length;
        this.stats.chainsFiltered += chainsFiltered;
        this.stats.localHighlighted += localHighlighted;
        this.stats.lastUpdate = Date.now();
        if (chainsFiltered > 0 || localHighlighted > 0) {
          uiInjector.showFilterStatus(this.settings.filterLevel, chainsFiltered, localHighlighted);
        }
        console.log(`MapsModifier: Processing complete. Chains filtered: ${chainsFiltered}, Local highlighted: ${localHighlighted}`);
      } catch (error) {
        console.error("MapsModifier: Error processing page:", error);
        this.trackEvent("error", {
          error: error.message,
          stack: error.stack,
          context: "process_page"
        });
      }
    }
    /**
     * Load nearby businesses for the current location
     */
    async loadNearbyBusinesses(location) {
      try {
        const response = await chrome.runtime.sendMessage({
          action: "getNearbyBusinesses",
          data: {
            lat: location.lat,
            lng: location.lng,
            radius: CONFIG.FILTERING.DEFAULT_RADIUS
          }
        });
        if (response && response.success) {
          businessMatcher.updateLocalBusinesses(response.data.businesses);
          console.log(`MapsModifier: Loaded ${response.data.businesses.length} nearby businesses`);
        }
      } catch (error) {
        console.error("MapsModifier: Failed to load nearby businesses:", error);
      }
    }
    /**
     * Process a single business
     */
    async processBusiness(business, currentLocation) {
      if (!business.name || !business.element) {
        return;
      }
      business.processed = {};
      try {
        const chainResult = businessMatcher.isChainBusiness(
          business.name,
          CONFIG.FILTER_LEVELS[this.settings.filterLevel].confidenceThreshold
        );
        if (chainResult.isChain) {
          business.processed.isChain = true;
          business.processed.chainInfo = chainResult.matchedChain;
          uiInjector.applyChainFiltering(
            business.element,
            chainResult.matchedChain,
            this.settings.filterLevel
          );
          if (this.settings.showAlternatives && currentLocation) {
            const alternatives = businessMatcher.findLocalAlternatives(
              chainResult.matchedChain,
              currentLocation
            );
            if (alternatives.length > 0) {
              uiInjector.showLocalAlternatives(business.element, chainResult.matchedChain, alternatives);
            }
          }
          this.trackEvent("chain_filtered", {
            businessName: business.name,
            chainName: chainResult.matchedChain.name,
            confidence: chainResult.confidence,
            filterLevel: this.settings.filterLevel
          });
        } else {
          const localMatch = businessMatcher.findLocalMatch(business.name, currentLocation);
          if (localMatch && this.settings.showBadges) {
            business.processed.isLocal = true;
            business.processed.localInfo = localMatch;
            uiInjector.addLFABadge(business.element, localMatch);
            this.trackEvent("local_highlighted", {
              businessName: business.name,
              businessId: localMatch.id,
              matchScore: localMatch.matchScore
            });
          }
        }
      } catch (error) {
        console.error(`MapsModifier: Error processing business ${business.name}:`, error);
        business.processed.error = error.message;
      }
    }
    /**
     * Toggle extension on/off
     */
    toggleExtension(enabled) {
      this.isEnabled = enabled;
      if (!enabled) {
        uiInjector.clearAllInjectedElements();
        uiInjector.hideFilterStatus();
      } else {
        this.processCurrentPage();
      }
      console.log(`MapsModifier: Extension ${enabled ? "enabled" : "disabled"}`);
    }
    /**
     * Track analytics event
     */
    trackEvent(eventType, data = {}) {
      chrome.runtime.sendMessage({
        action: "trackEvent",
        data: {
          type: eventType,
          metadata: {
            ...data,
            url: window.location.href,
            timestamp: Date.now()
          }
        }
      }).catch((error) => {
        console.error("MapsModifier: Failed to track event:", error);
      });
    }
    /**
     * Get current statistics
     */
    getStats() {
      return {
        ...this.stats,
        isEnabled: this.isEnabled,
        isInitialized: this.isInitialized,
        settings: this.settings,
        businessMatcher: businessMatcher.getStatus(),
        businessDetector: businessDetector.getStatus(),
        uiInjector: uiInjector.getStatus()
      };
    }
    /**
     * Reset statistics
     */
    resetStats() {
      this.stats = {
        businessesProcessed: 0,
        chainsFiltered: 0,
        localHighlighted: 0,
        lastUpdate: Date.now()
      };
    }
    /**
     * Cleanup when extension is disabled or page unloads
     */
    cleanup() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      uiInjector.clearAllInjectedElements();
      businessDetector.clearProcessedCache();
      console.log("MapsModifier: Cleanup complete");
    }
  }
  function initializeMapsModifier() {
    const mapsModifier = new MapsModifier();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        mapsModifier.init();
      });
    } else {
      setTimeout(() => {
        mapsModifier.init();
      }, 1e3);
    }
    window.addEventListener("beforeunload", () => {
      mapsModifier.cleanup();
    });
    window.lfa_mapsModifier = mapsModifier;
  }
  initializeMapsModifier();
  console.log("Local First Arizona Maps Modifier loaded");
  console.log("Local First Arizona extension content scripts loaded");
})();
