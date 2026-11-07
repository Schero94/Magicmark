/** Shapes returned by the plugin's admin API. */
export type Visibility = 'private' | 'shared' | 'public';

export interface Bookmark {
  documentId: string;
  name: string;
  description: string;
  icon: string;
  path: string | null;
  contentType: string | null;
  query: string;
  visibility: Visibility;
  owner: { name: string | null; isDeleted: boolean } | null;
  isOwner: boolean;
  isPinned: boolean;
  canEdit: boolean;
  createdAt?: string;
  updatedAt?: string;
  sharing?: {
    roles: { documentId: string; name: string }[];
    users: { documentId: string; name: string | null; email?: string | null }[];
  };
}

export interface Pagination {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

export interface BookmarkList {
  data: Bookmark[];
  meta: { pagination: Pagination; permissions: { canShare: boolean; canManage: boolean } };
}

export interface BookmarkInput {
  name?: string;
  description?: string;
  icon?: string;
  path?: string;
  query?: string;
  visibility?: Visibility;
  roles?: string[];
  users?: string[];
}

export interface ShareUser {
  documentId: string;
  name: string | null;
  email?: string | null;
}

export interface ShareRole {
  documentId: string;
  name: string;
}
