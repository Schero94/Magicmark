---
name: strapi-plugin-maintenance
description: Maintain Magicmark Strapi 5 bookmarks, sharing, license UI and conditional access with reproducible checks.
---

# Magicmark maintenance

Use Node 22. Read local rules, query current Strapi 5 plugin/route/permission and Design System docs through Context7, and compare newest compatible 5.x with the workbench pin. Do not store credentials or license keys in skills, traces or Git; never push without an explicit request.

Trace both `server/src/routes/admin.ts` and `server/routes/admin.js`, the controller/services and `admin/src/permissions.ts`. Routes and menu links currently use empty `policies`/`permissions`; do not assume this means unauthenticated access, but prove the admin auth scope and role/permission boundary at runtime. Make a matrix for anonymous, admin lacking permission, allowed admin, bookmark owner and another admin. Check create/reorder/pin/share/delete ownership, role visibility, license key writes and limits server-side. Preserve the intentional share semantics while denying cross-user modification.

For UI changes, first read the workbench root skill's `references/ui-ux-standards.md`; it defines the shared responsive, alignment, readable-copy, accessibility and Playwright acceptance checks. Use Strapi 5 Design System, permission-backed menu and accessible bookmark actions, empty/error/loading states and responsive query-builder layout. Run `npm run build`, `npm run verify`, `npm run test:ts:front`, `npm run test:ts:back`, plus focused owner/deny tests; then shared app build/boot and Playwright CLI navigation. Do not present successful typechecks as proof of authorization.

## Shared product quality contract

Use spec-first development: define acceptance criteria and API response/error contracts before implementation.

Follow the detailed JSDoc contract in the always-applied plugin rule for new and substantially changed exported or non-trivial functions, handlers, services, hooks, middleware, policies and components. Document purpose, context, applicable `@param` and `@returns`, and only actually propagated `@throws`. Verify HTTP `@route`, access, inputs and outcomes against the implementation; describe applicable mutations and security/privacy effects with `@sideeffect`. These are custom tags; respect configured tools, never invent behavior, and update comments when contracts change.

Every behavior change starts with a written current-state and target-state analysis covering screens, controls, routes, roles, data, known gaps and non-goals. Define acceptance criteria and API response/error contracts before implementation, then add a failing regression test first. A primary task should take no more than four meaningful user interactions from the plugin entry page; exclude login and mandatory security confirmations, and measure and document any justified exception. Use the Strapi Design System, responsive layouts, keyboard accessibility and explicit loading, empty, success and error states. Enforce authentication, plugin permissions, validation and owner boundaries server-side. Keep API error contracts consistent within each Strapi surface and never return stack traces or internal details. Do not log secrets, tokens, cookies, request bodies, email, IP or stable user/session identifiers. Use fakes for providers and record unverified behavior accurately.
