import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  // Removed results overlay; keep markers simple for now
  
  // Infinite scroll state
  const [allBusinesses, setAllBusinesses] = useState([]); // Store all fetched businesses
  const [displayedBusinesses, setDisplayedBusinesses] = useState([]); // Paginated display
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 50; // Load 50 businesses at a time
  
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
  
  // Map-related state - start with null to avoid Phoenix flash for users with permission
  const [mapRegion, setMapRegion] = useState(null);
  
  // Track user map interactions to avoid recentering after user pans/zooms
  const hasUserPannedRef = useRef(false);
  const hasCenteredOnLocationRef = useRef(false);
  const VIEWPORT_PADDING_FACTOR = 1.5; // render only markers within ~1.5x current viewport
  
  // Viewport-based search state
  const [viewportBounds, setViewportBounds] = useState(null);
  const boundsDebounceRef = useRef(null);
  const viewportBoundsDebounceRef = useRef(null); // Separate debounce for marker updates
  const lastSearchBoundsRef = useRef(null);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [currentMapCenter, setCurrentMapCenter] = useState(null); // Track current map center for button state
  const [panToUserCoordinate, setPanToUserCoordinate] = useState(null);

  // Initialize location and voice services when component mounts
  useEffect(() => {
    initializeLocation();
    initializeVoiceService();
    // Load businesses after a short delay to ensure everything is initialized
    const timer = setTimeout(() => {
      loadInitialBusinesses(); // Load businesses on app start
    }, 1000);
    return () => {
      clearTimeout(timer);
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

  // Initial load tracking
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const initialLoadRef = useRef(false); // Track if we've done initial load
  
  // No longer need separate initial load effect - handled by handleMapBoundsChange
  const previousCategoryRef = useRef(null); // Track last category to detect clearing
  const previousSearchQueryRef = useRef(''); // Track last search query for clear detection

  // Search effect for text query and category changes (not map movement)
  useEffect(() => {
    // Skip if no location or haven't loaded initial viewport
    if (!userLocation || locationStatus === 'checking' || !hasLoadedInitial) {
      return;
    }

    // Only trigger on category/query changes, NOT on initial load
    // (initial load handled by map bounds change)
    const hasTextQuery = searchQuery.trim().length > 0;
    const categoryCleared = !!previousCategoryRef.current && !selectedCategory;
    const shouldSearch = hasTextQuery || selectedCategory || categoryCleared;
    
    // Don't search if this is just initial state (no query, no category)
    if (!shouldSearch) {
      previousCategoryRef.current = selectedCategory;
      return;
    }
    
    const debounceDelay = hasTextQuery ? 500 : 0; // 500ms for typing, instant for category
    const timer = setTimeout(() => {
      // Use current viewport bounds from state
      performSearch(searchQuery, null); // null means use viewportBounds from state
    }, debounceDelay);

    previousCategoryRef.current = selectedCategory;
    return () => clearTimeout(timer);
  }, [selectedCategory, searchQuery, hasLoadedInitial]);

  // When search input is cleared via keyboard, reset results (same as clear button)
  useEffect(() => {
    if (!hasLoadedInitial) {
      previousSearchQueryRef.current = searchQuery;
      return;
    }
    const prev = previousSearchQueryRef.current;
    const prevHadText = prev && prev.trim().length > 0;
    const nowEmpty = searchQuery.trim().length === 0;
    if (prevHadText && nowEmpty) {
      setSelectedBusiness(null);
      setSearchResults([]);
      setDisplayedBusinesses([]);
      setSearchMetadata(null);
      setSearchError(null);
      performSearch('', viewportBounds);
    }
    previousSearchQueryRef.current = searchQuery;
  }, [searchQuery, hasLoadedInitial, viewportBounds]);

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
        // OPTIMIZATION: Check cached location FIRST to avoid Phoenix flash
        // If we have a cached location, use it immediately while fresh location loads in background
        const cachedLocation = await locationService.getCachedLocation();
        if (cachedLocation) {
          setUserLocation(cachedLocation);
          setLocationStatus('granted');
          
          // Set map region to cached location immediately (prevents Phoenix flash)
          const lat = cachedLocation?.coords?.latitude || cachedLocation?.latitude;
          const lng = cachedLocation?.coords?.longitude || cachedLocation?.longitude;
          
          if (lat && lng) {
            setMapRegion({
              latitude: lat,
              longitude: lng,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            });
          }
          
          // Now try to get fresh location in background (non-blocking)
          getCurrentLocation().catch(() => {
            // Silently fail - we already have cached location
          });
        } else {
          // No cache - try IP location first (fast), then GPS (slow)
          const ipResult = await locationService.getIPLocation();
          if (ipResult.success) {
            // Got IP location quickly (~200ms), show it immediately
            setUserLocation(ipResult.location);
            setLocationStatus('granted');
            
            const lat = ipResult.location?.coords?.latitude;
            const lng = ipResult.location?.coords?.longitude;
            
            if (lat && lng) {
              setMapRegion({
                latitude: lat,
                longitude: lng,
                latitudeDelta: 0.1, // Wider zoom for IP (less accurate)
                longitudeDelta: 0.1,
              });
            }
            
            // Now get accurate GPS in background
            getCurrentLocation().catch(() => {
              // IP location is good enough if GPS fails
            });
          } else {
            // IP failed, fall back to GPS
            await getCurrentLocation();
          }
        }
      } else if (status === 'denied') {
        // Permission denied, set Phoenix as default and try to load cached location
        setMapRegion({
          latitude: 33.4484,
          longitude: -112.0740,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
        setLocationStatus('denied');
        await loadCachedLocation();
      } else {
        // Permission not determined, set Phoenix as default
        setMapRegion({
          latitude: 33.4484,
          longitude: -112.0740,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
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
      // Set Phoenix as fallback on error
      setMapRegion({
        latitude: 33.4484,
        longitude: -112.0740,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
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
        }
        
        // cached location used
      } else {
        throw new Error(result.error || 'Unable to get location');
      }
    } catch (error) {
      console.error('Error getting current location:', error);
      setLocationError(error.message);
      setLocationStatus('unavailable');
      
      // Set Phoenix as fallback to prevent infinite loading screen
      setMapRegion({
        latitude: 33.4484,
        longitude: -112.0740,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
      
      await loadCachedLocation();
    }
  };

  const loadCachedLocation = async () => {
    try {
      const cachedLocation = await locationService.getCachedLocation();
      if (cachedLocation) {
        setUserLocation(cachedLocation);
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
        // Only center on location once (or until user manually pans)
        if (!hasCenteredOnLocationRef.current && !hasUserPannedRef.current) {
          setMapRegion({
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.05, // Closer zoom for better user experience
            longitudeDelta: 0.05,
          });
          hasCenteredOnLocationRef.current = true;
        }
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

      return result;
    } catch (error) {
      console.error('Error requesting permission:', error);
      setLocationError('Failed to request location permission');
      return null;
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
      
      // Process the voice query
      const processedQuery = voiceService.processVoiceSearchQuery(finalTranscription);
      const queryToUse = processedQuery?.processedQuery || finalTranscription;
      
      // Set query (useEffect will trigger search automatically)
      setSearchQuery(queryToUse);
      
      // For voice, we want immediate results, so also call performSearch directly
      performSearch(queryToUse, null); // Use current viewport bounds from state
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

  const initialLoadDoneRef = useRef(false);
  
  const loadInitialBusinesses = async () => {
    // Prevent multiple calls
    if (initialLoadDoneRef.current) {
      // initial load already done, skipping
      return;
    }

    // If we've already gotten viewport bounds and run a bounds-based search, skip the Phoenix fallback
    if (lastSearchBoundsRef.current || viewportBounds) {
      // skip initial fallback when viewport data exists
      initialLoadDoneRef.current = true;
      return;
    }
    
    // loading initial businesses on app start
    initialLoadDoneRef.current = true;
    
    try {
      setLoading(true);
      
      // Default to Phoenix coordinates for initial load
      let searchLat = 33.4484;
      let searchLng = -112.0740;
      let locationSource = 'Phoenix default';
      
      // If user location is available and in Arizona, use it instead
      const lat = userLocation?.coords?.latitude || userLocation?.latitude;
      const lng = userLocation?.coords?.longitude || userLocation?.longitude;
      
      if (lat && lng && lat >= 31 && lat <= 37 && lng >= -115 && lng <= -109) {
        searchLat = lat;
        searchLng = lng;
        locationSource = 'user location';
      }
      
      // Build API request - get businesses within 25 miles radius (reduced for performance)
      const params = new URLSearchParams();
      params.append('lat', searchLat);
      params.append('lng', searchLng);
      params.append('radius', '25'); // Reduced from 50 to 25 miles
      params.append('limit', '200'); // Reduced from 500 to 200 for better performance
      
      const endpoint = `/api/businesses/nearby?${params}`;
      
      const response = await apiRequest(endpoint, {
        method: 'GET',
      });
      
      if (!response.ok) {
        console.error('[MOBILE-SEARCH] Initial load failed:', response.status, response.statusText);
        setLoading(false);
        initialLoadDoneRef.current = false; // Allow retry on error
        return;
      }
      
      const data = await response.json();
      
      if (data.businesses && data.businesses.length > 0) {
        // Set both allBusinesses (for map markers) and searchResults (for list)
        setAllBusinesses(data.businesses);
        setCurrentPage(1);
        const firstPage = data.businesses.slice(0, PAGE_SIZE);
        setSearchResults(firstPage);
        setDisplayedBusinesses(firstPage);
        
        // Only update map region if it hasn't been set yet (to avoid overwriting user location)
        // This prevents the Phoenix flash when location permission is already granted
        setMapRegion(prevRegion => {
          if (prevRegion === null) {
            // Map region not set yet, set it now
            return {
              latitude: searchLat,
              longitude: searchLng,
              latitudeDelta: 0.3,
              longitudeDelta: 0.3,
            };
          }
          // Map region already set (by getCurrentLocation), keep it
          return prevRegion;
        });
      }
      
    } catch (error) {
      console.error('[MOBILE-SEARCH] Error loading initial businesses:', error);
      initialLoadDoneRef.current = false; // Allow retry on error
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async (query, explicitBounds = null) => {
    // Use explicitly passed bounds or fall back to state
    const boundsToUse = explicitBounds || viewportBounds;
    const hasTextQuery = query && query.trim().length > 0;
    
    // Allow empty query to show all nearby businesses (initial load or browsing)
    setLoading(true);
    setSearchError(null); // Clear any previous errors
    
    try {
      // Build query parameters for enhanced search API
      const params = new URLSearchParams({
        query: query,
        limit: 500 // Reduced from 5000 to 500 for better performance
      });

      // Add category filter if selected
      if (selectedCategory) {
        params.append('category_filter', selectedCategory);
      }
      
      // For text searches, remove radius constraint and use a global-ish bounding box
      if (hasTextQuery) {
        params.append('ne_lat', 90);
        params.append('ne_lng', 180);
        params.append('sw_lat', -90);
        params.append('sw_lng', -180);
      } else if (boundsToUse) {
        params.append('ne_lat', boundsToUse.northeast.lat);
        params.append('ne_lng', boundsToUse.northeast.lng);
        params.append('sw_lat', boundsToUse.southwest.lat);
        params.append('sw_lng', boundsToUse.southwest.lng);
      } else {
        params.append('radius', '25');
      }

      // Intelligent location detection from search query
      let searchLat = 33.4484; // Phoenix, AZ latitude (default)
      let searchLng = -112.0740; // Phoenix, AZ longitude (default)
      let locationSource = 'fallback (Phoenix, AZ)';
      
      // PRIORITY 1: Use viewport center if available (viewport-based search)
      if (!hasTextQuery && boundsToUse && boundsToUse.center) {
        searchLat = boundsToUse.center.lat;
        searchLng = boundsToUse.center.lng;
        locationSource = `viewport center (map area)`;
      }
      // PRIORITY 2: Parse query for city names or location indicators
      else if (parseLocationFromQuery(query)) {
        const cityCoords = parseLocationFromQuery(query);
        searchLat = cityCoords.lat;
        searchLng = cityCoords.lng;
        locationSource = `parsed city (${cityCoords.city})`;
      } 
      // PRIORITY 3: "Near me" searches
      else if (query.toLowerCase().includes('near me') || query.toLowerCase().includes('nearby')) {
        // User wants results near their current location
        const lat = userLocation?.coords?.latitude || userLocation?.latitude;
        const lng = userLocation?.coords?.longitude || userLocation?.longitude;

        if (lat && lng) {
          // Arizona rough bounds: lat 31-37, lng -115 to -109
          if (lat >= 31 && lat <= 37 && lng >= -115 && lng <= -109) {
            searchLat = lat;
            searchLng = lng;
            locationSource = `user location (near me)`;

            // Use smaller radius for "near me" searches for more relevant results
            params.set('radius', '10'); // 10 miles instead of 25
          } else {
            // user location outside AZ bounds, fallback to Phoenix
          }
        } else {
          // no user location for "near me", fallback to Phoenix

          // Show a helpful message to user
          setLocationError('To search "near me", please enable location access in settings or use a specific city name.');
        }
      } 
      // PRIORITY 4: User location (if available)
      else if (userLocation) {
        const lat = userLocation?.coords?.latitude || userLocation?.latitude;
        const lng = userLocation?.coords?.longitude || userLocation?.longitude;
        if (lat && lng && lat >= 31 && lat <= 37 && lng >= -115 && lng <= -109) {
          searchLat = lat;
          searchLng = lng;
          locationSource = `user location`;
        }
      }
      
      params.append('lat', searchLat);
      params.append('lng', searchLng);

      const searchEndpoint = `${API_CONFIG.ENDPOINTS.BUSINESSES_SEARCH}?${params}`;

      // Use the shared semantic search API endpoint
      const response = await apiRequest(searchEndpoint);

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

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse API response:', jsonError);
        throw new Error('Invalid JSON response from server');
      }

      // Handle response format from enhanced search API
      let businesses = [];
      if (data && data.businesses && Array.isArray(data.businesses)) {
          businesses = data.businesses;
        // Store enhanced search metadata
        setSearchMetadata(data.searchMetadata || null);
      } else if (data && Array.isArray(data)) {
        businesses = data;
      } else if (data.results && Array.isArray(data.results)) {
        businesses = data.results;
      } else {
        console.error(`[MOBILE-SEARCH] No businesses found in response, data structure:`, Object.keys(data));
        console.error(`[MOBILE-SEARCH] Full response data:`, data);
        businesses = [];
      }

      // Store all businesses and show first page
      setAllBusinesses(businesses);
      setCurrentPage(1);
      const firstPage = businesses.slice(0, PAGE_SIZE);
      setSearchResults(firstPage);
      setDisplayedBusinesses(firstPage);

    } catch (error) {
      console.error('[MOBILE-SEARCH] Search error:', error);
      setSearchResults([]);
      setSearchError(error.message || 'Failed to search businesses');
    } finally {
      setLoading(false);
    }
  };


  // Load more businesses for infinite scroll
  const loadMoreBusinesses = () => {
    if (loadingMore || loading) return; // Prevent multiple loads
    if (displayedBusinesses.length >= allBusinesses.length) return; // All loaded
    
    setLoadingMore(true);
    
    setTimeout(() => {
      const nextPage = currentPage + 1;
      const start = currentPage * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      const newBusinesses = allBusinesses.slice(start, end);
      
      const updatedDisplayed = [...displayedBusinesses, ...newBusinesses];
      setDisplayedBusinesses(updatedDisplayed);
      setSearchResults(updatedDisplayed);
      setCurrentPage(nextPage);
      setLoadingMore(false);
      
    }, 300); // Small delay for smooth UX
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

  // Removed fitMapToResults; auto-center handled via first result when applicable

  // Manual search (bypasses debounce for immediate results)
  const handleTextSearch = () => {
    if (searchQuery.trim() || selectedCategory) {
      performSearch(searchQuery, null); // Use current viewport bounds from state
    }
  };

  const toggleVoiceButtonMinimized = () => {
    setVoiceButtonMinimized(!voiceButtonMinimized);
  };

  const handleBusinessSelect = (business) => {
    setSelectedBusiness(business);
    // Center map on selected business with close zoom to show individual marker
    setMapRegion({
      latitude: business.latitude,
      longitude: business.longitude,
      latitudeDelta: 0.002, // Even closer zoom to ensure we break clusters
      longitudeDelta: 0.002,
    });
  };

  const recenterToUserLocation = () => {
    const lat = userLocation?.coords?.latitude || userLocation?.latitude;
    const lng = userLocation?.coords?.longitude || userLocation?.longitude;
    if (lat && lng) {
      // Reset zoom to the same level as initial load and pan to user
      setMapRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
      setPanToUserCoordinate({ latitude: lat, longitude: lng });
    } else {
      handleEnableLocationPress();
    }
  };

  // Handle map viewport changes for viewport-based search
  const handleMapBoundsChange = useCallback((bounds) => {
    // Mark as loaded on first bounds update
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      setHasLoadedInitial(true);
      // Set initial viewport bounds immediately on first load
      setViewportBounds(bounds);
      setCurrentMapCenter(bounds.center);
      // Kick off an initial fetch for whatever is in view (even with no query/category)
      performSearch('', bounds);
      lastSearchBoundsRef.current = bounds;
      return;
    }
    
    // Track current map center for button state calculation
    setCurrentMapCenter(bounds.center);
    
    // If a text search is active, don't reset results on pan/zoom; just track bounds
    if (searchQuery.trim().length > 0) {
      setViewportBounds(bounds);
      return;
    }
    // User has interacted with the map (pan/zoom)
    hasUserPannedRef.current = true;
    // Immediately show loading state while we debounce the fetch
    setLoading(true);
    
    // Debounce viewport bounds update to prevent marker flickering during drag
    // Only update markers after user stops dragging for 300ms
    if (viewportBoundsDebounceRef.current) {
      clearTimeout(viewportBoundsDebounceRef.current);
    }
    viewportBoundsDebounceRef.current = setTimeout(() => {
      setViewportBounds(bounds);
    }, 300); // Short debounce for smooth dragging
    
    // Clear any existing search debounce timer
    if (boundsDebounceRef.current) {
      clearTimeout(boundsDebounceRef.current);
    }
    
    // Debounce: only search after user stops moving map for ~0.7s
    boundsDebounceRef.current = setTimeout(() => {
      // Always search on viewport change to load businesses in view (even with no query/category)
      lastSearchBoundsRef.current = bounds;
      // CRITICAL: Pass bounds directly to avoid React state timing issues
      performSearch(searchQuery, bounds);
    }, 700); // Faster refresh while avoiding excessive calls during pan
  }, [searchQuery]);
  
  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (boundsDebounceRef.current) {
        clearTimeout(boundsDebounceRef.current);
      }
      if (viewportBoundsDebounceRef.current) {
        clearTimeout(viewportBoundsDebounceRef.current);
      }
    };
  }, []);
  
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

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedBusiness(null);
    setSearchResults([]);
    setDisplayedBusinesses([]);
    setSearchMetadata(null);
    setSearchError(null);
    // Re-run browse fetch for current viewport if available
    performSearch('', viewportBounds);
  };

  // Debug logging for render

  // Memoize markers array to prevent infinite loop
  // Use allBusinesses for map (show all markers), not searchResults (paginated list)
  const mapMarkers = useMemo(() => {
    const markers = [];

    const userLat = userLocation?.coords?.latitude || userLocation?.latitude;
    const userLng = userLocation?.coords?.longitude || userLocation?.longitude;

    if (userLat && userLng) {
      markers.push({
        coordinate: {
          latitude: userLat,
          longitude: userLng,
        },
        title: 'Your Location',
        description: locationStatus === 'granted' ? 'Current location' : 'Manual location',
        pinColor: '#4285f4',
        isUserLocation: true,
      });
    }

    // If we have viewport bounds, filter markers to a padded viewport to reduce load
    let filtered = allBusinesses;
    if (viewportBounds) {
      const { northeast, southwest } = viewportBounds;
      const latCenter = (northeast.lat + southwest.lat) / 2;
      const lngCenter = (northeast.lng + southwest.lng) / 2;
      const latDelta = (northeast.lat - southwest.lat) * VIEWPORT_PADDING_FACTOR;
      const lngDelta = (northeast.lng - southwest.lng) * VIEWPORT_PADDING_FACTOR;
      const latMin = latCenter - latDelta / 2;
      const latMax = latCenter + latDelta / 2;
      const lngMin = lngCenter - lngDelta / 2;
      const lngMax = lngCenter + lngDelta / 2;

      filtered = allBusinesses.filter(b => {
        const lat = b.latitude;
        const lng = b.longitude;
        return lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax;
      });
    }

    // Always include the currently selected business so its marker is present
    if (selectedBusiness) {
      const exists = filtered.some(b => b.id === selectedBusiness.id);
      if (!exists) {
        const sb = allBusinesses.find(b => b.id === selectedBusiness.id);
        if (sb) {
          filtered = [...filtered, sb];
        }
      }
    }

    const businessMarkers = filtered.map(business => ({
      coordinate: {
        latitude: business.latitude,
        longitude: business.longitude,
      },
      title: business.name,
      description: `${business.category} • ${formatDistance(business.distance)}`,
      pinColor: business.lfa_member ? '#3182ce' : '#ef4444',
      businessData: business
    }));
    
    return [...markers, ...businessMarkers];
  }, [allBusinesses, viewportBounds, VIEWPORT_PADDING_FACTOR, userLocation, locationStatus, selectedBusiness]);

  // Compute if map is currently centered on user location (within ~200m tolerance)
  const isCenteredOnUser = useMemo(() => {
    if (!userLocation || !currentMapCenter) return false;
    
    const userLat = userLocation?.coords?.latitude || userLocation?.latitude;
    const userLng = userLocation?.coords?.longitude || userLocation?.longitude;
    
    if (!userLat || !userLng) return false;
    
    const distance = locationService.calculateDistance(
      userLat, userLng,
      currentMapCenter.lat, currentMapCenter.lng
    );
    
    return distance < 0.15; // ~240m tolerance (accounts for map drag inertia)
  }, [userLocation, currentMapCenter]);

  const handleEnableLocationPress = async () => {
    const result = await handleRequestPermission();
    if (!result || !result.success) {
      setShowPermissionModal(true);
    }
    if (result?.success && userLocation) {
      recenterToUserLocation();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Map Container */}
      <View style={styles.mapContainer}>
        {!mapRegion ? (
          // Loading state while waiting for location
          <View style={styles.mapLoadingContainer}>
            <ActivityIndicator size="large" color="#3182ce" />
            <Text style={styles.mapLoadingText}>Loading map...</Text>
          </View>
        ) : (
          <WebMapView
            style={styles.map}
            region={mapRegion}
            onRegionChangeComplete={null}
            onBoundsChange={handleMapBoundsChange}
            showsUserLocation={true}
            showsCompass={true}
            showsScale={true}
            onMarkerPress={handleMapMarkerPress}
            selectedBusiness={selectedBusiness}
            onClearSelection={() => setSelectedBusiness(null)}
            autoFitMarkers={false}
            enableClustering={true}
            markers={mapMarkers}
            panToCoordinate={panToUserCoordinate}
          >
          </WebMapView>
        )}
        {/* Location status overlay */}
        {userLocation && (
          <View style={styles.locationStatusOverlay}>
            <Text style={styles.locationStatusText}>
              {locationStatus === 'granted' ? '📍 Current location' : '📍 Manual location'}
            </Text>
          </View>
        )}
        
        {/* Loading indicator for viewport-based search */}
        {loading && hasLoadedInitial && (
          <View style={styles.searchAreaButtonContainer}>
            <View style={styles.searchAreaButton}>
              <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.searchAreaButtonText}>Searching area...</Text>
            </View>
          </View>
        )}

        {/* Enable / Re-center button (bottom-left) */}
        <View style={styles.enableLocationContainer}>
          <TouchableOpacity
            style={[
              styles.enableLocationButton,
              isCenteredOnUser && styles.enableLocationButtonDisabled,
            ]}
            onPress={userLocation ? recenterToUserLocation : handleEnableLocationPress}
            disabled={isCenteredOnUser}
          >
            <Ionicons
              name="locate"
              size={16}
              color={isCenteredOnUser ? '#3182ce' : '#ffffff'}
            />
            <Text
              style={[
                styles.enableLocationText,
                isCenteredOnUser && styles.enableLocationTextDisabled,
              ]}
            >
              {userLocation ? 'Re-center' : 'Enable location'}
            </Text>
          </TouchableOpacity>
        </View>
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
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearSearch}
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </TouchableOpacity>
        )}
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
          // Just update state - useEffect will trigger search automatically
          setSelectedCategory(category);
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
        ) : searchResults.length === 0 ? (
          <View style={styles.noResultsContainer}>
            <Ionicons name="information-circle-outline" size={20} color="#718096" />
            <Text style={styles.noResultsText}>No businesses in this area yet.</Text>
          </View>
        ) : (
          <FlatList
            ref={businessListRef}
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.resultsList}
            onEndReached={loadMoreBusinesses}
            onEndReachedThreshold={0.5}
            ListFooterComponent={() => {
              if (loadingMore) {
                return (
                  <View style={styles.loadMoreContainer}>
                    <ActivityIndicator size="small" color="#3182ce" />
                    <Text style={styles.loadMoreText}>
                      Loading more... ({displayedBusinesses.length}/{allBusinesses.length})
                    </Text>
                  </View>
                );
              }
              if (allBusinesses.length > 0 && displayedBusinesses.length >= allBusinesses.length) {
                return (
                  <View style={styles.loadMoreContainer}>
                    <Text style={styles.allLoadedText}>
                      ✓ All {allBusinesses.length} businesses loaded
                    </Text>
                  </View>
                );
              }
              return null;
            }}
            onScrollToIndexFailed={(error) => {
              // Fallback if scrollToIndex fails; try scrolling to offset instead
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
  mapLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  mapLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  searchAreaButtonContainer: {
    position: 'absolute',
    top: 50,
    left: '50%',
    transform: [{ translateX: -75 }], // Center the button (half of button width)
    zIndex: 10,
  },
  searchAreaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3182ce',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchAreaButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  enableLocationContainer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    zIndex: 5,
  },
  enableLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(49, 130, 206, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  enableLocationText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  enableLocationButtonDisabled: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#3182ce',
    opacity: 0.5,
  },
  enableLocationTextDisabled: {
    color: '#3182ce',
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
  clearButton: {
    position: 'absolute',
    right: 60,
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 8,
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
  noResultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  noResultsText: {
    marginTop: 8,
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
  },
  loadMoreContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: {
    marginTop: 8,
    fontSize: 14,
    color: '#718096',
  },
  allLoadedText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
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