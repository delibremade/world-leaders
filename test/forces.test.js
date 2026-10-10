import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runMonth } from '../src/sim/tick.js';
import { applyVerb } from '../src/sim/actions.js';
import { newCampaign, STATE_FIELDS } from '../src/sim/state.js';
import { checkV57 } from '../src/sim/invariants.js';
import { forceQuality, forceMult, tier1Odds, exportEdge, capWeight } from '../src/sim/formulas.js';
import { crewStatus, forceView, newForces } from '../src/sim/forces.js';
import { programSupply, inputsOf } from '../src/sim/minerals.js';
import { SOF_UNITS, SOF_RULES, FORCE_RULES, TRAINING, crewOf, ALL_UNITS, BRANCH_IDS } from '../src/data/forces.js';
import { PLATFORM_INPUTS, MINERALS } from '../src/data/minerals.js';
import { PLATFORMS, DEPLOYABLE } from '../src/data/platforms.js';
import { COUNTRIES } from '../src/data/nations.js';
import { setRngSource, mulberry32 } from '../src/sim/rng.js';

// E8 (#20): troops, training, force quality and SOF tiers (spec Part 7), plus E4's scope gap (platform builds draw minerals).
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
const months = (h, n) => { for (let i = 0; i < n; i++) { h.month(); assert.deepEqual(checkV57(h.g), [], `month ${i + 1}`); } };
const rich = (g) => { g.stats = { ...g.stats, treasury: 500000 }; };
const setF = (g, o) => { g.forces = { ...g.forces, ...o }; };

test('data: every unit declares a branch and crew sets; drone wings fly with their host; SOF names per playable nation with status_source', () => {
  for (const id of ALL_UNITS) { const c = crewOf(id); assert.ok(BRANCH_IDS.includes(c.b) && Number.isInteger(c.n) && c.n >= 0, id); }
  assert.equal(crewOf('cca').n, 0, 'CCA attaches to F-47 crews');
  assert.deepEqual(crewOf('f47'), { b: 'air', n: 2 });
  for (const c of COUNTRIES) { const u = SOF_UNITS[c.id]; assert.ok(u && u.t1 && u.t2 && u.status_source, c.id); }
  assert.equal(SOF_UNITS.usa.t1, '1st SFOD-D (Delta)');
  for (const n of ['china', 'brazil']) assert.match(SOF_UNITS[n].status_source, /generic/);
  assert.ok(SOF_RULES.t1MoMin >= 24 && SOF_RULES.t1MoMax <= 36 && SOF_RULES.t2Mo >= 24 && SOF_RULES.t2Mo <= 36, 'pipelines 24-36 months');
});

test('cohesion: force quality is one formula in formulas.js over the existing vitals; no consumer re-implements it', () => {
  const s = { education: 80, healthcare: 70, foodSecurity: 90, stability: 60, inequality: 40 };
  const q = forceQuality(s);
  assert.ok(q > 0 && q < 100);
  for (const k of ['education', 'healthcare', 'foodSecurity', 'stability']) assert.ok(forceQuality({ ...s, [k]: s[k] - 20 }) < q, `${k} lowers quality`);
  assert.ok(forceQuality({ ...s, inequality: 70 }) < q, 'inequality lowers quality');
  for (const f of ['src/sim/tick.js', 'src/sim/actions.js', 'src/sim/forces.js', 'src/ui/App.jsx', 'src/sim/selectors.js']) {
    const src = readFileSync(f, 'utf8');
    assert.ok(!/education\s*\*\s*0\.\d+\s*\+[^\n]*healthcare\s*\*/.test(src), `${f} re-implements the quality weights`);
    assert.ok(!/const chance=Math\.min\(0\.9,0\.3\+/.test(src), `${f} re-implements the Tier-1 odds`);
  }
});

test('new campaign: manpower, quality, standard training, crews, SOF; invariants hold', () => {
  const h = headless('usa'); const f = h.g.forces;
  assert.equal(f.active, FORCE_RULES.start.active);
  assert.equal(f.train, 2);
  for (const b of BRANCH_IDS) assert.equal(f.readiness[b], FORCE_RULES.start.readiness);
  assert.equal(Math.round(f.quality), Math.round(forceQuality(h.g.stats)));
  assert.deepEqual([f.sof.t2, f.sof.t1], [3, 2]);
  assert.deepEqual(checkV57(h.g), []);
});

test('all consumers read the single formula: quality moves deployed military power, posture weight, Tier-1 odds and export advantage', () => {
  const lo = headless('usa'); const hi = headless('usa');
  setF(lo.g, { quality: 20 }); setF(hi.g, { quality: 90 });
  assert.ok(forceMult(lo.g.forces, 'air') < forceMult(hi.g.forces, 'air'));
  // deployed military power (and so the hegemony military pillar, which reads it)
  for (const h of [lo, hi]) { h.g.platforms = { fighter_wing: 6, carrier_group: 2 }; h.g.stats = { ...h.g.stats, military: 50 }; h.month(); }
  assert.ok(lo.g.stats.military < hi.g.stats.military, `military ${lo.g.stats.military} < ${hi.g.stats.military}`);
  // posture: capability-weighted regional weight (sphere suppression, escort tension, pressure)
  const dep = { carrier_group: 2, fighter_wing: 2 };
  assert.ok(capWeight(dep, {}, lo.g.forces) < capWeight(dep, {}, hi.g.forces));
  // Tier-1 operation odds
  assert.ok(tier1Odds(lo.g, 'cuba').mine < tier1Odds(hi.g, 'cuba').mine);
  // export buyer advantage
  assert.ok(exportEdge(lo.g.forces) < exportEdge(hi.g.forces));
  const sell = (h) => { h.g.defLevels = { ...h.g.defLevels, aircraft: 4 }; h.run('offerArms', { nation: 'india', vertical: 'aircraft' }); return h.g.defExports.india_aircraft?.revenue; };
  const rLo = sell(lo), rHi = sell(hi); assert.ok(rLo > 0 && rLo < rHi, `export revenue ${rLo} < ${rHi}`);
});

test('done-when: 10 years of education cuts measurably lower force quality and Tier-1 op odds', () => {
  const base = headless('usa', 7); const cut = headless('usa', 7);
  cut.g.budgetAlloc = { ...cut.g.budgetAlloc, education: 0 };
  for (const h of [base, cut]) { rich(h.g); h.g.gracePeriod = 999; }
  for (let i = 0; i < 120; i++) { base.month(); cut.month(); for (const h of [base, cut]) h.g.stats = { ...h.g.stats, treasury: 500000 }; }
  assert.ok(cut.g.stats.education < base.g.stats.education - 20, `education ${cut.g.stats.education} vs ${base.g.stats.education}`);
  assert.ok(cut.g.forces.quality < base.g.forces.quality - 5, `quality ${cut.g.forces.quality} vs ${base.g.forces.quality}`);
  // Same strike package for both, so only the force itself differs.
  for (const h of [base, cut]) { h.g.stats = { ...h.g.stats, military: 70 }; }
  const a = tier1Odds(base.g, 'cuba'), b = tier1Odds(cut.g, 'cuba');
  assert.ok(b.mine < a.mine && b.chance < a.chance, `odds ${b.chance} < ${a.chance}`);
});

test('done-when: an unpaid army loses retention and strength; pay is a Personnel ledger line, never negative', () => {
  const paid = headless('usa', 3); const unpaid = headless('usa', 3);
  unpaid.run('setPersonnelPay', { pay: 0 });
  assert.equal(unpaid.g.personnelPay, 0);
  unpaid.run('setPersonnelPay', { pay: -20 }); assert.equal(unpaid.g.personnelPay, 0, 'pay >= 0');
  months(paid, 24); months(unpaid, 24);
  assert.ok(unpaid.g.forces.retention < paid.g.forces.retention - 15, `retention ${unpaid.g.forces.retention} vs ${paid.g.forces.retention}`);
  assert.ok(unpaid.g.forces.active < paid.g.forces.active - 3, `active ${unpaid.g.forces.active} vs ${paid.g.forces.active}`);
  assert.ok(paid.ui.ledger.Personnel < 0 && !(unpaid.ui.ledger.Personnel < 0), 'unpaid: no Personnel cost');
  assert.ok(paid.ui.ledger.Training < 0, 'training is a ledger line');
});

test('done-when: crewless F-47 wings cannot deploy; the gap is shown; trained crews let them deploy', () => {
  const h = headless('usa'); rich(h.g);
  h.g.blackPrograms = { f47: 2 };
  setF(h.g, { crews: { ...h.g.forces.crews, air: 0 }, pipe: [] });
  assert.ok(DEPLOYABLE.includes('f47'));
  h.run('deployUnit', { region: 'EA', unit: 'f47' });
  assert.equal(h.g.forceDeployments.EA?.f47 || 0, 0, 'not stationed');
  assert.match(h.toasts.at(-1), /crew/i);
  const st = crewStatus(h.g).air; assert.ok(st.gap >= 4 && st.need >= 4, `gap ${st.gap}`);
  // Standard training trains the gap through the air pipeline.
  for (let i = 0; i < FORCE_RULES.pipeMo.air + 2; i++) h.month();
  assert.ok(Math.floor(h.g.forces.crews.air) >= 2);
  h.run('deployUnit', { region: 'EA', unit: 'f47' });
  assert.equal(h.g.forceDeployments.EA.f47, 1);
});

test('training: readiness decays unfunded, holds at standard, Joint Exercises posture lifts it; Training is a ledger line', () => {
  const none = headless('usa', 5); const std = headless('usa', 5); const ex = headless('usa', 5);
  none.run('setTraining', { level: 0 });
  ex.g.platforms = { fighter_wing: 2 }; ex.g.forceDeployments = { WE: { fighter_wing: 2 } }; ex.g.forcePosture = { WE: 'exercise' };
  months(none, 12); months(std, 12); months(ex, 12);
  assert.ok(none.g.forces.readiness.air <= FORCE_RULES.start.readiness - 10, `unfunded ${none.g.forces.readiness.air}`);
  assert.equal(Math.round(std.g.forces.readiness.air), FORCE_RULES.start.readiness);
  assert.ok(ex.g.forces.readiness.air > std.g.forces.readiness.air, 'exercise lifts air readiness');
  assert.equal(ex.g.forces.readiness.sea, std.g.forces.readiness.sea, 'only the exercising branch');
  assert.ok(!(none.ui.ledger.Training < 0) && std.ui.ledger.Training === -TRAINING[2].cost);
  assert.ok(forceView(none.g).branches.find((b) => b.id === 'air').decayMo != null, 'decay countdown shown');
});

test('SOF: Tier 2 pipeline, then Tier 1 selection draws on Tier 2; selection is faster with higher quality; Tier 1 drives odds', () => {
  const h = headless('usa'); rich(h.g);
  const t2 = h.g.forces.sof.t2, t1 = h.g.forces.sof.t1;
  h.run('trainSof', {});
  assert.equal(h.g.forces.sof.pipes.length, 1);
  months(h, SOF_RULES.t2Mo);
  assert.equal(h.g.forces.sof.t2, t2 + 1);
  const mil = h.g.stats.military; const odds0 = tier1Odds(h.g, 'cuba');
  h.run('selectTier1', {});
  assert.equal(h.g.forces.sof.t2, t2, 'a candidate leaves Tier 2 for selection');
  const mo = h.g.forces.sof.pipes[0].mo; assert.ok(mo >= SOF_RULES.t1MoMin && mo <= SOF_RULES.t1MoMax);
  months(h, mo);
  assert.equal(h.g.forces.sof.t1, t1 + 1);
  h.g.stats = { ...h.g.stats, military: mil }; const odds1 = tier1Odds(h.g, 'cuba');
  assert.ok(odds1.t1 > odds0.t1 && odds1.mine > odds0.mine, 'Tier 1 strength raises overmatch');
  const dull = headless('usa'); rich(dull.g); setF(dull.g, { quality: 10 }); dull.run('selectTier1', {});
  const sharp = headless('usa'); rich(sharp.g); setF(sharp.g, { quality: 95 }); sharp.run('selectTier1', {});
  assert.ok(dull.g.forces.sof.pipes[0].mo > sharp.g.forces.sof.pipes[0].mo);
  const none = headless('cuba'); rich(none.g); setF(none.g, { sof: { ...none.g.forces.sof, t2: 0 } }); none.run('selectTier1', {});
  assert.equal(none.g.forces.sof.pipes.length, 0, 'no Tier 2 candidates, no selection');
});

test('invariants: strength, readiness, quality in 0..100; crews <= trained pool; pay >= 0; named on violation', () => {
  const h = headless('usa');
  const bad = (o, re) => { const g = { ...h.g, forces: { ...h.g.forces, ...o } }; assert.ok(checkV57(g).some((n) => re.test(n)), JSON.stringify(o)); };
  bad({ active: 101 }, /strength/); bad({ quality: -1 }, /quality/); bad({ readiness: { ...h.g.forces.readiness, air: 120 } }, /readiness/);
  bad({ crews: { ...h.g.forces.crews, sea: 999 } }, /crews/);
  assert.ok(checkV57({ ...h.g, personnelPay: -1 }).some((n) => /pay/.test(n)));
});

test('old saves without forces still run (multipliers 1, forces created on the first month)', () => {
  const h = headless('usa'); h.g.forces = undefined;
  assert.equal(forceMult(undefined, 'air'), 1);
  h.month(); assert.ok(h.g.forces && h.g.forces.active > 0);
  assert.deepEqual(newForces('china', h.g.stats).sof.t1, 1);
});

test('E4 gap: regular platform builds draw mineral inputs; a shortfall queues the build, minerals deliver it', () => {
  for (const id of Object.keys(PLATFORMS)) { const inp = inputsOf(id); assert.ok(Object.keys(inp).length > 0, id); for (const m of Object.keys(inp)) assert.ok(MINERALS[m], `${id} ${m}`); }
  assert.deepEqual(inputsOf('fighter_wing'), PLATFORM_INPUTS.fighter_wing);
  const h = headless('usa'); rich(h.g);
  const ti0 = h.g.minerals.own.titanium.stock;
  h.run('buildPlatform', { platform: 'fighter_wing' });
  assert.equal(h.g.platforms.fighter_wing, 1);
  assert.equal(h.g.minerals.own.titanium.stock, ti0 - PLATFORM_INPUTS.fighter_wing.titanium);
  h.g.minerals = { ...h.g.minerals, own: { ...h.g.minerals.own, titanium: { ...h.g.minerals.own.titanium, stock: 0 } } };
  h.run('buildPlatform', { platform: 'fighter_wing' });
  assert.equal(h.g.platforms.fighter_wing, 1, 'shortfall: not delivered yet');
  assert.equal(h.g.minerals.queue.length, 1);
  assert.match(h.toasts.at(-1), /Titanium/);
  assert.equal(programSupply(h.g, 'fighter_wing').queued.length, 1);
  let k = 0; while ((h.g.platforms.fighter_wing || 0) < 2 && k < 24) { h.month(); k++; }
  assert.equal(h.g.platforms.fighter_wing, 2, `delivered after ${k} months`);
  assert.deepEqual(checkV57(h.g), []);
});
