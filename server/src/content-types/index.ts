/**
 * Plugin content types. All three are internal: hidden from the Content Manager and
 * the Content-Type Builder, without Draft & Publish.
 *
 * - `bookmark`: a saved Content Manager list view (path + query) owned by one admin.
 * - `bookmark-share`: one row per role or admin user a bookmark is shared with.
 * - `bookmark-preference`: per-user state for a bookmark (pinned).
 *
 * Owners, roles and users are referenced by `documentId` strings, not relations, so the
 * plugin never needs read access to the `admin::user` content type for its own data.
 */
const internal = {
  'content-manager': { visible: false },
  'content-type-builder': { visible: false },
};

export default {
  bookmark: {
    schema: {
      kind: 'collectionType',
      collectionName: 'magic_bookmarks',
      info: {
        singularName: 'bookmark',
        pluralName: 'bookmarks',
        displayName: 'Magic Mark bookmark',
      },
      options: { draftAndPublish: false },
      pluginOptions: internal,
      attributes: {
        name: { type: 'string', required: true, maxLength: 100, configurable: false },
        description: { type: 'text', maxLength: 500, configurable: false },
        // Router path of the list view, e.g. /content-manager/collection-types/api::article.article
        path: { type: 'string', required: true, maxLength: 255, configurable: false },
        // Content-type uid derived from `path`; used to list the bookmarks of one list view.
        contentType: { type: 'string', maxLength: 255, configurable: false },
        // Query string without the leading "?" (filters, sort, pageSize, plugins).
        query: { type: 'text', configurable: false },
        // Icon key (see server/src/validation.ts ICON_KEYS). The column keeps its 3.x name.
        emoji: { type: 'string', default: 'bookmark', maxLength: 50, configurable: false },
        creatorId: { type: 'string', configurable: false },
        updaterId: { type: 'string', configurable: false },
        isPublic: { type: 'boolean', default: false, configurable: false },
        // 3.x fields. Migrated on bootstrap into bookmark-share and bookmark-preference rows
        // and then cleared; kept in the schema so the migration can still read old rows.
        sharedWithRoles: { type: 'json', configurable: false },
        sharedWithUsers: { type: 'json', configurable: false },
        isPinned: { type: 'boolean', default: false, configurable: false },
        order: { type: 'integer', default: 0, configurable: false },
      },
    },
  },
  'bookmark-share': {
    schema: {
      kind: 'collectionType',
      collectionName: 'magic_bookmark_shares',
      info: {
        singularName: 'bookmark-share',
        pluralName: 'bookmark-shares',
        displayName: 'Magic Mark bookmark share',
      },
      options: { draftAndPublish: false },
      pluginOptions: internal,
      attributes: {
        bookmarkDocumentId: { type: 'string', required: true, configurable: false },
        targetType: {
          type: 'enumeration',
          enum: ['user', 'role'],
          required: true,
          configurable: false,
        },
        targetId: { type: 'string', required: true, configurable: false },
      },
    },
  },
  'bookmark-preference': {
    schema: {
      kind: 'collectionType',
      collectionName: 'magic_bookmark_preferences',
      info: {
        singularName: 'bookmark-preference',
        pluralName: 'bookmark-preferences',
        displayName: 'Magic Mark bookmark preference',
      },
      options: { draftAndPublish: false },
      pluginOptions: internal,
      attributes: {
        userId: { type: 'string', required: true, configurable: false },
        bookmarkDocumentId: { type: 'string', required: true, configurable: false },
        isPinned: { type: 'boolean', default: false, configurable: false },
      },
    },
  },
};
