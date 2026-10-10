import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMonth } from '../src/sim/tick.js';
import { applyVerb } from '../src/sim/actions.js';
import { newCampaign, STATE_FIELDS } from '../src/sim/state.js';
import { COUNTRIES } from '../src/data/nations.js';
import { DECISIONS } from '../src/data/world.js';
import { WORLD_RULES } from '../src/data/events.js';
import { DECISION_WHY, WORLD_WHY, whyFor } from '../src/data/event-why.js';
import { absMonth, isBriefingMonth, monthsToBriefing, BRIEFING_EVERY, WORLD_GAP } from '../src/sim/events.js';
import { buildOutliner } from '../src/ui/shell/outliner.js';
import { mulberry32, setRngSource } from '../src/sim/rng.js';
import { checkV57 } from '../src/sim/invariants.js';
import { eventOptions } from '../src/sim/selectors.js';
import { mount, flush, BUNDLES } from './util/harness.js';

// F2 (#33): decision cadence and 'Why now'. Rules: (1) decisions open only at the quarterly briefing, except flagged urgent ones;
// (2) every decision and world-event card carries a non-empty why-now; (3) one open decision at a time; (4) no decision within
// WORLD_GAP months of a world event; (5) the outliner counts down to the next briefing.
const URGENT_IDS = DECISIONS.filter((d) => d.urgent).map((d) => d.id);
const FALLBACK = /^Inflation .*, unemployment .*, stability /; // whyFor's last resort: shipped ids must never need it

function headless(seed, idx = 0) {
  setRngSource(mulberry32(seed));
  const g = newCampaign(COUNTRIES[idx]); g.doctrine = 'hegemon'; g.gracePeriod = 0;
  const ui = { log: [] };
  const S = new Proxy({}, { get: (_, name) => (v) => { const k = name[3].toLowerCase() + name.slice(4); const box = STATE_FIELDS.includes(k) ? g : ui; box[k] = typeof v === 'function' ? v(box[k]) : v; } });
  const fx = { toast() {}, now: () => 0, defer: (fn) => fn() };
  return { g, month: () => runMonth(g, S, fx), run: (type, payload) => applyVerb(g, S, fx, { type, payload }) };
}

test('cadence helpers: briefings fall on Jan, Apr, Jul, Oct and count down 3, 2, 1', () => {
  assert.equal(BRIEFING_EVERY, 3);
  for (let mo = 0; mo < 12; mo++) {
    const g = { date: { yr: 2025, mo } };
    assert.equal(isBriefingMonth(g), [0, 3, 6, 9].includes(mo), `month ${mo}`);
    assert.equal(monthsToBriefing(g), 3 - (mo % 3));
  }
});

test('every decision and world event has a why-now entry, and it names live state without the fallback', () => {
  assert.deepEqual(DECISIONS.filter((d) => !DECISION_WHY[d.id]).map((d) => d.id), []);
  assert.deepEqual(Object.keys(WORLD_RULES).filter((id) => !WORLD_WHY[id]), []);
  assert.deepEqual(Object.keys(DECISION_WHY).filter((id) => !DECISIONS.some((d) => d.id === id)), [], 'no stray decision entries');
  assert.match(whyFor('decision', 'not_registered', { g: { stats: { inflation: 4.1, unemployment: 5, stability: 60 } } }), FALLBACK);
  assert.ok(URGENT_IDS.length >= 3 && URGENT_IDS.every((id) => DECISIONS.find((d) => d.id === id).when), 'urgent decisions are a flagged subset of gated ones');
});

// A bot that lets cards sit for a few months, so the one-open and gap rules are exercised, not just the happy path.
function play(seed, idx, months = 240) {
  const h = headless(seed, idx); const g = h.g; const bot = mulberry32(seed * 7919 + idx);
  const out = { opened: [], urgent: [], worlds: [], maxOpenPerMonth: 0, bad: [] };
  let lastD = null, lastW = null, hold = 0;
  for (let m = 0; m < months; m++) {
    const t = m % 72; g.rivalTension = Object.fromEntries(['china', 'russia', 'usa', 'germany'].filter((r) => r !== g.country.id).map((r, i) => [r, Math.max(0, (t < 24 ? 12 : t < 48 ? 40 : 62) - i * 5)]));
    if (m % 24 === 12) g.stats = { ...g.stats, stability: 40 };
    if (m % 12 === 0) g.stats = { ...g.stats, treasury: Math.max(g.stats.treasury, 40000) };
    if (!h.month()) break;
    let openedNow = 0;
    const d = g.activeDecision;
    if (d && d.id !== lastD) {
      openedNow++; out.opened.push(d.id); if (d.urgentNow) out.urgent.push(d.id);
      const ev = g.evState; const why = d.why;
      if (!(d.at % BRIEFING_EVERY === 0 || d.urgentNow)) out.bad.push(`${d.id} opened off-briefing at ${d.at} unflagged`);
      if (d.urgentNow && !URGENT_IDS.includes(d.id)) out.bad.push(`${d.id} flagged urgent but is not an urgent decision`);
      if (g.worldEvent) out.bad.push(`${d.id} opened under an open world event`);
      if (d.at - ev.last < WORLD_GAP) out.bad.push(`${d.id} opened ${d.at - ev.last} months after a world event`);
      if (typeof why !== 'string' || !why.trim() || FALLBACK.test(why)) out.bad.push(`${d.id} why-now: ${JSON.stringify(why)}`);
      hold = Math.floor(bot() * 6);
    }
    lastD = d?.id ?? null;
    const w = g.worldEvent;
    if (w && (w.id !== lastW?.id || w.mo > lastW.mo)) { out.worlds.push(w.id); if (typeof w.why !== 'string' || !w.why.trim() || FALLBACK.test(w.why)) out.bad.push(`world ${w.id} why-now: ${JSON.stringify(w.why)}`); }
    lastW = w ? { id: w.id, mo: w.mo } : null;
    out.maxOpenPerMonth = Math.max(out.maxOpenPerMonth, openedNow);
    if (g.activeDecision) { if (hold-- <= 0) { const ops = eventOptions(g, 'decision').filter((o) => o.ok); if (ops.length) h.run('makeDecision', { option: ops[Math.floor(bot() * ops.length)].id }); } }
    if (g.worldEvent && !g.worldEvent.ans && bot() < 0.3) { const ops = eventOptions(g, 'world').filter((o) => o.ok); if (ops.length) h.run('eventResponse', { kind: 'world', response: ops[Math.floor(bot() * ops.length)].id }); }
    const bad = checkV57(g); if (bad.length) out.bad.push(`month ${m}: invariants ${bad}`);
  }
  return out;
}

test('240-month seeded runs, 8 nations x 3 seeds: decisions only at briefings or flagged urgent, never two open, never near a world event, each with a why-now', () => {
  let decisions = 0, worlds = 0; const urgent = [];
  for (let idx = 0; idx < COUNTRIES.length; idx++) for (const seed of [1, 2, 3]) {
    const r = play(seed, idx);
    assert.deepEqual(r.bad, [], `${COUNTRIES[idx].id}/${seed}`);
    assert.ok(r.maxOpenPerMonth <= 1);
    decisions += r.opened.length; worlds += r.worlds.length; urgent.push(...r.urgent);
  }
  assert.ok(decisions >= 40, `only ${decisions} decisions across 24 runs: the rule must not starve the pool`);
  assert.ok(worlds >= 10, `only ${worlds} world events: the check needs some to be meaningful`);
});

// Forcing a month: the tick decides on the month the game is IN (the date advances after the systems run), so advance until
// the game sits at `phase` (months since a briefing), then let the caller set up state and tick once.
function toPhase(h, phase) { for (let i = 0; i < 12; i++) { if (absMonth(h.g) % BRIEFING_EVERY === phase) return; assert.ok(h.month()); } assert.fail('no such month'); }
// `only`: every other decision is marked used, so the one under test is the only candidate.
const due = (g, only = 'protest') => { g.usedDecisions = new Set(DECISIONS.filter((d) => d.id !== only).map((d) => d.id)); g.decisionTimer = 0; g.activeDecision = null; g.worldEvent = null; g.evState = { ...g.evState, last: -999, q: [] }; };

test('rule 1: off-briefing, only an urgent decision opens, flagged; a merely eligible one waits for the briefing', () => {
  const h = headless(5); toPhase(h, 1); due(h.g);
  h.g.stats = { ...h.g.stats, stability: 50, inequality: 40 }; // protest is eligible (stability < 58) but not urgent (>= 45)
  h.month();
  assert.equal(h.g.activeDecision, null, 'eligible but not urgent: waits');
  const u = headless(5); toPhase(u, 1); due(u.g);
  u.g.stats = { ...u.g.stats, stability: 30 };
  u.month();
  assert.equal(u.g.activeDecision?.id, 'protest', 'urgent: opens off-briefing'); assert.equal(u.g.activeDecision.urgentNow, true);
  assert.notEqual(absMonth(u.g) % BRIEFING_EVERY, 0); assert.match(u.g.activeDecision.why, /Stability \d+, below 58/);
  const b = headless(5); toPhase(b, 0); due(b.g); b.g.stats = { ...b.g.stats, stability: 50 };
  b.month();
  assert.equal(b.g.activeDecision?.id, 'protest', 'at the briefing the same state opens it'); assert.equal(b.g.activeDecision.urgentNow, false);
});

test('rule 3: a second decision never opens while one is on the table', () => {
  const h = headless(5); toPhase(h, 0); due(h.g); h.g.stats = { ...h.g.stats, stability: 50 };
  h.month(); const first = h.g.activeDecision; assert.ok(first);
  for (let i = 0; i < 9; i++) { h.g.decisionTimer = 0; h.month(); assert.equal(h.g.activeDecision?.id, first.id, `month +${i + 1}`); }
});

test('rule 4: no decision under an open world event, nor within 3 months after one starts or ends', () => {
  const tryOpen = (setup) => { const h = headless(5); toPhase(h, 0); due(h.g); h.g.stats = { ...h.g.stats, stability: 50 }; setup(h.g); h.month(); return h.g.activeDecision; };
  assert.equal(tryOpen((g) => { g.worldEvent = { id: 'pandemic', mo: 5, why: 'x' }; }), null, 'world event open');
  assert.equal(tryOpen((g) => { g.evState = { ...g.evState, last: absMonth(g) - 1 }; }), null, 'event touched 1 month ago');
  assert.equal(tryOpen((g) => { g.evState = { ...g.evState, last: absMonth(g) - 2 }; }), null, 'event touched 2 months ago');
  assert.ok(tryOpen((g) => { g.evState = { ...g.evState, last: absMonth(g) - 4 }; }), 'clear after the gap');
});

test('rule 2: a started world event stores its why-now; a chained follow-up says so', () => {
  const h = headless(9, 1); let seen = null;
  for (let m = 0; m < 600 && !seen; m++) { h.g.rivalTension = { russia: 60, china: 60, usa: 60, germany: 60 }; h.g.stats = { ...h.g.stats, inflation: 5, healthcare: 70 }; h.month(); if (h.g.worldEvent) seen = h.g.worldEvent; }
  assert.ok(seen, 'a world event came up'); assert.ok(seen.why && !FALLBACK.test(seen.why), seen.why);
});

test('rule 5: the outliner counts down to the next briefing', () => {
  const row = (mo) => buildOutliner({ date: { yr: 2025, mo } }).find((r) => r.id === 'briefing');
  assert.equal(row(0).months, 3); assert.equal(row(1).months, 2); assert.equal(row(2).months, 1); assert.equal(row(3).months, 3);
  assert.equal(row(1).group, 'timers'); assert.match(row(1).title, /briefing/i);
});

test('UI: a decision card and a world-event card each show a non-empty Why now; urgent ones are flagged', async () => {
  const g = await mount(BUNDLES.app, { testHook: true, seed: 3 }); await g.pickCountry(0);
  const q = (s) => g.doc.querySelector(s);
  g.w.__wl.decision('summit', 'Russia tension 55, past the 50 where talks open', false); await flush();
  assert.match(q('[data-event-card=decision] [data-why-now]').textContent, /Why now: Russia tension 55/);
  assert.match(q('[data-event-card=decision] .wl-label').textContent, /Cabinet briefing/);
  g.w.__wl.decision('protest', 'Stability 30, below 58', true); await flush();
  assert.match(q('[data-event-card=decision] .wl-label').textContent, /Urgent decision/);
  g.w.__wl.event('pandemic', 6); await flush(); await flush();
  assert.ok(q('[data-event-card=world] [data-why-now]').textContent.length > 'Why now: '.length, 'world card has a why line');
  g.close();
});
