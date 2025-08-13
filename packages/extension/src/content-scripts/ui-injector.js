import { CONFIG } from '../shared/constants.js';

/**
 * UI Injector for Local First Arizona Extension
 * Handles adding badges, filtering UI, and visual modifications to Google Maps
 */
export class UIInjector {
  constructor() {
    this.injectedElements = new WeakMap();
    this.styleSheet = null;
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

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .lfa-badge {
          border: 2px solid white;
        }
        
        .lfa-chain-business {
          border: 2px solid orange;
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
      
      if (settings.hideChains) {
        element.classList.add('lfa-chain-hidden');
        this.injectedElements.set(element, { type: 'chain-hidden', chainInfo });
        
        // Also hide related map pins
        this.hideRelatedMapPins(chainInfo.name);
        
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
   * Create a placeholder element for hidden chain businesses
   */
  createChainReplacementPlaceholder(element, chainInfo) {
    try {
      // Create a placeholder that will replace the hidden chain
      const placeholder = document.createElement('div');
      placeholder.className = 'lfa-chain-placeholder';
      placeholder.style.cssText = `
        background: #f8f9fa !important;
        border: 1px solid #e8eaed !important;
        border-radius: 8px !important;
        padding: 12px !important;
        margin: 4px 0 !important;
        display: block !important;
        position: relative !important;
        z-index: 1000 !important;
        color: #333 !important;
      `;
      
      // Insert the placeholder after the hidden element
      element.parentNode.insertBefore(placeholder, element.nextSibling);
      
      // Store reference to placeholder
      if (this.injectedElements.has(element)) {
        this.injectedElements.get(element).placeholder = placeholder;
      } else {
        this.injectedElements.set(element, { placeholder: placeholder, type: 'chain-placeholder' });
      }
      
      console.log(`UIInjector: Created placeholder for hidden ${chainInfo.name}`);
    } catch (error) {
      console.error('UIInjector: Failed to create chain placeholder:', error);
    }
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
        // Use the placeholder for hidden chains
        injectedData.placeholder.appendChild(alternativesElement);
        injectedData.placeholder.style.display = 'block'; // Show the placeholder
        injectedData.alternatives = alternativesElement;
        console.log(`UIInjector: Added ${alternatives.length} alternatives to placeholder for ${chainInfo.name}`);
        
        // Also show alternative map pins
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
          
          // Also show alternative map pins
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

      const name = document.createElement('span');
      name.className = 'lfa-alternative-name';
      name.textContent = business.name;
      name.addEventListener('click', () => {
        this.handleAlternativeClick(business, chainInfo);
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
      
      if (business.latitude && business.longitude) {
        // Use coordinates if available
        url = `https://maps.google.com/maps?q=${business.latitude},${business.longitude}`;
      } else {
        // Use name and address
        const query = encodeURIComponent(`${business.name} ${business.address || ''}`);
        url = `https://maps.google.com/maps?q=${query}`;
      }
      
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
   * Show map pins for local alternative businesses
   */
  showAlternativeMapPins(alternatives) {
    try {
      console.log(`UIInjector: Attempting to show ${alternatives.length} alternative map pins`);
      
      // This is a simplified approach - in a real implementation, you'd need to
      // interact with the Google Maps API to add custom markers
      alternatives.forEach(business => {
        // For now, we'll create overlay markers
        this.createCustomMapMarker(business);
      });
      
    } catch (error) {
      console.error('UIInjector: Failed to show alternative map pins:', error);
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
   * Clear all injected elements (for page navigation)
   */
  clearAllInjectedElements() {
    // Remove filter status
    this.hideFilterStatus();
    
    // Remove all class-based modifications
    document.querySelectorAll('.lfa-chain-business, .lfa-chain-hidden').forEach(element => {
      element.classList.remove('lfa-chain-business', 'lfa-chain-hidden');
    });
    
    // Remove all injected elements
    document.querySelectorAll('.lfa-badge, .lfa-alternatives').forEach(element => {
      element.remove();
    });
    
    // Restore hidden map pins
    document.querySelectorAll('[data-lfa-hidden="true"]').forEach(element => {
      element.style.display = '';
      element.removeAttribute('data-lfa-hidden');
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