# legacy/ — drop zone (read-only reference)

Put the last chat-built files here. Never edit them; never import from them in src/.

Required:
- `world-leaders-v57.jsx` — the v57 single-file artifact (download from the "Building a Tropico-inspired strategy game" chat)
- `WORLD-LEADERS-NOTES-v57.md` — the running ledger: process rules, system coupling map, rulings, remaining work

Strongly recommended if you have them:
- `WORLD-LEADERS-HANDOFF.md` — architecture (state + ref pattern, bug museum)
- `wl-harness/run.js`, `wl-harness/SETUP.md`, `wl-harness/recharts-stub.js` — the 78-step jsdom harness

If the harness files are missing, task 002 rebuilds the steps from the notes file's step list.

Task 001 creates `legacy/adapter.js` here (parity harness). That is the only file in this folder Claude Code may write.
