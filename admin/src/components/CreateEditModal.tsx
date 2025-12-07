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
import { Cross, Lightbulb } from '@strapi/icons';
import { useFetchClient } from '@strapi/strapi/admin';
import styled from 'styled-components';
import FilterPreview from './FilterPreview';

const EmojiPicker = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 8px;
  padding: 12px;
  background: ${props => props.theme.colors.neutral100};
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
`;

const EmojiButton = styled.button<{ isSelected?: boolean }>`
  padding: 8px;
  font-size: 24px;
  border: 2px solid ${props => props.isSelected ? props.theme.colors.primary600 : props.theme.colors.neutral200};
  background: ${props => props.theme.colors.neutral0};
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: ${props => props.theme.colors.primary600};
    background: ${props => props.theme.colors.neutral100};
  }
`;

const BOOKMARK_EMOJIS = ['🔖', '📌', '⭐', '💫', '❤️', '🎯', '🚀', '📝', '🔗', '🌟', '💼', '🎨', '📚', '🔔', '✅', '🎁'];

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
  const [name, setName] = useState('');
  const [path, setPath] = useState(currentPath || '');
  const [query, setQuery] = useState(currentQuery || '');
  const [emoji, setEmoji] = useState('🔖');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [error, setError] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [sharedWithRoles, setSharedWithRoles] = useState<number[]>([]);
  const [sharedWithUsers, setSharedWithUsers] = useState<number[]>([]);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  

  useEffect(() => {
    if (bookmark) {
      setName(bookmark.name);
      setPath(bookmark.path);
      setQuery(bookmark.query || '');
      setEmoji(bookmark.emoji);
      setDescription(bookmark.description || '');
      setIsPublic(bookmark.isPublic || false);
      setSharedWithRoles(bookmark.sharedWithRoles || []);
      setSharedWithUsers(bookmark.sharedWithUsers || []);
    }
    
    // Fetch available roles and users
    fetchRoles();
    fetchUsers();
  }, [bookmark]);

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

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      // First get current user
      const meResponse = await get('/admin/users/me');
      const currentUser = meResponse.data?.data || meResponse.data || meResponse;
      const currentUserId = currentUser?.id;
      const currentUserEmail = currentUser?.email;
      
      console.log('[CreateEditModal] Current user:', { currentUserId, currentUserEmail, fullResponse: currentUser });
      
      // Then get all users
      const response = await get('/admin/users?pageSize=100&page=1&sort=firstname');
      
      // Extract users from response - they are in response.data.data.results
      const allUsers = response.data?.data?.results || response.data?.results || [];
      
      console.log('[CreateEditModal] All users:', allUsers.map(u => ({ id: u.id, email: u.email })));
      
      // Filter out current user - check both ID and email to be sure
      const users = Array.isArray(allUsers) ? allUsers.filter(u => {
        const matchById = u.id === currentUserId || u.id === Number(currentUserId) || String(u.id) === String(currentUserId);
        const matchByEmail = u.email?.toLowerCase() === currentUserEmail?.toLowerCase();
        const shouldExclude = matchById || matchByEmail;
        
        if (shouldExclude) {
          console.log('[CreateEditModal] Excluding current user:', u.email);
        }
        return !shouldExclude;
      }) : [];
      
      console.log('[CreateEditModal] Filtered users (without current):', users.map(u => ({ id: u.id, email: u.email })));
      
      setAvailableUsers(users);
    } catch (error) {
      console.error('[Magic-Mark] Error fetching users:', error);
      // Fallback to custom endpoint if admin API fails
      try {
        const response = await get(`/${pluginId}/users`);
        const users = response.data?.data?.data || response.data?.data || response.data || [];
        setAvailableUsers(users);
      } catch (fallbackError) {
        console.warn('[Magic-Mark] Both user endpoints failed, feature disabled');
        setAvailableUsers([]);
      }
    } finally {
      setLoadingUsers(false);
    }
  };

  const validateForm = () => {
    setError('');
    if (!name.trim()) {
      setError(formatMessage({
        id: `${pluginId}.error.nameRequired`,
        defaultMessage: 'Name is required'
      }));
      return false;
    }
    if (!path.trim()) {
      setError(formatMessage({
        id: `${pluginId}.error.pathRequired`,
        defaultMessage: 'Path is required'
      }));
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const endpoint = bookmark
        ? `/${pluginId}/bookmarks/${bookmark.id}`
        : `/${pluginId}/bookmarks`;

      const body = {
        name,
        path,
        query,
        emoji,
        description,
        isPublic,
        sharedWithRoles,
        sharedWithUsers,
      };


      let result;
      if (bookmark) {
        result = await put(endpoint, body);
      } else {
        result = await post(endpoint, body);
      }

      onSuccess();
    } catch (error) {
      console.error('[Magic-Mark] Error saving bookmark:', error);
      setError(formatMessage({
        id: `${pluginId}.error.save`,
        defaultMessage: 'Failed to save bookmark'
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditing = !!bookmark;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
      }}
    >
      <Box
        padding={6}
        background="neutral0"
        style={{
          borderRadius: '8px',
          maxHeight: '90vh',
          overflow: 'auto',
          maxWidth: '600px',
          width: '90%',
        }}
      >
        {/* Header */}
        <Flex justifyContent="space-between" alignItems="center" marginBottom={6}>
          <Typography as="h2" variant="beta">
            {isEditing
              ? formatMessage({
                  id: `${pluginId}.modal.edit`,
                  defaultMessage: 'Edit Bookmark'
                })
              : formatMessage({
                  id: `${pluginId}.modal.create`,
                  defaultMessage: 'Save as Bookmark'
                })}
          </Typography>
          <Button onClick={onClose} variant="ghost" type="button">
            <Cross />
          </Button>
        </Flex>

        {/* Body */}
        <Box marginBottom={6}>
          <Box
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {error && (
              <Box padding={3} background="danger100" borderRadius="4px">
                <Typography textColor="danger600">{error}</Typography>
              </Box>
            )}

            {/* Emoji Selector */}
            <Box>
              <Typography variant="pi" fontWeight="bold" style={{ marginBottom: '8px', display: 'block' }}>
                {formatMessage({
                  id: `${pluginId}.form.emoji`,
                  defaultMessage: 'Choose Icon'
                })}
              </Typography>
              <Flex gap={2} alignItems="center">
                <Box
                  as="button"
                  padding={3}
                  borderRadius="4px"
                  border="1px solid"
                  borderColor="neutral200"
                  fontSize="32px"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  type="button"
                  style={{ cursor: 'pointer' }}
                >
                  {emoji}
                </Box>
                <Typography variant="pi" textColor="neutral600">
                  {formatMessage({
                    id: `${pluginId}.form.selectEmoji`,
                    defaultMessage: 'Click to select'
                  })}
                </Typography>
              </Flex>
              {showEmojiPicker && (
                <EmojiPicker>
                  {BOOKMARK_EMOJIS.map((e) => (
                    <EmojiButton
                      key={e}
                      isSelected={emoji === e}
                      onClick={() => {
                        setEmoji(e);
                        setShowEmojiPicker(false);
                      }}
                      type="button"
                    >
                      {e}
                    </EmojiButton>
                  ))}
                </EmojiPicker>
              )}
            </Box>

            {/* Sharing Options */}
            <Box>
              <Typography variant="pi" fontWeight="bold" style={{ marginBottom: '8px', display: 'block' }}>
                {formatMessage({
                  id: `${pluginId}.form.sharing`,
                  defaultMessage: 'Sharing Options'
                })}
              </Typography>
              
              {/* Public Checkbox */}
              <Box marginBottom={3}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={{ fontSize: '14px' }}>
                    {formatMessage({
                      id: `${pluginId}.form.publicAccess`,
                      defaultMessage: 'Public (All admin users can see this bookmark)'
                    })}
                  </span>
                </label>
              </Box>
              
              {/* Role Selection */}
              <Box>
                <Flex justifyContent="space-between" alignItems="center" marginBottom={2}>
                  <Typography variant="pi" textColor="neutral600">
                    {formatMessage({
                      id: `${pluginId}.form.shareWithRoles`,
                      defaultMessage: 'Share with specific roles:'
                    })}
                  </Typography>
                  {sharedWithRoles.length > 0 && (
                    <Typography variant="pi" fontWeight="semiBold" textColor="primary600">
                      {sharedWithRoles.length} selected
                    </Typography>
                  )}
                </Flex>
                <Box 
                  background={isPublic ? "neutral100" : "neutral0"}
                  borderColor="neutral200"
                  style={{ 
                    maxHeight: '150px', 
                    overflowY: 'auto',
                    border: '1px solid',
                    borderRadius: '4px',
                    padding: '12px',
                  }}
                >
                  {loadingRoles ? (
                    <Typography variant="pi">{formatMessage({ id: `${pluginId}.form.loadingRoles`, defaultMessage: 'Loading roles...' })}</Typography>
                  ) : availableRoles.length > 0 ? (
                    availableRoles.map(role => (
                      <Box key={role.id} marginBottom={2}>
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          cursor: isPublic ? 'not-allowed' : 'pointer',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          background: sharedWithRoles.includes(role.id) ? '#eaf5ff' : 'transparent',
                          border: sharedWithRoles.includes(role.id) ? '1px solid #3945C9' : '1px solid transparent'
                        }}>
                          <input
                            type="checkbox"
                            checked={sharedWithRoles.includes(role.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSharedWithRoles(prev => {
                                  const newRoles = [...prev, role.id];
                                  return newRoles;
                                });
                              } else {
                                setSharedWithRoles(prev => {
                                  const newRoles = prev.filter(id => id !== role.id);
                                  return newRoles;
                                });
                              }
                            }}
                            style={{ marginRight: '8px' }}
                            disabled={isPublic}
                          />
                          <span style={{ 
                            fontSize: '14px',
                            fontWeight: sharedWithRoles.includes(role.id) ? 600 : 400,
                            color: isPublic ? '#999' : (sharedWithRoles.includes(role.id) ? '#3945C9' : '#32324d')
                          }}>
                            {role.name || role.code || `Role ${role.id}`}
                            {role.isCustom && <span style={{ fontSize: '11px', marginLeft: '4px', color: '#8C4BFF' }}>(Custom)</span>}
                            {role.userCount > 0 && <span style={{ fontSize: '11px', marginLeft: '4px', color: '#666' }}>({role.userCount} user{role.userCount > 1 ? 's' : ''})</span>}
                          </span>
                        </label>
                      </Box>
                    ))
                  ) : (
                    <Typography variant="pi" textColor="neutral600">
                      {formatMessage({ id: `${pluginId}.form.noRoles`, defaultMessage: 'No roles available' })}
                    </Typography>
                  )}
                </Box>
                {isPublic && (
                  <Typography variant="pi" textColor="neutral600" style={{ marginTop: '4px', fontSize: '0.75rem' }}>
                    {formatMessage({ id: `${pluginId}.form.roleDisabled`, defaultMessage: 'Role selection disabled when bookmark is public' })}
                  </Typography>
                )}
              </Box>

              {/* User Selection */}
              <Box marginTop={3}>
                <Flex justifyContent="space-between" alignItems="center" marginBottom={2}>
                  <Typography variant="pi" textColor="neutral600">
                    {formatMessage({
                      id: `${pluginId}.form.shareWithUsers`,
                      defaultMessage: 'Share with specific users:'
                    })}
                  </Typography>
                  {sharedWithUsers.length > 0 && (
                    <Typography variant="pi" fontWeight="semiBold" textColor="primary600">
                      {sharedWithUsers.length} selected
                    </Typography>
                  )}
                </Flex>
                <Box 
                  background={isPublic ? "neutral100" : "neutral0"}
                  borderColor="neutral200"
                  style={{ 
                    maxHeight: '150px', 
                    overflowY: 'auto',
                    border: '1px solid',
                    borderRadius: '4px',
                    padding: '12px',
                  }}
                >
                  {loadingUsers ? (
                    <Typography variant="pi">{formatMessage({ id: `${pluginId}.form.loadingUsers`, defaultMessage: 'Loading users...' })}</Typography>
                  ) : availableUsers.length > 0 ? (
                    availableUsers.map(user => (
                      <Box key={user.id} marginBottom={2}>
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          cursor: isPublic ? 'not-allowed' : 'pointer',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          background: sharedWithUsers.includes(user.id) ? '#eaf5ff' : 'transparent',
                          border: sharedWithUsers.includes(user.id) ? '1px solid #3945C9' : '1px solid transparent'
                        }}>
                          <input
                            type="checkbox"
                            checked={sharedWithUsers.includes(user.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSharedWithUsers(prev => {
                                  const newUsers = [...prev, user.id];
                                  return newUsers;
                                });
                              } else {
                                setSharedWithUsers(prev => {
                                  const newUsers = prev.filter(id => id !== user.id);
                                  return newUsers;
                                });
                              }
                            }}
                            style={{ marginRight: '8px' }}
                            disabled={isPublic}
                          />
                          <span style={{ 
                            fontSize: '14px',
                            fontWeight: sharedWithUsers.includes(user.id) ? 600 : 400,
                            color: isPublic ? '#999' : (sharedWithUsers.includes(user.id) ? '#3945C9' : '#32324d')
                          }}>
                            {user.firstname || ''} {user.lastname || ''}
                            <span style={{ fontSize: '12px', color: '#666', marginLeft: '4px' }}>({user.email || user.username || 'No email'})</span>
                          </span>
                        </label>
                      </Box>
                    ))
                  ) : (
                    <Typography variant="pi" textColor="neutral600">
                      {formatMessage({ id: `${pluginId}.form.noUsers`, defaultMessage: 'No other users available' })}
                    </Typography>
                  )}
                </Box>
                {isPublic && (
                  <Typography variant="pi" textColor="neutral600" style={{ marginTop: '4px', fontSize: '0.75rem' }}>
                    {formatMessage({ id: `${pluginId}.form.userDisabled`, defaultMessage: 'User selection disabled when bookmark is public' })}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Name */}
            <Box>
              <Typography variant="pi" fontWeight="bold" style={{ marginBottom: '8px', display: 'block' }} as="label" htmlFor="name">
                {formatMessage({
                  id: `${pluginId}.form.name`,
                  defaultMessage: 'Bookmark Name'
                })} *
              </Typography>
              <TextInput
                id="name"
                type="text"
                placeholder={formatMessage({ id: `${pluginId}.form.namePlaceholder`, defaultMessage: 'e.g., Published Articles' })}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Box>

            {/* Path (readonly) */}
            <Box>
              <Typography variant="pi" fontWeight="bold" style={{ marginBottom: '8px', display: 'block' }} as="label" htmlFor="path">
                {formatMessage({
                  id: `${pluginId}.form.path`,
                  defaultMessage: 'Content Manager Path'
                })}
              </Typography>
              <TextInput
                id="path"
                type="text"
                placeholder="/content-manager/collection-types/api::article.article"
                value={path}
                readOnly
                disabled
              />
              <Typography variant="pi" textColor="neutral600" style={{ marginTop: '4px', display: 'block' }}>
                {formatMessage({
                  id: `${pluginId}.form.pathHelp`,
                  defaultMessage: 'Automatically captured from Content Manager'
                })}
              </Typography>
            </Box>

            {/* Query Preview - Beautiful! */}
            <Box>
              <Typography variant="pi" fontWeight="bold" style={{ marginBottom: '8px', display: 'block' }}>
                {formatMessage({
                  id: `${pluginId}.form.filterPreview`,
                  defaultMessage: 'Captured Filters & Settings'
                })}
              </Typography>
              <FilterPreview query={query} />
              <Flex alignItems="center" gap={1} style={{ marginTop: '8px' }}>
                <Lightbulb fill="neutral600" width="14px" height="14px" />
                <Typography variant="pi" textColor="neutral600">
                  {formatMessage({
                    id: `${pluginId}.form.queryHelp`,
                    defaultMessage: 'These filters will be restored when you click this bookmark'
                  })}
                </Typography>
              </Flex>
            </Box>

            {/* Description */}
            <Box>
              <Typography variant="pi" fontWeight="bold" style={{ marginBottom: '8px', display: 'block' }} as="label" htmlFor="description">
                {formatMessage({
                  id: `${pluginId}.form.description`,
                  defaultMessage: 'Description (Optional)'
                })}
              </Typography>
              <Textarea
                id="description"
                placeholder={formatMessage({ id: `${pluginId}.form.descriptionPlaceholder`, defaultMessage: 'Add a description...' })}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Box>
          </Box>
        </Box>

        {/* Footer */}
        <Flex justifyContent="flex-end" gap={2}>
          <Button onClick={onClose} variant="tertiary" type="button">
            {formatMessage({
              id: `${pluginId}.button.cancel`,
              defaultMessage: 'Cancel'
            })}
          </Button>
          <Button
            onClick={handleSubmit}
            loading={isSubmitting}
            type="button"
          >
            {isEditing
              ? formatMessage({
                  id: `${pluginId}.button.update`,
                  defaultMessage: 'Update'
                })
              : formatMessage({
                  id: `${pluginId}.button.save`,
                  defaultMessage: 'Save Bookmark'
                })}
          </Button>
        </Flex>
      </Box>
    </div>
  );
};

export default CreateEditModal;
