import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMonth } from '../src/sim/tick.js';
import { applyVerb } from '../src/sim/actions.js';
import { newCampaign, STATE_FIELDS } from '../src/sim/state.js';
import { checkV57 } from '../src/sim/invariants.js';
import { ageRel, ageDefOf, mcAgeF, costAgeF, fleetFill, lineReady } from '../src/sim/formulas.js';
import { fleetView, mcTarget, lineCost, retirePlan, retireView, successorOf, salvageOf, modMonths } from '../src/sim/forces.js';
import { ORBAT, FLEET_AGES } from '../src/data/orbat.js';
import { FLEET_RULES as FL, FORCE_RULES } from '../src/data/forces.js';
import { SLOT_INPUTS } from '../src/data/minerals.js';
import { COUNTRIES } from '../src/data/nations.js';
import { setRngSource, mulberry32 } from '../src/sim/rng.js';
import { mount, flush, BUNDLES } from './util/harness.js';

// #93: modernize and retire as gameplay. Every type ages along a curve (MC down, maintenance up, relative to 2024); modernizing buys
// block, capability, MC ceiling and service life; retiring frees maintenance, converts crews to the successor, salvages minerals and parts.
function headless(nid = 'usa', seed = 1) {
  setRngSource(mulberry32(seed));
  const g = newCampaign(COUNTRIES[COUNTRIES.findIndex((c) => c.id === nid)]); g.doctrine = 'hegemon'; g.gracePeriod = 999;
  const ui = { log: [], ledger: {} }; const toasts = [];
  const S = new Proxy({}, { get: (_, name) => (v) => { const k = name[3].toLowerCase() + name.slice(4); const box = STATE_FIELDS.includes(k) ? g : ui; box[k] = typeof v === 'function' ? v(box[k]) : v; } });
  const fx = { toast: (m) => toasts.push(m), now: () => 0, defer: (fn) => fn() };
  return { g, ui, toasts, month: () => { g.stats = { ...g.stats, treasury: 1e7 }; ui.ledger = {}; runMonth(g, S, fx); assert.deepEqual(checkV57(g), []); }, run: (type, payload) => applyVerb(g, S, fx, { type, payload }) };
}
const months = (h, n) => { for (let i = 0; i < n; i++) h.month(); };
const L = (nid, id) => ORBAT[nid].find((l) => l.id === id);
const line = (g, id) => fleetView(g).lines.find((l) => l.id === id);
const stock = (g, m) => g.minerals.own[m].stock;

test('data: every line of every nation has an age and service life; the 2024 start is unchanged (age factors 1); the curve holds then falls', () => {
  for (const c of COUNTRIES) for (const l of ORBAT[c.id] || []) { const [a, life] = ageDefOf(c.id, l); assert.ok(a >= 0 && life > 0, `${c.id} ${l.id}`); }
  for (const [id, row] of Object.entries(FLEET_AGES.usa)) assert.ok(L('usa', id) && row[2], `usa ${id} sourced`);
  const h = headless(); const f = h.g.forces;
  for (const l of ORBAT.usa) { const r = ageRel('usa', l, f.fleet[l.id]); assert.ok(Math.abs(r.mc - 1) < 1e-12 && Math.abs(r.cost - 1) < 1e-12, l.id); }
  assert.deepEqual([f.fleet.f22.age, f.fleet.f22.life], [17, 30]);
  assert.equal(mcAgeF(0.5), 1); assert.ok(Math.abs(mcAgeF(1) - 0.8) < 1e-12); assert.ok(mcAgeF(1.25) < 0.55); assert.equal(costAgeF(0.4), 1); assert.ok(Math.abs(costAgeF(1) - 1.4) < 1e-12);
});

test('age curve: left alone for 15 years the F-22 fleet loses MC and costs more per airframe; numbers', () => {
  const h = headless(); const l = L('usa', 'f22');
  const c0 = lineCost(h.g.forces, l, h.g.forces.fleet.f22) / 183;
  months(h, 180);
  const s = h.g.forces.fleet.f22; const v = line(h.g, 'f22');
  assert.ok(Math.abs(s.age - 32) < 1e-6, `age ${s.age}`);
  assert.ok(v.target < 33 && v.mc < 35, `MC target ${v.target.toFixed(1)} (2024: 40), MC ${v.mc.toFixed(1)}`);
  const c1 = lineCost(h.g.forces, l, s) / s.n; assert.ok(c1 / c0 > 1.4, `cost per airframe x${(c1 / c0).toFixed(2)}`);
  // deliveries join at age 0: an F-35A wing pulls the line's average age down
  const a0 = h.g.forces.fleet.f35a.age; h.g.platforms = { ...h.g.platforms, fighter_wing: 1 }; h.month();
  assert.ok(h.g.forces.fleet.f35a.age < a0 - 0.5, `F-35A average age ${a0.toFixed(1)} -> ${h.g.forces.fleet.f35a.age.toFixed(1)}`);
});

test('modernize: costs per airframe, takes 15% offline in the depot for months, then raises block, capability, MC ceiling and service life', () => {
  const h = headless(); const l = L('usa', 'f22'); const t0 = 1e7; h.g.stats = { ...h.g.stats, treasury: t0 };
  const ready0 = lineReady(h.g.forces, l, fleetFill(h.g.forces).fill);
  h.run('modernize', { line: 'f22' });
  const per = FL.modCost * 1; assert.equal(h.g.stats.treasury, t0 - Math.round(183 * per), `$${per}M per airframe x 183`);
  const mo = modMonths(h.g.forces); assert.equal(h.g.forces.fleet.f22.mod, mo);
  assert.ok(Math.abs(lineReady(h.g.forces, l, fleetFill(h.g.forces).fill) / ready0 - (1 - FL.modShare)) < 1e-9, '15% of the fleet in the depot');
  const twin = headless(); months(h, mo); months(twin, mo);
  const s = h.g.forces.fleet.f22; const t = twin.g.forces.fleet.f22;
  assert.equal(s.blk, 1); assert.equal(s.life, 30 + FL.modLife); assert.equal(s.mod, 0);
  assert.ok(mcTarget(h.g.forces, l, s) > mcTarget(twin.g.forces, l, t) * 1.03, 'MC ceiling up');
  // ten years on, the modernized fleet is younger against its life: higher MC, cheaper per airframe, more capability
  months(h, 120); months(twin, 120);
  const a = line(h.g, 'f22'), b = line(twin.g, 'f22');
  assert.ok(a.target > b.target + 4 && a.costAge < b.costAge && a.ageX < b.ageX, `MC target ${a.target.toFixed(1)} vs ${b.target.toFixed(1)}, cost x${a.costAge.toFixed(2)} vs x${b.costAge.toFixed(2)}`);
  assert.ok(lineReady(h.g.forces, l, fleetFill(h.g.forces).fill) > lineReady(twin.g.forces, l, fleetFill(twin.g.forces).fill) * 1.15, 'capability');
});

test('retire: removes the oldest units, frees maintenance at once, converts crews to the successor, salvages minerals and parts', () => {
  const h = headless(); const l = L('usa', 'f16'); months(h, 1);
  const m0 = h.ui.ledger.Maintenance; const re0 = stock(h.g, 'titanium');
  const p = retirePlan(h.g.forces, 'f16', 240);
  h.run('retire', { line: 'f16', n: 240 });
  const s = h.g.forces.fleet.f16; assert.equal(s.n, 600); assert.ok(s.age < 33, `oldest first: average age ${s.age.toFixed(2)}`);
  assert.equal(successorOf('usa', l).id, 'f35a');
  assert.deepEqual(h.g.forces.conv.map((c) => [c.to, c.b, c.mo]), [['f35a', 'air', FL.convMo.air]]);
  assert.ok(FL.convMo.air < FORCE_RULES.pipeMo.air, 'conversion is shorter than ab-initio training');
  assert.ok(Math.abs(h.g.forces.conv[0].n - 240 * 13.25) < 1e-9, '240 x (1.25 pilots + 12 maintainers)');
  assert.ok(stock(h.g, 'titanium') - re0 > 0 && Math.abs(stock(h.g, 'titanium') - re0 - p.minerals.titanium) < 1e-9, `titanium +${p.minerals.titanium.toFixed(2)}`);
  assert.ok(s.parts > 0, `parts credit $${s.parts.toFixed(1)}M`);
  h.month();
  assert.ok(-h.ui.ledger.Maintenance < -m0 - p.saves + 1, `maintenance $${-m0}M -> $${-h.ui.ledger.Maintenance}M (saves ${p.saves.toFixed(1)} + parts)`);
  months(h, FL.convMo.air); assert.equal(h.g.forces.conv.length, 0, 'conversion done'); assert.ok(h.toasts.some((t) => /crews converted to F-35A/.test(t)));
});

test('the F-22 retire to fund F-47 trade-off: crews, minerals and sustainment for an F-47 force the air branch cannot otherwise crew', () => {
  // An air branch at exactly full manning (no slack) takes 4 F-47 tranches (96 airframes, 1,272 people): they arrive crewless.
  const setup = () => { const h = headless(); const need = fleetFill(h.g.forces).need.air; h.g.forces = { ...h.g.forces, crewShare: { ...h.g.forces.crewShare, air: need / h.g.forces.active } }; h.g.blackPrograms = { f47: 4 }; h.month(); return h; };
  const keep = setup(); const cut = setup();
  assert.ok(line(keep.g, 'f47').count === 96 && line(keep.g, 'f47').crewless > 0, `F-47 crewless ${line(keep.g, 'f47').crewless}`);
  const re0 = stock(cut.g, 'rareEarth'); const ga0 = stock(cut.g, 'gallium');
  const v = retireView(cut.g, 'f22', 183); cut.run('retire', { line: 'f22', n: 183 });
  assert.equal(v.succ, 'F-47 (NGAD)'); assert.ok(Math.abs(v.crews - 183 * 13.25) < 1e-9);
  // minerals: 30% of a gen-5 airframe's inputs; one F-47 tranche needs SLOT_INPUTS.gen6
  const gained = stock(cut.g, 'rareEarth') - re0; assert.ok(gained >= SLOT_INPUTS.gen6.rareEarth && stock(cut.g, 'gallium') - ga0 >= SLOT_INPUTS.gen6.gallium, `rare earth +${gained.toFixed(1)} units, gallium +${(stock(cut.g, 'gallium') - ga0).toFixed(1)}: one F-47 tranche's worth`);
  months(keep, FL.convMo.air + 1); months(cut, FL.convMo.air + 1);
  assert.ok(line(keep.g, 'f47').crewless > 0, 'keep the F-22: F-47s still crewless');
  assert.equal(line(cut.g, 'f47').crewless, 0, 'retire the F-22: its crews converted, every F-47 crewed');
  assert.ok(v.saves > 4, `maintenance $${v.saves.toFixed(1)}M/mo freed (F-22 sustainment x2.3 per airframe)`);
  assert.ok(fleetView(cut.g).branches.find((b) => b.id === 'air').equip > fleetView(keep.g).branches.find((b) => b.id === 'air').equip * 0.97, 'air capability holds within 3% with half the F-22 count replaced by crewed F-47s');
});

test('salvage: per-platform minerals follow the role and generation; a type with no inputs salvages nothing', () => {
  const f22 = salvageOf(L('usa', 'f22')); assert.ok(Math.abs(f22.rareEarth - SLOT_INPUTS.gen5.rareEarth * FL.salvage / 24) < 1e-12);
  assert.deepEqual(salvageOf(L('usa', 'c17')), {});
  assert.ok(salvageOf(L('usa', 'cvn')).enrichment > 0, 'a carrier gives back enrichment');
});

test('240 months x 8 nations with retirements and upgrades in play keep every invariant', () => {
  for (const c of COUNTRIES) {
    const h = headless(c.id, 6); const ls = ORBAT[c.id].filter((l) => l.count > 0);
    for (let k = 1; k <= 240; k++) { if (k % 30 === 0) { const l = ls[k / 30 % ls.length]; h.run('retire', { line: l.id, n: Math.ceil(l.count / 4) }); } if (k % 45 === 0) h.run('modernize', { line: ls[(k / 45) % ls.length].id }); h.month(); }
  }
});

test('App: the type detail shows age and service life with the age-curve table; retire confirm names crews, successor and salvage', async () => {
  const origErr = console.error; console.error = () => {};
  const g = await mount(BUNDLES.app, { testHook: true });
  try {
    await g.pickCountry(0); await flush();
    const { doc } = g; const q = (sel) => doc.querySelector(sel);
    const click = async (el) => { el.dispatchEvent(new g.w.MouseEvent('click', { bubbles: true })); await flush(); await flush(); };
    await click(q('[data-tab=forces]')); await click(q('[data-segbar=forces] [data-seg=equipment]'));
    await click(q('[data-line=f22]'));
    assert.match(q('[data-line-detail=f22]').textContent, /Age and service life/); assert.match(q('[data-line-detail=f22]').textContent, /17 \/ 30 yr/);
    await click(q('[data-age-why=f22]')); assert.match(q('[data-why-content="F-22A Raptor: age curve"]').textContent, /MC factor vs 2024/);
    await click(q('[data-retire-all=f22]'));
    const txt = q('[data-confirm]').textContent; assert.match(txt, /crews convert to F-47 \(NGAD\) in 4 months/); assert.match(txt, /Salvage to the stockpile/); assert.match(txt, /saves \$\d+M\/mo/);
  } finally { console.error = origErr; g.close(); }
});
