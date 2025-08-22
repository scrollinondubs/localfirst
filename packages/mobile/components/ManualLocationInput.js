import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

const ManualLocationInput = ({ 
  visible, 
  onLocationSelected, 
  onClose,
  currentLocation 
}) => {
  const [searchText, setSearchText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Common Arizona cities for quick selection
  const popularCities = [
    { name: 'Phoenix', fullName: 'Phoenix, AZ' },
    { name: 'Scottsdale', fullName: 'Scottsdale, AZ' },
    { name: 'Tempe', fullName: 'Tempe, AZ' },
    { name: 'Mesa', fullName: 'Mesa, AZ' },
    { name: 'Chandler', fullName: 'Chandler, AZ' },
    { name: 'Glendale', fullName: 'Glendale, AZ' },
    { name: 'Tucson', fullName: 'Tucson, AZ' },
    { name: 'Peoria', fullName: 'Peoria, AZ' },
  ];

  const searchLocation = async () => {
    if (!searchText.trim()) {
      Alert.alert('Enter Location', 'Please enter a city, address, or ZIP code to search.');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    
    try {
      // Use Expo Location for geocoding
      const geocodeResults = await Location.geocodeAsync(searchText);
      
      if (geocodeResults && geocodeResults.length > 0) {
        // Convert to our format and get address details
        const results = await Promise.all(
          geocodeResults.slice(0, 5).map(async (result, index) => {
            try {
              // Try to get a formatted address
              const reverseGeocode = await Location.reverseGeocodeAsync({
                latitude: result.latitude,
                longitude: result.longitude
              });

              let displayName = searchText;
              if (reverseGeocode && reverseGeocode.length > 0) {
                const addr = reverseGeocode[0];
                displayName = [
                  addr.name || addr.streetNumber,
                  addr.street,
                  addr.city,
                  addr.region,
                  addr.postalCode
                ].filter(Boolean).join(' ');
              }

              return {
                id: index.toString(),
                name: displayName,
                coordinates: {
                  latitude: result.latitude,
                  longitude: result.longitude
                }
              };
            } catch (error) {
              return {
                id: index.toString(),
                name: searchText,
                coordinates: {
                  latitude: result.latitude,
                  longitude: result.longitude
                }
              };
            }
          })
        );

        setSearchResults(results);
      } else {
        setSearchResults([]);
        Alert.alert(
          'Location Not Found', 
          'Could not find the specified location. Please try a different search term or select from popular cities below.'
        );
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setSearchResults([]);
      Alert.alert(
        'Search Error', 
        'Unable to search for location. Please check your internet connection and try again.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  const selectLocation = (location) => {
    onLocationSelected({
      coords: location.coordinates,
      address: location.name,
      isManual: true
    });
    handleClose();
  };

  const selectPopularCity = async (city) => {
    setSearchText(city.fullName);
    setIsSearching(true);
    setHasSearched(true);
    
    try {
      const geocodeResults = await Location.geocodeAsync(city.fullName);
      if (geocodeResults && geocodeResults.length > 0) {
        const result = geocodeResults[0];
        selectLocation({
          name: city.fullName,
          coordinates: {
            latitude: result.latitude,
            longitude: result.longitude
          }
        });
      }
    } catch (error) {
      console.error('Error geocoding popular city:', error);
      Alert.alert('Error', 'Unable to select this city. Please try searching manually.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleClose = () => {
    setSearchText('');
    setSearchResults([]);
    setHasSearched(false);
    onClose();
  };

  const useCurrentLocation = () => {
    if (currentLocation) {
      onLocationSelected({
        coords: currentLocation.coords,
        address: 'Current Location',
        isManual: false
      });
      handleClose();
    }
  };

  const renderSearchResult = ({ item }) => (
    <TouchableOpacity 
      style={styles.resultItem}
      onPress={() => selectLocation(item)}
    >
      <Ionicons name="location-outline" size={20} color="#3182ce" />
      <Text style={styles.resultText}>{item.name}</Text>
      <Ionicons name="chevron-forward" size={16} color="#a0aec0" />
    </TouchableOpacity>
  );

  const renderPopularCity = ({ item }) => (
    <TouchableOpacity 
      style={styles.popularCityItem}
      onPress={() => selectPopularCity(item)}
    >
      <Text style={styles.popularCityText}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Enter Your Location</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
            >
              <Ionicons name="close" size={24} color="#718096" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Enter a city, address, or ZIP code to find businesses near you
          </Text>

          {/* Current Location Button (if available) */}
          {currentLocation && (
            <TouchableOpacity
              style={styles.currentLocationButton}
              onPress={useCurrentLocation}
            >
              <Ionicons name="locate" size={20} color="#3182ce" />
              <Text style={styles.currentLocationText}>Use Current Location</Text>
            </TouchableOpacity>
          )}

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Enter city, address, or ZIP code..."
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={searchLocation}
              autoCapitalize="words"
              returnKeyType="search"
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={searchLocation}
              disabled={isSearching}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="search" size={20} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>

          {/* Search Results */}
          {hasSearched && searchResults.length > 0 && (
            <View style={styles.resultsSection}>
              <Text style={styles.sectionTitle}>Search Results</Text>
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item) => item.id}
                style={styles.resultsList}
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}

          {/* Popular Cities */}
          {(!hasSearched || searchResults.length === 0) && (
            <View style={styles.popularSection}>
              <Text style={styles.sectionTitle}>Popular Arizona Cities</Text>
              <FlatList
                data={popularCities}
                renderItem={renderPopularCity}
                keyExtractor={(item) => item.name}
                numColumns={2}
                style={styles.popularList}
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 20,
    lineHeight: 20,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f3ff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  currentLocationText: {
    color: '#3182ce',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f7fafc',
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
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 48,
  },
  resultsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 12,
  },
  resultsList: {
    maxHeight: 200,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f7fafc',
    borderRadius: 8,
    marginBottom: 8,
  },
  resultText: {
    flex: 1,
    fontSize: 16,
    color: '#2d3748',
    marginLeft: 12,
  },
  popularSection: {
    flex: 1,
  },
  popularList: {
    flexGrow: 0,
  },
  popularCityItem: {
    flex: 1,
    backgroundColor: '#f7fafc',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    margin: 4,
    alignItems: 'center',
  },
  popularCityText: {
    fontSize: 14,
    color: '#2d3748',
    fontWeight: '500',
  },
});

export default ManualLocationInput;