'use strict';

/**
 * Strapi 5.62 filter changes (strapi/strapi#28172 and #28367):
 * - invalid boolean filter values (empty, "yes"/"no"/"on"/"off", padded, numbers other than
 *   0/1) now return 400, so saved bookmarks must only send "true"/"false";
 * - a date-only value on a datetime field means the whole local day in the Content Manager
 *   (`toApiFilters`), so the filter editor must keep it date-only.
 */
require('./helpers/register-ts.cjs');
const assert = require('node:assert/strict');
const test = require('node:test');

const f = require('../admin/src/utils/filters.ts');
const b = require('../admin/src/utils/booleanFilters.ts');
const { parseQuery, stringifyQuery } = require('../admin/src/utils/query.ts');

const init = {
  contentTypes: [
    {
      uid: 'api::article.article',
      attributes: {
        title: { type: 'string' },
        featured: { type: 'boolean' },
        publishedOn: { type: 'datetime' },
        author: {
          type: 'relation',
          relation: 'manyToOne',
          target: 'plugin::users-permissions.user',
        },
        seo: { type: 'component', component: 'shared.seo' },
      },
    },
    {
      uid: 'plugin::users-permissions.user',
      attributes: { username: { type: 'string' }, confirmed: { type: 'boolean' } },
    },
  ],
  components: [{ uid: 'shared.seo', attributes: { indexable: { type: 'boolean' } } }],
};
const resolve = b.createAttributeResolver(init, 'api::article.article');

const fields = new Map(
  [
    { path: 'title', label: 'Title', type: 'string' },
    { path: 'featured', label: 'Featured', type: 'boolean' },
    { path: 'publishedOn', label: 'Published on', type: 'datetime' },
  ].map((field) => [field.path, field])
);
const row = (field, operator, value = '', valueTo) => ({
  id: f.nextRowId(),
  field,
  operator,
  value,
  valueTo,
});

test('normalizeBooleanValue maps legacy values and rejects unreadable ones', () => {
  for (const v of ['true', 'TRUE', 't', '1', 'yes', 'On', ' true ', true, 1]) {
    assert.equal(b.normalizeBooleanValue(v), 'true', String(v));
  }
  for (const v of ['false', 'F', '0', 'no', 'off', false, 0]) {
    assert.equal(b.normalizeBooleanValue(v), 'false', String(v));
  }
  for (const v of ['', '  ', '2', 'maybe', null, undefined, {}, 2]) {
    assert.equal(b.normalizeBooleanValue(v), null, String(v));
  }
});

test('the attribute resolver follows relations and components', () => {
  assert.equal(resolve(['featured']).type, 'boolean');
  assert.equal(resolve(['author', 'confirmed']).type, 'boolean');
  assert.equal(resolve(['seo', 'indexable']).type, 'boolean');
  assert.equal(resolve(['title', 'x']), undefined);
  assert.equal(resolve(['missing']), undefined);
});

test('a saved bookmark with legacy boolean values is normalised before it is opened', () => {
  const saved = parseQuery(
    'filters[$and][0][featured][$eq]=1&filters[$and][1][author][confirmed][$ne]=no' +
      '&filters[$and][2][seo][indexable][$eq]=%20true%20&filters[$and][3][title][$eq]=1&sort=title:ASC'
  );
  const { filters, normalized, dropped } = b.sanitizeBooleanFilters(saved.filters, resolve);
  assert.deepEqual(filters, {
    $and: [
      { featured: { $eq: 'true' } },
      { author: { confirmed: { $ne: 'false' } } },
      { seo: { indexable: { $eq: 'true' } } },
      // Not a boolean field: "1" stays.
      { title: { $eq: '1' } },
    ],
  });
  assert.equal(normalized, 3);
  assert.equal(dropped, 0);
});

test('boolean conditions with an empty or unreadable value are dropped, not sent', () => {
  const saved = parseQuery(
    'filters[$and][0][featured][$eq]=&filters[$and][1][title][$eq]=a&filters[$or][0][featured][$ne]=maybe'
  );
  const { filters, dropped } = b.sanitizeBooleanFilters(saved.filters, resolve);
  assert.deepEqual(filters, { $and: [{ title: { $eq: 'a' } }] });
  assert.equal(dropped, 2);

  const only = b.sanitizeBooleanFilters({ $and: [{ featured: { $eq: 'yes please' } }] }, resolve);
  assert.equal(only.filters, undefined, 'nothing left: the filters key is removed');
});

test('valid boolean filters, $null and the shorthand form are left as Strapi 5.62 accepts them', () => {
  const valid = {
    $and: [
      { featured: { $eq: 'true' } },
      { featured: { $ne: 'false' } },
      { featured: { $null: 'true' } },
      { featured: { $notNull: 'true' } },
    ],
  };
  const result = b.sanitizeBooleanFilters(valid, resolve);
  assert.deepEqual(result.filters, valid);
  assert.equal(result.normalized + result.dropped, 0);

  assert.deepEqual(b.sanitizeBooleanFilters({ featured: 'YES' }, resolve).filters, {
    featured: 'true',
  });
});

test('normalizeSavedQuery keeps the query object when nothing changes', () => {
  const { normalizeSavedQuery } = loadOpenBookmark();
  const clean = parseQuery('filters[$and][0][featured][$eq]=true&page=1');
  assert.equal(normalizeSavedQuery(clean, init, 'api::article.article'), clean);

  const legacy = parseQuery('filters[$and][0][featured][$eq]=0&page=1');
  const fixed = normalizeSavedQuery(legacy, init, 'api::article.article');
  assert.equal(
    decodeURIComponent(stringifyQuery(fixed)),
    'filters[$and][0][featured][$eq]=false&page=1'
  );

  const empty = normalizeSavedQuery(
    parseQuery('filters[$and][0][featured][$eq]=&page=1'),
    init,
    'api::article.article'
  );
  assert.equal(stringifyQuery(empty), 'page=1');
});

test('the filter editor only accepts true/false for boolean rows', () => {
  assert.equal(f.validateRow(row('featured', '$eq', 'true'), fields), null);
  assert.equal(f.validateRow(row('featured', '$ne', 'false'), fields), null);
  assert.equal(f.validateRow(row('featured', '$null'), fields), null);
  for (const value of ['', '1', 'yes', ' true']) {
    assert.equal(f.validateRow(row('featured', '$eq', value), fields), 'value', value);
  }
});

test('a date-only datetime filter round-trips unchanged (whole day in Strapi 5.62)', () => {
  const stored = { $and: [{ publishedOn: { $eq: '2026-11-15' } }] };
  const { rows } = f.parseFilters(stored);
  const edited = rows.map((r) => ({ ...r, value: f.datetimeToInput(r.value) }));
  assert.equal(edited[0].value, '2026-11-15', 'the editor shows the date, not an instant');
  const applied = edited.map((r) => ({ ...r, value: f.inputToDatetime(r.value) }));
  assert.deepEqual(f.buildFilters('all', applied), stored);
});

test('a date-time filter is stored as an ISO instant and reads back as the same minute', () => {
  const iso = f.inputToDatetime('2026-11-15T10:30');
  assert.match(iso, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
  assert.equal(new Date(iso).getTime(), new Date('2026-11-15T10:30').getTime());
  assert.equal(f.datetimeToInput(iso), '2026-11-15T10:30');
  // Unreadable values are left for validation, not silently changed.
  assert.equal(f.inputToDatetime('not a date'), 'not a date');
  assert.equal(f.inputToDatetime(''), '');
  assert.equal(f.isDateOnly('2026-11-15'), true);
  assert.equal(f.isDateOnly('2026-11-15T00:00'), false);
});

/** Loads `normalizeSavedQuery` with the admin runtime imports stubbed. */
function loadOpenBookmark() {
  const Module = require('node:module');
  const original = Module._load;
  const stubs = {
    '@strapi/strapi/admin': { useFetchClient: () => ({}), useNotification: () => ({}) },
    'react-router-dom': { useNavigate: () => () => {} },
    'react-intl': { useIntl: () => ({}) },
  };
  Module._load = function load(request, ...rest) {
    if (stubs[request]) return stubs[request];
    return original.call(this, request, ...rest);
  };
  try {
    return require('../admin/src/hooks/useOpenBookmark.ts');
  } finally {
    Module._load = original;
  }
}
