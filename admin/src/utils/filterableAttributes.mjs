const SYSTEM_FIELDS = new Set(['createdBy', 'updatedBy', 'localizations', 'locale']);
const NON_FILTERABLE_TYPES = new Set(['component', 'dynamiczone', 'media']);

/**
 * Determines whether a schema attribute is safe and supported in the filter UI.
 *
 * @param {string} name Attribute name from the server-owned content-type schema.
 * @param {object} attribute Strapi attribute metadata.
 * @param {object} [metadata] Content Manager visibility and search metadata.
 * @returns {boolean} True when the attribute is visible, searchable and supported.
 */
export const isFilterableAttribute = (name, attribute, metadata = {}) => (
  !SYSTEM_FIELDS.has(name)
  && attribute?.private !== true
  && attribute?.hidden !== true
  && attribute?.searchable !== false
  && metadata?.edit?.visible !== false
  && metadata?.list?.searchable !== false
  && !NON_FILTERABLE_TYPES.has(attribute?.type)
);

/**
 * Splits schema attributes into safe scalar fields and Content API relations.
 * Plugin-internal relation targets are omitted because their schemas are not
 * available to the Content Manager filter builder.
 *
 * @param {Record<string, object>} attributes Strapi content-type attributes.
 * @param {Record<string, object>} [metadata] Content Manager field metadata.
 * @returns {{fields: Array<{name: string, type: string}>, relations: Array<{name: string, target: string}>}}
 */
export const getFilterableAttributes = (attributes = {}, metadata = {}) => {
  const fields = [];
  const relations = [];
  const fieldNames = new Set();

  for (const [name, attribute] of Object.entries(attributes)) {
    if (!isFilterableAttribute(name, attribute, metadata[name])) continue;

    if (attribute.type === 'relation') {
      if (typeof attribute.target === 'string' && attribute.target.startsWith('api::')) {
        relations.push({ name, target: attribute.target });
      }
      continue;
    }

    fieldNames.add(name);
    fields.push({ name, type: attribute.type || 'string' });
  }

  for (const [name, type] of [
    ['id', 'integer'],
    ['documentId', 'string'],
    ['createdAt', 'datetime'],
    ['updatedAt', 'datetime'],
  ]) {
    if (fieldNames.has(name) || SYSTEM_FIELDS.has(name)) continue;
    fields.unshift({ name, type });
    fieldNames.add(name);
  }

  return { fields, relations };
};
