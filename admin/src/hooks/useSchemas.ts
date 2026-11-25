/**
 * Content type schemas and filterable fields from the Content Manager's own admin API
 * (`GET /content-manager/init` and `GET /content-manager/content-types/:uid/configuration`).
 * Every admin who can use the Content Manager may call both, unlike the Content-Type
 * Builder API, which needs builder permissions.
 */
import { getFetchClient, useAuth } from '@strapi/strapi/admin';
import { useEffect, useMemo, useState } from 'react';
import type { FieldOption } from '../utils/filters';
import { buildFieldOptions, type InitData, type Metadata } from '../utils/fieldOptions';

let initCache: Promise<InitData> | null = null;
const configCache = new Map<string, Promise<Record<string, Metadata>>>();

/**
 * GET for the session-wide caches below. They are shared by every component, so their requests
 * must not belong to one component: `useFetchClient` aborts its requests when its component
 * unmounts (React StrictMode unmounts once on mount), which would reject the cached promise for
 * every other consumer. `getFetchClient()` has no component-bound abort signal.
 * @param url - Admin API path.
 * @returns The fetch client response.
 */
const sessionGet = <T>(url: string) => getFetchClient().get<T>(url);

/**
 * Schemas from `/content-manager/init`, loaded once per admin session.
 */
export const loadInit = (): Promise<InitData> => {
  if (!initCache) {
    initCache = sessionGet<{ data: InitData }>('/content-manager/init')
      .then(({ data }) => data.data)
      .catch((error) => {
        initCache = null;
        throw error;
      });
  }
  return initCache;
};

const loadMetadatas = (uid: string): Promise<Record<string, Metadata>> => {
  let promise = configCache.get(uid);
  if (!promise) {
    promise = sessionGet<{ data: { contentType: { metadatas: Record<string, Metadata> } } }>(
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
    loadInit()
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
  }, []);
  return state;
};

/**
 * Filterable fields of a content type for the advanced filters.
 * @param uid - Content type uid, or null to load nothing.
 * @returns `{ fields, isLoading, error, retry }`.
 */
export const useFilterFields = (uid: string | null) => {
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
    Promise.all([loadInit(), loadMetadatas(uid)])
      .then(([init, metadatas]) => {
        if (active) {
          setState({ key, fields: buildFieldOptions(uid, init, metadatas, readable), error: null });
        }
      })
      .catch((error) => active && setState({ key, fields: [], error }));
    return () => {
      active = false;
    };
  }, [uid, readable, key]);

  const current = state.key === key;
  return {
    fields: current ? state.fields : [],
    error: current ? state.error : null,
    isLoading: !!uid && !current,
    retry: () => setAttempt((n) => n + 1),
  };
};
