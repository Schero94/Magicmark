// @ts-nocheck
import React from 'react';
import { Typography, Loader } from '@strapi/design-system';
import { Pin, ArrowRight } from '@strapi/icons';
import { BookmarkIcon } from '@heroicons/react/24/outline';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import pluginId from '../pluginId';
import { getIconById } from './CreateEditModal';

// ================ ANIMATIONS ================
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
`;

// ================ STYLED COMPONENTS ================
const PopoverContainer = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 280px;
  max-width: 360px;
  max-height: 400px;
  background: #ffffff;
  border: 1px solid #dcdce4;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  z-index: 1000;
  animation: ${fadeIn} 0.2s ease-out;
  overflow: hidden;
`;

const PopoverHeader = styled.div`
  padding: 12px 16px;
  background: linear-gradient(135deg, #4945FF 0%, #7B79FF 100%);
  border-bottom: 1px solid #dcdce4;
  display: flex;
  align-items: center;
  gap: 8px;
  
  svg {
    width: 16px;
    height: 16px;
    color: white;
  }
`;

const PopoverTitle = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: white;
`;

const PopoverCount = styled.span`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  margin-left: auto;
`;

const BookmarksList = styled.div`
  max-height: 300px;
  overflow-y: auto;
  padding: 8px;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #c0c0cf;
    border-radius: 3px;
  }
`;

const BookmarkItem = styled.button<{ $isPinned?: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  border-radius: 6px;
  background: ${props => props.$isPinned ? '#fffbeb' : 'transparent'};
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
  
  &:hover {
    background: ${props => props.$isPinned ? '#fef3c7' : '#f6f6f9'};
    
    .arrow-icon {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  &:active {
    transform: scale(0.98);
  }
`;

const BookmarkIconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #EEF0FF 0%, #E0E7FF 100%);
  border-radius: 6px;
  flex-shrink: 0;
  
  svg {
    width: 16px;
    height: 16px;
    color: #4945FF;
  }
`;

const BookmarkContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const BookmarkName = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: #32324d;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const BookmarkDescription = styled.div`
  font-size: 11px;
  color: #8e8ea9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
`;

const ArrowIcon = styled.div`
  opacity: 0;
  transform: translateX(-4px);
  transition: all 0.15s ease;
  color: #4945FF;
  
  svg {
    width: 14px;
    height: 14px;
  }
`;

const PinIcon = styled.div`
  color: #f59e0b;
  flex-shrink: 0;
  
  svg {
    width: 12px;
    height: 12px;
  }
`;

const EmptyState = styled.div`
  padding: 24px 16px;
  text-align: center;
`;

const EmptyIcon = styled.div`
  width: 48px;
  height: 48px;
  margin: 0 auto 12px;
  background: #f6f6f9;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  
  svg {
    width: 24px;
    height: 24px;
    color: #8e8ea9;
  }
`;

const PopoverFooter = styled.div`
  padding: 10px 16px;
  border-top: 1px solid #eaeaef;
  background: #fafafa;
`;

const ViewAllLink = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #4945FF;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: #eef0ff;
  }
  
  svg {
    width: 14px;
    height: 14px;
  }
`;

interface ViewsListPopoverProps {
  views: any[];
  onViewClick: (view: any) => void;
  isLoading?: boolean;
  buttonElement?: HTMLElement;
}

/**
 * Popover component displaying list of saved bookmarks
 */
const ViewsListPopover: React.FC<ViewsListPopoverProps> = ({
  views,
  onViewClick,
  isLoading = false,
}) => {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();

  // Sort: pinned first, then by name
  const sortedViews = [...views].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <PopoverContainer>
      <PopoverHeader>
        <BookmarkIcon />
        <PopoverTitle>Your Bookmarks</PopoverTitle>
        <PopoverCount>{views.length} saved</PopoverCount>
      </PopoverHeader>

      {isLoading ? (
        <EmptyState>
          <Loader small>Loading...</Loader>
        </EmptyState>
      ) : views && views.length > 0 ? (
        <>
          <BookmarksList>
            {sortedViews.map((view) => {
              const IconComponent = getIconById(view.icon || view.emoji || 'bookmark');
              return (
                <BookmarkItem
                  key={view.id}
                  $isPinned={view.isPinned}
                  onClick={() => onViewClick(view)}
                >
                  <BookmarkIconWrapper>
                    <IconComponent />
                  </BookmarkIconWrapper>
                  <BookmarkContent>
                    <BookmarkName>{view.name}</BookmarkName>
                    {view.description && (
                      <BookmarkDescription>{view.description}</BookmarkDescription>
                    )}
                  </BookmarkContent>
                  {view.isPinned && (
                    <PinIcon>
                      <Pin />
                    </PinIcon>
                  )}
                  <ArrowIcon className="arrow-icon">
                    <ArrowRight />
                  </ArrowIcon>
                </BookmarkItem>
              );
            })}
          </BookmarksList>
          <PopoverFooter>
            <ViewAllLink onClick={() => navigate(`/plugins/${pluginId}`)}>
              <BookmarkIcon />
              Manage all bookmarks
            </ViewAllLink>
          </PopoverFooter>
        </>
      ) : (
        <EmptyState>
          <EmptyIcon>
            <BookmarkIcon />
          </EmptyIcon>
          <Typography variant="pi" textColor="neutral600">
            {formatMessage({
              id: `${pluginId}.ViewsWidget.ViewsPopover.emptyList`,
              defaultMessage: 'No bookmarks yet. Save your first view!',
            })}
          </Typography>
        </EmptyState>
      )}
    </PopoverContainer>
  );
};

export default ViewsListPopover as any;
