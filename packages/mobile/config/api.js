// Dynamic function to determine if we're in production
const getIsProduction = () => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname.includes('localfirst-mobile.pages.dev') || 
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
  
  console.log('[API] Runtime URL determination:', {
    isProduction,
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'undefined',
    baseUrl,
    timestamp: new Date().toISOString()
  });
  
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
  
  console.log('[API] Building URL:', {
    endpoint,
    baseUrl: actualBaseUrl,
    fullUrl,
    timestamp: new Date().toISOString()
  });
  
  return fullUrl;
};

// Helper function to make API requests
export const apiRequest = async (endpoint, options = {}) => {
  const { method = 'GET', ...fetchOptions } = options;
  
  const fullUrl = buildApiUrl(endpoint);
  
  console.log(`[API] Making ${method} request:`, {
    url: fullUrl,
    method,
    options: fetchOptions,
    userAgent: navigator?.userAgent || 'unknown',
    timestamp: new Date().toISOString()
  });
  
  try {
    const fetchStart = Date.now();
    
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
    
    const fetchDuration = Date.now() - fetchStart;
    
    console.log(`[API] Response received:`, {
      url: fullUrl,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      type: response.type,
      redirected: response.redirected,
      headers: Object.fromEntries(response.headers.entries()),
      duration: `${fetchDuration}ms`,
      timestamp: new Date().toISOString()
    });
    
    return response;
  } catch (error) {
    console.error(`[API] Request failed for ${fullUrl}:`, {
      error: error.message,
      name: error.name,
      stack: error.stack,
      cause: error.cause,
      timestamp: new Date().toISOString()
    });
    
    // Additional debugging for fetch failures
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error('[API] Network error details:', {
        possibleCauses: [
          'CORS policy blocking request',
          'Network connectivity issue', 
          'DNS resolution failure',
          'SSL certificate issue',
          'Invalid URL format'
        ],
        url: fullUrl,
        timestamp: new Date().toISOString()
      });
    }
    
    throw error; // Re-throw the original error
  }
};