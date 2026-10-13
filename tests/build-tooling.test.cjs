const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const manifest = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

test('plugin build declares the Vite peer required by Strapi SDK React tooling', () => {
  assert.equal(manifest.devDependencies?.vite, '^6.4.4');
});
