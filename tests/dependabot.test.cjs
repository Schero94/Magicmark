'use strict';

// Dependabot does not propose Design System minors; they follow the Strapi baseline by hand.
// The comment that explains this must name the minor the repo actually develops against, so
// it cannot drift again when the baseline moves (MARK-DOC-1).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const dependabot = fs.readFileSync(path.join(root, '.github/dependabot.yml'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

test('Design System pin comment and README name the devDependency minor', () => {
  const range = pkg.devDependencies['@strapi/design-system'];
  const minor = /(\d+\.\d+)\./.exec(range)[1];
  assert.equal(
    /(\d+\.\d+)\./.exec(pkg.devDependencies['@strapi/icons'])[1],
    minor,
    'icons follow the same minor'
  );
  const block = dependabot.slice(dependabot.indexOf('# Keep the Design System'));
  assert.match(block, new RegExp(`ships ${minor.replace('.', '\\.')}\\.\\d+\\)`));
  assert.match(block, /'@strapi\/design-system'\s+update-types: \[[^\]]*semver-minor/);
  assert.match(readme, new RegExp(`\\(${minor.replace('.', '\\.')}\\.x for Strapi`));
});
