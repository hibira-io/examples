// sql.js loads its WebAssembly file at run time: serve it from public/.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve('sql.js'));
mkdirSync('public', { recursive: true });
// The browser build asks for sql-wasm-browser.wasm.
copyFileSync(join(dist, 'sql-wasm-browser.wasm'), 'public/sql-wasm-browser.wasm');
