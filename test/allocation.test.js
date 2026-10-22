import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { SECTORS, ALLOC, poolCost, costOf, allocFor, squeeze, deltas } from '../src/ui/economy/pool.js';
import { calcSCost } from '../src/sim/formulas.js';
import { mount, BUNDLES, flush } from './util/harness.js';
import { launch, openGame, settle, stableRect } from './util/browser.js';
import { applyVerb } from '../src/sim/actions.js';

test('setSectorBudgets: one action sets several lines with the setSectorBudget rule (clamped to 0..200, unknown sectors ignored)', () => {
  let alloc = { defense: 100, energy: 100, healthcare: 100, education: 100, technology: 100 };
  const S = { setBudgetAlloc: (f) => { alloc = typeof f === 'function' ? f(alloc) : f; } };
  applyVerb({}, S, { toast() {} }, { type: 'setSectorBudgets', payload: { allocs: { defense: 150, energy: 60, bogus: 999, healthcare: -5, education: 250 } } });
  assert.deepEqual(alloc, { defense: 150, energy: 60, healthcare: 0, education: 200, technology: 100 });
});

// V2e (docs/DESIGN-SYSTEM-V2.md §4): one pool. Dragging one line squeezes the unlocked others proportionally; a
// lock exempts a line; each line shows its change against the baseline; a squeezed alert lists what was cut. The
// engine keeps five independent allocations and the pool is the sum of its own calcSCost; the squeeze is UI-side.

const flat = () => Object.fromEntries(SECTORS.map((k) => [k, 100]));

test('pool: costs are the engine formula; the inverse snaps to the step; raising one line cuts the others in proportion and keeps the pool within rounding', () => {
  const m = { defense: 24 };
  for (const k of SECTORS) assert.equal(costOf(k, 130, m), calcSCost(k, 130, m));
  assert.equal(allocFor('defense', costOf('defense', 135, m), m), 135); assert.equal(allocFor('energy', 0, m), 0); assert.equal(allocFor('energy', 1e9, m), ALLOC.max);
  const r = squeeze({ allocs: flat(), maturity: m, sector: 'defense', value: 150 });
  assert.equal(r.moved.to, 150); assert.equal(r.allocs.defense, 150); assert.equal(r.squeezed, true);
  assert.deepEqual(r.cuts.map((c) => c.sector).sort(), ['education', 'energy', 'healthcare', 'technology'], 'every unlocked line gives');
  for (const c of r.cuts) assert.ok(c.to < c.from && c.to % ALLOC.step === 0, JSON.stringify(c));
  // proportional in cost: each giver loses the same share of its own cost (within one slider step)
  const share = r.cuts.map((c) => (costOf(c.sector, c.from, m) - costOf(c.sector, c.to, m)) / costOf(c.sector, c.from, m));
  assert.ok(Math.max(...share) - Math.min(...share) < 0.12, `shares ${share.map((x) => x.toFixed(2))}`);
  const slack = Math.abs(r.pool.after - r.pool.before); assert.ok(slack <= 0.2 * r.cuts.length * 1 + 1.5, `pool kept within rounding: ${r.pool.before} -> ${r.pool.after}`);
  // lowering a line feeds the others
  const f = squeeze({ allocs: flat(), maturity: m, sector: 'defense', value: 50 });
  assert.equal(f.squeezed, false); assert.equal(f.fed, true); assert.ok(f.cuts.every((c) => c.to > c.from));
});

test('pool: locks are never touched; with every other line locked the pool just grows; deltas report against the baseline', () => {
  const locks = new Set(['healthcare', 'education']);
  const r = squeeze({ allocs: flat(), locks, sector: 'defense', value: 160 });
  assert.equal(r.allocs.healthcare, 100); assert.equal(r.allocs.education, 100);
  assert.deepEqual(r.cuts.map((c) => c.sector).sort(), ['energy', 'technology']);
  assert.ok(r.allocs.energy < 100 && r.allocs.technology < 100);
  const all = squeeze({ allocs: flat(), locks: new Set(SECTORS.filter((k) => k !== 'defense')), sector: 'defense', value: 160 });
  assert.deepEqual(all.cuts, []); assert.equal(all.squeezed, false); assert.ok(all.pool.after > all.pool.before);
  const floor = squeeze({ allocs: { ...flat(), energy: 0, technology: 0 }, locks: new Set(['healthcare', 'education']), sector: 'defense', value: 160 });
  assert.deepEqual(floor.cuts, [], 'lines at the floor cannot give');
  const d = deltas({ ...flat(), defense: 130, energy: 80 }, flat());
  assert.equal(d.defense.dAlloc, 30); assert.ok(d.defense.dCost > 0); assert.equal(d.energy.dAlloc, -20); assert.ok(d.energy.dCost < 0); assert.equal(d.healthcare.dAlloc, 0);
  assert.equal(poolCost(flat(), {}), SECTORS.reduce((s, k) => s + calcSCost(k, 100, {}), 0));
});

test('App (jsdom): pool held by default; a drag is local and commits one batched setSectorBudgets on release; free pool commits one setSectorBudget; a lock holds; baseline deltas; ALLOCATE opens the drawer', async () => {
  const origErr = console.error; console.error = () => {};
  const g = await mount(BUNDLES.app, { testHook: true, seed: 3 });
  try {
    await g.pickCountry(0);
    const { doc, w } = g; const q = (s) => doc.querySelector(s), qa = (s) => [...doc.querySelectorAll(s)];
    [...q('[data-event-card=doctrine]').querySelectorAll('div')].find((d) => d.style.cursor === 'pointer' && /Military Superpower/.test(d.textContent)).click(); await flush();
    g.tabBtn('economy').click(); await flush(); await flush();
    const sl = (k) => q(`[data-alloc-line=${k}] input[type=range]`); const val = (k) => +sl(k).value;
    const set = async (k, v) => { const el = sl(k); const proto = Object.getPrototypeOf(el); Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(v)); el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); await flush(); await flush(); };
    assert.equal(qa('[data-allocation=full] [data-alloc-line]').length, 5); assert.equal(qa('[data-allocation=full] input[type=range][max="200"]').length, 5);
    assert.equal(q('[data-pool-hold]').getAttribute('aria-pressed'), 'true', 'pool held by default (v2: one pool)');
    // a drag is local until release: five input events move only the slider, the one change event commits exactly one action
    const inputs = async (k, vs) => { for (const v of vs) { const el = sl(k); Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, String(v)); el.dispatchEvent(new w.Event('input', { bubbles: true })); await flush(); } };
    const n0 = w.__wl.dispatched().length;
    await inputs('defense', [105, 110, 120, 130, 150]);
    assert.equal(val('defense'), 150, 'slider follows the drag'); assert.equal(q('[data-allocation=full]').dataset.dragging, 'defense'); assert.ok(q('[data-drag-preview]'), 'preview while dragging');
    assert.equal(w.__wl.dispatched().length, n0, 'nothing dispatched during the drag'); assert.equal(val('energy'), 100, 'others untouched until release');
    sl('defense').dispatchEvent(new w.Event('change', { bubbles: true })); await flush(); await flush();
    assert.deepEqual(Array.from(w.__wl.dispatched().slice(n0)), ['setSectorBudgets'], 'release = one batched action');
    assert.equal(val('defense'), 150); for (const k of ['energy', 'healthcare', 'education', 'technology']) assert.ok(val(k) < 100, `${k} squeezed to ${val(k)}`);
    assert.ok(q('[data-squeezed]'), 'squeezed alert'); assert.equal(q('[data-drag-preview]'), null);
    // pool free: the same drag is one plain setSectorBudget and moves one line (what the v57 parity replay sees)
    q('[data-pool-hold]').click(); await flush(); assert.equal(q('[data-pool-hold]').getAttribute('aria-pressed'), 'false');
    const n1 = w.__wl.dispatched().length; await inputs('defense', [140, 130]); sl('defense').dispatchEvent(new w.Event('change', { bubbles: true })); await flush(); await flush();
    assert.deepEqual(Array.from(w.__wl.dispatched().slice(n1)), ['setSectorBudget'], 'free pool: one plain action'); assert.equal(val('defense'), 130);
    const others = ['energy', 'healthcare', 'education', 'technology'].map(val);
    await set('defense', 135); assert.deepEqual(['energy', 'healthcare', 'education', 'technology'].map(val), others, 'free pool never touches the other lines');
    assert.match(q('[data-delta=defense]').textContent, /\+35%/, 'change vs baseline');
    // hold again, lock healthcare, raise defense further: the three unlocked lines give way, healthcare does not
    q('[data-pool-hold]').click(); await flush(); assert.equal(q('[data-pool-hold]').getAttribute('aria-pressed'), 'true');
    q('[data-lock=healthcare]').click(); await flush(); assert.equal(q('[data-lock=healthcare]').getAttribute('aria-pressed'), 'true');
    const hc0 = val('healthcare'); const e0 = val('energy');
    await set('defense', 170);
    assert.equal(val('defense'), 170); assert.equal(val('healthcare'), hc0, 'locked line holds');
    for (const k of ['energy', 'education', 'technology']) assert.ok(val(k) < 100, `${k} squeezed to ${val(k)}`); assert.ok(val('energy') < e0, 'energy gave again');
    const alert = q('[data-squeezed]'); assert.ok(alert, 'squeezed alert'); assert.match(alert.textContent, /Squeezed to pay for 🛡️ Defense 135% → 170%/); assert.match(alert.textContent, /Energy \d+% → \d+%/); assert.doesNotMatch(alert.textContent, /Healthcare/);
    assert.match(q('[data-delta=energy]').textContent, /−\d+%/);
    // the HUD ALLOCATE button opens the drawer with the same surface and live values
    q('[data-allocate]').click(); await flush(); await flush();
    assert.ok(q('[data-sheet] [data-allocation=drawer]'), 'drawer open'); assert.equal(+q('[data-allocation=drawer] [data-alloc-line=defense] input').value, 170);
    // one action, not one per line: the verb exists and clamps (engine-side check of the batched setter)
    assert.match(q('[data-pause-reason]').textContent, /sheet open/, 'the drawer holds the clock');
    q('[data-allocate-full]').click(); await flush(); await flush(); assert.equal(q('[data-tab=economy]').getAttribute('aria-current'), 'page');
    assert.ok(!g.faulted());
  } finally { console.error = origErr; g.close(); }
});

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });
for (const [W, H] of [[1440, 900], [390, 844]]) {
  test(`${W}px: the ALLOCATE drawer and the Economy surface fit the viewport; lines are 44px rows with a lock`, async () => {
    const { ctx, page, errors } = await openGame(browser, { svg: true, width: W, height: H });
    try {
      await page.click('[data-allocate]'); await settle(page, 700);
      const sh = await stableRect(page, '[data-sheet]', { within: { W, H } }); assert.ok(sh && sh.x >= -0.5 && sh.r <= W + 0.5 && sh.b <= H + 0.5, `drawer ${JSON.stringify(sh)}`);
      const rows = await page.evaluate(() => [...document.querySelectorAll('[data-allocation=drawer] [data-alloc-line]')].map((e) => { const r = e.getBoundingClientRect(); const l = e.querySelector('[data-lock]').getBoundingClientRect(); return { h: r.height, x: r.x, r: r.right, lock: l.width }; }));
      assert.equal(rows.length, 5); for (const r of rows) assert.ok(r.h >= 44 && r.x >= -0.5 && r.r <= W + 0.5 && r.lock >= 36, JSON.stringify(r));
      await page.keyboard.press('Escape'); await settle(page, 500);
      await page.evaluate(() => document.querySelector('[data-tab=economy]').click()); await settle(page, 400);
      const full = await page.evaluate(() => { const e = document.querySelector('[data-allocation=full]'); const r = e.getBoundingClientRect(); return { x: r.x, r: r.right, lines: document.querySelectorAll('[data-allocation=full] [data-alloc-line]').length }; });
      assert.equal(full.lines, 5); assert.ok(full.x >= -0.5 && full.r <= W + 0.5, JSON.stringify(full));
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}
