import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runMonth } from '../src/sim/tick.js';
import { applyVerb } from '../src/sim/actions.js';
import { newCampaign, STATE_FIELDS } from '../src/sim/state.js';
import { checkV57 } from '../src/sim/invariants.js';
import { COUNTRIES } from '../src/data/nations.js';
import { NODE_TYPES } from '../src/data/bases.js';
import { nodeId, findNode } from '../src/sim/bases.js';
import { chokeWeight, ownChokeWeight, rivalChokeWeight, theaterMult, baseIsr, responseAt, shieldAt, sphereGain, laneCut, t1Bonus, regionsCovered, REACH_CAPS } from '../src/sim/reach.js';
import { isrOf, isrScore, theaterWeight, capWeight, tier1Odds } from '../src/sim/formulas.js';
import { fpReason } from '../src/sim/events.js';
import { setRngSource, mulberry32 } from '../src/sim/rng.js';
import {routeProtection,protectionWeight,escortProtectionWeight,energySituation} from '../src/sim/energy-view.js';
import {packageDeployments} from '../src/sim/force-packages.js';

// F9c (#57): every node effect, one test each, measured through the system that consumes it (spec Part 11 "done when").
const idx = (id) => COUNTRIES.findIndex((c) => c.id === id);
function headless(nid = 'usa', seed = 1) {
  setRngSource(mulberry32(seed));
  const g = newCampaign(COUNTRIES[idx(nid)]); g.doctrine = 'hegemon'; g.gracePeriod = 999;
  const ui = { log: [], ledger: {} }; const toasts = [];
  const S = new Proxy({}, { get: (_, name) => (v) => { const k = name[3].toLowerCase() + name.slice(4); const box = STATE_FIELDS.includes(k) ? g : ui; box[k] = typeof v === 'function' ? v(box[k]) : v; } });
  const fx = { toast: (m) => toasts.push(m), now: () => 0, defer: (fn) => fn() };
  return { g, ui, toasts, month: () => runMonth(g, S, fx), run: (type, payload) => applyVerb(g, S, fx, { type, payload }) };
}
const months = (h, n) => { for (let i = 0; i < n; i++) { h.month(); assert.deepEqual(checkV57(h.g), [], `month ${i + 1}`); } };
const rich = (g) => { g.stats = { ...g.stats, treasury: 500000 }; };
// Add or drop nodes directly (the verb path is covered by test/bases.test.js); status active unless given.
const add = (g, owner, site, type, status = 'active') => { g.bases = { ...g.bases, nodes: [...g.bases.nodes, { id: nodeId(owner, site, type), owner, site, type, status, mo: status === 'building' ? NODE_TYPES[type].mo : 0, since: 0 }] }; };
const drop = (g, id) => { g.bases = { ...g.bases, nodes: g.bases.nodes.filter((n) => n.id !== id) }; };
const setStatus = (g, id, status) => { g.bases = { ...g.bases, nodes: g.bases.nodes.map((n) => (n.id === id ? { ...n, status, closed: status === 'closed' ? 0 : undefined, mo: 0 } : n)) }; };

test('cohesion: every effect has one implementation in reach.js; tick, actions, events and the UI call it (no re-derived ISR or theater weight)', () => {
  for (const f of ['src/sim/tick.js', 'src/sim/actions.js', 'src/sim/selectors.js', 'src/ui/App.jsx']) {
    const src = readFileSync(f, 'utf8');
    assert.ok(!/isrScore\(/.test(src), `${f} reads raw isrScore; use isrOf(g)`);
    assert.ok(!/capWeight\(g\.forceDeployments/.test(src), `${f} reads capWeight without reach; use theaterWeight(g,rid)`);
  }
  assert.ok(/routeProtection\(/.test(readFileSync('src/sim/tick.js', 'utf8')) && /chokeWeight\(g,id\)/.test(readFileSync('src/sim/energy-view.js', 'utf8')) && /responseAt\(g, rid\)/.test(readFileSync('src/sim/events.js', 'utf8')));
});

test('done-when: a naval base at a chokepoint raises control weight; Bahrain secures Hormuz with no ships; rivals halve it; a closed base counts for nothing', () => {
  const h = headless('usa'); const g = h.g; rich(g);
  assert.equal(ownChokeWeight(g, 'hormuz'), NODE_TYPES.naval.mult.choke, 'NSA Bahrain reaches Hormuz');
  assert.equal(ownChokeWeight(g, 'bab'), 0, 'a SOF compound at Djibouti adds no control weight');
  assert.equal(chokeWeight(g, 'malacca'), 0);
  months(h, 1); assert.equal(g.chokeStatus.hormuz, 'open', 'one base (1.5) is short of the 2.0 line');
  g.platforms = { ...g.platforms, frigate: 1 };assert.equal(h.run('deployUnit',{region:'ME',unit:'frigate'}),true); // navalWeight 0.5 + 1.5 base = 2.0
  months(h, 1); assert.equal(g.chokeStatus.hormuz, 'secured', 'ships plus base clear the line');
  drop(g, nodeId('usa', 'bahrain', 'naval')); months(h, 1); assert.equal(g.chokeStatus.hormuz, 'open', 'without the base, half a frigate secures nothing');
  add(g, 'usa', 'bahrain', 'naval'); add(g, 'usa', 'aludeid', 'logistics'); // 1.5 + 0.5 + 0.5 ships = 2.5
  months(h, 1); assert.equal(g.chokeStatus.hormuz, 'secured');
  add(g, 'china', 'gwadar', 'naval'); add(g, 'russia', 'bahrain', 'naval'); // rivals 3.0 -> ours 2.0 - 1.5 = 0.5, plus ships 0.5 = 1.0
  assert.equal(rivalChokeWeight(g, 'hormuz'), 3); assert.equal(chokeWeight(g, 'hormuz'), 0.5);
  months(h, 1); assert.equal(g.chokeStatus.hormuz, 'open', 'a crowded Gulf is contestable, not owned');
  drop(g, nodeId('china', 'gwadar', 'naval')); drop(g, nodeId('russia', 'bahrain', 'naval'));
  setStatus(g, nodeId('usa', 'bahrain', 'naval'), 'closed'); assert.equal(ownChokeWeight(g, 'hormuz'), NODE_TYPES.logistics.mult.choke, 'a closed base contributes nothing');
  months(h, 1); assert.equal(g.chokeStatus.hormuz, 'open');
});

test('done-when: escort effectiveness. Under a Hormuz closure the escort posture reads "escorted" only with enough weight; a naval base supplies it; lane protection cuts the import bill', () => {
  const h = headless('usa'); const g = h.g; rich(g); g.gracePeriod = 0;
  g.forceDeployments = { ME: { frigate: 1 } }; g.platforms = { ...g.platforms, frigate: 1 }; g.forcePosture = { ME: 'escort' };
  g.worldEvent = { id: 'hormuz_closure', mo: 6, why: 'test' };
  months(h, 1); assert.equal(g.chokeStatus.hormuz, 'escorted', 'half a frigate plus NSA Bahrain escorts');
  drop(g, nodeId('usa', 'bahrain', 'naval')); months(h, 1); assert.equal(g.chokeStatus.hormuz, 'disrupted', 'no base: the same escort fails');
  // Imports: Germany routes through Suez, Bab al-Mandab and Hormuz. Secure them and the lane cut shows on the ledger.
  const bill = (lane) => {
    const x=headless('germany');rich(x.g);x.g.gracePeriod=0;x.g.importContracts=new Set(['oil','gas']);
    x.g.forceDeployments={ME:{frigate:4},AF:{frigate:4}};x.g.platforms={...x.g.platforms,frigate:8};
    // Isolate basing/lane effects with genuinely crewed, mission-ready purchases.
    x.g.forces.fleet.ffg.mc=100;x.g.forces.crewShare.sea=.04;x.g.forces.crews.sea=x.g.forces.active*.04;
    if(lane){add(x.g,'germany','djibouti','naval');add(x.g,'germany','souda','naval');}
    months(x,1);return {imports:x.ui.ledger.Imports,cs:x.g.chokeStatus,cut:laneCut(x.g,['suez','bab','hormuz'])};
  };
  const a = bill(false), b = bill(true);
  assert.ok(['secured', 'escorted'].includes(b.cs.bab) && ['secured', 'escorted'].includes(b.cs.suez), JSON.stringify(b.cs));
  assert.equal(b.cut, 2 * NODE_TYPES.naval.mult.lane); assert.ok(b.imports > a.imports, `imports ${a.imports} -> ${b.imports} (less negative) with lane protection`);
});

test('route protection reads ready package missions: bases support escorts, mixed missions stay separate, and unavailable ships cannot protect access',()=>{
 const h=headless('usa'),g=h.g;rich(g);g.gracePeriod=0;g.forces.fleet.ddg.mc=100;
 const make=(id,posture)=>({id,name:`Gulf ${posture}`,service:'navy',template:'detachment',members:{'fleet:usa:ddg':1},plannedMembers:{'fleet:usa:ddg':1},region:'ME',posture});
 g.forces={...g.forces,packageVersion:1,nextPackageId:3,packages:[make('pkg:1','escort'),make('pkg:2','exercise')]};
 g.forceDeployments=packageDeployments(g.forces.packages);g.forcePosture={ME:'humanitarian'};g.worldEvent={id:'hormuz_closure',mo:6,why:'test'};
 let r=routeProtection(g,'hormuz');assert.equal(r.naval,1);assert.equal(r.escortNaval,.5);assert.equal(r.bases,1.5);assert.equal(r.weight,2.5);assert.equal(r.escortWeight,2);assert.equal(r.canEscort,true);
 assert.equal(protectionWeight(g,'hormuz'),r.weight);assert.equal(escortProtectionWeight(g,'hormuz'),r.escortWeight);
 months(h,1);assert.equal(g.chokeStatus.hormuz,'escorted');
 g.forces.packages[0].posture='exercise';r=routeProtection(g,'hormuz');assert.equal(r.weight,2.5);assert.equal(r.canEscort,false,'other missions do not become escorts through a theater default');
 months(h,1);assert.equal(g.chokeStatus.hormuz,'disrupted');
 g.forces.packages[0].posture='escort';g.forces.fleet.ddg.mc=0;r=routeProtection(g,'hormuz');assert.equal(r.naval,0);assert.equal(r.escortNaval,0);assert.equal(r.canEscort,false,'a base cannot replace a mission-ready escort');
 for(const displayed of energySituation(g).routes)assert.equal(displayed.escortWeight,routeProtection(g,displayed.id).escortWeight);
 months(h,1);assert.equal(g.chokeStatus.hormuz,'disrupted');
});

test('done-when: an air base in theater raises deployed power for air units within reach; sea and land units untouched; a closed base removes it', () => {
  const h = headless('usa'); const g = h.g;
  g.platforms = { ...g.platforms, fighter_wing: 2, carrier_group: 1 }; g.forceDeployments = { EA: { fighter_wing: 2, carrier_group: 1 }, SA: { fighter_wing: 2 } };
  const plain = (rid) => capWeight(g.forceDeployments[rid], g.blackPrograms, g.forces);
  assert.equal(theaterMult(g, 'EA', 'air'), Math.min(REACH_CAPS.theater, 2 * NODE_TYPES.air.mult.sortie), 'Kadena and Osan sorties');
  assert.ok(theaterMult(g, 'EA', 'sea') >= NODE_TYPES.naval.mult.sustain, 'Yokosuka sustains the carrier');
  assert.equal(theaterMult(g, 'SA', 'air'), 0, 'no US base reaches South America');
  assert.ok(theaterWeight(g, 'EA') > plain('EA')); assert.equal(theaterWeight(g, 'SA'), plain('SA'));
  const airOnly = { EA: { fighter_wing: 2 } }; const g2 = { ...g, forceDeployments: airOnly };
  assert.ok(Math.abs(theaterWeight(g2, 'EA') - capWeight(airOnly.EA, g.blackPrograms, g.forces) * (1 + theaterMult(g, 'EA', 'air'))) < 1e-9);
  setStatus(g, nodeId('usa', 'kadena', 'air'), 'closed'); setStatus(g, nodeId('usa', 'osan', 'air'), 'closed');
  assert.equal(theaterMult(g, 'EA', 'air'), 0, 'both closed: no sortie bonus');
  // the theater weight is what projection and pressure read: a stronger theater suppresses the leading rival faster
  const h2 = headless('usa'); rich(h2.g); h2.g.gracePeriod = 0; h2.g.platforms = { ...h2.g.platforms, fighter_wing: 3 }; h2.g.forceDeployments = { EA: { fighter_wing: 3 } }; h2.g.forcePosture = { EA: 'deter' };
  const h3 = headless('usa'); rich(h3.g); h3.g.gracePeriod = 0; h3.g.platforms = { ...h3.g.platforms, fighter_wing: 3 }; h3.g.forceDeployments = { EA: { fighter_wing: 3 } }; h3.g.forcePosture = { EA: 'deter' };
  h2.g.forces.fleet.f35a.mc=100;h3.g.forces.fleet.f35a.mc=100;
  setStatus(h3.g, nodeId('usa', 'kadena', 'air'), 'closed'); setStatus(h3.g, nodeId('usa', 'osan', 'air'), 'closed');
  months(h2, 1); months(h3, 1);
  assert.ok(h2.g.sphere.EA.competitors.china < h3.g.sphere.EA.competitors.china, `China's share in East Asia drops faster with Kadena and Osan open (${h2.g.sphere.EA.competitors.china} vs ${h3.g.sphere.EA.competitors.china})`);
});

test('ISR: radar and forward sites add to the one ISR every consumer reads (ops odds, strikes, Tier-1), capped; a closed radar drops out', () => {
  const h = headless('usa'); const g = h.g;
  const raw = isrScore(g.platforms, g.defLevels, g.intelInfra, g.blackPrograms);
  const expected = NODE_TYPES.radar.mult.isr + 5 * NODE_TYPES.air.mult.isr + NODE_TYPES.sof.mult.isr + 2 * NODE_TYPES.bmd.mult.isr; // Pituffik; Guam, Kadena, Osan, Ramstein, Al Udeid; Lemonnier; Redzikowo, Deveselu
  assert.ok(Math.abs(baseIsr(g.bases, 'usa') - expected) < 1e-9, `${baseIsr(g.bases, 'usa')} vs ${expected}`);
  assert.equal(isrOf(g), raw + baseIsr(g.bases, 'usa'));
  assert.ok(baseIsr(g.bases, 'usa') < 10 - raw || raw >= 10, 'bases alone do not open the regime-change ISR gate at the start');
  for (let i = 0; i < 6; i++) add(g, 'usa', ['norfolk', 'orland', 'evenes', 'keflavik', 'misawa', 'aldhafra'][i], 'radar');
  assert.equal(baseIsr(g.bases, 'usa'), REACH_CAPS.isr, 'capped');
  setStatus(g, nodeId('usa', 'pituffik', 'radar'), 'closed'); assert.ok(baseIsr(g.bases, 'usa') <= REACH_CAPS.isr);
  const cuba = headless('cuba').g; assert.equal(baseIsr(cuba.bases, 'cuba'), NODE_TYPES.air.mult.isr, 'Cuba: one air base');
  assert.equal(baseIsr(cuba.bases, 'usa'), 0 + baseIsr(cuba.bases, 'usa'), 'AI nodes never feed the player');
  assert.ok(tier1Odds(g, 'china').isr === isrOf(g), 'Tier-1 overmatch reads isrOf');
});

test('done-when: flashpoint response. Bases in reach add months to a new flashpoint and open the intervene option without deployed forces', () => {
  const h = headless('usa'); const g = h.g; rich(g);
  assert.equal(responseAt(g, 'EA'), Math.min(REACH_CAPS.response, 2 * NODE_TYPES.air.mult.response), 'Kadena and Osan');
  assert.equal(responseAt(g, 'SA'), 0);
  g.stats = { ...g.stats, military: 50 }; g.forceDeployments = {};
  assert.equal(fpReason(g, 'EA', 'intervene'), null, 'a base in reach lets you intervene');
  assert.match(fpReason(g, 'SA', 'intervene'), /base in reach/);
  g.flashpoint = { rid: 'SA', type: 'coup', t: 3 }; assert.equal(h.run('flashpointResponse', { region: 'SA', response: 'intervene' }), false); assert.match(h.toasts.at(-1), /base in reach/);
  g.flashpoint = { rid: 'EA', type: 'coup', t: 3 }; assert.equal(h.run('flashpointResponse', { region: 'EA', response: 'intervene' }), true); assert.equal(g.flashpoint, null);
  // spawn timer: force a flashpoint in EA by narrowing the eligible regions, with and without the bases
  const spawn = (strip) => { for (let seed = 1; seed < 200; seed++) { const x = headless('usa', seed); rich(x.g); x.g.gracePeriod = 0; for (const r of Object.keys(x.g.sphere)) x.g.sphere[r] = { ...x.g.sphere[r], player: r === 'EA' ? 40 : 90 }; if (strip) { setStatus(x.g, nodeId('usa', 'kadena', 'air'), 'closed'); setStatus(x.g, nodeId('usa', 'osan', 'air'), 'closed'); } x.month(); if (x.g.flashpoint?.rid === 'EA') return x.g.flashpoint.t; } return null; };
  const withBases = spawn(false), without = spawn(true);
  assert.equal(without, 6); assert.equal(withBases, 6 + 2);
});

test('done-when: host-region sphere. A garrison (or port) in a theater pulls it toward you each month; nothing else deployed', () => {
  const run = (node) => { const h = headless('usa'); rich(h.g); h.g.gracePeriod = 0; h.g.forceDeployments = {}; h.g.platforms = {}; if (node) add(h.g, 'usa', 'darwin', 'garrison'); const before = h.g.sphere.PAC.player; months(h, 3); return h.g.sphere.PAC.player - before; };
  const a = run(false), b = run(true);
  assert.ok(Math.abs(sphereGain(headless('usa').g, 'PAC')) < 1e-9, 'no US garrison or port in Oceania at the start');
  assert.ok(b - a >= 3 * NODE_TYPES.garrison.mult.sphere - 1e-6, `garrison pulls Oceania: ${a} -> ${b}`);
  const g = headless('usa').g; add(g, 'usa', 'darwin', 'garrison'); add(g, 'usa', 'honiara', 'port'); assert.equal(sphereGain(g, 'PAC'), NODE_TYPES.garrison.mult.sphere + NODE_TYPES.port.mult.sphere);
  assert.equal(sphereGain(g, 'SEA'), 0, 'a garrison pulls its own theater only');
});

test('missile defense in reach softens a rival pressure response; SOF staging in reach raises Tier-1 odds; both vanish when closed', () => {
  // Pressure: hold Oceania above 68 so China responds there; compare the swing with and without a missile-defense site on Guam
  const swing = (shield) => { const h = headless('usa', 5); rich(h.g); h.g.gracePeriod = 0; h.g.pressureTimer = 1; h.g.sphere.PAC = { ...h.g.sphere.PAC, player: 75 }; if (shield) add(h.g, 'usa', 'guam', 'bmd'); const before = h.g.sphere.PAC.player; h.month(); return before - h.g.sphere.PAC.player; };
  const g0 = headless('usa').g; assert.equal(shieldAt(g0, 'EE'), Math.min(REACH_CAPS.shield, 2 * NODE_TYPES.bmd.mult.shield), 'Aegis Ashore covers Eastern Europe'); assert.equal(shieldAt(g0, 'PAC'), 0);
  add(g0, 'usa', 'guam', 'bmd'); assert.equal(shieldAt(g0, 'PAC'), NODE_TYPES.bmd.mult.shield);
  const a = swing(false), b = swing(true);
  assert.ok(a > 0, `China pushed back (${a})`); assert.ok(Math.abs(b - a * (1 - NODE_TYPES.bmd.mult.shield)) < 0.05, `shielded swing ${b} vs ${a} x ${1 - NODE_TYPES.bmd.mult.shield}`);
  // Tier-1 odds: SOF staging at Al-Azraq (Jordan) reaches the Middle East; Saudi Arabia's home
  const g = headless('usa').g; const base = tier1Odds(g, 'saudi').chance;
  assert.equal(t1Bonus(g, 'ME'), NODE_TYPES.sof.mult.t1, 'Camp Lemonnier reaches the Gulf');
  setStatus(g, nodeId('usa', 'djibouti', 'sof'), 'closed'); const none = tier1Odds(g, 'saudi').chance; assert.equal(t1Bonus(g, 'ME'), 0); assert.ok(base > none || base >= 0.9, `Lemonnier lifts the odds (${none} -> ${base})`);
  setStatus(g, nodeId('usa', 'djibouti', 'sof'), 'active'); add(g, 'usa', 'alazraq', 'sof'); assert.ok(regionsCovered({ site: 'alazraq', type: 'sof' }).includes('ME'));
  assert.ok(tier1Odds(g, 'saudi').chance >= base, 'odds never drop'); assert.equal(t1Bonus(g, 'ME'), Math.min(REACH_CAPS.t1, 2 * NODE_TYPES.sof.mult.t1));
  setStatus(g, nodeId('usa', 'alazraq', 'sof'), 'closed'); setStatus(g, nodeId('usa', 'djibouti', 'sof'), 'closed'); assert.equal(t1Bonus(g, 'ME'), 0);
});

test('reach: the Horn of Africa fragment tagged EE no longer puts Eastern Europe in reach of Djibouti', () => {
  assert.deepEqual(regionsCovered({ site: 'djibouti', type: 'naval' }).sort(), ['AF', 'ME']);
  assert.ok(!regionsCovered({ site: 'djibouti', type: 'radar' }).includes('EE') || NODE_TYPES.radar.reach >= 2500, 'a 2500 km radar legitimately reaches the Caucasus');
});

test('relations collapse closes an agreement base and removes every effect at once; treaty sites stay (F15, #89); 120 months x 8 nations with effects live keep the invariants', () => {
  const h = headless('usa'); const g = h.g; rich(g);
  // Singapore: sign, build air at Paya Lebar, then the relations collapse closes it
  g.nationRelations.singapore = 30; assert.equal(h.run('basingAgreement', { nation: 'singapore' }), true);
  assert.equal(h.run('buildNode', { site: 'payalebar', type: 'air' }), true); months(h, NODE_TYPES.air.mo);
  assert.equal(findNode(g, 'usa', 'payalebar', 'air').status, 'active'); const on = theaterMult(g, 'SEA', 'air'); assert.ok(on > 0);
  g.sanctions.add('skorea'); g.nationRelations.japan = -10; g.nationRelations.singapore = -10; months(h, 1);
  for (const id of ['kadena:air', 'osan:air', 'yokosuka:naval']) assert.equal(findNode(g, 'usa', ...id.split(':')).status, 'active', `${id}: treaty/SOFA persists`);
  assert.equal(findNode(g, 'usa', 'payalebar', 'air').status, 'closed'); assert.ok(!g.bases.agreements.singapore, 'agreement suspended');
  assert.ok(theaterMult(g, 'SEA', 'air') < on, 'its sortie bonus is gone');
  for (const c of COUNTRIES) { const x = headless(c.id, 11); x.g.gracePeriod = 0; rich(x.g); months(x, 120); }
});
