# Changelog

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
