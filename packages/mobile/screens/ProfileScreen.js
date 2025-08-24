import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView
} from 'react-native';
import { useAuth } from '../components/AuthContext';

export default function ProfileScreen({ navigation }) {
  const { currentUser, logout } = useAuth();
  const [showAuthOptions, setShowAuthOptions] = useState(false);

  if (currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Your Profile</Text>
            <Text style={styles.subtitle}>Welcome back, {currentUser.name || currentUser.email}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Settings</Text>
            <TouchableOpacity style={styles.optionButton}>
              <Text style={styles.optionText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionButton}>
              <Text style={styles.optionText}>Notification Preferences</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionButton}>
              <Text style={styles.optionText}>Saved Searches</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personalization</Text>
            <TouchableOpacity 
              style={styles.optionButton}
              onPress={() => navigation.navigate('ProfileInterview')}
            >
              <Text style={styles.optionText}>Complete Profile Interview</Text>
              <Text style={styles.optionSubtext}>Get personalized business recommendations</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionButton}>
              <Text style={styles.optionText}>Business Preferences</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionButton}>
              <Text style={styles.optionText}>Location History</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.button, styles.logoutButton]} 
            onPress={logout}
          >
            <Text style={[styles.buttonText, styles.logoutButtonText]}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile & Personalization</Text>
          <Text style={styles.subtitle}>
            Create an account to save your preferences and get personalized recommendations
          </Text>
        </View>

        <View style={styles.benefits}>
          <Text style={styles.benefitsTitle}>Benefits of creating an account:</Text>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitText}>• Save your favorite businesses</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitText}>• Get personalized deals and offers</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitText}>• Save search history and preferences</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitText}>• Receive notifications about new local businesses</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.button}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.buttonText}>Create Account</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Sign In</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          You can continue using the app without an account. This is completely optional.
        </Text>
      </ScrollView>
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
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 16,
  },
  optionButton: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  optionText: {
    fontSize: 16,
    color: '#2d3748',
  },
  optionSubtext: {
    fontSize: 14,
    color: '#718096',
    marginTop: 4,
  },
  benefits: {
    marginBottom: 32,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 16,
  },
  benefitItem: {
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 16,
    color: '#4a5568',
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#3182ce',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#3182ce',
  },
  logoutButton: {
    backgroundColor: '#e53e3e',
    marginTop: 32,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButtonText: {
    color: '#3182ce',
  },
  logoutButtonText: {
    color: '#ffffff',
  },
  disclaimer: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 32,
  },
});