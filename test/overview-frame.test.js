import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, openGame, settle } from './util/browser.js';
import { DECISIONS } from '../src/data/world.js';

// FIX 1 (Overview frame): a fixed, non-scrolling frame at 1440x900 and 1920x1080. The map, mode dock, rail, outliner, HUD
// and the card dock keep the same bounding boxes before and after an event fires, a decision opens, a mode toggles, a region
// is selected and a tooltip opens. Overlays live in reserved slots, so nothing reflows.
let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

const FRAME = { map: '.wl-mv-stage', dock: '[data-map-modes]', rail: '[data-nav]', outliner: '[data-outliner]', hud: '[data-hud]', cards: '[data-dock]' };
const boxes = (page) => page.evaluate((F) => Object.fromEntries(Object.entries(F).map(([k, s]) => { const e = document.querySelector(s); if (!e) return [k, null]; const r = e.getBoundingClientRect(); return [k, [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 2) / 2)]; })), FRAME);
const scroll = (page) => page.evaluate(() => { const col = document.querySelector('.wl-ov-col'); const body = document.querySelector('.wl-body'); return { col: col.scrollHeight - col.clientHeight, body: body.scrollHeight - body.clientHeight, page: document.documentElement.scrollHeight - innerHeight }; });

for (const [W, H] of [[1440, 900], [1920, 1080]]) {
  test(`${W}x${H}: the Overview frame never shifts while cards, decisions, modes, selection and tooltips come and go; no vertical scroll`, async () => {
    const { ctx, page, errors } = await openGame(browser, { svg: true, width: W, height: H });
    try {
      await page.evaluate(() => document.querySelector('[data-tab=overview]').click()); await settle(page, 500);
      const base = await boxes(page);
      for (const k of Object.keys(FRAME)) assert.ok(base[k], `${k} present`);
      assert.deepEqual(await scroll(page), { col: 0, body: 0, page: 0 }, 'no vertical scroll at rest');
      const steps = [
        ['world event fires', () => page.evaluate(() => { window.__wl.fund(20000); window.__wl.event('hormuz_closure', 6); })],
        ['flashpoint fires', () => page.evaluate(() => window.__wl.flashpoint('ME', 'coup', 5))],
        ['decision opens', () => page.evaluate((id) => window.__wl.decision(id), DECISIONS[0].id)],
        ['map mode toggles', async () => { await page.mouse.move(W / 2, H / 2); await page.keyboard.press('w'); }],
        ['region selected (command card + sheet)', () => page.evaluate(() => window.__wl.region('WE'))],
        ['tooltip opens', () => page.evaluate(() => document.querySelector('[data-well=treasury]').click())], // DOM click: the open sheet's scrim sits over the HUD
      ];
      for (const [what, act] of steps) {
        await act(); await settle(page, 700);
        const now = await boxes(page);
        for (const k of Object.keys(FRAME)) assert.deepEqual(now[k], base[k], `${k} moved after: ${what}`);
        const sc = await scroll(page); assert.ok(sc.col <= 0 && sc.body <= 0 && sc.page <= 0, `scroll appeared after ${what}: ${JSON.stringify(sc)}`);
      }
      // the dock holds every card in its reserved slot and scrolls inside; the outliner stays where it was
      const dock = await page.evaluate(() => { const d = document.querySelector('[data-dock]'); return { n: +d.dataset.dockCount, cards: d.querySelectorAll('[data-event-card]').length, inner: d.scrollHeight >= d.clientHeight }; });
      assert.ok(dock.n >= 3 && dock.cards === dock.n, `dock holds the cards: ${JSON.stringify(dock)}`);
      // one overlay at a time: the command card is up with the region; opening the feed closes the selection
      assert.ok(await page.$('[data-command-card=region]'), 'command card with the selection');
      await page.evaluate(() => document.querySelector('[data-bell]').click()); await settle(page, 500);
      assert.equal(await page.$('[data-command-card=region]'), null, 'feed closed the selection');
      // the vitals ride in the HUD tables
      await page.keyboard.press('Escape'); await settle(page, 300);
      await page.evaluate(() => document.querySelector('[data-well=stability]').click()); await settle(page, 400);
      const facts = await page.evaluate(() => [...document.querySelectorAll('[data-why-content] [data-fact]')].map((r) => r.dataset.fact));
      for (const k of ['healthcare', 'education', 'foodSecurity', 'inequality', 'unemployment', 'inflation']) assert.ok(facts.includes(k), `stability table lists ${k}`);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}
