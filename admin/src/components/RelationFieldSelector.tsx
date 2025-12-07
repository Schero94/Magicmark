// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Box, Flex, Loader } from '@strapi/design-system';
import { ChevronRight, Cross } from '@strapi/icons';
import styled, { keyframes } from 'styled-components';
import CustomSelect from './CustomSelect';
import { useRelationSchema } from '../hooks/useRelationSchema';

// ================ ANIMATIONS ================
const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
`;

// ================ STYLED COMPONENTS ================
const Container = styled(Flex)`
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 300px;
  flex-wrap: wrap;

  /* Tablet */
  @media (max-width: 768px) {
    gap: 8px;
    min-width: 100%;
  }

  /* Mobile */
  @media (max-width: 480px) {
    flex-direction: column;
    align-items: stretch;
    gap: 0;
  }
`;

const SelectWrapper = styled.div<{ $isNew?: boolean; $level?: number }>`
  flex: 1;
  min-width: 180px;
  animation: ${props => props.$isNew ? fadeIn : 'none'} 0.2s ease-out;
  display: flex;
  align-items: center;
  gap: 6px;

  /* Mobile */
  @media (max-width: 480px) {
    min-width: 100%;
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
  }
`;

/**
 * Wrapper for nested levels on mobile - shows visual hierarchy
 */
const NestedLevelWrapper = styled.div<{ $level: number }>`
  display: contents;

  /* Mobile - show as indented block */
  @media (max-width: 480px) {
    display: flex;
    flex-direction: column;
    width: 100%;
    margin-top: 8px;
    padding-left: ${props => props.$level * 12}px;
    border-left: 2px solid #E5E7EB;
  }
`;

/**
 * Mobile label for nested levels
 */
const MobileNestedLabel = styled.span`
  display: none;
  font-size: 11px;
  color: #6B7280;
  margin-bottom: 4px;
  font-weight: 500;

  @media (max-width: 480px) {
    display: block;
  }
`;

/**
 * Row container for select + clear button on mobile
 */
const SelectRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
`;

const Chevron = styled(ChevronRight)`
  width: 18px;
  height: 18px;
  color: #6366F1;
  flex-shrink: 0;

  /* Hide on mobile - we use indentation instead */
  @media (max-width: 480px) {
    display: none;
  }
`;

/**
 * Clear button to remove a level selection
 */
const ClearButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: #FEE2E2;
  color: #DC2626;
  border-radius: 6px;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;

  &:hover {
    background: #FECACA;
    transform: scale(1.1);
  }

  /* Touch-friendly on mobile */
  @media (max-width: 480px) {
    width: 36px;
    height: 36px;
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

// ================ TYPES ================
interface Field {
  name: string;
  type: string;
  isRelation?: boolean;
  target?: string;
}

interface Props {
  availableFields: Field[];
  availableRelations: Array<{ name: string; target?: string }>;
  fieldPath: string[];
  onChange: (fieldPath: string[]) => void;
  maxDepth?: number;
  showBreadcrumb?: boolean;
}

/**
 * Horizontal cascading field selector for relation filtering
 * Layout: [Field] > [Nested] > [Nested] in one row
 */
const RelationFieldSelector: React.FC<Props> = ({
  availableFields,
  availableRelations,
  fieldPath,
  onChange,
  maxDepth = 2,
}) => {
  const [levelFields, setLevelFields] = useState<Record<number, Field[]>>({});
  const [loadingLevel, setLoadingLevel] = useState<number | null>(null);
  const [newLevel, setNewLevel] = useState<number | null>(null);
  
  // Hook without parameter - it manages its own state
  const { getRelationFields } = useRelationSchema();

  /**
   * Initialize level 0 with base fields and relations
   */
  useEffect(() => {
    console.log('[RelationFieldSelector] Initializing with:', {
      fieldsCount: availableFields.length,
      relationsCount: availableRelations.length,
      relations: availableRelations.map(r => ({ name: r.name, target: r.target })),
    });

    const baseFields: Field[] = availableFields.map(f => ({
      name: f.name,
      type: f.type,
      isRelation: false,
    }));

    const relationFields: Field[] = availableRelations.map(r => ({
      name: r.name,
      type: 'relation',
      isRelation: true,
      target: r.target,
    }));

    // Relations first, then other fields
    const allFields = [...relationFields, ...baseFields.filter(f => 
      !relationFields.some(r => r.name === f.name)
    )];

    console.log('[RelationFieldSelector] Level 0 fields:', allFields.length, allFields.map(f => f.name));
    setLevelFields(prev => ({ ...prev, 0: allFields }));
  }, [availableFields, availableRelations]);

  /**
   * Auto-load nested fields if fieldPath already contains a relation
   * This handles the case when the component is mounted with an existing filter
   */
  useEffect(() => {
    const loadNestedFieldsIfNeeded = async () => {
      // Check if fieldPath[0] is a relation and we don't have level 1 fields yet
      if (fieldPath.length > 0 && fieldPath[0] && !levelFields[1]?.length) {
        const selectedField = levelFields[0]?.find(f => f.name === fieldPath[0]);
        
        if (selectedField?.isRelation && selectedField.target) {
          console.log('[RelationFieldSelector] Auto-loading nested fields for existing path:', fieldPath[0]);
          setLoadingLevel(1);
          
          try {
            const nestedFields = await getRelationFields(selectedField.target);
            console.log('[RelationFieldSelector] Auto-loaded nested fields:', nestedFields?.length);
            
            setLevelFields(prev => ({
              ...prev,
              1: (nestedFields || []).map(f => ({
                ...f,
                target: f.isRelation ? f.target : undefined,
              })),
            }));
          } catch (error) {
            console.error('[RelationFieldSelector] Error auto-loading nested fields:', error);
          } finally {
            setLoadingLevel(null);
          }
        }
      }
    };
    
    // Only run when levelFields[0] is populated
    if (levelFields[0]?.length > 0) {
      loadNestedFieldsIfNeeded();
    }
  }, [fieldPath, levelFields[0], getRelationFields]);

  /**
   * Handle field selection - loads nested fields for relations
   */
  const handleSelect = async (level: number, fieldName: string) => {
    console.log('[RelationFieldSelector] handleSelect:', { level, fieldName });
    
    // Update path up to this level
    const newPath = fieldPath.slice(0, level);
    newPath[level] = fieldName;
    
    // Find field info
    const field = levelFields[level]?.find(f => f.name === fieldName);
    console.log('[RelationFieldSelector] Selected field:', field);
    
    // If it's a relation and not at max depth, load nested fields
    if (field?.isRelation && field.target && level < maxDepth) {
      console.log('[RelationFieldSelector] Loading nested fields for target:', field.target);
      setLoadingLevel(level + 1);
      
      try {
        const nestedFields = await getRelationFields(field.target);
        console.log('[RelationFieldSelector] Loaded nested fields:', nestedFields?.length, nestedFields);
        
        if (!nestedFields || nestedFields.length === 0) {
          console.warn('[RelationFieldSelector] No nested fields returned for:', field.target);
        }
        
        // Clear deeper levels and set new one
        setLevelFields(prev => {
          const updated = { ...prev };
          // Remove levels beyond current + 1
          Object.keys(updated).forEach(k => {
            if (parseInt(k) > level + 1) delete updated[parseInt(k)];
          });
          updated[level + 1] = (nestedFields || []).map(f => ({
            ...f,
            target: f.isRelation ? f.target : undefined,
          }));
          console.log('[RelationFieldSelector] Updated levelFields:', updated);
          return updated;
        });
        
        // Animate new dropdown
        setNewLevel(level + 1);
        setTimeout(() => setNewLevel(null), 300);
        
      } catch (error) {
        console.error('[RelationFieldSelector] Error loading nested fields:', error);
      } finally {
        setLoadingLevel(null);
      }
    } else {
      // Clear deeper levels
      setLevelFields(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(k => {
          if (parseInt(k) > level) delete updated[parseInt(k)];
        });
        return updated;
      });
    }
    
    onChange(newPath);
  };

  /**
   * Generate dropdown options for a level
   */
  const getOptions = (level: number) => {
    const fields = levelFields[level] || [];
    return [
      { value: '', label: level === 0 ? 'Select field...' : 'Select...' },
      ...fields.map(f => ({
        value: f.name,
        label: f.isRelation ? `${f.name} [Rel]` : f.name,
      })),
    ];
  };

  /**
   * Check if level should be visible
   * Shows dropdown if previous field is a relation (even while loading)
   */
  const shouldShow = (level: number): boolean => {
    if (level === 0) return true;
    if (level > maxDepth) return false;
    
    const prevField = fieldPath[level - 1];
    const prevMeta = levelFields[level - 1]?.find(f => f.name === prevField);
    
    // Show if previous field is a relation AND (has fields loaded OR is currently loading)
    const isLoading = loadingLevel === level;
    const hasFields = (levelFields[level]?.length || 0) > 0;
    
    return !!(prevMeta?.isRelation && (hasFields || isLoading));
  };

  /**
   * Clear selection from a specific level onwards
   * E.g., clearFromLevel(1) keeps only fieldPath[0]
   */
  const clearFromLevel = (level: number) => {
    const newPath = fieldPath.slice(0, level);
    
    // Clear levelFields for this level and deeper
    setLevelFields(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(k => {
        if (parseInt(k) >= level) delete updated[parseInt(k)];
      });
      return updated;
    });
    
    onChange(newPath);
  };

  return (
    <Container>
      {/* Level 0 - always visible */}
      <SelectWrapper $level={0}>
        <SelectRow>
          <CustomSelect
            value={fieldPath[0] || ''}
            onChange={(val) => handleSelect(0, val)}
            options={getOptions(0)}
            placeholder="Select field"
            searchable
          />
        </SelectRow>
      </SelectWrapper>

      {/* Level 1 */}
      {shouldShow(1) && (
        <>
          <Chevron />
          <NestedLevelWrapper $level={1}>
            <MobileNestedLabel>Nested field:</MobileNestedLabel>
            <SelectWrapper $isNew={newLevel === 1} $level={1}>
              {loadingLevel === 1 ? (
                <Box padding={3} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F3F4F6', borderRadius: '8px', height: '40px', width: '100%' }}>
                  <Loader small /> Loading...
                </Box>
              ) : (
                <SelectRow>
                  <CustomSelect
                    value={fieldPath[1] || ''}
                    onChange={(val) => handleSelect(1, val)}
                    options={getOptions(1)}
                    placeholder="Select nested"
                    searchable
                  />
                  <ClearButton onClick={() => clearFromLevel(1)} title="Clear selection">
                    <Cross />
                  </ClearButton>
                </SelectRow>
              )}
            </SelectWrapper>
          </NestedLevelWrapper>
        </>
      )}

      {/* Level 2 */}
      {shouldShow(2) && (
        <>
          <Chevron />
          <NestedLevelWrapper $level={2}>
            <MobileNestedLabel>Deep nested:</MobileNestedLabel>
            <SelectWrapper $isNew={newLevel === 2} $level={2}>
              {loadingLevel === 2 ? (
                <Box padding={3} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F3F4F6', borderRadius: '8px', height: '40px', width: '100%' }}>
                  <Loader small /> Loading...
                </Box>
              ) : (
                <SelectRow>
                  <CustomSelect
                    value={fieldPath[2] || ''}
                    onChange={(val) => handleSelect(2, val)}
                    options={getOptions(2)}
                    placeholder="Select field"
                    searchable
                  />
                  <ClearButton onClick={() => clearFromLevel(2)} title="Clear selection">
                    <Cross />
                  </ClearButton>
                </SelectRow>
              )}
            </SelectWrapper>
          </NestedLevelWrapper>
        </>
      )}
    </Container>
  );
};

export default RelationFieldSelector;
