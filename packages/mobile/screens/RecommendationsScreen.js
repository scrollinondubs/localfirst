import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../components/AuthContext';
import { buildApiUrl } from '../config/api';
import FavoriteButton from '../components/FavoriteButton';

export default function RecommendationsScreen({ navigation }) {
  const { currentUser, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchRecommendations();
    }
  }, [currentUser]);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const response = await fetch(buildApiUrl('/api/concierge/recommendations'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-ID': currentUser?.id,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.recommendations || []);
      } else {
        console.error('Failed to fetch recommendations:', response.status);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generateNewRecommendations = async () => {
    try {
      console.log('[RECOMMENDATIONS] Starting recommendation generation...');
      setGenerating(true);
      
      const url = buildApiUrl('/api/concierge/recommendations/generate');
      await proceedWithGeneration(url);
    } catch (error) {
      console.error('[RECOMMENDATIONS] Exception during setup:', error);
      setGenerating(false);
    }
  };

  const proceedWithGeneration = async (url) => {
    try {
      console.log('[RECOMMENDATIONS] Starting fetch request...');
      
      // Add timeout to the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-ID': currentUser?.id,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log('[RECOMMENDATIONS] Response received - status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[RECOMMENDATIONS] Success response:', data);
        
        // Fetch updated recommendations
        setTimeout(() => fetchRecommendations(), 1000);
      } else {
        const errorText = await response.text();
        console.error('[RECOMMENDATIONS] Error response:', errorText);
      }
    } catch (error) {
      console.error('[RECOMMENDATIONS] Exception during generation:', error);
    } finally {
      setGenerating(false);
    }
  };


  const dismissRecommendation = async (recommendationId) => {
    try {
      const response = await fetch(buildApiUrl(`/api/concierge/recommendations/${recommendationId}/dismiss`), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-ID': currentUser?.id,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Remove from UI immediately
        setRecommendations(prev => prev.filter(r => r.id !== recommendationId));
      } else {
        console.error('Failed to dismiss recommendation');
      }
    } catch (error) {
      console.error('Error dismissing recommendation:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecommendations();
  };

  const renderRecommendationCard = (recommendation) => {
    const { business } = recommendation;
    const matchPercentage = Math.round(recommendation.matchScore * 100);

    return (
      <View key={recommendation.id} style={styles.recommendationCard}>
        {/* Business Image */}
        {business.image && (
          <Image 
            source={{ uri: business.image }} 
            style={styles.businessImage}
            resizeMode="cover"
          />
        )}
        
        {/* Content */}
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={styles.businessInfo}>
              <Text style={styles.businessName}>{business.name}</Text>
              <Text style={styles.businessAddress}>{business.address}</Text>
            </View>
            
            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <FavoriteButton
                businessId={business.id}
                size={24}
                style={styles.favoriteButton}
              />
              
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={() => dismissRecommendation(recommendation.id)}
              >
                <Ionicons name="trash-outline" size={24} color="#718096" />
              </TouchableOpacity>
            </View>
          </View>

          {/* AI Rationale */}
          <Text style={styles.rationale}>{recommendation.rationale}</Text>
          
          {/* Rating */}
          {business.rating && (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={16} color="#f6ad55" />
              <Text style={styles.rating}>{business.rating}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Please sign in to see recommendations.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Recommendations</Text>
        <Text style={styles.headerSubtitle}>AI-powered business suggestions just for you</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Generate New Recommendations Button */}
        <TouchableOpacity
          style={[styles.generateButton, generating && styles.generateButtonDisabled]}
          onPress={generateNewRecommendations}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="sparkles" size={20} color="#ffffff" />
              <Text style={styles.generateButtonText}>Generate New Recommendations</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Loading State */}
        {loading && (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#3182ce" />
            <Text style={styles.loadingText}>Loading your recommendations...</Text>
          </View>
        )}

        {/* Recommendations List */}
        {!loading && recommendations.length > 0 && (
          <View style={styles.recommendationsList}>
            {recommendations.map(renderRecommendationCard)}
          </View>
        )}

        {/* Empty State */}
        {!loading && recommendations.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="sparkles-outline" size={64} color="#cbd5e0" />
            <Text style={styles.emptyStateTitle}>No Recommendations Yet</Text>
            <Text style={styles.emptyStateText}>
              Tap the button above to generate your first set of personalized business recommendations!
            </Text>
          </View>
        )}
      </ScrollView>
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
    paddingVertical: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#718096',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  generateButton: {
    backgroundColor: '#3182ce',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  generateButtonDisabled: {
    backgroundColor: '#a0aec0',
  },
  generateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#718096',
    marginTop: 12,
  },
  recommendationsList: {
    gap: 16,
  },
  recommendationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  businessImage: {
    width: '100%',
    height: 200,
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  businessInfo: {
    flex: 1,
    marginRight: 16,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 4,
  },
  businessAddress: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 4,
  },
  matchScore: {
    fontSize: 14,
    color: '#38a169',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  favoriteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fed7d7',
  },
  dismissButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#edf2f7',
  },
  categories: {
    fontSize: 14,
    color: '#4a5568',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  rationale: {
    fontSize: 15,
    color: '#4a5568',
    lineHeight: 22,
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 14,
    color: '#4a5568',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4a5568',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#e53e3e',
    textAlign: 'center',
  },
});