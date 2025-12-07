import { useState, useEffect, useCallback } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';

/**
 * Feature definitions for MagicMark
 * Maps feature keys to their required tier
 */
export const FEATURES = {
  // Free tier features
  basicBookmarks: { tier: 'free', limit: 10 },
  basicFilters: { tier: 'free' },
  
  // Premium tier features
  extendedBookmarks: { tier: 'premium', limit: 50 },
  queryHistory: { tier: 'premium' },
  exportBookmarks: { tier: 'premium' },
  sharedBookmarks: { tier: 'premium' },
  
  // Advanced tier features
  unlimitedBookmarks: { tier: 'advanced', limit: -1 },
  advancedFilters: { tier: 'advanced' },
  subGroups: { tier: 'advanced' },
  bulkOperations: { tier: 'advanced' },
  analytics: { tier: 'advanced' },
  customIntegrations: { tier: 'advanced' },
} as const;

export type FeatureKey = keyof typeof FEATURES;

interface LicenseLimits {
  maxBookmarks: number;
  currentBookmarks: number;
  canCreate: boolean;
  tier: 'free' | 'premium' | 'advanced';
  features: {
    queryHistory: boolean;
    export: boolean;
    analytics: boolean;
    bulkOperations: boolean;
    customIntegrations: boolean;
  };
}

interface UseFeatureGateResult {
  canUse: boolean;
  tier: string;
  requiredTier: string;
  isLoading: boolean;
  showUpgrade: () => void;
  limits: LicenseLimits | null;
  isPremium: boolean;
  isAdvanced: boolean;
}

/**
 * Hook to check if a feature is available based on license
 * @param feature - Feature key to check
 * @returns Object with canUse boolean and upgrade function
 */
export const useFeatureGate = (feature: FeatureKey): UseFeatureGateResult => {
  const { get } = useFetchClient();
  const [limits, setLimits] = useState<LicenseLimits | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLimits = async () => {
      try {
        const response: any = await get('/magic-mark/license/limits');
        if (response.data?.success) {
          setLimits(response.data.data);
        }
      } catch (error) {
        console.error('[useFeatureGate] Error fetching license limits:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLimits();
  }, []);

  const featureConfig = FEATURES[feature];
  const requiredTier = featureConfig.tier;
  const currentTier = limits?.tier || 'free';

  // Determine if feature is available
  const tierOrder = { free: 0, premium: 1, advanced: 2 };
  const canUse = tierOrder[currentTier] >= tierOrder[requiredTier];

  const isPremium = currentTier === 'premium' || currentTier === 'advanced';
  const isAdvanced = currentTier === 'advanced';

  const showUpgrade = useCallback(() => {
    // Navigate to upgrade page
    window.location.href = '/admin/settings/magic-mark/upgrade';
  }, []);

  return {
    canUse,
    tier: currentTier,
    requiredTier,
    isLoading,
    showUpgrade,
    limits,
    isPremium,
    isAdvanced,
  };
};

/**
 * Simplified hook to get all license info
 */
export const useLicenseInfo = () => {
  const { get } = useFetchClient();
  const [limits, setLimits] = useState<LicenseLimits | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLimits = async () => {
      try {
        console.log('[useLicenseInfo] Fetching license limits...');
        const response: any = await get('/magic-mark/license/limits');
        console.log('[useLicenseInfo] Raw API response:', response);
        console.log('[useLicenseInfo] Response data:', response.data);
        
        if (response.data?.success) {
          console.log('[useLicenseInfo] Setting limits:', response.data.data);
          setLimits(response.data.data);
        } else {
          console.warn('[useLicenseInfo] API returned success=false or missing data');
        }
      } catch (error) {
        console.error('[useLicenseInfo] Error fetching license limits:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLimits();
  }, []);

  const tier = limits?.tier || 'free';
  const isPremium = tier === 'premium' || tier === 'advanced';
  const isAdvanced = tier === 'advanced';
  
  // Debug log the final computed values
  console.log('[useLicenseInfo] Computed values:', { tier, isPremium, isAdvanced, limits });

  return {
    isLoading,
    limits,
    tier,
    isFree: tier === 'free',
    isPremium,
    isAdvanced,
    canUseFeature: (feature: FeatureKey): boolean => {
      const featureConfig = FEATURES[feature];
      const tierOrder = { free: 0, premium: 1, advanced: 2 };
      return tierOrder[tier] >= tierOrder[featureConfig.tier];
    },
  };
};

export default useFeatureGate;

