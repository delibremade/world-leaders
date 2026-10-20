// The gate (CLAUDE.md: npm test green or it does not ship). Two passes, same files, same assertions:
//   1. engine, pure and jsdom suites: node --test, parallel (one process per file, default concurrency).
//   2. real-Chromium suites (any file that imports test/util/browser.js): node --test --test-concurrency=1, one at a
//      time, after the first pass. Each of these launches Chromium with swiftshader WebGL for the map; three of them
//      in parallel took the whole runner down (GitHub: "runner received a shutdown signal"; locally: SIGKILL on
//      desktop-layout.test.js). Serial, the same files pass in a bounded footprint, so the gate is deterministic.
// Exit code is non-zero if either pass fails. A new test file is picked up by its import, no registration needed.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

const files = readdirSync('test').filter((f) => f.endsWith('.test.js')).sort().map((f) => `test/${f}`);
const browser = files.filter((f) => /util\/browser\.js/.test(readFileSync(f, 'utf8')));
const unit = files.filter((f) => !browser.includes(f));
const only = process.argv[2]; // `node scripts/test.js unit` or `... browser` runs one pass

const run = (label, args) => {
  console.log(`\n# gate: ${label}`);
  const r = spawnSync(process.execPath, ['--test', ...args], { stdio: 'inherit' });
  return r.status ?? 1;
};
let code = 0;
if (only !== 'browser') code |= run(`${unit.length} engine, pure and jsdom suites (parallel)`, unit);
if (only !== 'unit') code |= run(`${browser.length} Chromium suites (serial)`, ['--test-concurrency=1', ...browser]);
console.log(`\n# gate: ${code ? 'FAIL' : 'green'}`);
process.exit(code ? 1 : 0);
