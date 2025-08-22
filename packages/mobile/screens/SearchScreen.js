import React, { useState, useEffect, useCallback } from 'react';
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
import { apiRequest, API_CONFIG } from '../config/api';

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
        // Permission not determined, show modal if first time
        setLocationStatus('unavailable');
        if (!hasAskedBefore) {
          setTimeout(() => {
            setShowPermissionModal(true);
          }, 1000); // Show after a short delay
        } else {
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
        if (result.location && result.location.latitude && result.location.longitude) {
          setMapRegion({
            latitude: result.location.latitude,
            longitude: result.location.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          });
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
    if (location && location.latitude && location.longitude) {
      setMapRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
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
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    
    try {
      // Build query parameters for semantic search API
      const params = new URLSearchParams({
        query: query,
        limit: 50,
        radius: 25 // Limit to 25 miles from user location
      });

      // Add location parameters if available
      if (userLocation && userLocation.coords) {
        params.append('lat', userLocation.coords.latitude);
        params.append('lng', userLocation.coords.longitude); // Note: 'lng' not 'lon' for semantic search API
      }

      // Use the shared semantic search API endpoint
      const response = await apiRequest(`${API_CONFIG.ENDPOINTS.BUSINESSES_SEARCH}?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      // Handle response format from semantic search API
      if (data && data.businesses && Array.isArray(data.businesses)) {
        setSearchResults(data.businesses);
      } else if (data && Array.isArray(data)) {
        setSearchResults(data);
      } else if (data.results && Array.isArray(data.results)) {
        setSearchResults(data.results);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      // You could show an error message to the user here if needed
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
  };

  const renderSearchResult = ({ item }) => {
    const isSelected = selectedBusiness && selectedBusiness.id === item.id;
    
    return (
      <TouchableOpacity 
        style={[styles.resultCard, isSelected && styles.selectedResultCard]}
        onPress={() => handleBusinessSelect(item)}
      >
        <View style={styles.resultHeader}>
          <Text style={styles.resultName}>{item.name}</Text>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={16} color="#fbbf24" />
            <Text style={styles.rating}>{item.rating}</Text>
          </View>
        </View>
        <Text style={styles.resultAddress}>{item.address}</Text>
        <View style={styles.resultFooter}>
          <Text style={[styles.category, item.lfa_member && styles.lfaMember]}>
            {item.lfa_member ? 'LFA Member • ' : ''}{item.category}
          </Text>
          <Text style={styles.distance}>{item.distance}</Text>
        </View>
        
        {/* Expanded details when selected */}
        {isSelected && (
          <View style={styles.expandedDetails}>
            {item.phone && (
              <View style={styles.detailRow}>
                <Ionicons name="call-outline" size={16} color="#718096" />
                <Text style={styles.detailText}>{item.phone}</Text>
              </View>
            )}
            {item.website && (
              <View style={styles.detailRow}>
                <Ionicons name="globe-outline" size={16} color="#718096" />
                <Text style={styles.detailText}>{item.website}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={16} color="#718096" />
              <Text style={styles.detailText}>Tap pin on map to view location</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

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
          autoFitMarkers={!selectedBusiness}
          markers={[
            // User location marker (temporarily disabled for debugging)
            // Business markers
            ...searchResults.map(business => ({
              coordinate: {
                latitude: business.latitude,
                longitude: business.longitude,
              },
              title: business.name,
              description: `${business.category} • ${business.distance || 'Distance unknown'}`,
              pinColor: business.lfa_member ? '#3182ce' : '#ef4444',
              businessData: business
            }))
          ]}
        >
          {/* User location marker */}
          {userLocation && (
            <WebMarker
              coordinate={{
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
              }}
              title="Your Location"
              description={locationStatus === 'granted' ? 'Current location' : 'Manual location'}
              pinColor="blue"
            />
          )}
          
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

      {/* Location Error Message */}
      {locationError && (
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{locationError}</Text>
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
      <View style={styles.resultsContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3182ce" />
            <Text style={styles.loadingText}>Finding businesses for you...</Text>
          </View>
        ) : (
          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.resultsList}
          />
        )}
      </View>

      {/* Voice Search Button - Fixed at Bottom */}
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
    backgroundColor: '#ffffff',
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
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 14,
    color: '#718096',
    marginLeft: 4,
  },
  resultAddress: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 12,
  },
  resultFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  category: {
    fontSize: 14,
    color: '#3182ce',
    fontWeight: '500',
  },
  distance: {
    fontSize: 14,
    color: '#718096',
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
  selectedResultCard: {
    borderColor: '#3182ce',
    borderWidth: 2,
    backgroundColor: '#f0f9ff',
  },
  lfaMember: {
    color: '#3182ce',
    fontWeight: 'bold',
  },
  expandedDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#4a5568',
    marginLeft: 8,
    flex: 1,
  },
});