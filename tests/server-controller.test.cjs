'use strict';

require('./helpers/register-ts.cjs');
const assert = require('node:assert/strict');
const test = require('node:test');
const { createFakeStrapi } = require('./helpers/fake-strapi.cjs');

const controllerFactory = require('../server/src/controllers/bookmarks.ts').default;
const bookmarkService = require('../server/src/services/bookmarks.ts').default;

const PATH = '/content-manager/collection-types/api::article.article';

const setup = () => {
  const strapi = createFakeStrapi({
    tables: {
      'admin::role': [{ documentId: 'roleeditor', name: 'Editor' }],
      'admin::user': [{ documentId: 'owner', firstname: 'Ada', isActive: true }],
    },
  });
  strapi.services.bookmarks = bookmarkService({ strapi });
  return { strapi, controller: controllerFactory({ strapi }) };
};

const ctx = ({ body, query = {}, params = {}, granted = [] } = {}) => ({
  state: {
    user: { id: 2, documentId: 'owner', roles: [{ id: 1, documentId: 'roleeditor' }] },
    userAbility: { can: (action) => granted.includes(action) },
  },
  request: { body },
  query,
  params,
  body: undefined,
});

test('handlers take the owner from the session, not from the body', async () => {
  const { controller } = setup();
  const c = ctx({ body: { name: 'Mine', path: PATH } });
  await controller.create(c);
  assert.equal(c.body.data.isOwner, true);

  const forged = ctx({ body: { name: 'x', path: PATH, creatorId: 'someone-else' } });
  await assert.rejects(controller.create(forged), { name: 'ValidationError' });
});

test('missing session answers 401, invalid input 400 with field details', async () => {
  const { controller } = setup();
  const anonymous = { ...ctx(), state: {} };
  await assert.rejects(controller.find(anonymous), { name: 'UnauthorizedError' });
  await assert.rejects(controller.create(ctx({ body: { name: '', path: '/x' } })), (error) => {
    assert.equal(error.name, 'ValidationError');
    assert.ok(error.details.fieldErrors.name);
    assert.ok(error.details.fieldErrors.path);
    return true;
  });
  await assert.rejects(controller.find(ctx({ query: { pageSize: '5000' } })), {
    name: 'ValidationError',
  });
});

test('share permission comes from the user ability; without it sharing is forbidden', async () => {
  const { controller } = setup();
  const body = { name: 'Team', path: PATH, visibility: 'shared', roles: ['roleeditor'] };
  await assert.rejects(controller.create(ctx({ body })), { name: 'ForbiddenError' });
  const allowed = ctx({ body, granted: ['plugin::magic-mark.bookmarks.share'] });
  await controller.create(allowed);
  assert.equal(allowed.body.data.visibility, 'shared');
});

test('list response carries pagination and the caller permissions', async () => {
  const { controller } = setup();
  await controller.create(ctx({ body: { name: 'A', path: PATH } }));
  const c = ctx({
    query: { page: '1', pageSize: '10' },
    granted: ['plugin::magic-mark.bookmarks.manage'],
  });
  await controller.find(c);
  assert.equal(c.body.data.length, 1);
  assert.deepEqual(c.body.meta.pagination, { page: 1, pageSize: 10, pageCount: 1, total: 1 });
  assert.deepEqual(c.body.meta.permissions, { canShare: false, canManage: true });
});

test('route params from the router (which may carry extra keys) only pass the id', async () => {
  const { controller } = setup();
  const created = ctx({ body: { name: 'A', path: PATH } });
  await controller.create(created);
  const c = ctx({ params: { id: created.body.data.documentId, 0: 'bookmarks' } });
  await controller.findOne(c);
  assert.equal(c.body.data.name, 'A');
  await assert.rejects(controller.findOne(ctx({ params: { id: '../etc' } })), {
    name: 'ValidationError',
  });
});
