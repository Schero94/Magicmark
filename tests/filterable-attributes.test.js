'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('filter builder omits private, hidden, non-searchable and unsupported plugin fields', async () => {
  const { getFilterableAttributes } = await import('../admin/src/utils/filterableAttributes.mjs');
  const result = getFilterableAttributes({
    username: { type: 'string' },
    email: { type: 'email' },
    password: { type: 'password', private: true, searchable: false },
    resetPasswordToken: { type: 'string', private: true, hidden: true },
    confirmationToken: { type: 'string', private: true, hidden: true },
    provider: { type: 'string' },
    blocked: { type: 'boolean' },
    role: { type: 'relation', target: 'plugin::users-permissions.role' },
    organization: { type: 'relation', target: 'api::organization.organization' },
    settings: { type: 'component' },
    avatar: { type: 'media' },
  }, {
    provider: { edit: { visible: false } },
  });

  assert.deepEqual(result.fields.map(({ name }) => name), [
    'updatedAt', 'createdAt', 'documentId', 'id', 'username', 'email', 'blocked',
  ]);
  assert.deepEqual(result.relations, [
    { name: 'organization', target: 'api::organization.organization' },
  ]);
});

test('filterable attribute checks reject secret metadata before option construction', async () => {
  const { isFilterableAttribute } = await import('../admin/src/utils/filterableAttributes.mjs');
  assert.equal(isFilterableAttribute('password', { type: 'password', private: true }), false);
  assert.equal(isFilterableAttribute('resetPasswordToken', { type: 'string', hidden: true }), false);
  assert.equal(isFilterableAttribute('provider', { type: 'string', searchable: false }), false);
  assert.equal(isFilterableAttribute('provider', { type: 'string' }, { edit: { visible: false } }), false);
  assert.equal(isFilterableAttribute('username', { type: 'string' }), true);
});

test('Content Manager filter components share the secure schema allowlist', () => {
  const advanced = readFileSync(path.join(__dirname, '../admin/src/components/AdvancedFilterButton.tsx'), 'utf8');
  const relations = readFileSync(path.join(__dirname, '../admin/src/hooks/useRelationSchema.ts'), 'utf8');
  assert.match(advanced, /getFilterableAttributes\(realAttributes, metadatas\)/);
  assert.match(relations, /getFilterableAttributes\(attributes\)/);
});
