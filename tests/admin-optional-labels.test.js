'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('optional bookmark descriptions are labeled once in every supported locale', () => {
  const translations = {
    en: 'Description',
    de: 'Beschreibung',
    fr: 'Description',
    es: 'Descripción',
    pt: 'Descrição',
  };

  for (const [locale, label] of Object.entries(translations)) {
    const source = readFileSync(
      path.join(__dirname, `../admin/src/translations/${locale}.json`),
      'utf8'
    );
    assert.match(source, new RegExp(`"form\\.description":\\s*"${label}"`), `${locale} supplies only the field label`);
  }

  const modal = readFileSync(path.join(__dirname, '../admin/src/components/CreateEditModal.tsx'), 'utf8');
  assert.match(modal, /form\.description[\s\S]*?\(Optional\)/, 'the component adds one consistent optional marker');
});
