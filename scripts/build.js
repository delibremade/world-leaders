// Bundles src/ui/main.jsx (v57 UI on the src/sim engine) two ways. No external requests; fonts fall back to the system stack.
//  dist/index.html            first paint: React + game inline; pixi.js + pixi-viewport load lazily from dist/chunks/ (GitHub Pages)
//  dist/world-leaders.html    one self-contained file with everything inline (artifact publish, offline)
import { build } from 'esbuild';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { shell } from './shell.js';

const common = { entryPoints: ['src/ui/main.jsx'], bundle: true, write: false, minify: true, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, target: ['es2020'] };
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
rmSync('dist', { recursive: true, force: true }); mkdirSync('dist/chunks', { recursive: true });

const single = await build({ ...common, format: 'iife' });
const one = shell(single.outputFiles[0].text);
writeFileSync('dist/world-leaders.html', one);

// Split build: ESM entry inlined into index.html; every other output (the pixi chunk, any shared chunk) is a file under chunks/.
const split = await build({ ...common, format: 'esm', splitting: true, outdir: 'dist', chunkNames: 'chunks/[name]-[hash]', entryNames: 'entry' });
const entry = split.outputFiles.find((f) => f.path.endsWith('/entry.js'));
const chunks = split.outputFiles.filter((f) => f !== entry);
for (const f of chunks) writeFileSync(f.path, f.contents);
// The inline module resolves './chunks/..' against the page URL, so the entry's own imports must be rewritten from entry-relative to page-relative (same dir: no change).
const html = shell(entry.text).replace('<script>', '<script type="module">');
writeFileSync('dist/index.html', html);

// First paint = index.html plus every chunk reachable through static imports (anything only import()ed is lazy).
const staticDeps = (text, base) => [...text.matchAll(/(?:from|import)\s*"(\.\/[^"]+\.js)"/g)].map((m) => base + m[1].slice(2));
const eager = []; const walk = (names) => { for (const n of names) { const f = chunks.find((c) => c.path.endsWith(`/${n}`)); if (f && !eager.includes(f)) { eager.push(f); walk(staticDeps(f.text, 'chunks/'));} } };
walk(staticDeps(entry.text, ''));
const first = Buffer.byteLength(html) + eager.reduce((s, f) => s + f.contents.length, 0);
const firstGz = gzipSync(Buffer.from(html), { level: 9 }).length + eager.reduce((s, f) => s + gzipSync(f.contents, { level: 9 }).length, 0);
const lazy = chunks.filter((f) => !eager.includes(f));
console.log(`dist/world-leaders.html ${kb(one.length)} (${kb(gzipSync(Buffer.from(one), { level: 9 }).length)} gz)`);
console.log(`dist/index.html first paint ${kb(first)} (${kb(firstGz)} gz); lazy ${lazy.map((f) => `${f.path.split('/').pop()} ${kb(f.contents.length)} (${kb(gzipSync(f.contents, { level: 9 }).length)} gz)`).join(', ') || 'none'}`);
if (!lazy.length) { console.error('no lazy chunk: pixi.js is still in the first paint'); process.exit(1); }
