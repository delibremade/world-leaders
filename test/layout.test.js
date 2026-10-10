import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, openGame, overflow, settle, stableRect } from './util/browser.js';
import { TABS, PANES, FOLDED } from './util/harness.js';

// P3d gate: layout assertions jsdom cannot make, in real Chromium (playwright-core, devDependency).
// Phone 390x844 and desktop 1280x800: nothing scrolls sideways on any vertical, the nav reaches all nine, the map
// is the first thing on Overview, map-mode chips all fit, and the static how-to text lives behind a popover.

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });
// Folded panes (sitroom) are reached through their parent vertical's segmented control.
const go = async (page, t) => {
  await page.evaluate((t) => document.querySelector(`[data-tab=${t}]`).click(), FOLDED[t] || t); await settle(page, 250);
  if (FOLDED[t]) { await page.evaluate((t) => document.querySelector(`[data-seg=${t}]`).click(), t); await settle(page, 250); }
};
const seg = (page, id) => page.evaluate((id) => document.querySelector(`[data-seg=${id}]`).click(), id).then(() => settle(page, 200));
const rect = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);

for (const [W, H] of [[390, 844], [1280, 800]]) {
  test(`${W}px: no horizontal overflow on any vertical (doctrine card open, then every tab)`, async () => {
    const { ctx, page, errors } = await openGame(browser, { width: W, height: H, doctrine: false });
    try {
      let o = await overflow(page, W);
      assert.ok(o.scrollWidth <= W, `doctrine card: scrollWidth ${o.scrollWidth}`); assert.deepEqual(o.bad, [], 'doctrine card: elements past the right edge');
      await page.locator('text=Military Superpower').first().click(); await settle(page, 500);
      for (const t of PANES) {
        await go(page, t); o = await overflow(page, W);
        assert.ok(o.scrollWidth <= W, `${t}: scrollWidth ${o.scrollWidth} > ${W}`);
        assert.deepEqual(o.bad, [], `${t}: elements past the right edge`);
      }
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

test('390px: HUD speed control and all three figures are fully on screen; nav reaches all nine verticals in one tap, each >= 43px wide (nav-only exception, PLAYABLE-PLAN) and >= 44px tall', async () => {
  const { ctx, page } = await openGame(browser, { width: 390 });
  try {
    for (const sel of ['[data-speed]', '[data-why^="Treasury"]', '[data-why^="Stability"]', '[data-why^="Hegemony"]']) { const r = await rect(page, sel); assert.ok(r && r.x >= 0 && r.r <= 390 && r.w > 40, `${sel} ${JSON.stringify(r)}`); }
    for (const t of TABS) {
      const r = await rect(page, `[data-nav] [data-tab=${t}]`); assert.ok(r && r.x >= 0 && r.r <= 390.5 && r.w >= 43 && r.h >= 44, `nav ${t} ${JSON.stringify(r)}`);
      await page.evaluate((t) => document.querySelector(`[data-nav] [data-tab=${t}]`).click(), t); await settle(page, 200);
      assert.equal(await page.evaluate(() => document.querySelector('[data-nav] [aria-current=page]')?.dataset.tab), t, `one tap reaches ${t}`);
      assert.ok((await rect(page, `[data-nav] [aria-current=page] .wl-nav-l`))?.w > 0, 'active tab shows its label');
    }
  } finally { await ctx.close(); }
});

// E5c: Resources vertical (minerals). Six sub-tabs fit both widths with no sideways scroll, every row and button is
// a 44px target, and every Part 3 lever (plants, recycling, reserve, offtake, pact, export controls) plus the merged
// rare-earth export extraction and the natural-resource cards are reachable.
for (const [W, H] of [[390, 844], [1280, 800]]) {
  test(`${W}px: Resources minerals view, six sub-tabs inside the screen; every Part 3 lever reachable`, async () => {
    const { ctx, page, errors } = await openGame(browser, { width: W, height: H });
    try {
      await go(page, 'resources');
      const segs = await page.evaluate(() => [...document.querySelectorAll('[data-segbar=resources] [data-seg]')].map((b) => { const r = b.getBoundingClientRect(); return { id: b.dataset.seg, w: r.width, h: r.height, r: r.right }; }));
      assert.deepEqual(segs.map((x) => x.id), ['reserves', 'processing', 'stockpile', 'deals', 'controls', 'natural']);
      for (const x of segs) assert.ok(x.h >= 44 && x.w >= 44 && x.r <= W + 0.5, `segment ${JSON.stringify(x)}`);
      const want = {
        reserves: [/Ore reserves/, /to zero|unrefined|—/, /Rare earths · export extraction/, /Revenue/],
        processing: [/Processing capacity/, /Build plant/, /Recycle/, /Gallium/],
        stockpile: [/Stockpile and reserve/, /Buy reserve/, /Release reserve|Hold reserve/],
        deals: [/Offtake deals/, /Available partners/, /Offtake · /, /Processing pact/],
        controls: [/Your export controls/, /Controls against you/, /Rival impact/, /Export control/],
        natural: [/Natural Resource Management/, /Crude Oil/, /Renewable Energy/],
      };
      for (const [id, res] of Object.entries(want)) {
        await seg(page, id);
        const txt = await page.evaluate(() => (document.querySelector('[data-minerals]') || document.querySelector('[data-sentinel=resources]')).innerText);
        for (const re of res) assert.match(txt, new RegExp(re.source, 'i'), `${id}: ${re}`);
        const o = await overflow(page, W);
        assert.ok(o.scrollWidth <= W, `${id}: scrollWidth ${o.scrollWidth}`); assert.deepEqual(o.bad, [], `${id}: elements past the right edge`);
        if (id !== 'natural') {
          const small = await page.evaluate(() => [...document.querySelectorAll('[data-minerals] .wl-r, [data-minerals] .wl-p-head, [data-minerals] .wl-btn')].filter((e) => e.getBoundingClientRect().height < 43.5).map((e) => (e.className || e.tagName) + ':' + e.textContent.slice(0, 20)));
          assert.deepEqual(small, [], `${id}: targets under 44px`);
        }
      }
      await seg(page, 'controls');
      await page.evaluate(() => [...document.querySelectorAll('[data-minerals] button')].find((b) => /Export control/.test(b.textContent))?.click()); await settle(page, 400);
      const c = await stableRect(page, '[data-confirm]', { within: { W, H } }); if (c) assert.ok(c.x >= 0 && c.r <= W + 0.5, JSON.stringify(c));
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

// E5a: Forces vertical. Every sub-tab fits both widths with no sideways scroll, every segment and row control is a
// 44px target, and every E8 mechanic (spec Part 7) has a control or a figure on one of the five screens.
for (const [W, H] of [[390, 844], [1280, 800]]) {
  test(`${W}px: Forces vertical, five sub-tabs inside the screen; every Part 7 mechanic reachable`, async () => {
    const { ctx, page, errors } = await openGame(browser, { width: W, height: H });
    try {
      await page.evaluate(() => { const h = window.__wl; h.field('f47', 2); h.forces({ crews: { land: 6, air: 0, sea: 6 } }); });
      await go(page, 'forces');
      const segs = await page.evaluate(() => [...document.querySelectorAll('[data-segbar=forces] [data-seg]')].map((b) => { const r = b.getBoundingClientRect(); return { id: b.dataset.seg, w: r.width, h: r.height, r: r.right }; }));
      assert.deepEqual(segs.map((x) => x.id), ['manpower', 'quality', 'training', 'equipment', 'specialized']);
      for (const x of segs) assert.ok(x.h >= 44 && x.w >= 44 && x.r <= W + 0.5, `segment ${JSON.stringify(x)}`);
      const want = {
        manpower: [/Strength/, /Retention/, /Personnel pay/, /Recruits/],
        quality: [/Force quality index/, /Education/, /Healthcare/, /Food security/, /Stability/, /Equality/],
        training: [/Unfunded/, /Intensive/, /Readiness by branch/, /Crew pipelines/],
        equipment: [/Crews vs airframes/, /gap 4/, /Theater summary/, /Maintenance/, /F-47/],
        specialized: [/Train Tier 2/, /Tier 1 selection/, /1st SFOD-D/, /ISR score/, /Cyber Command/, /Nuclear crews/],
      };
      for (const [id, res] of Object.entries(want)) {
        await seg(page, id);
        const txt = await page.evaluate(() => document.querySelector('[data-forces]').innerText);
        for (const re of res) assert.match(txt, new RegExp(re.source, 'i'), `${id}: ${re}`); // panel titles are uppercase labels
        const o = await overflow(page, W);
        assert.ok(o.scrollWidth <= W, `${id}: scrollWidth ${o.scrollWidth}`); assert.deepEqual(o.bad, [], `${id}: elements past the right edge`);
        const small = await page.evaluate(() => [...document.querySelectorAll('[data-forces] .wl-r, [data-forces] .wl-p-head, [data-forces] select, [data-forces] input')].filter((e) => e.getBoundingClientRect().height < 43.5).map((e) => e.className || e.tagName));
        assert.deepEqual(small, [], `${id}: rows under 44px`);
      }
      await seg(page, 'manpower');
      assert.ok(await page.evaluate(() => !!document.querySelector('input[type=range][min="0"][max="150"]')), 'pay slider reaches 0');
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

// E5b: Arsenal vertical. Six sub-tabs fit both widths, no sideways scroll, every row and button is a 44px target,
// and every Part 1-6 mechanic (programs, procurement, supply, allied access, exports, deterrence) is on one of them.
for (const [W, H] of [[390, 844], [1280, 800]]) {
  test(`${W}px: Arsenal vertical, six sub-tabs inside the screen; every Part 1-6 mechanic reachable`, async () => {
    const { ctx, page, errors } = await openGame(browser, { width: W, height: H });
    try {
      await page.evaluate(() => { const h = window.__wl; h.fund(60000); h.field('b21', 1); h.field('f47', 1); h.platforms({ ssbn_fleet: 1 }); });
      await go(page, 'arsenal');
      const segs = await page.evaluate(() => [...document.querySelectorAll('[data-segbar=arsenal] [data-seg]')].map((b) => { const r = b.getBoundingClientRect(); return { id: b.dataset.seg, w: r.width, h: r.height, r: r.right }; }));
      assert.deepEqual(segs.map((x) => x.id), ['programs', 'procurement', 'supply', 'partnerships', 'exports', 'deterrence']);
      for (const x of segs) assert.ok(x.h >= 44 && x.w >= 44 && x.r <= W + 0.5, `segment ${JSON.stringify(x)}`);
      const want = {
        programs: [/Pipeline/, /SAP office|Establish SAP Office/, /B-21/, /F-47/, /CCA/, /SR-72/, /SSN\(X\)/, /F-35/, /Tranche #|Produce/, /Prototype|R&D/],
        procurement: [/Force structure/, /Acquisition policy/, /Surge/, /Platforms/, /Build \$/, /R&D readiness/],
        supply: [/Mineral supply/, /Open Resources/, /Programs: inputs and coverage/, /Platforms: inputs and coverage/],
        partnerships: [/Security compliance/, /Counter-intelligence/, /F-47/, /B-21/, /CCA/],
        exports: [/Export marketplace/, /Buyers/, /Your exportable platforms/, /Material Science/],
        deterrence: [/Nuclear triad/, /Deployed military power/, /MAD parity/, /Nuclear register/, /SSBN fleet/],
      };
      for (const [id, res] of Object.entries(want)) {
        await seg(page, id);
        if (id === 'exports') { await page.evaluate(() => [...document.querySelectorAll('[data-arsenal] button')].find((b) => /Material Science/.test(b.textContent)).click()); await settle(page, 150); }
        const txt = await page.evaluate(() => document.querySelector('[data-arsenal]').innerText);
        for (const re of res) assert.match(txt, new RegExp(re.source, 'i'), `${id}: ${re}`);
        const o = await overflow(page, W);
        assert.ok(o.scrollWidth <= W, `${id}: scrollWidth ${o.scrollWidth}`); assert.deepEqual(o.bad, [], `${id}: elements past the right edge`);
        const small = await page.evaluate(() => [...document.querySelectorAll('[data-arsenal] .wl-r, [data-arsenal] .wl-p-head, [data-arsenal] .wl-btn')].filter((e) => e.getBoundingClientRect().height < 43.5).map((e) => (e.className || e.tagName) + ':' + e.textContent.slice(0, 20)));
        assert.deepEqual(small, [], `${id}: targets under 44px`);
      }
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

test('390px: Forces why-popover on retention and the confirm sheet for Tier 1 selection stay on screen', async () => {
  const { ctx, page, errors } = await openGame(browser, { width: 390 });
  try {
    await go(page, 'forces');
    await page.evaluate(() => document.querySelector('[data-why="Retention target"]').click()); await settle(page, 200);
    const w = await rect(page, '[data-why-content="Retention target"]'); assert.ok(w && w.x >= 0 && w.r <= 390.5, JSON.stringify(w));
    await page.keyboard.press('Escape'); await seg(page, 'specialized');
    await page.evaluate(() => [...document.querySelectorAll('[data-forces] button')].find((b) => /Tier 1 selection/.test(b.textContent)).click()); await settle(page, 400);
    const c = await rect(page, '[data-confirm]'); assert.ok(c && c.x >= 0 && c.r <= 390.5, JSON.stringify(c));
    assert.match(await page.evaluate(() => document.querySelector('[data-confirm]').innerText), /\$20M\/mo/);
    assert.deepEqual(errors, []);
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
    for (const t of PANES) {
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
