# Migration: v57 artifact -> repo (tasks 000..002)

## Why
v57 is ~4,000 lines in one JSX file, edited by whole-file round trips through chat, with a harness that lived in an ephemeral sandbox. Every change cost a full human turn. The repo makes the gate persistent, the engine testable in milliseconds, and the work delegable.

## Target shape
```
src/sim/   tick(state, actions, rng)  <- all game logic, all month-to-month state transitions
src/data/  NATIONS, platforms, REGION_GEO, chokepoints, events, blocs, concessions
src/ui/    React tabs; reads state, dispatches actions; recharts stays here
test/      the gate (purity, determinism, fuzz, parity, smoke)
```

## Task 001: extract engine + data, prove parity (UI untouched)
1. Inventory `legacy/world-leaders-v57.jsx`: list every `useState`/`useRef` that holds game state, every monthly tick function, every formula, every static table. Write the inventory to `reports/inventory-v57.md` before moving code.
2. Move static tables to `src/data/` verbatim (NATIONS first). Export named constants. No logic.
3. Build `src/sim/state.js` from the inventory: one plain object holding everything the v57 autosave payload held, plus anything held only in refs. Save-format version 58; write `migrateSave(v57) -> v58` with a test.
4. Port each monthly system into `src/sim/systems.js` as `{ id, run(state, rng) }`. Preserve order of execution exactly as v57's tick ran them.
5. Port each player verb into `src/sim/actions.js`. The UI's click handlers become `dispatch({type, payload})`.
6. Replace every `Math.random()` in moved code with `rng.next()` and friends. Count the draws; the parity adapter must feed the legacy build from the same stream.
7. Collapse duplicated formulas: ISR (5 sites) and naval weight (4 sites) become one function each in `src/sim/formulas.js`.
8. Parity harness `legacy/adapter.js`:
   - jsdom-mount the v57 JSX (reuse `legacy/wl-harness/run.js` setup and `recharts-stub.js` if present).
   - Replace `window.Math.random` with the seeded stream BEFORE mount.
   - Shim `window.storage` to capture the autosave payload (the normalized snapshot).
   - Drive 120 months with a fixed action script via `window.__wl`.
   - Emit a per-month snapshot; normalize (drop UI-only fields, sort keys).
   - Run the new engine with the same seed and script; compare per-month hashes.
   - Pass criterion: identical hashes for seeds 1..5 over 120 months. If a field cannot match (floating-point order, draw-order changes), list it in `reports/parity-v57.md` with one line of justification and a tolerance. The owner signs off on that list; nothing merges without it.
9. Extend `test/bots/chaos.js` to emit every action type with schema-valid payloads; `npm run sim -- 1000 120` clean.
10. Extend `src/sim/invariants.js` with everything the v57 self-invariant purge and harness sentinels implied (no self-as-rival, no negative stocks, SPR within capacity, bloc freeze timers non-negative, etc.).

Deliverable: one PR. Evidence: parity report, inventory, test summary, line counts per module.

## Task 002: port UI, port the 78-step harness, retire legacy
- Move v57 tabs into `src/ui/` as plain components; every click becomes a dispatch. No logic in the UI.
- Autosave: `window.storage` (artifact runtime) -> `src/ui/storage.js` (guarded localStorage). Resume works when storage is empty.
- Port the 78 harness steps to `test/smoke.test.js`: same sentinels, same `__wl` hook, driven against the built bundle in jsdom.
- `npm run build` produces a playable `dist/world-leaders.html`; publish it as the artifact. Delete nothing in `legacy/`; mark it frozen in its README.

## Known deltas: artifact runtime vs repo build
| Artifact runtime | Repo build | Handling |
|---|---|---|
| `window.storage` key-value API | not present | `src/ui/storage.js` localStorage adapter, try/catch |
| recharts, lucide-react provided | must be declared | add as deps in task 002, pinned versions |
| Tailwind utility classes | no CDN by default | inline styles or a small CSS file; Tailwind play-CDN is allowed on published pages if needed |
| `Math.random` everywhere | forbidden in sim | seeded rng passed down |
| React from artifact env | react 18.3.1 pinned | same major, no API change expected |

## Parity is the proof, not the goal
Parity proves the refactor changed nothing. The goal is the next three features landing without you babysitting each one. Do not spend more than one task on parity edge cases; document, get sign-off, move on.
