// @ts-nocheck
import React from 'react';
import { useIntl } from 'react-intl';
import { Box, Button, Flex, Typography } from '@strapi/design-system';
import { Lock, Sparkle, Lightning } from '@strapi/icons';
import styled, { keyframes } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import pluginId from '../pluginId';

// ================ ANIMATIONS ================
const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
`;

// ================ STYLED COMPONENTS ================
const PromptContainer = styled(Box)<{ variant: 'inline' | 'banner' | 'modal' }>`
  ${props => props.variant === 'inline' && `
    background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%);
    border: 1px dashed #F97316;
    border-radius: 8px;
    padding: 12px 16px;
  `}

  ${props => props.variant === 'banner' && `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    padding: 24px 32px;
    color: white;
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.1),
        transparent
      );
      background-size: 200% 100%;
      animation: ${shimmer} 3s infinite;
    }
  `}

  ${props => props.variant === 'modal' && `
    background: white;
    border-radius: 16px;
    padding: 32px;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
    max-width: 400px;
    text-align: center;
  `}
`;

const LockIconWrapper = styled.div<{ size: 'sm' | 'md' | 'lg' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(249, 115, 22, 0.1);
  border-radius: 50%;
  animation: ${float} 2s ease-in-out infinite;
  
  ${props => props.size === 'sm' && `
    width: 24px;
    height: 24px;
    svg { width: 12px; height: 12px; }
  `}

  ${props => props.size === 'md' && `
    width: 40px;
    height: 40px;
    svg { width: 20px; height: 20px; }
  `}

  ${props => props.size === 'lg' && `
    width: 64px;
    height: 64px;
    margin-bottom: 16px;
    svg { width: 28px; height: 28px; }
  `}

  svg {
    color: #F97316;
  }
`;

const FeatureBadge = styled.span<{ tier: 'premium' | 'advanced' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  ${props => props.tier === 'premium' && `
    background: linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%);
    color: white;
  `}

  ${props => props.tier === 'advanced' && `
    background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
    color: white;
  `}

  svg {
    width: 12px;
    height: 12px;
  }
`;

const UpgradeButton = styled(Button)`
  background: linear-gradient(135deg, #F97316 0%, #EA580C 100%);
  border: none;
  color: white;
  font-weight: 600;
  border-radius: 8px;
  padding: 8px 20px;
  transition: all 0.2s;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4);
  }
`;

const InlineUpgradeLink = styled.button`
  background: none;
  border: none;
  color: #F97316;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
  
  &:hover {
    color: #EA580C;
  }
`;

// ================ TYPES ================
interface UpgradePromptProps {
  feature: string;
  tier?: 'premium' | 'advanced';
  variant?: 'inline' | 'banner' | 'modal';
  title?: string;
  description?: string;
  showIcon?: boolean;
  onUpgradeClick?: () => void;
}

// ================ COMPONENT ================
const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  feature,
  tier = 'premium',
  variant = 'inline',
  title,
  description,
  showIcon = true,
  onUpgradeClick,
}) => {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();

  const handleUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      navigate('/settings/magic-mark/upgrade');
    }
  };

  const defaultTitle = tier === 'premium' 
    ? formatMessage({ id: `${pluginId}.upgrade.premiumFeature`, defaultMessage: 'Premium Feature' })
    : formatMessage({ id: `${pluginId}.upgrade.advancedFeature`, defaultMessage: 'Advanced Feature' });

  const defaultDescription = formatMessage({ id: `${pluginId}.upgrade.description`, defaultMessage: '{feature} is a {tier} feature. Upgrade to unlock this and more.' }, { feature, tier });

  // Inline variant - small, unobtrusive
  if (variant === 'inline') {
    return (
      <PromptContainer variant="inline">
        <Flex alignItems="center" gap={3}>
          {showIcon && (
            <LockIconWrapper size="sm">
              <Lock />
            </LockIconWrapper>
          )}
          <Box style={{ flex: 1 }}>
            <Flex alignItems="center" gap={2}>
              <Typography variant="pi" fontWeight="semiBold" style={{ color: '#C2410C' }}>
                {title || defaultTitle}
              </Typography>
              <FeatureBadge tier={tier}>
                {tier === 'premium' ? <Sparkle /> : <Lightning />}
                {tier}
              </FeatureBadge>
            </Flex>
            <Typography variant="pi" style={{ color: '#9A3412', fontSize: '12px' }}>
              {description || defaultDescription}
            </Typography>
          </Box>
          <InlineUpgradeLink onClick={handleUpgrade}>
            {formatMessage({ id: `${pluginId}.upgrade.button`, defaultMessage: 'Upgrade' })}
          </InlineUpgradeLink>
        </Flex>
      </PromptContainer>
    );
  }

  // Banner variant - prominent, for page headers
  if (variant === 'banner') {
    return (
      <PromptContainer variant="banner">
        <Flex alignItems="center" justifyContent="space-between" style={{ position: 'relative', zIndex: 1 }}>
          <Flex alignItems="center" gap={4}>
            {showIcon && (
              <LockIconWrapper size="md" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <Lock style={{ color: 'white' }} />
              </LockIconWrapper>
            )}
            <Box>
              <Flex alignItems="center" gap={2} marginBottom={1}>
                <Typography variant="delta" fontWeight="bold" style={{ color: 'white' }}>
                  {title || formatMessage({ id: `${pluginId}.upgrade.unlockTitle`, defaultMessage: 'Unlock {feature}' }, { feature })}
                </Typography>
                <FeatureBadge tier={tier}>
                  {tier === 'premium' ? <Sparkle /> : <Lightning />}
                  {tier}
                </FeatureBadge>
              </Flex>
              <Typography variant="omega" style={{ color: 'rgba(255,255,255,0.9)' }}>
                {description || defaultDescription}
              </Typography>
            </Box>
          </Flex>
          <UpgradeButton onClick={handleUpgrade}>
            {formatMessage({ id: `${pluginId}.upgrade.upgradeNow`, defaultMessage: 'Upgrade Now' })}
          </UpgradeButton>
        </Flex>
      </PromptContainer>
    );
  }

  // Modal variant - centered, for blocking access
  return (
    <PromptContainer variant="modal">
      {showIcon && (
        <LockIconWrapper size="lg">
          <Lock />
        </LockIconWrapper>
      )}
      <FeatureBadge tier={tier} style={{ marginBottom: '16px' }}>
        {tier === 'premium' ? <Sparkle /> : <Lightning />}
        {formatMessage({ id: `${pluginId}.upgrade.tierFeature`, defaultMessage: '{tier} Feature' }, { tier })}
      </FeatureBadge>
      <Typography variant="delta" fontWeight="bold" style={{ marginBottom: '8px', display: 'block' }}>
        {title || formatMessage({ id: `${pluginId}.upgrade.locked`, defaultMessage: '{feature} is locked' }, { feature })}
      </Typography>
      <Typography variant="omega" textColor="neutral600" style={{ marginBottom: '24px', display: 'block' }}>
        {description || defaultDescription}
      </Typography>
      <UpgradeButton onClick={handleUpgrade} fullWidth>
        {formatMessage({ id: `${pluginId}.upgrade.upgradeTo`, defaultMessage: 'Upgrade to {tier}' }, { tier: tier.charAt(0).toUpperCase() + tier.slice(1) })}
      </UpgradeButton>
    </PromptContainer>
  );
};

/**
 * Higher-order component to wrap features with paywall
 */
export const withFeatureGate = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  feature: string,
  tier: 'premium' | 'advanced' = 'premium'
) => {
  return (props: P & { canUse?: boolean }) => {
    const { canUse = false, ...rest } = props;
    
    if (!canUse) {
      return (
        <UpgradePrompt 
          feature={feature} 
          tier={tier} 
          variant="inline" 
        />
      );
    }
    
    return <WrappedComponent {...(rest as P)} />;
  };
};

/**
 * Feature lock overlay for disabling UI elements
 */
export const FeatureLockOverlay = styled.div`
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(2px);
    border-radius: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: not-allowed;
  }
`;

export default UpgradePrompt;

