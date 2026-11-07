'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('runtime dependencies are only what the plugin imports itself (PKG-1, DEP-01)', () => {
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['qs', 'zod']);
  for (const name of ['@heroicons/react', '@types/qs', '@strapi/sdk-plugin', '@swc/core']) {
    assert.equal(pkg.dependencies[name], undefined, `${name} is not a runtime dependency`);
    assert.equal(pkg.peerDependencies[name], undefined, `${name} is not a peer`);
  }
  assert.equal(pkg.devDependencies['@heroicons/react'], undefined);
  for (const peer of [
    '@strapi/design-system',
    '@strapi/icons',
    '@strapi/strapi',
    '@strapi/utils',
    'react',
    'react-dom',
    'react-intl',
    'react-router-dom',
    'styled-components',
  ]) {
    assert.ok(pkg.peerDependencies[peer], `${peer} is a peer`);
  }
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
