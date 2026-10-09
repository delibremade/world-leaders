// Bundles src/ui/main.jsx (v57 UI on the src/sim engine) into ONE self-contained dist/world-leaders.html.
// No external requests; fonts fall back to the system stack.
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { shell } from './shell.js';

const r = await build({
  entryPoints: ['src/ui/main.jsx'], bundle: true, write: false, format: 'iife', minify: true,
  jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, target: ['es2020'],
});
const html = shell(r.outputFiles[0].text);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/world-leaders.html', html);
console.log(`dist/world-leaders.html ${(html.length / 1024).toFixed(0)} KB`);
