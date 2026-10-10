// Headless v57 month for tests that need setters applied (the App's S sink, minus React): a setX(v|fn) writes g.x.
import { runMonth } from '../../src/sim/tick.js';
import { applyVerb } from '../../src/sim/actions.js';
import { newCampaign } from '../../src/sim/state.js';
import { COUNTRIES } from '../../src/data/nations.js';
import { mulberry32, setRngSource } from '../../src/sim/rng.js';

export function game(seed, idx = 0) {
  setRngSource(mulberry32(seed));
  const g = { ...newCampaign(COUNTRIES[idx]), log: [] };
  g.doctrine = 'hegemon';
  const toasts = [];
  const S = new Proxy({}, { get: (_, n) => (v) => { const f = n.slice(3, 4).toLowerCase() + n.slice(4); g[f] = typeof v === 'function' ? v(g[f]) : v; } });
  const fx = { toast: (m) => toasts.push(m), now: () => g.tickCount, defer() {} };
  return { g, toasts, step: () => runMonth(g, S, fx), act: (a) => applyVerb(g, S, fx, a), done: () => setRngSource(() => Math.random()) };
}
