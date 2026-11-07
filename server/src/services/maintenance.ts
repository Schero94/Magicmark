/**
 * Maintenance service: one-time upgrades from 3.x and cleanup when admin users or roles
 * are deleted.
 *
 * Every step is idempotent and safe when several Strapi processes run it at the same time
 * (for example 2 replicas x 4 workers on one Postgres): a row is "claimed" with a guarded
 * `updateMany` (only the process that changed the row gets `count === 1`) and the follow-up
 * inserts run in the same transaction.
 */
import type { Core } from '@strapi/strapi';
import {
  ADMIN_PERMISSION_UID,
  ADMIN_ROLE_UID,
  ADMIN_USER_UID,
  BOOKMARK_UID,
  LEGACY_ACTION_MAP,
  LEGACY_STORE_KEYS,
  LIMITS,
  PLUGIN_ID,
  PREFERENCE_UID,
  SHARE_UID,
  actionId,
} from '../constants';
import { normalizeListViewPath } from '../validation';

interface LegacyRow {
  id: number;
  documentId: string;
  path: string | null;
  contentType: string | null;
  creatorId: string | null;
  isPinned: boolean | null;
  sharedWithRoles: unknown;
  sharedWithUsers: unknown;
}

/**
 * Maps 3.x share ids (documentId strings or numeric ids) to existing documentIds.
 * @param strapi - Strapi instance.
 * @param uid - admin::role or admin::user.
 * @param raw - Stored JSON value.
 * @returns Unique documentIds that exist.
 */
const resolveLegacyIds = async (strapi: Core.Strapi, uid: string, raw: unknown) => {
  if (!Array.isArray(raw) || raw.length === 0) return [] as string[];
  const values = raw.slice(0, 1000);
  const numeric = values
    .map((value) =>
      typeof value === 'number' ? value : /^\d+$/.test(String(value)) ? Number(value) : NaN
    )
    .filter((value) => Number.isInteger(value));
  const strings = values.filter(
    (value): value is string => typeof value === 'string' && !/^\d+$/.test(value)
  );
  const or: Record<string, unknown>[] = [];
  if (numeric.length) or.push({ id: { $in: numeric } });
  if (strings.length) or.push({ documentId: { $in: strings } });
  if (!or.length) return [];
  const rows = await strapi.db.query(uid).findMany({ where: { $or: or }, select: ['documentId'] });
  return [...new Set(rows.map((row: { documentId: string }) => row.documentId))];
};

const maintenanceService = ({ strapi }: { strapi: Core.Strapi }) => {
  const db = strapi.db;

  /** Migrates one 3.x bookmark row. */
  const migrateRow = async (row: LegacyRow) => {
    // 1. Path and content type (3.x stored relative paths and no content type).
    if (row.contentType === null || row.contentType === undefined) {
      const normalized = normalizeListViewPath(row.path);
      await db.query(BOOKMARK_UID).updateMany({
        where: { id: row.id, contentType: { $null: true } },
        data: normalized
          ? { path: normalized.path, contentType: normalized.contentType }
          : { contentType: '' },
      });
    }

    // 2. Share JSON -> bookmark-share rows.
    if (row.sharedWithRoles !== null || row.sharedWithUsers !== null) {
      const [roles, users] = await Promise.all([
        resolveLegacyIds(strapi, ADMIN_ROLE_UID, row.sharedWithRoles),
        resolveLegacyIds(strapi, ADMIN_USER_UID, row.sharedWithUsers),
      ]);
      await db.transaction(async () => {
        const { count } = await db.query(BOOKMARK_UID).updateMany({
          where: {
            id: row.id,
            $or: [{ sharedWithRoles: { $notNull: true } }, { sharedWithUsers: { $notNull: true } }],
          },
          data: { sharedWithRoles: null, sharedWithUsers: null },
        });
        if (count !== 1) return;
        const data = [
          ...roles.map((targetId) => ({ targetType: 'role', targetId })),
          ...users
            .filter((targetId) => targetId !== row.creatorId)
            .map((targetId) => ({ targetType: 'user', targetId })),
        ].map((share) => ({ ...share, bookmarkDocumentId: row.documentId }));
        if (data.length) await db.query(SHARE_UID).createMany({ data });
      });
    }

    // 3. Global owner pin -> the owner's own preference.
    if (row.isPinned) {
      await db.transaction(async () => {
        const { count } = await db.query(BOOKMARK_UID).updateMany({
          where: { id: row.id, isPinned: true },
          data: { isPinned: false },
        });
        if (count !== 1 || !row.creatorId) return;
        const exists = await db.query(PREFERENCE_UID).count({
          where: { userId: row.creatorId, bookmarkDocumentId: row.documentId },
        });
        if (!exists) {
          await db.query(PREFERENCE_UID).create({
            data: { userId: row.creatorId, bookmarkDocumentId: row.documentId, isPinned: true },
          });
        }
      });
    }
  };

  return {
    /**
     * Deletes the store keys of the removed 3.x license system.
     * @sideeffect Deletes plugin store rows `licenseKey` and `lastValidated`.
     */
    async removeLegacyLicenseKeys() {
      const store = strapi.store({ type: 'plugin', name: PLUGIN_ID });
      for (const key of LEGACY_STORE_KEYS) {
        await store.delete({ key });
      }
    },

    /**
     * Migrates every 3.x bookmark row (paths, content types, share JSON, global pins).
     * Walks by id cursor in batches; rows already migrated are not selected again.
     * @returns Number of rows inspected.
     */
    async migrateLegacyBookmarks() {
      let cursor = 0;
      let inspected = 0;
      for (;;) {
        const rows: LegacyRow[] = await db.query(BOOKMARK_UID).findMany({
          where: {
            id: { $gt: cursor },
            $or: [
              { contentType: { $null: true } },
              { sharedWithRoles: { $notNull: true } },
              { sharedWithUsers: { $notNull: true } },
              { isPinned: true },
            ],
          },
          select: [
            'id',
            'documentId',
            'path',
            'contentType',
            'creatorId',
            'isPinned',
            'sharedWithRoles',
            'sharedWithUsers',
          ],
          orderBy: { id: 'asc' },
          limit: LIMITS.migrationBatch,
        });
        if (!rows.length) return inspected;
        for (const row of rows) {
          try {
            await migrateRow(row);
          } catch (error) {
            strapi.log.error('[magic-mark] Bookmark migration failed for one row', {
              name: (error as Error)?.name,
            });
          }
        }
        inspected += rows.length;
        cursor = rows[rows.length - 1].id;
      }
    },

    /**
     * Grants the 4.x actions to every role that held a 3.x action. Runs before the admin
     * removes permissions of unregistered actions, so existing roles keep their access.
     * @sideeffect Creates admin permission rows.
     */
    async migrateLegacyPermissions() {
      const legacy = await db.query(ADMIN_PERMISSION_UID).findMany({
        where: { action: { $in: Object.keys(LEGACY_ACTION_MAP) } },
        populate: ['role'],
      });
      const wanted = new Map<number, Set<string>>();
      for (const permission of legacy as { action: string; role?: { id: number } }[]) {
        if (!permission.role?.id) continue;
        const set = wanted.get(permission.role.id) ?? new Set<string>();
        for (const key of LEGACY_ACTION_MAP[permission.action] ?? []) set.add(actionId(key));
        wanted.set(permission.role.id, set);
      }
      for (const [roleId, actions] of wanted) {
        const existing = await db.query(ADMIN_PERMISSION_UID).findMany({
          where: { role: { id: roleId }, action: { $in: [...actions] } },
          select: ['action'],
        });
        const have = new Set(existing.map((row: { action: string }) => row.action));
        const missing = [...actions].filter((action) => !have.has(action));
        if (!missing.length) continue;
        await strapi.admin.services.permission.createMany(
          missing.map((action) => ({
            action,
            subject: null,
            properties: {},
            conditions: [],
            role: roleId,
          }))
        );
      }
    },

    /**
     * Removes what deleted admin users leave behind: their shares and pins, and their
     * private bookmarks. Public or shared bookmarks stay; `bookmarks.manage` can remove them.
     * @param userIds - documentIds of the deleted users.
     */
    async cleanupDeletedUsers(userIds: string[]) {
      if (!userIds.length) return;
      await db.query(SHARE_UID).deleteMany({
        where: { targetType: 'user', targetId: { $in: userIds } },
      });
      await db.query(PREFERENCE_UID).deleteMany({ where: { userId: { $in: userIds } } });

      const owned: { documentId: string }[] = await db.query(BOOKMARK_UID).findMany({
        where: { creatorId: { $in: userIds }, isPublic: false },
        select: ['documentId'],
      });
      if (!owned.length) return;
      const ids = owned.map((row) => row.documentId);
      const shared = await db.query(SHARE_UID).findMany({
        where: { bookmarkDocumentId: { $in: ids } },
        select: ['bookmarkDocumentId'],
      });
      const sharedIds = new Set(
        shared.map((row: { bookmarkDocumentId: string }) => row.bookmarkDocumentId)
      );
      const privateIds = ids.filter((id) => !sharedIds.has(id));
      if (!privateIds.length) return;
      await db.query(PREFERENCE_UID).deleteMany({
        where: { bookmarkDocumentId: { $in: privateIds } },
      });
      await db.query(BOOKMARK_UID).deleteMany({ where: { documentId: { $in: privateIds } } });
    },

    /**
     * Removes share rows that point at deleted roles.
     * @param roleIds - documentIds of the deleted roles.
     */
    async cleanupDeletedRoles(roleIds: string[]) {
      if (!roleIds.length) return;
      await db.query(SHARE_UID).deleteMany({
        where: { targetType: 'role', targetId: { $in: roleIds } },
      });
    },
  };
};

export type MaintenanceService = ReturnType<typeof maintenanceService>;
export default maintenanceService;
