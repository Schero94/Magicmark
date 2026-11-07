// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Filter, Cross } from '@strapi/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFetchClient } from '@strapi/strapi/admin';
import styled from 'styled-components';
import StrapiStyleFilterModal from './StrapiStyleFilterModal';
import { useLicenseInfo } from '../hooks/useFeatureGate';
import { getFilterableAttributes } from '../utils/filterableAttributes.mjs';

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
  border: 1px solid ${props => props.$isActive ? '#4945FF' : 'rgba(128, 128, 128, 0.25)'};
  border-radius: 4px;
  background: ${props => props.$isActive 
    ? 'rgba(73, 69, 255, 0.08)' 
    : props.theme.colors.neutral0};
  color: ${props => props.$isActive ? '#4945FF' : props.theme.colors.neutral800};
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  
  &:hover {
    background: ${props => props.$isActive ? 'rgba(73, 69, 255, 0.12)' : props.theme.colors.neutral100};
    border-color: ${props => props.$isActive ? '#4945FF' : 'rgba(128, 128, 128, 0.3)'};
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
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 4px;
  background: rgba(239, 68, 68, 0.06);
  color: #dc2626;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.4);
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
  const { isAdvanced } = useLicenseInfo();
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
        return;
      }

      try {
        // Step 1: Get the REAL schema from content-type-builder (has correct attribute types)
        let realAttributes: Record<string, any> = {};
        try {
          const schemaResponse = await get(`/content-type-builder/content-types/${uid}`);
          const schemaInfo = schemaResponse.data?.data?.schema || schemaResponse.data?.schema || {};
          realAttributes = schemaInfo.attributes || {};
        } catch {
          // Continue with field metadata if the schema endpoint is unavailable.
        }
        
        // Step 2: Also get configuration for field metadata (labels, etc.)
        let metadatas: Record<string, any> = {};
        try {
          const configResponse = await get(`/content-manager/content-types/${uid}/configuration`);
          const contentTypeData = configResponse.data?.data?.contentType || configResponse.data?.contentType || {};
          metadatas = contentTypeData.metadatas || {};
        } catch {
          // The real schema remains sufficient when display metadata is unavailable.
        }
        
        // Exclude private, hidden and unsupported attributes before populating
        // filters that are serialized into Content Manager requests.
        const { fields, relations } = getFilterableAttributes(realAttributes, metadatas);
        setAvailableFields(fields);
        setAvailableRelations(relations);
        
      } catch {
        console.error('[AdvancedFilter] Error fetching schema');
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
    return currentQuery;
  };

  return (
    <FilterButtonGroup>
      <FilterButton
        $isActive={hasActiveFilters}
        onClick={() => setShowModal(true)}
        title={isAdvanced ? 'Open advanced filter builder' : 'Open filter builder'}
        aria-label={isAdvanced ? 'Open advanced filter builder' : 'Open filter builder'}
      >
        <Filter />
        {isAdvanced ? 'Advanced Filter' : 'Filter'}
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
        <StrapiStyleFilterModal
          onClose={() => setShowModal(false)}
          onApply={handleApplyFilters}
          availableFields={availableFields}
          availableRelations={isAdvanced ? availableRelations : []}
          currentQuery={getCurrentFilters()}
          enableNestedGroups={isAdvanced}
        />
      )}
    </FilterButtonGroup>
  );
};

export default AdvancedFilterButton;

