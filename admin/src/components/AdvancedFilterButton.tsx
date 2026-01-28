// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Filter, Cross } from '@strapi/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFetchClient } from '@strapi/strapi/admin';
import styled from 'styled-components';
import SimpleAdvancedFilterModal from './SimpleAdvancedFilterModal';

// ================ STYLED COMPONENTS ================
const FilterButtonGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const FilterButton = styled.button<{ $isActive?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid ${props => props.$isActive ? '#4945FF' : '#dcdce4'};
  border-radius: 4px;
  background: ${props => props.$isActive 
    ? '#EEF0FF' 
    : '#ffffff'};
  color: ${props => props.$isActive ? '#4945FF' : '#32324d'};
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  
  &:hover {
    background: ${props => props.$isActive ? '#E0E7FF' : '#f6f6f9'};
    border-color: ${props => props.$isActive ? '#4945FF' : '#c0c0cf'};
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
`;

const ClearButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid #fecaca;
  border-radius: 4px;
  background: #fef2f2;
  color: #dc2626;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: #fee2e2;
    border-color: #fca5a5;
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

const ActiveDot = styled.span`
  width: 6px;
  height: 6px;
  background: #22c55e;
  border-radius: 50%;
  margin-left: 2px;
`;

const AdvancedFilterButton: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { get } = useFetchClient();
  const [availableFields, setAvailableFields] = useState<Array<{ name: string; type: string }>>([]);
  const [availableRelations, setAvailableRelations] = useState<Array<{ name: string; target: string }>>([]);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);

  // Check if URL has filters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    let hasFilters = false;
    params.forEach((value, key) => {
      if (key.startsWith('filters[')) {
        hasFilters = true;
      }
    });
    setHasActiveFilters(hasFilters);
  }, [location.search]);

  // Extract content type UID from URL
  // /admin/content-manager/collection-types/plugin::users-permissions.user -> plugin::users-permissions.user
  const extractContentTypeUid = (): string | null => {
    const match = location.pathname.match(/collection-types\/([^/?]+)/);
    return match ? match[1] : null;
  };

  /**
   * Fetches schema for current content type and extracts fields + relations
   */
  useEffect(() => {
    const fetchSchema = async () => {
      const uid = extractContentTypeUid();
      if (!uid) {
        console.log('[AdvancedFilter] No content type UID found in URL');
        return;
      }

      try {
        console.log('[AdvancedFilter] Fetching schema for:', uid);
        
        // Step 1: Get the REAL schema from content-type-builder (has correct attribute types)
        let realAttributes: Record<string, any> = {};
        try {
          const schemaResponse = await get(`/content-type-builder/content-types/${uid}`);
          const schemaInfo = schemaResponse.data?.data?.schema || schemaResponse.data?.schema || {};
          realAttributes = schemaInfo.attributes || {};
          console.log('[AdvancedFilter] Real schema attributes:', realAttributes);
        } catch (e) {
          console.log('[AdvancedFilter] Content-type-builder endpoint failed:', e);
        }
        
        // Step 2: Also get configuration for field metadata (labels, etc.)
        let metadatas: Record<string, any> = {};
        try {
          const configResponse = await get(`/content-manager/content-types/${uid}/configuration`);
          const contentTypeData = configResponse.data?.data?.contentType || configResponse.data?.contentType || {};
          metadatas = contentTypeData.metadatas || {};
          console.log('[AdvancedFilter] Configuration metadatas:', metadatas);
        } catch (e) {
          console.log('[AdvancedFilter] Configuration endpoint failed:', e);
        }
        
        // Step 3: Extract fields and relations from REAL attributes
        const fields: Array<{ name: string; type: string }> = [];
        const relations: Array<{ name: string; target: string }> = [];
        const fieldNames = new Set<string>();
        
        // Process real attributes (this has correct types!)
        Object.keys(realAttributes).forEach((key) => {
          const attr = realAttributes[key];
          const attrType = attr.type;
          
          // Skip internal fields
          if (['createdBy', 'updatedBy', 'localizations', 'locale'].includes(key)) {
            return;
          }
          
          // Check if it's a relation
          if (attrType === 'relation') {
            relations.push({ name: key, target: attr.target });
            console.log('[AdvancedFilter] Found relation:', key, '-> target:', attr.target);
          } else if (attrType === 'component' || attrType === 'dynamiczone') {
            // Skip components and dynamic zones for filtering
            console.log('[AdvancedFilter] Skipping component/dynamiczone:', key);
          } else if (attrType === 'media') {
            // Skip media for now (complex filtering)
            console.log('[AdvancedFilter] Skipping media:', key);
          } else if (!fieldNames.has(key)) {
            // Regular field
            fieldNames.add(key);
            fields.push({ 
              name: key, 
              type: attrType || 'string' 
            });
          }
        });

        // Add default fields if not already present
        ['id', 'documentId', 'createdAt', 'updatedAt'].forEach(defaultField => {
          if (!fieldNames.has(defaultField)) {
            let type = 'string';
            if (defaultField === 'id') type = 'integer';
            if (defaultField === 'createdAt' || defaultField === 'updatedAt') type = 'datetime';
            fields.unshift({ name: defaultField, type });
          }
        });

        setAvailableFields(fields);
        setAvailableRelations(relations);
        
        console.log('[AdvancedFilter] Final fields:', fields);
        console.log('[AdvancedFilter] Final relations:', relations);
        
      } catch (error) {
        console.error('[AdvancedFilter] Error fetching schema:', error);
        // Fallback to basic fields
        setAvailableFields([
          { name: 'id', type: 'integer' },
          { name: 'documentId', type: 'string' },
          { name: 'createdAt', type: 'datetime' },
          { name: 'updatedAt', type: 'datetime' },
        ]);
      }
    };

    fetchSchema();
  }, [location.pathname]);

  const handleApplyFilters = (queryString: string) => {
    console.log('[AdvancedFilter] Applying filters:', queryString);
    
    // Get current path
    const currentPath = location.pathname;
    
    // Merge with existing query (keep pagination, sorting if present)
    const currentParams = new URLSearchParams(location.search);
    const newParams = new URLSearchParams(queryString);
    
    // Remove old filters
    const cleanParams = new URLSearchParams();
    currentParams.forEach((value, key) => {
      if (!key.startsWith('filters[') && !key.startsWith('populate[')) {
        cleanParams.set(key, value);
      }
    });
    
    // Add new filters
    newParams.forEach((value, key) => {
      cleanParams.set(key, value);
    });
    
    // Reset to page 1 when applying filters
    cleanParams.set('page', '1');
    
    const finalUrl = `${currentPath}?${cleanParams.toString()}`;
    console.log('[AdvancedFilter] Final URL:', finalUrl);
    
    // Navigate first, then reload to ensure Strapi CM picks up the filters
    navigate(finalUrl);
    
    // Small delay then reload to ensure the URL is updated before reload
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const handleClearFilters = () => {
    const currentPath = location.pathname;
    const currentParams = new URLSearchParams(location.search);
    
    // Keep only non-filter params (like page, pageSize, sort)
    const cleanParams = new URLSearchParams();
    currentParams.forEach((value, key) => {
      if (!key.startsWith('filters[') && !key.startsWith('populate[')) {
        cleanParams.set(key, value);
      }
    });
    
    const finalUrl = `${currentPath}${cleanParams.toString() ? '?' + cleanParams.toString() : ''}`;
    navigate(finalUrl);
    
    // Small delay then reload
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  // Extract current filters from URL
  const getCurrentFilters = () => {
    const params = new URLSearchParams(location.search);
    const currentQuery = params.toString();
    console.log('[AdvancedFilter] Current query from URL:', currentQuery);
    return currentQuery;
  };

  return (
    <FilterButtonGroup>
      <FilterButton
        $isActive={hasActiveFilters}
        onClick={() => setShowModal(true)}
        title="Open advanced filter builder"
      >
        <Filter />
        Filters
        {hasActiveFilters && <ActiveDot />}
      </FilterButton>

      {hasActiveFilters && (
        <ClearButton
          onClick={handleClearFilters}
          title="Clear all filters"
        >
          <Cross />
        </ClearButton>
      )}

      {showModal && (
        <SimpleAdvancedFilterModal
          onClose={() => setShowModal(false)}
          onApply={handleApplyFilters}
          availableFields={availableFields}
          availableRelations={availableRelations}
          currentQuery={getCurrentFilters()}
        />
      )}
    </FilterButtonGroup>
  );
};

export default AdvancedFilterButton;

