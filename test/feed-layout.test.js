import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, openGame, overflow, settle, stableRect } from './util/browser.js';

// Q1 (#41), layout in real Chromium: the bell fits the HUD row, the feed sheet with 20 entries and the routing view
// stay inside the viewport with 44px targets and no sideways scroll. Writes the review screenshots to docs/shots/.

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

// A sheet has landed once it is inside the viewport and has stopped moving; slow runners animate for longer than one wait.
async function landed(page, W, H) {
  for (let i = 0; i < 40; i++) { const r = await stableRect(page, '[data-sheet]'); if (r && r.x >= -0.5 && r.y >= -0.5 && r.r <= W + 0.5 && r.b <= H + 0.5) return r; await settle(page, 150); }
  return stableRect(page, '[data-sheet]');
}

const PHASES = ['intelOps', 'economy', 'world', 'forces', 'pressure', 'statecraft', 'research', 'minerals'];
const TEXTS = ['🚨 Intelligence operation discovered! Response required.', '⚠ Treasury is low: the ministry stops shipping for 3 months while the budget is rebuilt', '🌐 WORLD EVENT: Pandemic', '🎖️ SEAL Teams: 12 new operators graduate', '⚓ russia blockade runners slipped the Western Europe cordon', '🏛️ Embassy established in Germany', '🔬 Cyber L2 complete — DARPA spillover applied', '🏭 Private lithium plant online'];

for (const [W, H] of [[390, 844], [1280, 800]]) {
  test(`${W}px: bell is a 44px target in the HUD row; the feed with 20 entries and the routing view fit the screen`, async () => {
    const { ctx, page, errors } = await openGame(browser, { width: W, height: H });
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' }); // sheets land at once; CI never finished the slide-in at 1280px
      const hud = await page.evaluate(() => { const r = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, r: b.right, b: b.bottom, w: b.width, h: b.height }; }; return { bell: r('[data-bell]'), speed: r('[data-speed]'), quit: r('[aria-label="Quit to nation select"]') }; });
      assert.ok(hud.bell.w >= 43.5 && hud.bell.h >= 43.5 && hud.bell.r <= W + 0.5 && hud.bell.x >= 0, `bell ${JSON.stringify(hud.bell)}`);
      assert.ok(hud.quit.r <= W + 0.5 && hud.speed.r <= W + 0.5, 'speed group and quit stay on screen');
      assert.ok(hud.bell.r <= hud.quit.x + 0.5 || hud.bell.b <= hud.quit.y + 0.5, 'bell does not overlap the quit button');
      const before0 = await page.evaluate(() => window.__wl.feed().length);
      await page.evaluate(({ PHASES, TEXTS }) => { for (let i = 0; i < 20; i++) { window.__wl.phase(PHASES[i % 8]); window.__wl.notify(`${TEXTS[i % 8]} #${i + 1}`); window.__wl.phase(null); } }, { PHASES, TEXTS });
      await settle(page, 200);
      assert.equal(await page.evaluate(() => document.querySelector('[data-bell-badge]').textContent), String(before0 + 20));
      await page.screenshot({ path: `docs/shots/41-hud-bell-${W}.png`, clip: { x: 0, y: 0, width: W, height: 150 } });
      await page.evaluate(() => document.querySelector('[data-bell]').click());
      const sh = await landed(page, W, H);
      assert.ok(sh && sh.x >= -0.5 && sh.r <= W + 0.5 && sh.b <= H + 0.5, `sheet ${JSON.stringify(sh)}`);
      const rows = await page.evaluate(() => [...document.querySelectorAll('[data-feed-row]')].map((e) => { const b = e.getBoundingClientRect(); return { h: b.height, r: b.right, x: b.x }; }));
      assert.equal(rows.length, before0 + 20); assert.ok(rows.every((r) => r.h >= 43.5 && r.r <= W + 0.5 && r.x >= -0.5), 'rows are 44px targets inside the sheet');
      const o = await overflow(page, W); assert.ok(o.scrollWidth <= W, `scrollWidth ${o.scrollWidth}`); assert.deepEqual(o.bad, []);
      assert.ok(await page.evaluate(() => { const b = document.querySelector('[data-feed-list]').parentElement; return b.scrollHeight > b.clientHeight; }), '20 entries scroll inside the sheet');
      await page.screenshot({ path: `docs/shots/41-feed-${W}.png` });
      await page.evaluate(() => document.querySelector('[data-feed-tab=routing]').click()); await settle(page, 250);
      const btns = await page.evaluate(() => [...document.querySelectorAll('[data-route]')].map((e) => { const b = e.getBoundingClientRect(); return { w: b.width, h: b.height, r: b.right }; }));
      assert.equal(btns.length, 26, '8 classes x 3 + orders x 2');
      assert.ok(btns.every((b) => b.w >= 43.5 && b.h >= 43.5 && b.r <= W + 0.5), 'routing buttons are 44px targets inside the sheet');
      const o2 = await overflow(page, W); assert.ok(o2.scrollWidth <= W); assert.deepEqual(o2.bad, []);
      await page.screenshot({ path: `docs/shots/41-routing-${W}.png` });
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}
