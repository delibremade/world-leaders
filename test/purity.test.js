import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// src/sim must be headless and deterministic. Any of these tokens inside it fails the gate.
const FORBIDDEN = [
  /Math\.random/, /Date\.now/, /new Date\(/, /\bdocument\b/, /\bwindow\b/, /localStorage/,
  /from ['"]react/, /require\(['"]react/, /setTimeout|setInterval/, /\bfetch\(/,
];

test('src/sim is pure: no randomness, clock, DOM, React, or I/O', () => {
  const dir = 'src/sim';
  for (const f of readdirSync(dir)) {
    const src = readFileSync(join(dir, f), 'utf8');
    for (const re of FORBIDDEN) assert.ok(!re.test(src), `${dir}/${f} contains forbidden token ${re}`);
  }
});
