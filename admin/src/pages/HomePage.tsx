// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import {
  Box,
  Button,
  Flex,
  Table,
  Thead,
  Tbody,
  Tr,
  Td,
  Th,
  Typography,
  VisuallyHidden,
  Loader,
} from '@strapi/design-system';
import { Trash, Pencil, Pin } from '@strapi/icons';
import { useFetchClient } from '@strapi/strapi/admin';
import pluginId from '../pluginId';
import CreateEditModal, { getIconById } from '../components/CreateEditModal';
import FilterPreview from '../components/FilterPreview';
import styled from 'styled-components';

const BookmarkRow = styled(Tr)`
  &:hover {
    background-color: ${props => props.theme.colors.primary100};
  }
`;

const IconCell = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #EEF0FF 0%, #E0E7FF 100%);
  border-radius: 6px;
  
  svg {
    width: 18px;
    height: 18px;
    color: #4945FF;
  }
`;

const PinIcon = styled(Pin)<{ isPinned?: boolean }>`
  color: ${props => props.isPinned ? props.theme.colors.primary600 : props.theme.colors.neutral500};
`;

interface Bookmark {
  id: string;
  name: string;
  path: string;
  query: string;
  icon?: string;
  emoji?: string;
  description?: string;
  isPinned: boolean;
  order: number;
}

const HomePage: React.FC = () => {
  const { formatMessage } = useIntl();
  const { get, post, del } = useFetchClient();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const fetchBookmarks = async () => {
    setLoading(true);
    try {
      const { data } = await get(`/${pluginId}/bookmarks`);
      console.log('[Magic-Mark HomePage] Bookmarks loaded:', data);
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
    setEditingBookmark(null);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingBookmark(null);
  };

  const handleModalSuccess = () => {
    fetchBookmarks();
    handleModalClose();
  };

  const pinnedCount = bookmarks.filter(b => b.isPinned).length;
  const unpinnedCount = bookmarks.filter(b => !b.isPinned).length;

  return (
    <Box padding={8} background="neutral0">
      {/* Header */}
      <Box marginBottom={6}>
        <Flex justifyContent="space-between" alignItems="center">
          <Box>
            <Typography as="h1" variant="alpha" textColor="neutral800">
              {formatMessage({
                id: `${pluginId}.title`,
                defaultMessage: '🔖 MagicMark'
              })}
            </Typography>
            <Typography variant="omega" textColor="neutral600" marginTop={2}>
              {formatMessage({
                id: `${pluginId}.subtitle`,
                defaultMessage: 'Manage your bookmarks and quick links'
              })}
            </Typography>
          </Box>
          <Button onClick={handleCreate} variant="default">
            {formatMessage({
              id: `${pluginId}.button.create`,
              defaultMessage: '+ Add Bookmark'
            })}
          </Button>
        </Flex>
      </Box>

      {/* Stats */}
      <Box marginBottom={6} padding={4} background="neutral100" borderRadius="4px">
        <Flex gap={4}>
          <Box>
            <Typography variant="pi" textColor="neutral600">
              {formatMessage({
                id: `${pluginId}.stats.pinned`,
                defaultMessage: 'Pinned'
              })}
            </Typography>
            <Typography as="h2" variant="alpha" textColor="neutral800" marginTop={1}>
              {pinnedCount}
            </Typography>
          </Box>
          <Box>
            <Typography variant="pi" textColor="neutral600">
              {formatMessage({
                id: `${pluginId}.stats.total`,
                defaultMessage: 'Total'
              })}
            </Typography>
            <Typography as="h2" variant="alpha" textColor="neutral800" marginTop={1}>
              {bookmarks.length}
            </Typography>
          </Box>
        </Flex>
      </Box>

      {/* Bookmarks Table */}
      {loading ? (
        <Flex justifyContent="center" padding={8}>
          <Loader>
            {formatMessage({
              id: `${pluginId}.loading`,
              defaultMessage: 'Loading bookmarks...'
            })}
          </Loader>
        </Flex>
      ) : bookmarks.length === 0 ? (
        <Box padding={8} textAlign="center" background="neutral100" borderRadius="4px">
          <Typography variant="beta" textColor="neutral600">
            {formatMessage({
              id: `${pluginId}.empty`,
              defaultMessage: 'No bookmarks yet. Create your first one!'
            })}
          </Typography>
        </Box>
      ) : (
        <Box background="neutral0" borderRadius="4px" overflow="hidden">
          <Table colCount={6} rowCount={bookmarks.length + 1}>
            <Thead>
              <Tr>
                <Th width="8%">
                  <VisuallyHidden>
                    {formatMessage({
                      id: `${pluginId}.table.icon`,
                      defaultMessage: 'Icon'
                    })}
                  </VisuallyHidden>
                </Th>
                <Th width="25%">
                  <Typography variant="sigma">
                    {formatMessage({
                      id: `${pluginId}.table.name`,
                      defaultMessage: 'Name'
                    })}
                  </Typography>
                </Th>
                <Th width="35%">
                  <Typography variant="sigma">
                    {formatMessage({
                      id: `${pluginId}.table.filters`,
                      defaultMessage: 'Filters'
                    })}
                  </Typography>
                </Th>
                <Th width="20%">
                  <Typography variant="sigma">
                    {formatMessage({
                      id: `${pluginId}.table.description`,
                      defaultMessage: 'Description'
                    })}
                  </Typography>
                </Th>
                <Th width="8%">
                  <VisuallyHidden>
                    {formatMessage({
                      id: `${pluginId}.table.status`,
                      defaultMessage: 'Status'
                    })}
                  </VisuallyHidden>
                </Th>
                <Th width="8%">
                  <VisuallyHidden>
                    {formatMessage({
                      id: `${pluginId}.table.actions`,
                      defaultMessage: 'Actions'
                    })}
                  </VisuallyHidden>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {bookmarks.map((bookmark) => {
                const IconComponent = getIconById(bookmark.icon || bookmark.emoji || 'bookmark');
                return (
                <BookmarkRow key={bookmark.id}>
                  <Td>
                    <IconCell>
                      <IconComponent />
                    </IconCell>
                  </Td>
                  <Td>
                    <Typography fontWeight="bold" textColor="neutral800">{bookmark.name}</Typography>
                  </Td>
                  <Td>
                    <FilterPreview query={bookmark.query} />
                  </Td>
                  <Td>
                    <Typography variant="pi" textColor="neutral600">
                      {bookmark.description || '-'}
                    </Typography>
                  </Td>
                  <Td>
                    <Button
                      onClick={() => handlePin(bookmark)}
                      variant="ghost"
                      size="S"
                    >
                      <PinIcon isPinned={bookmark.isPinned} />
                    </Button>
                  </Td>
                  <Td>
                    <Flex gap={2} justifyContent="flex-end">
                      <Button
                        onClick={() => handleEdit(bookmark)}
                        variant="ghost"
                        size="S"
                      >
                        <Pencil />
                      </Button>
                      <Button
                        onClick={() => handleDelete(bookmark.id)}
                        variant="ghost"
                        size="S"
                      >
                        <Trash />
                      </Button>
                    </Flex>
                  </Td>
                </BookmarkRow>
              );
              })}
            </Tbody>
          </Table>
        </Box>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <CreateEditModal
          bookmark={editingBookmark}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          pluginId={pluginId}
        />
      )}
    </Box>
  );
};

export default HomePage;
