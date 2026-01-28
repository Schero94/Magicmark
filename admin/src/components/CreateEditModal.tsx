// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import {
  Box,
  Button,
  Flex,
  TextInput,
  Textarea,
  Typography,
} from '@strapi/design-system';
import { Cross } from '@strapi/icons';
import { useFetchClient } from '@strapi/strapi/admin';
import styled, { keyframes, css } from 'styled-components';
import FilterPreview from './FilterPreview';

// Heroicons (Outline style - 24x24)
import {
  BookmarkIcon,
  BookOpenIcon,
  StarIcon,
  HeartIcon,
  BoltIcon,
  RocketLaunchIcon,
  PencilIcon,
  LinkIcon,
  SparklesIcon,
  BriefcaseIcon,
  PhotoIcon,
  DocumentIcon,
  BellIcon,
  CheckCircleIcon,
  GiftIcon,
  UserIcon,
  UserGroupIcon,
  EnvelopeIcon,
  CalendarIcon,
  ClockIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  GlobeAltIcon,
  TagIcon,
  FlagIcon,
  FireIcon,
  CubeIcon,
  HomeIcon,
  CogIcon,
  WrenchIcon,
  CommandLineIcon,
  ChartBarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  LightBulbIcon,
  ShareIcon,
  SwatchIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

// ================ THEME ================
const theme = {
  colors: {
    primary: { 500: '#4945FF', 600: '#3B38E0', 100: '#EEF0FF', 200: '#D9D8FF' },
    secondary: { 500: '#7B79FF', 100: '#F0F0FF' },
    success: { 500: '#328048', 100: '#EAFBE7', 600: '#2E7D32' },
    warning: { 500: '#D9822F', 100: '#FDF4DC' },
    danger: { 500: '#D02B20', 100: '#FCECEA' },
    neutral: { 0: '#FFFFFF', 100: '#F6F6F9', 200: '#DCDCE4', 400: '#A5A5BA', 600: '#666687', 800: '#32324D', 900: '#212134' },
  },
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
  },
  gradients: {
    primary: 'linear-gradient(135deg, #4945FF 0%, #7B79FF 100%)',
    header: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  }
};

// ================ ICON DEFINITIONS ================
export const BOOKMARK_ICONS = [
  { id: 'bookmark', icon: BookmarkIcon, label: 'Bookmark' },
  { id: 'book', icon: BookOpenIcon, label: 'Book' },
  { id: 'star', icon: StarIcon, label: 'Star' },
  { id: 'heart', icon: HeartIcon, label: 'Heart' },
  { id: 'bolt', icon: BoltIcon, label: 'Lightning' },
  { id: 'rocket', icon: RocketLaunchIcon, label: 'Rocket' },
  { id: 'pencil', icon: PencilIcon, label: 'Pencil' },
  { id: 'link', icon: LinkIcon, label: 'Link' },
  { id: 'sparkles', icon: SparklesIcon, label: 'Sparkles' },
  { id: 'briefcase', icon: BriefcaseIcon, label: 'Briefcase' },
  { id: 'photo', icon: PhotoIcon, label: 'Photo' },
  { id: 'document', icon: DocumentIcon, label: 'Document' },
  { id: 'bell', icon: BellIcon, label: 'Bell' },
  { id: 'check', icon: CheckCircleIcon, label: 'Check' },
  { id: 'gift', icon: GiftIcon, label: 'Gift' },
  { id: 'user', icon: UserIcon, label: 'User' },
  { id: 'users', icon: UserGroupIcon, label: 'Users' },
  { id: 'mail', icon: EnvelopeIcon, label: 'Mail' },
  { id: 'calendar', icon: CalendarIcon, label: 'Calendar' },
  { id: 'clock', icon: ClockIcon, label: 'Clock' },
  { id: 'folder', icon: FolderIcon, label: 'Folder' },
  { id: 'search', icon: MagnifyingGlassIcon, label: 'Search' },
  { id: 'filter', icon: FunnelIcon, label: 'Filter' },
  { id: 'globe', icon: GlobeAltIcon, label: 'Globe' },
  { id: 'tag', icon: TagIcon, label: 'Tag' },
  { id: 'flag', icon: FlagIcon, label: 'Flag' },
  { id: 'fire', icon: FireIcon, label: 'Fire' },
  { id: 'cube', icon: CubeIcon, label: 'Cube' },
  { id: 'home', icon: HomeIcon, label: 'Home' },
  { id: 'cog', icon: CogIcon, label: 'Settings' },
  { id: 'wrench', icon: WrenchIcon, label: 'Wrench' },
  { id: 'terminal', icon: CommandLineIcon, label: 'Terminal' },
  { id: 'chart', icon: ChartBarIcon, label: 'Chart' },
];

/**
 * Returns the icon component for a given icon ID
 */
export const getIconById = (iconId: string) => {
  const found = BOOKMARK_ICONS.find(i => i.id === iconId);
  return found ? found.icon : BookmarkIcon;
};

// ================ ANIMATIONS ================
const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
`;

const slideDown = keyframes`
  from { opacity: 0; max-height: 0; }
  to { opacity: 1; max-height: 500px; }
`;

// ================ STYLED COMPONENTS ================
const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
`;

const ModalContainer = styled.div`
  background: ${theme.colors.neutral[0]};
  border-radius: 16px;
  max-height: 90vh;
  overflow: hidden;
  max-width: 580px;
  width: 95%;
  box-shadow: ${theme.shadows.xl};
  animation: ${fadeIn} 0.2s ease-out;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  background: ${theme.gradients.header};
  padding: 24px 28px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const HeaderTitle = styled.h2`
  color: white;
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  
  svg {
    width: 24px;
    height: 24px;
  }
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  
  svg {
    width: 20px;
    height: 20px;
    color: white;
  }
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.05);
  }
`;

const ModalBody = styled.div`
  padding: 24px 28px;
  overflow-y: auto;
  flex: 1;
`;

const ModalFooter = styled.div`
  padding: 16px 28px;
  background: ${theme.colors.neutral[100]};
  border-top: 1px solid ${theme.colors.neutral[200]};
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;

const Section = styled.div<{ $collapsed?: boolean }>`
  margin-bottom: 20px;
  border: 1px solid ${theme.colors.neutral[200]};
  border-radius: 12px;
  overflow: hidden;
  background: ${theme.colors.neutral[0]};
  transition: all 0.2s ease;
  
  &:hover {
    border-color: ${theme.colors.primary[200]};
  }
`;

const SectionHeader = styled.button<{ $hasIcon?: boolean }>`
  width: 100%;
  padding: 14px 16px;
  background: ${theme.colors.neutral[100]};
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.15s ease;
  
  &:hover {
    background: ${theme.colors.neutral[200]};
  }
`;

const SectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 0.875rem;
  color: ${theme.colors.neutral[800]};
  
  svg {
    width: 18px;
    height: 18px;
    color: ${theme.colors.primary[500]};
  }
`;

const SectionContent = styled.div<{ $collapsed?: boolean }>`
  padding: ${props => props.$collapsed ? '0' : '16px'};
  max-height: ${props => props.$collapsed ? '0' : '500px'};
  opacity: ${props => props.$collapsed ? '0' : '1'};
  overflow: hidden;
  transition: all 0.25s ease;
`;

const ChevronIcon = styled.div<{ $collapsed?: boolean }>`
  transform: rotate(${props => props.$collapsed ? '0' : '180deg'});
  transition: transform 0.2s ease;
  
  svg {
    width: 18px;
    height: 18px;
    color: ${theme.colors.neutral[600]};
  }
`;

const IconPicker = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 8px;
  padding: 12px;
  background: ${theme.colors.neutral[100]};
  border-radius: 8px;
  max-height: 180px;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${theme.colors.neutral[400]};
    border-radius: 3px;
  }
`;

const IconButton = styled.button<{ $isSelected?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border: 2px solid ${props => props.$isSelected ? theme.colors.primary[500] : 'transparent'};
  background: ${props => props.$isSelected ? theme.colors.primary[100] : theme.colors.neutral[0]};
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  
  svg {
    width: 20px;
    height: 20px;
    color: ${props => props.$isSelected ? theme.colors.primary[500] : theme.colors.neutral[600]};
  }
  
  &:hover {
    border-color: ${theme.colors.primary[500]};
    background: ${theme.colors.primary[100]};
    transform: scale(1.08);
    
    svg {
      color: ${theme.colors.primary[500]};
    }
  }
`;

const SelectedIconDisplay = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: linear-gradient(135deg, ${theme.colors.primary[100]} 0%, ${theme.colors.secondary[100]} 100%);
  border-radius: 10px;
  margin-bottom: 12px;
`;

const SelectedIconCircle = styled.div`
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background: ${theme.colors.neutral[0]};
  border: 2px solid ${theme.colors.primary[500]};
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: ${theme.shadows.md};
  
  svg {
    width: 26px;
    height: 26px;
    color: ${theme.colors.primary[500]};
  }
`;

const PublicToggleContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: ${theme.colors.neutral[100]};
  border-radius: 10px;
  margin-bottom: 16px;
`;

const PublicToggleInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  
  svg {
    width: 20px;
    height: 20px;
    color: ${theme.colors.primary[500]};
  }
`;

const SwitchContainer = styled.label`
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
`;

const SwitchInput = styled.input`
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
`;

const SwitchSlider = styled.span<{ $checked?: boolean }>`
  position: relative;
  width: 44px;
  height: 24px;
  background: ${props => props.$checked ? theme.colors.primary[500] : theme.colors.neutral[300]};
  border-radius: 24px;
  transition: all 0.2s ease;
  
  &::before {
    content: '';
    position: absolute;
    width: 18px;
    height: 18px;
    left: ${props => props.$checked ? '23px' : '3px'};
    top: 3px;
    background: white;
    border-radius: 50%;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }
  
  &:hover {
    background: ${props => props.$checked ? theme.colors.primary[600] : theme.colors.neutral[400]};
  }
`;

const SelectionList = styled.div<{ $disabled?: boolean }>`
  max-height: 140px;
  overflow-y: auto;
  border: 1px solid ${theme.colors.neutral[200]};
  border-radius: 8px;
  background: ${props => props.$disabled ? theme.colors.neutral[100] : theme.colors.neutral[0]};
  opacity: ${props => props.$disabled ? 0.6 : 1};
  pointer-events: ${props => props.$disabled ? 'none' : 'auto'};
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${theme.colors.neutral[400]};
    border-radius: 3px;
  }
`;

const SelectionItem = styled.label<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 1px solid ${theme.colors.neutral[200]};
  background: ${props => props.$selected ? theme.colors.primary[100] : 'transparent'};
  transition: all 0.15s ease;
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background: ${props => props.$selected ? theme.colors.primary[100] : theme.colors.neutral[100]};
  }
`;

const CustomCheckbox = styled.div<{ $checked?: boolean }>`
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 2px solid ${props => props.$checked ? theme.colors.primary[500] : theme.colors.neutral[400]};
  background: ${props => props.$checked ? theme.colors.primary[500] : 'transparent'};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
  
  svg {
    width: 14px;
    height: 14px;
    color: white;
    opacity: ${props => props.$checked ? 1 : 0};
  }
`;

const ItemLabel = styled.span<{ $selected?: boolean }>`
  font-size: 0.875rem;
  color: ${props => props.$selected ? theme.colors.primary[600] : theme.colors.neutral[800]};
  font-weight: ${props => props.$selected ? 600 : 400};
`;

const ItemBadge = styled.span<{ $type?: 'custom' | 'count' }>`
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: ${props => props.$type === 'custom' ? '#F3E8FF' : theme.colors.neutral[200]};
  color: ${props => props.$type === 'custom' ? '#8B5CF6' : theme.colors.neutral[600]};
  font-weight: 500;
`;

const FormField = styled.div`
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const Label = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: ${theme.colors.neutral[800]};
  margin-bottom: 8px;
`;

const HintText = styled.p`
  font-size: 0.75rem;
  color: ${theme.colors.neutral[600]};
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  
  svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }
`;

const PathDisplay = styled.div`
  padding: 12px 14px;
  background: ${theme.colors.neutral[100]};
  border: 1px solid ${theme.colors.neutral[200]};
  border-radius: 8px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.8rem;
  color: ${theme.colors.neutral[600]};
  word-break: break-all;
`;

const ErrorBox = styled.div`
  padding: 12px 16px;
  background: ${theme.colors.danger[100]};
  border: 1px solid ${theme.colors.danger[500]};
  border-radius: 8px;
  margin-bottom: 16px;
  
  p {
    color: ${theme.colors.danger[500]};
    font-size: 0.875rem;
    margin: 0;
  }
`;

const SectionLabel = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  color: ${theme.colors.neutral[600]};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  margin-top: 12px;
  
  &:first-child {
    margin-top: 0;
  }
`;

const StyledTextInput = styled(TextInput)`
  input {
    border-radius: 8px;
    border: 1px solid ${theme.colors.neutral[200]};
    
    &:focus {
      border-color: ${theme.colors.primary[500]};
      box-shadow: 0 0 0 3px ${theme.colors.primary[100]};
    }
  }
`;

const StyledTextarea = styled(Textarea)`
  textarea {
    border-radius: 8px;
    border: 1px solid ${theme.colors.neutral[200]};
    min-height: 80px;
    
    &:focus {
      border-color: ${theme.colors.primary[500]};
      box-shadow: 0 0 0 3px ${theme.colors.primary[100]};
    }
  }
`;

// ================ COMPONENT ================
interface CreateEditModalProps {
  bookmark: any | null;
  onClose: () => void;
  onSuccess: () => void;
  pluginId: string;
  currentPath?: string;
  currentQuery?: string;
}

const CreateEditModal: React.FC<CreateEditModalProps> = ({
  bookmark,
  onClose,
  onSuccess,
  pluginId,
  currentPath,
  currentQuery,
}) => {
  const { formatMessage } = useIntl();
  const { post, put, get } = useFetchClient();
  
  // Form state
  const [name, setName] = useState('');
  const [path, setPath] = useState(currentPath || '');
  const [query, setQuery] = useState(currentQuery || '');
  const [icon, setIcon] = useState('bookmark');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Sharing state
  const [isPublic, setIsPublic] = useState(false);
  const [sharedWithRoles, setSharedWithRoles] = useState<number[]>([]);
  const [sharedWithUsers, setSharedWithUsers] = useState<number[]>([]);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Collapsed sections
  const [iconSectionOpen, setIconSectionOpen] = useState(true);
  const [sharingSectionOpen, setSharingSectionOpen] = useState(false);
  const [filtersSectionOpen, setFiltersSectionOpen] = useState(false);

  useEffect(() => {
    if (bookmark) {
      setName(bookmark.name);
      setPath(bookmark.path);
      setQuery(bookmark.query || '');
      setIcon(bookmark.icon || bookmark.emoji || 'bookmark');
      setDescription(bookmark.description || '');
      setIsPublic(bookmark.isPublic || false);
      setSharedWithRoles(bookmark.sharedWithRoles || []);
      setSharedWithUsers(bookmark.sharedWithUsers || []);
    }
    
    fetchRoles();
    fetchUsers();
  }, [bookmark]);

  /**
   * Fetches available admin roles
   */
  const fetchRoles = async () => {
    setLoadingRoles(true);
    try {
      const response = await get(`/${pluginId}/roles`);
      const roles = response.data?.data?.data || response.data?.data || response.data || [];
      setAvailableRoles(roles);
    } catch (error) {
      console.error('[Magic-Mark] Error fetching roles:', error);
    } finally {
      setLoadingRoles(false);
    }
  };

  /**
   * Fetches available admin users
   */
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const meResponse = await get('/admin/users/me');
      const currentUser = meResponse.data?.data || meResponse.data || meResponse;
      const currentUserId = currentUser?.id;
      const currentUserEmail = currentUser?.email;
      
      const response = await get('/admin/users?pageSize=100&page=1&sort=firstname');
      const allUsers = response.data?.data?.results || response.data?.results || [];
      
      const users = Array.isArray(allUsers) ? allUsers.filter(u => {
        const matchById = u.id === currentUserId || u.id === Number(currentUserId) || String(u.id) === String(currentUserId);
        const matchByEmail = u.email?.toLowerCase() === currentUserEmail?.toLowerCase();
        return !(matchById || matchByEmail);
      }) : [];
      
      setAvailableUsers(users);
    } catch (error) {
      console.error('[Magic-Mark] Error fetching users:', error);
      try {
        const response = await get(`/${pluginId}/users`);
        const users = response.data?.data?.data || response.data?.data || response.data || [];
        setAvailableUsers(users);
      } catch (fallbackError) {
        setAvailableUsers([]);
      }
    } finally {
      setLoadingUsers(false);
    }
  };

  /**
   * Validates the form before submission
   */
  const validateForm = () => {
    setError('');
    if (!name.trim()) {
      setError(formatMessage({ id: `${pluginId}.error.nameRequired`, defaultMessage: 'Name is required' }));
      return false;
    }
    if (!path.trim()) {
      setError(formatMessage({ id: `${pluginId}.error.pathRequired`, defaultMessage: 'Path is required' }));
      return false;
    }
    return true;
  };

  /**
   * Handles form submission
   */
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      // Use documentId for Strapi v5 Document Service API
      const bookmarkId = bookmark?.documentId || bookmark?.id;
      const endpoint = bookmark
        ? `/${pluginId}/bookmarks/${bookmarkId}`
        : `/${pluginId}/bookmarks`;

      const body = {
        name,
        path,
        query,
        icon,
        emoji: icon,
        description,
        isPublic,
        sharedWithRoles,
        sharedWithUsers,
      };

      if (bookmark) {
        await put(endpoint, body);
      } else {
        await post(endpoint, body);
      }

      onSuccess();
    } catch (error) {
      console.error('[Magic-Mark] Error saving bookmark:', error);
      setError(formatMessage({ id: `${pluginId}.error.save`, defaultMessage: 'Failed to save bookmark' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Toggles role selection
   */
  const toggleRole = (roleId: number) => {
    setSharedWithRoles(prev => 
      prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
    );
  };

  /**
   * Toggles user selection
   */
  const toggleUser = (userId: number) => {
    setSharedWithUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const isEditing = !!bookmark;
  const SelectedIcon = getIconById(icon);

  return (
    <Overlay onClick={onClose}>
      <ModalContainer onClick={e => e.stopPropagation()}>
        {/* Header */}
        <ModalHeader>
          <HeaderTitle>
            <BookmarkIcon />
            {isEditing
              ? formatMessage({ id: `${pluginId}.modal.edit`, defaultMessage: 'Edit Bookmark' })
              : formatMessage({ id: `${pluginId}.modal.create`, defaultMessage: 'Save as Bookmark' })}
          </HeaderTitle>
          <CloseButton onClick={onClose}>
            <Cross />
          </CloseButton>
        </ModalHeader>

        {/* Body */}
        <ModalBody>
          {error && (
            <ErrorBox>
              <p>{error}</p>
            </ErrorBox>
          )}

          {/* Name Field - Always visible */}
          <FormField>
            <Label>
              {formatMessage({ id: `${pluginId}.form.name`, defaultMessage: 'Bookmark Name' })} *
            </Label>
            <StyledTextInput
              type="text"
              placeholder={formatMessage({ id: `${pluginId}.form.namePlaceholder`, defaultMessage: 'e.g., Published Articles' })}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>

          {/* Icon Section */}
          <Section>
            <SectionHeader onClick={() => setIconSectionOpen(!iconSectionOpen)}>
              <SectionTitle>
                <SwatchIcon />
                {formatMessage({ id: `${pluginId}.form.icon`, defaultMessage: 'Choose Icon' })}
              </SectionTitle>
              <ChevronIcon $collapsed={!iconSectionOpen}>
                <ChevronDownIcon />
              </ChevronIcon>
            </SectionHeader>
            <SectionContent $collapsed={!iconSectionOpen}>
              <SelectedIconDisplay>
                <SelectedIconCircle>
                  <SelectedIcon />
                </SelectedIconCircle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <Typography variant="pi" fontWeight="semiBold" style={{ color: theme.colors.neutral[800], display: 'block' }}>
                    {BOOKMARK_ICONS.find(i => i.id === icon)?.label || 'Bookmark'}
                  </Typography>
                  <Typography variant="pi" textColor="neutral600" style={{ fontSize: '0.75rem', display: 'block' }}>
                    Click below to change
                  </Typography>
                </div>
              </SelectedIconDisplay>
              <IconPicker>
                {BOOKMARK_ICONS.map((item) => {
                  const IconComp = item.icon;
                  return (
                    <IconButton
                      key={item.id}
                      $isSelected={icon === item.id}
                      onClick={() => setIcon(item.id)}
                      type="button"
                      title={item.label}
                    >
                      <IconComp />
                    </IconButton>
                  );
                })}
              </IconPicker>
            </SectionContent>
          </Section>

          {/* Sharing Section */}
          <Section>
            <SectionHeader onClick={() => setSharingSectionOpen(!sharingSectionOpen)}>
              <SectionTitle>
                <ShareIcon />
                {formatMessage({ id: `${pluginId}.form.sharing`, defaultMessage: 'Sharing Options' })}
                {(isPublic || sharedWithRoles.length > 0 || sharedWithUsers.length > 0) && (
                  <ItemBadge>
                    {isPublic ? 'Public' : `${sharedWithRoles.length + sharedWithUsers.length} shared`}
                  </ItemBadge>
                )}
              </SectionTitle>
              <ChevronIcon $collapsed={!sharingSectionOpen}>
                <ChevronDownIcon />
              </ChevronIcon>
            </SectionHeader>
            <SectionContent $collapsed={!sharingSectionOpen}>
              {/* Public Toggle */}
              <PublicToggleContainer>
                <PublicToggleInfo>
                  <GlobeAltIcon />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <Typography variant="pi" fontWeight="semiBold" style={{ color: theme.colors.neutral[800], display: 'block' }}>
                      Public Bookmark
                    </Typography>
                    <Typography variant="pi" style={{ fontSize: '0.75rem', color: theme.colors.neutral[600], display: 'block' }}>
                      All admin users can see this
                    </Typography>
                  </div>
                </PublicToggleInfo>
                <SwitchContainer>
                  <SwitchInput
                    type="checkbox"
                    checked={isPublic}
                    onChange={() => setIsPublic(!isPublic)}
                  />
                  <SwitchSlider $checked={isPublic} />
                </SwitchContainer>
              </PublicToggleContainer>

              {/* Roles */}
              <SectionLabel>Share with Roles</SectionLabel>
              <SelectionList $disabled={isPublic}>
                {loadingRoles ? (
                  <div style={{ padding: '16px', textAlign: 'center' }}>
                    <Typography variant="pi" textColor="neutral600">Loading...</Typography>
                  </div>
                ) : availableRoles.length > 0 ? (
                  availableRoles.map(role => (
                    <SelectionItem 
                      key={role.id} 
                      $selected={sharedWithRoles.includes(role.id)}
                      onClick={() => !isPublic && toggleRole(role.id)}
                    >
                      <CustomCheckbox $checked={sharedWithRoles.includes(role.id)}>
                        <CheckCircleIcon />
                      </CustomCheckbox>
                      <ItemLabel $selected={sharedWithRoles.includes(role.id)}>
                        {role.name || role.code}
                      </ItemLabel>
                      {role.isCustom && <ItemBadge $type="custom">Custom</ItemBadge>}
                      {role.userCount > 0 && <ItemBadge $type="count">{role.userCount} users</ItemBadge>}
                    </SelectionItem>
                  ))
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center' }}>
                    <Typography variant="pi" textColor="neutral600">No roles available</Typography>
                  </div>
                )}
              </SelectionList>

              {/* Users */}
              <SectionLabel>Share with Users</SectionLabel>
              <SelectionList $disabled={isPublic}>
                {loadingUsers ? (
                  <div style={{ padding: '16px', textAlign: 'center' }}>
                    <Typography variant="pi" textColor="neutral600">Loading...</Typography>
                  </div>
                ) : availableUsers.length > 0 ? (
                  availableUsers.map(user => (
                    <SelectionItem 
                      key={user.id}
                      $selected={sharedWithUsers.includes(user.id)}
                      onClick={() => !isPublic && toggleUser(user.id)}
                    >
                      <CustomCheckbox $checked={sharedWithUsers.includes(user.id)}>
                        <CheckCircleIcon />
                      </CustomCheckbox>
                      <ItemLabel $selected={sharedWithUsers.includes(user.id)}>
                        {user.firstname || ''} {user.lastname || ''}
                      </ItemLabel>
                      <ItemBadge>{user.email}</ItemBadge>
                    </SelectionItem>
                  ))
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center' }}>
                    <Typography variant="pi" textColor="neutral600">No other users</Typography>
                  </div>
                )}
              </SelectionList>
            </SectionContent>
          </Section>

          {/* Filters Section */}
          <Section>
            <SectionHeader onClick={() => setFiltersSectionOpen(!filtersSectionOpen)}>
              <SectionTitle>
                <FunnelIcon />
                {formatMessage({ id: `${pluginId}.form.filterPreview`, defaultMessage: 'Captured Filters' })}
              </SectionTitle>
              <ChevronIcon $collapsed={!filtersSectionOpen}>
                <ChevronDownIcon />
              </ChevronIcon>
            </SectionHeader>
            <SectionContent $collapsed={!filtersSectionOpen}>
              <SectionLabel>Content Manager Path</SectionLabel>
              <PathDisplay>{path || 'No path captured'}</PathDisplay>
              
              <SectionLabel>Active Filters</SectionLabel>
              <FilterPreview query={query} />
              
              <HintText>
                <LightBulbIcon />
                These filters will be restored when you click this bookmark
              </HintText>
            </SectionContent>
          </Section>

          {/* Description */}
          <FormField>
            <Label>
              {formatMessage({ id: `${pluginId}.form.description`, defaultMessage: 'Description' })}
              <span style={{ fontWeight: 400, color: theme.colors.neutral[600] }}> (Optional)</span>
            </Label>
            <StyledTextarea
              placeholder={formatMessage({ id: `${pluginId}.form.descriptionPlaceholder`, defaultMessage: 'Add a description...' })}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
        </ModalBody>

        {/* Footer */}
        <ModalFooter>
          <Button onClick={onClose} variant="tertiary">
            {formatMessage({ id: `${pluginId}.button.cancel`, defaultMessage: 'Cancel' })}
          </Button>
          <Button onClick={handleSubmit} loading={isSubmitting}>
            {isEditing
              ? formatMessage({ id: `${pluginId}.button.update`, defaultMessage: 'Update' })
              : formatMessage({ id: `${pluginId}.button.save`, defaultMessage: 'Save Bookmark' })}
          </Button>
        </ModalFooter>
      </ModalContainer>
    </Overlay>
  );
};

export default CreateEditModal;
