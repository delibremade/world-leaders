import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMonth } from '../src/sim/tick.js';
import { applyVerb } from '../src/sim/actions.js';
import { newCampaign, STATE_FIELDS } from '../src/sim/state.js';
import { checkV57 } from '../src/sim/invariants.js';
import { COUNTRIES } from '../src/data/nations.js';
import { FORCE_RULES, FLEET_RULES as FL } from '../src/data/forces.js';
import { fleetFill } from '../src/sim/formulas.js';
import { forceView, fleetView, crewStatus, pipeCost, expandCost } from '../src/sim/forces.js';
import { setRngSource, mulberry32 } from '../src/sim/rng.js';
import { mount, flush, BUNDLES } from './util/harness.js';

// #91: crews scale with funding. Trained crews are headcounts per branch fed by pipelines whose monthly starts are the smallest of
// training funding x capacity, pipeline capacity, and the recruits the population supplies; funded pipelines grow with the fleet.
const CP = FL.crewPipe;
function headless(nid = 'usa', seed = 1) {
  setRngSource(mulberry32(seed));
  const g = newCampaign(COUNTRIES[COUNTRIES.findIndex((c) => c.id === nid)]); g.doctrine = 'hegemon';
  const ui = { log: [], ledger: {} }; const toasts = [];
  const S = new Proxy({}, { get: (_, name) => (v) => { const k = name[3].toLowerCase() + name.slice(4); const box = STATE_FIELDS.includes(k) ? g : ui; box[k] = typeof v === 'function' ? v(box[k]) : v; } });
  const fx = { toast: (m) => toasts.push(m), now: () => 0, defer: (fn) => fn() };
  return { g, ui, toasts, month: () => { g.stats = { ...g.stats, treasury: 1e7 }; ui.ledger = {}; runMonth(g, S, fx); assert.deepEqual(checkV57(g), []); }, run: (type, payload) => applyVerb(g, S, fx, { type, payload }) };
}
const fill = (g) => fleetFill(g.forces).fill;
const short = (g) => ['land', 'air', 'sea'].filter((b) => fill(g)[b] < 1 - 1e-9);
// Run n months; `each(k)` before month k; returns the first month a branch is short and its binding constraint.
function run(h, n, each) {
  for (let k = 1; k <= n; k++) { each?.(k); h.month(); const s = short(h.g); if (s.length) return { month: k, b: s[0], binding: h.g.forces.crewWhy[s[0]].binding }; }
  return null;
}
const buy = (g, unit, k = 1) => { g.platforms = { ...g.platforms, [unit]: (g.platforms[unit] || 0) + k }; };

test('start: crews are headcounts at the 2024 fill, pipelines at steady state, capacity above replacement; 240 idle months stay fully crewed for every nation', () => {
  for (const c of COUNTRIES) {
    const h = headless(c.id, 4); const f = h.g.forces;
    assert.ok(f.cap && f.crewFund === 100, c.id);
    for (const b of ['land', 'air', 'sea']) { assert.ok(fill(h.g)[b] === 1, `${c.id} ${b} fill`); assert.ok(f.pipe.filter((p) => p.b === b).length === FORCE_RULES.pipeMo[b] || !f.crews[b], `${c.id} ${b} pipeline full`); }
    assert.equal(run(h, 240), null, `${c.id}: no shortage with nothing bought`);
  }
});

test('done-when (#91): at full training funding and adequate manpower, buying at a normal rate never produces a crew shortage', () => {
  // US: a fighter wing (24 airframes) every quarter for 15 years, a carrier group every 5 years, a Virginia pair every 2 years.
  const us = headless('usa', 2);
  assert.equal(run(us, 180, (k) => { if (k % 3 === 0) buy(us.g, 'fighter_wing'); if (k % 60 === 0) buy(us.g, 'carrier_group'); if (k % 24 === 0) buy(us.g, 'sub_fleet'); }), null);
  const air = fleetView(us.g).lines.filter((l) => l.b === 'air').reduce((a, l) => a + l.crewless, 0); assert.equal(air, 0, 'no crewless airframes');
  assert.ok(us.g.forces.cap.air > headless('usa', 2).g.forces.cap.air * 1.15, `the air pipeline grew with the fleet: ${Math.round(us.g.forces.cap.air)}/mo`);
  // Norway: one F-35 squadron every four years (2017-24 real pace, ~6 a year); China: a J-20 regiment every six months.
  const no = headless('norway', 2); assert.equal(run(no, 144, (k) => { if (k % 48 === 0) buy(no.g, 'fighter_wing'); }), null);
  const cn = headless('china', 2); assert.equal(run(cn, 120, (k) => { if (k % 6 === 0) buy(cn.g, 'fighter_wing'); }), null);
});

test('done-when (#91): a 50 percent training cut produces a shortage within 36 months, bound by funding; restoring funding recovers', () => {
  const h = headless('usa', 3); h.run('setCrewFunding', { pct: 50 }); assert.equal(h.g.forces.crewFund, 50);
  const s = run(h, 36); assert.ok(s && s.month <= 36 && s.month >= 12, JSON.stringify(s)); assert.equal(s.binding, 'funding');
  assert.ok(h.ui.ledger['Crew pipeline'] < 0);
  const cap0 = { ...h.g.forces.cap }; buy(h.g, 'fighter_wing', 4); h.month(); assert.ok(h.g.forces.cap.air <= cap0.air + 1e-9, 'underfunded pipelines do not grow with the fleet');
  h.run('setCrewFunding', { pct: 125 }); let k = 0; while (short(h.g).length && k < 60) { h.month(); k++; } assert.ok(!short(h.g).length, `recovered in ${k} months`);
});

test('done-when (#91): recruitable population exhausted (no one enlists) produces a shortage, bound by manpower; funding and capacity cannot fix it', () => {
  const h = headless('usa', 3); h.run('setPersonnelPay', { pay: 0 }); h.run('setCrewFunding', { pct: 150 });
  const s = run(h, 24); assert.ok(s && s.month <= 18, JSON.stringify(s)); assert.equal(s.binding, 'manpower');
  assert.equal(h.g.forces.recruits, 0, 'propensity 0: no recruits');
});

test('pipeline capacity: a surge beyond the pipeline binds on capacity; buying capacity crews it sooner; trained + training never exceed active', () => {
  const surge = (expand) => {
    const h = headless('usa', 5); buy(h.g, 'fighter_wing', 40); h.month();
    assert.equal(h.g.forces.crewWhy.air.binding, 'pipeline');
    if (expand) { const c0 = h.g.forces.cap.air; const t0 = h.g.stats.treasury; const cost = expandCost(h.g.forces, 'air'); h.run('expandPipeline', { branch: 'air' }); assert.ok(Math.abs(h.g.forces.cap.air - c0 * (1 + CP.expand)) < 1e-6); assert.equal(h.g.stats.treasury, t0 - cost); h.run('expandPipeline', { branch: 'air' }); }
    let k = 1; while (short(h.g).length && k < 60) { h.month(); k++; } return k;
  };
  const slow = surge(false); const fast = surge(true);
  assert.ok(fast < slow, `expansion crews 960 new fighters in ${fast} months instead of ${slow}`);
  const h = headless('usa'); h.g.stats = { ...h.g.stats, treasury: 0 }; h.run('expandPipeline', { branch: 'sea' }); assert.match(h.toasts.at(-1), /Need \$/);
});

test('funding: Crew pipeline ledger scales with funding and is zero while the training budget is Unfunded (which also stops starts)', () => {
  const h = headless('usa'); h.month(); const full = -h.ui.ledger['Crew pipeline']; assert.ok(full > 0);
  assert.ok(Math.abs(pipeCost(h.g.forces) - full) < 1, 'one formula for the ledger and the view');
  h.run('setCrewFunding', { pct: 50 }); h.month(); assert.ok(Math.abs(-h.ui.ledger['Crew pipeline'] - full / 2) < full * 0.05);
  h.run('setCrewFunding', { pct: 100 }); h.run('setTraining', { level: 0 }); h.month(); assert.equal(h.ui.ledger['Crew pipeline'], undefined);
  assert.ok(Object.values(h.g.forces.crewWhy).every((w) => w.starts === 0 && w.limits.funding === 0));
  h.run('setCrewFunding', { pct: 999 }); assert.equal(h.g.forces.crewFund, CP.fundMax);
});

test('view: every branch reports trained, need, in training, capacity and the three limits; the deploy gate follows the fill', () => {
  const h = headless('usa'); h.month();
  const p = forceView(h.g).pipes; assert.equal(p.branches.length, 3);
  for (const b of p.branches) { assert.ok(b.trained >= b.need && b.cap > 0 && b.training > 0); assert.deepEqual(Object.keys(b.limits), ['funding', 'pipeline', 'manpower']); assert.equal(b.binding, null); }
  assert.ok(crewStatus(h.g).air.gap === 0);
  buy(h.g, 'carrier_group'); assert.ok(crewStatus(h.g).sea.free >= 4, 'a crewed branch stations what it owns');
  h.g.forces = { ...h.g.forces, crews: { ...h.g.forces.crews, sea: 0 } }; assert.ok(crewStatus(h.g).sea.crews === 0 && crewStatus(h.g).sea.gap === 4, 'no trained sailors: the carrier cannot sail');
});

test('App: Forces > Training shows the crew pipelines with a tooltip table naming the binding constraint; the funding chips and expand dispatch', async () => {
  const origErr = console.error; console.error = () => {};
  const g = await mount(BUNDLES.app, { testHook: true });
  try {
    await g.pickCountry(0); await flush();
    const { doc } = g; const q = (sel) => doc.querySelector(sel);
    const click = async (el) => { el.dispatchEvent(new g.w.MouseEvent('click', { bubbles: true })); await flush(); await flush(); };
    await click(q('[data-tab=forces]')); await click(q('[data-segbar=forces] [data-seg=training]'));
    assert.ok(q('[data-crew-pipes]'), 'pipelines panel'); for (const b of ['land', 'air', 'sea']) assert.ok(q(`[data-crew-branch=${b}]`), b);
    await click(q('[data-crew-fund="50"]')); assert.ok(g.w.__wl.dispatched().includes('setCrewFunding'));
    await g.advance(1);
    await click(q('[data-crew-why=land]'));
    const tip = q('[data-why-content="Land crew starts"]'); assert.ok(tip, 'tooltip open');
    assert.match(tip.textContent, /Training funding 50%/); assert.match(tip.textContent, /Pipeline capacity/); assert.match(tip.textContent, /Recruits available/); assert.match(tip.textContent, /Binding: Training underfunded/);
    await click(q('[data-expand-pipe=air]')); assert.ok(g.w.__wl.dispatched().includes('expandPipeline'));
  } finally { console.error = origErr; g.close(); }
});
