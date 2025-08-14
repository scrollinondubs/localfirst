// Configuration constants for Local First Arizona Extension

export const CONFIG = {
  // API Configuration
  API_BASE_URL: (() => {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
      return 'https://api-localfirst-az.your-domain.workers.dev';
    }
    return 'http://localhost:8787';
  })(),
  
  // Extension Identity
  EXTENSION_ID: (() => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return chrome.runtime.id;
    }
    return 'local-dev-extension';
  })(),
  
  // Data Sync Configuration
  SYNC_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  
  // Analytics Configuration
  ANALYTICS: {
    ENABLED: true,
    BATCH_SIZE: 10, // Number of events to batch before sending
    FLUSH_INTERVAL: 5 * 60 * 1000, // 5 minutes
    MAX_RETRIES: 3,
  },
  
  // LFA Business Search Configuration
  SEARCH: {
    DEFAULT_RADIUS: 15, // miles for LFA business search
    MAX_RADIUS: 25, // maximum search radius
    MAX_RESULTS: 20, // maximum businesses to return in LFA mode
  },
  
  // Storage Keys
  STORAGE_KEYS: {
    CHAINS: 'lfa_chains',
    SETTINGS: 'lfa_settings',
    ANALYTICS_QUEUE: 'lfa_analytics_queue',
    LAST_SYNC: 'lfa_last_sync',
    CACHED_BUSINESSES: 'lfa_cached_businesses',
  },
  
  // Default Settings - Simplified for binary LFA/Google toggle
  DEFAULT_SETTINGS: {
    enabled: true, // LFA mode enabled by default
    anonymousAnalytics: true,
  },
  
  // Event Types for Analytics
  EVENT_TYPES: {
    INSTALL: 'install',
    VIEW: 'view',
    CLICK: 'click',
    MODE_TOGGLE: 'mode_toggle', // LFA/Google mode toggle
    SETTINGS_CHANGE: 'settings_change',
    ERROR: 'error',
  },
  
  // Business Categories
  CATEGORIES: [
    'restaurant',
    'retail',
    'professional_services',
    'health_wellness',
    'home_garden',
    'arts_entertainment',
    'automotive',
    'financial',
    'other',
  ],
};

// Utility function to get environment-specific config
export function getConfig(key) {
  return CONFIG[key];
}

// Utility function to check if we're in development
export function isDevelopment() {
  return CONFIG.API_BASE_URL.includes('localhost');
}

// Utility function to generate unique ID
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}