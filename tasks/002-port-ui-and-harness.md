# Task 002 — port the UI onto the engine, port the 78-step harness, make the repo build playable

Read CLAUDE.md, docs/MIGRATION.md (task 002 section), docs/DESIGN-RULINGS.md, legacy/WORLD-LEADERS-NOTES-v57.md. Task 001 must be merged.

1. Move each v57 tab into `src/ui/` as a plain component file. Every click handler becomes `dispatch({type, payload})`. If a handler contains logic that is not already in `src/sim`, that is a task 001 miss: move it into the engine first, with a test.
2. Replace `window.storage` with `src/ui/storage.js`. Resume must work when storage is empty or blocked.
3. Declare recharts (and any other artifact-provided library the UI needs) as pinned dependencies; say which and why in the PR.
4. Port the 78 harness steps from `legacy/wl-harness/run.js` (or rebuild them from the notes' step list) into `test/smoke.test.js`: same sentinels per tab, same `window.__WL_TEST` / `window.__wl` hook, run against the esbuild bundle in jsdom.
5. `npm run build` -> `dist/world-leaders.html` playable at 390px width. Verify every tab renders and a 120-month autoplay via the hook completes.
6. Freeze `legacy/` (README note). One PR; evidence per the template, plus a screenshot of the Situation Room at 390px.
