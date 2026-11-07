/**
 * Request validation for the admin routes (zod 4) and normalisation of saved list views.
 *
 * Every schema is strict (unknown keys are rejected) and bounded. Failures throw the
 * `@strapi/utils` `ValidationError`, which Strapi renders as a 400 with field details.
 */
import { errors } from '@strapi/utils';
import qs from 'qs';
import { z } from 'zod';
import { LIMITS } from './constants';

/** Icon keys accepted for a bookmark. They match the 3.x ids, so stored rows stay valid. */
export const ICON_KEYS = [
  'bookmark',
  'book',
  'star',
  'heart',
  'bolt',
  'rocket',
  'pencil',
  'link',
  'sparkles',
  'briefcase',
  'photo',
  'document',
  'bell',
  'check',
  'gift',
  'user',
  'users',
  'mail',
  'calendar',
  'clock',
  'folder',
  'search',
  'filter',
  'globe',
  'tag',
  'flag',
  'fire',
  'cube',
  'home',
  'cog',
  'wrench',
  'terminal',
  'chart',
] as const;

export const VISIBILITIES = ['private', 'shared', 'public'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/** Content Manager list view path: /content-manager/<kind>/<uid>. */
const LIST_VIEW_PATH =
  /^\/content-manager\/(collection-types|single-types)\/((?:api|plugin)::[a-z0-9_-]{1,80}\.[a-z0-9_-]{1,80})$/;

const DOCUMENT_ID = /^[a-z0-9]{1,64}$/;
const FIELD_KEY = /^[A-Za-z_][A-Za-z0-9_]{0,99}$/;
const OPERATOR_KEY = /^\$[A-Za-z]{1,20}$/;
const SORT_VALUE = /^[A-Za-z_][A-Za-z0-9_.]{0,99}:(ASC|DESC|asc|desc)$/;
const LOCALE = /^[A-Za-z0-9-]{1,20}$/;
const MAX_QUERY_LENGTH = 8192;
const MAX_FILTER_VALUE_LENGTH = 1000;
const MAX_FILTER_DEPTH = 8;

const documentId = z.string().regex(DOCUMENT_ID);

/**
 * Throws a Strapi ValidationError with zod's flattened field errors.
 * @param error - The zod error.
 * @throws {errors.ValidationError} Always.
 */
const fail = (error: z.ZodError): never => {
  throw new errors.ValidationError('Validation failed', z.flattenError(error));
};

/**
 * Parses `input` with `schema` or throws a ValidationError (400).
 * @param schema - zod schema.
 * @param input - Untrusted input.
 * @returns The parsed value.
 * @throws {errors.ValidationError} When the input does not match.
 */
export const parse = <T extends z.ZodType>(schema: T, input: unknown): z.output<T> => {
  const result = schema.safeParse(input ?? {});
  if (!result.success) fail(result.error);
  return (result as { data: z.output<T> }).data;
};

/**
 * Normalises a list view path: adds a leading slash (3.x stored relative paths) and checks it.
 * @param path - Path from the request or a stored row.
 * @returns `{ path, contentType }`, or null when the path is not a Content Manager list view.
 */
export const normalizeListViewPath = (
  path: unknown
): { path: string; contentType: string } | null => {
  if (typeof path !== 'string') return null;
  const trimmed = path.trim();
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const match = LIST_VIEW_PATH.exec(withSlash);
  if (!match) return null;
  return { path: withSlash, contentType: match[2] };
};

/**
 * Checks a parsed `filters` tree: only field names, `$operators` and array indices as keys,
 * bounded depth, string values of bounded length. Rejects `__proto__` and similar keys.
 */
const isSafeFilterTree = (node: unknown, depth = 0): boolean => {
  if (depth > MAX_FILTER_DEPTH) return false;
  if (typeof node === 'string') return node.length <= MAX_FILTER_VALUE_LENGTH;
  if (Array.isArray(node)) {
    return node.length <= 100 && node.every((item) => isSafeFilterTree(item, depth + 1));
  }
  if (node && typeof node === 'object') {
    const entries = Object.entries(node as Record<string, unknown>);
    if (entries.length > 100) return false;
    return entries.every(
      ([key, value]) =>
        (FIELD_KEY.test(key) || OPERATOR_KEY.test(key) || /^\d{1,3}$/.test(key)) &&
        key !== '__proto__' &&
        key !== 'constructor' &&
        key !== 'prototype' &&
        isSafeFilterTree(value, depth + 1)
    );
  }
  return false;
};

/**
 * Normalises a saved list view query string. Keeps `filters`, `sort`, `pageSize`, `_q` (up to
 * 1000 characters, like a filter value) and
 * `plugins[i18n][locale]`; drops `page` and everything else; rejects unsafe shapes.
 * @param query - Raw query string, with or without a leading "?".
 * @returns The normalised query string (no leading "?"), or null when it is invalid.
 */
export const normalizeListViewQuery = (query: unknown): string | null => {
  if (query === undefined || query === null || query === '') return '';
  if (typeof query !== 'string') return null;
  const raw = query.startsWith('?') ? query.slice(1) : query;
  if (raw.length > MAX_QUERY_LENGTH || raw.includes('#') || raw.includes('\\')) return null;
  // eslint-disable-next-line no-control-regex -- rejecting control characters is the point
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;

  const parsed = qs.parse(raw, {
    depth: MAX_FILTER_DEPTH,
    allowPrototypes: false,
    plainObjects: true,
    parameterLimit: 500,
    arrayLimit: 100,
  }) as Record<string, unknown>;

  const out: Record<string, unknown> = {};
  if (parsed.filters !== undefined) {
    if (!parsed.filters || typeof parsed.filters !== 'object' || Array.isArray(parsed.filters)) {
      return null;
    }
    if (!isSafeFilterTree(parsed.filters)) return null;
    out.filters = parsed.filters;
  }
  if (parsed.sort !== undefined) {
    if (typeof parsed.sort !== 'string' || !SORT_VALUE.test(parsed.sort)) return null;
    out.sort = parsed.sort;
  }
  if (parsed.pageSize !== undefined) {
    const size = Number(parsed.pageSize);
    if (!Number.isInteger(size) || size < 1 || size > 100) return null;
    out.pageSize = String(size);
  }
  if (parsed._q !== undefined) {
    if (typeof parsed._q !== 'string' || parsed._q.length > MAX_FILTER_VALUE_LENGTH) return null;
    if (parsed._q) out._q = parsed._q;
  }
  const locale = (parsed.plugins as { i18n?: { locale?: unknown } } | undefined)?.i18n?.locale;
  if (locale !== undefined) {
    if (typeof locale !== 'string' || !LOCALE.test(locale)) return null;
    out.plugins = { i18n: { locale } };
  }

  return qs.stringify(out, { encodeValuesOnly: true });
};

const name = z.string().trim().min(1).max(100);
const description = z.string().trim().max(500);
const shareTargets = z
  .array(documentId)
  .max(LIMITS.shareTargetsMax)
  .transform((ids) => [...new Set(ids)]);

const listViewPath = z
  .string()
  .max(255)
  .transform((value, ctx) => {
    const normalized = normalizeListViewPath(value);
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'Must be a Content Manager list view path' });
      return z.NEVER;
    }
    return normalized;
  });

const listViewQuery = z
  .string()
  .max(MAX_QUERY_LENGTH)
  .transform((value, ctx) => {
    const normalized = normalizeListViewQuery(value);
    if (normalized === null) {
      ctx.addIssue({ code: 'custom', message: 'Unsupported list view query' });
      return z.NEVER;
    }
    return normalized;
  });

const sharing = {
  visibility: z.enum(VISIBILITIES).optional(),
  roles: shareTargets.optional(),
  users: shareTargets.optional(),
};

export const createBookmarkSchema = z.strictObject({
  name,
  description: description.optional(),
  icon: z.enum(ICON_KEYS).optional(),
  path: listViewPath,
  query: listViewQuery.optional(),
  ...sharing,
});

export const updateBookmarkSchema = z.strictObject({
  name: name.optional(),
  description: description.optional(),
  icon: z.enum(ICON_KEYS).optional(),
  ...sharing,
});

export const updateViewSchema = z.strictObject({
  query: listViewQuery,
});

export const pinSchema = z.strictObject({
  pinned: z.boolean(),
});

export const duplicateSchema = z.strictObject({
  name: name.optional(),
});

export const SCOPES = ['all', 'mine', 'shared', 'pinned', 'managed'] as const;
export const SORTS = ['name:asc', 'name:desc', 'updatedAt:desc', 'updatedAt:asc'] as const;

const intFromQuery = (min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).optional();

export const listQuerySchema = z.strictObject({
  page: intFromQuery(1, 100000),
  pageSize: intFromQuery(1, LIMITS.pageSizeMax),
  q: z.string().trim().max(100).optional(),
  scope: z.enum(SCOPES).optional(),
  sort: z.enum(SORTS).optional(),
  contentType: z
    .string()
    .max(170)
    .regex(/^(?:api|plugin)::[a-z0-9_-]{1,80}\.[a-z0-9_-]{1,80}$/)
    .optional(),
});

export const userSearchSchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  page: intFromQuery(1, 1000),
});

export const idParamSchema = z.strictObject({ id: documentId });
