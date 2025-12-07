// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import styled from 'styled-components';
import {
  Box,
  Button,
  Flex,
  Typography,
  Badge,
} from '@strapi/design-system';
import {
  Check as CheckIcon,
  Cross as XMarkIcon,
  Sparkle as SparklesIcon,
  Lightning as BoltIcon,
  Rocket as RocketLaunchIcon,
} from '@strapi/icons';
import pluginId from '../pluginId';

const Container = styled(Box)`
  padding: 32px;
  max-width: 1400px;
  margin: 0 auto;
`;

const Header = styled(Box)`
  text-align: center;
  margin-bottom: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

const Title = styled(Typography)`
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 8px;
  background: linear-gradient(135deg, #0EA5E9, #A855F7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  display: block;
`;

const Subtitle = styled(Typography)`
  font-size: 1.125rem;
  color: ${props => props.theme.colors.neutral600};
  line-height: 1.6;
  display: block;
`;

const TierGrid = styled(Flex)`
  gap: 32px;
  margin: 0 auto 48px;
  max-width: 1080px;
  justify-content: center;
  flex-wrap: wrap;
  align-items: stretch;
`;

const TierWrapper = styled(Box)`
  flex: 1;
  min-width: 280px;
  max-width: 340px;
  display: flex;
`;

interface TierCardProps {
  $featured?: boolean;
}

const TierCard = styled(Box)<TierCardProps>`
  background: ${props => props.theme.colors.neutral0};
  border-radius: 16px;
  padding: 32px;
  border: 2px solid ${props => props.$featured ? '#0EA5E9' : props.theme.colors.neutral200};
  position: relative;
  transition: all 0.3s ease;
  box-shadow: ${props => props.$featured
    ? '0 20px 25px -5px rgba(14, 165, 233, 0.25), 0 8px 10px -6px rgba(14, 165, 233, 0.2)'
    : '0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.05)'};
  display: flex;
  flex-direction: column;
  width: 100%;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.1);
  }
`;

const PopularBadge = styled(Badge)`
  position: absolute;
  top: -12px;
  right: 24px;
  background: linear-gradient(135deg, #0EA5E9, #0284C7);
  color: white;
  padding: 4px 16px;
  font-size: 12px;
  font-weight: 600;
`;

interface TierIconProps {
  $color: string;
}

const TierIcon = styled(Box)<TierIconProps>`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  background: ${props => props.$color};
  
  svg {
    width: 28px;
    height: 28px;
    color: white;
  }
`;

const TierName = styled(Typography)`
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 8px;
`;

const TierPrice = styled(Typography)`
  font-size: 2rem;
  font-weight: 800;
  margin-bottom: 4px;
`;

const TierDescription = styled(Typography)`
  color: ${props => props.theme.colors.neutral600};
  margin-bottom: 24px;
`;

const FeatureList = styled(Box)`
  margin-bottom: 24px;
  flex: 1;
`;

const Feature = styled(Flex)`
  gap: 12px;
  margin-bottom: 12px;
  align-items: flex-start;
`;

interface FeatureIconProps {
  $included: boolean;
}

const FeatureIcon = styled(Box)<FeatureIconProps>`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
  
  ${props => props.$included ? `
    background: #DCFCE7;
    svg { color: #16A34A; }
  ` : `
    background: #FEE2E2;
    svg { color: #DC2626; }
  `}
`;

interface UpgradeButtonProps {
  $gradient: string;
}

const UpgradeButton = styled(Button)<UpgradeButtonProps>`
  width: 100%;
  height: 48px;
  font-weight: 600;
  font-size: 15px;
  background: ${props => props.$gradient};
  border: none;
  color: white;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;

const CurrentPlanBadge = styled(Badge)`
  width: 100%;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.theme.colors.neutral100};
  color: ${props => props.theme.colors.neutral600};
  font-weight: 600;
  font-size: 15px;
`;

const LimitsBox = styled(Box)`
  background: ${props => props.theme.colors.neutral100};
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 20px;
`;

interface TierFeature {
  name: string;
  included: boolean;
}

interface TierLimits {
  bookmarks: string;
  support: string;
}

interface Tier {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  featured?: boolean;
  features: TierFeature[];
  limits: TierLimits;
}

/**
 * Upgrade page for MagicMark with pricing tiers
 */
const UpgradePage: React.FC = () => {
  const { formatMessage } = useIntl();
  const { get } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [currentTier, setCurrentTier] = useState<string>('free');
  const [limits, setLimits] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchLicenseInfo();
  }, []);

  /**
   * Fetches current license information
   */
  const fetchLicenseInfo = async () => {
    try {
      const response: any = await get('/magic-mark/license/status');
      const licenseData = response.data || {};
      
      let tier = 'free';
      if (licenseData.data?.features?.advanced) {
        tier = 'advanced';
      } else if (licenseData.data?.features?.premium) {
        tier = 'premium';
      }
      
      setCurrentTier(tier);
      setLimits(licenseData.limits);
      setLoading(false);
    } catch (error) {
      console.error('[magic-mark] Failed to fetch license info:', error);
      setLoading(false);
    }
  };

  /**
   * Returns rank of tier for comparison
   */
  const getTierRank = (tierId: string): number => {
    const ranks: Record<string, number> = {
      'free': 0,
      'premium': 1,
      'advanced': 2,
    };
    return ranks[tierId] || 0;
  };

  /**
   * Returns button text based on tier comparison
   */
  const getButtonText = (tierId: string): string => {
    const currentRank = getTierRank(currentTier);
    const targetRank = getTierRank(tierId);
    
    if (currentRank === targetRank) {
      return formatMessage({ id: `${pluginId}.upgradePage.currentPlan`, defaultMessage: 'Current Plan' });
    } else if (targetRank > currentRank) {
      return formatMessage({ id: `${pluginId}.upgrade.upgradeNow`, defaultMessage: 'Upgrade Now' });
    } else {
      return formatMessage({ id: `${pluginId}.upgradePage.downgrade`, defaultMessage: 'Downgrade' });
    }
  };

  const tiers: Tier[] = [
    {
      id: 'free',
      name: 'FREE',
      price: '$0',
      period: 'forever',
      description: 'Perfect for small projects and testing',
      icon: <SparklesIcon />,
      color: 'linear-gradient(135deg, #6B7280, #4B5563)',
      features: [
        { name: '10 Bookmarks', included: true },
        { name: 'Advanced Filters', included: true },
        { name: 'Role Sharing', included: true },
        { name: 'Drag & Drop', included: true },
        { name: 'Quick Access', included: true },
        { name: 'Query History', included: false },
        { name: 'Export Bookmarks', included: false },
        { name: 'Analytics', included: false },
        { name: 'Bulk Operations', included: false },
      ],
      limits: {
        bookmarks: '10',
        support: 'Community',
      }
    },
    {
      id: 'premium',
      name: 'PREMIUM',
      price: '$14.50',
      period: '/month',
      description: 'Enhanced features for growing teams',
      icon: <BoltIcon />,
      color: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
      featured: true,
      features: [
        { name: '50 Bookmarks', included: true },
        { name: 'Advanced Filters', included: true },
        { name: 'Role Sharing', included: true },
        { name: 'Drag & Drop', included: true },
        { name: 'Quick Access', included: true },
        { name: 'Query History', included: true },
        { name: 'Export Bookmarks', included: true },
        { name: 'Priority Support', included: true },
        { name: 'Analytics', included: false },
        { name: 'Bulk Operations', included: false },
      ],
      limits: {
        bookmarks: '50',
        support: 'Priority',
      }
    },
    {
      id: 'advanced',
      name: 'ADVANCED',
      price: '$39.50',
      period: '/month',
      description: 'Maximum features for power users',
      icon: <RocketLaunchIcon />,
      color: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
      features: [
        { name: 'Unlimited Bookmarks', included: true },
        { name: 'Advanced Filters', included: true },
        { name: 'Role Sharing', included: true },
        { name: 'Drag & Drop', included: true },
        { name: 'Quick Access', included: true },
        { name: 'Query History', included: true },
        { name: 'Export Bookmarks', included: true },
        { name: 'Analytics Dashboard', included: true },
        { name: 'Bulk Operations', included: true },
        { name: 'Custom Integrations', included: true },
        { name: 'Priority + Phone Support', included: true },
      ],
      limits: {
        bookmarks: 'Unlimited',
        support: 'Priority + Phone',
      }
    }
  ];

  /**
   * Handle upgrade button click
   */
  const handleUpgrade = (tierId: string) => {
    window.open('https://store.magicdx.dev/', '_blank');
  };

  if (loading) {
    return (
      <Container>
        <Flex justifyContent="center" alignItems="center" style={{ minHeight: '400px' }}>
          <Typography>{formatMessage({ id: `${pluginId}.upgradePage.loading`, defaultMessage: 'Loading license information...' })}</Typography>
        </Flex>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <Title variant="alpha">{formatMessage({ id: `${pluginId}.upgradePage.title`, defaultMessage: 'Choose Your Plan' })}</Title>
        <Subtitle variant="omega">
          {formatMessage({ id: `${pluginId}.upgradePage.subtitle`, defaultMessage: 'Unlock powerful bookmarking features for your Strapi application' })}
        </Subtitle>
      </Header>

      <TierGrid>
        {tiers.map((tier) => (
          <TierWrapper key={tier.id}>
            <TierCard $featured={tier.featured}>
              {tier.featured && <PopularBadge>{formatMessage({ id: `${pluginId}.upgradePage.mostPopular`, defaultMessage: 'MOST POPULAR' })}</PopularBadge>}
              
              <TierIcon $color={tier.color}>
                {tier.icon}
              </TierIcon>
              
              <TierName variant="beta">{tier.name}</TierName>
              
              <Flex alignItems="baseline" gap={1}>
                <TierPrice variant="alpha">{tier.price}</TierPrice>
                <Typography variant="omega" style={{ color: '#6B7280' }}>
                  {tier.period}
                </Typography>
              </Flex>
              
              <TierDescription variant="omega">
                {tier.description}
              </TierDescription>
              
              <LimitsBox>
                <Flex direction="column" gap={2}>
                  <Typography variant="pi" style={{ fontSize: '13px' }}>
                    <strong>{formatMessage({ id: `${pluginId}.upgradePage.bookmarks`, defaultMessage: 'Bookmarks:' })}</strong> {tier.limits.bookmarks}
                  </Typography>
                  <Typography variant="pi" style={{ fontSize: '13px' }}>
                    <strong>{formatMessage({ id: `${pluginId}.upgradePage.support`, defaultMessage: 'Support:' })}</strong> {tier.limits.support}
                  </Typography>
                </Flex>
              </LimitsBox>
              
              <FeatureList>
                {tier.features.map((feature, index) => (
                  <Feature key={index}>
                    <FeatureIcon $included={feature.included}>
                      {feature.included ? (
                        <CheckIcon style={{ width: 14, height: 14 }} />
                      ) : (
                        <XMarkIcon style={{ width: 14, height: 14 }} />
                      )}
                    </FeatureIcon>
                    <Typography 
                      variant="omega" 
                      style={{ 
                        fontSize: '14px',
                        color: feature.included ? '#374151' : '#9CA3AF',
                        textDecoration: feature.included ? 'none' : 'line-through'
                      }}
                    >
                      {feature.name}
                    </Typography>
                  </Feature>
                ))}
              </FeatureList>
              
              {currentTier === tier.id ? (
                <CurrentPlanBadge>{formatMessage({ id: `${pluginId}.upgradePage.currentPlan`, defaultMessage: 'CURRENT PLAN' })}</CurrentPlanBadge>
              ) : (
                <UpgradeButton
                  onClick={() => handleUpgrade(tier.id)}
                  $gradient={tier.color}
                >
                  {getButtonText(tier.id)}
                </UpgradeButton>
              )}
            </TierCard>
          </TierWrapper>
        ))}
      </TierGrid>
    </Container>
  );
};

export default UpgradePage;

