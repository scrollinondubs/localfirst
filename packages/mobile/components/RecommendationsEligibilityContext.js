import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { buildApiUrl } from '../config/api';

const RecommendationsEligibilityContext = createContext();

export const RecommendationsEligibilityProvider = ({ children }) => {
  const { currentUser, token, isAuthenticated } = useAuth();
  const [isEligible, setIsEligible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [eligibilityData, setEligibilityData] = useState(null);

  const checkEligibility = async () => {
    if (!isAuthenticated() || !currentUser) {
      setIsEligible(false);
      setLoading(false);
      setEligibilityData(null);
      return;
    }

    setLoading(true);
    try {
      console.log('[ELIGIBILITY] Checking recommendations eligibility for user:', currentUser.id);
      
      const response = await fetch(buildApiUrl('/api/concierge/eligibility'), {
        headers: {
          'X-User-ID': currentUser.id,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[ELIGIBILITY] Eligibility check result:', data);
        
        // New eligibility: hasDossier && hasPreferences && hasCompletedInterview
        const wasEligible = isEligible;
        setIsEligible(data.eligible);
        setEligibilityData(data);
        
        // Log eligibility change for debugging
        if (wasEligible !== data.eligible) {
          console.log('[ELIGIBILITY] Eligibility changed:', wasEligible, '->', data.eligible);
        }
      } else {
        console.log('[ELIGIBILITY] Eligibility check failed:', response.status, response.statusText);
        setIsEligible(false);
        setEligibilityData(null);
      }
    } catch (error) {
      console.error('[ELIGIBILITY] Error checking recommendations eligibility:', error);
      setIsEligible(false);
      setEligibilityData(null);
    } finally {
      setLoading(false);
    }
  };

  // Initial check when user changes
  useEffect(() => {
    checkEligibility();
  }, [currentUser, isAuthenticated]);

  const value = {
    isEligible,
    loading,
    eligibilityData,
    refresh: checkEligibility
  };

  return (
    <RecommendationsEligibilityContext.Provider value={value}>
      {children}
    </RecommendationsEligibilityContext.Provider>
  );
};

export const useRecommendationsEligibility = () => {
  const context = useContext(RecommendationsEligibilityContext);
  if (context === undefined) {
    throw new Error('useRecommendationsEligibility must be used within a RecommendationsEligibilityProvider');
  }
  return context;
};