// API configuration for mobile app
export const API_CONFIG = {
  // Use environment variable or fallback based on NODE_ENV
  BASE_URL: process.env.REACT_APP_API_URL || 
    (process.env.NODE_ENV === 'production' 
      ? 'https://localfirst-api-production.localfirst.workers.dev'
      : 'http://localhost:8787'),
  
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

// Helper function to make API requests
export const apiRequest = async (endpoint, options = {}) => {
  const { method = 'GET', ...fetchOptions } = options;
  
  try {
    const response = await fetch(buildApiUrl(endpoint), {
      method,
      ...fetchOptions,
    });
    
    return response;
  } catch (error) {
    console.error('API request failed:', error);
    throw new Error('API unavailable - please check your internet connection');
  }
};