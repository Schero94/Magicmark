/**
 * Safe query string parsing for saved list views. qs is configured so that keys such as
 * `filters[$__proto__]` can never reach Object.prototype.
 */
import qs from 'qs';

export const QS_PARSE_OPTIONS = {
  allowPrototypes: false,
  plainObjects: true,
  depth: 8,
  parameterLimit: 500,
  arrayLimit: 100,
} as const;

/**
 * Parses a saved query string (with or without "?").
 * @param query - Query string.
 * @returns Parsed object with a null prototype.
 */
export const parseQuery = (query: string | null | undefined): Record<string, unknown> => {
  if (!query) return {};
  return qs.parse(query.startsWith('?') ? query.slice(1) : query, QS_PARSE_OPTIONS) as Record<
    string,
    unknown
  >;
};

/**
 * Serialises a query object the way bookmarks store it (values encoded, brackets readable).
 * @param query - Query object with decoded values.
 */
export const stringifyQuery = (query: Record<string, unknown>): string =>
  qs.stringify(query, { encodeValuesOnly: true });
