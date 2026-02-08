// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  DatePicker,
  DateTimePicker,
  Flex,
  NumberInput,
  SingleSelect,
  SingleSelectOption,
  TextInput,
  TimePicker,
  Typography,
  Tag,
} from '@strapi/design-system';
import { Cross as CrossIcon } from '@strapi/icons';
import { Cross } from '@strapi/icons';
import styled from 'styled-components';
import CustomSelect from './CustomSelect';
import { useRelationSchema } from '../hooks/useRelationSchema';
import { generateFromRows, generateFromGroup, getOperatorsForType, type FilterRow, type FilterGroup as FilterGroupType, type LogicConnector } from '../utils/queryGenerator';
import { parseQueryToRows } from '../utils/queryToStructure';

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 400;
  padding: 20px;
  @media (max-width: 768px) {
    padding: 10px;
  }
`;

const ModalContent = styled(Box)`
  background: ${(p) => p.theme.colors.neutral0};
  border-radius: 8px;
  max-height: 90vh;
  max-width: 720px;
  width: 100%;
  min-height: 400px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  @media (max-width: 768px) {
    max-width: 100%;
    max-height: 92vh;
  }
`;

const ModalScrollArea = styled.div`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
`;

const RowWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
`;

const FilterRowCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: ${(p) => p.theme.colors.neutral100};
  border-radius: 6px;
  border: 1px solid ${(p) => p.theme.colors.neutral200};
`;

const FilterRowTop = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const NegateCheckbox = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: ${(p) => p.theme.colors.neutral700};
  cursor: pointer;
  user-select: none;
  input {
    cursor: pointer;
  }
`;

const FilterRowValue = styled.div`
  width: 100%;
  padding-top: 14px;
  padding-bottom: 4px;
  border-top: 1px solid ${(p) => p.theme.colors.neutral200};
`;

const ValueLabel = styled.span`
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: ${(p) => p.theme.colors.neutral600};
  margin-bottom: 8px;
`;

const FieldTypeBadge = styled.span`
  font-size: 10px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  background: ${(p) => p.theme.colors.neutral200};
  color: ${(p) => p.theme.colors.neutral700};
  text-transform: uppercase;
`;

const MultiValueWrapper = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 32px;
  padding: 6px 8px;
  border: 1px solid ${(p) => p.theme.colors.neutral200};
  border-radius: 4px;
  background: ${(p) => p.theme.colors.neutral0};
  &:focus-within {
    border-color: #4945ff;
    box-shadow: 0 0 0 2px rgba(73, 69, 255, 0.1);
  }
`;

const MultiValueInput = styled.input`
  flex: 1;
  min-width: 80px;
  border: none;
  background: transparent;
  font-size: 14px;
  color: ${(p) => p.theme.colors.neutral800};
  &:focus {
    outline: none;
  }
  &::placeholder {
    color: ${(p) => p.theme.colors.neutral500};
  }
`;

const BetweenWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
`;

const BetweenSeparator = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: ${(p) => p.theme.colors.neutral600};
`;

/**
 * Renders the appropriate Strapi DS input based on field type and operator
 */
function SmartValueInput({
  fieldType,
  operator,
  value,
  valueTo,
  onChange,
  onValueToChange,
  placeholder = 'Value',
}: {
  fieldType?: string;
  operator: string;
  value: string;
  valueTo?: string;
  onChange: (value: string) => void;
  onValueToChange?: (value: string) => void;
  placeholder?: string;
}) {
  const t = (fieldType || 'string').toLowerCase();
  const [inputValue, setInputValue] = React.useState('');

  // Handle $in/$notIn - multi-value with tags
  if (['in', 'notIn'].includes(operator)) {
    const values = value ? value.split(',').map(v => v.trim()).filter(Boolean) : [];
    
    const handleAddValue = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const newVal = inputValue.trim();
        if (newVal && !values.includes(newVal)) {
          const updated = [...values, newVal].join(',');
          onChange(updated);
          setInputValue('');
        }
      }
    };

    const handleRemoveValue = (val: string) => {
      const updated = values.filter(v => v !== val).join(',');
      onChange(updated);
    };

    return (
      <Box style={{ width: '100%' }}>
        <MultiValueWrapper>
          {values.map(val => (
            <Tag
              key={val}
              icon={<CrossIcon />}
              onClick={() => handleRemoveValue(val)}
            >
              {val}
            </Tag>
          ))}
          <MultiValueInput
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleAddValue}
            placeholder={values.length === 0 ? 'Type and press Enter' : ''}
          />
        </MultiValueWrapper>
      </Box>
    );
  }

  // Handle $between - dual input (field-type-aware)
  if (operator === 'between') {
    // Date between
    if (['date'].includes(t)) {
      const dateVal1 = value ? (() => { try { const d = new Date(value); return isNaN(d.getTime()) ? undefined : d; } catch { return undefined; } })() : undefined;
      const dateVal2 = valueTo ? (() => { try { const d = new Date(valueTo); return isNaN(d.getTime()) ? undefined : d; } catch { return undefined; } })() : undefined;
      return (
        <BetweenWrapper>
          <Box style={{ flex: 1 }}>
            <DatePicker value={dateVal1} onChange={(d) => onChange(d ? d.toISOString().slice(0, 10) : '')} clearLabel="Clear" size="S" />
          </Box>
          <BetweenSeparator>and</BetweenSeparator>
          <Box style={{ flex: 1 }}>
            <DatePicker value={dateVal2} onChange={(d) => onValueToChange?.(d ? d.toISOString().slice(0, 10) : '')} clearLabel="Clear" size="S" />
          </Box>
        </BetweenWrapper>
      );
    }
    
    // Number between
    if (['integer', 'float', 'decimal', 'biginteger'].includes(t)) {
      const num1 = value === '' ? undefined : (() => { const n = parseFloat(value); return isNaN(n) ? undefined : n; })();
      const num2 = valueTo === '' || !valueTo ? undefined : (() => { const n = parseFloat(valueTo); return isNaN(n) ? undefined : n; })();
      return (
        <BetweenWrapper>
          <Box style={{ flex: 1 }}>
            <NumberInput value={num1} onValueChange={(v) => onChange(v !== undefined ? String(v) : '')} size="S" />
          </Box>
          <BetweenSeparator>and</BetweenSeparator>
          <Box style={{ flex: 1 }}>
            <NumberInput value={num2} onValueChange={(v) => onValueToChange?.(v !== undefined ? String(v) : '')} size="S" />
          </Box>
        </BetweenWrapper>
      );
    }
    
    // Default text between
    return (
      <BetweenWrapper>
        <Box style={{ flex: 1 }}>
          <TextInput value={value} onChange={(e) => onChange(e.target.value)} placeholder="From" size="S" />
        </Box>
        <BetweenSeparator>and</BetweenSeparator>
        <Box style={{ flex: 1 }}>
          <TextInput value={valueTo || ''} onChange={(e) => onValueToChange?.(e.target.value)} placeholder="To" size="S" />
        </Box>
      </BetweenWrapper>
    );
  }

  // Regular single-value inputs
  if (['date'].includes(t)) {
    const dateVal = value ? (() => {
      try {
        const d = new Date(value);
        return isNaN(d.getTime()) ? undefined : d;
      } catch {
        return undefined;
      }
    })() : undefined;
    return (
      <Box style={{ width: '100%', minWidth: 140 }}>
        <DatePicker
          value={dateVal}
          onChange={(d) => onChange(d ? d.toISOString().slice(0, 10) : '')}
          clearLabel="Clear"
          size="S"
        />
      </Box>
    );
  }

  if (['datetime'].includes(t)) {
    const dateVal = value ? (() => {
      try {
        const d = new Date(value);
        return isNaN(d.getTime()) ? undefined : d;
      } catch {
        return undefined;
      }
    })() : undefined;
    return (
      <Box style={{ width: '100%', minWidth: 200 }}>
        <DateTimePicker
          value={dateVal ?? undefined}
          onChange={(d) => onChange(d ? d.toISOString() : '')}
          clearLabel="Clear"
          size="S"
        />
      </Box>
    );
  }

  if (['time'].includes(t)) {
    return (
      <Box style={{ width: '100%', minWidth: 120 }}>
        <TimePicker
          value={value || undefined}
          onChange={(v) => onChange(v ?? '')}
          size="S"
        />
      </Box>
    );
  }

  if (['integer', 'float', 'decimal', 'biginteger'].includes(t)) {
    const numVal = value === '' ? undefined : (() => {
      const n = parseFloat(value);
      return isNaN(n) ? undefined : n;
    })();
    return (
      <Box style={{ width: '100%', minWidth: 120 }}>
        <NumberInput
          value={numVal}
          onValueChange={(v) => onChange(v !== undefined ? String(v) : '')}
          size="S"
        />
      </Box>
    );
  }

  if (['boolean'].includes(t)) {
    const selVal = value === 'true' ? 'true' : value === 'false' ? 'false' : '';
    return (
      <Box style={{ width: '100%', minWidth: 120 }}>
        <SingleSelect
          value={selVal || undefined}
          onChange={(v) => onChange(v != null ? String(v) : '')}
          placeholder={placeholder}
          size="S"
        >
          <SingleSelectOption value="true">true</SingleSelectOption>
          <SingleSelectOption value="false">false</SingleSelectOption>
        </SingleSelect>
      </Box>
    );
  }

  return (
    <Box style={{ width: '100%', minWidth: 120 }}>
      <TextInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        size="S"
      />
    </Box>
  );
}

const ConnectorPill = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 0;
`;

const ConnectorButton = styled.button<{ $active: boolean }>`
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid ${(p) => p.$active ? '#4945ff' : p.theme.colors.neutral300};
  border-radius: 999px;
  background: ${(p) => p.$active ? '#EEF0FF' : 'transparent'};
  color: ${(p) => p.$active ? '#4945ff' : p.theme.colors.neutral700};
  cursor: pointer;
  transition: all 0.15s ease;
  &:hover {
    border-color: #4945ff;
  }
`;

const ActiveBadge = styled.span`
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(73, 69, 255, 0.12);
  color: #4945ff;
  margin-left: 8px;
`;

const DeleteButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(239, 68, 68, 0.06);
  color: #dc2626;
  border-radius: 4px;
  cursor: pointer;
  flex-shrink: 0;
  &:hover {
    background: rgba(239, 68, 68, 0.12);
  }
  svg {
    width: 14px;
    height: 14px;
  }
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  border: 1px dashed rgba(128, 128, 128, 0.25);
  border-radius: 4px;
  background: ${(p) => p.theme.colors.neutral100};
  color: #4945ff;
  cursor: pointer;
  transition: all 0.15s ease;
  &:hover {
    border-color: #4945ff;
    background: rgba(73, 69, 255, 0.06);
  }
`;

const InfoText = styled.div`
  font-size: 12px;
  color: ${(p) => p.theme.colors.neutral600};
  margin-top: 8px;
  font-style: italic;
`;

const ModalFooter = styled.div`
  flex-shrink: 0;
  padding-top: 16px;
  border-top: 1px solid ${(p) => p.theme.colors.neutral200};
  margin-top: 8px;
`;

const GroupContainer = styled.div<{ $logic: 'AND' | 'OR'; $level: number }>`
  border: 2px solid ${(p) => p.$logic === 'AND' ? '#0EA5E9' : '#F97316'};
  border-radius: 8px;
  padding: 16px;
  margin: ${(p) => p.$level > 0 ? '12px 0 12px 20px' : '0'};
  background: ${(p) => p.$logic === 'AND' ? 'rgba(14, 165, 233, 0.03)' : 'rgba(249, 115, 22, 0.03)'};
  position: relative;
  ${(p) => p.$level > 0 && `border-style: dashed;`}
`;

const GroupHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid ${(p) => p.theme.colors.neutral200};
`;

const LogicBadge = styled.div<{ $logic: 'AND' | 'OR' }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: ${(p) => p.$logic === 'AND' ? '#0284C7' : '#EA580C'};
`;

const LogicToggleButton = styled.button<{ $active: boolean; $logic: 'AND' | 'OR' }>`
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid ${(p) => p.$logic === 'AND' ? '#0EA5E9' : '#F97316'};
  background: ${(p) => p.$active ? (p.$logic === 'AND' ? '#0EA5E9' : '#F97316') : 'transparent'};
  color: ${(p) => p.$active ? 'white' : (p.$logic === 'AND' ? '#0284C7' : '#EA580C')};
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  &:hover {
    transform: scale(1.05);
  }
`;

const GroupActions = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
`;

const SmallButton = styled.button`
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid ${(p) => p.theme.colors.neutral300};
  border-radius: 4px;
  background: ${(p) => p.theme.colors.neutral0};
  color: ${(p) => p.theme.colors.neutral700};
  cursor: pointer;
  &:hover {
    border-color: #4945ff;
    background: rgba(73, 69, 255, 0.06);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const RemoveGroupButton = styled(SmallButton)`
  color: #dc2626;
  border-color: rgba(239, 68, 68, 0.3);
  &:hover {
    border-color: #dc2626;
    background: rgba(239, 68, 68, 0.06);
  }
`;

interface FieldOption {
  value: string;
  label: string;
  group: string;
  type?: string;
}

interface StrapiStyleFilterModalProps {
  onClose: () => void;
  onApply: (queryString: string) => void;
  availableFields: Array<{ name: string; type: string }>;
  availableRelations?: Array<{ name: string; target?: string }>;
  currentQuery?: string;
  enableNestedGroups?: boolean; // Premium feature flag
}

/**
 * Strapi-style filter modal with flat rows and AND/OR connectors
 */
const StrapiStyleFilterModal: React.FC<StrapiStyleFilterModalProps> = ({
  onClose,
  onApply,
  availableFields,
  availableRelations = [],
  currentQuery = '',
  enableNestedGroups = false,
}) => {
  const { getRelationFields } = useRelationSchema();
  const [fieldOptions, setFieldOptions] = useState<FieldOption[]>([]);
  
  // State: Flat rows (for simple mode) OR nested groups (for advanced mode)
  const [rows, setRows] = useState<FilterRow[]>([]);
  const [connectors, setConnectors] = useState<LogicConnector[]>([]);
  const [rootGroup, setRootGroup] = useState<FilterGroupType | null>(null);

  const buildFieldOptions = useCallback(async () => {
    const direct: FieldOption[] = availableFields.map(f => ({
      value: f.name,
      label: f.name,
      group: 'Fields',
      type: f.type,
    }));

    const relationOptions: FieldOption[] = [];
    for (const rel of availableRelations) {
      if (!rel.target) continue;
      try {
        const nestedFields = await getRelationFields(rel.target);
        if (nestedFields) {
          nestedFields
            .filter(f => !f.isRelation)
            .forEach(f => {
              relationOptions.push({
                value: `${rel.name}.${f.name}`,
                label: `${rel.name} > ${f.name}`,
                group: 'Relations',
                type: f.type,
              });
            });
        }
      } catch (e) {
        console.warn('[StrapiStyleFilter] Failed to load relation fields:', rel.name, e);
      }
    }

    setFieldOptions([...direct, ...relationOptions]);
  }, [availableFields, availableRelations, getRelationFields]);

  useEffect(() => {
    buildFieldOptions();
  }, [buildFieldOptions]);

  useEffect(() => {
    if (enableNestedGroups) {
      // Initialize with root group
      setRootGroup({
        id: 'root',
        logic: 'AND',
        items: [{
          id: `row_${Date.now()}`,
          field: '',
          operator: 'eq',
          value: '',
        }],
        isGroup: true,
      });
    } else {
      // Flat mode
      if (currentQuery) {
        const { rows: parsedRows, connectors: parsedConnectors } = parseQueryToRows(currentQuery);
        if (parsedRows.length > 0) {
          setRows(parsedRows);
          setConnectors(parsedConnectors);
          return;
        }
      }
      setRows([{
        id: `row_${Date.now()}`,
        field: '',
        operator: 'eq',
        value: '',
      }]);
      setConnectors([]);
    }
  }, [currentQuery, enableNestedGroups]);

  /** Enrich rows with fieldType from fieldOptions when options load */
  useEffect(() => {
    if (fieldOptions.length === 0) return;
    if (!enableNestedGroups) {
      setRows(prev => prev.map(r => {
        if (!r.field || r.fieldType) return r;
        const opt = fieldOptions.find(f => f.value === r.field);
        return opt?.type ? { ...r, fieldType: opt.type } : r;
      }));
    } else if (rootGroup) {
      const enrichGroup = (group: FilterGroupType): FilterGroupType => ({
        ...group,
        items: group.items.map(item => {
          if ('isGroup' in item && item.isGroup) {
            return enrichGroup(item as FilterGroupType);
          }
          const row = item as FilterRow;
          if (!row.field || row.fieldType) return row;
          const opt = fieldOptions.find(f => f.value === row.field);
          return opt?.type ? { ...row, fieldType: opt.type } : row;
        }),
      });
      setRootGroup(prev => prev ? enrichGroup(prev) : prev);
    }
  }, [fieldOptions, enableNestedGroups]);

  const relationsInUse = enableNestedGroups && rootGroup 
    ? (() => {
        const relations = new Set<string>();
        const extract = (group: FilterGroupType) => {
          group.items.forEach(item => {
            if ('isGroup' in item && item.isGroup) {
              extract(item as FilterGroupType);
            } else {
              const row = item as FilterRow;
              if (row.field?.includes('.')) {
                relations.add(row.field.split('.')[0]);
              }
            }
          });
        };
        extract(rootGroup);
        return relations;
      })()
    : new Set(
        rows
          .map(r => r.field.includes('.') ? r.field.split('.')[0] : null)
          .filter(Boolean)
      );

  // ========== Flat Mode Functions ==========
  const updateRow = (index: number, updates: Partial<FilterRow>) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== index) return r;
      const merged = { ...r, ...updates };
      if ('field' in updates && updates.field !== undefined) {
        const opt = fieldOptions.find(f => f.value === updates.field);
        merged.fieldType = opt?.type;
        const ops = getOperatorsForType(opt?.type || 'string');
        const firstOp = ops[0]?.value ?? 'eq';
        if (!ops.some(o => o.value === merged.operator)) {
          merged.operator = firstOp;
        }
      }
      return merged;
    }));
  };

  const updateConnector = (index: number, logic: 'AND' | 'OR') => {
    setConnectors(prev => {
      const next = [...prev];
      next[index] = { logic };
      return next;
    });
  };

  const addRow = () => {
    const newRow: FilterRow = {
      id: `row_${Date.now()}`,
      field: '',
      operator: 'eq',
      value: '',
    };
    setRows(prev => [...prev, newRow]);
    setConnectors(prev => [...prev, { logic: 'AND' }]);
  };

  const removeRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index));
    setConnectors(prev => {
      const connectorIndex = index > 0 ? index - 1 : 0;
      return prev.filter((_, i) => i !== connectorIndex);
    });
  };

  // ========== Nested Groups Functions ==========
  const updateGroupLogic = (groupId: string, logic: 'AND' | 'OR') => {
    if (!rootGroup) return;
    const update = (group: FilterGroupType): FilterGroupType => {
      if (group.id === groupId) {
        return { ...group, logic };
      }
      return {
        ...group,
        items: group.items.map(item => 
          ('isGroup' in item && item.isGroup) ? update(item as FilterGroupType) : item
        ),
      };
    };
    setRootGroup(update(rootGroup));
  };

  const updateRowInGroup = (groupId: string, rowId: string, updates: Partial<FilterRow>) => {
    if (!rootGroup) return;
    const update = (group: FilterGroupType): FilterGroupType => {
      if (group.id === groupId) {
        return {
          ...group,
          items: group.items.map(item => {
            if (!('isGroup' in item) || !item.isGroup) {
              const row = item as FilterRow;
              if (row.id === rowId) {
                const merged = { ...row, ...updates };
                if ('field' in updates && updates.field !== undefined) {
                  const opt = fieldOptions.find(f => f.value === updates.field);
                  merged.fieldType = opt?.type;
                  const ops = getOperatorsForType(opt?.type || 'string');
                  const firstOp = ops[0]?.value ?? 'eq';
                  if (!ops.some(o => o.value === merged.operator)) {
                    merged.operator = firstOp;
                  }
                }
                return merged;
              }
            }
            return item;
          }),
        };
      }
      return {
        ...group,
        items: group.items.map(item =>
          ('isGroup' in item && item.isGroup) ? update(item as FilterGroupType) : item
        ),
      };
    };
    setRootGroup(update(rootGroup));
  };

  const addRowToGroup = (groupId: string) => {
    if (!rootGroup) return;
    const newRow: FilterRow = {
      id: `row_${Date.now()}`,
      field: '',
      operator: 'eq',
      value: '',
    };
    const update = (group: FilterGroupType): FilterGroupType => {
      if (group.id === groupId) {
        return { ...group, items: [...group.items, newRow] };
      }
      return {
        ...group,
        items: group.items.map(item =>
          ('isGroup' in item && item.isGroup) ? update(item as FilterGroupType) : item
        ),
      };
    };
    setRootGroup(update(rootGroup));
  };

  const removeRowFromGroup = (groupId: string, rowId: string) => {
    if (!rootGroup) return;
    const update = (group: FilterGroupType): FilterGroupType => {
      if (group.id === groupId) {
        return {
          ...group,
          items: group.items.filter(item => {
            if ('isGroup' in item && item.isGroup) return true;
            return (item as FilterRow).id !== rowId;
          }),
        };
      }
      return {
        ...group,
        items: group.items.map(item =>
          ('isGroup' in item && item.isGroup) ? update(item as FilterGroupType) : item
        ),
      };
    };
    setRootGroup(update(rootGroup));
  };

  const addNestedGroup = (parentGroupId: string) => {
    if (!rootGroup) return;
    const newGroup: FilterGroupType = {
      id: `group_${Date.now()}`,
      logic: 'AND',
      items: [{
        id: `row_${Date.now()}`,
        field: '',
        operator: 'eq',
        value: '',
      }],
      isGroup: true,
    };
    const update = (group: FilterGroupType): FilterGroupType => {
      if (group.id === parentGroupId) {
        return { ...group, items: [...group.items, newGroup] };
      }
      return {
        ...group,
        items: group.items.map(item =>
          ('isGroup' in item && item.isGroup) ? update(item as FilterGroupType) : item
        ),
      };
    };
    setRootGroup(update(rootGroup));
  };

  const removeGroup = (groupId: string) => {
    if (!rootGroup || groupId === 'root') return;
    const update = (group: FilterGroupType): FilterGroupType => ({
      ...group,
      items: group.items.filter(item => {
        if ('isGroup' in item && item.isGroup) {
          return (item as FilterGroupType).id !== groupId;
        }
        return true;
      }).map(item =>
        ('isGroup' in item && item.isGroup) ? update(item as FilterGroupType) : item
      ),
    });
    setRootGroup(update(rootGroup));
  };

  const handleApply = () => {
    if (enableNestedGroups && rootGroup) {
      const queryString = generateFromGroup(rootGroup);
      onApply(queryString);
      onClose();
      return;
    }
    
    // Flat mode
    const validRows = rows.filter(r => {
      if (!r.field) return false;
      if (['null', 'notNull'].includes(r.operator)) return true;
      if (r.operator === 'between') return r.value.trim() && r.valueTo?.trim();
      return r.value.trim();
    });
    if (validRows.length === 0) {
      onApply('');
      onClose();
      return;
    }
    const queryString = generateFromRows(validRows, connectors.slice(0, validRows.length - 1));
    onApply(queryString);
    onClose();
  };

  const handleClearAll = () => {
    if (enableNestedGroups) {
      setRootGroup({
        id: 'root',
        logic: 'AND',
        items: [{
          id: `row_${Date.now()}`,
          field: '',
          operator: 'eq',
          value: '',
        }],
        isGroup: true,
      });
    } else {
      setRows([{
        id: `row_${Date.now()}`,
        field: '',
        operator: 'eq',
        value: '',
      }]);
      setConnectors([]);
    }
  };

  const countActiveFilters = (group: FilterGroupType): number => {
    let count = 0;
    group.items.forEach(item => {
      if ('isGroup' in item && item.isGroup) {
        count += countActiveFilters(item as FilterGroupType);
      } else {
        const row = item as FilterRow;
        if (row.field && (['null', 'notNull'].includes(row.operator) || (row.value && row.value.trim()))) {
          count++;
        }
      }
    });
    return count;
  };

  const activeCount = enableNestedGroups && rootGroup 
    ? countActiveFilters(rootGroup)
    : rows.filter(r => r.field && (['null', 'notNull'].includes(r.operator) || (r.value && r.value.trim()))).length;

  /**
   * Recursively render a filter group and its items
   */
  const renderGroup = (group: FilterGroupType, level: number = 0): React.ReactNode => {
    return (
      <GroupContainer key={group.id} $logic={group.logic} $level={level}>
        <GroupHeader>
          <LogicBadge $logic={group.logic}>
            <LogicToggleButton
              $active={group.logic === 'AND'}
              $logic={'AND'}
              onClick={() => updateGroupLogic(group.id, 'AND')}
              type="button"
            >
              AND
            </LogicToggleButton>
            <LogicToggleButton
              $active={group.logic === 'OR'}
              $logic={'OR'}
              onClick={() => updateGroupLogic(group.id, 'OR')}
              type="button"
            >
              OR
            </LogicToggleButton>
          </LogicBadge>
          <GroupActions>
            <SmallButton onClick={() => addRowToGroup(group.id)} type="button">
              + Row
            </SmallButton>
            <SmallButton onClick={() => addNestedGroup(group.id)} type="button">
              + Group
            </SmallButton>
            {group.id !== 'root' && (
              <RemoveGroupButton onClick={() => removeGroup(group.id)} type="button">
                Remove
              </RemoveGroupButton>
            )}
          </GroupActions>
        </GroupHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {group.items.map((item) => {
            if ('isGroup' in item && item.isGroup) {
              return renderGroup(item as FilterGroupType, level + 1);
            }
            
            // Render row
            const row = item as FilterRow;
            return (
              <FilterRowCard key={row.id}>
                <FilterRowTop>
                  <Box style={{ flex: '1 1 200px', minWidth: '140px' }}>
                    <CustomSelect
                      value={row.field}
                      onChange={(v) => updateRowInGroup(group.id, row.id, { field: v })}
                      options={[
                        { value: '', label: 'Select field...' },
                        ...fieldOptions,
                      ]}
                      placeholder="Select field"
                      searchable
                    />
                  </Box>
                  <Box style={{ flex: '1 1 140px', minWidth: '120px' }}>
                    <CustomSelect
                      value={row.operator}
                      onChange={(v) => updateRowInGroup(group.id, row.id, { operator: v })}
                      options={getOperatorsForType(row.fieldType).map(o => ({ value: o.value, label: o.label }))}
                      placeholder="Operator"
                      searchable={false}
                    />
                  </Box>
                  <NegateCheckbox title="Negate this condition (NOT)">
                    <input
                      type="checkbox"
                      checked={row.negate || false}
                      onChange={(e) => updateRowInGroup(group.id, row.id, { negate: e.target.checked })}
                    />
                    NOT
                  </NegateCheckbox>
                  <DeleteButton
                    type="button"
                    onClick={() => removeRowFromGroup(group.id, row.id)}
                    title="Remove filter"
                  >
                    <Cross />
                  </DeleteButton>
                </FilterRowTop>
                {!['null', 'notNull'].includes(row.operator) && (
                  <FilterRowValue>
                    <ValueLabel>
                      {['in', 'notIn'].includes(row.operator) 
                        ? 'Enter values (press Enter after each)' 
                        : ['between'].includes(row.operator)
                        ? 'Enter range'
                        : 'Enter value'}
                    </ValueLabel>
                    <SmartValueInput
                      fieldType={row.fieldType}
                      operator={row.operator}
                      value={row.value}
                      valueTo={row.valueTo}
                      onChange={(v) => updateRowInGroup(group.id, row.id, { value: v })}
                      onValueToChange={(v) => updateRowInGroup(group.id, row.id, { valueTo: v })}
                      placeholder="Value"
                    />
                  </FilterRowValue>
                )}
              </FilterRowCard>
            );
          })}
        </div>
      </GroupContainer>
    );
  };

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent padding={6} onClick={(e) => e.stopPropagation()}>
        <Flex justifyContent="space-between" alignItems="center" marginBottom={4} style={{ flexShrink: 0 }}>
          <Flex alignItems="center">
            <Typography as="h2" variant="beta">Advanced Filter</Typography>
            {activeCount > 0 && <ActiveBadge>{activeCount}</ActiveBadge>}
          </Flex>
          <Button onClick={onClose} variant="ghost" type="button">
            <Cross />
          </Button>
        </Flex>

        <ModalScrollArea>
          {enableNestedGroups && rootGroup ? (
            // Nested Groups Mode
            <>
              {renderGroup(rootGroup, 0)}
              {relationsInUse.size > 0 && (
                <InfoText>
                  {Array.from(relationsInUse).join(', ')} will be loaded automatically
                </InfoText>
              )}
            </>
          ) : (
            // Flat Mode
            <>
              <RowWrapper>
                {rows.map((row, i) => (
                  <React.Fragment key={row.id}>
                    {i > 0 && (
                      <ConnectorPill>
                        <ConnectorButton
                          type="button"
                          $active={connectors[i - 1]?.logic === 'AND'}
                          onClick={() => updateConnector(i - 1, 'AND')}
                        >
                          and
                        </ConnectorButton>
                        <span style={{ margin: '0 8px', color: 'var(--colors-neutral500, #8e8ea9)' }}>|</span>
                        <ConnectorButton
                          type="button"
                          $active={connectors[i - 1]?.logic === 'OR'}
                          onClick={() => updateConnector(i - 1, 'OR')}
                        >
                          or
                        </ConnectorButton>
                      </ConnectorPill>
                    )}
                    <FilterRowCard>
                      <FilterRowTop>
                        <Box style={{ flex: '1 1 200px', minWidth: '140px' }}>
                          <CustomSelect
                            value={row.field}
                            onChange={(v) => updateRow(i, { field: v })}
                            options={[
                              { value: '', label: 'Select field...' },
                              ...fieldOptions,
                            ]}
                            placeholder="Select field"
                            searchable
                          />
                        </Box>
                        <Box style={{ flex: '1 1 140px', minWidth: '120px' }}>
                          <CustomSelect
                            value={row.operator}
                            onChange={(v) => updateRow(i, { operator: v })}
                            options={getOperatorsForType(row.fieldType).map(o => ({ value: o.value, label: o.label }))}
                            placeholder="Operator"
                            searchable={false}
                          />
                        </Box>
                        <NegateCheckbox title="Negate this condition (NOT)">
                          <input
                            type="checkbox"
                            checked={row.negate || false}
                            onChange={(e) => updateRow(i, { negate: e.target.checked })}
                          />
                          NOT
                        </NegateCheckbox>
                        <DeleteButton
                          type="button"
                          onClick={() => removeRow(i)}
                          title="Remove filter"
                        >
                          <Cross />
                        </DeleteButton>
                      </FilterRowTop>
                      {!['null', 'notNull'].includes(row.operator) && (
                        <FilterRowValue>
                          <ValueLabel>
                            {['in', 'notIn'].includes(row.operator) 
                              ? 'Enter values (press Enter after each)' 
                              : ['between'].includes(row.operator)
                              ? 'Enter range'
                              : 'Enter value'}
                          </ValueLabel>
                          <SmartValueInput
                            fieldType={row.fieldType}
                            operator={row.operator}
                            value={row.value}
                            valueTo={row.valueTo}
                            onChange={(v) => updateRow(i, { value: v })}
                            onValueToChange={(v) => updateRow(i, { valueTo: v })}
                            placeholder="Value"
                          />
                        </FilterRowValue>
                      )}
                    </FilterRowCard>
                  </React.Fragment>
                ))}
              </RowWrapper>

              {relationsInUse.size > 0 && (
                <InfoText>
                  {Array.from(relationsInUse).join(', ')} will be loaded automatically
                </InfoText>
              )}
            </>
          )}
        </ModalScrollArea>

        <ModalFooter>
          <Flex justifyContent="space-between" alignItems="center" gap={2}>
            <Button onClick={handleClearAll} variant="tertiary">
              Clear All
            </Button>
            {!enableNestedGroups && (
              <AddButton type="button" onClick={addRow}>
                + Add Filter
              </AddButton>
            )}
            <Button onClick={handleApply} variant="default">
              Apply
            </Button>
          </Flex>
        </ModalFooter>
      </ModalContent>
    </ModalOverlay>
  );
};

export default StrapiStyleFilterModal;
