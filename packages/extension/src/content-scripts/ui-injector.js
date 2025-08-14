import { CONFIG } from '../shared/constants.js';
import { mapPinManager } from './map-pin-manager.js';

/**
 * UI Injector for Local First Arizona Extension
 * Handles adding badges, filtering UI, and visual modifications to Google Maps
 */
export class UIInjector {
  constructor() {
    this.injectedElements = new WeakMap();
    this.styleSheet = null;
    this.hiddenBusinessData = new Map(); // Store data for hidden businesses
    this.initializeStyles();
  }

  /**
   * Initialize CSS styles for the extension
   */
  initializeStyles() {
    if (this.styleSheet) {
      return; // Already initialized
    }

    const style = document.createElement('style');
    style.id = 'lfa-extension-styles';
    style.textContent = `
      /* Local First Arizona Extension Styles */
      
      /* LFA Badge Styles */
      .lfa-badge {
        display: inline-flex;
        align-items: center;
        background: linear-gradient(135deg, #2E7D32, #4CAF50);
        color: white;
        font-size: 11px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 8px;
        margin: 2px 4px 2px 0;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        z-index: 1000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        position: relative;
        animation: lfa-badge-appear 0.3s ease-out;
      }

      .lfa-badge::before {
        content: '🏪';
        margin-right: 3px;
        font-size: 10px;
      }

      .lfa-badge-member {
        background: linear-gradient(135deg, #1565C0, #2196F3);
      }

      .lfa-badge-verified {
        background: linear-gradient(135deg, #E65100, #FF9800);
      }

      .lfa-badge-verified::before {
        content: '✓';
        font-size: 9px;
        margin-right: 2px;
      }

      /* Chain Business Dimming */
      .lfa-chain-business {
        opacity: 0.4 !important;
        filter: grayscale(50%) !important;
        transition: opacity 0.3s ease, filter 0.3s ease !important;
        position: relative;
      }

      .lfa-chain-business::after {
        content: 'Chain Store';
        position: absolute;
        top: 2px;
        right: 2px;
        background: rgba(255, 152, 0, 0.9);
        color: white;
        font-size: 9px;
        padding: 1px 4px;
        border-radius: 3px;
        z-index: 1001;
        font-weight: 500;
      }

      .lfa-chain-business:hover {
        opacity: 0.7 !important;
        filter: grayscale(25%) !important;
      }

      /* Chain Business Hiding */
      .lfa-chain-hidden {
        display: none !important;
      }

      /* Chain Replacement Placeholder */
      .lfa-chain-placeholder {
        background: #f8f9fa !important;
        border: 1px solid #e8eaed !important;
        border-radius: 8px !important;
        padding: 16px !important;
        margin: 4px 0 !important;
        display: block !important;
        position: relative !important;
        z-index: 1000 !important;
        color: #333 !important;
        font-family: Google Sans, Roboto, Arial, sans-serif !important;
        font-size: 14px !important;
        line-height: 20px !important;
      }

      /* Local Alternative Suggestions */
      .lfa-alternatives {
        background: #f8f9fa !important;
        border: 1px solid #e8eaed !important;
        border-radius: 8px !important;
        padding: 16px !important;
        margin: 4px 0 !important;
        font-family: Google Sans, Roboto, Arial, sans-serif !important;
        font-size: 14px !important;
        line-height: 20px !important;
        position: relative !important;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
        color: #3c4043 !important;
      }

      .lfa-alternatives-header {
        font-weight: 600 !important;
        color: #2E7D32 !important;
        margin-bottom: 12px !important;
        display: flex !important;
        align-items: center !important;
        font-size: 16px !important;
        line-height: 24px !important;
      }

      .lfa-alternatives-header::before {
        content: '🏪';
        margin-right: 6px !important;
        font-size: 14px !important;
      }

      .lfa-alternative-item {
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        padding: 12px 0 !important;
        border-bottom: 1px solid #e8eaed !important;
        gap: 4px !important;
      }

      .lfa-alternative-item:last-child {
        border-bottom: none !important;
      }

      .lfa-alternative-name {
        font-weight: 500 !important;
        color: #1a73e8 !important;
        cursor: pointer !important;
        font-size: 16px !important;
        line-height: 24px !important;
        text-decoration: none !important;
      }

      .lfa-alternative-name:hover {
        text-decoration: underline !important;
      }

      .lfa-alternative-info {
        display: flex !important;
        flex-direction: column !important;
        gap: 2px !important;
        width: 100% !important;
      }

      .lfa-alternative-address {
        font-size: 14px !important;
        color: #5f6368 !important;
        line-height: 20px !important;
      }

      .lfa-alternative-distance {
        font-size: 14px !important;
        color: #5f6368 !important;
        line-height: 20px !important;
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
      }

      /* Filter Status Indicator */
      .lfa-filter-status {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        z-index: 10000;
        backdrop-filter: blur(10px);
        transition: opacity 0.3s ease;
        pointer-events: none;
      }

      .lfa-filter-status.hidden {
        opacity: 0;
      }

      /* Animations */
      @keyframes lfa-badge-appear {
        from {
          opacity: 0;
          transform: scale(0.8);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      @keyframes lfa-pulse {
        0%, 100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.05);
        }
      }

      .lfa-badge-new {
        animation: lfa-pulse 2s ease-in-out;
      }

      /* Responsive adjustments */
      @media (max-width: 768px) {
        .lfa-badge {
          font-size: 10px;
          padding: 1px 4px;
        }
        
        .lfa-alternatives {
          font-size: 11px;
          padding: 6px;
        }
        
        .lfa-filter-status {
          bottom: 10px;
          right: 10px;
          font-size: 11px;
          padding: 6px 10px;
        }
      }

      /* Map Pin Styles */
      .lfa-map-pin {
        position: absolute;
        pointer-events: auto;
        cursor: pointer;
        user-select: none;
        transition: all 0.2s ease;
      }

      .lfa-map-pin:hover {
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
      }

      /* Info Window Styles */
      .lfa-info-window {
        position: absolute;
        background: white;
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 300;
        font-family: Google Sans, Roboto, Arial, sans-serif;
        font-size: 14px;
        line-height: 20px;
        max-width: 250px;
        pointer-events: auto;
        cursor: default;
        animation: lfa-info-appear 0.2s ease-out;
      }

      @keyframes lfa-info-appear {
        from {
          opacity: 0;
          transform: translate(-50%, -100%) scale(0.9);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -100%) scale(1);
        }
      }

      /* Pin Overlay Container */
      #lfa-pin-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 100;
        overflow: hidden;
      }

      /* Enhanced Alternative Item Hover */
      .lfa-alternative-item:hover {
        background-color: #f8f9fa !important;
        transform: translateX(4px) !important;
        transition: all 0.2s ease !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .lfa-badge {
          border: 2px solid white;
        }
        
        .lfa-chain-business {
          border: 2px solid orange;
        }
        
        .lfa-map-pin {
          border: 2px solid white;
          border-radius: 50%;
        }
        
        .lfa-info-window {
          border: 2px solid #333;
        }
      }
    `;

    document.head.appendChild(style);
    this.styleSheet = style;
    console.log('UIInjector: Styles initialized');
  }

  /**
   * Add LFA badge to a business element
   */
  addLFABadge(element, businessInfo) {
    // Check if badge already exists
    if (this.injectedElements.has(element)) {
      return;
    }

    try {
      const badge = this.createLFABadge(businessInfo);
      const insertionPoint = this.findBestInsertionPoint(element);
      
      if (insertionPoint) {
        insertionPoint.appendChild(badge);
        this.injectedElements.set(element, { badge, type: 'lfa-badge' });
        console.log(`UIInjector: Added LFA badge for ${businessInfo.name}`);
      }
    } catch (error) {
      console.error('UIInjector: Failed to add LFA badge:', error);
    }
  }

  /**
   * Create LFA badge element
   */
  createLFABadge(businessInfo) {
    const badge = document.createElement('span');
    badge.className = 'lfa-badge lfa-badge-new';
    
    if (businessInfo.verified) {
      badge.classList.add('lfa-badge-verified');
      badge.textContent = 'Verified Local';
      badge.title = 'Verified Local First Arizona Member';
    } else {
      badge.classList.add('lfa-badge-member');
      badge.textContent = 'Local';
      badge.title = 'Local First Arizona Member';
    }

    // Add click handler for analytics
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleBadgeClick(businessInfo);
    });

    // Remove the "new" animation class after it completes
    setTimeout(() => {
      badge.classList.remove('lfa-badge-new');
    }, 2000);

    return badge;
  }

  /**
   * Apply chain business filtering
   */
  applyChainFiltering(element, chainInfo, filterLevel) {
    if (this.injectedElements.has(element)) {
      return; // Already processed
    }

    try {
      const settings = CONFIG.FILTER_LEVELS[filterLevel] || CONFIG.FILTER_LEVELS.moderate;
      
      // Extract specific business data from the element being hidden
      const businessData = this.extractBusinessData(element);
      const businessKey = this.generateBusinessKey(businessData, chainInfo);
      
      if (settings.hideChains) {
        element.classList.add('lfa-chain-hidden');
        this.injectedElements.set(element, { type: 'chain-hidden', chainInfo });
        
        // Store this hidden business data for targeted pin hiding
        this.hiddenBusinessData.set(businessKey, {
          element: element,
          chainInfo: chainInfo,
          businessData: businessData,
          timestamp: Date.now()
        });
        
        console.log(`UIInjector: Stored hidden business data for ${chainInfo.name}:`, businessData);
        
        // Use targeted pin hiding based on business data
        this.hideTargetedMapPins(businessData, chainInfo);
        
        // In strict mode, create a placeholder for alternatives
        this.createChainReplacementPlaceholder(element, chainInfo);
        
      } else if (settings.dimChains) {
        element.classList.add('lfa-chain-business');
        this.injectedElements.set(element, { type: 'chain-dimmed', chainInfo });
      }

      console.log(`UIInjector: Applied ${filterLevel} filtering to ${chainInfo.name}`);
    } catch (error) {
      console.error('UIInjector: Failed to apply chain filtering:', error);
    }
  }

  /**
   * Extract business data from a DOM element
   */
  extractBusinessData(element) {
    const data = {
      name: null,
      address: null,
      element: element
    };
    
    try {
      // Try multiple selectors to find business name - look for actual chain business names
      const nameSelectors = [
        '.qBF1Pd.fontHeadlineSmall', // Most specific first
        '.qBF1Pd',
        '[role="heading"]',
        'h1', 'h2', 'h3',
        '.section-result-title',
        '.NrDZNb',
        'span[data-value][data-dtype="d3bn"]'
      ];
      
      for (const selector of nameSelectors) {
        const nameElements = element.querySelectorAll(selector);
        for (const nameElement of nameElements) {
          const text = nameElement.textContent.trim();
          // Look for actual business names, not generic terms
          if (text && text.length > 3 && text.length < 100) {
            if (text.toLowerCase().includes('whole foods') || 
                text.toLowerCase().includes('safeway') ||
                text.toLowerCase().includes('fry') ||
                text.toLowerCase().includes('walmart') ||
                text.toLowerCase().includes('target')) {
              data.name = text;
              console.log(`UIInjector: Found business name "${text}" using selector "${selector}"`);
              break;
            }
          }
        }
        if (data.name) break;
      }
      
      // Try to find address
      const addressSelectors = [
        '[data-value="Address"]',
        '.section-result-location',
        '.rogA2c'
      ];
      
      for (const selector of addressSelectors) {
        const addressElement = element.querySelector(selector);
        if (addressElement && addressElement.textContent.trim()) {
          data.address = addressElement.textContent.trim();
          break;
        }
      }
      
    } catch (error) {
      console.error('Error extracting business data:', error);
    }
    
    return data;
  }
  
  /**
   * Generate a unique key for business data
   */
  generateBusinessKey(businessData, chainInfo) {
    const name = businessData.name || chainInfo.name;
    const address = businessData.address || '';
    return `${name.toLowerCase()}-${address.toLowerCase()}`.replace(/\s+/g, '-');
  }
  
  /**
   * Hide map pins using targeted business data
   */
  hideTargetedMapPins(businessData, chainInfo) {
    try {
      console.log(`UIInjector: Starting enhanced pin hiding for business:`, businessData);
      
      // Use multiple strategies to find and hide the corresponding map pins
      let hiddenCount = 0;
      
      // Strategy 1: Use Google Maps specific data if available
      if (businessData.googleMapsData) {
        hiddenCount += this.hideMapPinsByGoogleData(businessData.googleMapsData, chainInfo.name);
      }
      
      // Strategy 2: Use business name matching
      hiddenCount += this.hideMapPinsByBusinessName(businessData.name || chainInfo.name);
      
      // Strategy 3: Use address if available
      if (businessData.address) {
        hiddenCount += this.hideMapPinsByAddress(businessData.address);
      }
      
      // Strategy 4: Use coordinates if available
      if (businessData.googleMapsData?.coordinates) {
        hiddenCount += this.hideMapPinsByCoordinates(businessData.googleMapsData.coordinates);
      }
      
      console.log(`UIInjector: Initial pin hiding found ${hiddenCount} elements for ${chainInfo.name}`);
      
      // Set up continuous monitoring for new pins
      this.setupTargetedPinMonitoring(businessData, chainInfo);
      
      // Set up delayed pin hiding with multiple methods
      this.setupDelayedPinHiding(businessData, chainInfo);
      
    } catch (error) {
      console.error('Error in targeted map pin hiding:', error);
      // Fallback to original method
      this.hideRelatedMapPins(chainInfo.name);
    }
  }
  
  /**
   * Hide map pins using Google Maps specific data
   */
  hideMapPinsByGoogleData(googleData, businessName) {
    let hiddenCount = 0;
    
    try {
      // Strategy 1: Use Place ID if available
      if (googleData.placeId) {
        const placeElements = document.querySelectorAll(`[data-cid*="${googleData.placeId}"], [href*="${googleData.placeId}"]`);
        placeElements.forEach(element => {
          this.concealElement(element, `Google Place ID match for ${businessName}`);
          hiddenCount++;
        });
      }
      
      // Strategy 2: Use data-value attributes
      googleData.dataValues.forEach(dataValue => {
        const elements = document.querySelectorAll(`[data-value="${dataValue}"]`);
        elements.forEach(element => {
          // Only hide if it's likely a map pin (not the sidebar element we already hid)
          if (this.isLikelyMapPin(element)) {
            this.concealElement(element, `Data value match for ${businessName}`);
            hiddenCount++;
          }
        });
      });
      
      // Strategy 3: Use jsaction patterns
      googleData.jsActions.forEach(jsAction => {
        const elements = document.querySelectorAll(`[jsaction*="${jsAction}"]`);
        elements.forEach(element => {
          if (this.isLikelyMapPin(element)) {
            this.concealElement(element, `JS action match for ${businessName}`);
            hiddenCount++;
          }
        });
      });
      
      // Strategy 4: Use aria labels
      if (googleData.ariaLabels) {
        googleData.ariaLabels.forEach(ariaLabel => {
          const elements = document.querySelectorAll(`[aria-label*="${ariaLabel}"]`);
          elements.forEach(element => {
            if (this.isLikelyMapPin(element)) {
              this.concealElement(element, `Aria label match for ${businessName}`);
              hiddenCount++;
            }
          });
        });
      }
      
    } catch (error) {
      console.error('Error in Google data pin hiding:', error);
    }
    
    return hiddenCount;
  }

  /**
   * Hide map pins by coordinates
   */
  hideMapPinsByCoordinates(coordinates) {
    let hiddenCount = 0;
    
    try {
      // Look for elements containing these coordinates
      const coordString1 = `${coordinates.lat},${coordinates.lng}`;
      const coordString2 = `${coordinates.lat}, ${coordinates.lng}`;
      
      const elements = document.querySelectorAll('*');
      elements.forEach(element => {
        const text = element.textContent || element.getAttribute('href') || '';
        if ((text.includes(coordString1) || text.includes(coordString2)) && this.isLikelyMapPin(element)) {
          this.concealElement(element, `Coordinate match`);
          hiddenCount++;
        }
      });
      
    } catch (error) {
      console.error('Error in coordinate pin hiding:', error);
    }
    
    return hiddenCount;
  }

  /**
   * Check if element is likely a map pin (not a sidebar element)
   */
  isLikelyMapPin(element) {
    try {
      // Safety check for element
      if (!element || !element.getBoundingClientRect) {
        return false;
      }
      
      // Check if element is in the map area (right side) vs sidebar (left side)
      const rect = element.getBoundingClientRect();
      const isOnMap = rect.left > 400; // Map is typically to the right of 400px
      
      // Check for map-specific classes or attributes - safely handle className
      let hasMapClasses = false;
      if (element.className && typeof element.className === 'string') {
        hasMapClasses = 
          element.className.includes('pin') ||
          element.className.includes('marker') ||
          element.className.includes('place');
      } else if (element.classList && element.classList.length > 0) {
        // Handle DOMTokenList case
        const classString = Array.from(element.classList).join(' ');
        hasMapClasses = 
          classString.includes('pin') ||
          classString.includes('marker') ||
          classString.includes('place');
      }
      
      // Check for map-specific roles or tags
      const hasMapRole = element.hasAttribute && element.hasAttribute('role') && 
        ['button', 'link'].includes(element.getAttribute('role'));
      
      // Exclude sidebar elements - but be more careful about detection
      let isInSidebar = false;
      try {
        isInSidebar = element.closest && element.closest('[role="main"]') && rect.left < 400;
      } catch (error) {
        // If closest fails, assume not in sidebar
        isInSidebar = false;
      }
      
      return (isOnMap || hasMapClasses || hasMapRole) && !isInSidebar;
      
    } catch (error) {
      console.warn('UIInjector: Error in isLikelyMapPin:', error);
      return false;
    }
  }

  /**
   * Conceal element using multiple CSS methods
   */
  concealElement(element, reason) {
    try {
      // Safety check - don't hide essential UI elements
      if (this.isEssentialElement(element)) {
        console.log(`UIInjector: Skipped concealing essential element - ${reason}:`, element);
        return;
      }
      
      // Apply concealment methods - use fewer simultaneous methods to avoid conflicts
      element.style.display = 'none';
      element.style.visibility = 'hidden';
      element.style.opacity = '0';
      // Remove transform and z-index that might interfere with Maps UI
      // element.style.transform = 'scale(0)';
      element.style.pointerEvents = 'none';
      // element.style.zIndex = '-1000';
      
      // Mark element as hidden by our extension
      element.setAttribute('data-lfa-hidden', 'true');
      element.setAttribute('data-lfa-reason', reason);
      
      console.log(`UIInjector: Concealed element - ${reason}:`, element);
    } catch (error) {
      console.warn('UIInjector: Error concealing element:', error);
    }
  }

  /**
   * Check if element is essential to Google Maps UI
   */
  isEssentialElement(element) {
    try {
      // Don't hide main containers, panes, or essential UI
      const essentialSelectors = [
        '#pane',
        '[role="main"]',
        '.section-layout-root',
        '.section-result-content',
        '.lfa-chain-placeholder',
        '[data-lfa-alternatives]'
      ];
      
      for (const selector of essentialSelectors) {
        if (element.matches && element.matches(selector)) {
          return true;
        }
        if (element.closest && element.closest(selector)) {
          return true;
        }
      }
      
      // Don't hide elements that contain our alternatives
      if (element.querySelector && element.querySelector('.lfa-alternatives, [data-lfa-alternatives]')) {
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Hide map pins by business name
   */
  hideMapPinsByBusinessName(businessName) {
    if (!businessName) return 0;
    
    let hiddenCount = 0;
    const normalizedName = businessName.toLowerCase().trim();
    
    // Find map pins/buttons that contain the business name
    const pinSelectors = [
      `[aria-label*="${businessName}"]`,
      `[title*="${businessName}"]`,
      '[role="button"][data-value="Directions"]',
      'button[data-value="Directions"]',
      '.section-result-action-container button'
    ];
    
    pinSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const text = (element.textContent || element.getAttribute('aria-label') || element.getAttribute('title') || '').toLowerCase();
        if (text.includes(normalizedName) || normalizedName.includes(text.split(' ')[0])) {
          if (this.isLikelyMapPin(element)) {
            this.concealElement(element, `Business name match for ${businessName}`);
            hiddenCount++;
          }
        }
      });
    });
    
    return hiddenCount;
  }
  
  /**
   * Hide map pins by address
   */
  hideMapPinsByAddress(address) {
    if (!address) return 0;
    
    let hiddenCount = 0;
    const normalizedAddress = address.toLowerCase().trim();
    
    // Find elements containing the address
    const elements = document.querySelectorAll('[role="button"], button, [data-value]');
    elements.forEach(element => {
      const text = (element.textContent || element.getAttribute('aria-label') || '').toLowerCase();
      if ((text.includes(normalizedAddress) || normalizedAddress.includes(text)) && this.isLikelyMapPin(element)) {
        this.concealElement(element, `Address match for ${address}`);
        hiddenCount++;
      }
    });
    
    return hiddenCount;
  }

  /**
   * Set up delayed pin hiding with multiple methods
   */
  setupDelayedPinHiding(businessData, chainInfo) {
    const businessName = businessData.name || chainInfo.name;
    
    // Reduced delays to minimize interference with Google Maps
    const delays = [2000, 5000]; // Only 2 delayed attempts
    
    delays.forEach((delay, index) => {
      setTimeout(() => {
        console.log(`UIInjector: Delayed pin hiding attempt ${index + 1} for ${businessName}`);
        
        let hiddenCount = 0;
        
        // Try focused strategies - avoid the scanning method that causes issues
        if (businessData.googleMapsData) {
          hiddenCount += this.hideMapPinsByGoogleData(businessData.googleMapsData, businessName);
        }
        
        hiddenCount += this.hideMapPinsByBusinessName(businessName);
        
        if (businessData.address) {
          hiddenCount += this.hideMapPinsByAddress(businessData.address);
        }
        
        // Skip the aggressive scanning method that was causing issues
        // hiddenCount += this.scanAndHideNewPins(businessData, chainInfo);
        
        if (hiddenCount > 0) {
          console.log(`UIInjector: Delayed attempt ${index + 1} found ${hiddenCount} additional pins for ${businessName}`);
        }
      }, delay);
    });
  }

  /**
   * Scan for and hide new pins that match our business data (SAFER VERSION)
   */
  scanAndHideNewPins(businessData, chainInfo) {
    let hiddenCount = 0;
    const businessName = businessData.name || chainInfo.name;
    
    try {
      // More targeted approach - only look at likely pin elements instead of all elements
      const pinCandidates = document.querySelectorAll(`
        [role="button"]:not([data-lfa-hidden]),
        button:not([data-lfa-hidden]),
        [data-value]:not([data-lfa-hidden]),
        [aria-label*="directions"]:not([data-lfa-hidden])
      `);
      
      // Limit to first 20 elements to avoid performance issues
      const limitedCandidates = Array.from(pinCandidates).slice(0, 20);
      
      limitedCandidates.forEach(element => {
        if (!this.isLikelyMapPin(element)) return;
        
        const elementText = (
          (element.textContent || '') + ' ' + 
          (element.getAttribute('aria-label') || '') + ' ' +
          (element.getAttribute('title') || '')
        ).toLowerCase();
        
        // Only check for name matches to be safer
        const nameMatch = businessName && elementText.includes(businessName.toLowerCase());
        
        if (nameMatch) {
          this.concealElement(element, `Late scan match for ${businessName}`);
          hiddenCount++;
        }
      });
      
    } catch (error) {
      console.error('Error in new pin scanning:', error);
    }
    
    return hiddenCount;
  }
  
  /**
   * Set up continuous monitoring for new map pins
   */
  setupTargetedPinMonitoring(businessData, chainInfo) {
    const businessName = businessData.name || chainInfo.name;
    const normalizedName = businessName.toLowerCase().trim();
    
    // Create a mutation observer to hide pins as they appear
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if this new element is a map pin for our business
            const text = (node.textContent || node.getAttribute('aria-label') || '').toLowerCase();
            if (text.includes(normalizedName)) {
              node.style.display = 'none';
              console.log(`UIInjector: Hidden dynamically added pin for ${businessName}:`, node);
            }
            
            // Also check child elements
            const childPins = node.querySelectorAll('[role="button"], button, [data-value]');
            childPins.forEach(pin => {
              const pinText = (pin.textContent || pin.getAttribute('aria-label') || '').toLowerCase();
              if (pinText.includes(normalizedName)) {
                pin.style.display = 'none';
                console.log(`UIInjector: Hidden child pin for ${businessName}:`, pin);
              }
            });
          }
        });
      });
    });
    
    // Observe the map area
    const mapContainer = document.querySelector('#map') || document.body;
    observer.observe(mapContainer, {
      childList: true,
      subtree: true
    });
    
    // Store observer for cleanup
    if (!this.targetedPinObservers) {
      this.targetedPinObservers = [];
    }
    this.targetedPinObservers.push(observer);
    
    console.log(`UIInjector: Set up targeted pin monitoring for ${businessName}`);
  }

  /**
   * Create a placeholder element for hidden chain businesses
   */
  createChainReplacementPlaceholder(element, chainInfo) {
    try {
      // Check if placeholder already exists for this element to prevent duplicates
      const existingInjected = this.injectedElements.get(element);
      if (existingInjected && existingInjected.placeholder) {
        console.log(`UIInjector: Placeholder already exists for ${chainInfo.name}, skipping`);
        return;
      }

      // Find the appropriate parent container for proper placement
      const parentContainer = this.findPlaceholderParent(element);
      if (!parentContainer) {
        console.log(`UIInjector: Could not find suitable parent for placeholder for ${chainInfo.name}`);
        return;
      }

      // Create a placeholder that will replace the hidden chain
      const placeholder = document.createElement('div');
      placeholder.className = 'lfa-chain-placeholder';
      placeholder.setAttribute('data-chain-name', chainInfo.name);
      placeholder.style.cssText = `
        background: #f8f9fa !important;
        border: 1px solid #e8eaed !important;
        border-radius: 8px !important;
        padding: 12px !important;
        margin: 4px 0 !important;
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
        color: #333 !important;
        font-family: Google Sans, Roboto, Arial, sans-serif !important;
        font-size: 13px !important;
        line-height: 18px !important;
        min-height: 50px !important;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
        clear: both !important;
      `;
      
      // Add content but make it more compact to avoid layout issues
      placeholder.innerHTML = `
        <div style="color: #666; font-size: 13px; text-align: center; padding: 8px;">
          <div style="font-weight: 500; margin-bottom: 4px;">🏪 Chain store hidden</div>
          <div style="font-size: 11px;">Loading local alternatives...</div>
        </div>
      `;
      
      // Insert the placeholder in a safer location - after the original element but within proper container
      try {
        parentContainer.appendChild(placeholder);
        console.log(`UIInjector: Created placeholder for hidden ${chainInfo.name} in proper container`);
      } catch (insertError) {
        // Fallback to original insertion method
        console.warn(`UIInjector: Container insertion failed, using fallback for ${chainInfo.name}:`, insertError);
        element.parentNode.insertBefore(placeholder, element.nextSibling);
      }
      
      // Store reference to placeholder
      if (this.injectedElements.has(element)) {
        this.injectedElements.get(element).placeholder = placeholder;
      } else {
        this.injectedElements.set(element, { placeholder: placeholder, type: 'chain-placeholder' });
      }
      
    } catch (error) {
      console.error('UIInjector: Failed to create chain placeholder:', error);
    }
  }

  /**
   * Find appropriate parent container for placeholder placement
   */
  findPlaceholderParent(element) {
    let current = element.parentElement;
    
    // Look for a suitable container that won't cause layout issues
    while (current && current !== document.body) {
      // Check if this looks like a results container
      if (current.classList.contains('section-result') ||
          current.classList.contains('section-result-content') ||
          current.querySelector('[role="article"]') ||
          current.style.display === 'flex' && current.children.length > 1) {
        return current;
      }
      current = current.parentElement;
    }
    
    // Fallback to element's direct parent
    return element.parentElement;
  }

  /**
   * Show local alternatives when chain is filtered
   */
  showLocalAlternatives(element, chainInfo, alternatives) {
    if (!alternatives || alternatives.length === 0) {
      return;
    }

    try {
      const alternativesElement = this.createAlternativesElement(alternatives, chainInfo);
      
      // Check if this chain is hidden and has a placeholder
      const injectedData = this.injectedElements.get(element);
      if (injectedData && injectedData.placeholder) {
        // Replace the placeholder content with alternatives
        injectedData.placeholder.innerHTML = ''; // Clear placeholder content
        injectedData.placeholder.appendChild(alternativesElement);
        injectedData.placeholder.style.display = 'block'; // Show the placeholder
        injectedData.alternatives = alternativesElement;
        console.log(`UIInjector: Added ${alternatives.length} alternatives to placeholder for ${chainInfo.name}`);
        
        // Show map pins using MapPinManager
        this.showAlternativeMapPins(alternatives);
      } else {
        // Use normal insertion point for dimmed chains
        const insertionPoint = this.findAlternativesInsertionPoint(element);
        
        if (insertionPoint) {
          insertionPoint.appendChild(alternativesElement);
          
          // Store reference for cleanup
          if (this.injectedElements.has(element)) {
            this.injectedElements.get(element).alternatives = alternativesElement;
          } else {
            this.injectedElements.set(element, { alternatives: alternativesElement, type: 'alternatives' });
          }
          
          console.log(`UIInjector: Added ${alternatives.length} alternatives for ${chainInfo.name}`);
          
          // Show map pins using MapPinManager
          this.showAlternativeMapPins(alternatives);
        }
      }
    } catch (error) {
      console.error('UIInjector: Failed to show alternatives:', error);
    }
  }

  /**
   * Create local alternatives element
   */
  createAlternativesElement(alternatives, chainInfo) {
    const container = document.createElement('div');
    container.className = 'lfa-alternatives';

    const header = document.createElement('div');
    header.className = 'lfa-alternatives-header';
    header.innerHTML = `
      <strong>🏪 Local alternatives to ${chainInfo.name}:</strong>
      <div style="font-size: 11px; font-weight: normal; margin-top: 2px; color: #666;">
        Supporting local businesses in your community
      </div>
    `;
    container.appendChild(header);

    alternatives.forEach(business => {
      const item = document.createElement('div');
      item.className = 'lfa-alternative-item';
      item.setAttribute('data-business-id', business.id);

      const name = document.createElement('span');
      name.className = 'lfa-alternative-name';
      name.textContent = business.name;
      name.addEventListener('click', () => {
        this.handleAlternativeClick(business, chainInfo);
      });
      
      // Add hover effects that interact with map pins
      item.addEventListener('mouseenter', () => {
        if (mapPinManager.isInitialized) {
          mapPinManager.highlightPinForBusiness(business.id, true);
        }
      });
      
      item.addEventListener('mouseleave', () => {
        if (mapPinManager.isInitialized) {
          mapPinManager.highlightPinForBusiness(business.id, false);
        }
      });
      
      // Add click handler to entire item for better UX
      item.addEventListener('click', (event) => {
        // Only trigger if clicking on the item itself, not the name link
        if (event.target === item || event.target.classList.contains('lfa-alternative-info') || 
            event.target.classList.contains('lfa-alternative-address') || 
            event.target.classList.contains('lfa-alternative-distance')) {
          
          if (mapPinManager.isInitialized) {
            // Highlight the pin and center view on it
            mapPinManager.highlightPinForBusiness(business.id, true);
            
            // Remove highlight after 3 seconds
            setTimeout(() => {
              mapPinManager.highlightPinForBusiness(business.id, false);
            }, 3000);
            
            console.log(`UIInjector: Highlighted pin for ${business.name} via sidebar click`);
          }
        }
      });

      // Create info section with address and distance
      const info = document.createElement('div');
      info.className = 'lfa-alternative-info';
      
      if (business.address) {
        const address = document.createElement('span');
        address.className = 'lfa-alternative-address';
        address.textContent = business.address;
        info.appendChild(address);
      }

      const distanceContainer = document.createElement('span');
      distanceContainer.className = 'lfa-alternative-distance';
      
      const distanceText = business.distance ? `${business.distance.toFixed(1)} mi away` : 'Near you';
      distanceContainer.textContent = distanceText;

      // Add verified badge if applicable
      if (business.verified) {
        const badge = document.createElement('span');
        badge.style.cssText = `
          background: #4CAF50 !important;
          color: white !important;
          font-size: 12px !important;
          padding: 2px 6px !important;
          border-radius: 4px !important;
          margin-left: 8px !important;
          font-weight: 500 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
        `;
        badge.textContent = 'VERIFIED';
        distanceContainer.appendChild(badge);
      }

      info.appendChild(distanceContainer);
      
      item.appendChild(name);
      item.appendChild(info);
      container.appendChild(item);
    });

    return container;
  }

  /**
   * Find the best place to insert a badge
   */
  findBestInsertionPoint(element) {
    // Try to find the business name heading
    const headings = element.querySelectorAll('h1, h2, h3, h4, [role="heading"]');
    if (headings.length > 0) {
      return headings[0].parentElement || headings[0];
    }

    // Try to find a title container
    const titleContainers = element.querySelectorAll('.section-result-title, .section-result-content');
    if (titleContainers.length > 0) {
      return titleContainers[0];
    }

    // Fallback to the element itself
    return element;
  }

  /**
   * Find place to insert alternatives
   */
  findAlternativesInsertionPoint(element) {
    // Try to insert after the main business info
    const infoContainers = element.querySelectorAll('.section-result-content, .section-result');
    if (infoContainers.length > 0) {
      return infoContainers[0].parentElement || infoContainers[0];
    }

    return element;
  }

  /**
   * Show filter status indicator
   */
  showFilterStatus(filterLevel, chainsFiltered = 0, businessesHighlighted = 0) {
    // Remove existing status
    this.hideFilterStatus();

    const status = document.createElement('div');
    status.className = 'lfa-filter-status';
    status.id = 'lfa-filter-status';
    
    let statusText = `Filter: ${filterLevel}`;
    if (chainsFiltered > 0) {
      statusText += ` • ${chainsFiltered} chains filtered`;
    }
    if (businessesHighlighted > 0) {
      statusText += ` • ${businessesHighlighted} local highlighted`;
    }
    
    status.textContent = statusText;
    document.body.appendChild(status);

    // Auto-hide after 3 seconds
    setTimeout(() => {
      this.hideFilterStatus();
    }, 3000);
  }

  /**
   * Hide filter status indicator
   */
  hideFilterStatus() {
    const existing = document.getElementById('lfa-filter-status');
    if (existing) {
      existing.remove();
    }
  }

  /**
   * Handle badge click for analytics
   */
  handleBadgeClick(businessInfo) {
    // Send analytics event via background script
    chrome.runtime.sendMessage({
      action: 'trackEvent',
      data: {
        type: CONFIG.EVENT_TYPES.CLICK,
        businessId: businessInfo.id,
        metadata: {
          businessName: businessInfo.name,
          clickType: 'badge',
          url: window.location.href,
        }
      }
    }).catch(error => {
      console.error('Failed to track badge click:', error);
    });

    console.log('Badge clicked:', businessInfo.name);
  }

  /**
   * Handle alternative business click
   */
  handleAlternativeClick(business, chainInfo) {
    // Send analytics event
    chrome.runtime.sendMessage({
      action: 'trackEvent',
      data: {
        type: CONFIG.EVENT_TYPES.CLICK,
        businessId: business.id,
        metadata: {
          businessName: business.name,
          clickType: 'alternative',
          chainName: chainInfo.name,
          url: window.location.href,
        }
      }
    }).catch(error => {
      console.error('Failed to track alternative click:', error);
    });

    // Try to open business in Google Maps
    this.openBusinessInMaps(business);
  }

  /**
   * Open business in Google Maps
   */
  openBusinessInMaps(business) {
    try {
      let url;
      
      // Priority 1: Use Google Place ID if available (most reliable)
      if (business.placeId) {
        // Try the correct Google Places URL format
        url = `https://www.google.com/maps/place/?q=place_id:${business.placeId}`;
        console.log('Opening business using Place ID:', business.name, 'Place ID:', business.placeId);
      }
      // Priority 2: Use name + address search for precise results
      else if (business.name && business.address) {
        const query = encodeURIComponent(`${business.name} ${business.address}`);
        url = `https://maps.google.com/maps/search/${query}`;
        console.log('Opening business using name + address search:', business.name);
      } 
      // Priority 3: Search by name only
      else if (business.name) {
        const query = encodeURIComponent(business.name);
        url = `https://maps.google.com/maps/search/${query}`;
        console.log('Opening business using name search:', business.name);
      } 
      // Priority 4: Use coordinates as last resort
      else if (business.latitude && business.longitude) {
        url = `https://maps.google.com/maps?q=${business.latitude},${business.longitude}`;
        console.log('Opening business using coordinates:', business.name);
      } 
      else {
        console.warn('Business has insufficient data for Maps search:', business);
        return;
      }
      
      console.log('Final Maps URL:', url);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Failed to open business in maps:', error);
    }
  }

  /**
   * Hide map pins/markers related to a chain business
   */
  hideRelatedMapPins(businessName) {
    try {
      const cleanName = businessName.toLowerCase().trim();
      console.log(`UIInjector: Attempting to hide map pins for "${businessName}"`);
      
      let hiddenCount = 0;
      
      // Use MutationObserver to continuously hide chain pins as they appear
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.hideChainPinsInElement(node, cleanName);
            }
          });
        });
      });
      
      // Start observing the map area
      const mapContainer = document.querySelector('#map') || document.body;
      observer.observe(mapContainer, {
        childList: true,
        subtree: true
      });
      
      // Store observer for cleanup
      if (!this.mapPinObservers) {
        this.mapPinObservers = [];
      }
      this.mapPinObservers.push(observer);
      
      // Hide existing pins immediately
      hiddenCount = this.hideChainPinsInElement(document, cleanName);
      
      // Add delayed pin hiding to catch rendered map pins
      setTimeout(() => {
        console.log(`UIInjector: Starting delayed pin hiding scan for "${businessName}"`);
        const delayedHiddenCount = this.hideMapPinsWithDelay(cleanName);
        console.log(`UIInjector: Delayed pin hiding found ${delayedHiddenCount} additional elements for ${businessName}`);
      }, 2000);
      
      // Add periodic pin hiding to catch dynamically loaded pins
      const intervalId = setInterval(() => {
        const periodicHiddenCount = this.hideMapPinsWithDelay(cleanName);
        if (periodicHiddenCount > 0) {
          console.log(`UIInjector: Periodic pin hiding found ${periodicHiddenCount} additional elements for ${businessName}`);
        }
      }, 3000);
      
      // Store interval for cleanup
      if (!this.mapPinIntervals) {
        this.mapPinIntervals = [];
      }
      this.mapPinIntervals.push(intervalId);
      
      // Stop periodic checking after 30 seconds
      setTimeout(() => {
        clearInterval(intervalId);
        const index = this.mapPinIntervals.indexOf(intervalId);
        if (index > -1) {
          this.mapPinIntervals.splice(index, 1);
        }
      }, 30000);
      
      console.log(`UIInjector: Set up pin hiding for ${businessName}, hid ${hiddenCount} existing elements`);
      
    } catch (error) {
      console.error('UIInjector: Failed to hide related map pins:', error);
    }
  }

  /**
   * Hide chain pins within a specific element
   */
  hideChainPinsInElement(element, cleanName) {
    let hiddenCount = 0;
    
    try {
      // Only target specific map elements, avoid major page containers
      const selectors = [
        // Only target specific business listing elements (not entire containers)
        '.hfpxzc', // Individual business links
        '.Nv2PK.THOPZb.CpccDe', // Individual business result containers
        // Map-specific elements only
        '.gm-ui-hover-effect', '.maps-sprite-pane-default', '.maps-pin-view',
        '.widget-marker', 
        // Individual buttons and links, not entire containers
        'button[aria-label*="' + cleanName + '"]',
        'a[aria-label*="' + cleanName + '"]',
        // Info windows and popups (small containers only)
        '.gm-style-iw', '.gm-style-iw-c', '.gm-style-iw-d'
      ];
      
      // Critical containers that should NEVER be hidden
      const protectedSelectors = [
        '#app-container',
        '.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde.ecceSd', // Results feed
        '.k7jAl.miFGmb.lJ3Kh', // Side panels  
        '.e07Vkf.kA9KIf', // Scrollable containers
        '[role="feed"]', // Results feeds
        '.vasquette' // Main app container
      ];
      
      selectors.forEach(selector => {
        const elements = element.querySelectorAll ? element.querySelectorAll(selector) : [];
        elements.forEach(el => {
          // Skip if this is a protected element
          if (this.isProtectedElement(el, protectedSelectors)) {
            return;
          }
          
          const text = this.getElementText(el);
          const isMatch = text.includes(cleanName) || this.isChainRelated(el, cleanName);
          
          if (isMatch && !el.hasAttribute('data-lfa-hidden')) {
            // Only hide small, specific elements
            const rect = el.getBoundingClientRect();
            const isLargeContainer = rect.width > 500 || rect.height > 500;
            
            if (!isLargeContainer || this.isSafeToHide(el)) {
              console.log(`UIInjector: Hiding specific element for ${cleanName}:`, el.className, 'size:', rect.width + 'x' + rect.height);
              
              // Use more targeted hiding
              el.style.setProperty('display', 'none', 'important');
              el.setAttribute('data-lfa-hidden', 'true');
              el.setAttribute('data-lfa-chain', cleanName);
              hiddenCount++;
            } else {
              console.log(`UIInjector: Skipping large container for ${cleanName}:`, el.className, 'size:', rect.width + 'x' + rect.height);
            }
          }
        });
      });
      
    } catch (error) {
      console.warn('UIInjector: Error hiding pins in element:', error);
    }
    
    return hiddenCount;
  }

  /**
   * Get all text content from element and its attributes
   */
  getElementText(element) {
    return (
      (element.textContent || '') + ' ' +
      (element.getAttribute('aria-label') || '') + ' ' +
      (element.getAttribute('title') || '') + ' ' +
      (element.getAttribute('data-value') || '') + ' ' +
      (element.getAttribute('alt') || '')
    ).toLowerCase();
  }

  /**
   * Check if element is related to a chain business
   */
  isChainRelated(element, cleanName) {
    // Check if this is a map marker or info window for the chain
    const isMapElement = element.closest('#map') || 
                        element.querySelector('img[src*="marker"]') ||
                        element.classList.contains('gm-style-iw') ||
                        element.hasAttribute('jsaction');
    
    return isMapElement && this.getElementText(element).includes(cleanName);
  }

  /**
   * Check if element is a map container that should be hidden
   */
  isMapContainer(element) {
    return element.classList.contains('gm-style') ||
           element.classList.contains('gm-ui-hover-effect') ||
           element.classList.contains('maps-pin-view') ||
           element.classList.contains('widget-marker') ||
           element.closest('#map') ||
           element.hasAttribute('jsaction');
  }

  /**
   * Check if element is protected from being hidden (major containers)
   */
  isProtectedElement(element, protectedSelectors) {
    // Check if element matches any protected selector
    for (const selector of protectedSelectors) {
      if (element.matches && element.matches(selector)) {
        return true;
      }
      if (element.id && selector.includes('#' + element.id)) {
        return true;
      }
    }
    
    // Check if element is a major page container by ID or class patterns
    const protectedPatterns = [
      'app-container', 'vasquette', 'id-app-container',
      'm6QErb', 'DxyBCb', 'kA9KIf', 'dS8AEf', 'XiKgde', 'ecceSd', // Results feed classes
      'k7jAl', 'miFGmb', 'lJ3Kh', // Side panel classes
      'e07Vkf' // Scrollable container
    ];
    
    return protectedPatterns.some(pattern => 
      element.id?.includes(pattern) || 
      element.className?.includes(pattern)
    );
  }

  /**
   * Check if element is safe to hide (small, specific elements)
   */
  isSafeToHide(element) {
    // Safe elements are specific business links or small components
    return element.matches('.hfpxzc') || // Business links
           element.matches('button') ||   // Individual buttons
           element.matches('a') ||        // Individual links
           element.matches('.gm-style-iw'); // Info windows
  }

  /**
   * Hide map pins with delay - targets actual Google Maps pin elements
   */
  hideMapPinsWithDelay(cleanName) {
    let hiddenCount = 0;
    
    try {
      // Look for Google Maps pin and overlay elements
      const mapContainer = document.querySelector('#map');
      if (!mapContainer) {
        console.log(`UIInjector: No #map container found for ${cleanName}`);
        return 0;
      }
      
      console.log(`UIInjector: Map container found, scanning for pins containing "${cleanName}"`);
      
      // Target actual Google Maps pin elements and overlays
      const pinSelectors = [
        // Map markers/pins (typical Google Maps classes)
        '[role="button"]', // Most map pins are buttons
        '[role="img"]',    // Some pins are images
        '.gm-style-iw',    // Info windows
        '.gm-style-cc',    // Map controls
        '[data-value]',    // Elements with data values
        '[jsaction]'       // Interactive elements
      ];
      
      pinSelectors.forEach(selector => {
        const elements = mapContainer.querySelectorAll(selector);
        console.log(`UIInjector: Found ${elements.length} elements for selector "${selector}"`);
        
        elements.forEach((element, index) => {
          const text = this.getElementText(element);
          
          // Log a sample of elements for debugging
          if (index < 5 && text.length > 0) {
            console.log(`UIInjector: Sample element ${index} (${selector}): "${text.substring(0, 100)}"`);
          }
          
          // More flexible matching - check for partial names too
          const isMatch = text.includes(cleanName) || 
                         text.includes(cleanName.split(' ')[0]) || // First word match
                         (cleanName.includes('whole foods') && text.includes('whole')) ||
                         (cleanName.includes('safeway') && text.includes('safeway')) ||
                         (cleanName.includes('fry') && text.includes('fry'));
          
          if (isMatch && !element.hasAttribute('data-lfa-hidden')) {
            console.log(`UIInjector: MATCH FOUND for ${cleanName}:`, text.substring(0, 100));
            const rect = element.getBoundingClientRect();
            
            // Skip elements that are too large (probably containers)
            if (rect.width > 300 || rect.height > 300) {
              return;
            }
            
            // Skip if element has no visible content
            if (rect.width === 0 && rect.height === 0) {
              return;
            }
            
            console.log(`UIInjector: Hiding map pin for ${cleanName}:`, {
              element: element.tagName,
              class: element.className,
              role: element.getAttribute('role'),
              size: `${rect.width}x${rect.height}`,
              text: text.substring(0, 100),
              hasJsAction: !!element.getAttribute('jsaction')
            });
            
            // Hide the element with multiple approaches
            element.style.setProperty('display', 'none', 'important');
            element.style.setProperty('visibility', 'hidden', 'important');
            element.style.setProperty('opacity', '0', 'important');
            element.style.setProperty('pointer-events', 'none', 'important');
            element.style.setProperty('transform', 'scale(0)', 'important');
            element.setAttribute('data-lfa-hidden', 'true');
            element.setAttribute('data-lfa-chain', cleanName);
            hiddenCount++;
            
            // Also try to hide parent if it looks like a pin container
            const parent = element.parentElement;
            if (parent && parent.children.length === 1 && !parent.hasAttribute('data-lfa-hidden')) {
              const parentRect = parent.getBoundingClientRect();
              if (parentRect.width < 100 && parentRect.height < 100) {
                parent.style.setProperty('display', 'none', 'important');
                parent.setAttribute('data-lfa-hidden-parent', 'true');
                console.log(`UIInjector: Also hiding parent pin container for ${cleanName}`);
              }
            }
          }
        });
      });
      
    } catch (error) {
      console.warn('UIInjector: Error in delayed pin hiding:', error);
    }
    
    return hiddenCount;
  }

  /**
   * Show map pins for local alternative businesses
   */
  async showAlternativeMapPins(alternatives) {
    try {
      console.log(`UIInjector: Attempting to show ${alternatives.length} alternative map pins using MapPinManager`);
      
      // Initialize MapPinManager if not already done
      if (!mapPinManager.isInitialized) {
        console.log('UIInjector: Initializing MapPinManager...');
        try {
          await mapPinManager.init();
          console.log('UIInjector: MapPinManager initialized successfully');
        } catch (initError) {
          console.error('UIInjector: MapPinManager initialization failed:', initError);
          throw initError;
        }
      }
      
      // Set up bidirectional hover interactions
      mapPinManager.setHoverCallbacks(
        (business, isHovering) => this.handlePinHover(business, isHovering),
        (business, event) => this.handlePinClick(business, event)
      );
      
      // Show pins for alternatives
      console.log('UIInjector: Calling mapPinManager.showPinsForBusinesses with:', alternatives);
      mapPinManager.showPinsForBusinesses(alternatives);
      console.log('UIInjector: MapPinManager pin display completed');
      
    } catch (error) {
      console.error('UIInjector: Failed to show alternative map pins:', error);
      console.log('UIInjector: Error details:', {
        error: error.message,
        stack: error.stack,
        alternatives: alternatives,
        mapPinManagerInitialized: mapPinManager.isInitialized
      });
    }
  }

  /**
   * Create a custom map marker overlay for local business
   */
  createCustomMapMarker(business) {
    try {
      // Find the map container
      const mapContainer = document.querySelector('#map canvas') || 
                          document.querySelector('[role="application"]') ||
                          document.querySelector('.gm-style');
      
      if (!mapContainer) {
        console.warn('UIInjector: Could not find map container for custom marker');
        return;
      }
      
      // Create a custom marker element
      const marker = document.createElement('div');
      marker.className = 'lfa-custom-marker';
      marker.style.cssText = `
        position: absolute;
        width: 30px;
        height: 30px;
        background: #4CAF50;
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        font-size: 12px;
        font-weight: bold;
        color: white;
      `;
      marker.textContent = '🏪';
      marker.title = `${business.name} - Local Alternative`;
      
      // Add click handler
      marker.addEventListener('click', () => {
        this.handleAlternativeMapPinClick(business);
      });
      
      // Position the marker (this is a rough approximation)
      // In a real implementation, you'd need proper coordinate conversion
      marker.style.top = '50%';
      marker.style.left = '50%';
      marker.style.transform = 'translate(-50%, -50%)';
      
      // Add to map container
      mapContainer.appendChild(marker);
      
      console.log(`UIInjector: Created custom map marker for ${business.name}`);
      
    } catch (error) {
      console.error('UIInjector: Failed to create custom map marker:', error);
    }
  }

  /**
   * Handle click on alternative map pin
   */
  handleAlternativeMapPinClick(business) {
    // Show business info popup or navigate to it
    const info = `${business.name}\n${business.address}\n${business.distance ? business.distance.toFixed(1) + ' mi away' : 'Near you'}`;
    alert(info);
    
    // Track the click
    this.handleAlternativeClick(business, { name: 'map-pin-click' });
  }

  /**
   * Remove all injected UI elements from an element
   */
  removeInjectedElements(element) {
    const injected = this.injectedElements.get(element);
    if (injected) {
      try {
        if (injected.badge && injected.badge.parentElement) {
          injected.badge.parentElement.removeChild(injected.badge);
        }
        if (injected.alternatives && injected.alternatives.parentElement) {
          injected.alternatives.parentElement.removeChild(injected.alternatives);
        }
        if (injected.placeholder && injected.placeholder.parentElement) {
          injected.placeholder.parentElement.removeChild(injected.placeholder);
        }
        
        // Remove CSS classes
        element.classList.remove('lfa-chain-business', 'lfa-chain-hidden');
        
        this.injectedElements.delete(element);
      } catch (error) {
        console.error('UIInjector: Failed to remove injected elements:', error);
      }
    }
  }

  /**
   * Handle pin hover from MapPinManager
   */
  handlePinHover(business, isHovering) {
    // This is called when pins are hovered - highlight the corresponding sidebar listing
    try {
      const alternativeItems = document.querySelectorAll('.lfa-alternative-item');
      
      alternativeItems.forEach(item => {
        const nameElement = item.querySelector('.lfa-alternative-name');
        if (nameElement && nameElement.textContent.trim() === business.name) {
          if (isHovering) {
            item.style.backgroundColor = '#e8f0fe';
            item.style.transform = 'scale(1.02)';
            item.style.transition = 'all 0.2s ease';
            item.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
          } else {
            item.style.backgroundColor = '';
            item.style.transform = '';
            item.style.boxShadow = '';
          }
        }
      });
    } catch (error) {
      console.warn('UIInjector: Error handling pin hover:', error);
    }
  }

  /**
   * Handle pin click from MapPinManager
   */
  handlePinClick(business, event) {
    // This is called when pins are clicked - could trigger the alternative click handler
    console.log('UIInjector: Pin clicked for business:', business.name);
    // The info window is already handled by MapPinManager
  }

  /**
   * Clean up orphaned placeholder elements that may be causing stacking issues
   */
  cleanupOrphanedPlaceholders() {
    try {
      const placeholders = document.querySelectorAll('.lfa-chain-placeholder');
      console.log(`UIInjector: Found ${placeholders.length} placeholder elements for cleanup check`);
      
      placeholders.forEach((placeholder, index) => {
        // Remove placeholders that appear to be duplicates or misplaced
        const chainName = placeholder.getAttribute('data-chain-name');
        const parentRect = placeholder.parentElement?.getBoundingClientRect();
        
        // Check if placeholder is positioned outside the main content area (stacking to the right)
        if (parentRect && parentRect.left > window.innerWidth * 0.6) {
          console.log(`UIInjector: Removing misplaced placeholder for ${chainName} (positioned at x: ${parentRect.left})`);
          placeholder.remove();
        }
        
        // Remove excessive placeholders (more than 5 suggests a problem)
        if (index > 4) {
          console.log(`UIInjector: Removing excess placeholder #${index} for ${chainName}`);
          placeholder.remove();
        }
      });
      
    } catch (error) {
      console.error('UIInjector: Error cleaning up orphaned placeholders:', error);
    }
  }

  /**
   * Clear all injected elements (for page navigation)
   */
  clearAllInjectedElements() {
    // Remove filter status
    this.hideFilterStatus();
    
    // Clear MapPinManager pins
    if (mapPinManager.isInitialized) {
      mapPinManager.clearAllPins();
    }
    
    // Clear observers and intervals
    if (this.mapPinObservers) {
      this.mapPinObservers.forEach(observer => observer.disconnect());
      this.mapPinObservers = [];
    }
    
    if (this.targetedPinObservers) {
      this.targetedPinObservers.forEach(observer => observer.disconnect());
      this.targetedPinObservers = [];
    }
    
    if (this.mapPinIntervals) {
      this.mapPinIntervals.forEach(intervalId => clearInterval(intervalId));
      this.mapPinIntervals = [];
    }
    
    // Clear hidden business data
    if (this.hiddenBusinessData) {
      this.hiddenBusinessData.clear();
    }
    
    // Remove all class-based modifications
    document.querySelectorAll('.lfa-chain-business, .lfa-chain-hidden').forEach(element => {
      element.classList.remove('lfa-chain-business', 'lfa-chain-hidden');
    });
    
    // Clean up orphaned placeholders first
    this.cleanupOrphanedPlaceholders();
    
    // Remove all injected elements including placeholders
    document.querySelectorAll('.lfa-badge, .lfa-alternatives, .lfa-chain-placeholder').forEach(element => {
      element.remove();
    });
    
    // Restore hidden map pins and parent containers
    document.querySelectorAll('[data-lfa-hidden="true"]').forEach(element => {
      element.style.display = '';
      element.style.visibility = '';
      element.style.opacity = '';
      element.style.pointerEvents = '';
      element.style.transform = '';
      element.removeAttribute('data-lfa-hidden');
      element.removeAttribute('data-lfa-chain');
    });
    
    document.querySelectorAll('[data-lfa-hidden-parent="true"]').forEach(element => {
      element.style.display = '';
      element.removeAttribute('data-lfa-hidden-parent');
    });
    
    // Clear tracking
    this.injectedElements = new WeakMap();
    
    console.log('UIInjector: Cleared all injected elements');
  }

  /**
   * Get injector status for debugging
   */
  getStatus() {
    return {
      hasStyleSheet: !!this.styleSheet,
      injectedElementsCount: this.injectedElements.size || 'unknown', // WeakMap doesn't have size
    };
  }
}

// Create singleton instance
export const uiInjector = new UIInjector();