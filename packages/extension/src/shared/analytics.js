import { CONFIG, generateId } from './constants.js';
import { apiClient } from './api-client.js';

/**
 * Analytics manager for Local First Arizona Extension
 * Handles event batching, queuing, and sending to API
 */
export class Analytics {
  constructor() {
    this.queue = [];
    this.sessionId = generateId();
    this.isFlushingScheduled = false;
    this.isEnabled = CONFIG.ANALYTICS.ENABLED;
    
    // Initialize from storage
    this.initializeFromStorage();
    
    // Set up periodic flush
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
      console.error('Failed to initialize analytics from storage:', error);
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
      console.error('Failed to save analytics queue to storage:', error);
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
        url: data.url || (typeof window !== 'undefined' ? window.location.href : null),
        timestamp: Date.now(),
        ...data.metadata
      },
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    // Add to queue
    this.queue.push(event);
    console.log(`Analytics: Tracked ${eventType}`, event);

    // Save to storage
    await this.saveQueueToStorage();

    // Check if we should flush immediately
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
        installTime: Date.now(),
      }
    });
  }

  /**
   * Track business view
   */
  async trackBusinessView(businessId, businessName, source = 'maps') {
    await this.track(CONFIG.EVENT_TYPES.VIEW, {
      businessId,
      metadata: {
        businessName,
        source,
      }
    });
  }

  /**
   * Track business click
   */
  async trackBusinessClick(businessId, businessName, clickType = 'badge') {
    await this.track(CONFIG.EVENT_TYPES.CLICK, {
      businessId,
      metadata: {
        businessName,
        clickType, // badge, website, phone, etc.
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
        filterLevel,
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
        newValue,
      }
    });
  }

  /**
   * Track error
   */
  async trackError(error, context = 'unknown') {
    await this.track(CONFIG.EVENT_TYPES.ERROR, {
      metadata: {
        error: error.message || error,
        stack: error.stack,
        context,
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
    }, 60 * 60 * 1000); // 1 hour
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
    
    // Take events to send (avoid race conditions)
    const eventsToSend = [...this.queue];
    
    try {
      const result = await apiClient.sendAnalyticsEvents(eventsToSend);
      
      if (result.success) {
        // Remove sent events from queue
        this.queue = this.queue.filter(event => 
          !eventsToSend.find(sent => sent.id === event.id)
        );
        
        console.log(`Analytics: Successfully sent ${result.processed} events`);
      } else {
        // Mark events as failed and increment retry count
        eventsToSend.forEach(event => {
          event.retryCount = (event.retryCount || 0) + 1;
          if (event.retryCount >= CONFIG.ANALYTICS.MAX_RETRIES) {
            // Remove events that have exceeded retry limit
            this.queue = this.queue.filter(q => q.id !== event.id);
            console.warn(`Analytics: Dropping event after ${CONFIG.ANALYTICS.MAX_RETRIES} retries`, event);
          }
        });
        
        console.error('Analytics: Failed to send events, will retry later');
      }
    } catch (error) {
      console.error('Analytics: Error during flush:', error);
      await this.trackError(error, 'analytics_flush');
    }

    // Save updated queue
    await this.saveQueueToStorage();
  }

  /**
   * Clear all analytics data (for privacy/reset)
   */
  async clear() {
    this.queue = [];
    await chrome.storage.local.remove([CONFIG.STORAGE_KEYS.ANALYTICS_QUEUE]);
    console.log('Analytics: Cleared all data');
  }

  /**
   * Enable/disable analytics
   */
  async setEnabled(enabled) {
    this.isEnabled = enabled;
    
    if (!enabled) {
      await this.clear();
    }
    
    console.log(`Analytics: ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Get analytics summary for debugging
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      queueLength: this.queue.length,
      sessionId: this.sessionId,
      isFlushingScheduled: this.isFlushingScheduled,
    };
  }
}

// Create singleton instance
export const analytics = new Analytics();