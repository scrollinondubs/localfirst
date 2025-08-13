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

      /* Local Alternative Suggestions */
      .lfa-alternatives {
        background: #f8f9fa;
        border: 1px solid #e8eaed;
        border-radius: 8px;
        padding: 8px;
        margin: 4px 0;
        font-size: 12px;
        position: relative;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }

      .lfa-alternatives-header {
        font-weight: 600;
        color: #2E7D32;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
      }

      .lfa-alternatives-header::before {
        content: '🏪';
        margin-right: 4px;
        font-size: 11px;
      }

      .lfa-alternative-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 0;
        border-bottom: 1px solid #f0f0f0;
      }

      .lfa-alternative-item:last-child {
        border-bottom: none;
      }

      .lfa-alternative-name {
        font-weight: 500;
        color: #1a73e8;
        cursor: pointer;
        flex: 1;
      }

      .lfa-alternative-name:hover {
        text-decoration: underline;
      }

      .lfa-alternative-distance {
        font-size: 10px;
        color: #70757a;
        margin-left: 8px;
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
   * Show local alternatives when chain is filtered
   */
  showLocalAlternatives(element, chainInfo, alternatives) {
    if (!alternatives || alternatives.length === 0) {
      return;
    }

    try {
      const alternativesElement = this.createAlternativesElement(alternatives, chainInfo);
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
    header.textContent = `Local alternatives nearby:`;
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

      const distance = document.createElement('span');
      distance.className = 'lfa-alternative-distance';
      distance.textContent = `${business.distance.toFixed(1)} mi`;

      item.appendChild(name);
      item.appendChild(distance);
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