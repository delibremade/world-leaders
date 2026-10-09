import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isrScore, navalWeight, wSum, sumDep, isAllyOf, topHostile } from '../src/sim/formulas.js';

test('isrScore matches the v57 inline formula', () => {
  assert.equal(isrScore({}, {}, {}, undefined), 0);
  const p = { satellite_net: 2, rq170: 1, rq180: 1, drone_swarm: 3 };
  assert.equal(isrScore(p, { space: 4 }, { isr_fusion: 1 }, { sr72: 1 }), 4 + 2 + 4 + 4 + 4 + 6 + 3);
});

test('navalWeight matches the v57 inline formula and tolerates a missing region', () => {
  assert.equal(navalWeight(undefined), 0);
  assert.equal(navalWeight({ carrier_group: 2, sub_fleet: 1, ssnx: 1, frigate: 3, zumwalt: 1, fighter_wing: 9 }), 2 + 1 + 2 + 1.5 + 1.2);
});

test('deployment helpers and bloc logic', () => {
  assert.equal(sumDep({ a: 2, b: 3 }), 5);
  assert.equal(wSum({ b21: 1, frigate: 2, carrier_group: 1 }), 2 + 1 + 1);
  assert.ok(isAllyOf('usa', 'germany'));
  assert.ok(!isAllyOf('usa', 'usa'), 'never your own ally');
  assert.ok(!isAllyOf('brazil', 'india'), 'neutrals are not a bloc');
  assert.deepEqual(topHostile({ germany: 50, china: 30, russia: 10 }, 'usa'), ['china', 30]);
});
