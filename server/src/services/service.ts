import type { Core } from '@strapi/strapi';

const BOOKMARK_UID = 'plugin::magic-mark.bookmark';
const ADMIN_USER_UID = 'admin::user';

/**
 * Bookmark Service
 * Handles all bookmark-related database operations
 * 
 * Uses Document Service API (Strapi v5 Best Practice)
 * 
 * NOTE: We store creatorId/updaterId as strings (documentId) instead of relations
 * to avoid permission issues with admin::user content-type.
 */
const bookmarkService = ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * Find all bookmarks accessible to a user
   * @param userId - The admin user's documentId
   * @returns Array of accessible bookmarks with createdBy info
   */
  async findAll(userId: string) {
    try {
      // Get user with roles using Document Service
      const user = await strapi.documents(ADMIN_USER_UID).findOne({
        documentId: userId,
        populate: ['roles']
      });

      const userRoleIds = user?.roles?.map((role: any) => role.documentId || role.id) || [];

      // Find all bookmarks (no populate needed - creatorId is a string field)
      const allBookmarks = await strapi.documents(BOOKMARK_UID).findMany({
        sort: [
          { isPinned: 'desc' },
          { order: 'asc' }
        ]
      });

      // Filter bookmarks based on access
      const accessibleBookmarks = allBookmarks?.filter((bookmark: any) => {
        // User owns this bookmark (compare creatorId field)
        if (bookmark.creatorId === userId) {
          return true;
        }
        // Bookmark is public
        if (bookmark.isPublic) {
          return true;
        }
        // Bookmark is shared directly with this user
        if (bookmark.sharedWithUsers && Array.isArray(bookmark.sharedWithUsers)) {
          if (bookmark.sharedWithUsers.includes(userId)) {
            return true;
          }
        }
        // Bookmark is shared with user's roles
        if (bookmark.sharedWithRoles && Array.isArray(bookmark.sharedWithRoles)) {
          return bookmark.sharedWithRoles.some((roleId: string) => 
            userRoleIds.includes(roleId)
          );
        }
        return false;
      }) || [];

      // Collect all unique creatorIds to fetch user info
      const creatorIds = [...new Set(accessibleBookmarks.map((b: any) => b.creatorId).filter(Boolean))];
      
      // Fetch all creators in batch
      const creatorsMap = new Map();
      for (const creatorId of creatorIds) {
        try {
          const creator = await strapi.documents(ADMIN_USER_UID).findOne({
            documentId: creatorId as string,
            fields: ['firstname', 'lastname', 'email']
          });
          if (creator) {
            creatorsMap.set(creatorId, {
              id: creatorId,
              documentId: creatorId,
              firstname: creator.firstname,
              lastname: creator.lastname,
              email: creator.email
            });
          }
        } catch (err) {
          // User might be deleted, skip
          strapi.log.debug(`[magic-mark] Could not fetch creator ${creatorId}`);
        }
      }

      // Attach createdBy object to each bookmark
      const enrichedBookmarks = accessibleBookmarks.map((bookmark: any) => ({
        ...bookmark,
        createdBy: creatorsMap.get(bookmark.creatorId) || null
      }));

      return enrichedBookmarks;
    } catch (error) {
      strapi.log.error('[magic-mark] Error finding bookmarks:', error);
      throw error;
    }
  },

  /**
   * Create a new bookmark
   * @param name - Bookmark name
   * @param path - URL path
   * @param query - Query string
   * @param emoji - Emoji icon
   * @param description - Description
   * @param userId - Creator's documentId
   * @param sharedWithRoles - Array of role documentIds
   * @param sharedWithUsers - Array of user documentIds
   * @param isPublic - Public visibility
   * @returns Created bookmark
   */
  async create(
    name: string, 
    path: string, 
    query: string, 
    emoji: string, 
    description: string, 
    userId: string, 
    sharedWithRoles?: string[], 
    sharedWithUsers?: string[], 
    isPublic?: boolean
  ) {
    try {
      // Get the highest order number
      const bookmarks = await strapi.documents(BOOKMARK_UID).findMany({
        sort: [{ order: 'desc' }],
        limit: 1
      });
      
      const maxOrder = bookmarks && bookmarks.length > 0 ? (bookmarks[0] as any).order : 0;
      
      const bookmark = await strapi.documents(BOOKMARK_UID).create({
        data: {
          name,
          path,
          query: query || '',
          emoji: emoji || 'bookmark',
          description,
          isPinned: false,
          order: (maxOrder || 0) + 1,
          creatorId: userId,  // Store as string field, not relation
          updaterId: userId,
          sharedWithRoles: sharedWithRoles || [],
          sharedWithUsers: sharedWithUsers || [],
          isPublic: isPublic || false
        } as any
      });
      return bookmark;
    } catch (error) {
      strapi.log.error('[magic-mark] Error creating bookmark:', error);
      throw error;
    }
  },

  /**
   * Update an existing bookmark
   * @param documentId - Bookmark's documentId
   * @param data - Update data
   * @param userId - Editor's documentId
   * @returns Updated bookmark
   */
  async update(documentId: string, data: any, userId: string) {
    try {
      // First check if user owns this bookmark
      const existingBookmark = await strapi.documents(BOOKMARK_UID).findOne({
        documentId
      });

      // Check ownership via creatorId field
      if (!existingBookmark || (existingBookmark as any).creatorId !== userId) {
        throw new Error('Unauthorized: You can only edit your own bookmarks');
      }

      const bookmark = await strapi.documents(BOOKMARK_UID).update({
        documentId,
        data: {
          name: data.name,
          path: data.path,
          query: data.query || '',
          emoji: data.emoji || 'bookmark',
          description: data.description,
          isPinned: data.isPinned,
          order: data.order,
          sharedWithRoles: data.sharedWithRoles,
          sharedWithUsers: data.sharedWithUsers,
          isPublic: data.isPublic,
          updaterId: userId  // Store as string field
        } as any
      });
      return bookmark;
    } catch (error) {
      strapi.log.error('[magic-mark] Error updating bookmark:', error);
      throw error;
    }
  },

  /**
   * Delete a bookmark
   * @param documentId - Bookmark's documentId
   * @returns Deleted bookmark
   */
  async delete(documentId: string) {
    try {
      return await strapi.documents(BOOKMARK_UID).delete({
        documentId
      });
    } catch (error) {
      strapi.log.error('[magic-mark] Error deleting bookmark:', error);
      throw error;
    }
  },

  /**
   * Pin or unpin a bookmark
   * @param documentId - Bookmark's documentId
   * @param isPinned - Pin status
   * @param userId - Editor's documentId
   * @returns Updated bookmark
   */
  async pin(documentId: string, isPinned: boolean, userId: string) {
    try {
      const bookmark = await strapi.documents(BOOKMARK_UID).update({
        documentId,
        data: {
          isPinned: isPinned,
          updaterId: userId
        } as any
      });
      return bookmark;
    } catch (error) {
      strapi.log.error('[magic-mark] Error pinning bookmark:', error);
      throw error;
    }
  },

  /**
   * Reorder bookmarks
   * @param bookmarkIds - Array of bookmark documentIds in new order
   * @param userId - Editor's documentId
   * @returns Updated bookmarks
   */
  async reorder(bookmarkIds: string[], userId: string) {
    try {
      const updates = bookmarkIds.map((documentId, index) =>
        strapi.documents(BOOKMARK_UID).update({
          documentId,
          data: {
            order: index,
            updaterId: userId
          } as any
        })
      );
      return Promise.all(updates);
    } catch (error) {
      strapi.log.error('[magic-mark] Error reordering bookmarks:', error);
      throw error;
    }
  },

  /**
   * Validate URL format
   * @param url - URL to validate
   * @returns True if valid
   */
  validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
});

export default bookmarkService;
