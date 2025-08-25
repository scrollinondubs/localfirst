import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useAuth } from '../components/AuthContext';

export default function ForceLogoutScreen({ navigation }) {
  const { logout } = useAuth();

  const handleForceLogout = () => {
    // Clear all authentication state
    logout();
    
    // Clear any stored data in localStorage/AsyncStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
      window.sessionStorage.clear();
    }
    
    // Navigate back to main app
    navigation.navigate('Home');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Force Logout</Text>
        <Text style={styles.description}>
          This will clear all authentication data and log you out completely.
        </Text>
        
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleForceLogout}
        >
          <Text style={styles.logoutButtonText}>Force Logout & Clear Data</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  logoutButton: {
    backgroundColor: '#e53e3e',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 16,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonText: {
    color: '#3182ce',
    fontSize: 16,
  },
});