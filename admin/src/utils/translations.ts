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

/**
 * Message descriptor for an operator label.
 * @param operator - e.g. `$eq`.
 */
export const operatorLabel = (operator: string): MessageDescriptor =>
  PLUGIN_OPERATOR_LABELS[operator] ?? {
    id: `components.FilterOptions.FILTER_TYPES.${operator}`,
    defaultMessage: NATIVE_OPERATOR_LABELS[operator] ?? operator,
  };
