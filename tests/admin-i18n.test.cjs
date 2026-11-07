'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { parse } = require('@formatjs/icu-messageformat-parser');

const LOCALES = ['en', 'de', 'fr', 'es', 'pt'];
const dir = path.join(__dirname, '../admin/src/translations');
const load = (locale) => JSON.parse(fs.readFileSync(path.join(dir, `${locale}.json`), 'utf8'));

/** Placeholder names used by an ICU message. */
const placeholders = (message) => {
  const names = new Set();
  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.value && typeof node.value === 'string' && node.type !== 0) names.add(node.value);
      if (node.options) for (const option of Object.values(node.options)) walk(option.value);
    }
  };
  walk(parse(message));
  return [...names].sort();
};

test('every message used in the source exists in en.json with the same default text', async () => {
  const { extractMessages } = await import('../scripts/extract-messages.mjs');
  const { messages, conflicts } = extractMessages();
  assert.deepEqual(conflicts, [], 'one default message per key');
  const en = load('en');
  assert.deepEqual(
    Object.keys(en).sort(),
    Object.keys(messages).sort(),
    'en.json has no missing or orphan keys'
  );
  for (const [key, value] of Object.entries(messages)) assert.equal(en[key], value, key);
});

test('all five locales have the same keys, valid ICU and the same placeholders', () => {
  const en = load('en');
  for (const locale of LOCALES) {
    const messages = load(locale);
    assert.deepEqual(Object.keys(messages).sort(), Object.keys(en).sort(), locale);
    for (const [key, value] of Object.entries(messages)) {
      assert.ok(value.trim(), `${locale}.${key} is empty`);
      assert.deepEqual(placeholders(value), placeholders(en[key]), `${locale}.${key} placeholders`);
    }
  }
});

test('no emoji, no license or upgrade wording in any locale (FREE-5, UX-23)', () => {
  for (const locale of LOCALES) {
    for (const [key, value] of Object.entries(load(locale))) {
      assert.doesNotMatch(value, /\p{Extended_Pictographic}/u, `${locale}.${key} has an emoji`);
      assert.doesNotMatch(
        `${key} ${value}`,
        /\b(licen\w*|upgrade|premium|enterprise|tiers?)\b|limit reached/i,
        `${locale}.${key}`
      );
    }
  }
});

test('German copy does not address the reader (no du/Sie forms)', () => {
  for (const [key, value] of Object.entries(load('de'))) {
    assert.doesNotMatch(value, /\b(du|dich|dir|dein\w*|Sie|Ihr\w*|Ihnen)\b/, `de.${key}: ${value}`);
  }
});

test('translated locales are not English copies', () => {
  const en = load('en');
  for (const locale of ['de', 'fr', 'es', 'pt']) {
    const messages = load(locale);
    const same = Object.keys(en).filter(
      (key) =>
        messages[key] === en[key] &&
        !/^(page\.title|plugin\.name|icons\.(filter|link|terminal|document|mail|chart|search|globe|tag|photo))$/.test(
          key
        ) &&
        !/^\{/.test(en[key])
    );
    assert.ok(
      same.length <= 8,
      `${locale} has ${same.length} untranslated strings: ${same.join(', ')}`
    );
  }
});
