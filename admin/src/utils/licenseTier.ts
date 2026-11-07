export type LicenseTier = 'free' | 'premium' | 'advanced' | 'enterprise';

const TIER_RANK: Record<LicenseTier, number> = {
  free: 0,
  premium: 1,
  advanced: 2,
  enterprise: 3,
};

const rankFor = (tier: string): number =>
  TIER_RANK[tier as LicenseTier] ?? TIER_RANK.free;

/**
 * Returns whether a license tier includes Premium features.
 * @param tier Tier returned by the MagicMark license service.
 */
export const isPremiumTier = (tier: string): boolean => rankFor(tier) >= TIER_RANK.premium;

/**
 * Returns whether a license tier includes Advanced features.
 * @param tier Tier returned by the MagicMark license service.
 */
export const isAdvancedTier = (tier: string): boolean => rankFor(tier) >= TIER_RANK.advanced;

/**
 * Compares the current tier with a feature's minimum tier.
 * Unknown values safely fall back to the free tier.
 * @param currentTier Tier assigned to the active license.
 * @param requiredTier Minimum tier required by a feature.
 */
export const isTierAtLeast = (currentTier: string, requiredTier: string): boolean =>
  rankFor(currentTier) >= rankFor(requiredTier);
