// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes, css } from 'styled-components';
import {
  Box,
  Button,
  Flex,
  Typography,
  Loader,
  Table,
  Thead,
  Tbody,
  Tr,
  Td,
  Th,
  VisuallyHidden,
  SingleSelect,
  SingleSelectOption,
} from '@strapi/design-system';
import { 
  Plus, 
  Trash, 
  Pencil, 
  Pin, 
  Link as LinkIcon, 
  Sparkle, 
  Eye, 
  User,
  Calendar,
  Clock,
  Search,
  Book,
} from '@strapi/icons';
import { useFetchClient } from '@strapi/strapi/admin';
import pluginId from '../pluginId';
import CreateEditModal from '../components/CreateEditModal';
import FilterPreview from '../components/FilterPreview';
import { useLicenseInfo } from '../hooks/useFeatureGate';
import UpgradePrompt from '../components/UpgradePrompt';

// ================ THEME ================
const theme = {
  colors: {
    primary: {
      50: '#F0F9FF',
      100: '#E0F2FE',
      500: '#0EA5E9',
      600: '#0284C7',
      700: '#0369A1',
    },
    secondary: {
      500: '#A855F7',
      600: '#9333EA',
    },
    success: {
      100: '#DCFCE7',
      500: '#22C55E',
      600: '#16A34A',
    },
    warning: {
      100: '#FEF3C7',
      500: '#F59E0B',
      600: '#D97706',
    },
    danger: {
      100: '#FEE2E2',
      500: '#EF4444',
      600: '#DC2626',
    },
    neutral: {
      0: '#FFFFFF',
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
    }
  },
  shadows: {
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  },
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
  },
  borderRadius: {
    md: '8px',
    lg: '12px',
    xl: '16px',
  }
};

// ================ ANIMATIONS ================
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const slideIn = keyframes`
  from { opacity: 0; transform: translateX(-10px); }
  to { opacity: 1; transform: translateX(0); }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-5px); }
`;

// ================ RESPONSIVE BREAKPOINTS ================
const breakpoints = {
  mobile: '768px',
  tablet: '1024px',
};

// ================ STYLED COMPONENTS ================
const Container = styled(Box)`
  animation: ${fadeIn} ${theme.transitions.slow};
  min-height: 100vh;
  max-width: 1440px;
  margin: 0 auto;
  padding: ${theme.spacing.xl} ${theme.spacing.lg} 0;

  @media screen and (max-width: ${breakpoints.mobile}) {
    padding: ${theme.spacing.md} ${theme.spacing.sm} 0;
  }
`;

const Header = styled(Box)`
  background: linear-gradient(135deg, 
    ${theme.colors.primary[600]} 0%, 
    ${theme.colors.secondary[600]} 100%
  );
  border-radius: ${theme.borderRadius.xl};
  padding: ${theme.spacing.xl} ${theme.spacing['2xl']};
  margin-bottom: ${theme.spacing.xl};
  position: relative;
  overflow: hidden;
  box-shadow: ${theme.shadows.xl};

  @media screen and (max-width: ${breakpoints.mobile}) {
    padding: ${theme.spacing.lg} ${theme.spacing.md} !important;
    border-radius: ${theme.borderRadius.lg} !important;
  }
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 200%;
    height: 100%;
    background: linear-gradient(
      90deg, 
      transparent, 
      rgba(255, 255, 255, 0.1), 
      transparent
    );
    animation: ${shimmer} 3s infinite;
  }
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 100%;
    height: 100%;
    background-image: radial-gradient(circle at 20% 80%, transparent 50%, rgba(255, 255, 255, 0.1) 50%);
    background-size: 15px 15px;
    opacity: 0.3;
  }
`;

const HeaderContent = styled(Flex)`
  position: relative;
  z-index: 1;
`;

const Title = styled(Typography)`
  color: ${theme.colors.neutral[0]};
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  
  svg {
    width: 28px;
    height: 28px;
    animation: ${float} 3s ease-in-out infinite;
  }
`;

const Subtitle = styled(Typography)`
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.95rem;
  font-weight: 400;
  margin-top: ${theme.spacing.xs};
  letter-spacing: 0.01em;
`;

const StatsGrid = styled.div`
  margin-bottom: ${theme.spacing.xl};
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${theme.spacing.md};
  justify-content: center;
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;

  @media screen and (max-width: ${breakpoints.mobile}) {
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 12px !important;
    margin-bottom: 24px !important;
  }
`;

const StatCard = styled(Box)`
  background: ${theme.colors.neutral[0]};
  border-radius: ${theme.borderRadius.lg};
  padding: ${theme.spacing.lg};
  position: relative;
  overflow: hidden;
  transition: all ${theme.transitions.normal};
  animation: ${fadeIn} ${theme.transitions.slow} backwards;
  animation-delay: ${props => props.$delay || '0s'};
  box-shadow: ${theme.shadows.sm};
  border: 1px solid ${theme.colors.neutral[200]};
  min-width: 200px;
  flex: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: ${theme.shadows.xl};
    border-color: ${props => props.$color || theme.colors.primary[500]};
    
    .stat-icon {
      transform: scale(1.1);
    }
    
    .stat-value {
      transform: scale(1.05);
    }
  }

  @media screen and (max-width: ${breakpoints.mobile}) {
    min-width: unset !important;
    padding: ${theme.spacing.md} !important;
    
    &:hover {
      transform: none !important;
    }
  }
`;

const StatIcon = styled(Box)`
  width: 64px;
  height: 64px;
  border-radius: ${theme.borderRadius.md};
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.$bg || theme.colors.primary[100]};
  transition: all ${theme.transitions.normal};
  margin-bottom: ${theme.spacing.md};
  
  svg {
    width: 32px;
    height: 32px;
    color: ${props => props.$color || theme.colors.primary[600]};
  }
`;

const StatValue = styled(Typography)`
  font-size: 2.5rem;
  font-weight: 700;
  color: ${theme.colors.neutral[800]};
  line-height: 1;
  margin-bottom: ${theme.spacing.xs};
  transition: transform ${theme.transitions.normal};
`;

const StatLabel = styled(Typography)`
  font-size: 0.875rem;
  color: ${theme.colors.neutral[600]};
  font-weight: 500;
  letter-spacing: 0.025em;
  text-transform: capitalize;
`;

const DataTable = styled(Box)`
  background: ${theme.colors.neutral[0]};
  border-radius: ${theme.borderRadius.lg};
  overflow: hidden;
  box-shadow: ${theme.shadows.sm};
  border: 1px solid ${theme.colors.neutral[200]};
  margin-bottom: ${theme.spacing.xl};
`;

const StyledTable = styled(Table)`
  thead {
    background: ${theme.colors.neutral[0]};
    border-bottom: 2px solid ${theme.colors.neutral[100]};
    
    th {
      font-weight: 600;
      color: ${theme.colors.neutral[700]};
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.025em;
      padding: ${theme.spacing.lg} ${theme.spacing.lg};
    }
  }
  
  tbody tr {
    transition: all ${theme.transitions.fast};
    border-bottom: 1px solid ${theme.colors.neutral[100]};
    
    &:last-child {
      border-bottom: none;
    }
    
    &:hover {
      background: ${theme.colors.neutral[50]};
      
      .action-buttons {
        opacity: 1;
      }
    }
    
    td {
      padding: ${theme.spacing.lg} ${theme.spacing.lg};
      color: ${theme.colors.neutral[700]};
      vertical-align: middle;
    }
  }
`;

const PinIndicator = styled(Box)`
  width: 4px;
  height: 40px;
  background: ${props => props.$isPinned ? theme.colors.warning[500] : 'transparent'};
  border-radius: 2px;
  transition: all ${theme.transitions.normal};
`;

const BookmarkEmoji = styled.div`
  font-size: 32px;
  line-height: 1;
  text-align: center;
`;

const ActionButtons = styled(Flex)`
  opacity: 1;
  transition: all ${theme.transitions.fast};
  gap: ${theme.spacing.xs};
  justify-content: flex-end;
`;

const FloatingEmoji = styled.div`
  position: absolute;
  bottom: 40px;
  right: 40px;
  font-size: 72px;
  opacity: 0.08;
  animation: ${float} 4s ease-in-out infinite;
`;

const FilterBar = styled(Flex)`
  background: ${theme.colors.neutral[0]};
  padding: ${theme.spacing.md} ${theme.spacing.lg};
  border-radius: ${theme.borderRadius.lg};
  margin-bottom: ${theme.spacing.lg};
  box-shadow: ${theme.shadows.sm};
  border: 1px solid ${theme.colors.neutral[200]};
  gap: ${theme.spacing.md};
  align-items: center;
`;

const FilterSelect = styled(Box)`
  min-width: 120px;
`;

const SearchInputWrapper = styled.div`
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
`;

const SearchIcon = styled(Search)`
  position: absolute;
  left: 12px;
  width: 16px;
  height: 16px;
  color: ${theme.colors.neutral[600]};
  pointer-events: none;
`;

const StyledSearchInput = styled.input`
  width: 100%;
  padding: ${theme.spacing.sm} ${theme.spacing.sm} ${theme.spacing.sm} 36px;
  border: 1px solid ${theme.colors.neutral[200]};
  border-radius: ${theme.borderRadius.md};
  font-size: 0.875rem;
  transition: all ${theme.transitions.fast};
  background: ${theme.colors.neutral[0]};
  color: ${theme.colors.neutral[800]};
  
  &:focus {
    outline: none;
    border-color: ${theme.colors.primary[500]};
    box-shadow: 0 0 0 3px ${theme.colors.primary[100]};
  }
  
  &::placeholder {
    color: ${theme.colors.neutral[600]};
  }
`;

interface Bookmark {
  id: string;
  name: string;
  path: string;
  query: string;
  emoji: string;
  description?: string;
  isPinned: boolean;
  order: number;
  isPublic?: boolean;
  sharedWithRoles?: number[];
  sharedWithUsers?: number[];
  createdBy?: any;
}

const HomePageModern: React.FC = () => {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const { get, post, del } = useFetchClient();
  const { isPremium, isAdvanced, tier, canUseFeature } = useLicenseInfo();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [entriesPerPage, setEntriesPerPage] = useState('10');
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [licenseLimits, setLicenseLimits] = useState<any>({
    maxBookmarks: 10,
    currentBookmarks: 0,
    canCreate: true,
    tier: 'free',
    features: {}
  });

  useEffect(() => {
    fetchBookmarks();
    fetchCurrentUser();
    fetchRoles();
    fetchUsers();
    fetchLicenseLimits();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await get(`/${pluginId}/roles`);
      const roles = response.data?.data?.data || response.data?.data || [];
      console.log('[Magic-Mark] Available roles in HomePage:', roles);
      setAvailableRoles(roles);
    } catch (error) {
      console.error('[Magic-Mark] Error fetching roles:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      // Use Strapi's existing admin API directly
      const response = await get('/admin/users?pageSize=100&page=1&sort=firstname');
      console.log('[Magic-Mark] Admin users API response:', response);
      
      // Extract users from response - they are in response.data.data.results
      const allUsers = response.data?.data?.results || response.data?.results || [];
      console.log('[Magic-Mark] All users from API in HomePage:', allUsers);
      
      // Filter out current user if we have their ID
      const users = currentUser && Array.isArray(allUsers) ? allUsers.filter(u => u.id !== currentUser.id) : allUsers;
      
      console.log('[Magic-Mark] Available users in HomePage:', users);
      setAvailableUsers(users);
    } catch (error) {
      console.error('[Magic-Mark] Error fetching users from admin API:', error);
      // Fallback to custom endpoint
      try {
        const response = await get(`/${pluginId}/users`);
        const users = response.data?.data?.data || response.data?.data || [];
        setAvailableUsers(users);
      } catch (fallbackError) {
        console.warn('[Magic-Mark] Both user endpoints failed');
        setAvailableUsers([]);
      }
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const response = await get('/admin/users/me');
      console.log('[Magic-Mark] Current user response:', response);
      // The response structure may vary, handle both cases
      const userData = response.data?.data || response.data || response;
      setCurrentUser(userData);
      console.log('[Magic-Mark] Current user set to:', userData);
    } catch (error) {
      console.error('[Magic-Mark] Error fetching current user:', error);
    }
  };

  /**
   * Fetch license limits and feature flags
   */
  const fetchLicenseLimits = async () => {
    try {
      const response = await get(`/${pluginId}/license/limits`);
      if (response.data?.success) {
        setLicenseLimits(response.data.data);
        console.log('[Magic-Mark] License limits loaded:', response.data.data);
      }
    } catch (error) {
      console.error('[Magic-Mark] Error fetching license limits:', error);
    }
  };

  const fetchBookmarks = async () => {
    setLoading(true);
    try {
      const { data } = await get(`/${pluginId}/bookmarks`);
      console.log('[Magic-Mark HomePage] Bookmarks loaded:', data);
      console.log('[Magic-Mark HomePage] Current user state:', currentUser);
      setBookmarks(data.data || []);
    } catch (error) {
      console.error('[Magic-Mark HomePage] Error fetching bookmarks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(formatMessage({ 
      id: `${pluginId}.confirm.delete`,
      defaultMessage: 'Are you sure you want to delete this bookmark?'
    }))) {
      return;
    }

    try {
      await del(`/${pluginId}/bookmarks/${id}`);
      console.log('[Magic-Mark HomePage] Bookmark deleted:', id);
      fetchBookmarks();
    } catch (error) {
      console.error('[Magic-Mark HomePage] Error deleting bookmark:', error);
    }
  };

  const handlePin = async (bookmark: Bookmark) => {
    try {
      await post(`/${pluginId}/bookmarks/${bookmark.id}/pin`, {
        isPinned: !bookmark.isPinned
      });
      console.log('[Magic-Mark HomePage] Bookmark pinned:', bookmark.id);
      fetchBookmarks();
    } catch (error) {
      console.error('[Magic-Mark HomePage] Error pinning bookmark:', error);
    }
  };

  const handleEdit = (bookmark: Bookmark) => {
    setEditingBookmark(bookmark);
    setShowModal(true);
  };

  const handleCreate = () => {
    // Check if bookmark limit is reached
    if (!licenseLimits.canCreate && licenseLimits.maxBookmarks !== -1) {
      alert(`Bookmark limit reached (${licenseLimits.currentBookmarks}/${licenseLimits.maxBookmarks}). Please upgrade to create more bookmarks.`);
      navigate(`/settings/${pluginId}/upgrade`);
      return;
    }
    setEditingBookmark(null);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingBookmark(null);
  };

  const handleModalSuccess = () => {
    setShowModal(false);
    setEditingBookmark(null);
    fetchBookmarks();
    fetchLicenseLimits(); // Update limits after bookmark changes
  };

  const handleBookmarkClick = (bookmark: Bookmark) => {
    if (bookmark.path) {
      let path = bookmark.path;
      
      // Remove /admin prefix if present (navigate will add it automatically)
      if (path.startsWith('/admin/')) {
        path = path.substring(6);
      }
      
      const url = bookmark.query 
        ? `${path}?${bookmark.query}` 
        : path;
      
      console.log('[HomePage] Navigating to:', url);
      navigate(url);
    }
  };

  // Filter bookmarks by search query and filter type
  const filteredBookmarks = bookmarks
    .filter(bookmark => {
      // Filter by type
      if (filterType === 'pinned' && !bookmark.isPinned) return false;
      if (filterType === 'unpinned' && bookmark.isPinned) return false;
      
      // Filter by search
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        bookmark.name.toLowerCase().includes(query) ||
        (bookmark.description && bookmark.description.toLowerCase().includes(query)) ||
        bookmark.path.toLowerCase().includes(query)
      );
    })
    .slice(0, parseInt(entriesPerPage));

  const pinnedBookmarks = bookmarks.filter(b => b.isPinned);
  const myBookmarks = bookmarks.filter(b => b.createdBy?.id === currentUser?.id);
  const sharedWithMe = bookmarks.filter(b => b.createdBy?.id !== currentUser?.id && b.createdBy?.id);

  return (
    <Container padding={8}>
      {/* Gradient Header */}
      <Header>
        <HeaderContent direction="column" alignItems="flex-start" gap={2}>
          <Title>
            <Book /> MagicMark
          </Title>
          <Subtitle>
            Save filtered views and navigate with one click
          </Subtitle>
        </HeaderContent>
      </Header>

      {/* Stats Cards */}
      <StatsGrid>
        <StatCard $delay="0.1s" $color={theme.colors.primary[500]}>
          <StatIcon className="stat-icon" $bg={theme.colors.primary[100]} $color={theme.colors.primary[600]}>
            <User />
          </StatIcon>
          <StatValue className="stat-value">{myBookmarks.length}</StatValue>
          <StatLabel>My Bookmarks</StatLabel>
        </StatCard>

        <StatCard $delay="0.2s" $color={theme.colors.success[500]}>
          <StatIcon className="stat-icon" $bg={theme.colors.success[100]} $color={theme.colors.success[600]}>
            <Sparkle />
          </StatIcon>
          <StatValue className="stat-value">{sharedWithMe.length}</StatValue>
          <StatLabel>{formatMessage({ id: `${pluginId}.stats.shared`, defaultMessage: 'Shared with Me' })}</StatLabel>
        </StatCard>

        <StatCard $delay="0.3s" $color={theme.colors.warning[500]}>
          <StatIcon className="stat-icon" $bg={theme.colors.warning[100]} $color={theme.colors.warning[600]}>
            <Pin />
          </StatIcon>
          <StatValue className="stat-value">{pinnedBookmarks.length}</StatValue>
          <StatLabel>{formatMessage({ id: `${pluginId}.stats.pinned`, defaultMessage: 'Pinned' })}</StatLabel>
        </StatCard>

        <StatCard 
          $delay="0.4s" 
          $color={licenseLimits.canCreate ? theme.colors.neutral[600] : theme.colors.danger[500]}
          onClick={() => !licenseLimits.canCreate && navigate(`/settings/${pluginId}/upgrade`)}
          style={{ cursor: !licenseLimits.canCreate ? 'pointer' : 'default' }}
        >
          <StatIcon 
            className="stat-icon" 
            $bg={licenseLimits.canCreate ? theme.colors.neutral[100] : theme.colors.danger[100]} 
            $color={licenseLimits.canCreate ? theme.colors.neutral[600] : theme.colors.danger[600]}
          >
            <LinkIcon />
          </StatIcon>
          <StatValue className="stat-value">
            {licenseLimits.currentBookmarks}/{licenseLimits.maxBookmarks === -1 ? '∞' : licenseLimits.maxBookmarks}
          </StatValue>
          <StatLabel>
            {licenseLimits.canCreate 
              ? formatMessage({ id: `${pluginId}.stats.limit`, defaultMessage: 'Bookmark Limit' })
              : formatMessage({ id: `${pluginId}.stats.limitReached`, defaultMessage: 'Limit Reached - Upgrade' })
            }
          </StatLabel>
        </StatCard>
      </StatsGrid>

      {/* Loading */}
      {loading && (
        <Flex justifyContent="center" padding={8}>
          <Loader>{formatMessage({ id: `${pluginId}.loading`, defaultMessage: 'Loading bookmarks...' })}</Loader>
        </Flex>
      )}

      {/* Shared with me section */}
      {!loading && sharedWithMe.length > 0 && (
        <Box marginBottom={4}>
          <Box style={{ 
            padding: theme.spacing.lg,
            background: theme.colors.primary[50],
            borderRadius: theme.borderRadius.lg,
            border: `1px solid ${theme.colors.primary[200]}`
          }}>
            <Typography variant="beta" style={{ marginBottom: theme.spacing.sm, color: theme.colors.primary[700] }}>
              {formatMessage({ id: `${pluginId}.shared.title`, defaultMessage: '🤝 Shared with You' })}
            </Typography>
            <Typography variant="pi" style={{ color: theme.colors.primary[600] }}>
              {sharedWithMe.length > 1 
                ? formatMessage({ id: `${pluginId}.shared.countPlural`, defaultMessage: '{count} bookmarks have been shared with you' }, { count: sharedWithMe.length })
                : formatMessage({ id: `${pluginId}.shared.count`, defaultMessage: '{count} bookmark has been shared with you' }, { count: sharedWithMe.length })
              }
            </Typography>
            <Box marginTop={2}>
              {[...new Map(sharedWithMe.map(b => [b.createdBy?.id, b.createdBy])).values()].map(creator => {
                const creatorBookmarks = sharedWithMe.filter(b => b.createdBy?.id === creator?.id);
                return creator && (
                  <Flex key={creator.id} alignItems="center" marginTop={1}>
                    <Typography variant="pi" fontWeight="semiBold">
                      {creator.firstname || formatMessage({ id: `${pluginId}.bookmark.unknown`, defaultMessage: 'Unknown' })} {creator.lastname || ''}: 
                    </Typography>
                    <Typography variant="pi" marginLeft={1}>
                      {creatorBookmarks.length > 1 
                        ? formatMessage({ id: `${pluginId}.shared.byCreatorPlural`, defaultMessage: '{count} bookmarks' }, { count: creatorBookmarks.length })
                        : formatMessage({ id: `${pluginId}.shared.byCreator`, defaultMessage: '{count} bookmark' }, { count: creatorBookmarks.length })
                      }
                    </Typography>
                  </Flex>
                );
              })}
            </Box>
          </Box>
        </Box>
      )}

      {/* Bookmarks Table */}
      {!loading && bookmarks.length > 0 && (
        <Box>
          <Box style={{ marginBottom: theme.spacing.md }}>
            <Typography variant="delta" style={{ marginBottom: theme.spacing.md, color: theme.colors.neutral[700] }}>
              {formatMessage({ id: `${pluginId}.allBookmarks.title`, defaultMessage: '🔖 All Available Bookmarks' })}
            </Typography>
          </Box>
          
          {/* Search Bar */}
          <FilterBar>
            <SearchInputWrapper style={{ flex: 1 }}>
              <SearchIcon />
              <StyledSearchInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={formatMessage({ id: `${pluginId}.search.placeholder`, defaultMessage: 'Search by name, description...' })}
                type="text"
              />
            </SearchInputWrapper>
            <FilterSelect>
              <SingleSelect
                value={filterType}
                onChange={setFilterType}
                placeholder={formatMessage({ id: `${pluginId}.filter.placeholder`, defaultMessage: 'Filter' })}
                size="S"
              >
                <SingleSelectOption value="all">{formatMessage({ id: `${pluginId}.filter.all`, defaultMessage: 'Show All' })}</SingleSelectOption>
                <SingleSelectOption value="pinned">{formatMessage({ id: `${pluginId}.filter.pinned`, defaultMessage: 'Pinned Only' })}</SingleSelectOption>
                <SingleSelectOption value="unpinned">{formatMessage({ id: `${pluginId}.filter.unpinned`, defaultMessage: 'Unpinned Only' })}</SingleSelectOption>
              </SingleSelect>
            </FilterSelect>
            <FilterSelect>
              <SingleSelect
                value={entriesPerPage}
                onChange={setEntriesPerPage}
                placeholder={formatMessage({ id: `${pluginId}.entries.placeholder`, defaultMessage: 'Entries' })}
                size="S"
              >
                <SingleSelectOption value="10">{formatMessage({ id: `${pluginId}.entries.10`, defaultMessage: '10 entries' })}</SingleSelectOption>
                <SingleSelectOption value="25">{formatMessage({ id: `${pluginId}.entries.25`, defaultMessage: '25 entries' })}</SingleSelectOption>
                <SingleSelectOption value="50">{formatMessage({ id: `${pluginId}.entries.50`, defaultMessage: '50 entries' })}</SingleSelectOption>
                <SingleSelectOption value="100">{formatMessage({ id: `${pluginId}.entries.100`, defaultMessage: '100 entries' })}</SingleSelectOption>
              </SingleSelect>
            </FilterSelect>
          </FilterBar>
          
          <DataTable>
            <StyledTable>
              <Thead>
                <Tr>
                  <Th>
                    {formatMessage({
                      id: `${pluginId}.table.name`,
                      defaultMessage: 'Name'
                    })}
                  </Th>
                  <Th>
                    {formatMessage({
                      id: `${pluginId}.table.description`,
                      defaultMessage: 'Description'
                    })}
                  </Th>
                  <Th>
                    <VisuallyHidden>Actions</VisuallyHidden>
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredBookmarks.map((bookmark) => (
                  <Tr key={bookmark.id} style={{ 
                    background: bookmark.isPinned ? theme.colors.warning[50] : 'transparent'
                  }}>
                    {/* Name with Emoji */}
                    <Td onClick={() => handleBookmarkClick(bookmark)} style={{ cursor: 'pointer' }}>
                      <Flex alignItems="center" gap={3}>
                        {/* Emoji */}
                        <Box
                          style={{
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            fontSize: '24px',
                          }}
                        >
                          {bookmark.emoji}
                        </Box>
                        <Flex direction="column" alignItems="flex-start" gap={0}>
                          <Typography fontWeight="semiBold" ellipsis style={{ fontSize: '1.125rem', lineHeight: '1.4' }}>
                            {bookmark.name}
                          </Typography>
                          {/* Ownership/Sharing Indicators */}
                          <Flex gap={1} alignItems="center">
                            {(bookmark.createdBy?.id && currentUser?.id && bookmark.createdBy.id === currentUser.id) ? (
                              <Typography variant="pi" style={{ fontSize: '0.75rem', color: theme.colors.primary[600], fontWeight: 500 }}>
                                • {formatMessage({ id: `${pluginId}.bookmark.myBookmark`, defaultMessage: 'My Bookmark' })}
                              </Typography>
                            ) : (
                              <Typography variant="pi" style={{ fontSize: '0.75rem', color: theme.colors.neutral[600] }}>
                                • {formatMessage({ id: `${pluginId}.bookmark.sharedBy`, defaultMessage: 'Shared by {name}' }, { name: bookmark.createdBy?.firstname || formatMessage({ id: `${pluginId}.bookmark.unknown`, defaultMessage: 'Unknown' }) })}
                              </Typography>
                            )}
                            {bookmark.isPublic && (
                              <Typography variant="pi" style={{ fontSize: '0.75rem', color: theme.colors.success[600], marginLeft: '8px' }}>
                                • {formatMessage({ id: `${pluginId}.bookmark.public`, defaultMessage: 'Public' })}
                              </Typography>
                            )}
                            {bookmark.sharedWithRoles && bookmark.sharedWithRoles.length > 0 && !bookmark.isPublic && (
                              <Typography variant="pi" style={{ fontSize: '0.75rem', color: theme.colors.warning[600], marginLeft: '8px' }}>
                                • Roles: {bookmark.sharedWithRoles.map(roleId => {
                                  const role = availableRoles.find(r => r.id === roleId);
                                  return role?.name || `Role ${roleId}`;
                                }).join(', ')}
                              </Typography>
                            )}
                            {bookmark.sharedWithUsers && bookmark.sharedWithUsers.length > 0 && !bookmark.isPublic && (
                              <Typography variant="pi" style={{ fontSize: '0.75rem', color: theme.colors.primary[600], marginLeft: '8px' }}>
                                • Users: {bookmark.sharedWithUsers.map(userId => {
                                  const user = availableUsers.find(u => u.id === userId);
                                  return user ? `${user.firstname} ${user.lastname}` : `User ${userId}`;
                                }).join(', ')}
                              </Typography>
                            )}
                          </Flex>
                        </Flex>
                      </Flex>
                    </Td>
                    
                    {/* Description */}
                    <Td onClick={() => handleBookmarkClick(bookmark)} style={{ cursor: 'pointer' }}>
                      <Typography variant="pi" textColor="neutral600" ellipsis style={{ fontSize: '1rem', lineHeight: '1.6', fontWeight: 400 }}>
                        {bookmark.description || '-'}
                      </Typography>
                    </Td>
                    
                    {/* Actions */}
                    <Td>
                      <ActionButtons 
                        className="action-buttons"
                      >
                        <Button
                          variant={bookmark.isPinned ? "secondary" : "ghost"}
                          size="S"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePin(bookmark);
                          }}
                          style={{
                            color: bookmark.isPinned ? theme.colors.warning[600] : 'inherit',
                            background: bookmark.isPinned ? theme.colors.warning[100] : 'transparent',
                          }}
                        >
                          <Pin />
                        </Button>
                        <Button
                          variant="ghost"
                          size="S"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBookmarkClick(bookmark);
                          }}
                        >
                          <Eye />
                        </Button>
                        {/* Show edit button for owned bookmarks */}
                        {bookmark.createdBy && (
                          <Button
                            variant="ghost"
                            size="S"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(bookmark);
                            }}
                            disabled={bookmark.createdBy?.id !== currentUser?.id}
                          >
                            <Pencil />
                          </Button>
                        )}
                        {/* Show delete for owned bookmarks */}
                        {(bookmark.createdBy?.id && currentUser?.id && bookmark.createdBy.id === currentUser.id) && (
                          <Button
                            variant="ghost"
                            size="S"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(bookmark.id);
                            }}
                          >
                            <Trash />
                          </Button>
                        )}
                      </ActionButtons>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </StyledTable>
          </DataTable>
        </Box>
      )}

      {/* Empty State */}
      {!loading && bookmarks.length === 0 && (
        <Box
          style={{
            background: theme.colors.neutral[0],
            borderRadius: theme.borderRadius.xl,
            border: `2px dashed ${theme.colors.neutral[200]}`,
            padding: theme.spacing['3xl'],
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
            minHeight: '400px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Background Gradient */}
          <Box
            style={{
              content: '',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: `linear-gradient(135deg, ${theme.colors.primary[50]} 0%, ${theme.colors.secondary[50]} 100%)`,
              opacity: 0.3,
              zIndex: 0,
            }}
          />
          
          {/* Floating Icon */}
          <FloatingEmoji>
            <Sparkle fill="warning500" />
          </FloatingEmoji>
          
          {/* Content */}
          <Flex direction="column" alignItems="center" gap={6} style={{ position: 'relative', zIndex: 1 }}>
            {/* Icon Circle */}
            <Box
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${theme.colors.primary[100]} 0%, ${theme.colors.secondary[100]} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: theme.shadows.xl,
              }}
            >
              <Sparkle style={{ width: '60px', height: '60px', color: theme.colors.primary[600] }} />
            </Box>
            
            {/* Text */}
            <Typography 
              variant="alpha" 
              style={{ 
                fontSize: '1.75rem',
                fontWeight: '700',
                color: theme.colors.neutral[800],
                marginBottom: '8px',
              }}
            >
              {formatMessage({ id: `${pluginId}.empty.title`, defaultMessage: 'No bookmarks yet' })}
            </Typography>
            
            <Typography 
              variant="omega" 
              textColor="neutral600"
              style={{
                fontSize: '1rem',
                maxWidth: '500px',
                lineHeight: '1.6',
              }}
            >
              {formatMessage({ id: `${pluginId}.empty.description`, defaultMessage: 'Navigate to any Content Manager view, apply filters, and click "Save Bookmark" to create quick access shortcuts' })}
            </Typography>
          </Flex>
        </Box>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <CreateEditModal
          bookmark={editingBookmark}
          pluginId={pluginId}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          currentPath=""
          currentQuery=""
        />
      )}
    </Container>
  );
};

export default HomePageModern;

