# World Leaders — agent contract

Read this fully before any edit. Then read `docs/DESIGN-RULINGS.md`. For migration tasks also read `legacy/WORLD-LEADERS-NOTES-v57.md` and `legacy/WORLD-LEADERS-HANDOFF.md`.

## What this is
Tropico-inspired grand-strategy nation simulator. The player is a head of state. Four victory paths: Hegemony, Economic Ascendancy, Technological Supremacy, Diplomatic Order. Systems: economy, trade/exports, R&D and platforms (develop-then-build), diplomacy (blocs, visits, aid, pacts), intel (ops, Tier-1 regime change), escalation (tension per rival, blockades, ultimatums, nuclear register, MAD), energy (chokepoints, SPR, embargoes), world events, real-geography map. Owner plays on a phone.

## Commands
```
npm install
npm test                 # THE GATE. Purity + determinism + invariant fuzz + parity + UI smoke.
npm run sim -- 1000 240  # fuzz: N seeds x M months, writes reports/failures/seed-N.json on failure
npm run replay -- <file> # reproduce a failure headless from {seed, actions}
npm run balance          # bot hegemony curves -> reports/balance.json (the tuning oracle)
npm run build            # dist/world-leaders.html, single self-contained file for artifact publish
```

## Architecture (hard boundaries)
- `src/sim/` pure engine. Entry point `tick(state, actions, rng) -> state`. No React, no DOM, no `Math.random`, no `Date`, no I/O. `test/purity.test.js` enforces this.
- `src/sim/systems.js` monthly systems registry. Every system runs every month and stamps `lastRun`. A system that acts every 3 months no-ops internally; it never skips the stamp.
- `src/sim/actions.js` the only way state changes from outside: dispatch an action type through `tick`.
- `src/sim/invariants.js` asserted after every tick. Add an invariant whenever you add state.
- `src/data/` static registries. `NATIONS` is the single source of truth. Never create a second nation list.
- `src/ui/` React. Reads state, dispatches actions. Zero game logic. Autosave via `src/ui/storage.js` (guarded localStorage).
- `legacy/` read-only reference (v57 monolith, notes, old harness). Never edit, never import from. Exception: `legacy/adapter.js` (parity harness) may be created by task 001.
- `test/bots/` scripted policies `(state, rng) -> actions[]`. `chaos` fuzzes; `turtle`, `trader`, `warmonger` are balance probes.

## Process rules (each one was paid for in v27..v57)
1. **The harness is the gate.** `npm test` green or it does not ship. String checks, bracket balance, and "it looks right" are not substitutes for runtime assertions.
2. **If a task has no test, write the test first.** Then make it pass.
3. **Patches are atomic.** Before writing a multi-site edit, assert every anchor exists. If any anchor is missing, abort and change nothing.
4. **Never define a component inside another component.** It remounts on every render. Use plain render helpers.
5. **Declaration order inside a component is load-bearing** (TDZ). Keep refs, state, and callbacks in dependency order.
6. **Never write tension, holds, embargoes, or blockade targets against the player's own id.** `purgeSelf` runs every tick; do not rely on it, avoid the write.
7. **Monthly systems anchor outside the 3-month pressure gate.** The cadence bug this caused lived from v39 to v53.
8. **One implementation per formula.** ISR was duplicated at 5 sites, naval weight at 4. Never reintroduce duplication; extract and import.
9. **Seeded rng only inside `src/sim`.** Pass `rng` down; never reach for `Math.random`.
10. **Rare branches get a test hook, not a skip.** `window.__WL_TEST = true` exposes `window.__wl` (setTension, field, fund, platforms, levels, event, sanction). Extend it rather than leaving nuclear, chokepoint, or SAP paths untested.
11. **Do not relitigate `docs/DESIGN-RULINGS.md`.** Propose a change as an issue; do not implement it.
12. **One task, one branch, one PR.** Small commits with messages that name the system touched.
13. **No new dependencies without stating why in the PR.** Plain Node, no SaaS, no vendor lock-in.

## Definition of done
- `npm test` green; paste the summary in the PR.
- New behavior has a test. New state has an invariant.
- `npm run build` succeeds; note dist size.
- UI change: verified at 390px width; screenshot or a 3-line walkthrough in the PR.
- `CHANGELOG.md` entry with version bump (semver minor per feature, patch per fix).
- PR body follows `.github/pull_request_template.md`.
**No evidence, no "done." Never report a task complete without running the gate in this session.**

## When something fails
- Reproduce headless first: `npm run replay -- reports/failures/seed-N.json`. Fix the engine, not the symptom. Add the failing seed as a regression test.
- A bug the owner hits in play arrives as `{seed, actions}` from the autosave. Same path.

## How to write for the owner
- Terse. Lead with the next step or the verdict in bold. Numbers over adjectives. No em dashes.
- PR descriptions are read on a phone: evidence first, prose second, under 15 lines.
- Disagree when the spec is wrong; say why in one line and propose the alternative. Do not silently comply with a bad spec.
