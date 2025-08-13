import { CONFIG } from './constants.js';

/**
 * Storage utilities for Local First Arizona Extension
 * Provides a consistent interface for Chrome storage APIs
 */
export class Storage {
  /**
   * Get settings from sync storage
   */
  static async getSettings() {
    try {
      const result = await chrome.storage.sync.get([CONFIG.STORAGE_KEYS.SETTINGS]);
      return result[CONFIG.STORAGE_KEYS.SETTINGS] || CONFIG.DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Failed to get settings:', error);
      return CONFIG.DEFAULT_SETTINGS;
    }
  }

  /**
   * Update settings in sync storage
   */
  static async updateSettings(newSettings) {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...newSettings };
      
      await chrome.storage.sync.set({
        [CONFIG.STORAGE_KEYS.SETTINGS]: updatedSettings
      });
      
      return updatedSettings;
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  }

  /**
   * Get a specific setting
   */
  static async getSetting(key) {
    const settings = await this.getSettings();
    return settings[key] ?? CONFIG.DEFAULT_SETTINGS[key];
  }

  /**
   * Set a specific setting
   */
  static async setSetting(key, value) {
    return await this.updateSettings({ [key]: value });
  }

  /**
   * Reset settings to defaults
   */
  static async resetSettings() {
    try {
      await chrome.storage.sync.set({
        [CONFIG.STORAGE_KEYS.SETTINGS]: CONFIG.DEFAULT_SETTINGS
      });
      return CONFIG.DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Failed to reset settings:', error);
      throw error;
    }
  }

  /**
   * Get cached chains from local storage
   */
  static async getCachedChains() {
    try {
      const result = await chrome.storage.local.get([CONFIG.STORAGE_KEYS.CHAINS]);
      const cached = result[CONFIG.STORAGE_KEYS.CHAINS];
      
      if (cached && cached.chains) {
        return {
          chains: cached.chains,
          timestamp: cached.timestamp,
          lastUpdated: cached.lastUpdated,
          isStale: (Date.now() - cached.timestamp) > CONFIG.SYNC_INTERVAL,
        };
      }
      
      return { chains: [], timestamp: null, lastUpdated: null, isStale: true };
    } catch (error) {
      console.error('Failed to get cached chains:', error);
      return { chains: [], timestamp: null, lastUpdated: null, isStale: true };
    }
  }

  /**
   * Get last sync timestamp
   */
  static async getLastSync() {
    try {
      const result = await chrome.storage.local.get([CONFIG.STORAGE_KEYS.LAST_SYNC]);
      return result[CONFIG.STORAGE_KEYS.LAST_SYNC] || null;
    } catch (error) {
      console.error('Failed to get last sync timestamp:', error);
      return null;
    }
  }

  /**
   * Clear all cached data
   */
  static async clearCache() {
    try {
      await chrome.storage.local.remove([
        CONFIG.STORAGE_KEYS.CHAINS,
        CONFIG.STORAGE_KEYS.CACHED_BUSINESSES,
        CONFIG.STORAGE_KEYS.LAST_SYNC,
      ]);
      console.log('Cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      throw error;
    }
  }

  /**
   * Clear all extension data (for uninstall/reset)
   */
  static async clearAllData() {
    try {
      await chrome.storage.local.clear();
      await chrome.storage.sync.clear();
      console.log('All extension data cleared');
    } catch (error) {
      console.error('Failed to clear all data:', error);
      throw error;
    }
  }

  /**
   * Get storage usage information
   */
  static async getStorageInfo() {
    try {
      const [localUsage, syncUsage] = await Promise.all([
        chrome.storage.local.getBytesInUse(),
        chrome.storage.sync.getBytesInUse(),
      ]);
      
      return {
        local: {
          used: localUsage,
          quota: chrome.storage.local.QUOTA_BYTES,
          percentage: (localUsage / chrome.storage.local.QUOTA_BYTES) * 100,
        },
        sync: {
          used: syncUsage,
          quota: chrome.storage.sync.QUOTA_BYTES,
          percentage: (syncUsage / chrome.storage.sync.QUOTA_BYTES) * 100,
        },
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return null;
    }
  }

  /**
   * Listen for storage changes
   */
  static addChangeListener(callback) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      callback(changes, namespace);
    });
  }

  /**
   * Remove storage change listener
   */
  static removeChangeListener(callback) {
    chrome.storage.onChanged.removeListener(callback);
  }

  /**
   * Export all settings and data (for backup)
   */
  static async exportData() {
    try {
      const [localData, syncData] = await Promise.all([
        chrome.storage.local.get(),
        chrome.storage.sync.get(),
      ]);
      
      return {
        local: localData,
        sync: syncData,
        exportDate: new Date().toISOString(),
        version: chrome.runtime.getManifest().version,
      };
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  /**
   * Import settings and data (for restore)
   */
  static async importData(data) {
    try {
      if (data.local) {
        await chrome.storage.local.set(data.local);
      }
      
      if (data.sync) {
        await chrome.storage.sync.set(data.sync);
      }
      
      console.log('Data imported successfully');
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  }
}

/**
 * Message passing utility for communicating with background script
 */
export class Messaging {
  /**
   * Send message to background script
   */
  static async sendMessage(action, data = {}) {
    try {
      const response = await chrome.runtime.sendMessage({ action, data });
      return response;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Get nearby businesses via background script
   */
  static async getNearbyBusinesses(lat, lng, radius) {
    return await this.sendMessage('getNearbyBusinesses', { lat, lng, radius });
  }

  /**
   * Get chain patterns via background script
   */
  static async getChainPatterns() {
    return await this.sendMessage('getChainPatterns');
  }

  /**
   * Update settings via background script
   */
  static async updateSettings(settings) {
    return await this.sendMessage('updateSettings', settings);
  }

  /**
   * Track analytics event via background script
   */
  static async trackEvent(type, data = {}) {
    return await this.sendMessage('trackEvent', { type, ...data });
  }

  /**
   * Trigger data sync via background script
   */
  static async syncData() {
    return await this.sendMessage('syncData');
  }

  /**
   * Get extension status via background script
   */
  static async getStatus() {
    return await this.sendMessage('getStatus');
  }
}