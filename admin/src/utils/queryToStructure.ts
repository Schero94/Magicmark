// @ts-nocheck
import qs from 'qs';
/**
 * Converts URL query string back into QueryBuilder structure
 * Supports deep relation filtering (e.g., filters[user][email][$contains]=admin)
 */

export interface Condition {
  id: string;
  field: string;
  /** Field path for deep filtering (e.g., ['user', 'email']) */
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
 * Extract field path and operator from filter key parts
 * e.g., ['user', 'email', '$contains'] -> { fieldPath: ['user', 'email'], operator: 'contains' }
 */
const extractFieldPathAndOperator = (parts: string[]): { fieldPath: string[]; operator: string } | null => {
  // Find the operator (last part starting with $)
  let operatorIndex = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].startsWith('$')) {
      operatorIndex = i;
      break;
    }
  }
  
  if (operatorIndex === -1) return null;
  
  const operator = parts[operatorIndex].substring(1); // Remove $
  const fieldPath = parts.slice(0, operatorIndex);
  
  if (fieldPath.length === 0) return null;
  
  return { fieldPath, operator };
};

/**
 * Parse URL query parameters into QueryBuilder structure
 * Supports:
 * - Simple filters: filters[$and][0][field][$eq]=value
 * - Deep filters: filters[$and][0][user][email][$contains]=admin
 * - Very deep filters: filters[$and][0][user][role][name][$eq]=Admin
 * - Nested groups: filters[$and][1][$or][0][field][$eq]=value
 */
export const parseQueryToStructure = (queryString: string): ConditionGroup => {
  const params = new URLSearchParams(queryString);
  
  // Build a tree structure from filter params
  const filterTree: any = {};
  
  params.forEach((value, key) => {
    if (key.startsWith('filters[')) {
      // Parse the key structure
      const parts = key.match(/\[([^\]]+)\]/g)?.map(p => p.slice(1, -1)) || [];
      
      if (parts.length < 2) return; // Need at least [field][$op]
      
      // Check if first part is logic operator ($and/$or)
      if (parts[0].startsWith('$')) {
        // Format: filters[$and][0][field][$eq] or filters[$and][0][user][email][$contains]
        const logic = parts[0].substring(1); // Remove $
        const index = parseInt(parts[1]);
        
        if (isNaN(index)) return;
        
        // Check if nested group (third part is also a logic operator)
        if (parts[2].startsWith('$')) {
          // Nested: filters[$and][1][$or][0][user][email][$contains]
          const nestedLogic = parts[2].substring(1);
          const nestedIndex = parseInt(parts[3]);
          
          if (isNaN(nestedIndex)) return;
          
          // Remaining parts are field path + operator
          const remainingParts = parts.slice(4);
          const extracted = extractFieldPathAndOperator(remainingParts);
          
          if (!extracted) return;
          
          if (!filterTree[logic]) filterTree[logic] = {};
          if (!filterTree[logic][index]) filterTree[logic][index] = { nested: nestedLogic, items: {} };
          filterTree[logic][index].items[nestedIndex] = { 
            fieldPath: extracted.fieldPath,
            field: extracted.fieldPath[extracted.fieldPath.length - 1], // Last element for backward compat
            operator: extracted.operator, 
            value 
          };
        } else {
          // Simple or deep: filters[$and][0][user][email][$contains]
          const remainingParts = parts.slice(2);
          const extracted = extractFieldPathAndOperator(remainingParts);
          
          if (!extracted) return;
          
          if (!filterTree[logic]) filterTree[logic] = {};
          filterTree[logic][index] = { 
            fieldPath: extracted.fieldPath,
            field: extracted.fieldPath[extracted.fieldPath.length - 1], // Last element for backward compat
            operator: extracted.operator, 
            value 
          };
        }
      } else {
        // Format WITHOUT $and/$or: filters[user][email][$contains] or filters[field][$eq]
        // This happens when there's only a single condition (generator optimization)
        const extracted = extractFieldPathAndOperator(parts);
        
        if (!extracted) return;
        
        // Add to 'and' with index 0 by default
        if (!filterTree['and']) filterTree['and'] = {};
        filterTree['and'][0] = { 
          fieldPath: extracted.fieldPath,
          field: extracted.fieldPath[extracted.fieldPath.length - 1],
          operator: extracted.operator, 
          value 
        };
      }
    }
  });

  // Convert tree to QueryBuilder structure
  const rootLogic = Object.keys(filterTree)[0] || 'and';
  const rootGroup: ConditionGroup = {
    id: 'root',
    logic: rootLogic.toUpperCase() as 'AND' | 'OR',
    conditions: [],
  };

  let conditionId = 1;
  const rootItems = filterTree[rootLogic] || {};
  
  Object.keys(rootItems).sort((a, b) => parseInt(a) - parseInt(b)).forEach(index => {
    const item = rootItems[index];
    
    if (item.nested) {
      // Nested group
      const subGroup: ConditionGroup = {
        id: `group_${conditionId++}`,
        logic: item.nested.toUpperCase() as 'AND' | 'OR',
        conditions: [],
        isGroup: true,
      };
      
      Object.keys(item.items).sort((a, b) => parseInt(a) - parseInt(b)).forEach(subIndex => {
        const subItem = item.items[subIndex];
        subGroup.conditions.push({
          id: `condition_${conditionId++}`,
          field: subItem.field,
          fieldPath: subItem.fieldPath,
          operator: subItem.operator,
          value: subItem.value,
        });
      });
      
      rootGroup.conditions.push(subGroup);
    } else {
      // Simple or deep condition
      rootGroup.conditions.push({
        id: `condition_${conditionId++}`,
        field: item.field,
        fieldPath: item.fieldPath,
        operator: item.operator,
        value: item.value,
      });
    }
  });

  // If no conditions found, add empty one
  if (rootGroup.conditions.length === 0) {
    rootGroup.conditions.push({
      id: 'condition_1',
      field: '',
      fieldPath: [],
      operator: 'eq',
      value: '',
    });
  }

  return rootGroup;
};

// ================ Flat Row Format (Strapi-Style Filter) ================

export interface FilterRow {
  id: string;
  field: string;    // "title" or "user.email" (dot notation)
  operator: string;
  value: string;
  valueTo?: string;
  negate?: boolean;
}

export interface NestedFilterGroup {
  id: string;
  logic: 'AND' | 'OR';
  items: Array<FilterRow | NestedFilterGroup>;
  isGroup: true;
}

export interface LogicConnector {
  logic: 'AND' | 'OR';
}

/**
 * Flattens a ConditionGroup into a sequence of conditions with logic
 */
const flattenGroup = (
  group: ConditionGroup
): Array<{ condition: Condition; connectorBefore: 'AND' | 'OR' | null }> => {
  const result: Array<{ condition: Condition; connectorBefore: 'AND' | 'OR' | null }> = [];
  const logic = group.logic;

  group.conditions.forEach((item, i) => {
    const connectorBefore = i === 0 ? null : logic;
    if ('isGroup' in item && item.isGroup) {
      const sub = flattenGroup(item as ConditionGroup);
      sub.forEach((s, j) => {
        result.push({
          condition: s.condition,
          connectorBefore: j === 0 ? connectorBefore : s.connectorBefore,
        });
      });
    } else {
      result.push({ condition: item as Condition, connectorBefore });
    }
  });
  return result;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Parse a serialized Strapi filter tree into the recursive structure used by
 * the advanced filter editor. Query-string values are decoded by `qs` once.
 * @param queryString URL query parameters, with or without a leading question mark.
 * @returns A root AND/OR group containing the saved filter tree.
 */
export const parseQueryToFilterGroup = (queryString: string): NestedFilterGroup => {
  let nextId = 0;
  const createId = (prefix: 'group' | 'row') => `${prefix}_${++nextId}`;

  const parseRows = (
    node: unknown,
    fieldPath: string[] = [],
    negate = false,
  ): FilterRow[] => {
    if (!isRecord(node)) return [];

    return Object.entries(node).flatMap(([key, value]) => {
      if (key === '$not') return parseRows(value, fieldPath, !negate);
      if (key.startsWith('$')) {
        if (fieldPath.length === 0) return [];
        const operator = key.slice(1);
        const range = operator === 'between' && Array.isArray(value) ? value : undefined;
        const normalizedValue = range
          ? String(range[0] ?? '')
          : Array.isArray(value)
            ? value.map((entry) => String(entry ?? '')).join(',')
            : String(value ?? '');
        return [{
          id: createId('row'),
          field: fieldPath.join('.'),
          operator,
          value: normalizedValue,
          ...(range ? { valueTo: String(range[1] ?? '') } : {}),
          ...(negate ? { negate: true } : {}),
        }];
      }
      if (isRecord(value)) return parseRows(value, [...fieldPath, key], negate);
      return [];
    });
  };

  const parseGroup = (
    node: unknown,
    fallbackLogic: 'AND' | 'OR' = 'AND',
    isRoot = false,
  ): NestedFilterGroup => {
    const group: NestedFilterGroup = {
      id: isRoot ? 'root' : createId('group'),
      logic: fallbackLogic,
      items: [],
      isGroup: true,
    };
    if (!isRecord(node)) return group;

    const logicKey = Object.prototype.hasOwnProperty.call(node, '$or')
      ? '$or'
      : Object.prototype.hasOwnProperty.call(node, '$and')
        ? '$and'
        : null;

    if (!logicKey) {
      group.items.push(...parseRows(node));
      return group;
    }

    group.logic = logicKey === '$or' ? 'OR' : 'AND';
    const children = node[logicKey];
    const childNodes = Array.isArray(children)
      ? children
      : isRecord(children)
        ? Object.entries(children)
            .filter(([index]) => /^(0|[1-9]\d*)$/.test(index))
            .sort(([left], [right]) => Number(left) - Number(right))
            .map(([, child]) => child)
        : [];

    childNodes.forEach((child) => {
      if (isRecord(child) && (
        Object.prototype.hasOwnProperty.call(child, '$and') ||
        Object.prototype.hasOwnProperty.call(child, '$or')
      )) {
        group.items.push(parseGroup(child, group.logic));
      } else {
        group.items.push(...parseRows(child));
      }
    });
    return group;
  };

  try {
    const parsed = qs.parse(queryString.replace(/^\?/, ''), {
      allowPrototypes: false,
      depth: 16,
      parameterLimit: 500,
    }) as Record<string, unknown>;
    const filters = isRecord(parsed.filters) ? parsed.filters : {};
    const root = parseGroup(filters, 'AND', true);
    if (root.items.length === 0) {
      root.items.push({ id: createId('row'), field: '', operator: 'eq', value: '' });
    }
    return root;
  } catch {
    return {
      id: 'root',
      logic: 'AND',
      isGroup: true,
      items: [{ id: 'row_1', field: '', operator: 'eq', value: '' }],
    };
  }
};

/**
 * Parses URL query string into flat rows + connectors for StrapiStyleFilterModal
 * @param queryString - URL query string (e.g. from location.search)
 * @returns { rows, connectors } for re-opening modal with existing filters
 */
export const parseQueryToRows = (
  queryString: string
): { rows: FilterRow[]; connectors: LogicConnector[] } => {
  const structure = parseQueryToStructure(queryString);
  const flattened = flattenGroup(structure);

  const rows: FilterRow[] = [];
  const connectors: LogicConnector[] = [];

  flattened.forEach((item, i) => {
    const cond = item.condition;
    const field = cond.fieldPath && cond.fieldPath.length > 0
      ? cond.fieldPath.join('.')
      : cond.field || '';
    const needsValue = !['null', 'notNull'].includes(cond.operator);
    if (!field && needsValue) return;

    rows.push({
      id: cond.id || `row_${i + 1}`,
      field,
      operator: cond.operator,
      value: cond.value || '',
    });
    if (item.connectorBefore && i > 0) {
      connectors.push({ logic: item.connectorBefore });
    }
  });

  for (let i = connectors.length; i < Math.max(0, rows.length - 1); i++) {
    connectors.push({ logic: 'AND' });
  }

  return { rows, connectors };
};

/**
 * Parse individual filter parameter
 * Example: filters[$and][0][blocked][$eq] = true
 * Returns: { logic: 'and', index: 0, field: 'blocked', operator: 'eq', value: 'true' }
 */
const parseFilterParam = (key: string, value: string): { logic: string; index: number; field: string; operator: string; value: string } | null => {
  try {
    // Extract components
    // filters[$and][0][blocked][$eq] -> logic: and, index: 0, field: blocked, operator: eq
    
    const logicMatch = key.match(/\[\$(\w+)\]/);
    const logic = logicMatch ? logicMatch[1] : 'and';
    
    const indexMatch = key.match(/\]\[(\d+)\]\[/);
    const index = indexMatch ? parseInt(indexMatch[1]) : 0;
    
    const fieldMatch = key.match(/\[(\w+)\]\[\$/);
    const field = fieldMatch ? fieldMatch[1] : '';
    
    const operatorMatch = key.match(/\[\$(\w+)\]$/);
    const operator = operatorMatch ? operatorMatch[1] : 'eq';

    if (field) {
      return {
        logic,
        index,
        field,
        operator,
        value,
      };
    }
    
    return null;
  } catch (error) {
    console.error('[QueryParser] Could not parse filter entry');
    return null;
  }
};

