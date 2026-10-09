// Bundles src/legacy-entry.jsx (v57 as-is) into ONE self-contained dist/index.html for GitHub Pages.
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';

export const legacyBuildOptions = {
  entryPoints: ['src/legacy-entry.jsx'], bundle: true, write: false, format: 'iife', minify: true,
  jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, target: ['es2020'], logLevel: 'silent',
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const js = (await build(legacyBuildOptions)).outputFiles[0].text;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>World Leaders</title>
<style>html,body{height:100%;margin:0;background:#06090d}*{box-sizing:border-box}</style></head><body><div id="root"></div>
<script>${js.replace(/<\/script>/g, '<\\/script>')}</script>
</body></html>`;
  mkdirSync('dist', { recursive: true });
  writeFileSync('dist/index.html', html);
  console.log(`dist/index.html ${(html.length / 1024).toFixed(0)} KB`);
}
