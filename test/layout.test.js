import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, openGame, overflow, settle } from './util/browser.js';
import { TABS } from './util/harness.js';

// P3d gate: layout assertions jsdom cannot make, in real Chromium (playwright-core, devDependency).
// Phone 390x844 and desktop 1280x800: nothing scrolls sideways on any vertical, the nav reaches all nine, the map
// is the first thing on Overview, map-mode chips all fit, and the static how-to text lives behind a popover.

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });
const go = (page, t) => page.evaluate((t) => document.querySelector(`[data-tab=${t}]`).click(), t).then(() => settle(page, 250));
const rect = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);

for (const [W, H] of [[390, 844], [1280, 800]]) {
  test(`${W}px: no horizontal overflow on any vertical (doctrine card open, then every tab)`, async () => {
    const { ctx, page, errors } = await openGame(browser, { width: W, height: H, doctrine: false });
    try {
      let o = await overflow(page, W);
      assert.ok(o.scrollWidth <= W, `doctrine card: scrollWidth ${o.scrollWidth}`); assert.deepEqual(o.bad, [], 'doctrine card: elements past the right edge');
      await page.locator('text=Military Superpower').first().click(); await settle(page, 500);
      for (const t of TABS) {
        await go(page, t); o = await overflow(page, W);
        assert.ok(o.scrollWidth <= W, `${t}: scrollWidth ${o.scrollWidth} > ${W}`);
        assert.deepEqual(o.bad, [], `${t}: elements past the right edge`);
      }
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

test('390px: HUD speed control and all three figures are fully on screen; nav reaches all nine verticals in one tap', async () => {
  const { ctx, page } = await openGame(browser, { width: 390 });
  try {
    for (const sel of ['[data-speed]', '[data-why^="Treasury"]', '[data-why^="Stability"]', '[data-why^="Hegemony"]']) { const r = await rect(page, sel); assert.ok(r && r.x >= 0 && r.r <= 390 && r.w > 40, `${sel} ${JSON.stringify(r)}`); }
    for (const t of TABS) {
      const r = await rect(page, `[data-nav] [data-tab=${t}]`); assert.ok(r && r.x >= 0 && r.r <= 390.5 && r.w >= 36, `nav ${t} ${JSON.stringify(r)}`);
      await page.evaluate((t) => document.querySelector(`[data-nav] [data-tab=${t}]`).click(), t); await settle(page, 200);
      assert.equal(await page.evaluate(() => document.querySelector('[data-nav] [aria-current=page]')?.dataset.tab), t, `one tap reaches ${t}`);
      assert.ok((await rect(page, `[data-nav] [aria-current=page] .wl-nav-l`))?.w > 0, 'active tab shows its label');
    }
  } finally { await ctx.close(); }
});

test('390px: six map-mode chips fit inside the map card, equal width, none clipped', async () => {
  const { ctx, page } = await openGame(browser, { width: 390 });
  try {
    const card = await rect(page, '[data-map-modes]'); const ids = ['sphere', 'tension', 'trade', 'energy', 'military', 'intel'];
    assert.equal(await page.evaluate(() => document.querySelectorAll('[data-map-mode-btn]').length), 6);
    for (const id of ids) { const r = await rect(page, `[data-map-mode-btn=${id}]`); assert.ok(r.x >= card.x - 0.5 && r.r <= card.r + 0.5 && r.w >= 40 && r.h >= 44, `${id} ${JSON.stringify(r)} in ${JSON.stringify(card)}`); }
    const clipped = await page.evaluate(() => [...document.querySelectorAll('[data-map-mode-btn] span:last-child')].filter((s) => s.scrollWidth > s.clientWidth).map((s) => s.textContent));
    assert.deepEqual(clipped, [], 'labels fully visible');
  } finally { await ctx.close(); }
});

test('Overview: the map comes first (phone: above every card; desktop: main column, tips behind a popover)', async () => {
  for (const [W, H] of [[390, 844], [1280, 800]]) {
    const { ctx, page } = await openGame(browser, { width: W, height: H });
    try {
      const top = await page.evaluate(() => { const els = [...document.querySelectorAll('.wl-overview > div:first-child > *')].filter((e) => e.getBoundingClientRect().height > 0).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top); return { first: els[0]?.className, mapTop: document.querySelector('.wl-map-card').getBoundingClientRect().top, otherTops: els.filter((e) => !e.matches('.wl-map-card')).map((e) => e.getBoundingClientRect().top) }; });
      assert.equal(top.first, 'wl-map-card', `${W}px first block`); assert.ok(top.otherTops.every((y) => y > top.mapTop), `${W}px: cards below the map`);
      const map = await rect(page, '.wl-map-card');
      if (W >= 900) assert.ok(map.w >= 600, `desktop map column ${map.w}px`); else assert.ok(map.w >= 340 && map.y < 300, `phone map ${JSON.stringify(map)}`);
      assert.equal(await page.evaluate(() => /Investigate issues/.test(document.body.innerText)), false, 'static tips are out of the layout');
      await page.evaluate(() => document.querySelector('[data-help]').click()); await settle(page, 300);
      assert.match(await page.evaluate(() => document.querySelector('[data-help-content]')?.textContent || ''), /Investigate issues/);
      assert.equal((await overflow(page, W)).scrollWidth <= W, true);
    } finally { await ctx.close(); }
  }
});

// E2 (#14): world-event and flashpoint cards carry their responses inline. Every response button sits inside its
// card, is at least 44px tall, and its text is not clipped, at phone and desktop width.
for (const [W, H] of [[390, 844], [1280, 800]]) {
  test(`${W}px: event cards show inline responses that fit (world event + flashpoint)`, async () => {
    const { ctx, page, errors } = await openGame(browser, { width: W, height: H });
    try {
      await page.evaluate(() => { const h = window.__wl; h.fund(20000); h.deploy('ME', 'carrier_group', 2); h.platforms({ carrier_group: 2 }); h.event('hormuz_closure', 6); h.flashpoint('ME', 'coup', 5); });
      await settle(page, 600);
      const cards = await page.evaluate(() => [...document.querySelectorAll('[data-event-card=world],[data-event-card=flashpoint]')].map((c) => ({ kind: c.dataset.eventCard, n: c.querySelectorAll('[data-response]').length })));
      assert.deepEqual(cards.map((c) => c.kind).sort(), ['flashpoint', 'world']);
      assert.equal(cards.find((c) => c.kind === 'world').n, 3); assert.equal(cards.find((c) => c.kind === 'flashpoint').n, 4);
      const bad = await page.evaluate(() => [...document.querySelectorAll('[data-event-card] [data-response]')].flatMap((b) => {
        const c = b.closest('[data-event-card]').getBoundingClientRect(); const r = b.getBoundingClientRect(); const out = [];
        if (r.left < c.left - 0.5 || r.right > c.right + 0.5) out.push(`${b.dataset.response} outside its card`);
        if (r.height < 44) out.push(`${b.dataset.response} ${Math.round(r.height)}px tall`);
        if ([...b.querySelectorAll('b,small')].some((e) => e.scrollWidth > e.clientWidth + 1)) out.push(`${b.dataset.response} clipped text`);
        return out; }));
      assert.deepEqual(bad, []);
      const o = await overflow(page, W); assert.ok(o.scrollWidth <= W, `scrollWidth ${o.scrollWidth}`); assert.deepEqual(o.bad, []);
      // answering closes the card in place and the outliner says what is in effect
      await page.evaluate(() => document.querySelector('[data-event-card=world] [data-response=escort]').click()); await settle(page, 300);
      assert.equal(await page.evaluate(() => !!document.querySelector('[data-event-card=world]')), false, 'world card closed');
      await page.evaluate(() => document.querySelector('[data-event-card=flashpoint] [data-response=mediate]').click()); await settle(page, 300);
      assert.equal(await page.evaluate(() => !!document.querySelector('[data-event-card=flashpoint]')), false, 'flashpoint card closed');
      await page.evaluate(() => document.querySelector('[data-outliner-handle]').click()); await settle(page, 400);
      const rows = await page.evaluate(() => [...document.querySelectorAll('[data-outliner-row]')].map((r) => r.textContent));
      assert.ok(rows.some((t) => /in effect: Escort convoys/.test(t)), 'world row: ' + rows.join(' | '));
      assert.ok(rows.some((t) => /in effect: Mediate/.test(t)), 'flashpoint row');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

// #23 follow-up: on a phone no tab pane is crushed by Nation Vitals. Every pane keeps its whole content on screen
// (no inner clipping) and its content is at least 60% of the viewport wide.
test('390px: every tab pane grows to its content; pane and content are >= 60% of the viewport wide', async () => {
  const W = 390;
  const { ctx, page } = await openGame(browser, { width: W, height: 844 });
  try {
    for (const t of TABS) {
      await go(page, t);
      const m = await page.evaluate(() => {
        const pane = [...document.querySelector('.wl-body').children].find((c) => !c.classList.contains('wl-vitals'));
        const r = pane.getBoundingClientRect();
        const kids = [...pane.children].map((k) => k.getBoundingClientRect().width);
        return { w: r.width, content: Math.max(0, ...kids), h: r.height, sh: pane.scrollHeight };
      });
      assert.ok(m.w >= 0.6 * W, `${t}: pane ${m.w}px`);
      assert.ok(m.content >= 0.6 * W, `${t}: content ${m.content}px`);
      assert.ok(m.h >= m.sh - 1, `${t}: pane clipped (${m.h}px of ${m.sh}px)`);
    }
  } finally { await ctx.close(); }
});
