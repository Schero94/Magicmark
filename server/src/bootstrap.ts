/**
 * Plugin bootstrap phase. Idempotent and safe to run in every Strapi process at once.
 *
 * 1. Deletes the store keys of the removed 3.x license system (no network calls, no timers).
 * 2. Migrates 3.x bookmark rows (paths, content types, share JSON, global pins).
 * 2b. Removes duplicate Magic Mark permission rows that a simultaneous start of several
 *     processes can leave (Strapi's super admin permission sync runs in every process).
 * 3. Subscribes to admin user and role deletions to clean up shares, pins and private
 *    bookmarks of deleted users. `destroy` removes the subscription.
 */
import type { Core } from '@strapi/strapi';
import { ADMIN_ROLE_UID, ADMIN_USER_UID, PLUGIN_ID } from './constants';
import type { MaintenanceService } from './services/maintenance';

const STATE_KEY = 'magicMarkDeletedIds';
let unsubscribe: (() => void) | null = null;

/** Detaches the lifecycle subscription created by bootstrap. */
export const detachLifecycles = () => {
  unsubscribe?.();
  unsubscribe = null;
};

/**
 * @param deps - `{ strapi }`.
 * @sideeffect Deletes legacy store keys, migrates rows, subscribes to db lifecycles.
 */
const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  const maintenance = strapi.plugin(PLUGIN_ID).service('maintenance') as MaintenanceService;

  try {
    await maintenance.removeLegacyLicenseKeys();
  } catch (error) {
    strapi.log.error('[magic-mark] Removing legacy license keys failed', {
      name: (error as Error)?.name,
    });
  }

  try {
    await maintenance.migrateLegacyBookmarks();
  } catch (error) {
    strapi.log.error('[magic-mark] Bookmark migration failed', { name: (error as Error)?.name });
  }

  try {
    await maintenance.removeDuplicatePermissions();
  } catch (error) {
    strapi.log.error('[magic-mark] Removing duplicate permissions failed', {
      name: (error as Error)?.name,
    });
  }

  const captureIds = async (event: {
    model: { uid: string };
    params: { where?: unknown };
    state: Record<string, unknown>;
  }) => {
    const rows = await strapi.db.query(event.model.uid).findMany({
      where: event.params.where ?? {},
      select: ['documentId'],
    });
    event.state[STATE_KEY] = rows.map((row: { documentId: string }) => row.documentId);
  };
  const cleanup = async (event: { model: { uid: string }; state: Record<string, unknown> }) => {
    const ids = (event.state[STATE_KEY] as string[] | undefined) ?? [];
    try {
      if (event.model.uid === ADMIN_USER_UID) await maintenance.cleanupDeletedUsers(ids);
      if (event.model.uid === ADMIN_ROLE_UID) await maintenance.cleanupDeletedRoles(ids);
    } catch (error) {
      strapi.log.error('[magic-mark] Cleanup after deletion failed', {
        name: (error as Error)?.name,
      });
    }
  };

  detachLifecycles();
  unsubscribe = strapi.db.lifecycles.subscribe({
    models: [ADMIN_USER_UID, ADMIN_ROLE_UID],
    beforeDelete: captureIds,
    beforeDeleteMany: captureIds,
    afterDelete: cleanup,
    afterDeleteMany: cleanup,
  } as Parameters<typeof strapi.db.lifecycles.subscribe>[0]);
};

export default bootstrap;
