import React, { useState, useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  Animated,
  Alert,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from './AuthContext';
import { apiRequest } from '../config/api';

const FavoriteButton = ({ 
  businessId, 
  initialFavorited = false, 
  onToggle,
  disabled = false,
  size = 24,
  style = {},
  testID
}) => {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [isLoading, setIsLoading] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [hasInitialized, setHasInitialized] = useState(false);

  // Don't show favorite button for unauthenticated users
  if (!isAuthenticated()) {
    return null;
  }

  // Initialize favorite status from API
  useEffect(() => {
    if (businessId && !hasInitialized) {
      fetchFavoriteStatus();
    }
  }, [businessId, hasInitialized]);

  const fetchFavoriteStatus = async () => {
    try {
      const response = await apiRequest(`/api/favorites/status/${businessId}`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setIsFavorited(data.isFavorited);
      }
    } catch (error) {
      console.warn('Failed to fetch favorite status:', error);
      // Fallback to initialFavorited on error
      setIsFavorited(initialFavorited);
    } finally {
      setHasInitialized(true);
    }
  };

  const triggerHapticFeedback = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.warn('Haptic feedback not available:', error);
      }
    }
  };

  const animatePress = () => {
    // Scale animation: 1.0 -> 0.9 -> 1.1 -> 1.0
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1.1,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1.0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const toggleFavorite = async () => {
    if (disabled || isLoading || !businessId) {
      return;
    }

    // Optimistic update
    const previousState = isFavorited;
    setIsFavorited(!isFavorited);
    setIsLoading(true);

    // Trigger haptic feedback and animation
    triggerHapticFeedback();
    animatePress();

    try {
      let response;
      if (isFavorited) {
        // Remove from favorites
        response = await apiRequest(`/api/favorites/${businessId}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
      } else {
        // Add to favorites
        response = await apiRequest(`/api/favorites/${businessId}`, {
          method: 'POST',
          headers: getAuthHeaders()
        });
      }

      if (!response.ok) {
        throw new Error('Failed to update favorites');
      }

      const data = await response.json();
      
      // Update to server state
      setIsFavorited(!previousState);
      
      // Call the onToggle callback if provided
      if (onToggle) {
        onToggle(!previousState);
      }

    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      
      // Rollback optimistic update on error
      setIsFavorited(previousState);
      
      // Show error message to user
      Alert.alert(
        'Error',
        'Unable to update favorites. Please check your connection and try again.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getIconName = () => {
    return isFavorited ? 'heart' : 'heart-outline';
  };

  const getIconColor = () => {
    if (disabled || isLoading) {
      return '#A0AEC0'; // Disabled state
    }
    return isFavorited ? '#DC2626' : '#718096'; // Red when favorited, grey when not
  };

  return (
    <TouchableOpacity
      style={[
        {
          padding: 12, // 12px padding for 44px minimum touch target with 24px icon
          borderRadius: 22, // Half of 44px for circular touch area
          justifyContent: 'center',
          alignItems: 'center',
        },
        style
      ]}
      onPress={toggleFavorite}
      disabled={disabled || isLoading}
      activeOpacity={0.7}
      testID={testID}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Ionicons
          name={getIconName()}
          size={size}
          color={getIconColor()}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

export default FavoriteButton;