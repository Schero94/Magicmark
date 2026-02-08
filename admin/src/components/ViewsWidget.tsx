import React, { useRef } from 'react';
import { Plus } from '@strapi/icons';
import { BookmarkIcon } from '@heroicons/react/24/outline';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { useFetchClient } from '@strapi/strapi/admin';
import styled from 'styled-components';

import ViewsListPopover from './ViewsListPopover';
import CreateEditModal from './CreateEditModal';
import pluginId from '../pluginId';

// ================ STYLED COMPONENTS ================
const WidgetContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 8px;
`;

const ActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 4px;
  background: ${(p) => p.theme.colors.neutral0};
  color: ${(p) => p.theme.colors.neutral800};
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  
  &:hover {
    background: ${(p) => p.theme.colors.neutral100};
    border-color: rgba(128, 128, 128, 0.3);
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
`;

const MagicMarkButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 4px;
  background: ${(p) => p.theme.colors.neutral0};
  color: ${(p) => p.theme.colors.neutral800};
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
  
  &:hover {
    background: ${(p) => p.theme.colors.neutral100};
    border-color: rgba(128, 128, 128, 0.3);
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    color: ${(p) => p.theme.colors.neutral600};
  }
`;

const MagicMarkWrapper = styled.div`
  position: relative;
`;

const Badge = styled.span`
  position: absolute;
  top: -6px;
  right: -6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: 10px;
  font-weight: 700;
  background: #4945FF;
  color: #ffffff;
  border-radius: 9px;
  border: 2px solid #ffffff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
`;

interface ViewsWidgetProps {
  privateViews?: any[];
  onCreateView?: () => void;
  onShowViews?: () => void;
}

/**
 * Widget for saving and accessing bookmarks in the Content Manager
 */
const ViewsWidget: React.FC<ViewsWidgetProps> = () => {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const { get } = useFetchClient();
  const viewsButtonRef = useRef<HTMLButtonElement | null>(null);
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [viewsPopoverVisible, setViewsPopoverVisible] = React.useState(false);
  const [bookmarks, setBookmarks] = React.useState<any[]>([]);
  const [isLoadingViews, setIsLoadingViews] = React.useState(false);
  const [currentPath, setCurrentPath] = React.useState('');
  const [currentQuery, setCurrentQuery] = React.useState('');

  /**
   * Fetches all bookmarks from the API
   */
  const getBookmarks = async () => {
    setIsLoadingViews(true);
    const url = `/magic-mark/bookmarks`;
    
    try {
      const { data } = await get(url);
      setBookmarks(data.data || []);
    } catch (error) {
      console.error('[Magic-Mark] Error fetching bookmarks:', error);
      setBookmarks([]);
    } finally {
      setIsLoadingViews(false);
    }
  };

  /**
   * Opens the create bookmark modal with current path/query
   */
  const handleOpenModal = () => {
    let path = window.location.pathname;
    
    if (path.startsWith('/admin/')) {
      path = path.substring(6);
    }
    
    const query = window.location.search.substring(1);
    
    setCurrentPath(path);
    setCurrentQuery(query);
    setShowCreateModal(true);
  };

  React.useEffect(() => {
    getBookmarks();
  }, [showCreateModal]);

  /**
   * Navigates to the selected bookmark
   */
  const handleBookmarkClick = (bookmark: any) => {
    if (bookmark.path && bookmark.query) {
      navigate(`${bookmark.path}?${bookmark.query}`);
    } else if (bookmark.path) {
      navigate(bookmark.path);
    }
    setViewsPopoverVisible(false);
  };

  return (
    <WidgetContainer>
      {/* Save Bookmark Button */}
      <ActionButton
        onClick={handleOpenModal}
        title={formatMessage({
          id: `${pluginId}.ViewsWidget.actions.create`,
          defaultMessage: 'Save current view as bookmark',
        })}
      >
        <Plus />
        Save
      </ActionButton>

      {/* MagicMark Button */}
      <MagicMarkWrapper>
        <MagicMarkButton
          ref={viewsButtonRef}
          onClick={() => setViewsPopoverVisible((s) => !s)}
          title="MagicMark Bookmarks"
        >
          <BookmarkIcon />
        </MagicMarkButton>
        {bookmarks.length > 0 && <Badge>{bookmarks.length}</Badge>}

        {viewsPopoverVisible && viewsButtonRef.current && (
          <ViewsListPopover
            views={bookmarks}
            onViewClick={handleBookmarkClick}
            isLoading={isLoadingViews}
            buttonElement={viewsButtonRef.current}
          />
        )}
      </MagicMarkWrapper>

      {showCreateModal && (
        <CreateEditModal
          bookmark={null}
          pluginId={pluginId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            getBookmarks();
          }}
          currentPath={currentPath}
          currentQuery={currentQuery}
        />
      )}
    </WidgetContainer>
  );
};

export default ViewsWidget;
