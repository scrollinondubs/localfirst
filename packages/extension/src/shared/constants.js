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
  
  // Business Filtering Configuration
  FILTERING: {
    DEFAULT_RADIUS: 5, // miles
    MAX_RADIUS: 25, // maximum search radius
    MAX_RESULTS: 100, // maximum businesses to return
    CONFIDENCE_THRESHOLD: 80, // minimum confidence for chain matching
  },
  
  // Storage Keys
  STORAGE_KEYS: {
    CHAINS: 'lfa_chains',
    SETTINGS: 'lfa_settings',
    ANALYTICS_QUEUE: 'lfa_analytics_queue',
    LAST_SYNC: 'lfa_last_sync',
    CACHED_BUSINESSES: 'lfa_cached_businesses',
  },
  
  // Default Settings
  DEFAULT_SETTINGS: {
    enabled: true,
    filterLevel: 'moderate', // strict, moderate, light
    showBadges: true,
    showAlternatives: true,
    anonymousAnalytics: true,
  },
  
  // Filter Levels
  FILTER_LEVELS: {
    strict: {
      hideChains: true,
      dimChains: false,
      showAlternatives: true,
      confidenceThreshold: 70,
    },
    moderate: {
      hideChains: false,
      dimChains: true,
      showAlternatives: true,
      confidenceThreshold: 80,
    },
    light: {
      hideChains: false,
      dimChains: true,
      showAlternatives: false,
      confidenceThreshold: 90,
    },
  },
  
  // Event Types for Analytics
  EVENT_TYPES: {
    INSTALL: 'install',
    VIEW: 'view',
    CLICK: 'click',
    FILTER_TOGGLE: 'filter_toggle',
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