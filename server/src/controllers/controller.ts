const ADMIN_ROLE_UID = 'admin::role';
const ADMIN_USER_UID = 'admin::user';

/**
 * Bookmark Controller
 * Handles HTTP requests for bookmark management
 * 
 * Uses Document Service API (Strapi v5 Best Practice)
 */
export default ({ strapi }: any) => ({
  /**
   * Get all bookmarks for current user
   * GET /magic-mark/bookmarks
   */
  async getAll(ctx: any) {
    try {
      const user = ctx.state.user;
      if (!user) {
        return ctx.throw(401, 'User not authenticated');
      }

      // Use documentId if available, fallback to id
      const userId = user.documentId || String(user.id);

      const bookmarks = await strapi
        .plugin('magic-mark')
        .service('bookmarks')
        .findAll(userId);

      ctx.body = {
        data: bookmarks,
        meta: {
          count: bookmarks.length
        }
      };
    } catch (error) {
      ctx.throw(500, `Error fetching bookmarks: ${error}`);
    }
  },

  /**
   * Create a new bookmark
   * POST /magic-mark/bookmarks
   */
  async create(ctx: any) {
    try {
      const user = ctx.state.user;
      if (!user) {
        return ctx.throw(401, 'User not authenticated');
      }

      const { name, path, query, emoji, description, sharedWithRoles, sharedWithUsers, isPublic } = ctx.request.body;

      // Validation
      if (!name || name.trim().length === 0) {
        return ctx.throw(400, 'Name is required');
      }
      if (!path || path.trim().length === 0) {
        return ctx.throw(400, 'Path is required');
      }

      const userId = user.documentId || String(user.id);

      // Check bookmark limit before creating
      const licenseGuard = strapi.plugin('magic-mark').service('license-guard');
      const limitCheck = await licenseGuard.canCreateBookmark(userId);
      
      if (!limitCheck.canCreate) {
        return ctx.throw(403, {
          error: 'BOOKMARK_LIMIT_REACHED',
          message: limitCheck.message || `Bookmark limit reached (${limitCheck.current}/${limitCheck.max}). Upgrade to Premium or Advanced to create more bookmarks.`,
          current: limitCheck.current,
          max: limitCheck.max,
          upgradeUrl: '/admin/settings/magic-mark/upgrade'
        });
      }

      const service = strapi.plugin('magic-mark').service('bookmarks');

      const bookmark = await service.create(name, path, query, emoji, description, userId, sharedWithRoles, sharedWithUsers, isPublic);

      ctx.body = {
        data: bookmark
      };
    } catch (error) {
      ctx.throw(500, `Error creating bookmark: ${error}`);
    }
  },

  /**
   * Update an existing bookmark
   * PUT /magic-mark/bookmarks/:id
   */
  async update(ctx: any) {
    try {
      const user = ctx.state.user;
      if (!user) {
        return ctx.throw(401, 'User not authenticated');
      }

      const { id } = ctx.params;
      const { name, path, query, emoji, description, isPinned, order, sharedWithRoles, sharedWithUsers, isPublic } = ctx.request.body;

      // Validation
      if (!name || name.trim().length === 0) {
        return ctx.throw(400, 'Name is required');
      }
      if (!path || path.trim().length === 0) {
        return ctx.throw(400, 'Path is required');
      }

      const userId = user.documentId || String(user.id);
      
      const bookmark = await strapi
        .plugin('magic-mark')
        .service('bookmarks')
        .update(id, { name, path, query, emoji, description, isPinned, order, sharedWithRoles, sharedWithUsers, isPublic }, userId);

      ctx.body = {
        data: bookmark
      };
    } catch (error) {
      ctx.throw(500, `Error updating bookmark: ${error}`);
    }
  },

  /**
   * Delete a bookmark
   * DELETE /magic-mark/bookmarks/:id
   */
  async delete(ctx: any) {
    try {
      const user = ctx.state.user;
      if (!user) {
        return ctx.throw(401, 'User not authenticated');
      }

      const { id } = ctx.params;
      
      await strapi
        .plugin('magic-mark')
        .service('bookmarks')
        .delete(id);

      ctx.body = {
        data: { success: true }
      };
    } catch (error) {
      ctx.throw(500, `Error deleting bookmark: ${error}`);
    }
  },

  /**
   * Pin or unpin a bookmark
   * PUT /magic-mark/bookmarks/:id/pin
   */
  async pin(ctx: any) {
    try {
      const user = ctx.state.user;
      if (!user) {
        return ctx.throw(401, 'User not authenticated');
      }

      const { id } = ctx.params;
      const { isPinned } = ctx.request.body;

      const userId = user.documentId || String(user.id);

      const bookmark = await strapi
        .plugin('magic-mark')
        .service('bookmarks')
        .pin(id, isPinned, userId);

      ctx.body = {
        data: bookmark
      };
    } catch (error) {
      ctx.throw(500, `Error pinning bookmark: ${error}`);
    }
  },

  /**
   * Reorder bookmarks
   * PUT /magic-mark/bookmarks/reorder
   */
  async reorder(ctx: any) {
    try {
      const user = ctx.state.user;
      if (!user) {
        return ctx.throw(401, 'User not authenticated');
      }

      const { bookmarkIds } = ctx.request.body;

      // Validation
      if (!bookmarkIds || !Array.isArray(bookmarkIds)) {
        return ctx.throw(400, 'Bookmark IDs array is required');
      }

      const userId = user.documentId || String(user.id);

      const bookmarks = await strapi
        .plugin('magic-mark')
        .service('bookmarks')
        .reorder(bookmarkIds, userId);

      ctx.body = {
        data: bookmarks
      };
    } catch (error) {
      ctx.throw(500, `Error reordering bookmarks: ${error}`);
    }
  },

  /**
   * Get all admin roles for sharing
   * GET /magic-mark/roles
   */
  async getRoles(ctx: any) {
    try {
      const user = ctx.state.user;
      if (!user) {
        return ctx.throw(401, 'User not authenticated');
      }

      // Get ALL admin roles using Document Service
      const roles = await strapi.documents(ADMIN_ROLE_UID).findMany({
        fields: ['name', 'code', 'description', 'createdAt', 'updatedAt'],
        sort: { name: 'asc' },
        populate: ['users']
      });

      // Add user count to each role
      const rolesWithDetails = roles?.map((role: any) => ({
        id: role.documentId,
        name: role.name,
        code: role.code,
        description: role.description,
        userCount: role.users?.length || 0,
        isCustom: !['super_admin', 'editor', 'author'].includes(role.code)
      })) || [];

      ctx.body = {
        data: {
          data: rolesWithDetails
        }
      };
    } catch (error) {
      ctx.throw(500, `Error fetching roles: ${error}`);
    }
  },

  /**
   * Get all admin users for sharing
   * GET /magic-mark/users
   */
  async getUsers(ctx: any) {
    try {
      const user = ctx.state.user;
      if (!user) {
        return ctx.throw(401, 'User not authenticated');
      }

      let users: any[] = [];
      
      try {
        // Method 1: Try the admin service first
        const adminUserService = strapi.admin?.services?.user || strapi.service('admin::user');
        if (adminUserService?.findPage) {
          const results = await adminUserService.findPage({
            pagination: {
              page: 1,
              pageSize: 100
            }
          });
          users = results.results || [];
        } else if (adminUserService?.find) {
          users = await adminUserService.find();
        }
      } catch (err) {
        strapi.log.debug('[magic-mark] Admin service not available, trying Document Service');
      }
      
      // Method 2: If admin service failed, use Document Service
      if (!users || users.length === 0) {
        try {
          users = await strapi.documents(ADMIN_USER_UID).findMany({
            limit: 100
          }) as any[];
        } catch (err) {
          strapi.log.debug('[magic-mark] Document Service error for admin::user');
        }
      }
      
      // Method 3: entityService as fallback (deprecated but works)
      if (!users || users.length === 0) {
        try {
          users = await strapi.entityService.findMany(ADMIN_USER_UID, {
            limit: 100
          });
        } catch (err) {
          strapi.log.warn('[magic-mark] entityService fallback also failed');
        }
      }

      const currentUserId = user.documentId || String(user.id);
      
      // Filter out current user
      const filteredUsers = users.filter((u: any) => {
        const uId = u.documentId || String(u.id);
        return uId !== currentUserId;
      });

      strapi.log.debug(`[magic-mark] Total admin users found: ${users.length}`);

      ctx.body = {
        data: {
          data: filteredUsers.map((u: any) => ({
            id: u.documentId || u.id,
            firstname: u.firstname || '',
            lastname: u.lastname || '',
            email: u.email,
            username: u.username || u.email
          }))
        }
      };
    } catch (error) {
      ctx.throw(500, `Error fetching users: ${error}`);
    }
  },
});
