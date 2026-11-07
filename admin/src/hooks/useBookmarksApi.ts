/**
 * Typed wrappers around the plugin's admin routes. `useFetchClient` adds and refreshes the
 * admin token; callers handle errors with `isFetchError` / `useAPIErrorHandler`.
 */
import { useFetchClient } from '@strapi/strapi/admin';
import { useMemo } from 'react';
import type {
  Bookmark,
  BookmarkInput,
  BookmarkList,
  Pagination,
  ShareRole,
  ShareUser,
} from '../types';

export interface ListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  scope?: 'all' | 'mine' | 'shared' | 'pinned' | 'managed';
  sort?: string;
  contentType?: string;
}

const BASE = '/magic-mark';

/**
 * @returns API methods bound to the current admin session.
 */
export const useBookmarksApi = () => {
  const { get, post, put, del } = useFetchClient();

  return useMemo(
    () => ({
      list: async (params: ListParams, signal?: AbortSignal) => {
        const clean = Object.fromEntries(
          Object.entries(params).filter(([, value]) => value !== undefined && value !== '')
        );
        const { data } = await get<BookmarkList>(`${BASE}/bookmarks`, { params: clean, signal });
        return data;
      },
      get: async (id: string) =>
        (await get<{ data: Bookmark }>(`${BASE}/bookmarks/${id}`)).data.data,
      create: async (input: BookmarkInput) =>
        (await post<{ data: Bookmark }>(`${BASE}/bookmarks`, input)).data.data,
      update: async (id: string, input: BookmarkInput) =>
        (await put<{ data: Bookmark }>(`${BASE}/bookmarks/${id}`, input)).data.data,
      updateView: async (id: string, query: string) =>
        (await put<{ data: Bookmark }>(`${BASE}/bookmarks/${id}/view`, { query })).data.data,
      duplicate: async (id: string, name?: string) =>
        (await post<{ data: Bookmark }>(`${BASE}/bookmarks/${id}/duplicate`, name ? { name } : {}))
          .data.data,
      pin: async (id: string, pinned: boolean) =>
        (await put<{ data: { isPinned: boolean } }>(`${BASE}/bookmarks/${id}/pin`, { pinned })).data
          .data,
      remove: async (id: string) => {
        await del(`${BASE}/bookmarks/${id}`);
      },
      roles: async () => (await get<{ data: ShareRole[] }>(`${BASE}/sharing/roles`)).data.data,
      users: async (q: string, page = 1, signal?: AbortSignal) =>
        (
          await get<{ data: ShareUser[]; meta: { pagination: Pagination } }>(
            `${BASE}/sharing/users`,
            { params: q ? { q, page } : { page }, signal }
          )
        ).data,
    }),
    [get, post, put, del]
  );
};
