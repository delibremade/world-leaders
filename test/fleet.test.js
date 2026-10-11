import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMonth } from '../src/sim/tick.js';
import { applyVerb } from '../src/sim/actions.js';
import { newCampaign, STATE_FIELDS } from '../src/sim/state.js';
import { checkV57 } from '../src/sim/invariants.js';
import { forceMult, equipF, manPts } from '../src/sim/formulas.js';
import { fleetView, theaterCapability, basingMult, buyLine, newForces } from '../src/sim/forces.js';
import { ORBAT, MANPOWER, OWNER_PARAMS, UNIT_PLATFORMS, manpowerCap } from '../src/data/orbat.js';
import { FLEET_RULES as FL } from '../src/data/forces.js';
import { BLACK_PROGRAMS } from '../src/data/platforms.js';
import { COUNTRIES, NATIONS } from '../src/data/nations.js';
import { setRngSource, mulberry32 } from '../src/sim/rng.js';

// F7b (#55), spec Part 9: the order of battle as engine. Headcount manpower bounded by population, per-type mission-capable rates
// driven by maintenance and depot throughput, attrition, modernization, retirement, procurement into existing fleets, theater capability.
const idx = (id) => COUNTRIES.findIndex((c) => c.id === id);
function headless(nid = 'usa', seed = 1) {
  setRngSource(mulberry32(seed));
  const g = newCampaign(COUNTRIES[idx(nid)]); g.doctrine = 'hegemon'; g.gracePeriod = 999;
  const ui = { log: [], ledger: {} }; const toasts = [];
  const S = new Proxy({}, { get: (_, name) => (v) => {
    const k = name[3].toLowerCase() + name.slice(4);
    const box = STATE_FIELDS.includes(k) ? g : ui;
    box[k] = typeof v === 'function' ? v(box[k]) : v;
  } });
  const fx = { toast: (m) => toasts.push(m), now: () => 0, defer: (fn) => fn() };
  return { g, ui, toasts, month: () => runMonth(g, S, fx), run: (type, payload) => applyVerb(g, S, fx, { type, payload }) };
}
const months = (h, n, each) => { for (let i = 0; i < n; i++) { h.month(); each?.(h); assert.deepEqual(checkV57(h.g), [], `month ${i + 1}`); } };
const rich = (g) => { g.stats = { ...g.stats, treasury: 500000 }; };
const line = (g, id) => fleetView(g).lines.find((l) => l.id === id);

test('done-when: a US campaign starts with the real 2024 fleet, counts visible per type, headcount manpower', () => {
  const h = headless('usa'); const f = h.g.forces;
  for (const l of ORBAT.usa) { assert.equal(f.fleet[l.id].n, l.count, l.id); assert.equal(f.fleet[l.id].mc, l.mc, l.id); }
  assert.equal(f.active, MANPOWER.usa.active); assert.equal(f.reserve, MANPOWER.usa.reserve);
  const v = fleetView(h.g);
  assert.equal(v.lines.length, ORBAT.usa.length);
  assert.deepEqual([line(h.g, 'f22').count, line(h.g, 'cvn').count, line(h.g, 'ssbn').count], [183, 11, 14]);
  for (const x of v.lines) assert.ok(x.status_source, `${x.id}: source line shown`);
  assert.ok(line(h.g, 'f22').ready > 0 && line(h.g, 'f22').ready < 183, 'ready = crewed x MC');
  assert.ok(v.branches.every((b) => b.fill === 1), 'the 2024 fleet is fully crewed');
  assert.deepEqual(checkV57(h.g), []);
  // Every playable nation starts with its own order of battle.
  for (const c of COUNTRIES) { const g = headless(c.id).g; assert.equal(Object.keys(g.forces.fleet).length, ORBAT[c.id].length, c.id); assert.deepEqual(checkV57(g), [], c.id); }
});

test('done-when: a 10% maintenance cut lowers mission-capable rates within 12 months; Maintenance is a ledger line', () => {
  const base = headless('usa', 3); const cut = headless('usa', 3);
  for (const h of [base, cut]) rich(h.g);
  cut.run('setMaintenance', { line: 'all', pct: 90 });
  assert.equal(cut.g.forces.fleet.f22.mx, 90);
  assert.match(cut.toasts.at(-1), /Maintenance all types: 90%/);
  months(base, 12, rich); months(cut, 12, rich);
  for (const l of ORBAT.usa) if (l.count > 0 && l.mc > 0) assert.ok(cut.g.forces.fleet[l.id].mc < base.g.forces.fleet[l.id].mc, `${l.id}: ${cut.g.forces.fleet[l.id].mc} < ${base.g.forces.fleet[l.id].mc}`);
  const d22 = base.g.forces.fleet.f22.mc - cut.g.forces.fleet.f22.mc;
  assert.ok(d22 >= 1.5, `F-22 MC down ${d22.toFixed(2)} points`);
  assert.ok(cut.ui.ledger.Maintenance > base.ui.ledger.Maintenance && base.ui.ledger.Maintenance < 0, 'cut spends less');
  assert.ok(base.ui.ledger.Depot < 0, 'depot is a ledger line');
  assert.ok(equipF(cut.g.forces, 'air') < equipF(base.g.forces, 'air'), 'lower MC lowers air capability');
  // One type alone: only that line moves.
  const one = headless('usa', 3); rich(one.g); one.run('setMaintenance', { line: 'b1b', pct: 60 }); months(one, 6, rich);
  assert.ok(one.g.forces.fleet.b1b.mc < base.g.forces.fleet.b1b.mc - 3);
  assert.ok(Math.abs(one.g.forces.fleet.f22.mc - ORBAT.usa.find((l) => l.id === 'f22').mc) < 0.5);
});

test('done-when: crewless airframes sit unready, never vanish', () => {
  const h = headless('usa', 2); const r0 = line(h.g, 'f22').ready; const eq0 = equipF(h.g.forces, 'air');
  h.g.forces = { ...h.g.forces, active: Math.round(MANPOWER.usa.active * 0.2) };
  const v = line(h.g, 'f22');
  assert.equal(v.count, 183, 'airframes stay on the books');
  assert.ok(v.crewless > 0 && v.crewed < 183 && v.ready < r0, `crewed ${v.crewed}, ready ${v.ready} < ${r0}`);
  assert.ok(fleetView(h.g).branches.find((b) => b.id === 'air').fill < 1);
  assert.ok(equipF(h.g.forces, 'air') < eq0, 'unready airframes add no capability');
  h.month(); assert.equal(h.g.forces.fleet.f22.n, 183, 'a month later still 183');
  // Procurement beyond the crews: platforms arrive, the fill drops.
  const p = headless('norway'); p.g.forces = { ...p.g.forces, active: 6000 };
  p.g.blackPrograms = { f35: 4 }; p.month();
  assert.equal(p.g.forces.fleet.f35a.n, 52 + 4 * UNIT_PLATFORMS.f35.per);
  assert.ok(line(p.g, 'f35a').crewless > 0);
});

test('done-when: the population bound holds; recruitment is propensity of the eligible cohort', () => {
  for (const nid of ['usa', 'norway', 'cuba']) {
    const h = headless(nid, 4); const cap = manpowerCap(nid); const m = MANPOWER[nid];
    h.run('setPersonnelPay', { pay: 200 });
    months(h, 60, (x) => { x.g.stats = { ...x.g.stats, unemployment: 30, stability: 100, treasury: 500000 }; const f = x.g.forces;
      assert.ok(f.active + f.reserve <= cap + 1e-6, `${nid}: ${f.active + f.reserve} > ${cap}`);
      assert.ok(f.recruits <= m.cohort * m.elig / m.cohortYears / 12 + 1e-6, `${nid}: recruits above the eligible intake`); });
    assert.ok(fleetView(h.g).manpower.prop <= 1);
    // Pinned against the cap: never past it.
    const f = h.g.forces; h.g.forces = { ...f, active: cap - f.reserve - 10 }; months(h, 3, (x) => { x.g.stats = { ...x.g.stats, unemployment: 30, stability: 100 }; });
    assert.ok(h.g.forces.active + h.g.forces.reserve <= cap + 1e-6);
  }
  const g = headless('usa').g;
  assert.ok(checkV57({ ...g, forces: { ...g.forces, active: manpowerCap('usa') } }).some((n) => /population/.test(n)), 'invariant names the bound');
  // 2024 conditions roughly hold 2024 strength for two years (within 5%).
  const h = headless('usa', 5); months(h, 24, rich);
  assert.ok(Math.abs(h.g.forces.active / MANPOWER.usa.active - 1) < 0.05, `active ${Math.round(h.g.forces.active)}`);
  // An unpaid force shrinks in headcount.
  const u = headless('usa', 5); u.run('setPersonnelPay', { pay: 0 }); months(u, 24, rich);
  assert.ok(u.g.forces.active < h.g.forces.active * 0.9 && u.g.forces.recruits === 0);
});

test('procurement adds to existing fleets: F-35, B-21 (owner buy 200), Russian fighter wings; decommission takes them out', () => {
  const h = headless('usa'); rich(h.g);
  assert.equal(BLACK_PROGRAMS.b21.cap * UNIT_PLATFORMS.b21.per, OWNER_PARAMS.b21.plannedBuy, 'B-21 tranches reach the planned buy');
  h.g.blackPrograms = { f35: 1, b21: 2 }; h.month();
  assert.equal(h.g.forces.fleet.f35a.n, 410 + 24);
  assert.equal(h.g.forces.fleet.b21.n, 40);
  assert.equal(h.g.forces.fleet.b21.at[NATIONS.usa.region], 40, 'new airframes base at home');
  h.month(); assert.equal(h.g.forces.fleet.b21.n, 40, 'fielded once');
  h.run('buildPlatform', { platform: 'fighter_wing' }); h.month();
  assert.equal(h.g.forces.fleet.f35a.n, 410 + 48, 'a fighter wing is 24 more F-35As');
  h.run('decommissionPlatform', { platform: 'fighter_wing' }); h.month();
  assert.equal(h.g.forces.fleet.f35a.n, 410 + 24);
  assert.equal(buyLine('russia', 'fighter_wing').id, 'su35s');
  assert.equal(buyLine('norway', 'x_gen6').id, 'f35a', 'an unlisted unit joins the newest line of its role');
  assert.equal(buyLine('cuba', 'ssbn_fleet'), null, 'no line, no fleet');
});

test('retire and modernize: retirement frees maintenance; a block upgrade takes the depot time and raises effectiveness', () => {
  const h = headless('usa'); rich(h.g);
  const m0 = fleetView(h.g).maintenance;
  h.run('retire', { line: 'f22', n: 33 });
  assert.equal(h.g.forces.fleet.f22.n, 150); assert.match(h.toasts.at(-1), /Retired 33 F-22A/);
  assert.ok(fleetView(h.g).maintenance < m0);
  h.run('retire', { line: 'f22', n: 999 }); assert.equal(h.g.forces.fleet.f22.n, 0, 'retire stops at zero');
  h.run('retire', { line: 'f22', n: 1 }); assert.match(h.toasts.at(-1), /No F-22A/);
  const t0 = h.g.stats.treasury; const cost = line(h.g, 'f15e').modCost;
  h.run('modernize', { line: 'f15e' });
  assert.equal(h.g.stats.treasury, t0 - cost);
  const mo = h.g.forces.fleet.f15e.mod; assert.equal(mo, FL.modMo);
  h.run('modernize', { line: 'f15e' }); assert.match(h.toasts.at(-1), /already in the depot/);
  const before = equipF(h.g.forces, 'air');
  months(h, mo, rich);
  assert.equal(h.g.forces.fleet.f15e.blk, 1); assert.equal(h.g.forces.fleet.f15e.mod, 0);
  assert.ok(h.toasts.some((t) => /block 1 upgrade complete/.test(t)));
  assert.ok(line(h.g, 'f15e').target > ORBAT.usa.find((l) => l.id === 'f15e').mc, 'newer block, higher MC target');
  const poor = headless('cuba'); poor.g.stats = { ...poor.g.stats, treasury: 0 }; poor.run('modernize', { line: 'mig29' });
  assert.match(poor.toasts.at(-1), /Need \$/); assert.equal(poor.g.forces.fleet.mig29.mod, 0);
  assert.ok(before > 0);
});

test('depot throughput: more throughput recovers MC faster and shortens upgrades; it costs more', () => {
  const lo = headless('usa', 6); const hi = headless('usa', 6);
  for (const h of [lo, hi]) { rich(h.g); h.g.forces = { ...h.g.forces, fleet: { ...h.g.forces.fleet, f22: { ...h.g.forces.fleet.f22, mc: 20 } } }; }
  lo.run('setDepot', { pct: 60 }); hi.run('setDepot', { pct: 150 });
  months(lo, 6, rich); months(hi, 6, rich);
  assert.ok(hi.g.forces.fleet.f22.mc > lo.g.forces.fleet.f22.mc + 3);
  assert.ok(fleetView(hi.g).modMo < fleetView(lo.g).modMo);
  assert.ok(hi.ui.ledger.Depot < lo.ui.ledger.Depot);
});

test('attrition: peacetime losses strike airframes off one at a time; hulls do not wear out by mishap', () => {
  const h = headless('usa', 8); months(h, 120, rich);
  const f16 = h.g.forces.fleet.f16; assert.ok(f16.n < 840 && f16.n > 800 && f16.lost === 840 - f16.n, `F-16 ${f16.n}`);
  assert.equal(h.g.forces.fleet.cvn.n, 11);
});

test('force quality applies per type; capability per theater = present x MC x crews x quality x block x basing (F9c hook)', () => {
  const lo = headless('usa'); const hi = headless('usa');
  lo.g.forces = { ...lo.g.forces, quality: 20 }; hi.g.forces = { ...hi.g.forces, quality: 90 };
  assert.ok(line(lo.g, 'f22').quality < line(lo.g, 'mm3').quality, 'complex kit feels low quality more than ICBMs');
  assert.ok(forceMult(lo.g.forces, 'air') < forceMult(hi.g.forces, 'air'));
  const h = headless('usa'); const home = NATIONS.usa.region;
  const c0 = theaterCapability(h.g, home); assert.ok(c0 > 0); assert.equal(theaterCapability(h.g, 'EA'), 0);
  assert.equal(basingMult(h.g, 'EA', ORBAT.usa[0]), 1);
  // Rebasing is F9c's (#57); placement state is already per theater.
  const f22 = h.g.forces.fleet.f22; h.g.forces = { ...h.g.forces, fleet: { ...h.g.forces.fleet, f22: { ...f22, at: { [home]: 159, EA: 24 } } } };
  assert.ok(theaterCapability(h.g, 'EA') > 0 && theaterCapability(h.g, home) < c0);
  assert.deepEqual(checkV57(h.g), []);
});

test('invariants: fleet counts integers placed in theaters, MC and maintenance bounded; named on violation', () => {
  const g = headless('usa').g; const fl = g.forces.fleet;
  const bad = (o) => checkV57({ ...g, forces: { ...g.forces, fleet: { ...fl, f22: { ...fl.f22, ...o } } } }).some((n) => /fleet/.test(n));
  assert.ok(bad({ n: 182.5 })); assert.ok(bad({ mc: 120 })); assert.ok(bad({ mx: 250 })); assert.ok(bad({ at: { NA: 100 } })); assert.ok(bad({ blk: 4 }));
  assert.ok(checkV57({ ...g, forces: { ...g.forces, fleet: { ...fl, bogus: fl.f22 } } }).some((n) => /fleet/.test(n)));
});

test('pre-F7 saves: an index-strength force converts to headcounts and gets its fleet on the first month', () => {
  const h = headless('usa'); const f = h.g.forces;
  const { nid, base, q0, depot, crewShare, prop, fleet, fielded, ...old } = f; // eslint-disable-line no-unused-vars
  h.g.forces = { ...old, active: 30, reserve: 36 };
  h.month();
  assert.ok(h.g.forces.base && h.g.forces.fleet.f22);
  assert.ok(Math.abs(manPts(h.g.forces).active - 30) < 1, `index ${manPts(h.g.forces).active}`);
  assert.deepEqual(checkV57(h.g), []);
  assert.ok(newForces('cuba', h.g.stats).fleet.mig29);
});
