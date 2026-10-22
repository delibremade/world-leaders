import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './util/headless-month.js';
import { checkV57 } from '../src/sim/invariants.js';
import { setPermanent, migrateEffects, ageEffect, liveEffect, PERMANENT, RENEWABLE_DAMPER } from '../src/sim/effects.js';
import { groupEffects, sourceLabel } from '../src/ui/shell/effects.js';
import { mount, BUNDLES, flush } from './util/harness.js';

// FIX 4: "Inflation -0.04/mo (767mo)" four times over. Each renewable build pushed its own 999-month inflation row
// (767 = 999 - 232 months played) and nothing merged them. Now one permanent row per kind, d = level x -0.04; a
// pre-fix save's stacked rows fold into that row on the next tick; the UI groups the rest by source and names it.

const ren = (k, mo = 767) => ({ id: `ren_${k}_1`, source: `renewable_${k}`, stat: 'inflation', d: -0.04, monthsLeft: mo, totalMonths: 999 });

test('three solar builds give one permanent damper at -0.12, not three 999-month rows; the invariants hold', () => {
  const h = game(1);
  try {
    h.g.stats.treasury = 60000;
    for (let i = 0; i < 3; i++) h.act({ type: 'buildRenewable', payload: { kind: 'solar' } });
    h.act({ type: 'buildRenewable', payload: { kind: 'wind' } });
    assert.equal(h.g.resources.renewable.solar, 3);
    const rows = h.g.activeEffects.filter((e) => e.stat === 'inflation');
    assert.deepEqual(rows.map((e) => [e.source, e.d, e.permanent, e.monthsLeft]), [['renewable_solar', -0.12, true, PERMANENT], ['renewable_wind', -0.04, true, PERMANENT]]);
    assert.deepEqual(checkV57(h.g), []);
    // a month later the damper still holds at 999 and still lands on inflation
    const before = h.g.stats.inflation; h.step();
    assert.equal(h.g.activeEffects.find((e) => e.source === 'renewable_solar').monthsLeft, PERMANENT);
    assert.ok(h.g.stats.inflation < before + 0.5, 'damper applied (inflation did not jump)');
    // a stacked duplicate trips the invariant
    assert.ok(checkV57({ ...h.g, activeEffects: [...h.g.activeEffects, { ...h.g.activeEffects[0], id: 'dup' }] }).some((n) => /one permanent effect/.test(n)));
  } finally { h.done(); }
});

test('a pre-fix save: four 767-month solar rows fold into one permanent -0.16 row on the next tick; timed rows still count down and expire', () => {
  const h = game(2);
  try {
    h.g.activeEffects = [ren('solar', 767), ren('solar', 767), ren('solar', 780), ren('solar', 790), ren('hydro', 500),
      { id: 'qe', source: 'e4', stat: 'gdpGrowth', d: 0.08, monthsLeft: 2, totalMonths: 8 }];
    h.step();
    const ae = h.g.activeEffects;
    assert.deepEqual(ae.filter((e) => e.permanent).map((e) => [e.id, e.source, e.d, e.monthsLeft]), [['ren_solar', 'renewable_solar', -0.16, PERMANENT], ['ren_hydro', 'renewable_hydro', -0.04, PERMANENT]]);
    assert.deepEqual(ae.find((e) => e.id === 'qe').monthsLeft, 1, 'timed row aged by one');
    assert.deepEqual(checkV57(h.g), []);
    h.step(); assert.equal(h.g.activeEffects.find((e) => e.id === 'qe'), undefined, 'timed row expired');
    assert.equal(h.g.activeEffects.filter((e) => e.permanent).length, 2);
  } finally { h.done(); }
});

test('effects helpers: setPermanent replaces d in place; migrateEffects returns the same list when nothing is stacked; age/live', () => {
  const a = setPermanent([], { id: 'ren_solar', source: 'renewable_solar', stat: 'inflation', d: RENEWABLE_DAMPER });
  const b = setPermanent(a, { id: 'ren_solar', source: 'renewable_solar', stat: 'inflation', d: RENEWABLE_DAMPER * 2 });
  assert.equal(b.length, 1); assert.equal(b[0].d, -0.08); assert.equal(a[0].d, -0.04, 'input untouched');
  const plain = [{ id: 'x', source: 'e4', stat: 'inflation', d: 0.18, monthsLeft: 6, totalMonths: 6 }];
  assert.equal(migrateEffects(plain), plain, 'same reference: parity for runs without renewables');
  assert.equal(migrateEffects(b), b);
  assert.equal(ageEffect(b[0]), b[0]); assert.equal(ageEffect(plain[0]).monthsLeft, 5);
  assert.equal(liveEffect({ monthsLeft: 0 }), false); assert.equal(liveEffect({ monthsLeft: 0, permanent: true }), true);
});

test('groupEffects: same source and stat fold into one named line with a count, summed d and the longest clock', () => {
  const g = groupEffects([ren('solar'), ren('solar'), { id: 'n1', source: 'intel_network', stat: 'stability', d: 0.01, monthsLeft: 12 }, { id: 'n2', source: 'intel_network', stat: 'stability', d: 0.01, monthsLeft: 7 },
    { id: 'q', source: 'e4', stat: 'inflation', d: 0.18, monthsLeft: 6 }, { id: 'p', source: 'renewable_wind', stat: 'inflation', d: -0.04, monthsLeft: 999, permanent: true }]);
  assert.deepEqual(g.map((x) => [x.label, x.statLabel, x.d, x.count, x.months, x.permanent]), [
    ['Renewables · Solar', 'Inflation', -0.08, 2, 767, false], ['Intel network', 'Stability', 0.02, 2, 12, false], ['Quantitative Easing', 'Inflation', 0.18, 1, 6, false], ['Renewables · Wind', 'Inflation', -0.04, 1, 0, true]]);
  assert.equal(sourceLabel('econ_war'), 'Economic warfare'); assert.equal(sourceLabel('t2'), 'National 5G Rollout'); assert.equal(sourceLabel('zzz'), 'zzz');
});

test('App (jsdom): three solar builds show one Active Effects line naming the source as permanent; the inflation drill names it too', async () => {
  const origErr = console.error; console.error = () => {};
  const g = await mount(BUNDLES.app, { testHook: true, seed: 9 });
  try {
    await g.pickCountry(0);
    const { doc, w } = g; const q = (s) => doc.querySelector(s), qa = (s) => [...doc.querySelectorAll(s)];
    [...q('[data-event-card=doctrine]').querySelectorAll('div')].find((d) => d.style.cursor === 'pointer' && /Military Superpower/.test(d.textContent)).click(); await flush();
    await g.advance(1); w.__wl.fund(60000); await flush();
    g.tabBtn('resources').click(); await flush(); q('[data-seg=natural]')?.click(); await flush();
    for (let i = 0; i < 3; i++) { qa('button').find((b) => /^\+\$400M$/.test(b.textContent)).click(); await flush(); }
    g.tabBtn('overview').click(); await flush();
    const rows = qa('[data-effect-row]'); assert.ok(rows.length >= 1, 'active effects shown');
    const solar = rows.filter((r) => /Solar/.test(r.textContent)); assert.equal(solar.length, 1, 'one line, not three');
    assert.match(solar[0].textContent, /Inflation -0\.12\/mo · Renewables · Solar · permanent/); assert.equal(solar[0].dataset.count, '1');
    assert.ok(!rows.some((r) => /\(\d{3}mo\)/.test(r.textContent)), 'no 999-style countdown');
    assert.ok(!g.faulted());
  } finally { console.error = origErr; g.close(); }
});
