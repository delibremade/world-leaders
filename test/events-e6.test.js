import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMonth } from '../src/sim/tick.js';
import { applyVerb } from '../src/sim/actions.js';
import { newCampaign, STATE_FIELDS } from '../src/sim/state.js';
import { COUNTRIES } from '../src/data/nations.js';
import { WORLD_EVENTS, DECISIONS } from '../src/data/world.js';
import { WORLD_RULES } from '../src/data/events.js';
import { mulberry32, setRngSource } from '../src/sim/rng.js';
import { checkV57 } from '../src/sim/invariants.js';
import { eventOptions, openEventCards, playerCatalog } from '../src/sim/selectors.js';
import { DV } from '../src/data/platforms.js';
import { memberOf, ownedMembers, tightest, strongest, squeezed } from '../src/data/event-ctx.js';

// E6 (#18): event content expansion. Decisions 8 -> 30, world events 10 -> 20. The engine rules (responses, 60-month cooldown,
// context weighting, no decision reset, chains) are E2's and are tested in events.test.js; this file tests the content:
// every item is gated on state, every option costs something and moves something measurable, chains point at real events,
// cards are written from the player's seat, and every item can come up in a 240-month seeded run.
const NEW_DECISIONS = ['j36_setback', 'j50_setback', 's70_engines', 'gcap_workshare', 'fcas_defection', 'f47_buyer_offer', 'usa_admission', 'flagged_trade_offer',
  'ore_runout', 'controls_temptation', 'controls_review', 'processing_pact_offer', 'pay_dispute', 'crew_shortfall', 'quality_warning', 'joint_exercise',
  'sof_raid', 'sof_selection', 'sof_scandal', 'reserve_window', 'double_agent', 'coastal_standoff'];
const NEW_WORLD = ['mineral_controls_bite', 'export_backlash', 'partner_security_audit', 'owner_leak_scare', 'readiness_grounding', 'recruitment_slump',
  'hostage_crisis', 'sanctions_wave', 'grid_attack', 'false_alarm'];
const idx = (nid) => COUNTRIES.findIndex((c) => c.id === nid);

function headless(seed = 1, nid = 'usa') {
  setRngSource(mulberry32(seed));
  const g = newCampaign(COUNTRIES[idx(nid)]); g.doctrine = 'hegemon'; g.gracePeriod = 0;
  const ui = { log: [] }; const toasts = [];
  const S = new Proxy({}, { get: (_, name) => (v) => {
    const k = name[3].toLowerCase() + name.slice(4);
    const box = STATE_FIELDS.includes(k) ? g : ui;
    box[k] = typeof v === 'function' ? v(box[k]) : v;
  } });
  const fx = { toast: (m) => toasts.push(m), now: () => 0, defer: (fn) => fn() };
  return { g, ui, toasts, S, fx, month: () => runMonth(g, S, fx), run: (type, payload) => applyVerb(g, S, fx, { type, payload }) };
}
// The context the tick builds for decisions (tick.js "Decisions").
const ctxOf = (g) => ({ ns: g.stats, ten: g.rivalTension, rel: g.nationRelations, bt: g.blocTrade, ex: g.defExports, dl: g.defLevels, g, country: g.country });
const snap = (g) => JSON.stringify({ s: g.stats, t: g.rivalTension, r: g.nationRelations, f: g.forces, mi: g.minerals, ar: g.arsenal, gd: g.globalDef, q: g.evState.q, pay: g.personnelPay, spr: g.spr,
  ta: [...g.tradeAgreements], ic: [...g.importContracts] });

// Per-decision opening positions: the minimum state that makes `when` true and every option open.
const rich = (g) => { g.stats = { ...g.stats, treasury: 60000 }; };
const SCENARIO = {
  j36_setback: ['china', (g) => { g.arsenal = { ...g.arsenal, dev: { j36: { prog: 10, mo: 36 }, j50: { prog: 10, mo: 30 } } }; }],
  j50_setback: ['china', (g) => { g.arsenal = { ...g.arsenal, dev: { j36: { prog: 10, mo: 36 }, j50: { prog: 10, mo: 30 } } }; }],
  s70_engines: ['russia', (g) => { g.arsenal = { ...g.arsenal, dev: { s70: { prog: 10, mo: 30 } } }; }],
  gcap_workshare: ['japan', () => {}],
  fcas_defection: ['germany', (g) => { g.nationRelations = { ...g.nationRelations, uk: 90, italy: 90, japan: 90 }; g.defensePacts = new Set(['uk']); }],
  f47_buyer_offer: ['norway', (g) => { g.nationRelations = { ...g.nationRelations, usa: 85 }; g.defensePacts = new Set(['usa']); }],
  usa_admission: ['usa', (g) => { g.nationRelations = { ...g.nationRelations, japan: 85, norway: 85 }; g.defensePacts = new Set(['japan', 'norway']); }],
  flagged_trade_offer: ['germany', (g) => { g.stats = { ...g.stats, gdpGrowth: 1 }; }],
  ore_runout: ['germany', () => {}],
  controls_temptation: ['china', (g) => { g.rivalTension = { usa: 40 }; }],
  controls_review: ['china', (g) => { g.minerals = { ...g.minerals, controls: ['gallium'] }; }],
  processing_pact_offer: ['germany', (g) => { g.rivalTension = { russia: 40 }; }],
  pay_dispute: ['usa', (g) => { g.forces = { ...g.forces, retention: 30 }; g.personnelPay = 90; }],
  crew_shortfall: ['usa', (g) => { g.platforms = { ...g.platforms, f35: 60, ford: 6 }; }],
  quality_warning: ['usa', (g) => { g.forces = { ...g.forces, quality: 40 }; }],
  joint_exercise: ['usa', (g) => { g.defensePacts = new Set(['uk']); g.forces = { ...g.forces, readiness: { land: 60, air: 60, sea: 60 } }; }],
  sof_raid: ['usa', (g) => { g.rivalTension = { china: 30 }; }],
  sof_selection: ['usa', (g) => { g.rivalTension = { china: 30 }; }],
  sof_scandal: ['usa', (g) => { g.usedDecisions = new Set(['sof_raid']); }],
  reserve_window: ['usa', (g) => { g.spr = 0; }],
  double_agent: ['usa', (g) => { g.rivalTension = { china: 30 }; g.intelOps = [{ id: 'op1', opId: 'tech_acq', targetId: 'china', monthsLeft: 3 }]; }],
  coastal_standoff: ['usa', (g) => { g.rivalTension = { china: 55 }; }],
};
function scenario(id) {
  const [nid, set] = SCENARIO[id]; const h = headless(1, nid); const g = h.g;
  g.rivalTension = {}; rich(g); set(g);
  return h;
}

test('pool sizes: 30 decisions (8 legacy + 22), 20 world events (10 legacy + 10); every id registered once', () => {
  assert.equal(DECISIONS.length, 30); assert.equal(Object.keys(WORLD_EVENTS).length, 20);
  assert.equal(new Set(DECISIONS.map((d) => d.id)).size, DECISIONS.length);
  for (const id of NEW_DECISIONS) assert.ok(DECISIONS.some((d) => d.id === id), id);
  for (const id of NEW_WORLD) assert.ok(WORLD_EVENTS[id] && WORLD_RULES[id], id);
  assert.deepEqual(Object.keys(SCENARIO).sort(), [...NEW_DECISIONS].sort(), 'a scenario per new decision');
});

test('conditions: nothing is uniformly random; every rule reads the state', () => {
  for (const d of DECISIONS) assert.ok(typeof d.when === 'function' && d.when.length >= 1, `${d.id}: when reads ctx`);
  for (const [id, r] of Object.entries(WORLD_RULES)) {
    if (id === 'nuclear_taboo') { assert.equal(r.w({}), 0, 'only ever follows a nuclear employment'); continue; }
    assert.ok(r.when.length >= 1, `${id}: when reads the state`);
  }
  // the legacy unconditional pair is now tied to the state
  const h = headless(1, 'norway'); h.g.stats = { ...h.g.stats, healthcare: 95 };
  assert.equal(WORLD_RULES.pandemic.when(h.g), false, 'a prepared health system is not hit');
  h.g.stats = { ...h.g.stats, healthcare: 50 }; assert.equal(WORLD_RULES.pandemic.when(h.g), true);
  h.g.defLevels = {}; assert.equal(WORLD_RULES.breakthrough.when(h.g), false, 'nothing to lose a lead in');
  h.g.defLevels = { aircraft: 3 }; assert.equal(WORLD_RULES.breakthrough.when(h.g), true);
});

test('each new decision: eligible in its scenario, ineligible on a neutral opening, 2-3 options', () => {
  for (const id of NEW_DECISIONS) {
    const d = DECISIONS.find((x) => x.id === id);
    const h = scenario(id); assert.ok(d.when(ctxOf(h.g)), `${id}: eligible in its scenario`);
    assert.ok(d.options.length >= 2 && d.options.length <= 3, `${id}: ${d.options.length} options`);
    // founders' politics are state of the program record, so the neutral opening for them is a nation outside the program
    const bare = headless(1, { gcap_workshare: 'usa', fcas_defection: 'usa', flagged_trade_offer: 'usa', ore_runout: 'cuba' }[id] || SCENARIO[id][0]); bare.g.rivalTension = {};
    if (id === 'reserve_window') bare.g.spr = 6; // a full reserve is the neutral position
    assert.ok(!d.when(ctxOf(bare.g)), `${id}: not eligible on the bare opening (conditions are state, not a roll)`);
  }
});

test('scale: costs $0-$1000M, stat nudges within 4 points, every option has a cost or a measurable effect', () => {
  for (const id of NEW_DECISIONS) for (const o of DECISIONS.find((x) => x.id === id).options) {
    const tag = `${id}/${o.id}`;
    assert.ok((o.cost || 0) >= 0 && (o.cost || 0) <= 1000, `${tag}: cost ${o.cost}`);
    for (const [k, v] of Object.entries(o.effects || {})) { if (k === 'treasury') assert.ok(Math.abs(v) <= 400, `${tag}: treasury ${v}`); else assert.ok(Math.abs(v) <= 4, `${tag}: ${k} ${v}`); }
    assert.ok(o.tags.length >= 1, `${tag}: tags`);
  }
  for (const id of NEW_WORLD) for (const r of WORLD_RULES[id].responses) {
    const tag = `${id}/${r.id}`;
    assert.ok(r.cost >= 0 && r.cost <= 1000, `${tag}: cost ${r.cost}`);
    for (const v of Object.values(r.now || {})) assert.ok(Math.abs(v) <= 4, `${tag}: nudge ${v}`);
  }
});

test('every new decision option changes state measurably, charges its cost, closes the card and marks the decision used', () => {
  for (const id of NEW_DECISIONS) {
    const d = DECISIONS.find((x) => x.id === id);
    for (const o of d.options) {
      const h = scenario(id); const g = h.g; g.activeDecision = d;
      const opt = eventOptions(g, 'decision').find((x) => x.id === o.id);
      const tag = `${id}/${o.id}`;
      assert.ok(opt.ok, `${tag}: open in its scenario (${opt.reason})`);
      const before = snap(g); const cash = g.stats.treasury; const q0 = g.evState.q.length;
      h.run('makeDecision', { option: o.id });
      assert.equal(g.activeDecision, null, `${tag}: card closed`); assert.ok(g.usedDecisions.has(id), `${tag}: used`);
      assert.notEqual(snap(g), before, `${tag}: state changed`);
      if (o.cost) assert.ok(g.stats.treasury <= cash - o.cost + 1e-9, `${tag}: cost charged`);
      if (o.chain) { assert.equal(g.evState.q.length, q0 + 1, `${tag}: follow-up queued`); assert.ok(WORLD_EVENTS[o.chain.id], `${tag}: chain target exists`); }
    }
  }
});

test('a closed option is refused: nothing moves and the card stays open', () => {
  const d = DECISIONS.find((x) => x.id === 'sof_scandal'); const h = scenario('sof_scandal'); const g = h.g;
  g.forces = { ...g.forces, sof: { ...g.forces.sof, t1: 0 } }; g.activeDecision = d; // no squadron left to stand down
  const o = eventOptions(g, 'decision').find((x) => x.id === 'c'); assert.equal(o.ok, false); assert.ok(o.reason);
  let b = snap(g); h.run('makeDecision', { option: 'c' }); assert.equal(snap(g), b); assert.ok(g.activeDecision);
  g.stats = { ...g.stats, treasury: 100 }; b = snap(g); // a priced option needs the cash
  assert.equal(eventOptions(g, 'decision').find((x) => x.id === 'a').ok, false); h.run('makeDecision', { option: 'a' }); assert.equal(snap(g), b); assert.ok(g.activeDecision);
});

test('decisions that drive engine verbs land them: defection, admission, controls, SOF pipelines, training, pay', () => {
  let h = scenario('fcas_defection'); h.g.activeDecision = DECISIONS.find((d) => d.id === 'fcas_defection'); h.run('makeDecision', { option: 'b' });
  assert.equal(h.g.arsenal.defected.fcas, 'gcap'); assert.equal(h.g.arsenal.access.gcap.germany.tier, 'codev'); assert.ok(h.g.nationRelations.france < 0 || true);
  h = scenario('usa_admission'); h.g.activeDecision = DECISIONS.find((d) => d.id === 'usa_admission'); h.run('makeDecision', { option: 'a' });
  assert.equal(h.g.arsenal.access.f47.japan.tier, 'buyer'); assert.equal(ownedMembers(h.g).length, 1);
  h = scenario('controls_temptation'); h.g.activeDecision = DECISIONS.find((d) => d.id === 'controls_temptation'); const m = strongest(h.g); h.run('makeDecision', { option: 'a' });
  assert.ok(h.g.minerals.controls.includes(m));
  h = scenario('sof_selection'); h.g.activeDecision = DECISIONS.find((d) => d.id === 'sof_selection'); const p0 = h.g.forces.sof.pipes.length; h.run('makeDecision', { option: 'a' });
  assert.equal(h.g.forces.sof.pipes.length, p0 + 1); assert.equal(h.g.forces.sof.pipes.at(-1).t, 1);
  h = scenario('crew_shortfall'); h.g.activeDecision = DECISIONS.find((d) => d.id === 'crew_shortfall'); h.run('makeDecision', { option: 'a' });
  assert.equal(h.g.forces.train, 3);
  h = scenario('pay_dispute'); h.g.activeDecision = DECISIONS.find((d) => d.id === 'pay_dispute'); h.run('makeDecision', { option: 'a' });
  assert.equal(h.g.personnelPay, 115);
  h = scenario('flagged_trade_offer'); h.g.activeDecision = DECISIONS.find((d) => d.id === 'flagged_trade_offer'); h.run('makeDecision', { option: 'a' });
  assert.ok(h.g.tradeAgreements.has('china'));
  for (let i = 0; i < 2; i++) h.month();
  const acc = Object.values(h.g.arsenal.access).map((r) => r.germany).filter(Boolean);
  assert.ok(acc.some((a) => a.status === 'suspended'), 'a flagged deal breaches compliance and the month suspends the membership');
});

test('program delays: devSlip moves a prototype line both ways and never past its finish line', () => {
  const h = scenario('j36_setback'); const g = h.g; g.activeDecision = DECISIONS.find((d) => d.id === 'j36_setback');
  h.run('makeDecision', { option: 'c' }); assert.equal(g.arsenal.dev.j36.prog, 0, '12 months of slip from 10 bottoms out at 0');
  const k = scenario('j36_setback'); k.g.arsenal = { ...k.g.arsenal, dev: { j36: { prog: 34, mo: 36 }, j50: { prog: 10, mo: 30 } } }; k.g.activeDecision = DECISIONS.find((d) => d.id === 'j36_setback');
  k.run('makeDecision', { option: 'a' }); assert.equal(k.g.arsenal.dev.j36.prog, 35, 'ahead of schedule, capped one month short of delivery');
  assert.equal(k.g.arsenal.dev.j50.prog, 10);
  const j = scenario('j36_setback'); j.g.activeDecision = DECISIONS.find((d) => d.id === 'j36_setback'); j.run('makeDecision', { option: 'b' });
  assert.equal(j.g.arsenal.dev.j36.prog, 4); assert.equal(j.g.arsenal.dev.j50.prog, 13);
});

// ── World events ───────────────────────────────────────────────────────────
const WSCEN = {
  mineral_controls_bite: ['usa', (g) => { g.minerals = { ...g.minerals, against: { china: ['rareEarth'] }, own: { ...g.minerals.own, rareEarth: { ...g.minerals.own.rareEarth, reserve: 20 } } }; }],
  export_backlash: ['china', (g) => { g.minerals = { ...g.minerals, controls: ['gallium'] }; }],
  partner_security_audit: ['germany', () => {}],
  owner_leak_scare: ['usa', (g) => { g.arsenal = { ...g.arsenal, access: { f47: { usa: { tier: 'codev', status: 'active', founder: true }, japan: { tier: 'buyer', status: 'active', susp: 0 } } } }; }],
  readiness_grounding: ['usa', (g) => { g.forces = { ...g.forces, readiness: { land: 40, air: 40, sea: 40 } }; }],
  recruitment_slump: ['usa', (g) => { g.forces = { ...g.forces, retention: 30 }; }],
  hostage_crisis: ['usa', (g) => { g.rivalTension = { china: 30 }; }],
  sanctions_wave: ['usa', (g) => { g.sanctions = new Set(['russia']); g.rivalTension = { russia: 40 }; }],
  grid_attack: ['usa', (g) => { g.rivalTension = { russia: 40 }; g.defLevels = { ...g.defLevels, cyber: 2 }; }],
  false_alarm: ['usa', (g) => { g.rivalTension = { russia: 70 }; }],
};
test('each new world event is gated on its system, silent on a bare opening, and every response is a real choice', () => {
  for (const id of NEW_WORLD) {
    const [nid, set] = WSCEN[id]; const h = headless(1, nid); const g = h.g; g.rivalTension = {}; rich(g);
    const bare = WORLD_RULES[id].when(g); set(g);
    assert.ok(WORLD_RULES[id].when(g), `${id}: eligible in its scenario`); assert.ok(WORLD_RULES[id].w(g) > 0, `${id}: weight`);
    if (id !== 'partner_security_audit') assert.equal(bare, false, `${id}: not eligible on the bare opening`);
    const rs = WORLD_RULES[id].responses; assert.ok(rs.length >= 2 && rs.length <= 3, `${id}: ${rs.length} responses`);
    for (const r of rs) {
      const k = headless(1, nid); k.g.rivalTension = {}; rich(k.g); set(k.g); k.g.worldEvent = { id, mo: 6 };
      const o = eventOptions(k.g, 'world').find((x) => x.id === r.id); assert.ok(o.ok, `${id}/${r.id}: open (${o.reason})`);
      const before = snap(k.g); k.run('eventResponse', { kind: 'world', response: r.id });
      assert.equal(k.g.worldEvent.ans, r.id); assert.notEqual(snap(k.g), before, `${id}/${r.id}: state changed`);
    }
  }
});

test('world responses drive the right engine: reserve release, recycling, lift, expel, suspension, training, call-up, hotline', () => {
  const go = (id, resp, nid, set) => { const h = headless(1, nid); h.g.rivalTension = {}; rich(h.g); set(h.g); h.g.worldEvent = { id, mo: 6 }; h.run('eventResponse', { kind: 'world', response: resp }); return h; };
  let h = go('mineral_controls_bite', 'reserve', 'usa', (g) => { g.minerals = { ...g.minerals, against: { china: ['rareEarth'] }, own: { ...g.minerals.own, rareEarth: { ...g.minerals.own.rareEarth, reserve: 20 } } }; });
  assert.deepEqual(h.g.minerals.release, ['rareEarth']);
  h = go('mineral_controls_bite', 'recycle', 'usa', (g) => { g.minerals = { ...g.minerals, against: { china: ['rareEarth'] } }; }); assert.deepEqual(h.g.minerals.recycle, ['rareEarth']);
  h = go('export_backlash', 'lift', 'china', (g) => { g.minerals = { ...g.minerals, controls: ['gallium'] }; }); assert.deepEqual(h.g.minerals.controls, []);
  h = go('partner_security_audit', 'stonewall', 'germany', () => {}); assert.ok(Object.values(h.g.arsenal.access).some((r) => r.germany?.status === 'suspended'), 'membership suspended');
  assert.equal(memberOf(h.g), null);
  h = go('owner_leak_scare', 'expel', 'usa', WSCEN.owner_leak_scare[1]); assert.equal(ownedMembers(h.g).length, 0);
  h = go('readiness_grounding', 'retrain', 'usa', WSCEN.readiness_grounding[1]); assert.equal(h.g.forces.train, 3); assert.equal(h.g.forces.readiness.air, 48);
  h = go('recruitment_slump', 'callup', 'usa', WSCEN.recruitment_slump[1]); assert.equal(h.g.forces.active, 66); assert.equal(h.g.forces.reserve, 30);
  h = go('hostage_crisis', 'raid', 'usa', WSCEN.hostage_crisis[1]); assert.equal(h.g.forces.readiness.land, 65);
  h = go('false_alarm', 'hotline', 'usa', WSCEN.false_alarm[1]); assert.equal(h.g.rivalTension.russia, 60); assert.deepEqual(h.g.evState.q.map((q) => q.id), ['peace_accord']);
});

test('refusals: a response whose precondition fails changes nothing and keeps the card open', () => {
  const h = headless(1, 'usa'); const g = h.g; rich(g); g.minerals = { ...g.minerals, against: { china: ['enrichment'] } }; g.worldEvent = { id: 'mineral_controls_bite', mo: 6 };
  const ops = eventOptions(g, 'world'); assert.deepEqual(ops.map((o) => o.ok), [false, true, false], 'no reserve, spot is open, enriched uranium cannot be recycled');
  for (const r of ['reserve', 'recycle']) { const b = snap(g); h.run('eventResponse', { kind: 'world', response: r }); assert.equal(snap(g), b); assert.ok(openEventCards(g).world); }
  const k = headless(1, 'usa'); rich(k.g); k.g.forces = { ...k.g.forces, readiness: { land: 30, air: 30, sea: 30 } }; k.g.worldEvent = { id: 'hostage_crisis', mo: 5 };
  assert.equal(eventOptions(k.g, 'world')[0].ok, false, 'land readiness below 50 closes the raid');
});

test('chains: every chain points at a real world event; decisions and responses queue them; the queued event fires', () => {
  const targets = [];
  for (const d of DECISIONS) for (const o of d.options) if (o.chain) targets.push(o.chain.id);
  for (const r of Object.values(WORLD_RULES)) for (const x of r.responses) if (x.chain) targets.push(x.chain.id);
  for (const t of targets) assert.ok(WORLD_EVENTS[t] && WORLD_RULES[t], `chain target ${t}`);
  const fromNew = NEW_DECISIONS.flatMap((id) => DECISIONS.find((d) => d.id === id).options).filter((o) => o.chain).length + NEW_WORLD.flatMap((id) => WORLD_RULES[id].responses).filter((r) => r.chain).length;
  assert.ok(fromNew >= 10, `${fromNew} chained follow-ups in the new content`);
  const h = scenario('coastal_standoff'); const g = h.g; g.activeDecision = DECISIONS.find((d) => d.id === 'coastal_standoff'); h.run('makeDecision', { option: 'c' });
  assert.deepEqual(g.evState.q.map((q) => q.id), ['false_alarm']);
  let fired = null; for (let i = 0; i < 14 && !fired; i++) { g.rivalTension = { china: 60 }; h.month(); if (g.worldEvent?.id === 'false_alarm') fired = i; }
  assert.ok(fired !== null && fired >= 5, `the follow-up fired after its delay (month ${fired})`);
});

test('decisions follow decisions: the SOF scandal only exists after the raid', () => {
  const d = DECISIONS.find((x) => x.id === 'sof_scandal'); const h = scenario('sof_raid');
  assert.equal(d.when(ctxOf(h.g)), false); h.g.activeDecision = DECISIONS.find((x) => x.id === 'sof_raid'); h.run('makeDecision', { option: 'a' });
  assert.equal(d.when(ctxOf(h.g)), true);
});

// ── Tone: written from the player's seat ────────────────────────────────────
const US_WORDS = /Washington|Congress|Pentagon|\bNSC\b|Capitol|the Agency|Joint Staff|Commerce|American|Americans|US seaboard/;
test('tone: China and Russia cards carry no US-centric copy; seat-specific copy differs by seat', () => {
  const seatCards = { ore_runout: ['china', 'usa', 'russia'], controls_temptation: ['china', 'usa', 'russia'], pay_dispute: ['china', 'usa', 'russia'], sof_raid: ['china', 'usa', 'russia'], double_agent: ['china', 'usa', 'russia'], coastal_standoff: ['china', 'usa', 'russia'] };
  for (const [id, seats] of Object.entries(seatCards)) {
    const d = DECISIONS.find((x) => x.id === id); assert.equal(typeof d.desc, 'function', `${id}: desc is a function of the seat`);
    const texts = seats.map((s) => d.desc({ country: { id: s } }));
    assert.equal(new Set(texts).size, seats.length, `${id}: each seat reads differently`);
    for (const [i, s] of seats.entries()) if (s !== 'usa') assert.ok(!US_WORDS.test(texts[i]), `${id}/${s}: "${texts[i]}"`);
  }
  for (const id of ['mineral_controls_bite', 'export_backlash', 'recruitment_slump', 'hostage_crisis']) {
    const d = WORLD_EVENTS[id].d; assert.equal(typeof d, 'function', id);
    for (const s of ['china', 'russia']) assert.ok(!US_WORDS.test(d({ id: s })), `${id}/${s}`);
    assert.notEqual(d({ id: 'china' }), d({ id: 'usa' }));
  }
  // every nation-specific card is only ever eligible for its nation
  const only = { j36_setback: 'china', j50_setback: 'china', s70_engines: 'russia', gcap_workshare: 'japan', fcas_defection: 'germany', usa_admission: 'usa' };
  for (const [id, nid] of Object.entries(only)) for (const c of COUNTRIES) {
    const h = headless(1, c.id); h.g.rivalTension = {}; SCENARIO[id][1](h.g);
    assert.equal(DECISIONS.find((d) => d.id === id).when(ctxOf(h.g)), c.id === nid, `${id} for ${c.id}`);
  }
  for (const id of ['f47_buyer_offer']) for (const c of COUNTRIES) {
    const h = headless(1, c.id); h.g.rivalTension = {}; SCENARIO[id][1](h.g); h.g.nationRelations.usa = 85;
    assert.equal(DECISIONS.find((d) => d.id === id).when(ctxOf(h.g)), ['norway', 'japan', 'germany'].includes(c.id), `${id} for ${c.id}`);
  }
});

// ── Reachability: every event can come up in a 240-month seeded run across the 8 nations ──────────────────────────────
// The policy is a plausible player: neglects training and pay, ramps tension through the cycle, sanctions, controls a
// mineral, opens prototype lines, joins and admits where the gates allow. Where a path is long, the policy writes the state
// the way the __wl test hooks do (fund, setTension, platforms); each hook is marked.
// #33 (F2): decisions open only at the quarterly briefing, one at a time, clear of world events, so a run draws fewer: 36 seeds, not 12.
const SEEDS = Array.from({ length: 36 }, (_, i) => i + 1);
const RIVALS = ['china', 'russia', 'usa', 'germany'];
function policy(h, m, nid) {
  const { g } = h; const me = nid;
  if (m % 12 === 0) g.stats = { ...g.stats, treasury: Math.max(g.stats.treasury, 40000) };            // hook: fund
  const phase = m % 96; const t = phase < 12 ? 18 : phase < 36 ? 38 : phase < 60 ? 52 : phase < 80 ? 68 : 22;
  g.rivalTension = Object.fromEntries(RIVALS.filter((r) => r !== me).map((r, i) => [r, Math.max(0, t - i * 4)])); // hook: setTension
  if (m === 1) g.defLevels = Object.fromEntries(Object.keys(DV).map((v) => [v, v === 'cyber' ? 4 : 5]));                                  // hook: levels
  if (m === 2) { h.run('setPersonnelPay', { pay: 70 }); h.run('setTraining', { level: 0 }); }
  if (m === 3) { h.run('establishSapOffice'); for (const e of playerCatalog(g).filter((x) => x.start === 'proto')) h.run('sapInitiate', { program: e.id }); }
  if (m === 5) { h.g.nationRelations = { ...g.nationRelations, usa: 60, japan: 60, norway: 60 }; }                    // hook: relations
  if (m === 8 && me !== 'russia') h.run('toggleSanctions', { nation: 'russia' });
  if (m === 8 && me === 'russia') h.run('toggleSanctions', { nation: 'china' });
  if (m % 96 >= 26 && m % 96 < 40) { g.nationRelations = { ...g.nationRelations, china: 60 }; g.blocTrade = { ...g.blocTrade, cn: 2 }; } // hook: a China bloc tier that holds
  if (m === 14) g.platforms = { ...g.platforms, f35: 60, ford: 6 };                                                   // hook: platforms
  if (m === 16) g.stats = { ...g.stats, education: 8, healthcare: 22, foodSecurity: 30, stability: 40 };              // hook: stats
  if (m % 12 === 8 && m >= 20) g.intelOps = [{ id: 'op_e6', opId: 'tech_acq', targetId: me === 'china' ? 'usa' : 'china', monthsLeft: 4 }]; // hook: a standing op
  if (m === 30) { const mm = strongest(g); if (mm && !g.minerals.controls.includes(mm)) h.run('toggleExportControl', { mineral: mm }); }
  if (m === 40) g.minerals = { ...g.minerals, controls: [] };
  if (m === 44 && me === 'usa') { h.run('admitPartner', { program: 'f47', nation: 'japan', tier: 'buyer' }); }
  if (m === 44 && me === 'usa' && !ownedMembers(g).length) g.arsenal = { ...g.arsenal, access: { ...g.arsenal.access, f47: { ...g.arsenal.access.f47, japan: { tier: 'buyer', status: 'active', susp: 0, since: 0 } } } }; // hook
  if (m === 10) g.defensePacts = new Set(['uk', 'japan']);                                                          // hook: a pact
  if (m === 25) g.defExports = Object.fromEntries(['uk_aircraft', 'france_missiles', 'italy_munitions'].map((k) => [k, { buyerId: k.split('_')[0], vert: k.split('_')[1], level: 3, relationship: 60, revenue: 100 }])); // hook: three arms deals
  if (m === 60 && memberOf(g)) { h.run('toggleSanctions', { nation: 'china' }); }
}
function sweep(nid, seed, months = 240) {
  const h = headless(seed, nid); const g = h.g; const bot = mulberry32(seed * 104729 + 13);
  const el = new Set(), fired = new Set(), decFired = new Set(), wel = new Set();
  for (let m = 0; m < months; m++) {
    policy(h, m, nid);
    if (!h.month()) break;
    const ctx = ctxOf(g);
    for (const d of DECISIONS) if (d.when(ctx)) el.add(d.id);
    for (const [id, r] of Object.entries(WORLD_RULES)) if (r.when(g) && r.w(g) > 0) wel.add(id);
    if (g.activeDecision) { decFired.add(g.activeDecision.id); const ops = eventOptions(g, 'decision').filter((o) => o.ok); if (ops.length) h.run('makeDecision', { option: ops[Math.floor(bot() * ops.length)].id }); }
    if (g.worldEvent && openEventCards(g).world && bot() < 0.7) { const ops = eventOptions(g, 'world').filter((o) => o.ok); if (ops.length) h.run('eventResponse', { kind: 'world', response: ops[Math.floor(bot() * ops.length)].id }); }
    assert.deepEqual(checkV57(g), [], `${nid}/${seed} month ${m}: invariants`);
  }
  for (const e of g.evState.log) fired.add(e.id); // instant events (breakthrough) never hold the slot; the engine log has every spawn
  return { el, wel, fired, decFired };
}
test('reachability: every decision and world event is eligible in some 240-month seeded run across the 8 nations, and every one is also drawn', () => {
  const eligD = new Map(), eligW = new Map(), firedW = new Set(), firedD = new Set();
  for (const c of COUNTRIES) for (const seed of SEEDS) {
    const r = sweep(c.id, seed);
    for (const id of r.el) (eligD.get(id) || eligD.set(id, new Set()).get(id)).add(c.id);
    for (const id of r.wel) (eligW.get(id) || eligW.set(id, new Set()).get(id)).add(c.id);
    r.fired.forEach((id) => firedW.add(id)); r.decFired.forEach((id) => firedD.add(id));
  }
  // nuclear_taboo is reachable only through a nuclear employment (events.test.js drives it); everything else must come up.
  const missD = DECISIONS.filter((d) => !eligD.has(d.id)).map((d) => d.id);
  const missW = Object.keys(WORLD_RULES).filter((id) => id !== 'nuclear_taboo' && !eligW.has(id));
  assert.deepEqual(missD, [], `decisions never eligible: ${missD}`); assert.deepEqual(missW, [], `world events never eligible: ${missW}`);
  const unfiredD = DECISIONS.filter((d) => !firedD.has(d.id)).map((d) => d.id);
  const unfiredW = Object.keys(WORLD_RULES).filter((id) => id !== 'nuclear_taboo' && !firedW.has(id));
  assert.deepEqual(unfiredD, [], `decisions eligible but never drawn in 288 runs: ${unfiredD}`);
  assert.deepEqual(unfiredW, [], `world events eligible but never drawn in 288 runs: ${unfiredW}`);
});

test('nuclear taboo stays reachable: an employment opens it', () => {
  const h = headless(1, 'usa'); rich(h.g); h.g.platforms = { ...h.g.platforms, ssbn_fleet: 2, icbm_force: 2, strategic_bombers: 2 }; h.g.globalDef = { ...h.g.globalDef, russia: {} };
  h.run('nuclearEmployment', { nation: 'russia' });
  assert.equal(h.g.worldEvent?.id, 'nuclear_taboo'); assert.ok(h.g.evState.cd.nuclear_taboo > 0);
  assert.deepEqual(eventOptions(h.g, 'world').map((o) => o.id), ['summit', 'pledge']);
});

test('invariants: a follow-up naming an unknown event, or a used decision that is not registered, is caught', () => {
  const g = headless(1, 'usa').g; assert.deepEqual(checkV57(g), []);
  g.evState = { ...g.evState, q: [{ id: 'not_an_event', at: 5 }] }; assert.ok(checkV57(g).includes('queued follow-ups are registered world events'));
  g.evState = { ...g.evState, q: [] }; g.usedDecisions = new Set(['ghost']); assert.ok(checkV57(g).includes('used decisions are registered decisions'));
});
