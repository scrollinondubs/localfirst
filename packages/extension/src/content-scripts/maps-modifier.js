import { CONFIG } from '../shared/constants.js';
import { businessDetector } from './business-detector.js';
import { businessMatcher } from '../shared/business-matcher.js';
import { uiInjector } from './ui-injector.js';

/**
 * Maps Modifier - Main orchestrator for Google Maps content script
 * Coordinates business detection, matching, and UI modifications
 */
class MapsModifier {
  constructor() {
    this.isInitialized = false;
    this.isEnabled = true;
    this.settings = CONFIG.DEFAULT_SETTINGS;
    this.observer = null;
    this.lastProcessedUrl = '';
    this.processThrottle = 1000; // Minimum ms between full processes
    this.lastProcessTime = 0;
    this.retryCount = 0;
    this.maxRetries = 3;
    
    this.stats = {
      businessesProcessed: 0,
      chainsFiltered: 0,
      localHighlighted: 0,
      lastUpdate: Date.now(),
    };
  }

  /**
   * Initialize the Maps Modifier
   */
  async init() {
    if (this.isInitialized) {
      return;
    }

    console.log('MapsModifier: Initializing...');

    try {
      // Load settings and data
      await this.loadSettings();
      await this.loadChainPatterns();
      
      // Set up DOM observer
      this.setupMutationObserver();
      
      // Set up message listener
      this.setupMessageListener();
      
      // Set up navigation listener
      this.setupNavigationListener();
      
      // Set up toggle listener for filter controls
      this.setupToggleListener();
      
      // Update status bar with current settings
      this.updateStatusBar();
      
      // Initial processing
      await this.processCurrentPage();
      
      this.isInitialized = true;
      console.log('MapsModifier: Initialized successfully');
      
      // Track initialization
      this.trackEvent('init', {
        url: window.location.href,
        userAgent: navigator.userAgent,
      });

    } catch (error) {
      console.error('MapsModifier: Initialization failed:', error);
      this.retryCount++;
      
      if (this.retryCount < this.maxRetries) {
        console.log(`MapsModifier: Retrying initialization (${this.retryCount}/${this.maxRetries})`);
        setTimeout(() => this.init(), 2000 * this.retryCount);
      } else {
        console.error('MapsModifier: Max retries reached, giving up');
      }
    }
  }

  /**
   * Load extension settings
   */
  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
      if (response && response.success) {
        this.settings = { ...CONFIG.DEFAULT_SETTINGS, ...response.data };
        // Force strict mode override any stored moderate setting
        this.settings.filterLevel = 'strict';
        this.isEnabled = this.settings.enabled;
        console.log('MapsModifier: Settings loaded', this.settings);
      }
    } catch (error) {
      console.error('MapsModifier: Failed to load settings:', error);
      // Use defaults
      this.settings = CONFIG.DEFAULT_SETTINGS;
    }
  }

  /**
   * Load chain patterns from background script
   */
  async loadChainPatterns() {
    console.log('🔍 CONTENT SCRIPT: loadChainPatterns() called');
    
    try {
      console.log('🔍 CONTENT SCRIPT: Sending getChainPatterns message to service worker');
      const response = await chrome.runtime.sendMessage({ action: 'getChainPatterns' });
      
      console.log('🔍 CONTENT SCRIPT: Received response from service worker:', {
        hasResponse: !!response,
        success: response?.success,
        hasData: !!response?.data,
        hasChains: !!response?.data?.chains,
        chainsLength: response?.data?.chains?.length,
        total: response?.data?.total
      });
      
      if (response && response.success && response.data.chains) {
        console.log('🔍 CONTENT SCRIPT: Response data analysis:', {
          chainsLength: response.data.chains.length,
          hasTracer: response.data.chains.some(c => c.name.includes('TRACER')),
          firstFewChains: response.data.chains.slice(0, 5).map(c => c.name),
          totalFromResponse: response.data.total
        });
        
        businessMatcher.updateChainPatterns(response.data.chains);
        console.log(`🔍 CONTENT SCRIPT: Successfully loaded ${response.data.chains.length} chain patterns`);
        console.log(`🔍 CONTENT SCRIPT: Updated with ${response.data.chains.length} chain patterns`);
      } else {
        console.error('🔍 CONTENT SCRIPT: Invalid response structure:', response);
      }
    } catch (error) {
      console.error('🔍 CONTENT SCRIPT: Failed to load chain patterns:', error);
    }
  }

  /**
   * Set up mutation observer to watch for DOM changes
   */
  setupMutationObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false, // We don't need attribute changes for this use case
    });

    console.log('MapsModifier: Mutation observer set up');
  }

  /**
   * Handle DOM mutations
   */
  handleMutations(mutations) {
    if (!this.isEnabled) {
      return;
    }

    // Check if there are significant changes
    const hasSignificantChanges = mutations.some(mutation => 
      mutation.addedNodes.length > 0 && 
      Array.from(mutation.addedNodes).some(node => 
        node.nodeType === Node.ELEMENT_NODE && 
        (node.querySelector && (
          node.querySelector('[role="article"]') ||
          node.querySelector('.section-result') ||
          node.querySelector('[data-value="Directions"]')
        ))
      )
    );

    if (hasSignificantChanges) {
      // Throttle processing
      const now = Date.now();
      if (now - this.lastProcessTime > this.processThrottle) {
        this.lastProcessTime = now;
        this.processCurrentPage();
      }
    }
  }

  /**
   * Set up message listener for communication with background script
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open
    });
  }

  /**
   * Handle messages from background script
   */
  async handleMessage(message, sender, sendResponse) {
    try {
      const { action, data } = message;

      switch (action) {
        case 'settingsChanged':
          await this.handleSettingsChange(data);
          sendResponse({ success: true });
          break;

        case 'refresh':
          await this.processCurrentPage();
          sendResponse({ success: true });
          break;

        case 'getStats':
          sendResponse({ success: true, data: this.getStats() });
          break;

        case 'toggle':
          this.toggleExtension(data.enabled);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('MapsModifier: Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle settings changes
   */
  async handleSettingsChange(newSettings) {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };
    this.isEnabled = this.settings.enabled;

    console.log('MapsModifier: Settings changed', this.settings);

    // If filtering level changed, re-process page
    if (oldSettings.filterLevel !== this.settings.filterLevel) {
      uiInjector.clearAllInjectedElements();
      await this.processCurrentPage();
    }

    // Track settings change
    this.trackEvent('settings_change', {
      oldSettings,
      newSettings: this.settings,
    });
  }

  /**
   * Set up navigation listener to detect page changes
   */
  setupNavigationListener() {
    // Watch for URL changes
    let currentUrl = window.location.href;
    
    const checkUrlChange = () => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        this.handleNavigation();
      }
    };

    // Check for URL changes periodically
    setInterval(checkUrlChange, 1000);

    // Also listen for popstate events
    window.addEventListener('popstate', () => {
      this.handleNavigation();
    });
  }

  /**
   * Set up toggle listener for filter controls
   */
  setupToggleListener() {
    window.addEventListener('lfa-toggle-filter', () => {
      this.toggleFilterMode();
    });
  }

  /**
   * Toggle between strict and moderate filtering
   */
  toggleFilterMode() {
    const currentLevel = this.settings.filterLevel;
    const newLevel = currentLevel === 'strict' ? 'moderate' : 'strict';
    
    console.log(`MapsModifier: Switching from ${currentLevel} to ${newLevel} filtering`);
    
    this.settings.filterLevel = newLevel;
    this.updateStatusBar();
    
    // Clear existing modifications and reprocess
    uiInjector.clearAllInjectedElements();
    businessDetector.clearProcessedCache();
    
    // Reprocess current page with new settings
    setTimeout(() => {
      this.processCurrentPage();
    }, 100);
    
    // Track the toggle
    this.trackEvent('filter_toggle', {
      fromLevel: currentLevel,
      toLevel: newLevel
    });
  }

  /**
   * Update the status bar text and button based on current settings
   */
  updateStatusBar() {
    const statusMessage = document.getElementById('lfa-status-message');
    const toggleButton = document.getElementById('lfa-toggle-button');
    
    if (statusMessage && toggleButton) {
      const isStrict = this.settings.filterLevel === 'strict';
      
      statusMessage.textContent = isStrict 
        ? '🏪 Local First Arizona is hiding chain stores'
        : '🏪 Local First Arizona is dimming chain stores';
        
      toggleButton.textContent = isStrict 
        ? 'Switch to Dimming' 
        : 'Switch to Hiding';
        
      console.log(`MapsModifier: Updated status bar for ${this.settings.filterLevel} mode`);
    }
  }

  /**
   * Handle page navigation
   */
  handleNavigation() {
    console.log('MapsModifier: Navigation detected');
    
    // Clear previous modifications
    uiInjector.clearAllInjectedElements();
    businessDetector.clearProcessedCache();
    
    // Reset stats
    this.resetStats();
    
    // Process new page after a short delay
    setTimeout(() => {
      this.processCurrentPage();
    }, 1000);
  }

  /**
   * Process the current page
   */
  async processCurrentPage() {
    if (!this.isEnabled) {
      console.log('MapsModifier: Extension disabled, skipping processing');
      return;
    }

    console.log('MapsModifier: Processing current page...');
    
    try {
      // Get current location for alternative business searches
      const currentLocation = businessMatcher.extractLocationFromUrl();

      // Scan for businesses on the page
      const businesses = businessDetector.scanForBusinesses();
      console.log(`MapsModifier: Found ${businesses.length} businesses to process`);

      let chainsFiltered = 0;
      let localHighlighted = 0;

      // Process each business
      for (const business of businesses) {
        try {
          await this.processBusiness(business, currentLocation);
          
          // Update stats based on processing results
          if (business.processed?.isChain) {
            chainsFiltered++;
          }
          if (business.processed?.isLocal) {
            localHighlighted++;
          }
          
        } catch (error) {
          console.error(`MapsModifier: Error processing business ${business.name}:`, error);
        }
      }

      // Update stats
      this.stats.businessesProcessed += businesses.length;
      this.stats.chainsFiltered += chainsFiltered;
      this.stats.localHighlighted += localHighlighted;
      this.stats.lastUpdate = Date.now();

      // Show filter status if anything was processed
      if (chainsFiltered > 0 || localHighlighted > 0) {
        uiInjector.showFilterStatus(this.settings.filterLevel, chainsFiltered, localHighlighted);
      }

      console.log(`MapsModifier: Processing complete. Chains filtered: ${chainsFiltered}, Local highlighted: ${localHighlighted}`);

      // Clean up any orphaned placeholders that might be stacking up
      setTimeout(() => {
        uiInjector.cleanupOrphanedPlaceholders();
      }, 2000);

    } catch (error) {
      console.error('MapsModifier: Error processing page:', error);
      this.trackEvent('error', {
        error: error.message,
        stack: error.stack,
        context: 'process_page',
      });
    }
  }

  /**
   * Removed: loadNearbyBusinesses() - No longer using hardcoded business database
   * Local businesses are now dynamically fetched via API when alternatives are needed
   */

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Process a single business
   */
  async processBusiness(business, currentLocation) {
    if (!business.name || !business.element) {
      return;
    }

    business.processed = {};

    try {
      // Check if it's a chain business
      const chainResult = businessMatcher.isChainBusiness(
        business.name, 
        CONFIG.FILTER_LEVELS[this.settings.filterLevel].confidenceThreshold
      );

      if (chainResult.isChain) {
        business.processed.isChain = true;
        business.processed.chainInfo = chainResult.matchedChain;

        // Apply chain filtering
        uiInjector.applyChainFiltering(
          business.element, 
          chainResult.matchedChain, 
          this.settings.filterLevel
        );

        // Show alternatives if enabled (now using async API search)
        if (this.settings.showAlternatives && currentLocation) {
          console.log('MapsModifier: Looking for alternatives for', chainResult.matchedChain.name, 'at location', currentLocation);
          
          // findLocalAlternatives is now async and searches via API
          businessMatcher.findLocalAlternatives(chainResult.matchedChain, currentLocation)
            .then(alternatives => {
              console.log('MapsModifier: Found', alternatives.length, 'alternatives via API:', alternatives);

              if (alternatives.length > 0) {
                console.log('MapsModifier: Showing alternatives for', chainResult.matchedChain.name);
                uiInjector.showLocalAlternatives(business.element, chainResult.matchedChain, alternatives);
              } else {
                console.log('MapsModifier: No alternatives found via API for', chainResult.matchedChain.name);
              }
            })
            .catch(error => {
              console.error('MapsModifier: Error fetching alternatives:', error);
            });
        } else {
          console.log('MapsModifier: Not showing alternatives - showAlternatives:', this.settings.showAlternatives, 'currentLocation:', currentLocation);
        }

        // Track chain filtering
        this.trackEvent('chain_filtered', {
          businessName: business.name,
          chainName: chainResult.matchedChain.name,
          confidence: chainResult.confidence,
          filterLevel: this.settings.filterLevel,
        });

      }
      // Note: Local business identification/badging removed - could be re-implemented via API if needed

    } catch (error) {
      console.error(`MapsModifier: Error processing business ${business.name}:`, error);
      business.processed.error = error.message;
    }
  }

  /**
   * Toggle extension on/off
   */
  toggleExtension(enabled) {
    this.isEnabled = enabled;
    
    if (!enabled) {
      // Clear all modifications when disabled
      uiInjector.clearAllInjectedElements();
      uiInjector.hideFilterStatus();
    } else {
      // Re-process page when enabled
      this.processCurrentPage();
    }

    console.log(`MapsModifier: Extension ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Track analytics event
   */
  trackEvent(eventType, data = {}) {
    chrome.runtime.sendMessage({
      action: 'trackEvent',
      data: {
        type: eventType,
        metadata: {
          ...data,
          url: window.location.href,
          timestamp: Date.now(),
        }
      }
    }).catch(error => {
      console.error('MapsModifier: Failed to track event:', error);
    });
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      ...this.stats,
      isEnabled: this.isEnabled,
      isInitialized: this.isInitialized,
      settings: this.settings,
      businessMatcher: businessMatcher.getStatus(),
      businessDetector: businessDetector.getStatus(),
      uiInjector: uiInjector.getStatus(),
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      businessesProcessed: 0,
      chainsFiltered: 0,
      localHighlighted: 0,
      lastUpdate: Date.now(),
    };
  }

  /**
   * Cleanup when extension is disabled or page unloads
   */
  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    uiInjector.clearAllInjectedElements();
    businessDetector.clearProcessedCache();
    
    console.log('MapsModifier: Cleanup complete');
  }
}

// Initialize when DOM is ready
function initializeMapsModifier() {
  const mapsModifier = new MapsModifier();
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      mapsModifier.init();
    });
  } else {
    // DOM is already ready
    setTimeout(() => {
      mapsModifier.init();
    }, 1000); // Small delay to ensure Maps has loaded
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    mapsModifier.cleanup();
  });

  // Make available globally for debugging
  window.lfa_mapsModifier = mapsModifier;
}

// Start the extension
initializeMapsModifier();

console.log('Local First Arizona Maps Modifier loaded');