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
try { ({ chromium } = require('playwright')); } catch { try { ({ chromium } = require('playwright-core')); } catch { console.error('playwright not resolvable; run with NODE_PATH=$(npm root -g)'); process.exit(2); } }

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
  // E2 (#14): event cards with inline responses, and the outliner after both are answered.
  // E6 (#18): new content cards, from the player's seat. The decision and arsenal hooks are test-only (window.__WL_TEST).
  'e6-decision-sof-390': async (page) => { await inGame(page); await page.evaluate(() => { const h = window.__wl; h.fund(20000); h.setTension('china', 40); h.decision('sof_raid'); }); await settle(page, 900); await pause(page); await page.evaluate(() => document.querySelector('[data-event-card=decision]').scrollIntoView({ inline: 'start', block: 'nearest' })); await settle(page, 400); },
  'e6-decision-j36-china-390': async (page) => { await startNation(page, 'China'); await page.evaluate(() => { const h = window.__wl; h.fund(20000); h.arsenal({ dev: { j36: { prog: 10, mo: 36 }, j50: { prog: 10, mo: 30 } } }); h.decision('j36_setback'); }); await settle(page, 900); await pause(page); await page.evaluate(() => document.querySelector('[data-event-card=decision]').scrollIntoView({ inline: 'start', block: 'nearest' })); await settle(page, 400); },
  'e6-world-minerals-390': async (page) => { await inGame(page); await page.evaluate(() => { const h = window.__wl; h.fund(20000); h.setTension('china', 72); h.mineral('rareEarth', { reserve: 20 }); h.event('mineral_controls_bite', 9); }); await settle(page, 900); await pause(page); await page.evaluate(() => document.querySelector('[data-event-card=world]').scrollIntoView({ inline: 'start', block: 'nearest' })); await settle(page, 400); },
  'e2-world-card-390': async (page) => { await inGame(page); await page.evaluate(() => { const h = window.__wl; h.fund(20000); h.deploy('ME', 'carrier_group', 2); h.platforms({ carrier_group: 2 }); h.event('hormuz_closure', 6); }); await settle(page, 900); await pause(page); await page.evaluate(() => document.querySelector('[data-event-card=world]').scrollIntoView({ inline: 'start', block: 'nearest' })); await settle(page, 400); },
  'e2-flashpoint-card-390': async (page) => { await inGame(page); await page.evaluate(() => { const h = window.__wl; h.fund(20000); h.flashpoint('ME', 'coup', 5); }); await settle(page, 900); await pause(page); await page.evaluate(() => document.querySelector('[data-event-card=flashpoint]').scrollIntoView({ inline: 'start', block: 'nearest' })); await settle(page, 400); },
  'e2-outliner-390': async (page) => { await inGame(page); await page.evaluate(() => { const h = window.__wl; h.fund(20000); h.deploy('ME', 'carrier_group', 2); h.platforms({ carrier_group: 2 }); h.event('hormuz_closure', 6); h.flashpoint('ME', 'coup', 5); }); await settle(page, 900); await pause(page); await page.evaluate(() => { document.querySelector('[data-event-card=world] [data-response=escort]').click(); }); await settle(page, 300); await page.evaluate(() => { document.querySelector('[data-event-card=flashpoint] [data-response=mediate]').click(); }); await settle(page, 300); await page.evaluate(() => document.querySelector('[data-outliner-handle]').click()); await settle(page, 500); },
  'p3c-desktop': async (page) => { await page.setViewportSize({ width: 1280, height: 800 }); await inGame(page); await pause(page); await settle(page, 600); },
};

// P3d: Overview map-first, HUD, nav, and the six map modes at 390 and 1280.
const desk = (page) => page.setViewportSize({ width: 1280, height: 800 });
const mode = async (page, m) => { await page.evaluate((m) => document.querySelector(`[data-map-mode-btn=${m}]`).click(), m); await settle(page, 700); };
for (const [tag, setup] of [['390', async () => {}], ['1280', desk]]) {
  SCENARIOS[`p3d-overview-${tag}`] = async (page) => { await setup(page); await inGame(page); await page.evaluate(() => { const h = window.__wl; h.setTension('russia', 82); h.deploy('ME', 'carrier', 2); h.event('hormuz_closure', 3); }); await settle(page, 4500); await pause(page); await page.evaluate(() => document.querySelector('[data-tab=economy]').click()); await settle(page, 300); await page.evaluate(() => document.querySelector('[data-tab=overview]').click()); await settle(page, 600); };
  for (const m of ['sphere', 'tension', 'trade', 'energy', 'military', 'intel']) SCENARIOS[`p3d-map-${m}-${tag}`] = async (page) => { await setup(page); await inGame(page); await page.evaluate(() => { const h = window.__wl; h.setTension('russia', 82); h.setTension('china', 55); h.deploy('ME', 'carrier', 2); h.event('hormuz_closure', 3); }); await settle(page, 4500); await pause(page); await mode(page, m); };
}
// E3 (#15): a China campaign's catalog (J-20 produced at start, J-36 and J-50 funded in parallel).
const startNation = async (page, id) => { await page.evaluate((id) => [...document.querySelectorAll('.cc')].find((c) => c.textContent.includes(id))?.click(), id); await settle(page, 400); await page.locator('text=Military Superpower').first().click(); await settle(page, 400); };
const catalogShot = async (page, prog) => { await page.evaluate(() => document.querySelector('[data-tab=defense]').click()); await settle(page, 500); await page.evaluate((p) => document.querySelector(p ? `[data-program=${p}]` : '[data-catalog]').scrollIntoView({ block: 'start' }), prog); await settle(page, 400); };
SCENARIOS['e3-china-catalog-390'] = async (page) => {
  await startNation(page, 'China'); await pause(page);
  await page.evaluate(() => { const h = window.__wl; h.fund(60000); h.levels({ aircraft: 3, propulsion: 3, computers: 3 }); }); await settle(page, 300);
  await page.evaluate(() => document.querySelector('[data-tab=defense]').click()); await settle(page, 400);
  const press = (prog, re) => page.evaluate(([p, r]) => [...document.querySelectorAll(p ? `[data-program=${p}] button` : "button")].find((b) => new RegExp(r).test(b.textContent))?.click(), [prog, re]);
  await press('j20', 'Produce'); await settle(page, 200); await press('j20', 'Tranche'); await settle(page, 200);
  await press('', 'Establish SAP Office'); await settle(page, 300);
  await press('j36', 'Fund prototype'); await settle(page, 200); await press('j50', 'Fund prototype'); await settle(page, 200);
  await settle(page, 4500); await catalogShot(page, 'j36');
};
// E7 (#19): Norway's F-47 partnership: gates before joining, then Buyer -> Partner after supplying rare earths (E4: a recycling line).
const norwayAccess = async (page, join) => {
  await startNation(page, 'Norway'); await pause(page);
  await page.evaluate(() => { const h = window.__wl; h.fund(30000); h.rel('usa', 78); }); await settle(page, 300);
  await page.evaluate(() => document.querySelector('[data-tab=defense]').click()); await settle(page, 400);
  const press = (re) => page.evaluate((r) => [...document.querySelectorAll('[data-access=f47] button')].find((b) => new RegExp(r).test(b.textContent))?.click(), re);
  if (join) { await press('Join as Buyer'); await settle(page, 200); await page.evaluate(() => window.__wl.minerals({ recycle: ['rareEarth'] })); await settle(page, 300); await press('Join as Partner'); await settle(page, 4500); }
  await page.evaluate(() => document.querySelector('[data-partnerships]').scrollIntoView({ block: 'start' })); await settle(page, 400);
};
SCENARIOS['e7-norway-gates-390'] = (page) => norwayAccess(page, false);
SCENARIOS['e7-norway-partner-390'] = (page) => norwayAccess(page, true);
// E4 (#16): the minerals view under Chinese export controls (gallium row open), and an F-35 tranche slowed by the shortfall.
const IDS = ['rareEarth', 'gallium', 'germanium', 'graphite', 'lithium', 'cobalt', 'nickel', 'tungsten', 'titanium', 'enrichment'];
const chinaControls = async (page) => {
  await inGame(page); await pause(page);
  await page.evaluate((ids) => { const h = window.__wl; h.fund(60000); for (const m of ids) h.mineral(m, { stock: 0 }); h.setTension('china', 90); }, IDS); await settle(page, 300);
  await page.evaluate(() => window.__wl.month()); await settle(page, 400);
};
SCENARIOS['e4-minerals-390'] = async (page) => {
  await chinaControls(page);
  await page.evaluate(() => document.querySelector('[data-tab=resources]').click()); await settle(page, 400);
  await page.evaluate(() => document.querySelector('[data-seg=processing]')?.click()); await settle(page, 300);
  await page.evaluate(() => [...document.querySelectorAll('[data-mineral=gallium] button')].find((b) => b.dataset.lever === 'guarantee')?.click()); await settle(page, 300);
  await page.evaluate(() => document.querySelector('[data-minerals]').scrollIntoView({ block: 'start' })); await settle(page, 400);
};
SCENARIOS['e4-slowdown-390'] = async (page) => {
  await chinaControls(page);
  await page.evaluate((ids) => { for (const m of ids) window.__wl.mineral(m, { stock: 0 }); }, IDS); await settle(page, 300);
  await page.evaluate(() => document.querySelector('[data-tab=defense]').click()); await settle(page, 400);
  await page.evaluate(() => [...document.querySelectorAll('[data-program=f35] button')].find((b) => /Tranche|Produce/.test(b.textContent)).click()); await settle(page, 400);
  await page.evaluate(() => document.querySelector('[data-program=f35]').scrollIntoView({ block: 'center' })); await settle(page, 400);
};
// E9 (#23): the issue loop on the Intel tab at 390px: the list, a ready brief (with its card), a running deployment.
// One engine month per call with a render between (a tight loop would tick on stale refs).
const adv = async (page, n) => { for (let i = 0; i < n; i++) { await page.evaluate(() => window.__wl.month()); await settle(page, 200); } };
const toIntel = async (page) => { await page.evaluate(() => document.querySelector('[data-tab=intel]').click()); await settle(page, 400); };
const tapIssue = async (page, i = 0) => { await page.evaluate((i) => { const b = document.querySelectorAll('[data-issue] > button')[i]; if (b.getAttribute('aria-expanded') !== 'true') b.click(); }, i); await settle(page, 300); }; // opens, never toggles shut
const tapText = async (page, text) => { await page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t))?.click(), text); await settle(page, 300); };
SCENARIOS['e9-issues-390'] = async (page) => { await inGame(page); await pause(page); await adv(page, 3); await toIntel(page); await page.evaluate(() => document.querySelector('[data-issues-panel]').scrollIntoView({ block: 'start' })); await settle(page, 300); };
SCENARIOS['e9-brief-390'] = async (page) => { await inGame(page); await pause(page); await adv(page, 2); await toIntel(page); await tapIssue(page, 0); await tapText(page, 'Examine'); await adv(page, 2); await page.evaluate(() => document.querySelector('[data-event-card=brief]')?.scrollIntoView({ block: 'start' })); await settle(page, 300); };
SCENARIOS['e9-brief-options-390'] = async (page) => { await inGame(page); await pause(page); await adv(page, 2); await toIntel(page); await tapIssue(page, 0); await tapText(page, 'Examine'); await adv(page, 2); await tapIssue(page, 0); await page.evaluate(() => document.querySelector('[data-issues-panel]').scrollIntoView({ block: 'start' })); await settle(page, 300); };
SCENARIOS['e9-deploy-390'] = async (page) => { await inGame(page); await pause(page); await adv(page, 2); await toIntel(page); await tapIssue(page, 0); await tapText(page, 'Examine'); await adv(page, 2); await tapIssue(page, 0); await tapText(page, 'Deploy ·'); await adv(page, 3); await tapIssue(page, 0); await page.evaluate(() => document.querySelector('[data-issues-panel]').scrollIntoView({ block: 'start' })); await settle(page, 300); };
for (const t of ['economy', 'defense', 'overview']) SCENARIOS[`e9-pane-${t}-390`] = async (page) => { await inGame(page); await pause(page); await page.evaluate((t) => document.querySelector(`[data-tab=${t}]`).click(), t); await settle(page, 500); };
// E8 (#20): Forces panel (manpower, quality, training, crews, SOF); crewless F-47 refused with the gap shown; Tier-1 card with the SOF term.
const toForces = async (page) => { await page.evaluate(() => document.querySelector('[data-tab=defense]').click()); await settle(page, 400); await page.evaluate(() => document.querySelector('[data-forces]').scrollIntoView({ block: 'start' })); await settle(page, 300); };
SCENARIOS['e8-forces-390'] = async (page) => { await inGame(page); await pause(page); await page.evaluate(() => { const h = window.__wl; h.fund(20000); h.platforms({ carrier_group: 2, fighter_wing: 3 }); }); await months(page, 3); await toForces(page); await page.evaluate(() => [...document.querySelectorAll('[data-forces] button')].find((b) => /Train Tier 2/.test(b.textContent)).click()); await settle(page, 300); await toForces(page); };
SCENARIOS['e8-sof-crews-390'] = async (page) => { await inGame(page); await pause(page); await page.evaluate(() => { const h = window.__wl; h.fund(20000); h.field('f47', 2); h.forces({ crews: { land: 6, air: 0, sea: 6 } }); }); await toForces(page);
  await page.evaluate(() => { const sel = document.getElementById('oob_f47'); sel.value = 'EA'; sel.parentElement.querySelector('button').click(); }); await settle(page, 300);
  await page.evaluate(() => document.querySelector('[data-forces-crews]').scrollIntoView({ block: 'start' })); await settle(page, 300); };
SCENARIOS['e8-unpaid-390'] = async (page) => { await inGame(page); await pause(page); await page.evaluate(() => { const h = window.__wl; h.fund(20000); }); await page.evaluate(() => document.querySelector('[data-tab=defense]').click()); await settle(page, 300);
  await page.evaluate(() => { const el = document.querySelector('input[type=range][min="0"][max="150"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '0'); el.dispatchEvent(new Event('input', { bubbles: true })); }); await months(page, 7); await toForces(page); };
// F5 (#37): private capital. Processing with a lever in force, Natural with an authorized GGRB retort, the treasury why with sector income.
const toRes = async (page, sub) => { await page.evaluate(() => document.querySelector('[data-tab=resources]').click()); await settle(page, 400); await page.evaluate((s) => document.querySelector(`[data-seg=${s}]`).click(), sub); await settle(page, 400); };
SCENARIOS['f5-processing-390'] = async (page) => { await inGame(page); await pause(page); await page.evaluate(() => window.__wl.fund(20000)); await toRes(page, 'processing');
  await page.evaluate(() => [...document.querySelectorAll('[data-mineral=gallium] button')].find((b) => b.dataset.lever === 'guarantee').click()); await settle(page, 300);
  await page.evaluate(() => document.querySelector('[data-mineral=rareEarth]').scrollIntoView({ block: 'start' })); await settle(page, 300); };
SCENARIOS['f5-natural-390'] = async (page) => { await inGame(page); await pause(page); await page.evaluate(() => { const h = window.__wl; h.fund(20000); h.levels({ materials: 5, propulsion: 6 }); }); await toRes(page, 'natural');
  await tapText(page, 'Commission Geological Survey'); await adv(page, 7); await tapText(page, 'Activate Phase II'); await page.evaluate(() => document.querySelector('[data-retort] [data-lever=permit]').click()); await settle(page, 300); await adv(page, 2);
  await page.evaluate(() => document.querySelector('[data-retort]').scrollIntoView({ block: 'center' })); await settle(page, 300); };
SCENARIOS['f5-why-390'] = async (page) => { await inGame(page); await pause(page); await page.evaluate(() => window.__wl.mineral('enrichment', { cap: 12 })); await settle(page, 200); await adv(page, 1);
  await page.evaluate(() => document.querySelector('[data-why^="Treasury"]').click()); await settle(page, 500); };
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
