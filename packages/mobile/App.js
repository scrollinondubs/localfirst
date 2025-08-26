import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './components/AuthContext';
import { RecommendationsEligibilityProvider } from './components/RecommendationsEligibilityContext';
import AppNavigator from './navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <RecommendationsEligibilityProvider>
        <AppNavigator />
        <StatusBar style="auto" />
      </RecommendationsEligibilityProvider>
    </AuthProvider>
  );
}
