/**
 * Translation helpers. Every plugin message is declared with the msg() helper below, so a test
 * can extract all ids and default messages from the source and compare them with en.json.
 */
import type { MessageDescriptor } from 'react-intl';
import pluginId from '../pluginId';

/**
 * Builds a plugin message descriptor.
 * @param key - Key in translations/<locale>.json, without the plugin prefix.
 * @param defaultMessage - English text; must equal the en.json value.
 * @returns `{ id: 'magic-mark.<key>', defaultMessage }`.
 */
export const msg = (key: string, defaultMessage: string): MessageDescriptor => ({
  id: `${pluginId}.${key}`,
  defaultMessage,
});

/** Native Strapi operator labels (admin catalogue), so the wording matches the native filters. */
export const NATIVE_OPERATOR_LABELS: Record<string, string> = {
  $eq: 'is',
  $ne: 'is not',
  $null: 'is null',
  $notNull: 'is not null',
  $eqi: 'is (case insensitive)',
  $nei: 'is not (case insensitive)',
  $contains: 'contains',
  $containsi: 'contains (case insensitive)',
  $notContains: 'does not contain',
  $notContainsi: 'does not contain (case insensitive)',
  $startsWith: 'starts with',
  $startsWithi: 'starts with (case insensitive)',
  $endsWith: 'ends with',
  $endsWithi: 'ends with (case insensitive)',
  $gt: 'is greater than',
  $gte: 'is greater than or equal to',
  $lt: 'is lower than',
  $lte: 'is lower than or equal to',
};

/** Operators the native catalogue lacks; translated by the plugin. */
export const PLUGIN_OPERATOR_LABELS: Record<string, MessageDescriptor> = {
  $in: msg('operators.in', 'is one of'),
  $notIn: msg('operators.notIn', 'is none of'),
  $between: msg('operators.between', 'is between'),
};

/** Plain-language labels for every operator, by kind of field (see {@link operatorLabel}). */
const PLAIN_LABELS: Record<string, MessageDescriptor> = {
  $eq: msg('operators.is', 'is'),
  $ne: msg('operators.isNot', 'is not'),
  $eqi: msg('operators.isAnyCase', 'is (ignoring case)'),
  $nei: msg('operators.isNotAnyCase', 'is not (ignoring case)'),
  $containsi: msg('operators.contains', 'contains'),
  $notContainsi: msg('operators.notContains', 'does not contain'),
  $startsWithi: msg('operators.startsWith', 'starts with'),
  $endsWithi: msg('operators.endsWith', 'ends with'),
  $contains: msg('operators.containsCase', 'contains (matching case)'),
  $notContains: msg('operators.notContainsCase', 'does not contain (matching case)'),
  $startsWith: msg('operators.startsWithCase', 'starts with (matching case)'),
  $endsWith: msg('operators.endsWithCase', 'ends with (matching case)'),
  $null: msg('operators.isEmpty', 'is empty'),
  $notNull: msg('operators.isNotEmpty', 'is not empty'),
  $gt: msg('operators.greaterThan', 'is greater than'),
  $gte: msg('operators.atLeast', 'is at least'),
  $lt: msg('operators.lessThan', 'is less than'),
  $lte: msg('operators.atMost', 'is at most'),
  ...PLUGIN_OPERATOR_LABELS,
};

/** Date and time fields read better with before / after. */
const DATE_LABELS: Record<string, MessageDescriptor> = {
  $eq: msg('operators.isOn', 'is on'),
  $ne: msg('operators.isNotOn', 'is not on'),
  $gt: msg('operators.after', 'is after'),
  $gte: msg('operators.onOrAfter', 'is on or after'),
  $lt: msg('operators.before', 'is before'),
  $lte: msg('operators.onOrBefore', 'is on or before'),
};

const DATE_TYPES = new Set(['date', 'datetime', 'time']);

/**
 * Message descriptor for an operator label, in plain words for the field type
 * ("is on or after" for dates, "is at least" for numbers, "is empty" for `$null`).
 * @param operator - e.g. `$eq`.
 * @param type - Attribute type of the field, when known.
 */
export const operatorLabel = (operator: string, type?: string): MessageDescriptor =>
  (type && DATE_TYPES.has(type) ? DATE_LABELS[operator] : undefined) ??
  PLAIN_LABELS[operator] ?? {
    id: `components.FilterOptions.FILTER_TYPES.${operator}`,
    defaultMessage: NATIVE_OPERATOR_LABELS[operator] ?? operator,
  };
