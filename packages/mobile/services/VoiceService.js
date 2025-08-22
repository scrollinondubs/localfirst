import { Platform } from 'react-native';

class VoiceService {
  constructor() {
    this.isListening = false;
    this.isAvailable = false;
    this.callbacks = {};
    this.recognition = null;
    
    this.initialize();
  }

  async initialize() {
    try {
      // Check if Web Speech API is available
      if (typeof window !== 'undefined' && 
          (window.SpeechRecognition || window.webkitSpeechRecognition)) {
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        // Configure recognition
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        
        // Set up event listeners
        this.recognition.onstart = () => this.onSpeechStart();
        this.recognition.onresult = (event) => this.onSpeechResults(event);
        this.recognition.onerror = (event) => this.onSpeechError(event);
        this.recognition.onend = () => this.onSpeechEnd();
        
        this.isAvailable = true;
        console.log('Web Speech API initialized successfully');
      } else {
        console.warn('Web Speech API is not available in this browser');
        this.isAvailable = false;
      }
    } catch (error) {
      console.error('Failed to initialize voice service:', error);
      this.isAvailable = false;
    }
  }

  // Event handlers
  onSpeechStart() {
    console.log('Speech recognition started');
    this.isListening = true;
    if (this.callbacks.onStart) {
      this.callbacks.onStart();
    }
  }

  onSpeechEnd() {
    console.log('Speech recognition ended');
    this.isListening = false;
    if (this.callbacks.onEnd) {
      this.callbacks.onEnd();
    }
  }

  onSpeechError(event) {
    console.error('Speech recognition error:', event.error);
    this.isListening = false;
    
    let errorMessage = event.error;
    
    // Provide user-friendly error messages
    switch(event.error) {
      case 'network':
        errorMessage = 'Network error. Speech recognition requires HTTPS or localhost.';
        break;
      case 'not-allowed':
        errorMessage = 'Microphone access denied. Please allow microphone permissions.';
        break;
      case 'no-speech':
        errorMessage = 'No speech detected. Please try speaking again.';
        break;
      case 'audio-capture':
        errorMessage = 'Microphone not available. Please check your microphone.';
        break;
      case 'service-not-allowed':
        errorMessage = 'Speech service not allowed. Try using HTTPS.';
        break;
      default:
        errorMessage = `Speech recognition error: ${event.error}`;
    }
    
    if (this.callbacks.onError) {
      this.callbacks.onError({ error: { message: errorMessage } });
    }
  }

  onSpeechResults(event) {
    const results = [];
    const partialResults = [];
    
    // Process all results from the event
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      
      if (result.isFinal) {
        results.push(transcript);
      } else {
        partialResults.push(transcript);
      }
    }
    
    // Call callbacks with final results
    if (results.length > 0) {
      console.log('Speech results:', results);
      if (this.callbacks.onResults) {
        this.callbacks.onResults(results);
      }
    }
    
    // Call callbacks with partial results
    if (partialResults.length > 0) {
      console.log('Partial speech results:', partialResults);
      if (this.callbacks.onPartialResults) {
        this.callbacks.onPartialResults(partialResults);
      }
    }
  }

  // Public methods
  async startListening(options = {}) {
    if (!this.isAvailable || !this.recognition) {
      throw new Error('Speech recognition is not available in this browser');
    }

    if (this.isListening) {
      console.warn('Already listening for speech');
      return;
    }

    try {
      // Set language preference
      const language = options.language || 'en-US';
      this.recognition.lang = language;
      
      // Configure options
      this.recognition.continuous = true;
      this.recognition.interimResults = options.EXTRA_PARTIAL_RESULTS !== false;
      
      this.recognition.start();
      console.log('Started listening with language:', language);
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      this.isListening = false;
      throw error;
    }
  }

  async stopListening() {
    if (!this.isListening || !this.recognition) {
      console.warn('Not currently listening');
      return;
    }

    try {
      this.recognition.stop();
      console.log('Stopped listening');
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
      throw error;
    }
  }

  async cancelListening() {
    if (!this.isListening || !this.recognition) {
      return;
    }

    try {
      this.recognition.abort();
      this.isListening = false;
      console.log('Cancelled listening');
    } catch (error) {
      console.error('Error cancelling speech recognition:', error);
      throw error;
    }
  }

  // Set up callbacks for speech events
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // Clear all callbacks
  clearCallbacks() {
    this.callbacks = {};
  }

  // Check if currently listening
  getIsListening() {
    return this.isListening;
  }

  // Check if voice recognition is available
  getIsAvailable() {
    return this.isAvailable;
  }

  // Request permissions
  async requestPermissions() {
    try {
      // Web Speech API permissions are requested automatically when starting recognition
      return { success: true, message: 'Browser permissions requested on first use' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // Cleanup method
  destroy() {
    try {
      if (this.recognition && this.isListening) {
        this.recognition.abort();
      }
      this.callbacks = {};
      this.isListening = false;
      this.recognition = null;
      console.log('Voice service destroyed');
    } catch (error) {
      console.error('Error destroying voice service:', error);
    }
  }

  // Utility method to check microphone permissions
  async checkMicrophonePermissions() {
    try {
      return {
        available: this.isAvailable,
        message: this.isAvailable ? 'Speech recognition available' : 'Speech recognition not available in this browser'
      };
    } catch (error) {
      return {
        available: false,
        message: `Error checking permissions: ${error.message}`
      };
    }
  }

  // Process natural language voice input for business search
  processVoiceSearchQuery(transcript) {
    if (!transcript || transcript.length === 0) {
      return null;
    }

    // Get the most likely transcript
    const query = Array.isArray(transcript) ? transcript[0] : transcript;
    
    // Clean up the query
    const cleanQuery = query
      .toLowerCase()
      .trim()
      // Remove common voice command prefixes
      .replace(/^(find|search for|look for|i'm looking for|show me|where is|where are|i need|i want|get me)\s+/i, '')
      // Remove location indicators that we'll handle separately
      .replace(/\s+(near me|nearby|in my area|around here|close by)$/i, '')
      .trim();

    return {
      originalQuery: query,
      processedQuery: cleanQuery,
      hasLocationIndicator: /\b(near me|nearby|in my area|around here|close by|in\s+\w+)\b/i.test(query)
    };
  }
}

// Create and export a singleton instance
const voiceService = new VoiceService();
export default voiceService;