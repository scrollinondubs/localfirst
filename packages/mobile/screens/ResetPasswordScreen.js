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

export default function ResetPasswordScreen({ route, navigation }) {
  const { email } = route.params || {};
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const { resetPassword } = useAuth();

  // Token validation
  const validateToken = (token) => {
    if (!token) return 'Reset token is required';
    if (token.length < 8) return 'Invalid reset token format';
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

  // Update token with validation
  const handleTokenChange = (value) => {
    setResetToken(value);
    if (touched.resetToken) {
      setErrors(prev => ({ ...prev, resetToken: validateToken(value) }));
    }
  };

  // Update password with validation
  const handlePasswordChange = (value) => {
    setPassword(value);
    if (touched.password) {
      setErrors(prev => ({ ...prev, password: validatePassword(value) }));
    }
    if (touched.confirmPassword && confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: validateConfirmPassword(confirmPassword, value) }));
    }
  };

  // Update confirm password with validation
  const handleConfirmPasswordChange = (value) => {
    setConfirmPassword(value);
    if (touched.confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: validateConfirmPassword(value, password) }));
    }
  };

  // Handle field blur to show validation
  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    if (field === 'resetToken') {
      setErrors(prev => ({ ...prev, resetToken: validateToken(resetToken) }));
    } else if (field === 'password') {
      setErrors(prev => ({ ...prev, password: validatePassword(password) }));
    } else if (field === 'confirmPassword') {
      setErrors(prev => ({ ...prev, confirmPassword: validateConfirmPassword(confirmPassword, password) }));
    }
  };

  const handleResetPassword = async () => {
    // Validate all fields
    const tokenError = validateToken(resetToken);
    const passwordError = validatePassword(password);
    const confirmPasswordError = validateConfirmPassword(confirmPassword, password);
    
    setErrors({
      resetToken: tokenError,
      password: passwordError,
      confirmPassword: confirmPasswordError
    });
    
    setTouched({ 
      resetToken: true, 
      password: true, 
      confirmPassword: true 
    });

    if (tokenError || passwordError || confirmPasswordError) {
      return;
    }

    setLoading(true);

    try {
      const result = await resetPassword(resetToken.trim(), password);
      if (result.success) {
        Alert.alert(
          'Password Reset Successful',
          'Your password has been reset successfully. You can now sign in with your new password.',
          [
            {
              text: 'Sign In',
              onPress: () => navigation.navigate('Login')
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }

    setLoading(false);
  };

  // Password strength indicator
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
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your reset token and choose a new password
              {email && ` for ${email}`}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.input,
                  errors.resetToken ? styles.inputError : null,
                  touched.resetToken && !errors.resetToken ? styles.inputSuccess : null
                ]}
                placeholder="Reset Token"
                value={resetToken}
                onChangeText={handleTokenChange}
                onBlur={() => handleBlur('resetToken')}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              {errors.resetToken && touched.resetToken && (
                <Text style={styles.errorText}>{errors.resetToken}</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.input,
                  errors.password ? styles.inputError : null,
                  touched.password && !errors.password ? styles.inputSuccess : null
                ]}
                placeholder="New Password"
                value={password}
                onChangeText={handlePasswordChange}
                onBlur={() => handleBlur('password')}
                secureTextEntry
                autoCapitalize="none"
                editable={!loading}
              />
              {errors.password && touched.password && (
                <Text style={styles.errorText}>{errors.password}</Text>
              )}
              {passwordStrength && password.length > 0 && (
                <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                  Password strength: {passwordStrength.text}
                </Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.input,
                  errors.confirmPassword ? styles.inputError : null,
                  touched.confirmPassword && !errors.confirmPassword ? styles.inputSuccess : null
                ]}
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                onBlur={() => handleBlur('confirmPassword')}
                secureTextEntry
                autoCapitalize="none"
                editable={!loading}
              />
              {errors.confirmPassword && touched.confirmPassword && (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={[styles.buttonText, styles.loadingText]}>Resetting...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Reset Password</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('ForgotPassword')}
              disabled={loading}
            >
              <Text style={[styles.linkText, loading && styles.linkTextDisabled]}>
                Need a new reset token?
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('Login')}
              disabled={loading}
            >
              <Text style={[styles.linkText, loading && styles.linkTextDisabled]}>
                Back to Sign In
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
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 24,
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
});