import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, openGame, overflow, settle, stableRect } from './util/browser.js';

// Q2 (#42), layout in real Chromium: the step button joins the speed group; every speed target stays a 44px target
// and on screen at 390 and 1280px; the "Paused: sheet open" chip fits. Writes docs/shots/42-*.png.

// Review screenshots are opt-in (SHOTS=1 npm test); see feed-layout.test.js.
const SHOTS = !!process.env.SHOTS;
let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

// A sheet has landed once it is inside the viewport and has stopped moving; slow runners animate for longer than one wait.
async function landed(page, W, H) {
  for (let i = 0; i < 40; i++) { const r = await stableRect(page, '[data-sheet]'); if (r && r.x >= -0.5 && r.y >= -0.5 && r.r <= W + 0.5 && r.b <= H + 0.5) return r; await settle(page, 150); }
  return stableRect(page, '[data-sheet]');
}

const box = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, r: b.right, b: b.bottom, w: b.width, h: b.height, t: e.textContent.trim() }; }), sel);

for (const [W, H] of [[390, 844], [1280, 800]]) {
  test(`${W}px: speed group with the step button: five 44px targets, all on screen, nation name still readable; sheet-open chip fits`, async () => {
    const { ctx, page, errors } = await openGame(browser, { width: W, height: H }); // openGame leaves the game paused
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' }); // sheets land at once (same CI slide-in stall as feed-layout)
      const btns = await box(page, '[data-speed] button');
      assert.deepEqual(btns.map((b) => b.t), ['▶ 1×', '1×', '2×', '4×', '⏭'], 'pause/resume, three speeds, Next');
      assert.ok(btns.every((b) => b.w >= 43.5 && b.h >= 43.5 && b.x >= 0 && b.r <= W + 0.5), `speed targets ${JSON.stringify(btns.map((b) => [Math.round(b.w), Math.round(b.h)]))}`);
      const [bell] = await box(page, '[data-bell]'), [quit] = await box(page, '[aria-label="Quit to nation select"]'), [nat] = await box(page, '.wl-hud-nation');
      assert.ok(bell.r <= W + 0.5 && quit.r <= W + 0.5, 'bell and quit on screen');
      assert.ok(nat.w >= 120, `nation block keeps ${Math.round(nat.w)}px`);
      assert.ok(await page.evaluate(() => { const b = document.querySelector('.wl-hud-nation b'); return b.scrollWidth <= b.clientWidth + 1 || b.textContent.length < 18; }) || nat.w >= 120, 'nation name not crushed');
      assert.equal(await page.evaluate(() => document.querySelector('[data-step]').getAttribute('aria-disabled')), null, 'Next is live while paused');
      if (SHOTS) await page.screenshot({ path: `docs/shots/42-hud-step-${W}.png`, clip: { x: 0, y: 0, width: W, height: 150 } });
      // resume, then open a region sheet: the clock stops and the chip names the sheet
      await page.evaluate(() => document.querySelector('[data-speed] [data-pause]').click()); await settle(page, 250);
      assert.equal(await page.evaluate(() => document.querySelector('[data-step]').getAttribute('aria-disabled')), 'true', 'Next is off while the clock runs');
      await page.evaluate(() => window.__wl.region('NA')); await settle(page, 300);
      const sh = await landed(page, W, H);
      assert.ok(sh && sh.r <= W + 0.5 && sh.b <= H + 0.5);
      const chip = await page.evaluate(() => document.querySelector('[data-pause-reason]')?.textContent);
      assert.match(chip, /Paused: sheet open · close it to resume at 1×/);
      const [c] = await box(page, '[data-pause-reason]'); assert.ok(c.x >= -0.5 && c.r <= W + 0.5, `chip ${JSON.stringify(c)}`);
      const o = await overflow(page, W); assert.ok(o.scrollWidth <= W); assert.deepEqual(o.bad, []);
      if (SHOTS) await page.screenshot({ path: `docs/shots/42-sheet-pause-${W}.png` });
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}
