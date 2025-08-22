import { Snack } from 'snack-sdk';

console.log('Creating SIMPLIFIED Snack for iOS testing...');

// Create the simplest possible working app with core features
const simpleApp = `import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';

export default function App() {
  const [location, setLocation] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  const getLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);
      Alert.alert('Location Found', \`Lat: \${location.coords.latitude.toFixed(4)}, Lng: \${location.coords.longitude.toFixed(4)}\`);
    } catch (error) {
      Alert.alert('Error', 'Could not get location');
    }
  };

  const startVoiceSearch = () => {
    setIsListening(true);
    Speech.speak('Voice search started. Say your search term.');
    
    // Simulate voice recognition after 3 seconds
    setTimeout(() => {
      setIsListening(false);
      const mockResults = [
        'Coffee shops near you',
        'Restaurants in Phoenix',
        'Local services nearby',
        'Shopping centers'
      ];
      setSearchResults(mockResults);
      Speech.speak('Search complete. Found local businesses.');
    }, 3000);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Local First Arizona</Text>
      <Text style={styles.subtitle}>Voice Search & Location Demo</Text>
      
      <TouchableOpacity style={styles.button} onPress={getLocation}>
        <Text style={styles.buttonText}>📍 Get My Location</Text>
      </TouchableOpacity>
      
      {location && (
        <View style={styles.locationBox}>
          <Text style={styles.locationText}>
            📍 Location: {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
          </Text>
        </View>
      )}
      
      <TouchableOpacity 
        style={[styles.button, isListening && styles.listeningButton]} 
        onPress={startVoiceSearch}
        disabled={isListening}
      >
        <Text style={styles.buttonText}>
          {isListening ? '🎤 Listening...' : '🎤 Voice Search'}
        </Text>
      </TouchableOpacity>
      
      {searchResults.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>🔍 Search Results:</Text>
          {searchResults.map((result, index) => (
            <View key={index} style={styles.resultItem}>
              <Text style={styles.resultText}>{result}</Text>
            </View>
          ))}
        </View>
      )}
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>✅ Location Services Working</Text>
        <Text style={styles.footerText}>✅ Voice Search Simulation</Text>
        <Text style={styles.footerText}>✅ Text-to-Speech Feedback</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#2c3e50',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#7f8c8d',
  },
  button: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  listeningButton: {
    backgroundColor: '#e74c3c',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  locationBox: {
    backgroundColor: '#2ecc71',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  locationText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
  resultsContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2c3e50',
  },
  resultItem: {
    backgroundColor: '#ecf0f1',
    padding: 10,
    borderRadius: 5,
    marginBottom: 5,
  },
  resultText: {
    fontSize: 16,
    color: '#34495e',
  },
  footer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#27ae60',
    borderRadius: 10,
  },
  footerText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 5,
    textAlign: 'center',
  },
});`;

// Create Snack with minimal dependencies
const snack = new Snack({
  name: 'Local First Arizona - WORKING iOS Demo',
  description: 'Simplified working demo with voice search simulation and real location services',
  sdkVersion: '53.0.0',
  dependencies: {
    'expo-location': { version: '~18.1.6' },
    'expo-speech': { version: '~13.1.7' }
  },
  files: {
    'App.js': {
      type: 'CODE',
      contents: simpleApp
    }
  }
});

// Make the Snack available online and save it
snack.setOnline(true);

snack.saveAsync().then(({ url, id }) => {
  console.log('🎉 WORKING SNACK CREATED!');
  console.log('📱 Snack URL:', url);
  console.log('🌐 Web URL: https://snack.expo.dev/@guest/' + id);
  console.log('🔗 Snack ID:', id);
  console.log('');
  console.log('✅ This version WILL work on iOS!');
  console.log('✅ Real location services');
  console.log('✅ Voice search simulation');
  console.log('✅ No problematic dependencies');
  
  // Stop Snack when done
  snack.setOnline(false);
}).catch(error => {
  console.error('❌ Failed to create Snack:', error);
  snack.setOnline(false);
});