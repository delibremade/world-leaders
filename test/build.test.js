import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';

// P3d: pixi.js + pixi-viewport ship as lazily loaded chunks; the first paint (index.html) must not contain them.
test('build: pixi is a lazy chunk, index.html first paint excludes it, single-file build still has everything', () => {
  execFileSync('node', ['scripts/build.js'], { stdio: 'pipe' });
  const html = readFileSync('dist/index.html', 'utf8'); const one = statSync('dist/world-leaders.html').size;
  const chunks = readdirSync('dist/chunks');
  assert.match(html, /import\("\.\/chunks\/pixi-map-[\w-]+\.js"\)/, 'pixi-map is a dynamic import');
  assert.doesNotMatch(html, /(?:from|import)\s*"\.\/chunks\/(?:pixi|lib|Web|browser|Canvas|Bitmap)/, 'no static import of a pixi chunk');
  assert.doesNotMatch(html, /WebGLRenderer|ViewportPlugin|class\s+\w*Viewport|GlProgram/, 'renderer code is not inlined');
  assert.ok(chunks.some((f) => /^pixi_viewport-/.test(f)) && chunks.some((f) => /^pixi-map-/.test(f)), 'lazy chunks written');
  const lazy = chunks.reduce((s, f) => s + statSync(`dist/chunks/${f}`).size, 0);
  assert.ok(Buffer.byteLength(html) < one * 0.6, `first paint ${Buffer.byteLength(html)} vs single ${one}`);
  assert.ok(lazy > 700 * 1024, `lazy chunks hold pixi (${lazy} bytes)`);
  // V2a fonts: the Pages build points at its own fonts/ files, the single file embeds them; neither asks the network.
  const fontsDir = readdirSync('dist/fonts'); assert.ok(fontsDir.length >= 7 && fontsDir.every((f) => f.endsWith('.woff2')), `dist/fonts ${fontsDir}`);
  for (const f of fontsDir) assert.match(html, new RegExp(`url\\(fonts/${f.replace('.', '\\.')}\\)`), `index.html references ${f}`);
  const single = readFileSync('dist/world-leaders.html', 'utf8');
  assert.equal((single.match(/data:font\/woff2;base64,/g) || []).length, fontsDir.length, 'single file embeds every font');
  assert.doesNotMatch(single, /url\(fonts\//); assert.doesNotMatch(html + single, /fonts\.(googleapis|gstatic)\.com/);
});
