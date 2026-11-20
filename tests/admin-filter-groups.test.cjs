'use strict';

/**
 * AND / OR filters with one level of groups: model <-> URL round trips, the admin's qs limits,
 * and lossless reading of bookmark queries saved by earlier versions (fixtures in
 * tests/fixtures/legacy-bookmark-queries.json). "Lossless" is checked by meaning: the original
 * filters and the rebuilt ones must select the same records of a synthetic data set, evaluated
 * with Strapi's filter semantics (root keys and entry fields are combined with AND).
 */
require('./helpers/register-ts.cjs');
const assert = require('node:assert/strict');
const test = require('node:test');
const qs = require('qs');

const f = require('../admin/src/utils/filters.ts');
const { parseQuery, stringifyQuery } = require('../admin/src/utils/query.ts');
const fixtures = require('./fixtures/legacy-bookmark-queries.json');

/** The admin's own parse of the list view URL (`useQueryParams`: qs defaults, depth 5). */
const adminParse = (query) => qs.parse(query);
/** What the editor writes: values encoded like `deepEncodeQueryValues`, then `setQuery`. */
const writeUrl = (filters) =>
  qs.stringify(
    {
      filters: JSON.parse(JSON.stringify(filters), (k, v) =>
        typeof v === 'string' ? encodeURIComponent(v) : v
      ),
    },
    { encode: false }
  );
/** `strapi::query` middleware options (Strapi 5.63). */
const STRAPI_QUERY = { strictNullHandling: true, arrayLimit: 100, depth: 20 };

const records = [
  {
    id: 1,
    title: 'A01 Spring news',
    category: 'news',
    views: 120,
    featured: true,
    publishOn: '2026-03-01',
    author: { id: 1, name: 'Anna Beispiel' },
    seo: { noIndex: false },
    status: 'published',
  },
  {
    id: 2,
    title: 'A02 Setup guide',
    category: 'guide',
    views: 40,
    featured: false,
    publishOn: '2026-04-12',
    author: { id: 2, name: 'Ben Muster' },
    seo: { noIndex: true },
    status: 'published',
  },
  {
    id: 3,
    title: 'A03 Camera review',
    category: 'review',
    views: 300,
    featured: true,
    publishOn: '2026-05-20',
    author: { id: 3, name: 'Carla Probe' },
    seo: { noIndex: false },
    status: 'draft',
  },
  {
    id: 4,
    title: 'A04 Opinion on tea',
    category: 'opinion',
    views: 5,
    featured: false,
    publishOn: '2026-06-02',
    author: { id: 1, name: 'Anna Beispiel' },
    seo: { noIndex: true },
    status: 'draft',
  },
  {
    id: 5,
    title: 'A05 Summer news',
    category: 'news',
    views: 80,
    featured: false,
    publishOn: '2026-07-15',
    author: { id: 2, name: 'Ben Muster' },
    seo: { noIndex: true },
    status: 'published',
  },
  {
    id: 6,
    title: 'A06 Advanced guide',
    category: 'guide',
    views: 210,
    featured: true,
    publishOn: '2026-08-08',
    author: { id: 3, name: 'Carla Probe' },
    seo: { noIndex: false },
    status: 'published',
  },
  {
    id: 7,
    title: 'A07 50% off & more',
    category: 'review',
    views: 15,
    featured: false,
    publishOn: null,
    author: null,
    seo: { noIndex: true },
    status: 'draft',
  },
];

/** Strapi filter semantics, enough for the operators the editor writes. */
const evaluate = (filters, record) => {
  const ops = {
    $eq: (a, b) => String(a) === String(b),
    $ne: (a, b) => String(a) !== String(b),
    $eqi: (a, b) => String(a).toLowerCase() === String(b).toLowerCase(),
    $gt: (a, b) => a !== null && Number(a) > Number(b),
    $gte: (a, b) => a !== null && Number(a) >= Number(b),
    $lt: (a, b) => a !== null && Number(a) < Number(b),
    $lte: (a, b) => a !== null && Number(a) <= Number(b),
    $in: (a, b) => [].concat(b).map(String).includes(String(a)),
    $notIn: (a, b) => ![].concat(b).map(String).includes(String(a)),
    $between: (a, [x, y]) => a !== null && Number(a) >= Number(x) && Number(a) <= Number(y),
    $contains: (a, b) => a !== null && String(a).includes(b),
    $containsi: (a, b) => a !== null && String(a).toLowerCase().includes(String(b).toLowerCase()),
    $null: (a) => a === null || a === undefined,
    $notNull: (a) => a !== null && a !== undefined,
  };
  const field = (node, value) => {
    if (node === null || typeof node !== 'object') return ops.$eq(value, node);
    return Object.entries(node).every(([key, inner]) => {
      if (key.startsWith('$')) {
        assert.ok(ops[key], `evaluator knows ${key}`);
        return ops[key](value, inner);
      }
      return field(inner, value ? value[key] : null);
    });
  };
  const node = (n) =>
    Object.entries(n).every(([key, value]) => {
      const list = Array.isArray(value)
        ? value
        : value && typeof value === 'object'
          ? Object.values(value)
          : [];
      if (key === '$and') return list.every(node);
      if (key === '$or') return list.some(node);
      if (key === '__status') return field(value, record.status);
      return field(value, record[key]);
    });
  return filters ? node(filters) : true;
};
const select = (filters) => records.filter((r) => evaluate(filters, r)).map((r) => r.id);

const row = (field, operator, value = '', valueTo) => ({
  id: f.nextRowId(),
  field,
  operator,
  value,
  valueTo,
});
const group = (...conditions) => ({ id: f.nextGroupId(), kind: 'group', conditions });
const fields = new Map(
  [
    { path: 'title', type: 'string' },
    { path: 'category', type: 'enumeration', enum: ['news', 'guide', 'review', 'opinion'] },
    { path: 'views', type: 'integer' },
    { path: 'featured', type: 'boolean' },
    { path: 'publishOn', type: 'date' },
    { path: 'author.name', type: 'string' },
    { path: 'seo.noIndex', type: 'boolean' },
    { path: 'id', type: 'integer' },
    { path: f.STATUS_FIELD, type: f.STATUS_TYPE },
  ].map((x) => [x.path, { label: x.path, ...x }])
);

test('all of (A, any of (B, C)) uses $and next to $or and stays within depth 5', () => {
  const tree = {
    match: 'all',
    items: [
      row('category', '$eq', 'news'),
      group(row('views', '$gt', '100'), row('author.name', '$eq', 'Ben Muster')),
    ],
  };
  assert.equal(f.validateTree(tree, fields).valid, true);
  const filters = f.buildFilterTree(tree);
  assert.deepEqual(filters, {
    $and: [{ category: { $eq: 'news' } }],
    $or: [{ views: { $gt: '100' } }, { author: { name: { $eq: 'Ben Muster' } } }],
  });
  assert.equal(f.filterDepth(filters), 5);
  assert.deepEqual(select(filters), [1, 5]);
  // Admin parse keeps it intact; the Content Manager's native tags read $and only.
  assert.deepEqual(adminParse(writeUrl(filters)).filters, filters);
});

test('any of (A, all of (B, C)) merges the group into one $or entry', () => {
  const tree = {
    match: 'any',
    items: [
      row('category', '$eq', 'opinion'),
      group(
        row('featured', '$eq', 'true'),
        row('views', '$gte', '200'),
        row('author.name', '$eq', 'Carla Probe')
      ),
    ],
  };
  const filters = f.buildFilterTree(tree);
  assert.deepEqual(filters, {
    $or: [
      { category: { $eq: 'opinion' } },
      {
        featured: { $eq: 'true' },
        views: { $gte: '200' },
        author: { name: { $eq: 'Carla Probe' } },
      },
    ],
  });
  assert.ok(f.fitsAdminQueryDepth(filters));
  assert.deepEqual(select(filters), [3, 4, 6]);
});

test('a nested logical operator would exceed the admin qs depth (why groups use implicit AND)', () => {
  const nested = { $and: [{ $or: [{ title: { $eq: 'x' } }] }] };
  assert.equal(f.fitsAdminQueryDepth(nested), false);
  assert.deepEqual(adminParse(writeUrl(nested)).filters.$and[0].$or[0], {
    title: { '[$eq]': 'x' },
  });
});

test('model -> URL -> model round trip for every supported shape', () => {
  const trees = [
    {
      match: 'all',
      items: [row('title', '$containsi', 'news'), row('views', '$between', '10', '100')],
    },
    { match: 'any', items: [row('category', '$in', 'news, guide'), row('publishOn', '$null')] },
    {
      match: 'all',
      items: [
        row(f.STATUS_FIELD, '$eq', 'draft'),
        row('views', '$lt', '50'),
        group(row('category', '$eq', 'review'), row('seo.noIndex', '$eq', 'true')),
      ],
    },
    {
      match: 'any',
      items: [
        group(row('views', '$gt', '10'), row('views', '$lt', '100')),
        group(row('category', '$notIn', 'news'), row('featured', '$eq', 'false')),
      ],
    },
  ];
  const strip = (tree) => ({
    match: tree.match,
    items: tree.items.map((item) =>
      f.isGroup(item)
        ? item.conditions.map((r) => [r.field, r.operator, r.value, r.valueTo])
        : [item.field, item.operator, item.value, item.valueTo]
    ),
  });
  for (const tree of trees) {
    assert.equal(f.validateTree(tree, fields).valid, true, JSON.stringify(strip(tree)));
    const filters = f.buildFilterTree(tree);
    const back = f.parseFilterTree(adminParse(writeUrl(filters)).filters);
    assert.equal(back.unsupported, false);
    assert.deepEqual(strip(back), strip(tree));
    // Strapi parses the same URL into the same object.
    assert.deepEqual(qs.parse(writeUrl(filters), STRAPI_QUERY).filters, filters);
  }
});

test('status alone next to a group gets an always-true companion and reads back without it', () => {
  const tree = {
    match: 'all',
    items: [
      row(f.STATUS_FIELD, '$eq', 'draft'),
      group(row('category', '$eq', 'news'), row('category', '$eq', 'review')),
    ],
  };
  const filters = f.buildFilterTree(tree);
  assert.deepEqual(filters.$and, [{ __status: { $eq: 'draft' } }, { id: { $notNull: 'true' } }]);
  const back = f.parseFilterTree(adminParse(writeUrl(filters)).filters);
  assert.equal(back.items.length, 2);
  assert.equal(back.items[0].field, f.STATUS_FIELD);
  assert.ok(f.isGroup(back.items[1]));
  assert.deepEqual(select(filters), [3, 7]);
});

test('validation: status only at the top of "all", one group in "all", no repeated pair in an "all" group', () => {
  const status = row(f.STATUS_FIELD, '$eq', 'published');
  assert.equal(
    f.validateTree({ match: 'any', items: [status] }, fields).conditions.get(status.id),
    'statusPlacement'
  );
  const inGroup = row(f.STATUS_FIELD, '$eq', 'published');
  assert.equal(
    f.validateTree({ match: 'all', items: [group(inGroup)] }, fields).conditions.get(inGroup.id),
    'statusPlacement'
  );
  assert.equal(
    f.validateTree(
      { match: 'all', items: [group(row('views', '$gt', '1')), group(row('views', '$lt', '9'))] },
      fields
    ).tooManyGroups,
    true
  );
  assert.equal(
    f.validateTree(
      { match: 'any', items: [group(row('views', '$gt', '1')), group(row('views', '$lt', '9'))] },
      fields
    ).valid,
    true
  );
  const dup = row('title', '$containsi', 'b');
  const v = f.validateTree(
    { match: 'any', items: [group(row('title', '$containsi', 'a'), dup)] },
    fields
  );
  assert.equal(v.conditions.get(dup.id), 'duplicateInGroup');
  // The same pair is fine in an "any" group (separate $or entries).
  assert.equal(
    f.validateTree(
      {
        match: 'all',
        items: [group(row('title', '$containsi', 'a'), row('title', '$containsi', 'b'))],
      },
      fields
    ).valid,
    true
  );
  assert.equal(f.validateRow(row(f.STATUS_FIELD, '$eq', 'archived'), fields), 'value');
});

test('limits: 20 top-level conditions for "all", 100 entries for "any", 20 per group', () => {
  const many = (n, op = '$eq') => Array.from({ length: n }, (_, i) => row('views', op, String(i)));
  assert.equal(f.validateTree({ match: 'all', items: many(20) }, fields).tooManyItems, false);
  assert.equal(f.validateTree({ match: 'all', items: many(21) }, fields).tooManyItems, true);
  assert.equal(f.validateTree({ match: 'any', items: many(100) }, fields).tooManyItems, false);
  assert.equal(f.validateTree({ match: 'any', items: many(101) }, fields).tooManyItems, true);
  const big = group(...many(21));
  assert.ok(f.validateTree({ match: 'all', items: [big] }, fields).tooLargeGroups.has(big.id));
  // 20 $and conditions plus a 20-condition group stay lists in the admin's parse.
  const filters = f.buildFilterTree({
    match: 'all',
    items: [...many(20), group(...many(20, '$gt'))],
  });
  const parsed = adminParse(writeUrl(filters)).filters;
  assert.ok(Array.isArray(parsed.$and) && Array.isArray(parsed.$or));
  assert.equal(f.exceedsListLimit({ filters: parsed }), false);
});

test('legacy bookmark queries open in the editor and rebuild to the same result set', () => {
  for (const { name, query } of fixtures.supported) {
    for (const parse of [parseQuery, adminParse]) {
      const original = parse(query).filters;
      const tree = f.parseFilterTree(original);
      assert.equal(tree.unsupported, false, `${name}: supported`);
      assert.ok(f.treeConditions(tree).length > 0, `${name}: has conditions`);
      assert.equal(f.validateTree(tree, fields).valid, true, `${name}: valid in the editor`);
      const rebuilt = f.buildFilterTree(tree);
      assert.deepEqual(select(rebuilt), select(original), `${name}: same records`);
      assert.ok(f.fitsAdminQueryDepth(rebuilt), `${name}: fits depth 5`);
      // Saving the rebuilt view keeps it identical on the next read.
      const again = f.buildFilterTree(
        f.parseFilterTree(parseQuery(stringifyQuery({ filters: rebuilt })).filters)
      );
      assert.deepEqual(again, rebuilt, `${name}: stable`);
    }
  }
});

test('legacy shapes the editor cannot show are flagged, never silently dropped', () => {
  for (const { name, query } of fixtures.unsupported) {
    assert.equal(f.parseFilterTree(parseQuery(query).filters).unsupported, true, name);
  }
  assert.equal(
    f.parseFilterTree({ $or: [{ title: { $null: 'false' } }] }).unsupported,
    true,
    'is null: false'
  );
  assert.equal(f.parseFilterTree('x').unsupported, true);
  assert.deepEqual(f.parseFilterTree(undefined), { match: 'all', items: [], unsupported: false });
});

test('an $or list longer than the admin arrayLimit (index-keyed object) is read in order', () => {
  const items = Array.from({ length: 25 }, (_, i) => row('views', '$eq', String(i)));
  const filters = f.buildFilterTree({ match: 'any', items });
  const parsed = adminParse(writeUrl(filters)).filters;
  assert.ok(!Array.isArray(parsed.$or));
  const back = f.parseFilterTree(parsed);
  assert.deepEqual(
    back.items.map((r) => r.value),
    items.map((r) => r.value)
  );
});
