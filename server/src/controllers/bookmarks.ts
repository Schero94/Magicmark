/**
 * Bookmark controller. Parses and validates input, builds the viewer from the authenticated
 * admin, calls the service and shapes `{ data, meta }` responses. Errors are thrown as
 * `@strapi/utils` errors and rendered by Strapi's error middleware.
 */
import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { PLUGIN_ID, actionId } from '../constants';
import type { BookmarkService, Viewer } from '../services/bookmarks';
import {
  createBookmarkSchema,
  duplicateSchema,
  idParamSchema,
  listQuerySchema,
  parse,
  pinSchema,
  updateBookmarkSchema,
  updateViewSchema,
  userSearchSchema,
} from '../validation';

interface AdminContext {
  state: {
    user?: { id: number; documentId?: string; roles?: { id: number; documentId?: string }[] };
    userAbility?: { can: (action: string, subject?: unknown) => boolean };
  };
  params: Record<string, string>;
  query: Record<string, unknown>;
  request: { body?: unknown };
  body: unknown;
}

/**
 * Builds the viewer for access checks from the authenticated admin.
 * @throws {errors.UnauthorizedError} When no admin is authenticated.
 */
const getViewer = async (strapi: Core.Strapi, ctx: AdminContext): Promise<Viewer> => {
  const user = ctx.state.user;
  if (!user) throw new errors.UnauthorizedError('Authentication required');

  let userId = user.documentId;
  let roles = user.roles;
  if (!userId || !roles || roles.some((role) => !role.documentId)) {
    const row = await strapi.db.query('admin::user').findOne({
      where: { id: user.id },
      select: ['documentId'],
      populate: { roles: { select: ['documentId'] } },
    });
    if (!row) throw new errors.UnauthorizedError('Authentication required');
    userId = row.documentId;
    roles = row.roles;
  }

  const can = (action: string) => ctx.state.userAbility?.can(action) === true;
  return {
    userId: userId as string,
    roleIds: (roles ?? []).map((role) => role.documentId as string).filter(Boolean),
    canShare: can(actionId('share')),
    canManage: can(actionId('manage')),
    canReadUsers: can('admin::users.read'),
  };
};

const controller = ({ strapi }: { strapi: Core.Strapi }) => {
  const service = () => strapi.plugin(PLUGIN_ID).service('bookmarks') as BookmarkService;

  return {
    /**
     * @route GET /magic-mark/bookmarks
     * @access bookmarks.read
     * Query: page, pageSize (<=100), q, scope (all|mine|shared|pinned), sort, contentType.
     */
    async find(ctx: AdminContext) {
      const params = parse(listQuerySchema, ctx.query);
      const viewer = await getViewer(strapi, ctx);
      const { results, pagination } = await service().list(viewer, params);
      ctx.body = {
        data: results,
        meta: {
          pagination,
          permissions: { canShare: viewer.canShare, canManage: viewer.canManage },
        },
      };
    },

    /**
     * @route GET /magic-mark/bookmarks/:id
     * @access bookmarks.read; 404 when not visible. Sharing lists only for owner/manager.
     */
    async findOne(ctx: AdminContext) {
      const { id } = parse(idParamSchema, ctx.params);
      ctx.body = { data: await service().findOne(await getViewer(strapi, ctx), id) };
    },

    /**
     * @route POST /magic-mark/bookmarks
     * @access bookmarks.read + bookmarks.create; sharing also needs bookmarks.share.
     * @sideeffect Creates a bookmark owned by the caller.
     */
    async create(ctx: AdminContext) {
      const input = parse(createBookmarkSchema, ctx.request.body);
      ctx.body = { data: await service().create(await getViewer(strapi, ctx), input) };
    },

    /**
     * @route PUT /magic-mark/bookmarks/:id
     * @access bookmarks.read + bookmarks.update, owner or bookmarks.manage.
     */
    async update(ctx: AdminContext) {
      const { id } = parse(idParamSchema, ctx.params);
      const input = parse(updateBookmarkSchema, ctx.request.body);
      ctx.body = { data: await service().update(await getViewer(strapi, ctx), id, input) };
    },

    /**
     * @route PUT /magic-mark/bookmarks/:id/view
     * @access bookmarks.read + bookmarks.update, owner or bookmarks.manage.
     */
    async updateView(ctx: AdminContext) {
      const { id } = parse(idParamSchema, ctx.params);
      const { query } = parse(updateViewSchema, ctx.request.body);
      ctx.body = { data: await service().updateView(await getViewer(strapi, ctx), id, query) };
    },

    /**
     * @route POST /magic-mark/bookmarks/:id/duplicate
     * @access bookmarks.read + bookmarks.create; the copy is private and owned by the caller.
     */
    async duplicate(ctx: AdminContext) {
      const { id } = parse(idParamSchema, ctx.params);
      const { name } = parse(duplicateSchema, ctx.request.body);
      ctx.body = { data: await service().duplicate(await getViewer(strapi, ctx), id, name) };
    },

    /**
     * @route PUT /magic-mark/bookmarks/:id/pin
     * @access bookmarks.read; pins only for the caller.
     */
    async pin(ctx: AdminContext) {
      const { id } = parse(idParamSchema, ctx.params);
      const { pinned } = parse(pinSchema, ctx.request.body);
      ctx.body = { data: await service().setPinned(await getViewer(strapi, ctx), id, pinned) };
    },

    /**
     * @route DELETE /magic-mark/bookmarks/:id
     * @access bookmarks.read + bookmarks.delete, owner or bookmarks.manage.
     */
    async delete(ctx: AdminContext) {
      const { id } = parse(idParamSchema, ctx.params);
      ctx.body = { data: await service().delete(await getViewer(strapi, ctx), id) };
    },

    /**
     * @route GET /magic-mark/sharing/roles
     * @access bookmarks.share
     */
    async roles(ctx: AdminContext) {
      parse(userSearchSchema.pick({}), ctx.query);
      ctx.body = { data: await service().listRoles() };
    },

    /**
     * @route GET /magic-mark/sharing/users?q=&page=
     * @access bookmarks.share; email only with admin::users.read.
     */
    async users(ctx: AdminContext) {
      const params = parse(userSearchSchema, ctx.query);
      const { results, pagination } = await service().searchUsers(
        await getViewer(strapi, ctx),
        params
      );
      ctx.body = { data: results, meta: { pagination } };
    },
  };
};

export default controller;
