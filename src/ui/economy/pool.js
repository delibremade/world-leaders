// One-pool allocation math (docs/DESIGN-SYSTEM-V2.md §4): dragging one line squeezes the unlocked others
// proportionally; a lock exempts a line; each line reports its change against a baseline. Pure, UI-side only:
// the engine keeps five independent sector allocations (setSectorBudget), and the pool is the sum of their monthly
// costs through the engine's own calcSCost (src/sim/formulas.js), never a second formula.
import { calcSCost } from '../../sim/formulas.js';
import { BASE_SECTOR } from '../../data/economy.js';

export const SECTORS = Object.keys(BASE_SECTOR);
export const ALLOC = { min: 0, max: 200, step: 5, exp: 2.5 };

export const costOf = (sector, alloc, maturity) => calcSCost(sector, alloc, maturity);
export const poolCost = (allocs, maturity) => SECTORS.reduce((s, k) => s + costOf(k, allocs[k] ?? 100, maturity), 0);
// The allocation that costs `cost` for this sector (inverse of the 2.5 power), snapped to the slider step and clamped.
export function allocFor(sector, cost, maturity) {
  const base = costOf(sector, 100, maturity); if (base <= 0) return ALLOC.min;
  const raw = 100 * Math.pow(Math.max(0, cost) / base, 1 / ALLOC.exp);
  return Math.max(ALLOC.min, Math.min(ALLOC.max, Math.round(raw / ALLOC.step) * ALLOC.step));
}

// Move `sector` to `value` and keep the pool: the unlocked others absorb the cost delta in proportion to what they
// spend now. Returns the new allocations, the lines that were cut (or fed), and the pool before and after. With no
// unlocked line left to give (all locked, or already at the floor), the pool simply grows and `squeezed` is false.
export function squeeze({ allocs, locks = new Set(), maturity = {}, sector, value }) {
  const from = allocs[sector] ?? 100; const to = Math.max(ALLOC.min, Math.min(ALLOC.max, value));
  const before = poolCost(allocs, maturity);
  const next = { ...allocs, [sector]: to };
  const delta = costOf(sector, to, maturity) - costOf(sector, from, maturity);
  const givers = SECTORS.filter((k) => k !== sector && !locks.has(k) && (delta > 0 ? (allocs[k] ?? 100) > ALLOC.min : (allocs[k] ?? 100) < ALLOC.max));
  const giverCost = givers.reduce((s, k) => s + costOf(k, allocs[k] ?? 100, maturity), 0);
  const cuts = [];
  if (delta !== 0 && givers.length && giverCost > 0) {
    for (const k of givers) {
      const c0 = costOf(k, allocs[k] ?? 100, maturity); const c1 = c0 - delta * (c0 / giverCost);
      const a1 = allocFor(k, c1, maturity);
      if (a1 !== (allocs[k] ?? 100)) { cuts.push({ sector: k, from: allocs[k] ?? 100, to: a1, dCost: +(costOf(k, a1, maturity) - c0).toFixed(2) }); next[k] = a1; }
    }
  }
  return { allocs: next, cuts, squeezed: cuts.some((c) => c.to < c.from), fed: cuts.some((c) => c.to > c.from), pool: { before: +before.toFixed(2), after: +poolCost(next, maturity).toFixed(2) }, moved: { sector, from, to } };
}

// Change of every line against a baseline: allocation points and monthly cost.
export const deltas = (allocs, baseline = {}, maturity = {}) => Object.fromEntries(SECTORS.map((k) => {
  const a = allocs[k] ?? 100, b = baseline[k] ?? 100;
  return [k, { dAlloc: a - b, dCost: +(costOf(k, a, maturity) - costOf(k, b, maturity)).toFixed(2) }];
}));
