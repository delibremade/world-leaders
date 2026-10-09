import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// src/sim must be headless and deterministic. Any of these tokens inside it fails the gate.
const FORBIDDEN = [
  /Date\.now/, /new Date\(/, /\bdocument\b/, /\bwindow\b/, /localStorage/,
  /from ['"]react/, /require\(['"]react/, /setTimeout|setInterval/, /\bfetch\(/,
];
// P2 exception (tasks/P2-thin-seam.md): Math.random is allowed exactly once, behind rng() in src/sim/rng.js.
const RNG_FILE = 'src/sim/rng.js';
const RNG_LINE = 'let source = () => Math.random();';

const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const code = (src) => src.split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '')).join('\n');

test('src/sim is pure: no clock, DOM, React, or I/O; Math.random only behind rng()', () => {
  for (const f of walk('src/sim')) {
    const src = code(readFileSync(f, 'utf8'));
    for (const re of FORBIDDEN) assert.ok(!re.test(src), `${f} contains forbidden token ${re}`);
    const hits = src.split('\n').filter((l) => /Math\.random/.test(l));
    if (f === RNG_FILE) assert.deepEqual(hits.map((l) => l.trim()), [RNG_LINE], `${f}: only the rng() source may call Math.random`);
    else assert.equal(hits.length, 0, `${f} calls Math.random; use rng() from src/sim/rng.js`);
  }
});
