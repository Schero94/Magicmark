## [3.2.6](https://github.com/Schero94/Magicmark/compare/v3.2.5...v3.2.6) (2025-12-14)


### Bug Fixes

* update package-lock.json for CI compatibility ([92b2d0d](https://github.com/Schero94/Magicmark/commit/92b2d0d2bd4e9eb3458358fb1af1baffe25b92e8))

## [3.2.5](https://github.com/Schero94/Magicmark/compare/v3.2.4...v3.2.5) (2025-12-14)


### Bug Fixes

* clean up README formatting ([fd31589](https://github.com/Schero94/Magicmark/commit/fd3158927ab3f671c70b93ff254e775d163a1d28))

## [3.2.4](https://github.com/Schero94/Magicmark/compare/v3.2.3...v3.2.4) (2025-12-14)


### Bug Fixes

* update optionalDependencies for CI compatibility ([fef0c25](https://github.com/Schero94/Magicmark/commit/fef0c25681577f86e6bd9c8f390e22c3964ab5d2))

## [3.2.3](https://github.com/Schero94/Magicmark/compare/v3.2.2...v3.2.3) (2025-12-14)


### Bug Fixes

* enable npm provenance with OIDC trusted publishing ([9b72e83](https://github.com/Schero94/Magicmark/commit/9b72e8324ebb953f9efd8bf2459d9d8b9b031e2d))

## [3.2.2](https://github.com/Schero94/Magicmark/compare/v3.2.1...v3.2.2) (2025-12-14)


### Bug Fixes

* update release workflow for new npm token requirements ([ae2c41a](https://github.com/Schero94/Magicmark/commit/ae2c41a303f95c06219a9046e55f18a25087aa0f))

## [3.2.1](https://github.com/Schero94/Magicmark/compare/v3.2.0...v3.2.1) (2025-12-14)


### Bug Fixes

* add debug mode documentation to README ([f9ba17a](https://github.com/Schero94/Magicmark/commit/f9ba17a8c0aa5aa3d6357909d8db91bcccc3a5e6))
* add debug mode for plugin logging ([3bc45ba](https://github.com/Schero94/Magicmark/commit/3bc45ba8023dc7676603b46974884c22bb68c6dd))

# [3.2.0](https://github.com/Schero94/Magicmark/compare/v3.1.0...v3.2.0) (2025-12-08)


### Features

* enhance pull request template with query builder specific sections and filter testing checklist ([4c45c89](https://github.com/Schero94/Magicmark/commit/4c45c896e488cdfdb901bcb1d350b90749e36759))

# [3.1.0](https://github.com/Schero94/Magicmark/compare/v3.0.3...v3.1.0) (2025-12-08)


### Features

* enhance GitHub issue templates with query builder specific fields and feature request template ([468275b](https://github.com/Schero94/Magicmark/commit/468275b15fcf6faf3691b3c5fb33020cb706b370))

## [3.0.3](https://github.com/Schero94/Magicmark/compare/v3.0.2...v3.0.3) (2025-12-08)


### Bug Fixes

* update CI workflow to use Node.js 22 for compatibility with dependencies ([bc20bd0](https://github.com/Schero94/Magicmark/commit/bc20bd008d499840fe20f9148a82071edb6d494f))

## [3.0.2](https://github.com/Schero94/Magicmark/compare/v3.0.1...v3.0.2) (2025-12-08)


### Bug Fixes

* add GitHub templates for better open-source collaboration ([2477e70](https://github.com/Schero94/Magicmark/commit/2477e706c924a925a66435121a0a1bee31cad14b))

## [3.0.1](https://github.com/Schero94/Magicmark/compare/v3.0.0...v3.0.1) (2025-12-04)


### Bug Fixes

* **ci:** run build before verify in GitHub Actions ([707403e](https://github.com/Schero94/Magicmark/commit/707403e4de20ce5acc21bb4e4c98305063d2f209))

# [3.0.0](https://github.com/Schero94/Magicmark/compare/v2.0.0...v3.0.0) (2025-12-04)


### Features

* migrate to Strapi v5 Document Service API ([816806c](https://github.com/Schero94/Magicmark/commit/816806c293033643515f29491b6329c0a606f5f8))


### BREAKING CHANGES

* Schema field changes
- Renamed createdBy/updatedBy to creatorId/updaterId (string fields)
- Removed relation dependency on admin::user

Changes:
- Migrated all services from entityService to strapi.documents()
- Migrated controllers from db.query to strapi.documents()
- Removed all emojis from server logs (replaced with [TAG] format)
- Added proper JSDoc documentation to all functions
- Fixed relation handling (now uses string documentIds)
- Added entityService as documented fallback for admin::user
- Updated content-types schema for Strapi v5 compliance

Strapi v5 Rules Compliance:
- strapi.db.query() = 0 (FORBIDDEN)
- strapi.entityService = 1 (fallback only)
- strapi.documents() = 9+ (RECOMMENDED)
- Emojis in code = 0 (NONE)
- JSDoc comments = 41 blocks

# [2.0.0](https://github.com/Schero94/Magicmark/compare/v1.3.1...v2.0.0) (2025-11-01)


### Features

* Migrate repository to Schero94/Magicmark ([e98e473](https://github.com/Schero94/Magicmark/commit/e98e47382c670c98b86b288650321e5c237a5cba))


### BREAKING CHANGES

* Repository location has changed to github.com/Schero94/Magicmark

## [1.3.1](https://github.com/fame361/Magicmark/compare/v1.3.0...v1.3.1) (2025-10-28)


### Bug Fixes

* Correct author name to Schero D. ([aa41c5a](https://github.com/fame361/Magicmark/commit/aa41c5a0e77f2a4d3218a8b15e169683393d0522))

# [1.3.0](https://github.com/fame361/Magicmark/compare/v1.2.0...v1.3.0) (2025-10-28)


### Features

* Complete production release with screenshots ([005cbea](https://github.com/fame361/Magicmark/commit/005cbea5f6080594287d858ae6708852ee921903))

# [1.2.0](https://github.com/fame361/Magicmark/compare/v1.1.0...v1.2.0) (2025-10-28)


### Features

* Production ready with corrected NPM token ([b702a04](https://github.com/fame361/Magicmark/commit/b702a04e96e635ba1dcad31e77dc0e01073c18d1))

# [1.1.0](https://github.com/fame361/Magicmark/compare/v1.0.0...v1.1.0) (2025-10-28)


### Features

* Ready for NPM - Complete Strapi v5 plugin ([75ae6c5](https://github.com/fame361/Magicmark/commit/75ae6c5d1620a704d59ea1531648630e4b0cf6a9))

# 1.0.0 (2025-10-28)


### Bug Fixes

* Add all semantic-release plugins as devDependencies ([0781cf1](https://github.com/fame361/Magicmark/commit/0781cf131619cafd4d81616941b3b685413eb835))
* Add platform-specific SWC binaries for GitHub Actions ([d8c942f](https://github.com/fame361/Magicmark/commit/d8c942fdbd5a21eccc14a65f0de2cc04bafd302e))
* Add rollup platform binaries for CI/CD ([e6944f8](https://github.com/fame361/Magicmark/commit/e6944f8c689f69fb3a04923fbe05a85495abf431))
* Update package-lock.json for semantic-release ([76014b5](https://github.com/fame361/Magicmark/commit/76014b503894a4cfeb5b080d9e2e7fa9870a1e23))
* Update repository URLs to fame361/Magicmark ([2554a24](https://github.com/fame361/Magicmark/commit/2554a24882207c7b1b0d2a2a12563798785ec201))


### Features

* Initial release of MagicMark v1.0.0 ([e8b0b88](https://github.com/fame361/Magicmark/commit/e8b0b888f229d85867f88e36e6390ce7cbdc91e7))
