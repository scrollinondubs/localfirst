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
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
  class ApiClient {
    constructor() {
      this.baseUrl = CONFIG.API_BASE_URL;
      this.retryAttempts = CONFIG.ANALYTICS.MAX_RETRIES;
    }
    /**
     * Make a fetch request with error handling and retries
     */
    async request(url, options = {}, retries = this.retryAttempts) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            ...options.headers
          }
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        console.error(`API request failed: ${url}`, error);
        if (retries > 0 && this.isRetryableError(error)) {
          console.log(`Retrying request... ${retries} attempts left`);
          await this.delay(1e3 * (this.retryAttempts - retries + 1));
          return this.request(url, options, retries - 1);
        }
        throw error;
      }
    }
    /**
     * Check if an error is retryable
     */
    isRetryableError(error) {
      return error.message.includes("NetworkError") || error.message.includes("fetch") || error.message.includes("HTTP 5");
    }
    /**
     * Simple delay utility
     */
    delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    /**
     * Get nearby LFA businesses
     */
    async getNearbyBusinesses(lat, lng, radius = CONFIG.FILTERING.DEFAULT_RADIUS, category = null) {
      let url = `${this.baseUrl}/api/businesses/nearby?lat=${lat}&lng=${lng}&radius=${radius}`;
      if (category && category !== "other") {
        url += `&category=${encodeURIComponent(category)}`;
      }
      try {
        const data = await this.request(url);
        return {
          success: true,
          businesses: data.businesses || [],
          total: data.total || 0,
          center: data.center,
          radius: data.radius,
          category
        };
      } catch (error) {
        console.error("Failed to fetch nearby businesses:", error);
        return {
          success: false,
          businesses: [],
          total: 0,
          error: error.message
        };
      }
    }
    /**
     * Get chain business patterns for filtering
     */
    async getChainPatterns() {
      var _a, _b, _c;
      const url = `${this.baseUrl}/api/chains`;
      console.log("🔍 API CLIENT: Making request to:", url);
      try {
        const data = await this.request(url);
        console.log("🔍 API CLIENT: Raw response data:", {
          total: data.total,
          chainsLength: (_a = data.chains) == null ? void 0 : _a.length,
          hasTracer: (_b = data.chains) == null ? void 0 : _b.some((c) => c.name.includes("TRACER")),
          firstFewChains: (_c = data.chains) == null ? void 0 : _c.slice(0, 3).map((c) => c.name)
        });
        const result = {
          success: true,
          chains: data.chains || [],
          lastUpdated: data.lastUpdated,
          total: data.total || 0
        };
        console.log("🔍 API CLIENT: Returning result:", {
          success: result.success,
          chainsLength: result.chains.length,
          total: result.total,
          hasTracer: result.chains.some((c) => c.name.includes("TRACER"))
        });
        return result;
      } catch (error) {
        console.error("🔍 API CLIENT: Request failed:", error);
        return {
          success: false,
          chains: [],
          error: error.message
        };
      }
    }
    /**
     * Send analytics events to the API
     */
    async sendAnalyticsEvents(events) {
      if (!events || events.length === 0) {
        return { success: true, processed: 0 };
      }
      const url = `${this.baseUrl}/api/analytics/events`;
      const payload = {
        extension_id: CONFIG.EXTENSION_ID,
        events: events.map((event) => ({
          type: event.type,
          business_id: event.businessId || null,
          metadata: event.metadata || {},
          timestamp: event.timestamp || (/* @__PURE__ */ new Date()).toISOString()
        }))
      };
      try {
        const data = await this.request(url, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        return {
          success: true,
          processed: data.processed || events.length
        };
      } catch (error) {
        console.error("Failed to send analytics events:", error);
        return {
          success: false,
          processed: 0,
          error: error.message
        };
      }
    }
    /**
     * Check API health
     */
    async checkHealth() {
      const url = `${this.baseUrl}/`;
      try {
        const data = await this.request(url);
        return {
          success: true,
          status: data.status,
          version: data.version
        };
      } catch (error) {
        console.error("API health check failed:", error);
        return {
          success: false,
          error: error.message
        };
      }
    }
  }
  const apiClient = new ApiClient();
  class Analytics {
    constructor() {
      this.queue = [];
      this.sessionId = generateId();
      this.isFlushingScheduled = false;
      this.isEnabled = CONFIG.ANALYTICS.ENABLED;
      this.initializeFromStorage();
      this.schedulePeriodicFlush();
    }
    /**
     * Initialize analytics queue from Chrome storage
     */
    async initializeFromStorage() {
      try {
        const result = await chrome.storage.local.get([CONFIG.STORAGE_KEYS.ANALYTICS_QUEUE]);
        const storedQueue = result[CONFIG.STORAGE_KEYS.ANALYTICS_QUEUE];
        if (storedQueue && Array.isArray(storedQueue)) {
          this.queue = storedQueue;
          console.log(`Loaded ${this.queue.length} analytics events from storage`);
        }
      } catch (error) {
        console.error("Failed to initialize analytics from storage:", error);
      }
    }
    /**
     * Save current queue to Chrome storage
     */
    async saveQueueToStorage() {
      try {
        await chrome.storage.local.set({
          [CONFIG.STORAGE_KEYS.ANALYTICS_QUEUE]: this.queue
        });
      } catch (error) {
        console.error("Failed to save analytics queue to storage:", error);
      }
    }
    /**
     * Track an analytics event
     */
    async track(eventType, data = {}) {
      if (!this.isEnabled) {
        return;
      }
      const event = {
        id: generateId(),
        type: eventType,
        businessId: data.businessId || null,
        metadata: {
          sessionId: this.sessionId,
          url: data.url || (typeof window !== "undefined" ? window.location.href : null),
          timestamp: Date.now(),
          ...data.metadata
        },
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        retryCount: 0
      };
      this.queue.push(event);
      console.log(`Analytics: Tracked ${eventType}`, event);
      await this.saveQueueToStorage();
      if (this.queue.length >= CONFIG.ANALYTICS.BATCH_SIZE) {
        this.flush();
      } else if (!this.isFlushingScheduled) {
        this.scheduleFlush();
      }
    }
    /**
     * Track extension installation
     */
    async trackInstall() {
      await this.track(CONFIG.EVENT_TYPES.INSTALL, {
        metadata: {
          version: chrome.runtime.getManifest().version,
          installTime: Date.now()
        }
      });
    }
    /**
     * Track business view
     */
    async trackBusinessView(businessId, businessName, source = "maps") {
      await this.track(CONFIG.EVENT_TYPES.VIEW, {
        businessId,
        metadata: {
          businessName,
          source
        }
      });
    }
    /**
     * Track business click
     */
    async trackBusinessClick(businessId, businessName, clickType = "badge") {
      await this.track(CONFIG.EVENT_TYPES.CLICK, {
        businessId,
        metadata: {
          businessName,
          clickType
          // badge, website, phone, etc.
        }
      });
    }
    /**
     * Track filter toggle
     */
    async trackFilterToggle(enabled, filterLevel) {
      await this.track(CONFIG.EVENT_TYPES.FILTER_TOGGLE, {
        metadata: {
          enabled,
          filterLevel
        }
      });
    }
    /**
     * Track settings change
     */
    async trackSettingsChange(setting, oldValue, newValue) {
      await this.track(CONFIG.EVENT_TYPES.SETTINGS_CHANGE, {
        metadata: {
          setting,
          oldValue,
          newValue
        }
      });
    }
    /**
     * Track error
     */
    async trackError(error, context = "unknown") {
      await this.track(CONFIG.EVENT_TYPES.ERROR, {
        metadata: {
          error: error.message || error,
          stack: error.stack,
          context
        }
      });
    }
    /**
     * Schedule a flush after a delay
     */
    scheduleFlush() {
      if (this.isFlushingScheduled) {
        return;
      }
      this.isFlushingScheduled = true;
      setTimeout(() => {
        this.flush();
      }, CONFIG.ANALYTICS.FLUSH_INTERVAL);
    }
    /**
     * Set up periodic flush every hour
     */
    schedulePeriodicFlush() {
      setInterval(() => {
        if (this.queue.length > 0) {
          this.flush();
        }
      }, 60 * 60 * 1e3);
    }
    /**
     * Flush queued events to API
     */
    async flush() {
      this.isFlushingScheduled = false;
      if (this.queue.length === 0) {
        return;
      }
      console.log(`Analytics: Flushing ${this.queue.length} events`);
      const eventsToSend = [...this.queue];
      try {
        const result = await apiClient.sendAnalyticsEvents(eventsToSend);
        if (result.success) {
          this.queue = this.queue.filter(
            (event) => !eventsToSend.find((sent) => sent.id === event.id)
          );
          console.log(`Analytics: Successfully sent ${result.processed} events`);
        } else {
          eventsToSend.forEach((event) => {
            event.retryCount = (event.retryCount || 0) + 1;
            if (event.retryCount >= CONFIG.ANALYTICS.MAX_RETRIES) {
              this.queue = this.queue.filter((q) => q.id !== event.id);
              console.warn(`Analytics: Dropping event after ${CONFIG.ANALYTICS.MAX_RETRIES} retries`, event);
            }
          });
          console.error("Analytics: Failed to send events, will retry later");
        }
      } catch (error) {
        console.error("Analytics: Error during flush:", error);
        await this.trackError(error, "analytics_flush");
      }
      await this.saveQueueToStorage();
    }
    /**
     * Clear all analytics data (for privacy/reset)
     */
    async clear() {
      this.queue = [];
      await chrome.storage.local.remove([CONFIG.STORAGE_KEYS.ANALYTICS_QUEUE]);
      console.log("Analytics: Cleared all data");
    }
    /**
     * Enable/disable analytics
     */
    async setEnabled(enabled) {
      this.isEnabled = enabled;
      if (!enabled) {
        await this.clear();
      }
      console.log(`Analytics: ${enabled ? "Enabled" : "Disabled"}`);
    }
    /**
     * Get analytics summary for debugging
     */
    getStatus() {
      return {
        enabled: this.isEnabled,
        queueLength: this.queue.length,
        sessionId: this.sessionId,
        isFlushingScheduled: this.isFlushingScheduled
      };
    }
  }
  const analytics = new Analytics();
  class ExtensionServiceWorker {
    constructor() {
      this.isInitialized = false;
      this.syncInProgress = false;
      this.installDate = null;
      this.init();
    }
    /**
     * Initialize the service worker
     */
    async init() {
      console.log("Local First Arizona Service Worker initializing...");
      try {
        this.setupEventListeners();
        await this.initializeSettings();
        this.scheduleDataSync();
        await this.handleInstallation();
        this.isInitialized = true;
        console.log("Service Worker initialized successfully");
      } catch (error) {
        console.error("Service Worker initialization failed:", error);
      }
    }
    /**
     * Set up Chrome extension event listeners
     */
    setupEventListeners() {
      if (typeof chrome === "undefined" || !chrome.runtime) {
        console.error("Chrome runtime API not available");
        return;
      }
      if (chrome.runtime.onInstalled) {
        chrome.runtime.onInstalled.addListener((details) => {
          this.handleOnInstalled(details);
        });
      }
      if (chrome.runtime.onStartup) {
        chrome.runtime.onStartup.addListener(() => {
          console.log("Extension started up");
          analytics.track("startup");
        });
      }
      if (chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          this.handleMessage(message, sender, sendResponse);
          return true;
        });
      }
      if (chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, namespace) => {
          this.handleStorageChange(changes, namespace);
        });
      }
      if (chrome.alarms && chrome.alarms.onAlarm) {
        chrome.alarms.onAlarm.addListener((alarm) => {
          this.handleAlarm(alarm);
        });
      }
    }
    /**
     * Handle extension installation/update
     */
    async handleOnInstalled(details) {
      console.log("Extension installed/updated:", details);
      if (details.reason === "install") {
        this.installDate = Date.now();
        await chrome.storage.local.set({ installDate: this.installDate });
        await analytics.trackInstall();
        await this.performInitialDataSync();
      } else if (details.reason === "update") {
        const previousVersion = details.previousVersion;
        const currentVersion = chrome.runtime.getManifest().version;
        await analytics.track("update", {
          metadata: {
            previousVersion,
            currentVersion
          }
        });
        await this.handleVersionMigration(previousVersion, currentVersion);
      }
    }
    /**
     * Handle initial installation setup
     */
    async handleInstallation() {
      try {
        const result = await chrome.storage.local.get(["installDate"]);
        if (!result.installDate) {
          this.installDate = Date.now();
          await chrome.storage.local.set({ installDate: this.installDate });
        } else {
          this.installDate = result.installDate;
        }
      } catch (error) {
        console.error("Failed to handle installation:", error);
      }
    }
    /**
     * Initialize default settings if they don't exist
     */
    async initializeSettings() {
      try {
        const result = await chrome.storage.sync.get(["settings"]);
        if (!result.settings) {
          await chrome.storage.sync.set({
            settings: CONFIG.DEFAULT_SETTINGS
          });
          console.log("Initialized default settings");
        }
      } catch (error) {
        console.error("Failed to initialize settings:", error);
      }
    }
    /**
     * Handle messages from content scripts and popup
     */
    async handleMessage(message, sender, sendResponse) {
      try {
        const { action, data } = message;
        switch (action) {
          case "getNearbyBusinesses":
            const businesses = await this.getNearbyBusinesses(data.lat, data.lng, data.radius, data.category);
            sendResponse({ success: true, data: businesses });
            break;
          case "semanticSearch":
            const semanticResults = await this.getSemanticSearch(data.query, data.lat, data.lng, data.radius, data.limit);
            sendResponse({ success: true, data: semanticResults });
            break;
          case "getChainPatterns":
            const chains = await this.getChainPatterns();
            sendResponse({ success: true, data: chains });
            break;
          case "getSettings":
            const settings = await this.getSettings();
            sendResponse({ success: true, data: settings });
            break;
          case "updateSettings":
            await this.updateSettings(data);
            sendResponse({ success: true });
            break;
          case "trackEvent":
            await analytics.track(data.type, data);
            sendResponse({ success: true });
            break;
          case "syncData":
            await this.syncData();
            sendResponse({ success: true });
            break;
          case "getStatus":
            const status = this.getStatus();
            sendResponse({ success: true, data: status });
            break;
          default:
            console.warn("Unknown message action:", action);
            sendResponse({ success: false, error: "Unknown action" });
        }
      } catch (error) {
        console.error("Error handling message:", error);
        sendResponse({ success: false, error: error.message });
      }
    }
    /**
     * Get current settings
     */
    async getSettings() {
      try {
        const result = await chrome.storage.sync.get(["settings"]);
        return result.settings || CONFIG.DEFAULT_SETTINGS;
      } catch (error) {
        console.error("Failed to get settings:", error);
        return CONFIG.DEFAULT_SETTINGS;
      }
    }
    /**
     * Handle storage changes (settings updates)
     */
    async handleStorageChange(changes, namespace) {
      if (namespace === "sync" && changes.settings) {
        const { oldValue, newValue } = changes.settings;
        if (oldValue && newValue) {
          for (const [key, value] of Object.entries(newValue)) {
            if (oldValue[key] !== value) {
              await analytics.trackSettingsChange(key, oldValue[key], value);
            }
          }
        }
        this.notifyContentScripts("settingsChanged", newValue);
      }
    }
    /**
     * Handle alarm events
     */
    async handleAlarm(alarm) {
      console.log("Alarm triggered:", alarm.name);
      switch (alarm.name) {
        case "syncData":
          await this.syncData();
          break;
        case "flushAnalytics":
          await analytics.flush();
          break;
        default:
          console.warn("Unknown alarm:", alarm.name);
      }
    }
    /**
     * Get nearby businesses with caching
     */
    async getNearbyBusinesses(lat, lng, radius, category = null) {
      try {
        const cacheKey = `businesses_${lat}_${lng}_${radius}_${category || "all"}`;
        const cached = await this.getFromCache(cacheKey, 10 * 60 * 1e3);
        if (cached) {
          console.log(`Returning cached businesses for category: ${category || "all"}`);
          return cached;
        }
        const result = await apiClient.getNearbyBusinesses(lat, lng, radius, category);
        if (result.success) {
          await this.setCache(cacheKey, result);
          console.log(`Cached ${result.businesses.length} businesses for category: ${category || "all"}`);
          return result;
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error("Failed to get nearby businesses:", error);
        return { success: false, businesses: [], error: error.message };
      }
    }
    /**
     * Get semantic search results for businesses
     */
    async getSemanticSearch(query, lat, lng, radius = 10, limit = 8) {
      try {
        console.log(`SERVICE WORKER: Semantic search for "${query}" near ${lat},${lng}`);
        const apiUrl = `${CONFIG.API_BASE_URL}/api/businesses/semantic-search`;
        const params = new URLSearchParams({
          query,
          lat: lat.toString(),
          lng: lng.toString(),
          radius: radius.toString(),
          limit: limit.toString()
        });
        const url = `${apiUrl}?${params.toString()}`;
        console.log("SERVICE WORKER: Calling semantic search API:", url);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        const result = await response.json();
        console.log(`SERVICE WORKER: Found ${result.businesses.length} semantic matches`);
        return result;
      } catch (error) {
        console.error("SERVICE WORKER: Failed to get semantic search results:", error);
        return { success: false, businesses: [], error: error.message };
      }
    }
    /**
     * Get chain patterns with caching
     */
    async getChainPatterns() {
      var _a, _b, _c, _d, _e;
      console.log("🔍 SERVICE WORKER: getChainPatterns() called");
      console.log("🔍 SERVICE WORKER: Using storage key:", CONFIG.STORAGE_KEYS.CHAINS);
      try {
        const result = await chrome.storage.local.get([CONFIG.STORAGE_KEYS.CHAINS]);
        const cached = result[CONFIG.STORAGE_KEYS.CHAINS];
        console.log("🔍 SERVICE WORKER: Cache check result:", {
          hasCached: !!cached,
          cachedTimestamp: cached == null ? void 0 : cached.timestamp,
          currentTime: Date.now(),
          cacheAge: (cached == null ? void 0 : cached.timestamp) ? Date.now() - cached.timestamp : "N/A",
          syncInterval: CONFIG.SYNC_INTERVAL,
          isCacheValid: cached && cached.timestamp && Date.now() - cached.timestamp < CONFIG.SYNC_INTERVAL
        });
        if (cached && cached.timestamp && Date.now() - cached.timestamp < CONFIG.SYNC_INTERVAL) {
          console.log("🔍 SERVICE WORKER: Using cached chain patterns");
          console.log("🔍 SERVICE WORKER: Cached data:", {
            chainsLength: (_a = cached.chains) == null ? void 0 : _a.length,
            hasTracer: (_b = cached.chains) == null ? void 0 : _b.some((c) => c.name.includes("TRACER")),
            firstFewChains: (_c = cached.chains) == null ? void 0 : _c.slice(0, 3).map((c) => c.name)
          });
          return { success: true, chains: cached.chains };
        }
        console.log("🔍 SERVICE WORKER: Cache invalid/missing, fetching fresh data from API");
        const apiResult = await apiClient.getChainPatterns();
        console.log("🔍 SERVICE WORKER: API result:", {
          success: apiResult.success,
          chainsLength: (_d = apiResult.chains) == null ? void 0 : _d.length,
          hasTracer: (_e = apiResult.chains) == null ? void 0 : _e.some((c) => c.name.includes("TRACER")),
          total: apiResult.total
        });
        if (apiResult.success) {
          const cacheData = {
            chains: apiResult.chains,
            timestamp: Date.now(),
            lastUpdated: apiResult.lastUpdated
          };
          console.log("🔍 SERVICE WORKER: Caching result under key:", CONFIG.STORAGE_KEYS.CHAINS);
          console.log("🔍 SERVICE WORKER: Caching data:", {
            chainsLength: cacheData.chains.length,
            timestamp: cacheData.timestamp,
            hasTracer: cacheData.chains.some((c) => c.name.includes("TRACER"))
          });
          await chrome.storage.local.set({
            [CONFIG.STORAGE_KEYS.CHAINS]: cacheData
          });
          console.log("🔍 SERVICE WORKER: Successfully cached and returning API result");
          return apiResult;
        } else {
          console.log("🔍 SERVICE WORKER: API failed, checking for stale cache");
          if (cached && cached.chains) {
            console.warn("🔍 SERVICE WORKER: API failed, returning stale cached chains");
            return { success: true, chains: cached.chains };
          }
          throw new Error(apiResult.error);
        }
      } catch (error) {
        console.error("🔍 SERVICE WORKER: Error in getChainPatterns:", error);
        return { success: false, chains: [], error: error.message };
      }
    }
    /**
     * Update extension settings
     */
    async updateSettings(newSettings) {
      try {
        const current = await chrome.storage.sync.get(["settings"]);
        const currentSettings = current.settings || {};
        const updatedSettings = { ...currentSettings, ...newSettings };
        await chrome.storage.sync.set({
          settings: updatedSettings
        });
        console.log("Settings updated:", updatedSettings);
      } catch (error) {
        console.error("Failed to update settings:", error);
        throw error;
      }
    }
    /**
     * Perform initial data sync on installation
     */
    async performInitialDataSync() {
      console.log("Performing initial data sync...");
      try {
        await this.getChainPatterns();
        await chrome.storage.local.set({
          lastSync: Date.now()
        });
        console.log("Initial data sync completed");
      } catch (error) {
        console.error("Initial data sync failed:", error);
      }
    }
    /**
     * Schedule automatic data sync
     */
    scheduleDataSync() {
      if (!chrome.alarms) {
        console.warn("Chrome alarms API not available");
        return;
      }
      chrome.alarms.clear("syncData");
      chrome.alarms.create("syncData", {
        delayInMinutes: 24 * 60,
        // 24 hours
        periodInMinutes: 24 * 60
      });
      console.log("Scheduled automatic data sync every 24 hours");
    }
    /**
     * Perform data synchronization
     */
    async syncData() {
      if (this.syncInProgress) {
        console.log("Sync already in progress, skipping");
        return;
      }
      this.syncInProgress = true;
      console.log("Starting data sync...");
      try {
        await chrome.storage.local.remove([CONFIG.STORAGE_KEYS.CHAINS]);
        await this.getChainPatterns();
        await chrome.storage.local.set({
          lastSync: Date.now()
        });
        console.log("Data sync completed");
        await analytics.track("sync_completed");
      } catch (error) {
        console.error("Data sync failed:", error);
      } finally {
        this.syncInProgress = false;
      }
    }
    /**
     * Handle version migrations
     */
    async handleVersionMigration(previousVersion, currentVersion) {
      console.log(`Migrating from ${previousVersion} to ${currentVersion}`);
      try {
        if (previousVersion && previousVersion < "1.1.0") {
          await chrome.storage.local.clear();
          console.log("Cleared old cache format");
        }
      } catch (error) {
        console.error("Migration failed:", error);
      }
    }
    /**
     * Notify all content scripts
     */
    async notifyContentScripts(action, data) {
      try {
        const tabs = await chrome.tabs.query({ url: "https://maps.google.com/*" });
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, { action, data }).catch(() => {
          });
        }
      } catch (error) {
        console.error("Failed to notify content scripts:", error);
      }
    }
    /**
     * Cache utilities
     */
    async getFromCache(key, maxAge) {
      try {
        const result = await chrome.storage.local.get([key]);
        const cached = result[key];
        if (cached && cached.timestamp && Date.now() - cached.timestamp < maxAge) {
          return cached.data;
        }
        return null;
      } catch (error) {
        console.error("Cache read error:", error);
        return null;
      }
    }
    async setCache(key, data) {
      try {
        await chrome.storage.local.set({
          [key]: {
            data,
            timestamp: Date.now()
          }
        });
      } catch (error) {
        console.error("Cache write error:", error);
      }
    }
    /**
     * Get service worker status
     */
    getStatus() {
      return {
        initialized: this.isInitialized,
        syncInProgress: this.syncInProgress,
        installDate: this.installDate,
        version: chrome.runtime.getManifest().version,
        analytics: analytics.getStatus()
      };
    }
  }
  new ExtensionServiceWorker();
  console.log("Local First Arizona Service Worker loaded");
})();
