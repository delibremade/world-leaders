# Changelog

## 0.61.1 (2026-10-10) — fix: lane sanctions charge bloc/ally costs (#5); map +/- deploy writes live state (#6)
- `imposeSanctions` now runs `toggleSanctions` when adding (bloc reset + 12mo freeze, -4 stability and warning for allies), ruling 7. `adjustDeployment` routes + to `deployUnit` and - to `recallUnit`; the map no longer treats unowned black programs as owned (free count cannot go negative). + now toasts "stationed", as the other deploy entry points do.
- Tests: entry-point parity for france/japan/saudi, live-state reads after map +/-. Parity: map +/- clicks removed from `parity-clicks.js` month 9 (replaced by OOB station via the shared path); lane sanctions were never in the script. Every other parity case unchanged.

## 0.61.0 (2026-10-10) — P2b player verbs into src/sim/actions.js
- Every v57 player verb is now `dispatch({type, payload})` -> `applyVerb(g, S, fx, action)` (`src/sim/actions.js`, 100 verbs): the 20 callbacks plus ~80 inline render handlers. Payloads are keyed by nation / region / id for the P3 bottom sheet. App keeps presentation state only (tabs, selection, panels, speed, pause) and session lifecycle (start, resume, New Nation).
- Shared rules hoisted so render and verbs use one implementation: `triadLegs`, `strategicWeight`, `kineticDamage`, `meetsReq`, `procurementCost`, `sapRate/sapRunCost`, `recapCost` (formulas.js); bloc tier reqs, EU/CN T3 exclusivity, EU thresholds, statecraft groups (`src/sim/selectors.js`). Labels to `src/data`.
- Gate: `test/util/parity-clicks.js` drives every verb family through the UI (2 seeds x 120 months, every modal option, IMF bailout); App autosaves byte-identical to v57. `test/actions.test.js`: dispatch/VERBS coverage both ways, no game writes left in the UI, headless tests for verbs parity cannot reach (modernization, recapitalization, bailout).
- v57 text variants of one act kept via `from` (back-channel, reserve release, posture, blockade lift); v57 quirks kept: map +/- skips the live ref, lane sanctions skip bloc consequences.

## 0.60.1 (2026-10-10) — fix: embargoed player with import contracts no longer faults every month
- `isDiversified(g)` in `src/sim/formulas.js` replaces the v57 TDZ read (inventory bug 1); the two read sites in `tick.js` share it. No other rule changed.
- `window.__wl.embargoBy/imports` test hooks; `test/embargo-imports.test.js` (engine + App smoke). Parity unchanged (no scenario hits the bug).
- Pages now deploys the App build (`dist/world-leaders.html` copied to `index.html`); `build:legacy` kept.

## 0.60.0 (2026-10-09) — P2a thin seam: state + tick out of the component
- `src/ui/App.jsx` (v57 UI) runs its month on `src/sim/tick.js` `runMonth(g, S, fx)`: 9 phases in v57 order, 3-month pressure gate inside its phase.
- `src/sim/state.js`: `STATE_FIELDS` (107), `stateView`, `openingPosition`, `newCampaign`. `src/sim/formulas.js`: ISR (8 sites) and naval weight (7 sites) hoisted. `rng()` is the only Math.random in src/sim.
- Static tables in `src/data/` (10 modules); COUNTRIES folded into `NATIONS[id].play`.
- Gate: App autosaves byte-identical to v57 (3 seeds x 120 months); smoke + resume on both builds; headless month tests; v57 invariants. Both builds share one HTML shell (fixes a 20px panel-width drift at 390px).
- Not yet: player verbs into `src/sim/actions.js` (P2b).

## 0.59.0 (2026-10-09) — P1 v57 playable from repo
- `src/legacy-entry.jsx` mounts v57 unmodified; `window.storage` shim over guarded localStorage; `npm run build:legacy` -> `dist/index.html` (545 KB); Pages workflow; `test/legacy-smoke.test.js` (120 months, 9 tabs, autosave).

## 0.58.0 (2026-10-09) — repo scaffold
- Pure sim skeleton (`src/sim`): seeded rng, tick(), action reducer, monthly-system registry, invariants, replay.
- Gate: purity, determinism, invariant fuzz (200 seeds x 120 months), parity (skipped until task 001), UI smoke.
- Scripts: sim, replay, balance, build (single-file HTML for artifact publish).
- CI, PR/issue templates, CLAUDE.md, migration plan, task prompts 000-003.

## 0.57.0 — legacy baseline
- `legacy/world-leaders-v57.jsx`, single-file artifact, 78-step jsdom harness. Last chat-built version.
