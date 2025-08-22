import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const LocationPermissionModal = ({ 
  visible, 
  onRequestPermission, 
  onSkip, 
  onClose,
  permissionStatus 
}) => {
  const handleOpenSettings = () => {
    Alert.alert(
      'Open Settings',
      'To enable location access, please go to Settings > Privacy & Security > Location Services and allow location access for this app.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Open Settings', 
          onPress: () => {
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:');
            } else {
              Linking.openSettings();
            }
          }
        }
      ]
    );
  };

  const renderContent = () => {
    if (permissionStatus === 'denied') {
      return (
        <>
          <View style={styles.iconContainer}>
            <Ionicons name="location-outline" size={64} color="#ef4444" />
          </View>
          
          <Text style={styles.title}>Location Access Denied</Text>
          
          <Text style={styles.description}>
            Location permission was previously denied. To discover businesses near you, please enable location access in your device settings.
          </Text>
          
          <Text style={styles.benefits}>
            With location access, you can:
            {'\n'}• Find nearby businesses automatically
            {'\n'}• Get accurate distance estimates
            {'\n'}• Discover local favorites
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleOpenSettings}
          >
            <Ionicons name="settings-outline" size={20} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Open Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onSkip}
          >
            <Text style={styles.secondaryButtonText}>Continue Without Location</Text>
          </TouchableOpacity>
        </>
      );
    }

    // Default permission request UI
    return (
      <>
        <View style={styles.iconContainer}>
          <Ionicons name="location-outline" size={64} color="#3182ce" />
        </View>
        
        <Text style={styles.title}>Enable Location Services</Text>
        
        <Text style={styles.description}>
          Local First Arizona uses your location to help you discover amazing businesses in your area.
        </Text>
        
        <Text style={styles.benefits}>
          With location access, you can:
          {'\n'}• Find nearby businesses automatically
          {'\n'}• Get accurate distance estimates
          {'\n'}• Discover local favorites
          {'\n'}• Get personalized recommendations
        </Text>

        <Text style={styles.privacy}>
          Your location data stays private and is only used to improve your search experience.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onRequestPermission}
        >
          <Ionicons name="location" size={20} color="#ffffff" />
          <Text style={styles.primaryButtonText}>Allow Location Access</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onSkip}
        >
          <Text style={styles.secondaryButtonText}>Maybe Later</Text>
        </TouchableOpacity>
      </>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color="#718096" />
          </TouchableOpacity>

          {renderContent()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 1,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d3748',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#4a5568',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  benefits: {
    fontSize: 14,
    color: '#718096',
    lineHeight: 22,
    marginBottom: 16,
    paddingLeft: 8,
  },
  privacy: {
    fontSize: 12,
    color: '#a0aec0',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    fontStyle: 'italic',
  },
  primaryButton: {
    backgroundColor: '#3182ce',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
  },
  secondaryButtonText: {
    color: '#718096',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default LocationPermissionModal;