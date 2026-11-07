'use strict';

require('./helpers/register-ts.cjs');
const assert = require('node:assert/strict');
const test = require('node:test');
const { createFakeStrapi } = require('./helpers/fake-strapi.cjs');

const server = require('../server/src/index.ts').default;
const maintenanceService = require('../server/src/services/maintenance.ts').default;
const bookmarkService = require('../server/src/services/bookmarks.ts').default;

const BOOKMARK = 'plugin::magic-mark.bookmark';
const SHARE = 'plugin::magic-mark.bookmark-share';
const PREF = 'plugin::magic-mark.bookmark-preference';

const withServices = (strapi) => {
  strapi.services.maintenance = maintenanceService({ strapi });
  strapi.services.bookmarks = bookmarkService({ strapi });
  return strapi;
};

/** 3.x fixture: relative path, numeric and documentId shares, a global pin. */
const legacyFixture = () =>
  withServices(
    createFakeStrapi({
      tables: {
        'admin::role': [{ documentId: 'roleeditor', name: 'Editor' }],
        'admin::user': [
          { documentId: 'owner', isActive: true },
          { documentId: 'editor', isActive: true },
        ],
        [BOOKMARK]: [
          {
            name: 'Legacy',
            path: 'content-manager/collection-types/api::article.article',
            contentType: null,
            query: '',
            creatorId: 'owner',
            isPublic: false,
            isPinned: true,
            sharedWithRoles: ['roleeditor'],
            sharedWithUsers: [3, 'owner', 'ghost'], // id 3 = editor (roles are inserted first)
          },
          {
            name: 'Broken path',
            path: 'https://evil.example',
            contentType: null,
            creatorId: 'owner',
            isPinned: false,
            sharedWithRoles: [],
            sharedWithUsers: [],
          },
        ],
      },
      store: { licenseKey: 'FAKE-KEY-0001', lastValidated: '2026-01-01' },
    })
  );

test('register, bootstrap and destroy make no network calls and leave no timers (FREE-1, SEC-05)', async () => {
  const strapi = legacyFixture();
  const originalFetch = globalThis.fetch;
  const originalInterval = globalThis.setInterval;
  const originalTimeout = globalThis.setTimeout;
  let fetches = 0;
  let timers = 0;
  globalThis.fetch = async () => {
    fetches += 1;
    throw new Error('network disabled in tests');
  };
  globalThis.setInterval = (...args) => {
    timers += 1;
    return originalInterval(...args);
  };
  globalThis.setTimeout = (...args) => {
    timers += 1;
    return originalTimeout(...args);
  };
  try {
    await server.register({ strapi });
    await strapi.hooks['strapi::content-types.afterSync']();
    await server.bootstrap({ strapi });
    assert.ok(strapi.subscriber, 'bootstrap subscribes to admin user/role deletions');
    await server.destroy({ strapi });
    assert.equal(strapi.subscriber, null, 'destroy removes the subscription');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setInterval = originalInterval;
    globalThis.setTimeout = originalTimeout;
  }
  assert.equal(fetches, 0);
  assert.equal(timers, 0);
  assert.equal(strapi.registeredActions.length, 6);
});

test('bootstrap deletes the stored 3.x license keys and is idempotent', async () => {
  const strapi = legacyFixture();
  await server.bootstrap({ strapi });
  await server.bootstrap({ strapi });
  assert.equal(strapi.storeValues.has('licenseKey'), false);
  assert.equal(strapi.storeValues.has('lastValidated'), false);
  assert.equal(JSON.stringify(strapi.logs).includes('FAKE-KEY'), false);
});

test('3.x rows migrate: path, content type, numeric/documentId shares and the owner pin', async () => {
  const strapi = legacyFixture();
  await strapi.services.maintenance.migrateLegacyBookmarks();
  const [legacy, broken] = strapi.table(BOOKMARK);
  assert.equal(legacy.path, '/content-manager/collection-types/api::article.article');
  assert.equal(legacy.contentType, 'api::article.article');
  assert.equal(legacy.sharedWithRoles, null);
  assert.equal(legacy.sharedWithUsers, null);
  assert.equal(legacy.isPinned, false);
  assert.equal(broken.contentType, '');

  const shares = strapi
    .table(SHARE)
    .map((s) => `${s.targetType}:${s.targetId}`)
    .sort();
  assert.deepEqual(
    shares,
    ['role:roleeditor', 'user:editor'],
    'numeric id 3 maps to editor; owner and ghost are dropped'
  );
  assert.deepEqual(
    strapi.table(PREF).map((p) => [p.userId, p.isPinned]),
    [['owner', true]]
  );

  const visible = await strapi.services.bookmarks.list(
    { userId: 'editor', roleIds: [], canShare: false, canManage: false, canReadUsers: false },
    {}
  );
  assert.deepEqual(
    visible.results.map((b) => b.name),
    ['Legacy']
  );
});

test('concurrent migrations (several processes) insert each share once', async () => {
  const strapi = legacyFixture();
  const other = maintenanceService({ strapi });
  await Promise.all([
    strapi.services.maintenance.migrateLegacyBookmarks(),
    other.migrateLegacyBookmarks(),
  ]);
  assert.equal(strapi.table(SHARE).length, 2);
  assert.equal(strapi.table(PREF).length, 1);
  await strapi.services.maintenance.migrateLegacyBookmarks();
  assert.equal(strapi.table(SHARE).length, 2);
});

test('3.x permissions are mapped to the new actions for the same roles', async () => {
  const strapi = withServices(
    createFakeStrapi({
      tables: {
        'admin::permission': [
          { action: 'plugin::magic-mark.settings.read', role: { id: 7 } },
          { action: 'plugin::magic-mark.settings.update', role: { id: 8 } },
          { action: 'plugin::magic-mark.bookmarks.read', role: { id: 8 } },
        ],
      },
    })
  );
  await strapi.services.maintenance.migrateLegacyPermissions();
  await strapi.services.maintenance.migrateLegacyPermissions();
  const byRole = (id) =>
    strapi
      .table('admin::permission')
      .filter((p) => p.role.id === id && p.action.includes('bookmarks.'))
      .map((p) => p.action.split('.').pop())
      .sort();
  assert.deepEqual(byRole(7), ['read']);
  assert.deepEqual(byRole(8), ['create', 'delete', 'read', 'share', 'update']);
  assert.equal(byRole(8).length, new Set(byRole(8)).size, 'no duplicates on a second run');
});

test('deleting an admin user removes their private bookmarks, shares and pins; shared ones stay (MM-F13)', async () => {
  const strapi = withServices(
    createFakeStrapi({ tables: { 'admin::user': [{ documentId: 'gone', isActive: true }] } })
  );
  const [priv, pub] = [
    strapi.insert(BOOKMARK, { name: 'p', creatorId: 'gone', isPublic: false }),
    strapi.insert(BOOKMARK, { name: 'q', creatorId: 'gone', isPublic: true }),
  ];
  strapi.insert(SHARE, { bookmarkDocumentId: 'other', targetType: 'user', targetId: 'gone' });
  strapi.insert(PREF, { userId: 'gone', bookmarkDocumentId: pub.documentId, isPinned: true });
  await strapi.services.maintenance.cleanupDeletedUsers(['gone']);
  assert.deepEqual(
    strapi.table(BOOKMARK).map((b) => b.documentId),
    [pub.documentId]
  );
  assert.equal(strapi.table(SHARE).length, 0);
  assert.equal(strapi.table(PREF).length, 0);
  assert.ok(priv);
});

test('the user deletion lifecycle captures ids before delete and cleans up after', async () => {
  const strapi = legacyFixture();
  await server.bootstrap({ strapi });
  const owner = strapi.table('admin::user').find((u) => u.documentId === 'editor');
  const event = { model: { uid: 'admin::user' }, params: { where: { id: owner.id } }, state: {} };
  await strapi.subscriber.beforeDelete(event);
  assert.deepEqual(event.state.magicMarkDeletedIds, ['editor']);
  await strapi.subscriber.afterDelete(event);
  assert.equal(
    strapi.table(SHARE).some((s) => s.targetId === 'editor'),
    false
  );
  await server.destroy({ strapi });
});
