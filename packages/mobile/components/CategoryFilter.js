import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest, API_CONFIG } from '../config/api';

const CategoryFilter = ({ selectedCategory, onCategoryChange, style }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await apiRequest(API_CONFIG.ENDPOINTS.BUSINESSES_CATEGORIES);
      
      if (response.ok) {
        const data = await response.json();
        setCategories([
          { name: 'all', displayName: 'All Categories', totalCount: '∞' },
          ...data.categories
        ]);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      Alert.alert('Error', 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (categoryName) => {
    const iconMap = {
      'all': 'grid',
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
    return iconMap[categoryName] || 'business';
  };

  const getSelectedCategoryDisplay = () => {
    if (!selectedCategory || selectedCategory === 'all') {
      return 'All Categories';
    }
    
    const category = categories.find(cat => cat.name === selectedCategory);
    return category ? category.displayName : selectedCategory;
  };

  const handleCategorySelect = (categoryName) => {
    const newCategory = categoryName === 'all' ? null : categoryName;
    onCategoryChange(newCategory);
    setModalVisible(false);
  };

  return (
    <View style={[styles.container, style]}>
      {/* Category Filter Button */}
      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons 
          name={getCategoryIcon(selectedCategory || 'all')} 
          size={16} 
          color="#666" 
        />
        <Text style={styles.filterButtonText}>
          {getSelectedCategoryDisplay()}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#666" />
      </TouchableOpacity>

      {/* Clear filter button */}
      {selectedCategory && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={() => handleCategorySelect('all')}
        >
          <Ionicons name="close-circle" size={18} color="#999" />
        </TouchableOpacity>
      )}

      {/* Category Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading categories...</Text>
              </View>
            ) : (
              <ScrollView style={styles.categoriesList}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.name}
                    style={[
                      styles.categoryItem,
                      selectedCategory === category.name && styles.categoryItemSelected
                    ]}
                    onPress={() => handleCategorySelect(category.name)}
                  >
                    <View style={styles.categoryInfo}>
                      <View style={styles.categoryIcon}>
                        <Ionicons 
                          name={getCategoryIcon(category.name)} 
                          size={20} 
                          color={selectedCategory === category.name ? "#007AFF" : "#666"} 
                        />
                      </View>
                      <View style={styles.categoryText}>
                        <Text style={[
                          styles.categoryName,
                          selectedCategory === category.name && styles.categoryNameSelected
                        ]}>
                          {category.displayName}
                        </Text>
                        {category.subcategories && category.subcategories.length > 0 && (
                          <Text style={styles.subcategoriesText}>
                            {category.subcategories.slice(0, 3).map(sub => sub.displayName).join(', ')}
                            {category.subcategories.length > 3 ? '...' : ''}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.categoryCount}>
                      <Text style={[
                        styles.countText,
                        selectedCategory === category.name && styles.countTextSelected
                      ]}>
                        {category.totalCount}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flex: 1,
  },
  
  filterButtonText: {
    marginLeft: 6,
    marginRight: 4,
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '50%',
  },
  
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  
  closeButton: {
    padding: 4,
  },
  
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  
  categoriesList: {
    flex: 1,
  },
  
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  
  categoryItemSelected: {
    backgroundColor: '#f0f8ff',
  },
  
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  
  categoryIcon: {
    width: 32,
    alignItems: 'center',
    marginRight: 12,
  },
  
  categoryText: {
    flex: 1,
  },
  
  categoryName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  
  categoryNameSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  
  subcategoriesText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  
  categoryCount: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 30,
    alignItems: 'center',
  },
  
  countText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  
  countTextSelected: {
    color: '#007AFF',
  },
});

export default CategoryFilter;