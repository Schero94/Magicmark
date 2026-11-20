/**
 * Plain-language descriptions of filters ("Category is news and (Views is at least 100 or
 * Author (name) is Ben)"), used by the active filter chip, the bookmark summary and the
 * bookmark list. Pure module: the caller passes `formatMessage`.
 */
import type { MessageDescriptor } from 'react-intl';
import {
  type FieldOption,
  type FilterRow,
  type FilterTree,
  isGroup,
  LIST_OPERATORS,
  NO_VALUE_OPERATORS,
  RANGE_OPERATORS,
  STATUS_FIELD,
  splitList,
} from './filters';
import { msg, operatorLabel } from './translations';

export type Format = (
  descriptor: MessageDescriptor,
  values?: Record<string, string | number>
) => string;

/** Labels of the publication status values, worded for editors. */
export const STATUS_LABELS: Record<string, MessageDescriptor> = {
  draft: msg('status.draft', 'Draft (never published)'),
  published: msg('status.published', 'Published'),
  'published-modified': msg('status.publishedModified', 'Published, with unpublished changes'),
  'published-unmodified': msg('status.publishedUnmodified', 'Published, no unpublished changes'),
};

/**
 * Display label of a field.
 * @param path - Field path.
 * @param field - Field option, when known.
 * @param format - `formatMessage`.
 */
export const fieldLabel = (path: string, field: FieldOption | undefined, format: Format): string =>
  path === STATUS_FIELD ? format(msg('filters.status', 'Status')) : (field?.label ?? path);

/**
 * Display text of a value for a field type (booleans as Yes/No, status values as words).
 * @param value - Stored value.
 * @param type - Attribute type.
 * @param format - `formatMessage`.
 */
export const valueLabel = (value: string, type: string | undefined, format: Format): string => {
  if (type === 'boolean') {
    if (value === 'true') return format(msg('filters.true', 'Yes'));
    if (value === 'false') return format(msg('filters.false', 'No'));
  }
  if (type === 'status' && STATUS_LABELS[value]) return format(STATUS_LABELS[value]);
  return value;
};

/**
 * One condition as text, e.g. "Views is between 10 and 100".
 * @param row - Condition.
 * @param fields - Field options by path.
 * @param format - `formatMessage`.
 */
export const describeCondition = (
  row: FilterRow,
  fields: Map<string, FieldOption>,
  format: Format
): string => {
  const field = fields.get(row.field);
  const label = fieldLabel(row.field, field, format);
  const operator = format(operatorLabel(row.operator, field?.type));
  if (NO_VALUE_OPERATORS.includes(row.operator)) return `${label} ${operator}`;
  if (RANGE_OPERATORS.includes(row.operator)) {
    return format(msg('summary.range', '{field} {operator} {from} and {to}'), {
      field: label,
      operator,
      from: row.value,
      to: row.valueTo ?? '',
    });
  }
  const value = LIST_OPERATORS.includes(row.operator)
    ? splitList(row.value)
        .map((item) => valueLabel(item, field?.type, format))
        .join(', ')
    : valueLabel(row.value, field?.type, format);
  return `${label} ${operator} ${value}`;
};

/**
 * The whole filter as one sentence. Conditions are joined with "and" / "or" and a group is
 * put in brackets.
 * @param tree - Editor tree.
 * @param fields - Field options by path.
 * @param format - `formatMessage`.
 */
export const describeTree = (
  tree: Pick<FilterTree, 'match' | 'items'>,
  fields: Map<string, FieldOption>,
  format: Format
): string => {
  const and = ` ${format(msg('summary.and', 'and'))} `;
  const or = ` ${format(msg('summary.or', 'or'))} `;
  const outer = tree.match === 'any' ? or : and;
  const inner = tree.match === 'any' ? and : or;
  return tree.items
    .map((item) => {
      if (!isGroup(item)) return describeCondition(item, fields, format);
      const parts = item.conditions.map((row) => describeCondition(row, fields, format));
      return parts.length > 1 ? `(${parts.join(inner)})` : (parts[0] ?? '');
    })
    .filter(Boolean)
    .join(outer);
};
