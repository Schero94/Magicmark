// @ts-nocheck
import React, { useState } from 'react';
import { Box, Button, Flex, Typography } from '@strapi/design-system';
import { Cross, Search, Filter, Link as LinkIcon, Check, Stack, Lightbulb } from '@strapi/icons';
import styled from 'styled-components';
import QueryBuilder from './QueryBuilder';
import { parseQueryToStructure, type ConditionGroup } from '../utils/queryToStructure';
import { generateQueryString } from '../utils/queryGenerator';
import { useLicenseInfo } from '../hooks/useFeatureGate';
import UpgradePrompt from './UpgradePrompt';

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
  max-width: 900px;
  width: 100%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  
  @media (max-width: 768px) {
    max-width: 100%;
    max-height: 95vh;
    border-radius: 12px;
  }
  
  @media (min-width: 769px) {
    width: 85%;
  }
`;

interface PopulateField {
  name: string;
  enabled: boolean;
  deep: boolean;
}

interface SimpleAdvancedFilterModalProps {
  onClose: () => void;
  onApply: (queryString: string) => void;
  availableFields: Array<{ name: string; type: string }>;
  /** Relations with their target UIDs for deep filtering */
  availableRelations?: Array<{ name: string; target?: string }>;
  currentQuery?: string;
}

const SimpleAdvancedFilterModal: React.FC<SimpleAdvancedFilterModalProps> = ({
  onClose,
  onApply,
  availableFields,
  availableRelations = [],
  currentQuery = '',
}) => {
  const { isPremium, isAdvanced, tier, isLoading } = useLicenseInfo();
  
  // Debug log for license status
  React.useEffect(() => {
    console.log('[SimpleAdvancedFilter] License status:', { isPremium, isAdvanced, tier, isLoading });
  }, [isPremium, isAdvanced, tier, isLoading]);
  const [queryStructure, setQueryStructure] = useState<ConditionGroup | null>(null);
  const [initialStructure, setInitialStructure] = useState<ConditionGroup | null>(null);
  const [initialFiltersLoaded, setInitialFiltersLoaded] = useState(false);
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [populateFields, setPopulateFields] = useState<PopulateField[]>([]);

  // Load current filters from URL when modal opens
  React.useEffect(() => {
    if (!initialFiltersLoaded) {
      console.log('[SimpleAdvancedFilter] Loading current query:', currentQuery);
      
      // Initialize populateFields from availableRelations
      if (availableRelations.length > 0) {
        const initialFields = availableRelations.map(rel => ({
          name: rel.name,
          enabled: false,
          deep: false,
        }));
        console.log('[SimpleAdvancedFilter] Initializing populateFields:', initialFields);
        setPopulateFields(initialFields);
      }
      
      // Parse filters into structure
      if (currentQuery) {
        const parsed = parseQueryToStructure(currentQuery);
        setInitialStructure(parsed);
        setQueryStructure(parsed);
        
        // Parse populate and sort from URL
        const params = new URLSearchParams(currentQuery);
        const updatedPopulate = availableRelations.map(rel => ({
          name: rel.name,
          enabled: false,
          deep: false,
        }));
        
        params.forEach((value, key) => {
          // Parse populate
          if (key.startsWith('populate[')) {
            const match = key.match(/populate\[([^\]]+)\]/);
            if (match) {
              const fieldName = match[1];
              const index = updatedPopulate.findIndex(p => p.name === fieldName);
              if (index >= 0) {
                // Check if it's deep populate
                const isDeep = key.includes('[populate]') || value === '*';
                updatedPopulate[index] = {
                  ...updatedPopulate[index],
                  enabled: true,
                  deep: isDeep,
                };
              }
            }
          }
          // Parse sort
          else if (key === 'sort') {
            // Format: username:ASC or createdAt:DESC
            const parts = value.split(':');
            if (parts.length === 2) {
              setSortField(parts[0]);
              setSortOrder(parts[1].toUpperCase() as 'ASC' | 'DESC');
            }
          }
        });
        
        setPopulateFields(updatedPopulate);
      }
      
      setInitialFiltersLoaded(true);
      console.log('[SimpleAdvancedFilter] Initial structure loaded');
    }
  }, [currentQuery]);

  /**
   * Handle query changes and automatically enable populates for filtered relations
   */
  const handleQueryChange = (newStructure: ConditionGroup) => {
    setQueryStructure(newStructure);
    
    // Auto-enable populate for relations used in filters
    const relationsInFilter = new Set<string>();
    
    const findRelationsInConditions = (conditions: any[]) => {
      conditions.forEach(item => {
        if (item.isGroup && item.conditions) {
          findRelationsInConditions(item.conditions);
        } else if (item.fieldPath && item.fieldPath.length > 1) {
          // First element of fieldPath is the relation name
          relationsInFilter.add(item.fieldPath[0]);
        }
      });
    };
    
    if (newStructure?.conditions) {
      findRelationsInConditions(newStructure.conditions);
    }
    
    // Auto-enable populates for relations used in filters
    if (relationsInFilter.size > 0) {
      setPopulateFields(prev => prev.map(p => {
        if (relationsInFilter.has(p.name) && !p.enabled) {
          console.log('[SimpleAdvancedFilter] Auto-enabling populate for:', p.name);
          return { ...p, enabled: true };
        }
        return p;
      }));
    }
  };

  const handleApply = () => {
    if (!queryStructure) {
      console.warn('[SimpleAdvancedFilter] No query structure defined');
      return;
    }

    const queryString = generateQueryString(
      queryStructure,
      sortField,
      sortOrder,
      populateFields
    );
    
    console.log('[SimpleAdvancedFilter] Applying query:', queryString);
    onApply(queryString);
    onClose();
  };

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent padding={6} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <Flex justifyContent="space-between" alignItems="center" marginBottom={4}>
          <Flex alignItems="center" gap={2}>
            <Search fill="primary600" />
            <Typography as="h2" variant="beta">Advanced Filters</Typography>
          </Flex>
          <Button onClick={onClose} variant="ghost" type="button">
            <Cross />
          </Button>
        </Flex>

        <Typography variant="pi" textColor="neutral600" marginBottom={4}>
          Build complex queries by combining AND/OR groups. Each group can contain conditions or nested groups.
        </Typography>

        {/* Query Builder */}
        <Box marginBottom={4}>
          <QueryBuilder 
            availableFields={availableFields}
            availableRelations={availableRelations}
            onQueryChange={handleQueryChange}
            initialStructure={initialStructure}
            isPremium={isPremium || isAdvanced}
            enableDeepFiltering={isPremium || isAdvanced}
          />
        </Box>

        {/* Upgrade prompt for non-premium users */}
        {!isPremium && !isAdvanced && (
          <Box marginBottom={4}>
            <UpgradePrompt
              feature="Sub-Groups & Drag & Drop"
              tier="premium"
              variant="inline"
              description="Upgrade to Premium to unlock nested query groups, drag & drop reordering, and more advanced filter options."
            />
          </Box>
        )}

        {/* Sorting Section */}
        <Box marginBottom={4} padding={3} background="warning100" borderRadius="4px">
          <Flex alignItems="center" gap={2} style={{ marginBottom: '12px' }}>
            <Filter fill="warning600" />
            <Typography variant="pi" fontWeight="bold">Sorting:</Typography>
          </Flex>
          <Flex gap={2} alignItems="center" style={{ flexWrap: 'wrap' }}>
            <Box style={{ flex: 2, minWidth: '200px' }}>
              <Typography variant="pi" style={{ marginBottom: '4px', display: 'block' }}>
                Sort by field:
              </Typography>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid rgba(128, 128, 128, 0.25)',
                  borderRadius: '4px',
                  background: 'transparent',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                <option value="">No sorting</option>
                {availableFields.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Box>

            {sortField && (
              <Box style={{ flex: 1, minWidth: '120px' }}>
                <Typography variant="pi" style={{ marginBottom: '4px', display: 'block' }}>
                  Order:
                </Typography>
                <Flex gap={2}>
                  <Button
                    variant={sortOrder === 'ASC' ? 'default' : 'secondary'}
                    size="S"
                    onClick={() => setSortOrder('ASC')}
                  >
                    ↑ ASC
                  </Button>
                  <Button
                    variant={sortOrder === 'DESC' ? 'default' : 'secondary'}
                    size="S"
                    onClick={() => setSortOrder('DESC')}
                  >
                    ↓ DESC
                  </Button>
                </Flex>
              </Box>
            )}
          </Flex>
          {sortField && (
            <Flex alignItems="center" gap={1} style={{ marginTop: '8px' }}>
              <Filter fill="warning700" width="12px" height="12px" />
              <Typography variant="pi" textColor="warning700" style={{ fontSize: '12px' }}>
                Results will be sorted by <strong>{sortField}</strong> in <strong>{sortOrder}</strong> order
              </Typography>
            </Flex>
          )}
        </Box>

        {/* Preview */}
        <Box marginBottom={4} padding={3} background="neutral100" borderRadius="4px">
          <Typography variant="pi" fontWeight="bold" style={{ marginBottom: '8px', display: 'block' }}>
            Generated Query:
          </Typography>
          <Typography variant="pi" fontFamily="monospace" style={{ wordBreak: 'break-all', fontSize: '11px' }}>
            {queryStructure ? generateQueryString(queryStructure, sortField, sortOrder, populateFields) : 'No filters defined'}
          </Typography>
        </Box>

        {/* Footer */}
        <Flex justifyContent="flex-end" gap={2}>
          <Button onClick={onClose} variant="tertiary">
            Cancel
          </Button>
          <Button onClick={handleApply} variant="default">
            Apply Filters
          </Button>
        </Flex>
      </ModalContent>
    </ModalOverlay>
  );
};

export default SimpleAdvancedFilterModal;

