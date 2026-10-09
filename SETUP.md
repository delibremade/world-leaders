# SETUP — zip to running loop (about 20 minutes, needs a computer once)

## 1. Unzip
Unzip `world-leaders-starter.zip` into `~/Projects/world-leaders` (any folder works).

## 2. Drop the v57 files into `legacy/`
From the chat titled "Building a Tropico-inspired strategy game", download and place:
- `world-leaders-v57.jsx` (required)
- `WORLD-LEADERS-NOTES-v57.md` (required)
- `WORLD-LEADERS-HANDOFF.md` (if you have it)
- `wl-harness/run.js`, `wl-harness/SETUP.md`, `wl-harness/recharts-stub.js` (if you have them)

If you only have an older notes version or a v56 JSX, use what you have and rename nothing; tell Claude Code which version is present when you paste task 001.

## 3. Install once
- Node 22: https://nodejs.org (LTS)
- Git
- GitHub CLI: https://cli.github.com then run `gh auth login` yourself (Claude Code must not do this step)
- Claude Code desktop app, signed in with your Max plan (no API key set in your shell; an `ANTHROPIC_API_KEY` env var would bill the API instead of the plan)

## 4. Bootstrap
Open Claude Code in the repo folder. Set the model to Opus for migration tasks (`/model`). Paste the contents of `tasks/000-bootstrap.md`.
Expected: `npm test` reports 6 pass, 1 skipped (parity); build about 140 KB; private repo `world-leaders` created; CI green.

## 5. Task 001 (the big one)
Paste `tasks/001-extract-engine.md`. Let it run. It will stop to ask batched design questions once; answer, let it finish. It ends by opening a PR.
Review on the phone: GitHub app -> PR -> check CI green, read `reports/parity-v57.md`. If the divergence list is empty or acceptable, merge.

## 6. Task 002, then 003
Paste `tasks/002-port-ui-and-harness.md`. When merged, `npm run build` gives you `dist/world-leaders.html`; publish it as the artifact and play on the phone. Then `tasks/003-production-queues.md`.

## 7. Steady state (per feature)
1. Open a GitHub issue using the Task template: goal, acceptance criteria, out of scope.
2. In Claude Code: "Implement issue #N per CLAUDE.md. Open a PR with evidence."
3. Review the PR on the phone. Merge or comment. Repeat.

## When you hit a bug playing
Export the autosave `{seed, actions}` (task 002 adds an Export button), paste it into an issue. Claude Code reproduces it with `npm run replay`, fixes the engine, adds the seed as a regression test.

## Usage notes (Max plan)
- Chat and Claude Code share one usage bucket. Task 001 is the expensive run; start it when you will not need the chat for a few hours.
- Watch claude.ai/settings/usage the first week. Claude Code auto-downgrades Opus to Sonnet partway through the limit (Max 5x at 20%, Max 20x at 50%); re-pin with `/model` if a migration task is mid-flight.
