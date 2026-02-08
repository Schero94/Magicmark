// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { Box, Button, Flex, Typography } from '@strapi/design-system';
import { Cross } from '@strapi/icons';
import styled from 'styled-components';
import CustomSelect from './CustomSelect';
import { useRelationSchema } from '../hooks/useRelationSchema';
import { generateFromRows, type FilterRow, type LogicConnector } from '../utils/queryGenerator';
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
  z-index: 999;
  padding: 20px;
  @media (max-width: 768px) {
    padding: 10px;
  }
`;

const ModalContent = styled(Box)`
  background: ${(p) => p.theme.colors.neutral0};
  border-radius: 8px;
  max-height: 90vh;
  overflow-y: auto;
  max-width: 560px;
  width: 100%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  @media (max-width: 768px) {
    max-width: 100%;
    max-height: 95vh;
  }
`;

const RowWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
`;

const FilterRowContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const ValueInput = styled.input`
  flex: 1;
  min-width: 120px;
  padding: 8px 12px;
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 4px;
  font-size: 14px;
  &:focus {
    outline: none;
    border-color: #4945ff;
    box-shadow: 0 0 0 2px rgba(73, 69, 255, 0.1);
  }
`;

const ConnectorRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 0;
`;

const ConnectorButton = styled.button<{ $active: boolean }>`
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid ${props => props.$active ? '#4945ff' : 'rgba(128, 128, 128, 0.25)'};
  border-radius: 4px;
  background: ${props => props.$active ? '#EEF0FF' : 'transparent'};
  color: ${props => props.$active ? '#4945ff' : '#32324d'};
  cursor: pointer;
  transition: all 0.15s ease;
  &:hover {
    border-color: #4945ff;
    background: ${(p) => p.theme.colors.neutral100};
  }
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

const OPERATORS = [
  { value: 'eq', label: 'is' },
  { value: 'ne', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'notContains', label: 'not contains' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'endsWith', label: 'ends with' },
  { value: 'gt', label: 'is greater than' },
  { value: 'lt', label: 'is less than' },
  { value: 'null', label: 'is null' },
  { value: 'notNull', label: 'is not null' },
];

interface FieldOption {
  value: string;
  label: string;
  group: string;
}

interface StrapiStyleFilterModalProps {
  onClose: () => void;
  onApply: (queryString: string) => void;
  availableFields: Array<{ name: string; type: string }>;
  availableRelations?: Array<{ name: string; target?: string }>;
  currentQuery?: string;
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
}) => {
  const { getRelationFields } = useRelationSchema();
  const [fieldOptions, setFieldOptions] = useState<FieldOption[]>([]);
  const [rows, setRows] = useState<FilterRow[]>([]);
  const [connectors, setConnectors] = useState<LogicConnector[]>([]);

  const buildFieldOptions = useCallback(async () => {
    const direct: FieldOption[] = availableFields.map(f => ({
      value: f.name,
      label: f.name,
      group: 'Fields',
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
  }, [currentQuery]);

  const relationsInUse = new Set(
    rows
      .map(r => r.field.includes('.') ? r.field.split('.')[0] : null)
      .filter(Boolean)
  );

  const updateRow = (index: number, updates: Partial<FilterRow>) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, ...updates } : r));
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

  const handleApply = () => {
    const validRows = rows.filter(r => r.field && (['null', 'notNull'].includes(r.operator) || r.value.trim()));
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
    setRows([{
      id: `row_${Date.now()}`,
      field: '',
      operator: 'eq',
      value: '',
    }]);
    setConnectors([]);
  };

  const operatorOptions = OPERATORS.map(o => ({ value: o.value, label: o.label }));

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent padding={6} onClick={(e) => e.stopPropagation()}>
        <Flex justifyContent="space-between" alignItems="center" marginBottom={4}>
          <Typography as="h2" variant="beta">Filters</Typography>
          <Button onClick={onClose} variant="ghost" type="button">
            <Cross />
          </Button>
        </Flex>

        <RowWrapper>
          {rows.map((row, i) => (
            <React.Fragment key={row.id}>
              {i > 0 && (
                <ConnectorRow>
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
                </ConnectorRow>
              )}
              <FilterRowContainer>
                <Box style={{ flex: '1 1 140px', minWidth: '120px' }}>
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
                <Box style={{ flex: '1 1 130px', minWidth: '100px' }}>
                  <CustomSelect
                    value={row.operator}
                    onChange={(v) => updateRow(i, { operator: v })}
                    options={[
                      { value: 'eq', label: 'is' },
                      ...operatorOptions.filter(o => o.value !== 'eq'),
                    ]}
                    placeholder="Operator"
                    searchable={false}
                  />
                </Box>
                {!['null', 'notNull'].includes(row.operator) && (
                  <ValueInput
                    type="text"
                    value={row.value}
                    onChange={(e) => updateRow(i, { value: e.target.value })}
                    placeholder="Value"
                  />
                )}
                <DeleteButton
                  type="button"
                  onClick={() => removeRow(i)}
                  title="Remove filter"
                >
                  <Cross />
                </DeleteButton>
              </FilterRowContainer>
            </React.Fragment>
          ))}
        </RowWrapper>

        <AddButton type="button" onClick={addRow}>
          + Add filter
        </AddButton>

        {relationsInUse.size > 0 && (
          <InfoText>
            {Array.from(relationsInUse).join(', ')} will be loaded automatically
          </InfoText>
        )}

        <Flex justifyContent="space-between" marginTop={5} gap={2}>
          <Button onClick={handleClearAll} variant="tertiary">
            Clear All
          </Button>
          <Button onClick={handleApply} variant="default">
            Apply Filters
          </Button>
        </Flex>
      </ModalContent>
    </ModalOverlay>
  );
};

export default StrapiStyleFilterModal;
