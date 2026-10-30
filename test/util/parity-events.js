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
// #18 (E6): the decision pool grows 8 -> 30 and the world-event pool 10 -> 20, all gated on state, so every run's draws change after the
// first decision or world event. The v57 prefix check above is untouched; the five pinned cases are re-baselined citing #18.
// #33 (F2): decisions open only at the quarterly briefing, one at a time, clear of world events, and every card carries a why-now, so the five
// pinned cases are re-baselined citing #33 (each opens a decision inside the 120-month window; the month and the stored card moved).
// #37 (F5): processing plants and GGRB retorting are private capital (margin-driven builds, state levers, sector income). Private plants
// come online by default (US/Japan/Russia enrichment ~month 24), so all five pinned cases are re-baselined citing #37; the v57 prefix is untouched.
// #57 (F9): `bases` likewise (nodes, consent, AI placement; guarded by test/bases.test.js). F9 is an intentional rule change: every nation starts with
// its real bases, so upkeep and basing agreements land on the treasury from month 1 and the AI draws on the rng after the grace period; all five
// pinned cases are re-baselined citing #37 and #57 together (F5 merged first; F9 re-ran the baseline on top of it).
// F9c wires bases into chokepoint control, deployed weight, ISR, flashpoints, pressure and sphere (Bahrain secures Hormuz from month 1), so all five
// are re-baselined again citing #57.
// #55 (F7): the tangible order of battle. Strength is headcounts and every nation starts with its real 2024 fleet, so the Maintenance and
// Depot ledger lines land on the treasury from month 1 and the equipment factor (fleet MC x crews x per-type quality) replaces the global
// quality multiplier in every capability consumer (F9c's theaterWeight reads it through forceMult); all five pinned cases are re-baselined
// citing #55 and #57 together (F9c merged first; F7 re-ran the baseline on top of it; guarded by test/fleet.test.js and test/bases-effects.test.js).
// #56 (F8): Tier 1 / Tier 2 are named units with operator counts; the SOF pay premium is per operator (was per abstract unit), so the
// Personnel line moves from month 1 and all five pinned cases are re-baselined citing #56 (only hashes moved; firstDivergence unchanged;
// guarded by test/sof.test.js).
// FIX 3 (operations list): a standing program's relaunch is stamped with an id and odds (it carried neither, resolved as rng() < NaN and never
// succeeded). The two verb cases toggle a standing program (parity-clicks step 7), so their pinned hashes are re-baselined citing FIX 3; the
// three play cases never relaunch an op and are untouched (guarded by test/intel-ops.test.js).
// FIX 4 (active effects): a renewable build sets one permanent inflation damper per kind (id `ren_<kind>`, `permanent: true`) instead of
// pushing a fresh 999-month row per build. The two verb cases build one renewable (parity-clicks step 4), so their pinned hashes are
// re-baselined citing FIX 4; the three play cases never build one and are untouched (guarded by test/effects.test.js).
// #89 (F15 tenure, host nations): pre-placed bases carry a tenure; leases and treaty/SOFA sites persist through sanctions and a relations collapse.
// Every pinned case sanctions or sours a host in its first months (play seed 1 sanctions Germany in month 1: Ramstein used to close, now it stays),
// so all five are re-baselined citing #89 (guarded by test/hosts.test.js and test/bases.test.js).
// 0.92 UI onboarding: both replay fixtures choose a doctrine before month 1. Previously the App could run
// without one until month 2 (verb cases) or the first blocking event (play cases). Re-pin the five runs for
// the explicit, matched opening choice; simulation formulas and save schema are unchanged.
// 0.94: canonical trained personnel, usable starting fleet, home-theater flashpoint exclusion and queued-event timing
// intentionally change military capability and event draws. Five replay hashes re-pinned; prefix and verb coverage unchanged.
// 0.95: covert gates reject duplicate/invalid orders, standing ops respect infrastructure and SOF availability,
// and defensive sweeps expire without a foreign discovery roll. Re-pin only affected verb replays; assertions stay intact.
// 0.98: service-owned package missions, actual ready inventory and full-cycle standing costs
// intentionally change military projection and charges. Re-pin runs without weakening prefix or verb checks.
const NEW_KEYS = ['arsenal', 'minerals', 'forces', 'bases'];
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
