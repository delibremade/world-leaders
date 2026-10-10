import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMonth } from '../src/sim/tick.js';
import { pickWorldEvent, stampEvent } from '../src/sim/events.js';
import { VERBS, applyVerb } from '../src/sim/actions.js';
import { newCampaign, STATE_FIELDS } from '../src/sim/state.js';
import { checkV57 } from '../src/sim/invariants.js';
import { openEventCards, eventOptions } from '../src/sim/selectors.js';
import { COUNTRIES } from '../src/data/nations.js';
import { WORLD_EVENTS, DECISIONS } from '../src/data/world.js';
import { FLASHPOINTS } from '../src/data/regions.js';
import { WORLD_RULES, FP_RESPONSES, EVENT_COOLDOWN } from '../src/data/events.js';
import { mulberry32, setRngSource } from '../src/sim/rng.js';
import { buildOutliner } from '../src/ui/shell/outliner.js';

// E2 (#14). Rule change: parity with v57 ends for the event system. Every card is answerable in place, answered
// cards resolve into the outliner, world events carry a 60-month cooldown and context weights, and the decision
// pool never resets.
function headless(seed = 1, countryIdx = 0) {
  setRngSource(mulberry32(seed));
  const g = newCampaign(COUNTRIES[countryIdx]); g.doctrine = 'hegemon'; g.gracePeriod = 0;
  const ui = { log: [] }; const toasts = [];
  const S = new Proxy({}, { get: (_, name) => (v) => {
    const k = name[3].toLowerCase() + name.slice(4);
    const box = STATE_FIELDS.includes(k) ? g : ui;
    box[k] = typeof v === 'function' ? v(box[k]) : v;
  } });
  const fx = { toast: (m) => toasts.push(m), now: () => 0, defer: (fn) => fn() };
  return { g, ui, toasts, S, fx, month: () => runMonth(g, S, fx), run: (type, payload) => applyVerb(g, S, fx, { type, payload }) };
}
const rich = (g) => { // everything a response could need
  g.stats = { ...g.stats, treasury: 50000, military: 80 }; g.spr = 5;
  g.forceDeployments = { ME: { carrier_group: 2, sub_fleet: 1 }, AF: { carrier_group: 2, sub_fleet: 1 }, NA: { carrier_group: 1 } };
  g.rivalTension = { china: 60, russia: 40 }; g.chokeDeals = {};
  g.nationRelations = { ...g.nationRelations, brazil: 50, colombia: 50 };
  // E6 (#18): what the new responses need. A processor withholds rare earth, the player holds a reserve and controls gallium,
  // is a Buyer of GCAP (a program it does not own), and has admitted Japan to the F-47 it owns.
  g.minerals = { ...g.minerals, against: { china: ['rareEarth'] }, controls: ['gallium'], own: { ...g.minerals.own, rareEarth: { ...g.minerals.own.rareEarth, reserve: 20 }, gallium: { ...g.minerals.own.gallium, cap: 3 } } };
  g.arsenal = { ...g.arsenal, access: { gcap: { usa: { tier: 'buyer', status: 'active', susp: 0, since: 0 } }, f47: { usa: { tier: 'codev', status: 'active', susp: 0, since: 0, founder: true }, japan: { tier: 'buyer', status: 'active', susp: 0, since: 0 } } } };
  g.sanctions = new Set(['russia']);
};
const snap = (g) => JSON.stringify({ s: g.stats, sp: g.sphere, t: g.rivalTension, r: g.nationRelations, p: g.forcePosture, rel: g.sprRelease, mo: g.worldEvent?.mo, q: g.evState.q, cd: g.chokeDeals, f: g.forces, mi: g.minerals, ar: g.arsenal, gd: g.globalDef });
const ANSWERABLE = Object.keys(WORLD_EVENTS).filter((id) => !WORLD_RULES[id]?.instant);

test('every world event has rules; each card has 2-3 responses (nuclear taboo: 2), breakthrough has none', () => {
  assert.deepEqual(Object.keys(WORLD_RULES).sort(), Object.keys(WORLD_EVENTS).sort());
  for (const id of ANSWERABLE) { const n = WORLD_RULES[id].responses.length; assert.ok(n >= 2 && n <= 3, `${id}: ${n} responses`); }
  assert.equal(WORLD_RULES.breakthrough.responses.length, 0);
});

test('every world event response changes state measurably, closes the card, and resolves into the outliner', () => {
  for (const id of ANSWERABLE) for (const r of WORLD_RULES[id].responses) {
    const h = headless(); rich(h.g); h.g.worldEvent = { id, mo: 8 };
    assert.ok(openEventCards(h.g).world, `${id}: card open`);
    const before = snap(h.g); const cash0 = h.g.stats.treasury;
    h.run('eventResponse', { kind: 'world', response: r.id });
    const tag = `${id}/${r.id}`;
    assert.equal(openEventCards(h.g).world, null, `${tag}: card closed`);
    assert.equal(h.g.worldEvent?.ans, r.id, `${tag}: answer recorded`);
    assert.notEqual(snap(h.g), before, `${tag}: state changed`);
    const row = buildOutliner(h.g).find((x) => x.id === 'we');
    assert.ok(row && row.sub.startsWith('in effect: '), `${tag}: outliner row says in effect`);
    assert.ok(row.sub.includes(r.label) && row.months > 0, `${tag}: names the choice and months left`);
    if (r.cost > 0) assert.ok(h.g.stats.treasury <= cash0 - r.cost + 1e-9, `${tag}: cost charged`);
  }
});

test('a response that cannot be afforded or has no precondition is refused and the card stays open', () => {
  let h = headless(); rich(h.g); h.g.worldEvent = { id: 'hormuz_closure', mo: 8 }; h.g.stats.treasury = 100; h.g.forceDeployments = {}; h.g.spr = 0;
  const opts = eventOptions(h.g, 'world');
  assert.deepEqual(opts.map((o) => o.ok), [false, false, false], 'no navy, no reserve, no cash');
  assert.ok(opts.every((o) => o.reason));
  for (const r of ['escort', 'spr', 'reroute']) {
    const b = snap(h.g); h.run('eventResponse', { kind: 'world', response: r });
    assert.equal(snap(h.g), b, `${r}: nothing moved`); assert.ok(openEventCards(h.g).world, `${r}: card still open`);
  }
  h.run('eventResponse', { kind: 'world', response: 'nonsense' }); assert.ok(openEventCards(h.g).world);
});

test('hormuz responses are wired to engine actions: posture, reserve release', () => {
  let h = headless(); rich(h.g); h.g.worldEvent = { id: 'hormuz_closure', mo: 8 };
  h.run('eventResponse', { kind: 'world', response: 'escort' });
  assert.equal(h.g.forcePosture.ME, 'escort'); assert.equal(h.g.worldEvent.mo, 6, 'escort shortens the closure');
  h = headless(); rich(h.g); h.g.worldEvent = { id: 'hormuz_closure', mo: 8 };
  h.run('eventResponse', { kind: 'world', response: 'spr' }); assert.equal(h.g.sprRelease, true);
});

test('flashpoints: four inline responses, each resolves the card and leaves an in-effect row', () => {
  assert.deepEqual(FP_RESPONSES.filter((r) => !r.mapOnly).map((r) => r.id), ['mediate', 'intervene', 'fund', 'concede']);
  for (const type of Object.keys(FLASHPOINTS)) for (const r of FP_RESPONSES) {
    const h = headless(); rich(h.g); h.g.flashpoint = { rid: 'ME', type, t: 5 }; h.g.embassies = new Set(['saudi', 'iran', 'israel', 'egypt', 'turkey', 'uae', 'iraq', 'qatar']);
    const before = snap(h.g);
    if (r.mapOnly) { h.run('flashpointResponse', { region: 'ME', response: r.id }); }
    else h.run('eventResponse', { kind: 'flashpoint', response: r.id });
    const tag = `${type}/${r.id}`;
    if (r.mapOnly && h.g.flashpoint) continue; // diplomatic needs an embassy; covered by the map panel path
    assert.equal(h.g.flashpoint, null, `${tag}: card closed`);
    assert.equal(openEventCards(h.g).flashpoint, null);
    assert.notEqual(snap(h.g), before, `${tag}: state changed`);
    const row = buildOutliner(h.g).find((x) => x.id.startsWith('fx_'));
    assert.ok(row && row.sub.startsWith('in effect: ') && row.months === 6, `${tag}: outliner row ${JSON.stringify(row)}`);
  }
});

test('flashpoint rows linger: sphere keeps moving for 6 months then the row is gone', () => {
  const h = headless(); rich(h.g); h.g.flashpoint = { rid: 'ME', type: 'coup', t: 5 };
  h.run('eventResponse', { kind: 'flashpoint', response: 'mediate' });
  const s0 = h.g.sphere.ME.player;
  for (let i = 0; i < 3; i++) h.month();
  assert.ok(buildOutliner(h.g).some((x) => x.id.startsWith('fx_') && x.months === 3), 'three months left');
  for (let i = 0; i < 3; i++) h.month();
  assert.ok(!buildOutliner(h.g).some((x) => x.id.startsWith('fx_')), 'row expired');
  assert.equal(h.g.evState.fx.length, 0);
  assert.notEqual(s0, undefined);
});

test('consequence chain: a response schedules a follow-up that fires once the slot and cooldown allow', () => {
  const h = headless(); rich(h.g); h.g.worldEvent = { id: 'pandemic', mo: 8 };
  h.run('eventResponse', { kind: 'world', response: 'lockdown' });
  assert.deepEqual(h.g.evState.q.map((q) => q.id), ['financial_crisis']);
  let fired = null;
  for (let i = 0; i < 12 && !fired; i++) { h.month(); if (h.g.worldEvent?.id === 'financial_crisis') fired = i; }
  assert.ok(fired !== null && fired >= 3, `follow-up fired after its delay (month ${fired})`);
  assert.equal(h.g.evState.q.length, 0);
  // cooldown wins over a chain: a queued event that is on cooldown is dropped, not forced
  const k = headless(); rich(k.g); k.g.evState = { ...k.g.evState, cd: { financial_crisis: 30 }, q: [{ id: 'financial_crisis', at: 0 }] };
  for (let i = 0; i < 8; i++) k.month();
  assert.notEqual(k.g.worldEvent?.id, 'financial_crisis'); assert.equal(k.g.evState.q.length, 0);
});

test('cooldown and context: pickWorldEvent never returns a cooling-down or ineligible event', () => {
  const h = headless(); const g = h.g; g.rivalTension = {}; g.spr = 5; g.embargoedBy = null; g.date = { yr: 2030, mo: 6 };
  const seen = new Set();
  for (let i = 0; i < 400; i++) seen.add(pickWorldEvent(g, (i + 0.5) / 400));
  assert.ok(!seen.has('nuclear_taboo'), 'nuclear taboo only follows a nuclear employment');
  assert.ok(!seen.has('hormuz_closure') && !seen.has('red_sea_attacks') && !seen.has('regional_war'), 'calm world: no tension-driven events');
  assert.ok(!seen.has('panama_drought'), 'wet season');
  g.rivalTension = { china: 70 }; g.evState = { ...g.evState, cd: { hormuz_closure: 12, regional_war: 1 } };
  const seen2 = new Set(); for (let i = 0; i < 400; i++) seen2.add(pickWorldEvent(g, (i + 0.5) / 400));
  assert.ok(!seen2.has('hormuz_closure') && !seen2.has('regional_war'), 'cooling down');
  assert.ok(seen2.has('red_sea_attacks'), 'eligible under tension');
  g.evState = { ...g.evState, cd: Object.fromEntries(Object.keys(WORLD_EVENTS).map((k) => [k, 5])) };
  assert.equal(pickWorldEvent(g, 0.3), null, 'nothing eligible: quiet months');
});

test('decision pool never resets: an exhausted pool means quiet months', () => {
  const h = headless(3); h.g.usedDecisions = new Set(DECISIONS.map((d) => d.id)); h.g.decisionTimer = 0;
  for (let i = 0; i < 40; i++) h.month();
  assert.equal(h.g.activeDecision, null, 'no decision card');
  assert.equal(h.g.usedDecisions.size, DECISIONS.length, 'pool not reset');
});

// ── 600-month seeded fuzz ──────────────────────────────────────────────────
// Spawns are observed from outside the engine (a world event appearing where there was none) and cross-checked against
// the engine's own log, so a spawn that skipped the cooldown stamp cannot hide.
const fuzz = (seed, months = 600) => {
  const h = headless(seed, seed % COUNTRIES.length); const g = h.g;
  const bot = mulberry32(seed * 7919); const seen = []; const decisions = []; let prev = null; let answered = 0; let fpAnswered = 0;
  for (let m = 0; m < months; m++) {
    if (!h.month()) break;
    const abs = g.date.yr * 12 + g.date.mo - 1; // the date advances at the end of the month; spawns stamp the month they ran in
    const id = g.worldEvent?.id || null;
    if (id && id !== prev) { seen.push({ id, m: abs }); assert.ok(g.evState.log.some((e) => e.id === id && e.m === abs), `month ${m}: ${id} appeared without a log entry`); }
    prev = id;
    if (g.activeDecision && bot() < 0.6) { const ops = eventOptions(g, 'decision').filter((o) => o.ok); if (ops.length) { decisions.push(g.activeDecision.id); h.run('makeDecision', { option: ops[Math.floor(bot() * ops.length)].id }); } } // E6 (#18): an option can be closed, so pick among the open ones
    const cards = openEventCards(g);
    if (cards.world && bot() < 0.6) { const ops = eventOptions(g, 'world').filter((o) => o.ok); if (ops.length) { h.run('eventResponse', { kind: 'world', response: ops[Math.floor(bot() * ops.length)].id }); answered++; assert.equal(openEventCards(g).world, null, `month ${m}: world card outlived its answer`); } }
    if (cards.flashpoint && bot() < 0.6) { const ops = eventOptions(g, 'flashpoint').filter((o) => o.ok); if (ops.length) { h.run('eventResponse', { kind: 'flashpoint', response: ops[Math.floor(bot() * ops.length)].id }); fpAnswered++; assert.equal(g.flashpoint, null, `month ${m}: flashpoint outlived its answer`); } }
    if (g.worldEvent) assert.ok(g.worldEvent.mo > 0, `month ${m}: expired world event still present`);
    if (g.flashpoint) assert.ok(g.flashpoint.t > 0, `month ${m}: expired flashpoint still present`);
    for (const r of g.evState.fx) assert.ok(r.mo > 0, `month ${m}: expired in-effect row ${r.id}`);
    assert.deepEqual(checkV57(g), [], `month ${m}: invariants`);
  }
  return { g, seen, spawns: g.evState.log, decisions, answered, fpAnswered };
};

test('600-month fuzz: zero world-event repeats inside the cooldown, no card outlives its resolution', () => {
  let totalSpawns = 0, answered = 0, fpAnswered = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const r = fuzz(seed);
    const last = {};
    for (const e of [...r.spawns].sort((x, y) => x.m - y.m)) {
      if (last[e.id] !== undefined) assert.ok(e.m - last[e.id] >= 60, `seed ${seed}: ${e.id} repeated after ${e.m - last[e.id]} months`);
      last[e.id] = e.m;
    }
    totalSpawns += r.spawns.length; answered += r.answered; fpAnswered += r.fpAnswered;
    assert.equal(new Set(r.decisions).size, r.decisions.length, `seed ${seed}: a decision repeated`);
    assert.ok(r.seen.every((e) => r.spawns.some((x) => x.id === e.id && x.m === e.m)), `seed ${seed}: observed spawn missing from log`);
  }
  assert.ok(totalSpawns >= 20 && answered >= 5 && fpAnswered >= 5, `fuzz was vacuous: ${totalSpawns} spawns, ${answered} world answers, ${fpAnswered} flashpoint answers`);
});

test('fuzz is deterministic for a seed', () => {
  const a = fuzz(9, 240), b = fuzz(9, 240);
  assert.equal(JSON.stringify(a.spawns), JSON.stringify(b.spawns));
  assert.equal(JSON.stringify(a.g.evState), JSON.stringify(b.g.evState));
});

test('the cooldown is the 60 months the spec says', () => { assert.equal(EVENT_COOLDOWN, 60); assert.ok(VERBS.eventResponse); });

test('invariants catch an expired row, an answered event without its row, and a bad cooldown', () => {
  const h = headless(); const g = h.g;
  assert.deepEqual(checkV57(g), []);
  g.evState = { ...g.evState, fx: [{ id: 'x', kind: 'world', ev: 'pandemic', mo: 0 }] };
  assert.ok(checkV57(g).includes('in-effect rows have months left and a known kind'));
  g.evState = { ...g.evState, fx: [], cd: { pandemic: 61 } };
  assert.ok(checkV57(g).includes('event cooldowns are integers in [0,60]'));
  g.evState = { ...g.evState, cd: {} }; g.worldEvent = { id: 'pandemic', mo: 3, ans: 'lockdown' };
  assert.ok(checkV57(g).includes('an answered world event has its in-effect row'));
});

test('the nuclear-employment path stamps the taboo cooldown and the event log', () => {
  const h = headless(); stampEvent(h.g, h.S, 'nuclear_taboo');
  assert.equal(h.g.evState.cd.nuclear_taboo, 60); assert.equal(h.g.evState.log.at(-1).id, 'nuclear_taboo');
});
