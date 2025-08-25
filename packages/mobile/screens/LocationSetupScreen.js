import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TextInput,
  Keyboard,
  Platform
} from 'react-native';
import * as Location from 'expo-location';
import { useAuth } from '../components/AuthContext';
import { API_BASE_URL } from '../config';

export default function LocationSetupScreen({ navigation, route }) {
  const { currentUser } = useAuth();
  const { type } = route.params; // 'home' or 'work'
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [manualAddress, setManualAddress] = useState('');
  const [permissionStatus, setPermissionStatus] = useState(null);

  useEffect(() => {
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setPermissionStatus(status);
    } catch (error) {
      console.error('Error checking location permission:', error);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
      
      if (status === 'granted') {
        getCurrentLocation();
      } else {
        Alert.alert(
          'Location Permission Denied',
          'You can still set your location manually by entering an address.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      Alert.alert(
        'Permission Error',
        'Unable to request location permission. You can set your location manually.',
        [{ text: 'OK' }]
      );
    }
  };

  const getCurrentLocation = async () => {
    setLoading(true);
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Reverse geocode to get address
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (reverseGeocode.length > 0) {
        const address = reverseGeocode[0];
        const formattedAddress = `${address.street || ''} ${address.city || ''}, ${address.region || ''} ${address.postalCode || ''}`.trim();
        
        setCurrentLocation({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          address: formattedAddress,
          source: 'gps'
        });
      }
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert(
        'Location Error',
        'Unable to get your current location. Please try again or enter your address manually.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const geocodeAddress = async (address) => {
    try {
      const geocoded = await Location.geocodeAsync(address);
      if (geocoded.length > 0) {
        return {
          lat: geocoded[0].latitude,
          lng: geocoded[0].longitude,
          address: address.trim(),
          source: 'manual'
        };
      }
      throw new Error('Address not found');
    } catch (error) {
      throw new Error('Unable to find that address. Please check and try again.');
    }
  };

  const saveLocation = async (locationData) => {
    setLoading(true);
    try {
      // Get current preferences first
      const prefsResponse = await fetch(`${API_BASE_URL}/api/concierge/preferences`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUser?.id
        }
      });

      let currentPrefs = {
        locationSettings: {
          current: "home",
          home: null,
          work: null
        }
      };

      if (prefsResponse.ok) {
        const data = await prefsResponse.json();
        if (!data.isDefault) {
          currentPrefs = data;
        }
      }

      // Update location settings
      const updatedLocationSettings = {
        ...currentPrefs.locationSettings,
        [type]: locationData
      };

      // If this is the first location being set, make it current
      if (!currentPrefs.locationSettings.home && !currentPrefs.locationSettings.work) {
        updatedLocationSettings.current = type;
      }

      const response = await fetch(`${API_BASE_URL}/api/concierge/preferences/location`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUser?.id
        },
        body: JSON.stringify({
          locationSettings: updatedLocationSettings
        })
      });

      if (response.ok) {
        Alert.alert(
          'Location Saved',
          `Your ${type} location has been saved successfully.`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        throw new Error('Failed to save location');
      }
    } catch (error) {
      console.error('Error saving location:', error);
      Alert.alert(
        'Error',
        'Failed to save your location. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (currentLocation) {
      saveLocation(currentLocation);
    }
  };

  const handleManualAddress = async () => {
    if (!manualAddress.trim()) {
      Alert.alert('Error', 'Please enter an address.');
      return;
    }

    setLoading(true);
    try {
      const locationData = await geocodeAddress(manualAddress);
      await saveLocation(locationData);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const getLocationTitle = () => {
    return type === 'home' ? 'Set Home Location' : 'Set Work Location';
  };

  const getLocationIcon = () => {
    return type === 'home' ? '🏠' : '🏢';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{getLocationTitle()}</Text>
        <Text style={styles.subtitle}>
          {getLocationIcon()} This helps us provide better recommendations near where you spend most of your time.
        </Text>
      </View>

      <View style={styles.content}>
        {/* Current Location Option */}
        {permissionStatus === 'granted' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Use Current Location</Text>
            
            {currentLocation ? (
              <View style={styles.locationCard}>
                <Text style={styles.locationAddress}>{currentLocation.address}</Text>
                <Text style={styles.locationSource}>📍 From GPS</Text>
                <TouchableOpacity 
                  style={styles.useLocationButton}
                  onPress={handleUseCurrentLocation}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.useLocationButtonText}>Use This Location</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.getCurrentButton}
                onPress={getCurrentLocation}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#3182ce" size="small" />
                ) : (
                  <>
                    <Text style={styles.getCurrentButtonText}>📍 Get My Current Location</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Permission Request */}
        {permissionStatus === 'denied' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Enable Location Services</Text>
            <Text style={styles.sectionDesc}>
              Allow location access to quickly set your {type} location using GPS.
            </Text>
            <TouchableOpacity 
              style={styles.permissionButton}
              onPress={requestLocationPermission}
            >
              <Text style={styles.permissionButtonText}>Enable Location Access</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Manual Address Entry */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enter Address Manually</Text>
          <Text style={styles.sectionDesc}>
            Type your {type} address if you prefer not to use GPS.
          </Text>
          
          <TextInput
            style={styles.addressInput}
            placeholder={`Enter your ${type} address...`}
            value={manualAddress}
            onChangeText={setManualAddress}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            returnKeyType="done"
            blurOnSubmit={true}
            onSubmitEditing={Keyboard.dismiss}
          />
          
          <TouchableOpacity 
            style={[
              styles.saveAddressButton,
              (!manualAddress.trim() || loading) && styles.saveAddressButtonDisabled
            ]}
            onPress={handleManualAddress}
            disabled={!manualAddress.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.saveAddressButtonText}>Save Address</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Help Text */}
        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>Why do we need this?</Text>
          <Text style={styles.helpText}>
            Setting your {type} location helps our AI concierge recommend businesses that are convenient for you. We use this to calculate distances and suggest places you can easily visit.
          </Text>
          <Text style={styles.helpText}>
            Your location data is stored securely and only used to improve your recommendations. You can change or remove it anytime in your settings.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3182ce',
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#718096',
    lineHeight: 22,
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  section: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 8,
  },
  sectionDesc: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 16,
    lineHeight: 20,
  },
  locationCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#f7fafc',
  },
  locationAddress: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2d3748',
    marginBottom: 4,
  },
  locationSource: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 16,
  },
  useLocationButton: {
    backgroundColor: '#38a169',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
  },
  useLocationButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  getCurrentButton: {
    borderWidth: 2,
    borderColor: '#3182ce',
    borderStyle: 'dashed',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#ebf8ff',
  },
  getCurrentButtonText: {
    fontSize: 16,
    color: '#3182ce',
    fontWeight: '500',
  },
  permissionButton: {
    backgroundColor: '#3182ce',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addressInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#2d3748',
    backgroundColor: '#ffffff',
    height: 80,
    marginBottom: 16,
  },
  saveAddressButton: {
    backgroundColor: '#3182ce',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveAddressButtonDisabled: {
    backgroundColor: '#a0aec0',
  },
  saveAddressButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  helpSection: {
    marginHorizontal: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4a5568',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#718096',
    lineHeight: 20,
    marginBottom: 12,
  },
});