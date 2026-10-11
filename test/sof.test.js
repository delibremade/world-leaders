import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMonth } from '../src/sim/tick.js';
import { applyVerb } from '../src/sim/actions.js';
import { newCampaign, STATE_FIELDS } from '../src/sim/state.js';
import { checkV57 } from '../src/sim/invariants.js';
import { tier1Odds } from '../src/sim/formulas.js';
import { forceView, tier1Plan } from '../src/sim/forces.js';
import { SOF_ORBAT, SOF_RULES, sofOps, sofFree } from '../src/data/sof.js';
import { INTEL_OPS } from '../src/data/intel.js';
import { COUNTRIES } from '../src/data/nations.js';
import { setRngSource, mulberry32 } from '../src/sim/rng.js';

// F8 (#56, spec Part 10): Tier 1 / Tier 2 as named real units with operator counts, selection pipelines, attrition and op commitment.
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
const months = (h, n) => { for (let i = 0; i < n; i++) { h.month(); h.g.stats = { ...h.g.stats, treasury: 500000 }; assert.deepEqual(checkV57(h.g), [], `month ${i + 1}`); } };
const unit = (g, id) => g.forces.sof.units[id];
// A strike package that clears every regime-change gate in both Americas, so only the SOF term moves.
function armed(h) {
  const g = h.g; g.stats = { ...g.stats, treasury: 500000, military: 400 };
  g.blackPrograms = { ...g.blackPrograms, b21: 1 }; g.platforms = { ...g.platforms, rq180: 3 };
  g.forceDeployments = { ...g.forceDeployments, NA: { carrier_group: 2, fighter_wing: 4 }, SA: { carrier_group: 2, fighter_wing: 4 } };
  return h;
}
// Odds against a third nation at zero military: chance = 0.3 + the Tier-1 bonus, nowhere near the 0.9 cap.
const probe = (g) => { const m = g.stats.military; g.stats = { ...g.stats, military: 0 }; const o = tier1Odds(g, 'saudi'); g.stats = { ...g.stats, military: m }; return o; };

test('data: every playable nation fields named Tier 1 and Tier 2 units with operators, sub-units, role and status_source', () => {
  for (const c of COUNTRIES) {
    const us = SOF_ORBAT[c.id]; assert.ok(us?.length, c.id);
    for (const t of [1, 2]) assert.ok(us.some((u) => u.tier === t), `${c.id} tier ${t}`);
    for (const u of us) {
      assert.ok(u.id && u.n && u.role && u.sub && u.status_source, `${c.id}.${u.id}`);
      assert.ok(Number.isInteger(u.ops) && u.ops >= 0 && Number.isInteger(u.subs) && u.subs >= 1 && Number.isInteger(u.cls) && u.cls >= 1, `${c.id}.${u.id} sizes`);
    }
  }
  const us = SOF_ORBAT.usa.map((u) => u.n).join(' | ');
  for (const re of [/Delta/, /DEVGRU/, /24th Special Tactics/, /75th Ranger/, /MARSOC/, /Special Forces groups/, /SEAL Teams/]) assert.match(us, re);
  for (const n of ['china', 'brazil']) for (const u of SOF_ORBAT[n]) assert.match(u.status_source, /generic/, `${n}.${u.id}`);
  assert.ok(SOF_RULES.t1MoMin >= 24 && SOF_RULES.t1MoMax <= 36 && SOF_RULES.t2Mo >= 24 && SOF_RULES.t2Mo <= 36, 'pipelines 24-36 months');
});

test('steady state: 10 quiet years hold every unit near its 2024 strength; turnover is replaced by the standing pipeline', () => {
  const h = headless('usa', 3); months(h, 120);
  for (const u of SOF_ORBAT.usa) {
    const s = unit(h.g, u.id); assert.ok(Math.abs(s.ops - u.ops) <= u.ops * 0.05, `${u.id} ${s.ops} vs ${u.ops}`);
    assert.deepEqual(s.out, []);
  }
});

test('done-when: a Tier-1 op shows which unit is committed and for how long, before and after launch', () => {
  const h = armed(headless('usa'));
  const plan = tier1Plan(h.g);
  assert.equal(plan.t1[0].u, 'cag', 'the strongest free Tier 1 unit');
  assert.equal(plan.t1[0].k, SOF_RULES.ops.regime.t1);
  assert.equal(plan.mo, SOF_RULES.ops.regime.mo); assert.equal(plan.rec, SOF_RULES.ops.regime.rec);
  assert.match(plan.label, /Delta.*2 squadrons.*\d+ mo.*\d+ mo recovery/);
  const ops0 = unit(h.g, 'cag').ops;
  h.run('regimeChange', { nation: 'cuba' });
  const cag = unit(h.g, 'cag');
  assert.equal(cag.out.length, SOF_RULES.ops.regime.t1, 'two squadrons out');
  for (const o of cag.out) assert.deepEqual([o.op, o.tgt, o.mo, o.rec], ['regime', 'cuba', plan.mo, plan.rec]);
  assert.ok(cag.ops < ops0, 'operators lost on the raid');
  assert.ok(h.toasts.some((t) => /Delta/.test(t) && /2 squadrons/.test(t) && new RegExp(`${plan.mo} mo`).test(t)), h.toasts.join(' | '));
  const view = forceView(h.g).sofUnits.find((u) => u.id === 'cag');
  assert.equal(view.free, 2); assert.equal(view.out.length, 2); assert.match(view.out[0].label, /Regime change.*Cuba/);
  const rangers = unit(h.g, 'rangers'); assert.equal(rangers.out.length, SOF_RULES.ops.regime.t2, 'a Ranger battalion secures the objective');
});

test('done-when: back-to-back ops degrade Tier-1 odds until the committed units recover', () => {
  const h = armed(headless('usa'));
  const o0 = probe(h.g);
  h.run('regimeChange', { nation: 'cuba' }); const o1 = probe(h.g);
  assert.ok(o1.t1 < o0.t1 && o1.mine < o0.mine && o1.chance < o0.chance, `first op: ${o0.chance} -> ${o1.chance}`);
  h.g.stats = { ...h.g.stats, military: 400 };
  h.run('regimeChange', { nation: 'venezuela' }); const o2 = probe(h.g);
  assert.ok(o2.t1 < o1.t1 && o2.chance < o1.chance, `second op: ${o1.chance} -> ${o2.chance}`);
  assert.equal(unit(h.g, 'devgru').out.length, SOF_RULES.ops.regime.t1, 'two Delta squadrons are out; the second op draws on DEVGRU');
  const { mo, rec } = SOF_RULES.ops.regime;
  months(h, mo + rec - 1); assert.ok(probe(h.g).t1 < o0.t1 * 0.9, 'still recovering one month short');
  months(h, 1); const o3 = probe(h.g);
  assert.ok(o3.t1 > o2.t1 && o3.t1 >= o0.t1 * 0.95, `recovered ${o3.t1} vs ${o0.t1}`);
  for (const u of SOF_ORBAT.usa) assert.deepEqual(unit(h.g, u.id).out, [], `${u.id} back in rotation`);
});

test('no free Tier 1 sub-unit: the op is refused and nothing is spent', () => {
  const h = armed(headless('norway'));
  for (const u of SOF_ORBAT.norway.filter((x) => x.tier === 1)) h.g.forces = { ...h.g.forces, sof: { ...h.g.forces.sof, units: { ...h.g.forces.sof.units, [u.id]: { ...unit(h.g, u.id), out: Array.from({ length: u.subs }, () => ({ op: 'regime', tgt: 'cuba', mo: 2, rec: 6 })) } } } };
  const t0 = h.g.stats.treasury; h.run('regimeChange', { nation: 'cuba' });
  assert.equal(h.g.stats.treasury, t0); assert.match(h.toasts.at(-1), /No Tier 1.*free/i);
});

test('selection: a Tier 1 class draws on Tier 2 operators and conventional forces, graduates after 24-36 months, capped', () => {
  const h = headless('usa'); h.g.stats = { ...h.g.stats, treasury: 500000 };
  const cag = SOF_ORBAT.usa.find((u) => u.id === 'cag');
  const t2a = sofOps(h.g.forces, 2);
  h.run('selectTier1', { unit: 'cag' });
  const p = h.g.forces.sof.pipes[0]; assert.deepEqual([p.u, p.t, p.n], ['cag', 1, cag.cls]);
  assert.ok(p.mo >= SOF_RULES.t1MoMin && p.mo <= SOF_RULES.t1MoMax);
  assert.ok(Math.abs(t2a - sofOps(h.g.forces, 2) - cag.cls * SOF_RULES.t2Share) < 1e-6, 'candidates leave Tier 2');
  assert.match(h.toasts.at(-1), new RegExp(`${Math.round(cag.cls * SOF_RULES.t2Share)} from Tier 2, \\d+ from conventional forces`));
  const before = unit(h.g, 'cag').ops; months(h, p.mo);
  assert.ok(unit(h.g, 'cag').ops > before + cag.cls * 0.8, `class graduated: ${before} -> ${unit(h.g, 'cag').ops}`);
  assert.equal(h.g.forces.sof.pipes.length, 0);
  // Tier 2: a class of conventional volunteers.
  h.run('trainSof', { unit: 'marsoc' }); const q = h.g.forces.sof.pipes[0]; assert.deepEqual([q.u, q.t, q.mo], ['marsoc', 2, SOF_RULES.t2Mo]);
  assert.ok(forceView(h.g).training >= q.n * SOF_RULES.costPer.t2, 'training cost per operator in the pipeline');
  // Cap: a unit at capF x its 2024 strength takes no more classes.
  h.g.forces = { ...h.g.forces, sof: { ...h.g.forces.sof, pipes: [], units: { ...h.g.forces.sof.units, cag: { ...unit(h.g, 'cag'), ops: cag.ops * SOF_RULES.capF } } } };
  h.run('selectTier1', { unit: 'cag' }); assert.equal(h.g.forces.sof.pipes.length, 0); assert.match(h.toasts.at(-1), /ceiling/);
});

test('attrition: casualties are replaced by the standing pipeline over years, never above the 2024 strength', () => {
  const h = headless('usa'); const u0 = SOF_ORBAT.usa.find((u) => u.id === 'devgru');
  h.g.forces = { ...h.g.forces, sof: { ...h.g.forces.sof, units: { ...h.g.forces.sof.units, devgru: { ...unit(h.g, 'devgru'), ops: u0.ops * 0.5 } } } };
  months(h, 12); const y1 = unit(h.g, 'devgru').ops; assert.ok(y1 > u0.ops * 0.5 && y1 < u0.ops * 0.8, `one year: ${y1}`);
  months(h, 96); const y9 = unit(h.g, 'devgru').ops; assert.ok(y9 > u0.ops * 0.9 && y9 <= u0.ops, `nine years: ${y9}`);
});

test('intel: special activities commit a Tier 2 element for the op plus recovery; shown on Specialized', () => {
  const h = headless('usa'); h.g.stats = { ...h.g.stats, treasury: 500000 }; h.g.intelInfra = { ...h.g.intelInfra, paramilitary: 1 };
  const op = INTEL_OPS.find((o) => o.id === 'sabotage'); assert.ok(op.sof, 'sabotage declares a SOF element');
  const free0 = sofFree(h.g.forces, 2);
  h.run('runIntelOp', { op: 'sabotage', nation: 'china' });
  assert.equal(sofFree(h.g.forces, 2), free0 - 1);
  const out = forceView(h.g).sofUnits.flatMap((u) => u.out.map((o) => ({ ...o, unit: u.n })));
  assert.equal(out.length, 1); assert.equal(out[0].mo, op.mo); assert.match(out[0].label, /Covert Sabotage.*China/);
  assert.ok(h.toasts.some((t) => /committed/i.test(t) && new RegExp(`${op.mo} mo`).test(t)), h.toasts.join(' | '));
});
