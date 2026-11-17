'use strict';

// The README ships in the npm package and is rendered by npmjs.com and the Strapi marketplace
// (community.strapi.io/marketplace). Neither resolves paths relative to the GitHub repository,
// and the marketplace strips the HTML `align` attribute. These checks keep every image and link
// working outside GitHub (MARK-MKT-2, MARK-MKT-3).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const PAGES_IMG = 'https://schero94.github.io/Magicmark/img/';

/** Markdown and HTML image sources with their alt text. */
function images(source) {
  const found = [];
  for (const m of source.matchAll(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
    found.push({ alt: m[1], url: m[2] });
  }
  for (const m of source.matchAll(/<img\b[^>]*>/gi)) {
    const src = /\bsrc\s*=\s*["']([^"']*)["']/i.exec(m[0]);
    const alt = /\balt\s*=\s*["']([^"']*)["']/i.exec(m[0]);
    found.push({ alt: alt ? alt[1] : '', url: src ? src[1] : '' });
  }
  return found;
}

/** Every link and image target: markdown `](url)`, reference definitions, HTML src/href. */
function targets(source) {
  const found = [];
  for (const m of source.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) found.push(m[1]);
  for (const m of source.matchAll(/^\s{0,3}\[[^\]]+\]:\s*<?(\S+?)>?(?:\s|$)/gm)) found.push(m[1]);
  for (const m of source.matchAll(/\b(?:src|href)\s*=\s*["']([^"']*)["']/gi)) found.push(m[1]);
  return found;
}

/** GitHub-style heading slug, used by the marketplace renderer as heading id. */
function slug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

test('the helpers find relative targets (self-check)', () => {
  const sample =
    '![a](docs/x.png) [b](./LICENSE) <img src="pics/y.png" alt="y">\n[c]: CHANGELOG.md';
  assert.deepEqual(targets(sample), ['docs/x.png', './LICENSE', 'CHANGELOG.md', 'pics/y.png']);
  assert.deepEqual(
    images(sample).map((i) => i.url),
    ['docs/x.png', 'pics/y.png']
  );
});

test('every link and image target is absolute, mailto: or an in-page anchor', () => {
  const all = targets(readme);
  assert.ok(all.length > 20, 'README targets were parsed');
  const bad = all.filter((url) => !/^(https?:\/\/|mailto:|#)/i.test(url));
  assert.deepEqual(bad, [], `relative targets break on npm and the Strapi marketplace: ${bad}`);
});

test('in-page anchors point at an existing heading', () => {
  const ids = new Set(
    [...readme.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => slug(m[1].replace(/`/g, '')))
  );
  const missing = targets(readme)
    .filter((url) => url.startsWith('#'))
    .filter((url) => !ids.has(url.slice(1)));
  assert.deepEqual(missing, []);
});

test('images come from the GitHub Pages copy or a badge service, and exist in docs/site/img', () => {
  for (const { url } of images(readme)) {
    if (url.startsWith(PAGES_IMG)) {
      const file = path.join(root, 'docs/site/img', url.slice(PAGES_IMG.length));
      assert.ok(fs.existsSync(file), `${url} is published from docs/site/img`);
      continue;
    }
    assert.match(
      url,
      /^https:\/\/(img\.shields\.io\/|github\.com\/Schero94\/Magicmark\/actions\/workflows\/[\w.-]+\/badge\.svg$)/,
      `${url} is not a stable image URL`
    );
  }
});

test('every image has alt text and each screenshot appears once (4 to 8 screenshots)', () => {
  const all = images(readme);
  for (const { alt, url } of all) assert.ok(alt.trim(), `${url} has alt text`);
  const shots = all
    .map((i) => i.url)
    .filter(
      (url) => url.startsWith(PAGES_IMG) && url.endsWith('.png') && !url.includes('/img/icon')
    );
  assert.equal(new Set(shots).size, shots.length, 'no screenshot is repeated');
  assert.ok(shots.length >= 4 && shots.length <= 8, `${shots.length} screenshots`);
});

test('no HTML attributes that the Strapi marketplace strips', () => {
  assert.doesNotMatch(readme, /\balign\s*=/i);
});
