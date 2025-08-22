// API configuration for mobile app
export const API_CONFIG = {
  // Use the shared API server (extension's Hono API)
  BASE_URL: process.env.NODE_ENV === 'production' 
    ? 'https://your-production-api.com' 
    : 'http://localhost:8787', // Default Hono dev server port
  
  // Fallback to mobile dev server if shared API not available
  FALLBACK_URL: 'http://localhost:3001',
  
  ENDPOINTS: {
    BUSINESSES_SEARCH: '/api/businesses/semantic-search',
    BUSINESSES_NEARBY: '/api/businesses/nearby',
    AUTH_LOGIN: '/api/auth/login',
    AUTH_REGISTER: '/api/auth/register'
  }
};

// Helper function to build full API URL
export const buildApiUrl = (endpoint, baseUrl = API_CONFIG.BASE_URL) => {
  return `${baseUrl}${endpoint}`;
};

// Helper function to make API requests with fallback
export const apiRequest = async (endpoint, options = {}) => {
  const { method = 'GET', ...fetchOptions } = options;
  
  // Try main API first
  try {
    const response = await fetch(buildApiUrl(endpoint), {
      method,
      ...fetchOptions,
    });
    
    if (response.ok) {
      return response;
    }
    
    // If response not ok, try fallback
    throw new Error(`API request failed with status ${response.status}`);
    
  } catch (error) {
    console.log(`Main API failed (${API_CONFIG.BASE_URL}), trying fallback...`);
    
    // Try fallback API
    try {
      const response = await fetch(buildApiUrl(endpoint, API_CONFIG.FALLBACK_URL), {
        method,
        ...fetchOptions,
      });
      
      return response;
    } catch (fallbackError) {
      console.error('Both APIs failed:', { main: error.message, fallback: fallbackError.message });
      throw new Error('API unavailable');
    }
  }
};