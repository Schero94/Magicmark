'use strict';

/**
 * Lets `require()` load the plugin's TypeScript sources in `node --test`: every `.ts`/`.tsx`
 * file is transpiled to CommonJS with the TypeScript compiler (no type checking here; the
 * `test:ts:*` scripts do that). Node's own type stripping is bypassed on purpose so ESM
 * `export` syntax in the sources works under `require`.
 */
const fs = require('node:fs');
const ts = require('typescript');

const compile = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  module._compile(outputText, filename);
};

require.extensions['.ts'] = compile;
require.extensions['.tsx'] = compile;
