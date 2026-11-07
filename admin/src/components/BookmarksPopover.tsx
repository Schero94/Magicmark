/**
 * Bookmarks of the current content type in a Design System popover, opened from the list
 * view toolbar. Loads when it opens; pinned bookmarks first.
 */
import {
  Box,
  Button,
  Divider,
  Flex,
  IconButton,
  Link,
  Loader,
  Popover,
  TextButton,
  Typography,
} from '@strapi/design-system';
import { ArrowClockwise, Pin, Plus, Star } from '@strapi/icons';
import { useNotification, useQueryParams } from '@strapi/strapi/admin';
import { useCallback, useState } from 'react';
import { useIntl } from 'react-intl';
import { NavLink } from 'react-router-dom';
import { useBookmarksApi } from '../hooks/useBookmarksApi';
import { bookmarkLocation, useOpenBookmark } from '../hooks/useOpenBookmark';
import { useContentTypeNames } from '../hooks/useSchemas';
import pluginId from '../pluginId';
import type { Bookmark } from '../types';
import { getIcon } from '../utils/icons';
import { type ListViewLocation, pickSavedQuery } from '../utils/listView';
import { stringifyQuery } from '../utils/query';
import { msg } from '../utils/translations';
import { BookmarkFormModal, type CapturedView } from './BookmarkFormModal';

interface BookmarksPopoverProps {
  listView: ListViewLocation;
  canCreate: boolean;
  canUpdate: boolean;
  canShare: boolean;
}

/** Pinned first, then by name. */
const sortBookmarks = (list: Bookmark[]) =>
  [...list].sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || a.name.localeCompare(b.name));

/**
 * @param props - Current list view and the user's permissions.
 */
export const BookmarksPopover = ({
  listView,
  canCreate,
  canUpdate,
  canShare,
}: BookmarksPopoverProps) => {
  const { formatMessage } = useIntl();
  const { toggleNotification } = useNotification();
  const api = useBookmarksApi();
  const openBookmark = useOpenBookmark();
  const [{ query }] = useQueryParams<Record<string, unknown>>();
  const { names } = useContentTypeNames();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Bookmark[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [captured, setCaptured] = useState<CapturedView | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const result = await api.list({ contentType: listView.uid, pageSize: 100, sort: 'name:asc' });
      setItems(sortBookmarks(result.data));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [api, listView.uid]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) load();
  };

  const currentQuery = stringifyQuery(pickSavedQuery(query));
  const contentTypeName = names.get(listView.uid) ?? listView.uid;

  const saveView = () => {
    setOpen(false);
    setCaptured({
      path: listView.path,
      query: currentQuery,
      contentType: listView.uid,
      contentTypeName,
    });
  };

  const togglePin = async (bookmark: Bookmark) => {
    setBusyId(bookmark.documentId);
    try {
      await api.pin(bookmark.documentId, !bookmark.isPinned);
      setItems((prev) =>
        sortBookmarks(
          prev.map((b) =>
            b.documentId === bookmark.documentId ? { ...b, isPinned: !b.isPinned } : b
          )
        )
      );
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage(msg('notification.pinError', 'The bookmark could not be pinned.')),
      });
    } finally {
      setBusyId(null);
    }
  };

  const updateView = async (bookmark: Bookmark) => {
    setBusyId(bookmark.documentId);
    try {
      const updated = await api.updateView(bookmark.documentId, currentQuery);
      setItems((prev) =>
        prev.map((b) => (b.documentId === updated.documentId ? { ...b, ...updated } : b))
      );
      toggleNotification({
        type: 'success',
        message: formatMessage(
          msg('notification.viewUpdated', '"{name}" now saves the current view.'),
          {
            name: bookmark.name,
          }
        ),
      });
    } catch {
      toggleNotification({
        type: 'danger',
        message: formatMessage(
          msg('notification.viewUpdateError', 'The bookmark could not be updated.')
        ),
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Popover.Root open={open} onOpenChange={handleOpenChange}>
        <Popover.Trigger>
          <IconButton label={formatMessage(msg('popover.trigger', 'Bookmarks'))}>
            <Star />
          </IconButton>
        </Popover.Trigger>
        <Popover.Content side="bottom" align="end" sideOffset={4}>
          <Box
            width="32rem"
            maxWidth="calc(100vw - 32px)"
            maxHeight="var(--radix-popover-content-available-height)"
            overflow="auto"
            padding={3}
          >
            <Flex direction="column" alignItems="stretch" gap={3}>
              <Flex justifyContent="space-between" gap={2}>
                <Typography variant="sigma" textColor="neutral600" tag="h2">
                  {formatMessage(msg('popover.title', 'Bookmarks for {name}'), {
                    name: contentTypeName,
                  })}
                </Typography>
                {canCreate ? (
                  <Button size="S" variant="secondary" startIcon={<Plus />} onClick={saveView}>
                    {formatMessage(msg('popover.save', 'Save view'))}
                  </Button>
                ) : null}
              </Flex>
              <Divider />

              {status === 'loading' ? (
                <Flex justifyContent="center" padding={4}>
                  <Loader small>{formatMessage(msg('state.loading', 'Loading'))}</Loader>
                </Flex>
              ) : null}

              {status === 'error' ? (
                <Flex direction="column" alignItems="flex-start" gap={2}>
                  <Typography variant="pi" textColor="danger600">
                    {formatMessage(msg('popover.error', 'Bookmarks could not be loaded.'))}
                  </Typography>
                  <TextButton startIcon={<ArrowClockwise />} onClick={load}>
                    {formatMessage(msg('state.retry', 'Try again'))}
                  </TextButton>
                </Flex>
              ) : null}

              {status === 'ready' && items.length === 0 ? (
                <Typography variant="pi" textColor="neutral600">
                  {canCreate
                    ? formatMessage(
                        msg(
                          'popover.empty',
                          'No bookmarks for this content type yet. Filter the list, then choose Save view.'
                        )
                      )
                    : formatMessage(
                        msg('popover.emptyReadOnly', 'No bookmarks for this content type yet.')
                      )}
                </Typography>
              ) : null}

              {status === 'ready' && items.length > 0 ? (
                <Box maxHeight="40rem" overflow="auto">
                  <Flex direction="column" alignItems="stretch" gap={1} tag="ul">
                    {items.map((bookmark) => {
                      const Icon = getIcon(bookmark.icon);
                      const target = bookmarkLocation(bookmark);
                      const isCurrent = bookmark.query === currentQuery;
                      return (
                        <Flex
                          key={bookmark.documentId}
                          tag="li"
                          gap={2}
                          alignItems="center"
                          paddingTop={1}
                          paddingBottom={1}
                        >
                          <Flex gap={2} alignItems="flex-start" flex={1} minWidth={0}>
                            <Box paddingTop={1} color="neutral600">
                              <Icon aria-hidden />
                            </Box>
                            <Flex direction="column" alignItems="flex-start" minWidth={0}>
                              {target ? (
                                <Link
                                  tag={NavLink}
                                  to={target}
                                  onClick={(event: React.MouseEvent) => {
                                    if (
                                      event.metaKey ||
                                      event.ctrlKey ||
                                      event.shiftKey ||
                                      event.button !== 0
                                    )
                                      return;
                                    event.preventDefault();
                                    setOpen(false);
                                    openBookmark(bookmark);
                                  }}
                                  aria-current={isCurrent ? 'page' : undefined}
                                >
                                  {bookmark.name}
                                </Link>
                              ) : (
                                <Typography>{bookmark.name}</Typography>
                              )}
                              {bookmark.description ? (
                                <Typography
                                  variant="pi"
                                  textColor="neutral600"
                                  ellipsis
                                  title={bookmark.description}
                                >
                                  {bookmark.description}
                                </Typography>
                              ) : null}
                            </Flex>
                          </Flex>
                          {canUpdate && bookmark.canEdit && !isCurrent ? (
                            <IconButton
                              label={formatMessage(
                                msg('actions.updateViewNamed', 'Save the current view in {name}'),
                                {
                                  name: bookmark.name,
                                }
                              )}
                              variant="ghost"
                              disabled={busyId === bookmark.documentId}
                              onClick={() => updateView(bookmark)}
                            >
                              <ArrowClockwise />
                            </IconButton>
                          ) : null}
                          <IconButton
                            label={formatMessage(
                              bookmark.isPinned
                                ? msg('actions.unpinNamed', 'Unpin {name}')
                                : msg('actions.pinNamed', 'Pin {name}'),
                              { name: bookmark.name }
                            )}
                            variant={bookmark.isPinned ? 'secondary' : 'ghost'}
                            disabled={busyId === bookmark.documentId}
                            onClick={() => togglePin(bookmark)}
                            aria-pressed={bookmark.isPinned}
                          >
                            <Pin />
                          </IconButton>
                        </Flex>
                      );
                    })}
                  </Flex>
                </Box>
              ) : null}

              <Divider />
              <Link tag={NavLink} to={`/plugins/${pluginId}`} onClick={() => setOpen(false)}>
                {formatMessage(msg('popover.manage', 'Manage bookmarks'))}
              </Link>
            </Flex>
          </Box>
        </Popover.Content>
      </Popover.Root>

      {captured ? (
        <BookmarkFormModal
          open={!!captured}
          onOpenChange={(next) => !next && setCaptured(null)}
          view={captured}
          canShare={canShare}
          onSaved={() => setCaptured(null)}
        />
      ) : null}
    </>
  );
};
