'use strict';

require('./helpers/register-ts.cjs');
const assert = require('node:assert/strict');
const test = require('node:test');
const qs = require('qs');

const v = require('../server/src/validation.ts');

const PATH = '/content-manager/collection-types/api::article.article';

test('list view paths: only Content Manager list views, 3.x relative paths are normalised (SEC-02)', () => {
  assert.deepEqual(v.normalizeListViewPath(PATH), {
    path: PATH,
    contentType: 'api::article.article',
  });
  assert.deepEqual(
    v.normalizeListViewPath('content-manager/collection-types/plugin::users-permissions.user'),
    {
      path: '/content-manager/collection-types/plugin::users-permissions.user',
      contentType: 'plugin::users-permissions.user',
    }
  );
  for (const bad of [
    '/\\evil.example',
    '//evil.example/content-manager/collection-types/api::a.a',
    'https://evil.example',
    '/settings/users',
    '/content-manager/collection-types/api::article.article/abc123',
    '/content-manager/collection-types/admin::user',
    `${PATH}?x=1`,
    `${PATH}#x`,
    42,
    null,
  ]) {
    assert.equal(v.normalizeListViewPath(bad), null, String(bad));
  }
});

test('saved queries keep filters, sort, pageSize, _q and locale and drop page and unknown keys (MM-F08)', () => {
  const out = v.normalizeListViewQuery(
    '?page=4&pageSize=50&sort=title:ASC&_q=hello&plugins[i18n][locale]=de&foo=bar&filters[$and][0][title][$contains]=50%25%20off'
  );
  const parsed = qs.parse(out);
  assert.equal(parsed.page, undefined);
  assert.equal(parsed.foo, undefined);
  assert.equal(parsed.pageSize, '50');
  assert.equal(parsed.sort, 'title:ASC');
  assert.equal(parsed._q, 'hello');
  assert.deepEqual(parsed.plugins, { i18n: { locale: 'de' } });
  assert.deepEqual(parsed.filters, { $and: [{ title: { $contains: '50% off' } }] });
  assert.equal(v.normalizeListViewQuery(''), '');
  assert.equal(v.normalizeListViewQuery(undefined), '');
});

test('unsafe queries are rejected: prototype keys, backslashes, fragments, oversize (SEC-03)', () => {
  const before = Object.keys(Object.prototype).length;
  // qs (allowPrototypes: false) drops prototype keys entirely; nothing is stored or polluted.
  assert.equal(v.normalizeListViewQuery('filters[__proto__][polluted]=1'), '');
  for (const bad of [
    'filters[$and][0][constructor][prototype][x]=1',
    'filters=plain',
    'sort=title;DROP',
    'pageSize=1000',
    'a=1#frag',
    'a=\\b',
    `filters[$and][0][title][$eq]=${'x'.repeat(9000)}`,
    'plugins[i18n][locale]=../../x',
  ]) {
    assert.equal(v.normalizeListViewQuery(bad), null, bad);
  }
  assert.equal(Object.keys(Object.prototype).length, before);
  assert.equal({}.polluted, undefined);
});

test('create schema is strict, bounded and trims the name (MM-F10, SEC-06)', () => {
  const ok = v.parse(v.createBookmarkSchema, {
    name: '  Drafts ',
    path: PATH,
    query: 'sort=title:ASC',
  });
  assert.equal(ok.name, 'Drafts');
  assert.deepEqual(ok.path, { path: PATH, contentType: 'api::article.article' });

  const invalid = [
    {},
    { name: '', path: PATH },
    { name: 'x'.repeat(101), path: PATH },
    { name: 'x', path: '/admin/settings' },
    { name: 'x', path: PATH, isPinned: true },
    { name: 'x', path: PATH, order: 3 },
    { name: 'x', path: PATH, icon: '<script>' },
    { name: 'x', path: PATH, description: 'x'.repeat(501) },
    { name: 'x', path: PATH, users: Array.from({ length: 201 }, (_, i) => `u${i}`) },
    { name: 'x', path: PATH, users: ['NOT-A-DOC-ID'] },
    { name: 42, path: PATH },
  ];
  for (const body of invalid) {
    assert.throws(
      () => v.parse(v.createBookmarkSchema, body),
      (error) => {
        assert.equal(error.name, 'ValidationError');
        assert.ok(error.details && 'fieldErrors' in error.details);
        return true;
      },
      JSON.stringify(body).slice(0, 80)
    );
  }
});

test('share target lists are de-duplicated', () => {
  const parsed = v.parse(v.updateBookmarkSchema, { users: ['abc', 'abc', 'def'] });
  assert.deepEqual(parsed.users, ['abc', 'def']);
});

test('list query schema bounds page size and rejects unknown params', () => {
  assert.deepEqual(v.parse(v.listQuerySchema, { page: '2', pageSize: '10', scope: 'mine' }), {
    page: 2,
    pageSize: 10,
    scope: 'mine',
  });
  assert.throws(() => v.parse(v.listQuerySchema, { pageSize: '1000' }), {
    name: 'ValidationError',
  });
  assert.throws(() => v.parse(v.listQuerySchema, { filters: { a: 1 } }), {
    name: 'ValidationError',
  });
  assert.throws(() => v.parse(v.idParamSchema, { id: '../x' }), { name: 'ValidationError' });
});

test('a search text up to 1000 characters can be saved, like a filter value (MM-RA-3)', () => {
  const long = 'a'.repeat(1000);
  assert.equal(qs.parse(v.normalizeListViewQuery(`_q=${long}`))._q, long);
  assert.equal(v.normalizeListViewQuery(`_q=${long}a`), null);
});
