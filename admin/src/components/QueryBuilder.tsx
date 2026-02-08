// @ts-nocheck
import React, { useState, useCallback } from 'react';
import { Box, Button, Flex, Typography } from '@strapi/design-system';
import { Plus, Trash, ArrowUp, ArrowDown, Drag } from '@strapi/icons';
import styled, { keyframes, css } from 'styled-components';
import CustomSelect from './CustomSelect';
import RelationFieldSelector from './RelationFieldSelector';

// ================ ANIMATIONS ================
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const slideIn = keyframes`
  from { opacity: 0; transform: translateX(-12px); }
  to { opacity: 1; transform: translateX(0); }
`;

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(69, 69, 255, 0.2); }
  50% { box-shadow: 0 0 0 8px rgba(69, 69, 255, 0); }
`;

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
`;

// ================ THEME ================
const theme = {
  and: {
    bg: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)',
    border: '#0EA5E9',
    badge: '#0284C7',
    badgeBg: '#E0F2FE',
    text: '#0369A1',
    icon: '#0EA5E9',
  },
  or: {
    bg: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
    border: '#F97316',
    badge: '#EA580C',
    badgeBg: '#FFF7ED',
    text: '#C2410C',
    icon: '#F97316',
  },
};

// ================ STYLED COMPONENTS ================
const GroupContainer = styled.div<{ level: number; logic: 'AND' | 'OR' }>`
  border: 2px solid ${props => props.logic === 'AND' ? theme.and.border : theme.or.border};
  border-radius: 12px;
  padding: 20px;
  margin: 12px 0;
  background: ${props => props.logic === 'AND' ? theme.and.bg : theme.or.bg};
  animation: ${fadeIn} 0.3s ease-out;
  position: relative;
  transition: all 0.2s ease;

  ${props => props.level > 0 && css`
    margin-left: 24px;
    border-width: 2px;
    border-style: dashed;
  `}

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  /* Tablet */
  @media (max-width: 768px) {
    padding: 16px;
    ${props => props.level > 0 && css`
      margin-left: 12px;
    `}
  }

  /* Mobile */
  @media (max-width: 480px) {
    padding: 12px;
    margin: 8px 0;
    ${props => props.level > 0 && css`
      margin-left: 8px;
    `}
  }
`;

const GroupHeader = styled(Flex)`
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  flex-wrap: wrap;

  /* Mobile */
  @media (max-width: 480px) {
    gap: 8px;
    margin-bottom: 12px;
  }
`;

const GroupIcon = styled.div<{ logic: 'AND' | 'OR' }>`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.logic === 'AND' ? theme.and.badgeBg : theme.or.badgeBg};
  color: ${props => props.logic === 'AND' ? theme.and.icon : theme.or.icon};
  font-weight: bold;
  font-size: 14px;
  margin-right: 12px;
  flex-shrink: 0;

  /* Mobile */
  @media (max-width: 480px) {
    width: 28px;
    height: 28px;
    font-size: 12px;
    margin-right: 8px;
  }
`;

const LogicToggle = styled.button<{ logic: 'AND' | 'OR'; $active: boolean }>`
  padding: 6px 16px;
  border-radius: 20px;
  border: 2px solid ${props => props.logic === 'AND' ? theme.and.border : theme.or.border};
  background: ${props => props.$active 
    ? (props.logic === 'AND' ? theme.and.border : theme.or.border) 
    : props.theme.colors.neutral0};
  color: ${props => props.$active ? 'white' : (props.logic === 'AND' ? theme.and.text : theme.or.text)};
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-right: 8px;

  &:hover {
    transform: scale(1.05);
  }

  /* Touch-friendly on mobile */
  @media (max-width: 480px) {
    padding: 8px 14px;
    font-size: 11px;
    margin-right: 4px;
  }
`;

const ConditionCard = styled.div<{ $isNew?: boolean; $twoRows?: boolean }>`
  background: ${(p) => p.theme.colors.neutral0};
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 10px;
  padding: 16px;
  margin: 8px 0;
  display: flex;
  flex-direction: ${props => props.$twoRows ? 'column' : 'row'};
  align-items: ${props => props.$twoRows ? 'stretch' : 'center'};
  gap: ${props => props.$twoRows ? '16px' : '12px'};
  animation: ${props => props.$isNew ? css`${slideIn} 0.3s ease-out` : 'none'};
  transition: all 0.2s ease;
  position: relative;

  &:hover {
    border-color: rgba(99, 102, 241, 0.4);
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
  }

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: linear-gradient(180deg, #6366F1 0%, #8B5CF6 100%);
    border-radius: 10px 0 0 10px;
  }

  /* Tablet */
  @media (max-width: 768px) {
    padding: 14px;
    gap: 10px;
  }

  /* Mobile - always stack vertically */
  @media (max-width: 480px) {
    flex-direction: column;
    align-items: stretch;
    padding: 12px;
    gap: 12px;
  }
`;

/**
 * Row container for condition elements - responsive
 */
const ConditionRow = styled(Flex)`
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;

  /* Mobile */
  @media (max-width: 480px) {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
`;

/**
 * Header row with reorder + delete buttons on mobile
 */
const ConditionHeader = styled.div`
  display: none;

  /* Mobile - show header row with controls */
  @media (max-width: 480px) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
`;

/**
 * Operator + Value row - responsive
 */
const OperatorValueRow = styled(Flex)`
  align-items: center;
  gap: 12px;
  padding-left: 48px;

  /* Mobile */
  @media (max-width: 480px) {
    flex-direction: column;
    align-items: stretch;
    padding-left: 0;
    gap: 8px;
  }
`;

/**
 * Desktop-only wrapper for controls
 */
const DesktopControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;

  @media (max-width: 480px) {
    display: none;
  }
`;

const DragHandle = styled.div`
  cursor: grab;
  padding: 8px 4px;
  color: ${(p) => p.theme.colors.neutral500};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  transition: color 0.2s;

  &:hover {
    color: #6366F1;
  }

  &:active {
    cursor: grabbing;
  }
`;

const ReorderButtons = styled(Flex)`
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;

  /* Mobile - horizontal layout */
  @media (max-width: 480px) {
    flex-direction: row;
    gap: 4px;
  }
`;

const ReorderButton = styled.button`
  background: ${(p) => p.theme.colors.neutral100};
  border: none;
  border-radius: 4px;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  color: ${(p) => p.theme.colors.neutral600};

  &:hover:not(:disabled) {
    background: ${(p) => p.theme.colors.neutral200};
    color: #4F46E5;
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  svg {
    width: 14px;
    height: 14px;
  }

  /* Touch-friendly on mobile */
  @media (max-width: 480px) {
    padding: 8px;
    
    svg {
      width: 16px;
      height: 16px;
    }
  }
`;

const FieldSelect = styled.div`
  flex: 2;
  min-width: 160px;

  /* Mobile */
  @media (max-width: 480px) {
    min-width: 100%;
    width: 100%;
  }
`;

const OperatorSelect = styled.div`
  flex: 1;
  min-width: 120px;

  /* Mobile */
  @media (max-width: 480px) {
    min-width: 100%;
    width: 100%;
  }
`;

const ValueInput = styled.input`
  flex: 2;
  min-width: 140px;
  padding: 10px 14px;
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: #6366F1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }

  &::placeholder {
    color: ${(p) => p.theme.colors.neutral500};
  }

  /* Mobile */
  @media (max-width: 480px) {
    min-width: 100%;
    width: 100%;
    padding: 12px 14px;
    font-size: 16px; /* Prevents zoom on iOS */
  }
`;

const DeleteButton = styled.button`
  background: rgba(239, 68, 68, 0.12);
  border: none;
  flex-shrink: 0;
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  color: #DC2626;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.3);
    transform: scale(1.1);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  svg {
    width: 16px;
    height: 16px;
  }

  /* Touch-friendly on mobile */
  @media (max-width: 480px) {
    padding: 10px;
    
    svg {
      width: 18px;
      height: 18px;
    }
  }
`;

const LogicDivider = styled.div<{ logic: 'AND' | 'OR' }>`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 12px 0;
  position: relative;

  &::before, &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: ${props => props.logic === 'AND' ? theme.and.border : theme.or.border};
    opacity: 0.3;
  }
`;

const LogicBadge = styled.span<{ logic: 'AND' | 'OR' }>`
  padding: 4px 16px;
  border-radius: 12px;
  background: ${props => props.logic === 'AND' ? theme.and.badgeBg : theme.or.badgeBg};
  color: ${props => props.logic === 'AND' ? theme.and.badge : theme.or.badge};
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.5px;
  margin: 0 12px;
  border: 1px solid ${props => props.logic === 'AND' ? theme.and.border : theme.or.border};
`;

const ActionButton = styled(Button)`
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-1px);
  }

  /* Mobile - full width buttons */
  @media (max-width: 480px) {
    flex: 1;
    justify-content: center;
    padding: 10px 12px;
  }
`;

const GroupLabel = styled(Typography)`
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: ${(p) => p.theme.colors.neutral800};
  margin-bottom: 2px;

  /* Mobile */
  @media (max-width: 480px) {
    font-size: 13px;
  }
`;

const GroupDescription = styled(Typography)`
  display: block;
  font-size: 12px;
  color: ${(p) => p.theme.colors.neutral600};

  /* Mobile */
  @media (max-width: 480px) {
    font-size: 11px;
  }
`;

// ================ TYPES ================
interface Condition {
  id: string;
  field: string;
  /** Field path for deep filtering (e.g., ['user', 'role', 'name']) */
  fieldPath?: string[];
  operator: string;
  value: string;
}

interface ConditionGroup {
  id: string;
  logic: 'AND' | 'OR';
  conditions: (Condition | ConditionGroup)[];
  isGroup?: boolean;
}

interface RelationInfo {
  name: string;
  target?: string;
}

interface QueryBuilderProps {
  availableFields: Array<{ name: string; type: string }>;
  /** Relations with their target UIDs for deep filtering */
  availableRelations?: RelationInfo[];
  onQueryChange: (query: ConditionGroup) => void;
  initialStructure?: ConditionGroup | null;
  isPremium?: boolean;
  /** Enable deep relation filtering (requires Premium) */
  enableDeepFiltering?: boolean;
}

const OPERATORS = [
  { value: 'eq', label: '= equals' },
  { value: 'ne', label: '!= not equals' },
  { value: 'lt', label: '< less than' },
  { value: 'lte', label: '<= less or equal' },
  { value: 'gt', label: '> greater than' },
  { value: 'gte', label: '>= greater or equal' },
  { value: 'contains', label: 'contains' },
  { value: 'notContains', label: 'not contains' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'endsWith', label: 'ends with' },
  { value: 'null', label: 'is null' },
  { value: 'notNull', label: 'is not null' },
];

// ================ COMPONENT ================
const QueryBuilder: React.FC<QueryBuilderProps> = ({
  availableFields,
  availableRelations = [],
  onQueryChange,
  initialStructure,
  isPremium = true,
  enableDeepFiltering = true,
}) => {
  // Debug log props
  console.log('[QueryBuilder] Props received:', { isPremium, enableDeepFiltering, availableRelationsCount: availableRelations.length });
  const [rootGroup, setRootGroup] = useState<ConditionGroup>(
    initialStructure || {
      id: 'root',
      logic: 'AND',
      conditions: [{ id: '1', field: '', fieldPath: [], operator: 'eq', value: '' }],
    }
  );

  const [newItems, setNewItems] = useState<Set<string>>(new Set());

  // Update if initialStructure changes
  React.useEffect(() => {
    if (initialStructure) {
      setRootGroup(initialStructure);
    }
  }, [initialStructure]);

  const updateRootGroup = useCallback((newGroup: ConditionGroup) => {
    setRootGroup(newGroup);
    onQueryChange(newGroup);
  }, [onQueryChange]);

  const findGroup = (group: ConditionGroup, id: string): ConditionGroup | null => {
    if (group.id === id) return group;
    for (const item of group.conditions) {
      if ((item as ConditionGroup).isGroup) {
        const found = findGroup(item as ConditionGroup, id);
        if (found) return found;
      }
    }
    return null;
  };

  const findCondition = (group: ConditionGroup, id: string): Condition | null => {
    for (const item of group.conditions) {
      if (!(item as ConditionGroup).isGroup && item.id === id) {
        return item as Condition;
      }
      if ((item as ConditionGroup).isGroup) {
        const found = findCondition(item as ConditionGroup, id);
        if (found) return found;
      }
    }
    return null;
  };

  const addCondition = (groupId: string) => {
    const newGroup = JSON.parse(JSON.stringify(rootGroup));
    const group = findGroup(newGroup, groupId);
    if (group) {
      const newId = Date.now().toString();
      group.conditions.push({
        id: newId,
        field: '',
        fieldPath: [],
        operator: 'eq',
        value: '',
      });
      setNewItems(prev => new Set(prev).add(newId));
      setTimeout(() => setNewItems(prev => {
        const next = new Set(prev);
        next.delete(newId);
        return next;
      }), 500);
      updateRootGroup(newGroup);
    }
  };

  const addGroup = (parentGroupId: string) => {
    const newGroup = JSON.parse(JSON.stringify(rootGroup));
    const parentGroup = findGroup(newGroup, parentGroupId);
    if (parentGroup) {
      // Free users can add 1 sub-group at root level, Premium users can add nested groups
      const currentLevel = parentGroupId === 'root' ? 0 : 1;
      if (!isPremium && currentLevel >= 1) return;
      
      const newId = Date.now().toString();
      parentGroup.conditions.push({
        id: newId,
        logic: 'OR',
        conditions: [{ id: newId + '_1', field: '', fieldPath: [], operator: 'eq', value: '' }],
        isGroup: true,
      });
      updateRootGroup(newGroup);
    }
  };

  const removeItem = (groupId: string, itemId: string) => {
    const newGroup = JSON.parse(JSON.stringify(rootGroup));
    const group = findGroup(newGroup, groupId);
    if (group) {
      group.conditions = group.conditions.filter((c: any) => c.id !== itemId);
      updateRootGroup(newGroup);
    }
  };

  const updateCondition = (conditionId: string, key: string, value: string) => {
    const newGroup = JSON.parse(JSON.stringify(rootGroup));
    const condition = findCondition(newGroup, conditionId);
    if (condition) {
      (condition as any)[key] = value;
      updateRootGroup(newGroup);
    }
  };

  const toggleGroupLogic = (groupId: string) => {
    const newGroup = JSON.parse(JSON.stringify(rootGroup));
    const group = findGroup(newGroup, groupId);
    if (group) {
      group.logic = group.logic === 'AND' ? 'OR' : 'AND';
      updateRootGroup(newGroup);
    }
  };

  const moveCondition = (groupId: string, itemId: string, direction: 'up' | 'down') => {
    const newGroup = JSON.parse(JSON.stringify(rootGroup));
    const group = findGroup(newGroup, groupId);
    if (group) {
      const index = group.conditions.findIndex((c: any) => c.id === itemId);
      if (index === -1) return;
      
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= group.conditions.length) return;
      
      // Swap
      [group.conditions[index], group.conditions[newIndex]] = 
        [group.conditions[newIndex], group.conditions[index]];
      
      updateRootGroup(newGroup);
    }
  };

  /**
   * Updates the fieldPath for a condition and syncs the field property
   */
  const updateFieldPath = (conditionId: string, newPath: string[]) => {
    const newGroup = JSON.parse(JSON.stringify(rootGroup));
    const condition = findCondition(newGroup, conditionId);
    if (condition) {
      condition.fieldPath = newPath;
      // Set field to the last element of path (for backward compatibility)
      condition.field = newPath[newPath.length - 1] || '';
      updateRootGroup(newGroup);
    }
  };

  const renderCondition = (
    condition: Condition,
    group: ConditionGroup,
    index: number,
    level: number
  ): React.ReactNode => {
    const isFirst = index === 0;
    const isLast = index === group.conditions.length - 1;
    const canDelete = group.conditions.length > 1 || level > 0;
    
    // Determine if we should use deep filtering
    const useDeepFilter = enableDeepFiltering && isPremium && availableRelations.length > 0;
    const fieldPath = condition.fieldPath || [condition.field].filter(Boolean);
    
    // Check if the first selected field is a relation (for two-row layout)
    // This should trigger as soon as user selects a relation like "user [Rel]"
    const firstFieldIsRelation = fieldPath.length > 0 && 
      availableRelations.some(r => r.name === fieldPath[0]);
    
    // Use two-row layout when a relation is selected (even if no nested field yet)
    const hasRelationSelected = firstFieldIsRelation;

    // Two-row layout when relation is selected
    if (useDeepFilter && hasRelationSelected) {
      return (
        <ConditionCard key={condition.id} $isNew={newItems.has(condition.id)} $twoRows>
          {/* Mobile Header - shows controls at top */}
          <ConditionHeader>
            <ReorderButtons>
              <ReorderButton
                onClick={() => moveCondition(group.id, condition.id, 'up')}
                disabled={isFirst}
                title="Move up"
              >
                <ArrowUp />
              </ReorderButton>
              <ReorderButton
                onClick={() => moveCondition(group.id, condition.id, 'down')}
                disabled={isLast}
                title="Move down"
              >
                <ArrowDown />
              </ReorderButton>
            </ReorderButtons>
            
            <DeleteButton
              onClick={() => removeItem(group.id, condition.id)}
              disabled={!canDelete}
              title="Remove condition"
            >
              <Trash />
            </DeleteButton>
          </ConditionHeader>

          {/* Row 1: Field Path Selection */}
          <ConditionRow>
            {/* Desktop-only reorder buttons */}
            <DesktopControls>
              <ReorderButtons>
                <ReorderButton
                  onClick={() => moveCondition(group.id, condition.id, 'up')}
                  disabled={isFirst}
                  title="Move up"
                >
                  <ArrowUp />
                </ReorderButton>
                <ReorderButton
                  onClick={() => moveCondition(group.id, condition.id, 'down')}
                  disabled={isLast}
                  title="Move down"
                >
                  <ArrowDown />
                </ReorderButton>
              </ReorderButtons>
            </DesktopControls>
            
            <RelationFieldSelector
              availableFields={availableFields}
              availableRelations={availableRelations}
              fieldPath={fieldPath}
              onChange={(newPath) => updateFieldPath(condition.id, newPath)}
              maxDepth={2}
            />
            
            {/* Desktop-only delete button */}
            <DesktopControls>
              <DeleteButton
                onClick={() => removeItem(group.id, condition.id)}
                disabled={!canDelete}
                title="Remove condition"
              >
                <Trash />
              </DeleteButton>
            </DesktopControls>
          </ConditionRow>
          
          {/* Row 2: Operator + Value */}
          <OperatorValueRow>
            <OperatorSelect>
              <CustomSelect
                value={condition.operator}
                onChange={(val) => updateCondition(condition.id, 'operator', val)}
                options={OPERATORS}
                searchable={false}
              />
            </OperatorSelect>

            {!['null', 'notNull'].includes(condition.operator) && (
              <ValueInput
                value={condition.value}
                onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                placeholder="Enter value..."
              />
            )}
          </OperatorValueRow>
        </ConditionCard>
      );
    }

    // Single-row layout (no relation or simple field)
    return (
      <ConditionCard key={condition.id} $isNew={newItems.has(condition.id)}>
        {/* Reorder Buttons */}
        <ReorderButtons>
          <ReorderButton
            onClick={() => moveCondition(group.id, condition.id, 'up')}
            disabled={isFirst}
            title="Move up"
          >
            <ArrowUp />
          </ReorderButton>
          <ReorderButton
            onClick={() => moveCondition(group.id, condition.id, 'down')}
            disabled={isLast}
            title="Move down"
          >
            <ArrowDown />
          </ReorderButton>
        </ReorderButtons>

        {/* Field Select - Use RelationFieldSelector for deep filtering */}
        {useDeepFilter ? (
          <RelationFieldSelector
            availableFields={availableFields}
            availableRelations={availableRelations}
            fieldPath={fieldPath}
            onChange={(newPath) => updateFieldPath(condition.id, newPath)}
            maxDepth={2}
          />
        ) : (
          <FieldSelect>
            <CustomSelect
              value={condition.field}
              onChange={(val) => {
                updateCondition(condition.id, 'field', val);
                // Also update fieldPath for consistency
                updateFieldPath(condition.id, [val]);
              }}
              options={[
                { value: '', label: 'Select field...' },
                ...availableFields.map(f => ({
                  value: f.name,
                  label: `${f.name} (${f.type})`,
                })),
              ]}
              placeholder="Select field"
              searchable={true}
            />
          </FieldSelect>
        )}

        {/* Operator Select */}
        <OperatorSelect>
          <CustomSelect
            value={condition.operator}
            onChange={(val) => updateCondition(condition.id, 'operator', val)}
            options={OPERATORS}
            searchable={false}
          />
        </OperatorSelect>

        {/* Value Input */}
        {!['null', 'notNull'].includes(condition.operator) && (
          <ValueInput
            value={condition.value}
            onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
            placeholder="Enter value..."
          />
        )}

        {/* Delete Button */}
        <DeleteButton
          onClick={() => removeItem(group.id, condition.id)}
          disabled={!canDelete}
          title="Remove condition"
        >
          <Trash />
        </DeleteButton>
      </ConditionCard>
    );
  };

  const renderGroup = (group: ConditionGroup, level: number = 0): React.ReactNode => {
    return (
      <GroupContainer key={group.id} level={level} logic={group.logic}>
        {/* Group Header */}
        <GroupHeader gap={3} alignItems="center">
          <GroupIcon logic={group.logic}>
            {level === 0 ? 'Q' : level}
          </GroupIcon>
          
          <Box style={{ flex: 1 }}>
            <GroupLabel>
              {level === 0 ? 'Query Builder' : `Sub-Group ${level}`}
            </GroupLabel>
            <GroupDescription>
              {group.logic === 'AND' 
                ? 'All conditions must match' 
                : 'Any condition can match'}
            </GroupDescription>
          </Box>

          <Flex gap={1}>
            <LogicToggle
              logic="AND"
              $active={group.logic === 'AND'}
              onClick={() => group.logic !== 'AND' && toggleGroupLogic(group.id)}
            >
              AND
            </LogicToggle>
            <LogicToggle
              logic="OR"
              $active={group.logic === 'OR'}
              onClick={() => group.logic !== 'OR' && toggleGroupLogic(group.id)}
            >
              OR
            </LogicToggle>
          </Flex>

          {level > 0 && (
            <DeleteButton
              onClick={() => {
                // Find parent and remove this group
                const findParentAndRemove = (parent: ConditionGroup): boolean => {
                  const idx = parent.conditions.findIndex(c => c.id === group.id);
                  if (idx !== -1) {
                    parent.conditions.splice(idx, 1);
                    return true;
                  }
                  for (const item of parent.conditions) {
                    if ((item as ConditionGroup).isGroup) {
                      if (findParentAndRemove(item as ConditionGroup)) return true;
                    }
                  }
                  return false;
                };
                const newRoot = JSON.parse(JSON.stringify(rootGroup));
                findParentAndRemove(newRoot);
                updateRootGroup(newRoot);
              }}
              title="Remove group"
            >
              <Trash />
            </DeleteButton>
          )}
        </GroupHeader>

        {/* Conditions */}
        {group.conditions.map((item, index) => (
          <Box key={item.id}>
            {/* Logic Divider between conditions */}
            {index > 0 && (
              <LogicDivider logic={group.logic}>
                <LogicBadge logic={group.logic}>{group.logic}</LogicBadge>
              </LogicDivider>
            )}

            {(item as ConditionGroup).isGroup ? (
              renderGroup(item as ConditionGroup, level + 1)
            ) : (
              renderCondition(item as Condition, group, index, level)
            )}
          </Box>
        ))}

        {/* Action Buttons */}
        <Flex gap={2} marginTop={4}>
          <ActionButton
            variant="secondary"
            size="S"
            startIcon={<Plus />}
            onClick={() => addCondition(group.id)}
          >
            Add Condition
          </ActionButton>
          
          {level < 2 && (
            <ActionButton
              variant="tertiary"
              size="S"
              startIcon={<Plus />}
              onClick={() => addGroup(group.id)}
              disabled={!isPremium && level >= 1}
              title={!isPremium && level >= 1 ? "Upgrade to Premium for more nested groups" : "Add a sub-group"}
            >
              Add Sub-Group {!isPremium && level >= 1 && '(Premium)'}
            </ActionButton>
          )}
        </Flex>
      </GroupContainer>
    );
  };

  return <Box>{renderGroup(rootGroup)}</Box>;
};

export default QueryBuilder;
