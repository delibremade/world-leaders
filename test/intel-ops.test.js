import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMonth } from '../src/sim/tick.js';
import { newCampaign } from '../src/sim/state.js';
import { COUNTRIES } from '../src/data/nations.js';
import { mulberry32, setRngSource } from '../src/sim/rng.js';
import { checkV57 } from '../src/sim/invariants.js';
import { opOdds, opOddsTerms } from '../src/sim/selectors.js';
import { groupOps } from '../src/ui/shell/ops.js';
import { mount, BUNDLES, flush } from './util/harness.js';

// FIX 3: the operations list showed 0% success / 0% exposure on every row. Real cause, not display: a standing program's
// relaunch carried no id and no odds, so it resolved as rng() < NaN (never a success, never discovered) and the row rendered
// (undefined || 0). Relaunches are stamped like hand launches now; an unstamped op from an old save resolves on today's odds.

function month(seed, mutate) {
  setRngSource(mulberry32(seed));
  const g = newCampaign(COUNTRIES[0]); g.doctrine = 'hegemon'; g.gracePeriod = 0; mutate(g);
  const calls = []; const toasts = [];
  const S = new Proxy({}, { get: (_, name) => (v) => calls.push([name, v]) });
  try { runMonth(g, S, { toast: (m) => toasts.push(m), now: () => 0 }); } finally { setRngSource(() => Math.random()); }
  // fold every setIntelOps call over the month's starting list, as React would
  const ops = calls.filter(([n]) => n === 'setIntelOps').reduce((p, [, v]) => (typeof v === 'function' ? v(p) : v), g.intelOps);
  const log = calls.filter(([n]) => n === 'setLog').reduce((p, [, v]) => (typeof v === 'function' ? v(p) : v), g.log || []);
  return { g, ops, log, toasts };
}

test('a standing program relaunches stamped: id, odds from opOddsTerms, type; the v57 invariant holds', () => {
  const { g, ops } = month(3, (g) => { g.continuousOps = { 'tech_acq@china': true }; g.stats.treasury = 50000; });
  const o = ops.find((x) => x.opId === 'tech_acq' && x.targetId === 'china');
  assert.ok(o, 'relaunched'); assert.equal(typeof o.id, 'string'); assert.equal(o.continuous, true); assert.equal(o.type, 'covert');
  const t = opOddsTerms(g, 'tech_acq');
  assert.equal(o.successRate, t.successRate); assert.equal(o.discoverRate, t.discoverRate);
  assert.ok(o.successRate > 0.5 && o.successRate <= 0.95, `success ${o.successRate}`); assert.ok(o.discoverRate >= 0.05 && o.discoverRate < 0.5, `exposure ${o.discoverRate}`);
  assert.deepEqual(checkV57({ ...g, intelOps: ops }), []);
  assert.ok(checkV57({ ...g, intelOps: [{ opId: 'tech_acq', targetId: 'china', monthsLeft: 4, continuous: true }] }).some((n) => /intel ops carry/.test(n)), 'an unstamped op trips the invariant');
});

test('resolution uses the stamped odds: a sure op succeeds, a hopeless one fails; an unstamped op from an old save resolves on today\'s odds, never NaN', () => {
  const sure = month(5, (g) => { g.intelOps = [{ id: 'a', opId: 'tech_acq', targetId: 'china', monthsLeft: 1, successRate: 1, discoverRate: 0, type: 'covert' }]; });
  assert.ok(sure.log.some((l) => /Intel op vs china: success/.test(l.msg)), JSON.stringify(sure.log.slice(0, 3)));
  assert.ok(!sure.log.some((l) => /DISCOVERED/.test(l.msg)));
  const hopeless = month(5, (g) => { g.intelOps = [{ id: 'b', opId: 'tech_acq', targetId: 'china', monthsLeft: 1, successRate: 0, discoverRate: 0, type: 'covert' }]; });
  assert.ok(hopeless.log.some((l) => /Intel op vs china: failed/.test(l.msg)));
  // old save: no odds on the op. v57 resolved rng() < NaN, so it could never succeed; now it resolves on today's odds.
  let wins = 0;
  for (let seed = 1; seed <= 30; seed++) { const r = month(seed, (g) => { g.intelOps = [{ opId: 'tech_acq', targetId: 'china', monthsLeft: 1, continuous: true }]; }); if (r.log.some((l) => /vs china: success/.test(l.msg))) wins++; }
  assert.ok(wins >= 10, `an unstamped op won ${wins}/30 months (would be 0 before the fix)`);
  const g = newCampaign(COUNTRIES[0]); g.doctrine = 'hegemon';
  const legacy = opOdds(g, { opId: 'tech_acq', targetId: 'china' }); assert.equal(legacy.successRate, opOddsTerms(g, 'tech_acq').successRate);
  assert.deepEqual(opOdds(g, { opId: 'tech_acq', successRate: 0.42, discoverRate: 0.1 }), { successRate: 0.42, discoverRate: 0.1 }, 'a stamped op keeps its stamp');
});

test('groupOps: by type then target with counts, covert before defensive, busiest target first', () => {
  const ops = [
    { id: '1', opId: 'tech_acq', targetId: 'china', monthsLeft: 2 }, { id: '2', opId: 'destab', targetId: 'china', monthsLeft: 3 },
    { id: '3', opId: 'tech_acq', targetId: 'russia', monthsLeft: 1 }, { id: '4', opId: 'counter_int', targetId: 'russia', monthsLeft: 2 },
  ];
  const g = groupOps(ops);
  assert.deepEqual(g.map((x) => [x.type, x.count]), [['covert', 3], ['defensive', 1]]);
  assert.deepEqual(g[0].targets.map((t) => [t.targetId, t.count]), [['china', 2], ['russia', 1]]);
  assert.equal(g[0].targets[0].name, 'China'); assert.deepEqual(g[0].targets[0].ops.map((o) => o.id), ['1', '2']);
  assert.deepEqual(groupOps([]), []);
});

test('App (jsdom): the Intel operations list is grouped by type and target with counts and every row shows non-zero odds', async () => {
  const origErr = console.error; console.error = () => {};
  const g = await mount(BUNDLES.app, { testHook: true, seed: 4 });
  try {
    await g.pickCountry(0);
    const { doc, w } = g; const q = (s) => doc.querySelector(s), qa = (s) => [...doc.querySelectorAll(s)];
    [...q('[data-event-card=doctrine]').querySelectorAll('div')].find((d) => d.style.cursor === 'pointer' && /Military Superpower/.test(d.textContent)).click(); await flush();
    await g.advance(1); w.__wl.fund(60000); await flush();
    g.tabBtn('intel').click(); await flush();
    const btn = (re, nth = 0) => qa('button').filter((b) => re.test(b.textContent))[nth];
    btn(/^🇨🇳 China$/).click(); await flush(); btn(/^Launch Op$/, 0).click(); await flush(); btn(/^Launch Op$/, 0).click(); await flush();
    btn(/^🇷🇺 Russia$/).click(); await flush(); btn(/^Launch Op$/, 0).click(); await flush();
    assert.match(q('[data-ops-head]').textContent, /Operations in Progress · 3/);
    const types = qa('[data-ops-type]'); assert.equal(types.length, 1); assert.equal(types[0].dataset.opsType, 'covert'); assert.equal(types[0].dataset.count, '3');
    assert.deepEqual(qa('[data-ops-target]').map((t) => [t.dataset.opsTarget, t.dataset.count]), [['china', '2'], ['russia', '1']]);
    const odds = qa('[data-op-odds]').map((e) => e.textContent); assert.equal(odds.length, 3);
    for (const t of odds) { const m = t.match(/(\d+)% success · (\d+)% exposure/); assert.ok(m, t); assert.ok(+m[1] > 0 && +m[2] > 0, t); }
    assert.ok(!g.faulted());
  } finally { console.error = origErr; g.close(); }
});
