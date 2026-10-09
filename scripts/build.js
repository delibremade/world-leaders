// Bundles src/ui/main.jsx into ONE self-contained HTML file for publishing as a claude.ai artifact.
// Output: dist/world-leaders.html (no external requests; fonts fall back to system stack).
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';

const r = await build({
  entryPoints: ['src/ui/main.jsx'], bundle: true, write: false, format: 'iife', minify: true,
  jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, target: ['es2020'],
});
const js = r.outputFiles[0].text;
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>World Leaders</title>
<style>
:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);--bg:#f6f4ef;--fg:#1a1a1a}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#111;--fg:#eee}}
:root[data-theme="dark"]{--bg:#111;--fg:#eee}
html,body{height:100%;margin:0;background:var(--bg);color:var(--fg)}
</style></head><body><div id="root"></div>
<script>${js.replace(/<\/script>/g, '<\\/script>')}</script>
</body></html>`;
mkdirSync('dist', { recursive: true });
writeFileSync('dist/world-leaders.html', html);
console.log(`dist/world-leaders.html ${(html.length / 1024).toFixed(0)} KB`);
