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
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getChainPatterns' });
      if (response && response.success && response.data.chains) {
        businessMatcher.updateChainPatterns(response.data.chains);
        console.log(`MapsModifier: Loaded ${response.data.chains.length} chain patterns`);
      }
    } catch (error) {
      console.error('MapsModifier: Failed to load chain patterns:', error);
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
      // Get current location for nearby business queries
      const currentLocation = businessMatcher.extractLocationFromUrl();
      
      // Load nearby businesses if we have location
      if (currentLocation) {
        await this.loadNearbyBusinesses(currentLocation);
      }

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
   * Load nearby businesses for the current location
   */
  async loadNearbyBusinesses(location) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getNearbyBusinesses',
        data: {
          lat: location.lat,
          lng: location.lng,
          radius: CONFIG.FILTERING.DEFAULT_RADIUS,
        }
      });

      if (response && response.success) {
        businessMatcher.updateLocalBusinesses(response.data.businesses);
        console.log(`MapsModifier: Loaded ${response.data.businesses.length} nearby businesses`);
      }
    } catch (error) {
      console.error('MapsModifier: Failed to load nearby businesses:', error);
    }
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

        // Show alternatives if enabled
        if (this.settings.showAlternatives && currentLocation) {
          const alternatives = businessMatcher.findLocalAlternatives(
            chainResult.matchedChain, 
            currentLocation
          );

          if (alternatives.length > 0) {
            uiInjector.showLocalAlternatives(business.element, chainResult.matchedChain, alternatives);
          }
        }

        // Track chain filtering
        this.trackEvent('chain_filtered', {
          businessName: business.name,
          chainName: chainResult.matchedChain.name,
          confidence: chainResult.confidence,
          filterLevel: this.settings.filterLevel,
        });

      } else {
        // Check if it's a local business
        const localMatch = businessMatcher.findLocalMatch(business.name, currentLocation);

        if (localMatch && this.settings.showBadges) {
          business.processed.isLocal = true;
          business.processed.localInfo = localMatch;

          // Add LFA badge
          uiInjector.addLFABadge(business.element, localMatch);

          // Track local business view
          this.trackEvent('local_highlighted', {
            businessName: business.name,
            businessId: localMatch.id,
            matchScore: localMatch.matchScore,
          });
        }
      }

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