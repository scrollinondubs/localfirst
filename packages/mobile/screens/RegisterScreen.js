import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { useAuth } from '../components/AuthContext';

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [generalError, setGeneralError] = useState('');
  const { register } = useAuth();

  // Email validation
  const validateEmail = (email) => {
    if (!email) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Please enter a valid email address (e.g., user@domain.com)';
    return '';
  };

  // Name validation
  const validateName = (name) => {
    if (!name || name.trim().length === 0) return 'Name is required';
    if (name.trim().length < 2) return 'Name must be at least 2 characters';
    return '';
  };

  // Password validation
  const validatePassword = (password) => {
    if (!password) return 'Password is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    return '';
  };

  // Confirm password validation
  const validateConfirmPassword = (confirmPassword, password) => {
    if (!confirmPassword) return 'Please confirm your password';
    if (confirmPassword !== password) return 'Passwords do not match';
    return '';
  };

  // Get password strength
  const getPasswordStrength = (password) => {
    if (!password) return null;
    
    const checks = {
      minLength: password.length >= 6,
      hasLetter: /[a-zA-Z]/.test(password),
      hasNumber: /\d/.test(password),
    };
    
    const strength = Object.values(checks).filter(Boolean).length;
    
    if (strength >= 3) return { text: 'Strong', color: '#38a169' };
    if (strength >= 2) return { text: 'Medium', color: '#d69e2e' };
    return { text: 'Weak', color: '#e53e3e' };
  };

  // Update email with validation
  const handleEmailChange = (value) => {
    setEmail(value);
    // Show validation immediately after user starts typing
    if (value.length > 0) {
      setTouched(prev => ({ ...prev, email: true }));
      setErrors(prev => ({ ...prev, email: validateEmail(value) }));
    } else {
      setErrors(prev => ({ ...prev, email: '' }));
    }
  };

  // Update name with validation
  const handleNameChange = (value) => {
    setName(value);
    // Show validation immediately after user starts typing
    if (value.length > 0) {
      setTouched(prev => ({ ...prev, name: true }));
      setErrors(prev => ({ ...prev, name: validateName(value) }));
    } else {
      setErrors(prev => ({ ...prev, name: '' }));
    }
  };

  // Update password with validation
  const handlePasswordChange = (value) => {
    setPassword(value);
    // Show validation immediately after user starts typing
    if (value.length > 0) {
      setTouched(prev => ({ ...prev, password: true }));
      setErrors(prev => ({ ...prev, password: validatePassword(value) }));
    } else {
      setErrors(prev => ({ ...prev, password: '' }));
    }
    // Update confirm password validation if it's already been entered
    if (confirmPassword.length > 0) {
      setErrors(prev => ({ ...prev, confirmPassword: validateConfirmPassword(confirmPassword, value) }));
    }
  };

  // Update confirm password with validation
  const handleConfirmPasswordChange = (value) => {
    setConfirmPassword(value);
    // Show validation immediately after user starts typing
    if (value.length > 0) {
      setTouched(prev => ({ ...prev, confirmPassword: true }));
      setErrors(prev => ({ ...prev, confirmPassword: validateConfirmPassword(value, password) }));
    } else {
      setErrors(prev => ({ ...prev, confirmPassword: '' }));
    }
  };

  // Handle field blur to show validation
  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    if (field === 'email') {
      setErrors(prev => ({ ...prev, email: validateEmail(email) }));
    } else if (field === 'name') {
      setErrors(prev => ({ ...prev, name: validateName(name) }));
    } else if (field === 'password') {
      setErrors(prev => ({ ...prev, password: validatePassword(password) }));
    } else if (field === 'confirmPassword') {
      setErrors(prev => ({ ...prev, confirmPassword: validateConfirmPassword(confirmPassword, password) }));
    }
  };

  const handleRegister = async () => {
    // Clear previous messages
    setSuccessMessage('');
    setGeneralError('');
    
    // Validate all fields
    const emailError = validateEmail(email);
    const nameError = validateName(name);
    const passwordError = validatePassword(password);
    const confirmPasswordError = validateConfirmPassword(confirmPassword, password);
    
    const newErrors = {
      email: emailError,
      name: nameError,
      password: passwordError,
      confirmPassword: confirmPasswordError
    };
    
    setErrors(newErrors);
    setTouched({ 
      email: true, 
      name: true, 
      password: true, 
      confirmPassword: true 
    });

    // Check if there are any errors
    if (emailError || nameError || passwordError || confirmPasswordError) {
      setGeneralError('Please fix the errors above before continuing.');
      return; // Don't proceed if validation fails
    }

    setLoading(true);

    try {
      const result = await register(email.toLowerCase().trim(), password, name.trim());
      if (!result.success) {
        // Show specific validation errors if available
        if (result.details && Array.isArray(result.details)) {
          const fieldErrors = {};
          result.details.forEach(detail => {
            fieldErrors[detail.field] = detail.message;
          });
          setErrors(prev => ({ ...prev, ...fieldErrors }));
          setGeneralError('Please fix the errors above and try again.');
        } else {
          setGeneralError(result.error || 'Registration failed. Please try again.');
        }
      } else {
        // Show success message and navigate to onboarding
        setSuccessMessage(`Welcome to Local First Arizona, ${result.user.name}! Your account has been created successfully.`);
        
        // Navigate to onboarding after a brief delay to show success message
        setTimeout(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Onboarding' }],
          });
        }, 2000);
      }
    } catch (error) {
      console.error('Registration error:', error);
      setGeneralError('Unable to create account. Please check your internet connection and try again.');
    }

    setLoading(false);
  };

  const passwordStrength = getPasswordStrength(password);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Local First Arizona</Text>
            <Text style={styles.subtitle}>Create Your Account</Text>
          </View>

          {/* Success Message */}
          {successMessage && (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>✅ {successMessage}</Text>
              <Text style={styles.successSubtext}>Redirecting to onboarding...</Text>
            </View>
          )}

          {/* General Error Message */}
          {generalError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>❌ {generalError}</Text>
            </View>
          )}

          <View style={styles.form}>
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.input,
                  errors.email ? styles.inputError : null,
                  touched.email && !errors.email ? styles.inputSuccess : null
                ]}
                placeholder="Email Address"
                value={email}
                onChangeText={handleEmailChange}
                onBlur={() => handleBlur('email')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              {errors.email && (
                <Text style={styles.errorText}>{errors.email}</Text>
              )}
            </View>

            {/* Name Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.input,
                  errors.name ? styles.inputError : null,
                  touched.name && !errors.name ? styles.inputSuccess : null
                ]}
                placeholder="Full Name"
                value={name}
                onChangeText={handleNameChange}
                onBlur={() => handleBlur('name')}
                autoCapitalize="words"
                editable={!loading}
              />
              {errors.name && (
                <Text style={styles.errorText}>{errors.name}</Text>
              )}
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.input,
                  errors.password ? styles.inputError : null,
                  touched.password && !errors.password ? styles.inputSuccess : null
                ]}
                placeholder="Password"
                value={password}
                onChangeText={handlePasswordChange}
                onBlur={() => handleBlur('password')}
                secureTextEntry
                autoCapitalize="none"
                editable={!loading}
              />
              {errors.password && (
                <Text style={styles.errorText}>{errors.password}</Text>
              )}
              {passwordStrength && password.length > 0 && !errors.password && (
                <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                  Password strength: {passwordStrength.text}
                </Text>
              )}
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.input,
                  errors.confirmPassword ? styles.inputError : null,
                  touched.confirmPassword && !errors.confirmPassword ? styles.inputSuccess : null
                ]}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                onBlur={() => handleBlur('confirmPassword')}
                secureTextEntry
                autoCapitalize="none"
                editable={!loading}
              />
              {errors.confirmPassword && (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              )}
              {confirmPassword.length > 0 && !errors.confirmPassword && password === confirmPassword && (
                <Text style={styles.successText}>✓ Passwords match</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={[styles.buttonText, styles.loadingText]}>Creating Account...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('Login')}
              disabled={loading}
            >
              <Text style={[styles.linkText, loading && styles.linkTextDisabled]}>
                Already have an account? Sign In
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#718096',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inputError: {
    borderColor: '#e53e3e',
    borderWidth: 2,
  },
  inputSuccess: {
    borderColor: '#38a169',
    borderWidth: 2,
  },
  errorText: {
    color: '#e53e3e',
    fontSize: 14,
    marginTop: 4,
    marginLeft: 4,
  },
  successText: {
    color: '#38a169',
    fontSize: 14,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
  },
  strengthText: {
    fontSize: 14,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#3182ce',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    marginLeft: 8,
  },
  linkButton: {
    alignItems: 'center',
    marginBottom: 8,
  },
  linkText: {
    color: '#3182ce',
    fontSize: 16,
  },
  linkTextDisabled: {
    opacity: 0.5,
  },
  successContainer: {
    backgroundColor: '#f0fff4',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#38a169',
  },
  successText: {
    color: '#38a169',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  successSubtext: {
    color: '#68d391',
    fontSize: 14,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#fed7d7',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e53e3e',
  },
  errorText: {
    color: '#e53e3e',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});