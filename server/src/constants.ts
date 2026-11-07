/**
 * Shared server constants: plugin id, content-type UIDs and RBAC action ids.
 */
export const PLUGIN_ID = 'magic-mark';

export const BOOKMARK_UID = 'plugin::magic-mark.bookmark';
export const SHARE_UID = 'plugin::magic-mark.bookmark-share';
export const PREFERENCE_UID = 'plugin::magic-mark.bookmark-preference';
export const ADMIN_USER_UID = 'admin::user';
export const ADMIN_ROLE_UID = 'admin::role';
export const ADMIN_PERMISSION_UID = 'admin::permission';

/**
 * Permission action uids registered with the admin action provider.
 * The full action id is `plugin::magic-mark.<uid>`.
 */
export const ACTION_UIDS = {
  read: 'bookmarks.read',
  create: 'bookmarks.create',
  update: 'bookmarks.update',
  delete: 'bookmarks.delete',
  share: 'bookmarks.share',
  manage: 'bookmarks.manage',
} as const;

export type ActionKey = keyof typeof ACTION_UIDS;

/** Full action id for an action key, e.g. `plugin::magic-mark.bookmarks.read`. */
export const actionId = (key: ActionKey): string => `plugin::${PLUGIN_ID}.${ACTION_UIDS[key]}`;

/** Actions of plugin versions up to 3.x, mapped to the actions that replace them. */
export const LEGACY_ACTION_MAP: Record<string, ActionKey[]> = {
  [`plugin::${PLUGIN_ID}.settings.read`]: ['read'],
  [`plugin::${PLUGIN_ID}.settings.update`]: ['read', 'create', 'update', 'delete', 'share'],
};

/** Plugin store keys written by the removed license system (3.x). */
export const LEGACY_STORE_KEYS = ['licenseKey', 'lastValidated'] as const;

/** Upper bounds for list endpoints. */
export const LIMITS = {
  pageSizeMax: 100,
  shareTargetsMax: 200,
  userSearchPageSize: 20,
  migrationBatch: 200,
} as const;
