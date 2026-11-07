/**
 * ESLint flat config for strapi-plugin-magic-mark (ESLint 10, typescript-eslint 8).
 *
 * - `@eslint/js` recommended rules for every linted file.
 * - TypeScript (admin and server): typescript-eslint recommended rules.
 * - Admin panel: browser globals, JSX, React Hooks recommended rules.
 * - Server: Node globals, `strapi` as a readonly global.
 * - Tests and scripts: Node globals, module type per file extension.
 * - `eslint-config-prettier` last, so formatting stays with Prettier.
 *
 * eslint-plugin-jsx-a11y is not used: its latest release (6.10.2) declares
 * `eslint: ^3 || ... || ^9` as peer range and does not support ESLint 10.
 */
import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const unusedVars = [
  'error',
  { argsIgnorePattern: '^_', ignoreRestSiblings: true, reportUsedIgnorePattern: true },
];

export default defineConfig([
  globalIgnores(['dist/', 'node_modules/', 'pics/', 'docs/site/img/', 'coverage/']),

  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    extends: [js.configs.recommended],
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: { 'no-unused-vars': unusedVars },
  },

  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': unusedVars,
    },
  },

  // Admin panel (React, browser)
  {
    files: ['admin/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
  },

  // Server (Node). Strapi provides the `strapi` global at runtime.
  {
    files: ['server/**/*.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, strapi: 'readonly' },
    },
  },

  // CommonJS entry files, scripts and tests
  {
    files: ['strapi-admin.js', 'strapi-server.js', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  // Playwright evaluate callbacks run in the browser
  {
    files: ['scripts/acceptance/**/*.cjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },

  prettier,
]);
