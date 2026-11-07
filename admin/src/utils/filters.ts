/**
 * Advanced filter model and conversion to and from Content Manager `filters` query objects.
 *
 * Pure module (no imports) so it runs in the admin bundle and under `node --test`.
 *
 * The editor holds a flat list of rows plus one match mode:
 * - match "all" -> `{ $and: [row, row, ...] }`. This is the shape of Strapi's native filter
 *   tags (`@strapi/admin` Filters reads `query.filters.$and`), so the rows show up as native
 *   tags and stay when a native tag is removed.
 * - match "any" -> `{ $or: [row, row, ...] }`.
 *
 * A row is `{ field: { $op: value } }`, or `{ relationOrComponent: { subField: { $op: value } } }`.
 * The admin parses the URL with qs' default depth of 5 brackets below `filters`, so every
 * generated key stays within `filters[$and][0][a][b][$op]`. Operators that need one more level
 * (`$in`, `$notIn`, `$between` on a sub-field) are not offered for sub-fields.
 */

export type MatchMode = 'all' | 'any';

export interface FieldOption {
  /** Dotted path, e.g. "title", "author.name", "seo.metaTitle". */
  path: string;
  /** Display label (translated or from the Content Manager metadata). */
  label: string;
  /** Strapi attribute type of the filtered value (the main field for relations). */
  type: string;
  /** Allowed values for enumerations. */
  enum?: string[];
  /** Group label for the picker: the content type, a relation or a component. */
  group?: string;
}

export interface FilterRow {
  id: string;
  field: string;
  operator: string;
  /** Text value; for `$in`/`$notIn` a comma separated list; for `$between` two values. */
  value: string;
  valueTo?: string;
}

export interface FilterState {
  match: MatchMode;
  rows: FilterRow[];
  /** True when the URL held filters this editor cannot represent; they are replaced on apply. */
  unsupported: boolean;
}

/** qs default parse depth used by the admin's useQueryParams. */
export const ADMIN_QUERY_DEPTH = 5;

export const NO_VALUE_OPERATORS = ['$null', '$notNull'];
export const LIST_OPERATORS = ['$in', '$notIn'];
export const RANGE_OPERATORS = ['$between'];

const BASE = ['$eq', '$ne', '$null', '$notNull'];
const NUMERIC = ['$gt', '$gte', '$lt', '$lte'];
const SENSITIVE = ['$eqi', '$nei'];
const CONTAINS = ['$contains', '$containsi', '$notContains', '$notContainsi'];
const STRING_PARSE = ['$startsWith', '$startsWithi', '$endsWith', '$endsWithi'];

/** Every operator the editor knows, in display order. */
export const ALL_OPERATORS = [
  ...BASE,
  ...SENSITIVE,
  ...CONTAINS,
  ...STRING_PARSE,
  ...NUMERIC,
  ...LIST_OPERATORS,
  ...RANGE_OPERATORS,
];

/**
 * Operators for an attribute type. Mirrors the native list (`@strapi/admin` Filters
 * getFilterList) and adds `$in`, `$notIn` and `$between` where they make sense.
 * @param type - Strapi attribute type.
 * @param isSubField - True for relation or component sub-fields (one level deeper).
 * @returns Operator keys such as `$eq`.
 */
export const operatorsForType = (type: string, isSubField = false): string[] => {
  let ops: string[];
  switch (type) {
    case 'email':
    case 'string':
    case 'text':
    case 'uid':
      ops = [...BASE, ...SENSITIVE, ...CONTAINS, ...STRING_PARSE, ...LIST_OPERATORS];
      break;
    case 'float':
    case 'integer':
    case 'biginteger':
    case 'decimal':
      ops = [...BASE, ...NUMERIC, ...LIST_OPERATORS, ...RANGE_OPERATORS];
      break;
    case 'date':
    case 'time':
      ops = [...BASE, ...NUMERIC, ...CONTAINS, ...RANGE_OPERATORS];
      break;
    case 'datetime':
      ops = [...BASE, ...NUMERIC, ...RANGE_OPERATORS];
      break;
    case 'enumeration':
      ops = [...BASE, ...LIST_OPERATORS];
      break;
    case 'boolean':
      ops = [...BASE];
      break;
    default:
      ops = [...BASE, ...SENSITIVE];
  }
  return isSubField
    ? ops.filter((op) => !LIST_OPERATORS.includes(op) && !RANGE_OPERATORS.includes(op))
    : ops;
};

/**
 * Splits a comma separated list into trimmed, non-empty values.
 * @param value - e.g. "a, b,,c".
 * @returns e.g. ["a", "b", "c"].
 */
export const splitList = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * Validates one row against the available fields.
 * @param row - The row.
 * @param fields - Field options by path.
 * @returns An error key (`field`, `operator`, `value`, `valueTo`) or null when valid.
 */
export const validateRow = (
  row: FilterRow,
  fields: Map<string, FieldOption>
): 'field' | 'operator' | 'value' | 'valueTo' | null => {
  const field = fields.get(row.field);
  if (!field) return 'field';
  if (!operatorsForType(field.type, row.field.includes('.')).includes(row.operator)) {
    return 'operator';
  }
  if (NO_VALUE_OPERATORS.includes(row.operator)) return null;
  if (LIST_OPERATORS.includes(row.operator)) return splitList(row.value).length ? null : 'value';
  if (!row.value.trim()) return 'value';
  if (RANGE_OPERATORS.includes(row.operator) && !(row.valueTo ?? '').trim()) return 'valueTo';
  return null;
};

/** The `{ $op: value }` part of a row. */
const operatorValue = (row: FilterRow): Record<string, unknown> => {
  if (NO_VALUE_OPERATORS.includes(row.operator)) return { [row.operator]: 'true' };
  if (LIST_OPERATORS.includes(row.operator)) return { [row.operator]: splitList(row.value) };
  if (RANGE_OPERATORS.includes(row.operator)) {
    return { [row.operator]: [row.value.trim(), (row.valueTo ?? '').trim()] };
  }
  return { [row.operator]: row.value.trim() };
};

/**
 * Converts one row into a filter entry, nesting dotted paths.
 * @param row - A valid row.
 * @returns e.g. `{ author: { name: { $eq: 'Ada' } } }`.
 */
export const rowToFilter = (row: FilterRow): Record<string, unknown> => {
  const [head, sub] = row.field.split('.');
  return sub ? { [head]: { [sub]: operatorValue(row) } } : { [head]: operatorValue(row) };
};

/**
 * Builds the `filters` object for the URL from the editor state.
 * @param match - "all" or "any".
 * @param rows - Valid rows.
 * @returns `{ $and: [...] }` / `{ $or: [...] }`, or undefined when there are no rows.
 */
export const buildFilters = (
  match: MatchMode,
  rows: FilterRow[]
): Record<string, unknown[]> | undefined => {
  if (!rows.length) return undefined;
  return { [match === 'any' ? '$or' : '$and']: rows.map(rowToFilter) };
};

/**
 * Bracket depth below `filters` of the deepest key a filters object produces.
 * `{ $and: [{ title: { $eq: 'x' } }] }` -> `[$and][0][title][$eq]` -> 4.
 * @param value - filters object (or any nested value).
 * @returns Depth in brackets.
 */
export const filterDepth = (value: unknown): number => {
  if (Array.isArray(value)) {
    return value.length ? 1 + Math.max(...value.map(filterDepth)) : 1;
  }
  if (value && typeof value === 'object') {
    const entries = Object.values(value as Record<string, unknown>);
    return entries.length ? 1 + Math.max(...entries.map(filterDepth)) : 1;
  }
  return 0;
};

/**
 * True when every key of the filters object fits the admin's qs parse depth.
 * @param filters - filters object.
 */
export const fitsAdminQueryDepth = (filters: unknown): boolean =>
  filterDepth(filters) <= ADMIN_QUERY_DEPTH;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const SAFE_KEY = /^[A-Za-z_][A-Za-z0-9_]{0,99}$/;
const OPERATOR = /^\$[A-Za-z]{1,20}$/;

let rowCounter = 0;
/** Creates a unique row id. */
export const nextRowId = (): string => {
  rowCounter += 1;
  return `row-${rowCounter}`;
};

/** Parses one filter entry back into a row, or null when its shape is not supported. */
const entryToRow = (entry: unknown): FilterRow | null => {
  if (!isPlainObject(entry)) return null;
  const keys = Object.keys(entry);
  if (keys.length !== 1 || !SAFE_KEY.test(keys[0])) return null;
  const head = keys[0];
  const inner = entry[head];
  if (!isPlainObject(inner)) return null;
  const innerKeys = Object.keys(inner);
  if (innerKeys.length !== 1) return null;

  let path = head;
  let opObject: Record<string, unknown> = inner;
  if (!OPERATOR.test(innerKeys[0])) {
    if (!SAFE_KEY.test(innerKeys[0])) return null;
    const nested = inner[innerKeys[0]];
    if (!isPlainObject(nested) || Object.keys(nested).length !== 1) return null;
    path = `${head}.${innerKeys[0]}`;
    opObject = nested;
  }
  const operator = Object.keys(opObject)[0];
  if (!ALL_OPERATORS.includes(operator)) return null;
  const raw = opObject[operator];

  if (NO_VALUE_OPERATORS.includes(operator)) {
    return { id: nextRowId(), field: path, operator, value: '' };
  }
  if (LIST_OPERATORS.includes(operator)) {
    const list = Array.isArray(raw) ? raw : [raw];
    if (!list.every((item) => typeof item === 'string')) return null;
    return { id: nextRowId(), field: path, operator, value: list.join(', ') };
  }
  if (RANGE_OPERATORS.includes(operator)) {
    if (!Array.isArray(raw) || raw.length !== 2 || !raw.every((v) => typeof v === 'string')) {
      return null;
    }
    return { id: nextRowId(), field: path, operator, value: raw[0], valueTo: raw[1] };
  }
  if (typeof raw !== 'string') return null;
  return { id: nextRowId(), field: path, operator, value: raw };
};

/**
 * Reads URL filters back into the editor. Supports `{ $and: [...] }` or `{ $or: [...] }`
 * of single-condition entries; anything else sets `unsupported`.
 * @param filters - Parsed `query.filters` (already URL-decoded).
 * @returns Editor state.
 */
export const parseFilters = (filters: unknown): FilterState => {
  if (filters === undefined || filters === null || filters === '') {
    return { match: 'all', rows: [], unsupported: false };
  }
  if (!isPlainObject(filters)) return { match: 'all', rows: [], unsupported: true };
  const keys = Object.keys(filters);
  if (keys.length !== 1 || !['$and', '$or'].includes(keys[0])) {
    return { match: 'all', rows: [], unsupported: true };
  }
  const match: MatchMode = keys[0] === '$or' ? 'any' : 'all';
  const list = filters[keys[0]];
  const entries = Array.isArray(list) ? list : isPlainObject(list) ? Object.values(list) : [];
  const rows: FilterRow[] = [];
  let unsupported = !Array.isArray(list) && !isPlainObject(list);
  for (const entry of entries) {
    const row = entryToRow(entry);
    if (row) rows.push(row);
    else unsupported = true;
  }
  return { match, rows, unsupported };
};

/**
 * Number of conditions in a filters object (top-level entries of `$and`/`$or`).
 * @param filters - Parsed `query.filters`.
 */
export const countConditions = (filters: unknown): number => {
  if (!isPlainObject(filters)) return 0;
  let count = 0;
  for (const [key, value] of Object.entries(filters)) {
    if (key === '$and' || key === '$or') {
      count += Array.isArray(value)
        ? value.length
        : isPlainObject(value)
          ? Object.keys(value).length
          : 0;
    } else {
      count += 1;
    }
  }
  return count;
};
