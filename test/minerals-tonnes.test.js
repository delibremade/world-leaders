import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MINERALS, MINERAL_IDS, MINERAL_START, MINERAL_UNITS, SLOT_INPUTS, PLATFORM_INPUTS, MINERAL_RULES as R, tPerUnit, FACILITIES } from '../src/data/minerals.js';
import { NATIONS } from '../src/data/nations.js';
import { COUNTRIES } from '../src/data/nations.js';
import { newCampaign } from '../src/sim/state.js';
import { mineralView, programSupply, plantsOf, trancheDemand, mineralFlows } from '../src/sim/minerals.js';

// F10 (#58, spec Part 12): tangible minerals. Units stay the sim's currency; tonnes are units x tPerUnit, one conversion.
const US = () => newCampaign(COUNTRIES.find((c) => c.id === 'usa'));

test('every mineral row has a unit, a world output and a status_source', () => {
  for (const m of MINERAL_IDS) {
    const u = MINERAL_UNITS[m];
    assert.ok(u?.u && u.world > 0 && u.status_source.length > 20, `${m} unit, world output, source`);
    assert.equal(tPerUnit(m), u.world / 1200, `${m}: 1 unit/mo = 1% of world per year`);
  }
  for (const r of mineralView(US())) assert.ok(r.unit && r.status_source && r.tPerUnit > 0, `${r.id} view row carries unit and source`);
});

test('every processor has plants summing to its capacity in tonnes per year; named facilities exist in NATIONS', () => {
  for (const n of Object.keys(FACILITIES)) assert.ok(NATIONS[n], `${n} in NATIONS`);
  for (const [n, row] of Object.entries(MINERAL_START)) for (const m of MINERAL_IDS) {
    const cap = row[m]?.[1] || 0; if (!cap) continue;
    const plants = plantsOf(n, m);
    assert.ok(plants.length && plants.every((p) => p.name && p.source), `${n} ${m} has named plants and a source`);
    assert.ok(Math.abs(plants.reduce((s, p) => s + p.t, 0) - cap * 12 * tPerUnit(m)) < 1e-6, `${n} ${m} plants sum to capacity`);
  }
  assert.ok(plantsOf('usa', 'rareEarth').some((p) => /Mountain Pass/.test(p.name)));
  assert.ok(plantsOf('usa', 'rareEarth').some((p) => /Seadrift, TX/.test(p.name) && p.t === 0), 'the Texas plant is listed, planned, 0 t');
  assert.ok(plantsOf('china', 'rareEarth').some((p) => /Jiangxi/.test(p.name)), 'China by province');
});

test('tranche demand in tonnes is the supply math: need x tPerUnit, coverage unchanged', () => {
  const g = US();
  for (const inp of [...Object.values(SLOT_INPUTS), ...Object.values(PLATFORM_INPUTS)]) for (const [m, u] of Object.entries(inp)) assert.ok(MINERALS[m] && u > 0);
  const d = trancheDemand('f35');
  assert.ok(d.length > 0);
  for (const r of d) assert.equal(r.t, r.units * tPerUnit(r.m));
  const sup = programSupply(g, 'f35'); const f = mineralFlows(g);
  for (const r of sup.rows) {
    assert.equal(r.needT, r.need * tPerUnit(r.m)); assert.equal(r.inflowT, f[r.m].total * tPerUnit(r.m));
    assert.ok(Math.abs(r.cov - Math.min(1, (g.minerals.own[r.m].stock * tPerUnit(r.m) + r.inflowT) / r.needT)) < 1e-9, `${r.m} coverage in tonnes equals coverage in units`);
  }
});

test('view carries tonnes: capacity t/yr, ore, stock, years to depletion in the same units', () => {
  for (const r of mineralView(US())) {
    assert.equal(r.capT, r.cap * 12 * tPerUnit(r.id)); assert.equal(r.oreT, r.ore * tPerUnit(r.id)); assert.equal(r.stockT, r.stock * tPerUnit(r.id));
    assert.equal(r.stockMaxT, R.stockMax * tPerUnit(r.id));
    if (r.cap > 0 && r.ore > 0) assert.ok(Math.abs(r.years - r.oreT / r.capT) < 1e-9, 'years = ore t / capacity t per yr');
    else assert.equal(r.years, null);
  }
});
