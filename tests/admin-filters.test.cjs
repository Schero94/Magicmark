'use strict';

require('./helpers/register-ts.cjs');
const assert = require('node:assert/strict');
const test = require('node:test');
const qs = require('qs');

const f = require('../admin/src/utils/filters.ts');
const { parseQuery, stringifyQuery } = require('../admin/src/utils/query.ts');
const { buildFieldOptions } = require('../admin/src/utils/fieldOptions.ts');

const fields = new Map(
  [
    { path: 'title', label: 'Title', type: 'string' },
    { path: 'views', label: 'Views', type: 'integer' },
    { path: 'status', label: 'Status', type: 'enumeration', enum: ['draft', 'live'] },
    { path: 'publishedOn', label: 'Published on', type: 'date' },
    { path: 'author.name', label: 'Author (name)', type: 'string' },
  ].map((field) => [field.path, field])
);

const row = (field, operator, value = '', valueTo) => ({
  id: f.nextRowId(),
  field,
  operator,
  value,
  valueTo,
});

/** Serialises filters like the admin's setQuery and parses them like its useQueryParams (qs depth 5). */
const roundTrip = (filters) =>
  qs.parse(qs.stringify({ filters }, { encode: false }).replace(/ /g, '%20')).filters;

test('"all" builds the native $and shape that Strapi filter tags read (MM-F06)', () => {
  const filters = f.buildFilters('all', [
    row('title', '$containsi', 'news'),
    row('author.name', '$eq', 'Ada'),
  ]);
  assert.deepEqual(filters, {
    $and: [{ title: { $containsi: 'news' } }, { author: { name: { $eq: 'Ada' } } }],
  });
  const parsed = roundTrip(filters);
  assert.ok(
    Array.isArray(parsed.$and),
    'query.filters.$and is an array after the admin parses the URL'
  );
  assert.deepEqual(parsed, filters);
});

test('removing one native tag keeps the other conditions', () => {
  const filters = f.buildFilters('all', [row('title', '$eq', 'a'), row('views', '$gt', '3')]);
  const parsed = roundTrip(filters);
  const afterNativeRemove = { $and: parsed.$and.filter((_, i) => i !== 0) };
  assert.deepEqual(
    f.parseFilters(afterNativeRemove).rows.map((r) => r.field),
    ['views']
  );
});

test('"any" builds a root $or and every operator stays within the admin qs depth', () => {
  for (const match of ['all', 'any']) {
    for (const [path, field] of fields) {
      for (const op of f.operatorsForType(field.type, path.includes('.'))) {
        const r = row(
          path,
          op,
          op === '$in' || op === '$notIn' ? 'a, b' : 'x',
          op === '$between' ? 'y' : undefined
        );
        const filters = f.buildFilters(match, [r]);
        assert.ok(f.fitsAdminQueryDepth(filters), `${match} ${path} ${op}`);
        assert.deepEqual(roundTrip(filters), filters, `${match} ${path} ${op} survives qs depth 5`);
      }
    }
  }
});

test('sub-fields never offer list or range operators (they would exceed depth 5)', () => {
  assert.ok(!f.operatorsForType('string', true).includes('$in'));
  assert.ok(!f.operatorsForType('integer', true).includes('$between'));
  assert.ok(f.operatorsForType('integer', false).includes('$between'));
});

test('parseFilters restores rows; unknown shapes are flagged instead of dropped silently', () => {
  const filters = f.buildFilters('any', [
    row('views', '$between', '1', '9'),
    row('status', '$in', 'draft, live'),
    row('title', '$null'),
  ]);
  const state = f.parseFilters(roundTrip(filters));
  assert.equal(state.match, 'any');
  assert.equal(state.unsupported, false);
  assert.deepEqual(
    state.rows.map((r) => [r.field, r.operator, r.value, r.valueTo]),
    [
      ['views', '$between', '1', '9'],
      ['status', '$in', 'draft, live', undefined],
      ['title', '$null', '', undefined],
    ]
  );
  assert.equal(f.parseFilters({ $and: [{ a: { b: { c: { $eq: '1' } } } }] }).unsupported, true);
  assert.equal(f.parseFilters({ title: { $eq: 'x' } }).unsupported, true);
  assert.equal(f.parseFilters(undefined).unsupported, false);
});

test('values with percent signs survive the URL round trip', () => {
  const value = '50% off + 100%/final';
  const filters = f.buildFilters('all', [row('title', '$eq', value)]);
  const encoded = qs.stringify(
    {
      filters: JSON.parse(JSON.stringify(filters), (k, v) =>
        typeof v === 'string' ? encodeURIComponent(v) : v
      ),
    },
    { encode: false }
  );
  assert.equal(f.parseFilters(qs.parse(encoded).filters).rows[0].value, value);
});

test('row validation reports the first missing part', () => {
  assert.equal(f.validateRow(row('', '$eq', 'x'), fields), 'field');
  assert.equal(f.validateRow(row('title', '$gt', 'x'), fields), 'operator');
  assert.equal(f.validateRow(row('title', '$eq', ' '), fields), 'value');
  assert.equal(f.validateRow(row('views', '$between', '1'), fields), 'valueTo');
  assert.equal(f.validateRow(row('status', '$in', ' , '), fields), 'value');
  assert.equal(f.validateRow(row('title', '$null'), fields), null);
});

test('saved queries are parsed without prototype pollution (SEC-03)', () => {
  const parsed = parseQuery(
    'filters[$__proto__][0][x][$eq]=1&filters[__proto__][polluted]=1&constructor[prototype][y]=1'
  );
  assert.equal({}.polluted, undefined);
  assert.equal({}.y, undefined);
  assert.equal(Object.getPrototypeOf(parsed), null);
  assert.equal(
    stringifyQuery({ filters: { $and: [{ title: { $eq: 'a&b' } }] } }),
    'filters[$and][0][title][$eq]=a%26b'
  );
});

test('countConditions counts top-level conditions', () => {
  assert.equal(f.countConditions(undefined), 0);
  assert.equal(f.countConditions({ $and: [{ a: 1 }, { b: 1 }] }), 2);
  assert.equal(f.countConditions({ $or: { 0: { a: 1 } }, title: { $eq: 'x' } }), 2);
});

test('filterable fields come from the Content Manager schema (no CTB access needed, MM-F04/F15)', () => {
  const init = {
    contentTypes: [
      {
        uid: 'api::article.article',
        attributes: {
          title: { type: 'string' },
          body: { type: 'richtext' },
          secret: { type: 'string', private: true },
          password: { type: 'password' },
          status: { type: 'enumeration', enum: ['draft', 'live'] },
          author: { type: 'relation', target: 'plugin::users-permissions.user' },
          owner: { type: 'relation', target: 'admin::user' },
          seo: { type: 'component', component: 'shared.seo', repeatable: false },
          blocks: { type: 'dynamiczone' },
          createdAt: { type: 'datetime' },
        },
      },
      { uid: 'plugin::users-permissions.user', attributes: { username: { type: 'string' } } },
    ],
    components: [
      {
        uid: 'shared.seo',
        attributes: { metaTitle: { type: 'string' }, image: { type: 'media' } },
      },
    ],
  };
  const metadatas = {
    title: { list: { label: 'Headline' } },
    author: { list: { label: 'Author', mainField: 'username' } },
  };
  const paths = buildFieldOptions('api::article.article', init, metadatas, null).map((x) => x.path);
  assert.deepEqual(paths, [
    'id',
    'documentId',
    'title',
    'status',
    'author.username',
    'author.id',
    'seo.metaTitle',
    'createdAt',
    'updatedAt',
  ]);
  const readable = buildFieldOptions('api::article.article', init, metadatas, ['title']).map(
    (x) => x.path
  );
  assert.deepEqual(readable, ['id', 'documentId', 'title', 'createdAt', 'updatedAt']);
});
