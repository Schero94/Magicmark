// @ts-nocheck
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
      
      console.log('[QueryParser] Parsing key:', key, 'parts:', parts);
      
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
        console.log('[QueryParser] Parsing simple filter without logic operator');
        
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

  console.log('[QueryParser] Filter tree:', filterTree);

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
          value: decodeURIComponent(subItem.value),
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
        value: decodeURIComponent(item.value),
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

  console.log('[QueryParser] Built structure:', rootGroup);
  return rootGroup;
};

// ================ Flat Row Format (Strapi-Style Filter) ================

export interface FilterRow {
  id: string;
  field: string;    // "title" or "user.email" (dot notation)
  operator: string;
  value: string;
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
        value: decodeURIComponent(value),
      };
    }
    
    return null;
  } catch (error) {
    console.error('[QueryParser] Error parsing filter:', key, error);
    return null;
  }
};

