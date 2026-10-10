// jsdom-free map bench: real Chromium (SwiftShader WebGL, no GPU) pans the PixiJS map for 3s and reports fps.
// Not part of the gate; software GL is a floor, a phone GPU is faster. Usage:
//   NODE_PATH=$(npm root -g) node scripts/map-bench.js            -> reports/map-bench.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { bundle, BUNDLES } from '../test/util/harness.js';
import { shell } from './shell.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const html = shell(await bundle(BUNDLES.app)).replace('<script>', '<script>window.__WL_TEST=true;</script><script>');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const out = { viewport: { width: 390, height: 844, dpr: 2 }, runs: [] };
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.setContent(html, { waitUntil: 'load' });
  await page.locator('.cc').first().click();
  await page.locator('text=Military Superpower').first().click();
  await page.waitForFunction(() => window.__wlMap?.renderer === 'pixi', null, { timeout: 15000 });
  await page.waitForTimeout(500);
  for (const mode of ['sphere', 'tension', 'military']) {
    await page.locator(`[data-map-mode-btn=${mode}]`).click();
    await page.waitForTimeout(200);
    const r = await page.evaluate(async (mode) => {
      const m = window.__wlMap; m.zoom(1.2);
      const start = performance.now(); const f0 = m.frames(); let raf = 0; let dir = 1;
      await new Promise((res) => { const step = () => { raf++; m.pan(dir * 3, dir * 1.2); if (raf % 90 === 0) dir = -dir; if (performance.now() - start < 3000) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
      const ms = performance.now() - start;
      return { mode, ms: Math.round(ms), rafFps: +(raf * 1000 / ms).toFixed(1), tickerFps: +((m.frames() - f0) * 1000 / ms).toFixed(1), scale: +m.scale().toFixed(2) };
    }, mode);
    out.runs.push(r); console.log(JSON.stringify(r));
  }
  out.errors = errors;
  out.ua = await page.evaluate(() => navigator.userAgent);
  out.gl = await page.evaluate(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl2'); const d = gl?.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'n/a'; });
  await ctx.close();
} finally { await browser.close(); }
mkdirSync('reports', { recursive: true });
writeFileSync('reports/map-bench.json', JSON.stringify(out, null, 2));
console.log('gl:', out.gl, 'errors:', out.errors.length);
