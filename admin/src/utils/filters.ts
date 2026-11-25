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
  /** For a relation's main field: the target content type, to suggest existing values. */
  relation?: { target: string; mainField: string };
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

/**
 * Most items Strapi accepts in one list of the query string. The `strapi::query` middleware
 * parses with qs `arrayLimit: 100`; a longer list arrives as an object keyed by index, and from
 * Strapi 5.63 the Content API and Content Manager answer it with 400. It applies to the values
 * of `$in` / `$notIn` and to the conditions of `$and` / `$or`.
 */
export const MAX_LIST_ITEMS = 100;

/**
 * Most conditions for match "all". The admin parses the URL with qs defaults (`arrayLimit: 20`),
 * so a longer `$and` list becomes an object keyed by index, and the Content Manager list view
 * (`Filters` reads `query.filters.$and` with `.reduce`, Strapi 5.62 and 5.63) fails to render.
 * `$or` lists are not read that way and keep {@link MAX_LIST_ITEMS}.
 */
export const MAX_ALL_CONDITIONS = 20;

/**
 * Publication status pseudo-field of the Content Manager list view (Strapi 5.57+). The list API
 * reads `{ __status: { $eq } }` only from the root `$and` list (`normalizeStatusFromFilters` in
 * `@strapi/content-manager` server `controllers/collection-types`); anywhere else it answers 400.
 */
export const STATUS_FIELD = '__status';
/** Attribute type the editor uses for {@link STATUS_FIELD}. */
export const STATUS_TYPE = 'status';
/** Values the Content Manager accepts for {@link STATUS_FIELD}. */
export const STATUS_VALUES = ['draft', 'published', 'published-modified', 'published-unmodified'];

/**
 * Most conditions a filter can have for a match mode.
 * @param match - "all" or "any".
 */
export const maxConditions = (match: MatchMode): number =>
  match === 'all' ? MAX_ALL_CONDITIONS : MAX_LIST_ITEMS;

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
    case STATUS_TYPE:
      return ['$eq'];
    default:
      ops = [...BASE, ...SENSITIVE];
  }
  return isSubField
    ? ops.filter((op) => !LIST_OPERATORS.includes(op) && !RANGE_OPERATORS.includes(op))
    : ops;
};

/** The only boolean filter values the editor sends. */
export const BOOLEAN_VALUES = ['true', 'false'];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True for a `YYYY-MM-DD` value. On a `datetime` field Strapi 5.62's Content Manager reads it
 * as the whole local day (`toApiFilters` in `@strapi/admin`), so it must stay date-only.
 * @param value - Filter value.
 */
export const isDateOnly = (value: string | undefined): boolean => DATE_ONLY.test(value ?? '');

/**
 * Stored `datetime` filter value -> value for the editor input. An ISO instant becomes
 * `YYYY-MM-DDTHH:mm` in the user's time zone (for `<input type="datetime-local">`); a
 * date-only value and anything unreadable stay unchanged.
 * @param value - Stored value.
 */
export const datetimeToInput = (value: string): string => {
  const date = new Date(value);
  if (!value.includes('T') || Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * Editor input -> stored `datetime` filter value. A local date and time becomes an ISO
 * instant (UTC). A date-only value is kept as it is, so it still means the whole day; turning
 * it into an instant would make it UTC midnight.
 * @param value - Input value.
 */
export const inputToDatetime = (value: string): string => {
  if (!value || isDateOnly(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
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
 * True when a `$in` / `$notIn` row has more values than Strapi accepts ({@link MAX_LIST_ITEMS}).
 * @param row - The row.
 */
export const hasTooManyValues = (row: Pick<FilterRow, 'operator' | 'value'>): boolean =>
  LIST_OPERATORS.includes(row.operator) && splitList(row.value).length > MAX_LIST_ITEMS;

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
  if (field.type === STATUS_TYPE) return STATUS_VALUES.includes(row.value) ? null : 'value';
  // Strapi 5.62 answers 400 for any other boolean value (empty, "1", "yes", padded, ...).
  if (field.type === 'boolean') return BOOLEAN_VALUES.includes(row.value) ? null : 'value';
  if (LIST_OPERATORS.includes(row.operator)) {
    const count = splitList(row.value).length;
    return count && count <= MAX_LIST_ITEMS ? null : 'value';
  }
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

const INDEX_KEY = /^\d+$/;

/** Number of items in a parsed list: an array, or an object keyed only by indexes. */
const listLength = (value: unknown): number => {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== 'object') return 0;
  const keys = Object.keys(value);
  return keys.length && keys.every((key) => INDEX_KEY.test(key))
    ? Math.max(...keys.map(Number)) + 1
    : 0;
};

/** True when an array or index-keyed object at any depth has more than {@link MAX_LIST_ITEMS} items. */
const exceedsItemLimit = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.length > MAX_LIST_ITEMS || value.some(exceedsItemLimit);
  }
  if (!value || typeof value !== 'object') return false;
  const keys = Object.keys(value);
  if (keys.length && keys.every((key) => INDEX_KEY.test(key))) {
    if (keys.some((key) => Number(key) >= MAX_LIST_ITEMS)) return true;
  }
  return Object.values(value as Record<string, unknown>).some(exceedsItemLimit);
};

/**
 * True when a parsed query holds a list that Strapi 5.63 rejects with 400: an array with more
 * than {@link MAX_LIST_ITEMS} items, or an object keyed only by indexes with an index of
 * {@link MAX_LIST_ITEMS} or more (what qs makes of such a list with `arrayLimit: 100`). Also true
 * for a root `$and` with more than {@link MAX_ALL_CONDITIONS} conditions, which the Content
 * Manager list view cannot render.
 * @param value - Parsed query, or any part of it.
 * @returns True when a list is too long.
 */
export const exceedsListLimit = (value: unknown): boolean => {
  const filters = (value as { filters?: unknown } | null)?.filters;
  if (filters && typeof filters === 'object') {
    if (listLength((filters as Record<string, unknown>).$and) > MAX_ALL_CONDITIONS) return true;
  }
  return exceedsItemLimit(value);
};

/* -------------------------------------------------------------------------------------------------
 * Condition groups (AND / OR with one level of nesting)
 *
 * The admin parses the list view URL with qs' default depth of 5 brackets below `filters`
 * (`useQueryParams` in `@strapi/admin`), so a nested logical operator such as
 * `filters[$and][0][$or][0][title][$eq]` (6 levels) arrives as `{ title: { '[$eq]': ... } }` and
 * the Content Manager answers 400. One level of nesting fits when it uses the implicit AND of
 * Strapi filters ("multiple fields are combined with $and by default"):
 *
 * - "all of (A, B, any of (C, D))" -> `{ $and: [A, B], $or: [C, D] }` (root keys are ANDed).
 *   Only one "any" group fits: the root has one `$or` key.
 * - "any of (A, all of (B, C))"    -> `{ $or: [A, { ...B, ...C }] }` (one object, several fields).
 *   A group can use each field and condition once (object keys are unique).
 *
 * Every generated key stays within `filters[$or][0][relation][field][$op]` (5 levels).
 * ---------------------------------------------------------------------------------------------- */

/** A group of conditions. Its match is always the opposite of the top level's match. */
export interface FilterGroup {
  id: string;
  kind: 'group';
  conditions: FilterRow[];
}

export type FilterItem = FilterRow | FilterGroup;

/** Editor model: the top-level match and its conditions and groups. */
export interface FilterTree {
  match: MatchMode;
  items: FilterItem[];
  /** True when the URL held filters this editor cannot represent; they are replaced on apply. */
  unsupported: boolean;
}

/** Most groups a filter can have for a match mode ("all": one `$or` key at the root). */
export const maxGroups = (match: MatchMode): number => (match === 'all' ? 1 : MAX_ALL_CONDITIONS);

/** Most conditions inside one group. */
export const MAX_GROUP_CONDITIONS = MAX_ALL_CONDITIONS;

/**
 * True for a group item.
 * @param item - Condition or group.
 */
export const isGroup = (item: FilterItem): item is FilterGroup =>
  (item as FilterGroup).kind === 'group';

let groupCounter = 0;
/** Creates a unique group id. */
export const nextGroupId = (): string => {
  groupCounter += 1;
  return `group-${groupCounter}`;
};

/** All conditions of a tree, groups included, in display order. */
export const treeConditions = (tree: Pick<FilterTree, 'items'>): FilterRow[] =>
  tree.items.flatMap((item) => (isGroup(item) ? item.conditions : [item]));

/** The `{ id: { $notNull } }` entry added next to a lone status condition (see buildFilterTree). */
const STATUS_COMPANION = { id: { $notNull: 'true' } };

const isStatusEntry = (entry: unknown): boolean =>
  isPlainObject(entry) && Object.keys(entry).length === 1 && STATUS_FIELD in entry;

const isStatusCompanion = (row: FilterRow): boolean =>
  row.field === 'id' && row.operator === '$notNull';

/** Merges the entries of a group into one object (implicit AND). */
const mergeEntries = (entries: Record<string, unknown>[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  const merge = (target: Record<string, unknown>, source: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(source)) {
      if (isPlainObject(value) && isPlainObject(target[key])) {
        merge(target[key] as Record<string, unknown>, value);
      } else {
        target[key] = isPlainObject(value) ? merge({}, value) : value;
      }
    }
    return target;
  };
  for (const entry of entries) merge(out, entry);
  return out;
};

/**
 * Builds the `filters` object for the URL from the editor tree. Groups without conditions are
 * left out. Call {@link validateTree} first: an invalid tree builds an invalid query.
 *
 * When status is the only other top-level condition of an "all" filter with a group, an
 * always-true `id is not null` condition is added: the Content Manager drops the whole
 * `filters` object (and with it the group) when it takes the status out of a `$and` list that
 * is left empty (`normalizeStatusFromFilters`, Strapi 5.57 to 5.63).
 * @param tree - Editor tree with valid conditions.
 * @returns The filters object, or undefined when there are no conditions.
 */
export const buildFilterTree = (
  tree: Pick<FilterTree, 'match' | 'items'>
): Record<string, unknown> | undefined => {
  const groups = tree.items.filter(isGroup).filter((group) => group.conditions.length);
  const rows = tree.items.filter((item): item is FilterRow => !isGroup(item));

  if (tree.match === 'any') {
    const or = tree.items
      .map((item) => {
        if (!isGroup(item)) return rowToFilter(item);
        if (!item.conditions.length) return null;
        return mergeEntries(item.conditions.map(rowToFilter));
      })
      .filter((entry): entry is Record<string, unknown> => !!entry);
    return or.length ? { $or: or } : undefined;
  }

  const and: Record<string, unknown>[] = rows.map(rowToFilter);
  const group = groups[0];
  if (!group) return and.length ? { $and: and } : undefined;
  const or = group.conditions.map(rowToFilter);
  if (!and.length) return { $or: or };
  if (and.every(isStatusEntry)) and.push(STATUS_COMPANION);
  return { $and: and, $or: or };
};

/** Items of a parsed list: an array, or an object keyed by index (qs above its arrayLimit). */
const listItems = (value: unknown): unknown[] | null => {
  if (Array.isArray(value)) return value;
  if (!isPlainObject(value)) return null;
  const keys = Object.keys(value);
  if (!keys.every((key) => INDEX_KEY.test(key))) return null;
  return keys.sort((a, b) => Number(a) - Number(b)).map((key) => value[key]);
};

/** One operator and its raw value -> row, or null when the shape is not supported. */
const toRow = (path: string, operator: string, raw: unknown): FilterRow | null => {
  if (!ALL_OPERATORS.includes(operator)) return null;
  if (NO_VALUE_OPERATORS.includes(operator)) {
    // "is null: false" would mean the opposite; only the native "true" is read.
    return raw === 'true' || raw === true
      ? { id: nextRowId(), field: path, operator, value: '' }
      : null;
  }
  if (LIST_OPERATORS.includes(operator)) {
    const list = listItems(raw) ?? [raw];
    if (!list.length || !list.every((item) => typeof item === 'string')) return null;
    return { id: nextRowId(), field: path, operator, value: (list as string[]).join(', ') };
  }
  if (RANGE_OPERATORS.includes(operator)) {
    const list = listItems(raw);
    if (!list || list.length !== 2 || !list.every((v) => typeof v === 'string')) return null;
    return {
      id: nextRowId(),
      field: path,
      operator,
      value: list[0] as string,
      valueTo: list[1] as string,
    };
  }
  if (typeof raw !== 'string') return null;
  return { id: nextRowId(), field: path, operator, value: raw };
};

/** `{ $op: value, ... }` (or a bare value, meaning $eq) -> rows. */
const operatorRows = (path: string, node: unknown): FilterRow[] | null => {
  if (!isPlainObject(node)) {
    const row = toRow(path, '$eq', node);
    return row ? [row] : null;
  }
  const entries = Object.entries(node);
  if (!entries.length) return null;
  const rows: FilterRow[] = [];
  for (const [operator, raw] of entries) {
    if (!OPERATOR.test(operator)) return null;
    const row = toRow(path, operator, raw);
    if (!row) return null;
    rows.push(row);
  }
  return rows;
};

/**
 * Reads one filter entry (an object of fields, combined with AND) into conditions, or null
 * when it holds a logical operator, a path deeper than relation.field or an unknown operator.
 * @param entry - e.g. `{ title: { $eq: 'a' }, author: { name: { $eq: 'b' } } }`.
 */
export const entryConditions = (entry: unknown): FilterRow[] | null => {
  if (!isPlainObject(entry)) return null;
  const keys = Object.keys(entry);
  if (!keys.length) return null;
  const rows: FilterRow[] = [];
  for (const head of keys) {
    if (!SAFE_KEY.test(head)) return null;
    const node = entry[head];
    const innerKeys = isPlainObject(node) ? Object.keys(node) : [];
    if (isPlainObject(node) && innerKeys.length && innerKeys.every((k) => SAFE_KEY.test(k))) {
      // relation or component: { author: { name: { $eq } } }
      for (const sub of innerKeys) {
        const subRows = operatorRows(`${head}.${sub}`, node[sub]);
        if (!subRows) return null;
        rows.push(...subRows);
      }
      continue;
    }
    const opRows = operatorRows(head, node);
    if (!opRows) return null;
    rows.push(...opRows);
  }
  return rows;
};

/**
 * Reads URL filters back into the editor tree. Understands every shape the editor writes and
 * the older ones Magic Mark and the native filters wrote: a root `$and` or `$or` list,
 * `$and` plus `$or` (one group), field keys at the root (combined with AND) and entries with
 * several fields (combined with AND). Anything else sets `unsupported` and keeps the parts
 * that could be read.
 * @param filters - Parsed `query.filters` (already URL-decoded).
 * @returns Editor tree.
 */
export const parseFilterTree = (filters: unknown): FilterTree => {
  if (filters === undefined || filters === null || filters === '') {
    return { match: 'all', items: [], unsupported: false };
  }
  if (!isPlainObject(filters)) return { match: 'all', items: [], unsupported: true };

  let unsupported = false;
  const andRows: FilterRow[] = [];
  const andList = filters.$and === undefined ? [] : listItems(filters.$and);
  const orList = filters.$or === undefined ? null : listItems(filters.$or);
  if (andList === null || (filters.$or !== undefined && orList === null)) unsupported = true;

  for (const entry of andList ?? []) {
    const rows = entryConditions(entry);
    if (rows) andRows.push(...rows);
    else unsupported = true;
  }
  const rootFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (key === '$and' || key === '$or') continue;
    if (key.startsWith('$')) unsupported = true;
    else rootFields[key] = value;
  }
  if (Object.keys(rootFields).length) {
    const rows = entryConditions(rootFields);
    if (rows) andRows.push(...rows);
    else unsupported = true;
  }

  // Only a root $or: match "any", entries with several conditions become "all" groups.
  if (orList && !andRows.length && filters.$and === undefined) {
    const items: FilterItem[] = [];
    for (const entry of orList) {
      const rows = entryConditions(entry);
      if (!rows) unsupported = true;
      else if (rows.length === 1) items.push(rows[0]);
      else items.push({ id: nextGroupId(), kind: 'group', conditions: rows });
    }
    return { match: 'any', items, unsupported };
  }

  const items: FilterItem[] = [...andRows];
  if (orList && orList.length) {
    const conditions: FilterRow[] = [];
    for (const entry of orList) {
      const rows = entryConditions(entry);
      if (rows && rows.length === 1) conditions.push(rows[0]);
      else unsupported = true; // "any of (all of ...)" inside "all" needs a second level
    }
    if (conditions.length) {
      items.push({ id: nextGroupId(), kind: 'group', conditions });
      // Drop the always-true companion that buildFilterTree adds next to a lone status.
      if (andRows.some((row) => row.field === STATUS_FIELD)) {
        const companion = andRows.findIndex(isStatusCompanion);
        if (companion >= 0) items.splice(companion, 1);
      }
    }
  }
  return { match: 'all', items, unsupported };
};

export type ConditionError =
  'field' | 'operator' | 'value' | 'valueTo' | 'statusPlacement' | 'duplicateInGroup';

/** Result of {@link validateTree}. */
export interface TreeValidation {
  /** Error per condition id. */
  conditions: Map<string, ConditionError>;
  /** True when the top level has more conditions or groups than the Content Manager accepts. */
  tooManyItems: boolean;
  /** Ids of groups with more conditions than accepted. */
  tooLargeGroups: Set<string>;
  /** True when "all" has more than one group. */
  tooManyGroups: boolean;
  /** True when the built query does not fit the admin's qs depth. */
  tooDeep: boolean;
  valid: boolean;
}

/**
 * Validates a tree: every condition (see {@link validateRow}), the limits of the admin and
 * Strapi query parsers, status placement (only top-level "all") and repeated field/condition
 * pairs inside an "all" group (one object cannot hold the same key twice).
 * @param tree - Editor tree.
 * @param fields - Field options by path.
 */
export const validateTree = (
  tree: Pick<FilterTree, 'match' | 'items'>,
  fields: Map<string, FieldOption>
): TreeValidation => {
  const conditions = new Map<string, ConditionError>();
  const tooLargeGroups = new Set<string>();
  const check = (row: FilterRow, inGroup: boolean) => {
    const error = validateRow(row, fields);
    if (error) conditions.set(row.id, error);
    else if (row.field === STATUS_FIELD && (inGroup || tree.match === 'any')) {
      conditions.set(row.id, 'statusPlacement');
    }
  };
  for (const item of tree.items) {
    if (!isGroup(item)) {
      check(item, false);
      continue;
    }
    if (item.conditions.length > MAX_GROUP_CONDITIONS) tooLargeGroups.add(item.id);
    const seen = new Set<string>();
    for (const row of item.conditions) {
      check(row, true);
      // In "any", a group is one object: the same field and condition cannot appear twice.
      const key = `${row.field}|${row.operator}`;
      if (tree.match === 'any' && seen.has(key) && !conditions.has(row.id)) {
        conditions.set(row.id, 'duplicateInGroup');
      }
      seen.add(key);
    }
  }
  const groups = tree.items.filter(isGroup).length;
  const topCount = tree.items.filter((item) => !isGroup(item)).length;
  const tooManyGroups = groups > maxGroups(tree.match);
  // "all": the top-level conditions are the root $and list (admin arrayLimit 20, see
  // MAX_ALL_CONDITIONS); "any": every item is one entry of the root $or list.
  const tooManyItems =
    tree.match === 'all' ? topCount > MAX_ALL_CONDITIONS : tree.items.length > MAX_LIST_ITEMS;
  let tooDeep = false;
  if (!conditions.size && !tooManyGroups) {
    const built = buildFilterTree(tree);
    tooDeep = !!built && !fitsAdminQueryDepth(built);
  }
  return {
    conditions,
    tooManyItems,
    tooLargeGroups,
    tooManyGroups,
    tooDeep,
    valid: !conditions.size && !tooManyItems && !tooLargeGroups.size && !tooManyGroups && !tooDeep,
  };
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * A day relative to today, as a value for the editor's date or date-time input.
 * @param daysAgo - 0 for today, 7 for a week ago.
 * @param type - `date` (YYYY-MM-DD) or `datetime` (YYYY-MM-DDT00:00, local midnight).
 * @param now - Current time (for tests).
 */
export const relativeDay = (daysAgo: number, type: string, now = new Date()): string => {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
  const date = `${day.getFullYear()}-${pad2(day.getMonth() + 1)}-${pad2(day.getDate())}`;
  return type === 'datetime' ? `${date}T00:00` : date;
};

/**
 * Filters for the live result count, read the way the Content Manager list reads them: a
 * date-only value on a date-time field in the root `$and` list means the whole local day
 * (`toApiFilters` in `@strapi/admin`, Strapi 5.62+), so it is sent as the instants it covers.
 * @param filters - Filters object built by {@link buildFilterTree}.
 * @param typeOf - Attribute type by field path.
 * @returns Filters for the list API.
 */
export const toCountFilters = (
  filters: Record<string, unknown>,
  typeOf: (path: string) => string | undefined
): Record<string, unknown> => {
  const list = filters.$and;
  if (!Array.isArray(list)) return filters;
  const bounds = (value: string) => {
    const [y, m, d] = value.split('-').map(Number);
    return {
      start: new Date(y, m - 1, d).toISOString(),
      end: new Date(y, m - 1, d + 1).toISOString(),
    };
  };
  const rewrite = (path: string, node: unknown): unknown => {
    if (!isPlainObject(node) || typeOf(path) !== 'datetime') return node;
    const out: Record<string, unknown> = {};
    for (const [op, value] of Object.entries(node)) {
      if (typeof value !== 'string' || !isDateOnly(value)) {
        out[op] = value;
        continue;
      }
      const { start, end } = bounds(value);
      if (op === '$eq') Object.assign(out, { $gte: start, $lt: end });
      else if (op === '$gt') out.$gte = end;
      else if (op === '$gte') out.$gte = start;
      else if (op === '$lt') out.$lt = start;
      else if (op === '$lte') out.$lt = end;
      else out[op] = value;
    }
    return out;
  };
  return {
    ...filters,
    $and: list.map((entry) =>
      isPlainObject(entry)
        ? Object.fromEntries(
            Object.entries(entry).map(([key, node]) => [
              key,
              isPlainObject(node) && !Object.keys(node).some((k) => k.startsWith('$'))
                ? Object.fromEntries(
                    Object.entries(node).map(([sub, v]) => [sub, rewrite(`${key}.${sub}`, v)])
                  )
                : rewrite(key, node),
            ])
          )
        : entry
    ),
  };
};

/** Operators the editor offers first, by kind of field; others appear only when in use. */
const PRIMARY_OPERATORS: Record<string, string[]> = {
  text: [
    '$eq',
    '$ne',
    '$containsi',
    '$notContainsi',
    '$startsWithi',
    '$endsWithi',
    '$in',
    '$notIn',
    '$null',
    '$notNull',
  ],
  number: [
    '$eq',
    '$ne',
    '$gt',
    '$gte',
    '$lt',
    '$lte',
    '$between',
    '$in',
    '$notIn',
    '$null',
    '$notNull',
  ],
  date: ['$eq', '$gt', '$gte', '$lt', '$lte', '$between', '$null', '$notNull'],
  // An exact date-time instant rarely matches: offer before / after instead of "is".
  datetime: ['$gt', '$gte', '$lt', '$lte', '$between', '$null', '$notNull'],
  enumeration: ['$eq', '$ne', '$in', '$notIn', '$null', '$notNull'],
  boolean: ['$eq', '$null', '$notNull'],
  status: ['$eq'],
  other: ['$eq', '$ne', '$null', '$notNull'],
};

const KIND: Record<string, string> = {
  string: 'text',
  text: 'text',
  email: 'text',
  uid: 'text',
  integer: 'number',
  biginteger: 'number',
  float: 'number',
  decimal: 'number',
  date: 'date',
  time: 'date',
  datetime: 'datetime',
  enumeration: 'enumeration',
  boolean: 'boolean',
  status: 'status',
};

/**
 * Operators the editor shows for a field: a short plain list per type, plus the current
 * operator when an older filter uses another valid one (so it is shown, not lost).
 * @param type - Attribute type.
 * @param isSubField - True for relation or component sub-fields.
 * @param current - Operator of the condition, if any.
 */
export const operatorChoices = (type: string, isSubField: boolean, current?: string): string[] => {
  const valid = operatorsForType(type, isSubField);
  const primary = (PRIMARY_OPERATORS[KIND[type] ?? 'other'] ?? []).filter((op) =>
    valid.includes(op)
  );
  return current && valid.includes(current) && !primary.includes(current)
    ? [...primary, current]
    : primary;
};

/**
 * First operator and value for a field the user just picked.
 * @param field - Field option.
 */
export const defaultsFor = (field: FieldOption): Pick<FilterRow, 'operator' | 'value'> => {
  switch (KIND[field.type] ?? 'other') {
    case 'text':
      return { operator: field.relation ? '$eq' : '$containsi', value: '' };
    case 'date':
    case 'datetime':
      return { operator: '$gte', value: '' };
    case 'boolean':
      return { operator: '$eq', value: 'true' };
    case 'status':
      return { operator: '$eq', value: 'published' };
    default:
      return { operator: '$eq', value: '' };
  }
};
