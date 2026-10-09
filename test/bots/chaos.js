// Fuzzer: emits 0-3 random legal actions per month. When task 001 lands, make it draw from ACTION_TYPES
// with random (but schema-valid) payloads so it reaches every reducer branch.
import { ACTION_TYPES } from '../../src/sim/actions.js';
const TYPES = [...ACTION_TYPES];
export function chaos(state, rng) {
  const n = rng.int(4);
  const out = [];
  for (let i = 0; i < n; i++) out.push({ type: rng.pick(TYPES) });
  return out;
}
