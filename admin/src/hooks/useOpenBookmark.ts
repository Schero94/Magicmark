/**
 * Opens a bookmark's list view inside the admin (no page reload).
 *
 * The path is checked again on the client: only Content Manager list views are opened, so a
 * stored value can never send the user to another admin page or off-site. Before navigating,
 * the Content Manager's remembered list settings for that content type are replaced by the
 * bookmark's own, so remembered filters do not mix into the bookmark.
 */
import { useNotification } from '@strapi/strapi/admin';
import { useCallback } from 'react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import type { Bookmark } from '../types';
import { parseListViewPath, syncPersistedListSettings } from '../utils/listView';
import { parseQuery } from '../utils/query';
import { msg } from '../utils/translations';

/**
 * Builds the router location of a bookmark, or null when its path is not a list view.
 * @param bookmark - Bookmark with `path` and `query`.
 */
export const bookmarkLocation = (bookmark: Pick<Bookmark, 'path' | 'query'>) => {
  const location = parseListViewPath(bookmark.path);
  if (!location) return null;
  return { pathname: location.path, search: bookmark.query ? `?${bookmark.query}` : '' };
};

/**
 * @returns `open(bookmark)`.
 */
export const useOpenBookmark = () => {
  const navigate = useNavigate();
  const { toggleNotification } = useNotification();
  const { formatMessage } = useIntl();

  return useCallback(
    (bookmark: Pick<Bookmark, 'path' | 'query'>) => {
      const target = bookmarkLocation(bookmark);
      const location = parseListViewPath(bookmark.path);
      if (!target || !location) {
        toggleNotification({
          type: 'danger',
          message: formatMessage(
            msg('notification.invalidPath', 'This bookmark does not point to a list view.')
          ),
        });
        return;
      }
      try {
        syncPersistedListSettings(window.localStorage, location.uid, parseQuery(bookmark.query));
      } catch {
        // Storage can be unavailable (private mode, blocked site data); the URL still applies.
      }
      navigate(target);
    },
    [navigate, toggleNotification, formatMessage]
  );
};
