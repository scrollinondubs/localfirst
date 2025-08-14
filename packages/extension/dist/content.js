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
    // LFA Business Search Configuration
    SEARCH: {
      DEFAULT_RADIUS: 15,
      // miles for LFA business search
      MAX_RADIUS: 25,
      // maximum search radius
      MAX_RESULTS: 20
      // maximum businesses to return in LFA mode
    },
    // Storage Keys
    STORAGE_KEYS: {
      CHAINS: "lfa_chains",
      SETTINGS: "lfa_settings",
      ANALYTICS_QUEUE: "lfa_analytics_queue",
      LAST_SYNC: "lfa_last_sync",
      CACHED_BUSINESSES: "lfa_cached_businesses"
    },
    // Default Settings - Simplified for binary LFA/Google toggle
    DEFAULT_SETTINGS: {
      enabled: true,
      // LFA mode enabled by default
      anonymousAnalytics: true
    },
    // Event Types for Analytics
    EVENT_TYPES: {
      INSTALL: "install",
      VIEW: "view",
      CLICK: "click",
      MODE_TOGGLE: "mode_toggle",
      // LFA/Google mode toggle
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
        const url = window.location.href;
        const searchMatch = url.match(/\/maps\/search\/([^\/\?]+)/);
        if (searchMatch) {
          const searchTerm = decodeURIComponent(searchMatch[1]).replace(/\+/g, " ");
          console.log("BusinessMatcher: Found search in URL path:", searchTerm);
          return searchTerm;
        }
        const searchBox = document.querySelector('#searchboxinput, [data-value="Search"], input[placeholder*="Search"]');
        if (searchBox && searchBox.value && searchBox.value.trim()) {
          console.log("BusinessMatcher: Found search in search box:", searchBox.value);
          return searchBox.value.trim();
        }
        const urlObj = new URL(url);
        const query = urlObj.searchParams.get("q") || urlObj.searchParams.get("query");
        if (query) {
          console.log("BusinessMatcher: Found search in URL params:", query);
          return query;
        }
        console.log("BusinessMatcher: No user search query found");
        return null;
      } catch (error) {
        console.error("BusinessMatcher: Error extracting user search query:", error);
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
        const searchData = {
          query,
          lat: location.lat,
          lng: location.lng,
          radius: 15,
          // Larger radius for more comprehensive results
          limit: 20
          // More businesses for LFA mode
        };
        const response = await chrome.runtime.sendMessage({
          action: "semanticSearch",
          data: searchData
        });
        console.log("BusinessMatcher: Received response from service worker:", response);
        if (response && response.success && response.data && response.data.businesses) {
          const businesses = response.data.businesses;
          console.log(`BusinessMatcher: Found ${businesses.length} LFA businesses`);
          return businesses.map((business) => ({
            ...business,
            // Ensure we have proper display fields
            name: business.name || business.business_name || "Local Business",
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
          console.log("BusinessMatcher: No LFA businesses found");
          return [];
        }
      } catch (error) {
        console.error("BusinessMatcher: Error finding LFA businesses:", error);
        return [];
      }
    }
    /**
     * Get matcher status for debugging
     */
    getStatus() {
      return {
        mode: "binary_lfa_google_toggle",
        lfaBusinessSearch: true,
        locationExtraction: true,
        queryExtraction: true
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
      const hasModernBusinessIndicators = (
        // Modern business card classes
        element.classList.contains("Nv2PK") || // New business card class
        element.classList.contains("lI9IFe") || // Business listing class
        element.classList.contains("qBF1Pd") || // Business name class
        // Traditional indicators (keep for backward compatibility)
        element.querySelector('[data-value="Directions"]') || element.querySelector('[role="heading"]') || element.hasAttribute("data-result-index") || element.classList.contains("section-result") || // Text-based indicators for business content
        text.includes("⋅") && (text.includes("opens") || text.includes("closed") || text.includes("hours")) || // "Closed ⋅ Opens 10 am"
        text.includes("€") && text.includes("store") || // "€€ Clothing store"
        text.includes("clothing store") || text.includes("boutique") || text.includes("shop") || text.match(/\d+\.\d+\(\d+\)/) && text.includes("·") || // Rating pattern like "4.2(166) ·"
        text.includes("directions") || text.includes("call") || text.includes("website") || text.includes("reviews")
      );
      const isNotFooter = !element.closest("footer") && !element.closest('[role="contentinfo"]');
      const isNotNavigation = !element.closest("nav") && !element.closest('[role="navigation"]');
      const isNotControlElement = !text.includes("collapse side panel") && !text.includes("savedrecentsget the app") && !text.includes("all filters") && text.length > 10;
      const result = hasModernBusinessIndicators && isNotFooter && isNotNavigation && isNotControlElement;
      if (result) {
        console.log(`BusinessDetector: Accepted container with text: "${text.slice(0, 100)}"`);
      }
      return result;
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
            const name = this.cleanBusinessName(nameElement.textContent.trim());
            console.log(`BusinessDetector: Found name "${name}" using selector "${selector}"`);
            if (this.isGenericTerm(name)) {
              console.log(`BusinessDetector: Skipping generic term: ${name}`);
              continue;
            }
            return name;
          }
        } catch (error) {
        }
      }
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
     * Check if a term is too generic to be a business name
     */
    isGenericTerm(text) {
      if (!text) return true;
      const genericTerms = [
        "results",
        "search results",
        "map results",
        "loading",
        "loading...",
        "search",
        "directions",
        "call",
        "website",
        "save",
        "more options",
        "options",
        "menu",
        "filter",
        "filters",
        "sort",
        "view all",
        "show more",
        "show less",
        "expand",
        "collapse"
      ];
      const lowerText = text.toLowerCase().trim();
      return genericTerms.includes(lowerText) || lowerText.length < 3;
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
  class CoordinateConverter {
    constructor() {
      this.EARTH_RADIUS = 6378137;
      this.MAX_LATITUDE = 85.0511287798;
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
      console.log("CoordinateConverter: Starting map bounds extraction process");
      try {
        console.log("CoordinateConverter: Trying URL-based extraction...");
        const urlBounds = this.extractBoundsFromUrl();
        if (urlBounds) {
          console.log("CoordinateConverter: Successfully extracted bounds from URL:", urlBounds);
          return urlBounds;
        }
        console.log("CoordinateConverter: Trying DOM-based extraction...");
        const domBounds = this.extractBoundsFromDOM();
        if (domBounds) {
          console.log("CoordinateConverter: Successfully extracted bounds from DOM:", domBounds);
          return domBounds;
        }
        console.log("CoordinateConverter: Using fallback estimation...");
        const fallbackBounds = this.estimateBoundsFromLocation();
        console.log("CoordinateConverter: Using estimated bounds:", fallbackBounds);
        return fallbackBounds;
      } catch (error) {
        console.error("CoordinateConverter: Failed to extract map bounds:", error);
        return null;
      }
    }
    /**
     * Extract bounds from Google Maps URL
     */
    extractBoundsFromUrl() {
      const url = window.location.href;
      console.log("CoordinateConverter: Extracting bounds from URL:", url);
      let coordMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+\.?\d*)z/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        const zoom = parseFloat(coordMatch[3]);
        console.log("CoordinateConverter: Found URL coordinates (z-suffix):", { lat, lng, zoom });
        return this.calculateBoundsFromCenter(lat, lng, zoom);
      }
      coordMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+\.?\d*)/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        const zoom = parseFloat(coordMatch[3]);
        console.log("CoordinateConverter: Found URL coordinates (no-z):", { lat, lng, zoom });
        return this.calculateBoundsFromCenter(lat, lng, zoom);
      }
      const placeMatch = url.match(/\/place\/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+\.?\d*)/);
      if (placeMatch) {
        const lat = parseFloat(placeMatch[1]);
        const lng = parseFloat(placeMatch[2]);
        const zoom = parseFloat(placeMatch[3]);
        console.log("CoordinateConverter: Found place coordinates:", { lat, lng, zoom });
        return this.calculateBoundsFromCenter(lat, lng, zoom);
      }
      const searchMatch = url.match(/\/search\/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+\.?\d*)/);
      if (searchMatch) {
        const lat = parseFloat(searchMatch[1]);
        const lng = parseFloat(searchMatch[2]);
        const zoom = parseFloat(searchMatch[3]);
        console.log("CoordinateConverter: Found search coordinates:", { lat, lng, zoom });
        return this.calculateBoundsFromCenter(lat, lng, zoom);
      }
      const dirMatch = url.match(/\/dir\/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+\.?\d*)/);
      if (dirMatch) {
        const lat = parseFloat(dirMatch[1]);
        const lng = parseFloat(dirMatch[2]);
        const zoom = parseFloat(dirMatch[3]);
        console.log("CoordinateConverter: Found directions coordinates:", { lat, lng, zoom });
        return this.calculateBoundsFromCenter(lat, lng, zoom);
      }
      console.log("CoordinateConverter: No coordinates found in URL patterns");
      return null;
    }
    /**
     * Calculate map bounds from center point and zoom level
     */
    calculateBoundsFromCenter(centerLat, centerLng, zoom) {
      const degreesPerPixelAtEquator = 360 / (256 * Math.pow(2, zoom));
      const containerWidth = 1366;
      const containerHeight = 1024;
      const lngSpan = containerWidth * degreesPerPixelAtEquator;
      const latSpan = containerHeight * degreesPerPixelAtEquator;
      const cosLat = Math.cos(centerLat * Math.PI / 180);
      const adjustedLngSpan = lngSpan / cosLat;
      console.log("CoordinateConverter: Calculated bounds for zoom", zoom, "spans:", {
        latSpan,
        lngSpan: adjustedLngSpan,
        degreesPerPixel: degreesPerPixelAtEquator,
        cosLat
      });
      return {
        center: { lat: centerLat, lng: centerLng },
        zoom,
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
      console.log("CoordinateConverter: Attempting DOM-based bounds extraction");
      try {
        if (window.google && window.google.maps) {
          console.log("CoordinateConverter: Found Google Maps API, but cannot directly access map instance");
        }
        const mapContainer = document.querySelector("#map") || document.querySelector(".gm-style");
        if (mapContainer) {
          console.log("CoordinateConverter: Found map container, checking for coordinate attributes");
          const attrs = ["data-lat", "data-lng", "data-zoom", "data-bounds", "data-viewport"];
          for (const attr of attrs) {
            const value = mapContainer.getAttribute(attr);
            if (value) {
              console.log(`CoordinateConverter: Found attribute ${attr}:`, value);
            }
          }
        }
      } catch (error) {
        console.log("CoordinateConverter: Error accessing Google Maps data:", error);
      }
      const mapElements = [
        document.querySelector("[data-lat]"),
        document.querySelector("[data-lng]"),
        document.querySelector(".gm-style[data-bounds]"),
        document.querySelector("#scene[data-viewport]"),
        document.querySelector('[role="application"]'),
        // Map application role
        document.querySelector(".widget-scene-canvas")
        // Scene canvas
      ];
      for (const element of mapElements) {
        if (element) {
          console.log("CoordinateConverter: Checking element for bounds:", element.tagName, element.className);
          const bounds = this.parseBoundsFromElement(element);
          if (bounds) {
            console.log("CoordinateConverter: Successfully extracted bounds from DOM");
            return bounds;
          }
        }
      }
      console.log("CoordinateConverter: No bounds found in DOM elements");
      return null;
    }
    /**
     * Parse bounds from a DOM element
     */
    parseBoundsFromElement(element) {
      const attributes = ["data-bounds", "data-viewport", "data-center", "data-coords"];
      for (const attr of attributes) {
        const value = element.getAttribute(attr);
        if (value) {
          try {
            const parsed = JSON.parse(value);
            if (parsed.north && parsed.south && parsed.east && parsed.west) {
              return parsed;
            }
          } catch (e) {
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
      console.log("CoordinateConverter: Attempting to estimate bounds from URL and context");
      const url = window.location.href;
      let coords = url.match(/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (coords && coords.length >= 3) {
        const lat = parseFloat(coords[1]);
        const lng = parseFloat(coords[2]);
        if (lat >= 20 && lat <= 50 && lng >= -130 && lng <= -80) {
          console.log("CoordinateConverter: Found coordinates in URL:", { lat, lng });
          let estimatedZoom = 10;
          const zoomMatch = url.match(/(\d+\.?\d*)z/);
          if (zoomMatch) {
            estimatedZoom = parseFloat(zoomMatch[1]);
          } else {
            if (url.includes("/place/") || url.includes("/search/")) {
              estimatedZoom = 15;
            } else if (url.includes("/dir/")) {
              estimatedZoom = 12;
            } else {
              estimatedZoom = 10;
            }
          }
          console.log("CoordinateConverter: Using estimated coordinates with zoom:", { lat, lng, zoom: estimatedZoom });
          return this.calculateBoundsFromCenter(lat, lng, estimatedZoom);
        }
      }
      if (url.includes("phoenix") || url.includes("Arizona") || url.includes("AZ")) {
        const phoenixCenter2 = { lat: 33.4484, lng: -112.074 };
        const defaultZoom = 9;
        console.log("CoordinateConverter: Using Phoenix area bounds based on URL context");
        return this.calculateBoundsFromCenter(phoenixCenter2.lat, phoenixCenter2.lng, defaultZoom);
      }
      const phoenixCenter = { lat: 33.4484, lng: -112.074 };
      const wideZoom = 8;
      console.log("CoordinateConverter: Using wide Phoenix default bounds as last resort");
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
        console.log("CoordinateConverter: Converting point:", { lat, lng });
        console.log("CoordinateConverter: Map bounds:", mapBounds);
        console.log("CoordinateConverter: Container size:", containerSize);
        if (lat < mapBounds.south || lat > mapBounds.north || lng < mapBounds.west || lng > mapBounds.east) {
          console.log("CoordinateConverter: Point outside map bounds");
          return null;
        }
        const xRatio = (lng - mapBounds.west) / (mapBounds.east - mapBounds.west);
        const yRatio = (mapBounds.north - lat) / (mapBounds.north - mapBounds.south);
        console.log("CoordinateConverter: Calculated ratios:", { xRatio, yRatio });
        const x = xRatio * containerSize.width;
        const y = yRatio * containerSize.height;
        console.log("CoordinateConverter: Final pixel coordinates:", { x, y });
        if (x >= -20 && x <= containerSize.width + 20 && y >= -20 && y <= containerSize.height + 20) {
          return { x, y };
        } else {
          console.log("CoordinateConverter: Point outside container bounds:", { x, y, containerSize });
          return null;
        }
      } catch (error) {
        console.error("CoordinateConverter: Conversion failed:", error);
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
        const xRatio = x / containerSize.width;
        const yRatio = y / containerSize.height;
        const mercatorBounds = {
          north: this.latitudeToMercatorY(mapBounds.north),
          south: this.latitudeToMercatorY(mapBounds.south),
          east: this.longitudeToMercatorX(mapBounds.east),
          west: this.longitudeToMercatorX(mapBounds.west)
        };
        const mercatorX = mercatorBounds.west + xRatio * (mercatorBounds.east - mercatorBounds.west);
        const mercatorY = mercatorBounds.north - yRatio * (mercatorBounds.north - mercatorBounds.south);
        const lat = this.mercatorYToLatitude(mercatorY);
        const lng = this.mercatorXToLongitude(mercatorX);
        return { lat, lng };
      } catch (error) {
        console.error("CoordinateConverter: Reverse conversion failed:", error);
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
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }
    /**
     * Check if a point is within the visible map bounds
     */
    isPointInBounds(lat, lng, mapBounds) {
      return lat >= mapBounds.south && lat <= mapBounds.north && lng >= mapBounds.west && lng <= mapBounds.east;
    }
    /**
     * Get optimal zoom level to fit all points
     */
    getOptimalZoom(points, containerSize) {
      if (!points || points.length === 0) return 10;
      let minLat = Infinity, maxLat = -Infinity;
      let minLng = Infinity, maxLng = -Infinity;
      points.forEach((point) => {
        minLat = Math.min(minLat, point.lat);
        maxLat = Math.max(maxLat, point.lat);
        minLng = Math.min(minLng, point.lng);
        maxLng = Math.max(maxLng, point.lng);
      });
      const latSpan = maxLat - minLat;
      const lngSpan = maxLng - minLng;
      const maxSpan = Math.max(latSpan, lngSpan);
      const zoom = Math.floor(Math.log2(360 / maxSpan)) - 1;
      return Math.max(1, Math.min(20, zoom));
    }
  }
  const coordinateConverter = new CoordinateConverter();
  console.log("CoordinateConverter: Module loaded and instance created");
  if (typeof window !== "undefined") {
    window.LFA_coordinateConverter = coordinateConverter;
  }
  class MapPinManager {
    constructor() {
      this.overlayContainer = null;
      this.pins = /* @__PURE__ */ new Map();
      this.businessData = /* @__PURE__ */ new Map();
      this.infoWindow = null;
      this.currentBounds = null;
      this.currentZoom = null;
      this.mapContainer = null;
      this.isInitialized = false;
      this.handleMapChange = this.handleMapChange.bind(this);
      this.handlePinHover = this.handlePinHover.bind(this);
      this.handlePinClick = this.handlePinClick.bind(this);
      this.updateThrottle = 50;
      this.lastUpdate = 0;
      this.onPinHover = null;
      this.onPinClick = null;
    }
    /**
     * Initialize the pin manager system
     */
    async init() {
      if (this.isInitialized) {
        return;
      }
      try {
        console.log("MapPinManager: Initializing...");
        await this.setupMapContainer();
        this.createOverlaySystem();
        this.setupEventListeners();
        this.isInitialized = true;
        console.log("MapPinManager: Initialized successfully");
      } catch (error) {
        console.error("MapPinManager: Initialization failed:", error);
        throw error;
      }
    }
    /**
     * Find and set up the Google Maps container
     */
    async setupMapContainer() {
      const selectors = [
        "#scene",
        // Primary map canvas container
        '[role="region"]',
        // Map region
        ".gm-style",
        // Google Maps style container
        "#map",
        // Generic map ID
        ".widget-scene-canvas",
        // Canvas container
        "[data-scene]",
        // Scene container
        ".maps-page",
        // Maps page container
        'div[jsaction*="map"]',
        // Elements with map actions
        'div[data-component-id*="scene"]'
        // Components with scene ID
      ];
      console.log("MapPinManager: Searching for map container...");
      for (const selector of selectors) {
        try {
          const containers = document.querySelectorAll(selector);
          console.log(`MapPinManager: Found ${containers.length} elements for selector "${selector}"`);
          for (const container of containers) {
            const rect = container.getBoundingClientRect();
            console.log(`MapPinManager: Checking container - size: ${rect.width}x${rect.height}, visible: ${rect.width > 0 && rect.height > 0}`);
            if (rect.width > 200 && rect.height > 200) {
              this.mapContainer = container;
              console.log("MapPinManager: Found map container:", selector, "size:", `${rect.width}x${rect.height}`);
              return;
            }
          }
        } catch (error) {
          console.warn("MapPinManager: Error with selector", selector, error);
        }
      }
      const allDivs = document.querySelectorAll("div");
      for (const div of allDivs) {
        const rect = div.getBoundingClientRect();
        if (rect.width > 400 && rect.height > 300) {
          const hasMapLikeContent = div.querySelector("canvas") || div.querySelector('img[src*="maps"]') || div.querySelector('[role="button"][aria-label*="map"]');
          if (hasMapLikeContent) {
            this.mapContainer = div;
            console.log("MapPinManager: Found map container via fallback:", div.className, "size:", `${rect.width}x${rect.height}`);
            return;
          }
        }
      }
      throw new Error("MapPinManager: Could not find valid map container");
    }
    /**
     * Create the overlay system for pins
     */
    createOverlaySystem() {
      if (this.overlayContainer) {
        return;
      }
      this.overlayContainer = document.createElement("div");
      this.overlayContainer.id = "lfa-pin-overlay";
      this.overlayContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 100;
      overflow: hidden;
    `;
      this.mapContainer.appendChild(this.overlayContainer);
      console.log("MapPinManager: Created overlay system");
    }
    /**
     * Set up event listeners for map changes
     */
    setupEventListeners() {
      if (window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(() => {
          this.handleMapChange("resize");
        });
        resizeObserver.observe(this.mapContainer);
      }
      let lastUrl = window.location.href;
      setInterval(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
          console.log("MapPinManager: URL changed from", lastUrl, "to", currentUrl);
          lastUrl = currentUrl;
          this.handleMapChange("navigation");
        }
      }, 300);
      this.mapContainer.addEventListener("wheel", () => {
        setTimeout(() => this.handleMapChange("zoom"), 200);
      }, { passive: true });
      this.mapContainer.addEventListener("mouseup", () => {
        setTimeout(() => this.handleMapChange("pan"), 200);
      }, { passive: true });
      this.mapContainer.addEventListener("touchend", () => {
        setTimeout(() => this.handleMapChange("touch"), 200);
      }, { passive: true });
      this.mapContainer.addEventListener("keyup", () => {
        setTimeout(() => this.handleMapChange("keyboard"), 200);
      }, { passive: true });
      if (window.MutationObserver) {
        const mapObserver = new MutationObserver((mutations) => {
          const hasMapChanges = mutations.some(
            (mutation) => {
              var _a, _b, _c;
              return mutation.target && (((_a = mutation.target.classList) == null ? void 0 : _a.contains("gm-style")) || ((_c = (_b = mutation.target).querySelector) == null ? void 0 : _c.call(_b, ".gm-style")));
            }
          );
          if (hasMapChanges) {
            setTimeout(() => this.handleMapChange("dom-change"), 100);
          }
        });
        mapObserver.observe(this.mapContainer, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["style", "transform"]
        });
      }
      console.log("MapPinManager: Enhanced event listeners set up");
    }
    /**
     * Handle map changes (zoom, pan, resize)
     */
    handleMapChange(type) {
      const now = Date.now();
      if (now - this.lastUpdate < this.updateThrottle) {
        return;
      }
      this.lastUpdate = now;
      console.log("MapPinManager: Map change detected:", type);
      this.updatePinPositions();
    }
    /**
     * Extract current map bounds and zoom from Google Maps
     */
    extractMapBounds() {
      return coordinateConverter.extractMapBounds();
    }
    /**
     * Convert latitude/longitude to pixel coordinates within the overlay
     */
    latLngToPixel(lat, lng, mapBounds, containerSize) {
      if (!mapBounds || !containerSize) {
        return null;
      }
      try {
        return coordinateConverter.latLngToPixel(lat, lng, mapBounds, containerSize);
      } catch (error) {
        console.error("MapPinManager: Failed to convert lat/lng to pixel:", error);
        return null;
      }
    }
    /**
     * Show pins for an array of businesses
     */
    showPinsForBusinesses(businesses) {
      if (!this.isInitialized || !businesses || businesses.length === 0) {
        return;
      }
      console.log("MapPinManager: Showing pins for", businesses.length, "businesses");
      this.clearAllPins();
      businesses.forEach((business, index) => {
        this.createPin(business, index);
      });
      this.updatePinPositions();
    }
    /**
     * Create a pin for a single business
     */
    createPin(business, index) {
      if (!business.latitude || !business.longitude) {
        console.warn("MapPinManager: Skipping business without coordinates:", business.name);
        return;
      }
      const pin = document.createElement("div");
      pin.className = "lfa-map-pin";
      pin.setAttribute("data-business-id", business.id);
      pin.style.cssText = `
      position: absolute;
      pointer-events: auto;
      cursor: pointer;
      transform: translate(-50%, -100%);
      transition: all 0.2s ease;
      z-index: ${101 + index};
    `;
      this.businessData.set(business.id, business);
      pin.innerHTML = this.createPinSVG(business, index);
      pin.addEventListener("mouseenter", (e) => this.handlePinHover(e, business, true));
      pin.addEventListener("mouseleave", (e) => this.handlePinHover(e, business, false));
      pin.addEventListener("click", (e) => this.handlePinClick(e, business));
      this.overlayContainer.appendChild(pin);
      this.pins.set(business.id, pin);
      console.log("MapPinManager: Created pin for", business.name);
    }
    /**
     * Create SVG for pin with Local First Arizona branding
     */
    createPinSVG(business, index) {
      const gradientId = `lfa-gradient-${business.id}`;
      return `
      <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#4CAF50;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#2E7D32;stop-opacity:1" />
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.3)"/>
          </filter>
        </defs>
        
        <!-- Pin shape -->
        <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" 
              fill="url(#${gradientId})" 
              stroke="#1B5E20" 
              stroke-width="1"
              filter="url(#shadow)"/>
        
        <!-- Inner circle -->
        <circle cx="16" cy="16" r="10" fill="white" stroke="#2E7D32" stroke-width="1"/>
        
        <!-- LFA text -->
        <text x="16" y="20" text-anchor="middle" 
              font-family="Arial, sans-serif" 
              font-size="8" 
              font-weight="bold" 
              fill="#2E7D32">LFA</text>
      </svg>
    `;
    }
    /**
     * Update positions of all pins based on current map state
     */
    updatePinPositions() {
      const mapBounds = this.extractMapBounds();
      if (!mapBounds) {
        console.warn("MapPinManager: Could not extract map bounds for positioning");
        return;
      }
      const containerSize = {
        width: this.overlayContainer.offsetWidth,
        height: this.overlayContainer.offsetHeight
      };
      console.log("MapPinManager: Updating pin positions with:", {
        mapBounds,
        containerSize,
        totalPins: this.pins.size
      });
      let visiblePins = 0;
      this.pins.forEach((pin, businessId) => {
        const businessData = this.getBusinessDataFromPin(pin);
        if (!businessData) {
          console.warn("MapPinManager: No business data for pin:", businessId);
          return;
        }
        console.log(`MapPinManager: Positioning pin for ${businessData.name} at (${businessData.latitude}, ${businessData.longitude})`);
        const pixelPos = this.latLngToPixel(
          businessData.latitude,
          businessData.longitude,
          mapBounds,
          containerSize
        );
        if (pixelPos) {
          pin.style.left = `${pixelPos.x}px`;
          pin.style.top = `${pixelPos.y}px`;
          pin.style.display = "block";
          pin.style.position = "absolute";
          visiblePins++;
          console.log(`MapPinManager: Pin positioned at (${pixelPos.x}, ${pixelPos.y}) for ${businessData.name}`);
        } else {
          pin.style.display = "none";
          console.log(`MapPinManager: Pin hidden (outside bounds) for ${businessData.name}`);
        }
      });
      console.log(`MapPinManager: Updated positions for ${this.pins.size} pins, ${visiblePins} visible`);
    }
    /**
     * Extract business data from pin element (helper method)
     */
    getBusinessDataFromPin(pin) {
      const businessId = pin.getAttribute("data-business-id");
      if (businessId && this.businessData.has(businessId)) {
        return this.businessData.get(businessId);
      }
      console.warn("MapPinManager: No business data found for pin, using fallback");
      return {
        latitude: 33.4484,
        // Phoenix area default
        longitude: -112.074,
        name: "Unknown Business"
      };
    }
    /**
     * Handle pin hover events
     */
    handlePinHover(event, business, isEntering) {
      const pin = event.currentTarget;
      console.log(`MapPinManager: handlePinHover called - ${isEntering ? "ENTER" : "LEAVE"} for business:`, business.name, "ID:", business.id);
      if (isEntering) {
        pin.style.transform = "translate(-50%, -100%) scale(1.1)";
        pin.style.zIndex = "200";
        console.log("MapPinManager: Attempting to highlight sidebar listing for business ID:", business.id);
        this.highlightSidebarListing(business.id, true);
        if (this.onPinHover) {
          this.onPinHover(business, true);
        }
        console.log("MapPinManager: Hovering over", business.name);
      } else {
        pin.style.transform = "translate(-50%, -100%) scale(1)";
        pin.style.zIndex = "";
        console.log("MapPinManager: Attempting to remove sidebar listing highlight for business ID:", business.id);
        this.highlightSidebarListing(business.id, false);
        if (this.onPinHover) {
          this.onPinHover(business, false);
        }
      }
    }
    /**
     * Handle pin click events
     */
    handlePinClick(event, business) {
      event.stopPropagation();
      console.log("MapPinManager: Clicked pin for", business.name);
      this.showInfoWindow(business, event.currentTarget);
      if (this.onPinClick) {
        this.onPinClick(business, event);
      }
    }
    /**
     * Show info window for business
     */
    showInfoWindow(business, pinElement) {
      console.log("MapPinManager: Showing info window for", business.name);
      this.hideInfoWindow();
      this.infoWindow = this.createInfoWindow(business);
      const pinRect = pinElement.getBoundingClientRect();
      const overlayRect = this.overlayContainer.getBoundingClientRect();
      this.infoWindow.style.left = `${pinRect.left - overlayRect.left}px`;
      this.infoWindow.style.top = `${pinRect.top - overlayRect.top - 10}px`;
      this.infoWindow.style.transform = "translate(-50%, -100%)";
      this.overlayContainer.appendChild(this.infoWindow);
      setTimeout(() => {
        this.hideInfoWindow();
      }, 5e3);
    }
    /**
     * Create Google Maps-style info window
     */
    createInfoWindow(business) {
      const infoWindow = document.createElement("div");
      infoWindow.className = "lfa-info-window";
      infoWindow.style.cssText = `
      position: absolute;
      background: white;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 300;
      font-family: Google Sans, Roboto, Arial, sans-serif;
      font-size: 14px;
      line-height: 20px;
      max-width: 250px;
      pointer-events: auto;
      cursor: default;
    `;
      const arrow = document.createElement("div");
      arrow.style.cssText = `
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid white;
    `;
      infoWindow.appendChild(arrow);
      const name = document.createElement("div");
      name.style.cssText = `
      font-weight: 600;
      color: #1a73e8;
      margin-bottom: 4px;
      cursor: pointer;
    `;
      name.textContent = business.name;
      name.addEventListener("click", () => {
        this.openBusinessInMaps(business);
      });
      infoWindow.appendChild(name);
      if (business.address) {
        const address = document.createElement("div");
        address.style.cssText = `
        color: #5f6368;
        font-size: 13px;
        margin-bottom: 4px;
      `;
        address.textContent = business.address;
        infoWindow.appendChild(address);
      }
      if (business.distance) {
        const distance = document.createElement("div");
        distance.style.cssText = `
        color: #5f6368;
        font-size: 13px;
        margin-bottom: 8px;
      `;
        distance.textContent = `${business.distance.toFixed(1)} mi away`;
        infoWindow.appendChild(distance);
      }
      if (business.verified) {
        const badge = document.createElement("div");
        badge.style.cssText = `
        background: #4CAF50;
        color: white;
        font-size: 11px;
        padding: 3px 6px;
        border-radius: 4px;
        display: inline-block;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        font-weight: 600;
      `;
        badge.textContent = "Verified Local";
        infoWindow.appendChild(badge);
      }
      return infoWindow;
    }
    /**
     * Hide the current info window
     */
    hideInfoWindow() {
      if (this.infoWindow) {
        this.infoWindow.remove();
        this.infoWindow = null;
      }
    }
    /**
     * Open business in Google Maps
     */
    openBusinessInMaps(business) {
      try {
        let url;
        if (business.name && business.address) {
          console.log("MapPinManager: Using name+address search for", business.name);
          const query = encodeURIComponent(`${business.name} ${business.address}`);
          url = `https://www.google.com/maps/search/${query}`;
        } else if (business.placeId && business.placeId.length > 15 && !business.placeId.includes("Example") && !business.placeId.includes("ChIJ")) {
          console.log("MapPinManager: Using validated PlaceID for", business.name, ":", business.placeId);
          url = `https://www.google.com/maps/place/?q=place_id:${business.placeId}`;
        } else if (business.latitude && business.longitude && business.name) {
          console.log("MapPinManager: Using coordinates+name search for", business.name);
          const query = encodeURIComponent(`${business.name} Phoenix AZ`);
          url = `https://www.google.com/maps/search/${query}/@${business.latitude},${business.longitude},17z`;
        } else if (business.name) {
          console.log("MapPinManager: Using name-only search for", business.name);
          const query = encodeURIComponent(`${business.name} Phoenix AZ`);
          url = `https://www.google.com/maps/search/${query}`;
        } else {
          console.warn("MapPinManager: No valid data to open business in maps:", business);
          return;
        }
        console.log("MapPinManager: Opening URL:", url);
        window.open(url, "_blank");
      } catch (error) {
        console.error("MapPinManager: Failed to open business in maps:", error);
      }
    }
    /**
     * Highlight sidebar listing for a business
     */
    highlightSidebarListing(businessId, highlight = true) {
      try {
        const lfaBusinessItem = document.querySelector(`[data-lfa-business="${businessId}"]`);
        if (lfaBusinessItem) {
          if (highlight) {
            lfaBusinessItem.style.backgroundColor = "#f8f9fa";
            lfaBusinessItem.style.transform = "translateX(2px)";
            lfaBusinessItem.style.transition = "all 0.2s ease";
            lfaBusinessItem.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
          } else {
            lfaBusinessItem.style.backgroundColor = "";
            lfaBusinessItem.style.transform = "";
            lfaBusinessItem.style.boxShadow = "";
          }
          console.log(`MapPinManager: ${highlight ? "Highlighted" : "Unhighlighted"} sidebar listing for business ${businessId}`);
        } else {
          console.log(`MapPinManager: No sidebar listing found for business ${businessId}`);
          console.log(
            "MapPinManager: Available LFA business items:",
            Array.from(document.querySelectorAll("[data-lfa-business]")).map((el) => el.getAttribute("data-lfa-business"))
          );
        }
      } catch (error) {
        console.warn("MapPinManager: Error highlighting sidebar listing:", error);
      }
    }
    /**
     * Clear all pins from the overlay
     */
    clearAllPins() {
      this.hideInfoWindow();
      this.pins.forEach((pin) => {
        pin.remove();
      });
      this.pins.clear();
      this.businessData.clear();
      console.log("MapPinManager: Cleared all pins");
    }
    /**
     * Set hover callbacks for bidirectional interaction
     */
    setHoverCallbacks(onPinHover, onPinClick) {
      this.onPinHover = onPinHover;
      this.onPinClick = onPinClick;
    }
    /**
     * Highlight a pin from external trigger (e.g., sidebar hover)
     */
    highlightPinForBusiness(businessId, highlight = true) {
      try {
        const pin = this.pins.get(businessId);
        if (pin) {
          if (highlight) {
            pin.style.transform = "translate(-50%, -100%) scale(1.15)";
            pin.style.zIndex = "250";
            pin.style.filter = "drop-shadow(0 4px 8px rgba(0,0,0,0.3))";
          } else {
            pin.style.transform = "translate(-50%, -100%) scale(1)";
            pin.style.zIndex = "";
            pin.style.filter = "";
          }
        }
      } catch (error) {
        console.warn("MapPinManager: Error highlighting pin:", error);
      }
    }
    /**
     * Get all pins for external access
     */
    getPins() {
      return Array.from(this.pins.entries()).map(([businessId, pinElement]) => {
        const business = this.businessData.get(businessId);
        return {
          businessId,
          business,
          pinElement
        };
      });
    }
    /**
     * Destroy the pin manager and clean up
     */
    destroy() {
      this.clearAllPins();
      if (this.overlayContainer) {
        this.overlayContainer.remove();
        this.overlayContainer = null;
      }
      this.isInitialized = false;
      console.log("MapPinManager: Destroyed");
    }
  }
  const mapPinManager = new MapPinManager();
  console.log("MapPinManager: Module loaded and instance created");
  if (typeof window !== "undefined") {
    window.LFA_mapPinManager = mapPinManager;
  }
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

      /* Map Pin Styles */
      .lfa-map-pin {
        position: absolute;
        pointer-events: auto;
        cursor: pointer;
        user-select: none;
        transition: all 0.2s ease;
      }

      .lfa-map-pin:hover {
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
      }

      /* Info Window Styles */
      .lfa-info-window {
        position: absolute;
        background: white;
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 300;
        font-family: Google Sans, Roboto, Arial, sans-serif;
        font-size: 14px;
        line-height: 20px;
        max-width: 250px;
        pointer-events: auto;
        cursor: default;
        animation: lfa-info-appear 0.2s ease-out;
      }

      @keyframes lfa-info-appear {
        from {
          opacity: 0;
          transform: translate(-50%, -100%) scale(0.9);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -100%) scale(1);
        }
      }

      /* Pin Overlay Container */
      #lfa-pin-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 100;
        overflow: hidden;
      }

      /* Enhanced Alternative Item Hover */
      .lfa-alternative-item:hover {
        background-color: #f8f9fa !important;
        transform: translateX(4px) !important;
        transition: all 0.2s ease !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .lfa-badge {
          border: 2px solid white;
        }
        
        .lfa-chain-business {
          border: 2px solid orange;
        }
        
        .lfa-map-pin {
          border: 2px solid white;
          border-radius: 50%;
        }
        
        .lfa-info-window {
          border: 2px solid #333;
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
          ".qBF1Pd.fontHeadlineSmall",
          // Most specific first
          ".qBF1Pd",
          '[role="heading"]',
          "h1",
          "h2",
          "h3",
          ".section-result-title",
          ".NrDZNb",
          'span[data-value][data-dtype="d3bn"]'
        ];
        for (const selector of nameSelectors) {
          const nameElements = element.querySelectorAll(selector);
          for (const nameElement of nameElements) {
            const text = nameElement.textContent.trim();
            if (text && text.length > 3 && text.length < 100) {
              if (text.toLowerCase().includes("whole foods") || text.toLowerCase().includes("safeway") || text.toLowerCase().includes("fry") || text.toLowerCase().includes("walmart") || text.toLowerCase().includes("target")) {
                data.name = text;
                console.log(`UIInjector: Found business name "${text}" using selector "${selector}"`);
                break;
              }
            }
          }
          if (data.name) break;
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
              if (node.classList && (node.classList.contains("lfa-alternatives") || node.classList.contains("lfa-placeholder") || node.classList.contains("lfa-status-bar"))) {
                return;
              }
              const text = (node.textContent || node.getAttribute("aria-label") || "").toLowerCase();
              if (text.includes(normalizedName)) {
                node.style.display = "none";
                console.log(`UIInjector: Hidden dynamically added pin for ${businessName}:`, node);
              }
              const childPins = node.querySelectorAll('[role="button"], button, [data-value]');
              childPins.forEach((pin) => {
                if (pin.closest(".lfa-alternatives, .lfa-placeholder, .lfa-status-bar")) {
                  return;
                }
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
        const existingInjected = this.injectedElements.get(element);
        if (existingInjected && existingInjected.placeholder) {
          console.log(`UIInjector: Placeholder already exists for ${chainInfo.name}, skipping`);
          return;
        }
        const parentContainer = this.findPlaceholderParent(element);
        if (!parentContainer) {
          console.log(`UIInjector: Could not find suitable parent for placeholder for ${chainInfo.name}`);
          return;
        }
        const placeholder = document.createElement("div");
        placeholder.className = "lfa-chain-placeholder";
        placeholder.setAttribute("data-chain-name", chainInfo.name);
        placeholder.style.cssText = `
        background: #f8f9fa !important;
        border: 1px solid #e8eaed !important;
        border-radius: 8px !important;
        padding: 12px !important;
        margin: 4px 0 !important;
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
        color: #333 !important;
        font-family: Google Sans, Roboto, Arial, sans-serif !important;
        font-size: 13px !important;
        line-height: 18px !important;
        min-height: 50px !important;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
        clear: both !important;
      `;
        placeholder.innerHTML = `
        <div style="color: #666; font-size: 13px; text-align: center; padding: 8px;">
          <div style="font-weight: 500; margin-bottom: 4px;">🏪 Chain store hidden</div>
          <div style="font-size: 11px;">Loading local alternatives...</div>
        </div>
      `;
        try {
          parentContainer.appendChild(placeholder);
          console.log(`UIInjector: Created placeholder for hidden ${chainInfo.name} in proper container`);
        } catch (insertError) {
          console.warn(`UIInjector: Container insertion failed, using fallback for ${chainInfo.name}:`, insertError);
          element.parentNode.insertBefore(placeholder, element.nextSibling);
        }
        if (this.injectedElements.has(element)) {
          this.injectedElements.get(element).placeholder = placeholder;
        } else {
          this.injectedElements.set(element, { placeholder, type: "chain-placeholder" });
        }
      } catch (error) {
        console.error("UIInjector: Failed to create chain placeholder:", error);
      }
    }
    /**
     * Find appropriate parent container for placeholder placement
     */
    findPlaceholderParent(element) {
      let current = element.parentElement;
      while (current && current !== document.body) {
        if (current.classList.contains("section-result") || current.classList.contains("section-result-content") || current.querySelector('[role="article"]') || current.style.display === "flex" && current.children.length > 1) {
          return current;
        }
        current = current.parentElement;
      }
      return element.parentElement;
    }
    /**
     * Show local alternatives when chain is filtered
     */
    showLocalAlternatives(element, chainInfo, alternatives, isProactive = false) {
      if (!alternatives || alternatives.length === 0) {
        return;
      }
      try {
        const alternativesElement = this.createAlternativesElement(alternatives, chainInfo, isProactive);
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
          } else if (isProactive) {
            const resultsContainer = document.querySelector('[role="main"] > div > div') || document.querySelector(".m6QErb.WNBkOb.XiKgde") || document.querySelector('[role="main"]');
            if (resultsContainer) {
              const firstResult = resultsContainer.querySelector(".Nv2PK.THOPZb.CpccDe") || resultsContainer.querySelector('[jsaction*="mouseover"]');
              if (firstResult && firstResult.parentElement) {
                firstResult.parentElement.insertBefore(alternativesElement, firstResult);
              } else {
                resultsContainer.insertBefore(alternativesElement, resultsContainer.firstChild);
              }
              this.injectedElements.set(element, {
                alternatives: alternativesElement,
                type: "proactive-alternatives",
                container: resultsContainer
              });
              console.log(`UIInjector: Added ${alternatives.length} proactive alternatives to sidebar`);
              this.showAlternativeMapPins(alternatives);
            } else {
              console.error("UIInjector: Could not find results container for proactive alternatives");
            }
          }
        }
      } catch (error) {
        console.error("UIInjector: Failed to show alternatives:", error);
      }
    }
    /**
     * Create local alternatives element
     */
    createAlternativesElement(alternatives, chainInfo, isProactive = false) {
      const container = document.createElement("div");
      container.className = "lfa-alternatives";
      container.style.cssText = "margin-bottom: 16px;";
      const header = document.createElement("div");
      header.style.cssText = `
      background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
      color: white;
      padding: 12px 16px;
      font-size: 14px;
      font-weight: 500;
      border-radius: 8px 8px 0 0;
    `;
      if (isProactive) {
        header.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">🏪</span>
          <div>
            <div>Local businesses you might like</div>
            <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">Supporting your community</div>
          </div>
        </div>`;
      } else {
        header.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">🏪</span>
          <div>
            <div>Local alternatives to ${chainInfo.name}</div>
            <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">Supporting your community</div>
          </div>
        </div>`;
      }
      container.appendChild(header);
      const listingsContainer = document.createElement("div");
      listingsContainer.style.cssText = `
      background: white;
      border-left: 1px solid #e8eaed;
      border-right: 1px solid #e8eaed;
      border-bottom: 1px solid #e8eaed;
      border-radius: 0 0 8px 8px;
      overflow: hidden;
    `;
      alternatives.slice(0, 5).forEach((business, index) => {
        const item = document.createElement("div");
        item.className = "Nv2PK THOPZb CpccDe lfa-alternative-item";
        item.style.cssText = `
        padding: 16px; 
        border-bottom: ${index < alternatives.slice(0, 5).length - 1 ? "1px solid #e8eaed" : "none"}; 
        cursor: pointer;
        transition: background-color 0.2s;
      `;
        item.addEventListener("mouseenter", () => {
          item.style.backgroundColor = "#f8f9fa";
        });
        item.addEventListener("mouseleave", () => {
          item.style.backgroundColor = "white";
        });
        item.setAttribute("data-business-id", business.id);
        const contentHtml = `
        <div class="bJzME" style="padding: 0;">
          <div class="qBF1Pd fontHeadlineSmall" style="font-weight: 500; color: #1a73e8; margin-bottom: 4px;">
            ${business.name}
          </div>
          <div style="display: flex; align-items: center; gap: 8px; color: #70757a; font-size: 14px;">
            <span style="color: #fbbc04;">★★★★★</span>
            <span>Local Business</span>
            ${business.category && business.category !== "other" ? `<span>· ${business.category}</span>` : ""}
          </div>
          ${business.address ? `
            <div style="color: #70757a; font-size: 14px; margin-top: 4px;">
              ${business.address}
            </div>
          ` : ""}
          ${business.distance ? `
            <div style="color: #188038; font-size: 14px; margin-top: 4px;">
              ${business.distance.toFixed(1)} mi away
            </div>
          ` : ""}
          <div style="color: #188038; font-weight: 500; font-size: 12px; margin-top: 8px;">
            VERIFIED LOCAL
          </div>
        </div>
      `;
        item.innerHTML = contentHtml;
        const nameElement = item.querySelector(".qBF1Pd");
        nameElement.style.cursor = "pointer";
        nameElement.addEventListener("click", () => {
          this.handleAlternativeClick(business, chainInfo);
        });
        item.addEventListener("mouseenter", () => {
          if (mapPinManager.isInitialized) {
            mapPinManager.highlightPinForBusiness(business.id, true);
          }
        });
        item.addEventListener("mouseleave", () => {
          if (mapPinManager.isInitialized) {
            mapPinManager.highlightPinForBusiness(business.id, false);
          }
        });
        item.addEventListener("click", (event) => {
          if (!event.target.classList.contains("qBF1Pd")) {
            if (mapPinManager.isInitialized) {
              mapPinManager.highlightPinForBusiness(business.id, true);
              setTimeout(() => {
                mapPinManager.highlightPinForBusiness(business.id, false);
              }, 3e3);
              console.log(`UIInjector: Highlighted pin for ${business.name} via sidebar click`);
            }
          }
        });
        listingsContainer.appendChild(item);
      });
      container.appendChild(listingsContainer);
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
    async showAlternativeMapPins(alternatives) {
      try {
        console.log(`UIInjector: Attempting to show ${alternatives.length} alternative map pins using MapPinManager`);
        if (!mapPinManager.isInitialized) {
          console.log("UIInjector: Initializing MapPinManager...");
          try {
            await mapPinManager.init();
            console.log("UIInjector: MapPinManager initialized successfully");
          } catch (initError) {
            console.error("UIInjector: MapPinManager initialization failed:", initError);
            throw initError;
          }
        }
        mapPinManager.setHoverCallbacks(
          (business, isHovering) => this.handlePinHover(business, isHovering),
          (business, event) => this.handlePinClick(business, event)
        );
        console.log("UIInjector: Calling mapPinManager.showPinsForBusinesses with:", alternatives);
        mapPinManager.showPinsForBusinesses(alternatives);
        console.log("UIInjector: MapPinManager pin display completed");
      } catch (error) {
        console.error("UIInjector: Failed to show alternative map pins:", error);
        console.log("UIInjector: Error details:", {
          error: error.message,
          stack: error.stack,
          alternatives,
          mapPinManagerInitialized: mapPinManager.isInitialized
        });
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
     * Handle pin hover from MapPinManager
     */
    handlePinHover(business, isHovering) {
      try {
        const alternativeItems = document.querySelectorAll(".lfa-alternative-item");
        alternativeItems.forEach((item) => {
          const nameElement = item.querySelector(".lfa-alternative-name");
          if (nameElement && nameElement.textContent.trim() === business.name) {
            if (isHovering) {
              item.style.backgroundColor = "#e8f0fe";
              item.style.transform = "scale(1.02)";
              item.style.transition = "all 0.2s ease";
              item.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
            } else {
              item.style.backgroundColor = "";
              item.style.transform = "";
              item.style.boxShadow = "";
            }
          }
        });
      } catch (error) {
        console.warn("UIInjector: Error handling pin hover:", error);
      }
    }
    /**
     * Handle pin click from MapPinManager
     */
    handlePinClick(business, event) {
      console.log("UIInjector: Pin clicked for business:", business.name);
    }
    /**
     * Clean up orphaned placeholder elements that may be causing stacking issues
     */
    cleanupOrphanedPlaceholders() {
      try {
        const placeholders = document.querySelectorAll(".lfa-chain-placeholder");
        console.log(`UIInjector: Found ${placeholders.length} placeholder elements for cleanup check`);
        placeholders.forEach((placeholder, index) => {
          var _a;
          const chainName = placeholder.getAttribute("data-chain-name");
          const parentRect = (_a = placeholder.parentElement) == null ? void 0 : _a.getBoundingClientRect();
          if (parentRect && parentRect.left > window.innerWidth * 0.6) {
            console.log(`UIInjector: Removing misplaced placeholder for ${chainName} (positioned at x: ${parentRect.left})`);
            placeholder.remove();
          }
          if (index > 4) {
            console.log(`UIInjector: Removing excess placeholder #${index} for ${chainName}`);
            placeholder.remove();
          }
        });
      } catch (error) {
        console.error("UIInjector: Error cleaning up orphaned placeholders:", error);
      }
    }
    /**
     * Clear all injected elements (for page navigation)
     */
    clearAllInjectedElements() {
      const preserveLFASidebar = document.querySelector('[data-lfa-sidebar="true"]');
      if (preserveLFASidebar) {
        console.log("UIInjector: Preserving LFA sidebar during clear operation");
        return;
      }
      console.log("UIInjector: Clearing all injected elements (no LFA sidebar to preserve)");
      this.hideFilterStatus();
      if (mapPinManager.isInitialized && !preserveLFASidebar) {
        mapPinManager.clearAllPins();
      }
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
      this.cleanupOrphanedPlaceholders();
      document.querySelectorAll(".lfa-badge, .lfa-alternatives, .lfa-chain-placeholder").forEach((element) => {
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
    /**
     * Replace Google sidebar with LFA businesses
     */
    async replaceSidebarWithLFA() {
      try {
        console.log("UIInjector: Replacing Google business listings with LFA businesses");
        this.storeOriginalGoogleContent();
        const feedContainer = this.findGoogleFeedContainer();
        if (!feedContainer) {
          console.error("UIInjector: Could not find Google feed container");
          return;
        }
        const userQuery = businessMatcher.extractUserSearchQuery();
        const currentLocation = businessMatcher.extractLocationFromUrl();
        console.log("UIInjector: Extracted query and location:", { userQuery, currentLocation });
        if (!userQuery || !currentLocation) {
          console.log("UIInjector: Missing query or location for LFA replacement");
          return;
        }
        let lfaBusinesses = window.LFA_cachedBusinesses;
        if (lfaBusinesses && lfaBusinesses.length > 0) {
          console.log(`UIInjector: Using cached LFA businesses (${lfaBusinesses.length} businesses)`);
        } else {
          console.log("UIInjector: No cached businesses, calling findLFABusinesses with:", { userQuery, currentLocation });
          lfaBusinesses = await businessMatcher.findLFABusinesses(userQuery, currentLocation);
          console.log("UIInjector: findLFABusinesses returned:", (lfaBusinesses == null ? void 0 : lfaBusinesses.length) || 0, "businesses");
          window.LFA_cachedBusinesses = lfaBusinesses;
        }
        if (lfaBusinesses && lfaBusinesses.length > 0) {
          this.injectLFABusinessListings(feedContainer, lfaBusinesses, userQuery);
          console.log(`UIInjector: Replaced Google listings with ${lfaBusinesses.length} LFA businesses`);
        } else {
          console.log("UIInjector: No LFA businesses found for replacement");
          this.showNoLFABusinessesMessage(feedContainer, userQuery);
        }
      } catch (error) {
        console.error("UIInjector: Error replacing business listings:", error);
      }
    }
    /**
     * Restore original Google sidebar content
     */
    restoreGoogleSidebar() {
      try {
        console.log("UIInjector: Restoring Google sidebar");
        this.removeLFASidebar();
        this.showGoogleSidebar();
      } catch (error) {
        console.error("UIInjector: Error restoring Google sidebar:", error);
      }
    }
    /**
     * Find Google's feed container where business listings are displayed
     * This is the role="feed" container that holds all business results
     */
    findGoogleFeedContainer() {
      const feedContainer = document.querySelector('[role="feed"][aria-label*="Results"]');
      if (feedContainer) {
        console.log('UIInjector: Found Google feed container with role="feed"');
        return feedContainer;
      }
      const feedByClass = document.querySelector(".m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde.ecceSd");
      if (feedByClass) {
        console.log("UIInjector: Found Google feed container by class names");
        return feedByClass;
      }
      const anyFeed = document.querySelector('[role="feed"]');
      if (anyFeed) {
        console.log('UIInjector: Found feed container (any role="feed")');
        return anyFeed;
      }
      console.error("UIInjector: Could not find Google feed container");
      return null;
    }
    /**
     * Inject LFA business listings directly into Google's feed container
     * Each business uses Google's exact class structure for perfect integration
     */
    injectLFABusinessListings(feedContainer, lfaBusinesses, userQuery) {
      try {
        console.log(`UIInjector: Injecting ${lfaBusinesses.length} LFA businesses into feed container`);
        this.hideGoogleBusinessListings(feedContainer);
        lfaBusinesses.forEach((business, index) => {
          const businessElement = this.createGoogleStyleBusinessListing(business, index);
          feedContainer.appendChild(businessElement);
          businessElement.setAttribute("data-lfa-business-listing", "true");
        });
        console.log(`UIInjector: Successfully injected ${lfaBusinesses.length} LFA business listings`);
      } catch (error) {
        console.error("UIInjector: Error injecting LFA business listings:", error);
      }
    }
    /**
     * Hide Google's business listings while preserving the feed container structure
     */
    hideGoogleBusinessListings(feedContainer) {
      const businessItems = feedContainer.querySelectorAll(".Nv2PK.THOPZb.CpccDe, [data-result-index], .section-result");
      businessItems.forEach((item) => {
        item.style.display = "none";
        item.setAttribute("data-lfa-hidden-google", "true");
      });
      const sponsoredItems = feedContainer.querySelectorAll("[data-result-ad-type], .section-result-sponsored, .bfdHYd.Ppzolf.OFBs3e.Jv9l1d");
      sponsoredItems.forEach((item) => {
        item.style.display = "none";
        item.setAttribute("data-lfa-hidden-google", "true");
      });
      const loadingElements = feedContainer.querySelectorAll('.loading, .spinner, [class*="loading"], [class*="spinner"]');
      loadingElements.forEach((item) => {
        item.style.display = "none";
        item.setAttribute("data-lfa-hidden-google", "true");
      });
      const emptyDivs = Array.from(feedContainer.children).filter(
        (child) => child.tagName === "DIV" && !child.textContent.trim() && !child.querySelector("img, svg, canvas") && !child.hasAttribute("data-lfa-results-header") && !child.hasAttribute("data-lfa-business-listing")
      );
      emptyDivs.forEach((item) => {
        item.style.display = "none";
        item.setAttribute("data-lfa-hidden-google", "true");
      });
      console.log(`UIInjector: Hidden ${businessItems.length} business items, ${sponsoredItems.length} sponsored items, ${loadingElements.length} loading elements, and ${emptyDivs.length} empty divs`);
    }
    /**
     * Create a header element to indicate LFA businesses are being shown
     */
    createLFAResultsHeader(userQuery, businessCount) {
      const header = document.createElement("div");
      header.className = "lfa-results-header";
      header.setAttribute("data-lfa-results-header", "true");
      header.style.cssText = `
      background: linear-gradient(135deg, #2E7D32, #4CAF50) !important;
      color: white !important;
      padding: 12px 16px !important;
      margin: 0 0 8px 0 !important;
      border-radius: 8px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
    `;
      header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 18px;">🏪</span>
        <div>
          <div style="font-weight: 600; font-size: 14px;">
            Showing Local First Arizona businesses
          </div>
          <div style="font-size: 12px; opacity: 0.9;">
            ${businessCount} local businesses found for "${userQuery}"
          </div>
        </div>
      </div>
    `;
      return header;
    }
    /**
     * Create a business listing element that mimics Google's exact structure
     */
    createGoogleStyleBusinessListing(business, index) {
      const businessItem = document.createElement("div");
      businessItem.className = "Nv2PK THOPZb CpccDe lfa-business-item";
      businessItem.setAttribute("data-lfa-business", business.id);
      const distance = business.distance ? `${business.distance.toFixed(1)} mi` : "Near you";
      businessItem.innerHTML = `
      <div class="bfdHYd Ppzolf OFBs3e">
        <div class="lI9IFe">
          <div class="y7PRA">
            <div class="Lui3Od T7Wufd">
              <div class="Z8fK3b">
                <div class="UaQhfb fontBodyMedium">
                  <div class="NrDZNb">
                    <div class="qBF1Pd fontHeadlineSmall lfa-business-name">${business.name}</div>
                  </div>
                  <div class="W4Efsd">
                    <div class="W4Efsd">
                      <span><span>${business.category || "Local Business"}</span></span>
                      ${business.address ? `<span> <span aria-hidden="true">·</span> <span>${business.address}</span></span>` : ""}
                    </div>
                    ${business.phone ? `<div class="W4Efsd"><span class="UsdlK">${business.phone}</span></div>` : ""}
                    <div class="W4Efsd">
                      <span style="color: #1976D2; font-weight: 500;">${distance} away</span>
                      ${business.website ? ` <span aria-hidden="true">·</span> <a href="${business.website}" target="_blank" style="color: #1976D2; text-decoration: none;">Website</a>` : ""}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
      businessItem.addEventListener("click", () => {
        this.handleLFABusinessClick(business);
      });
      businessItem.addEventListener("mouseenter", () => {
        this.highlightMapPinForBusiness(business, true);
        businessItem.style.backgroundColor = "#f8f9fa";
        businessItem.style.transform = "translateX(2px)";
        businessItem.style.transition = "all 0.2s ease";
      });
      businessItem.addEventListener("mouseleave", () => {
        this.highlightMapPinForBusiness(business, false);
        businessItem.style.backgroundColor = "";
        businessItem.style.transform = "";
      });
      return businessItem;
    }
    /**
     * Handle click on LFA business listing
     */
    handleLFABusinessClick(business) {
      console.log("UIInjector: LFA business clicked:", business.name);
      if (business.website) {
        window.open(business.website, "_blank");
      }
      this.trackEvent("lfa_business_click", {
        businessId: business.id,
        businessName: business.name,
        hasWebsite: !!business.website
      });
    }
    /**
     * Highlight map pin for a business when hovering over listing
     */
    highlightMapPinForBusiness(business, isHighlighted) {
      try {
        const pinManager = window.LFA_mapPinManager || mapPinManager;
        if (!pinManager || !pinManager.isInitialized) {
          console.log("UIInjector: Map pin manager not available for highlighting");
          return;
        }
        if (pinManager.highlightPinForBusiness) {
          pinManager.highlightPinForBusiness(business.id, isHighlighted);
        } else {
          this.manuallyHighlightMapPin(business, isHighlighted);
        }
      } catch (error) {
        console.error("UIInjector: Error highlighting map pin:", error);
      }
    }
    /**
     * Manually highlight map pin if automatic method not available
     */
    manuallyHighlightMapPin(business, isHighlighted) {
      const mapPins = document.querySelectorAll("[data-lfa-pin], .lfa-map-pin");
      for (const pin of mapPins) {
        const pinBusinessId = pin.getAttribute("data-business-id");
        const pinBusinessName = pin.getAttribute("data-business-name");
        if (pinBusinessId === business.id || pinBusinessName === business.name) {
          if (isHighlighted) {
            pin.style.transform = "scale(1.3)";
            pin.style.filter = "drop-shadow(0 0 8px rgba(76, 175, 80, 0.8))";
            pin.style.zIndex = "1000";
            pin.style.transition = "all 0.2s ease";
          } else {
            pin.style.transform = "";
            pin.style.filter = "";
            pin.style.zIndex = "";
          }
          break;
        }
      }
    }
    /**
     * Show message when no LFA businesses are found
     */
    showNoLFABusinessesMessage(feedContainer, userQuery) {
      const messageElement = document.createElement("div");
      messageElement.className = "lfa-no-results-message";
      messageElement.setAttribute("data-lfa-no-results", "true");
      messageElement.style.cssText = `
      background: #f8f9fa !important;
      border: 2px dashed #ddd !important;
      padding: 24px !important;
      margin: 16px 0 !important;
      border-radius: 8px !important;
      text-align: center !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    `;
      messageElement.innerHTML = `
      <div style="color: #666; font-size: 14px;">
        <div style="font-size: 18px; margin-bottom: 8px;">🏪</div>
        <div style="font-weight: 600; margin-bottom: 4px;">No Local First Arizona businesses found</div>
        <div>for "${userQuery}" in this area</div>
      </div>
    `;
      feedContainer.appendChild(messageElement);
    }
    /**
     * Find the proper insertion point within Google's sidebar for LFA businesses
     * This mimics the working approach from chain filtering
     */
    findSidebarInsertionPoint(sidebarContainer) {
      const resultsList = sidebarContainer.querySelector('[role="feed"], [role="list"], .section-listbox');
      if (resultsList) {
        console.log("UIInjector: Found results list container");
        return resultsList;
      }
      const scrollableContainers = sidebarContainer.querySelectorAll('[style*="overflow"], [style*="scroll"]');
      for (const container of scrollableContainers) {
        if (container.children.length > 0) {
          console.log("UIInjector: Found scrollable container with children");
          return container;
        }
      }
      console.log("UIInjector: Using sidebar container as fallback insertion point");
      return sidebarContainer;
    }
    /**
     * Hide Google business listings while preserving structure
     */
    hideGoogleListings(sidebarContainer) {
      const businessItems = sidebarContainer.querySelectorAll('[data-result-index], .section-result, [role="article"]');
      businessItems.forEach((item) => {
        item.style.display = "none";
        item.setAttribute("data-lfa-hidden-google", "true");
      });
      const sponsoredItems = sidebarContainer.querySelectorAll("[data-result-ad-type], .section-result-sponsored");
      sponsoredItems.forEach((item) => {
        item.style.display = "none";
        item.setAttribute("data-lfa-hidden-google", "true");
      });
      console.log(`UIInjector: Hidden ${businessItems.length} business items and ${sponsoredItems.length} sponsored items`);
    }
    /**
     * Store original Google content for later restoration
     */
    storeOriginalGoogleContent() {
      if (this.originalGoogleContent) {
        return;
      }
      const sidebarContainer = this.findGoogleSidebarContainer();
      if (sidebarContainer) {
        this.originalGoogleContent = {
          container: sidebarContainer,
          display: sidebarContainer.style.display,
          visibility: sidebarContainer.style.visibility
        };
        console.log("UIInjector: Stored original Google content");
      }
    }
    /**
     * Hide Google sidebar content
     */
    hideGoogleSidebar() {
      const selectors = [
        '[role="main"] > div > div > div',
        // Main results container
        ".m6QErb.WNBkOb.XiKgde",
        // Results list container
        '[role="main"] > div',
        // Results wrapper
        "#pane > div > div",
        // Pane content
        ".section-result",
        // Individual results
        ".sponsored-result",
        // Sponsored content
        ".result-snippet"
        // Result snippets
      ];
      selectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          if (!element.closest('[data-lfa-sidebar="true"]')) {
            element.style.display = "none";
            element.setAttribute("data-lfa-hidden-google", "true");
          }
        });
      });
      document.querySelectorAll("[data-ads-integration], [data-sponsored], .sponsored").forEach((element) => {
        element.style.display = "none";
        element.setAttribute("data-lfa-hidden-google", "true");
      });
      console.log("UIInjector: Hidden Google sidebar and sponsored content");
    }
    /**
     * Show Google sidebar content
     */
    showGoogleSidebar() {
      document.querySelectorAll('[data-lfa-business-listing="true"], [data-lfa-results-header="true"], [data-lfa-no-results="true"], .lfa-results-header').forEach((element) => {
        element.remove();
      });
      document.querySelectorAll('[data-lfa-hidden-google="true"]').forEach((element) => {
        element.style.display = "";
        element.style.visibility = "";
        element.removeAttribute("data-lfa-hidden-google");
      });
      const parentContainers = document.querySelectorAll('[role="main"], [role="main"] > div');
      parentContainers.forEach((container) => {
        container.style.position = "";
        container.style.height = "";
        container.style.overflow = "";
      });
      console.log("UIInjector: Restored all hidden Google content and removed LFA listings");
    }
    /**
     * Find the main Google sidebar container
     */
    findGoogleSidebarContainer() {
      var _a, _b;
      const selectors = [
        '[role="main"] > div > div > div',
        // Main results container
        ".m6QErb.WNBkOb.XiKgde",
        // Results list container
        '[role="main"]',
        // Fallback to main area
        "#pane"
        // Google Maps pane selector
      ];
      console.log("UIInjector: Searching for Google sidebar container...");
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        console.log(`UIInjector: Selector "${selector}":`, {
          found: !!element,
          hasContent: !!((_a = element == null ? void 0 : element.textContent) == null ? void 0 : _a.trim()),
          rect: element == null ? void 0 : element.getBoundingClientRect(),
          childCount: (_b = element == null ? void 0 : element.children) == null ? void 0 : _b.length,
          className: element == null ? void 0 : element.className,
          visible: element ? window.getComputedStyle(element).display !== "none" : false
        });
        if (element && element.textContent.trim()) {
          console.log(`UIInjector: Selected sidebar container using selector: ${selector}`);
          return element;
        }
      }
      console.log("UIInjector: No suitable sidebar container found");
      return null;
    }
    /**
     * Create LFA sidebar with businesses
     */
    createLFASidebar(businesses, userQuery) {
      var _a;
      console.log("UIInjector: Creating LFA sidebar - START", { businessCount: businesses.length, userQuery });
      const existingSidebar = document.querySelector('[data-lfa-sidebar="true"]');
      if (existingSidebar) {
        const existingQuery = existingSidebar.getAttribute("data-lfa-query");
        if (existingQuery !== userQuery) {
          console.log("UIInjector: Removing existing sidebar for different query:", existingQuery, "->", userQuery);
          this.removeLFASidebar();
        } else {
          console.log("UIInjector: Keeping existing LFA sidebar for same query");
          return;
        }
      }
      const sidebarContainer = this.findGoogleSidebarContainer();
      console.log("UIInjector: Found sidebar container:", {
        found: !!sidebarContainer,
        hasParent: !!(sidebarContainer == null ? void 0 : sidebarContainer.parentElement),
        selector: (sidebarContainer == null ? void 0 : sidebarContainer.tagName) + ((sidebarContainer == null ? void 0 : sidebarContainer.className) ? "." + sidebarContainer.className : ""),
        rect: sidebarContainer == null ? void 0 : sidebarContainer.getBoundingClientRect(),
        visible: sidebarContainer ? window.getComputedStyle(sidebarContainer).display !== "none" : false
      });
      if (!sidebarContainer || !sidebarContainer.parentElement) {
        console.error("UIInjector: Could not find sidebar container for LFA injection");
        return;
      }
      const lfaSidebar = document.createElement("div");
      lfaSidebar.className = "lfa-sidebar";
      lfaSidebar.setAttribute("data-lfa-sidebar", "true");
      lfaSidebar.setAttribute("data-lfa-query", userQuery);
      lfaSidebar.style.cssText = `
      background: white !important;
      margin: 0 !important;
      padding: 0 !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      width: 100% !important;
      box-sizing: border-box !important;
      position: relative !important;
      z-index: 1 !important;
    `;
      console.log("UIInjector: Created LFA sidebar element with styles");
      const header = document.createElement("div");
      header.style.cssText = `
      background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%) !important;
      color: white !important;
      padding: 16px !important;
      font-weight: 600 !important;
      font-size: 16px !important;
      display: block !important;
    `;
      header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 20px;">🏪</span>
        <div>
          <div>Local First Arizona Results</div>
          <div style="font-size: 12px; opacity: 0.9; margin-top: 2px;">
            ${businesses.length} local business${businesses.length !== 1 ? "es" : ""} for "${userQuery}"
          </div>
        </div>
      </div>
    `;
      lfaSidebar.appendChild(header);
      console.log("UIInjector: Added header to LFA sidebar");
      const listContainer = document.createElement("div");
      listContainer.className = "lfa-business-list";
      listContainer.style.cssText = `
      padding: 16px !important; 
      display: block !important;
      background: #f8f9fa !important;
      min-height: 200px !important;
      overflow-y: auto !important;
    `;
      console.log(`UIInjector: Creating listings for ${businesses.length} businesses`);
      businesses.forEach((business, index) => {
        const businessElement = this.createLFABusinessListing(business, index);
        listContainer.appendChild(businessElement);
        console.log(`UIInjector: Added business ${index + 1}/${businesses.length}: ${business.name || business.business_name}`);
        setTimeout(() => {
          const rect2 = businessElement.getBoundingClientRect();
          console.log(`UIInjector: Business element ${index + 1} dimensions:`, {
            width: rect2.width,
            height: rect2.height,
            visible: rect2.width > 0 && rect2.height > 0,
            display: window.getComputedStyle(businessElement).display,
            visibility: window.getComputedStyle(businessElement).visibility
          });
        }, 100);
      });
      lfaSidebar.appendChild(listContainer);
      console.log("UIInjector: Added list container to LFA sidebar");
      setTimeout(() => {
        const listRect = listContainer.getBoundingClientRect();
        console.log("UIInjector: List container final dimensions:", {
          width: listRect.width,
          height: listRect.height,
          visible: listRect.width > 0 && listRect.height > 0,
          childCount: listContainer.children.length
        });
      }, 200);
      console.log("UIInjector: Replacing Google sidebar container completely");
      console.log("UIInjector: Parent element:", sidebarContainer.parentElement);
      console.log("UIInjector: Target container:", sidebarContainer);
      const insertionPoint = this.findSidebarInsertionPoint(sidebarContainer);
      if (insertionPoint) {
        this.hideGoogleListings(sidebarContainer);
        insertionPoint.insertBefore(lfaSidebar, insertionPoint.firstChild);
        console.log("UIInjector: Inserted LFA sidebar using working chain filtering method");
      } else {
        const mainContainer = document.querySelector('[role="main"]');
        if (mainContainer) {
          mainContainer.style.position = "relative";
          mainContainer.style.height = "calc(100vh - 120px)";
          mainContainer.style.width = "400px";
          mainContainer.style.minHeight = "600px";
          mainContainer.style.minWidth = "400px";
          mainContainer.style.overflow = "hidden";
          mainContainer.insertBefore(lfaSidebar, mainContainer.firstChild);
        }
      }
      const insertedSidebar = document.querySelector('[data-lfa-sidebar="true"]');
      const rect = insertedSidebar == null ? void 0 : insertedSidebar.getBoundingClientRect();
      const computedStyle = insertedSidebar ? window.getComputedStyle(insertedSidebar) : null;
      console.log("UIInjector: LFA sidebar insertion verification:", {
        found: !!insertedSidebar,
        rect,
        computedDisplay: computedStyle == null ? void 0 : computedStyle.display,
        computedVisibility: computedStyle == null ? void 0 : computedStyle.visibility,
        computedOpacity: computedStyle == null ? void 0 : computedStyle.opacity,
        computedPosition: computedStyle == null ? void 0 : computedStyle.position,
        computedTop: computedStyle == null ? void 0 : computedStyle.top,
        computedLeft: computedStyle == null ? void 0 : computedStyle.left,
        computedRight: computedStyle == null ? void 0 : computedStyle.right,
        computedBottom: computedStyle == null ? void 0 : computedStyle.bottom,
        computedWidth: computedStyle == null ? void 0 : computedStyle.width,
        computedHeight: computedStyle == null ? void 0 : computedStyle.height,
        computedZIndex: computedStyle == null ? void 0 : computedStyle.zIndex,
        inViewport: rect ? rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth : false,
        parentRect: (_a = insertedSidebar == null ? void 0 : insertedSidebar.parentElement) == null ? void 0 : _a.getBoundingClientRect(),
        parentComputedStyle: (insertedSidebar == null ? void 0 : insertedSidebar.parentElement) ? {
          display: window.getComputedStyle(insertedSidebar.parentElement).display,
          position: window.getComputedStyle(insertedSidebar.parentElement).position,
          width: window.getComputedStyle(insertedSidebar.parentElement).width,
          height: window.getComputedStyle(insertedSidebar.parentElement).height,
          overflow: window.getComputedStyle(insertedSidebar.parentElement).overflow
        } : null
      });
      if (insertedSidebar) {
        insertedSidebar.scrollIntoView({ behavior: "smooth", block: "start" });
        console.log("UIInjector: Scrolled LFA sidebar into view");
      }
      console.log("UIInjector: Created LFA sidebar with", businesses.length, "businesses - COMPLETE");
    }
    /**
     * Create empty LFA sidebar when no businesses found
     */
    createEmptyLFASidebar(userQuery) {
      this.createLFASidebar([], userQuery);
      const lfaSidebar = document.querySelector('[data-lfa-sidebar="true"]');
      if (lfaSidebar) {
        const emptyMessage = document.createElement("div");
        emptyMessage.style.cssText = `
        padding: 32px 16px;
        text-align: center;
        color: #666;
        font-size: 14px;
      `;
        emptyMessage.innerHTML = `
        <div style="font-size: 24px; margin-bottom: 8px;">🔍</div>
        <div>No Local First Arizona businesses found for "${userQuery}"</div>
        <div style="margin-top: 8px; font-size: 12px;">
          Try a different search term or browse our directory
        </div>
      `;
        lfaSidebar.appendChild(emptyMessage);
      }
    }
    /**
     * Create individual LFA business listing
     */
    createLFABusinessListing(business, index) {
      console.log(`UIInjector: Creating business listing for:`, business);
      const element = document.createElement("div");
      element.className = "lfa-business-listing";
      element.style.cssText = `
      border-bottom: 1px solid #e8eaed !important;
      padding: 16px !important;
      cursor: pointer !important;
      display: block !important;
      background: white !important;
      margin-bottom: 8px !important;
      min-height: 60px !important;
      border-radius: 8px !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
    `;
      const businessName = business.name || business.business_name || "Local Business";
      const businessCategory = business.category || "Local Business";
      const businessAddress = business.address || business.formatted_address || "";
      const businessDescription = business.description || "";
      element.innerHTML = `
      <div style="margin-bottom: 8px !important;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
          <h3 style="margin: 0 !important; font-size: 16px !important; font-weight: 600 !important; color: #1a73e8 !important; line-height: 1.3 !important;">
            ${businessName}
          </h3>
          <span style="background: #4CAF50 !important; color: white !important; padding: 4px 8px !important; border-radius: 4px !important; font-size: 11px !important; font-weight: 600 !important; white-space: nowrap !important;">
            LFA
          </span>
        </div>
        
        <div style="color: #5f6368 !important; font-size: 14px !important; margin-bottom: 4px !important;">
          ${businessCategory}
        </div>
        
        ${businessAddress ? `<div style="color: #5f6368 !important; font-size: 14px !important; margin-bottom: 4px !important;">${businessAddress}</div>` : ""}
        
        ${businessDescription ? `<div style="color: #3c4043 !important; font-size: 14px !important; margin-bottom: 8px !important;">${businessDescription}</div>` : ""}
        
        <div style="display: flex !important; gap: 12px !important; font-size: 13px !important; color: #1a73e8 !important;">
          ${business.phone ? `<span>📞 ${business.phone}</span>` : ""}
          ${business.website ? `<span>🌐 Website</span>` : ""}
          <span style="color: #4CAF50; font-weight: 600;">LOCAL BUSINESS</span>
        </div>
      </div>
    `;
      element.addEventListener("click", () => {
        console.log("UIInjector: Business clicked:", businessName);
      });
      console.log(`UIInjector: Created business element HTML:`, element.innerHTML.substring(0, 200));
      return element;
    }
    /**
     * Remove LFA sidebar
     */
    removeLFASidebar() {
      const lfaSidebar = document.querySelector('[data-lfa-sidebar="true"]');
      if (lfaSidebar) {
        lfaSidebar.remove();
        console.log("UIInjector: Removed LFA sidebar");
      }
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
     * Removed: loadChainPatterns() - Chain patterns not needed for binary LFA/Google toggle
     */
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
      const existingLFASidebar = document.querySelector('[data-lfa-sidebar="true"]');
      if (existingLFASidebar) {
        console.log("MapsModifier: LFA sidebar active, ignoring all DOM mutations");
        return;
      }
      const hasSignificantChanges = mutations.some(
        (mutation) => mutation.addedNodes.length > 0 && Array.from(mutation.addedNodes).some(
          (node) => {
            var _a;
            return node.nodeType === Node.ELEMENT_NODE && (node.querySelector && (node.querySelector('[role="article"]') || node.querySelector(".section-result") || node.querySelector('[data-value="Directions"]'))) && // Don't trigger on our own LFA elements
            !node.closest('[data-lfa-sidebar="true"]') && !((_a = node.classList) == null ? void 0 : _a.contains("lfa-sidebar"));
          }
        )
      );
      if (hasSignificantChanges) {
        console.log("MapsModifier: Significant DOM changes detected, processing page");
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
        this.toggleLFAMode();
      });
    }
    /**
     * Toggle between LFA mode and Google mode
     */
    toggleLFAMode() {
      const wasEnabled = this.isEnabled;
      const nowEnabled = !wasEnabled;
      console.log(`MapsModifier: Switching from ${wasEnabled ? "LFA" : "Google"} mode to ${nowEnabled ? "LFA" : "Google"} mode`);
      this.isEnabled = nowEnabled;
      this.updateStatusBar();
      if (nowEnabled) {
        this.enableLFAMode();
      } else {
        this.enableGoogleMode();
      }
      this.trackEvent("mode_toggle", {
        fromMode: wasEnabled ? "lfa" : "google",
        toMode: nowEnabled ? "lfa" : "google"
      });
    }
    /**
     * Enable LFA mode - replace Google results with LFA businesses
     */
    async enableLFAMode() {
      console.log("MapsModifier: Enabling LFA mode");
      await uiInjector.replaceSidebarWithLFA();
      await this.processCurrentPageLFAMode();
      uiInjector.showFilterStatus("lfa", 0, 0);
    }
    /**
     * Enable Google mode - restore original Google content
     */
    enableGoogleMode() {
      console.log("MapsModifier: Enabling Google mode");
      uiInjector.clearAllInjectedElements();
      uiInjector.restoreGoogleSidebar();
      uiInjector.hideFilterStatus();
      if (window.LFA_mapPinManager || mapPinManager) {
        const pinManager = window.LFA_mapPinManager || mapPinManager;
        pinManager.clearAllPins();
      }
    }
    /**
     * Process page for LFA mode - get LFA businesses and show pins
     */
    async processCurrentPageLFAMode() {
      try {
        const currentLocation = businessMatcher.extractLocationFromUrl();
        const userQuery = businessMatcher.extractUserSearchQuery();
        if (!currentLocation || !userQuery) {
          console.log("MapsModifier: Missing location or query for LFA mode");
          return;
        }
        console.log(`MapsModifier: Searching LFA businesses for "${userQuery}" near ${currentLocation.lat}, ${currentLocation.lng}`);
        const lfaBusinesses = await businessMatcher.findLFABusinesses(userQuery, currentLocation);
        if (lfaBusinesses && lfaBusinesses.length > 0) {
          console.log(`MapsModifier: Found ${lfaBusinesses.length} LFA businesses`);
          window.LFA_cachedBusinesses = lfaBusinesses;
          console.log("MapsModifier: Stored LFA businesses in window.LFA_cachedBusinesses for sidebar reuse");
          try {
            const pinManager = window.LFA_mapPinManager || mapPinManager;
            console.log("MapsModifier: Showing pins using mapPinManager:", !!pinManager);
            if (pinManager) {
              if (!pinManager.isInitialized) {
                console.log("MapsModifier: Initializing MapPinManager...");
                await pinManager.init();
              }
              console.log("MapsModifier: Calling showPinsForBusinesses with", lfaBusinesses.length, "businesses");
              await pinManager.showPinsForBusinesses(lfaBusinesses);
              console.log("MapsModifier: Successfully showed pins for LFA businesses");
            } else {
              console.error("MapsModifier: MapPinManager not available");
            }
          } catch (error) {
            console.error("MapsModifier: Error showing map pins:", error);
          }
          this.stats.businessesProcessed = lfaBusinesses.length;
          this.stats.localHighlighted = lfaBusinesses.length;
          this.stats.chainsFiltered = 0;
          this.stats.lastUpdate = Date.now();
        } else {
          console.log("MapsModifier: No LFA businesses found for this search");
        }
      } catch (error) {
        console.error("MapsModifier: Error in LFA mode processing:", error);
      }
    }
    /**
     * Update the status bar text and button based on current settings
     */
    updateStatusBar() {
      const statusMessage2 = document.getElementById("lfa-status-message");
      const toggleButton2 = document.getElementById("lfa-toggle-button");
      const statusBar2 = document.getElementById("lfa-status-bar");
      if (statusMessage2 && toggleButton2 && statusBar2) {
        const isEnabled = this.isEnabled;
        statusMessage2.textContent = isEnabled ? "🏪 Showing Local First Arizona businesses" : "📍 Showing Google Maps results";
        toggleButton2.textContent = isEnabled ? "Disable" : "Enable";
        statusBar2.style.background = isEnabled ? "linear-gradient(90deg, #2E7D32, #4CAF50)" : "linear-gradient(90deg, #f8f9fa, #ffffff)";
        statusBar2.style.color = isEnabled ? "white" : "#1a73e8";
        if (isEnabled) {
          toggleButton2.style.background = "rgba(255,255,255,0.2)";
          toggleButton2.style.border = "1px solid rgba(255,255,255,0.3)";
          toggleButton2.style.color = "white";
        } else {
          toggleButton2.style.background = "linear-gradient(135deg, #2E7D32, #4CAF50)";
          toggleButton2.style.border = "1px solid #1B5E20";
          toggleButton2.style.color = "white";
        }
        console.log(`MapsModifier: Updated status bar for ${isEnabled ? "LFA" : "Google"} mode`);
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
      if (!this.isEnabled) {
        console.log("MapsModifier: Extension disabled, using Google mode");
        this.enableGoogleMode();
        return;
      }
      console.log("MapsModifier: Processing current page in LFA mode...");
      try {
        await this.enableLFAMode();
        console.log("MapsModifier: LFA mode enabled successfully");
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
     * Removed: loadNearbyBusinesses() - No longer using hardcoded business database
     * Local businesses are now dynamically fetched via API when alternatives are needed
     */
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
            businessMatcher.findLocalAlternatives(chainResult.matchedChain, currentLocation).then((alternatives) => {
              console.log("MapsModifier: Found", alternatives.length, "alternatives via API:", alternatives);
              if (alternatives.length > 0) {
                console.log("MapsModifier: Showing alternatives for", chainResult.matchedChain.name);
                uiInjector.showLocalAlternatives(business.element, chainResult.matchedChain, alternatives);
              } else {
                console.log("MapsModifier: No alternatives found via API for", chainResult.matchedChain.name);
              }
            }).catch((error) => {
              console.error("MapsModifier: Error fetching alternatives:", error);
            });
          } else {
            console.log("MapsModifier: Not showing alternatives - showAlternatives:", this.settings.showAlternatives, "currentLocation:", currentLocation);
          }
          this.trackEvent("chain_filtered", {
            businessName: business.name,
            chainName: chainResult.matchedChain.name,
            confidence: chainResult.confidence,
            filterLevel: this.settings.filterLevel
          });
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
    /**
     * Add local alternatives proactively for searches that benefit from local options
     * This runs for relevant searches regardless of chain detection to ensure local options are always shown
     */
    async addProactiveAlternatives(currentLocation, businesses, chainsFiltered) {
      try {
        const userQuery = businessMatcher.extractUserSearchQuery();
        if (!userQuery) {
          console.log("MapsModifier: No user query found, skipping proactive alternatives");
          return;
        }
        const searchTerms = userQuery.toLowerCase();
        const shouldShowAlternatives = [
          "clothing",
          "clothes",
          "apparel",
          "fashion",
          "boutique",
          "hardware",
          "tools",
          "home improvement",
          "garden center",
          "restaurant",
          "food",
          "dining",
          "cafe",
          "bar",
          "bookstore",
          "books",
          "gift shop",
          "gifts",
          "jewelry",
          "art",
          "crafts",
          "salon",
          "spa",
          "pet store",
          "pharmacy",
          "florist",
          "flowers"
        ].some((term) => searchTerms.includes(term));
        const shouldShowProactive = shouldShowAlternatives || chainsFiltered < 3;
        if (!shouldShowProactive) {
          console.log("MapsModifier: Search query does not benefit from proactive alternatives:", userQuery, "chains filtered:", chainsFiltered);
          return;
        }
        console.log("MapsModifier: Adding proactive alternatives for search:", userQuery, "chains filtered:", chainsFiltered);
        const alternatives = await businessMatcher.findLocalAlternatives(
          { name: "Generic Local Business", category: "other" },
          // Dummy chain object
          currentLocation
        );
        if (alternatives && alternatives.length > 0) {
          console.log(`MapsModifier: Found ${alternatives.length} proactive alternatives`);
          const firstBusiness = businesses.find((b) => b.element);
          if (firstBusiness) {
            uiInjector.showLocalAlternatives(
              firstBusiness.element,
              { name: "Local Alternatives", category: "local" },
              alternatives,
              true
              // isProactive flag
            );
          }
        } else {
          console.log("MapsModifier: No proactive alternatives found");
        }
      } catch (error) {
        console.error("MapsModifier: Error adding proactive alternatives:", error);
      }
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
