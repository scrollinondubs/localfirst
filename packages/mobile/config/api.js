// Dynamic function to determine if we're in production
const getIsProduction = () => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname.includes('localfirst-mobile.pages.dev') || 
         hostname === 'mobile.localfirst.site' ||
         hostname === 'localfirst.dev' ||
         hostname === 'app.localfirst.dev' ||
         (hostname !== 'localhost' && hostname !== '127.0.0.1');
};

// Dynamic function to get the correct base URL
export const getBaseUrl = () => {
  const isProduction = getIsProduction();
  const baseUrl = isProduction 
    ? 'https://localfirst-api-production.localfirst.workers.dev'
    : (process.env.REACT_APP_API_URL || 'http://localhost:8787');
  
  return baseUrl;
};

// API configuration for mobile app
export const API_CONFIG = {
  ENDPOINTS: {
    BUSINESSES_SEARCH: '/api/enhanced-search',
    BUSINESSES_CATEGORIES: '/api/enhanced-search/categories',
    BUSINESSES_SEARCH_LEGACY: '/api/businesses/semantic-search', // Keep legacy for fallback
    BUSINESSES_NEARBY: '/api/businesses/nearby',
    AUTH_LOGIN: '/api/auth/login',
    AUTH_REGISTER: '/api/auth/register',
    FAVORITES_LIST: '/api/favorites',
    FAVORITES_ADD: '/api/favorites',
    FAVORITES_REMOVE: '/api/favorites',
    FAVORITES_STATUS: '/api/favorites/status'
  }
};

// Legacy BASE_URL getter for backward compatibility
Object.defineProperty(API_CONFIG, 'BASE_URL', {
  get: getBaseUrl
});

// Helper function to build full API URL
export const buildApiUrl = (endpoint, baseUrl = null) => {
  const actualBaseUrl = baseUrl || getBaseUrl();
  const fullUrl = `${actualBaseUrl}${endpoint}`;
  
  return fullUrl;
};

// Helper function to make API requests
export const apiRequest = async (endpoint, options = {}) => {
  const { method = 'GET', ...fetchOptions } = options;
  
  const fullUrl = buildApiUrl(endpoint);
  
  try {
    const response = await fetch(fullUrl, {
      method,
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers
      },
      ...fetchOptions,
    });
    
    return response;
  } catch (error) {
    throw error; // Re-throw the original error
  }
};