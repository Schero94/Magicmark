'use strict';

/**
 * Source rules that are cheap to enforce statically. Behaviour is tested elsewhere; these
 * guard against regressions of the 3.x problems (license calls, custom colours, reloads).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx|js|mjs|cjs)$/.test(entry.name) ? [full] : [];
  });
const read = (file) => fs.readFileSync(file, 'utf8');
const adminFiles = walk(path.join(root, 'admin/src'));
const serverFiles = walk(path.join(root, 'server/src'));

const assertNone = (files, pattern, label) => {
  const hits = files
    .filter((file) => pattern.test(read(file)))
    .map((file) => path.relative(root, file));
  assert.deepEqual(hits, [], label);
};

test('no license system, remote calls, fingerprinting or timers anywhere (FREE-1..4)', () => {
  const all = [...adminFiles, ...serverFiles];
  assertNone(
    all,
    /magicapi|fitlex|store\.magicdx|license-?guard|UpgradePage|UpgradePrompt|FeatureGate|licenseTier|canCreateBookmark|premium|enterprise/i,
    'license system'
  );
  // "license" may only appear in the one-time cleanup of the 3.x store keys.
  const allowed = [
    'server/src/constants.ts',
    'server/src/bootstrap.ts',
    'server/src/services/maintenance.ts',
  ];
  const mentions = all
    .filter((file) => /licen[cs]e/i.test(read(file)))
    .map((file) => path.relative(root, file).split(path.sep).join('/'));
  assert.deepEqual(
    mentions.filter((file) => !allowed.includes(file)),
    []
  );
  assertNone(
    serverFiles,
    /\bfetch\(|networkInterfaces|os\.hostname|setInterval|setTimeout/,
    'server network or timers'
  );
  assertNone(adminFiles, /setInterval/, 'admin polling');
});

test('admin uses Design System tokens only: no colour literals, var(--colors) or px font sizes (UX-25)', () => {
  assertNone(adminFiles, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|var\(--colors/, 'colour literals');
  assertNone(adminFiles, /font-size:\s*\d|fontSize=\{?['"]\d/, 'raw font sizes');
  assertNone(adminFiles, /styled\(|styled\.[a-z]+`/, 'no custom styled components needed');
});

test('admin has no browser dialogs, reloads, console output or raw fetch (UX-04, UX-20, UX-21)', () => {
  assertNone(
    adminFiles,
    /window\.(confirm|alert|prompt)|[^.\w]confirm\(|[^.\w]alert\(/,
    'browser dialogs'
  );
  assertNone(adminFiles, /location\.reload|window\.location\.href\s*=/, 'page reloads');
  assertNone(adminFiles, /console\.(log|info|debug|warn)/, 'console output');
  assertNone(adminFiles, /[^.\w]fetch\(/, 'raw fetch');
  assertNone(adminFiles, /@heroicons|\bas=\{/, 'heroicons or the removed `as` prop');
});

test('server has no deprecated entityService or strapi.query and logs no raw errors', () => {
  assertNone(serverFiles, /entityService|strapi\.query\(/, 'deprecated APIs');
  assertNone(serverFiles, /console\./, 'console');
  assertNone(serverFiles, /log\.\w+\([^)]*,\s*error\)/, 'raw error objects in logs');
});

test('no hand-written query parser: saved queries go through qs with prototypes disabled (SEC-03)', () => {
  const query = read(path.join(root, 'admin/src/utils/query.ts'));
  assert.match(query, /allowPrototypes: false/);
  assertNone(adminFiles, /new URLSearchParams/, 'hand parsing');
});

test('a changed bookmark form asks before closing, like the native Blocker (ACC-UI-02)', () => {
  const form = read(path.join(root, 'admin/src/components/BookmarkFormModal.tsx'));
  assert.match(form, /<Modal\.Root open=\{open\} onOpenChange=\{handleOpenChange\}>/);
  assert.match(form, /if \(!next && isDirty && !saving\)/);
  assert.match(form, /<ConfirmDialog[\s\S]*form\.discardBody/);
});

test('row dialogs return focus to the row menu, or to the page after a delete (ACC-UI-01)', () => {
  const page = read(path.join(root, 'admin/src/pages/BookmarksPage.tsx'));
  assert.match(page, /focusMainAfterLoad\.current = true;\s*reload\(\);/);
  assert.match(page, /\(trigger \?\? document\.getElementById\('main-content'\)\)\?\.focus\(\)/);
  assert.match(page, /focusTarget\.current = bookmark\.documentId;\s*setEditId/);
  assert.match(page, /focusTarget\.current = bookmark\.documentId;\s*setToDelete/);
  const actions = read(path.join(root, 'admin/src/components/BookmarkActions.tsx'));
  assert.match(actions, /data-bookmark-menu=\{bookmark\.documentId\}/);
});

test('badges avoid the Badge primary variant, which fails contrast in the dark theme (ACC-UI-03)', () => {
  assertNone(adminFiles, /<Badge[^>]*variant=\{?['"]?primary/, 'Badge variant primary');
  const page = read(path.join(root, 'admin/src/pages/BookmarksPage.tsx'));
  assert.doesNotMatch(page, /variant: 'primary'/);
  assert.match(page, /backgroundColor: 'primary100',\s*textColor: 'primary700'/);
});

test('below the large breakpoint the bookmarks page uses cards, so row actions stay visible (ACC-UI-04)', () => {
  const page = read(path.join(root, 'admin/src/pages/BookmarksPage.tsx'));
  assert.match(page, /const showCards = !useIsDesktop\(\);/);
  assert.match(page, /\) : showCards \? \(/);
});

test('table rows keep one button per cell, so Escape closes the row menu (ACC-UI-05)', () => {
  const page = read(path.join(root, 'admin/src/pages/BookmarksPage.tsx'));
  assert.match(
    page,
    /<Td>\{actionsFor\(bookmark, 'pin'\)\}<\/Td>\s*<Td>\{actionsFor\(bookmark, 'menu'\)\}<\/Td>/
  );
  assert.match(page, /colCount=\{7\}/);
  const actions = read(path.join(root, 'admin/src/components/BookmarkActions.tsx'));
  assert.match(actions, /<Menu\.Root open=\{menuOpen\} onOpenChange=\{setMenuOpen\}>/);
  assert.doesNotMatch(actions, /stopPropagation/);
  // Like the native row menu: no max height, so no action scrolls out of view.
  assert.match(actions, /<Menu\.Content popoverPlacement="bottom-end" maxHeight=\{undefined\}>/);
  assert.match(actions, /\{\.\.\.TRIGGER_WITHOUT_TOOLTIP\}\s*\/>/);
  assert.match(
    actions,
    /TRIGGER_WITHOUT_TOOLTIP: Record<string, unknown> = \{ withTooltip: false \}/
  );
});

test('the popover loads pinned bookmarks separately and links to the rest (MM-RA-4)', () => {
  const src = read(path.join(root, 'admin/src/components/BookmarksPopover.tsx'));
  assert.match(src, /scope: 'pinned'/, 'pinned bookmarks are requested on their own');
  assert.match(src, /total > items\.length/, 'a hidden remainder is announced');
  assert.match(src, /popover\.showAll/);
  assert.match(src, /\?contentType=\$\{encodeURIComponent\(listView\.uid\)\}/);
});

test('a rejected list view query is explained, not hidden behind a generic error (MM-RA-3)', () => {
  const form = read(path.join(root, 'admin/src/components/BookmarkFormModal.tsx'));
  const popover = read(path.join(root, 'admin/src/components/BookmarksPopover.tsx'));
  assert.match(form, /fields\.query/);
  assert.match(form, /form\.queryTooLong/);
  assert.match(popover, /fieldErrors\(error\)\.query/);
});

test('removed 3.x plugin pages show the native "Page not found" state, not an error (MM-404)', () => {
  const app = read(path.join(root, 'admin/src/pages/App.tsx'));
  assert.match(app, /<Route path="\*" element={<NotFoundPage \/>} \/>/);
  assert.doesNotMatch(app, /Page\.Error/, 'unknown paths are not an error');
  const page = read(path.join(root, 'admin/src/pages/NotFoundPage.tsx'));
  assert.match(page, /<Page\.Main /);
  assert.match(page, /<EmptyStateLayout/);
  assert.match(page, /to={`\/plugins\/\${pluginId}`}/, 'offers the way back to the plugin page');
});
