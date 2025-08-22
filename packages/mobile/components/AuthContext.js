import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext({});

// API configuration from environment variables
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://localfirst-api-production.localfirst.workers.dev/api'
    : 'http://localhost:8787/api');

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  // Make API request
  const makeApiRequest = async (endpoint, options = {}) => {
    const { method = 'GET', body, headers = {} } = options;
    
    const requestOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (body) {
      requestOptions.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions);
    return response;
  };

  // Verify token and refresh user data
  const verifyToken = async (storedToken) => {
    try {
      const response = await makeApiRequest('/auth/verify', {
        headers: { 'Authorization': `Bearer ${storedToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.user;
      }
      return null;
    } catch (error) {
      console.warn('Token verification failed:', error);
      return null;
    }
  };

  // Check for existing token on app start
  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('authToken');
        
        if (storedToken) {
          // Verify token is still valid
          const user = await verifyToken(storedToken);
          
          if (user) {
            setToken(storedToken);
            setCurrentUser(user);
            // Update stored user data with latest from server
            await AsyncStorage.setItem('currentUser', JSON.stringify(user));
          } else {
            // Token invalid, clear stored auth
            await clearStoredAuth();
          }
        }
      } catch (error) {
        console.error('Error loading stored auth:', error);
        await clearStoredAuth();
      } finally {
        setLoading(false);
      }
    };

    loadStoredAuth();
  }, []);

  // Helper to clear stored auth data
  const clearStoredAuth = async () => {
    try {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('currentUser');
      setToken(null);
      setCurrentUser(null);
    } catch (error) {
      console.error('Error clearing stored auth:', error);
    }
  };

  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await makeApiRequest('/auth/login', {
        method: 'POST',
        body: { email, password }
      });

      const data = await response.json();

      if (!response.ok) {
        // Return specific error details if available
        if (data.details) {
          return { 
            success: false, 
            error: data.error, 
            details: data.details 
          };
        }
        return { success: false, error: data.error || 'Login failed' };
      }

      // Store token and user data
      await AsyncStorage.setItem('authToken', data.token);
      await AsyncStorage.setItem('currentUser', JSON.stringify(data.user));
      
      setToken(data.token);
      setCurrentUser(data.user);
      
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: error.message.includes('API unavailable') 
          ? 'Unable to connect to server. Please check your internet connection.' 
          : 'Login failed. Please try again.'
      };
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password, name) => {
    setLoading(true);
    try {
      const response = await makeApiRequest('/auth/register', {
        method: 'POST',
        body: { email, password, name }
      });

      const data = await response.json();

      if (!response.ok) {
        // Return specific error details if available
        if (data.details) {
          return { 
            success: false, 
            error: data.error, 
            details: data.details 
          };
        }
        return { success: false, error: data.error || 'Registration failed' };
      }

      // Store token and user data
      await AsyncStorage.setItem('authToken', data.token);
      await AsyncStorage.setItem('currentUser', JSON.stringify(data.user));
      
      setToken(data.token);
      setCurrentUser(data.user);
      
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Registration error:', error);
      return { 
        success: false, 
        error: error.message.includes('API unavailable')
          ? 'Unable to connect to server. Please check your internet connection.'
          : 'Registration failed. Please try again.'
      };
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordReset = async (email) => {
    setLoading(true);
    try {
      const response = await makeApiRequest('/auth/reset-password-request', {
        method: 'POST',
        body: { email }
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Password reset request failed' };
      }

      return { 
        success: true, 
        message: data.message,
        // In development, return the reset token
        resetToken: data.resetToken
      };
    } catch (error) {
      console.error('Password reset request error:', error);
      return { success: false, error: 'Unable to process password reset request' };
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (token, newPassword) => {
    setLoading(true);
    try {
      const response = await makeApiRequest('/auth/reset-password', {
        method: 'POST',
        body: { token, password: newPassword }
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Password reset failed' };
      }

      return { success: true, message: data.message };
    } catch (error) {
      console.error('Password reset error:', error);
      return { success: false, error: 'Password reset failed' };
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (profileData) => {
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    setLoading(true);
    try {
      const response = await makeApiRequest('/auth/profile', {
        method: 'PUT',
        body: profileData,
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Profile update failed' };
      }

      // Update current user data
      setCurrentUser(data.user);
      await AsyncStorage.setItem('currentUser', JSON.stringify(data.user));

      return { success: true, user: data.user };
    } catch (error) {
      console.error('Profile update error:', error);
      return { success: false, error: 'Profile update failed' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await clearStoredAuth();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getAuthHeaders = () => {
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  // Check if user is authenticated
  const isAuthenticated = () => {
    return !!(token && currentUser);
  };

  const value = {
    currentUser,
    loading,
    login,
    register,
    requestPasswordReset,
    resetPassword,
    updateProfile,
    logout,
    getAuthHeaders,
    isAuthenticated
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};