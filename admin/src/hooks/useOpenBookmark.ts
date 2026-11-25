/**
 * Opens a bookmark's list view inside the admin (no page reload).
 *
 * The path is checked again on the client: only Content Manager list views are opened, so a
 * stored value can never send the user to another admin page or off-site. Before navigating,
 * boolean filter values are normalised for Strapi 5.62 (see `utils/booleanFilters`), and the
 * Content Manager's remembered list settings for that content type are replaced by the
 * bookmark's own, so remembered filters do not mix into the bookmark. A bookmark with a list
 * longer than Strapi accepts (more than 100 `$in` values or `$or` conditions, which Strapi 5.63
 * answers with 400, or more than 20 `$and` conditions, which the Content Manager list cannot
 * render) is not opened: the user gets a notice that says how to fix it instead of an error.
 */
import { useNotification } from '@strapi/strapi/admin';
import { useCallback } from 'react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import type { Bookmark } from '../types';
import { createAttributeResolver, sanitizeBooleanFilters } from '../utils/booleanFilters';
import { exceedsListLimit } from '../utils/filters';
import type { InitData } from '../utils/fieldOptions';
import { parseListViewPath, syncPersistedListSettings } from '../utils/listView';
import { parseQuery, stringifyQuery } from '../utils/query';
import { msg } from '../utils/translations';
import { loadInit } from './useSchemas';

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
 * Rewrites the boolean filters of a saved query so Strapi 5.62 accepts them: "1"/"yes" become
 * "true", "0"/"no" become "false", and conditions with an empty or unreadable value are
 * dropped. Returns the query unchanged when nothing needs to change.
 * @param query - Parsed saved query.
 * @param init - Schemas from /content-manager/init.
 * @param uid - Content type uid of the list view.
 * @returns The query to open.
 */
export const normalizeSavedQuery = (
  query: Record<string, unknown>,
  init: InitData,
  uid: string
): Record<string, unknown> => {
  if (query.filters === undefined) return query;
  const result = sanitizeBooleanFilters(query.filters, createAttributeResolver(init, uid));
  if (!result.normalized && !result.dropped) return query;
  const next: Record<string, unknown> = { ...query };
  if (result.filters === undefined) delete next.filters;
  else next.filters = result.filters;
  return next;
};

/**
 * @returns `open(bookmark)`.
 */
export const useOpenBookmark = () => {
  const navigate = useNavigate();
  const { toggleNotification } = useNotification();
  const { formatMessage } = useIntl();

  return useCallback(
    async (bookmark: Pick<Bookmark, 'path' | 'query'>) => {
      const location = parseListViewPath(bookmark.path);
      if (!location) {
        toggleNotification({
          type: 'danger',
          message: formatMessage(
            msg('notification.invalidPath', 'This bookmark does not point to a list view.')
          ),
        });
        return;
      }
      const parsed = parseQuery(bookmark.query);
      if (exceedsListLimit(parsed)) {
        toggleNotification({
          type: 'warning',
          timeout: 15000,
          message: formatMessage(
            msg(
              'notification.listTooLong',
              'This bookmark was not opened: its filters have more values or conditions than Strapi accepts. Open the list, narrow the filters, then save the current view in this bookmark.'
            )
          ),
        });
        return;
      }
      let saved = parsed;
      try {
        saved = normalizeSavedQuery(parsed, await loadInit(), location.uid);
      } catch {
        // Schemas unavailable: open the bookmark as it was saved.
      }
      const search = saved === parsed ? (bookmark.query ?? '') : stringifyQuery(saved);
      try {
        syncPersistedListSettings(window.localStorage, location.uid, saved);
      } catch {
        // Storage can be unavailable (private mode, blocked site data); the URL still applies.
      }
      navigate({ pathname: location.path, search: search ? `?${search}` : '' });
    },
    [navigate, toggleNotification, formatMessage]
  );
};
