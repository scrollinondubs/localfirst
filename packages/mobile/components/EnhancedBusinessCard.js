import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FavoriteButton from './FavoriteButton';

const EnhancedBusinessCard = ({ business, onPress, style, isSelected = false }) => {
  const handleWebsitePress = (website) => {
    if (website) {
      const url = website.startsWith('http') ? website : `https://${website}`;
      Linking.canOpenURL(url).then(supported => {
        if (supported) {
          Linking.openURL(url);
        } else {
          console.log("Don't know how to open URI: " + url);
        }
      });
    }
  };

  const handlePhonePress = (phone) => {
    if (phone) {
      const phoneUrl = `tel:${phone.replace(/[^\d+]/g, '')}`;
      Linking.canOpenURL(phoneUrl).then(supported => {
        if (supported) {
          Linking.openURL(phoneUrl);
        } else {
          console.log("Don't know how to open URI: " + phoneUrl);
        }
      });
    }
  };

  const handleDirectionsPress = () => {
    const address = business.address || business.name;
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    
    Linking.canOpenURL(googleMapsUrl).then(supported => {
      if (supported) {
        Linking.openURL(googleMapsUrl);
      } else {
        console.log("Don't know how to open URI: " + googleMapsUrl);
      }
    });
  };

  // Format category display
  const getCategoryDisplay = () => {
    if (business.subcategory && business.category) {
      const categoryName = business.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const subcategoryName = business.subcategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return `${categoryName} • ${subcategoryName}`;
    } else if (business.category) {
      return business.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    return 'Local Business';
  };

  // Get category icon
  const getCategoryIcon = () => {
    const category = business.category;
    const iconMap = {
      'food_dining': 'restaurant',
      'retail_shopping': 'storefront',
      'professional_services': 'briefcase',
      'health_wellness': 'medical',
      'home_services': 'construct',
      'automotive': 'car',
      'arts_entertainment': 'musical-notes',
      'education_training': 'school',
      'beauty_personal_care': 'cut',
      'financial_services': 'card',
      'technology': 'laptop',
      'manufacturing_industrial': 'settings',
      'nonprofit_community': 'people',
      'transportation_logistics': 'bus'
    };
    return iconMap[category] || 'business';
  };

  // Get business attributes badges
  const getAttributeBadges = () => {
    if (!business.businessAttributes) return [];
    
    const attributes = typeof business.businessAttributes === 'string' 
      ? JSON.parse(business.businessAttributes) 
      : business.businessAttributes;

    const badges = [];
    
    // Only show meaningful differentiating attributes that help users make decisions
    if (attributes.woman_owned) badges.push({ label: 'Woman Owned', color: '#E91E63' });
    if (attributes.veteran_owned) badges.push({ label: 'Veteran Owned', color: '#2196F3' });
    if (attributes.family_owned) badges.push({ label: 'Family Owned', color: '#4CAF50' });
    // Removed redundant badges: Local, Verified, Enhanced (present on most/all businesses)
    
    return badges;
  };

  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.selectedCard, style]}
      onPress={() => onPress && onPress(business)}
      activeOpacity={0.7}
    >
      {/* Header with name and category */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.categoryIconContainer}>
            <Ionicons 
              name={getCategoryIcon()} 
              size={16} 
              color="#666" 
            />
          </View>
          <Text style={styles.businessName} numberOfLines={2}>
            {business.name}
          </Text>
          <FavoriteButton businessId={business.id} style={styles.favoriteButton} />
        </View>
        
        <View style={styles.categoryRow}>
          <Text style={styles.category}>{getCategoryDisplay()}</Text>
        </View>
      </View>

      {/* Enhanced business description */}
      {business.businessDescription && (
        <Text style={styles.description} numberOfLines={3}>
          {business.businessDescription}
        </Text>
      )}

      {/* Attributes badges */}
      {getAttributeBadges().length > 0 && (
        <View style={styles.badgesContainer}>
          {getAttributeBadges().slice(0, 4).map((badge, index) => (
            <View key={index} style={[styles.badge, { backgroundColor: badge.color + '20' }]}>
              <Text style={[styles.badgeText, { color: badge.color }]}>
                {badge.label}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Keywords */}
      {business.keywords && business.keywords.length > 0 && (
        <View style={styles.keywordsContainer}>
          <Text style={styles.keywordsLabel}>Specialties:</Text>
          <Text style={styles.keywords} numberOfLines={1}>
            {business.keywords.slice(0, 3).join(' • ')}
          </Text>
        </View>
      )}

      {/* Contact info and actions */}
      <View style={styles.footer}>
        <View style={styles.contactInfo}>
          <Text style={styles.address} numberOfLines={1}>
            📍 {business.address}
          </Text>
        </View>
        
        <View style={styles.actions}>
          {business.distance != null && (
            <Text style={styles.distance}>{business.distance} mi</Text>
          )}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleDirectionsPress}
              accessibilityLabel="Get directions"
            >
              <Ionicons name="navigate" size={16} color="#007AFF" />
            </TouchableOpacity>
            
            {business.phone && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handlePhonePress(business.phone)}
                accessibilityLabel="Call"
              >
                <Ionicons name="call" size={16} color="#007AFF" />
              </TouchableOpacity>
            )}
            
            {business.website && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleWebsitePress(business.website)}
                accessibilityLabel="Website"
              >
                <Ionicons name="globe" size={16} color="#007AFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Search metadata (for debugging) */}
      {business.relevanceScore != null && business.relevanceScore !== 0 && __DEV__ && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            Score: {business.relevanceScore} | Combined: {business.combinedScore}
          </Text>
          {business.matchReasons && business.matchReasons.length > 0 && (
            <Text style={styles.debugText} numberOfLines={1}>
              Matched: {business.matchReasons.slice(0, 2).join(', ')}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  
  header: {
    marginBottom: 4,
  },
  
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  
  categoryIconContainer: {
    width: 20,
    alignItems: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  
  businessName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    lineHeight: 22,
  },
  
  favoriteButton: {
    marginLeft: 8,
  },
  
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 28, // Align with business name
  },
  
  category: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  
  distance: {
    fontSize: 12,
    color: '#999',
    fontWeight: '400',
    textAlign: 'right',
    marginBottom: 2,
  },
  
  description: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginBottom: 12,
  },
  
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  
  keywordsContainer: {
    marginBottom: 12,
  },
  
  keywordsLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginBottom: 2,
  },
  
  keywords: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  
  contactInfo: {
    flex: 1,
  },
  
  address: {
    fontSize: 12,
    color: '#666',
  },
  
  actions: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  
  actionButtonsRow: {
    flexDirection: 'row',
  },
  
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  
  debugInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  
  debugText: {
    fontSize: 10,
    color: '#999',
    marginBottom: 2,
  },
  
  selectedCard: {
    borderWidth: 2,
    borderColor: '#3182ce',
    backgroundColor: '#f0f8ff',
    shadowColor: '#3182ce',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
});

export default EnhancedBusinessCard;