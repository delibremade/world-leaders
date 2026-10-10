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
const inGame = async (page) => { await startUSA(page); await page.locator('text=Military Superpower').first().click(); await settle(page, 400); await page.waitForFunction(() => window.__wlMap, null, { timeout: 15000 }).catch(() => {}); await settle(page, 400); };
const pause = async (page) => { await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent === '⏸')?.click()); await settle(page, 200); };
const showMap = async (page) => { await page.evaluate(() => document.querySelector('[data-map]')?.scrollIntoView({ block: 'start' })); await settle(page, 400); };
const months = async (page, n) => { await page.evaluate((n) => { for (let i = 0; i < n; i++) window.__wl?.month?.(); }, n); await settle(page, 400); };

// scenario -> async (page) => void, run after the title screen is up with window.__WL_TEST = true.
export const SCENARIOS = {
  'p3a-title': async () => {},
  'p3a-hud': async (page) => { await startUSA(page); await page.locator('text=Choose Your National Doctrine').waitFor(); await click(page, 'Military Superpower').catch(() => page.locator('text=Military Superpower').first().click()); await settle(page, 400); },
  // P3b: the PixiJS map in each mode, a tapped region, and a disrupted chokepoint + flashpoint via the test hook.
  // DOM-level clicks: the v57 column scrolls inside overflow:hidden, which defeats Playwright's actionability scroll.
  ...Object.fromEntries(['sphere', 'tension', 'trade', 'energy', 'military', 'intel'].map((mode) => [`p3b-map-${mode}`, async (page) => {
    await inGame(page); await page.evaluate(() => { const h = window.__wl; h.setTension('russia', 82); h.setTension('china', 55); h.deploy('ME', 'carrier', 2); h.event('hormuz_closure', 3); });
    await settle(page, 4500); await pause(page);
    await page.evaluate((mode) => document.querySelector(`[data-map-mode-btn=${mode}]`).click(), mode); await settle(page, 600); await showMap(page);
  }])),
  'p3b-map-tap': async (page) => { await inGame(page); await pause(page); await showMap(page); const box = await page.locator('[data-map] canvas').boundingBox(); await page.mouse.click(box.x + box.width * 0.62, box.y + box.height * 0.42); await settle(page, 600); await showMap(page); },
  // P3c: shell surfaces. The HUD + cards + nav are on every screen; the sheet, outliner and why open on demand.
  'p3c-hud-cards': async (page) => { await startUSA(page); await settle(page, 600); },
  'p3c-why': async (page) => { await inGame(page); await pause(page); await page.evaluate(() => document.querySelector('[data-why^="Treasury"]').click()); await settle(page, 500); },
  'p3c-region-sheet': async (page) => { await inGame(page); await pause(page); await showMap(page); await page.evaluate(() => window.__wlMap.tapRegion('ME')); await settle(page, 900); },
  'p3c-nation-sheet': async (page) => { await inGame(page); await pause(page); await showMap(page); await page.evaluate(() => window.__wlMap.tapRegion('ME')); await settle(page, 900); await page.evaluate(() => document.querySelector('[data-nation-row]')?.click()); await settle(page, 900); },
  'p3c-outliner': async (page) => { await inGame(page); await page.evaluate(() => { const h = window.__wl; h.setTension('russia', 82); h.deploy('ME', 'carrier', 2); h.event('red_sea_attacks', 6); }); await settle(page, 4500); await pause(page); await page.evaluate(() => document.querySelector('[data-outliner-handle]').click()); await settle(page, 700); },
  'p3c-event-cards': async (page) => { await startUSA(page); await page.evaluate(() => { const h = window.__wl; h.setTension('russia', 82); h.event('pandemic', 6); }); await settle(page, 4500); await pause(page); },
  'p3c-desktop': async (page) => { await page.setViewportSize({ width: 1280, height: 800 }); await inGame(page); await pause(page); await settle(page, 600); },
};

// P3d: Overview map-first, HUD, nav, and the six map modes at 390 and 1280.
const desk = (page) => page.setViewportSize({ width: 1280, height: 800 });
const mode = async (page, m) => { await page.evaluate((m) => document.querySelector(`[data-map-mode-btn=${m}]`).click(), m); await settle(page, 700); };
for (const [tag, setup] of [['390', async () => {}], ['1280', desk]]) {
  SCENARIOS[`p3d-overview-${tag}`] = async (page) => { await setup(page); await inGame(page); await page.evaluate(() => { const h = window.__wl; h.setTension('russia', 82); h.deploy('ME', 'carrier', 2); h.event('hormuz_closure', 3); }); await settle(page, 4500); await pause(page); await page.evaluate(() => document.querySelector('[data-tab=economy]').click()); await settle(page, 300); await page.evaluate(() => document.querySelector('[data-tab=overview]').click()); await settle(page, 600); };
  for (const m of ['sphere', 'tension', 'trade', 'energy', 'military', 'intel']) SCENARIOS[`p3d-map-${m}-${tag}`] = async (page) => { await setup(page); await inGame(page); await page.evaluate(() => { const h = window.__wl; h.setTension('russia', 82); h.setTension('china', 55); h.deploy('ME', 'carrier', 2); h.event('hormuz_closure', 3); }); await settle(page, 4500); await pause(page); await mode(page, m); };
}
SCENARIOS['p3d-hud-doctrine-390'] = async (page) => { await startUSA(page); await settle(page, 700); };
SCENARIOS['p3d-nav-econ-390'] = async (page) => { await inGame(page); await pause(page); await page.evaluate(() => document.querySelector('[data-tab=technology]').click()); await settle(page, 500); };

export async function run(names) {
  const js = await bundle(BUNDLES.app);
  const html = shell(js).replace('<script>', '<script>window.__WL_TEST=true;</script><script>'); // init scripts do not reach setContent pages
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const results = [];
  try {
    for (const name of names) {
      const fn = SCENARIOS[name]; if (!fn) { console.error('unknown scenario', name); continue; }
      const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
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
