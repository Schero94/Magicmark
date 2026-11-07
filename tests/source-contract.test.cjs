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
