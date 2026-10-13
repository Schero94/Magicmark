const routes = [
    // Get all bookmarks
    {
      method: 'GET',
      path: '/bookmarks',
      handler: 'bookmarks.getAll',
      config: {
        policies: [],
      },
    },
    // Reorder bookmarks (SPECIFIC - must come before :id routes)
    {
      method: 'POST',
      path: '/bookmarks/reorder',
      handler: 'bookmarks.reorder',
      config: {
        policies: [],
      },
    },
    // Pin/Unpin bookmark (SPECIFIC - must come before generic :id)
    {
      method: 'POST',
      path: '/bookmarks/:id/pin',
      handler: 'bookmarks.pin',
      config: {
        policies: [],
      },
    },
    // Create bookmark
    {
      method: 'POST',
      path: '/bookmarks',
      handler: 'bookmarks.create',
      config: {
        policies: [],
      },
    },
    // Update bookmark
    {
      method: 'PUT',
      path: '/bookmarks/:id',
      handler: 'bookmarks.update',
      config: {
        policies: [],
      },
    },
    // Delete bookmark
    {
      method: 'DELETE',
      path: '/bookmarks/:id',
      handler: 'bookmarks.delete',
      config: {
        policies: [],
      },
    },
    // Get available roles for sharing
    {
      method: 'GET',
      path: '/roles',
      handler: 'bookmarks.getRoles',
      config: {
        policies: [],
      },
    },
    // Get available users for sharing
    {
      method: 'GET',
      path: '/users',
      handler: 'bookmarks.getUsers',
      config: {
        policies: [],
      },
    },
    // License Management
    {
      method: 'GET',
      path: '/license/status',
      handler: 'license.getStatus',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/license/create',
      handler: 'license.createAndActivate',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/license/ping',
      handler: 'license.ping',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/license/stats',
      handler: 'license.getStats',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/license/deactivate',
      handler: 'license.deactivate',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/license/store-key',
      handler: 'license.storeKey',
      config: {
        policies: [],
      },
    },
];

module.exports = {
  type: 'admin',
  routes: routes.map((route) => ({
    ...route,
    config: {
      ...route.config,
      auth: {
        scope: [`plugin::magic-mark.settings.${route.method === 'GET' ? 'read' : 'update'}`],
      },
    },
  })),
};
