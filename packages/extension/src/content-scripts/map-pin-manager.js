import { CONFIG } from '../shared/constants.js';
import { coordinateConverter } from './coordinate-converter.js';

/**
 * MapPinManager - Handles interactive map pins for local alternatives
 * Creates an overlay system that works with Google Maps to show local business pins
 */
export class MapPinManager {
  constructor() {
    this.overlayContainer = null;
    this.pins = new Map(); // Map of businessId -> pin element
    this.businessData = new Map(); // Map of businessId -> business data
    this.infoWindow = null;
    this.currentBounds = null;
    this.currentZoom = null;
    this.mapContainer = null;
    this.isInitialized = false;
    
    // Event handlers that need to be bound
    this.handleMapChange = this.handleMapChange.bind(this);
    this.handlePinHover = this.handlePinHover.bind(this);
    this.handlePinClick = this.handlePinClick.bind(this);
    
    // Throttle map updates for performance
    this.updateThrottle = 50; // ms - reduced for more responsive updates
    this.lastUpdate = 0;
    
    // Pin interaction callbacks
    this.onPinHover = null;
    this.onPinClick = null;
  }

  /**
   * Initialize the pin manager system
   */
  async init() {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('MapPinManager: Initializing...');
      
      // Find and set up map container
      await this.setupMapContainer();
      
      // Create overlay system
      this.createOverlaySystem();
      
      // Set up event listeners
      this.setupEventListeners();
      
      this.isInitialized = true;
      console.log('MapPinManager: Initialized successfully');
      
    } catch (error) {
      console.error('MapPinManager: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Find and set up the Google Maps container
   */
  async setupMapContainer() {
    // Try multiple selectors to find the map container
    const selectors = [
      '#scene', // Primary map canvas container
      '[role="region"]', // Map region
      '.gm-style', // Google Maps style container
      '#map', // Generic map ID
      '.widget-scene-canvas', // Canvas container
      '[data-scene]', // Scene container
      '.maps-page', // Maps page container
      'div[jsaction*="map"]', // Elements with map actions
      'div[data-component-id*="scene"]' // Components with scene ID
    ];

    console.log('MapPinManager: Searching for map container...');
    
    for (const selector of selectors) {
      try {
        const containers = document.querySelectorAll(selector);
        console.log(`MapPinManager: Found ${containers.length} elements for selector "${selector}"`);
        
        for (const container of containers) {
          const rect = container.getBoundingClientRect();
          console.log(`MapPinManager: Checking container - size: ${rect.width}x${rect.height}, visible: ${rect.width > 0 && rect.height > 0}`);
          
          if (rect.width > 200 && rect.height > 200) { // Must be reasonably sized
            this.mapContainer = container;
            console.log('MapPinManager: Found map container:', selector, 'size:', `${rect.width}x${rect.height}`);
            return;
          }
        }
      } catch (error) {
        console.warn('MapPinManager: Error with selector', selector, error);
      }
    }

    // Fallback: try to find any large container that might be the map
    const allDivs = document.querySelectorAll('div');
    for (const div of allDivs) {
      const rect = div.getBoundingClientRect();
      if (rect.width > 400 && rect.height > 300) {
        // Check if it looks like a map container
        const hasMapLikeContent = div.querySelector('canvas') || 
                                 div.querySelector('img[src*="maps"]') ||
                                 div.querySelector('[role="button"][aria-label*="map"]');
        if (hasMapLikeContent) {
          this.mapContainer = div;
          console.log('MapPinManager: Found map container via fallback:', div.className, 'size:', `${rect.width}x${rect.height}`);
          return;
        }
      }
    }

    throw new Error('MapPinManager: Could not find valid map container');
  }

  /**
   * Create the overlay system for pins
   */
  createOverlaySystem() {
    if (this.overlayContainer) {
      return; // Already created
    }

    // Create transparent overlay that sits above the map
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.id = 'lfa-pin-overlay';
    this.overlayContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 100;
      overflow: hidden;
    `;

    // Insert overlay as a child of the map container
    this.mapContainer.appendChild(this.overlayContainer);
    console.log('MapPinManager: Created overlay system');
  }

  /**
   * Set up event listeners for map changes
   */
  setupEventListeners() {
    // Listen for map container size changes
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => {
        this.handleMapChange('resize');
      });
      resizeObserver.observe(this.mapContainer);
    }

    // Listen for URL changes (indicates map navigation)
    let lastUrl = window.location.href;
    setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        console.log('MapPinManager: URL changed from', lastUrl, 'to', currentUrl);
        lastUrl = currentUrl;
        this.handleMapChange('navigation');
      }
    }, 300); // More frequent checking for better responsiveness

    // Listen for scroll/wheel events on map (zoom) - multiple triggers for reliability
    this.mapContainer.addEventListener('wheel', () => {
      setTimeout(() => this.handleMapChange('zoom'), 200);
    }, { passive: true });

    // Listen for mouse events on map (pan)
    this.mapContainer.addEventListener('mouseup', () => {
      setTimeout(() => this.handleMapChange('pan'), 200);
    }, { passive: true });

    // Listen for touch events on mobile
    this.mapContainer.addEventListener('touchend', () => {
      setTimeout(() => this.handleMapChange('touch'), 200);
    }, { passive: true });

    // Listen for keyboard navigation
    this.mapContainer.addEventListener('keyup', () => {
      setTimeout(() => this.handleMapChange('keyboard'), 200);
    }, { passive: true });

    // Additional zoom detection via MutationObserver for map content changes
    if (window.MutationObserver) {
      const mapObserver = new MutationObserver((mutations) => {
        const hasMapChanges = mutations.some(mutation => 
          mutation.target && (
            mutation.target.classList?.contains('gm-style') ||
            mutation.target.querySelector?.('.gm-style')
          )
        );
        
        if (hasMapChanges) {
          setTimeout(() => this.handleMapChange('dom-change'), 100);
        }
      });
      
      mapObserver.observe(this.mapContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'transform']
      });
    }

    console.log('MapPinManager: Enhanced event listeners set up');
  }

  /**
   * Handle map changes (zoom, pan, resize)
   */
  handleMapChange(type) {
    const now = Date.now();
    if (now - this.lastUpdate < this.updateThrottle) {
      return; // Throttle updates
    }
    this.lastUpdate = now;

    console.log('MapPinManager: Map change detected:', type);
    this.updatePinPositions();
  }

  /**
   * Extract current map bounds and zoom from Google Maps
   */
  extractMapBounds() {
    return coordinateConverter.extractMapBounds();
  }

  /**
   * Convert latitude/longitude to pixel coordinates within the overlay
   */
  latLngToPixel(lat, lng, mapBounds, containerSize) {
    if (!mapBounds || !containerSize) {
      return null;
    }

    try {
      // Use the coordinate converter for more accurate projection
      return coordinateConverter.latLngToPixel(lat, lng, mapBounds, containerSize);
    } catch (error) {
      console.error('MapPinManager: Failed to convert lat/lng to pixel:', error);
      return null;
    }
  }

  /**
   * Show pins for an array of businesses
   */
  showPinsForBusinesses(businesses) {
    if (!this.isInitialized || !businesses || businesses.length === 0) {
      return;
    }

    console.log('MapPinManager: Showing pins for', businesses.length, 'businesses');

    // Clear existing pins
    this.clearAllPins();

    // Create new pins
    businesses.forEach((business, index) => {
      this.createPin(business, index);
    });

    // Update positions
    this.updatePinPositions();
  }

  /**
   * Create a pin for a single business
   */
  createPin(business, index) {
    if (!business.latitude || !business.longitude) {
      console.warn('MapPinManager: Skipping business without coordinates:', business.name);
      return;
    }

    const pin = document.createElement('div');
    pin.className = 'lfa-map-pin';
    pin.setAttribute('data-business-id', business.id);
    pin.style.cssText = `
      position: absolute;
      pointer-events: auto;
      cursor: pointer;
      transform: translate(-50%, -100%);
      transition: all 0.2s ease;
      z-index: ${101 + index};
    `;

    // Store business data for later retrieval
    this.businessData.set(business.id, business);

    // Create pin SVG with Local First Arizona branding
    pin.innerHTML = this.createPinSVG(business, index);

    // Add event listeners
    pin.addEventListener('mouseenter', (e) => this.handlePinHover(e, business, true));
    pin.addEventListener('mouseleave', (e) => this.handlePinHover(e, business, false));
    pin.addEventListener('click', (e) => this.handlePinClick(e, business));

    // Add to overlay
    this.overlayContainer.appendChild(pin);
    this.pins.set(business.id, pin);

    console.log('MapPinManager: Created pin for', business.name);
  }

  /**
   * Create SVG for pin with Local First Arizona branding
   */
  createPinSVG(business, index) {
    const gradientId = `lfa-gradient-${business.id}`;
    
    return `
      <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#4CAF50;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#2E7D32;stop-opacity:1" />
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.3)"/>
          </filter>
        </defs>
        
        <!-- Pin shape -->
        <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" 
              fill="url(#${gradientId})" 
              stroke="#1B5E20" 
              stroke-width="1"
              filter="url(#shadow)"/>
        
        <!-- Inner circle -->
        <circle cx="16" cy="16" r="10" fill="white" stroke="#2E7D32" stroke-width="1"/>
        
        <!-- LFA text -->
        <text x="16" y="20" text-anchor="middle" 
              font-family="Arial, sans-serif" 
              font-size="8" 
              font-weight="bold" 
              fill="#2E7D32">LFA</text>
      </svg>
    `;
  }

  /**
   * Update positions of all pins based on current map state
   */
  updatePinPositions() {
    const mapBounds = this.extractMapBounds();
    if (!mapBounds) {
      console.warn('MapPinManager: Could not extract map bounds for positioning');
      return;
    }

    const containerSize = {
      width: this.overlayContainer.offsetWidth,
      height: this.overlayContainer.offsetHeight
    };
    
    console.log('MapPinManager: Updating pin positions with:', {
      mapBounds,
      containerSize,
      totalPins: this.pins.size
    });

    let visiblePins = 0;
    this.pins.forEach((pin, businessId) => {
      const businessData = this.getBusinessDataFromPin(pin);
      if (!businessData) {
        console.warn('MapPinManager: No business data for pin:', businessId);
        return;
      }

      console.log(`MapPinManager: Positioning pin for ${businessData.name} at (${businessData.latitude}, ${businessData.longitude})`);

      const pixelPos = this.latLngToPixel(
        businessData.latitude, 
        businessData.longitude, 
        mapBounds, 
        containerSize
      );

      if (pixelPos) {
        pin.style.left = `${pixelPos.x}px`;
        pin.style.top = `${pixelPos.y}px`;
        pin.style.display = 'block';
        pin.style.position = 'absolute';
        visiblePins++;
        
        console.log(`MapPinManager: Pin positioned at (${pixelPos.x}, ${pixelPos.y}) for ${businessData.name}`);
      } else {
        pin.style.display = 'none';
        console.log(`MapPinManager: Pin hidden (outside bounds) for ${businessData.name}`);
      }
    });

    console.log(`MapPinManager: Updated positions for ${this.pins.size} pins, ${visiblePins} visible`);
  }

  /**
   * Extract business data from pin element (helper method)
   */
  getBusinessDataFromPin(pin) {
    const businessId = pin.getAttribute('data-business-id');
    if (businessId && this.businessData.has(businessId)) {
      return this.businessData.get(businessId);
    }
    
    // Fallback to Phoenix area default if no data found
    console.warn('MapPinManager: No business data found for pin, using fallback');
    return {
      latitude: 33.4484, // Phoenix area default
      longitude: -112.0740,
      name: 'Unknown Business'
    };
  }

  /**
   * Handle pin hover events
   */
  handlePinHover(event, business, isEntering) {
    const pin = event.currentTarget;
    
    if (isEntering) {
      pin.style.transform = 'translate(-50%, -100%) scale(1.1)';
      pin.style.zIndex = '200';
      
      // Highlight corresponding sidebar listing
      this.highlightSidebarListing(business.id, true);
      
      // Call external hover callback if set
      if (this.onPinHover) {
        this.onPinHover(business, true);
      }
      
      console.log('MapPinManager: Hovering over', business.name);
    } else {
      pin.style.transform = 'translate(-50%, -100%) scale(1)';
      pin.style.zIndex = '';
      
      // Remove sidebar listing highlight
      this.highlightSidebarListing(business.id, false);
      
      // Call external hover callback if set
      if (this.onPinHover) {
        this.onPinHover(business, false);
      }
    }
  }

  /**
   * Handle pin click events
   */
  handlePinClick(event, business) {
    event.stopPropagation();
    console.log('MapPinManager: Clicked pin for', business.name);
    
    // Show info window
    this.showInfoWindow(business, event.currentTarget);
    
    // Call external click callback if set
    if (this.onPinClick) {
      this.onPinClick(business, event);
    }
  }

  /**
   * Show info window for business
   */
  showInfoWindow(business, pinElement) {
    console.log('MapPinManager: Showing info window for', business.name);
    
    // Remove any existing info window
    this.hideInfoWindow();
    
    // Create info window
    this.infoWindow = this.createInfoWindow(business);
    
    // Position it relative to the pin
    const pinRect = pinElement.getBoundingClientRect();
    const overlayRect = this.overlayContainer.getBoundingClientRect();
    
    // Position above the pin
    this.infoWindow.style.left = `${pinRect.left - overlayRect.left}px`;
    this.infoWindow.style.top = `${pinRect.top - overlayRect.top - 10}px`;
    this.infoWindow.style.transform = 'translate(-50%, -100%)';
    
    // Add to overlay
    this.overlayContainer.appendChild(this.infoWindow);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hideInfoWindow();
    }, 5000);
  }

  /**
   * Create Google Maps-style info window
   */
  createInfoWindow(business) {
    const infoWindow = document.createElement('div');
    infoWindow.className = 'lfa-info-window';
    infoWindow.style.cssText = `
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
    `;
    
    // Create arrow pointing to pin
    const arrow = document.createElement('div');
    arrow.style.cssText = `
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid white;
    `;
    infoWindow.appendChild(arrow);
    
    // Business name
    const name = document.createElement('div');
    name.style.cssText = `
      font-weight: 600;
      color: #1a73e8;
      margin-bottom: 4px;
      cursor: pointer;
    `;
    name.textContent = business.name;
    name.addEventListener('click', () => {
      this.openBusinessInMaps(business);
    });
    infoWindow.appendChild(name);
    
    // Business address
    if (business.address) {
      const address = document.createElement('div');
      address.style.cssText = `
        color: #5f6368;
        font-size: 13px;
        margin-bottom: 4px;
      `;
      address.textContent = business.address;
      infoWindow.appendChild(address);
    }
    
    // Distance
    if (business.distance) {
      const distance = document.createElement('div');
      distance.style.cssText = `
        color: #5f6368;
        font-size: 13px;
        margin-bottom: 8px;
      `;
      distance.textContent = `${business.distance.toFixed(1)} mi away`;
      infoWindow.appendChild(distance);
    }
    
    // Verified badge
    if (business.verified) {
      const badge = document.createElement('div');
      badge.style.cssText = `
        background: #4CAF50;
        color: white;
        font-size: 11px;
        padding: 3px 6px;
        border-radius: 4px;
        display: inline-block;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        font-weight: 600;
      `;
      badge.textContent = 'Verified Local';
      infoWindow.appendChild(badge);
    }
    
    return infoWindow;
  }

  /**
   * Hide the current info window
   */
  hideInfoWindow() {
    if (this.infoWindow) {
      this.infoWindow.remove();
      this.infoWindow = null;
    }
  }

  /**
   * Open business in Google Maps
   */
  openBusinessInMaps(business) {
    try {
      let url;
      
      // Priority 1: Search by name and address (most reliable for real businesses)
      if (business.name && business.address) {
        console.log('MapPinManager: Using name+address search for', business.name);
        const query = encodeURIComponent(`${business.name} ${business.address}`);
        url = `https://www.google.com/maps/search/${query}`;
      } 
      // Priority 2: Use validated PlaceID if available (only for verified real PlaceIDs)
      else if (business.placeId && business.placeId.length > 15 && !business.placeId.includes('Example') && !business.placeId.includes('ChIJ')) {
        console.log('MapPinManager: Using validated PlaceID for', business.name, ':', business.placeId);
        url = `https://www.google.com/maps/place/?q=place_id:${business.placeId}`;
      }
      // Priority 3: Search by coordinates with business name
      else if (business.latitude && business.longitude && business.name) {
        console.log('MapPinManager: Using coordinates+name search for', business.name);
        const query = encodeURIComponent(`${business.name} Phoenix AZ`);
        url = `https://www.google.com/maps/search/${query}/@${business.latitude},${business.longitude},17z`;
      }
      // Priority 4: Search by name only with Phoenix context
      else if (business.name) {
        console.log('MapPinManager: Using name-only search for', business.name);
        const query = encodeURIComponent(`${business.name} Phoenix AZ`);
        url = `https://www.google.com/maps/search/${query}`;
      } else {
        console.warn('MapPinManager: No valid data to open business in maps:', business);
        return;
      }
      
      console.log('MapPinManager: Opening URL:', url);
      window.open(url, '_blank');
    } catch (error) {
      console.error('MapPinManager: Failed to open business in maps:', error);
    }
  }

  /**
   * Highlight sidebar listing for a business
   */
  highlightSidebarListing(businessId, highlight = true) {
    try {
      // Find the corresponding sidebar element by business ID or name
      const business = this.businessData.get(businessId);
      if (!business) return;
      
      // Look for alternative listings that match this business
      const alternativeItems = document.querySelectorAll('.lfa-alternative-item');
      
      alternativeItems.forEach(item => {
        const nameElement = item.querySelector('.lfa-alternative-name');
        if (nameElement && nameElement.textContent.trim() === business.name) {
          if (highlight) {
            item.style.backgroundColor = '#f0f8ff';
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
      console.warn('MapPinManager: Error highlighting sidebar listing:', error);
    }
  }

  /**
   * Clear all pins from the overlay
   */
  clearAllPins() {
    this.hideInfoWindow();
    
    this.pins.forEach((pin) => {
      pin.remove();
    });
    this.pins.clear();
    this.businessData.clear();
    
    console.log('MapPinManager: Cleared all pins');
  }

  /**
   * Set hover callbacks for bidirectional interaction
   */
  setHoverCallbacks(onPinHover, onPinClick) {
    this.onPinHover = onPinHover;
    this.onPinClick = onPinClick;
  }

  /**
   * Highlight a pin from external trigger (e.g., sidebar hover)
   */
  highlightPinForBusiness(businessId, highlight = true) {
    try {
      const pin = this.pins.get(businessId);
      if (pin) {
        if (highlight) {
          pin.style.transform = 'translate(-50%, -100%) scale(1.15)';
          pin.style.zIndex = '250';
          pin.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))';
        } else {
          pin.style.transform = 'translate(-50%, -100%) scale(1)';
          pin.style.zIndex = '';
          pin.style.filter = '';
        }
      }
    } catch (error) {
      console.warn('MapPinManager: Error highlighting pin:', error);
    }
  }

  /**
   * Get all pins for external access
   */
  getPins() {
    return Array.from(this.pins.entries()).map(([businessId, pinElement]) => {
      const business = this.businessData.get(businessId);
      return {
        businessId,
        business,
        pinElement
      };
    });
  }

  /**
   * Destroy the pin manager and clean up
   */
  destroy() {
    this.clearAllPins();
    
    if (this.overlayContainer) {
      this.overlayContainer.remove();
      this.overlayContainer = null;
    }
    
    this.isInitialized = false;
    console.log('MapPinManager: Destroyed');
  }
}

// Create global instance
export const mapPinManager = new MapPinManager();

// Debug log to confirm the module loaded
console.log('MapPinManager: Module loaded and instance created');

// Make available for debugging
if (typeof window !== 'undefined') {
  window.LFA_mapPinManager = mapPinManager;
}