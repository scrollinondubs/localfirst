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
  async getNearbyBusinesses(lat, lng, radius = CONFIG.FILTERING.DEFAULT_RADIUS) {
    const url = `${this.baseUrl}/api/businesses/nearby?lat=${lat}&lng=${lng}&radius=${radius}`;
    
    try {
      const data = await this.request(url);
      return {
        success: true,
        businesses: data.businesses || [],
        total: data.total || 0,
        center: data.center,
        radius: data.radius,
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
    
    try {
      const data = await this.request(url);
      return {
        success: true,
        chains: data.chains || [],
        lastUpdated: data.lastUpdated,
        total: data.total || 0,
      };
    } catch (error) {
      console.error('Failed to fetch chain patterns:', error);
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