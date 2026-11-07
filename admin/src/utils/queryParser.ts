// @ts-nocheck
/**
 * Parses URL query parameters and extracts filters, sorting, and population info
 * into a human-readable format
 */

export interface ParsedFilter {
  field: string;
  operator: string;
  value: string;
  logic?: 'AND' | 'OR';
}

export interface ParsedQuery {
  filters: ParsedFilter[];
  sort: string[];
  populate: string[];
  page?: number;
  pageSize?: number;
}

/**
 * Parses query string into structured filter information
 */
export const parseQueryString = (queryString: string): ParsedQuery => {
  const result: ParsedQuery = {
    filters: [],
    sort: [],
    populate: [],
  };

  if (!queryString) return result;

  const params = new URLSearchParams(queryString);

  // Parse all parameters
  params.forEach((value, key) => {
    // Parse filters
    if (key.startsWith('filters[')) {
      const filter = parseFilterKey(key, value);
      if (filter) {
        result.filters.push(filter);
      }
    }
    // Parse sorting
    else if (key === 'sort') {
      result.sort = value.split(',').map(s => s.trim());
    }
    // Parse population
    else if (key.startsWith('populate')) {
      const populateField = extractPopulateField(key);
      if (populateField && !result.populate.includes(populateField)) {
        result.populate.push(populateField);
      }
    }
    // Parse pagination
    else if (key === 'page') {
      result.page = parseInt(value);
    } else if (key === 'pageSize') {
      result.pageSize = parseInt(value);
    }
  });

  return result;
};

/**
 * Extracts filter information from a filter key
 * Example: filters[$and][0][blocked][$eq] = true
 */
const parseFilterKey = (key: string, value: string): ParsedFilter | null => {
  try {
    // Extract logic (AND/OR)
    let logic: 'AND' | 'OR' | undefined;
    if (key.includes('[$and]')) {
      logic = 'AND';
    } else if (key.includes('[$or]')) {
      logic = 'OR';
    }

    // Extract field name
    // filters[$and][0][blocked][$eq] -> blocked
    // filters[status][$eq] -> status
    const fieldMatch = key.match(/\[([^\]$]+)\](?=\[\$)/);
    const field = fieldMatch ? fieldMatch[1] : null;

    // Extract operator
    const operatorMatch = key.match(/\[\$(\w+)\]/);
    const operator = operatorMatch ? operatorMatch[1] : 'eq';

    if (!field) {
      console.warn('[QueryParser] Could not extract filter field');
      return null;
    }

    return {
      field: formatFieldName(field),
      operator: formatOperator(operator),
      value: value,
      logic,
    };
  } catch {
    console.error('[QueryParser] Could not parse filter entry');
    return null;
  }
};

/**
 * Extracts populate field name
 * Example: populate[author] = true -> author
 */
const extractPopulateField = (key: string): string | null => {
  const match = key.match(/populate\[([^\]]+)\]/);
  return match ? match[1] : null;
};

/**
 * Formats field name for display
 * Example: "blocked" -> "Blocked", "createdAt" -> "Created At"
 */
const formatFieldName = (field: string): string => {
  // Handle camelCase
  const formatted = field.replace(/([A-Z])/g, ' $1');
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

/**
 * Formats operator for display
 */
const formatOperator = (operator: string): string => {
  const operatorMap: Record<string, string> = {
    'eq': '=',
    'ne': '≠',
    'lt': '<',
    'lte': '≤',
    'gt': '>',
    'gte': '≥',
    'in': 'in',
    'notIn': 'not in',
    'contains': 'contains',
    'notContains': 'not contains',
    'containsi': 'contains (case insensitive)',
    'notContainsi': 'not contains (case insensitive)',
    'startsWith': 'starts with',
    'endsWith': 'ends with',
    'null': 'is null',
    'notNull': 'is not null',
  };
  return operatorMap[operator] || operator;
};

/**
 * Generates a human-readable summary of parsed query
 */
export const generateQuerySummary = (parsed: ParsedQuery): string => {
  const parts: string[] = [];

  // Filters
  if (parsed.filters.length > 0) {
    const filterTexts = parsed.filters.map(f => {
      const logic = f.logic ? `${f.logic} ` : '';
      return `${logic}${f.field} ${f.operator} ${f.value}`;
    });
    parts.push(`Filters: ${filterTexts.join(', ')}`);
  }

  // Sorting
  if (parsed.sort.length > 0) {
    parts.push(`Sort: ${parsed.sort.join(', ')}`);
  }

  // Population
  if (parsed.populate.length > 0) {
    parts.push(`Populate: ${parsed.populate.join(', ')}`);
  }

  // Pagination
  if (parsed.page || parsed.pageSize) {
    parts.push(`Page ${parsed.page || 1} (${parsed.pageSize || 10} items)`);
  }

  return parts.join(' | ') || 'No filters applied';
};

