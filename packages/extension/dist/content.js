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
      DEFAULT_RADIUS: 50,
      // miles
      MAX_RADIUS: 50,
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
      filterLevel: "strict",
      // strict, moderate, light - default to aggressive filtering
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
    findLocalAlternatives(chainBusiness, location) {
      console.log("BusinessMatcher: findLocalAlternatives called with:", chainBusiness, location, "localBusinesses:", this.localBusinesses.length);
      if (!chainBusiness || !location || this.localBusinesses.length === 0) {
        console.log("BusinessMatcher: Early return - missing data");
        return [];
      }
      const category = chainBusiness.category || "other";
      console.log("BusinessMatcher: Looking for category:", category);
      const categoryBusinesses = this.localBusinesses.filter(
        (business) => business.category === category || category === "other"
      );
      console.log("BusinessMatcher: Found", categoryBusinesses.length, "businesses in category:", categoryBusinesses);
      const businessesInView = categoryBusinesses.filter((business) => {
        return business.latitude && business.longitude;
      }).map((business) => {
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
      }).sort((a, b) => a.distance - b.distance);
      console.log("BusinessMatcher: Found", businessesInView.length, "local alternatives sorted by distance");
      return businessesInView;
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
        const matches = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+(?:\.\d+)?)z/);
        if (matches) {
          const lat = parseFloat(matches[1]);
          const lng = parseFloat(matches[2]);
          const zoom = parseFloat(matches[3]);
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
        const basicMatches = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (basicMatches) {
          return {
            lat: parseFloat(basicMatches[1]),
            lng: parseFloat(basicMatches[2]),
            bounds: null
          };
        }
        const urlObj = new URL(url);
        const searchParams = urlObj.searchParams;
        const coords = searchParams.get("ll") || searchParams.get("center");
        if (coords) {
          const [lat, lng] = coords.split(",").map(parseFloat);
          if (!isNaN(lat) && !isNaN(lng)) {
            return { lat, lng, bounds: null };
          }
        }
        return null;
      } catch (error) {
        console.error("Failed to extract location from URL:", error);
        return null;
      }
    }
    /**
     * Get latitude delta from zoom level (approximate)
     */
    getLatDeltaFromZoom(zoom) {
      const baseDelta = 180 / Math.pow(2, zoom + 1);
      if (zoom >= 12) {
        return baseDelta * 3;
      } else if (zoom >= 10) {
        return baseDelta * 2;
      } else {
        return baseDelta * 1.5;
      }
    }
    /**
     * Get longitude delta from zoom level and latitude
     */
    getLngDeltaFromZoom(zoom, lat) {
      const latRadians = lat * Math.PI / 180;
      const cosLat = Math.cos(latRadians);
      const baseDelta = 360 / Math.pow(2, zoom + 1) * cosLat;
      if (zoom >= 12) {
        return baseDelta * 3;
      } else if (zoom >= 10) {
        return baseDelta * 2;
      } else {
        return baseDelta * 1.5;
      }
    }
    /**
     * Check if a point is within map bounds
     */
    isWithinBounds(lat, lng, bounds) {
      if (!bounds) return true;
      return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
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
          ".section-layout-root",
          // Layout root sections
          ".hfpxzc",
          // Modern Google Maps business card class
          ".Nv2PK",
          // Another modern Maps class
          ".bJzME",
          // Search result container
          ".lI9IFe",
          // Business listing container
          'div[jsaction*="mouseover"]',
          // Interactive elements
          "div[data-value][data-dtype]",
          // Data elements with values
          '[data-value="Directions"][role="button"]',
          // Map pins with directions
          'button[data-value="Directions"]',
          // Map direction buttons
          ".section-result-action-container button",
          // Action buttons in results
          'div[role="button"][aria-label*="directions"]'
          // Accessible direction buttons
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
          '[jsaction*="pane.kp.place"] h1',
          ".hfpxzc .qBF1Pd",
          // Modern Maps business name
          ".hfpxzc .NrDZNb",
          // Alternative modern Maps business name
          ".bJzME .qBF1Pd",
          // Search result business name
          '.lI9IFe span[role="heading"]',
          // Business listing heading
          'span[data-value][data-dtype="d3bn"] span'
          // Business name with specific data attributes
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
        console.log(`BusinessDetector: Found ${containers.length} potential containers`);
        containers.slice(0, 3).forEach((container, i) => {
          var _a;
          console.log(`Container ${i}:`, {
            tagName: container.tagName,
            className: container.className,
            textContent: (_a = container.textContent) == null ? void 0 : _a.slice(0, 100),
            hasDirections: !!container.querySelector('[data-value="Directions"]'),
            hasHeadings: container.querySelectorAll('h1, h2, h3, h4, [role="heading"]').length
          });
        });
        for (const container of containers) {
          if (this.processedElements.has(container)) {
            continue;
          }
          const businessInfo = this.extractBusinessInfo(container);
          if (businessInfo && businessInfo.name && !processedNames.has(businessInfo.name)) {
            console.log(`BusinessDetector: Found business: ${businessInfo.name}`);
            businesses.push({
              ...businessInfo,
              element: container,
              timestamp: now
            });
            processedNames.add(businessInfo.name);
            this.processedElements.add(container);
          } else if (businessInfo) {
            console.log(`BusinessDetector: Skipped business (no name or duplicate): ${businessInfo.name || "unnamed"}`);
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
      console.log(`BusinessDetector: Found ${containers.size} containers from selectors`);
      if (containers.size === 0) {
        console.log("BusinessDetector: No containers found, trying fallback approach");
        this.addFallbackContainers(containers);
      }
      const allContainers = Array.from(containers);
      const filteredContainers = allContainers.filter((container) => {
        var _a;
        const isLikely = this.isLikelyBusinessContainer(container);
        if (!isLikely) {
          console.log("BusinessDetector: Filtered out container:", {
            element: container,
            textContent: (_a = container.textContent) == null ? void 0 : _a.slice(0, 100),
            hasDirections: !!container.querySelector('[data-value="Directions"]'),
            hasHeading: !!container.querySelector('[role="heading"]'),
            classList: Array.from(container.classList),
            attributes: container.attributes ? Array.from(container.attributes).map((attr) => ({ name: attr.name, value: attr.value })) : []
          });
        }
        return isLikely;
      });
      console.log(`BusinessDetector: After filtering, ${filteredContainers.length} containers remain`);
      if (filteredContainers.length === 0 && allContainers.length > 0) {
        console.log("BusinessDetector: No containers passed filter, using first 3 unfiltered for debugging");
        return allContainers.slice(0, 3);
      }
      return filteredContainers;
    }
    /**
     * Fallback method to find business containers when normal selectors fail
     */
    addFallbackContainers(containers) {
      const businessKeywords = ["safeway", "walmart", "frys", "target", "mcdonald", "starbucks", "cvs"];
      for (const keyword of businessKeywords) {
        try {
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
        businessInfo.googleMapsData = this.extractGoogleMapsData(container);
        console.log("BusinessDetector: Enhanced business data extracted:", {
          name: businessInfo.name,
          googleMapsData: businessInfo.googleMapsData
        });
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
        if (container.attributes) {
          for (const attr of container.attributes) {
            if (attr.name.startsWith("data-")) {
              googleData.attributes[attr.name] = attr.value;
            }
          }
        }
        googleData.classes = Array.from(container.classList);
        const jsActionElements = container.querySelectorAll("[jsaction], [data-jsaction]");
        jsActionElements.forEach((el) => {
          const jsAction = el.getAttribute("jsaction") || el.getAttribute("data-jsaction");
          if (jsAction) {
            googleData.jsActions.push(jsAction);
          }
        });
        const dataValueElements = container.querySelectorAll("[data-value]");
        dataValueElements.forEach((el) => {
          const dataValue = el.getAttribute("data-value");
          if (dataValue) {
            googleData.dataValues.push(dataValue);
          }
        });
        const coordinatePatterns = [
          /(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
          // "33.1234, -112.5678"
          /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/
          // "@33.1234,-112.5678"
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
        const placeIdMatch = containerText.match(/ChI[a-zA-Z0-9_-]+/);
        if (placeIdMatch) {
          googleData.placeId = placeIdMatch[0];
        }
        const links = container.querySelectorAll("a[href]");
        links.forEach((link) => {
          const href = link.getAttribute("href");
          const placeIdMatch2 = href.match(/place\/([^\/]+)/);
          if (placeIdMatch2) {
            googleData.placeId = placeIdMatch2[1];
          }
          const idMatches = href.match(/@([^,]+),([^,]+),.*!(\w+)/);
          if (idMatches) {
            googleData.businessId = idMatches[3];
          }
        });
        const mapElements = container.querySelectorAll('[role="button"], [aria-label*="directions"], [aria-label*="call"]');
        mapElements.forEach((el) => {
          if (el.getAttribute("aria-label")) {
            if (!googleData.ariaLabels) {
              googleData.ariaLabels = [];
            }
            googleData.ariaLabels.push(el.getAttribute("aria-label"));
          }
        });
      } catch (error) {
        console.error("Error extracting Google Maps data:", error);
      }
      return googleData;
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
      this.hiddenBusinessData = /* @__PURE__ */ new Map();
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

      /* Chain Replacement Placeholder */
      .lfa-chain-placeholder {
        background: #f8f9fa !important;
        border: 1px solid #e8eaed !important;
        border-radius: 8px !important;
        padding: 16px !important;
        margin: 4px 0 !important;
        display: block !important;
        position: relative !important;
        z-index: 1000 !important;
        color: #333 !important;
        font-family: Google Sans, Roboto, Arial, sans-serif !important;
        font-size: 14px !important;
        line-height: 20px !important;
      }

      /* Local Alternative Suggestions */
      .lfa-alternatives {
        background: #f8f9fa !important;
        border: 1px solid #e8eaed !important;
        border-radius: 8px !important;
        padding: 16px !important;
        margin: 4px 0 !important;
        font-family: Google Sans, Roboto, Arial, sans-serif !important;
        font-size: 14px !important;
        line-height: 20px !important;
        position: relative !important;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
        color: #3c4043 !important;
      }

      .lfa-alternatives-header {
        font-weight: 600 !important;
        color: #2E7D32 !important;
        margin-bottom: 12px !important;
        display: flex !important;
        align-items: center !important;
        font-size: 16px !important;
        line-height: 24px !important;
      }

      .lfa-alternatives-header::before {
        content: '🏪';
        margin-right: 6px !important;
        font-size: 14px !important;
      }

      .lfa-alternative-item {
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        padding: 12px 0 !important;
        border-bottom: 1px solid #e8eaed !important;
        gap: 4px !important;
      }

      .lfa-alternative-item:last-child {
        border-bottom: none !important;
      }

      .lfa-alternative-name {
        font-weight: 500 !important;
        color: #1a73e8 !important;
        cursor: pointer !important;
        font-size: 16px !important;
        line-height: 24px !important;
        text-decoration: none !important;
      }

      .lfa-alternative-name:hover {
        text-decoration: underline !important;
      }

      .lfa-alternative-info {
        display: flex !important;
        flex-direction: column !important;
        gap: 2px !important;
        width: 100% !important;
      }

      .lfa-alternative-address {
        font-size: 14px !important;
        color: #5f6368 !important;
        line-height: 20px !important;
      }

      .lfa-alternative-distance {
        font-size: 14px !important;
        color: #5f6368 !important;
        line-height: 20px !important;
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
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
        const businessData = this.extractBusinessData(element);
        const businessKey = this.generateBusinessKey(businessData, chainInfo);
        if (settings.hideChains) {
          element.classList.add("lfa-chain-hidden");
          this.injectedElements.set(element, { type: "chain-hidden", chainInfo });
          this.hiddenBusinessData.set(businessKey, {
            element,
            chainInfo,
            businessData,
            timestamp: Date.now()
          });
          console.log(`UIInjector: Stored hidden business data for ${chainInfo.name}:`, businessData);
          this.hideTargetedMapPins(businessData, chainInfo);
          this.createChainReplacementPlaceholder(element, chainInfo);
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
     * Extract business data from a DOM element
     */
    extractBusinessData(element) {
      const data = {
        name: null,
        address: null,
        element
      };
      try {
        const nameSelectors = [
          '[role="heading"]',
          "h1",
          "h2",
          "h3",
          ".section-result-title",
          ".qBF1Pd",
          ".NrDZNb",
          'span[data-value][data-dtype="d3bn"]'
        ];
        for (const selector of nameSelectors) {
          const nameElement = element.querySelector(selector);
          if (nameElement && nameElement.textContent.trim()) {
            data.name = nameElement.textContent.trim();
            break;
          }
        }
        const addressSelectors = [
          '[data-value="Address"]',
          ".section-result-location",
          ".rogA2c"
        ];
        for (const selector of addressSelectors) {
          const addressElement = element.querySelector(selector);
          if (addressElement && addressElement.textContent.trim()) {
            data.address = addressElement.textContent.trim();
            break;
          }
        }
        if (!data.name) {
          const textContent = element.textContent.trim();
          if (textContent && textContent.length > 0 && textContent.length < 200) {
            const lines = textContent.split("\n").filter((line) => line.trim().length > 0);
            if (lines.length > 0) {
              data.name = lines[0].trim();
            }
          }
        }
      } catch (error) {
        console.error("Error extracting business data:", error);
      }
      return data;
    }
    /**
     * Generate a unique key for business data
     */
    generateBusinessKey(businessData, chainInfo) {
      const name = businessData.name || chainInfo.name;
      const address = businessData.address || "";
      return `${name.toLowerCase()}-${address.toLowerCase()}`.replace(/\s+/g, "-");
    }
    /**
     * Hide map pins using targeted business data
     */
    hideTargetedMapPins(businessData, chainInfo) {
      var _a;
      try {
        console.log(`UIInjector: Starting enhanced pin hiding for business:`, businessData);
        let hiddenCount = 0;
        if (businessData.googleMapsData) {
          hiddenCount += this.hideMapPinsByGoogleData(businessData.googleMapsData, chainInfo.name);
        }
        hiddenCount += this.hideMapPinsByBusinessName(businessData.name || chainInfo.name);
        if (businessData.address) {
          hiddenCount += this.hideMapPinsByAddress(businessData.address);
        }
        if ((_a = businessData.googleMapsData) == null ? void 0 : _a.coordinates) {
          hiddenCount += this.hideMapPinsByCoordinates(businessData.googleMapsData.coordinates);
        }
        console.log(`UIInjector: Initial pin hiding found ${hiddenCount} elements for ${chainInfo.name}`);
        this.setupTargetedPinMonitoring(businessData, chainInfo);
        this.setupDelayedPinHiding(businessData, chainInfo);
      } catch (error) {
        console.error("Error in targeted map pin hiding:", error);
        this.hideRelatedMapPins(chainInfo.name);
      }
    }
    /**
     * Hide map pins using Google Maps specific data
     */
    hideMapPinsByGoogleData(googleData, businessName) {
      let hiddenCount = 0;
      try {
        if (googleData.placeId) {
          const placeElements = document.querySelectorAll(`[data-cid*="${googleData.placeId}"], [href*="${googleData.placeId}"]`);
          placeElements.forEach((element) => {
            this.concealElement(element, `Google Place ID match for ${businessName}`);
            hiddenCount++;
          });
        }
        googleData.dataValues.forEach((dataValue) => {
          const elements = document.querySelectorAll(`[data-value="${dataValue}"]`);
          elements.forEach((element) => {
            if (this.isLikelyMapPin(element)) {
              this.concealElement(element, `Data value match for ${businessName}`);
              hiddenCount++;
            }
          });
        });
        googleData.jsActions.forEach((jsAction) => {
          const elements = document.querySelectorAll(`[jsaction*="${jsAction}"]`);
          elements.forEach((element) => {
            if (this.isLikelyMapPin(element)) {
              this.concealElement(element, `JS action match for ${businessName}`);
              hiddenCount++;
            }
          });
        });
        if (googleData.ariaLabels) {
          googleData.ariaLabels.forEach((ariaLabel) => {
            const elements = document.querySelectorAll(`[aria-label*="${ariaLabel}"]`);
            elements.forEach((element) => {
              if (this.isLikelyMapPin(element)) {
                this.concealElement(element, `Aria label match for ${businessName}`);
                hiddenCount++;
              }
            });
          });
        }
      } catch (error) {
        console.error("Error in Google data pin hiding:", error);
      }
      return hiddenCount;
    }
    /**
     * Hide map pins by coordinates
     */
    hideMapPinsByCoordinates(coordinates) {
      let hiddenCount = 0;
      try {
        const coordString1 = `${coordinates.lat},${coordinates.lng}`;
        const coordString2 = `${coordinates.lat}, ${coordinates.lng}`;
        const elements = document.querySelectorAll("*");
        elements.forEach((element) => {
          const text = element.textContent || element.getAttribute("href") || "";
          if ((text.includes(coordString1) || text.includes(coordString2)) && this.isLikelyMapPin(element)) {
            this.concealElement(element, `Coordinate match`);
            hiddenCount++;
          }
        });
      } catch (error) {
        console.error("Error in coordinate pin hiding:", error);
      }
      return hiddenCount;
    }
    /**
     * Check if element is likely a map pin (not a sidebar element)
     */
    isLikelyMapPin(element) {
      try {
        if (!element || !element.getBoundingClientRect) {
          return false;
        }
        const rect = element.getBoundingClientRect();
        const isOnMap = rect.left > 400;
        let hasMapClasses = false;
        if (element.className && typeof element.className === "string") {
          hasMapClasses = element.className.includes("pin") || element.className.includes("marker") || element.className.includes("place");
        } else if (element.classList && element.classList.length > 0) {
          const classString = Array.from(element.classList).join(" ");
          hasMapClasses = classString.includes("pin") || classString.includes("marker") || classString.includes("place");
        }
        const hasMapRole = element.hasAttribute && element.hasAttribute("role") && ["button", "link"].includes(element.getAttribute("role"));
        let isInSidebar = false;
        try {
          isInSidebar = element.closest && element.closest('[role="main"]') && rect.left < 400;
        } catch (error) {
          isInSidebar = false;
        }
        return (isOnMap || hasMapClasses || hasMapRole) && !isInSidebar;
      } catch (error) {
        console.warn("UIInjector: Error in isLikelyMapPin:", error);
        return false;
      }
    }
    /**
     * Conceal element using multiple CSS methods
     */
    concealElement(element, reason) {
      try {
        if (this.isEssentialElement(element)) {
          console.log(`UIInjector: Skipped concealing essential element - ${reason}:`, element);
          return;
        }
        element.style.display = "none";
        element.style.visibility = "hidden";
        element.style.opacity = "0";
        element.style.pointerEvents = "none";
        element.setAttribute("data-lfa-hidden", "true");
        element.setAttribute("data-lfa-reason", reason);
        console.log(`UIInjector: Concealed element - ${reason}:`, element);
      } catch (error) {
        console.warn("UIInjector: Error concealing element:", error);
      }
    }
    /**
     * Check if element is essential to Google Maps UI
     */
    isEssentialElement(element) {
      try {
        const essentialSelectors = [
          "#pane",
          '[role="main"]',
          ".section-layout-root",
          ".section-result-content",
          ".lfa-chain-placeholder",
          "[data-lfa-alternatives]"
        ];
        for (const selector of essentialSelectors) {
          if (element.matches && element.matches(selector)) {
            return true;
          }
          if (element.closest && element.closest(selector)) {
            return true;
          }
        }
        if (element.querySelector && element.querySelector(".lfa-alternatives, [data-lfa-alternatives]")) {
          return true;
        }
        return false;
      } catch (error) {
        return false;
      }
    }
    /**
     * Hide map pins by business name
     */
    hideMapPinsByBusinessName(businessName) {
      if (!businessName) return 0;
      let hiddenCount = 0;
      const normalizedName = businessName.toLowerCase().trim();
      const pinSelectors = [
        `[aria-label*="${businessName}"]`,
        `[title*="${businessName}"]`,
        '[role="button"][data-value="Directions"]',
        'button[data-value="Directions"]',
        ".section-result-action-container button"
      ];
      pinSelectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          const text = (element.textContent || element.getAttribute("aria-label") || element.getAttribute("title") || "").toLowerCase();
          if (text.includes(normalizedName) || normalizedName.includes(text.split(" ")[0])) {
            if (this.isLikelyMapPin(element)) {
              this.concealElement(element, `Business name match for ${businessName}`);
              hiddenCount++;
            }
          }
        });
      });
      return hiddenCount;
    }
    /**
     * Hide map pins by address
     */
    hideMapPinsByAddress(address) {
      if (!address) return 0;
      let hiddenCount = 0;
      const normalizedAddress = address.toLowerCase().trim();
      const elements = document.querySelectorAll('[role="button"], button, [data-value]');
      elements.forEach((element) => {
        const text = (element.textContent || element.getAttribute("aria-label") || "").toLowerCase();
        if ((text.includes(normalizedAddress) || normalizedAddress.includes(text)) && this.isLikelyMapPin(element)) {
          this.concealElement(element, `Address match for ${address}`);
          hiddenCount++;
        }
      });
      return hiddenCount;
    }
    /**
     * Set up delayed pin hiding with multiple methods
     */
    setupDelayedPinHiding(businessData, chainInfo) {
      const businessName = businessData.name || chainInfo.name;
      const delays = [2e3, 5e3];
      delays.forEach((delay, index) => {
        setTimeout(() => {
          console.log(`UIInjector: Delayed pin hiding attempt ${index + 1} for ${businessName}`);
          let hiddenCount = 0;
          if (businessData.googleMapsData) {
            hiddenCount += this.hideMapPinsByGoogleData(businessData.googleMapsData, businessName);
          }
          hiddenCount += this.hideMapPinsByBusinessName(businessName);
          if (businessData.address) {
            hiddenCount += this.hideMapPinsByAddress(businessData.address);
          }
          if (hiddenCount > 0) {
            console.log(`UIInjector: Delayed attempt ${index + 1} found ${hiddenCount} additional pins for ${businessName}`);
          }
        }, delay);
      });
    }
    /**
     * Scan for and hide new pins that match our business data (SAFER VERSION)
     */
    scanAndHideNewPins(businessData, chainInfo) {
      let hiddenCount = 0;
      const businessName = businessData.name || chainInfo.name;
      try {
        const pinCandidates = document.querySelectorAll(`
        [role="button"]:not([data-lfa-hidden]),
        button:not([data-lfa-hidden]),
        [data-value]:not([data-lfa-hidden]),
        [aria-label*="directions"]:not([data-lfa-hidden])
      `);
        const limitedCandidates = Array.from(pinCandidates).slice(0, 20);
        limitedCandidates.forEach((element) => {
          if (!this.isLikelyMapPin(element)) return;
          const elementText = ((element.textContent || "") + " " + (element.getAttribute("aria-label") || "") + " " + (element.getAttribute("title") || "")).toLowerCase();
          const nameMatch = businessName && elementText.includes(businessName.toLowerCase());
          if (nameMatch) {
            this.concealElement(element, `Late scan match for ${businessName}`);
            hiddenCount++;
          }
        });
      } catch (error) {
        console.error("Error in new pin scanning:", error);
      }
      return hiddenCount;
    }
    /**
     * Set up continuous monitoring for new map pins
     */
    setupTargetedPinMonitoring(businessData, chainInfo) {
      const businessName = businessData.name || chainInfo.name;
      const normalizedName = businessName.toLowerCase().trim();
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const text = (node.textContent || node.getAttribute("aria-label") || "").toLowerCase();
              if (text.includes(normalizedName)) {
                node.style.display = "none";
                console.log(`UIInjector: Hidden dynamically added pin for ${businessName}:`, node);
              }
              const childPins = node.querySelectorAll('[role="button"], button, [data-value]');
              childPins.forEach((pin) => {
                const pinText = (pin.textContent || pin.getAttribute("aria-label") || "").toLowerCase();
                if (pinText.includes(normalizedName)) {
                  pin.style.display = "none";
                  console.log(`UIInjector: Hidden child pin for ${businessName}:`, pin);
                }
              });
            }
          });
        });
      });
      const mapContainer = document.querySelector("#map") || document.body;
      observer.observe(mapContainer, {
        childList: true,
        subtree: true
      });
      if (!this.targetedPinObservers) {
        this.targetedPinObservers = [];
      }
      this.targetedPinObservers.push(observer);
      console.log(`UIInjector: Set up targeted pin monitoring for ${businessName}`);
    }
    /**
     * Create a placeholder element for hidden chain businesses
     */
    createChainReplacementPlaceholder(element, chainInfo) {
      try {
        const placeholder = document.createElement("div");
        placeholder.className = "lfa-chain-placeholder";
        placeholder.style.cssText = `
        background: #f8f9fa !important;
        border: 1px solid #e8eaed !important;
        border-radius: 8px !important;
        padding: 16px !important;
        margin: 8px 0 !important;
        display: block !important;
        position: relative !important;
        z-index: 1000 !important;
        color: #333 !important;
        font-family: Google Sans, Roboto, Arial, sans-serif !important;
        font-size: 14px !important;
        line-height: 20px !important;
        min-height: 60px !important;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
      `;
        placeholder.innerHTML = `
        <div style="color: #666; font-size: 14px; text-align: center; padding: 20px;">
          <div style="font-weight: 500; margin-bottom: 8px;">🏪 Chain store hidden</div>
          <div style="font-size: 12px;">Looking for local alternatives...</div>
        </div>
      `;
        element.parentNode.insertBefore(placeholder, element.nextSibling);
        if (this.injectedElements.has(element)) {
          this.injectedElements.get(element).placeholder = placeholder;
        } else {
          this.injectedElements.set(element, { placeholder, type: "chain-placeholder" });
        }
        console.log(`UIInjector: Created placeholder for hidden ${chainInfo.name}`);
      } catch (error) {
        console.error("UIInjector: Failed to create chain placeholder:", error);
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
        const injectedData = this.injectedElements.get(element);
        if (injectedData && injectedData.placeholder) {
          injectedData.placeholder.innerHTML = "";
          injectedData.placeholder.appendChild(alternativesElement);
          injectedData.placeholder.style.display = "block";
          injectedData.alternatives = alternativesElement;
          console.log(`UIInjector: Added ${alternatives.length} alternatives to placeholder for ${chainInfo.name}`);
          this.showAlternativeMapPins(alternatives);
        } else {
          const insertionPoint = this.findAlternativesInsertionPoint(element);
          if (insertionPoint) {
            insertionPoint.appendChild(alternativesElement);
            if (this.injectedElements.has(element)) {
              this.injectedElements.get(element).alternatives = alternativesElement;
            } else {
              this.injectedElements.set(element, { alternatives: alternativesElement, type: "alternatives" });
            }
            console.log(`UIInjector: Added ${alternatives.length} alternatives for ${chainInfo.name}`);
            this.showAlternativeMapPins(alternatives);
          }
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
      header.innerHTML = `
      <strong>🏪 Local alternatives to ${chainInfo.name}:</strong>
      <div style="font-size: 11px; font-weight: normal; margin-top: 2px; color: #666;">
        Supporting local businesses in your community
      </div>
    `;
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
        const info = document.createElement("div");
        info.className = "lfa-alternative-info";
        if (business.address) {
          const address = document.createElement("span");
          address.className = "lfa-alternative-address";
          address.textContent = business.address;
          info.appendChild(address);
        }
        const distanceContainer = document.createElement("span");
        distanceContainer.className = "lfa-alternative-distance";
        const distanceText = business.distance ? `${business.distance.toFixed(1)} mi away` : "Near you";
        distanceContainer.textContent = distanceText;
        if (business.verified) {
          const badge = document.createElement("span");
          badge.style.cssText = `
          background: #4CAF50 !important;
          color: white !important;
          font-size: 12px !important;
          padding: 2px 6px !important;
          border-radius: 4px !important;
          margin-left: 8px !important;
          font-weight: 500 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
        `;
          badge.textContent = "VERIFIED";
          distanceContainer.appendChild(badge);
        }
        info.appendChild(distanceContainer);
        item.appendChild(name);
        item.appendChild(info);
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
        if (business.placeId) {
          url = `https://www.google.com/maps/place/?q=place_id:${business.placeId}`;
          console.log("Opening business using Place ID:", business.name, "Place ID:", business.placeId);
        } else if (business.name && business.address) {
          const query = encodeURIComponent(`${business.name} ${business.address}`);
          url = `https://maps.google.com/maps/search/${query}`;
          console.log("Opening business using name + address search:", business.name);
        } else if (business.name) {
          const query = encodeURIComponent(business.name);
          url = `https://maps.google.com/maps/search/${query}`;
          console.log("Opening business using name search:", business.name);
        } else if (business.latitude && business.longitude) {
          url = `https://maps.google.com/maps?q=${business.latitude},${business.longitude}`;
          console.log("Opening business using coordinates:", business.name);
        } else {
          console.warn("Business has insufficient data for Maps search:", business);
          return;
        }
        console.log("Final Maps URL:", url);
        window.open(url, "_blank");
      } catch (error) {
        console.error("Failed to open business in maps:", error);
      }
    }
    /**
     * Hide map pins/markers related to a chain business
     */
    hideRelatedMapPins(businessName) {
      try {
        const cleanName = businessName.toLowerCase().trim();
        console.log(`UIInjector: Attempting to hide map pins for "${businessName}"`);
        let hiddenCount = 0;
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                this.hideChainPinsInElement(node, cleanName);
              }
            });
          });
        });
        const mapContainer = document.querySelector("#map") || document.body;
        observer.observe(mapContainer, {
          childList: true,
          subtree: true
        });
        if (!this.mapPinObservers) {
          this.mapPinObservers = [];
        }
        this.mapPinObservers.push(observer);
        hiddenCount = this.hideChainPinsInElement(document, cleanName);
        setTimeout(() => {
          console.log(`UIInjector: Starting delayed pin hiding scan for "${businessName}"`);
          const delayedHiddenCount = this.hideMapPinsWithDelay(cleanName);
          console.log(`UIInjector: Delayed pin hiding found ${delayedHiddenCount} additional elements for ${businessName}`);
        }, 2e3);
        const intervalId = setInterval(() => {
          const periodicHiddenCount = this.hideMapPinsWithDelay(cleanName);
          if (periodicHiddenCount > 0) {
            console.log(`UIInjector: Periodic pin hiding found ${periodicHiddenCount} additional elements for ${businessName}`);
          }
        }, 3e3);
        if (!this.mapPinIntervals) {
          this.mapPinIntervals = [];
        }
        this.mapPinIntervals.push(intervalId);
        setTimeout(() => {
          clearInterval(intervalId);
          const index = this.mapPinIntervals.indexOf(intervalId);
          if (index > -1) {
            this.mapPinIntervals.splice(index, 1);
          }
        }, 3e4);
        console.log(`UIInjector: Set up pin hiding for ${businessName}, hid ${hiddenCount} existing elements`);
      } catch (error) {
        console.error("UIInjector: Failed to hide related map pins:", error);
      }
    }
    /**
     * Hide chain pins within a specific element
     */
    hideChainPinsInElement(element, cleanName) {
      let hiddenCount = 0;
      try {
        const selectors = [
          // Only target specific business listing elements (not entire containers)
          ".hfpxzc",
          // Individual business links
          ".Nv2PK.THOPZb.CpccDe",
          // Individual business result containers
          // Map-specific elements only
          ".gm-ui-hover-effect",
          ".maps-sprite-pane-default",
          ".maps-pin-view",
          ".widget-marker",
          // Individual buttons and links, not entire containers
          'button[aria-label*="' + cleanName + '"]',
          'a[aria-label*="' + cleanName + '"]',
          // Info windows and popups (small containers only)
          ".gm-style-iw",
          ".gm-style-iw-c",
          ".gm-style-iw-d"
        ];
        const protectedSelectors = [
          "#app-container",
          ".m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde.ecceSd",
          // Results feed
          ".k7jAl.miFGmb.lJ3Kh",
          // Side panels  
          ".e07Vkf.kA9KIf",
          // Scrollable containers
          '[role="feed"]',
          // Results feeds
          ".vasquette"
          // Main app container
        ];
        selectors.forEach((selector) => {
          const elements = element.querySelectorAll ? element.querySelectorAll(selector) : [];
          elements.forEach((el) => {
            if (this.isProtectedElement(el, protectedSelectors)) {
              return;
            }
            const text = this.getElementText(el);
            const isMatch = text.includes(cleanName) || this.isChainRelated(el, cleanName);
            if (isMatch && !el.hasAttribute("data-lfa-hidden")) {
              const rect = el.getBoundingClientRect();
              const isLargeContainer = rect.width > 500 || rect.height > 500;
              if (!isLargeContainer || this.isSafeToHide(el)) {
                console.log(`UIInjector: Hiding specific element for ${cleanName}:`, el.className, "size:", rect.width + "x" + rect.height);
                el.style.setProperty("display", "none", "important");
                el.setAttribute("data-lfa-hidden", "true");
                el.setAttribute("data-lfa-chain", cleanName);
                hiddenCount++;
              } else {
                console.log(`UIInjector: Skipping large container for ${cleanName}:`, el.className, "size:", rect.width + "x" + rect.height);
              }
            }
          });
        });
      } catch (error) {
        console.warn("UIInjector: Error hiding pins in element:", error);
      }
      return hiddenCount;
    }
    /**
     * Get all text content from element and its attributes
     */
    getElementText(element) {
      return ((element.textContent || "") + " " + (element.getAttribute("aria-label") || "") + " " + (element.getAttribute("title") || "") + " " + (element.getAttribute("data-value") || "") + " " + (element.getAttribute("alt") || "")).toLowerCase();
    }
    /**
     * Check if element is related to a chain business
     */
    isChainRelated(element, cleanName) {
      const isMapElement = element.closest("#map") || element.querySelector('img[src*="marker"]') || element.classList.contains("gm-style-iw") || element.hasAttribute("jsaction");
      return isMapElement && this.getElementText(element).includes(cleanName);
    }
    /**
     * Check if element is a map container that should be hidden
     */
    isMapContainer(element) {
      return element.classList.contains("gm-style") || element.classList.contains("gm-ui-hover-effect") || element.classList.contains("maps-pin-view") || element.classList.contains("widget-marker") || element.closest("#map") || element.hasAttribute("jsaction");
    }
    /**
     * Check if element is protected from being hidden (major containers)
     */
    isProtectedElement(element, protectedSelectors) {
      for (const selector of protectedSelectors) {
        if (element.matches && element.matches(selector)) {
          return true;
        }
        if (element.id && selector.includes("#" + element.id)) {
          return true;
        }
      }
      const protectedPatterns = [
        "app-container",
        "vasquette",
        "id-app-container",
        "m6QErb",
        "DxyBCb",
        "kA9KIf",
        "dS8AEf",
        "XiKgde",
        "ecceSd",
        // Results feed classes
        "k7jAl",
        "miFGmb",
        "lJ3Kh",
        // Side panel classes
        "e07Vkf"
        // Scrollable container
      ];
      return protectedPatterns.some(
        (pattern) => {
          var _a, _b;
          return ((_a = element.id) == null ? void 0 : _a.includes(pattern)) || ((_b = element.className) == null ? void 0 : _b.includes(pattern));
        }
      );
    }
    /**
     * Check if element is safe to hide (small, specific elements)
     */
    isSafeToHide(element) {
      return element.matches(".hfpxzc") || // Business links
      element.matches("button") || // Individual buttons
      element.matches("a") || // Individual links
      element.matches(".gm-style-iw");
    }
    /**
     * Hide map pins with delay - targets actual Google Maps pin elements
     */
    hideMapPinsWithDelay(cleanName) {
      let hiddenCount = 0;
      try {
        const mapContainer = document.querySelector("#map");
        if (!mapContainer) {
          console.log(`UIInjector: No #map container found for ${cleanName}`);
          return 0;
        }
        console.log(`UIInjector: Map container found, scanning for pins containing "${cleanName}"`);
        const pinSelectors = [
          // Map markers/pins (typical Google Maps classes)
          '[role="button"]',
          // Most map pins are buttons
          '[role="img"]',
          // Some pins are images
          ".gm-style-iw",
          // Info windows
          ".gm-style-cc",
          // Map controls
          "[data-value]",
          // Elements with data values
          "[jsaction]"
          // Interactive elements
        ];
        pinSelectors.forEach((selector) => {
          const elements = mapContainer.querySelectorAll(selector);
          console.log(`UIInjector: Found ${elements.length} elements for selector "${selector}"`);
          elements.forEach((element, index) => {
            const text = this.getElementText(element);
            if (index < 5 && text.length > 0) {
              console.log(`UIInjector: Sample element ${index} (${selector}): "${text.substring(0, 100)}"`);
            }
            const isMatch = text.includes(cleanName) || text.includes(cleanName.split(" ")[0]) || // First word match
            cleanName.includes("whole foods") && text.includes("whole") || cleanName.includes("safeway") && text.includes("safeway") || cleanName.includes("fry") && text.includes("fry");
            if (isMatch && !element.hasAttribute("data-lfa-hidden")) {
              console.log(`UIInjector: MATCH FOUND for ${cleanName}:`, text.substring(0, 100));
              const rect = element.getBoundingClientRect();
              if (rect.width > 300 || rect.height > 300) {
                return;
              }
              if (rect.width === 0 && rect.height === 0) {
                return;
              }
              console.log(`UIInjector: Hiding map pin for ${cleanName}:`, {
                element: element.tagName,
                class: element.className,
                role: element.getAttribute("role"),
                size: `${rect.width}x${rect.height}`,
                text: text.substring(0, 100),
                hasJsAction: !!element.getAttribute("jsaction")
              });
              element.style.setProperty("display", "none", "important");
              element.style.setProperty("visibility", "hidden", "important");
              element.style.setProperty("opacity", "0", "important");
              element.style.setProperty("pointer-events", "none", "important");
              element.style.setProperty("transform", "scale(0)", "important");
              element.setAttribute("data-lfa-hidden", "true");
              element.setAttribute("data-lfa-chain", cleanName);
              hiddenCount++;
              const parent = element.parentElement;
              if (parent && parent.children.length === 1 && !parent.hasAttribute("data-lfa-hidden")) {
                const parentRect = parent.getBoundingClientRect();
                if (parentRect.width < 100 && parentRect.height < 100) {
                  parent.style.setProperty("display", "none", "important");
                  parent.setAttribute("data-lfa-hidden-parent", "true");
                  console.log(`UIInjector: Also hiding parent pin container for ${cleanName}`);
                }
              }
            }
          });
        });
      } catch (error) {
        console.warn("UIInjector: Error in delayed pin hiding:", error);
      }
      return hiddenCount;
    }
    /**
     * Show map pins for local alternative businesses
     */
    showAlternativeMapPins(alternatives) {
      try {
        console.log(`UIInjector: Attempting to show ${alternatives.length} alternative map pins`);
        alternatives.forEach((business) => {
          this.createCustomMapMarker(business);
        });
      } catch (error) {
        console.error("UIInjector: Failed to show alternative map pins:", error);
      }
    }
    /**
     * Create a custom map marker overlay for local business
     */
    createCustomMapMarker(business) {
      try {
        const mapContainer = document.querySelector("#map canvas") || document.querySelector('[role="application"]') || document.querySelector(".gm-style");
        if (!mapContainer) {
          console.warn("UIInjector: Could not find map container for custom marker");
          return;
        }
        const marker = document.createElement("div");
        marker.className = "lfa-custom-marker";
        marker.style.cssText = `
        position: absolute;
        width: 30px;
        height: 30px;
        background: #4CAF50;
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        font-size: 12px;
        font-weight: bold;
        color: white;
      `;
        marker.textContent = "🏪";
        marker.title = `${business.name} - Local Alternative`;
        marker.addEventListener("click", () => {
          this.handleAlternativeMapPinClick(business);
        });
        marker.style.top = "50%";
        marker.style.left = "50%";
        marker.style.transform = "translate(-50%, -50%)";
        mapContainer.appendChild(marker);
        console.log(`UIInjector: Created custom map marker for ${business.name}`);
      } catch (error) {
        console.error("UIInjector: Failed to create custom map marker:", error);
      }
    }
    /**
     * Handle click on alternative map pin
     */
    handleAlternativeMapPinClick(business) {
      const info = `${business.name}
${business.address}
${business.distance ? business.distance.toFixed(1) + " mi away" : "Near you"}`;
      alert(info);
      this.handleAlternativeClick(business, { name: "map-pin-click" });
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
          if (injected.placeholder && injected.placeholder.parentElement) {
            injected.placeholder.parentElement.removeChild(injected.placeholder);
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
      if (this.mapPinObservers) {
        this.mapPinObservers.forEach((observer) => observer.disconnect());
        this.mapPinObservers = [];
      }
      if (this.targetedPinObservers) {
        this.targetedPinObservers.forEach((observer) => observer.disconnect());
        this.targetedPinObservers = [];
      }
      if (this.mapPinIntervals) {
        this.mapPinIntervals.forEach((intervalId) => clearInterval(intervalId));
        this.mapPinIntervals = [];
      }
      if (this.hiddenBusinessData) {
        this.hiddenBusinessData.clear();
      }
      document.querySelectorAll(".lfa-chain-business, .lfa-chain-hidden").forEach((element) => {
        element.classList.remove("lfa-chain-business", "lfa-chain-hidden");
      });
      document.querySelectorAll(".lfa-badge, .lfa-alternatives").forEach((element) => {
        element.remove();
      });
      document.querySelectorAll('[data-lfa-hidden="true"]').forEach((element) => {
        element.style.display = "";
        element.style.visibility = "";
        element.style.opacity = "";
        element.style.pointerEvents = "";
        element.style.transform = "";
        element.removeAttribute("data-lfa-hidden");
        element.removeAttribute("data-lfa-chain");
      });
      document.querySelectorAll('[data-lfa-hidden-parent="true"]').forEach((element) => {
        element.style.display = "";
        element.removeAttribute("data-lfa-hidden-parent");
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
        this.setupToggleListener();
        this.updateStatusBar();
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
          this.settings.filterLevel = "strict";
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
     * Set up toggle listener for filter controls
     */
    setupToggleListener() {
      window.addEventListener("lfa-toggle-filter", () => {
        this.toggleFilterMode();
      });
    }
    /**
     * Toggle between strict and moderate filtering
     */
    toggleFilterMode() {
      const currentLevel = this.settings.filterLevel;
      const newLevel = currentLevel === "strict" ? "moderate" : "strict";
      console.log(`MapsModifier: Switching from ${currentLevel} to ${newLevel} filtering`);
      this.settings.filterLevel = newLevel;
      this.updateStatusBar();
      uiInjector.clearAllInjectedElements();
      businessDetector.clearProcessedCache();
      setTimeout(() => {
        this.processCurrentPage();
      }, 100);
      this.trackEvent("filter_toggle", {
        fromLevel: currentLevel,
        toLevel: newLevel
      });
    }
    /**
     * Update the status bar text and button based on current settings
     */
    updateStatusBar() {
      const statusMessage2 = document.getElementById("lfa-status-message");
      const toggleButton2 = document.getElementById("lfa-toggle-button");
      if (statusMessage2 && toggleButton2) {
        const isStrict = this.settings.filterLevel === "strict";
        statusMessage2.textContent = isStrict ? "🏪 Local First Arizona is hiding chain stores" : "🏪 Local First Arizona is dimming chain stores";
        toggleButton2.textContent = isStrict ? "Switch to Dimming" : "Switch to Hiding";
        console.log(`MapsModifier: Updated status bar for ${this.settings.filterLevel} mode`);
      }
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
        const mockLocalBusinesses = [
          // Central Phoenix
          {
            id: "local_1",
            name: "Phoenix Public Market",
            category: "grocery",
            address: "721 N Central Ave, Phoenix, AZ",
            latitude: 33.4734,
            longitude: -112.074,
            verified: true,
            placeId: "ChIJN1t_tDeuAIERAGYS_wLBZiw",
            // Example Phoenix Public Market Place ID
            phone: "(602) 252-2204",
            website: "https://phoenixpublicmarket.com"
          },
          {
            id: "local_2",
            name: "Arizona Natural Market",
            category: "grocery",
            address: "3045 N 16th St, Phoenix, AZ",
            latitude: 33.4851,
            longitude: -112.0379,
            verified: false,
            placeId: "ChIJc_eKY7arAIERAMZe7WqHFaE",
            // Example place ID
            phone: "(602) 279-3344"
          },
          {
            id: "local_3",
            name: "Desert Roots Market",
            category: "grocery",
            address: "1750 E Bell Rd, Phoenix, AZ",
            latitude: 33.639,
            longitude: -112.0277,
            verified: true,
            placeId: "ChIJwZHKP2CqAIERaGBt_2oYQfI",
            // Example place ID
            phone: "(602) 867-3663",
            website: "https://desertrootsmarket.com"
          },
          // West Valley
          {
            id: "local_4",
            name: "West Valley Fresh Market",
            category: "grocery",
            address: "7500 W Thomas Rd, Phoenix, AZ",
            latitude: 33.4806,
            longitude: -112.23,
            verified: true,
            placeId: "ChIJwVHKQ3CqAIERfGEt_2pYQfI",
            phone: "(623) 846-2245"
          },
          {
            id: "local_5",
            name: "Avondale Organic Co-op",
            category: "grocery",
            address: "11025 W McDowell Rd, Avondale, AZ",
            latitude: 33.465,
            longitude: -112.349,
            verified: false,
            placeId: "ChIJ-XHKa3CqAIERbGEt_2qYQfI",
            phone: "(623) 935-4483"
          },
          {
            id: "local_6",
            name: "Goodyear Farm Fresh",
            category: "grocery",
            address: "14500 W Indian School Rd, Goodyear, AZ",
            latitude: 33.4942,
            longitude: -112.3951,
            verified: true,
            placeId: "ChIJzXHKb3CqAIERcGEt_2rYQfI",
            phone: "(623) 932-1234",
            website: "https://goodyearfarmfresh.com"
          },
          // East Valley
          {
            id: "local_7",
            name: "Ahwatukee Organic Foods",
            category: "grocery",
            address: "4045 E Chandler Blvd, Phoenix, AZ",
            latitude: 33.3061,
            longitude: -111.9973,
            verified: false,
            placeId: "ChIJyXHKc3CqAIERdGEt_2sYQfI",
            phone: "(480) 753-2214"
          },
          {
            id: "local_8",
            name: "Scottsdale Fresh Market",
            category: "grocery",
            address: "7014 E Camelback Rd, Scottsdale, AZ",
            latitude: 33.5026,
            longitude: -111.9306,
            verified: true,
            placeId: "ChIJxXHKd3CqAIEReGEt_2tYQfI",
            phone: "(480) 941-5566",
            website: "https://scottsdalefresh.com"
          },
          {
            id: "local_9",
            name: "Tempe Community Market",
            category: "grocery",
            address: "1919 E Baseline Rd, Tempe, AZ",
            latitude: 33.3781,
            longitude: -111.9048,
            verified: true,
            placeId: "ChIJwXHKe3CqAIERfGEt_2uYQfI",
            phone: "(480) 967-4455",
            website: "https://tempemarket.org"
          },
          {
            id: "local_10",
            name: "Mesa Natural Foods",
            category: "grocery",
            address: "1065 N Country Club Dr, Mesa, AZ",
            latitude: 33.4295,
            longitude: -111.8568,
            verified: false,
            placeId: "ChIJvXHKf3CqAIERgGEt_2vYQfI",
            phone: "(480) 832-7799"
          },
          // North Phoenix/Deer Valley
          {
            id: "local_11",
            name: "Deer Valley Market",
            category: "grocery",
            address: "2102 W Union Hills Dr, Phoenix, AZ",
            latitude: 33.65,
            longitude: -112.105,
            verified: true,
            placeId: "ChIJuXHKg3CqAIERhGEt_2wYQfI",
            phone: "(602) 867-3344",
            website: "https://deervalleymarket.com"
          },
          {
            id: "local_12",
            name: "North Phoenix Co-op",
            category: "grocery",
            address: "17235 N Cave Creek Rd, Phoenix, AZ",
            latitude: 33.648,
            longitude: -112.0295,
            verified: false,
            placeId: "ChIJtXHKh3CqAIERiGEt_2xYQfI",
            phone: "(602) 482-5566"
          },
          // South Phoenix
          {
            id: "local_13",
            name: "South Mountain Market",
            category: "grocery",
            address: "5532 S Central Ave, Phoenix, AZ",
            latitude: 33.395,
            longitude: -112.074,
            verified: true,
            placeId: "ChIJsXHKi3CqAIERjGEt_2yYQfI",
            phone: "(602) 276-1234",
            website: "https://southmountainmarket.com"
          },
          {
            id: "local_14",
            name: "Laveen Village Market",
            category: "grocery",
            address: "5130 W Baseline Rd, Laveen, AZ",
            latitude: 33.3781,
            longitude: -112.175,
            verified: false,
            placeId: "ChIJrXHKj3CqAIERkGEt_2zYQfI",
            phone: "(602) 237-8899"
          }
        ];
        console.log("MapsModifier: Location for nearby businesses:", location);
        console.log("MapsModifier: Mock local businesses available:", mockLocalBusinesses.length);
        const nearbyBusinesses = mockLocalBusinesses.filter((business) => {
          return business.latitude && business.longitude;
        });
        businessMatcher.updateLocalBusinesses(nearbyBusinesses);
        console.log(`MapsModifier: Loaded ${nearbyBusinesses.length} nearby local businesses:`, nearbyBusinesses);
      } catch (error) {
        console.error("MapsModifier: Failed to load nearby businesses:", error);
      }
    }
    /**
     * Calculate distance between two points (Haversine formula)
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
            console.log("MapsModifier: Looking for alternatives for", chainResult.matchedChain.name, "at location", currentLocation);
            const alternatives = businessMatcher.findLocalAlternatives(
              chainResult.matchedChain,
              currentLocation
            );
            console.log("MapsModifier: Found", alternatives.length, "alternatives:", alternatives);
            if (alternatives.length > 0) {
              console.log("MapsModifier: Showing alternatives for", chainResult.matchedChain.name);
              uiInjector.showLocalAlternatives(business.element, chainResult.matchedChain, alternatives);
            } else {
              console.log("MapsModifier: No alternatives found for", chainResult.matchedChain.name);
            }
          } else {
            console.log("MapsModifier: Not showing alternatives - showAlternatives:", this.settings.showAlternatives, "currentLocation:", currentLocation);
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
  console.log("🏪 LOCAL FIRST ARIZONA EXTENSION - CONTENT SCRIPT STARTING");
  console.warn("🏪 LFA DEBUG: Content script file loaded at", (/* @__PURE__ */ new Date()).toISOString());
  window.LFA_EXTENSION_LOADED = true;
  const statusBar = document.createElement("div");
  statusBar.id = "lfa-status-bar";
  const updateStatusBarPosition = () => {
    try {
      const windowWidth = window.innerWidth;
      console.log("StatusBar: Setting fixed position for window width:", windowWidth);
      let leftPos = 408;
      let statusBarWidth = windowWidth - leftPos;
      if (windowWidth < 500) {
        leftPos = 0;
        statusBarWidth = windowWidth;
      } else if (windowWidth < 800) {
        leftPos = Math.floor(windowWidth * 0.45);
        statusBarWidth = windowWidth - leftPos;
      }
      statusBar.style.left = leftPos + "px";
      statusBar.style.width = statusBarWidth + "px";
      statusBar.style.right = "auto";
      console.log(`StatusBar: Applied fixed position - left: ${leftPos}px, width: ${statusBarWidth}px`);
    } catch (error) {
      console.error("Error updating status bar position:", error);
      statusBar.style.left = "408px";
      statusBar.style.right = "0px";
      statusBar.style.width = "auto";
    }
  };
  statusBar.style.cssText = `
  position: fixed;
  top: 0;
  left: 408px;
  right: 0;
  height: 35px;
  background: linear-gradient(90deg, #2E7D32, #4CAF50);
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 15px;
  font-family: Arial, sans-serif;
  font-size: 13px;
  font-weight: bold;
  z-index: 999999;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
`;
  setTimeout(() => {
    console.log("StatusBar: Initial positioning attempt");
    updateStatusBarPosition();
  }, 2e3);
  window.addEventListener("resize", updateStatusBarPosition);
  const layoutObserver = new MutationObserver(() => {
    clearTimeout(window.statusBarUpdateTimeout);
    window.statusBarUpdateTimeout = setTimeout(() => {
      updateStatusBarPosition();
    }, 500);
  });
  layoutObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "class"]
  });
  setTimeout(() => {
    console.log("StatusBar: Final positioning attempt");
    updateStatusBarPosition();
  }, 1e4);
  const statusMessage = document.createElement("span");
  statusMessage.id = "lfa-status-message";
  statusMessage.textContent = "🏪 Local First Arizona is filtering chain stores";
  const toggleContainer = document.createElement("div");
  toggleContainer.style.cssText = `
  display: flex;
  align-items: center;
  gap: 10px;
`;
  const toggleButton = document.createElement("button");
  toggleButton.id = "lfa-toggle-button";
  toggleButton.textContent = "Switch to Dimming";
  toggleButton.style.cssText = `
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.3);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  font-weight: bold;
`;
  const hideButton = document.createElement("button");
  hideButton.textContent = "×";
  hideButton.style.cssText = `
  background: none;
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
`;
  toggleButton.onclick = function(e) {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("lfa-toggle-filter"));
  };
  hideButton.onclick = function(e) {
    e.stopPropagation();
    statusBar.style.display = "none";
  };
  toggleContainer.appendChild(toggleButton);
  toggleContainer.appendChild(hideButton);
  statusBar.appendChild(statusMessage);
  statusBar.appendChild(toggleContainer);
  if (document.body) {
    document.body.appendChild(statusBar);
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      document.body.appendChild(statusBar);
    });
  }
  setTimeout(() => {
    const indicator = document.createElement("div");
    indicator.style.cssText = `
    position: fixed;
    top: 40px;
    right: 10px;
    background: #4CAF50;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-family: Arial, sans-serif;
    font-size: 12px;
    z-index: 10000;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  `;
    indicator.textContent = "LFA Extension Loaded Successfully!";
    document.body.appendChild(indicator);
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }, 3e3);
  }, 1e3);
})();
