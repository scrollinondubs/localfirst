import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

const WebMapView = ({ 
  region, 
  onRegionChangeComplete, 
  showsUserLocation = true,
  showsMyLocationButton = true,
  showsCompass = true,
  showsScale = true,
  children,
  style,
  onMarkerPress,
  selectedBusiness,
  markers = [], // Add direct marker data prop as backup
  autoFitMarkers = true // New prop to control auto-fitting
}) => {
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef = useRef([]);
  const lastMarkersRef = useRef([]);

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
    if (googleMapRef.current) {
      updateMarkers();
    }
  }, [children, selectedBusiness, markers]);

  const loadGoogleMapsAPI = () => {
    if (window.google && window.google.maps) {
      initializeMap();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyD9Na8epdXboFBw1BSEonX_fg7m35uh9ao&callback=initMap`;
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

    // Wait for map to be fully loaded before adding markers
    google.maps.event.addListenerOnce(googleMapRef.current, 'idle', () => {
      console.log('Map is idle and ready for markers');
      
      // Add location control if requested
      if (showsMyLocationButton && navigator.geolocation) {
        addLocationControl();
      }

      // Initialize markers after map is fully loaded
      console.log('Map fully loaded, calling updateMarkers');
      updateMarkers();
      
      // Add custom zoom controls to ensure correct behavior
      addCustomZoomControls();
    });

    // Listen for map bounds changes
    googleMapRef.current.addListener('bounds_changed', () => {
      if (onRegionChangeComplete) {
        const center = googleMapRef.current.getCenter();
        const bounds = googleMapRef.current.getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        
        onRegionChangeComplete({
          latitude: center.lat(),
          longitude: center.lng(),
          latitudeDelta: Math.abs(ne.lat() - sw.lat()),
          longitudeDelta: Math.abs(ne.lng() - sw.lng()),
        });
      }
    });
  };

  const addLocationControl = () => {
    const locationButton = document.createElement('button');
    locationButton.textContent = '📍';
    locationButton.classList.add('map-location-button');
    locationButton.style.cssText = `
      background-color: #fff;
      border: 2px solid #fff;
      border-radius: 3px;
      box-shadow: 0 2px 6px rgba(0,0,0,.3);
      cursor: pointer;
      font-size: 18px;
      margin: 8px;
      padding: 8px;
      position: absolute;
      right: 0;
      top: 0;
    `;
    
    locationButton.addEventListener('click', () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const pos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            googleMapRef.current.setCenter(pos);
            googleMapRef.current.setZoom(15);
          },
          () => {
            console.log('Error: The Geolocation service failed.');
          }
        );
      }
    });

    googleMapRef.current.controls[window.google.maps.ControlPosition.RIGHT_TOP].push(locationButton);
  };

  const updateMapRegion = () => {
    if (googleMapRef.current && region) {
      console.log('Updating map region:', region);
      const center = new window.google.maps.LatLng(region.latitude, region.longitude);
      googleMapRef.current.setCenter(center);
      
      // Calculate zoom level based on latitudeDelta
      if (region.latitudeDelta) {
        const zoom = Math.round(Math.log(360 / region.latitudeDelta) / Math.LN2);
        const finalZoom = Math.max(1, Math.min(zoom, 20));
        googleMapRef.current.setZoom(finalZoom);
        console.log('Set zoom to:', finalZoom, 'based on latitudeDelta:', region.latitudeDelta);
      }
    }
  };

  const updateMarkers = () => {
    console.log('updateMarkers called', { 
      hasMap: !!googleMapRef.current, 
      hasGoogle: !!(window.google && window.google.maps),
      markersLength: markers ? markers.length : 0,
      childrenLength: children ? (Array.isArray(children) ? children.length : 1) : 0
    });
    
    if (!googleMapRef.current) {
      console.log('No google map ref, skipping marker update');
      return;
    }

    if (!window.google || !window.google.maps) {
      console.log('Google Maps API not loaded, skipping marker update');
      return;
    }

    // Check if markers have actually changed to prevent unnecessary updates
    const currentMarkersData = JSON.stringify({
      markers: markers,
      selectedBusinessId: selectedBusiness?.id
    });
    
    if (lastMarkersRef.current === currentMarkersData) {
      console.log('Markers unchanged, skipping update');
      return;
    }
    
    lastMarkersRef.current = currentMarkersData;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Process markers from direct markers prop (preferred method)
    if (markers && markers.length > 0) {
      console.log('Processing direct markers:', markers.length);
      
      markers.forEach((markerData, index) => {
        if (markerData && markerData.coordinate) {
          const isSelected = selectedBusiness && 
            markerData.businessData && 
            markerData.businessData.id === selectedBusiness.id;
          
          console.log('Creating direct marker for:', {
            title: markerData.title,
            coordinate: markerData.coordinate,
            exactLatLng: {
              lat: markerData.coordinate.latitude,
              lng: markerData.coordinate.longitude
            },
            pinColor: markerData.pinColor,
            isSelected
          });
          
          const marker = new window.google.maps.Marker({
            position: {
              lat: markerData.coordinate.latitude,
              lng: markerData.coordinate.longitude,
            },
            map: googleMapRef.current,
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

          // Handle marker click
          marker.addListener('click', () => {
            console.log('Direct marker clicked:', markerData.title);
            if (markerData.businessData && onMarkerPress) {
              onMarkerPress(markerData.businessData);
            }
            
            if (markerData.description) {
              const infoWindow = new window.google.maps.InfoWindow({
                content: `<div><strong>${markerData.title}</strong><br/>${markerData.description}</div>`,
              });
              infoWindow.open(googleMapRef.current, marker);
            }
          });

          markersRef.current.push(marker);
          console.log('Created marker:', index + 1, 'of', markers.length);
        }
      });
    }
    
    console.log('Total markers created:', markersRef.current.length);
    

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
      googleMapRef.current.setZoom(currentZoom - 1);
      console.log('Zoom in clicked, new zoom:', currentZoom - 1);
    });

    zoomOutButton.addEventListener('click', () => {
      const currentZoom = googleMapRef.current.getZoom();
      googleMapRef.current.setZoom(currentZoom + 1);
      console.log('Zoom out clicked, new zoom:', currentZoom + 1);
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