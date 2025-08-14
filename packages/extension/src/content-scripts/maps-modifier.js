import { CONFIG } from '../shared/constants.js';
import { businessDetector } from './business-detector.js';
import { businessMatcher } from '../shared/business-matcher.js';
import { uiInjector } from './ui-injector.js';
import { mapPinManager } from './map-pin-manager.js';

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
      // Load settings
      await this.loadSettings();
      
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
   * Removed: loadChainPatterns() - Chain patterns not needed for binary LFA/Google toggle
   */

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

    // COMPLETELY DISABLE mutation processing when LFA sidebar exists
    const existingLFASidebar = document.querySelector('[data-lfa-sidebar="true"]');
    if (existingLFASidebar) {
      console.log('MapsModifier: LFA sidebar active, ignoring all DOM mutations');
      return;
    }
    
    // Check if there are significant changes (but ignore minor hover/interaction changes)
    const hasSignificantChanges = mutations.some(mutation => 
      mutation.addedNodes.length > 0 && 
      Array.from(mutation.addedNodes).some(node => 
        node.nodeType === Node.ELEMENT_NODE && 
        (node.querySelector && (
          node.querySelector('[role="article"]') ||
          node.querySelector('.section-result') ||
          node.querySelector('[data-value="Directions"]')
        )) &&
        // Don't trigger on our own LFA elements
        !node.closest('[data-lfa-sidebar="true"]') &&
        !node.classList?.contains('lfa-sidebar')
      )
    );

    if (hasSignificantChanges) {
      console.log('MapsModifier: Significant DOM changes detected, processing page');
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
      this.toggleLFAMode();
    });
  }

  /**
   * Toggle between LFA mode and Google mode
   */
  toggleLFAMode() {
    const wasEnabled = this.isEnabled;
    const nowEnabled = !wasEnabled;
    
    console.log(`MapsModifier: Switching from ${wasEnabled ? 'LFA' : 'Google'} mode to ${nowEnabled ? 'LFA' : 'Google'} mode`);
    
    this.isEnabled = nowEnabled;
    this.updateStatusBar();
    
    if (nowEnabled) {
      // Switching to LFA mode - replace Google results with LFA businesses
      this.enableLFAMode();
    } else {
      // Switching to Google mode - restore original Google content
      this.enableGoogleMode();
    }
    
    // Track the toggle
    this.trackEvent('mode_toggle', {
      fromMode: wasEnabled ? 'lfa' : 'google',
      toMode: nowEnabled ? 'lfa' : 'google'
    });
  }

  /**
   * Enable LFA mode - replace Google results with LFA businesses
   */
  async enableLFAMode() {
    console.log('MapsModifier: Enabling LFA mode');
    
    // Hide Google content and show LFA alternatives
    await uiInjector.replaceSidebarWithLFA();
    
    // Hide Google map pins and show LFA pins
    await this.processCurrentPageLFAMode();
    
    // Show the LFA status bar
    uiInjector.showFilterStatus('lfa', 0, 0);
  }

  /**
   * Enable Google mode - restore original Google content
   */
  enableGoogleMode() {
    console.log('MapsModifier: Enabling Google mode');
    
    // Clear all LFA modifications
    uiInjector.clearAllInjectedElements();
    
    // Restore Google sidebar content
    uiInjector.restoreGoogleSidebar();
    
    // Hide LFA status elements except the main toggle bar
    uiInjector.hideFilterStatus();
    
    // Clear map pins to restore Google pins
    if (window.LFA_mapPinManager || mapPinManager) {
      const pinManager = window.LFA_mapPinManager || mapPinManager;
      pinManager.clearAllPins();
    }
  }

  /**
   * Process page for LFA mode - get LFA businesses and show pins
   */
  async processCurrentPageLFAMode() {
    try {
      const currentLocation = businessMatcher.extractLocationFromUrl();
      const userQuery = businessMatcher.extractUserSearchQuery();
      
      if (!currentLocation || !userQuery) {
        console.log('MapsModifier: Missing location or query for LFA mode');
        return;
      }

      console.log(`MapsModifier: Searching LFA businesses for "${userQuery}" near ${currentLocation.lat}, ${currentLocation.lng}`);
      
      // Get LFA businesses via semantic search
      const lfaBusinesses = await businessMatcher.findLFABusinesses(userQuery, currentLocation);
      
      if (lfaBusinesses && lfaBusinesses.length > 0) {
        console.log(`MapsModifier: Found ${lfaBusinesses.length} LFA businesses`);
        
        // Store LFA businesses for sidebar use
        window.LFA_cachedBusinesses = lfaBusinesses;
        console.log('MapsModifier: Stored LFA businesses in window.LFA_cachedBusinesses for sidebar reuse');
        
        // Show LFA pins on map
        try {
          const pinManager = window.LFA_mapPinManager || mapPinManager;
          console.log('MapsModifier: Showing pins using mapPinManager:', !!pinManager);
          
          if (pinManager) {
            // Initialize pin manager if not already done
            if (!pinManager.isInitialized) {
              console.log('MapsModifier: Initializing MapPinManager...');
              await pinManager.init();
            }
            
            // Show pins for LFA businesses
            console.log('MapsModifier: Calling showPinsForBusinesses with', lfaBusinesses.length, 'businesses');
            await pinManager.showPinsForBusinesses(lfaBusinesses);
            console.log('MapsModifier: Successfully showed pins for LFA businesses');
          } else {
            console.error('MapsModifier: MapPinManager not available');
          }
        } catch (error) {
          console.error('MapsModifier: Error showing map pins:', error);
        }
        
        // Update stats
        this.stats.businessesProcessed = lfaBusinesses.length;
        this.stats.localHighlighted = lfaBusinesses.length;
        this.stats.chainsFiltered = 0;
        this.stats.lastUpdate = Date.now();
      } else {
        console.log('MapsModifier: No LFA businesses found for this search');
      }
      
    } catch (error) {
      console.error('MapsModifier: Error in LFA mode processing:', error);
    }
  }

  /**
   * Update the status bar text and button based on current settings
   */
  updateStatusBar() {
    const statusMessage = document.getElementById('lfa-status-message');
    const toggleButton = document.getElementById('lfa-toggle-button');
    const statusBar = document.getElementById('lfa-status-bar');
    
    if (statusMessage && toggleButton && statusBar) {
      const isEnabled = this.isEnabled;
      
      statusMessage.textContent = isEnabled 
        ? '🏪 Showing Local First Arizona businesses'
        : '📍 Showing Google Maps results';
        
      toggleButton.textContent = isEnabled 
        ? 'Disable' 
        : 'Enable';
      
      // Change status bar background color based on mode
      statusBar.style.background = isEnabled 
        ? 'linear-gradient(90deg, #2E7D32, #4CAF50)' // Green gradient when LFA enabled
        : 'linear-gradient(90deg, #f8f9fa, #ffffff)';  // White gradient when disabled
      
      // Change text color for contrast
      statusBar.style.color = isEnabled ? 'white' : '#1a73e8';
      
      // Update button styling based on mode
      if (isEnabled) {
        // LFA enabled - button has light background on green status bar
        toggleButton.style.background = 'rgba(255,255,255,0.2)';
        toggleButton.style.border = '1px solid rgba(255,255,255,0.3)';
        toggleButton.style.color = 'white';
      } else {
        // LFA disabled - button needs to be green on white status bar
        toggleButton.style.background = 'linear-gradient(135deg, #2E7D32, #4CAF50)';
        toggleButton.style.border = '1px solid #1B5E20';
        toggleButton.style.color = 'white';
      }
        
      console.log(`MapsModifier: Updated status bar for ${isEnabled ? 'LFA' : 'Google'} mode`);
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
      console.log('MapsModifier: Extension disabled, using Google mode');
      this.enableGoogleMode();
      return;
    }

    console.log('MapsModifier: Processing current page in LFA mode...');
    
    try {
      // Enable LFA mode - replace Google content with LFA businesses
      await this.enableLFAMode();
      
      console.log('MapsModifier: LFA mode enabled successfully');

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

  /**
   * Add local alternatives proactively for searches that benefit from local options
   * This runs for relevant searches regardless of chain detection to ensure local options are always shown
   */
  async addProactiveAlternatives(currentLocation, businesses, chainsFiltered) {
    try {
      // Get the user's search query to determine if we should show proactive alternatives
      const userQuery = businessMatcher.extractUserSearchQuery();
      if (!userQuery) {
        console.log('MapsModifier: No user query found, skipping proactive alternatives');
        return;
      }

      // Check if this is a search that benefits from local alternatives
      const searchTerms = userQuery.toLowerCase();
      const shouldShowAlternatives = [
        'clothing', 'clothes', 'apparel', 'fashion', 'boutique',
        'hardware', 'tools', 'home improvement', 'garden center',
        'restaurant', 'food', 'dining', 'cafe', 'bar',
        'bookstore', 'books', 'gift shop', 'gifts',
        'jewelry', 'art', 'crafts', 'salon', 'spa',
        'pet store', 'pharmacy', 'florist', 'flowers'
      ].some(term => searchTerms.includes(term));

      // Show proactive alternatives if:
      // 1. Search query suggests local alternatives would be valuable, OR
      // 2. We found very few chains (less than 3) and could supplement with local options
      const shouldShowProactive = shouldShowAlternatives || (chainsFiltered < 3);
      
      if (!shouldShowProactive) {
        console.log('MapsModifier: Search query does not benefit from proactive alternatives:', userQuery, 'chains filtered:', chainsFiltered);
        return;
      }

      console.log('MapsModifier: Adding proactive alternatives for search:', userQuery, 'chains filtered:', chainsFiltered);

      // Find local alternatives using semantic search
      const alternatives = await businessMatcher.findLocalAlternatives(
        { name: 'Generic Local Business', category: 'other' }, // Dummy chain object
        currentLocation
      );

      if (alternatives && alternatives.length > 0) {
        console.log(`MapsModifier: Found ${alternatives.length} proactive alternatives`);
        
        // Add alternatives to the first business container or create a new section
        const firstBusiness = businesses.find(b => b.element);
        if (firstBusiness) {
          // Create a special "Local Alternatives" section
          uiInjector.showLocalAlternatives(
            firstBusiness.element, 
            { name: 'Local Alternatives', category: 'local' }, 
            alternatives,
            true // isProactive flag
          );
        }
      } else {
        console.log('MapsModifier: No proactive alternatives found');
      }

    } catch (error) {
      console.error('MapsModifier: Error adding proactive alternatives:', error);
    }
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