import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMonth } from '../src/sim/tick.js';
import { newCampaign } from '../src/sim/state.js';
import { COUNTRIES } from '../src/data/nations.js';
import { mulberry32, setRngSource } from '../src/sim/rng.js';
import { mount, BUNDLES } from './util/harness.js';

// Regression (inventory-v57 bug 1): embargoed player with import contracts threw a TDZ ReferenceError every month.
test('engine: embargoed player with import contracts survives the month', () => {
  setRngSource(mulberry32(1));
  try {
    for (const contracts of [['oil'], ['oil', 'gas']]) {
      const g = newCampaign(COUNTRIES[3]); g.doctrine = 'hegemon';
      g.embargoedBy = { by: 'russia', mo: 12 }; g.importContracts = new Set(contracts);
      const S = new Proxy({}, { get: () => () => {} });
      assert.equal(runMonth(g, S, { toast() {}, now: () => 0 }), true);
    }
  } finally { setRngSource(() => Math.random()); }
});

test('App smoke: embargoed player with import contracts advances without a fault', async () => {
  const origErr = console.error; const faults = []; console.error = (...a) => faults.push(a.join(' '));
  const g = await mount(BUNDLES.app, { seed: 5, testHook: true });
  try {
    await g.pickCountry(3);
    g.w.__wl.embargoBy('russia', 12); g.w.__wl.imports(['oil']);
    const months = await g.advance(6);
    assert.equal(months, 6);
    assert.equal(g.faulted(), false);
    assert.deepEqual(faults.filter((f) => /tick fault/.test(f)), [], 'v57 contained the TDZ throw as a toast each month');
    assert.doesNotMatch(g.text(), /Simulation fault caught/);
  } finally { console.error = origErr; g.close(); }
});
