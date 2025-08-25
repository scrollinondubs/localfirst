import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  Alert
} from 'react-native';
import { useAuth } from '../components/AuthContext';

export default function OnboardingScreen({ navigation }) {
  const [currentStep, setCurrentStep] = useState(0);
  const { currentUser } = useAuth();

  const onboardingSteps = [
    {
      title: 'Welcome to Local First Arizona!',
      subtitle: `Hello ${currentUser?.name || 'there'}! We're excited to help you discover amazing local businesses.`,
      content: 'Support local entrepreneurs and find unique products and services right in your neighborhood.',
      buttonText: 'Get Started',
      image: '🏪'
    },
    {
      title: 'Discover Local Businesses',
      subtitle: 'Find restaurants, shops, and services owned by your neighbors.',
      content: 'Use our search to find exactly what you\'re looking for, from coffee shops to auto repair, all locally owned and operated.',
      buttonText: 'Continue',
      image: '🔍'
    },
    {
      title: 'Save Your Favorites',
      subtitle: 'Keep track of the places you love.',
      content: 'Create a personalized list of your favorite local businesses and never lose track of that perfect spot again.',
      buttonText: 'Continue',
      image: '❤️'
    },
    {
      title: 'Make an Impact',
      subtitle: 'Every purchase supports your local community.',
      content: 'When you shop local, you\'re supporting families, creating jobs, and building a stronger Arizona economy.',
      buttonText: 'Continue',
      image: '🌟'
    },
    {
      title: 'Let\'s Get Personal!',
      subtitle: 'Help us learn about your lifestyle and preferences',
      content: 'Take a quick interview to get personalized business recommendations tailored to your interests, habits, and needs. The more we know, the better we can help you discover amazing local spots!',
      buttonText: 'Start My Interview',
      image: '💬'
    }
  ];

  const currentStepData = onboardingSteps[currentStep];
  const isLastStep = currentStep === onboardingSteps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      // Navigate to profile interview
      navigation.reset({
        index: 0,
        routes: [{ 
          name: 'MainTabs', 
          state: {
            routes: [
              { name: 'Home' },
              { name: 'Profile', state: { routes: [{ name: 'ProfileInterview' }] } }
            ],
            index: 1 // Start on Profile tab with interview screen
          }
        }],
      });
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Onboarding?',
      'You can always access this information later in your profile settings.',
      [
        {
          text: 'Continue Onboarding',
          style: 'cancel'
        },
        {
          text: 'Skip',
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'MainTabs' }],
            });
          }
        }
      ]
    );
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          {onboardingSteps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index === currentStep && styles.progressDotActive,
                index < currentStep && styles.progressDotCompleted
              ]}
            />
          ))}
        </View>

        {/* Skip Button */}
        {!isLastStep && (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        )}

        {/* Main Content */}
        <View style={styles.content}>
          <Text style={styles.emoji}>{currentStepData.image}</Text>
          
          <Text style={styles.title}>{currentStepData.title}</Text>
          
          <Text style={styles.subtitle}>{currentStepData.subtitle}</Text>
          
          <Text style={styles.description}>{currentStepData.content}</Text>
        </View>

        {/* Navigation Buttons */}
        <View style={styles.navigationContainer}>
          {/* Back Button */}
          {currentStep > 0 && (
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}

          {/* Next/Finish Button */}
          <TouchableOpacity 
            style={[styles.nextButton, currentStep === 0 && styles.nextButtonFirst]}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>
              {currentStepData.buttonText}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Skip Interview Option (only on last step) */}
        {isLastStep && (
          <TouchableOpacity 
            style={styles.skipInterviewButton}
            onPress={() => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs' }],
              });
            }}
          >
            <Text style={styles.skipInterviewText}>Skip for now, explore the app</Text>
          </TouchableOpacity>
        )}

        {/* Step Indicator Text */}
        <Text style={styles.stepIndicator}>
          {currentStep + 1} of {onboardingSteps.length}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 4,
  },
  progressDotActive: {
    backgroundColor: '#3182ce',
  },
  progressDotCompleted: {
    backgroundColor: '#38a169',
  },
  skipButton: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  skipButtonText: {
    color: '#718096',
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 32,
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2d3748',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 18,
    color: '#4a5568',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 26,
    fontWeight: '500',
  },
  description: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  backButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  backButtonText: {
    color: '#4a5568',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#3182ce',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 12,
  },
  nextButtonFirst: {
    marginLeft: 0,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepIndicator: {
    textAlign: 'center',
    color: '#a0aec0',
    fontSize: 14,
  },
  skipInterviewButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  skipInterviewText: {
    color: '#718096',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});