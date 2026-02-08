// @ts-nocheck
/**
 * Generates correct Strapi v5 filter query strings from QueryBuilder structure
 * Based on: https://docs.strapi.io/cms/api/document-service/filters
 * Supports deep relation filtering (e.g., user.role.name)
 */

import qs from 'qs';

export interface Condition {
  id: string;
  field: string;
  /** Field path for deep filtering (e.g., ['user', 'role', 'name']) */
  fieldPath?: string[];
  operator: string;
  value: string;
}

export interface ConditionGroup {
  id: string;
  logic: 'AND' | 'OR';
  conditions: (Condition | ConditionGroup)[];
  isGroup?: boolean;
}

/**
 * Build a nested filter object from a field path
 * e.g., ['user', 'role', 'name'] with operator 'eq' and value 'Admin'
 * becomes: { user: { role: { name: { $eq: 'Admin' } } } }
 */
const buildNestedFilter = (fieldPath: string[], operator: string, value: string): any => {
  if (fieldPath.length === 0) return {};
  
  if (fieldPath.length === 1) {
    // Simple field - just the operator
    return {
      [fieldPath[0]]: {
        [`$${operator}`]: value
      }
    };
  }
  
  // Build nested structure from inside out
  const [first, ...rest] = fieldPath;
  return {
    [first]: buildNestedFilter(rest, operator, value)
  };
};

/**
 * Convert QueryBuilder structure to Strapi filter object
 * Supports deep relation filtering via fieldPath
 */
export const structureToFilters = (group: ConditionGroup): any => {
  const logic = group.logic.toLowerCase(); // 'and' or 'or'
  
  const conditions = group.conditions
    .filter(item => {
      // Filter out empty conditions
      if ((item as ConditionGroup).isGroup) return true;
      const cond = item as Condition;
      // Check if has either field or fieldPath
      const hasField = cond.field || (cond.fieldPath && cond.fieldPath.length > 0);
      // null/notNull operators don't need a value
      const needsValue = !['null', 'notNull'].includes(cond.operator);
      return hasField && (!needsValue || cond.value);
    })
    .map(item => {
      if ((item as ConditionGroup).isGroup) {
        // Nested group - recurse
        return structureToFilters(item as ConditionGroup);
      } else {
        // Simple or deep condition
        const cond = item as Condition;
        
        // Use fieldPath if available, otherwise use field
        const path = cond.fieldPath && cond.fieldPath.length > 0 
          ? cond.fieldPath 
          : [cond.field];
        
        // Handle null/notNull operators (no value needed)
        const value = ['null', 'notNull'].includes(cond.operator) ? true : cond.value;
        
        return buildNestedFilter(path, cond.operator, value);
      }
    });

  // If only one condition, don't wrap in $and/$or
  if (conditions.length === 1 && !(conditions[0].$and || conditions[0].$or)) {
    return conditions[0];
  }

  // Wrap in $and or $or
  return {
    [`$${logic}`]: conditions
  };
};

/**
 * Generate complete query string with filters, sort, and populate
 */
export const generateQueryString = (
  structure: ConditionGroup,
  sortField?: string,
  sortOrder?: 'ASC' | 'DESC',
  populateFields?: Array<{ name: string; enabled: boolean; deep: boolean }>
): string => {
  const queryObject: any = {};

  // Add filters
  if (structure && structure.conditions.length > 0) {
    const hasValidConditions = structure.conditions.some(item => {
      if ((item as ConditionGroup).isGroup) return true;
      const cond = item as Condition;
      return cond.field && cond.value;
    });

    if (hasValidConditions) {
      queryObject.filters = structureToFilters(structure);
    }
  }

  // Add sorting
  if (sortField) {
    // Don't add to queryObject - we'll add it manually to the query string
    // because Content Manager expects sort=field:order, not sort[0]=field:order
  }

  // Add populate
  if (populateFields && populateFields.length > 0) {
    const populate: any = {};
    populateFields.forEach(p => {
      if (p.enabled) {
        if (p.deep) {
          // Deep populate
          populate[p.name] = {
            populate: '*'
          };
        } else {
          // Simple populate
          populate[p.name] = true;
        }
      }
    });
    
    if (Object.keys(populate).length > 0) {
      queryObject.populate = populate;
    }
  }

  console.log('[QueryGenerator] Query object:', queryObject);

  // Use qs to generate proper URL query string
  let queryString = qs.stringify(queryObject, {
    encodeValuesOnly: true, // Pretty URLs
  });

  // Manually add sort parameter (Content Manager expects string, not array)
  if (sortField) {
    const sortParam = `sort=${sortField}:${sortOrder || 'ASC'}`;
    queryString = queryString ? `${queryString}&${sortParam}` : sortParam;
  }

  console.log('[QueryGenerator] Generated query string:', queryString);
  return queryString;
};

// ================ Flat Row Format (Strapi-Style Filter) ================

export interface FilterRow {
  id: string;
  field: string;    // "title" or "user.email" (dot notation for relations)
  operator: string; // "eq", "contains", "in", "between", etc.
  value: string;    // For single values or comma-separated for $in/$notIn
  valueTo?: string; // For $between operator (end of range)
  fieldType?: string; // "string", "integer", "datetime", "date", "boolean", etc.
  negate?: boolean; // For $not negation wrapper
}

export interface FilterGroup {
  id: string;
  logic: 'AND' | 'OR';
  items: Array<FilterRow | FilterGroup>; // Can contain rows or nested groups
  isGroup?: boolean; // Marker to distinguish from rows
}

/** Operator options per field type for UI */
export interface OperatorOption {
  value: string;
  label: string;
}

/**
 * Operators 1:1 from Strapi native Filters (@strapi/admin constants/filters)
 */
const BASE_FILTERS: OperatorOption[] = [
  { value: 'eq', label: 'is' },
  { value: 'ne', label: 'is not' },
  { value: 'null', label: 'is null' },
  { value: 'notNull', label: 'is not null' },
];

const NUMERIC_FILTERS: OperatorOption[] = [
  { value: 'gt', label: 'is greater than' },
  { value: 'gte', label: 'is greater than or equal to' },
  { value: 'lt', label: 'is less than' },
  { value: 'lte', label: 'is less than or equal to' },
];

const CONTAINS_FILTERS: OperatorOption[] = [
  { value: 'contains', label: 'contains' },
  { value: 'containsi', label: 'contains (case insensitive)' },
  { value: 'notContains', label: 'not contains' },
  { value: 'notContainsi', label: 'not contains (case insensitive)' },
];

const STRING_PARSE_FILTERS: OperatorOption[] = [
  { value: 'startsWith', label: 'starts with' },
  { value: 'startsWithi', label: 'starts with (case insensitive)' },
  { value: 'endsWith', label: 'ends with' },
  { value: 'endsWithi', label: 'ends with (case insensitive)' },
];

const IS_SENSITIVE_FILTERS: OperatorOption[] = [
  { value: 'eqi', label: 'is (case insensitive)' },
  { value: 'nei', label: 'is not (case insensitive)' },
];

const ARRAY_FILTERS: OperatorOption[] = [
  { value: 'in', label: 'is in' },
  { value: 'notIn', label: 'is not in' },
];

const RANGE_FILTERS: OperatorOption[] = [
  { value: 'between', label: 'is between' },
];

/**
 * Returns operators suitable for the given field type (1:1 match with Strapi native Filters + extended)
 */
export function getOperatorsForType(fieldType: string): OperatorOption[] {
  const t = (fieldType || 'string').toLowerCase();

  if (['string', 'text', 'email', 'uid', 'richtext'].includes(t)) {
    return [
      ...BASE_FILTERS,
      ...IS_SENSITIVE_FILTERS,
      ...CONTAINS_FILTERS,
      ...STRING_PARSE_FILTERS,
      ...ARRAY_FILTERS,
    ];
  }
  if (['integer', 'float', 'decimal', 'biginteger'].includes(t)) {
    return [
      ...BASE_FILTERS,
      ...NUMERIC_FILTERS,
      ...ARRAY_FILTERS,
      ...RANGE_FILTERS,
    ];
  }
  if (['datetime'].includes(t)) {
    return [
      ...BASE_FILTERS,
      ...NUMERIC_FILTERS,
      ...RANGE_FILTERS,
    ];
  }
  if (['date', 'time'].includes(t)) {
    return [
      ...BASE_FILTERS,
      ...NUMERIC_FILTERS,
      ...CONTAINS_FILTERS,
      ...RANGE_FILTERS,
    ];
  }
  if (['boolean'].includes(t)) {
    return BASE_FILTERS;
  }
  if (['enumeration'].includes(t)) {
    return [...BASE_FILTERS, ...ARRAY_FILTERS];
  }
  return [...BASE_FILTERS, ...IS_SENSITIVE_FILTERS];
}

export interface LogicConnector {
  logic: 'AND' | 'OR'; // between row[i] and row[i+1]
}

/**
 * Builds a nested filter object from a field path in dot notation
 * @param fieldPath - Path like "user.email" or "title"
 * @param operator - Strapi operator (eq, contains, in, between, etc.)
 * @param value - Filter value (comma-separated for $in/$notIn)
 * @param valueTo - End value for $between operator
 * @param negate - Wrap in $not for negation
 */
const buildFilterFromPath = (fieldPath: string, operator: string, value: string, valueTo?: string, negate?: boolean): any => {
  const parts = fieldPath.split('.').filter(Boolean);
  if (parts.length === 0) return {};

  const opKey = operator.startsWith('$') ? operator : `$${operator}`;
  
  let filterValue: any;
  if (['null', 'notNull'].includes(operator)) {
    filterValue = true;
  } else if (['in', 'notIn'].includes(operator)) {
    // Parse comma-separated values into array
    filterValue = value.split(',').map(v => v.trim()).filter(Boolean);
  } else if (operator === 'between' && valueTo) {
    // Between requires array [start, end]
    filterValue = [value, valueTo];
  } else {
    filterValue = value;
  }

  let result: any;
  if (parts.length === 1) {
    result = { [parts[0]]: { [opKey]: filterValue } };
  } else {
    const [first, ...rest] = parts;
    result = {
      [first]: buildFilterFromPath(rest.join('.'), operator, value, valueTo, false),
    };
  }

  // Wrap in $not if negation is requested
  if (negate) {
    return { $not: result };
  }

  return result;
};

/**
 * Extracts relation names from field paths (first segment of dotted paths)
 * @param field - Field path like "user.email" or "title"
 * @returns Relation name or null if direct field
 */
const extractRelationFromField = (field: string): string | null => {
  if (!field || !field.includes('.')) return null;
  return field.split('.')[0];
};

/**
 * Converts flat rows + connectors into a Strapi filter structure
 * Groups consecutive AND rows into $and blocks, connects groups with $or
 * Example: A AND B OR C AND D -> $or: [ $and: [A, B], C, $and: [D] ]
 */
const rowsToFilterStructure = (rows: FilterRow[], connectors: LogicConnector[]): any => {
  const validRows = rows.filter(r => {
    if (!r.field) return false;
    const needsValue = !['null', 'notNull'].includes(r.operator);
    return !needsValue || (r.value && r.value.trim() !== '');
  });

  if (validRows.length === 0) return undefined;
  if (validRows.length === 1) {
    return buildFilterFromPath(validRows[0].field, validRows[0].operator, validRows[0].value, validRows[0].valueTo, validRows[0].negate);
  }

  const groups: any[] = [];
  let currentAndGroup: any[] = [];

  validRows.forEach((row, i) => {
    const filter = buildFilterFromPath(row.field, row.operator, row.value, row.valueTo, row.negate);
    currentAndGroup.push(filter);

    const nextConnector = connectors[i];
    if (nextConnector?.logic === 'OR' || !nextConnector) {
      if (currentAndGroup.length === 1) {
        groups.push(currentAndGroup[0]);
      } else {
        groups.push({ $and: currentAndGroup });
      }
      currentAndGroup = [];
    }
  });

  if (currentAndGroup.length > 0) {
    if (currentAndGroup.length === 1) {
      groups.push(currentAndGroup[0]);
    } else {
      groups.push({ $and: currentAndGroup });
    }
  }

  if (groups.length === 1) return groups[0];
  return { $or: groups };
};

/**
 * Converts flat rows + connectors into a Strapi query string with auto-populate
 * @param rows - Filter rows with field, operator, value
 * @param connectors - Logic between rows (AND/OR)
 * @returns URL query string
 */
export const generateFromRows = (
  rows: FilterRow[],
  connectors: LogicConnector[]
): string => {
  const queryObject: any = {};

  const filterStructure = rowsToFilterStructure(rows, connectors);
  if (filterStructure) {
    queryObject.filters = filterStructure;
  }

  const relations = new Set<string>();
  rows.forEach(r => {
    const rel = extractRelationFromField(r.field);
    if (rel) relations.add(rel);
  });
  if (relations.size > 0) {
    const populate: Record<string, boolean> = {};
    relations.forEach(rel => { populate[rel] = true; });
    queryObject.populate = populate;
  }

  return qs.stringify(queryObject, { encodeValuesOnly: true });
};

/**
 * Recursively builds filter structure from nested groups
 */
const buildFilterFromGroup = (group: FilterGroup): any => {
  const validItems = group.items.filter(item => {
    if ('isGroup' in item && item.isGroup) return true; // Nested group
    const row = item as FilterRow;
    if (!row.field) return false;
    if (['null', 'notNull'].includes(row.operator)) return true;
    if (row.operator === 'between') return row.value?.trim() && row.valueTo?.trim();
    return row.value?.trim();
  });

  if (validItems.length === 0) return undefined;

  const conditions = validItems.map(item => {
    if ('isGroup' in item && item.isGroup) {
      // Nested group - recurse
      return buildFilterFromGroup(item as FilterGroup);
    }
    // Row
    const row = item as FilterRow;
    return buildFilterFromPath(row.field, row.operator, row.value, row.valueTo, row.negate);
  }).filter(Boolean);

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];

  const logicKey = group.logic === 'AND' ? '$and' : '$or';
  return { [logicKey]: conditions };
};

/**
 * Extract all relations from a group recursively
 */
const extractRelationsFromGroup = (group: FilterGroup): Set<string> => {
  const relations = new Set<string>();
  
  group.items.forEach(item => {
    if ('isGroup' in item && item.isGroup) {
      const nested = extractRelationsFromGroup(item as FilterGroup);
      nested.forEach(r => relations.add(r));
    } else {
      const row = item as FilterRow;
      const rel = extractRelationFromField(row.field);
      if (rel) relations.add(rel);
    }
  });

  return relations;
};

/**
 * Converts nested FilterGroup into a Strapi query string with auto-populate
 * @param group - Root filter group
 * @returns URL query string
 */
export const generateFromGroup = (group: FilterGroup): string => {
  const queryObject: any = {};

  const filterStructure = buildFilterFromGroup(group);
  if (filterStructure) {
    queryObject.filters = filterStructure;
  }

  const relations = extractRelationsFromGroup(group);
  if (relations.size > 0) {
    const populate: Record<string, boolean> = {};
    relations.forEach(rel => { populate[rel] = true; });
    queryObject.populate = populate;
  }

  return qs.stringify(queryObject, { encodeValuesOnly: true });
};

