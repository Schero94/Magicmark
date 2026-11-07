'use strict';

require('./helpers/register-ts.cjs');
const assert = require('node:assert/strict');
const test = require('node:test');

const lv = require('../admin/src/utils/listView.ts');

test('only Content Manager list views are recognised; the admin base URL is not part of the path (MM-F08)', () => {
  assert.deepEqual(lv.parseListViewPath('/content-manager/collection-types/api::article.article'), {
    kind: 'collection-types',
    uid: 'api::article.article',
    path: '/content-manager/collection-types/api::article.article',
  });
  assert.equal(
    lv.parseListViewPath('/admin/content-manager/collection-types/api::article.article'),
    null
  );
  assert.equal(
    lv.parseListViewPath('/content-manager/collection-types/api::article.article/abc'),
    null
  );
  assert.equal(lv.parseListViewPath('/\\evil.example'), null);
  assert.equal(lv.parseListViewPath(undefined), null);
});

test('saved query keeps view settings and drops page', () => {
  assert.deepEqual(
    lv.pickSavedQuery({
      page: '3',
      pageSize: '20',
      sort: 'title:ASC',
      filters: { $and: [] },
      _q: '',
      plugins: { i18n: { locale: 'fr' }, other: { x: 1 } },
      foo: 'bar',
    }),
    {
      filters: { $and: [] },
      sort: 'title:ASC',
      pageSize: '20',
      plugins: { i18n: { locale: 'fr' } },
    }
  );
});

test('opening a bookmark replaces the remembered Content Manager list settings (MM-F09)', () => {
  const store = new Map([
    [
      'STRAPI_LIST_VIEW_SETTINGS:api::article.article:uuid-1',
      JSON.stringify({ filters: { $and: [{ old: 1 }] } }),
    ],
    ['STRAPI_LIST_VIEW_SETTINGS:api::article.article', JSON.stringify({ sort: 'old:ASC' })],
    ['STRAPI_LIST_VIEW_SETTINGS:api::page.page:uuid-1', JSON.stringify({ sort: 'keep:ASC' })],
  ]);
  const storage = {
    get length() {
      return store.size;
    },
    key: (i) => [...store.keys()][i] ?? null,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
  lv.syncPersistedListSettings(storage, 'api::article.article', { sort: 'title:DESC', _q: 'x' });
  assert.equal(
    store.get('STRAPI_LIST_VIEW_SETTINGS:api::article.article:uuid-1'),
    JSON.stringify({ sort: 'title:DESC' })
  );
  assert.equal(
    store.get('STRAPI_LIST_VIEW_SETTINGS:api::article.article'),
    JSON.stringify({ sort: 'title:DESC' })
  );
  assert.equal(
    store.get('STRAPI_LIST_VIEW_SETTINGS:api::page.page:uuid-1'),
    JSON.stringify({ sort: 'keep:ASC' })
  );

  lv.syncPersistedListSettings(storage, 'api::article.article', {});
  assert.equal(store.has('STRAPI_LIST_VIEW_SETTINGS:api::article.article:uuid-1'), false);
  assert.equal(store.has('STRAPI_LIST_VIEW_SETTINGS:api::article.article'), false);
});

test('modal focus loop wraps Tab at both ends and leaves the middle to the browser (A11Y-FOCUS)', () => {
  const { loopTarget } = require('../admin/src/utils/focusLoop.ts');
  const nodes = ['name', 'icon', 'cancel', 'save'];
  assert.equal(loopTarget(nodes, 'save', false), 'name');
  assert.equal(loopTarget(nodes, 'name', true), 'save');
  assert.equal(loopTarget(nodes, 'icon', false), null);
  assert.equal(loopTarget(nodes, 'cancel', true), null);
  assert.equal(loopTarget(nodes, 'outside', false), 'name', 'focus outside comes back in');
  assert.equal(loopTarget(nodes, 'outside', true), 'save');
  assert.equal(loopTarget([], 'x', false), null);
});
