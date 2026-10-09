// npm run sim -- [seeds] [months]   e.g. npm run sim -- 1000 240
import { mkdirSync, writeFileSync } from 'node:fs';
import { run } from '../src/sim/replay.js';
import { chaos } from '../test/bots/chaos.js';

const seeds = Number(process.argv[2] || 1000);
const months = Number(process.argv[3] || 120);
mkdirSync('reports/failures', { recursive: true });
let fails = 0; const t0 = Date.now();
for (let seed = 1; seed <= seeds; seed++) {
  try { run({ seed, months, policy: chaos }); }
  catch (err) {
    fails++;
    const actions = [];
    try { run({ seed, months, policy: (s, r) => { const a = chaos(s, r); actions.push(a); return a; } }); } catch {}
    writeFileSync(`reports/failures/seed-${seed}.json`, JSON.stringify({ seed, player: 'usa', actions, error: String(err) }, null, 2));
    console.log(`FAIL seed ${seed}: ${err.message}`);
  }
}
console.log(`${seeds - fails}/${seeds} games clean over ${months} months in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(fails ? 1 : 0);
