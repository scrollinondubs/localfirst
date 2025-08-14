/**
 * Background Service Worker for Local First Arizona Extension
 * Handles data sync, analytics, settings, and extension lifecycle
 */

import { CONFIG, generateId } from '../shared/constants.js';
import { apiClient } from '../shared/api-client.js';
import { analytics } from '../shared/analytics.js';

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
    console.log('Local First Arizona Service Worker initializing...');
    
    try {
      // Set up event listeners
      this.setupEventListeners();
      
      // Initialize settings
      await this.initializeSettings();
      
      // Schedule data sync
      this.scheduleDataSync();
      
      // Check if this is a fresh install
      await this.handleInstallation();
      
      this.isInitialized = true;
      console.log('Service Worker initialized successfully');
      
    } catch (error) {
      console.error('Service Worker initialization failed:', error);
      // Don't call analytics here as it might not be initialized
    }
  }

  /**
   * Set up Chrome extension event listeners
   */
  setupEventListeners() {
    // Check if chrome.runtime is available
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      console.error('Chrome runtime API not available');
      return;
    }

    // Extension installation/startup
    if (chrome.runtime.onInstalled) {
      chrome.runtime.onInstalled.addListener((details) => {
        this.handleOnInstalled(details);
      });
    }

    // Extension startup (browser launch)
    if (chrome.runtime.onStartup) {
      chrome.runtime.onStartup.addListener(() => {
        console.log('Extension started up');
        analytics.track('startup');
      });
    }

    // Messages from content scripts
    if (chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
        return true; // Keep message channel open for async response
      });
    }

    // Storage changes (settings updates)
    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        this.handleStorageChange(changes, namespace);
      });
    }

    // Alarm events (for scheduled tasks) - Check if alarms API is available
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
    console.log('Extension installed/updated:', details);
    
    if (details.reason === 'install') {
      // Fresh installation
      this.installDate = Date.now();
      await chrome.storage.local.set({ installDate: this.installDate });
      await analytics.trackInstall();
      
      // Set up default data
      await this.performInitialDataSync();
      
    } else if (details.reason === 'update') {
      // Extension update
      const previousVersion = details.previousVersion;
      const currentVersion = chrome.runtime.getManifest().version;
      
      await analytics.track('update', {
        metadata: {
          previousVersion,
          currentVersion,
        }
      });
      
      // Perform migration if needed
      await this.handleVersionMigration(previousVersion, currentVersion);
    }
  }

  /**
   * Handle initial installation setup
   */
  async handleInstallation() {
    try {
      const result = await chrome.storage.local.get(['installDate']);
      if (!result.installDate) {
        // First time running, set install date
        this.installDate = Date.now();
        await chrome.storage.local.set({ installDate: this.installDate });
      } else {
        this.installDate = result.installDate;
      }
    } catch (error) {
      console.error('Failed to handle installation:', error);
    }
  }

  /**
   * Initialize default settings if they don't exist
   */
  async initializeSettings() {
    try {
      const result = await chrome.storage.sync.get(['settings']);
      
      if (!result.settings) {
        await chrome.storage.sync.set({
          settings: CONFIG.DEFAULT_SETTINGS
        });
        console.log('Initialized default settings');
      }
    } catch (error) {
      console.error('Failed to initialize settings:', error);
    }
  }

  /**
   * Handle messages from content scripts and popup
   */
  async handleMessage(message, sender, sendResponse) {
    try {
      const { action, data } = message;
      
      switch (action) {
        case 'getNearbyBusinesses':
          const businesses = await this.getNearbyBusinesses(data.lat, data.lng, data.radius, data.category);
          sendResponse({ success: true, data: businesses });
          break;
          
        case 'semanticSearch':
          const semanticResults = await this.getSemanticSearch(data.query, data.lat, data.lng, data.radius, data.limit);
          sendResponse({ success: true, data: semanticResults });
          break;
          
        case 'getChainPatterns':
          const chains = await this.getChainPatterns();
          sendResponse({ success: true, data: chains });
          break;
          
        case 'getSettings':
          const settings = await this.getSettings();
          sendResponse({ success: true, data: settings });
          break;
          
        case 'updateSettings':
          await this.updateSettings(data);
          sendResponse({ success: true });
          break;
          
        case 'trackEvent':
          await analytics.track(data.type, data);
          sendResponse({ success: true });
          break;
          
        case 'syncData':
          await this.syncData();
          sendResponse({ success: true });
          break;
          
        case 'getStatus':
          const status = this.getStatus();
          sendResponse({ success: true, data: status });
          break;
          
        default:
          console.warn('Unknown message action:', action);
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Get current settings
   */
  async getSettings() {
    try {
      const result = await chrome.storage.sync.get(['settings']);
      return result.settings || CONFIG.DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Failed to get settings:', error);
      return CONFIG.DEFAULT_SETTINGS;
    }
  }

  /**
   * Handle storage changes (settings updates)
   */
  async handleStorageChange(changes, namespace) {
    if (namespace === 'sync' && changes.settings) {
      const { oldValue, newValue } = changes.settings;
      
      // Track settings changes
      if (oldValue && newValue) {
        for (const [key, value] of Object.entries(newValue)) {
          if (oldValue[key] !== value) {
            await analytics.trackSettingsChange(key, oldValue[key], value);
          }
        }
      }
      
      // Notify content scripts of settings change
      this.notifyContentScripts('settingsChanged', newValue);
    }
  }

  /**
   * Handle alarm events
   */
  async handleAlarm(alarm) {
    console.log('Alarm triggered:', alarm.name);
    
    switch (alarm.name) {
      case 'syncData':
        await this.syncData();
        break;
        
      case 'flushAnalytics':
        await analytics.flush();
        break;
        
      default:
        console.warn('Unknown alarm:', alarm.name);
    }
  }

  /**
   * Get nearby businesses with caching
   */
  async getNearbyBusinesses(lat, lng, radius, category = null) {
    try {
      // Try to get from cache first (include category in cache key)
      const cacheKey = `businesses_${lat}_${lng}_${radius}_${category || 'all'}`;
      const cached = await this.getFromCache(cacheKey, 10 * 60 * 1000); // 10 minutes cache
      
      if (cached) {
        console.log(`Returning cached businesses for category: ${category || 'all'}`);
        return cached;
      }
      
      // Fetch from API
      const result = await apiClient.getNearbyBusinesses(lat, lng, radius, category);
      
      if (result.success) {
        // Cache the result
        await this.setCache(cacheKey, result);
        console.log(`Cached ${result.businesses.length} businesses for category: ${category || 'all'}`);
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Failed to get nearby businesses:', error);
      return { success: false, businesses: [], error: error.message };
    }
  }

  /**
   * Get semantic search results for businesses
   */
  async getSemanticSearch(query, lat, lng, radius = 10, limit = 8) {
    try {
      console.log(`SERVICE WORKER: Semantic search for "${query}" near ${lat},${lng}`);
      
      // Build API URL
      const apiUrl = `${CONFIG.API_BASE_URL}/api/businesses/semantic-search`;
      const params = new URLSearchParams({
        query: query,
        lat: lat.toString(),
        lng: lng.toString(),
        radius: radius.toString(),
        limit: limit.toString()
      });
      
      const url = `${apiUrl}?${params.toString()}`;
      console.log('SERVICE WORKER: Calling semantic search API:', url);
      
      // Make API request
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`SERVICE WORKER: Found ${result.businesses.length} semantic matches`);
      
      return result;
      
    } catch (error) {
      console.error('SERVICE WORKER: Failed to get semantic search results:', error);
      return { success: false, businesses: [], error: error.message };
    }
  }

  /**
   * Get chain patterns with caching
   */
  async getChainPatterns() {
    console.log('🔍 SERVICE WORKER: getChainPatterns() called');
    console.log('🔍 SERVICE WORKER: Using storage key:', CONFIG.STORAGE_KEYS.CHAINS);
    
    try {
      const result = await chrome.storage.local.get([CONFIG.STORAGE_KEYS.CHAINS]);
      const cached = result[CONFIG.STORAGE_KEYS.CHAINS];
      
      console.log('🔍 SERVICE WORKER: Cache check result:', {
        hasCached: !!cached,
        cachedTimestamp: cached?.timestamp,
        currentTime: Date.now(),
        cacheAge: cached?.timestamp ? (Date.now() - cached.timestamp) : 'N/A',
        syncInterval: CONFIG.SYNC_INTERVAL,
        isCacheValid: cached && cached.timestamp && (Date.now() - cached.timestamp) < CONFIG.SYNC_INTERVAL
      });
      
      // Check if cache is still valid (24 hours)
      if (cached && cached.timestamp && (Date.now() - cached.timestamp) < CONFIG.SYNC_INTERVAL) {
        console.log('🔍 SERVICE WORKER: Using cached chain patterns');
        console.log('🔍 SERVICE WORKER: Cached data:', {
          chainsLength: cached.chains?.length,
          hasTracer: cached.chains?.some(c => c.name.includes('TRACER')),
          firstFewChains: cached.chains?.slice(0, 3).map(c => c.name)
        });
        return { success: true, chains: cached.chains };
      }
      
      console.log('🔍 SERVICE WORKER: Cache invalid/missing, fetching fresh data from API');
      
      // Fetch fresh data
      const apiResult = await apiClient.getChainPatterns();
      
      console.log('🔍 SERVICE WORKER: API result:', {
        success: apiResult.success,
        chainsLength: apiResult.chains?.length,
        hasTracer: apiResult.chains?.some(c => c.name.includes('TRACER')),
        total: apiResult.total
      });
      
      if (apiResult.success) {
        const cacheData = {
          chains: apiResult.chains,
          timestamp: Date.now(),
          lastUpdated: apiResult.lastUpdated,
        };
        
        console.log('🔍 SERVICE WORKER: Caching result under key:', CONFIG.STORAGE_KEYS.CHAINS);
        console.log('🔍 SERVICE WORKER: Caching data:', {
          chainsLength: cacheData.chains.length,
          timestamp: cacheData.timestamp,
          hasTracer: cacheData.chains.some(c => c.name.includes('TRACER'))
        });
        
        // Cache the result
        await chrome.storage.local.set({
          [CONFIG.STORAGE_KEYS.CHAINS]: cacheData
        });
        
        console.log('🔍 SERVICE WORKER: Successfully cached and returning API result');
        return apiResult;
      } else {
        console.log('🔍 SERVICE WORKER: API failed, checking for stale cache');
        // Return cached data if API fails
        if (cached && cached.chains) {
          console.warn('🔍 SERVICE WORKER: API failed, returning stale cached chains');
          return { success: true, chains: cached.chains };
        }
        throw new Error(apiResult.error);
      }
    } catch (error) {
      console.error('🔍 SERVICE WORKER: Error in getChainPatterns:', error);
      return { success: false, chains: [], error: error.message };
    }
  }

  /**
   * Update extension settings
   */
  async updateSettings(newSettings) {
    try {
      const current = await chrome.storage.sync.get(['settings']);
      const currentSettings = current.settings || {};
      
      const updatedSettings = { ...currentSettings, ...newSettings };
      
      await chrome.storage.sync.set({
        settings: updatedSettings
      });
      
      console.log('Settings updated:', updatedSettings);
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  }

  /**
   * Perform initial data sync on installation
   */
  async performInitialDataSync() {
    console.log('Performing initial data sync...');
    
    try {
      // Sync chain patterns
      await this.getChainPatterns();
      
      // Set last sync timestamp
      await chrome.storage.local.set({
        lastSync: Date.now()
      });
      
      console.log('Initial data sync completed');
    } catch (error) {
      console.error('Initial data sync failed:', error);
    }
  }

  /**
   * Schedule automatic data sync
   */
  scheduleDataSync() {
    // Check if alarms API is available
    if (!chrome.alarms) {
      console.warn('Chrome alarms API not available');
      return;
    }

    // Clear any existing alarms
    chrome.alarms.clear('syncData');
    
    // Schedule sync every 24 hours
    chrome.alarms.create('syncData', {
      delayInMinutes: 24 * 60, // 24 hours
      periodInMinutes: 24 * 60
    });
    
    console.log('Scheduled automatic data sync every 24 hours');
  }

  /**
   * Perform data synchronization
   */
  async syncData() {
    if (this.syncInProgress) {
      console.log('Sync already in progress, skipping');
      return;
    }
    
    this.syncInProgress = true;
    console.log('Starting data sync...');
    
    try {
      // Force refresh chain patterns
      await chrome.storage.local.remove([CONFIG.STORAGE_KEYS.CHAINS]);
      await this.getChainPatterns();
      
      // Update last sync timestamp
      await chrome.storage.local.set({
        lastSync: Date.now()
      });
      
      console.log('Data sync completed');
      await analytics.track('sync_completed');
      
    } catch (error) {
      console.error('Data sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Handle version migrations
   */
  async handleVersionMigration(previousVersion, currentVersion) {
    console.log(`Migrating from ${previousVersion} to ${currentVersion}`);
    
    // Add migration logic here as needed
    // For example, clearing old cache formats, updating settings structure, etc.
    
    try {
      // Example: Clear old cache format
      if (previousVersion && previousVersion < '1.1.0') {
        await chrome.storage.local.clear();
        console.log('Cleared old cache format');
      }
      
    } catch (error) {
      console.error('Migration failed:', error);
    }
  }

  /**
   * Notify all content scripts
   */
  async notifyContentScripts(action, data) {
    try {
      const tabs = await chrome.tabs.query({ url: 'https://maps.google.com/*' });
      
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { action, data }).catch(() => {
          // Ignore errors for tabs that might not have content script loaded
        });
      }
    } catch (error) {
      console.error('Failed to notify content scripts:', error);
    }
  }

  /**
   * Cache utilities
   */
  async getFromCache(key, maxAge) {
    try {
      const result = await chrome.storage.local.get([key]);
      const cached = result[key];
      
      if (cached && cached.timestamp && (Date.now() - cached.timestamp) < maxAge) {
        return cached.data;
      }
      
      return null;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  async setCache(key, data) {
    try {
      await chrome.storage.local.set({
        [key]: {
          data,
          timestamp: Date.now(),
        }
      });
    } catch (error) {
      console.error('Cache write error:', error);
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
      analytics: analytics.getStatus(),
    };
  }
}

// Initialize the service worker
const extensionWorker = new ExtensionServiceWorker();

// Log that service worker is loaded
console.log('Local First Arizona Service Worker loaded');