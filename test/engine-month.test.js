import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMonth, MONTH_PHASES } from '../src/sim/tick.js';
import { newCampaign, STATE_FIELDS, stateView } from '../src/sim/state.js';
import { COUNTRIES } from '../src/data/nations.js';
import { mulberry32, setRngSource } from '../src/sim/rng.js';
import { checkV57 } from '../src/sim/invariants.js';

// Headless: the extracted v57 month runs on a plain state object, no React, no DOM.
function month(seed, countryIdx = 0) {
  setRngSource(mulberry32(seed));
  const g = newCampaign(COUNTRIES[countryIdx]); g.doctrine = 'hegemon';
  const calls = [];
  const S = new Proxy({}, { get: (_, name) => (v) => calls.push([name, typeof v === 'function' ? 'fn' : v]) });
  const toasts = [];
  const ran = [];
  const orig = MONTH_PHASES.map((p) => p.run);
  MONTH_PHASES.forEach((p, i) => { p.run = (...a) => { ran.push(p.id); return orig[i](...a); }; });
  try { return { ok: runMonth(g, S, { toast: (m) => toasts.push(m), now: () => 0 }), g, calls, toasts, ran }; }
  finally { MONTH_PHASES.forEach((p, i) => { p.run = orig[i]; }); setRngSource(() => Math.random()); }
}

test('newCampaign covers exactly STATE_FIELDS', () => {
  assert.deepEqual(Object.keys(newCampaign(COUNTRIES[0])).sort(), [...STATE_FIELDS].sort());
});

test('runMonth: all 11 phases in v57 order (E4 minerals after research, E8 forces after minerals), monthly systems outside the 3-month gate', () => {
  const r = month(1);
  assert.equal(r.ok, true);
  assert.deepEqual(r.ran, ['economy', 'research', 'minerals', 'forces', 'pressure', 'intelOps', 'alliances', 'market', 'statecraft', 'counterIntel', 'world']);
  assert.deepEqual([...new Set(MONTH_PHASES.map((p) => p.system))].sort(), ['diplomacy', 'economy', 'intel', 'military', 'resources', 'world']);
  assert.equal(r.g.tickCount, 1);
  assert.equal(r.g.pressureTimer, 2, 'pressure timer counts down every month');
  assert.equal(r.g.decisionTimer, 7);
  assert.ok(r.calls.some(([n]) => n === 'setStats') && r.calls.some(([n]) => n === 'setDate'));
  assert.deepEqual(checkV57(r.g), [], 'v57 invariants after a headless month');
});

test('runMonth is deterministic for a seeded rng stream', () => {
  const a = month(7, 3), b = month(7, 3);
  assert.equal(JSON.stringify(a.calls), JSON.stringify(b.calls));
  assert.notEqual(JSON.stringify(month(8, 3).calls), JSON.stringify(a.calls));
});

test('runMonth ends early without a country (v57 guard)', () => {
  const g = newCampaign(COUNTRIES[0]); g.country = null;
  assert.equal(runMonth(g, new Proxy({}, { get: () => () => {} }), { toast() {}, now: () => 0 }), false);
});

test('stateView is a sealed live view over {current} holders', () => {
  const holders = Object.fromEntries(STATE_FIELDS.map((k) => [k, { current: 0 }]));
  const v = stateView(holders);
  v.stats = 5; assert.equal(holders.stats.current, 5);
  holders.tickCount.current = 9; assert.equal(v.tickCount, 9);
  assert.throws(() => { v.nope = 1; }, TypeError);
  assert.throws(() => stateView({ ...holders, stats: undefined }), /missing holder/);
});

test('v57 invariants catch the player written as their own rival', () => {
  const g = newCampaign(COUNTRIES[0]);
  g.rivalTension.usa = 50; g.blockades.EA = { target: 'usa' };
  assert.deepEqual(checkV57(g), ['player not in rivalTension', 'player never a blockade target']);
});
