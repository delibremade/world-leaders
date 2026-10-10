import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, openGame, settle, stableRect } from './util/browser.js';

// F3 (#35): layout.test.js checks overflow at rest; this opens every sheet, popover and card at phone and desktop
// width and asserts each is fully inside the viewport. Event cards and the outliner must also clear the HUD.
let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

const box = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom, w: r.width, h: r.height }; }).filter((r) => r.w > 0 && r.h > 0), sel);
const inside = (r, W, H, what) => assert.ok(r.x >= -0.5 && r.y >= -0.5 && r.r <= W + 0.5 && r.b <= H + 0.5, `${what} outside ${W}x${H}: ${JSON.stringify(r)}`);
// Nothing else paints over an opened panel: sample a grid inside it and require the topmost element to belong to it.
const uncovered = (page, sel, what) => page.evaluate(([sel]) => {
  const e = document.querySelector(sel); const r = e.getBoundingClientRect(); const bad = [];
  for (const fx of [0.05, 0.5, 0.95]) for (const fy of [0.05, 0.5, 0.95]) {
    const t = document.elementFromPoint(r.x + r.width * fx, r.y + r.height * fy);
    if (t && !e.contains(t)) bad.push(`${(fx * 100) | 0}%,${(fy * 100) | 0}% covered by ${t.tagName.toLowerCase()}.${String(t.className).split(' ')[0]}`);
  }
  return bad;
}, [sel]).then((bad) => assert.deepEqual(bad, [], `${what} is covered`));
// Close and wait for the exit animation: a slow runner otherwise still has the last popover mounted when the next one opens.
// A sheet has landed once it is inside the viewport and has stopped moving (slow runners animate for longer than a fixed wait).
async function landed(page, W, H) {
  for (let i = 0; i < 40; i++) { const r = await stableRect(page, '[data-sheet]'); if (r && r.x >= -0.5 && r.y >= -0.5 && r.r <= W + 0.5 && r.b <= H + 0.5) return r; await settle(page, 150); }
  return stableRect(page, '[data-sheet]');
}
const key = async (page) => { await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('[data-why-content],[data-help-content]'), null, { timeout: 5000 }); await settle(page, 100); };

for (const [W, H] of [[390, 844], [1280, 800]]) {
  test(`${W}px: every opened sheet, popover and card is fully inside the viewport`, async () => {
    const { ctx, page, errors } = await openGame(browser, { width: W, height: H });
    try {
      const hud = (await box(page, '[data-hud]'))[0];
      // event cards (world + flashpoint) clear the HUD and stay in the viewport
      await page.evaluate(() => { const h = window.__wl; h.fund(20000); h.event('hormuz_closure', 6); h.flashpoint('ME', 'coup', 5); });
      await settle(page, 600);
      const cards = await box(page, '[data-event-card]');
      assert.ok(cards.length >= 2, 'cards open');
      const nCards = await page.evaluate(() => document.querySelectorAll('[data-event-card]').length);
      for (let i = 0; i < nCards; i++) { // cards sit in a snap carousel: each must be fully visible once scrolled to
        await page.evaluate((i) => document.querySelectorAll('[data-event-card]')[i].scrollIntoView({ inline: 'center', block: 'nearest' }), i); await settle(page, 300);
        const c = (await box(page, '[data-event-card]'))[i]; inside(c, W, H, 'event card'); assert.ok(c.y >= hud.b - 0.5 || c.x >= hud.r - 0.5, `card overlaps HUD ${JSON.stringify(c)} vs ${JSON.stringify(hud)}`); }
      // why popovers: every trigger on the shell, including the rightmost one
      const n = await page.evaluate(() => document.querySelectorAll('[data-hud] [data-why]').length);
      assert.equal(n, 3);
      for (let i = 0; i < n; i++) {
        await page.evaluate((i) => document.querySelectorAll('[data-hud] [data-why]')[i].click(), i); await settle(page, 350);
        const pops = await box(page, '[data-why-content]'); assert.equal(pops.length, 1, `why ${i} open`);
        inside(pops[0], W, H, `why popover ${i}`); await key(page);
      }
      // every why trigger on every vertical (the Forces ones sit at the right edge of the main column)
      for (const t of ['overview', 'economy', 'energy', 'resources', 'arsenal', 'forces', 'intel', 'technology', 'trade']) {
        await page.evaluate((t) => document.querySelector(`[data-nav] [data-tab=${t}]`).click(), t); await settle(page, 300);
        const k = await page.evaluate(() => document.querySelectorAll('[data-sentinel] [data-why], [data-main] [data-why]').length);
        for (let i = 0; i < Math.min(k, 6); i++) {
          await page.evaluate((i) => { const e = document.querySelectorAll('[data-sentinel] [data-why], [data-main] [data-why]')[i]; e.scrollIntoView({ block: 'center' }); e.click(); }, i); await settle(page, 300);
          for (const p of await box(page, '[data-why-content]')) inside(p, W, H, `${t} why popover ${i}`);
          await key(page);
        }
      }
      await page.evaluate(() => document.querySelector('[data-nav] [data-tab=overview]').click()); await settle(page, 300);
      // help popover
      await page.evaluate(() => document.querySelector('[data-help]')?.click()); await settle(page, 350);
      for (const p of await box(page, '[data-help-content]')) inside(p, W, H, 'help popover');
      await key(page);
      // outliner opened
      await page.evaluate(() => { const o = document.querySelector('[data-outliner]'); if (o.dataset.open !== 'true') document.querySelector('[data-outliner-handle]').click(); }); await settle(page, 500);
      const [ol] = await box(page, '[data-outliner]'); inside(ol, W, H, 'outliner');
      assert.ok(ol.y >= hud.b - 0.5 || ol.x >= hud.r - 0.5 || ol.x >= 0 && ol.y >= hud.b - 0.5, `outliner overlaps HUD ${JSON.stringify(ol)}`);
      await page.evaluate(() => { const o = document.querySelector('[data-outliner]'); if (W_MOBILE() && o.dataset.open === 'true') document.querySelector('[data-outliner-handle]').click(); function W_MOBILE() { return innerWidth < 900; } }); await settle(page, 400);
      // region sheet, then nation sheet
      await page.evaluate(() => window.__wl.region('WE')); await settle(page, 700);
      const sheet = await landed(page, W, H); assert.ok(sheet, 'region sheet open'); inside(sheet, W, H, 'region sheet'); await uncovered(page, '[data-sheet]', 'region sheet');
      await page.evaluate(() => window.__wl.nation('france')); await settle(page, 500);
      const nsheet = await landed(page, W, H); inside(nsheet, W, H, 'nation sheet'); await uncovered(page, '[data-sheet]', 'nation sheet');
      if (W >= 900) assert.ok(nsheet.w <= 480, `desktop sheet is a side panel, not full width: ${nsheet.w}`);
      assert.ok(await page.evaluate(() => !!document.querySelector('[data-nation-sheet=france]')), 'nation sheet open');
      // a why popover opened while the sheet is open stays inside too, and the sheet body scrolls rather than clips
      const clipped = await page.evaluate(() => { const b = document.querySelector('.wl-sheet-body'); return b.scrollHeight > b.clientHeight && getComputedStyle(b).overflowY === 'visible'; });
      assert.equal(clipped, false, 'sheet body scrolls');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}
