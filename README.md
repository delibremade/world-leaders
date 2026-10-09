# World Leaders

Tropico-inspired grand-strategy nation simulator. Pure headless sim engine (`src/sim`) + React UI (`src/ui`), bundled to a single HTML file for play on a phone.

Start here: `SETUP.md` (human steps), then `CLAUDE.md` (agent rules), then `tasks/000-bootstrap.md`.

```
npm install
npm test          # the gate
npm run sim       # 1,000 seeded fuzz games
npm run balance   # bot hegemony curves -> reports/balance.json
npm run replay -- reports/failures/seed-7.json
npm run build     # dist/world-leaders.html
```
