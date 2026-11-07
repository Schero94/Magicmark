// @ts-nocheck
import { useState, useCallback, useRef } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import { getFilterableAttributes } from '../utils/filterableAttributes.mjs';

interface SchemaAttribute {
  type: string;
  relation?: string;
  target?: string;
  required?: boolean;
  [key: string]: any;
}

interface SchemaCache {
  [uid: string]: {
    attributes: Record<string, SchemaAttribute>;
    timestamp: number;
  };
}

interface RelationField {
  name: string;
  type: string;
  isRelation: boolean;
  target?: string;
}

/**
 * Hook to fetch and cache relation schemas from the content-type-builder API
 * Used for deep filtering on relation fields (e.g., user.email, user.role.name)
 */
export const useRelationSchema = () => {
  const { get } = useFetchClient();
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const cacheRef = useRef<SchemaCache>({});
  
  // Cache TTL: 5 minutes
  const CACHE_TTL = 5 * 60 * 1000;

  /**
   * Fetches schema for a content type UID
   * @param uid - Content type UID (e.g., "plugin::users-permissions.user")
   * @returns Schema attributes or null on error
   */
  const fetchSchema = useCallback(async (uid: string): Promise<Record<string, SchemaAttribute> | null> => {
    // Check cache first
    const cached = cacheRef.current[uid];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[RelationSchema] Using cached schema for:', uid);
      return cached.attributes;
    }

    setLoading(prev => ({ ...prev, [uid]: true }));
    setErrors(prev => ({ ...prev, [uid]: '' }));

    try {
      console.log('[RelationSchema] Fetching schema for:', uid);
      const response = await get(`/content-type-builder/content-types/${uid}`);
      
      const schemaInfo = response.data?.data?.schema || response.data?.schema || {};
      const attributes = schemaInfo.attributes || {};
      
      // Cache the result
      cacheRef.current[uid] = {
        attributes,
        timestamp: Date.now(),
      };

      console.log('[RelationSchema] Fetched attributes for', uid, ':', Object.keys(attributes));
      setLoading(prev => ({ ...prev, [uid]: false }));
      return attributes;

    } catch (error: any) {
      console.error('[RelationSchema] Error fetching schema for', uid, ':', error);
      const errorMessage = error.message || 'Failed to fetch schema';
      setErrors(prev => ({ ...prev, [uid]: errorMessage }));
      setLoading(prev => ({ ...prev, [uid]: false }));
      return null;
    }
  }, [get]);

  /**
   * Gets filterable fields from a schema (excludes media, components, etc.)
   * @param uid - Content type UID
   * @returns Array of filterable fields with metadata
   */
  const getFilterableFields = useCallback(async (uid: string): Promise<RelationField[]> => {
    const attributes = await fetchSchema(uid);
    if (!attributes) return [];

      const filterable = getFilterableAttributes(attributes);
      const fields: RelationField[] = filterable.fields.map((field) => ({
        ...field,
        isRelation: false,
      }));

      fields.push(...filterable.relations.map((relation) => ({
        name: relation.name,
        type: 'relation',
        isRelation: true,
        target: relation.target,
      })));

      return fields;
  }, [fetchSchema]);

  /**
   * Gets fields for a relation's target (for nested filtering)
   * @param relationTarget - Target UID of the relation
   * @returns Array of fields from the related content type
   */
  const getRelationFields = useCallback(async (relationTarget: string): Promise<RelationField[]> => {
    return getFilterableFields(relationTarget);
  }, [getFilterableFields]);

  /**
   * Clears the schema cache
   */
  const clearCache = useCallback(() => {
    cacheRef.current = {};
    console.log('[RelationSchema] Cache cleared');
  }, []);

  /**
   * Gets schema from cache without fetching
   * @param uid - Content type UID
   * @returns Cached attributes or null
   */
  const getCachedSchema = useCallback((uid: string): Record<string, SchemaAttribute> | null => {
    const cached = cacheRef.current[uid];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.attributes;
    }
    return null;
  }, []);

  return {
    fetchSchema,
    getFilterableFields,
    getRelationFields,
    clearCache,
    getCachedSchema,
    loading,
    errors,
  };
};

export default useRelationSchema;

