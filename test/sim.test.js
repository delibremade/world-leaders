import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { run, replay } from '../src/sim/replay.js';
import { chaos } from './bots/chaos.js';
import { hashState } from './util/hash.js';

const SEEDS = Number(process.env.SEEDS || 200);
const MONTHS = Number(process.env.MONTHS || 120);

test(`determinism: same seed + same actions => identical state (20 seeds x ${MONTHS} months)`, () => {
  for (let seed = 1; seed <= 20; seed++) {
    const a = run({ seed, months: MONTHS, policy: chaos });
    const b = replay({ seed, actions: a.actions });
    assert.equal(hashState(a.state), hashState(b), `seed ${seed} diverged`);
  }
});

test(`invariants hold under fuzz (${SEEDS} seeds x ${MONTHS} months)`, () => {
  mkdirSync('reports/failures', { recursive: true });
  const failures = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    try {
      run({ seed, months: MONTHS, policy: chaos });
    } catch (err) {
      const actions = [];
      try { run({ seed, months: MONTHS, policy: (s, r) => { const a = chaos(s, r); actions.push(a); return a; } }); } catch {}
      const file = `reports/failures/seed-${seed}.json`;
      writeFileSync(file, JSON.stringify({ seed, player: 'usa', actions, error: String(err) }, null, 2));
      failures.push(`seed ${seed}: ${err.message} (repro: ${file})`);
    }
  }
  assert.deepEqual(failures, []);
});

test('tick rejects unknown action types', () => {
  assert.throws(() => run({ seed: 1, months: 1, policy: () => [{ type: 'nope' }] }), /Unknown action type/);
});

test('tick never lets the player become their own rival', () => {
  const r = run({ seed: 7, months: 12, policy: () => [] });
  assert.ok(!r.state.rivals.includes(r.state.player));
  assert.ok(!(r.state.player in r.state.tension));
});
