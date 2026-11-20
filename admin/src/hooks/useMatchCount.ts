/**
 * Live result count for the filter editor: asks the Content Manager's own list endpoint
 * (`GET /content-manager/collection-types/:uid`, the request the list view makes) for one
 * entry and reads `pagination.total`. Debounced, cancelled when the filters change or the
 * editor closes, and never retried on its own.
 */
import { getFetchClient } from '@strapi/strapi/admin';
import { useEffect, useState } from 'react';
import { stringifyQuery } from '../utils/query';

/** Wait after the last change before counting. */
export const COUNT_DELAY_MS = 400;

export type MatchCount =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; count: number }
  | { status: 'error' };

/**
 * @param uid - Content type uid.
 * @param filters - Filters to count (already in the list API's form), undefined for no
 *   filters, or null when the editor has errors and nothing should be counted.
 * @param locale - Locale of the list view, if any.
 * @returns The count state.
 */
export const useMatchCount = (
  uid: string,
  filters: Record<string, unknown> | undefined | null,
  locale: string | undefined
): MatchCount => {
  const key = filters === null ? '' : JSON.stringify([uid, filters ?? null, locale ?? null]);
  const [state, setState] = useState<{ key: string; result: MatchCount }>({
    key: '',
    result: { status: 'idle' },
  });

  useEffect(() => {
    if (!key) return undefined;
    // Everything the request needs is in `key`, so it is the effect's only input. The request
    // is aborted by this effect's cleanup (getFetchClient: no component-bound signal).
    const [model, current, lang] = JSON.parse(key) as [
      string,
      Record<string, unknown> | null,
      string | null,
    ];
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = stringifyQuery({
        page: 1,
        pageSize: 1,
        ...(lang ? { locale: lang } : {}),
        ...(current ? { filters: current } : {}),
      });
      getFetchClient()
        .get<{ pagination?: { total?: number } }>(`/content-manager/collection-types/${model}`, {
          params,
          signal: controller.signal,
        })
        .then(({ data }) => {
          const count = data?.pagination?.total;
          setState({
            key,
            result: typeof count === 'number' ? { status: 'ready', count } : { status: 'error' },
          });
        })
        .catch(() => {
          if (!controller.signal.aborted) setState({ key, result: { status: 'error' } });
        });
    }, COUNT_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  if (!key) return { status: 'idle' };
  return state.key === key ? state.result : { status: 'loading' };
};
