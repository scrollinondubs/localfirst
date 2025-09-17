import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  FlatList,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import WebMapView from '../components/WebMapView';
import WebMarker from '../components/WebMarker';
import locationService from '../services/LocationService';
import voiceService from '../services/VoiceService';
import LocationPermissionModal from '../components/LocationPermissionModal';
import ManualLocationInput from '../components/ManualLocationInput';
import DebugInfo from '../components/DebugInfo';
import FavoriteButton from '../components/FavoriteButton';
import EnhancedBusinessCard from '../components/EnhancedBusinessCard';
import CategoryFilter from '../components/CategoryFilter';
import { apiRequest, API_CONFIG } from '../config/api';

// Arizona cities and their coordinates for intelligent search parsing
const ARIZONA_CITIES = {
  'phoenix': { lat: 33.4484, lng: -112.0740, city: 'Phoenix' },
  'tucson': { lat: 32.2226, lng: -110.9747, city: 'Tucson' },
  'mesa': { lat: 33.4152, lng: -111.8315, city: 'Mesa' },
  'chandler': { lat: 33.3062, lng: -111.8413, city: 'Chandler' },
  'glendale': { lat: 33.5387, lng: -112.1860, city: 'Glendale' },
  'scottsdale': { lat: 33.4942, lng: -111.9261, city: 'Scottsdale' },
  'gilbert': { lat: 33.3528, lng: -111.7890, city: 'Gilbert' },
  'tempe': { lat: 33.4255, lng: -111.9400, city: 'Tempe' },
  'peoria': { lat: 33.5806, lng: -112.2374, city: 'Peoria' },
  'surprise': { lat: 33.6292, lng: -112.3679, city: 'Surprise' },
  'yuma': { lat: 32.6927, lng: -114.6277, city: 'Yuma' },
  'avondale': { lat: 33.4356, lng: -112.3496, city: 'Avondale' },
  'flagstaff': { lat: 35.1983, lng: -111.6513, city: 'Flagstaff' },
  'goodyear': { lat: 33.4355, lng: -112.3576, city: 'Goodyear' },
  'buckeye': { lat: 33.3703, lng: -112.5838, city: 'Buckeye' },
  'lake havasu city': { lat: 34.4839, lng: -114.3227, city: 'Lake Havasu City' },
  'casa grande': { lat: 32.8795, lng: -111.7574, city: 'Casa Grande' },
  'sierra vista': { lat: 31.5455, lng: -110.3037, city: 'Sierra Vista' },
  'maricopa': { lat: 33.0581, lng: -112.0476, city: 'Maricopa' },
  'oro valley': { lat: 32.3909, lng: -110.9665, city: 'Oro Valley' }
};

// Format distance from kilometers to miles with 1 decimal place
function formatDistance(distanceKm) {
  if (!distanceKm) return 'Distance unknown';
  
  // Convert km to miles (1 km = 0.621371 miles)
  const distanceMiles = distanceKm * 0.621371;
  
  // Round to 1 decimal place
  return `${distanceMiles.toFixed(1)} mi`;
}

// Parse location from search query (e.g., "pizza in tempe", "coffee in scottsdale")
function parseLocationFromQuery(query) {
  const lowerQuery = query.toLowerCase();
  
  // Look for "in [city]" patterns
  const inPattern = /\bin\s+([a-z\s]+?)(?:\s|$)/i;
  const inMatch = lowerQuery.match(inPattern);
  
  if (inMatch) {
    const cityName = inMatch[1].trim();
    if (ARIZONA_CITIES[cityName]) {
      return ARIZONA_CITIES[cityName];
    }
    
    // Try multi-word cities
    const words = cityName.split(' ');
    if (words.length > 1) {
      const multiWordCity = words.join(' ');
      if (ARIZONA_CITIES[multiWordCity]) {
        return ARIZONA_CITIES[multiWordCity];
      }
    }
  }
  
  // Look for direct city mentions at the end
  const words = lowerQuery.split(' ');
  for (let i = words.length - 1; i >= 0; i--) {
    const cityCandidate = words.slice(i).join(' ');
    if (ARIZONA_CITIES[cityCandidate]) {
      return ARIZONA_CITIES[cityCandidate];
    }
  }
  
  return null;
}

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [partialTranscription, setPartialTranscription] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const [isVoiceAvailable, setIsVoiceAvailable] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchMetadata, setSearchMetadata] = useState(null);
  const [voiceButtonMinimized, setVoiceButtonMinimized] = useState(false);
  
  // Ref for the business results list to enable scrolling
  const businessListRef = useRef(null);
  
  // Location-related state
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('checking'); // 'checking', 'granted', 'denied', 'unavailable'
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showManualLocationInput, setShowManualLocationInput] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('undetermined');
  const [locationError, setLocationError] = useState(null);
  const [isFirstTime, setIsFirstTime] = useState(true);
  
  // Map-related state
  const [mapRegion, setMapRegion] = useState({
    latitude: 33.4484, // Phoenix, AZ default
    longitude: -112.0740,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [selectedBusiness, setSelectedBusiness] = useState(null);

  // Initialize location and voice services when component mounts
  useEffect(() => {
    initializeLocation();
    initializeVoiceService();
    return () => {
      // Cleanup services when component unmounts
      locationService.cleanup();
      voiceService.destroy();
    };
  }, []);

  // Handle location updates when screen is focused
  useFocusEffect(
    useCallback(() => {
      // Start location watching when screen is focused
      const startLocationWatch = async () => {
        const status = await locationService.getPermissionStatus();
        if (status === 'granted') {
          locationService.startLocationWatch();
        }
      };
      
      startLocationWatch();
      
      // Setup location listener
      const removeLocationListener = locationService.addLocationListener(handleLocationUpdate);
      
      return () => {
        // Stop location watching when screen loses focus
        locationService.stopLocationWatch();
        removeLocationListener();
      };
    }, [])
  );

  // Auto-minimize voice button when search results are shown
  useEffect(() => {
    if (searchResults.length > 0 && !isRecording) {
      setVoiceButtonMinimized(true);
    }
  }, [searchResults.length, isRecording]);

  const initializeLocation = async () => {
    try {
      setLocationStatus('checking');
      
      // Check if we've asked for permission before
      const hasAskedBefore = await locationService.hasAskedForPermission();
      setIsFirstTime(!hasAskedBefore);
      
      // Get current permission status
      const status = await locationService.getPermissionStatus();
      setPermissionStatus(status);
      
      if (status === 'granted') {
        // Permission granted, get location
        await getCurrentLocation();
      } else if (status === 'denied') {
        // Permission denied, try to load cached location
        setLocationStatus('denied');
        await loadCachedLocation();
      } else {
        // Permission not determined, show modal if first time (but skip for web)
        setLocationStatus('unavailable');
        if (!hasAskedBefore) {
          setTimeout(() => {
            setShowPermissionModal(true);
          }, 1000); // Show after a short delay
        } else {
          // If asked before, skip modal and load cached location
          await loadCachedLocation();
        }
      }
    } catch (error) {
      console.error('Error initializing location:', error);
      setLocationError('Failed to initialize location services');
      setLocationStatus('unavailable');
      await loadCachedLocation();
    }
  };

  const getCurrentLocation = async () => {
    try {
      const result = await locationService.getCurrentLocation();
      if (result.success) {
        setUserLocation(result.location);
        setLocationStatus('granted');
        setLocationError(null);
        
        // Update map region to center on user location
        // Handle both direct coordinates and coords object format
        const lat = result.location?.coords?.latitude || result.location?.latitude;
        const lng = result.location?.coords?.longitude || result.location?.longitude;

        if (lat && lng) {
          setMapRegion({
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.05, // Closer zoom for better user experience
            longitudeDelta: 0.05,
          });
          console.log(`[LOCATION] Map centered on user location: ${lat}, ${lng}`);
        }
        
        if (result.fromCache) {
          console.log('Using cached location');
        }
      } else {
        throw new Error(result.error || 'Unable to get location');
      }
    } catch (error) {
      console.error('Error getting current location:', error);
      setLocationError(error.message);
      setLocationStatus('unavailable');
      await loadCachedLocation();
    }
  };

  const loadCachedLocation = async () => {
    try {
      const cachedLocation = await locationService.getCachedLocation();
      if (cachedLocation) {
        setUserLocation(cachedLocation);
        console.log('Loaded cached location');
      }
    } catch (error) {
      console.error('Error loading cached location:', error);
    }
  };

  const handleLocationUpdate = (location) => {
    setUserLocation(location);
    setLocationStatus('granted');
    setLocationError(null);

    // Update map region to center on user location
    // Handle both direct coordinates and coords object format
    const lat = location?.coords?.latitude || location?.latitude;
    const lng = location?.coords?.longitude || location?.longitude;

    if (lat && lng) {
      setMapRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.05, // Closer zoom for better user experience
        longitudeDelta: 0.05,
      });
      console.log(`[LOCATION] Map centered on user location: ${lat}, ${lng}`);
    }
  };

  const handleRequestPermission = async () => {
    try {
      const result = await locationService.requestLocationPermission();
      setPermissionStatus(result.status);
      
      if (result.success) {
        setShowPermissionModal(false);
        await getCurrentLocation();
      } else {
        setLocationError(result.message);
        if (result.status === 'denied') {
          setLocationStatus('denied');
        }
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      setLocationError('Failed to request location permission');
    }
  };

  const handleSkipLocation = () => {
    setShowPermissionModal(false);
    setLocationStatus('unavailable');
    loadCachedLocation();
  };

  const handleManualLocationSelected = (location) => {
    setUserLocation(location);
    setLocationStatus('manual');
    setLocationError(null);
    setShowManualLocationInput(false);
  };

  const openManualLocationInput = () => {
    setShowManualLocationInput(true);
  };

  const initializeVoiceService = async () => {
    try {
      const available = voiceService.getIsAvailable();
      setIsVoiceAvailable(available);
      
      if (available) {
        // Set up voice service callbacks
        voiceService.setCallbacks({
          onStart: handleVoiceStart,
          onResults: handleVoiceResults,
          onPartialResults: handleVoicePartialResults,
          onEnd: handleVoiceEnd,
          onError: handleVoiceError,
        });
      } else {
        console.warn('Voice recognition not available on this device');
      }
    } catch (error) {
      console.error('Error initializing voice service:', error);
      setVoiceError('Voice recognition not available');
    }
  };

  const handleVoiceStart = () => {
    setIsListening(true);
    setTranscription('');
    setPartialTranscription('Listening...');
    setVoiceError(null);
  };

  const handleVoiceResults = (results) => {
    if (results && results.length > 0) {
      const finalTranscription = results[0];
      setTranscription(finalTranscription);
      setPartialTranscription('');
      setSearchQuery(finalTranscription);
      
      // Process the voice query and perform search
      const processedQuery = voiceService.processVoiceSearchQuery(finalTranscription);
      if (processedQuery && processedQuery.processedQuery) {
        performSearch(processedQuery.processedQuery);
      }
    }
  };

  const handleVoicePartialResults = (partialResults) => {
    if (partialResults && partialResults.length > 0) {
      setPartialTranscription(partialResults[0]);
    }
  };

  const handleVoiceEnd = () => {
    setIsListening(false);
    setIsRecording(false);
    setPartialTranscription('');
  };

  const handleVoiceError = (error) => {
    console.error('Voice recognition error:', error);
    setIsListening(false);
    setIsRecording(false);
    setPartialTranscription('');
    
    let errorMessage = 'Voice recognition failed';
    if (error?.error?.message) {
      errorMessage = error.error.message;
    } else if (error?.error) {
      errorMessage = error.error.toString();
    }
    
    setVoiceError(errorMessage);
    
    // Show user-friendly error message
    Alert.alert(
      'Voice Recognition Error',
      'Sorry, we couldn\'t understand your voice. Please try again or use text search.',
      [{ text: 'OK', onPress: () => setVoiceError(null) }]
    );
  };

  const startVoiceSearch = async () => {
    if (!isVoiceAvailable) {
      Alert.alert(
        'Voice Search Unavailable',
        'Voice recognition is not available on this device. Please use text search instead.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsRecording(true);
      setVoiceError(null);
      setTranscription('');
      setPartialTranscription('');
      
      await voiceService.startListening({
        language: 'en-US',
        EXTRA_PARTIAL_RESULTS: true,
      });
    } catch (error) {
      console.error('Error starting voice search:', error);
      setIsRecording(false);
      setVoiceError('Failed to start voice recognition');
      
      Alert.alert(
        'Voice Search Error',
        'Unable to start voice recognition. Please check microphone permissions and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const stopVoiceSearch = async () => {
    try {
      await voiceService.stopListening();
    } catch (error) {
      console.error('Error stopping voice search:', error);
      // Force cleanup if stop fails
      setIsRecording(false);
      setIsListening(false);
      setPartialTranscription('');
    }
  };

  const performSearch = async (query) => {
    console.log(`[MOBILE-SEARCH] Starting search for: "${query}"`);
    
    if (!query.trim()) {
      console.log(`[MOBILE-SEARCH] Empty query, clearing results`);
      setSearchResults([]);
      return;
    }

    setLoading(true);
    setSearchError(null); // Clear any previous errors
    
    try {
      // Build query parameters for enhanced search API
      const params = new URLSearchParams({
        query: query,
        limit: 50,
        radius: 25 // Limit to 25 miles from user location
      });

      // Add category filter if selected
      if (selectedCategory) {
        params.append('category_filter', selectedCategory);
      }

      // Intelligent location detection from search query
      let searchLat = 33.4484; // Phoenix, AZ latitude (default)
      let searchLng = -112.0740; // Phoenix, AZ longitude (default)
      let locationSource = 'fallback (Phoenix, AZ)';
      
      // Parse query for city names or location indicators
      const cityCoords = parseLocationFromQuery(query);
      if (cityCoords) {
        searchLat = cityCoords.lat;
        searchLng = cityCoords.lng;
        locationSource = `parsed city (${cityCoords.city})`;
        console.log(`[MOBILE-SEARCH] Using parsed city coordinates: ${searchLat}, ${searchLng} for ${cityCoords.city}`);
      } else if (query.toLowerCase().includes('near me') || query.toLowerCase().includes('nearby')) {
        // User wants results near their current location
        const lat = userLocation?.coords?.latitude || userLocation?.latitude;
        const lng = userLocation?.coords?.longitude || userLocation?.longitude;

        if (lat && lng) {
          // Arizona rough bounds: lat 31-37, lng -115 to -109
          if (lat >= 31 && lat <= 37 && lng >= -115 && lng <= -109) {
            searchLat = lat;
            searchLng = lng;
            locationSource = `user location (near me)`;
            console.log(`[MOBILE-SEARCH] Using user location for "near me": ${lat}, ${lng}`);

            // Use smaller radius for "near me" searches for more relevant results
            params.set('radius', '10'); // 10 miles instead of 25
          } else {
            console.log(`[MOBILE-SEARCH] User location outside Arizona bounds (${lat}, ${lng}), using Phoenix fallback`);
          }
        } else {
          console.log(`[MOBILE-SEARCH] "Near me" requested but no user location available, using Phoenix fallback`);

          // Show a helpful message to user
          setLocationError('To search "near me", please enable location access in settings or use a specific city name.');
        }
      } else {
        console.log(`[MOBILE-SEARCH] No city detected in query "${query}", using Phoenix fallback`);
      }
      
      console.log(`[MOBILE-SEARCH] Search coordinates: ${searchLat}, ${searchLng} (${locationSource})`);
      params.append('lat', searchLat);
      params.append('lng', searchLng);

      const searchEndpoint = `${API_CONFIG.ENDPOINTS.BUSINESSES_SEARCH}?${params}`;
      console.log(`[MOBILE-SEARCH] API Endpoint: ${searchEndpoint}`);
      console.log(`[MOBILE-SEARCH] Full URL will be: ${API_CONFIG.BASE_URL}${searchEndpoint}`);
      console.log(`[MOBILE-SEARCH] API Config:`, API_CONFIG);

      // Use the shared semantic search API endpoint - pass only the endpoint path, not full URL
      console.log(`[MOBILE-SEARCH] About to make API request to endpoint: ${searchEndpoint}`);
      
      const response = await apiRequest(searchEndpoint);
      console.log(`[MOBILE-SEARCH] API Response received:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        type: response.type,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        console.error(`[MOBILE-SEARCH] Response not OK:`, {
          status: response.status,
          statusText: response.statusText,
          url: response.url
        });
        
        let errorData;
        try {
          errorData = await response.text(); // Use text() first in case JSON parsing fails
          console.error(`[MOBILE-SEARCH] Error response body:`, errorData);
          
          // Try to parse as JSON
          try {
            errorData = JSON.parse(errorData);
          } catch (jsonError) {
            console.warn(`[MOBILE-SEARCH] Response body is not JSON:`, jsonError.message);
          }
        } catch (readError) {
          console.error(`[MOBILE-SEARCH] Failed to read error response:`, readError);
        }
        
        throw new Error(errorData?.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`[MOBILE-SEARCH] About to parse response as JSON`);
      let data;
      try {
        data = await response.json();
        console.log(`[MOBILE-SEARCH] Successfully parsed JSON response:`, {
          dataType: typeof data,
          isArray: Array.isArray(data),
          keys: typeof data === 'object' ? Object.keys(data) : 'N/A',
          sampleData: data
        });
      } catch (jsonError) {
        console.error(`[MOBILE-SEARCH] Failed to parse JSON response:`, jsonError);
        const responseText = await response.text();
        console.error(`[MOBILE-SEARCH] Raw response text:`, responseText);
        throw new Error('Invalid JSON response from server');
      }

      // Handle response format from enhanced search API
      if (data && data.businesses && Array.isArray(data.businesses)) {
        console.log(`[MOBILE-SEARCH] Found ${data.businesses.length} businesses in data.businesses`);
        console.log(`[MOBILE-SEARCH] Setting searchResults with businesses:`, data.businesses.slice(0, 3));
        setSearchResults(data.businesses);
        
        // Store enhanced search metadata
        setSearchMetadata(data.searchMetadata || null);
      } else if (data && Array.isArray(data)) {
        console.log(`[MOBILE-SEARCH] Found ${data.length} businesses in data array`);
        console.log(`[MOBILE-SEARCH] Setting searchResults with direct array:`, data.slice(0, 3));
        setSearchResults(data);
      } else if (data.results && Array.isArray(data.results)) {
        console.log(`[MOBILE-SEARCH] Found ${data.results.length} businesses in data.results`);
        console.log(`[MOBILE-SEARCH] Setting searchResults with results:`, data.results.slice(0, 3));
        setSearchResults(data.results);
      } else {
        console.error(`[MOBILE-SEARCH] No businesses found in response, data structure:`, Object.keys(data));
        console.error(`[MOBILE-SEARCH] Full response data:`, data);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('[MOBILE-SEARCH] Search error:', error);
      setSearchResults([]);
      setSearchError(error.message || 'Failed to search businesses');
    } finally {
      setLoading(false);
    }
  };


  const getLocationDisplayText = () => {
    if (locationStatus === 'checking') {
      return 'Determining location...';
    }
    
    if (!userLocation) {
      return 'Location unavailable';
    }
    
    if (userLocation.address) {
      return userLocation.address;
    }
    
    if (userLocation.coords) {
      return `${userLocation.coords.latitude.toFixed(4)}, ${userLocation.coords.longitude.toFixed(4)}`;
    }
    
    return 'Location set';
  };

  const getLocationIcon = () => {
    switch (locationStatus) {
      case 'checking':
        return 'time-outline';
      case 'granted':
        return 'location';
      case 'denied':
        return 'location-outline';
      case 'manual':
        return 'pin';
      default:
        return 'location-outline';
    }
  };

  const getLocationColor = () => {
    switch (locationStatus) {
      case 'granted':
        return '#22c55e';
      case 'denied':
        return '#ef4444';
      case 'manual':
        return '#3182ce';
      default:
        return '#718096';
    }
  };

  const handleTextSearch = () => {
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    }
  };

  const toggleVoiceButtonMinimized = () => {
    setVoiceButtonMinimized(!voiceButtonMinimized);
  };

  const handleBusinessSelect = (business) => {
    setSelectedBusiness(business);
    // Center map on selected business
    setMapRegion({
      latitude: business.latitude,
      longitude: business.longitude,
      latitudeDelta: 0.01, // Zoom in closer
      longitudeDelta: 0.01,
    });
  };

  const handleMapMarkerPress = (business) => {
    setSelectedBusiness(business);
    
    // Find the business index in search results and scroll to it
    const businessIndex = searchResults.findIndex(item => item.id === business.id);
    if (businessIndex !== -1 && businessListRef.current) {
      // Scroll to the selected business with some offset
      businessListRef.current.scrollToIndex({
        index: businessIndex,
        animated: true,
        viewPosition: 0.3, // Position the item 30% from the top of the visible area
      });
    }
  };

  const renderSearchResult = ({ item }) => {
    // Add distance formatting for enhanced business card
    const businessWithDistance = {
      ...item,
      distance: item.distance ? formatDistance(item.distance).replace(' mi', '') : null
    };
    
    return (
      <EnhancedBusinessCard
        business={businessWithDistance}
        onPress={() => handleBusinessSelect(item)}
        isSelected={selectedBusiness && selectedBusiness.id === item.id}
      />
    );
  };

  // Debug logging for render
  console.log(`[MOBILE-SEARCH] Rendering with searchResults.length: ${searchResults.length}`);
  if (searchResults.length > 0) {
    console.log(`[MOBILE-SEARCH] First search result:`, searchResults[0]);
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Map Container */}
      <View style={styles.mapContainer}>
        <WebMapView
          style={styles.map}
          region={mapRegion}
          onRegionChangeComplete={setMapRegion}
          showsUserLocation={true}
          showsMyLocationButton={true}
          showsCompass={true}
          showsScale={true}
          onMarkerPress={handleMapMarkerPress}
          selectedBusiness={selectedBusiness}
          autoFitMarkers={false}
          markers={[
            // User location marker (temporarily disabled for debugging)
            // Business markers
            ...searchResults.map(business => ({
              coordinate: {
                latitude: business.latitude,
                longitude: business.longitude,
              },
              title: business.name,
              description: `${business.category} • ${formatDistance(business.distance)}`,
              pinColor: business.lfa_member ? '#3182ce' : '#ef4444',
              businessData: business
            }))
          ]}
        >
          {/* User location marker */}
          {userLocation && (() => {
            const lat = userLocation?.coords?.latitude || userLocation?.latitude;
            const lng = userLocation?.coords?.longitude || userLocation?.longitude;

            if (lat && lng) {
              return (
                <WebMarker
                  coordinate={{
                    latitude: lat,
                    longitude: lng,
                  }}
                  title="Your Location"
                  description={locationStatus === 'granted' ? 'Current location' : 'Manual location'}
                  pinColor="blue"
                />
              );
            }
            return null;
          })()}
          
          {/* Search result markers */}
          {searchResults.map((business, index) => (
            <WebMarker
              key={`business-${business.id}-${index}`}
              coordinate={{
                latitude: business.latitude,
                longitude: business.longitude,
              }}
              title={business.name}
              description={`${business.category} • ${business.distance || 'Distance unknown'}`}
              pinColor={business.lfa_member ? '#3182ce' : '#ef4444'}
              businessData={business}
              onPress={() => handleMapMarkerPress(business)}
            />
          ))}
        </WebMapView>
        
        {/* Location status overlay */}
        {userLocation && (
          <View style={styles.locationStatusOverlay}>
            <Text style={styles.locationStatusText}>
              {locationStatus === 'granted' ? '📍 Current location' : '📍 Manual location'}
            </Text>
          </View>
        )}
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for businesses..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleTextSearch}
        />
        
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleTextSearch}
        >
          <Ionicons name="search" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <CategoryFilter
        selectedCategory={selectedCategory}
        onCategoryChange={(category) => {
          setSelectedCategory(category);
          if (searchQuery.trim()) {
            performSearch(searchQuery);
          }
        }}
      />

      {/* Location Error Message */}
      {locationError && (
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{locationError}</Text>
        </View>
      )}

      {/* Search Error Display */}
      {searchError && (
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{searchError}</Text>
        </View>
      )}

      {/* Voice Error Display */}
      {voiceError && (
        <View style={styles.voiceErrorContainer}>
          <Ionicons name="warning-outline" size={16} color="#ef4444" />
          <Text style={styles.voiceErrorText}>{voiceError}</Text>
        </View>
      )}

      {/* Voice Status (minimal) */}
      {isListening && (
        <View style={styles.voiceStatusContainer}>
          <Text style={styles.voiceStatusText}>
            {partialTranscription || 'Listening...'}
          </Text>
        </View>
      )}

      {/* Search Results */}
      <View style={[
        styles.resultsContainer,
        voiceButtonMinimized && styles.resultsContainerMinimized
      ]}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3182ce" />
            <Text style={styles.loadingText}>Finding businesses for you...</Text>
          </View>
        ) : (
          <FlatList
            ref={businessListRef}
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.resultsList}
            onScrollToIndexFailed={(error) => {
              // Fallback if scrollToIndex fails
              console.log('ScrollToIndex failed:', error);
              // Try scrolling to offset instead
              if (businessListRef.current) {
                const itemHeight = 180; // Approximate item height
                const offset = error.index * itemHeight;
                businessListRef.current.scrollToOffset({ offset, animated: true });
              }
            }}
          />
        )}
      </View>

      {/* Voice Search Button - Fixed at Bottom */}
      {voiceButtonMinimized ? (
        // Minimized Voice Button (Just the button, no container background)
        <TouchableOpacity
          style={[
            styles.voiceButtonMinimized,
            isRecording && styles.voiceButtonMinimizedActive,
            !isVoiceAvailable && styles.voiceButtonMinimizedDisabled
          ]}
          onPress={isRecording ? stopVoiceSearch : toggleVoiceButtonMinimized}
          disabled={!isVoiceAvailable}
        >
          <Ionicons 
            name={isRecording ? "stop" : "mic"} 
            size={20} 
            color={!isVoiceAvailable ? "#a0aec0" : "#ffffff"} 
          />
        </TouchableOpacity>
      ) : (
        // Full Voice Button Section (opaque container)
        <View style={styles.voiceSection}>
          <TouchableOpacity
            style={[
              styles.voiceButton,
              isRecording && styles.voiceButtonActive,
              !isVoiceAvailable && styles.voiceButtonDisabled
            ]}
            onPress={isRecording ? stopVoiceSearch : startVoiceSearch}
            disabled={!isVoiceAvailable}
          >
            <Ionicons 
              name={isRecording ? "stop" : "mic"} 
              size={32} 
              color={!isVoiceAvailable ? "#a0aec0" : "#ffffff"} 
            />
          </TouchableOpacity>
          
          <Text style={[
            styles.voiceButtonText,
            !isVoiceAvailable && styles.voiceButtonTextDisabled
          ]}>
            {!isVoiceAvailable ? 'Voice search unavailable' :
             isRecording ? 'Tap to stop recording' : 
             'Push to record'}
          </Text>
        </View>
      )}

      {/* Location Permission Modal */}
      <LocationPermissionModal
        visible={showPermissionModal}
        onRequestPermission={handleRequestPermission}
        onSkip={handleSkipLocation}
        onClose={() => setShowPermissionModal(false)}
        permissionStatus={permissionStatus}
      />

      {/* Manual Location Input Modal */}
      <ManualLocationInput
        visible={showManualLocationInput}
        onLocationSelected={handleManualLocationSelected}
        onClose={() => setShowManualLocationInput(false)}
        currentLocation={userLocation}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  mapContainer: {
    height: 250,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  locationStatusOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  locationStatusText: {
    fontSize: 12,
    color: '#3182ce',
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  searchButton: {
    backgroundColor: '#3182ce',
    borderRadius: 8,
    padding: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  voiceErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  voiceErrorText: {
    fontSize: 12,
    color: '#dc2626',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  transcriptionContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  transcriptionLabel: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 4,
  },
  transcriptionText: {
    fontSize: 16,
    color: '#2d3748',
    fontWeight: '500',
    minHeight: 20,
    fontStyle: 'italic',
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    marginBottom: 120, // Space for fixed voice button
  },
  resultsContainerMinimized: {
    marginBottom: 0, // No space reserved when voice button is minimized
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#718096',
    marginTop: 16,
  },
  resultsList: {
    paddingBottom: 20,
  },
  voiceSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff', // Opaque white background
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  voiceSectionMinimized: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent', // Transparent background so search results show through
    alignItems: 'flex-end',
    paddingTop: 0,
    paddingBottom: 0,
    paddingRight: 0,
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  voiceButton: {
    backgroundColor: '#3182ce',
    borderRadius: 50,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  voiceButtonActive: {
    backgroundColor: '#dc2626',
    transform: [{ scale: 1.05 }],
  },
  voiceButtonDisabled: {
    backgroundColor: '#e2e8f0',
    elevation: 0,
    shadowOpacity: 0,
  },
  voiceButtonText: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
    textAlign: 'center',
  },
  voiceButtonTextDisabled: {
    color: '#a0aec0',
  },
  voiceStatusContainer: {
    backgroundColor: '#e6f3ff',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3182ce',
  },
  voiceStatusText: {
    fontSize: 14,
    color: '#1e40af',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  voiceButtonMinimized: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#3182ce', // Fully opaque blue button
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 1000,
  },
  voiceButtonMinimizedActive: {
    backgroundColor: '#dc2626', // Fully opaque red button
    transform: [{ scale: 1.1 }],
  },
  voiceButtonMinimizedDisabled: {
    backgroundColor: '#e2e8f0', // Fully opaque gray button
    elevation: 0,
    shadowOpacity: 0,
  },
});