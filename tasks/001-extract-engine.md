# Task 001 — extract the engine from v57 and prove parity

Read CLAUDE.md, docs/MIGRATION.md, docs/DESIGN-RULINGS.md, legacy/WORLD-LEADERS-NOTES-v57.md, legacy/WORLD-LEADERS-HANDOFF.md. Confirm `legacy/world-leaders-v57.jsx` exists; if not, stop and ask me for it.

Goal: every game rule and month-to-month state transition in `legacy/world-leaders-v57.jsx` runs inside `src/sim/` behind `tick(state, actions, rng)`, with static tables in `src/data/`. The UI is NOT ported in this task; the playable build stays the v57 artifact until task 002.

Do it in this order, committing after each numbered step:
1. Write `reports/inventory-v57.md`: every state holder, every monthly function in execution order, every formula (flag the 5 ISR and 4 naval-weight duplicates), every static table, every player verb, every `Math.random` call site with a count.
2. Port static tables to `src/data/` verbatim. NATIONS first. Add a test that NATIONS ids are unique and every reference elsewhere resolves.
3. Define the v58 state shape in `src/sim/state.js` and `migrateSave(v57save)` with a test using a v57 autosave payload you reconstruct from the code.
4. Port monthly systems into `src/sim/systems.js` in v57 execution order. Port verbs into `src/sim/actions.js`. Replace `Math.random` with the rng. Collapse ISR and naval weight into `src/sim/formulas.js`.
5. Extend invariants (see MIGRATION step 10) and the chaos bot to emit every action type. `npm run sim -- 1000 120` must be clean.
6. Build `legacy/adapter.js` and make `test/parity.test.js` pass for seeds 1..5 over 120 months. Any unavoidable divergence goes in `reports/parity-v57.md` with one line each; I sign off on that list before merge.
7. Open ONE pull request. Body: test summary, parity result, inventory link, line counts per module. Under 15 lines.

Constraints: no edits in `legacy/` except creating `adapter.js`; no new runtime dependencies; no UI changes; if you hit a design question, stop and ask rather than guessing, but batch questions so I answer once.
