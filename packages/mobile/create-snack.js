import { Snack } from 'snack-sdk';
import fs from 'fs';
import path from 'path';

// Create clean App.js without expo-status-bar (causes Snack issues)
const appJs = `import React from 'react';
import { AuthProvider } from './components/AuthContext';
import AppNavigator from './navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}`;
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

// Extract dependencies we need for Snack
const snackDependencies = {};
const requiredDeps = [
  // Core Expo/React Navigation dependencies that work in Snack
  '@react-navigation/bottom-tabs',
  '@react-navigation/native',
  '@react-navigation/stack',
  'expo-location',
  'expo-speech',
  'react-native-safe-area-context',
  'react-native-screens',
  '@expo/vector-icons'
  // Note: expo-status-bar removed due to Snack module resolution issues
  // Note: Firebase, Voice, and Maps require native modules - will need mocked versions
];

// Add compatible Snack dependencies with proper versions for SDK 53
snackDependencies['@react-navigation/bottom-tabs'] = { version: '^7.4.6' };
snackDependencies['@react-navigation/native'] = { version: '^7.1.17' };
snackDependencies['@react-navigation/stack'] = { version: '^7.4.7' };
snackDependencies['expo-location'] = { version: '~18.1.6' };
snackDependencies['expo-speech'] = { version: '~13.1.7' };
// expo-status-bar removed - causes module resolution issues in Snack
snackDependencies['react-native-safe-area-context'] = { version: '^5.6.1' };
snackDependencies['react-native-screens'] = { version: '^4.15.0' };
snackDependencies['@expo/vector-icons'] = { version: '^14.0.2' };

// Create mock Firebase config for Snack
const mockFirebaseConfig = `// Mock Firebase configuration for Snack environment
// Real Firebase requires native modules not available in Snack
const mockAuth = {
  currentUser: null,
  signInWithEmailAndPassword: async (email, password) => {
    console.log('Mock: Sign in with', email);
    return { user: { uid: 'mock-user-id', email } };
  },
  createUserWithEmailAndPassword: async (email, password) => {
    console.log('Mock: Create user with', email);
    return { user: { uid: 'mock-user-id', email } };
  },
  signOut: async () => {
    console.log('Mock: Sign out');
  }
};

const mockFirestore = {
  collection: (name) => ({
    add: async (data) => {
      console.log('Mock: Add to', name, data);
      return { id: 'mock-doc-id' };
    },
    get: async () => {
      console.log('Mock: Get collection', name);
      return { docs: [] };
    }
  })
};

// Mock auth state change
let authStateListeners = [];
const onAuthStateChanged = (auth, callback) => {
  authStateListeners.push(callback);
  // Simulate no user initially
  setTimeout(() => callback(null), 100);
  return () => {
    authStateListeners = authStateListeners.filter(l => l !== callback);
  };
};

export const auth = mockAuth;
export const firestore = mockFirestore;
export { onAuthStateChanged };
`;

// Create mock Voice service for Snack
const mockVoiceService = `// Mock Voice service for Snack environment
// Real voice recognition requires native modules not available in Snack
class MockVoiceService {
  static isListening = false;
  static listeners = [];

  static async start() {
    console.log('Mock: Starting voice recognition...');
    this.isListening = true;
    
    // Simulate voice input after 2 seconds
    setTimeout(() => {
      const mockResults = ['restaurants near me', 'coffee shops'];
      this.listeners.forEach(listener => {
        if (listener.onSpeechResults) {
          listener.onSpeechResults({ value: mockResults });
        }
      });
    }, 2000);
  }

  static async stop() {
    console.log('Mock: Stopping voice recognition...');
    this.isListening = false;
  }

  static addEventListener(event, callback) {
    console.log('Mock: Adding voice event listener for', event);
    this.listeners.push({ [event]: callback });
  }

  static removeEventListener(event, callback) {
    console.log('Mock: Removing voice event listener for', event);
    this.listeners = this.listeners.filter(l => l[event] !== callback);
  }
}

export default MockVoiceService;
`;

// Create mock components for missing dependencies
const mockLocationPermissionModal = `import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function LocationPermissionModal({ visible, onRequestPermission, onSkip, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Location Permission</Text>
          <Text style={styles.message}>
            Allow location access for better search results?
          </Text>
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.button} onPress={onRequestPermission}>
              <Text style={styles.buttonText}>Allow</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.skipButton]} onPress={onSkip}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    margin: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  message: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    backgroundColor: '#3182ce',
    padding: 10,
    borderRadius: 5,
    minWidth: 80,
  },
  skipButton: {
    backgroundColor: '#gray',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
  },
  skipText: {
    color: 'black',
    textAlign: 'center',
  },
});
`;

const mockManualLocationInput = `import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

export default function ManualLocationInput({ visible, onLocationSelected, onClose }) {
  const [address, setAddress] = useState('');

  const handleConfirm = () => {
    if (address.trim()) {
      onLocationSelected({
        address: address.trim(),
        coords: { latitude: 33.4484, longitude: -112.0740 } // Phoenix default
      });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Enter Location</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter address or city..."
            value={address}
            onChangeText={setAddress}
          />
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.button} onPress={handleConfirm}>
              <Text style={styles.buttonText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    margin: 20,
    width: '80%',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    backgroundColor: '#3182ce',
    padding: 10,
    borderRadius: 5,
    minWidth: 80,
  },
  cancelButton: {
    backgroundColor: '#gray',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
  },
  cancelText: {
    color: 'black',
    textAlign: 'center',
  },
});
`;

// Read additional source files
const authContext = fs.readFileSync('./components/AuthContext.js', 'utf-8');
const searchScreen = fs.readFileSync('./screens/SearchScreen.js', 'utf-8');
const loginScreen = fs.readFileSync('./screens/LoginScreen.js', 'utf-8');
const registerScreen = fs.readFileSync('./screens/RegisterScreen.js', 'utf-8');
const locationService = fs.readFileSync('./services/LocationService.js', 'utf-8');
const appNavigator = fs.readFileSync('./navigation/AppNavigator.js', 'utf-8');

console.log('Creating Snack with Local First Arizona app...');

// Create Snack
const snack = new Snack({
  name: 'Local First Arizona - Voice Search & Location',
  description: 'Mobile app for finding local Arizona businesses with voice search and location services',
  sdkVersion: '53.0.0',
  dependencies: snackDependencies,
  files: {
    'App.js': {
      type: 'CODE',
      contents: appJs
    },
    'components/AuthContext.js': {
      type: 'CODE', 
      contents: authContext
    },
    'screens/SearchScreen.js': {
      type: 'CODE',
      contents: searchScreen
    },
    'screens/LoginScreen.js': {
      type: 'CODE',
      contents: loginScreen
    },
    'screens/RegisterScreen.js': {
      type: 'CODE',
      contents: registerScreen
    },
    'services/VoiceService.js': {
      type: 'CODE',
      contents: mockVoiceService
    },
    'services/LocationService.js': {
      type: 'CODE',
      contents: locationService
    },
    'navigation/AppNavigator.js': {
      type: 'CODE',
      contents: appNavigator
    },
    'config/firebase.js': {
      type: 'CODE',
      contents: mockFirebaseConfig
    },
    'components/LocationPermissionModal.js': {
      type: 'CODE',
      contents: mockLocationPermissionModal
    },
    'components/ManualLocationInput.js': {
      type: 'CODE',
      contents: mockManualLocationInput
    }
  }
});

// Make the Snack available online
snack.setOnline(true);

// Save the Snack to get a permanent URL
snack.saveAsync().then(({ url, id }) => {
  console.log('✅ Snack created successfully!');
  console.log('📱 Snack URL:', url);
  console.log('🔗 Snack ID:', id);
  console.log('');
  console.log('You can now:');
  console.log('1. Open this URL on your phone to test with Expo Go');
  console.log('2. Share this URL with clients for testing');
  console.log('3. Test voice search and location services on mobile');
  
  // Stop Snack when done
  snack.setOnline(false);
}).catch(error => {
  console.error('❌ Failed to create Snack:', error);
  snack.setOnline(false);
});