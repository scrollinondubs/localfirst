import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import { buildApiUrl } from '../config/api';

export const useRecommendationsEligibility = () => {
  const { currentUser, token, isAuthenticated } = useAuth();
  const [isEligible, setIsEligible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [eligibilityData, setEligibilityData] = useState(null);

  const checkEligibility = async () => {
    if (!isAuthenticated() || !currentUser || !token) {
      setIsEligible(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(buildApiUrl('/api/concierge/eligibility'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-ID': currentUser.id,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // New eligibility: hasDossier && hasPreferences
        setIsEligible(data.eligible);
        setEligibilityData(data);
      } else {
        setIsEligible(false);
        setEligibilityData(null);
      }
    } catch (error) {
      console.error('Error checking recommendations eligibility:', error);
      setIsEligible(false);
      setEligibilityData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkEligibility();
  }, [currentUser, token, isAuthenticated]);

  return { isEligible, loading, eligibilityData, refresh: checkEligibility };
};