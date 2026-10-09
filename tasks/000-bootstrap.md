# Task 000 — bootstrap (paste this into Claude Code, opened in the repo folder)

Read CLAUDE.md first. Then:

1. Check `node -v` (need 20+) and `npm -v`. If Node is missing or old, stop and tell me exactly what to install.
2. `npm install`, then `npm test`. Expect every test to pass, with the parity test reported as skipped. If anything fails, diagnose and fix the scaffold; do not touch `legacy/`.
3. `npm run build`. Report the dist size.
4. `git init`, add everything, commit as `v0.58.0 scaffold`.
5. Create a PRIVATE GitHub repo named `world-leaders` with `gh repo create` and push `main`. If `gh` is not installed or not authenticated, stop and tell me the one command to run; do not try to authenticate for me.
6. Confirm the `gate` workflow ran green on GitHub. If it did not, read the log and fix.
7. Report: test count passed/skipped, build size, repo URL, CI status. Under 10 lines.
