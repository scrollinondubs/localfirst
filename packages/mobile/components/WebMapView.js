import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { MarkerClusterer } from '@googlemaps/markerclusterer';

const WebMapView = ({ 
  region, 
  onRegionChangeComplete,
  onBoundsChange, // Callback when map viewport changes (for viewport-based loading)
  showsUserLocation = true,
  showsCompass = true,
  showsScale = true,
  children,
  style,
  onMarkerPress,
  selectedBusiness,
  onClearSelection, // Callback to clear selected business when popup is closed
  markers = [], // Add direct marker data prop as backup
  autoFitMarkers = true, // New prop to control auto-fitting
  enableClustering = true, // Enable marker clustering by default
  panToCoordinate = null,
}) => {
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef = useRef([]);
  const lastMarkersRef = useRef([]);
  const markerClustererRef = useRef(null); // For clustering
  const updateCountRef = useRef(0); // Safety counter to prevent infinite loops
  const userMarkerRef = useRef(null);
  const userMarkerPrevPosRef = useRef(null);
  const userMarkerAnimRef = useRef(null);
  // Calculate distance between two lat/lng in meters (haversine)
  const computeDistanceMeters = (lat1, lng1, lat2, lng2) => {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371000; // meters
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Smooth pan animation proportional to distance with clamped duration
  const smoothPanTo = (targetLatLng) => {
    if (!googleMapRef.current || !targetLatLng) return;

    // Cancel any existing pan animation
    if (panAnimationRef.current) {
      cancelAnimationFrame(panAnimationRef.current);
      panAnimationRef.current = null;
    }

    const map = googleMapRef.current;
    const start = map.getCenter();
    const startLat = start.lat();
    const startLng = start.lng();
    const targetLat = targetLatLng.lat();
    const targetLng = targetLatLng.lng();

    const distanceMeters = computeDistanceMeters(
      startLat,
      startLng,
      targetLat,
      targetLng
    );

    // Duration scales with distance, clamped for UX
    const durationMs = Math.max(
      500,
      Math.min(2000, 600 + (distanceMeters / 1000) * 200)
    ); // 0.6s base, +200ms per km, max 2s

    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOutQuad

      const lat = startLat + (targetLat - startLat) * eased;
      const lng = startLng + (targetLng - startLng) * eased;
      map.setCenter(new window.google.maps.LatLng(lat, lng));

      if (t < 1) {
        panAnimationRef.current = requestAnimationFrame(animate);
      } else {
        panAnimationRef.current = null;
      }
    };

    panAnimationRef.current = requestAnimationFrame(animate);
  };
  const panAnimationRef = useRef(null);
  const lastPanTargetRef = useRef(null);

  useEffect(() => {
    if (Platform.OS === 'web' && window.google && window.google.maps) {
      initializeMap();
    } else {
      // Load Google Maps API if not already loaded
      loadGoogleMapsAPI();
    }
  }, []);

  useEffect(() => {
    if (googleMapRef.current && region) {
      updateMapRegion();
    }
  }, [region]);

  useEffect(() => {
    if (
      panToCoordinate &&
      googleMapRef.current &&
      window.google &&
      window.google.maps
    ) {
      const target = new window.google.maps.LatLng(
        panToCoordinate.latitude,
        panToCoordinate.longitude
      );
      lastPanTargetRef.current = target;
      smoothPanTo(target);
    }
  }, [panToCoordinate]);

  useEffect(() => {
    if (googleMapRef.current) {
      updateMarkers();
    }
  }, [selectedBusiness, markers]);

  // Open popup for selected business after map zoom completes
  useEffect(() => {
    if (!selectedBusiness || !googleMapRef.current || !window.google || !window.google.maps) return;
    
    let idleListener = null;
    let timer = null;
    
    const openPopupForSelected = () => {
      // Find the marker for the selected business
      const marker = markersRef.current.find(m => {
        return m.businessData?.id === selectedBusiness.id;
      });
      
      if (marker) {
        // Ensure we zoom enough to break clusters
        const currentZoom = googleMapRef.current.getZoom();
        if (currentZoom < 18) {
          googleMapRef.current.setZoom(18);
        }
        // Center map on the marker to make sure it's visible and uncluttered
        const pos = marker.getPosition();
        if (pos) {
          googleMapRef.current.setCenter(pos);
        }

        // Create and open InfoWindow
        const businessData = marker.businessData || selectedBusiness;
        const address = businessData.address || selectedBusiness.address || selectedBusiness.name;
        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
        const category = businessData.category || selectedBusiness.category || businessData.subcategory || '';
        const distanceRaw = businessData.distance || selectedBusiness.distance;
        // Format distance to one decimal place
        const distance = distanceRaw ? parseFloat(distanceRaw).toFixed(1) : null;
        const description = `${category}${distance ? ' • ' + distance + ' mi' : ''}`;
        
        // Create InfoWindow with close button on same line as title
        const infoWindow = new window.google.maps.InfoWindow();
        const closeFuncName = `closeInfoWindow_${selectedBusiness.id || 'selected'}`;
        const selectedBusinessId = selectedBusiness.id || 'selected';
        
        const content = `
          <div style="max-width: 200px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
              <strong style="font-size: 14px; color: #1a1a1a; flex: 1; margin-right: 8px; line-height: 1.3;">${selectedBusiness.name}</strong>
              <button id="closeBtn_${selectedBusinessId}" onclick="if(window.${closeFuncName}){window.${closeFuncName}();}" 
                      style="background: none; border: none; color: #666; font-size: 20px; cursor: pointer; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; line-height: 1; flex-shrink: 0; margin-top: -2px;" 
                      title="Close">×</button>
            </div>
            <span style="font-size: 12px; color: #666; margin-top: 4px; display: block;">${description}</span>
            ${address ? `<div style="font-size: 11px; color: #888; margin-top: 6px; line-height: 1.3;">${address}</div>` : ''}
            <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" 
               style="display: inline-flex; align-items: center; margin-top: 8px; padding: 6px 10px; 
                      background: #4285f4; color: white; text-decoration: none; border-radius: 4px; 
                      font-size: 12px; font-weight: 500; transition: background 0.2s;">
              <span style="margin-right: 4px;">🗺️</span>
              Open in Google Maps
            </a>
          </div>
        `;
        
        // Store close function on window object
        window[closeFuncName] = () => {
          infoWindow.close();
          // Clear selected business to prevent popup from reopening
          if (onClearSelection) {
            onClearSelection();
          }
          // Clean up function after closing
          setTimeout(() => {
            if (window[closeFuncName]) {
              delete window[closeFuncName];
            }
          }, 100);
        };
        
        infoWindow.setContent(content);
        
        // Use domready event to ensure button click handler works
        window.google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
          const closeButton = document.getElementById(`closeBtn_${selectedBusinessId}`);
          if (closeButton) {
            closeButton.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (window[closeFuncName]) {
                window[closeFuncName]();
              }
            });
          }
        });
        
        infoWindow.open(googleMapRef.current, marker);
        console.log('[MAP] ✅ Opened popup for selected business:', selectedBusiness.name);
      } else {
        // If marker not found, try again after a short delay (clustering might still be updating)
        timer = setTimeout(openPopupForSelected, 300);
      }
    };
    
    // Listen for map 'idle' event (fires when map finishes moving/zooming)
    idleListener = window.google.maps.event.addListenerOnce(
      googleMapRef.current,
      'idle',
      () => {
        // Wait a bit more for clustering to update after map becomes idle
        timer = setTimeout(openPopupForSelected, 200);
      }
    );
    
    return () => {
      if (idleListener) {
        window.google.maps.event.removeListener(idleListener);
      }
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [selectedBusiness, region]);

  const loadGoogleMapsAPI = () => {
    if (window.google && window.google.maps) {
      initializeMap();
      return;
    }

    const googleMapsKey = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      : 'YOUR_GOOGLE_MAPS_API_KEY';
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&callback=initMap`;
    script.async = true;
    
    window.initMap = () => {
      initializeMap();
    };
    
    document.head.appendChild(script);
  };

  const initializeMap = () => {
    console.log('initializeMap called', { 
      hasMapRef: !!mapRef.current, 
      hasExistingMap: !!googleMapRef.current,
      hasGoogleMaps: !!(window.google && window.google.maps)
    });
    
    if (!mapRef.current || googleMapRef.current) {
      console.log('Skipping map initialization - no ref or map already exists');
      return;
    }

    const mapOptions = {
      center: { 
        lat: region?.latitude || 33.4484, 
        lng: region?.longitude || -112.0740 
      },
      zoom: 12,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      scaleControl: showsScale,
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: false,
    };

    console.log('Creating Google Map with options:', mapOptions);
    googleMapRef.current = new window.google.maps.Map(mapRef.current, mapOptions);
    console.log('Google Map created successfully');
    
    // Add CSS to hide Google Maps default InfoWindow close button (we use our own)
    if (!document.getElementById('hide-gm-close-button')) {
      const style = document.createElement('style');
      style.id = 'hide-gm-close-button';
      style.textContent = `
        .gm-style-iw-c button[aria-label="Close"],
        .gm-style-iw-d button[aria-label="Close"] {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Wait for map to be fully loaded before adding markers
    window.google.maps.event.addListenerOnce(googleMapRef.current, 'idle', () => {
      console.log('Map is idle and ready for markers');
      
      // Initialize markers after map is fully loaded
      console.log('Map fully loaded, calling updateMarkers');
      updateMarkers();
      
      // Add custom zoom controls to ensure correct behavior
      addCustomZoomControls();
    });

    // Listen for map bounds changes
    googleMapRef.current.addListener('bounds_changed', () => {
      const bounds = googleMapRef.current.getBounds();
      if (!bounds) return;
      
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const center = googleMapRef.current.getCenter();
      
      // Call the new onBoundsChange callback for viewport-based loading
      if (onBoundsChange) {
        onBoundsChange({
          northeast: { lat: ne.lat(), lng: ne.lng() },
          southwest: { lat: sw.lat(), lng: sw.lng() },
          center: { lat: center.lat(), lng: center.lng() }
        });
      }
      
      // Keep the old callback for backward compatibility
      if (onRegionChangeComplete) {
        onRegionChangeComplete({
          latitude: center.lat(),
          longitude: center.lng(),
          latitudeDelta: Math.abs(ne.lat() - sw.lat()),
          longitudeDelta: Math.abs(ne.lng() - sw.lng()),
        });
      }
    });
  };

  const updateMapRegion = () => {
    if (googleMapRef.current && region) {
      console.log('Updating map region:', region);
      const center = new window.google.maps.LatLng(region.latitude, region.longitude);
      
      // Avoid snapping the center if this region matches the last animated pan target
      const shouldSkipCenterSnap =
        lastPanTargetRef.current &&
        Math.abs(lastPanTargetRef.current.lat() - center.lat()) < 1e-6 &&
        Math.abs(lastPanTargetRef.current.lng() - center.lng()) < 1e-6;

      if (!shouldSkipCenterSnap) {
        googleMapRef.current.setCenter(center);
      }
      
      // Calculate zoom level based on latitudeDelta
      if (region.latitudeDelta) {
        const zoom = Math.round(Math.log(360 / region.latitudeDelta) / Math.LN2);
        const finalZoom = Math.max(1, Math.min(zoom, 20));
        googleMapRef.current.setZoom(finalZoom);
        console.log('Set zoom to:', finalZoom, 'based on latitudeDelta:', region.latitudeDelta);
      }
    }
  };

  const updateMarkers = async () => {
    // Check if markers have actually changed FIRST (before safety counter)
    const currentMarkersKey = `${markers.length}-${selectedBusiness?.id || 'none'}`;
    
    if (lastMarkersRef.current === currentMarkersKey) {
      // Markers unchanged, exit early without incrementing counter
      return;
    }
    
    // Safety check: prevent infinite loops
    updateCountRef.current++;
    if (updateCountRef.current > 10) {
      console.error('[MAP] ❌ Too many marker updates, stopping to prevent infinite loop');
      return;
    }
    
    // Reset counter after 2 seconds of no updates
    setTimeout(() => { updateCountRef.current = 0; }, 2000);
    
    if (!googleMapRef.current || !window.google || !window.google.maps) {
      return;
    }

    lastMarkersRef.current = currentMarkersKey;

    // Clear existing markers and clusterer
    if (markerClustererRef.current) {
      markerClustererRef.current.clearMarkers();
      markerClustererRef.current = null;
    }
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    const cancelUserAnimation = () => {
      if (userMarkerAnimRef.current) {
        cancelAnimationFrame(userMarkerAnimRef.current);
        userMarkerAnimRef.current = null;
      }
    };

    const animateUserMarker = (marker, fromPos, toPos, duration = 600) => {
      cancelUserAnimation();
      const start = performance.now();
      const fromLat = fromPos.lat();
      const fromLng = fromPos.lng();
      const toLat = toPos.lat();
      const toLng = toPos.lng();

      const step = (ts) => {
        const elapsed = ts - start;
        const t = Math.min(1, elapsed / duration);
        const lat = fromLat + (toLat - fromLat) * t;
        const lng = fromLng + (toLng - fromLng) * t;
        marker.setPosition(new window.google.maps.LatLng(lat, lng));
        if (t < 1) {
          userMarkerAnimRef.current = requestAnimationFrame(step);
        } else {
          userMarkerAnimRef.current = null;
        }
      };

      userMarkerAnimRef.current = requestAnimationFrame(step);
    };

    // Process markers from direct markers prop (preferred method)
    if (markers && markers.length > 0) {
      const userMarkersData = markers.filter(m => m.isUserLocation);
      const businessMarkersData = markers.filter(m => !m.isUserLocation);
      const businessMarkerInstances = [];

      // Render user location markers directly (never clustered)
      userMarkersData.forEach(markerData => {
        if (markerData && markerData.coordinate) {
          const targetPos = new window.google.maps.LatLng(markerData.coordinate.latitude, markerData.coordinate.longitude);

          // Update existing marker smoothly
          if (userMarkerRef.current) {
            const prevPos = userMarkerRef.current.getPosition();
            if (prevPos) {
              animateUserMarker(userMarkerRef.current, prevPos, targetPos);
            } else {
              userMarkerRef.current.setPosition(targetPos);
            }
          } else {
            // Create new user marker
            const marker = new window.google.maps.Marker({
              position: targetPos,
              map: googleMapRef.current,
              title: markerData.title || 'Your location',
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: '#4285f4',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3,
                scale: 10,
              },
              zIndex: Number(window.google.maps.Marker.MAX_ZINDEX) + 1000,
            });
            userMarkerRef.current = marker;
          }
        }
      });

      // Remove user marker if no user data
      if (userMarkersData.length === 0 && userMarkerRef.current) {
        cancelUserAnimation();
        userMarkerRef.current.setMap(null);
        userMarkerRef.current = null;
      }

      // Render business markers (clustered by default)
      businessMarkersData.forEach((markerData, index) => {
        if (markerData && markerData.coordinate) {
          const isSelected = selectedBusiness && 
            markerData.businessData && 
            markerData.businessData.id === selectedBusiness.id;
          
          // Only log in development mode and limit frequency
          if (__DEV__ && index < 5) {
            console.log('Creating marker:', markerData.title);
          }
          
          const marker = new window.google.maps.Marker({
            position: {
              lat: markerData.coordinate.latitude,
              lng: markerData.coordinate.longitude,
            },
            map: enableClustering ? null : googleMapRef.current, // Don't set map yet if clustering
            title: markerData.title || '',
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: markerData.pinColor || '#FF0000',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2,
              scale: isSelected ? 12 : 8,
            },
          });
          
          // Store business data on marker for easy lookup
          marker.businessData = markerData.businessData;

          // Create InfoWindow content function for reuse
          const createInfoWindow = () => {
            if (markerData.description || markerData.businessData) {
              const businessData = markerData.businessData;
              const address = businessData?.address || markerData.title;
              const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
              
              // Format description - round distance to 1 decimal place
              let formattedDescription = markerData.description || '';
              // Match distance pattern like "0.13960964145761826 mi" and format to 1 decimal
              formattedDescription = formattedDescription.replace(/(\d+\.\d+)\s*mi/g, (match, num) => {
                const val = parseFloat(num);
                return isNaN(val) ? match : `${val.toFixed(1)} mi`;
              });
              
              // Create InfoWindow first
              const infoWindow = new window.google.maps.InfoWindow();
              
              // Create close function BEFORE setting content so it's available when onclick is evaluated
              const closeFuncName = `closeInfoWindow_${markerData.businessData?.id || 'default'}`;
              const businessId = markerData.businessData?.id || 'default';
              
              // Store close function on window object
              window[closeFuncName] = () => {
                infoWindow.close();
                // Clear selected business to prevent popup from reopening
                if (onClearSelection) {
                  onClearSelection();
                }
                // Clean up function after closing
                setTimeout(() => {
                  if (window[closeFuncName]) {
                    delete window[closeFuncName];
                  }
                }, 100);
              };
              
              // Generate content with close button on same line as title
              const content = `
                <div style="max-width: 200px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; position: relative;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                    <strong style="font-size: 14px; color: #1a1a1a; flex: 1; margin-right: 8px; line-height: 1.3;">${markerData.title}</strong>
                    <button id="closeBtn_${businessId}" onclick="if(window.closeInfoWindow_${businessId}){window.closeInfoWindow_${businessId}();}" 
                            style="background: none; border: none; color: #666; font-size: 20px; cursor: pointer; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; line-height: 1; flex-shrink: 0; margin-top: -2px;" 
                            title="Close">×</button>
                  </div>
                  ${formattedDescription ? `<span style="font-size: 12px; color: #666; margin-top: 4px; display: block;">${formattedDescription}</span>` : ''}
                  ${businessData?.address ? `<div style="font-size: 11px; color: #888; margin-top: 6px; line-height: 1.3;">${businessData.address}</div>` : ''}
                  <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" 
                     style="display: inline-flex; align-items: center; margin-top: 8px; padding: 6px 10px; 
                            background: #4285f4; color: white; text-decoration: none; border-radius: 4px; 
                            font-size: 12px; font-weight: 500; transition: background 0.2s;">
                    <span style="margin-right: 4px;">🗺️</span>
                    Open in Google Maps
                  </a>
                </div>
              `;
              
              infoWindow.setContent(content);
              
              // Use domready event to ensure button click handler works
              window.google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
                const closeButton = document.getElementById(`closeBtn_${businessId}`);
                if (closeButton) {
                  closeButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window[closeFuncName]) {
                      window[closeFuncName]();
                    }
                  });
                }
              });
              
              return infoWindow;
            }
            return null;
          };

          // Handle marker click
          marker.addListener('click', () => {
            console.log('Direct marker clicked:', markerData.title);
            if (markerData.businessData && onMarkerPress) {
              onMarkerPress(markerData.businessData);
            }
            
            const infoWindow = createInfoWindow();
            if (infoWindow) {
              infoWindow.open(googleMapRef.current, marker);
            }
          });

          // Auto-open InfoWindow if this marker is selected
          if (isSelected) {
            console.log('Auto-opening InfoWindow for selected business:', markerData.title);
            const infoWindow = createInfoWindow();
            if (infoWindow) {
              infoWindow.open(googleMapRef.current, marker);
            }
          }

          markersRef.current.push(marker);
          businessMarkerInstances.push(marker);
        }
      });
      
      // Initialize clustering if enabled and we have markers (business markers only)
      if (enableClustering && businessMarkerInstances.length > 0 && window.google && window.google.maps) {
        try {
          console.log(`[MAP] Initializing clustering for ${businessMarkerInstances.length} markers`);
          // Clean solid red clusters
          const renderer = {
            render: ({ count, position }) => {
              return new window.google.maps.Marker({
                position,
                icon: {
                  path: window.google.maps.SymbolPath.CIRCLE,
                  fillColor: '#ef4444',
                  fillOpacity: 1,
                  strokeColor: '#ef4444',
                  strokeWeight: 0,
                  scale: count < 10 ? 12 : count < 100 ? 16 : 20,
                },
                label: {
                  text: String(count),
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 'bold',
                },
                zIndex: Number(window.google.maps.Marker.MAX_ZINDEX) + count,
              });
            },
          };

          markerClustererRef.current = new MarkerClusterer({
            map: googleMapRef.current,
            markers: businessMarkerInstances,
            renderer: renderer,
          });
          console.log('[MAP] ✅ Clustering initialized successfully');
        } catch (error) {
          console.error('[MAP] ❌ Clustering error:', error);
          // Fall back to showing all markers without clustering  
          businessMarkerInstances.forEach(marker => marker.setMap(googleMapRef.current));
        }
      } else if (!enableClustering && businessMarkerInstances.length > 0) {
        // No clustering - show markers directly
        businessMarkerInstances.forEach(marker => marker.setMap(googleMapRef.current));
      }
    }
    
    

    // Auto-fit map to show all markers (only if autoFitMarkers is true and no specific region is set)
    if (autoFitMarkers && markersRef.current.length > 0 && !region) {
      fitMapToMarkers();
    }
  };

  const fitMapToMarkers = () => {
    if (!googleMapRef.current || markersRef.current.length === 0) {
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    
    // Add all marker positions to bounds
    markersRef.current.forEach(marker => {
      bounds.extend(marker.getPosition());
    });

    // Fit the map to show all markers with some padding
    googleMapRef.current.fitBounds(bounds);
    
    // Ensure minimum zoom level (don't zoom in too much for single markers)
    google.maps.event.addListenerOnce(googleMapRef.current, 'bounds_changed', () => {
      const zoom = googleMapRef.current.getZoom();
      if (zoom > 15) {
        googleMapRef.current.setZoom(15);
      }
    });
    
    console.log('Map fitted to show all markers');
  };

  const addCustomZoomControls = () => {
    // Disable default zoom control first
    googleMapRef.current.setOptions({ zoomControl: false });
    
    // Create custom zoom control container
    const zoomControlDiv = document.createElement('div');
    zoomControlDiv.style.cssText = `
      position: absolute;
      right: 10px;
      top: 50px;
      display: flex;
      flex-direction: column;
      background: white;
      border-radius: 2px;
      box-shadow: 0 2px 6px rgba(0,0,0,.3);
      z-index: 1;
    `;

    // Create zoom in button (+)
    const zoomInButton = document.createElement('button');
    zoomInButton.innerHTML = '+';
    zoomInButton.style.cssText = `
      width: 40px;
      height: 40px;
      border: none;
      background: white;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      border-bottom: 1px solid #ccc;
    `;
    zoomInButton.title = 'Zoom in';

    // Create zoom out button (-)
    const zoomOutButton = document.createElement('button');
    zoomOutButton.innerHTML = '−';
    zoomOutButton.style.cssText = `
      width: 40px;
      height: 40px;
      border: none;
      background: white;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
    `;
    zoomOutButton.title = 'Zoom out';

    // Add click handlers
    zoomInButton.addEventListener('click', () => {
      const currentZoom = googleMapRef.current.getZoom();
      googleMapRef.current.setZoom(currentZoom + 1);
      console.log('Zoom in clicked, new zoom:', currentZoom + 1);
    });

    zoomOutButton.addEventListener('click', () => {
      const currentZoom = googleMapRef.current.getZoom();
      googleMapRef.current.setZoom(currentZoom - 1);
      console.log('Zoom out clicked, new zoom:', currentZoom - 1);
    });

    // Add hover effects
    [zoomInButton, zoomOutButton].forEach(button => {
      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = '#f5f5f5';
      });
      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = 'white';
      });
    });

    // Assemble the control
    zoomControlDiv.appendChild(zoomInButton);
    zoomControlDiv.appendChild(zoomOutButton);

    // Add to map
    googleMapRef.current.controls[window.google.maps.ControlPosition.RIGHT_TOP].push(zoomControlDiv);
  };

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.fallback}>
          <Text>Map not available on this platform</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <div ref={mapRef} style={styles.map} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
});

export default WebMapView;