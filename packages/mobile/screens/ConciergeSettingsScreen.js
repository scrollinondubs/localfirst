import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useAuth } from '../components/AuthContext';
import { API_BASE_URL } from '../config';

export default function ConciergeSettingsScreen({ navigation }) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    notificationFrequency: 'weekly',
    notificationChannels: {
      in_app: true,
      push: false,
      email: false,
      sms: false
    },
    quietHours: {
      enabled: false,
      start: "22:00",
      end: "08:00"
    },
    preferredDays: ["monday", "wednesday", "friday"],
    locationSettings: {
      current: "home",
      home: null,
      work: null
    },
    searchRadius: 15,
    weekendRadius: 25,
    dataUsageConsent: true,
    profileSharingLevel: 'minimal'
  });

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/concierge/preferences`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUser?.id
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (!data.isDefault) {
          setPreferences(data);
        }
      } else {
        console.error('Failed to load preferences');
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/concierge/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUser?.id
        },
        body: JSON.stringify(preferences)
      });

      if (response.ok) {
        Alert.alert(
          'Settings Saved',
          'Your concierge preferences have been updated successfully.',
          [{ text: 'OK' }]
        );
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert(
        'Error',
        'Failed to save your preferences. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (key, value) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const updateNestedPreference = (parentKey, childKey, value) => {
    setPreferences(prev => ({
      ...prev,
      [parentKey]: {
        ...prev[parentKey],
        [childKey]: value
      }
    }));
  };

  const frequencyOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'twice_weekly', label: 'Twice Weekly' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'bi_weekly', label: 'Bi-Weekly' },
    { value: 'monthly', label: 'Monthly' }
  ];

  const radiusOptions = [
    { value: 5, label: '5 miles' },
    { value: 10, label: '10 miles' },
    { value: 15, label: '15 miles' },
    { value: 25, label: '25 miles' },
    { value: 50, label: '50 miles' }
  ];

  const sharingLevels = [
    { value: 'minimal', label: 'Minimal', desc: 'Basic preferences only' },
    { value: 'standard', label: 'Standard', desc: 'Interests and preferences' },
    { value: 'detailed', label: 'Detailed', desc: 'Full profile for best matches' }
  ];

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
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>AI Concierge Settings</Text>
          <Text style={styles.subtitle}>
            Customize how often and how we send you personalized business recommendations
          </Text>
        </View>

        {/* Notification Frequency */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommendation Frequency</Text>
          <Text style={styles.sectionDesc}>How often would you like to receive recommendations?</Text>
          
          {frequencyOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.radioOption,
                preferences.notificationFrequency === option.value && styles.radioOptionSelected
              ]}
              onPress={() => updatePreference('notificationFrequency', option.value)}
            >
              <View style={[
                styles.radioCircle,
                preferences.notificationFrequency === option.value && styles.radioCircleSelected
              ]}>
                {preferences.notificationFrequency === option.value && (
                  <View style={styles.radioInner} />
                )}
              </View>
              <Text style={[
                styles.radioText,
                preferences.notificationFrequency === option.value && styles.radioTextSelected
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Notification Channels */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Methods</Text>
          <Text style={styles.sectionDesc}>How would you like to receive recommendations?</Text>
          
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>In-App Notifications</Text>
              <Text style={styles.switchDesc}>Show recommendations when you open the app</Text>
            </View>
            <Switch
              value={preferences.notificationChannels.in_app}
              onValueChange={(value) => updateNestedPreference('notificationChannels', 'in_app', value)}
              trackColor={{ false: "#e2e8f0", true: "#63b3ed" }}
              thumbColor={preferences.notificationChannels.in_app ? "#3182ce" : "#cbd5e0"}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Push Notifications</Text>
              <Text style={styles.switchDesc}>Send notifications to your device</Text>
            </View>
            <Switch
              value={preferences.notificationChannels.push}
              onValueChange={(value) => updateNestedPreference('notificationChannels', 'push', value)}
              trackColor={{ false: "#e2e8f0", true: "#63b3ed" }}
              thumbColor={preferences.notificationChannels.push ? "#3182ce" : "#cbd5e0"}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Email Recommendations</Text>
              <Text style={styles.switchDesc}>Send recommendations to your email</Text>
            </View>
            <Switch
              value={preferences.notificationChannels.email}
              onValueChange={(value) => updateNestedPreference('notificationChannels', 'email', value)}
              trackColor={{ false: "#e2e8f0", true: "#63b3ed" }}
              thumbColor={preferences.notificationChannels.email ? "#3182ce" : "#cbd5e0"}
            />
          </View>
        </View>

        {/* Search Radius */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Search Distance</Text>
          <Text style={styles.sectionDesc}>How far should we look for recommendations?</Text>
          
          <View style={styles.radiusContainer}>
            <Text style={styles.radiusLabel}>Regular searches: {preferences.searchRadius} miles</Text>
            <View style={styles.radiusButtons}>
              {radiusOptions.map((option) => (
                <TouchableOpacity
                  key={`regular-${option.value}`}
                  style={[
                    styles.radiusButton,
                    preferences.searchRadius === option.value && styles.radiusButtonSelected
                  ]}
                  onPress={() => updatePreference('searchRadius', option.value)}
                >
                  <Text style={[
                    styles.radiusButtonText,
                    preferences.searchRadius === option.value && styles.radiusButtonTextSelected
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.radiusContainer}>
            <Text style={styles.radiusLabel}>Weekend/leisure searches: {preferences.weekendRadius} miles</Text>
            <View style={styles.radiusButtons}>
              {radiusOptions.map((option) => (
                <TouchableOpacity
                  key={`weekend-${option.value}`}
                  style={[
                    styles.radiusButton,
                    preferences.weekendRadius === option.value && styles.radiusButtonSelected
                  ]}
                  onPress={() => updatePreference('weekendRadius', option.value)}
                >
                  <Text style={[
                    styles.radiusButtonText,
                    preferences.weekendRadius === option.value && styles.radiusButtonTextSelected
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Location Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location Settings</Text>
          <Text style={styles.sectionDesc}>Set your home and work locations for better recommendations</Text>
          
          <TouchableOpacity 
            style={styles.locationButton}
            onPress={() => navigation.navigate('LocationSetup', { type: 'home' })}
          >
            <Text style={styles.locationButtonText}>
              🏠 Home: {preferences.locationSettings.home?.address || 'Not set'}
            </Text>
            <Text style={styles.locationArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.locationButton}
            onPress={() => navigation.navigate('LocationSetup', { type: 'work' })}
          >
            <Text style={styles.locationButtonText}>
              🏢 Work: {preferences.locationSettings.work?.address || 'Not set'}
            </Text>
            <Text style={styles.locationArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Privacy Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Data Usage</Text>
          
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Data Usage Consent</Text>
              <Text style={styles.switchDesc}>Allow us to use your data to improve recommendations</Text>
            </View>
            <Switch
              value={preferences.dataUsageConsent}
              onValueChange={(value) => updatePreference('dataUsageConsent', value)}
              trackColor={{ false: "#e2e8f0", true: "#63b3ed" }}
              thumbColor={preferences.dataUsageConsent ? "#3182ce" : "#cbd5e0"}
            />
          </View>

          <Text style={styles.subsectionTitle}>Profile Sharing Level</Text>
          {sharingLevels.map((level) => (
            <TouchableOpacity
              key={level.value}
              style={[
                styles.radioOption,
                preferences.profileSharingLevel === level.value && styles.radioOptionSelected
              ]}
              onPress={() => updatePreference('profileSharingLevel', level.value)}
            >
              <View style={[
                styles.radioCircle,
                preferences.profileSharingLevel === level.value && styles.radioCircleSelected
              ]}>
                {preferences.profileSharingLevel === level.value && (
                  <View style={styles.radioInner} />
                )}
              </View>
              <View style={styles.radioContent}>
                <Text style={[
                  styles.radioText,
                  preferences.profileSharingLevel === level.value && styles.radioTextSelected
                ]}>
                  {level.label}
                </Text>
                <Text style={styles.radioDesc}>{level.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Save Button */}
        <View style={styles.saveContainer}>
          <TouchableOpacity 
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={savePreferences}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Save Preferences</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
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
    color: '#718096',
  },
  scrollView: {
    flex: 1,
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
  section: {
    backgroundColor: '#ffffff',
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 24,
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
    marginBottom: 20,
    lineHeight: 20,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a5568',
    marginTop: 20,
    marginBottom: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  radioOptionSelected: {
    borderColor: '#3182ce',
    backgroundColor: '#ebf8ff',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e0',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#3182ce',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3182ce',
  },
  radioContent: {
    flex: 1,
  },
  radioText: {
    fontSize: 16,
    color: '#4a5568',
    fontWeight: '500',
  },
  radioTextSelected: {
    color: '#3182ce',
  },
  radioDesc: {
    fontSize: 14,
    color: '#718096',
    marginTop: 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f7fafc',
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2d3748',
    marginBottom: 4,
  },
  switchDesc: {
    fontSize: 14,
    color: '#718096',
    lineHeight: 18,
  },
  radiusContainer: {
    marginBottom: 24,
  },
  radiusLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4a5568',
    marginBottom: 12,
  },
  radiusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radiusButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  radiusButtonSelected: {
    borderColor: '#3182ce',
    backgroundColor: '#ebf8ff',
  },
  radiusButtonText: {
    fontSize: 14,
    color: '#4a5568',
    fontWeight: '500',
  },
  radiusButtonTextSelected: {
    color: '#3182ce',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    marginBottom: 12,
  },
  locationButtonText: {
    fontSize: 16,
    color: '#4a5568',
    flex: 1,
  },
  locationArrow: {
    fontSize: 18,
    color: '#cbd5e0',
  },
  saveContainer: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  saveButton: {
    backgroundColor: '#3182ce',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#a0aec0',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomSpacer: {
    height: 32,
  },
});