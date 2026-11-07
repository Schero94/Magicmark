const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTypeScript(relativePath, requireModule = require) {
  const filename = path.join(__dirname, relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const moduleRef = { exports: {} };
  new Function('module', 'exports', 'require', compiled)(moduleRef, moduleRef.exports, requireModule);
  return moduleRef.exports;
}

const fakeLicenseKey = 'FAKE-MAGICMARK-REGRESSION-KEY-0001';
const fakeLicense = {
  licenseKey: fakeLicenseKey,
  email: 'fake-licensee@example.test',
  firstName: 'Fake',
  lastName: 'Licensee',
  isActive: true,
  isExpired: false,
  isOnline: true,
  expiresAt: '2099-01-01T00:00:00.000Z',
  lastPingAt: '2026-10-15T00:00:00.000Z',
  deviceName: 'fake-device',
  deviceId: 'fake-device-id',
  ipAddress: '192.0.2.10',
  featurePremium: true,
  featureAdvanced: false,
  featureEnterprise: false,
  featureCustom: false,
  maxDevices: 2,
  currentDevices: 1,
};

function createLogger() {
  const messages = [];
  const logger = Object.fromEntries(['debug', 'info', 'warn', 'error'].map((level) => [
    level,
    (...args) => messages.push(args.map(String).join(' ')),
  ]));
  return { logger, messages };
}

test('query values containing percent signs survive serialize and reopen', () => {
  const { generateFromRows } = loadTypeScript('../admin/src/utils/queryGenerator.ts');
  const { parseQueryToRows } = loadTypeScript('../admin/src/utils/queryToStructure.ts');
  const value = '50% off + 100%/final';
  const query = generateFromRows([
    { id: 'row-1', field: 'title', operator: 'contains', value },
  ], []);

  assert.equal(parseQueryToRows(query).rows[0].value, value);
});

test('malformed filter indices produce an empty editable state instead of a parse exception', () => {
  const { parseQueryToStructure, parseQueryToFilterGroup, parseQueryToRows } = loadTypeScript('../admin/src/utils/queryToStructure.ts');
  const malformed = 'filters[$and][not-an-index][title][$eq]=x';
  const flat = parseQueryToStructure(malformed);
  const nested = parseQueryToFilterGroup(malformed);

  assert.equal(flat.conditions.length, 1);
  assert.equal(flat.conditions[0].field, '');
  assert.equal(nested.items.length, 1);
  assert.equal(nested.items[0].field, '');
  assert.deepEqual(parseQueryToRows(malformed).rows, []);
});

test('nested grouped filters reopen with the same logic and conditions', () => {
  const { generateFromGroup } = loadTypeScript('../admin/src/utils/queryGenerator.ts');
  const { parseQueryToFilterGroup } = loadTypeScript('../admin/src/utils/queryToStructure.ts');
  const group = {
    id: 'root',
    logic: 'AND',
    isGroup: true,
    items: [
      {
        id: 'authors',
        logic: 'OR',
        isGroup: true,
        items: [
          { id: 'admin', field: 'author.role', operator: 'eq', value: 'admin' },
          { id: 'editor', field: 'author.role', operator: 'eq', value: 'editor' },
        ],
      },
      { id: 'published', field: 'status', operator: 'eq', value: 'published' },
    ],
  };
  const reopened = parseQueryToFilterGroup(generateFromGroup(group));
  const normalize = (item) => item.isGroup
    ? { logic: item.logic, items: item.items.map(normalize) }
    : { field: item.field, operator: item.operator, value: item.value };

  assert.deepEqual(normalize(reopened), normalize(group));
  assert.notEqual(reopened.items[0].id, reopened.id, 'nested group must have an ID distinct from the root group');
});

test('advanced filter modal restores saved grouped filters instead of a blank group', () => {
  const source = fs.readFileSync(path.join(__dirname, '../admin/src/components/StrapiStyleFilterModal.tsx'), 'utf8');
  assert.ok(/parseQueryToFilterGroup\(currentQuery\)/.test(source), 'group mode must restore currentQuery');
});

test('custom select keeps dropdown coordinates in styled-components transient props', () => {
  const source = fs.readFileSync(path.join(__dirname, '../admin/src/components/CustomSelect.tsx'), 'utf8');

  assert.match(source, /\$top:\s*number/);
  assert.match(source, /\$left:\s*number/);
  assert.match(source, /\$width:\s*number/);
  assert.match(source, /\$top=\{dropdownPos\.top\}/);
  assert.match(source, /\$left=\{dropdownPos\.left\}/);
  assert.match(source, /\$width=\{dropdownPos\.width\}/);
  assert.doesNotMatch(source, /\stop=\{dropdownPos\.top\}/);
  assert.doesNotMatch(source, /\sleft=\{dropdownPos\.left\}/);
  assert.doesNotMatch(source, /\swidth=\{dropdownPos\.width\}/);
});

test('custom select keeps its portal inside the viewport when the trigger is near the edge', () => {
  const { calculateDropdownPosition } = loadTypeScript('../admin/src/utils/dropdownPosition.ts');
  const position = calculateDropdownPosition(
    { top: 650, bottom: 690, left: 340, width: 180 },
    { width: 390, height: 720 },
  );

  assert.equal(position.openAbove, true);
  assert.equal(position.width, 180);
  assert.equal(position.left, 202);
  assert.ok(position.top >= 8);
  assert.ok(position.top + position.maxHeight <= 712);
});

test('Content Manager filter guard permits supported filters and rejects over-depth boolean nesting', () => {
  const { getMaxFilterQueryDepth, isFilterQuerySupportedByContentManager } = loadTypeScript(
    '../admin/src/utils/contentManagerFilterCompatibility.ts',
  );
  const topLevelOr = 'filters[$or][0][email][$eq]=a&filters[$or][1][email][$eq]=b';
  const nestedAndOr = 'filters[$and][0][$or][0][email][$eq]=a&filters[$and][0][$or][1][email][$eq]=b';
  const negatedAnd = 'filters[$and][0][$not][email][$eq]=a';

  assert.equal(getMaxFilterQueryDepth(topLevelOr), 4);
  assert.equal(isFilterQuerySupportedByContentManager(topLevelOr), true);
  assert.equal(getMaxFilterQueryDepth(nestedAndOr), 6);
  assert.equal(isFilterQuerySupportedByContentManager(nestedAndOr), false);
  assert.equal(isFilterQuerySupportedByContentManager(negatedAnd), true);
});

test('filter-depth warning is translated in every supported admin locale', () => {
  for (const locale of ['de', 'en', 'es', 'fr', 'pt']) {
    const translations = JSON.parse(fs.readFileSync(path.join(__dirname, `../admin/src/translations/${locale}.json`), 'utf8'));
    assert.ok(translations['error.queryDepth'], `${locale} must define the filter-depth warning`);
  }
});

test('license status returns a safe summary without key, personal or device identifiers', async () => {
  const controllerModule = loadTypeScript('../server/src/controllers/license.ts');
  const licenseGuard = {
    verifyLicense: async () => ({ valid: true }),
    getLicenseByKey: async () => fakeLicense,
  };
  const controller = controllerModule.default({
    strapi: {
      store: () => ({ get: async () => fakeLicenseKey }),
      plugin: () => ({ service: () => licenseGuard }),
      log: createLogger().logger,
    },
  });
  const ctx = {
    state: { user: { documentId: 'admin-reader' } },
    send(body) { return body; },
    badRequest(message) { throw new Error(message); },
  };

  const response = await controller.getStatus(ctx);
  const serialized = JSON.stringify(response);

  for (const secret of [fakeLicenseKey, fakeLicense.email, fakeLicense.deviceId, fakeLicense.ipAddress, fakeLicense.firstName]) {
    assert.equal(serialized.includes(secret), false, `license status must omit ${secret}`);
  }
  assert.equal(response.data.features.premium, true);
});

test('license details return sensitive fields only through the update-scoped handler', async () => {
  const controllerModule = loadTypeScript('../server/src/controllers/license.ts');
  const controller = controllerModule.default({
    strapi: {
      store: () => ({ get: async () => fakeLicenseKey }),
      plugin: () => ({ service: () => ({
        verifyLicense: async () => ({ valid: true }),
        getLicenseByKey: async () => fakeLicense,
      }) }),
      log: createLogger().logger,
    },
  });
  let details;
  const ctx = {
    state: { user: { documentId: 'admin-manager' } },
    send(body) { details = body; return body; },
    unauthorized(message) { throw Object.assign(new Error(message), { status: 401 }); },
    badRequest(message) { throw new Error(message); },
  };

  await controller.getDetails(ctx);
  assert.equal(details.data.licenseKey, fakeLicenseKey);
  assert.equal(details.data.email, fakeLicense.email);
  assert.equal(details.data.deviceId, fakeLicense.deviceId);
});

test('anonymous license detail requests are rejected before license data is read', async () => {
  const controllerModule = loadTypeScript('../server/src/controllers/license.ts');
  let storeRead = false;
  const controller = controllerModule.default({
    strapi: {
      store: () => ({ get: async () => { storeRead = true; return fakeLicenseKey; } }),
      log: createLogger().logger,
    },
  });
  const ctx = {
    state: {},
    unauthorized(message) { throw Object.assign(new Error(message), { status: 401 }); },
  };

  await assert.rejects(controller.getDetails(ctx), (error) => error.status === 401);
  assert.equal(storeRead, false);
});

test('license details require the write permission in both route declarations and the settings link', () => {
  for (const routeFile of ['../server/src/routes/admin.ts', '../server/routes/admin.js']) {
    const routeModule = loadTypeScript(routeFile);
    const routes = routeModule.default?.routes || routeModule.routes;
    const details = routes.find((route) => route.path === '/license/details');
    const status = routes.find((route) => route.path === '/license/status');
    const users = routes.find((route) => route.path === '/users');
    assert.deepEqual(details?.config?.auth?.scope, ['plugin::magic-mark.settings.update']);
    assert.deepEqual(status?.config?.auth?.scope, ['plugin::magic-mark.settings.read']);
    assert.deepEqual(users?.config?.auth?.scope, ['plugin::magic-mark.settings.update']);
  }

  const adminEntry = fs.readFileSync(path.join(__dirname, '../admin/src/index.ts'), 'utf8');
  assert.match(adminEntry, /id: 'magic-mark-license',[\s\S]*?permissions: pluginPermissions\.updateSettings/);
});

test('license key validation logs contain neither the key nor the submitted email', async () => {
  const controllerModule = loadTypeScript('../server/src/controllers/license.ts');
  const { logger, messages } = createLogger();
  const licenseGuard = {
    verifyLicense: async () => ({ valid: true, data: fakeLicense }),
    getLicenseByKey: async () => fakeLicense,
    storeLicenseKey: async () => true,
    startPinging: () => 1,
  };
  const strapi = {
    plugin: () => ({ service: () => licenseGuard }),
    log: logger,
  };
  const controller = controllerModule.default({ strapi });
  const ctx = {
    state: { user: { documentId: 'admin-manager' } },
    request: { body: { licenseKey: fakeLicenseKey, email: fakeLicense.email } },
    send(body) { return body; },
    badRequest(message) { throw new Error(message); },
  };

  await controller.storeKey(ctx);
  const output = messages.join('\n');
  assert.equal(output.includes(fakeLicenseKey), false);
  assert.equal(output.includes(fakeLicense.email), false);
});

test('license key storage logs never include fake key material', async () => {
  const { logger, messages } = createLogger();
  const values = new Map();
  const mockedRequire = (request) => request.endsWith('utils/logger')
    ? { createLogger: () => logger }
    : require(request);
  const serviceModule = loadTypeScript('../server/src/services/license-guard.ts', mockedRequire);
  const service = serviceModule.default({
    strapi: {
      store: () => ({
        get: async ({ key }) => values.get(key),
        set: async ({ key, value }) => values.set(key, value),
      }),
    },
  });

  assert.equal(await service.storeLicenseKey(fakeLicenseKey), true);
  assert.equal(messages.join('\n').includes(fakeLicenseKey), false);
});

test('license initialization logs omit fake keys and licensee details', async () => {
  const { logger, messages } = createLogger();
  const mockedRequire = (request) => request.endsWith('utils/logger')
    ? { createLogger: () => logger }
    : require(request);
  const serviceModule = loadTypeScript('../server/src/services/license-guard.ts', mockedRequire);
  const values = new Map([
    ['licenseKey', fakeLicenseKey],
    ['lastValidated', new Date().toISOString()],
  ]);
  const service = serviceModule.default({
    strapi: {
      store: () => ({ get: async ({ key }) => values.get(key) }),
    },
  });
  service.verifyLicense = async () => ({ valid: true, data: fakeLicense });
  service.startPinging = () => 1;

  await service.initialize();
  const output = messages.join('\n');
  for (const secret of [fakeLicenseKey, fakeLicense.email, fakeLicense.deviceId, fakeLicense.ipAddress]) {
    assert.equal(output.includes(secret), false, `initialization log must omit ${secret}`);
  }
});

test('server create limits match fresh license tier, including enterprise', async () => {
  const { logger } = createLogger();
  const mockedRequire = (request) => request.endsWith('utils/logger')
    ? { createLogger: () => logger }
    : require(request);
  const serviceModule = loadTypeScript('../server/src/services/license-guard.ts', mockedRequire);

  for (const scenario of [
    { tier: 'premium', limit: 50, fresh: { isActive: true, isExpired: false, featurePremium: true }, cached: undefined },
    { tier: 'enterprise', limit: -1, fresh: { isActive: true, isExpired: false, featureEnterprise: true }, cached: { isActive: true, isExpired: false, featureEnterprise: true } },
  ]) {
    const strapi = {
      licenseGuard: { data: scenario.cached },
      documents: () => ({ findMany: async () => [] }),
    };
    const service = serviceModule.default({ strapi });
    service.getCurrentLicense = async () => scenario.fresh;

    const limits = await service.getLicenseLimits('admin-owner');
    assert.equal(limits.tier, scenario.tier);
    assert.equal(limits.maxBookmarks, scenario.limit);
  }
});

test('server feature tiers preserve Free sharing and require Advanced for advanced filters', () => {
  const { logger } = createLogger();
  const mockedRequire = (request) => request.endsWith('utils/logger')
    ? { createLogger: () => logger }
    : require(request);
  const serviceModule = loadTypeScript('../server/src/services/license-guard.ts', mockedRequire);
  const tiers = [
    { tier: 'free', flags: {} , sharing: true, advancedFilters: false },
    { tier: 'premium', flags: { featurePremium: true }, sharing: true, advancedFilters: false },
    { tier: 'advanced', flags: { featureAdvanced: true }, sharing: true, advancedFilters: true },
    { tier: 'enterprise', flags: { featureEnterprise: true }, sharing: true, advancedFilters: true },
  ];

  for (const { tier, flags, sharing, advancedFilters } of tiers) {
    const service = serviceModule.default({ strapi: {
      licenseGuard: { data: { isActive: true, isExpired: false, ...flags } },
    } });
    assert.equal(service.hasFeature('sharedBookmarks'), sharing, `${tier} sharing entitlement`);
    assert.equal(service.hasFeature('advancedFilters'), advancedFilters, `${tier} advanced filter entitlement`);
  }

  const upgradePage = fs.readFileSync(path.join(__dirname, '../admin/src/pages/UpgradePage.tsx'), 'utf8');
  const licensePage = fs.readFileSync(path.join(__dirname, '../admin/src/pages/License/index.tsx'), 'utf8');
  const featureHook = fs.readFileSync(path.join(__dirname, '../admin/src/hooks/useFeatureGate.ts'), 'utf8');
  const advertisedAdvancedFilters = [...upgradePage.matchAll(/name: 'Advanced Filters', included: (true|false)/g)]
    .map((match) => match[1]);
  const advertisedRoleSharing = [...upgradePage.matchAll(/name: 'Role Sharing', included: (true|false)/g)]
    .map((match) => match[1]);
  assert.ok(/sharedBookmarks: \{ tier: 'free' \}/.test(featureHook), 'the UI feature map must retain Free sharing');
  assert.deepEqual(advertisedAdvancedFilters, ['false', 'false', 'true']);
  assert.deepEqual(advertisedRoleSharing, ['true', 'true', 'true']);
  assert.ok(/features\?\.enterprise\s*\|\|\s*licenseData\.data\?\.features\?\.advanced/.test(upgradePage), 'enterprise must map to the Advanced feature plan');
  assert.ok(/data\.features\?\.advanced \|\| data\.features\?\.enterprise/.test(licensePage), 'Enterprise must inherit Advanced feature status');
});

test('quota lookup failure fails closed for server enforcement and UI limits', async () => {
  const { logger } = createLogger();
  const mockedRequire = (request) => request.endsWith('utils/logger')
    ? { createLogger: () => logger }
    : require(request);
  const serviceModule = loadTypeScript('../server/src/services/license-guard.ts', mockedRequire);
  const service = serviceModule.default({ strapi: {
    documents() { throw new Error('fake database failure'); },
  } });
  service.getEffectiveLicenseData = async () => fakeLicense;

  assert.equal((await service.canCreateBookmark('admin-owner', fakeLicense)).canCreate, false);
  assert.equal((await service.getLicenseLimits('admin-owner')).canCreate, false);
});

test('expired and inactive license flags never grant a paid bookmark quota', async () => {
  const { logger } = createLogger();
  const mockedRequire = (request) => request.endsWith('utils/logger')
    ? { createLogger: () => logger }
    : require(request);
  const serviceModule = loadTypeScript('../server/src/services/license-guard.ts', mockedRequire);

  for (const license of [
    { ...fakeLicense, isActive: false },
    { ...fakeLicense, isExpired: true },
  ]) {
    const service = serviceModule.default({ strapi: { licenseGuard: { data: license } } });
    service.getCurrentLicense = async () => license;
    assert.equal(await service.getBookmarkLimit(), 10);
  }
});

test('enterprise tier grants the same premium and advanced feature gates in the admin UI', () => {
  const { isAdvancedTier, isPremiumTier } = loadTypeScript('../admin/src/utils/licenseTier.ts');
  assert.equal(isPremiumTier('enterprise'), true);
  assert.equal(isAdvancedTier('enterprise'), true);
});

test('nested filter groups require the server-defined Advanced tier in each filter UI', () => {
  const advancedFilter = fs.readFileSync(path.join(__dirname, '../admin/src/components/AdvancedFilterButton.tsx'), 'utf8');
  const queryBuilder = fs.readFileSync(path.join(__dirname, '../admin/src/components/QueryBuilder.tsx'), 'utf8');
  const simpleModal = fs.readFileSync(path.join(__dirname, '../admin/src/components/SimpleAdvancedFilterModal.tsx'), 'utf8');

  assert.ok(/enableNestedGroups=\{isAdvanced\}/.test(advancedFilter), 'nested groups must not be enabled for Premium alone');
  assert.ok(/availableRelations=\{isAdvanced \? availableRelations : \[\]\}/.test(advancedFilter), 'deep relation fields must match the server Advanced gate');
  assert.ok(/isAdvanced \? 'Advanced Filter' : 'Filter'/.test(advancedFilter), 'the label must distinguish basic and Advanced-tier controls');
  assert.ok(/canUseSubGroups/.test(queryBuilder), 'query builder group controls must have a dedicated tier gate');
  assert.ok(/canUseSubGroups=\{isAdvanced\}/.test(simpleModal), 'simple query builder must match the Advanced tier');
  assert.ok(/tier="advanced"/.test(simpleModal), 'the upgrade prompt must name the required Advanced tier');
});

test('bookmark create and reorder actions are reachable and call the scoped API', () => {
  const homePage = fs.readFileSync(path.join(__dirname, '../admin/src/pages/HomePageModern.tsx'), 'utf8');
  const widget = fs.readFileSync(path.join(__dirname, '../admin/src/components/ViewsWidget.tsx'), 'utf8');

  assert.ok(/onClick=\{handleOpenContentManager\}/.test(homePage), 'dashboard create must route to a Content Manager view');
  const createHandler = homePage.match(/const handleOpenContentManager = \(\) => \{([\s\S]*?)\n  \};/);
  assert.ok(createHandler, 'dashboard create handler must be explicit');
  assert.match(createHandler[1], /navigate\('\/content-manager'\)/);
  assert.doesNotMatch(createHandler[1], /setShowModal\(true\)/, 'the dashboard has no Content Manager path to capture');
  assert.ok(/useRBAC\(pluginPermissions\.updateSettings\)/.test(homePage), 'management affordances must use the registered update permission');
  assert.ok(/useRBAC\(pluginPermissions\.updateSettings\)/.test(widget), 'content-manager create affordance must use the registered update permission');
  assert.ok(/canCreate: false/.test(homePage), 'create must stay disabled until server limits are known');
  assert.ok(/!licenseLimitsLoaded/.test(homePage), 'create handler and control must wait for the server limit response');
  assert.ok(/handleReorder/.test(homePage), 'owned bookmarks need a reorder handler');
  assert.ok(/bookmarks\/reorder/.test(homePage), 'reorder must call the scoped route');
  assert.ok(/Move bookmark (up|down)/.test(homePage), 'reorder controls need accessible names');
  assert.ok(/license\/limits/.test(widget), 'content-manager create affordance must load server limits');
  assert.ok(/canCreate/.test(widget), 'content-manager affordance must reflect the server create limit');
  assert.ok(/disabled=/.test(widget), 'content-manager create control must be disabled when unavailable');
});

test('bookmark reads retain intended sharing access without exposing creator email', async () => {
  const serviceModule = loadTypeScript('../server/src/services/service.ts');
  const bookmarks = [
    { documentId: 'owned', creatorId: 'viewer' },
    { documentId: 'direct', creatorId: 'direct-owner', sharedWithUsers: ['viewer'] },
    { documentId: 'role', creatorId: 'role-owner', sharedWithRoles: ['editor-role'] },
    { documentId: 'public', creatorId: 'public-owner', isPublic: true },
    { documentId: 'private', creatorId: 'private-owner' },
  ];
  const users = {
    viewer: { documentId: 'viewer', roles: [{ documentId: 'editor-role' }] },
  };
  const strapi = {
    documents(uid) {
      return {
        findOne: async ({ documentId }) => uid === 'admin::user'
          ? users[documentId] || { documentId, firstname: 'Fake', lastname: 'Owner', email: `${documentId}@example.test` }
          : bookmarks.find((bookmark) => bookmark.documentId === documentId),
        findMany: async () => bookmarks,
      };
    },
    log: { error() {}, debug() {} },
  };
  const service = serviceModule.default({ strapi });
  const visible = await service.findAll('viewer');

  assert.deepEqual(visible.map((bookmark) => bookmark.documentId).sort(), ['direct', 'owned', 'public', 'role']);
  assert.equal(visible.some((bookmark) => bookmark.createdBy?.email), false);
});

