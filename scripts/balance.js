// npm run balance -- [seeds] [months]  -> reports/balance.json + console table
// Hegemony curve per scripted policy. This is the held-out observation: tuning is judged here, not by feel alone.
import { mkdirSync, writeFileSync } from 'node:fs';
import { run } from '../src/sim/replay.js';
import { turtle } from '../test/bots/turtle.js';
import { trader } from '../test/bots/trader.js';
import { warmonger } from '../test/bots/warmonger.js';

const seeds = Number(process.argv[2] || 50);
const months = Number(process.argv[3] || 240);
const bots = { turtle, trader, warmonger };
const out = {};
for (const [name, policy] of Object.entries(bots)) {
  const sum = new Array(months).fill(0);
  for (let seed = 1; seed <= seeds; seed++) {
    run({ seed, months, policy, onMonth: (s, m) => { sum[m] += s.hegemony; } });
  }
  out[name] = sum.map((v) => +(v / seeds).toFixed(2));
}
mkdirSync('reports', { recursive: true });
writeFileSync('reports/balance.json', JSON.stringify({ seeds, months, hegemony: out }, null, 2));
const cols = [11, 59, 119, 179, 239].filter((i) => i < months);
console.log('bot        ' + cols.map((c) => `m${c + 1}`.padStart(8)).join(''));
for (const [name, curve] of Object.entries(out)) console.log(name.padEnd(11) + cols.map((c) => String(curve[c]).padStart(8)).join(''));
