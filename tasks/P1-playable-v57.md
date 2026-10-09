# Task P1 — v57 playable from the repo, live on GitHub Pages

Read CLAUDE.md and docs/PLAYABLE-PLAN.md. Use Sonnet. Do NOT change any game rule or edit legacy/.

1. Create `src/legacy-entry.jsx` that imports `../legacy/world-leaders-v57.jsx` and mounts its default export into `#root`. (Importing is allowed here; editing legacy/ is not.)
2. Add `recharts` and `lucide-react` (and any other library v57 imports) as pinned dependencies, versions at least two weeks old.
3. Provide a `window.storage` shim (get/set/delete/list, async, matching the artifact API) backed by try/catch-guarded localStorage, installed before mount. Autosave and resume must work; empty or blocked storage must not crash.
4. If v57 uses Tailwind classes, include Tailwind's play CDN script (pinned version) in the built HTML.
5. Add `npm run build:legacy` producing `dist/index.html` (single file).
6. Add `.github/workflows/pages.yml`: on push to main, build:legacy and deploy `dist/` to GitHub Pages. Tell me the one Settings click needed to enable Pages, if any.
7. Smoke test `test/legacy-smoke.test.js`: bundle mounts in jsdom with fake timers, 120 months advance without an ErrorGate fault, each of the 9 tabs (overview, sitroom, economy, energy, resources, defense, intel, technology, trade) renders non-empty.
8. One PR. Body: test result, bundle size, the Pages URL (or the step to enable it). Under 12 lines.
