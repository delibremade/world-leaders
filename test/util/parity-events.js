// Parity with v57 ends for the event system (issue #14, E2): the new engine draws world events by cooldown and context,
// answers cards in place, and never resets the decision pool, so a run diverges from v57 at its first random event.
// Everything before that is still byte-identical to v57; this helper enforces it and pins the rest to a golden file.
//   1. App autosaves, minus the new `evState` key, must equal v57's up to the first differing save.
//   2. That first differing save must differ in an event-system field (worldEvent, log, flashpoint, decisions), or the App
//      must hold an in-effect row (an answered flashpoint keeps swinging its region's sphere for 6 months).
//   3. From there on, the App's own saves are pinned by hash in test/golden/parity-events.json
//      (UPDATE_GOLDEN=1 npm test rewrites it; review the diff like any other behavior change).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const GOLDEN = new URL('../golden/parity-events.json', import.meta.url);
// #23 (E9): issues spawn on a cadence now, so the first spawn changes issues/log/actionCooldowns (issue_next) before any event.
const EVENT_FIELDS = ['worldEvent', 'log', 'flashpoint', 'usedDecisions', 'activeDecision', 'decisionTimer', 'demand', 'issues', 'briefs', 'investigations', 'actionCooldowns'];
// #15 (E3): `arsenal` is a new save key with no v57 counterpart; it is dropped before comparing and hashing, so a run that
// never touches a nation catalog keeps its v57 prefix and its pinned hashes. Catalog behavior is guarded by test/catalogs.test.js.
// #16 (E4): `minerals` likewise; a run whose tranches never wait on minerals keeps its pinned hashes (test/minerals.test.js guards the chain).
// #20 (E8): `forces` likewise (manpower, quality, training, crews, SOF; guarded by test/forces.test.js). E8 is an intentional rule change:
// capability multiplies deployed military power and crews gate stationing, so the cases it touches are re-baselined citing #20.
const NEW_KEYS = ['arsenal', 'minerals', 'forces'];
const dropNew = (s) => { if (!NEW_KEYS.some((k) => s.includes(`"${k}"`))) return s; const o = JSON.parse(s); for (const k of NEW_KEYS) delete o[k]; return JSON.stringify(o); };
const strip = (s) => { const o = JSON.parse(dropNew(s)); delete o.evState; return JSON.stringify(o); };
const hash = (s) => createHash('sha256').update(dropNew(s)).digest('hex').slice(0, 16);

export function assertEventParity(key, legacy, app) {
  assert.equal(app.months, legacy.months, 'months advanced');
  assert.equal(app.saves.length, legacy.saves.length, 'save count');
  let i = 0;
  while (i < legacy.saves.length && strip(app.saves[i]) === legacy.saves[i]) i++;
  if (i < legacy.saves.length) {
    const x = JSON.parse(legacy.saves[i]), y = JSON.parse(strip(app.saves[i]));
    const diff = Object.keys({ ...x, ...y }).filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k]));
    const rows = JSON.parse(app.saves[i]).evState?.fx?.length > 0; // an answered flashpoint lingers on the sphere
    assert.ok(rows || diff.some((k) => EVENT_FIELDS.includes(k)), `save #${i} (${x.date.mo + 1}/${x.date.yr}) diverges from v57 without an event-system field: ${diff.join(', ')}`);
  }
  const pinned = { firstDivergence: i, of: legacy.saves.length, hashes: app.saves.slice(i).map(hash) };
  const gold = existsSync(GOLDEN) ? JSON.parse(readFileSync(GOLDEN, 'utf8')) : {};
  if (process.env.UPDATE_GOLDEN) { gold[key] = pinned; writeFileSync(GOLDEN, JSON.stringify(gold, null, 1) + '\n'); return; }
  assert.ok(gold[key], `no golden for ${key}: run UPDATE_GOLDEN=1 npm test and review test/golden/parity-events.json`);
  assert.deepEqual(pinned, gold[key], `${key}: App saves drifted from the pinned event-system baseline`);
}
