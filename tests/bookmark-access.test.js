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
