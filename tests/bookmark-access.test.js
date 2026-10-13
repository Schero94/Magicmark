const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../server/src/services/service.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleRef = { exports: {} };
new Function('module', 'exports', 'require', compiled)(moduleRef, moduleRef.exports, require);
const createService = moduleRef.exports.default;

const controllerSource = fs.readFileSync(path.join(__dirname, '../server/src/controllers/controller.ts'), 'utf8');
const controllerCompiled = ts.transpileModule(controllerSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const controllerModule = { exports: {} };
new Function('module', 'exports', 'require', controllerCompiled)(controllerModule, controllerModule.exports, require);

test('another admin cannot delete a bookmark owned by someone else', async () => {
  let deleted = false;
  const strapi = {
    documents: () => ({
      findOne: async () => ({ creatorId: 'owner' }),
      delete: async () => { deleted = true; },
    }),
    log: { error() {} },
  };
  const service = createService({ strapi });
  await assert.rejects(service.delete('bookmark-id', 'other-admin'), /Unauthorized/);
  assert.equal(deleted, false);
});

test('owner can delete a bookmark', async () => {
  let deletedId;
  const strapi = {
    documents: () => ({
      findOne: async () => ({ creatorId: 'owner' }),
      delete: async ({ documentId }) => { deletedId = documentId; return { documentId }; },
    }),
    log: { error() {} },
  };
  const service = createService({ strapi });
  assert.deepEqual(await service.delete('bookmark-id', 'owner'), { documentId: 'bookmark-id' });
  assert.equal(deletedId, 'bookmark-id');
});

test('delete endpoint passes the admin identity and keeps forbidden as 403', async () => {
  let receivedUserId;
  const forbidden = Object.assign(new Error('Not owner'), { status: 403 });
  const strapi = { plugin: () => ({ service: () => ({
    delete: async (_id, userId) => { receivedUserId = userId; throw forbidden; },
  }) }) };
  const ctx = {
    state: { user: { documentId: 'other-admin' } },
    params: { id: 'bookmark-id' },
    throw(status) { throw Object.assign(new Error('HTTP error'), { status }); },
  };
  await assert.rejects(controllerModule.exports.default({ strapi }).delete(ctx),
    (error) => error === forbidden);
  assert.equal(receivedUserId, 'other-admin');
});

function createBookmarkServiceHarness(records = []) {
  const updates = [];
  const created = [];
  const strapi = {
    documents: () => ({
      findMany: async ({ sort, limit, filters } = {}) => {
        if (limit === 1) return records.slice().sort((a, b) => b.order - a.order).slice(0, 1);
        if (sort?.[0]?.order === 'desc') return records.slice().sort((a, b) => b.order - a.order);
        if (filters?.documentId?.$in) {
          return records.filter((record) => filters.documentId.$in.includes(record.documentId));
        }
        return records;
      },
      findOne: async ({ documentId }) => records.find((bookmark) => bookmark.documentId === documentId) || null,
      create: async ({ data }) => {
        created.push(data);
        return data;
      },
      update: async ({ documentId, data }) => {
        updates.push({ documentId, data });
        return { documentId, ...data };
      },
      delete: async ({ documentId }) => ({ documentId }),
    }),
    log: { error() {}, debug() {} },
  };
  return { service: createService({ strapi }), updates, created };
}

test('create assigns service-level ownership to the authenticated actor', async () => {
  const { service, created } = createBookmarkServiceHarness();
  await service.create('Mine', '/content-manager', '', '', '', 'owner');
  assert.equal(created[0].creatorId, 'owner');
  assert.equal(created[0].updaterId, 'owner');
});

test('create endpoint ignores caller-supplied ownership fields', async () => {
  let createArgs;
  const controller = controllerModule.exports.default({
    strapi: {
      plugin() { return { service(name) {
        if (name === 'license-guard') return { canCreateBookmark: async () => ({ canCreate: true }) };
        return { create: async (...args) => { createArgs = args; return {}; } };
      } }; },
    },
  });
  const ctx = {
    state: { user: { documentId: 'owner' } },
    request: { body: { name: 'Bookmark', path: '/content-manager', creatorId: 'attacker', updaterId: 'attacker' } },
    throw(status, message) { throw Object.assign(new Error(message), { status }); },
  };
  await controller.create(ctx);
  assert.equal(createArgs[5], 'owner');
  assert.equal(createArgs.includes('attacker'), false);
});

test('owner can pin a bookmark and another admin cannot', async () => {
  const records = [{ documentId: 'mine', creatorId: 'owner' }];
  const ownerHarness = createBookmarkServiceHarness(records);
  await ownerHarness.service.pin('mine', true, 'owner');
  assert.deepEqual(ownerHarness.updates, [{ documentId: 'mine', data: { isPinned: true, updaterId: 'owner' } }]);

  const otherHarness = createBookmarkServiceHarness(records);
  await assert.rejects(otherHarness.service.pin('mine', true, 'other-admin'), /Unauthorized/);
  assert.deepEqual(otherHarness.updates, []);
});

test('reorder updates only bookmarks owned by the actor and denies a mixed-owner batch without writes', async () => {
  const records = [
    { documentId: 'first', creatorId: 'owner' },
    { documentId: 'second', creatorId: 'owner' },
    { documentId: 'shared', creatorId: 'another-admin' },
  ];
  const ownerHarness = createBookmarkServiceHarness(records);
  await ownerHarness.service.reorder(['second', 'first'], 'owner');
  assert.deepEqual(ownerHarness.updates.map(({ documentId, data }) => [documentId, data.order]), [['second', 0], ['first', 1]]);

  const otherHarness = createBookmarkServiceHarness(records);
  await assert.rejects(otherHarness.service.reorder(['first', 'shared'], 'owner'), /Unauthorized/);
  assert.deepEqual(otherHarness.updates, []);
});

test('only the owner can change sharing settings', async () => {
  const records = [{ documentId: 'shared', creatorId: 'owner' }];
  const ownerHarness = createBookmarkServiceHarness(records);
  await ownerHarness.service.update('shared', {
    name: 'Shared', path: '/content-manager', sharedWithUsers: ['recipient'], isPublic: false,
  }, 'owner');
  assert.equal(ownerHarness.updates[0].data.sharedWithUsers[0], 'recipient');

  const otherHarness = createBookmarkServiceHarness(records);
  await assert.rejects(otherHarness.service.update('shared', {
    name: 'Stolen', path: '/content-manager', sharedWithUsers: [], isPublic: true,
  }, 'recipient'), /Unauthorized/);
  assert.deepEqual(otherHarness.updates, []);
});

test('admin routes use registered permission scopes and never disable authentication', () => {
  const routeFiles = [
    '../server/src/routes/admin.ts',
    '../server/routes/admin.js',
  ];
  for (const routeFile of routeFiles) {
    const sourceText = fs.readFileSync(path.join(__dirname, routeFile), 'utf8');
    const routeCompiled = ts.transpileModule(sourceText, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const routeModule = { exports: {} };
    new Function('module', 'exports', 'require', routeCompiled)(routeModule, routeModule.exports, require);
    const routes = routeModule.exports.default || routeModule.exports;
    for (const route of routes.routes) {
      assert.notEqual(route.config?.auth, false, `${route.method} ${route.path} must require admin authentication`);
      const expectedScope = route.method === 'GET'
        ? 'plugin::magic-mark.settings.read'
        : 'plugin::magic-mark.settings.update';
      assert.deepEqual(route.config?.auth?.scope, [expectedScope], `${route.method} ${route.path} must require ${expectedScope}`);
    }
  }
});

test('route read and write scopes are registered with Strapi admin RBAC', async () => {
  const registerSource = fs.readFileSync(path.join(__dirname, '../server/src/register.ts'), 'utf8');
  const registerCompiled = ts.transpileModule(registerSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const registerModule = { exports: {} };
  const mockedRequire = (request) => request === './utils/logger'
    ? { createLogger: () => ({ info() {} }) }
    : require(request);
  new Function('module', 'exports', 'require', registerCompiled)(registerModule, registerModule.exports, mockedRequire);
  let registeredActions = [];
  await registerModule.exports.default({
    strapi: {
      admin: { services: { permission: { actionProvider: {
        registerMany: async (actions) => { registeredActions = actions; },
      } } } },
      log: { info() {} },
    },
  });
  assert.deepEqual(registeredActions.map(({ uid }) => uid).sort(), ['settings.read', 'settings.update']);
});

test('anonymous bookmark create is rejected before the service is called', async () => {
  let serviceCalled = false;
  const controller = controllerModule.exports.default({
    plugin() { return { service() { return {
      canCreateBookmark: async () => ({ canCreate: true }),
      create: async () => { serviceCalled = true; },
    }; } }; },
  });
  const ctx = {
    state: {},
    request: { body: { name: 'Test', path: '/content-manager' } },
    throw(status) { throw Object.assign(new Error('HTTP error'), { status }); },
  };
  await assert.rejects(controller.create(ctx), (error) => error.status === 401);
  assert.equal(serviceCalled, false);
});

test('mutation routes preserve authorization denials and pass the authenticated actor', async () => {
  const forbidden = Object.assign(new Error('Not owner'), { status: 403 });
  const methods = ['update', 'pin', 'reorder', 'delete'];
  for (const method of methods) {
    let receivedUserId;
    const controller = controllerModule.exports.default({
      strapi: {
        plugin() { return { service() { return {
          [method]: async (...args) => {
            receivedUserId = method === 'reorder' ? args[1] : method === 'delete' ? args[1] : args.at(-1);
            throw forbidden;
          },
        }; } }; },
      },
    });
    const ctx = {
      state: { user: { documentId: 'other-admin' } },
      params: { id: 'bookmark-id' },
      request: { body: { name: 'Attempted change', path: '/content-manager', isPinned: true, bookmarkIds: ['bookmark-id'] } },
      throw(status, message) { throw Object.assign(new Error(message), { status }); },
    };
    await assert.rejects(controller[method](ctx), (error) => {
      assert.equal(error.status, 403, `${method} must preserve 403, got ${error.status}: ${error.message}`);
      assert.equal(error, forbidden, `${method} must preserve the original authorization error`);
      return true;
    }, method);
    assert.equal(receivedUserId, 'other-admin', method);
  }
});
