import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMonth } from '../src/sim/tick.js';
import { applyVerb } from '../src/sim/actions.js';
import { newCampaign, STATE_FIELDS } from '../src/sim/state.js';
import { checkV57 } from '../src/sim/invariants.js';
import { accessGates } from '../src/sim/selectors.js';
import { mineralFlows, programSupply, inputsOf, bindingMineral, mineralView, rivalSupplyFactor } from '../src/sim/minerals.js';
import { MINERALS, MINERAL_IDS, MINERAL_START, MINERAL_RULES } from '../src/data/minerals.js';
import { BLACK_PROGRAMS, CATALOGS } from '../src/data/platforms.js';
import { COUNTRIES, NATIONS } from '../src/data/nations.js';
import { setRngSource, mulberry32 } from '../src/sim/rng.js';
import { mount, BUNDLES } from './util/harness.js';

// E4 (#16): minerals and processing (spec Part 3). Ore -> processing -> refined stockpile; production tranches declare
// inputs and slow in proportion to the shortfall; levers: plants, offtake, stockpile, recycling, allied pact, export controls.
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
  return { g, toasts, month: () => runMonth(g, S, fx), run: (type, payload) => applyVerb(g, S, fx, { type, payload }) };
}
const own = (g, m) => g.minerals.own[m];
const setOwn = (g, m, o) => { g.minerals = { ...g.minerals, own: { ...g.minerals.own, [m]: { ...g.minerals.own[m], ...o } } }; };
const rich = (g) => { g.stats = { ...g.stats, treasury: 200000 }; };
// Months until the queued F-35 tranche delivers (cap 60).
const untilDelivered = (h, id = 'f35') => { const n0 = +h.g.blackPrograms[id] || 0; let k = 0; while ((+h.g.blackPrograms[id] || 0) === n0 && k < 60) { h.month(); k++; } return k; };

test('data: ten minerals, three stocks per nation, China dominant in processing, the USA ore-rich and processing-poor', () => {
  assert.deepEqual(MINERAL_IDS, ['rareEarth', 'gallium', 'germanium', 'graphite', 'lithium', 'cobalt', 'nickel', 'tungsten', 'titanium', 'enrichment']);
  for (const n of Object.keys(MINERAL_START)) assert.ok(NATIONS[n], `${n} is in NATIONS (one registry)`);
  const capOf = (n, m) => MINERAL_START[n]?.[m]?.[1] || 0;
  const top = MINERAL_IDS.filter((m) => Object.keys(MINERAL_START).every((n) => capOf('china', m) >= capOf(n, m)));
  assert.ok(top.length >= 7, `China leads processing of ${top.length}/10`);
  const poor = MINERAL_IDS.filter((m) => MINERAL_START.usa[m][0] >= 20 && MINERAL_START.usa[m][1] <= 2);
  assert.ok(poor.length >= 4, `USA ore-rich, processing-poor in ${poor.join(', ')}`);
  for (const id of Object.keys(BLACK_PROGRAMS)) {
    const inp = inputsOf(id);
    assert.ok(Object.keys(inp).length > 0, `${id} declares tranche inputs`);
    for (const [m, u] of Object.entries(inp)) assert.ok(MINERALS[m] && u > 0, `${id}: ${m}`);
    assert.ok(MINERALS[bindingMineral(id)], `${id} binding mineral`);
  }
});

test('every playable nation starts with one tranche of each in-service line in stock (no crippled opening)', () => {
  for (const c of COUNTRIES) for (const e of (CATALOGS[c.id] || []).filter((x) => x.start === 'lrip' || x.start === 'full')) {
    const st = MINERAL_START[c.id];
    for (const [m, u] of Object.entries(inputsOf(e.id))) assert.ok((st?.[m]?.[2] || 0) >= u, `${c.id} ${e.id}: ${m} ${st?.[m]?.[2] || 0} < ${u}`);
  }
});

test('new campaign: the player holds its start ore, capacity and stockpile; flows split domestic / market', () => {
  const h = headless('usa');
  assert.equal(own(h.g, 'rareEarth').cap, MINERAL_START.usa.rareEarth[1]);
  assert.equal(own(h.g, 'gallium').stock, MINERAL_START.usa.gallium[2]);
  const f = mineralFlows(h.g).gallium;
  assert.equal(f.dom, 0); assert.ok(f.mkt > 5, `gallium from the world market ${f.mkt}`);
  assert.deepEqual(checkV57(h.g), []);
});

test('done-when: China export controls on gallium slow F-35 production proportionally; a gallium plant restores it', () => {
  const scenario = ({ controls, plant }) => {
    const h = headless('usa'); rich(h.g);
    for (const m of MINERAL_IDS) setOwn(h.g, m, { stock: 0 });
    if (controls) { h.g.rivalTension = { ...h.g.rivalTension, china: 80 }; }
    if (plant) { h.run('buildPlant', { mineral: 'gallium' }); h.g.minerals = { ...h.g.minerals, plants: h.g.minerals.plants.map((p) => ({ ...p, mo: 1 })) }; }
    h.month(); // controls take effect; a plant comes online
    for (const m of MINERAL_IDS) setOwn(h.g, m, { stock: 0 });
    h.run('sapTranche', { program: 'f35' });
    return h;
  };
  const open = scenario({ controls: false });
  assert.equal(open.g.minerals.queue.length, 1, 'empty stockpile: the tranche waits for supply, never cancels');
  const tOpen = untilDelivered(open);

  const cut = scenario({ controls: true });
  assert.ok(cut.g.minerals.against.china?.includes('gallium'), 'China controls gallium at tension 80');
  const sup = programSupply(cut.g, 'f35');
  assert.equal(sup.binding, 'gallium', 'binding mineral named');
  assert.ok(sup.coverage < 0.5, `coverage ${sup.coverage}`);
  assert.ok(cut.toasts.some((t) => /Gallium/.test(t) && /slow/i.test(t)), 'the slowdown is announced with its mineral');
  const tCut = untilDelivered(cut);
  assert.ok(tCut >= 3 * tOpen, `controlled ${tCut}mo vs open ${tOpen}mo`);
  // Proportional: months to deliver track need / monthly inflow of the binding mineral.
  const need = inputsOf('f35').gallium; const inflow = mineralFlows(cut.g).gallium.total;
  assert.ok(Math.abs(tCut - Math.ceil(need / inflow)) <= 1, `${tCut}mo ~ ${need}/${inflow.toFixed(2)}`);

  const fixed = scenario({ controls: true, plant: true });
  assert.ok(own(fixed.g, 'gallium').cap >= MINERAL_RULES.plant.add, 'plant online');
  const tFixed = untilDelivered(fixed);
  assert.ok(tFixed < tCut, `with a plant ${tFixed}mo < ${tCut}mo`);
  for (const h of [open, cut, fixed]) assert.deepEqual(checkV57(h.g), []);
});

test('an embargo by a processor, or our sanctions on it, cut its mineral exports to us; the player is never keyed', () => {
  const a = headless('usa'); a.g.embargoedBy = { by: 'china', mo: 12 }; a.month();
  assert.ok(a.g.minerals.against.china?.length > 0, 'embargo -> controls');
  const b = headless('usa'); b.g.sanctions = new Set(['russia']); b.month();
  assert.ok(b.g.minerals.against.russia?.includes('enrichment'));
  assert.ok(!('usa' in b.g.minerals.against));
  const before = mineralFlows(headless('usa').g).enrichment.mkt;
  assert.ok(mineralFlows(b.g).enrichment.mkt < before, 'enrichment market shrinks');
});

test('lever: processing plant costs capex, takes years, then adds capacity and charges upkeep', () => {
  const h = headless('usa'); rich(h.g);
  const t0 = h.g.stats.treasury;
  h.run('buildPlant', { mineral: 'rareEarth' });
  assert.equal(t0 - h.g.stats.treasury, MINERAL_RULES.plant.capex);
  assert.equal(h.g.minerals.plants[0].mo, MINERAL_RULES.plant.mo);
  const cap0 = own(h.g, 'rareEarth').cap;
  for (let i = 0; i < MINERAL_RULES.plant.mo; i++) h.month();
  assert.equal(own(h.g, 'rareEarth').cap, cap0 + MINERAL_RULES.plant.add);
  assert.equal(h.g.minerals.built.rareEarth, 1);
  const v = mineralView(h.g).find((r) => r.id === 'rareEarth');
  assert.ok(v.upkeep >= MINERAL_RULES.plant.upkeep);
});

test('lever: offtake deal adds secure supply; price rises as relations fall; refused when the partner controls', () => {
  const h = headless('norway'); rich(h.g);
  h.g.nationRelations = { ...h.g.nationRelations, usa: 80 };
  const s0 = mineralFlows(h.g).rareEarth.secure;
  h.run('signOfftake', { mineral: 'rareEarth', nation: 'usa' });
  const d = h.g.minerals.deals[0];
  assert.ok(d && d.n === 'usa' && d.mo === MINERAL_RULES.offtake.term);
  assert.ok(mineralFlows(h.g).rareEarth.secure > s0);
  const cold = headless('norway'); rich(cold.g); cold.g.nationRelations = { ...cold.g.nationRelations, usa: 10 };
  cold.run('signOfftake', { mineral: 'rareEarth', nation: 'usa' });
  assert.ok(cold.g.minerals.deals[0].price > d.price, 'colder relations, dearer offtake');
  const twin = headless('norway'); rich(twin.g); twin.g.nationRelations = { ...twin.g.nationRelations, usa: 80 };
  h.month(); twin.month();
  assert.equal(h.g.minerals.deals[0].mo, d.mo - 1);
  assert.ok(Math.abs(twin.g.stats.treasury - h.g.stats.treasury - d.price) < 1, 'the deal is paid monthly');
  const u = headless('usa'); rich(u.g); u.g.rivalTension = { ...u.g.rivalTension, china: 90 }; u.month();
  u.run('signOfftake', { mineral: 'gallium', nation: 'china' });
  assert.equal(u.g.minerals.deals.length, 0, 'China will not sign while it controls gallium against us');
});

test('lever: strategic stockpile buy, hold, release', () => {
  const h = headless('usa'); rich(h.g);
  const t0 = h.g.stats.treasury;
  h.run('buyStockpile', { mineral: 'gallium' });
  assert.equal(own(h.g, 'gallium').reserve, MINERAL_RULES.stockpile.lot);
  assert.ok(h.g.stats.treasury < t0);
  setOwn(h.g, 'gallium', { stock: 0 }); h.g.rivalTension = { ...h.g.rivalTension, china: 90 };
  h.month(); assert.equal(own(h.g, 'gallium').reserve, MINERAL_RULES.stockpile.lot, 'held: reserve untouched');
  h.run('toggleStockpileRelease', { mineral: 'gallium' });
  setOwn(h.g, 'gallium', { stock: 0 }); h.month();
  assert.equal(own(h.g, 'gallium').reserve, MINERAL_RULES.stockpile.lot - MINERAL_RULES.stockpile.release);
  assert.ok(own(h.g, 'gallium').stock >= MINERAL_RULES.stockpile.release);
});

test('lever: recycling and the allied processing pact raise secure supply at a monthly cost', () => {
  const h = headless('norway'); rich(h.g);
  const f0 = mineralFlows(h.g).cobalt;
  h.run('toggleRecycling', { mineral: 'cobalt' });
  assert.ok(Math.abs(mineralFlows(h.g).cobalt.secure - (f0.secure + MINERAL_RULES.recycle.add)) < 1e-9);
  h.run('toggleRecycling', { mineral: 'enrichment' });
  assert.ok(!h.g.minerals.recycle.includes('enrichment'), 'enrichment cannot be recycled');
  const m0 = mineralFlows(h.g).titanium;
  h.run('toggleProcessingPact', {});
  assert.equal(h.g.minerals.pact, true);
  assert.ok(mineralFlows(h.g).titanium.secure > m0.secure, 'bloc partners (Japan titanium) become secure supply');
  const b = headless('brazil'); b.run('toggleProcessingPact', {});
  assert.equal(b.g.minerals.pact, false, 'a non-aligned nation has no bloc to pact with');
});

test('lever: export controls cut rivals\' supply and cost trade income and relations', () => {
  const ctl = headless('china'); const free = headless('china');
  const rel0 = ctl.g.nationRelations.japan;
  ctl.run('toggleExportControl', { mineral: 'gallium' });
  assert.ok(ctl.g.minerals.controls.includes('gallium'));
  assert.equal(ctl.g.nationRelations.japan, rel0 - MINERAL_RULES.controls.relHit, 'relations cost outside our bloc');
  assert.equal(ctl.g.nationRelations.china, free.g.nationRelations.china, 'never write the player');
  assert.ok(rivalSupplyFactor(ctl.g, 'usa') < 1 && rivalSupplyFactor(free.g, 'usa') === 1);
  for (let i = 0; i < 12; i++) { ctl.month(); free.month(); }
  const sum = (g) => Object.values(g.globalDef.usa).reduce((a, b) => a + b, 0);
  assert.ok(sum(ctl.g) < sum(free.g), 'US R&D grows slower under Chinese gallium controls');
  assert.ok(ctl.g.stats.treasury < free.g.stats.treasury, 'lost export sales');
  const u = headless('usa'); u.run('toggleExportControl', { mineral: 'gallium' });
  assert.ok(!u.g.minerals.controls.includes('gallium'), 'cannot control a mineral you do not process');
});

test('E7 mineral gate is the real chain: secure supply of the program\'s binding mineral; partners contribute monthly', () => {
  const h = headless('norway'); rich(h.g);
  h.g.nationRelations = { ...h.g.nationRelations, usa: 80 };
  const gate = () => accessGates(h.g, 'f47', 'partner').find((x) => x.id === 'minerals');
  assert.equal(gate().met, false, 'Norway refines no rare earths at start');
  assert.match(gate().label, new RegExp(MINERALS[bindingMineral('f47')].n));
  h.run('signOfftake', { mineral: bindingMineral('f47'), nation: 'usa' });
  assert.equal(gate().met, true);
  const twin = headless('norway'); rich(twin.g); twin.g.nationRelations = { ...twin.g.nationRelations, usa: 80 };
  twin.run('signOfftake', { mineral: bindingMineral('f47'), nation: 'usa' });
  h.run('joinProgram', { program: 'f47', tier: 'partner' });
  assert.equal(h.g.arsenal.access.f47.norway.tier, 'partner');
  h.month(); twin.month();
  const m = bindingMineral('f47');
  assert.equal(+(own(twin.g, m).stock - own(h.g, m).stock).toFixed(6), MINERAL_RULES.contribution, 'contribution drawn monthly');
});

test('invariants: stocks non-negative, capacity and stockpiles bounded, records well-formed (240-month lever fuzz)', () => {
  const VERBS = [['buildPlant', 'mineral'], ['signOfftake', 'both'], ['buyStockpile', 'mineral'], ['toggleStockpileRelease', 'mineral'], ['toggleRecycling', 'mineral'], ['toggleProcessingPact'], ['toggleExportControl', 'mineral'], ['sapTranche', 'program'], ['cancelOfftake', 'both']];
  for (const nid of ['usa', 'china', 'japan', 'norway']) {
    const h = headless(nid, 3); const r = mulberry32(99);
    const cat = (CATALOGS[nid] || []).map((e) => e.id); const partners = Object.keys(MINERAL_START).filter((n) => n !== nid);
    for (let mo = 0; mo < 240; mo++) {
      if (mo % 6 === 0) rich(h.g);
      for (let k = 0; k < 2; k++) {
        const [type, p] = VERBS[Math.floor(r() * VERBS.length)];
        const mineral = MINERAL_IDS[Math.floor(r() * 10)]; const nation = partners[Math.floor(r() * partners.length)];
        const payload = p === 'mineral' ? { mineral } : p === 'both' ? { mineral, nation } : p === 'program' ? { program: cat[Math.floor(r() * cat.length)] } : {};
        if (type !== 'sapTranche' || cat.length) h.run(type, payload);
      }
      if (mo % 24 === 5) h.g.rivalTension = { ...h.g.rivalTension, china: 85 };
      if (mo % 24 === 17) h.g.rivalTension = { ...h.g.rivalTension, china: 10 };
      h.month();
      assert.deepEqual(checkV57(h.g), [], `${nid} month ${mo}`);
    }
  }
  const h = headless('usa');
  setOwn(h.g, 'gallium', { stock: -1 }); assert.ok(checkV57(h.g).some((n) => /mineral stocks/.test(n)));
  setOwn(h.g, 'gallium', { stock: 0, cap: MINERAL_RULES.capMax + 1 }); assert.ok(checkV57(h.g).some((n) => /mineral stocks/.test(n)));
  setOwn(h.g, 'gallium', { cap: 0 }); h.g.minerals = { ...h.g.minerals, controls: ['gallium'] }; assert.ok(checkV57(h.g).some((n) => /export controls/.test(n)));
  h.g.minerals = { ...h.g.minerals, controls: [], against: { usa: ['gallium'] } }; assert.ok(checkV57(h.g).some((n) => /player/.test(n)));
  h.g.minerals = { ...h.g.minerals, against: {}, queue: [{ id: 'f35', left: { gallium: -2 }, need: { gallium: 2 } }] }; assert.ok(checkV57(h.g).some((n) => /queued tranches/.test(n)));
});

test('App: Resources shows the minerals view with every lever; Defense shows supply and the binding mineral when slowed', async () => {
  const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };
  const origErr = console.error; console.error = () => {};
  const g = await mount(BUNDLES.app, { seed: 7, testHook: true });
  try {
    await g.pickCountry(idx('usa')); g.w.__wl.fund(200000); await settle();
    g.tabBtn('resources').click(); await settle();
    const view = g.doc.querySelector('[data-minerals]');
    assert.ok(view, 'minerals view');
    assert.equal(view.querySelectorAll('[data-mineral]').length, 10);
    const row = (m = 'gallium') => g.doc.querySelector(`[data-mineral=${m}]`);
    const open = async (m) => { row(m).querySelector('[data-mineral-head]').click(); await settle(); };
    const press = async (re, root = row()) => { const b = [...root.querySelectorAll('button')].find((x) => re.test(x.textContent)); assert.ok(b, `button ${re}`); b.click(); await settle(); };
    await open('gallium');
    for (const re of [/Build plant/, /Buy reserve/, /Release/, /Recycl/]) await press(re);
    await press(/Offtake .*Japan/);
    assert.match(row().textContent, /plant .*36mo/i); assert.match(row().textContent, /reserve 10/i); assert.match(row().textContent, /Japan/);
    await press(/Processing pact/, view);
    await open('rareEarth');
    assert.ok([...row('rareEarth').querySelectorAll('button')].some((b) => /Export control/.test(b.textContent)), 'export control offered where we process');
    // Slow F-35 production: empty every stockpile, China controls its exports, produce.
    const drain = async () => { for (const m of MINERAL_IDS) g.w.__wl.mineral(m, { stock: 0, reserve: 0 }); await settle(); };
    await drain(); g.w.__wl.setTension('china', 90); await settle();
    g.w.__wl.month(); await settle(); await drain();
    g.tabBtn('defense').click(); await settle();
    const card = () => g.doc.querySelector('[data-program=f35]');
    assert.ok(card().querySelector('[data-supply]'), 'supply line on the program card');
    [...card().querySelectorAll('button')].find((b) => /Tranche|Produce/.test(b.textContent)).click(); await settle();
    const names = Object.keys(inputsOf('f35')).map((m) => MINERALS[m].n).join('|');
    assert.match(card().querySelector('[data-supply]').textContent, new RegExp(`slowed[^]*(${names})`, 'i'));
  } finally { console.error = origErr; g.close(); }
});
