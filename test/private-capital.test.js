import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMonth } from '../src/sim/tick.js';
import { applyVerb } from '../src/sim/actions.js';
import { newCampaign, STATE_FIELDS } from '../src/sim/state.js';
import { checkV57 } from '../src/sim/invariants.js';
import { MINERAL_VERBS, projectOutlook, sectorIncome, leverCost, mineralView } from '../src/sim/minerals.js';
import { MINERALS, MINERAL_IDS, MINERAL_START, MINERAL_RULES as R } from '../src/data/minerals.js';
import { COUNTRIES } from '../src/data/nations.js';
import { setRngSource, mulberry32 } from '../src/sim/rng.js';
import { mount, BUNDLES } from './util/harness.js';

// F5 (#37): processing plants (and GGRB in-situ retorting) are built by private capital when profitable. The government
// pulls levers that cost a fraction of capex and accelerate the build, and earns royalties and sector tax as a ledger line.
const idx = (id) => COUNTRIES.findIndex((c) => c.id === id);
function headless(nid = 'usa', seed = 1) {
  setRngSource(mulberry32(seed));
  const g = newCampaign(COUNTRIES[idx(nid)]); g.doctrine = 'hegemon'; g.gracePeriod = 999;
  const ui = { log: [] }; const toasts = [];
  const S = new Proxy({}, { get: (_, name) => (v) => {
    const k = name[3].toLowerCase() + name.slice(4);
    const box = STATE_FIELDS.includes(k) ? g : ui;
    box[k] = typeof v === 'function' ? v(box[k]) : v;
  } });
  const fx = { toast: (m) => toasts.push(m), now: () => 0, defer: (fn) => fn() };
  return { g, ui, toasts, month: () => runMonth(g, S, fx), run: (type, payload) => applyVerb(g, S, fx, { type, payload }) };
}
const cap = (h, m) => h.g.minerals.own[m].cap;
const rich = (g) => { g.stats = { ...g.stats, treasury: 200000 }; };
// Months until a private plant on m comes online (cap 80). Records every month's ledger.
function untilOnline(h, m, ledgers = []) {
  const c0 = cap(h, m); let k = 0;
  while (cap(h, m) === c0 && k < 80) { h.month(); ledgers.push({ ...h.ui.ledger }); k++; }
  return k;
}

test('the treasury no longer builds plants: buildPlant is gone, capex is private', () => {
  assert.equal(MINERAL_VERBS.buildPlant, undefined);
  const h = headless('usa'); const c0 = cap(h, 'gallium');
  assert.throws(() => h.run('buildPlant', { mineral: 'gallium' }), /Unknown verb/);
  assert.equal(cap(h, 'gallium'), c0);
  assert.equal(R.plant.upkeep, undefined, 'privately operated plants charge the state no upkeep');
});

test('done-when: a profitable plant is built by private capital with zero treasury capex', () => {
  const h = headless('usa');
  const o = projectOutlook(h.g, 'rareEarth');
  assert.ok(o.profitable && o.pace > 0, `US rare earths are profitable at start (margin ${o.margin})`);
  const ledgers = []; const t = untilOnline(h, 'rareEarth', ledgers);
  assert.ok(t <= R.plant.mo, `online in ${t}mo`);
  assert.equal(cap(h, 'rareEarth'), MINERAL_START.usa.rareEarth[1] + R.plant.add);
  assert.equal(h.g.minerals.built.rareEarth, 1);
  for (const l of ledgers) assert.ok(!(l.Minerals < 0), `no state mineral spending: ${JSON.stringify(l)}`);
  assert.ok(h.toasts.some((x) => /private/i.test(x) && /Rare earths/.test(x)), 'the plant is announced as private');
  assert.deepEqual(checkV57(h.g), []);
});

test('unprofitable minerals wait; export controls elsewhere (scarcity) and program demand make them profitable', () => {
  const h = headless('usa');
  const o = projectOutlook(h.g, 'gallium');
  assert.ok(!o.profitable && o.pace === 0, `no ore, low margin: ${o.margin}`);
  for (let i = 0; i < 40; i++) h.month();
  assert.equal(cap(h, 'gallium'), MINERAL_START.usa.gallium[1], 'nobody invests at a loss');
  const s = headless('usa'); s.g.rivalTension = { ...s.g.rivalTension, china: 80 }; s.month();
  assert.ok(projectOutlook(s.g, 'gallium').margin > o.margin, 'Chinese controls raise the US gallium margin');
  const dpa = headless('usa'); dpa.g.rivalTension = { ...dpa.g.rivalTension, china: 80 }; rich(dpa.g); dpa.month();
  dpa.run('enactLever', { project: 'gallium', lever: 'dpa' });
  assert.ok(projectOutlook(dpa.g, 'gallium').profitable, 'under Chinese controls, DPA funding makes greenfield US gallium investable');
  const cuba = headless('cuba');
  assert.ok(!projectOutlook(cuba.g, 'enrichment').profitable, 'no ore and no plant: greenfield enrichment needs the state');
  const d = headless('usa'); for (const m of MINERAL_IDS) d.g.minerals.own[m].stock = 0;
  d.run('sapTranche', { program: 'f35' });
  assert.ok(projectOutlook(d.g, 'gallium').margin > o.margin, 'a tranche waiting on gallium raises the margin');
});

test('done-when: every lever measurably accelerates the private build at a cost well below capex', () => {
  const base = untilOnline(headless('usa'), 'rareEarth');
  for (const k of Object.keys(R.levers)) {
    const h = headless('usa'); rich(h.g); const t0 = h.g.stats.treasury;
    h.run('enactLever', { project: 'rareEarth', lever: k });
    const paid = t0 - h.g.stats.treasury;
    assert.equal(paid, leverCost(R.plant.capex, k), `${k} cost`);
    assert.ok(paid > 0 && paid <= 0.2 * R.plant.capex, `${k}: $${paid}M vs capex $${R.plant.capex}M`);
    assert.deepEqual(h.g.minerals.proj.rareEarth.levers, [k]);
    const t = untilOnline(h, 'rareEarth');
    assert.ok(t < base, `${k}: ${t}mo < ${base}mo unaided`);
    assert.equal(h.g.minerals.proj.rareEarth, undefined, 'levers are consumed when the plant comes online');
  }
  const all = headless('usa'); rich(all.g); const t0 = all.g.stats.treasury;
  for (const k of Object.keys(R.levers)) all.run('enactLever', { project: 'rareEarth', lever: k });
  assert.ok(t0 - all.g.stats.treasury < 0.5 * R.plant.capex, 'all five together cost under half the capex');
  const twice = headless('usa'); rich(twice.g); twice.run('enactLever', { project: 'rareEarth', lever: 'dpa' }); const t1 = twice.g.stats.treasury;
  twice.run('enactLever', { project: 'rareEarth', lever: 'dpa' });
  assert.equal(twice.g.stats.treasury, t1, 'a lever in force cannot be bought twice');
});

test('margin levers bring an unprofitable mineral into reach; the offtake guarantee is a profitability floor', () => {
  const g0 = headless('usa');
  assert.ok(!projectOutlook(g0.g, 'gallium').profitable);
  for (const [k, m] of [['credit', 'cobalt'], ['guarantee', 'gallium']]) {
    assert.ok(!projectOutlook(g0.g, m).profitable, `${m} unprofitable unaided`);
    const h = headless('usa'); rich(h.g); h.run('enactLever', { project: m, lever: k });
    assert.ok(projectOutlook(h.g, m).profitable, `${k} makes ${m} investable`);
    assert.ok(untilOnline(h, m) < 80, `${k}: a ${m} plant gets built`);
  }
  const p = headless('usa'); rich(p.g); p.run('enactLever', { project: 'gallium', lever: 'permit' });
  assert.ok(!projectOutlook(p.g, 'gallium').profitable, 'faster permits do not make a loss-maker profitable');
});

test('done-when: sector royalties and tax are a ledger income line on new private capacity', () => {
  const h = headless('usa');
  assert.equal(sectorIncome(h.g).total, 0, 'start capacity is already in the GDP tax base');
  h.month(); assert.equal(h.ui.ledger['Minerals sector'], undefined, 'no line before new capacity');
  untilOnline(h, 'rareEarth');
  const inc = sectorIncome(h.g);
  assert.ok(inc.by.rareEarth > 0, 'a new rare-earth plant pays royalties + tax');
  assert.equal(h.ui.ledger['Minerals sector'], inc.total, 'ledger line equals the shared formula');
  const ore = R.plant.add * MINERALS.rareEarth.price * (R.sector.tax + R.sector.royalty);
  assert.ok(Math.abs(inc.by.rareEarth - ore) < 1e-9, `${inc.by.rareEarth} = add x price x (tax + royalty)`);
  assert.equal(mineralView(h.g).find((r) => r.id === 'rareEarth').income, inc.by.rareEarth);
});

test('GGRB Phase II: the state authorizes, private capital builds the retort with zero capex; levers accelerate', () => {
  const ready = (h) => { h.g.defLevels = { ...h.g.defLevels, propulsion: 6, materials: 5 }; h.g.grrbState = { surveying: false, surveyMo: 0, unlocked: true }; h.g.resources = { ...h.g.resources, shaleOil: { r: 3000, max: 3000 } }; };
  const run = (levers) => {
    const h = headless('usa'); ready(h); rich(h.g); const t0 = h.g.stats.treasury;
    h.run('ggrbPhase2', {});
    assert.equal(h.g.stats.treasury, t0, 'authorizing costs the treasury nothing');
    assert.equal(h.g.grrbState.phase2, undefined, 'not online yet: private build first');
    for (const k of levers) h.run('enactLever', { project: 'retort', lever: k });
    assert.ok(t0 - h.g.stats.treasury < 0.5 * R.retort.capex);
    let k = 0; while (!h.g.grrbState.phase2 && k < 80) { h.month(); k++; }
    assert.ok(h.g.grrbState.phase2, 'retorting online');
    assert.equal(h.g.resources.shaleOil.r >= 4900, true, '+2,000 units recoverable');
    assert.deepEqual(checkV57(h.g), []);
    return k;
  };
  const slow = run([]); const fast = run(['permit', 'dpa']);
  assert.ok(slow <= R.retort.mo + 1 && fast < slow, `retort ${slow}mo unaided, ${fast}mo with permits + DPA`);
  const n = headless('usa'); rich(n.g); n.run('enactLever', { project: 'retort', lever: 'permit' });
  assert.equal(n.g.minerals.proj.retort, undefined, 'no lever before the state authorizes the project');
});

test('old saves: treasury-built plants under construction carry over as private progress; invariants guard projects', () => {
  const h = headless('usa');
  h.g.minerals = { ...h.g.minerals, plants: [{ m: 'enrichment', mo: 2 }] }; delete h.g.minerals.proj;
  h.month();
  assert.equal(h.g.minerals.plants, undefined);
  assert.ok(cap(h, 'enrichment') === MINERAL_START.usa.enrichment[1] + R.plant.add || h.g.minerals.proj.enrichment.prog >= R.plant.mo - 2);
  assert.deepEqual(checkV57(h.g), []);
  const bad = (proj) => { const x = headless('usa'); x.g.minerals = { ...x.g.minerals, proj }; return checkV57(x.g).some((n) => /private projects/.test(n)); };
  assert.ok(bad({ gallium: { prog: -1, levers: [] } }));
  assert.ok(bad({ gallium: { prog: R.plant.mo + 1, levers: [] } }));
  assert.ok(bad({ gallium: { prog: 0, levers: ['bribe'] } }));
  assert.ok(bad({ gallium: { prog: 0, levers: ['dpa', 'dpa'] } }));
  assert.ok(bad({ unobtainium: { prog: 0, levers: [] } }));
  assert.ok(!bad({ gallium: { prog: 3, levers: ['dpa'] }, retort: { prog: 0, levers: [] } }));
});

test('App: the treasury why-breakdown lists the minerals sector income; Processing shows private build and the levers', async () => {
  const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };
  const origErr = console.error; console.error = () => {};
  const g = await mount(BUNDLES.app, { seed: 7, testHook: true });
  try {
    await g.pickCountry(idx('usa')); g.w.__wl.fund(200000); await settle();
    g.w.__wl.mineral('enrichment', { cap: MINERAL_START.usa.enrichment[1] + R.plant.add }); await settle();
    g.w.__wl.month(); await settle();
    g.doc.querySelector('[data-why^="Treasury"]').click(); await settle();
    assert.match(g.doc.querySelector('[data-why-content^="Treasury"]').textContent, /Minerals sector/);
    g.doc.querySelector('[data-why^="Treasury"]').click(); await settle();
    g.tabBtn('resources').click(); await settle();
    g.doc.querySelector('[data-seg=processing]').click(); await settle();
    const row = (m) => g.doc.querySelector(`[data-mineral=${m}]`);
    assert.doesNotMatch(g.doc.querySelector('[data-minerals]').textContent, /Build plant/);
    assert.match(row('rareEarth').querySelector('[data-private]').textContent, /Private plant/);
    assert.match(row('gallium').querySelector('[data-private]').textContent, /not profitable/i);
    const lever = row('gallium').querySelector('[data-lever=guarantee]');
    assert.ok(lever, 'lever offered'); lever.click(); await settle();
    assert.equal(lever.getAttribute('aria-pressed'), 'true');
    assert.match(row('gallium').querySelector('[data-private]').textContent, /Private plant/);
    // Natural: survey the GGRB, authorize Phase II (no capex), pull a lever on the private retort build.
    g.w.__wl.levels({ materials: 5, propulsion: 6 }); await settle();
    g.doc.querySelector('[data-seg=natural]').click(); await settle();
    const tap = async (re) => { const b = [...g.doc.querySelectorAll('button')].find((x) => re.test(x.textContent)); assert.ok(b, `button ${re}`); b.click(); await settle(); };
    assert.match(g.doc.querySelector('[data-natural-note]').textContent, /royalties and tax/);
    await tap(/Commission Geological Survey/);
    for (let i = 0; i < 7; i++) { g.w.__wl.month(); await settle(); }
    g.w.__wl.fund(200000); await settle();
    await tap(/Activate Phase II — private build, \$0 capex/);
    const retort = () => g.doc.querySelector('[data-retort]');
    assert.ok(retort(), 'authorized retort shows its private build');
    assert.match(retort().textContent, /Private retort \d+% · ~\d+mo/);
    retort().querySelector('[data-lever=permit]').click(); await settle();
    assert.equal(retort().querySelector('[data-lever=permit]').getAttribute('aria-pressed'), 'true');
  } finally { console.error = origErr; g.close(); }
});
