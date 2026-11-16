/**
 * Normalises boolean filter values in saved list views before they reach the Content Manager.
 * Pure module.
 *
 * Strapi 5.62.0 answers 400 for a boolean filter whose value is empty, `yes`/`no`/`on`/`off`,
 * padded with spaces or a number other than 0/1 (before, most of these matched `true`).
 * Bookmarks saved on older versions can hold such values, so they are rewritten to `true` or
 * `false`, and a condition with an unreadable value is dropped instead of being sent.
 * See https://github.com/strapi/strapi/releases/tag/v5.62.0 ("Invalid boolean filter values
 * now return 400", strapi/strapi pull request 28172).
 */
import type { Attribute, InitData } from './fieldOptions';

const TRUE_VALUES = new Set(['true', 't', '1', 'yes', 'on']);
const FALSE_VALUES = new Set(['false', 'f', '0', 'no', 'off']);
const LOGICAL = new Set(['$and', '$or', '$not']);

/**
 * Reads a stored boolean filter value.
 * @param value - Value from a parsed query string (usually a string).
 * @returns "true", "false", or null when the value has no clear boolean meaning.
 */
export const normalizeBooleanValue = (value: unknown): 'true' | 'false' | null => {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return value === 1 ? 'true' : value === 0 ? 'false' : null;
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  if (TRUE_VALUES.has(text)) return 'true';
  if (FALSE_VALUES.has(text)) return 'false';
  return null;
};

/** Resolves the attribute at a filter path (`['author', 'active']`), or undefined. */
export type AttributeResolver = (path: string[]) => Attribute | undefined;

/**
 * Builds an attribute resolver for a content type from `/content-manager/init` schemas.
 * Follows relations to their target content type and components to their schema.
 * @param init - Schemas from /content-manager/init.
 * @param uid - Content type uid of the list view.
 */
export const createAttributeResolver = (init: InitData, uid: string): AttributeResolver => {
  const contentTypes = new Map(init.contentTypes.map((ct) => [ct.uid, ct.attributes]));
  const components = new Map(init.components.map((c) => [c.uid, c.attributes]));
  return (path) => {
    let attributes = contentTypes.get(uid);
    for (let i = 0; i < path.length; i += 1) {
      const attribute = attributes?.[path[i]];
      if (!attribute) return undefined;
      if (i === path.length - 1) return attribute;
      if (attribute.type === 'relation') {
        attributes = contentTypes.get(attribute.targetModel ?? attribute.target ?? '');
      } else if (attribute.type === 'component' && attribute.component) {
        attributes = components.get(attribute.component);
      } else {
        return undefined;
      }
    }
    return undefined;
  };
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Result of {@link sanitizeBooleanFilters}. */
export interface SanitizedFilters {
  /** The filters with normalised values, or undefined when nothing is left. */
  filters: unknown;
  /** Number of values rewritten (for example "1" -> "true"). */
  normalized: number;
  /** Number of conditions or list items dropped because their value was unreadable. */
  dropped: number;
}

/**
 * Rewrites every boolean filter value to "true"/"false" and drops conditions whose value
 * cannot be read as a boolean. Non-boolean fields and unknown fields are left unchanged.
 * @param filters - Parsed `query.filters`.
 * @param resolve - Attribute resolver for the list view's content type.
 * @returns The new filters and the counts of changed and dropped values.
 */
export const sanitizeBooleanFilters = (
  filters: unknown,
  resolve: AttributeResolver
): SanitizedFilters => {
  let normalized = 0;
  let dropped = 0;

  /** Normalises one value; undefined means "drop". */
  const fixValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      const list = value.map(fixValue).filter((item) => item !== undefined);
      return list.length ? list : undefined;
    }
    const next = normalizeBooleanValue(value);
    if (next === null) {
      dropped += 1;
      return undefined;
    }
    if (next !== value) normalized += 1;
    return next;
  };

  const walk = (node: unknown, path: string[]): unknown => {
    if (Array.isArray(node)) {
      const list = node.map((item) => walk(item, path)).filter((item) => item !== undefined);
      return list.length || !node.length ? list : undefined;
    }
    const isBoolean = path.length > 0 && resolve(path)?.type === 'boolean';
    if (!isPlainObject(node)) {
      // Shorthand `filters[active]=true` (an implicit $eq).
      return isBoolean ? fixValue(node) : node;
    }
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      let next: unknown;
      if (LOGICAL.has(key)) next = walk(value, path);
      else if (key.startsWith('$')) next = isBoolean ? fixValue(value) : value;
      else next = walk(value, [...path, key]);
      if (next !== undefined) out[key] = next;
    }
    return Object.keys(out).length || !Object.keys(node).length ? out : undefined;
  };

  return { filters: walk(filters, []), normalized, dropped };
};
