import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './components/AuthContext';
import AppNavigator from './navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
