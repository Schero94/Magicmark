/**
 * StrictMode checks of every Magic Mark admin entry point (menu page, homepage widget, Content
 * Manager list view injection) and the dialogs they open. See harness/index.jsx for what each
 * assertion counts.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { act } from 'react';
import { checkStrictEntry, network, permission } from './harness/index.jsx';
import App from '../../admin/src/pages/App';
import PinnedBookmarksWidget from '../../admin/src/widgets/PinnedBookmarksWidget';
import { ListViewActions } from '../../admin/src/components/ListViewActions';
import { BookmarkFormModal } from '../../admin/src/components/BookmarkFormModal';

const ALL = ['read', 'create', 'update', 'delete', 'share', 'manage'].map((name) =>
  permission(`plugin::magic-mark.bookmarks.${name}`)
);
const ARTICLE = 'api::article.article';

const bookmark = (overrides = {}) => ({
  documentId: 'bm-1',
  name: 'Drafts',
  description: '',
  icon: 'bookmark',
  path: `/content-manager/collection-types/${ARTICLE}`,
  contentType: ARTICLE,
  query: 'filters[$and][0][title][$contains]=draft',
  visibility: 'private',
  owner: { name: 'Ada Example', isDeleted: false },
  isOwner: true,
  isPinned: true,
  canEdit: true,
  sharing: { roles: [], users: [] },
  ...overrides,
});

const list = (items) => ({
  data: items,
  meta: {
    pagination: { page: 1, pageSize: 10, pageCount: items.length ? 1 : 0, total: items.length },
    permissions: { canShare: true, canManage: true },
  },
});

/** Content Manager schema routes the plugin reads (synthetic article type). */
const contentManagerRoutes = () => {
  network.on('GET', '/content-manager/init', {
    data: {
      contentTypes: [
        {
          uid: ARTICLE,
          isDisplayed: true,
          kind: 'collectionType',
          info: { displayName: 'Article', singularName: 'article', pluralName: 'articles' },
          attributes: { title: { type: 'string' }, published: { type: 'boolean' } },
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
          title: { list: { label: 'Title', searchable: true, sortable: true } },
          published: { list: { label: 'Published', searchable: true, sortable: true } },
        },
      },
      components: {},
    },
  });
};

/**
 * Clicks an element inside `act` (Design System buttons and Radix triggers handle `click`;
 * Radix menus also need pointerdown).
 * @param {Element | null} element - Element.
 */
const click = async (element) => {
  assert.ok(element, 'element to click exists');
  await act(async () => {
    element.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    element.click();
  });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
};

/**
 * Finds a button by its accessible label or text anywhere in the document (dialogs and popovers
 * render in portals).
 * @param {string} label - Label or text.
 * @returns {HTMLElement | null} Button.
 */
const button = (label) =>
  document.querySelector(`[aria-label="${label}"]`) ||
  [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === label) ||
  null;

test('menu page (bookmark list): StrictMode mount, one live list request, clean unmount', async () => {
  contentManagerRoutes();
  network.on('GET', '/magic-mark/bookmarks', list([bookmark()]));
  const result = await checkStrictEntry(<App />, { path: '/', permissions: ALL });
  assert.match(result.html, /Drafts/);
  const live = result.mountCalls.filter(
    (call) => call.pathname === '/magic-mark/bookmarks' && !call.aborted
  );
  assert.equal(live.length, 1, 'one list request survives the StrictMode remount');
});

test('menu page: unknown sub-path shows the not-found state without plugin requests', async () => {
  const result = await checkStrictEntry(<App />, { path: '/unknown', permissions: ALL });
  assert.equal(result.mountCalls.filter((call) => call.fromPlugin).length, 0);
});

test('homepage widget: StrictMode mount shows pinned bookmarks with content type names', async () => {
  contentManagerRoutes();
  network.on('GET', '/magic-mark/bookmarks', list([bookmark()]));
  const result = await checkStrictEntry(<PinnedBookmarksWidget />, { permissions: ALL });
  assert.match(result.html, /Drafts/);
  // The name comes from the shared /content-manager/init cache. StrictMode aborts the first
  // mount's request (useFetchClient aborts on unmount); the remount must still get the names.
  assert.match(result.html, />Article</);
  assert.doesNotMatch(result.html, />api::article\.article</);
});

test('homepage widget: empty and error states mount and unmount cleanly', async () => {
  contentManagerRoutes();
  network.on('GET', '/magic-mark/bookmarks', list([]));
  const empty = await checkStrictEntry(<PinnedBookmarksWidget />, { permissions: ALL });
  assert.match(empty.html, /Pin bookmarks to see them here/);

  contentManagerRoutes();
  network.on('GET', '/magic-mark/bookmarks', { status: 500, body: { error: { status: 500 } } });
  const failed = await checkStrictEntry(<PinnedBookmarksWidget />, { permissions: ALL });
  assert.match(failed.html, /could not be loaded/);
});

test('list view injection: StrictMode mount, popover and filters dialog open cleanly', async () => {
  contentManagerRoutes();
  network.on('GET', '/magic-mark/bookmarks', list([bookmark()]));
  const result = await checkStrictEntry(<ListViewActions />, {
    path: `/content-manager/collection-types/${ARTICLE}?page=1`,
    permissions: ALL,
    async whileMounted() {
      await click(button('Bookmarks'));
      assert.match(document.body.textContent, /Bookmarks for Article/);
      await click(button('Advanced filters'));
      // No filters yet: the builder starts with the empty state and its examples.
      assert.match(document.body.textContent, /Show only the entries you need/);
      assert.match(document.body.textContent, /Updated in the last 7 days/);
    },
  });
  assert.equal(result.calls.filter((call) => call.method !== 'GET').length, 0, 'no mutation');
  const configuration = result.calls.filter((call) => call.pathname.endsWith('/configuration'));
  assert.equal(configuration.length, 1, 'field metadata is loaded once and not aborted');
  assert.equal(configuration[0].aborted, false);
});

test('list view injection: renders nothing outside collection-type list views', async () => {
  const result = await checkStrictEntry(<ListViewActions />, {
    path: '/content-manager/single-types/api::home.home',
    permissions: ALL,
  });
  assert.equal(result.mountCalls.filter((call) => call.fromPlugin).length, 0);
});

test('bookmark dialog (edit, shared): StrictMode mount and clean unmount', async () => {
  network.on('GET', '/magic-mark/bookmarks/bm-1', { data: bookmark({ visibility: 'shared' }) });
  network.on('GET', '/magic-mark/sharing/roles', {
    data: [{ documentId: 'role-1', name: 'Editor' }],
  });
  network.on('GET', '/magic-mark/sharing/users', {
    data: [],
    meta: { pagination: { page: 1, pageSize: 10, pageCount: 0, total: 0 } },
  });
  const result = await checkStrictEntry(
    <BookmarkFormModal
      open
      bookmarkId="bm-1"
      canShare
      onOpenChange={() => {}}
      onSaved={() => {}}
    />,
    {
      permissions: ALL,
      // The user search is debounced by 250 ms; wait for it so its request is part of the check.
      whileMounted: () => act(async () => new Promise((resolve) => setTimeout(resolve, 300))),
    }
  );
  assert.ok(
    result.calls.some((call) => call.pathname === '/magic-mark/bookmarks/bm-1' && !call.aborted)
  );
  assert.ok(
    result.calls.some((call) => call.pathname === '/magic-mark/sharing/users' && !call.aborted)
  );
  assert.equal(result.calls.filter((call) => call.method !== 'GET').length, 0);
});
