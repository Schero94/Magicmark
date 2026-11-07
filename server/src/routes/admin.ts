/**
 * Admin routes, served at `/magic-mark/...` and reachable only with an admin session or an
 * admin API token. Every route requires an authenticated admin and the listed Magic Mark
 * actions (`admin::hasPermissions` requires all of them). Owner checks happen in the service.
 */
import { type ActionKey, actionId } from '../constants';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Builds a route that requires the given actions.
 * @param method - HTTP method.
 * @param path - Path below the plugin prefix.
 * @param handler - `controller.action`.
 * @param actions - Action keys the caller must all hold.
 */
const route = (method: Method, path: string, handler: string, actions: ActionKey[]) => ({
  method,
  path,
  handler,
  config: {
    policies: [
      'admin::isAuthenticatedAdmin',
      { name: 'admin::hasPermissions', config: { actions: actions.map(actionId) } },
    ],
  },
});

export const routes = [
  route('GET', '/bookmarks', 'bookmarks.find', ['read']),
  route('POST', '/bookmarks', 'bookmarks.create', ['read', 'create']),
  route('GET', '/bookmarks/:id', 'bookmarks.findOne', ['read']),
  route('PUT', '/bookmarks/:id', 'bookmarks.update', ['read', 'update']),
  route('DELETE', '/bookmarks/:id', 'bookmarks.delete', ['read', 'delete']),
  route('PUT', '/bookmarks/:id/view', 'bookmarks.updateView', ['read', 'update']),
  route('POST', '/bookmarks/:id/duplicate', 'bookmarks.duplicate', ['read', 'create']),
  route('PUT', '/bookmarks/:id/pin', 'bookmarks.pin', ['read']),
  route('GET', '/sharing/roles', 'bookmarks.roles', ['share']),
  route('GET', '/sharing/users', 'bookmarks.users', ['share']),
];

export default {
  type: 'admin' as const,
  routes,
};
