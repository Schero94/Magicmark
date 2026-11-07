/**
 * Extracts every plugin message from admin/src: `msg('key', 'Default')` calls and the
 * `${pluginId}.key` descriptors in admin/src/index.ts. Prints `{ key: defaultMessage }` as JSON.
 * Used by tests/admin-i18n.test.cjs and to refresh translations/en.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'admin', 'src');

/** Recursively lists .ts/.tsx files. */
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });

const unquote = (literal) => literal.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
const STRING = String.raw`('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")`;
const MSG = new RegExp(String.raw`msg\(\s*${STRING}\s*,\s*${STRING}\s*,?\s*\)`, 'g');
const DESCRIPTOR = new RegExp(
  String.raw`id:\s*\`\$\{pluginId\}\.([\w.]+)\`\s*,\s*defaultMessage:\s*${STRING}`,
  'g'
);

export const extractMessages = () => {
  const messages = {};
  const conflicts = [];
  const add = (key, value, file) => {
    if (key in messages && messages[key] !== value) conflicts.push({ key, file });
    messages[key] = value;
  };
  for (const file of walk(root)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(MSG)) add(unquote(match[1]), unquote(match[2]), file);
    for (const match of source.matchAll(DESCRIPTOR)) add(match[1], unquote(match[2]), file);
  }
  return { messages, conflicts };
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { messages, conflicts } = extractMessages();
  if (conflicts.length) {
    console.error('Conflicting defaults:', conflicts);
    process.exit(1);
  }
  const sorted = Object.fromEntries(
    Object.entries(messages).sort(([a], [b]) => a.localeCompare(b))
  );
  process.stdout.write(`${JSON.stringify(sorted, null, 2)}\n`);
}
