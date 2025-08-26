import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  PanResponder
} from 'react-native';
// Using custom slider for web compatibility
import { Ionicons } from '@expo/vector-icons';
import WebMapView from '../components/WebMapView';
import { useAuth } from '../components/AuthContext';
import { useRecommendationsEligibility } from '../components/RecommendationsEligibilityContext';
import { buildApiUrl } from '../config/api';

const { width: screenWidth } = Dimensions.get('window');

export default function NotificationPreferencesScreen({ navigation }) {
  const { currentUser, token } = useAuth();
  const { refresh: refreshEligibility } = useRecommendationsEligibility();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // Form state
  const [preferences, setPreferences] = useState({
    location: {
      lat: 33.4484, // Default to Phoenix
      lng: -112.074,
      address: ''
    },
    searchRadius: 25,
    notificationChannels: {
      email: false,
      inApp: true
    },
    notificationFrequency: 'weekly',
    resultsPerNotification: 3
  });

  const [manualAddress, setManualAddress] = useState('');
  const sliderRef = useRef(null);
  const sliderWidth = screenWidth - 48;

  const [mapRegion, setMapRegion] = useState({
    latitude: 33.4484,
    longitude: -112.074,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421
  });

  const frequencyOptions = [
    { value: 'never', label: 'Never' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'bi_weekly', label: 'Bi-weekly' },
    { value: 'monthly', label: 'Monthly' }
  ];

  // Pan responder for draggable slider
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      // Start gesture
    },
    onPanResponderMove: (evt, gestureState) => {
      if (sliderRef.current) {
        sliderRef.current.measure((x, y, width, height, pageX, pageY) => {
          const relativeX = Math.max(0, Math.min(sliderWidth, evt.nativeEvent.pageX - pageX));
          const percentage = relativeX / sliderWidth;
          const newRadius = Math.round(5 + (percentage * 145)); // 5 to 150 miles, rounded to nearest 5
          const roundedRadius = Math.round(newRadius / 5) * 5;
          setPreferences(prev => ({ ...prev, searchRadius: roundedRadius }));
        });
      }
    },
    onPanResponderRelease: () => {
      // End gesture
    }
  });

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const response = await fetch(buildApiUrl('/api/concierge/preferences'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-ID': currentUser?.id,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.locationSettings) {
          const location = JSON.parse(data.locationSettings);
          setPreferences(prev => ({
            ...prev,
            location: {
              lat: location.lat || 33.4484,
              lng: location.lng || -112.074,
              address: location.address || ''
            }
          }));

          setMapRegion(prev => ({
            ...prev,
            latitude: location.lat || 33.4484,
            longitude: location.lng || -112.074
          }));
        }

        if (data.notificationChannels) {
          const channels = JSON.parse(data.notificationChannels);
          setPreferences(prev => ({
            ...prev,
            notificationChannels: {
              email: channels.email || false,
              inApp: channels.in_app !== false // Default to true
            }
          }));
        }

        setPreferences(prev => ({
          ...prev,
          searchRadius: data.searchRadius || 25,
          notificationFrequency: data.notificationFrequency || 'weekly',
          resultsPerNotification: data.resultsPerNotification || 3
        }));
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      Alert.alert('Error', 'Failed to load preferences. Using defaults.');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    // Validate at least one notification channel
    if (!preferences.notificationChannels.email && !preferences.notificationChannels.inApp) {
      Alert.alert('Validation Error', 'Please select at least one notification channel.');
      return;
    }

    try {
      setSaving(true);
      
      // Check if location has coordinates - if not, try to geocode the address
      let locationToSave = preferences.location;
      
      if (!locationToSave.lat || !locationToSave.lng) {
        if (locationToSave.address && locationToSave.address.trim()) {
          try {
            console.log('[PREFS] Location missing coordinates, attempting to geocode:', locationToSave.address);
            
            // Use the same geocoding logic as the geocodeAddress function
            const encodedAddress = encodeURIComponent(locationToSave.address.trim());
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`);
            
            if (response.ok) {
              const data = await response.json();
              
              if (data.length > 0) {
                const result = data[0];
                locationToSave = {
                  lat: parseFloat(result.lat),
                  lng: parseFloat(result.lon),
                  address: result.display_name || locationToSave.address.trim()
                };
                console.log('[PREFS] Successfully geocoded location:', locationToSave);
                
                // Update local state with geocoded location
                setPreferences(prev => ({
                  ...prev,
                  location: locationToSave
                }));
                
                setMapRegion(prev => ({
                  ...prev,
                  latitude: locationToSave.lat,
                  longitude: locationToSave.lng
                }));
              } else {
                throw new Error('Address not found');
              }
            } else {
              throw new Error('Geocoding service unavailable');
            }
          } catch (geocodeError) {
            console.error('[PREFS] Failed to geocode address:', geocodeError);
            Alert.alert(
              'Location Error', 
              `Unable to find coordinates for "${locationToSave.address}". Please use the map to select your location or try a different address.`
            );
            setSaving(false);
            return;
          }
        } else {
          Alert.alert('Location Required', 'Please select a location on the map or enter an address.');
          setSaving(false);
          return;
        }
      }
      
      // Validate that we now have valid coordinates
      if (!locationToSave.lat || !locationToSave.lng || isNaN(locationToSave.lat) || isNaN(locationToSave.lng)) {
        Alert.alert('Location Error', 'Invalid location coordinates. Please select a location on the map.');
        setSaving(false);
        return;
      }
      
      console.log('[PREFS] Saving location with coordinates:', locationToSave);
      
      const requestBody = {
        locationSettings: {
          lat: locationToSave.lat,
          lng: locationToSave.lng,
          address: locationToSave.address
        },
        searchRadius: preferences.searchRadius,
        notificationChannels: {
          email: preferences.notificationChannels.email,
          in_app: preferences.notificationChannels.inApp
        },
        notificationFrequency: preferences.notificationFrequency,
        resultsPerNotification: preferences.resultsPerNotification
      };

      const response = await fetch(buildApiUrl('/api/concierge/preferences'), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-ID': currentUser?.id,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 3000); // Hide after 3 seconds
        
        // Refresh recommendations eligibility since preferences were updated
        console.log('[PREFS] Preferences saved successfully, refreshing eligibility');
        refreshEligibility();
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert('Error', 'Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleMapPress = (coordinate) => {
    const newLocation = {
      lat: coordinate.latitude,
      lng: coordinate.longitude,
      address: `${coordinate.latitude.toFixed(4)}, ${coordinate.longitude.toFixed(4)}`
    };

    setPreferences(prev => ({
      ...prev,
      location: newLocation
    }));

    setMapRegion(prev => ({
      ...prev,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude
    }));
  };

  const useCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          handleMapPress({ latitude, longitude });
        },
        (error) => {
          Alert.alert('Location Error', 'Unable to get your current location. Please select manually on the map or enter an address below.');
        }
      );
    } else {
      Alert.alert('Location Error', 'Geolocation is not supported by this device.');
    }
  };

  const geocodeAddress = async () => {
    if (!manualAddress.trim()) {
      Alert.alert('Address Required', 'Please enter an address to search.');
      return;
    }

    try {
      // Using OpenStreetMap's Nominatim service for geocoding (free, no API key required)
      const encodedAddress = encodeURIComponent(manualAddress.trim());
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`);
      
      if (!response.ok) {
        throw new Error('Geocoding service unavailable');
      }

      const data = await response.json();
      
      if (data.length === 0) {
        Alert.alert('Address Not Found', 'Could not find the specified address. Please try a different address or select a location on the map.');
        return;
      }

      const result = data[0];
      const latitude = parseFloat(result.lat);
      const longitude = parseFloat(result.lon);
      
      // Update preferences with the geocoded address
      const newLocation = {
        lat: latitude,
        lng: longitude,
        address: result.display_name || manualAddress.trim()
      };

      setPreferences(prev => ({
        ...prev,
        location: newLocation
      }));

      setMapRegion(prev => ({
        ...prev,
        latitude: latitude,
        longitude: longitude
      }));
      
      setManualAddress(''); // Clear the input after successful geocoding
      
    } catch (error) {
      console.error('Geocoding error:', error);
      Alert.alert('Geocoding Error', 'Unable to find the address. Please try selecting a location on the map instead.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3182ce" />
          <Text style={styles.loadingText}>Loading preferences...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#2d3748" />
        </TouchableOpacity>
        <Text style={styles.title}>Notification Preferences</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Location Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Your Location</Text>
          <Text style={styles.sectionSubtext}>
            Tap on the map to select your primary location for recommendations
          </Text>
          
          <View style={styles.mapContainer}>
            <WebMapView
              region={mapRegion}
              onMarkerPress={handleMapPress}
              style={styles.map}
              showsUserLocation={true}
              markers={[{
                coordinate: {
                  latitude: preferences.location.lat,
                  longitude: preferences.location.lng
                },
                id: 'user-location'
              }]}
            />
          </View>

          <View style={styles.locationControls}>
            <TouchableOpacity 
              style={[styles.locationButton, { flex: 1, marginRight: 8 }]}
              onPress={useCurrentLocation}
            >
              <Ionicons name="locate" size={20} color="#3182ce" />
              <Text style={styles.locationButtonText}>Use Current Location</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.manualAddressContainer}>
            <Text style={styles.orText}>OR</Text>
            <View style={styles.addressInputContainer}>
              <TextInput
                style={styles.addressInput}
                placeholder="Enter address (e.g., Phoenix, AZ or 123 Main St, Phoenix, AZ)"
                value={manualAddress}
                onChangeText={setManualAddress}
                onSubmitEditing={geocodeAddress}
                returnKeyType="search"
              />
              <TouchableOpacity
                style={styles.searchButton}
                onPress={geocodeAddress}
                disabled={!manualAddress.trim()}
              >
                <Ionicons 
                  name="search" 
                  size={20} 
                  color={manualAddress.trim() ? "#3182ce" : "#a0aec0"} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {preferences.location.address && (
            <Text style={styles.addressText}>
              Selected: {preferences.location.address}
            </Text>
          )}
        </View>

        {/* Search Radius Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📏 Search Radius</Text>
          <Text style={styles.sectionSubtext}>
            How far should we look for recommendations?
          </Text>
          
          <View style={styles.sliderContainer}>
            <View 
              style={styles.customSlider} 
              ref={sliderRef}
              {...panResponder.panHandlers}
            >
              <View style={styles.sliderTrack}>
                <View 
                  style={[
                    styles.sliderProgress, 
                    { width: `${((preferences.searchRadius - 5) / 145) * 100}%` }
                  ]} 
                />
                <View
                  style={[
                    styles.sliderThumb,
                    { left: `${((preferences.searchRadius - 5) / 145) * 100}%` }
                  ]}
                />
              </View>
            </View>
            
            <View style={styles.sliderButtons}>
              <TouchableOpacity
                style={styles.sliderButton}
                onPress={() =>
                  setPreferences(prev => ({ 
                    ...prev, 
                    searchRadius: Math.max(5, prev.searchRadius - 5) 
                  }))
                }
              >
                <Ionicons name="remove" size={20} color="#3182ce" />
                <Text style={styles.sliderButtonText}>-5</Text>
              </TouchableOpacity>

              <Text style={styles.sliderValue}>
                {preferences.searchRadius} miles
              </Text>

              <TouchableOpacity
                style={styles.sliderButton}
                onPress={() =>
                  setPreferences(prev => ({ 
                    ...prev, 
                    searchRadius: Math.min(150, prev.searchRadius + 5) 
                  }))
                }
              >
                <Ionicons name="add" size={20} color="#3182ce" />
                <Text style={styles.sliderButtonText}>+5</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Notification Channels Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📢 Notification Channels</Text>
          <Text style={styles.sectionSubtext}>
            Select all that apply (at least one required)
          </Text>

          <View style={styles.channelOption}>
            <View style={styles.channelInfo}>
              <Ionicons name="mail" size={20} color="#4a5568" />
              <Text style={styles.channelText}>Email notifications</Text>
            </View>
            <Switch
              value={preferences.notificationChannels.email}
              onValueChange={(value) =>
                setPreferences(prev => ({
                  ...prev,
                  notificationChannels: { ...prev.notificationChannels, email: value }
                }))
              }
              trackColor={{ false: '#e2e8f0', true: '#3182ce' }}
              thumbColor={preferences.notificationChannels.email ? '#ffffff' : '#f4f4f4'}
            />
          </View>

          <View style={styles.channelOption}>
            <View style={styles.channelInfo}>
              <Ionicons name="notifications" size={20} color="#4a5568" />
              <Text style={styles.channelText}>In-app notifications</Text>
            </View>
            <Switch
              value={preferences.notificationChannels.inApp}
              onValueChange={(value) =>
                setPreferences(prev => ({
                  ...prev,
                  notificationChannels: { ...prev.notificationChannels, inApp: value }
                }))
              }
              trackColor={{ false: '#e2e8f0', true: '#3182ce' }}
              thumbColor={preferences.notificationChannels.inApp ? '#ffffff' : '#f4f4f4'}
            />
          </View>
        </View>

        {/* Notification Frequency Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⏰ Notification Frequency</Text>
          <Text style={styles.sectionSubtext}>
            How often would you like to receive recommendations?
          </Text>

          {frequencyOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.frequencyOption,
                preferences.notificationFrequency === option.value && styles.frequencyOptionSelected
              ]}
              onPress={() =>
                setPreferences(prev => ({ ...prev, notificationFrequency: option.value }))
              }
            >
              <View style={[
                styles.radioButton,
                preferences.notificationFrequency === option.value && styles.radioButtonSelected
              ]}>
                {preferences.notificationFrequency === option.value && (
                  <View style={styles.radioButtonInner} />
                )}
              </View>
              <Text style={[
                styles.frequencyText,
                preferences.notificationFrequency === option.value && styles.frequencyTextSelected
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Results Per Notification Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔢 Recommendations Per Notification</Text>
          <Text style={styles.sectionSubtext}>
            How many business recommendations would you like to receive each time?
          </Text>

          <View style={styles.counterContainer}>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() =>
                setPreferences(prev => ({
                  ...prev,
                  resultsPerNotification: Math.max(1, prev.resultsPerNotification - 1)
                }))
              }
              disabled={preferences.resultsPerNotification <= 1}
            >
              <Ionicons name="remove" size={20} color={preferences.resultsPerNotification <= 1 ? '#a0aec0' : '#3182ce'} />
            </TouchableOpacity>

            <Text style={styles.counterValue}>{preferences.resultsPerNotification}</Text>

            <TouchableOpacity
              style={styles.counterButton}
              onPress={() =>
                setPreferences(prev => ({
                  ...prev,
                  resultsPerNotification: Math.min(5, prev.resultsPerNotification + 1)
                }))
              }
              disabled={preferences.resultsPerNotification >= 5}
            >
              <Ionicons name="add" size={20} color={preferences.resultsPerNotification >= 5 ? '#a0aec0' : '#3182ce'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Save Button */}
        {showSaveSuccess && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#38a169" />
            <Text style={styles.successText}>Preferences saved successfully!</Text>
          </View>
        )}
        
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={savePreferences}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Preferences</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4a5568',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 4,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3748',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  section: {
    marginTop: 24,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 8,
  },
  sectionSubtext: {
    fontSize: 14,
    color: '#718096',
    lineHeight: 20,
    marginBottom: 16,
  },
  mapContainer: {
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  map: {
    flex: 1,
  },
  locationControls: {
    flexDirection: 'row',
    marginTop: 12,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3182ce',
  },
  locationButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#3182ce',
    fontWeight: '600',
  },
  manualAddressContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  orText: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 12,
    fontWeight: '600',
  },
  addressInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    width: '100%',
  },
  addressInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2d3748',
  },
  searchButton: {
    padding: 8,
    marginLeft: 8,
  },
  addressText: {
    marginTop: 12,
    fontSize: 14,
    color: '#4a5568',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  sliderContainer: {
    alignItems: 'center',
  },
  customSlider: {
    width: screenWidth - 48,
    height: 40,
    justifyContent: 'center',
    marginBottom: 16,
  },
  sliderTrack: {
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    position: 'relative',
  },
  sliderProgress: {
    height: 4,
    backgroundColor: '#3182ce',
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    top: -8,
    width: 20,
    height: 20,
    backgroundColor: '#3182ce',
    borderRadius: 10,
    marginLeft: -10,
  },
  sliderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: screenWidth - 48,
  },
  sliderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3182ce',
  },
  sliderButtonText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#3182ce',
    fontWeight: '600',
  },
  sliderValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3182ce',
  },
  channelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  channelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  channelText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#2d3748',
  },
  frequencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  frequencyOptionSelected: {
    borderColor: '#3182ce',
    backgroundColor: '#ebf8ff',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#3182ce',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3182ce',
  },
  frequencyText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#2d3748',
  },
  frequencyTextSelected: {
    color: '#3182ce',
    fontWeight: '600',
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  counterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f7fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  counterValue: {
    marginHorizontal: 32,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  saveButton: {
    backgroundColor: '#3182ce',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 32,
  },
  saveButtonDisabled: {
    backgroundColor: '#a0aec0',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fff4',
    borderColor: '#38a169',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  successText: {
    color: '#38a169',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});