# Changelog

## 0.64.1 (2026-10-10) — P3d fix-up: 390px overflow, map-first Overview, nine-tab nav, fitting map chips, lazy pixi chunk
- Overflow: `.wl-app` grid had an implicit `auto` column that grew to its widest child (417px at 390). Now `minmax(0,1fr)`; HUD figures are a 3-column grid (sparkline under the value on phones); nothing past the right edge on any vertical (`test/layout.test.js`, real Chromium via playwright-core, 390 and 1280).
- Overview: the map card is first on phone and the main column on desktop. Static how-to tips moved behind a `?` popover (`shell/Help.jsx`); Risk Signals moved from the right column into the center column, and the right column only shows for an open issue or brief.
- Nav: all nine verticals icon-only in one row, the active one shows its label (side rail unchanged on desktop). Map modes: six-column segmented control, icon over short label.
- Build: `dist/index.html` inlines React + game and lazy-loads pixi.js + pixi-viewport from `dist/chunks/` (Pages serves it); `dist/world-leaders.html` stays the single-file build. First paint 2150 KB / 621 KB gz -> 1143 KB / 334 KB gz. Pages deploy no longer copies the single file over index.html.
- New devDependency: playwright-core 1.56.1 (layout assertions need a real browser; CI installs Chromium). Parity untouched.

## 0.64.0 (2026-10-10) — P3c Tier 1 shell: HUD, event cards, bottom nav, bottom sheet, outliner, why-breakdowns
- `src/ui/shell/`: `Hud.jsx` (nation, date, speed control pause/1x/2x/4x, pause-reason chip: a pause always shows why; treasury + monthly net, stability, hegemony with 24-month recharts sparklines, each a why-breakdown), `EventCards.jsx` (non-blocking queue: doctrine choice, decisions, flashpoint, world event; the engine never paused for the doctrine modal so it is a card now; ultimatum / confrontation / intel crisis / game over / victory stay modals because the pause gate requires them), `BottomNav.jsx` (nine verticals with decision badges; a side rail at 900px+), `Sheet.jsx` (vaul 1.1.2) hosting the v57 region panel plus the nations in the region, `NationSheet.jsx` + `nation-verbs.js` (every nation-keyed verb in actions.js as a row with cost, consequence and gate; aliases: imposeSanctions→toggleSanctions, sellDefTech→offerArms), `Outliner.jsx` + `outliner.js` (ops, builds, research, timers, flashpoints, cooldowns; swipe up via @use-gesture/react 10.3.1, right column on desktop; rows jump to context), `Why.jsx` (@radix-ui/react-popover 1.1.23).
- Why sources moved into `src/sim/selectors.js` so the engine and the UI share one formula: `oilPriceTerms` (tick), `opOddsTerms` (runIntelOp), `influencePool`/`influenceGain` (tick), `renewableTotal`. Parity byte-identical.
- Harness: `tabBtn` prefers `[data-tab]`; a stalled run answers the top overlay or a `[data-modal]` card by priority (`topOverlay`), so the doctrine card is answered where v57's z-1900 modal was. The deterministic clock now starts after bundle init (lodash's start-up `Date.now` in the App bundle shifted every timestamp). Click script: decision options are matched by their inline grid row (the old selector also hit v57's issue cards, so decisions never resolved in the verb runs); eight more op launches keep an intel crisis on the path.
- Gate: `test/shell.test.js` (sheet covers every nation-keyed verb, selector formulas, outliner rows, App shell round-trip with 120 months and resume); verb coverage test scans every UI file. dist 2.1 MB.

## 0.63.0 (2026-10-10) — P3b PixiJS world map: six map modes, every v57 overlay, pan/pinch/inertia
- `src/ui/map/`: `scene.js` builds one scene (sphere shading, contested hatch, 6-month momentum, trade routes, influence lines, chokepoints, flashpoint + timer, deployed badge, intel dot) for six modes (Sphere, Tension, Trade, Energy, Military, Intel) with a legend each; `pixi-map.js` renders it with pixi.js 8.21.0 + pixi-viewport 6.0.3 (drag, pinch, wheel, decelerate, clamp, cover zoom at start, label LOD, 44px-tolerant region hit test over REGION_GEO polygons via `path.js`); `SvgMap.jsx` renders the same scene without WebGL (jsdom gate, old devices); `MapView.jsx` picks the renderer and owns the mode chips. App's overview swaps the inline SVG for `MapView`; region tap still opens the v57 region panel (P3c moves it to the sheet).
- Phone fallback until P3c: under 900px the v57 columns stack (CSS only) so the map gets the full width.
- Gate: `test/map.test.js` (REGION_GEO parse, hit tests, six scenes with every overlay, ruling 6 in tension mode, App renders chips/legend/taps and 120 months). `scripts/map-bench.js` measures pan fps in real Chromium; `scripts/screens.js` gained the P3b scenarios. Parity untouched. dist 1.5 MB (pixi.js is 0.95 MB of it).

## 0.62.0 (2026-10-10) — P3a design system: tokens, global stylesheet, build stamp from package.json
- `docs/DESIGN-SYSTEM.md` (situation-room tactical, dark-first, 390px rules) and `src/ui/tokens.js`: colour (bg steps, text steps, accents, factions, chokepoints, 5 map-mode ramps), type scale, spacing, radius, 44px tap, elevation, motion, z-order, breakpoints. `TOKEN_CSS` carries every token as `--wl-*` plus the `.wl-panel/.wl-card/.wl-chip/.wl-btn/.wl-scrim` primitives; `installTheme(document)` injects it once from `src/ui/main.jsx`. `pixiHex()` for the P3b map.
- Title screen and HUD stamp `BUILD v<package.json version>` via `src/ui/version.js` (was the hard-coded "BUILD v57").
- `test/tokens.test.js`: hex validity, ascending scales, WCAG contrast on `bg.panel` (4.5 text, 3.0 dim/accents, factions on ocean), stylesheet completeness, App installs the theme once and shows the stamp. `scripts/screens.js`: 390px Playwright screenshots for PR evidence (global playwright, not a dependency). Parity untouched.

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
