import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { buildApiUrl } from '../config/api';

const SupportChat = ({ visible, onClose }) => {
  const [activeView, setActiveView] = useState('menu'); // 'menu', 'bug-report', 'map-help', 'general'
  const [email, setEmail] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [ticketNumber, setTicketNumber] = useState(null);
  const [emailError, setEmailError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null); // { type: 'bug' | 'feedback', ticketNumber?: string, email?: string }

  // Validate email format
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle email input change
  const handleEmailChange = (text) => {
    setEmail(text);
    if (text.length > 0 && !validateEmail(text)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  // Handle bug report submission
  const handleBugReportSubmit = async () => {
    console.log('handleBugReportSubmit called');
    console.log('Email:', email, 'Description:', issueDescription);
    
    if (!email.trim()) {
      setEmailError('Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    if (!issueDescription.trim()) {
      Alert.alert('Missing Information', 'Please describe the issue or bug.');
      return;
    }

    setIsSubmitting(true);
    try {
      const apiUrl = buildApiUrl('/api/support/bug-report');
      console.log('Submitting bug report to:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          description: issueDescription.trim(),
        }),
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit bug report');
      }

      // Set ticket number from API response
      setTicketNumber(data.ticketNumber);

      // Show success message
      setSuccessMessage({
        type: 'bug',
        ticketNumber: data.ticketNumber,
        email: email.trim()
      });
    } catch (error) {
      console.error('Error submitting bug report:', error);
      Alert.alert(
        'Submission Error',
        error.message || 'Failed to submit bug report. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form when closing
  const handleClose = () => {
    setActiveView('menu');
    setEmail('');
    setIssueDescription('');
    setTicketNumber(null);
    setEmailError('');
    onClose();
  };

  // Render main menu
  const renderMenu = () => (
    <View style={styles.menuContainer}>
      <Text style={styles.menuTitle}>How can we help you?</Text>
      
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => setActiveView('map-help')}
      >
        <Ionicons name="map" size={24} color="#007AFF" style={styles.menuIcon} />
        <Text style={styles.menuButtonText}>How to Navigate the Map</Text>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => setActiveView('user-guide')}
      >
        <Ionicons name="book" size={24} color="#007AFF" style={styles.menuIcon} />
        <Text style={styles.menuButtonText}>User Guide</Text>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => setActiveView('business-guide')}
      >
        <Ionicons name="business" size={24} color="#007AFF" style={styles.menuIcon} />
        <Text style={styles.menuButtonText}>Business Owner Guide</Text>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => setActiveView('general')}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="#007AFF" style={styles.menuIcon} />
        <Text style={styles.menuButtonText}>General Feedback</Text>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => setActiveView('bug-report')}
      >
        <Ionicons name="bug" size={24} color="#007AFF" style={styles.menuIcon} />
        <Text style={styles.menuButtonText}>Report a Bug</Text>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </TouchableOpacity>
    </View>
  );

  // Render bug report form
  const renderBugReport = () => {
    const isEmailValid = email.trim() && validateEmail(email);
    const canSubmit = isEmailValid && issueDescription.trim().length > 0;

    return (
      <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={true}>
        <Text style={styles.formTitle}>Report a Bug</Text>
        <Text style={styles.formSubtitle}>Help us improve by reporting any issues you encounter.</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email Address *</Text>
          <TextInput
            style={[
              styles.input,
              emailError && styles.inputError
            ]}
            placeholder="your.email@example.com"
            placeholderTextColor="#999"
            value={email}
            onChangeText={handleEmailChange}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {emailError ? (
            <Text style={styles.errorText}>{emailError}</Text>
          ) : null}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Describe the Issue or Bug *</Text>
          <TextInput
            style={[styles.textArea, styles.input]}
            placeholder="Please describe what happened, what you were trying to do, and any error messages you saw..."
            placeholderTextColor="#999"
            value={issueDescription}
            onChangeText={setIssueDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            (!canSubmit || isSubmitting) && styles.submitButtonDisabled
          ]}
          onPress={handleBugReportSubmit}
          disabled={!canSubmit || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={[
              styles.submitButtonText,
              (!canSubmit || isSubmitting) && styles.submitButtonTextDisabled
            ]}>
              Submit Report
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            setEmail('');
            setIssueDescription('');
            setEmailError('');
            setActiveView('menu');
          }}
        >
          <Ionicons name="arrow-back" size={20} color="#007AFF" />
          <Text style={styles.backButtonText}>Back to Menu</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // Render map help
  const renderMapHelp = () => (
    <ScrollView style={styles.helpContainer} showsVerticalScrollIndicator={true}>
      <Text style={styles.helpTitle}>How to Navigate the Map</Text>
      
      <View style={styles.helpSection}>
        <Text style={styles.helpSectionTitle}>📍 Finding Businesses</Text>
        <Text style={styles.helpText}>
          • Use the search bar at the top to search for businesses by name or category{'\n'}
          • Click on business cards in the list to see them on the map{'\n'}
          • Red markers show individual businesses{'\n'}
          • Clustered markers (with numbers) show multiple businesses in that area
        </Text>
      </View>

      <View style={styles.helpSection}>
        <Text style={styles.helpSectionTitle}>🔍 Zooming & Panning</Text>
        <Text style={styles.helpText}>
          • Pinch to zoom in and out{'\n'}
          • Drag the map to move around{'\n'}
          • Click on markers to see business details{'\n'}
          • Use the zoom controls (+/-) in the bottom right
        </Text>
      </View>

      <View style={styles.helpSection}>
        <Text style={styles.helpSectionTitle}>💡 Tips</Text>
        <Text style={styles.helpText}>
          • Click a business card to zoom to its location{'\n'}
          • Use the "Get Directions" icon to open in Google Maps{'\n'}
          • Use voice search (mic icon) to search hands-free{'\n'}
          • Filter by category using the dropdown menu
        </Text>
      </View>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setActiveView('menu')}
      >
        <Ionicons name="arrow-back" size={20} color="#007AFF" />
        <Text style={styles.backButtonText}>Back to Menu</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // Render general feedback
  const renderGeneralFeedback = () => (
    <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={true}>
      <Text style={styles.formTitle}>General Feedback</Text>
      <Text style={styles.formSubtitle}>We'd love to hear your thoughts and suggestions!</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email Address (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="your.email@example.com"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Your Feedback *</Text>
        <TextInput
          style={[styles.textArea, styles.input]}
          placeholder="Share your thoughts, suggestions, or ideas..."
          placeholderTextColor="#999"
          value={issueDescription}
          onChangeText={setIssueDescription}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
      </View>

      <TouchableOpacity
        style={[
          styles.submitButton,
          (!issueDescription.trim() || isSubmitting) && styles.submitButtonDisabled
        ]}
        onPress={async () => {
          if (!issueDescription.trim()) {
            Alert.alert('Missing Information', 'Please enter your feedback.');
            return;
          }

          setIsSubmitting(true);
          try {
            const apiUrl = buildApiUrl('/api/support/feedback');
            console.log('Submitting feedback to:', apiUrl);
            
            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                email: email.trim() || undefined,
                description: issueDescription.trim(),
              }),
            });

            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Response data:', data);

            if (!response.ok) {
              throw new Error(data.error || 'Failed to submit feedback');
            }

            // Show success message
            setSuccessMessage({
              type: 'feedback',
              email: email.trim() || null
            });
          } catch (error) {
            console.error('Error submitting feedback:', error);
            Alert.alert(
              'Submission Error',
              error.message || 'Failed to submit feedback. Please try again later.',
              [{ text: 'OK' }]
            );
          } finally {
            setIsSubmitting(false);
          }
        }}
        disabled={!issueDescription.trim() || isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={[
            styles.submitButtonText,
            (!issueDescription.trim() || isSubmitting) && styles.submitButtonTextDisabled
          ]}>
            Submit Feedback
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          setEmail('');
          setIssueDescription('');
          setActiveView('menu');
        }}
      >
        <Ionicons name="arrow-back" size={20} color="#007AFF" />
        <Text style={styles.backButtonText}>Back to Menu</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // Render user guide
  const renderUserGuide = () => (
    <ScrollView style={styles.helpContainer} showsVerticalScrollIndicator={true}>
      <Text style={styles.helpTitle}>User Guide</Text>
      
      <View style={styles.helpSection}>
        <Text style={styles.helpSectionTitle}>🔍 Searching for Businesses</Text>
        <Text style={styles.helpText}>
          • Use the search bar to find businesses by name, category, or keywords{'\n'}
          • Filter by category using the dropdown menu{'\n'}
          • Use voice search (mic icon) for hands-free searching{'\n'}
          • Search results show distance from your location
        </Text>
      </View>

      <View style={styles.helpSection}>
        <Text style={styles.helpSectionTitle}>🗺️ Using the Map</Text>
        <Text style={styles.helpText}>
          • Click business cards to see them on the map{'\n'}
          • Drag to pan, pinch to zoom{'\n'}
          • Red markers show individual businesses{'\n'}
          • Clustered markers (with numbers) show multiple businesses{'\n'}
          • Click markers to see business details
        </Text>
      </View>

      <View style={styles.helpSection}>
        <Text style={styles.helpSectionTitle}>📱 Business Cards</Text>
        <Text style={styles.helpText}>
          • View business name, category, and distance{'\n'}
          • Tap "Get Directions" to open in Google Maps{'\n'}
          • Tap phone icon to call the business{'\n'}
          • Tap globe icon to visit their website{'\n'}
          • Favorite businesses for quick access
        </Text>
      </View>

      <View style={styles.helpSection}>
        <Text style={styles.helpSectionTitle}>📍 Location Services</Text>
        <Text style={styles.helpText}>
          • Allow location access for accurate distance calculations{'\n'}
          • Your location helps find nearby businesses{'\n'}
          • You can manually enter your location if preferred
        </Text>
      </View>

      <View style={styles.helpSection}>
        <Text style={styles.helpSectionTitle}>💡 Tips & Tricks</Text>
        <Text style={styles.helpText}>
          • Use voice search for faster searching{'\n'}
          • Filter by category to narrow results{'\n'}
          • Click business cards to zoom to their location{'\n'}
          • Save favorites for quick access{'\n'}
          • Report bugs or give feedback using the help icon
        </Text>
      </View>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setActiveView('menu')}
      >
        <Ionicons name="arrow-back" size={20} color="#007AFF" />
        <Text style={styles.backButtonText}>Back to Menu</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // Render business owner guide
  const renderBusinessGuide = () => (
    <ScrollView style={styles.helpContainer} showsVerticalScrollIndicator={true}>
      <Text style={styles.helpTitle}>Business Owner Guide</Text>
      
      <View style={styles.helpSection}>
        <Text style={styles.helpSectionTitle}>📋 Getting Listed</Text>
        <Text style={styles.helpText}>
          • Contact Local First Arizona to get your business listed{'\n'}
          • Provide accurate business information{'\n'}
          • Include complete address, phone, and website{'\n'}
          • Add business description and keywords{'\n'}
          • Specify your business category and subcategory
        </Text>
      </View>

      <View style={styles.helpSection}>
        <Text style={styles.helpSectionTitle}>✅ Business Information</Text>
        <Text style={styles.helpText}>
          • Keep your business information up to date{'\n'}
          • Accurate address ensures customers can find you{'\n'}
          • Complete contact information helps customers reach you{'\n'}
          • Business description helps customers understand your services{'\n'}
          • Keywords improve search visibility
        </Text>
      </View>

      <View style={styles.helpSection}>
        <Text style={styles.helpSectionTitle}>📊 Visibility & Discovery</Text>
        <Text style={styles.helpText}>
          • Complete profiles get better search rankings{'\n'}
          • Accurate categories help customers find you{'\n'}
          • Business attributes (woman-owned, veteran-owned, etc.) are highlighted{'\n'}
          • Regular updates keep your listing fresh
        </Text>
      </View>

      <View style={styles.helpSection}>
        <Text style={styles.helpSectionTitle}>🔄 Updating Your Listing</Text>
        <Text style={styles.helpText}>
          • Contact Local First Arizona to update information{'\n'}
          • Report incorrect information through support{'\n'}
          • Keep hours, contact info, and description current{'\n'}
          • Notify us of business closures or relocations
        </Text>
      </View>

      <View style={styles.helpSection}>
        <Text style={styles.helpSectionTitle}>📞 Need Help?</Text>
        <Text style={styles.helpText}>
          • Use "Report a Bug" if you see incorrect information{'\n'}
          • Use "General Feedback" to suggest improvements{'\n'}
          • We're here to help your business succeed!
        </Text>
      </View>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setActiveView('menu')}
      >
        <Ionicons name="arrow-back" size={20} color="#007AFF" />
        <Text style={styles.backButtonText}>Back to Menu</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // Render success message
  const renderSuccessMessage = () => {
    if (!successMessage) return null;

    const handleCloseSuccess = () => {
      setSuccessMessage(null);
      setEmail('');
      setIssueDescription('');
      setTicketNumber(null);
      setEmailError('');
      setActiveView('menu');
    };

    if (successMessage.type === 'bug') {
      return (
        <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={true}>
          <View style={styles.successContainer}>
            <Ionicons name="checkmark-circle" size={64} color="#10B981" style={styles.successIcon} />
            <Text style={styles.successTitle}>Thank You!</Text>
            <Text style={styles.successMessage}>
              Thank you so much for reporting a bug! Your ticket number is{' '}
              <Text style={styles.ticketNumber}>#{successMessage.ticketNumber}</Text> and we are working on resolving this issue.
            </Text>
            {successMessage.email && (
              <Text style={styles.successSubMessage}>
                A confirmation email has been sent to {successMessage.email}. Please save your ticket number to track the status of your report.
              </Text>
            )}
            <TouchableOpacity
              style={styles.successButton}
              onPress={handleCloseSuccess}
            >
              <Text style={styles.successButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    } else if (successMessage.type === 'feedback') {
      return (
        <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={true}>
          <View style={styles.successContainer}>
            <Ionicons name="checkmark-circle" size={64} color="#10B981" style={styles.successIcon} />
            <Text style={styles.successTitle}>Thank You!</Text>
            <Text style={styles.successMessage}>
              Thank you so much for your feedback! We appreciate you helping us improve our app.
            </Text>
            {successMessage.email && (
              <Text style={styles.successSubMessage}>
                A confirmation email has been sent to {successMessage.email}.
              </Text>
            )}
            <TouchableOpacity
              style={styles.successButton}
              onPress={handleCloseSuccess}
            >
              <Text style={styles.successButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    return null;
  };

  if (!visible) return null;

  // For web, use a positioned view instead of Modal to allow app interaction
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webContainer}>
        {/* Chat window - positioned on the right */}
        <View style={styles.chatWindow}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Support & Help</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {successMessage ? renderSuccessMessage() : (
              <>
                {activeView === 'menu' && renderMenu()}
                {activeView === 'bug-report' && renderBugReport()}
                {activeView === 'map-help' && renderMapHelp()}
                {activeView === 'general' && renderGeneralFeedback()}
                {activeView === 'user-guide' && renderUserGuide()}
                {activeView === 'business-guide' && renderBusinessGuide()}
              </>
            )}
          </View>
        </View>
      </View>
    );
  }

  // For mobile, use Modal
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.overlayClickable}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={styles.chatWindow}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Support & Help</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {successMessage ? renderSuccessMessage() : (
              <>
                {activeView === 'menu' && renderMenu()}
                {activeView === 'bug-report' && renderBugReport()}
                {activeView === 'map-help' && renderMapHelp()}
                {activeView === 'general' && renderGeneralFeedback()}
                {activeView === 'user-guide' && renderUserGuide()}
                {activeView === 'business-guide' && renderBusinessGuide()}
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  webContainer: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 80, // Reserve space for bottom navigation bar
    zIndex: 10000,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end', // Align to bottom to attach to help icon
    pointerEvents: 'none', // Allow clicks through container - only chat window blocks
    paddingRight: 20, // Match help icon right position
    paddingBottom: 145, // Position closer to help icon (86px help icon bottom + 56px height + 3px gap for triangle)
  },
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  overlayClickable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  chatWindow: {
    width: '90%',
    maxWidth: 400,
    height: '80%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...(Platform.OS === 'web' && {
      width: 380,
      maxWidth: 380,
      height: 'auto',
      maxHeight: 'calc(100vh - 220px)', // Increased height, closer to help icon
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
      pointerEvents: 'auto', // Chat window is interactive
      position: 'relative',
      zIndex: 10001,
      marginBottom: 0,
    }),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingBottom: 10, // Reduced padding to show back button without scrolling
  },
  menuContainer: {
    padding: 16,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 18,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: 12,
  },
  menuIcon: {
    marginRight: 12,
  },
  menuButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  formContainer: {
    padding: 16,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#FFF',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#CCC',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonTextDisabled: {
    color: '#999',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    marginTop: 4,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  helpContainer: {
    padding: 16,
  },
  helpTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 18,
  },
  helpSection: {
    marginBottom: 18,
  },
  helpSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  successContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 12,
  },
  ticketNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
  },
  successSubMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  successButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 8,
  },
  successButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SupportChat;

