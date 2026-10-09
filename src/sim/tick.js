import { applyAction } from './actions.js';
import { MONTHLY_SYSTEMS } from './systems.js';
import { assertInvariants } from './invariants.js';

const LOG_CAP = 500;

// State is plain JSON by contract; a JSON round-trip is the clone AND the enforcement (drops functions/undefined, NaN -> null).
export const clone = (v) => JSON.parse(JSON.stringify(v));

// The one entry point. Pure: same (state, actions, rng-stream) => same output. No React, no DOM, no clock.
export function tick(state, actions = [], rng) {
  if (!rng || typeof rng.next !== 'function') {
    throw new Error('tick(state, actions, rng): rng is required (src/sim/rng.js makeRng)');
  }
  let s = clone(state);
  for (const a of actions) s = applyAction(s, a, rng);
  s.month += 1;
  for (const sys of MONTHLY_SYSTEMS) {
    s = sys.run(s, rng);
    s.systems.lastRun[sys.id] = s.month;
  }
  s = purgeSelf(s);
  if (s.log.length > LOG_CAP) s.log = s.log.slice(-LOG_CAP);
  assertInvariants(s);
  return s;
}

// Structural guarantee (v56 ruling): the player can never appear as their own rival.
export function purgeSelf(s) {
  s.rivals = s.rivals.filter((id) => id !== s.player);
  delete s.tension[s.player];
  return s;
}
