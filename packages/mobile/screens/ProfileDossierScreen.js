import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useAuth } from '../components/AuthContext';
import { API_BASE_URL } from '../config';

export default function ProfileDossierScreen({ navigation }) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({
    summary: '',
    insights: {
      interests: [],
      upcomingNeeds: [],
      values: [],
      giftGiving: [],
      businessTypes: [],
      budgetStyle: 'unknown',
      shoppingStyle: 'unknown'
    },
    preferences: {},
    profileCompleteness: 0,
    lastInterviewDate: null
  });

  const [editingData, setEditingData] = useState({});

  useEffect(() => {
    loadProfileDossier();
  }, []);

  const loadProfileDossier = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/concierge/profile-dossier`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUser?.id
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setEditingData(data);
      } else if (response.status === 404) {
        // No profile found, user needs to complete interview
        setProfile({
          summary: 'Complete your interview to generate your profile dossier.',
          insights: {
            interests: [],
            upcomingNeeds: [],
            values: [],
            giftGiving: [],
            businessTypes: [],
            budgetStyle: 'unknown',
            shoppingStyle: 'unknown'
          },
          preferences: {},
          profileCompleteness: 0,
          lastInterviewDate: null,
          needsInterview: true
        });
      } else {
        throw new Error('Failed to load profile');
      }
    } catch (error) {
      console.error('Error loading profile dossier:', error);
      Alert.alert(
        'Error',
        'Failed to load your profile dossier. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const saveProfileDossier = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/concierge/profile-dossier`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': currentUser?.id
        },
        body: JSON.stringify({
          summary: editingData.summary,
          insights: editingData.insights,
          preferences: editingData.preferences
        })
      });

      if (response.ok) {
        setProfile(editingData);
        setEditing(false);
        Alert.alert(
          'Profile Updated',
          'Your profile dossier has been updated successfully.',
          [{ text: 'OK' }]
        );
      } else {
        throw new Error('Failed to save profile');
      }
    } catch (error) {
      console.error('Error saving profile dossier:', error);
      Alert.alert(
        'Error',
        'Failed to save your profile changes. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setSaving(false);
    }
  };

  const startEditing = () => {
    setEditingData({ ...profile });
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditingData({ ...profile });
    setEditing(false);
  };

  const updateEditingData = (field, value) => {
    setEditingData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateInsights = (category, value) => {
    setEditingData(prev => ({
      ...prev,
      insights: {
        ...prev.insights,
        [category]: value
      }
    }));
  };

  const addArrayItem = (category, item) => {
    if (!item.trim()) return;
    
    const currentItems = editingData.insights[category] || [];
    if (!currentItems.includes(item.trim())) {
      updateInsights(category, [...currentItems, item.trim()]);
    }
  };

  const removeArrayItem = (category, index) => {
    const currentItems = editingData.insights[category] || [];
    updateInsights(category, currentItems.filter((_, i) => i !== index));
  };

  const renderArrayEditor = (title, category, placeholder) => {
    const items = editing ? (editingData.insights[category] || []) : (profile.insights[category] || []);
    const [newItem, setNewItem] = useState('');

    return (
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {items.length > 0 ? (
          <View style={styles.tagContainer}>
            {items.map((item, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{item}</Text>
                {editing && (
                  <TouchableOpacity
                    style={styles.tagRemove}
                    onPress={() => removeArrayItem(category, index)}
                  >
                    <Text style={styles.tagRemoveText}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No {title.toLowerCase()} added yet</Text>
        )}
        
        {editing && (
          <View style={styles.addItemContainer}>
            <TextInput
              style={styles.addItemInput}
              placeholder={placeholder}
              value={newItem}
              onChangeText={setNewItem}
              onSubmitEditing={() => {
                addArrayItem(category, newItem);
                setNewItem('');
              }}
            />
            <TouchableOpacity
              style={styles.addItemButton}
              onPress={() => {
                addArrayItem(category, newItem);
                setNewItem('');
              }}
            >
              <Text style={styles.addItemButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderStyleEditor = (title, field, options) => {
    const currentValue = editing ? editingData.insights[field] : profile.insights[field];
    
    return (
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {editing ? (
          <View style={styles.styleOptions}>
            {options.map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.styleOption,
                  currentValue === option && styles.styleOptionSelected
                ]}
                onPress={() => updateInsights(field, option)}
              >
                <Text style={[
                  styles.styleOptionText,
                  currentValue === option && styles.styleOptionTextSelected
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.styleValue}>{currentValue}</Text>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3182ce" />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (profile.needsInterview) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Your Profile Dossier</Text>
        </View>

        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No Profile Yet</Text>
          <Text style={styles.emptyDescription}>
            Complete your interview with our AI concierge to generate your personalized profile dossier. This helps us understand your preferences and recommend the perfect local businesses for you.
          </Text>
          
          <TouchableOpacity 
            style={styles.interviewButton}
            onPress={() => navigation.navigate('ProfileInterview')}
          >
            <Text style={styles.interviewButtonText}>Start Interview</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Your Profile Dossier</Text>
        <Text style={styles.subtitle}>
          Review and edit how our AI understands your preferences
        </Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Completeness */}
        <View style={styles.completenessContainer}>
          <View style={styles.completenessHeader}>
            <Text style={styles.completenessTitle}>Profile Completeness</Text>
            <Text style={styles.completenessPercentage}>{profile.profileCompleteness || 0}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${profile.profileCompleteness || 0}%` }
              ]} 
            />
          </View>
          {profile.lastInterviewDate && (
            <Text style={styles.lastUpdated}>
              Last updated: {new Date(profile.lastInterviewDate).toLocaleDateString()}
            </Text>
          )}
        </View>

        {/* Profile Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Summary</Text>
          {editing ? (
            <TextInput
              style={styles.summaryInput}
              value={editingData.summary || ''}
              onChangeText={(value) => updateEditingData('summary', value)}
              placeholder="Describe your preferences and interests..."
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          ) : (
            <Text style={styles.summaryText}>{profile.summary}</Text>
          )}
        </View>

        {/* Interests */}
        {renderArrayEditor(
          'Interests & Hobbies', 
          'interests', 
          'Add an interest or hobby...'
        )}

        {/* Upcoming Needs */}
        {renderArrayEditor(
          'Upcoming Needs', 
          'upcomingNeeds', 
          'Add something you need soon...'
        )}

        {/* Values */}
        {renderArrayEditor(
          'Values & Priorities', 
          'values', 
          'Add a value that\'s important to you...'
        )}

        {/* Gift Giving */}
        {renderArrayEditor(
          'Gift Giving', 
          'giftGiving', 
          'Add gift occasions or recipients...'
        )}

        {/* Business Types */}
        {renderArrayEditor(
          'Preferred Business Types', 
          'businessTypes', 
          'Add types of businesses you like...'
        )}

        {/* Budget Style */}
        {renderStyleEditor(
          'Budget Style',
          'budgetStyle',
          ['value-conscious', 'moderate', 'premium', 'luxury', 'varies']
        )}

        {/* Shopping Style */}
        {renderStyleEditor(
          'Shopping Style',
          'shoppingStyle',
          ['prefers unique finds', 'convenience focused', 'research-driven', 'impulse buyer', 'brand loyal']
        )}

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {editing ? (
            <>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={cancelEditing}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={saveProfileDossier}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity 
              style={styles.editButton}
              onPress={startEditing}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
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
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
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
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 16,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  interviewButton: {
    backgroundColor: '#3182ce',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  interviewButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  completenessContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 12,
  },
  completenessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  completenessTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  completenessPercentage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3182ce',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3182ce',
    borderRadius: 4,
  },
  lastUpdated: {
    fontSize: 14,
    color: '#718096',
  },
  section: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 12,
  },
  sectionContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 16,
    color: '#4a5568',
    lineHeight: 22,
  },
  summaryInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#2d3748',
    backgroundColor: '#ffffff',
    height: 120,
    textAlignVertical: 'top',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ebf8ff',
    borderColor: '#3182ce',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 14,
    color: '#3182ce',
    fontWeight: '500',
  },
  tagRemove: {
    marginLeft: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3182ce',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagRemoveText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 14,
    color: '#a0aec0',
    fontStyle: 'italic',
  },
  addItemContainer: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  addItemInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#2d3748',
  },
  addItemButton: {
    backgroundColor: '#3182ce',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  styleOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  styleOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  styleOptionSelected: {
    borderColor: '#3182ce',
    backgroundColor: '#ebf8ff',
  },
  styleOptionText: {
    fontSize: 14,
    color: '#4a5568',
    fontWeight: '500',
  },
  styleOptionTextSelected: {
    color: '#3182ce',
  },
  styleValue: {
    fontSize: 16,
    color: '#4a5568',
    fontWeight: '500',
  },
  actionContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 12,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#3182ce',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#4a5568',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#38a169',
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