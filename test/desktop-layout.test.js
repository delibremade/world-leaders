import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, openGame, overflow, settle, stableRect } from './util/browser.js';
import { PANES, FOLDED, TABS } from './util/harness.js';

// Desktop-first gate (owner ruling 2026-10-11, PLAYABLE-PLAN guardrail 4): at 1280, 1440 and 1920 every vertical
// fills the width (no dead gutters), nothing is clipped or scrolls sideways, the nav rail shows all nine labelled
// verticals, and the keyboard shortcuts work. The 390px suite (layout.test.js) is unchanged and still gates.

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });
const go = async (page, t) => {
  await page.evaluate((t) => document.querySelector(`[data-tab=${t}]`).click(), FOLDED[t] || t); await settle(page, 250);
  if (FOLDED[t]) { await page.evaluate((t) => document.querySelector(`[data-seg=${t}]`).click(), t); await settle(page, 250); }
};

// Share of the viewport's width (sampled every 8px) where something visible is drawn: text, a control, svg/canvas.
const coverage = (page, main = false) => page.evaluate((main) => {
  const b = document.querySelector('.wl-body').getBoundingClientRect(); const x0 = main ? b.left : 0, W = main ? b.right : innerWidth, H = innerHeight; let hit = 0, n = 0;
  const content = (e) => e && (/^(CANVAS|SVG|PATH|IMG|INPUT|SELECT|BUTTON|TEXTAREA|RECT|CIRCLE|LINE|POLYGON|G)$/i.test(e.tagName) || [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()));
  for (let x = x0 + 4; x < W; x += 8) { n++; for (let y = 4; y < H; y += 20) if (content(document.elementFromPoint(x, y))) { hit++; break; } }
  return hit / n;
}, main);
// Elements that cut their own content: overflow hidden/clip with scrollWidth past clientWidth, ellipsis text excepted.
const clipped = (page) => page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => {
  const s = getComputedStyle(e); if (!/(hidden|clip)/.test(s.overflowX) || s.textOverflow === 'ellipsis' || !e.clientWidth) return false;
  return e.scrollWidth > e.clientWidth + 1 && !/^(svg|canvas)$/i.test(e.tagName) && !e.closest('svg,canvas,[data-map],.recharts-wrapper');
}).slice(0, 8).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} ${e.scrollWidth}>${e.clientWidth} ${e.textContent.trim().slice(0, 24)}`));

for (const [W, H] of [[1280, 800], [1440, 900], [1920, 1080]]) {
  test(`${W}px: every vertical fills >= 80% of the width, nothing clipped or scrolling sideways`, async () => {
    const { ctx, page, errors } = await openGame(browser, { svg: true, width: W, height: H });
    try {
      for (const t of PANES) {
        await go(page, t);
        const f = await coverage(page); assert.ok(f >= 0.8, `${t}: content covers ${(f * 100).toFixed(0)}% of ${W}px`);
        const fm = await coverage(page, true); assert.ok(fm >= 0.8, `${t}: content covers ${(fm * 100).toFixed(0)}% of the main column`);
        const o = await overflow(page, W); assert.ok(o.scrollWidth <= W, `${t}: scrollWidth ${o.scrollWidth}`); assert.deepEqual(o.bad, [], `${t}: past the right edge`);
        assert.deepEqual(await clipped(page), [], `${t}: clipped content`);
      }
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}

for (const [W, H] of [[1280, 800], [1920, 1080]]) {
  test(`${W}px: labelled left rail shows all nine verticals with full names and badges inside the viewport`, async () => {
    const { ctx, page } = await openGame(browser, { svg: true, width: W, height: H });
    try {
      const rows = await page.evaluate(() => [...document.querySelectorAll('[data-nav] [data-tab]')].map((b) => { const r = b.getBoundingClientRect(); const l = b.querySelector('.wl-nav-f'); const lr = l.getBoundingClientRect(); return { t: b.dataset.tab, x: r.x, w: r.width, b: r.bottom, label: l.textContent, lw: lr.width, trunc: l.scrollWidth > l.clientWidth + 1 }; }));
      assert.deepEqual(rows.map((r) => r.t), TABS);
      for (const r of rows) { assert.ok(r.w >= 150 && r.b <= H && r.lw > 40 && !r.trunc, JSON.stringify(r)); }
      const badge = await page.evaluate(() => { const b = document.querySelector('[data-badge]'); if (!b) return null; const r = b.getBoundingClientRect(); return { r: r.right, w: r.width }; });
      assert.ok(badge && badge.w > 0 && badge.r <= 260, 'a badge is visible inside the rail');
    } finally { await ctx.close(); }
  });
}

test('1440px: shortcuts switch verticals, change speed, step a month, and Escape closes the side panel', async () => {
  const { ctx, page, errors } = await openGame(browser, { svg: true, width: 1440, height: 900 });
  try {
    const cur = () => page.evaluate(() => document.querySelector('[data-nav] [aria-current=page]')?.dataset.tab);
    await page.mouse.move(700, 450);
    for (let i = 0; i < 9; i++) { await page.keyboard.press(String(i + 1)); await settle(page, 80); assert.equal(await cur(), TABS[i], `key ${i + 1}`); }
    const speed = () => page.evaluate(() => document.querySelector('[data-speed] [aria-pressed=true]')?.textContent);
    await page.keyboard.press('='); await settle(page, 100); assert.equal(await speed(), '2×');
    await page.keyboard.press('='); await settle(page, 100); assert.equal(await speed(), '4×');
    await page.keyboard.press('-'); await settle(page, 100); assert.equal(await speed(), '2×');
    await page.keyboard.press('Space'); await settle(page, 100);
    assert.ok(await page.evaluate(() => document.querySelector('[data-pause]').getAttribute('aria-pressed') === 'true'), 'Space pauses');
    const m = () => page.evaluate(() => document.querySelector('.wl-hud-nation small').textContent.slice(0, 8));
    const before = await m(); await page.keyboard.press('.'); await settle(page, 400); assert.notEqual(await m(), before, '. steps one month');
    await page.keyboard.press('1'); await settle(page, 200);
    await page.evaluate(() => document.querySelector('[data-region], .region-path')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await settle(page, 400);
    if (await page.$('[data-sheet]')) { await page.keyboard.press('Escape'); await settle(page, 500); assert.equal(await page.$('[data-sheet]'), null, 'Escape closes the side panel'); }
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('1440px: hovering a HUD figure opens its breakdown without a click; leaving closes it', async () => {
  const { ctx, page } = await openGame(browser, { svg: true, width: 1440, height: 900 });
  try {
    await page.hover('[data-why^="Treasury"]'); await settle(page, 500);
    assert.ok(await page.$('[data-why-content^="Treasury"]'), 'hover opens');
    await page.mouse.move(700, 600); await settle(page, 600);
    assert.equal(await page.$('[data-why-content^="Treasury"]'), null, 'leave closes');
    await page.click('[data-why^="Treasury"]'); await settle(page, 400);
    assert.ok(await page.$('[data-why-content^="Treasury"]'), 'click still opens and stays open');
  } finally { await ctx.close(); }
});

// D2 Overview: the map is the centerpiece. It is the largest block on the screen, shows the whole world (no crop,
// 1000:520), and the situation cards sit under it rather than beside it.
for (const [W, H, minW] of [[1280, 800, 560], [1440, 900, 700], [1920, 1080, 960]]) {
  test(`${W}px: Overview map is dominant (>= ${minW}px wide, whole world, cards below, vitals and outliner flank)`, async () => {
    const { ctx, page } = await openGame(browser, { width: W, height: H });
    try {
      await page.evaluate(() => document.querySelector('[data-tab=overview]').click()); await settle(page, 600);
      const r = await page.evaluate(() => { const q = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, r: b.right, b: b.bottom, w: b.width, h: b.height }; }; return { host: q('.wl-mv-host') || q('[data-map] svg'), vitals: q('.wl-vitals'), outliner: q('[data-outliner]'), flank: q('.wl-flank'), card: q('.wl-map-card') }; });
      assert.ok(r.host.w >= minW, `map ${Math.round(r.host.w)}px < ${minW}`);
      assert.ok(Math.abs(r.host.w / r.host.h - 1000 / 520) < 0.08, `whole world, aspect ${(r.host.w / r.host.h).toFixed(2)}`);
      assert.ok(r.vitals.r <= r.card.x + 1 && r.card.x + r.card.w <= r.outliner.x + 1, 'vitals left, outliner right of the map');
      assert.ok(r.flank.y >= r.card.b - 1, 'situation cards sit under the map');
      for (const k of ['vitals', 'outliner', 'flank', 'card']) assert.ok(r[k].r <= W + 0.5 && r[k].b <= H + 0.5, `${k} inside the viewport`);
    } finally { await ctx.close(); }
  });
}

// D3 Arsenal: Programs and Procurement are master-detail (sortable table beside a detail pane); Exports is a buyers table.
const seg = (page, id) => page.evaluate((id) => document.querySelector(`[data-seg=${id}]`).click(), id).then(() => settle(page, 300));
const box = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);
const visibleRows = (page, sel, H) => page.evaluate(([sel, H]) => [...document.querySelectorAll(`${sel} tbody tr`)].filter((r) => { const b = r.getBoundingClientRect(); return b.top >= 0 && b.bottom <= H; }).length, [sel, H]);
for (const [W, H] of [[1280, 800], [1440, 900], [1920, 1080]]) {
  test(`${W}px: Arsenal Programs is a table beside a detail pane; sorts, selects, arrow keys`, async () => {
    const { ctx, page, errors } = await openGame(browser, { width: W, height: H });
    try {
      await page.evaluate(() => { const h = window.__wl; h.fund(60000); h.field('b21', 1); h.field('f47', 1); });
      await go(page, 'arsenal');
      const t = await box(page, '[data-table=programs]'), d = await box(page, '[data-detail=programs]');
      assert.ok(t && d && t.w >= 420 && d.w >= 320 && d.x >= t.r - 1, `table ${JSON.stringify(t)} detail ${JSON.stringify(d)}`);
      assert.ok((t.w + d.w) / W >= 0.5, 'list + detail use the width');
      assert.equal(await visibleRows(page, '[data-table=programs]', H), 7, 'all seven programs visible at once');
      const title = () => page.evaluate(() => document.querySelector('[data-detail=programs] [data-program]')?.dataset.program);
      const first = await title();
      await page.click('[data-table=programs] tbody tr:nth-child(3)'); await settle(page, 150);
      assert.notEqual(await title(), first, 'row click swaps the detail');
      const order = () => page.evaluate(() => [...document.querySelectorAll('[data-table=programs] tbody tr')].map((r) => r.dataset.row));
      const before = await order(); await page.click('[data-sort=cost]'); await settle(page, 100); const first1 = await order();
      assert.notDeepEqual(first1, before, 'cost sort reorders'); await page.click('[data-sort=cost]'); await settle(page, 100);
      assert.deepEqual((await order()), [...first1].reverse(), 'second click reverses');
      assert.equal(await page.evaluate(() => document.querySelector('[data-sort=cost]').closest('th').getAttribute('aria-sort')), 'ascending', 'numeric columns sort high-to-low first, then reverse');
      const cur = await title(); await page.focus('[data-table=programs] tbody tr[aria-selected=true]'); await page.keyboard.press('ArrowDown'); await settle(page, 150);
      assert.notEqual(await title(), cur, 'ArrowDown moves the selection');
      const o = await overflow(page, W); assert.deepEqual(o.bad, []);
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}
test('1440px: Arsenal Procurement shows every platform in one table; Exports shows every buyer; supply/partnerships/deterrence use two columns', async () => {
  const { ctx, page, errors } = await openGame(browser, { width: 1440, height: 900 });
  try {
    await go(page, 'arsenal'); await seg(page, 'procurement');
    const n = await page.evaluate(() => document.querySelectorAll('[data-table=platforms] tbody tr').length);
    assert.ok(n >= 19 && await visibleRows(page, '[data-table=platforms]', 900) >= 17, `platform rows ${n}`);
    const d = await box(page, '[data-detail=platforms]'), t = await box(page, '[data-table=platforms]'); assert.ok(d.x >= t.r - 1, 'detail pane beside the table');
    await page.click('[data-table=platforms] tbody tr:nth-child(2)'); await settle(page, 150);
    assert.match(await page.evaluate(() => document.querySelector('[data-detail=platforms] [data-platform]').dataset.platform), /\w+/);
    await seg(page, 'exports');
    assert.ok(await page.evaluate(() => document.querySelectorAll('[data-table=buyers] tbody tr').length) >= 12);
    for (const id of ['supply', 'partnerships', 'deterrence']) {
      await seg(page, id);
      const cols = await page.evaluate(() => new Set([...document.querySelectorAll('[data-arsenal] > section')].map((e) => Math.round(e.getBoundingClientRect().x))).size);
      assert.ok(cols >= 2, `${id}: ${cols} column(s)`);
    }
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
