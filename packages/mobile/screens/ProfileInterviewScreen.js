import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useAuth } from '../components/AuthContext';
import voiceService from '../services/VoiceService';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8787';

export default function ProfileInterviewScreen({ navigation }) {
  const { currentUser, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isVoiceAvailable, setIsVoiceAvailable] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const [profileCompleteness, setProfileCompleteness] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const scrollViewRef = useRef();

  useEffect(() => {
    if (currentUser) {
      initializeSession();
      initializeVoiceService();
    }
    
    // Cleanup voice service on unmount
    return () => {
      voiceService.clearCallbacks();
    };
  }, [currentUser]);

  // Initialize or get existing interview session
  const initializeSession = async () => {
    try {
      setIsInitialLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/interview/session`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-ID': currentUser.id,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSessionId(data.sessionId);
        setMessages(data.messages || []);
        setProfileCompleteness(Math.floor((data.messageCount || 0) * 5)); // Rough estimate
      } else {
        throw new Error('Failed to initialize session');
      }
    } catch (error) {
      console.error('Error initializing session:', error);
      Alert.alert('Error', 'Failed to start interview session. Please try again.');
    } finally {
      setIsInitialLoading(false);
    }
  };

  // Send message to AI
  const sendMessage = async () => {
    if (!currentMessage.trim() || !sessionId || isLoading) return;

    const userMessage = {
      role: 'user',
      content: currentMessage.trim(),
      timestamp: new Date().toISOString()
    };

    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/interview/message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-ID': currentUser.id,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: sessionId,
          message: userMessage.content
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Add AI response
        const aiMessage = {
          role: 'assistant',
          content: data.aiResponse,
          timestamp: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, aiMessage]);
        setProfileCompleteness(data.profileCompleteness || 0);
        
        // Auto-scroll to bottom
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize voice service (matching SearchScreen)
  const initializeVoiceService = async () => {
    try {
      const available = voiceService.getIsAvailable();
      setIsVoiceAvailable(available);
      
      if (available) {
        // Set up voice service callbacks
        voiceService.setCallbacks({
          onStart: handleVoiceStart,
          onResults: handleVoiceResults,
          onPartialResults: handleVoicePartialResults,
          onEnd: handleVoiceEnd,
          onError: handleVoiceError,
        });
      } else {
        console.warn('Voice recognition not available on this device');
      }
    } catch (error) {
      console.error('Error initializing voice service:', error);
      setVoiceError('Voice recognition not available');
    }
  };

  const handleVoiceStart = () => {
    setIsVoiceActive(true);
    setVoiceError(null);
  };

  const handleVoiceResults = (results) => {
    if (results && results.length > 0) {
      const finalTranscription = results[0];
      // Process the voice input and set message
      const processedQuery = voiceService.processVoiceSearchQuery(finalTranscription);
      setCurrentMessage(processedQuery.processedQuery || finalTranscription);
    }
  };

  const handleVoicePartialResults = (partialResults) => {
    if (partialResults && partialResults.length > 0) {
      setCurrentMessage(partialResults[0]);
    }
  };

  const handleVoiceEnd = () => {
    setIsVoiceActive(false);
  };

  const handleVoiceError = (error) => {
    console.error('Voice recognition error:', error);
    setIsVoiceActive(false);
    
    let errorMessage = 'Voice recognition failed';
    if (error && error.error && error.error.message) {
      errorMessage = error.error.message;
    }
    
    setVoiceError(errorMessage);
    Alert.alert(
      'Voice Recognition Error',
      'Sorry, we couldn\'t understand your voice. Please try again or use text input.',
      [{ text: 'OK', onPress: () => setVoiceError(null) }]
    );
  };

  const startVoiceSearch = async () => {
    if (!isVoiceAvailable) {
      Alert.alert(
        'Voice Search Unavailable',
        'Voice recognition is not available on this device. Please use text input instead.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setVoiceError(null);
      
      await voiceService.startListening({
        language: 'en-US'
      });
      
    } catch (error) {
      console.error('Error starting voice search:', error);
      setIsVoiceActive(false);
      setVoiceError('Failed to start voice recognition');
      Alert.alert(
        'Voice Search Error',
        'Unable to start voice recognition. Please check microphone permissions and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const stopVoiceSearch = async () => {
    try {
      await voiceService.stopListening();
    } catch (error) {
      console.error('Error stopping voice search:', error);
    }
  };

  // Complete interview
  const completeInterview = async () => {
    if (!sessionId) return;

    Alert.alert(
      'Complete Interview?',
      'Are you ready to finish this conversation? We\'ll analyze what you\'ve shared to personalize your experience.',
      [
        { text: 'Continue Chatting', style: 'cancel' },
        { 
          text: 'Complete Interview', 
          onPress: async () => {
            try {
              setIsLoading(true);
              const response = await fetch(`${API_BASE_URL}/api/interview/complete`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'X-User-ID': currentUser.id,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sessionId })
              });

              if (response.ok) {
                const data = await response.json();
                setProfileCompleteness(data.profileCompleteness || 100);
                
                Alert.alert(
                  'Interview Complete!',
                  `Thanks for sharing! Your profile is now ${data.profileCompleteness}% complete. You'll start receiving personalized business recommendations.`,
                  [{ 
                    text: 'OK', 
                    onPress: () => navigation.goBack()
                  }]
                );
              } else {
                throw new Error('Failed to complete interview');
              }
            } catch (error) {
              console.error('Error completing interview:', error);
              Alert.alert('Error', 'Failed to complete interview.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // Render message bubble
  const renderMessage = (message, index) => {
    const isUser = message.role === 'user';
    return (
      <View key={index} style={[
        styles.messageContainer,
        isUser ? styles.userMessageContainer : styles.aiMessageContainer
      ]}>
        <View style={[
          styles.messageBubble,
          isUser ? styles.userMessage : styles.aiMessage
        ]}>
          <Text style={[
            styles.messageText,
            isUser ? styles.userMessageText : styles.aiMessageText
          ]}>
            {message.content}
          </Text>
        </View>
      </View>
    );
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Please sign in to use the profile interview.</Text>
          <TouchableOpacity 
            style={styles.button}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isInitialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#3182ce" />
          <Text style={styles.loadingText}>Starting your interview...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Profile Interview</Text>
            <Text style={styles.headerSubtitle}>{profileCompleteness}% Complete</Text>
          </View>
          <TouchableOpacity 
            onPress={completeInterview}
            style={styles.completeButton}
          >
            <Text style={styles.completeButtonText}>Finish</Text>
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${profileCompleteness}%` }
              ]} 
            />
          </View>
        </View>

        {/* Messages */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message, index) => renderMessage(message, index))}
          {isLoading && (
            <View style={styles.aiMessageContainer}>
              <View style={[styles.messageBubble, styles.aiMessage]}>
                <ActivityIndicator size="small" color="#666" />
                <Text style={styles.typingText}>AI is thinking...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input area */}
        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={currentMessage}
              onChangeText={setCurrentMessage}
              placeholder="Type your response or tap the mic..."
              placeholderTextColor="#999"
              multiline={false}
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={sendMessage}
              editable={!isLoading}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[
                styles.voiceButton,
                isVoiceActive && styles.voiceButtonActive,
                !isVoiceAvailable && styles.voiceButtonDisabled
              ]}
              onPress={isVoiceActive ? stopVoiceSearch : startVoiceSearch}
              disabled={isLoading || !isVoiceAvailable}
            >
              <Text style={styles.voiceButtonIcon}>
                🎤
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!currentMessage.trim() || isLoading) && styles.sendButtonDisabled
              ]}
              onPress={sendMessage}
              disabled={!currentMessage.trim() || isLoading}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
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
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3182ce',
    fontWeight: '500',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#718096',
    marginTop: 2,
  },
  completeButton: {
    padding: 8,
  },
  completeButtonText: {
    fontSize: 16,
    color: '#38a169',
    fontWeight: '500',
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3182ce',
    borderRadius: 2,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  messageContainer: {
    marginVertical: 4,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  aiMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userMessage: {
    backgroundColor: '#3182ce',
  },
  aiMessage: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#ffffff',
  },
  aiMessageText: {
    color: '#2d3748',
  },
  typingText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  inputContainer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: '#f7fafc',
  },
  voiceButton: {
    backgroundColor: '#3182ce',
    borderRadius: 22,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  voiceButtonActive: {
    backgroundColor: '#dc2626',
    transform: [{ scale: 1.05 }],
  },
  voiceButtonDisabled: {
    backgroundColor: '#e2e8f0',
    elevation: 0,
    shadowOpacity: 0,
  },
  voiceButtonIcon: {
    fontSize: 20,
    color: '#ffffff',
  },
  sendButton: {
    backgroundColor: '#3182ce',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#cbd5e0',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#3182ce',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginTop: 16,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#e53e3e',
    textAlign: 'center',
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    marginTop: 12,
  },
});