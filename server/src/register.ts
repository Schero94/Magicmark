/**
 * Plugin register phase.
 *
 * - Registers the RBAC actions (Settings > Roles > Plugins > Magic Mark). They are registered
 *   here, before any bootstrap, so the admin's start-up cleanup of unknown actions never removes
 *   permissions that were granted for them.
 * - Hooks the 3.x -> 4.x permission migration into `strapi::content-types.afterSync`, which runs
 *   after the schema sync and before the admin bootstrap deletes permissions of unregistered
 *   (3.x) actions. Roles therefore keep their access across the upgrade.
 */
import type { Core } from '@strapi/strapi';
import { ACTION_UIDS, PLUGIN_ID } from './constants';

export const PERMISSION_ACTIONS = [
  { uid: ACTION_UIDS.read, displayName: 'Read bookmarks' },
  { uid: ACTION_UIDS.create, displayName: 'Create bookmarks' },
  { uid: ACTION_UIDS.update, displayName: 'Edit own bookmarks' },
  { uid: ACTION_UIDS.delete, displayName: 'Delete own bookmarks' },
  { uid: ACTION_UIDS.share, displayName: 'Share bookmarks' },
  { uid: ACTION_UIDS.manage, displayName: 'Manage shared bookmarks of others' },
].map((action) => ({
  section: 'plugins' as const,
  pluginName: PLUGIN_ID,
  subCategory: 'Bookmarks',
  ...action,
}));

/**
 * @param deps - `{ strapi }`.
 * @sideeffect Registers permission actions and one afterSync hook.
 */
const register = async ({ strapi }: { strapi: Core.Strapi }) => {
  await strapi.admin.services.permission.actionProvider.registerMany(PERMISSION_ACTIONS);

  strapi.hook('strapi::content-types.afterSync').register(async () => {
    try {
      await strapi.plugin(PLUGIN_ID).service('maintenance').migrateLegacyPermissions();
    } catch (error) {
      strapi.log.error('[magic-mark] Permission migration failed', {
        name: (error as Error)?.name,
      });
    }
  });
};

export default register;
