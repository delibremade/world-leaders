// Registry of monthly systems. Each runs EVERY month, unconditionally.
// Rule (paid for in v39..v53): monthly systems anchor OUTSIDE any N-month pressure gate.
// If a system should only act every 3 months, it runs every month and no-ops internally; it still stamps lastRun.
// Shape: { id: 'economy', run(state, rng) -> state }
export const MONTHLY_SYSTEMS = [
  // populated by task 001 (engine extraction from legacy/world-leaders-v57.jsx)
];
