import { test } from 'node:test';
import { existsSync } from 'node:fs';

// Parity gate for the engine extraction (task 001).
// Protocol: legacy/adapter.js mounts legacy/world-leaders-v57.jsx in jsdom with Math.random replaced by the
// seeded rng, drives it through the __wl test hook with a fixed action script, and emits a normalized state
// snapshot per month. The new engine runs the same seed + script. Per-month hashes must match for >= 5 seeds
// over 120 months. Any divergence must be listed in reports/parity-v57.md with a one-line justification.
const ADAPTER = 'legacy/adapter.js';

test('v57 parity (enabled once legacy/adapter.js exists)', { skip: !existsSync(ADAPTER) && 'legacy/adapter.js not present yet (task 001)' }, async () => {
  const { compare } = await import('../' + ADAPTER);
  await compare({ seeds: [1, 2, 3, 4, 5], months: 120 });
});
