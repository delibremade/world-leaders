import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERBS } from '../src/sim/actions.js';
import { newCampaign } from '../src/sim/state.js';
import { COUNTRIES, NATIONS, DIP_TARGETS } from '../src/data/nations.js';
import { INTEL_OPS } from '../src/data/intel.js';
import { oilPriceTerms, opOddsTerms, influencePool, influenceGain, renewableTotal } from '../src/sim/selectors.js';
import { NATION_VERBS, NATION_VERB_ALIASES, verbsFor } from '../src/ui/shell/nation-verbs.js';
import { buildOutliner, GROUPS } from '../src/ui/shell/outliner.js';
import { mount, flush, BUNDLES, TABS, PANES, SENTINEL_PANES, gameEnded } from './util/harness.js';

// P3c gate: the Tier 1 shell. Nation sheet covers every nation-keyed verb; why-breakdown selectors agree with
// the engine's formulas; outliner rows come from engine state; the App renders HUD, nav, cards, sheet, outliner
// and popovers in jsdom and still plays 120 months with save/resume.

const g0 = () => { const g = newCampaign(COUNTRIES[0]); g.intelInfra = g.intelInfra || {}; g.covertPrograms = g.covertPrograms || new Set(); return g; };

test('nation sheet: every VERBS entry keyed by nation is a row or a documented alias', () => {
  const src = Object.entries(VERBS).map(([k, fn]) => [k, String(fn)]).filter(([, body]) => /\{[^}]*\bnation\b[^}]*\}\)=>/.test(body)).map(([k]) => k);
  assert.ok(src.length >= 18, `nation-keyed verbs found: ${src.length}`);
  const rows = new Set(NATION_VERBS.map((r) => r.type));
  const missing = src.filter((k) => !rows.has(k) && !NATION_VERB_ALIASES[k]);
  assert.deepEqual(missing, [], 'nation-keyed verbs without a sheet row');
  for (const [alias, target] of Object.entries(NATION_VERB_ALIASES)) { assert.ok(VERBS[alias], alias); assert.ok(rows.has(target), target); }
  for (const r of NATION_VERBS) assert.ok(VERBS[r.type], `row ${r.type} is not a verb`);
});

test('nation sheet rows: availability follows the registry and state; options come from data', () => {
  const g = g0(); const v = { ...g, country: COUNTRIES[0], stats: { treasury: 5000, stability: 60 }, rivalTension: { russia: 50 } };
  const fr = verbsFor(v, 'france'); const ru = verbsFor(v, 'russia'); const cuba = verbsFor(v, 'cuba');
  assert.ok(fr.some((r) => r.type === 'stateVisit') && fr.some((r) => r.type === 'establishEmbassy') && !fr.some((r) => r.type === 'toggleEmbassy'));
  assert.ok(!fr.some((r) => r.type === 'nuclearEmployment'), 'no nuclear row for a non-rival');
  assert.ok(ru.some((r) => r.type === 'nuclearEmployment') && ru.some((r) => r.type === 'backChannel') && ru.some((r) => r.type === 'regimeChange'), 'rival rows');
  assert.ok(cuba.some((r) => r.type === 'toggleSanctions') && cuba.some((r) => r.type === 'regimeChange'), 'ruling 7: any nation is sanctionable and targetable');
  const ops = ru.find((r) => r.type === 'runIntelOp'); assert.equal(ops.opts.length, INTEL_OPS.length); assert.match(ops.opts[0][1], /\d+%/);
  v.embassies = new Set(['france']); const fr2 = verbsFor(v, 'france');
  assert.ok(fr2.some((r) => r.type === 'toggleEmbassy') && fr2.some((r) => r.type === 'setEmbassyMission') && !fr2.some((r) => r.type === 'establishEmbassy'));
  assert.equal(fr2.find((r) => r.type === 'setEmbassyMission').payload('france', 'trade').mission, 'trade');
});

test('selectors: op odds, oil price and influence terms reproduce the engine formulas', () => {
  const g = g0(); g.defLevels = { ...g.defLevels, cyber: 4 }; g.intelBudget = 3; g.doctrine = 'shadow'; g.intelInfra = { overseas_stations: 2, listening_posts: 1 }; g.absorbBonus = 1;
  const t = opOddsTerms(g, 'tech_acq'); const op = INTEL_OPS.find((o) => o.id === 'tech_acq');
  const expected = Math.min(0.95, op.baseSuccess + (4 - 2) * 0.05 + 0.08 + 0.12 + 0 + 0.15 + 0.06 + Math.min(0.1, t.terms.find((x) => x.k === 'isr').d));
  assert.equal(t.successRate, expected); assert.ok(t.terms.length >= 8);
  assert.equal(Math.round(t.terms.reduce((s, x) => s + x.d, 0) * 1e9) / 1e9, Math.round(t.successRate * 1e9) / 1e9, 'terms sum to the rate');
  assert.equal(opOddsTerms(g, 'nope'), null);
  g.blocTrade = { ...g.blocTrade, opec: 2 }; g.resExtraction = { oil: 1 }; g.opecSwing = { mode: 'cut' }; g.embargoes = new Set(['venezuela']); g.worldEvent = null;
  const o = oilPriceTerms(g, { renTot: 12, hormuzHit: true });
  assert.equal(o.mult, 1.2 * 1.35 * 1.6 * 1 * 1.4 * 1.15 * 0.8); assert.equal(o.terms.length, 7);
  assert.equal(renewableTotal({ resources: { renewable: { solar: 2, wind: 3, hydro: 1 } } }), 6);
  g.influenceBudget = 4; g.influenceAlloc = { france: 2, india: 2 }; g.embassies = new Set(['france']); g.dominance = { regions: new Set(['WE']) }; g.doctrine = 'hegemon';
  const { infPool, totW } = influencePool(g); assert.equal(infPool, 400); assert.equal(totW, 4);
  const inf = influenceGain(g, 80, DIP_TARGETS.find((d) => d.id === 'france'), infPool, totW);
  assert.equal(inf.gain, Math.min(6, (200 / 40) * 1.8 * 1.5 * 1.15 * 1.4)); assert.equal(inf.terms.length, 5);
  assert.equal(influenceGain(g, 80, DIP_TARGETS.find((d) => d.id === 'brazil'), infPool, totW).gain, 0, 'no weight, no gain');
});

test('outliner: rows from engine state, grouped, each with a jump target', () => {
  const rows = buildOutliner({
    flashpoint: { rid: 'ME', type: 'coup', t: 3 }, worldEvent: { id: 'hormuz_closure', mo: 4 }, blockades: { EA: { target: 'china' } },
    intelOps: [{ id: 'x', opId: 'tech_acq', targetId: 'china', monthsLeft: 2, successRate: 0.7, discoverRate: 0.2 }], continuousOps: { 'tech_acq@russia': true }, investigations: { debt: 1 },
    platformDev: { frigate: { mo: 5 } }, blackResearch: { id: 'rq180', prog: 3, mo: 10 }, deployments: [{ id: 'd1', policyName: 'Pension', monthsElapsed: 2, timeMonths: 8, status: 'active' }],
    defResearch: { cyber: 4 }, defLevels: { cyber: 2 }, gracePeriod: 6, pariah: 0, hegHold: 10, embargoedBy: { by: 'russia', mo: 5 }, expelled: { china: 20 }, embassyLocks: { france: 12 }, blocLock: { eu: 9 },
    concessions: {}, sprRelease: true, actionCooldowns: { visit_france: 3, aid_india: 0, bc_russia: 6 },
  });
  const by = Object.fromEntries(GROUPS.map(([g]) => [g, rows.filter((r) => r.group === g).length]));
  assert.deepEqual(by, { flashpoints: 3, ops: 3, builds: 3, research: 1, timers: 7, cooldowns: 2 });
  for (const r of rows) { assert.ok(r.id && r.title && r.jump?.tab && PANES.includes(r.jump.tab), r.id); }
  assert.equal(rows.find((r) => r.id === 'fp').jump.region, 'ME'); assert.equal(rows.find((r) => r.id === 'x').jump.nation, 'china');
  assert.equal(rows.find((r) => r.id === 'sap').pct, 0.3); assert.equal(rows.find((r) => r.id === 'cd_visit_france').months, 3);
  assert.equal(buildOutliner({}).length, 0);
});

test('App: shell renders (HUD, speed, nav badges, doctrine card, sheet, outliner, why), plays 120 months, save/resume', async () => {
  const origErr = console.error; console.error = () => {};
  const g = await mount(BUNDLES.app, { testHook: true, seed: 7 }); // seeded: the 120-month run must not depend on the wall clock or Math.random
  try {
    await g.pickCountry(0);
    const { doc, w } = g;
    const q = (s) => doc.querySelector(s), qa = (s) => [...doc.querySelectorAll(s)];
    assert.ok(q('[data-hud]') && q('[data-nav]') && q('[data-outliner]'), 'shell chrome present');
    assert.equal(qa('[data-nav] [data-tab]').length, 9, 'nine verticals');
    assert.equal(qa('[data-nav] [data-tab]').map((b) => b.getAttribute('data-tab')).join(','), TABS.join(','));
    assert.ok(q('[data-event-card=doctrine]'), 'doctrine is a non-blocking card');
    assert.equal(q('[data-event-card=doctrine]').getAttribute('data-modal'), '1900');
    assert.ok(!qa('div').some((d) => d.style.position === 'fixed' && d.style.inset && /Doctrine/.test(d.textContent)), 'no doctrine scrim');
    assert.equal(q('[data-badge=overview]')?.textContent, '1', 'doctrine pending badge');
    // speed control: pause shows its reason; 2x sets speed and clears the pause
    const speed = qa('[data-speed] button'); assert.equal(speed.length, 4);
    speed[0].click(); await flush(); assert.match(q('[data-pause-reason]').textContent, /Paused by you/);
    speed[2].click(); await flush(); assert.equal(q('[data-pause-reason]'), null); assert.equal(speed[2].getAttribute('aria-pressed'), 'true');
    // why-breakdowns open from the HUD figures
    q('[data-why^="Treasury"]').click(); await flush(); await flush();
    assert.ok(q('[data-why-content^="Treasury"]'), 'treasury why opens'); assert.match(q('[data-why-content^="Treasury"]').textContent, /Net \/ month/);
    // doctrine via the card, then nav to intel and back (data-tab)
    [...q('[data-event-card=doctrine]').querySelectorAll('div')].find((d) => d.style.cursor === 'pointer' && /Military Superpower/.test(d.textContent)).click(); await flush();
    assert.equal(q('[data-event-card=doctrine]'), null, 'doctrine chosen, card gone');
    g.tabBtn('intel').click(); await flush(); assert.equal(q('[data-tab=intel]').getAttribute('aria-current'), 'page');
    g.tabBtn('overview').click(); await flush();
    // region tap -> sheet with the v57 panel + nations; nation row -> nation sheet listing verbs; dispatch one
    q('svg g[data-region=WE]').dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await flush(); await flush();
    assert.ok(q('[data-sheet]') && q('[data-region-panel]'), 'region sheet open'); assert.match(q('[data-sheet]').textContent, /Your Influence/);
    assert.ok(qa('[data-nation-row]').length >= 2, 'nations listed');
    q('[data-nation-row=france]').click(); await flush(); await flush();
    assert.ok(q('[data-nation-sheet=france]'), 'nation sheet open');
    const rowTypes = qa('[data-verb-row]').map((d) => d.getAttribute('data-verb-row'));
    for (const t of ['stateVisit', 'foreignAid', 'tradeAgreement', 'defensePact', 'establishEmbassy', 'setInfluence', 'toggleSanctions', 'toggleEmbargo', 'offerArms']) assert.ok(rowTypes.includes(t), `row ${t}`);
    q('[data-verb-row=establishEmbassy] .wl-verb').click(); await flush(); await flush();
    assert.ok(qa('[data-verb-row]').map((d) => d.getAttribute('data-verb-row')).includes('toggleEmbassy'), 'embassy established through the sheet (verb dispatched)');
    q('[data-sheet-back]').click(); await flush(); assert.ok(q('[data-region-panel]'), 'back to region');
    q('[data-sheet-close]').click(); await flush(); await flush(); assert.equal(q('[data-region-panel]'), null, 'sheet closed');
    // outliner opens, lists the embassy cooldown-free state (empty ok), and jumps
    q('[data-outliner-handle]').click(); await flush(); assert.equal(q('[data-outliner]').getAttribute('data-open'), 'true');
    w.__wl.setTension('russia', 80); await flush();
    const months = await g.advance(120);
    assert.ok(!g.faulted(), 'ErrorGate fault'); assert.ok(months >= 120 || gameEnded(doc), `advanced ${months}`);
    // Live rows come from engine state: plant a world event through the test hook and expect its row (what else
    // is live after 120 months depends on the seed, so it is not asserted).
    w.__wl.event('pandemic', 6); await flush(); await flush();
    assert.ok(q('[data-outliner-row=we]'), 'world event row in the outliner');
    assert.match(q('[data-outliner-row=we]').textContent, /Pandemic/);
    for (const t of PANES) { g.tabBtn(t).click(); await flush(); await flush(); assert.ok(g.text().length > 500, t); if (SENTINEL_PANES.includes(t)) assert.ok(q(`[data-sentinel=${t}]`), `sentinel ${t}`); }
    const raw = (await w.storage.get('wl_save')).value; assert.ok(raw, 'autosave');
    const g2 = await mount(BUNDLES.app, { preload: { wl_save: raw } });
    try {
      let resume; for (let i = 0; i < 20 && !resume; i++) { await flush(); resume = [...g2.doc.querySelectorAll('button')].find((b) => /Resume/.test(b.textContent)); }
      assert.ok(resume); resume.click(); await flush(); await flush();
      assert.ok(g2.doc.querySelector('[data-hud]') && g2.tabBtn('overview'), 'resumed into the shell');
    } finally { g2.close(); }
  } finally { console.error = origErr; g.close(); }
});
