import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../components/AuthContext';
import FavoriteButton from '../components/FavoriteButton';
import { apiRequest } from '../config/api';

// Format distance from kilometers to miles with 1 decimal place
function formatDistance(distanceKm) {
  if (!distanceKm) return 'Distance unknown';
  
  // Convert km to miles (1 km = 0.621371 miles)
  const distanceMiles = distanceKm * 0.621371;
  
  // Round to 1 decimal place
  return `${distanceMiles.toFixed(1)} mi`;
}

// Format category names by replacing underscores with spaces and capitalizing
function formatCategoryName(categoryName) {
  if (!categoryName) return '';
  
  return categoryName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function FavoritesScreen() {
  const navigation = useNavigation();
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Fetch favorites when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated()) {
        fetchFavorites();
      }
    }, [isAuthenticated])
  );

  const fetchFavorites = async (isRefresh = false) => {
    if (!isAuthenticated()) {
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      console.log('[FAVORITES] Fetching user favorites...');
      
      const response = await apiRequest('/api/favorites', {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[FAVORITES] Received favorites data:', data);

      // Handle different response formats
      let favoritesData = [];
      if (data && Array.isArray(data.favorites)) {
        favoritesData = data.favorites;
      } else if (data && Array.isArray(data)) {
        favoritesData = data;
      }

      setFavorites(favoritesData);
      console.log(`[FAVORITES] Set ${favoritesData.length} favorites`);

    } catch (error) {
      console.error('[FAVORITES] Error fetching favorites:', error);
      setError(error.message || 'Failed to load favorites');
      
      Alert.alert(
        'Error',
        'Failed to load your favorites. Please check your connection and try again.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchFavorites(true);
  };

  const handleFavoriteRemoved = (businessId) => {
    // Remove the business from the favorites list when unfavorited
    setFavorites(prevFavorites => 
      prevFavorites.filter(business => business.id !== businessId)
    );
  };

  const handleExploreBusiness = () => {
    // Navigate to the main search tab
    navigation.navigate('Home');
  };

  const renderFavoriteItem = ({ item }) => {
    return (
      <View style={styles.favoriteCard}>
        {/* Favorite Button positioned in upper-right corner */}
        <View style={styles.favoriteButtonContainer}>
          <FavoriteButton
            businessId={item.id}
            initialFavorited={true}
            onToggle={(favorited) => {
              if (!favorited) {
                handleFavoriteRemoved(item.id);
              }
            }}
            size={20}
            testID={`favorite-button-${item.id}`}
          />
        </View>
        
        <View style={styles.favoriteContent}>
          <View style={styles.favoriteHeader}>
            <Text style={styles.favoriteName}>{item.name}</Text>
          </View>
          
          <Text style={styles.favoriteAddress}>{item.address}</Text>
          
          <View style={styles.favoriteFooter}>
            <Text style={[styles.category, item.lfa_member && styles.lfaMember]}>
              {item.lfa_member ? 'LFA Member • ' : ''}{formatCategoryName(item.primaryCategory)}{item.subcategory ? ` > ${formatCategoryName(item.subcategory)}` : ''}
            </Text>
            <Text style={styles.distance}>{formatDistance(item.distance)}</Text>
          </View>

          {/* Additional details if available */}
          {(item.phone || item.website) && (
            <View style={styles.contactInfo}>
              {item.phone && (
                <View style={styles.contactRow}>
                  <Ionicons name="call-outline" size={14} color="#718096" />
                  <Text style={styles.contactText}>{item.phone}</Text>
                </View>
              )}
              {item.website && (
                <View style={styles.contactRow}>
                  <Ionicons name="globe-outline" size={14} color="#718096" />
                  <Text style={styles.contactText}>{item.website}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Ionicons name="heart-outline" size={80} color="#CBD5E0" />
      <Text style={styles.emptyStateTitle}>No favorites yet</Text>
      <Text style={styles.emptyStateSubtitle}>
        Tap the heart icon on businesses you love to save them here
      </Text>
      <TouchableOpacity
        style={styles.exploreCTA}
        onPress={handleExploreBusiness}
      >
        <Text style={styles.exploreCTAText}>Explore Local Businesses</Text>
      </TouchableOpacity>
    </View>
  );

  // Show different content based on authentication state
  if (!isAuthenticated()) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.unauthenticatedContainer}>
          <Ionicons name="heart-outline" size={80} color="#CBD5E0" />
          <Text style={styles.unauthenticatedTitle}>Sign in to view favorites</Text>
          <Text style={styles.unauthenticatedSubtitle}>
            Save your favorite local businesses and access them here
          </Text>
          <TouchableOpacity
            style={styles.signInCTA}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.signInCTAText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Favorites</Text>
        <Text style={styles.headerSubtitle}>
          {favorites.length} {favorites.length === 1 ? 'business' : 'businesses'} saved
        </Text>
      </View>

      {/* Error Display */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Favorites List */}
      <FlatList
        data={favorites}
        renderItem={renderFavoriteItem}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.favoritesList,
          favorites.length === 0 && styles.emptyList
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#3182ce']}
            tintColor="#3182ce"
          />
        }
        ListEmptyComponent={!loading ? renderEmptyState : null}
      />

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3182ce" />
          <Text style={styles.loadingText}>Loading your favorites...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#718096',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  favoritesList: {
    padding: 16,
  },
  emptyList: {
    flex: 1,
  },
  favoriteCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    position: 'relative',
  },
  favoriteButtonContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
    elevation: 3,
  },
  favoriteContent: {
    paddingRight: 40, // Make space for favorite button
  },
  favoriteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  favoriteName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  rating: {
    fontSize: 14,
    color: '#718096',
    marginLeft: 4,
  },
  favoriteAddress: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 12,
  },
  favoriteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  category: {
    fontSize: 14,
    color: '#3182ce',
    fontWeight: '500',
  },
  lfaMember: {
    color: '#3182ce',
    fontWeight: 'bold',
  },
  distance: {
    fontSize: 14,
    color: '#718096',
  },
  contactInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  contactText: {
    fontSize: 12,
    color: '#4a5568',
    marginLeft: 6,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3748',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  exploreCTA: {
    backgroundColor: '#3182ce',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  exploreCTAText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  unauthenticatedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  unauthenticatedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3748',
    marginTop: 20,
    marginBottom: 8,
  },
  unauthenticatedSubtitle: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  signInCTA: {
    backgroundColor: '#3182ce',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  signInCTAText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 249, 250, 0.8)',
  },
  loadingText: {
    fontSize: 16,
    color: '#718096',
    marginTop: 16,
  },
});