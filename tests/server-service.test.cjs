'use strict';

require('./helpers/register-ts.cjs');
const assert = require('node:assert/strict');
const test = require('node:test');
const { createFakeStrapi } = require('./helpers/fake-strapi.cjs');

const bookmarkService = require('../server/src/services/bookmarks.ts').default;

const PATH = '/content-manager/collection-types/api::article.article';
const viewer = (userId, roleIds = [], extra = {}) => ({
  userId,
  roleIds,
  canShare: true,
  canManage: false,
  canReadUsers: false,
  ...extra,
});

/** Fixture: two roles, three active admins (owner, editor in role A, outsider). */
const setup = () => {
  const strapi = createFakeStrapi({
    tables: {
      'admin::role': [
        { documentId: 'roleeditor', name: 'Editor' },
        { documentId: 'roleauthor', name: 'Author' },
      ],
      'admin::user': [
        {
          documentId: 'owner',
          firstname: 'Ada',
          lastname: 'Beispiel',
          email: 'ada@example.test',
          isActive: true,
        },
        {
          documentId: 'editor',
          firstname: 'Ben',
          lastname: 'Muster',
          email: 'ben@example.test',
          isActive: true,
        },
        {
          documentId: 'outsider',
          firstname: 'Cleo',
          lastname: 'Test',
          email: 'cleo@example.test',
          isActive: true,
        },
        { documentId: 'inactive', firstname: 'Dan', lastname: 'Old', isActive: false },
      ],
    },
  });
  return { strapi, service: bookmarkService({ strapi }) };
};

const create = (service, owner, input = {}) =>
  service.create(viewer(owner), {
    name: 'Drafts',
    path: { path: PATH, contentType: 'api::article.article' },
    query: 'filters[$and][0][title][$eq]=x',
    ...input,
  });

test('a bookmark shared with a user by documentId is visible to that user only (MM-F02)', async () => {
  const { service } = setup();
  const created = await create(service, 'owner', { visibility: 'shared', users: ['editor'] });
  assert.equal(created.visibility, 'shared');
  assert.deepEqual(
    created.sharing.users.map((u) => u.documentId),
    ['editor']
  );

  const forEditor = await service.list(viewer('editor'), {});
  assert.deepEqual(
    forEditor.results.map((b) => b.documentId),
    [created.documentId]
  );
  assert.equal(forEditor.results[0].isOwner, false);
  assert.equal(forEditor.results[0].canEdit, false);
  assert.equal('sharing' in forEditor.results[0], false, 'recipients never see sharing lists');

  const forOutsider = await service.list(viewer('outsider'), {});
  assert.equal(forOutsider.results.length, 0);
});

test('role shares and public bookmarks are visible; private ones are not', async () => {
  const { service } = setup();
  await create(service, 'owner', { name: 'Private' });
  await create(service, 'owner', { name: 'Role', visibility: 'shared', roles: ['roleeditor'] });
  await create(service, 'owner', { name: 'Public', visibility: 'public' });

  const names = (result) => result.results.map((b) => b.name).sort();
  assert.deepEqual(names(await service.list(viewer('editor', ['roleeditor']), {})), [
    'Public',
    'Role',
  ]);
  assert.deepEqual(names(await service.list(viewer('outsider', ['roleauthor']), {})), ['Public']);
  assert.deepEqual(names(await service.list(viewer('owner'), {})), ['Private', 'Public', 'Role']);
});

test('other users get 404 for invisible bookmarks and 403 for visible foreign ones (IDOR)', async () => {
  const { service } = setup();
  const priv = await create(service, 'owner');
  const pub = await create(service, 'owner', { visibility: 'public' });

  await assert.rejects(service.findOne(viewer('outsider'), priv.documentId), {
    name: 'NotFoundError',
  });
  await assert.rejects(service.update(viewer('outsider'), priv.documentId, { name: 'x' }), {
    name: 'NotFoundError',
  });
  await assert.rejects(service.delete(viewer('outsider'), priv.documentId), {
    name: 'NotFoundError',
  });
  await assert.rejects(service.update(viewer('outsider'), pub.documentId, { name: 'x' }), {
    name: 'ForbiddenError',
  });
  await assert.rejects(service.delete(viewer('outsider'), pub.documentId), {
    name: 'ForbiddenError',
  });
  await assert.rejects(service.updateView(viewer('outsider'), pub.documentId, ''), {
    name: 'ForbiddenError',
  });

  const managed = await service.update(
    viewer('outsider', [], { canManage: true }),
    pub.documentId,
    { name: 'Renamed' }
  );
  assert.equal(managed.name, 'Renamed');
});

test('sharing without the share permission is rejected; private bookmarks are allowed', async () => {
  const { service } = setup();
  const noShare = viewer('owner', [], { canShare: false });
  await assert.rejects(
    service.create(noShare, {
      name: 'x',
      path: { path: PATH, contentType: 'api::article.article' },
      visibility: 'public',
    }),
    { name: 'ForbiddenError' }
  );
  const created = await service.create(noShare, {
    name: 'x',
    path: { path: PATH, contentType: 'api::article.article' },
  });
  assert.equal(created.visibility, 'private');
});

test('share targets must exist and be active; "shared" needs at least one target', async () => {
  const { service } = setup();
  await assert.rejects(create(service, 'owner', { visibility: 'shared', users: ['missing'] }), {
    name: 'ValidationError',
  });
  await assert.rejects(create(service, 'owner', { visibility: 'shared', users: ['inactive'] }), {
    name: 'ValidationError',
  });
  await assert.rejects(create(service, 'owner', { visibility: 'shared', roles: ['nope'] }), {
    name: 'ValidationError',
  });
  await assert.rejects(create(service, 'owner', { visibility: 'shared' }), {
    name: 'ValidationError',
  });
});

test('changing visibility to private removes every share row', async () => {
  const { strapi, service } = setup();
  const created = await create(service, 'owner', {
    visibility: 'shared',
    roles: ['roleeditor'],
    users: ['editor'],
  });
  assert.equal(strapi.table('plugin::magic-mark.bookmark-share').length, 2);
  const updated = await service.update(viewer('owner'), created.documentId, {
    visibility: 'private',
  });
  assert.equal(updated.visibility, 'private');
  assert.equal(strapi.table('plugin::magic-mark.bookmark-share').length, 0);
  assert.equal((await service.list(viewer('editor', ['roleeditor']), {})).results.length, 0);
});

test('pins are per user: a recipient pins a shared bookmark without changing the owner list (MM-F12)', async () => {
  const { service } = setup();
  const pub = await create(service, 'owner', { visibility: 'public' });
  await service.setPinned(viewer('editor'), pub.documentId, true);
  await service.setPinned(viewer('editor'), pub.documentId, true);

  assert.equal((await service.list(viewer('editor'), { scope: 'pinned' })).results.length, 1);
  assert.equal((await service.list(viewer('owner'), { scope: 'pinned' })).results.length, 0);
  assert.equal((await service.list(viewer('editor'), {})).results[0].isPinned, true);
  assert.equal((await service.list(viewer('owner'), {})).results[0].isPinned, false);

  await service.setPinned(viewer('editor'), pub.documentId, false);
  assert.equal((await service.list(viewer('editor'), { scope: 'pinned' })).results.length, 0);
});

test('list filters by content type, name and scope and paginates in the query', async () => {
  const { service } = setup();
  for (let i = 0; i < 30; i += 1)
    await create(service, 'owner', { name: `View ${String(i).padStart(2, '0')}` });
  await service.create(viewer('owner'), {
    name: 'Pages',
    path: {
      path: '/content-manager/collection-types/api::page.page',
      contentType: 'api::page.page',
    },
  });
  await create(service, 'editor', { name: 'Editor public', visibility: 'public' });

  const first = await service.list(viewer('owner'), { pageSize: 10, page: 2 });
  assert.equal(first.results.length, 10);
  assert.deepEqual(first.pagination, { page: 2, pageSize: 10, pageCount: 4, total: 32 });
  assert.equal(first.results[0].name, 'View 08');

  assert.equal(
    (await service.list(viewer('owner'), { contentType: 'api::page.page' })).pagination.total,
    1
  );
  assert.equal((await service.list(viewer('owner'), { q: 'view 2' })).pagination.total, 10);
  assert.equal((await service.list(viewer('owner'), { scope: 'shared' })).pagination.total, 1);
  assert.equal((await service.list(viewer('owner'), { scope: 'mine' })).pagination.total, 31);
});

test('owner names are loaded with one query per page and never include email', async () => {
  const { strapi, service } = setup();
  for (let i = 0; i < 5; i += 1)
    await create(service, i % 2 ? 'owner' : 'editor', { visibility: 'public' });
  strapi.calls.queries.length = 0;
  const result = await service.list(viewer('outsider'), {});
  const userQueries = strapi.calls.queries.filter((q) => q.uid === 'admin::user');
  assert.equal(userQueries.length, 1, 'creators are loaded in one batch (no N+1)');
  assert.ok(result.results.every((b) => b.owner && !('email' in b.owner)));
  assert.equal(JSON.stringify(result).includes('@example.test'), false);
});

test('duplicate copies a visible bookmark into a private one owned by the caller', async () => {
  const { service } = setup();
  const pub = await create(service, 'owner', { visibility: 'public', name: 'Shared view' });
  const copy = await service.duplicate(viewer('editor'), pub.documentId, 'Mine');
  assert.equal(copy.name, 'Mine');
  assert.equal(copy.isOwner, true);
  assert.equal(copy.visibility, 'private');
  assert.equal(copy.query, pub.query);
});

test('delete removes shares and preferences of the bookmark', async () => {
  const { strapi, service } = setup();
  const created = await create(service, 'owner', { visibility: 'shared', users: ['editor'] });
  await service.setPinned(viewer('editor'), created.documentId, true);
  await service.delete(viewer('owner'), created.documentId);
  assert.equal(strapi.table('plugin::magic-mark.bookmark').length, 0);
  assert.equal(strapi.table('plugin::magic-mark.bookmark-share').length, 0);
  assert.equal(strapi.table('plugin::magic-mark.bookmark-preference').length, 0);
});

test('creating more than 10 bookmarks works: there is no plan limit (FREE-2)', async () => {
  const { service } = setup();
  for (let i = 0; i < 25; i += 1) await create(service, 'owner', { name: `B${i}` });
  assert.equal((await service.list(viewer('owner'), { pageSize: 100 })).pagination.total, 25);
});

test('user search excludes the caller and inactive users and hides email without admin::users.read', async () => {
  const { service } = setup();
  const result = await service.searchUsers(viewer('owner'), { q: '' });
  assert.deepEqual(result.results.map((u) => u.documentId).sort(), ['editor', 'outsider']);
  assert.ok(result.results.every((u) => !('email' in u)));
  const withEmail = await service.searchUsers(viewer('owner', [], { canReadUsers: true }), {
    q: 'ben@',
  });
  assert.deepEqual(withEmail.results, [
    { documentId: 'editor', name: 'Ben Muster', email: 'ben@example.test' },
  ]);
  const noEmailSearch = await service.searchUsers(viewer('owner'), { q: 'ben@' });
  assert.equal(
    noEmailSearch.results.length,
    0,
    'email is not searchable without admin::users.read'
  );
});

test('managers reach shared bookmarks of deleted users they are not a recipient of (MM-RA-1)', async () => {
  const { strapi, service } = setup();
  const shared = await create(service, 'owner', {
    name: 'Orphan',
    visibility: 'shared',
    users: ['editor'],
  });
  const priv = await create(service, 'owner', { name: 'Private' });
  // The owner is deleted: the shared bookmark stays and shows "Deleted user".
  strapi.table('admin::user').splice(
    strapi.table('admin::user').findIndex((u) => u.documentId === 'owner'),
    1
  );
  const manager = viewer('outsider', [], { canManage: true });

  const one = await service.findOne(manager, shared.documentId);
  assert.equal(one.owner.isDeleted, true);
  assert.equal(one.canEdit, true);
  await assert.rejects(service.findOne(manager, priv.documentId), { name: 'NotFoundError' });

  const managed = await service.list(manager, { scope: 'managed' });
  assert.deepEqual(
    managed.results.map((b) => b.name),
    ['Orphan'],
    'the managed scope lists shared bookmarks but never private ones of others'
  );
  assert.equal((await service.list(manager, {})).pagination.total, 0, '"All" stays personal');

  await assert.rejects(service.delete(viewer('editor'), shared.documentId), {
    name: 'ForbiddenError',
  });
  await service.delete(manager, shared.documentId);
  assert.deepEqual(
    strapi.table('plugin::magic-mark.bookmark').map((b) => b.name),
    ['Private']
  );
  assert.equal(strapi.table('plugin::magic-mark.bookmark-share').length, 0);
});

test('the managed scope needs the manage permission (MM-RA-1)', async () => {
  const { service } = setup();
  await assert.rejects(service.list(viewer('editor'), { scope: 'managed' }), {
    name: 'ForbiddenError',
  });
});

test('duplicate normalises a legacy query: page and unknown keys are dropped (MM-RA-2)', async () => {
  const { strapi, service } = setup();
  const pub = await create(service, 'owner', { visibility: 'public' });
  const row = strapi
    .table('plugin::magic-mark.bookmark')
    .find((b) => b.documentId === pub.documentId);
  row.query = 'page=3&pageSize=10&foo=bar&filters%5B%24and%5D%5B0%5D%5Btitle%5D%5B%24eq%5D=x';
  const copy = await service.duplicate(viewer('editor'), pub.documentId);
  assert.equal(copy.query.includes('page=3'), false);
  assert.equal(copy.query.includes('foo'), false);
  assert.match(copy.query, /pageSize=10/);
  assert.match(decodeURIComponent(copy.query), /filters\[\$and\]\[0\]\[title\]\[\$eq\]=x/);

  row.query = 'filters[__proto__][x]=1';
  assert.equal((await service.duplicate(viewer('editor'), pub.documentId)).query, '');
});

// Several Strapi processes on one database: requests for the same bookmark interleave. The
// fake db yields on every query and implements row locks like Postgres `FOR UPDATE`.

test('8 parallel pins of the same bookmark by one user store one preference row', async () => {
  const { strapi, service } = setup();
  const created = await create(service, 'owner');
  await Promise.all(
    Array.from({ length: 8 }, () => service.setPinned(viewer('owner'), created.documentId, true))
  );
  const prefs = strapi
    .table('plugin::magic-mark.bookmark-preference')
    .filter((p) => p.bookmarkDocumentId === created.documentId && p.userId === 'owner');
  assert.equal(prefs.length, 1);
  assert.equal(prefs[0].isPinned, true);
});

test('parallel share edits of one bookmark leave exactly one of the requested share sets', async () => {
  const { strapi, service } = setup();
  const created = await create(service, 'owner');
  const sets = [
    { visibility: 'shared', roles: ['roleeditor'], users: ['editor'] },
    { visibility: 'shared', roles: ['roleauthor'], users: ['outsider'] },
    { visibility: 'shared', roles: ['roleeditor', 'roleauthor'], users: [] },
    { visibility: 'shared', roles: [], users: ['editor', 'outsider'] },
  ];
  await Promise.all(
    [...sets, ...sets].map((set) => service.update(viewer('owner'), created.documentId, set))
  );
  const rows = strapi
    .table('plugin::magic-mark.bookmark-share')
    .filter((s) => s.bookmarkDocumentId === created.documentId)
    .map((s) => `${s.targetType}:${s.targetId}`)
    .sort();
  assert.equal(rows.length, new Set(rows).size, 'no duplicate share rows');
  const allowed = sets.map((set) =>
    [...set.roles.map((r) => `role:${r}`), ...set.users.map((u) => `user:${u}`)].sort().join(',')
  );
  assert.ok(allowed.includes(rows.join(',')), `unexpected share set ${rows.join(',')}`);
});

test('writes that race a delete answer 404 and leave no share or pin rows behind', async () => {
  const { strapi, service } = setup();
  const created = await create(service, 'owner', { visibility: 'shared', users: ['editor'] });
  const id = created.documentId;
  const results = await Promise.allSettled([
    service.delete(viewer('owner'), id),
    service.update(viewer('owner'), id, { visibility: 'shared', roles: ['roleeditor'] }),
    service.setPinned(viewer('owner'), id, true),
    service.setPinned(viewer('editor'), id, true),
    service.updateView(viewer('owner'), id, 'sort=title:ASC'),
    service.delete(viewer('owner'), id),
  ]);
  for (const result of results) {
    if (result.status === 'rejected') assert.equal(result.reason.name, 'NotFoundError');
  }
  const deletes = [results[0], results[5]];
  assert.equal(deletes.filter((r) => r.status === 'fulfilled').length, 1, 'one delete wins');
  assert.equal(strapi.table('plugin::magic-mark.bookmark').length, 0);
  assert.equal(
    strapi.table('plugin::magic-mark.bookmark-share').filter((s) => s.bookmarkDocumentId === id)
      .length,
    0
  );
  assert.equal(
    strapi
      .table('plugin::magic-mark.bookmark-preference')
      .filter((p) => p.bookmarkDocumentId === id).length,
    0
  );
});

test('every write to an existing bookmark locks its row first', async () => {
  const { strapi, service } = setup();
  const created = await create(service, 'owner');
  const id = created.documentId;
  const locksAfter = async (fn) => {
    strapi.calls.queries.length = 0;
    await fn();
    return strapi.calls.queries.filter(
      (q) => q.op === 'lock' && q.uid === 'plugin::magic-mark.bookmark'
    ).length;
  };
  assert.equal(await locksAfter(() => service.update(viewer('owner'), id, { name: 'x' })), 1);
  assert.equal(
    await locksAfter(() => service.updateView(viewer('owner'), id, 'sort=title:ASC')),
    1
  );
  assert.equal(await locksAfter(() => service.setPinned(viewer('owner'), id, true)), 1);
  assert.equal(await locksAfter(() => service.delete(viewer('owner'), id)), 1);
});
