/**
 * Helpers for Content Manager list view locations. Pure, so `node --test` can run them.
 *
 * Paths are router paths (relative to the admin base URL, which react-router strips), e.g.
 * `/content-manager/collection-types/api::article.article`. This keeps bookmarks working
 * when the admin is served under a custom `admin.url` such as `/dashboard`.
 */

const LIST_VIEW_PATH =
  /^\/content-manager\/(collection-types|single-types)\/((?:api|plugin)::[a-z0-9_-]{1,80}\.[a-z0-9_-]{1,80})\/?$/;

/** Query keys a bookmark stores. `page` is left out so a bookmark always opens on page 1. */
export const SAVED_QUERY_KEYS = ['filters', 'sort', 'pageSize', '_q', 'plugins'] as const;

/** List view settings the Content Manager persists in localStorage per content type. */
export const PERSISTED_KEYS = ['sort', 'filters', 'pageSize'] as const;

export interface ListViewLocation {
  kind: 'collection-types' | 'single-types';
  uid: string;
  path: string;
}

/**
 * Parses a router pathname into a list view location.
 * @param pathname - e.g. from `useLocation().pathname`.
 * @returns The location, or null for anything that is not a list view (edit views included).
 */
export const parseListViewPath = (pathname: string | null | undefined): ListViewLocation | null => {
  if (typeof pathname !== 'string') return null;
  const match = LIST_VIEW_PATH.exec(pathname);
  if (!match) return null;
  return {
    kind: match[1] as ListViewLocation['kind'],
    uid: match[2],
    path: `/content-manager/${match[1]}/${match[2]}`,
  };
};

/**
 * Keeps only the keys a bookmark stores, and only the i18n locale inside `plugins`.
 * @param query - Parsed query object (from `useQueryParams`).
 * @returns The subset to save.
 */
export const pickSavedQuery = (query: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const key of SAVED_QUERY_KEYS) {
    const value = query[key];
    if (value === undefined || value === '') continue;
    if (key === 'plugins') {
      const locale = (value as { i18n?: { locale?: unknown } })?.i18n?.locale;
      if (typeof locale === 'string') out.plugins = { i18n: { locale } };
      continue;
    }
    out[key] = value;
  }
  return out;
};

/**
 * Writes a bookmark's list settings into the Content Manager's persisted settings for its
 * content type, or removes them when the bookmark has none. Without this the Content Manager
 * merges filters remembered from an earlier visit into the bookmark's view.
 *
 * Keys are `STRAPI_LIST_VIEW_SETTINGS:<uid>` plus an optional `:<instance-uuid>` scope; every
 * existing key for the uid is updated, so the scope does not need to be known.
 * @param storage - `window.localStorage` (or a fake in tests).
 * @param uid - Content type uid.
 * @param saved - Parsed bookmark query.
 */
export const syncPersistedListSettings = (
  storage: Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>,
  uid: string,
  saved: Record<string, unknown>
): void => {
  const prefix = `STRAPI_LIST_VIEW_SETTINGS:${uid}`;
  const value: Record<string, unknown> = {};
  for (const key of PERSISTED_KEYS) {
    if (saved[key] !== undefined) value[key] = saved[key];
  }
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && (key === prefix || key.startsWith(`${prefix}:`))) keys.push(key);
  }
  for (const key of keys) {
    if (Object.keys(value).length) storage.setItem(key, JSON.stringify(value));
    else storage.removeItem(key);
  }
};
