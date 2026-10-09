// npm run replay -- reports/failures/seed-7.json
import { readFileSync } from 'node:fs';
import { replay } from '../src/sim/replay.js';
import { hashState } from '../test/util/hash.js';

const file = process.argv[2];
if (!file) { console.error('usage: npm run replay -- <bugfile.json>'); process.exit(2); }
const bug = JSON.parse(readFileSync(file, 'utf8'));
try {
  const final = replay(bug, (s, m) => { if (m % 12 === 11) console.log(`month ${s.month}: ${hashState(s)}`); });
  console.log('replay completed clean; final hash', hashState(final));
} catch (err) {
  console.log('reproduced:', err.message);
  process.exit(1);
}
