'use strict';

/**
 * Strapi 5.63 list limit: the `strapi::query` middleware parses the query string with qs
 * `arrayLimit: 100`. A longer list (more than 100 `$in` / `$notIn` values or `$and` / `$or`
 * conditions) arrives as an object keyed by index, and from 5.63 `@strapi/utils` answers it with
 * 400 ("the list has more items than the query parser's arrayLimit"). The filter editor caps
 * both at 100, and a stored bookmark over the limit is not opened.
 *
 * The admin parses the URL with qs defaults (arrayLimit 20): a root `$and` with more than 20
 * conditions becomes an object and the Content Manager list view (`Filters`, `$and.reduce`)
 * fails to render, so match "all" is capped at 20 conditions.
 */
require('./helpers/register-ts.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const qs = require('qs');

const f = require('../admin/src/utils/filters.ts');
const { parseQuery, stringifyQuery } = require('../admin/src/utils/query.ts');

/** The options of Strapi's `strapi::query` middleware (`@strapi/core` 5.63.0 `middlewares/query`). */
const STRAPI_QUERY = { strictNullHandling: true, arrayLimit: 100, depth: 20 };

const fields = new Map(
  [
    { path: 'title', label: 'Title', type: 'string' },
    { path: 'views', label: 'Views', type: 'integer' },
  ].map((field) => [field.path, field])
);
const values = (n) => Array.from({ length: n }, (_, i) => `v${i}`);
const row = (field, operator, value = '') => ({ id: f.nextRowId(), field, operator, value });
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('the limit is the arrayLimit of the strapi::query middleware', () => {
  assert.equal(f.MAX_LIST_ITEMS, 100);
  const at = qs.parse(stringifyQuery({ filters: { title: { $in: values(100) } } }), STRAPI_QUERY);
  assert.ok(Array.isArray(at.filters.title.$in), '100 values stay a list');
  const over = qs.parse(stringifyQuery({ filters: { title: { $in: values(101) } } }), STRAPI_QUERY);
  assert.ok(!Array.isArray(over.filters.title.$in), '101 values become an object (400 on 5.63)');
});

test('$in / $notIn rows accept up to 100 values and reject more', () => {
  for (const operator of ['$in', '$notIn']) {
    const ok = row('title', operator, values(100).join(', '));
    assert.equal(f.validateRow(ok, fields), null, `${operator} 100`);
    assert.equal(f.hasTooManyValues(ok), false);
    const tooMany = row('title', operator, values(101).join(', '));
    assert.equal(f.validateRow(tooMany, fields), 'value', `${operator} 101`);
    assert.equal(f.hasTooManyValues(tooMany), true);
  }
  // Empty items do not count: "a,,b" is two values.
  assert.equal(f.hasTooManyValues(row('title', '$in', `${values(100).join(',')},,,`)), false);
  // Other operators never count list items.
  assert.equal(f.hasTooManyValues(row('title', '$eq', values(101).join(', '))), false);
});

test('exceedsListLimit finds long lists in a parsed bookmark query', () => {
  const stored = (filters) => parseQuery(stringifyQuery({ page: '1', filters }));
  assert.equal(f.exceedsListLimit(stored({ $and: [{ title: { $in: values(100) } }] })), false);
  assert.equal(f.exceedsListLimit(stored({ $and: [{ title: { $in: values(101) } }] })), true);
  assert.equal(f.exceedsListLimit(stored({ $and: [{ title: { $notIn: values(150) } }] })), true);

  const rows = (n) => Array.from({ length: n }, (_, i) => ({ views: { $eq: String(i) } }));
  assert.equal(f.exceedsListLimit(stored({ $or: rows(100) })), false, '$or 100');
  assert.equal(f.exceedsListLimit(stored({ $or: rows(101) })), true, '$or 101');
  assert.equal(f.exceedsListLimit(stored({ $and: rows(20) })), false, '$and 20');
  assert.equal(f.exceedsListLimit(stored({ $and: rows(21) })), true, '$and 21');
  // The admin's own parse (qs defaults) turns 21 $and conditions into an index-keyed object.
  const adminParsed = qs.parse(stringifyQuery({ filters: { $and: rows(21) } }));
  assert.ok(!Array.isArray(adminParsed.filters.$and));
  assert.equal(f.exceedsListLimit(adminParsed), true);
  // A plain array (not parsed) longer than the limit counts too.
  assert.equal(f.exceedsListLimit({ filters: { $or: rows(101) } }), true);
  // Ordinary queries and values are untouched.
  assert.equal(f.exceedsListLimit(parseQuery('page=1&pageSize=10&sort=title:ASC')), false);
  assert.equal(f.exceedsListLimit({}), false);
  assert.equal(f.exceedsListLimit(null), false);
  assert.equal(f.exceedsListLimit('x'.repeat(500)), false);
});

test('buildFilters output within the limits stays a list for Strapi', () => {
  const filters = f.buildFilters(
    'any',
    Array.from({ length: 100 }, (_, i) => row('views', '$eq', String(i)))
  );
  const parsed = qs.parse(stringifyQuery({ filters }), STRAPI_QUERY);
  assert.ok(Array.isArray(parsed.filters.$or));
  assert.equal(parsed.filters.$or.length, 100);
  assert.equal(f.exceedsListLimit(parseQuery(stringifyQuery({ filters }))), false);
});

test('match "all" allows 20 conditions, "any" 100', () => {
  assert.equal(f.MAX_ALL_CONDITIONS, 20);
  assert.equal(f.maxConditions('all'), 20);
  assert.equal(f.maxConditions('any'), 100);
  const parsed = qs.parse(
    stringifyQuery({
      filters: { $and: Array.from({ length: 20 }, (_, i) => ({ views: { $eq: String(i) } })) },
    })
  );
  assert.ok(Array.isArray(parsed.filters.$and), '20 stay a list in the admin parse');
});

test('the editor caps conditions and the opener checks the limit before navigating', () => {
  const modal = read('admin/src/components/AdvancedFiltersModal.tsx');
  assert.match(modal, /maxConditions\(match\)/);
  assert.match(modal, /activeRows\.length > rowLimit/);
  assert.match(modal, /rows\.length >= rowLimit/);
  assert.match(modal, /disabled=\{atRowLimit\}/);
  assert.match(modal, /hasTooManyValues\(row\)/);

  const opener = read('admin/src/hooks/useOpenBookmark.ts');
  const check = opener.indexOf('exceedsListLimit(parsed)');
  assert.ok(check > 0, 'useOpenBookmark checks the list limit');
  assert.ok(check < opener.indexOf('navigate({'), 'the check runs before navigating');
  assert.match(opener.slice(check, opener.indexOf('navigate({')), /notification\.listTooLong/);
});
