import { makeRng } from './rng.js';
import { newGame } from './state.js';
import { tick } from './tick.js';

// Drive a game with a policy. Returns the full action script so any run is reproducible.
// policy(state, rng) -> actions[]   (bots live in test/bots/)
export function run({ seed, player = 'usa', months = 120, policy = () => [], onMonth }) {
  const rng = makeRng(seed);
  let state = newGame({ seed, player });
  const actions = [];
  for (let m = 0; m < months; m++) {
    const a = policy(state, rng);
    actions.push(a);
    state = tick(state, a, rng);
    if (onMonth) onMonth(state, m);
  }
  return { state, actions, draws: rng.draws };
}

// Replay a bug file: { seed, player, actions: [[...month0], [...month1], ...] }
// This is the "core dump": anything that fails in play is reproduced headless from this object.
export function replay({ seed, player = 'usa', actions }, onMonth) {
  const rng = makeRng(seed);
  let state = newGame({ seed, player });
  for (let m = 0; m < actions.length; m++) {
    state = tick(state, actions[m], rng);
    if (onMonth) onMonth(state, m);
  }
  return state;
}
