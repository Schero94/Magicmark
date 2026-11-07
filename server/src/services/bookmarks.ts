/**
 * Bookmark service: access rules, listing, CRUD, sharing and per-user pins.
 *
 * Access model
 * - A viewer sees a bookmark when they own it, it is public, it is shared with them, or it is
 *   shared with one of their roles. Everything else answers 404, like a missing bookmark.
 * - Owners edit and delete their bookmarks. Holders of `bookmarks.manage` edit and delete every
 *   bookmark that is not private: public ones, ones shared with anyone (also when they are not a
 *   recipient) and ones without an owner, which covers bookmarks left by deleted users. Private
 *   bookmarks of other users stay hidden from managers too. Managers list these bookmarks with
 *   the `managed` scope. Changing who a bookmark is shared with needs `bookmarks.share`.
 * - Pins are per user (bookmark-preference rows), so pinning never changes other users' lists.
 *
 * All reads are filtered and paginated in the database; owner names, pins and share flags of a
 * page are loaded with one query each (no N+1). Writes that touch several rows run in one
 * transaction, and no state is kept in the process, so any number of Strapi processes can
 * serve the same database.
 *
 * Concurrency: every write to an existing bookmark (edit, share, view, pin, delete) first locks
 * the bookmark row with `SELECT ... FOR UPDATE` inside its transaction, the pattern Strapi's own
 * admin uses for the first admin. Writes to one bookmark therefore run one after another across
 * processes: two share edits never interleave their delete-and-insert steps, two pins never both
 * insert a preference row, and a write that waited for a delete answers 404 instead of leaving
 * share or pin rows behind. SQLite ignores `FOR UPDATE` and serialises writers on its own.
 */
import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import {
  ADMIN_ROLE_UID,
  ADMIN_USER_UID,
  BOOKMARK_UID,
  LIMITS,
  PREFERENCE_UID,
  SHARE_UID,
} from '../constants';
import {
  ICON_KEYS,
  normalizeListViewPath,
  normalizeListViewQuery,
  type Visibility,
} from '../validation';

/** The admin user performing a request, reduced to what access checks need. */
export interface Viewer {
  userId: string;
  roleIds: string[];
  canShare: boolean;
  canManage: boolean;
  canReadUsers: boolean;
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  scope?: 'all' | 'mine' | 'shared' | 'pinned' | 'managed';
  sort?: 'name:asc' | 'name:desc' | 'updatedAt:desc' | 'updatedAt:asc';
  contentType?: string;
}

export interface BookmarkInput {
  name?: string;
  description?: string;
  icon?: (typeof ICON_KEYS)[number];
  path?: { path: string; contentType: string };
  query?: string;
  visibility?: Visibility;
  roles?: string[];
  users?: string[];
}

interface BookmarkRow {
  id: number;
  documentId: string;
  name: string;
  description?: string | null;
  path: string;
  contentType?: string | null;
  query?: string | null;
  emoji?: string | null;
  creatorId?: string | null;
  isPublic?: boolean | null;
  createdAt?: string;
  updatedAt?: string;
}

interface UserRow {
  documentId: string;
  firstname?: string | null;
  lastname?: string | null;
  username?: string | null;
  email?: string | null;
}

type Doc = Record<string, unknown> & { documentId: string };

/** The Document Service methods this service uses. */
interface DocumentsApi {
  findFirst(params: object): Promise<Doc | null>;
  findMany(params: object): Promise<Doc[]>;
  count(params: object): Promise<number>;
  create(params: object): Promise<Doc>;
  update(params: object): Promise<Doc>;
  delete(params: object): Promise<unknown>;
}

const BOOKMARK_FIELDS = [
  'name',
  'description',
  'path',
  'contentType',
  'query',
  'emoji',
  'creatorId',
  'isPublic',
  'createdAt',
  'updatedAt',
] as const;

const SORT_MAP: Record<NonNullable<ListParams['sort']>, Record<string, 'asc' | 'desc'>[]> = {
  'name:asc': [{ name: 'asc' }, { id: 'asc' }],
  'name:desc': [{ name: 'desc' }, { id: 'desc' }],
  'updatedAt:desc': [{ updatedAt: 'desc' }, { id: 'desc' }],
  'updatedAt:asc': [{ updatedAt: 'asc' }, { id: 'asc' }],
};

/**
 * Display name of an admin user: "First Last", else the username, else null.
 * @param user - Admin user row or undefined.
 * @returns The name, or null when nothing is set.
 */
export const displayName = (user?: Partial<UserRow> | null): string | null => {
  if (!user) return null;
  const full = [user.firstname, user.lastname].filter(Boolean).join(' ').trim();
  return full || user.username || null;
};

const notFound = () => new errors.NotFoundError('Bookmark not found');

/**
 * Creates the bookmark service.
 * @param deps - `{ strapi }`.
 * @returns Service methods.
 */
const bookmarkService = ({ strapi }: { strapi: Core.Strapi }) => {
  const db = strapi.db;
  // Plugin uids are not part of the generated app types, so the Document Service is typed here.
  const documents = () =>
    (strapi.documents as unknown as (uid: string) => DocumentsApi)(BOOKMARK_UID);

  /**
   * DocumentIds of bookmarks shared with the viewer or one of the viewer's roles.
   * @param viewer - Current viewer.
   * @returns Unique bookmark documentIds.
   */
  const sharedBookmarkIds = async (viewer: Viewer): Promise<string[]> => {
    const or: Record<string, unknown>[] = [{ targetType: 'user', targetId: viewer.userId }];
    if (viewer.roleIds.length) {
      or.push({ targetType: 'role', targetId: { $in: viewer.roleIds } });
    }
    const rows = await db.query(SHARE_UID).findMany({
      where: { $or: or },
      select: ['bookmarkDocumentId'],
    });
    return [...new Set(rows.map((row: { bookmarkDocumentId: string }) => row.bookmarkDocumentId))];
  };

  /**
   * Filter that matches every bookmark the viewer may see.
   * @param viewer - Current viewer.
   * @returns Document Service filter object.
   */
  const accessFilter = async (viewer: Viewer) => {
    const shared = await sharedBookmarkIds(viewer);
    const or: Record<string, unknown>[] = [{ creatorId: viewer.userId }, { isPublic: true }];
    if (shared.length) or.push({ documentId: { $in: shared } });
    return { $or: or };
  };

  /**
   * Filter that matches every bookmark a holder of `bookmarks.manage` may manage: the viewer's
   * own, public ones, ones with at least one share row and ones without an owner. Private
   * bookmarks of other users are not included.
   * @param viewer - Current viewer (must have `canManage`).
   * @returns Document Service filter object.
   */
  const managedFilter = async (viewer: Viewer) => {
    const rows = await db.query(SHARE_UID).findMany({ select: ['bookmarkDocumentId'] });
    const shared = [
      ...new Set(rows.map((row: { bookmarkDocumentId: string }) => row.bookmarkDocumentId)),
    ];
    const or: Record<string, unknown>[] = [
      { creatorId: viewer.userId },
      { isPublic: true },
      { creatorId: { $null: true } },
    ];
    if (shared.length) or.push({ documentId: { $in: shared } });
    return { $or: or };
  };

  /**
   * Pinned bookmark documentIds of a user, optionally limited to `ids`.
   */
  const pinnedIds = async (userId: string, ids?: string[]): Promise<Set<string>> => {
    const where: Record<string, unknown> = { userId, isPinned: true };
    if (ids) where.bookmarkDocumentId = { $in: ids };
    const rows = await db.query(PREFERENCE_UID).findMany({
      where,
      select: ['bookmarkDocumentId'],
    });
    return new Set(rows.map((row: { bookmarkDocumentId: string }) => row.bookmarkDocumentId));
  };

  /**
   * Loads users by documentId with name fields only, in one query.
   */
  const usersById = async (ids: string[], withEmail = false): Promise<Map<string, UserRow>> => {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return new Map();
    const select = ['documentId', 'firstname', 'lastname', 'username'];
    if (withEmail) select.push('email');
    const rows: UserRow[] = await db.query(ADMIN_USER_UID).findMany({
      where: { documentId: { $in: unique } },
      select,
    });
    return new Map(rows.map((row) => [row.documentId, row]));
  };

  /**
   * Shapes bookmark rows into the response DTO. Sharing lists are never included here.
   */
  const toDtos = async (rows: BookmarkRow[], viewer: Viewer) => {
    const ids = rows.map((row) => row.documentId);
    const [owners, pins, shareRows] = await Promise.all([
      usersById(rows.map((row) => row.creatorId as string)),
      ids.length ? pinnedIds(viewer.userId, ids) : Promise.resolve(new Set<string>()),
      ids.length
        ? db.query(SHARE_UID).findMany({
            where: { bookmarkDocumentId: { $in: ids } },
            select: ['bookmarkDocumentId'],
          })
        : Promise.resolve([]),
    ]);
    const sharedSet = new Set(
      shareRows.map((row: { bookmarkDocumentId: string }) => row.bookmarkDocumentId)
    );

    return rows.map((row) => {
      const normalized = normalizeListViewPath(row.path);
      const isOwner = !!row.creatorId && row.creatorId === viewer.userId;
      const visibility: Visibility = row.isPublic
        ? 'public'
        : sharedSet.has(row.documentId)
          ? 'shared'
          : 'private';
      const icon = (ICON_KEYS as readonly string[]).includes(row.emoji ?? '')
        ? (row.emoji as string)
        : 'bookmark';
      return {
        documentId: row.documentId,
        name: row.name,
        description: row.description ?? '',
        icon,
        path: normalized?.path ?? null,
        contentType: normalized?.contentType ?? row.contentType ?? null,
        query: row.query ?? '',
        visibility,
        owner: row.creatorId
          ? { name: displayName(owners.get(row.creatorId)), isDeleted: !owners.has(row.creatorId) }
          : null,
        isOwner,
        isPinned: pins.has(row.documentId),
        canEdit: isOwner || viewer.canManage,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });
  };

  /**
   * Loads one bookmark the viewer may see. Managers also reach every non-private bookmark.
   * @throws {errors.NotFoundError} When it does not exist or is not visible to the viewer.
   */
  const findVisible = async (viewer: Viewer, documentId: string): Promise<BookmarkRow> => {
    const access = await accessFilter(viewer);
    const row = await documents().findFirst({
      filters: { $and: [{ documentId }, access] },
      fields: BOOKMARK_FIELDS,
    });
    if (row) return row as unknown as BookmarkRow;
    if (viewer.canManage) {
      // Managers may also reach bookmarks they are not a recipient of, as long as they are
      // not private (public, shared with anyone, or without an owner).
      const candidate = (await documents().findFirst({
        filters: { documentId },
        fields: BOOKMARK_FIELDS,
      })) as unknown as BookmarkRow | null;
      if (candidate) {
        if (candidate.isPublic || !candidate.creatorId) return candidate;
        const shares = await db.query(SHARE_UID).count({
          where: { bookmarkDocumentId: documentId },
        });
        if (shares > 0) return candidate;
      }
    }
    throw notFound();
  };

  /**
   * Loads one bookmark the viewer may change (owner or `bookmarks.manage`).
   * @throws {errors.NotFoundError} When it is not visible.
   * @throws {errors.ForbiddenError} When it is visible but owned by someone else.
   */
  const findEditable = async (viewer: Viewer, documentId: string): Promise<BookmarkRow> => {
    const row = await findVisible(viewer, documentId);
    if (row.creatorId !== viewer.userId && !viewer.canManage) {
      throw new errors.ForbiddenError('Only the owner can change this bookmark');
    }
    return row;
  };

  /**
   * Checks that every role and user documentId exists (users must be active).
   * @throws {errors.ValidationError} When one of them does not exist.
   */
  const assertTargetsExist = async (roles: string[], users: string[]) => {
    const [roleCount, userCount] = await Promise.all([
      roles.length ? db.query(ADMIN_ROLE_UID).count({ where: { documentId: { $in: roles } } }) : 0,
      users.length
        ? db.query(ADMIN_USER_UID).count({
            where: { documentId: { $in: users }, isActive: true },
          })
        : 0,
    ]);
    const details: Record<string, string[]> = {};
    if (roleCount !== roles.length) details.roles = ['Unknown role'];
    if (userCount !== users.length) details.users = ['Unknown or inactive user'];
    if (Object.keys(details).length) {
      throw new errors.ValidationError('Validation failed', { fieldErrors: details });
    }
  };

  /**
   * Resolves the sharing part of an input into `{ isPublic, roles, users }`, or undefined when
   * the input does not touch sharing. Checks the share permission and the targets.
   * @throws {errors.ForbiddenError} When sharing is requested without `bookmarks.share`.
   * @throws {errors.ValidationError} When `shared` has no targets or a target does not exist.
   */
  const resolveSharing = async (viewer: Viewer, input: BookmarkInput) => {
    if (input.visibility === undefined && !input.roles && !input.users) return undefined;
    const visibility = input.visibility ?? 'shared';
    const roles = visibility === 'shared' ? (input.roles ?? []) : [];
    const users = (visibility === 'shared' ? (input.users ?? []) : []).filter(
      (id) => id !== viewer.userId
    );
    if (visibility !== 'private' && !viewer.canShare) {
      throw new errors.ForbiddenError('Sharing needs the share permission');
    }
    if (visibility === 'shared' && roles.length + users.length === 0) {
      throw new errors.ValidationError('Validation failed', {
        fieldErrors: { roles: ['Choose at least one role or user'] },
      });
    }
    await assertTargetsExist(roles, users);
    return { isPublic: visibility === 'public', roles, users };
  };

  /**
   * Locks the bookmark row until the surrounding transaction ends (`FOR UPDATE`).
   * @param trx - Transaction from `db.transaction`.
   * @param documentId - Bookmark documentId.
   * @throws {errors.NotFoundError} When the bookmark no longer exists (for example deleted by
   *   another process while this request waited for the lock).
   */
  const lockBookmark = async (trx: unknown, documentId: string) => {
    const row = await db
      .queryBuilder(BOOKMARK_UID)
      .select(['id'])
      .where({ documentId })
      .first()
      .transacting(trx)
      .forUpdate()
      .execute();
    if (!row) throw notFound();
  };

  /** Replaces the share rows of a bookmark. Call inside a transaction that holds the lock. */
  const replaceShares = async (bookmarkDocumentId: string, roles: string[], users: string[]) => {
    await db.query(SHARE_UID).deleteMany({ where: { bookmarkDocumentId } });
    const data = [
      ...roles.map((targetId) => ({ bookmarkDocumentId, targetType: 'role', targetId })),
      ...users.map((targetId) => ({ bookmarkDocumentId, targetType: 'user', targetId })),
    ];
    if (data.length) await db.query(SHARE_UID).createMany({ data });
  };

  return {
    /**
     * Lists the bookmarks the viewer can see, filtered, sorted and paginated in the database.
     * @param viewer - Current viewer.
     * @param params - Validated list params.
     * @returns `{ results, pagination }`.
     */
    async list(viewer: Viewer, params: ListParams) {
      const page = params.page ?? 1;
      const pageSize = Math.min(params.pageSize ?? 25, LIMITS.pageSizeMax);
      if (params.scope === 'managed' && !viewer.canManage) {
        throw new errors.ForbiddenError('Listing all shared bookmarks needs the manage permission');
      }
      const and: Record<string, unknown>[] = [
        params.scope === 'managed' ? await managedFilter(viewer) : await accessFilter(viewer),
      ];

      if (params.scope === 'mine') and.push({ creatorId: viewer.userId });
      if (params.scope === 'shared') {
        and.push({ $or: [{ creatorId: { $ne: viewer.userId } }, { creatorId: { $null: true } }] });
      }
      if (params.scope === 'pinned') {
        const pinned = [...(await pinnedIds(viewer.userId))];
        if (!pinned.length) {
          return { results: [], pagination: { page, pageSize, pageCount: 0, total: 0 } };
        }
        and.push({ documentId: { $in: pinned } });
      }
      if (params.contentType) and.push({ contentType: params.contentType });
      if (params.q) and.push({ name: { $containsi: params.q } });

      const filters = { $and: and };
      const [rows, total] = await Promise.all([
        documents().findMany({
          filters,
          fields: BOOKMARK_FIELDS,
          sort: SORT_MAP[params.sort ?? 'name:asc'],
          start: (page - 1) * pageSize,
          limit: pageSize,
        }),
        documents().count({ filters }),
      ]);

      return {
        results: await toDtos(rows as unknown as BookmarkRow[], viewer),
        pagination: { page, pageSize, pageCount: Math.ceil(total / pageSize), total },
      };
    },

    /**
     * One bookmark. Owners and managers also get the sharing lists with display names.
     * @throws {errors.NotFoundError} When it is not visible.
     */
    async findOne(viewer: Viewer, documentId: string) {
      const row = await findVisible(viewer, documentId);
      const [dto] = await toDtos([row], viewer);
      if (!dto.canEdit) return dto;

      const shares: { targetType: string; targetId: string }[] = await db
        .query(SHARE_UID)
        .findMany({
          where: { bookmarkDocumentId: documentId },
          select: ['targetType', 'targetId'],
        });
      const roleIds = shares.filter((s) => s.targetType === 'role').map((s) => s.targetId);
      const userIds = shares.filter((s) => s.targetType === 'user').map((s) => s.targetId);
      const [roles, users] = await Promise.all([
        roleIds.length
          ? db.query(ADMIN_ROLE_UID).findMany({
              where: { documentId: { $in: roleIds } },
              select: ['documentId', 'name'],
            })
          : [],
        usersById(userIds, viewer.canReadUsers),
      ]);
      return {
        ...dto,
        sharing: {
          roles: roles.map((role: { documentId: string; name: string }) => ({
            documentId: role.documentId,
            name: role.name,
          })),
          users: userIds
            .filter((id) => users.has(id))
            .map((id) => {
              const user = users.get(id) as UserRow;
              return {
                documentId: id,
                name: displayName(user),
                ...(viewer.canReadUsers ? { email: user.email ?? null } : {}),
              };
            }),
        },
      };
    },

    /**
     * Creates a bookmark owned by the viewer.
     * @sideeffect Inserts a bookmark and its share rows in one transaction.
     */
    async create(
      viewer: Viewer,
      input: BookmarkInput & { name: string; path: { path: string; contentType: string } }
    ) {
      const sharing = await resolveSharing(viewer, input);
      const documentId = await db.transaction(async () => {
        const created = await documents().create({
          data: {
            name: input.name,
            description: input.description ?? '',
            path: input.path.path,
            contentType: input.path.contentType,
            query: input.query ?? '',
            emoji: input.icon ?? 'bookmark',
            creatorId: viewer.userId,
            updaterId: viewer.userId,
            isPublic: sharing?.isPublic ?? false,
          },
          fields: ['documentId'],
        });
        if (sharing) await replaceShares(created.documentId, sharing.roles, sharing.users);
        return created.documentId;
      });
      return this.findOne(viewer, documentId);
    },

    /**
     * Updates name, description, icon and sharing of a bookmark.
     * @throws {errors.NotFoundError} / {errors.ForbiddenError} See findEditable; also 404 when
     *   the bookmark was deleted while this request waited for the row lock.
     * @sideeffect Updates the bookmark and replaces its share rows in one transaction.
     */
    async update(viewer: Viewer, documentId: string, input: BookmarkInput) {
      await findEditable(viewer, documentId);
      const sharing = await resolveSharing(viewer, input);
      const data: Record<string, unknown> = { updaterId: viewer.userId };
      if (input.name !== undefined) data.name = input.name;
      if (input.description !== undefined) data.description = input.description;
      if (input.icon !== undefined) data.emoji = input.icon;
      if (sharing) data.isPublic = sharing.isPublic;

      await db.transaction(async ({ trx }) => {
        await lockBookmark(trx, documentId);
        await documents().update({ documentId, data, fields: ['documentId'] });
        if (sharing) await replaceShares(documentId, sharing.roles, sharing.users);
      });
      return this.findOne(viewer, documentId);
    },

    /**
     * Replaces the saved list view query ("Update with current view").
     */
    async updateView(viewer: Viewer, documentId: string, query: string) {
      await findEditable(viewer, documentId);
      await db.transaction(async ({ trx }) => {
        await lockBookmark(trx, documentId);
        await documents().update({
          documentId,
          data: { query, updaterId: viewer.userId },
          fields: ['documentId'],
        });
      });
      return this.findOne(viewer, documentId);
    },

    /**
     * Copies a visible bookmark into a new private bookmark owned by the viewer.
     */
    async duplicate(viewer: Viewer, documentId: string, name?: string) {
      const source = await findVisible(viewer, documentId);
      const normalized = normalizeListViewPath(source.path);
      if (!normalized) throw new errors.ValidationError('This bookmark has no valid list view');
      return this.create(viewer, {
        name: name ?? `${source.name} (copy)`.slice(0, 100),
        description: source.description ?? '',
        icon: (ICON_KEYS as readonly string[]).includes(source.emoji ?? '')
          ? (source.emoji as BookmarkInput['icon'])
          : 'bookmark',
        path: normalized,
        // Rows from 3.x or older builds may hold an unnormalised query; never copy it as is.
        query: normalizeListViewQuery(source.query) ?? '',
      });
    },

    /**
     * Deletes a bookmark with its shares and preferences.
     * @sideeffect Deletes rows in three tables in one transaction.
     */
    async delete(viewer: Viewer, documentId: string) {
      await findEditable(viewer, documentId);
      await db.transaction(async ({ trx }) => {
        await lockBookmark(trx, documentId);
        await db.query(SHARE_UID).deleteMany({ where: { bookmarkDocumentId: documentId } });
        await db.query(PREFERENCE_UID).deleteMany({ where: { bookmarkDocumentId: documentId } });
        await documents().delete({ documentId });
      });
      return { documentId };
    },

    /**
     * Pins or unpins a visible bookmark for the viewer only. Idempotent: updates every
     * preference row of the pair and creates one only when none exists. The bookmark row lock
     * makes the check-then-insert safe across processes.
     * @throws {errors.NotFoundError} When the bookmark is not visible or was deleted meanwhile.
     * @sideeffect Writes one bookmark-preference row.
     */
    async setPinned(viewer: Viewer, documentId: string, pinned: boolean) {
      await findVisible(viewer, documentId);
      await db.transaction(async ({ trx }) => {
        await lockBookmark(trx, documentId);
        const where = { userId: viewer.userId, bookmarkDocumentId: documentId };
        const { count } = await db.query(PREFERENCE_UID).updateMany({
          where,
          data: { isPinned: pinned },
        });
        if (!count && pinned) {
          await db.query(PREFERENCE_UID).create({ data: { ...where, isPinned: true } });
        }
      });
      return { documentId, isPinned: pinned };
    },

    /**
     * Roles a bookmark can be shared with.
     * @returns `[{ documentId, name }]`.
     */
    async listRoles() {
      const roles = await db.query(ADMIN_ROLE_UID).findMany({
        select: ['documentId', 'name'],
        orderBy: { name: 'asc' },
      });
      return roles.map((role: { documentId: string; name: string }) => ({
        documentId: role.documentId,
        name: role.name,
      }));
    },

    /**
     * Searches active admin users a bookmark can be shared with (never the viewer).
     * Email is searched and returned only when the viewer may read admin users.
     */
    async searchUsers(viewer: Viewer, params: { q?: string; page?: number }) {
      const where: Record<string, unknown>[] = [
        { isActive: true },
        { documentId: { $ne: viewer.userId } },
      ];
      if (params.q) {
        const fields = ['firstname', 'lastname', 'username'];
        if (viewer.canReadUsers) fields.push('email');
        where.push({ $or: fields.map((field) => ({ [field]: { $containsi: params.q } })) });
      }
      const select = ['documentId', 'firstname', 'lastname', 'username'];
      if (viewer.canReadUsers) select.push('email');
      const { results, pagination } = await db.query(ADMIN_USER_UID).findPage({
        where: { $and: where },
        select,
        orderBy: [{ firstname: 'asc' }, { lastname: 'asc' }, { id: 'asc' }],
        page: params.page ?? 1,
        pageSize: LIMITS.userSearchPageSize,
      });
      return {
        results: (results as UserRow[]).map((user) => ({
          documentId: user.documentId,
          name: displayName(user),
          ...(viewer.canReadUsers ? { email: user.email ?? null } : {}),
        })),
        pagination,
      };
    },
  };
};

export type BookmarkService = ReturnType<typeof bookmarkService>;
export default bookmarkService;
