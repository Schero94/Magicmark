---
name: strapi-plugin-maintenance
description: Maintain Magicmark Strapi 5 bookmarks, sharing, license UI and conditional access with reproducible checks.
---

# Magicmark maintenance

Use Node 22. Read local rules, query current Strapi 5 plugin/route/permission and Design System docs through Context7, and compare newest compatible 5.x with the workbench pin. Do not store credentials or license keys in skills, traces or Git; never push without an explicit request.

Trace both `server/src/routes/admin.ts` and `server/routes/admin.js`, the controller/services and `admin/src/permissions.ts`. Routes and menu links currently use empty `policies`/`permissions`; do not assume this means unauthenticated access, but prove the admin auth scope and role/permission boundary at runtime. Make a matrix for anonymous, admin lacking permission, allowed admin, bookmark owner and another admin. Check create/reorder/pin/share/delete ownership, role visibility, license key writes and limits server-side. Preserve the intentional share semantics while denying cross-user modification.

Use Strapi 5 Design System, permission-backed menu and accessible bookmark actions, empty/error/loading states and responsive query-builder layout. Run `npm run build`, `npm run verify`, `npm run test:ts:front`, `npm run test:ts:back`, plus focused owner/deny tests; then shared app build/boot and Playwright CLI navigation. Do not present successful typechecks as proof of authorization.
