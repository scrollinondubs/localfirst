import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useAuth } from '../components/AuthContext';
import { buildApiUrl } from '../config/api';

export default function ViewDossierScreen({ navigation }) {
  const { currentUser, token } = useAuth();
  const [dossier, setDossier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDossier, setEditedDossier] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchDossier();
    }
  }, [currentUser, token]);

  const fetchDossier = async () => {
    try {
      console.log('DEBUG ViewDossier: Starting fetch, userId:', currentUser?.id);
      setLoading(true);
      
      // The dossier endpoint only needs X-User-ID, not authorization token
      const response = await fetch(buildApiUrl('/api/interview/dossier'), {
        headers: {
          'X-User-ID': currentUser.id,
          'Content-Type': 'application/json'
        }
      });

      console.log('DEBUG ViewDossier: Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('DEBUG ViewDossier: Data received:', data);
        setDossier(data.dossier);
        setEditedDossier(data.dossier);
      } else {
        console.log('DEBUG ViewDossier: Response not ok');
        Alert.alert('Error', 'Failed to load your personal dossier');
      }
    } catch (error) {
      console.error('DEBUG ViewDossier: Error fetching dossier:', error);
      Alert.alert('Error', 'Failed to load your personal dossier');
    } finally {
      setLoading(false);
    }
  };

  const saveDossier = async () => {
    try {
      setSaving(true);
      const response = await fetch(buildApiUrl('/api/interview/dossier'), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-ID': currentUser.id,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dossier: editedDossier })
      });

      if (response.ok) {
        setDossier(editedDossier);
        setIsEditing(false);
        Alert.alert('Success', 'Your personal dossier has been updated');
      } else {
        Alert.alert('Error', 'Failed to save your changes');
      }
    } catch (error) {
      console.error('Error saving dossier:', error);
      Alert.alert('Error', 'Failed to save your changes');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditedDossier(dossier);
    setIsEditing(false);
  };

  const updateField = (path, value) => {
    const keys = path.split('.');
    const newDossier = { ...editedDossier };
    let current = newDossier;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    
    setEditedDossier(newDossier);
  };

  const updateArrayField = (path, value) => {
    const items = value.split(',').map(item => item.trim()).filter(item => item.length > 0);
    updateField(path, items);
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Please sign in to view your personal dossier.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#3182ce" />
          <Text style={styles.loadingText}>Loading your personal dossier...</Text>
          <Text style={styles.debugText}>User: {currentUser?.id || 'No user'}</Text>
          <Text style={styles.debugText}>Token: {token ? 'Exists' : 'Missing'}</Text>
          <TouchableOpacity 
            style={styles.button}
            onPress={() => {
              Alert.alert('Debug Info', `User: ${currentUser?.id || 'No user'}\nToken: ${token ? 'Exists' : 'Missing'}\nLoading: ${loading}`);
            }}
          >
            <Text style={styles.buttonText}>Show Debug Info</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!dossier) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.noDataText}>No personal dossier found</Text>
          <Text style={styles.noDataSubtext}>Complete your profile interview to generate your dossier</Text>
          <TouchableOpacity 
            style={styles.button}
            onPress={() => navigation.navigate('ProfileInterview')}
          >
            <Text style={styles.buttonText}>Start Interview</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentDossier = isEditing ? editedDossier : dossier;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Personal Dossier</Text>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => isEditing ? saveDossier() : setIsEditing(true)}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#3182ce" />
          ) : (
            <Text style={styles.editButtonText}>
              {isEditing ? 'Save' : 'Edit'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          {isEditing ? (
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={currentDossier.summary}
              onChangeText={(value) => updateField('summary', value)}
              multiline
              placeholder="Brief overview of your personality and lifestyle..."
            />
          ) : (
            <Text style={styles.sectionContent}>{currentDossier.summary}</Text>
          )}
        </View>

        {/* Interests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests & Hobbies</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={currentDossier.interests?.join(', ') || ''}
              onChangeText={(value) => updateArrayField('interests', value)}
              placeholder="hiking, reading, cooking (comma separated)"
            />
          ) : (
            <View style={styles.tagContainer}>
              {currentDossier.interests?.map((interest, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{interest}</Text>
                </View>
              )) || <Text style={styles.emptyText}>No interests listed</Text>}
            </View>
          )}
        </View>

        {/* Lifestyle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lifestyle & Values</Text>
          
          <Text style={styles.subsectionTitle}>Values</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={currentDossier.lifestyle?.values?.join(', ') || ''}
              onChangeText={(value) => updateArrayField('lifestyle.values', value)}
              placeholder="family, sustainability, quality (comma separated)"
            />
          ) : (
            <View style={styles.tagContainer}>
              {currentDossier.lifestyle?.values?.map((value, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{value}</Text>
                </View>
              )) || <Text style={styles.emptyText}>No values listed</Text>}
            </View>
          )}

          <Text style={styles.subsectionTitle}>Priorities</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={currentDossier.lifestyle?.priorities?.join(', ') || ''}
              onChangeText={(value) => updateArrayField('lifestyle.priorities', value)}
              placeholder="work-life balance, health, relationships (comma separated)"
            />
          ) : (
            <View style={styles.tagContainer}>
              {currentDossier.lifestyle?.priorities?.map((priority, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{priority}</Text>
                </View>
              )) || <Text style={styles.emptyText}>No priorities listed</Text>}
            </View>
          )}
        </View>

        {/* Shopping Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shopping Preferences</Text>
          
          <Text style={styles.subsectionTitle}>Style</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={currentDossier.shoppingPreferences?.style || ''}
              onChangeText={(value) => updateField('shoppingPreferences.style', value)}
              placeholder="quality over quantity, bargain hunter, etc."
            />
          ) : (
            <Text style={styles.sectionContent}>
              {currentDossier.shoppingPreferences?.style || 'Not specified'}
            </Text>
          )}

          <Text style={styles.subsectionTitle}>Budget Range</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={currentDossier.shoppingPreferences?.budgetRange || ''}
              onChangeText={(value) => updateField('shoppingPreferences.budgetRange', value)}
              placeholder="budget-conscious, moderate, premium"
            />
          ) : (
            <Text style={styles.sectionContent}>
              {currentDossier.shoppingPreferences?.budgetRange || 'Not specified'}
            </Text>
          )}
        </View>

        {/* Gifting Profile */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gift-Giving Profile</Text>
          
          <Text style={styles.subsectionTitle}>Recipients</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={currentDossier.giftingProfile?.recipients?.join(', ') || ''}
              onChangeText={(value) => updateArrayField('giftingProfile.recipients', value)}
              placeholder="family, friends, colleagues (comma separated)"
            />
          ) : (
            <View style={styles.tagContainer}>
              {currentDossier.giftingProfile?.recipients?.map((recipient, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{recipient}</Text>
                </View>
              )) || <Text style={styles.emptyText}>No recipients listed</Text>}
            </View>
          )}

          <Text style={styles.subsectionTitle}>Typical Budget</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={currentDossier.giftingProfile?.typicalBudget || ''}
              onChangeText={(value) => updateField('giftingProfile.typicalBudget', value)}
              placeholder="$20-50, $50-100, depends on occasion, etc."
            />
          ) : (
            <Text style={styles.sectionContent}>
              {currentDossier.giftingProfile?.typicalBudget || 'Not specified'}
            </Text>
          )}
        </View>

        {/* Upcoming Needs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Needs & Occasions</Text>
          
          <Text style={styles.subsectionTitle}>Upcoming Needs</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={currentDossier.upcomingNeeds?.join(', ') || ''}
              onChangeText={(value) => updateArrayField('upcomingNeeds', value)}
              placeholder="new furniture, gifts for holidays, etc. (comma separated)"
            />
          ) : (
            <View style={styles.tagContainer}>
              {currentDossier.upcomingNeeds?.map((need, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{need}</Text>
                </View>
              )) || <Text style={styles.emptyText}>No upcoming needs listed</Text>}
            </View>
          )}

          <Text style={styles.subsectionTitle}>Special Occasions</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={currentDossier.specialOccasions?.join(', ') || ''}
              onChangeText={(value) => updateArrayField('specialOccasions', value)}
              placeholder="anniversary, birthday party, etc. (comma separated)"
            />
          ) : (
            <View style={styles.tagContainer}>
              {currentDossier.specialOccasions?.map((occasion, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{occasion}</Text>
                </View>
              )) || <Text style={styles.emptyText}>No special occasions listed</Text>}
            </View>
          )}
        </View>

        {isEditing && (
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={cancelEdit}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: 80,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3182ce',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    flex: 1,
    textAlign: 'center',
  },
  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#3182ce',
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a5568',
    marginTop: 12,
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 16,
    color: '#4a5568',
    lineHeight: 22,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  tag: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 14,
    color: '#4a5568',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 14,
    color: '#a0aec0',
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: '#f7fafc',
    color: '#2d3748',
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  editActions: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#4a5568',
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 16,
    color: '#718096',
    marginTop: 12,
  },
  debugText: {
    fontSize: 14,
    color: '#e53e3e',
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#e53e3e',
    textAlign: 'center',
  },
  noDataText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    textAlign: 'center',
    marginBottom: 8,
  },
  noDataSubtext: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#3182ce',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});