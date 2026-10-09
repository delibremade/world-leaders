# Task P2 — thin seam: game state + tick out of the component

Read CLAUDE.md, docs/PLAYABLE-PLAN.md (guardrails), docs/DESIGN-RULINGS.md, legacy/WORLD-LEADERS-NOTES-v57.md. Use Opus. P1 must be merged.

Goal: the v57 UI runs on an engine in `src/sim/`. Zero rule changes. No visual changes.

To control cost: first write `reports/inventory-v57.md` (state holders, tick phases in execution order, formulas, verbs, with line ranges) in one pass over the file; afterwards read only cited line ranges, never the whole file again.

1. Copy v57 into `src/ui/App.jsx` (legacy/ stays untouched as reference).
2. Move game state into one plain object in `src/sim/state.js`; move the monthly tick into `src/sim/tick.js` as phase functions (economy, diplomacy, military, intel, world) preserving v57 execution order and the cadence rule (monthly systems outside the 3-month gate).
3. Move player verbs into `src/sim/actions.js`; UI handlers become dispatches.
4. Hoist the duplicated ISR (5 sites) and naval-weight (4 sites) formulas into `src/sim/formulas.js`.
5. Static tables (NATIONS/COUNTRIES -> NATIONS, PLATFORMS, REGION_GEO, CHOKEPOINTS, CONCESSIONS, WORLD_EVENTS, BLOC_TRADE, BLACK_PROGRAMS) into `src/data/`.
6. Gate: P1 smoke test passes against the new App; save/resume round-trips; `src/sim` passes the purity test except Math.random, which is allowed for now behind a single `rng()` helper.
7. One PR, or a stack of small PRs if a session runs long. Body: what moved, line counts per module, test result.
