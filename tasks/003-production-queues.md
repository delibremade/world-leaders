# Task 003 — production queues

Read CLAUDE.md and docs/DESIGN-RULINGS.md. Tasks 001 and 002 must be merged.

Goal: the player can queue builds and research (e.g. 3 carriers + 2 research tiers) and have them execute sequentially without further clicks. Biggest click-reduction win in the backlog.

Acceptance criteria (each needs a test):
- New state: `queue: [{ kind: 'build'|'research', id, qty, progress }]` in `src/sim/state.js`, with invariants (no negative qty, progress within bounds, queue length cap).
- New actions: `enqueue`, `dequeue`, `reorderQueue`. Unknown ids rejected.
- A monthly system `productionQueue` advances the head item using the existing build/research rules; cost is debited exactly as a manual build would be; blocked items (insufficient funds, missing prerequisite) stall with a reason in `state.log`, they do not skip.
- UI: a queue panel in the Defense tab usable one-thumbed at 390px; chips show qty, ETA in months, and the stall reason.
- Balance: extend the `warmonger` bot to use the queue; `npm run balance` curves for warmonger must be within 5% of the pre-queue run (the queue removes clicks, not cost). Paste both curves in the PR.
- CHANGELOG 0.59.0.
