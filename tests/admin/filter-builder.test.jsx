/**
 * Filter builder (Advanced filters) in StrictMode: reading a URL filter with a group, the live
 * count request, the active filter chip, removing a condition with undo, and applying. Network
 * calls go to the harness fake (no server).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { act } from 'react';
import qs from 'qs';
import { checkStrictEntry, network, permission } from './harness/index.jsx';
import { ListViewActions } from '../../admin/src/components/ListViewActions';

const ARTICLE = 'api::article.article';
const LIST = `/content-manager/collection-types/${ARTICLE}`;
const ALL = ['read', 'create', 'update', 'share'].map((name) =>
  permission(`plugin::magic-mark.bookmarks.${name}`)
);

const routes = () => {
  network.on('GET', '/content-manager/init', {
    data: {
      contentTypes: [
        {
          uid: ARTICLE,
          isDisplayed: true,
          kind: 'collectionType',
          info: { displayName: 'Article', singularName: 'article', pluralName: 'articles' },
          options: { draftAndPublish: true },
          attributes: {
            title: { type: 'string' },
            views: { type: 'integer' },
            featured: { type: 'boolean' },
          },
        },
      ],
      components: [],
      fieldSizes: {},
    },
  });
  network.on('GET', `/content-manager/content-types/${ARTICLE}/configuration`, {
    data: {
      contentType: {
        uid: ARTICLE,
        metadatas: {
          title: { list: { label: 'Title' } },
          views: { list: { label: 'Views' } },
          featured: { list: { label: 'Featured' } },
        },
      },
      components: {},
    },
  });
  network.on('GET', LIST, { results: [], pagination: { page: 1, pageSize: 1, total: 3 } });
  network.on('GET', '/magic-mark/bookmarks', {
    data: [],
    meta: { pagination: { page: 1, pageSize: 10, pageCount: 0, total: 0 } },
  });
};

const wait = (ms) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));
const click = async (element) => {
  assert.ok(element, 'element to click exists');
  await act(async () => {
    element.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    element.click();
  });
  await wait(20);
};
const byLabel = (label) =>
  document.querySelector(`[aria-label="${label}"]`) ||
  [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === label) ||
  null;
const text = () => document.body.textContent;

const GROUPED = qs.stringify(
  {
    filters: {
      $and: [{ title: { $containsi: 'news' } }],
      $or: [{ views: { $gt: '100' } }, { featured: { $eq: 'true' } }],
    },
  },
  { encodeValuesOnly: true }
);

test('builder reads a grouped filter, counts once per change, and offers undo', async () => {
  routes();
  const result = await checkStrictEntry(<ListViewActions />, {
    path: `${LIST}?page=1&${GROUPED}`,
    permissions: ALL,
    async whileMounted() {
      // The chip describes the filter the native tags cannot show.
      const chip = [...document.querySelectorAll('button')].find((node) =>
        /Title contains news and \(Views is greater than 100 or Featured is Yes\)/.test(
          node.getAttribute('aria-label') ?? ''
        )
      );
      assert.ok(chip, 'active filter chip with the readable sentence');
      await click(chip);
      await wait(50);
      assert.match(text(), /Show entries that match/);
      assert.match(text(), /Any of these/);
      assert.match(text(), /At least one of these must match/);
      // "all" allows one group: the second group is disabled with the reason.
      assert.match(text(), /one “any of” group is possible/);
      await wait(500);
      assert.match(text(), /3 entries match\./);

      await click(byLabel('Remove condition 1'));
      assert.match(text(), /Condition removed\./);
      await wait(500);
      await click(byLabel('Undo'));
      assert.doesNotMatch(text(), /Condition removed\./);
      assert.ok(byLabel('Remove condition 3'), 'all three conditions are back');
      await wait(500);
    },
  });
  const counts = result.calls.filter((call) => call.pathname === LIST && !call.aborted);
  assert.ok(counts.length >= 1, 'the count used the Content Manager list endpoint');
  for (const call of counts) {
    const params = qs.parse(call.path.split('?')[1]);
    assert.equal(params.pageSize, '1');
    assert.deepEqual(params.filters.$or[0], { views: { $gt: '100' } });
  }
  // One request per filter change (initial, after remove, after undo): the StrictMode remount
  // and re-renders do not repeat a request for the same state.
  assert.equal(counts.length, 3, counts.map((call) => call.path).join('\n'));
  for (let i = 1; i < counts.length; i += 1) assert.notEqual(counts[i].path, counts[i - 1].path);
  assert.equal(result.calls.filter((call) => call.method !== 'GET').length, 0, 'no mutation');
});

test('empty builder: an example adds a ready condition and Apply writes the URL', async () => {
  routes();
  let handleRef;
  await checkStrictEntry(<ListViewActions />, {
    path: `${LIST}?page=1`,
    permissions: ALL,
    async whileMounted(handle) {
      handleRef = handle;
      await click(byLabel('Advanced filters'));
      await wait(50);
      await click(byLabel('Published entries'));
      const field = document.querySelector('[role="dialog"] input[role="combobox"]');
      assert.equal(field?.value, 'Status');
      await wait(500);
      assert.match(text(), /3 entries match\./);
      await click(byLabel('Apply'));
      await wait(50);
      const search = handle.router.state.location.search;
      assert.deepEqual(qs.parse(search.slice(1)).filters, {
        $and: [{ __status: { $eq: 'published' } }],
      });
    },
  });
  assert.ok(handleRef);
});
