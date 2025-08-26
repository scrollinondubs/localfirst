import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'react-native';

import { useAuth } from '../components/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import SearchScreen from '../screens/SearchScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProfileInterviewScreen from '../screens/ProfileInterviewScreen';
import NotificationPreferencesScreen from '../screens/NotificationPreferencesScreen';
import ForceLogoutScreen from '../screens/ForceLogoutScreen';
import RecommendationsScreen from '../screens/RecommendationsScreen';
import ViewDossierScreen from '../screens/ViewDossierScreen';
import { useRecommendationsEligibility } from '../components/RecommendationsEligibilityContext';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="ProfileInterview" component={ProfileInterviewScreen} />
      <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
      <Stack.Screen name="ViewDossier" component={ViewDossierScreen} />
      <Stack.Screen name="ForceLogout" component={ForceLogoutScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const { isAuthenticated } = useAuth();
  const { isEligible: showRecommendationsTab } = useRecommendationsEligibility();
  const showFavoritesTab = isAuthenticated();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === 'Home') {
            return (
              <Image 
                source={require('../assets/LFA-icon.png')} 
                style={{ 
                  width: size, 
                  height: size, 
                  tintColor: color,
                  opacity: focused ? 1 : 0.7 
                }} 
                resizeMode="contain"
              />
            );
          }

          let iconName;
          if (route.name === 'Favorites') {
            iconName = focused ? 'heart' : 'heart-outline';
          } else if (route.name === 'Recommendations') {
            iconName = focused ? 'sparkles' : 'sparkles-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#3182ce',
        tabBarInactiveTintColor: '#718096',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          height: 60,
          paddingTop: 5,
          paddingBottom: 5,
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={SearchScreen}
        options={{ title: 'LFA' }}
      />
      {showFavoritesTab && (
        <Tab.Screen 
          name="Favorites" 
          component={FavoritesScreen}
          options={{ title: 'Favorites' }}
        />
      )}
      {showRecommendationsTab && (
        <Tab.Screen 
          name="Recommendations" 
          component={RecommendationsScreen}
          options={{ title: 'Recommendations' }}
        />
      )}
      <Tab.Screen 
        name="Profile" 
        component={ProfileStack}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

function RootStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <RootStack />
    </NavigationContainer>
  );
}