import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { FONTS, FAMILIES, fontFaceCss } from '../scripts/fonts.js';
import { FONT } from '../src/ui/tokens.js';
import { shell } from '../scripts/shell.js';
import { bundle, BUNDLES } from './util/harness.js';
import { launch, settle } from './util/browser.js';

// V2a type (docs/DESIGN-SYSTEM-V2.md §2): Barlow Condensed, Inter and JetBrains Mono ship with the app, self-hosted under
// assets/fonts (SIL OFL, license files beside them), with @font-face font-display:swap, and no external request.

test('fonts: every manifest file and license exists; the token stacks lead with the shipped families; no external URL', () => {
  for (const f of FONTS) { const p = `assets/fonts/${f.file}`; assert.ok(existsSync(p), p); assert.ok(statSync(p).size > 10000 && statSync(p).size < 200000, `${p} is a subset woff2`); assert.equal(readFileSync(p).subarray(0, 4).toString('latin1'), 'wOF2', `${p} is woff2`); }
  for (const l of ['LICENSE-Barlow.txt', 'LICENSE-Inter.txt', 'LICENSE-JetBrainsMono.txt']) assert.match(readFileSync(`assets/fonts/${l}`, 'utf8'), /SIL Open Font License|SIL OPEN FONT LICENSE/i, l);
  assert.deepEqual(FAMILIES, ['Barlow Condensed', 'Inter', 'JetBrains Mono']);
  assert.match(FONT.display, /^'Barlow Condensed'/); assert.match(FONT.sans, /^Inter/); assert.match(FONT.mono, /^'JetBrains Mono'/);
  const rel = fontFaceCss(); assert.equal((rel.match(/@font-face/g) || []).length, FONTS.length);
  assert.doesNotMatch(rel, /https?:/, 'no external request'); assert.match(rel, /font-display:swap/); assert.match(rel, /url\(fonts\/Inter-Regular\.woff2\) format\("woff2"\)/);
  const inl = fontFaceCss({ inline: true }); assert.equal((inl.match(/data:font\/woff2;base64,/g) || []).length, FONTS.length); assert.doesNotMatch(inl, /https?:|url\(fonts\//);
  assert.match(shell('1', { head: inl }), /<style>@font-face\{font-family:"Barlow Condensed"/);
  assert.doesNotMatch(shell('1'), /@font-face/, 'the plain shell (legacy build, test harness) carries no fonts');
});

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

test('Chromium: the single-file page loads all three families from its own bytes and the HUD renders in them', async () => {
  const html = shell(await bundle(BUNDLES.app), { head: fontFaceCss({ inline: true }) }).replace('<script>', '<script>window.__WL_TEST=true;</script><script>');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const page = await ctx.newPage();
  const requests = []; page.on('request', (r) => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
  try {
    await page.setContent(html, { waitUntil: 'load' }); await settle(page, 300);
    await page.locator('.cc').first().click(); await settle(page, 500);
    const r = await page.evaluate(async () => {
      await document.fonts.ready;
      const faces = [...document.fonts].map((f) => `${f.family}:${f.weight}:${f.status}`).sort();
      const ok = { display: document.fonts.check('600 14px "Barlow Condensed"'), sans: document.fonts.check('400 14px Inter'), mono: document.fonts.check('600 14px "JetBrains Mono"') };
      const num = document.querySelector('.wl-fig-v'); const label = document.querySelector('.wl-label');
      return { faces, ok, num: num && getComputedStyle(num).fontFamily, label: label && getComputedStyle(label).fontFamily };
    });
    assert.deepEqual(r.ok, { display: true, sans: true, mono: true }, JSON.stringify(r.faces));
    assert.match(r.num || '', /JetBrains Mono/, 'numbers are mono'); assert.match(r.label || '', /Barlow Condensed/, 'labels are the display face');
    assert.deepEqual(requests, [], 'no network request');
  } finally { await ctx.close(); }
});
