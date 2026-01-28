// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import {
  Box,
  Button,
  Flex,
  TextInput,
  Textarea,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Typography,
  Stack,
} from '@strapi/design-system';
import styled from 'styled-components';
import { BOOKMARK_ICONS, getIconById } from './CreateEditModal';

// ================ STYLED COMPONENTS ================
const IconPicker = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 8px;
  padding: 12px;
  background: #f6f6f9;
  border-radius: 6px;
  max-height: 200px;
  overflow-y: auto;
  margin-top: 12px;
`;

const IconButton = styled.button<{ $isSelected?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border: 2px solid ${props => props.$isSelected ? '#4945FF' : '#dcdce4'};
  background: ${props => props.$isSelected ? '#EEF0FF' : '#ffffff'};
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  
  svg {
    width: 20px;
    height: 20px;
    color: ${props => props.$isSelected ? '#4945FF' : '#32324d'};
  }
  
  &:hover {
    border-color: #4945FF;
    background: #EEF0FF;
    
    svg {
      color: #4945FF;
    }
  }
`;

const SelectedIconPreview = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border: 2px solid #4945FF;
  background: linear-gradient(135deg, #EEF0FF 0%, #E0E7FF 100%);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  
  svg {
    width: 24px;
    height: 24px;
    color: #4945FF;
  }
  
  &:hover {
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(73, 69, 255, 0.2);
  }
`;

interface CreateEditModalProps {
  bookmark: any | null;
  onClose: () => void;
  onSuccess: () => void;
  pluginId: string;
}

const CreateEditModal: React.FC<CreateEditModalProps> = ({
  bookmark,
  onClose,
  onSuccess,
  pluginId,
}) => {
  const { formatMessage } = useIntl();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState('bookmark');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (bookmark) {
      setName(bookmark.name);
      setUrl(bookmark.url);
      setIcon(bookmark.icon || bookmark.emoji || 'bookmark');
      setDescription(bookmark.description || '');
    }
  }, [bookmark]);

  const validateForm = () => {
    setError('');
    if (!name.trim()) {
      setError(formatMessage({
        id: `${pluginId}.error.nameRequired`,
        defaultMessage: 'Name is required'
      }));
      return false;
    }
    if (!url.trim()) {
      setError(formatMessage({
        id: `${pluginId}.error.urlRequired`,
        defaultMessage: 'URL is required'
      }));
      return false;
    }
    try {
      new URL(url);
    } catch {
      setError(formatMessage({
        id: `${pluginId}.error.invalidUrl`,
        defaultMessage: 'Please enter a valid URL (e.g., https://example.com)'
      }));
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const method = bookmark ? 'PUT' : 'POST';
      const endpoint = bookmark
        ? `/admin/plugins/${pluginId}/bookmarks/${bookmark.id}`
        : `/admin/plugins/${pluginId}/bookmarks`;

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          url,
          icon,
          emoji: icon, // Backwards compatibility
          description,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save bookmark');
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving bookmark:', error);
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
    <Modal onClose={onClose} size="M">
      <ModalHeader>
        <Typography as="h2" id="title" variant="beta">
          {isEditing
            ? formatMessage({
                id: `${pluginId}.modal.edit`,
                defaultMessage: 'Edit Bookmark'
              })
            : formatMessage({
                id: `${pluginId}.modal.create`,
                defaultMessage: 'Create New Bookmark'
              })}
        </Typography>
      </ModalHeader>
      <ModalBody>
        <Stack spacing={4}>
          {error && (
            <Box padding={3} background="danger100" borderRadius="4px">
              <Typography textColor="danger600">{error}</Typography>
            </Box>
          )}

          {/* Icon Selector */}
          <Box>
            <Typography variant="pi" fontWeight="bold" marginBottom={2}>
              {formatMessage({
                id: `${pluginId}.form.icon`,
                defaultMessage: 'Choose Icon'
              })}
            </Typography>
            <Flex gap={3} alignItems="center">
              <SelectedIconPreview
                onClick={() => setShowIconPicker(!showIconPicker)}
                title="Click to change icon"
              >
                {(() => {
                  const IconComponent = getIconById(icon);
                  return <IconComponent />;
                })()}
              </SelectedIconPreview>
              <Typography variant="pi" textColor="neutral600">
                {formatMessage({
                  id: `${pluginId}.form.selectIcon`,
                  defaultMessage: 'Click to select an icon'
                })}
              </Typography>
            </Flex>
            {showIconPicker && (
              <IconPicker>
                {BOOKMARK_ICONS.map((item) => {
                  const IconComp = item.icon;
                  return (
                    <IconButton
                      key={item.id}
                      $isSelected={icon === item.id}
                      onClick={() => {
                        setIcon(item.id);
                        setShowIconPicker(false);
                      }}
                      title={item.label}
                    >
                      <IconComp />
                    </IconButton>
                  );
                })}
              </IconPicker>
            )}
          </Box>

          {/* Name */}
          <Box>
            <Typography variant="pi" fontWeight="bold" as="label" htmlFor="name" marginBottom={2}>
              {formatMessage({
                id: `${pluginId}.form.name`,
                defaultMessage: 'Bookmark Name'
              })} *
            </Typography>
            <TextInput
              id="name"
              type="text"
              placeholder="e.g., Google Search"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Box>

          {/* URL */}
          <Box>
            <Typography variant="pi" fontWeight="bold" as="label" htmlFor="url" marginBottom={2}>
              {formatMessage({
                id: `${pluginId}.form.url`,
                defaultMessage: 'URL'
              })} *
            </Typography>
            <TextInput
              id="url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Typography variant="pi" textColor="neutral600" marginTop={1}>
              {formatMessage({
                id: `${pluginId}.form.urlHelp`,
                defaultMessage: 'Enter the full URL with https://'
              })}
            </Typography>
          </Box>

          {/* Description */}
          <Box>
            <Typography variant="pi" fontWeight="bold" as="label" htmlFor="description" marginBottom={2}>
              {formatMessage({
                id: `${pluginId}.form.description`,
                defaultMessage: 'Description (Optional)'
              })}
            </Typography>
            <Textarea
              id="description"
              placeholder="Add a description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Box>
        </Stack>
      </ModalBody>
      <ModalFooter
        startActions={
          <Button onClick={onClose} variant="tertiary">
            {formatMessage({
              id: `${pluginId}.button.cancel`,
              defaultMessage: 'Cancel'
            })}
          </Button>
        }
        endActions={
          <Button
            onClick={handleSubmit}
            loading={isSubmitting}
          >
            {isEditing
              ? formatMessage({
                  id: `${pluginId}.button.update`,
                  defaultMessage: 'Update'
                })
              : formatMessage({
                  id: `${pluginId}.button.create`,
                  defaultMessage: 'Create'
                })}
          </Button>
        }
      />
    </Modal>
  );
};

export default CreateEditModal;
