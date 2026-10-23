import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './util/headless-month.js';
import { COUNTRIES } from '../src/data/nations.js';
import { WORLD_EVENTS, DECISIONS } from '../src/data/world.js';
import { WORLD_RULES, EVENT_COOLDOWN } from '../src/data/events.js';
import { WORLD_EVIDENCE, DECISION_EVIDENCE, evidenceFor, evidenceLine, trendOf, recordHist, HIST_KEYS, HIST_MONTHS, METRICS } from '../src/data/event-evidence.js';
import { pickWorldEvent, newEvState } from '../src/sim/events.js';
import { eventOptions, openEventCards } from '../src/sim/selectors.js';
import { checkV57 } from '../src/sim/invariants.js';
import { mulberry32 } from '../src/sim/rng.js';
import { mount, BUNDLES, flush } from './util/harness.js';

// FIX 5: every world event and decision carries trigger evidence (metric, value, threshold, trend, upstream cause) that the
// card renders; the 60-month cooldown and the context weighting hold over 240 seeded months in every seat.

test('registry: every world event and decision has an evidence entry; evidenceFor is structured and never the fallback on a state that opens the gate', () => {
  assert.deepEqual(Object.keys(WORLD_RULES).filter((id) => !WORLD_EVIDENCE[id]), []);
  assert.deepEqual(DECISIONS.filter((d) => !DECISION_EVIDENCE[d.id]).map((d) => d.id), []);
  assert.deepEqual(Object.keys(DECISION_EVIDENCE).filter((id) => !DECISIONS.some((d) => d.id === id)), [], 'no stray entries');
  const h = game(1); const g = h.g;
  try {
    g.rivalTension = { china: 80, russia: 30 }; g.spr = 1.2; g.sprRelease = true; g.stats.healthcare = 40; g.stats.debtGdp = 120; g.stats.inflation = 5; g.stats.stability = 40;
    const hist = { spr: [6, 5, 4, 3, 2], tension: [10, 30, 50, 70] };
    const e = evidenceFor('world', 'energy_crunch', { g }, hist);
    assert.equal(e.key, 'spr'); assert.equal(e.value, 1.2); assert.equal(e.cmp, '<'); assert.equal(e.threshold, 2);
    assert.deepEqual(e.trend, { months: 5, dir: 'falling', from: 6 }); assert.match(e.cause, /reserve release in progress/);
    assert.match(evidenceLine(e), /^Strategic reserve 1\.2 mo, below 2 mo · falling 5 months \(from 6 mo\) · driven by a reserve release in progress/);
    const hz = evidenceFor('world', 'hormuz_closure', { g }, hist);
    assert.equal(hz.key, 'tension'); assert.equal(hz.value, 80); assert.equal(hz.trend.months, 4); assert.equal(hz.trend.dir, 'rising'); assert.match(hz.cause, /^China:/);
    const sm = evidenceFor('decision', 'summit', { g }, hist); assert.equal(sm.threshold, 50); assert.match(evidenceLine(sm), /Rival tension 80, at or above 50/);
    const pd = evidenceFor('world', 'pandemic', { g }, {}); assert.equal(pd.value, 40); assert.match(evidenceLine(pd), /steady this month · driven by healthcare budget/);
    assert.equal(evidenceFor('world', 'not_registered', { g }, {}).key, 'fallback');
    for (const id of Object.keys(WORLD_RULES)) { const x = evidenceFor('world', id, { g }, hist); assert.notEqual(x.key, 'fallback', id); assert.ok(evidenceLine(x).length > 10, id); }
    for (const d of DECISIONS) { const x = evidenceFor('decision', d.id, { g }, hist); assert.notEqual(x.key, 'fallback', d.id); assert.ok(evidenceLine(x).length > 10, d.id); }
    // history and trend helpers
    let hh = {}; for (let i = 0; i < 15; i++) { g.spr = i; hh = recordHist(hh, g); }
    assert.deepEqual(Object.keys(hh), HIST_KEYS); assert.equal(hh.spr.length, HIST_MONTHS); assert.deepEqual(hh.spr.slice(-3), [12, 13, 14]);
    assert.deepEqual(trendOf({ spr: [3, 3, 3] }, 'spr', 3), { months: 0, dir: 'flat', from: 3 });
    assert.deepEqual(trendOf({ spr: [1, 5, 4, 3] }, 'spr', 2), { months: 3, dir: 'falling', from: 5 });
    for (const [k, m] of Object.entries(METRICS)) assert.ok(Number.isFinite(m.read(g)), k);
  } finally { h.done(); }
});

test('context weighting: pickWorldEvent draws in proportion to w(g); hot tension makes Hormuz far likelier than the drought', () => {
  const h = game(3); const g = h.g;
  try {
    g.rivalTension = { china: 80 }; g.date = { yr: 2026, mo: 0 }; g.evState = { ...newEvState(), cd: Object.fromEntries(Object.keys(WORLD_RULES).filter((id) => !['hormuz_closure', 'panama_drought'].includes(id)).map((id) => [id, 30])) };
    const wH = WORLD_RULES.hormuz_closure.w(g), wP = WORLD_RULES.panama_drought.w(g); assert.ok(wH > wP, `${wH} > ${wP}`);
    let hz = 0; const N = 1000; for (let i = 0; i < N; i++) if (pickWorldEvent(g, (i + 0.5) / N) === 'hormuz_closure') hz++;
    assert.ok(Math.abs(hz / N - wH / (wH + wP)) < 0.01, `${hz}/${N} vs ${wH / (wH + wP)}`);
    g.rivalTension = { china: 0 }; assert.equal(WORLD_RULES.hormuz_closure.when(g), false, 'below 25 Hormuz is not eligible');
    assert.equal(pickWorldEvent({ ...g, evState: { ...g.evState, cd: { ...g.evState.cd, panama_drought: 5 } } }, 0.5), null, 'everything on cooldown: a quiet month');
  } finally { h.done(); }
});

// A policy that keeps the gates busy: tension cycles, the reserve drains and refills, vitals dip, research climbs.
function policy(g, m, h) {
  const t = 15 + 60 * Math.abs(Math.sin(m / 11)); const rivals = Object.keys(g.rivalTension || {}).length ? Object.keys(g.rivalTension) : ['china', 'russia', 'usa'].filter((r) => r !== g.country.id);
  g.rivalTension = Object.fromEntries(rivals.map((r, i) => [r, Math.max(0, Math.round(t - i * 7))]));
  if (m % 40 === 1) { g.spr = 8; g.sprRelease = true; } if (m % 40 === 20) g.sprRelease = false;
  if (m % 30 === 0) g.stats = { ...g.stats, healthcare: 40 + (m % 3) * 15, debtGdp: 60 + (m % 5) * 20, inflation: 1 + (m % 4) * 1.5, stability: 40 + (m % 2) * 25, unemployment: 3 + (m % 3) * 2, gdpGrowth: 0.5 + (m % 3), inequality: 50 + (m % 3) * 12 };
  if (m === 2) g.defLevels = Object.fromEntries(Object.keys(g.defLevels || {}).map((v) => [v, v === 'cyber' ? 1 : 4]));
  if (m === 5) h.act({ type: 'toggleSanctions', payload: { nation: g.country.id === 'russia' ? 'china' : 'russia' } });
  if (m % 12 === 8 && m >= 20) g.intelOps = [{ id: `op${m}`, opId: 'tech_acq', targetId: g.country.id === 'china' ? 'usa' : 'china', monthsLeft: 4, successRate: 0.7, discoverRate: 0.2, type: 'covert' }];
  if (m % 6 === 0) g.stats.treasury = 60000;
}

test('240 months x 8 nations: no world event repeats inside its 60-month cooldown; every fire (event and decision) records evidence the card can render; the pool keeps firing', () => {
  const fires = {}; const decFires = {}; const perSeat = {}; let evChecked = 0;
  for (let idx = 0; idx < COUNTRIES.length; idx++) {
    const h = game(100 + idx, idx); const g = h.g; const bot = mulberry32(7 + idx);
    try {
      let lastW = null, lastD = null;
      for (let m = 0; m < 240; m++) {
        policy(g, m, h);
        h.step();
        assert.deepEqual(checkV57(g), [], `${g.country.id} month ${m}`);
        const w = g.worldEvent;
        if (w && (w.id !== lastW?.id || w.mo > lastW.mo)) {
          fires[w.id] = (fires[w.id] || 0) + 1;
          if (w.why !== 'Follow-up to your earlier response') { assert.ok(w.ev && w.ev.key !== 'fallback', `${g.country.id} ${w.id} evidence ${JSON.stringify(w.ev)}`); assert.ok(evidenceLine(w.ev).length > 10); evChecked++; }
          if (openEventCards(g).world && bot() < 0.7) { const ops = eventOptions(g, 'world').filter((o) => o.ok); if (ops.length) h.act({ type: 'eventResponse', payload: { kind: 'world', response: ops[Math.floor(bot() * ops.length)].id } }); }
        }
        lastW = g.worldEvent ? { ...g.worldEvent } : null;
        const d = g.activeDecision;
        if (d && d.id !== lastD?.id) { decFires[d.id] = (decFires[d.id] || 0) + 1; assert.ok(d.ev && d.ev.key !== 'fallback', `${g.country.id} decision ${d.id} evidence`); assert.ok(evidenceLine(d.ev).length > 10); evChecked++; const ops = eventOptions(g, 'decision').filter((o) => o.ok); if (ops.length) h.act({ type: 'makeDecision', payload: { option: ops[Math.floor(bot() * ops.length)].id } }); }
        lastD = g.activeDecision;
      }
      // cooldown: the event log is the record of every fire (chains included); same id never within 60 months
      const log = g.evState.log; const seen = {};
      for (const { id, m } of log) { if (seen[id] != null) assert.ok(m - seen[id] >= EVENT_COOLDOWN, `${g.country.id}: ${id} fired at ${seen[id]} and ${m} (${m - seen[id]} < ${EVENT_COOLDOWN})`); seen[id] = m; }
      perSeat[g.country.id] = log.length; assert.ok(log.length >= 2, `${g.country.id}: only ${log.length} world events in 240 months`);
      for (const [k, a] of Object.entries(g.evState.hist)) assert.equal(a.length, HIST_MONTHS, k);
    } finally { h.done(); }
  }
  const pool = Object.keys(WORLD_EVENTS).filter((id) => WORLD_RULES[id]);
  console.log(`world events fired across 8 seats: ${Object.entries(fires).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')} | never: ${pool.filter((id) => !fires[id]).join(', ') || 'none'}`);
  console.log(`world events per seat: ${Object.entries(perSeat).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`decisions fired: ${Object.keys(decFires).length}/${DECISIONS.length}; evidence checked on ${evChecked} fires`);
  assert.ok(Object.keys(fires).length >= 10, `only ${Object.keys(fires).length} distinct world events fired`);
  assert.ok(evChecked >= 40, `evidence checked on ${evChecked} fires`);
});

test('App (jsdom): the world event card and the decision card print the trigger chain under Why now', async () => {
  const origErr = console.error; console.error = () => {};
  const g = await mount(BUNDLES.app, { testHook: true, seed: 5 });
  try {
    await g.pickCountry(0);
    const { doc, w } = g; const q = (s) => doc.querySelector(s);
    [...q('[data-event-card=doctrine]').querySelectorAll('div')].find((d) => d.style.cursor === 'pointer' && /Military Superpower/.test(d.textContent)).click(); await flush();
    await g.advance(1); w.__wl.setTension('china', 60); await flush();
    w.__wl.event('hormuz_closure', 6); w.__wl.decision('summit'); await flush(); await flush();
    const we = q('[data-event-card=world] [data-evidence]'); assert.ok(we, 'world chain'); assert.equal(we.dataset.evidence, 'tension');
    assert.match(we.textContent, /^Trigger: Rival tension 60, at or above 25 · .* · driven by China: /);
    const de = q('[data-event-card=decision] [data-evidence]'); assert.ok(de, 'decision chain'); assert.match(de.textContent, /Rival tension 60, at or above 50/);
    assert.ok(!g.faulted());
  } finally { console.error = origErr; g.close(); }
});
