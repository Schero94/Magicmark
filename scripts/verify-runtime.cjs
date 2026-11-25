'use strict';

/**
 * Loads the built server bundle the way Strapi does (CommonJS require) and checks its shape:
 * lifecycle functions, routes with RBAC policies, content types, services and controllers.
 * Run after `npm run build`.
 */
const assert = require('node:assert/strict');
const path = require('node:path');

const entry = require(path.join(__dirname, '..', 'strapi-server.js'));

for (const fn of ['register', 'bootstrap', 'destroy']) {
  assert.equal(typeof entry[fn], 'function', `${fn} is a function`);
}
assert.deepEqual(Object.keys(entry.contentTypes).sort(), [
  'bookmark',
  'bookmark-preference',
  'bookmark-share',
]);
assert.deepEqual(Object.keys(entry.services).sort(), ['bookmarks', 'maintenance']);
assert.deepEqual(Object.keys(entry.controllers), ['bookmarks']);
assert.equal(entry.routes.admin.type, 'admin');
assert.ok(entry.routes.admin.routes.length >= 10);
for (const route of entry.routes.admin.routes) {
  const policy = route.config.policies.find((p) => p && p.name === 'admin::hasPermissions');
  assert.ok(policy, `${route.method} ${route.path} is protected`);
}
console.log(`verify:runtime ok (${entry.routes.admin.routes.length} admin routes)`);
