/**
 * RBAC permissions used by the admin UI. They only decide what the UI shows; the server
 * checks the same actions on every route.
 */
const action = (uid: string) => [{ action: `plugin::magic-mark.${uid}`, subject: null }];

export const PERMISSIONS = {
  read: action('bookmarks.read'),
  create: action('bookmarks.create'),
  update: action('bookmarks.update'),
  delete: action('bookmarks.delete'),
  share: action('bookmarks.share'),
  manage: action('bookmarks.manage'),
};

/** Flat list for useRBAC: allowedActions.canRead, canCreate, canUpdate, ... */
export const ALL_PERMISSIONS = Object.values(PERMISSIONS).flat();
