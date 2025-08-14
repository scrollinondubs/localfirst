import { CONFIG, generateId } from './constants.js';

/**
 * API Client for Local First Arizona Extension
 * Handles all communication with the backend API
 */
export class ApiClient {
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
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${url}`, error);
      
      if (retries > 0 && this.isRetryableError(error)) {
        console.log(`Retrying request... ${retries} attempts left`);
        await this.delay(1000 * (this.retryAttempts - retries + 1)); // Exponential backoff
        return this.request(url, options, retries - 1);
      }
      
      throw error;
    }
  }

  /**
   * Check if an error is retryable
   */
  isRetryableError(error) {
    // Retry on network errors or 5xx server errors
    return error.message.includes('NetworkError') || 
           error.message.includes('fetch') ||
           (error.message.includes('HTTP 5'));
  }

  /**
   * Simple delay utility
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get nearby LFA businesses
   */
  async getNearbyBusinesses(lat, lng, radius = CONFIG.FILTERING.DEFAULT_RADIUS, category = null) {
    let url = `${this.baseUrl}/api/businesses/nearby?lat=${lat}&lng=${lng}&radius=${radius}`;
    
    // Add category filter if specified
    if (category && category !== 'other') {
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
        category: category,
      };
    } catch (error) {
      console.error('Failed to fetch nearby businesses:', error);
      return {
        success: false,
        businesses: [],
        total: 0,
        error: error.message,
      };
    }
  }

  /**
   * Get chain business patterns for filtering
   */
  async getChainPatterns() {
    const url = `${this.baseUrl}/api/chains`;
    
    console.log('🔍 API CLIENT: Making request to:', url);
    
    try {
      const data = await this.request(url);
      console.log('🔍 API CLIENT: Raw response data:', {
        total: data.total,
        chainsLength: data.chains?.length,
        hasTracer: data.chains?.some(c => c.name.includes('TRACER')),
        firstFewChains: data.chains?.slice(0, 3).map(c => c.name)
      });
      
      const result = {
        success: true,
        chains: data.chains || [],
        lastUpdated: data.lastUpdated,
        total: data.total || 0,
      };
      
      console.log('🔍 API CLIENT: Returning result:', {
        success: result.success,
        chainsLength: result.chains.length,
        total: result.total,
        hasTracer: result.chains.some(c => c.name.includes('TRACER'))
      });
      
      return result;
    } catch (error) {
      console.error('🔍 API CLIENT: Request failed:', error);
      return {
        success: false,
        chains: [],
        error: error.message,
      };
    }
  }

  /**
   * Send analytics events to the API
   */
  async sendAnalyticsEvents(events) {
    if (!CONFIG.ANALYTICS.ENABLED || !events || events.length === 0) {
      return { success: true, processed: 0 };
    }

    const url = `${this.baseUrl}/api/analytics/events`;
    const payload = {
      extension_id: CONFIG.EXTENSION_ID,
      events: events.map(event => ({
        type: event.type,
        business_id: event.businessId || null,
        metadata: event.metadata || {},
        timestamp: event.timestamp || new Date().toISOString(),
      })),
    };

    try {
      const data = await this.request(url, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      
      return {
        success: true,
        processed: data.processed || events.length,
      };
    } catch (error) {
      console.error('Failed to send analytics events:', error);
      return {
        success: false,
        processed: 0,
        error: error.message,
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
        version: data.version,
      };
    } catch (error) {
      console.error('API health check failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Create singleton instance
export const apiClient = new ApiClient();