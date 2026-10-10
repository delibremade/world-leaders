// 390px screenshots of the App surfaces for PR evidence (CLAUDE.md "Definition of done").
// Headless Chromium through Playwright; not part of the gate. Playwright is not a project dependency:
//   NODE_PATH=$(npm root -g) node scripts/screens.js [scenario ...]      (global playwright + a Chromium)
// Outputs reports/screens/<scenario>.png at 390x844, 2x. Each scenario drives the real bundle (no mocks).
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { bundle, BUNDLES } from '../test/util/harness.js';
import { shell } from './shell.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { console.error('playwright not resolvable; run with NODE_PATH=$(npm root -g)'); process.exit(2); }

const OUT = 'reports/screens';
const VIEWPORT = { width: 390, height: 844 };
const settle = (page, ms = 250) => page.waitForTimeout(ms);
const click = async (page, text, nth = 0) => { await page.locator(`button:has-text("${text}")`).nth(nth).click(); await settle(page); };
const startUSA = async (page) => { await page.locator('.cc').first().click(); await settle(page, 400); };
const months = async (page, n) => { await page.evaluate((n) => { for (let i = 0; i < n; i++) window.__wl?.month?.(); }, n); await settle(page, 400); };

// scenario -> async (page) => void, run after the title screen is up with window.__WL_TEST = true.
export const SCENARIOS = {
  'p3a-title': async () => {},
  'p3a-hud': async (page) => { await startUSA(page); await page.locator('text=Choose Your National Doctrine').waitFor(); await click(page, 'Military Superpower').catch(() => page.locator('text=Military Superpower').first().click()); await settle(page, 400); },
};

export async function run(names) {
  const js = await bundle(BUNDLES.app);
  const html = shell(js);
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const results = [];
  try {
    for (const name of names) {
      const fn = SCENARIOS[name]; if (!fn) { console.error('unknown scenario', name); continue; }
      const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
      await page.addInitScript(() => { window.__WL_TEST = true; });
      await page.setContent(html, { waitUntil: 'load' });
      await settle(page, 300);
      await fn(page);
      const file = `${OUT}/${name}.png`;
      await page.screenshot({ path: file, fullPage: false });
      results.push({ name, file, errors });
      console.log(file, errors.length ? 'ERRORS: ' + errors.join(' | ') : 'ok');
      await ctx.close();
    }
  } finally { await browser.close(); }
  writeFileSync(`${OUT}/last-run.json`, JSON.stringify(results, null, 2));
  return results;
}

if (process.argv[1] && process.argv[1].endsWith('screens.js')) {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENARIOS);
  run(names).then((r) => process.exit(r.some((x) => x.errors.length) ? 1 : 0));
}
