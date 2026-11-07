/**
 * Homepage widget: the user's pinned bookmarks (up to 5) as links.
 */
import { Box, Flex, Link, Typography } from '@strapi/design-system';
import { Widget } from '@strapi/strapi/admin';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { NavLink } from 'react-router-dom';
import { useBookmarksApi } from '../hooks/useBookmarksApi';
import { bookmarkLocation, useOpenBookmark } from '../hooks/useOpenBookmark';
import { useContentTypeNames } from '../hooks/useSchemas';
import type { Bookmark } from '../types';
import { getIcon } from '../utils/icons';
import { msg } from '../utils/translations';

const PinnedBookmarksWidget = () => {
  const { formatMessage } = useIntl();
  const api = useBookmarksApi();
  const openBookmark = useOpenBookmark();
  const { names } = useContentTypeNames();
  const [items, setItems] = useState<Bookmark[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api
      .list({ scope: 'pinned', pageSize: 5, sort: 'name:asc' }, controller.signal)
      .then((result) => setItems(result.data))
      .catch(() => !controller.signal.aborted && setFailed(true));
    return () => controller.abort();
  }, [api]);

  if (failed) {
    return (
      <Widget.Error>
        {formatMessage(msg('widget.error', 'Pinned bookmarks could not be loaded.'))}
      </Widget.Error>
    );
  }
  if (!items) return <Widget.Loading />;
  if (!items.length) {
    return (
      <Widget.NoData>
        {formatMessage(msg('widget.empty', 'Pin bookmarks to see them here.'))}
      </Widget.NoData>
    );
  }

  return (
    <Flex direction="column" alignItems="stretch" gap={3} tag="ul">
      {items.map((bookmark) => {
        const Icon = getIcon(bookmark.icon);
        const target = bookmarkLocation(bookmark);
        return (
          <Flex key={bookmark.documentId} tag="li" gap={3} alignItems="flex-start" minWidth={0}>
            <Box paddingTop={1} color="neutral600">
              <Icon aria-hidden />
            </Box>
            <Flex direction="column" alignItems="flex-start" minWidth={0}>
              {target ? (
                <Link
                  tag={NavLink}
                  to={target}
                  onClick={(event: React.MouseEvent) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
                      return;
                    event.preventDefault();
                    openBookmark(bookmark);
                  }}
                >
                  {bookmark.name}
                </Link>
              ) : (
                <Typography>{bookmark.name}</Typography>
              )}
              <Typography variant="pi" textColor="neutral600">
                {bookmark.contentType
                  ? (names.get(bookmark.contentType) ?? bookmark.contentType)
                  : ''}
              </Typography>
            </Flex>
          </Flex>
        );
      })}
    </Flex>
  );
};

export default PinnedBookmarksWidget;
