---
name: strapi-plugin-maintenance
description: Maintain Magic Mark (Magicmark), the free Strapi 5 bookmarks and advanced filters plugin, with reproducible checks.
---

# Magic Mark maintenance

Use Node 22 or 24. Read local rules and the workbench skills (docs-first, lint-required, strapi-plugin-api, strapi-plugin-security, strapi-admin-ui-ux, strapi-design-system). Never store credentials in skills, traces or Git; never push without an explicit request.

The plugin is free: there is no license system and there must never be outbound requests, timers or tracking. `tests/source-contract.test.cjs` enforces this.

Server: `server/src/routes/admin.ts` (every route has `admin::isAuthenticatedAdmin` plus `admin::hasPermissions`), `controllers/bookmarks.ts`, `services/bookmarks.ts` (access rules, sharing rows, per-user pins), `services/maintenance.ts` (3.x migrations, deletion cleanup), `validation.ts` (zod). Keep the route permission matrix in `tests/server-routes.test.cjs` and the README in sync. A bookmark the caller cannot see answers 404; a visible one owned by someone else answers 403 on writes.

Admin: Design System components and `@strapi/strapi/admin` APIs only, no custom styled components or colour literals. One injection in `listView.actions` (Advanced filters + Bookmarks), the bookmarks page, and the homepage widget. Every string uses `msg()` and exists in en, de, fr, es and pt (`tests/admin-i18n.test.cjs`); German copy does not address the reader.

Gates before a commit: `npm run lint`, `npm run format:check`, `npm test`, `npm run test:ts:front`, `npm run test:ts:back`, `npm run build`, `npm run verify`, `npm run verify:runtime`, `npm pack --dry-run`. For UI or permission changes also run the isolated host acceptance (own port, SQLite, synthetic data, egress blocked) with an RBAC matrix (anonymous, admin without permission, owner, other admin, manager) and the Playwright viewport matrix in light and dark mode.
