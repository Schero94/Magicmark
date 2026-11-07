/**
 * Content type schemas and filterable fields from the Content Manager's own admin API
 * (`GET /content-manager/init` and `GET /content-manager/content-types/:uid/configuration`).
 * Every admin who can use the Content Manager may call both, unlike the Content-Type
 * Builder API, which needs builder permissions.
 */
import { useAuth, useFetchClient } from '@strapi/strapi/admin';
import { useEffect, useMemo, useState } from 'react';
import type { FieldOption } from '../utils/filters';
import { buildFieldOptions, type InitData, type Metadata } from '../utils/fieldOptions';

let initCache: Promise<InitData> | null = null;
const configCache = new Map<string, Promise<Record<string, Metadata>>>();

type Get = ReturnType<typeof useFetchClient>['get'];

const loadInit = (get: Get): Promise<InitData> => {
  if (!initCache) {
    initCache = get<{ data: InitData }>('/content-manager/init')
      .then(({ data }) => data.data)
      .catch((error) => {
        initCache = null;
        throw error;
      });
  }
  return initCache;
};

const loadMetadatas = (get: Get, uid: string): Promise<Record<string, Metadata>> => {
  let promise = configCache.get(uid);
  if (!promise) {
    promise = get<{ data: { contentType: { metadatas: Record<string, Metadata> } } }>(
      `/content-manager/content-types/${uid}/configuration`
    )
      .then(({ data }) => data.data.contentType.metadatas ?? {})
      .catch((error) => {
        configCache.delete(uid);
        throw error;
      });
    configCache.set(uid, promise);
  }
  return promise;
};

/**
 * Display names of every content type, keyed by uid.
 * @returns `{ names, isLoading, error }`.
 */
export const useContentTypeNames = () => {
  const { get } = useFetchClient();
  const [state, setState] = useState<{
    names: Map<string, string>;
    isLoading: boolean;
    error: unknown;
  }>({
    names: new Map(),
    isLoading: true,
    error: null,
  });
  useEffect(() => {
    let active = true;
    loadInit(get)
      .then((init) => {
        if (!active) return;
        setState({
          names: new Map(init.contentTypes.map((ct) => [ct.uid, ct.info?.displayName ?? ct.uid])),
          isLoading: false,
          error: null,
        });
      })
      .catch((error) => active && setState({ names: new Map(), isLoading: false, error }));
    return () => {
      active = false;
    };
  }, [get]);
  return state;
};

/**
 * Filterable fields of a content type for the advanced filters.
 * @param uid - Content type uid, or null to load nothing.
 * @returns `{ fields, isLoading, error, retry }`.
 */
export const useFilterFields = (uid: string | null) => {
  const { get } = useFetchClient();
  const permissions = useAuth('MagicMarkFilters', (state) => state.permissions);
  const [attempt, setAttempt] = useState(0);
  // Results are stored with the request key, so a new uid or a retry shows "loading"
  // without a synchronous state update inside the effect.
  const [state, setState] = useState<{ key: string; fields: FieldOption[]; error: unknown }>({
    key: '',
    fields: [],
    error: null,
  });

  const readable = useMemo(() => {
    const permission = permissions.find(
      (p) => p.action === 'plugin::content-manager.explorer.read' && p.subject === uid
    );
    const fields = (permission?.properties as { fields?: string[] } | undefined)?.fields;
    return Array.isArray(fields) ? fields : null;
  }, [permissions, uid]);

  const key = uid ? `${uid}:${attempt}` : '';

  useEffect(() => {
    if (!uid) return undefined;
    let active = true;
    Promise.all([loadInit(get), loadMetadatas(get, uid)])
      .then(([init, metadatas]) => {
        if (active) {
          setState({ key, fields: buildFieldOptions(uid, init, metadatas, readable), error: null });
        }
      })
      .catch((error) => active && setState({ key, fields: [], error }));
    return () => {
      active = false;
    };
  }, [get, uid, readable, key]);

  const current = state.key === key;
  return {
    fields: current ? state.fields : [],
    error: current ? state.error : null,
    isLoading: !!uid && !current,
    retry: () => setAttempt((n) => n + 1),
  };
};
