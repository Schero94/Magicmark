'use strict';

require('./helpers/register-ts.cjs');
const assert = require('node:assert/strict');
const test = require('node:test');

const { routes } = require('../server/src/routes/admin.ts');
const routerIndex = require('../server/src/routes/index.ts').default;
const { PERMISSION_ACTIONS } = require('../server/src/register.ts');
const path = require('node:path');

// The policy file is not in @strapi/admin's exports map, so it is loaded by path.
const hasPermissions = require(
  path.join(
    __dirname,
    '../node_modules/@strapi/admin/dist/server/server/src/policies/hasPermissions.js'
  )
);

const policyFor = (route) => route.config.policies.find((p) => p.name === 'admin::hasPermissions');

test('every admin route requires an authenticated admin and a Magic Mark action (MM-F01, SEC-01)', () => {
  assert.equal(routerIndex.admin.type, 'admin');
  assert.equal('content-api' in routerIndex, false);
  for (const route of routes) {
    assert.equal(route.config.auth, undefined, `${route.path} must not rely on auth.scope`);
    assert.equal(route.config.policies[0], 'admin::isAuthenticatedAdmin', route.path);
    const policy = policyFor(route);
    assert.ok(policy, `${route.method} ${route.path} has hasPermissions`);
    assert.ok(policy.config.actions.length > 0);
    assert.ok(policy.config.actions.every((a) => a.startsWith('plugin::magic-mark.bookmarks.')));
  }
});

test('route permission matrix', () => {
  const matrix = Object.fromEntries(
    routes.map((r) => [
      `${r.method} ${r.path}`,
      policyFor(r)
        .config.actions.map((a) => a.split('.').pop())
        .sort(),
    ])
  );
  assert.deepEqual(matrix, {
    'GET /bookmarks': ['read'],
    'POST /bookmarks': ['create', 'read'],
    'GET /bookmarks/:id': ['read'],
    'PUT /bookmarks/:id': ['read', 'update'],
    'DELETE /bookmarks/:id': ['delete', 'read'],
    'PUT /bookmarks/:id/view': ['read', 'update'],
    'POST /bookmarks/:id/duplicate': ['create', 'read'],
    'PUT /bookmarks/:id/pin': ['read'],
    'GET /sharing/roles': ['share'],
    'GET /sharing/users': ['share'],
  });
});

test('no license, upgrade or limit routes remain (FREE-3)', () => {
  assert.ok(routes.every((r) => !/licen|upgrade|limit/i.test(r.path)));
});

test('the real admin::hasPermissions policy denies an admin without the action', () => {
  const ability = (granted) => ({ can: (action) => granted.includes(action) });
  for (const route of routes) {
    const config = policyFor(route).config;
    const deny = hasPermissions.handler({ state: { userAbility: ability([]) } }, config);
    assert.equal(deny, false, `${route.path} denies without permission`);
    const allow = hasPermissions.handler(
      { state: { userAbility: ability(config.actions) } },
      config
    );
    assert.equal(allow, true, `${route.path} allows with permission`);
  }
});

test('registered action uids pass the admin action-provider pattern', () => {
  const pattern = /^[a-z]([a-z|.|-]+)[a-z]$/;
  const uids = PERMISSION_ACTIONS.map((a) => a.uid);
  assert.deepEqual(uids, [
    'bookmarks.read',
    'bookmarks.create',
    'bookmarks.update',
    'bookmarks.delete',
    'bookmarks.share',
    'bookmarks.manage',
  ]);
  for (const action of PERMISSION_ACTIONS) {
    assert.match(action.uid, pattern);
    assert.equal(action.section, 'plugins');
    assert.equal(action.pluginName, 'magic-mark');
  }
});
