'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('runtime dependencies are only what the plugin imports itself (PKG-1, DEP-01)', () => {
  // @strapi/utils is imported by the server code. Strapi apps do not list it, so as a peer it
  // made yarn 1 warn about an unmet peer; as a dependency it dedupes with Strapi's own copy.
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['@strapi/utils', 'qs', 'zod']);
  assert.match(pkg.dependencies['@strapi/utils'], /^\^5\./);
  for (const name of ['@heroicons/react', '@types/qs', '@strapi/sdk-plugin', '@swc/core']) {
    assert.equal(pkg.dependencies[name], undefined, `${name} is not a runtime dependency`);
    assert.equal(pkg.peerDependencies[name], undefined, `${name} is not a peer`);
  }
  assert.equal(pkg.devDependencies['@heroicons/react'], undefined);
  assert.equal(pkg.peerDependencies['@strapi/utils'], undefined, '@strapi/utils is not a peer');
});

test('peers match the Strapi 5 app template; admin-only packages are optional peers (PKG-2)', () => {
  // create-strapi-app 5.61.0 adds react ^18.0.0, react-dom ^18.0.0, react-router-dom ^6.30.3
  // and styled-components ^6.0.0 to every app. The Design System, icons and react-intl reach
  // the app only through @strapi/admin, so they are optional: no install warning, and the
  // admin build still resolves them from the app.
  assert.deepEqual(Object.keys(pkg.peerDependencies).sort(), [
    '@strapi/design-system',
    '@strapi/icons',
    '@strapi/strapi',
    'react',
    'react-dom',
    'react-intl',
    'react-router-dom',
    'styled-components',
  ]);
  assert.deepEqual(pkg.peerDependenciesMeta, {
    '@strapi/design-system': { optional: true },
    '@strapi/icons': { optional: true },
    'react-intl': { optional: true },
  });
  assert.equal(pkg.peerDependencies['@strapi/strapi'], '^5.57.0');
  assert.equal(pkg.peerDependencies.react, '^18.0.0');
  assert.equal(pkg.peerDependencies['react-dom'], '^18.0.0');
});

test('package metadata points at the project site and repository (PKG-5)', () => {
  assert.equal(pkg.homepage, 'https://schero94.github.io/Magicmark/');
  assert.deepEqual(pkg.repository, {
    type: 'git',
    url: 'git+https://github.com/Schero94/Magicmark.git',
  });
  assert.equal(pkg.bugs.url, 'https://github.com/Schero94/Magicmark/issues');
  assert.doesNotMatch(pkg.description, /enterprise|powerful|ultimate|blazing/i);
  assert.ok(pkg.keywords.includes('strapi-plugin'));
});

test('Strapi peer pins are documented majors: React 18, React Router 6, styled-components 6, react-intl 6', () => {
  assert.match(pkg.peerDependencies.react, /^\^18/);
  assert.match(pkg.peerDependencies['react-router-dom'], /^\^6/);
  assert.match(pkg.peerDependencies['styled-components'], /^\^6/);
  assert.match(pkg.peerDependencies['react-intl'], /^\^6/);
});

test('published files, engines, scripts and entry points (PKG-3, PKG-4)', () => {
  assert.deepEqual(pkg.files, [
    'dist',
    'strapi-admin.js',
    'strapi-server.js',
    'README.md',
    'LICENSE',
    'CHANGELOG.md',
  ]);
  assert.equal(fs.existsSync(path.join(root, 'COPYRIGHT_NOTICE.txt')), false);
  assert.equal(pkg.engines.node, '^22.22.2 || >=24.15.0');
  assert.equal(pkg.publishConfig.access, 'public');
  for (const script of [
    'lint',
    'format:check',
    'test',
    'test:ts:front',
    'test:ts:back',
    'build',
    'verify',
    'verify:runtime',
    'prepublishOnly',
  ]) {
    assert.ok(pkg.scripts[script], script);
  }
  assert.match(
    fs.readFileSync(path.join(root, 'strapi-server.js'), 'utf8'),
    /dist\/server\/index\.js/
  );
  assert.match(
    fs.readFileSync(path.join(root, 'strapi-admin.js'), 'utf8'),
    /dist\/admin\/index\.js/
  );
  assert.equal(pkg.exports['./strapi-server'].require, './dist/server/index.js');
});

test('release workflow keeps the NPM_TOKEN fallback and provenance (REL-1)', () => {
  const release = fs.readFileSync(path.join(root, '.github/workflows/release.yml'), 'utf8');
  assert.match(release, /NPM_TOKEN: \$\{\{ secrets\.NPM_TOKEN \}\}/);
  assert.match(release, /NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_TOKEN \}\}/);
  assert.match(release, /NPM_CONFIG_PROVENANCE: 'true'/);
  assert.match(release, /id-token: write/);
  assert.match(release, /npx --no-install semantic-release/);
});

test('CI and Dependabot are set up like the other plugins (CI-1, REL-2)', () => {
  const ci = fs.readFileSync(path.join(root, '.github/workflows/test.yml'), 'utf8');
  for (const step of [
    'npm run lint',
    'npm run format:check',
    'npm test',
    'npm run test:ts:front',
    'npm run test:ts:back',
    'npm run build',
    'npm run verify',
    'npm run verify:runtime',
  ]) {
    assert.ok(ci.includes(step), step);
  }
  assert.doesNotMatch(ci, /continue-on-error/);
  for (const file of [
    '.github/workflows/test.yml',
    '.github/workflows/release.yml',
    '.github/workflows/pages.yml',
    '.github/workflows/dependency-auto-merge.yml',
  ]) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const uses of text.match(/uses: \S+/g) ?? [])
      assert.match(uses, /@[0-9a-f]{40}$/, `${file}: ${uses} is SHA-pinned`);
  }
  assert.ok(fs.existsSync(path.join(root, '.github/dependabot.yml')));
});
