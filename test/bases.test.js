import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMonth, MONTH_PHASES } from '../src/sim/tick.js';
import { applyVerb, VERBS } from '../src/sim/actions.js';
import { newCampaign, STATE_FIELDS } from '../src/sim/state.js';
import { checkV57 } from '../src/sim/invariants.js';
import { COUNTRIES, NATIONS } from '../src/data/nations.js';
import { REGION_GEO } from '../src/data/regions.js';
import { CHOKEPOINTS } from '../src/data/chokepoints.js';
import { NODE_TYPES, NODE_IDS, SITES, SITE_IDS, REAL_BASES, BASE_RULES as R, project, unproject, distanceKm, KM_PER_PX } from '../src/data/bases.js';
import { newBases, nodeId, nodesOf, activeNodes, consent, siteOptions, siteView, basesView, coversChoke, coversRegion, chokesCovered, regionsCovered, kmToRegion, nodeCost, aiCandidates, AI_OWNERS, findNode } from '../src/sim/bases.js';
import { parseRegions, regionAt, WORLD } from '../src/ui/map/path.js';
import { setRngSource, mulberry32 } from '../src/sim/rng.js';
import { mount, flush, BUNDLES, gameEnded } from './util/harness.js';

// F9a (#57), spec Part 11: node types with reach and multipliers, real candidate sites, pre-placed real bases for every nation,
// host consent, costs per Part 3, AI placement. Effects land in F9c; the map build layer in F9b.
const idx = (id) => COUNTRIES.findIndex((c) => c.id === id);
function headless(nid = 'usa', seed = 1) {
  setRngSource(mulberry32(seed));
  const g = newCampaign(COUNTRIES[idx(nid)]); g.doctrine = 'hegemon'; g.gracePeriod = 999;
  const ui = { log: [], ledger: {} }; const toasts = [];
  const S = new Proxy({}, { get: (_, name) => (v) => {
    const k = name[3].toLowerCase() + name.slice(4);
    const box = STATE_FIELDS.includes(k) ? g : ui;
    box[k] = typeof v === 'function' ? v(box[k]) : v;
  } });
  const fx = { toast: (m) => toasts.push(m), now: () => 0, defer: (fn) => fn() };
  return { g, ui, toasts, month: () => runMonth(g, S, fx), run: (type, payload) => applyVerb(g, S, fx, { type, payload }) };
}
const months = (h, n) => { for (let i = 0; i < n; i++) { h.month(); assert.deepEqual(checkV57(h.g), [], `month ${i + 1}`); } };
const rich = (g) => { g.stats = { ...g.stats, treasury: 500000 }; };
const parsed = parseRegions(REGION_GEO);
// Real chokepoint coordinates (lon, lat) for the projection check against the v57 map markers.
// Ocean sites sit in no polygon and far from any coast; the rest must have their declared theater as the nearest coastline.
const OCEAN = ['guam', 'diegogarcia', 'honiara', 'lajes'];
// Two nearest coastlines (the Horn of Africa carries a stray Natural Earth fragment labelled EE one unit from Djibouti; REGION_GEO is generated, never hand-edited).
const nearestCoast = (x, y) => Object.entries(parsed).map(([rid, p]) => [rid, Math.sqrt(Math.min(...p.polys.flat().map(([px, py]) => (px - x) ** 2 + (py - y) ** 2)))]).sort((a, b) => a[1] - b[1]).slice(0, 2);
const CHOKE_LL = { hormuz: [56.3, 26.6], suez: [32.5, 30.5], bab: [43.3, 12.6], panama: [-79.6, 9.1], malacca: [101.0, 2.5] };

test('data: node types carry reach, capex, build months, upkeep, host payment and at least one multiplier; ports are private capital', () => {
  for (const id of NODE_IDS) {
    const t = NODE_TYPES[id];
    assert.ok(t.n && t.i && t.d, id);
    for (const k of ['reach', 'capex', 'mo', 'upkeep', 'host']) assert.ok(Number.isFinite(t[k]) && t[k] >= 0, `${id}.${k}`);
    assert.ok(t.mo > 0 && t.capex > 0, `${id} costs something and takes time`);
    assert.ok(Object.keys(t.mult).length >= 1 && Object.values(t.mult).every((v) => v > 0), `${id} multipliers`);
  }
  assert.ok(NODE_TYPES.port.private && NODE_TYPES.port.upkeep === 0 && NODE_TYPES.port.host === 0, 'port: private capital, enabling share only');
  assert.ok(NODE_TYPES.naval.mult.choke >= 1.5 && NODE_TYPES.air.mult.sortie > 0 && NODE_TYPES.radar.mult.isr >= 3, 'the three headline multipliers');
});

test('data: the projection reproduces the v57 chokepoint markers from real coordinates; every site lands in the frame and in its declared theater', () => {
  for (const [k, [lon, lat]] of Object.entries(CHOKE_LL)) { const p = project(lon, lat); const c = CHOKEPOINTS[k]; assert.ok(Math.hypot(p.x - c.x, p.y - c.y) <= 12, `${k}: projected ${p.x},${p.y} vs marker ${c.x},${c.y}`); }
  const u = unproject(647, 210); assert.ok(Math.abs(u.lon - 56.5) < 1 && Math.abs(u.lat - 26.6) < 1, 'unproject inverts');
  assert.ok(Math.abs(KM_PER_PX - 30.4) < 0.1);
  assert.ok(distanceKm({ lon: 43.1, lat: 11.5 }, { lon: 43.3, lat: 12.6 }) < 130, 'Djibouti to Bab al-Mandab');
  for (const sid of SITE_IDS) {
    const s = SITES[sid];
    assert.ok(s.n && s.status_source && REGION_GEO[s.region] && s.types.length >= 1 && s.types.every((t) => NODE_TYPES[t]), sid);
    assert.ok((s.host && NATIONS[s.host]) || (!s.host && s.local), `${sid}: host is a NATIONS id or a named local host`);
    assert.ok(s.x >= -40 && s.x <= WORLD.w + 40 && s.y >= 0 && s.y <= WORLD.h, `${sid} in frame ${s.x},${s.y}`);
    const hit = regionAt(parsed, s.x, s.y, 0);
    if (hit) assert.equal(hit, s.region, `${sid} sits in ${hit}, declared ${s.region}`);
    else if (!OCEAN.includes(sid)) assert.ok(nearestCoast(s.x, s.y).slice(0, 2).some(([rid, d]) => rid === s.region && d <= 25), `${sid}: coastal site's nearest coastline (within 25 units, Okinawa is 18 from the mainland polygon) is its theater: ${JSON.stringify(nearestCoast(s.x, s.y))}`);
    else assert.ok(kmToRegion({ lon: s.lon, lat: s.lat }, s.region) < 2600, `${sid}: ocean site within 2600 km of its theater`);
  }
});

test('data: every playable nation starts with real bases (status_source each); the named US, Chinese and Russian ones are present; every line fits its site', () => {
  for (const c of COUNTRIES) { const mine = REAL_BASES.filter((b) => b.owner === c.id); assert.ok(mine.length >= 1, c.id); for (const b of mine) assert.ok(b.status_source, `${b.owner} ${b.site}`); }
  for (const b of REAL_BASES) assert.ok(SITES[b.site] && SITES[b.site].types.includes(b.type) && NATIONS[b.owner], `${b.owner} ${b.site} ${b.type}`);
  const has = (o, s) => REAL_BASES.some((b) => b.owner === o && b.site === s);
  for (const s of ['guam', 'diegogarcia', 'kadena', 'rota', 'djibouti', 'bahrain']) assert.ok(has('usa', s), `usa ${s}`);
  for (const s of ['djibouti', 'ream']) assert.ok(has('china', s), `china ${s}`);
  assert.ok(has('russia', 'tartus'));
  assert.equal(new Set(REAL_BASES.map((b) => nodeId(b.owner, b.site, b.type))).size, REAL_BASES.length, 'no duplicate pre-placed node');
  assert.ok(REAL_BASES.find((b) => b.site === 'guantanamo').lease, 'Guantanamo is a lease');
});

test('new campaign: g.bases holds every real base active; the player owns its nation\'s; invariants hold; the phase runs after forces; plain JSON', () => {
  const h = headless('usa'); const b = h.g.bases;
  assert.equal(b.nodes.length, REAL_BASES.length); assert.ok(b.nodes.every((n) => n.status === 'active' && n.mo === 0));
  assert.equal(nodesOf(h.g).length, REAL_BASES.filter((x) => x.owner === 'usa').length);
  assert.deepEqual(checkV57(h.g), []);
  assert.deepEqual(JSON.parse(JSON.stringify(b)), b, 'plain data');
  const ids = MONTH_PHASES.map((p) => p.id); assert.ok(ids.indexOf('bases') > ids.indexOf('forces') && ids.indexOf('bases') < ids.indexOf('pressure'));
  assert.ok(STATE_FIELDS.includes('bases')); assert.ok(VERBS.buildNode && VERBS.closeNode);
  for (const c of COUNTRIES) assert.ok(nodesOf({ bases: newBases(c.id), country: c }).length >= 1, c.id);
});

test('reach: a naval base at Djibouti holds Bab al-Mandab and not Malacca; Guam reaches no chokepoint; a radar at Pituffik covers North America', () => {
  const dj = { site: 'djibouti', type: 'naval' }; const gu = { site: 'guam', type: 'naval' }; const pt = { site: 'pituffik', type: 'radar' }; const bh = { site: 'bahrain', type: 'naval' };
  assert.ok(coversChoke(dj, 'bab')); assert.ok(!coversChoke(dj, 'malacca')); assert.deepEqual(chokesCovered(dj), ['bab']);
  assert.deepEqual(chokesCovered(gu), []); assert.deepEqual(chokesCovered(bh), ['hormuz']);
  assert.ok(coversRegion(dj, 'AF'), 'its own theater'); assert.ok(coversRegion(dj, 'ME'), 'the Arabian coast is within 1500 km'); assert.ok(!coversRegion(dj, 'EA') && !coversRegion(dj, 'WE'));
  assert.deepEqual(regionsCovered(gu), ['PAC'], 'Guam reaches no other coastline within 1500 km');
  assert.ok(regionsCovered({ site: 'kadena', type: 'air' }).includes('EA') && regionsCovered({ site: 'kadena', type: 'air' }).includes('SEA') && !regionsCovered({ site: 'kadena', type: 'air' }).includes('SAS'), 'Okinawa air: East Asia and the northern Philippines, not South Asia');
  assert.ok(coversRegion(pt, 'NA')); assert.ok(regionsCovered(pt).includes('NA'));
  assert.ok(regionsCovered({ site: 'rio', type: 'port' }).includes('SA') && !regionsCovered({ site: 'rio', type: 'port' }).includes('NA'), 'a port (reach 0) covers only its own theater');
});

test('consent: own soil and allies always; a neutral registry host needs relations 20 (or a pact) and closes below 0 or under sanctions; a local host reads your sphere; a lease never lapses', () => {
  const h = headless('usa'); const g = h.g;
  assert.ok(consent(g, 'norfolk').ok && consent(g, 'rota').ok, 'own soil, allied Spain');
  g.nationRelations.turkey = 0; assert.ok(!consent(g, 'incirlik').ok && !consent(g, 'incirlik').lost); assert.match(consent(g, 'incirlik').reason, /need 20/);
  g.nationRelations.turkey = 25; assert.ok(consent(g, 'incirlik').ok);
  g.nationRelations.turkey = 0; g.defensePacts.add('turkey'); assert.ok(consent(g, 'incirlik').ok, 'a pact consents'); g.defensePacts.delete('turkey');
  g.nationRelations.turkey = -5; assert.ok(consent(g, 'incirlik').lost);
  g.nationRelations.turkey = 50; g.sanctions.add('turkey'); assert.ok(consent(g, 'incirlik').lost); assert.match(consent(g, 'incirlik').reason, /sanction/); g.sanctions.delete('turkey');
  g.sphere.AF = { ...g.sphere.AF, player: 20 }; assert.ok(consent(g, 'djibouti').ok);
  g.sphere.AF = { ...g.sphere.AF, player: 10 }; assert.ok(!consent(g, 'djibouti').ok && !consent(g, 'djibouti').lost, 'hysteresis band: the start position keeps Lemonnier but opens nothing new');
  g.sphere.AF = { ...g.sphere.AF, player: 5 }; assert.ok(consent(g, 'djibouti').lost);
  g.nationRelations.cuba = -40; g.sanctions.add('cuba');
  assert.ok(consent(g, 'guantanamo', findNode(g, 'usa', 'guantanamo', 'naval')).ok, 'the 1903 lease'); assert.ok(consent(g, 'guantanamo').lost, 'but you could not build anew there');
});

test('host collapse closes a base and consent restored reopens it after the wait; closure is logged and toasted', () => {
  const h = headless('usa'); const g = h.g; rich(g);
  const dj = findNode(g, 'usa', 'djibouti', 'sof'); assert.equal(dj.status, 'active');
  g.sphere.AF = { ...g.sphere.AF, player: 5 };
  months(h, 1);
  assert.equal(findNode(g, 'usa', 'djibouti', 'sof').status, 'closed'); assert.ok(h.toasts.some((t) => /Djibouti closes your SOF forward staging/.test(t)), h.toasts.join('|')); assert.ok(h.ui.log.some((l) => /Base closed by host/.test(l.msg)));
  assert.ok(basesView(g).closed.length === 1 && activeNodes(g).every((n) => n.site !== 'djibouti'));
  g.sphere.AF = { ...g.sphere.AF, player: 40 };
  for (let i = 0; i < R.reopenMo; i++) { g.sphere.AF = { ...g.sphere.AF, player: 40 }; months(h, 1); }
  assert.equal(findNode(g, 'usa', 'djibouti', 'sof').status, 'active', 'reopened'); assert.ok(h.toasts.some((t) => /reopened/.test(t)));
  // a sanctioned registry host closes a base too (Osan, South Korea)
  g.sanctions.add('skorea'); months(h, 1); assert.equal(findNode(g, 'usa', 'osan', 'air').status, 'closed');
  assert.ok(!g.bases.nodes.some((n) => n.owner !== 'usa' && n.status === 'closed'), 'AI nodes never close');
});

test('costs: upkeep on active nodes and basing agreements on foreign soil hit the treasury each month under their own ledger lines; building and closed nodes pay no upkeep', () => {
  const h = headless('usa'); const g = h.g; rich(g);
  const v = basesView(g); assert.ok(v.upkeep > 0 && v.hostPay > 0);
  months(h, 1);
  assert.equal(h.ui.ledger['Base upkeep'], -v.upkeep); assert.equal(h.ui.ledger['Basing agreements'], -v.hostPay);
  assert.equal(nodeCost('naval', 'norfolk', 'usa').host, 0, 'no agreement on own soil'); assert.equal(nodeCost('naval', 'bahrain', 'usa').host, NODE_TYPES.naval.host);
  const cuba = headless('cuba'); months(cuba, 1); assert.equal(cuba.ui.ledger['Basing agreements'], undefined, 'Cuba holds only home bases'); assert.ok(cuba.ui.ledger['Base upkeep'] < 0);
  g.sphere.AF = { ...g.sphere.AF, player: 5 }; months(h, 1); const v2 = basesView(g);
  assert.equal(h.ui.ledger['Base upkeep'], -v2.upkeep); assert.ok(v2.upkeep < v.upkeep, 'the closed Djibouti compound stopped costing');
});

test('verb buildNode: refusals name the reason (type, consent, treasury); success charges capex, builds for mo months, then pays upkeep; closeNode decommissions', () => {
  const h = headless('usa'); const g = h.g; const t0 = g.stats.treasury;
  assert.equal(h.run('buildNode', { site: 'bahrain', type: 'garrison' }), false); assert.match(h.toasts.at(-1), /cannot host/);
  g.nationRelations.turkey = 0; assert.equal(h.run('buildNode', { site: 'incirlik', type: 'air' }), false); assert.match(h.toasts.at(-1), /relations 0/);
  g.stats = { ...g.stats, treasury: 100 }; assert.equal(h.run('buildNode', { site: 'norfolk', type: 'radar' }), false); assert.match(h.toasts.at(-1), /Need \$350M/);
  assert.equal(g.bases.nodes.length, REAL_BASES.length, 'nothing placed');
  g.stats = { ...g.stats, treasury: t0 };
  assert.match(siteOptions(g, 'subic').find((o) => o.type === 'naval').reason, /sphere in Southeast Asia is 10%/, 'a local host wants two points of sphere first');
  g.sphere.SEA = { ...g.sphere.SEA, player: 20 };
  const opts = siteOptions(g, 'subic'); assert.ok(opts.find((o) => o.type === 'naval').ok, 'Subic opens at sphere 20');
  assert.equal(h.run('buildNode', { site: 'subic', type: 'naval' }), true);
  assert.equal(g.stats.treasury, t0 - NODE_TYPES.naval.capex);
  const n = findNode(g, 'usa', 'subic', 'naval'); assert.equal(n.status, 'building'); assert.equal(n.mo, NODE_TYPES.naval.mo);
  assert.match(siteOptions(g, 'subic').find((o) => o.type === 'naval').reason, /Building, 24 mo/);
  assert.equal(h.run('buildNode', { site: 'subic', type: 'naval' }), false, 'no duplicate');
  const before = basesView(g).upkeep; rich(g);
  months(h, NODE_TYPES.naval.mo - 1); assert.equal(findNode(g, 'usa', 'subic', 'naval').status, 'building');
  months(h, 1); assert.equal(findNode(g, 'usa', 'subic', 'naval').status, 'active'); assert.ok(h.toasts.some((t) => /Subic Bay is operational/.test(t)));
  assert.equal(basesView(g).upkeep, before + NODE_TYPES.naval.upkeep); assert.ok(chokesCovered(findNode(g, 'usa', 'subic', 'naval')).length === 0 && regionsCovered(findNode(g, 'usa', 'subic', 'naval')).includes('SEA'));
  assert.equal(h.run('closeNode', { id: nodeId('usa', 'subic', 'naval') }), true); assert.equal(findNode(g, 'usa', 'subic', 'naval'), null);
  assert.equal(h.run('closeNode', { id: nodeId('china', 'ream', 'naval') }), false, 'not yours');
  const sv = siteView(g, 'djibouti'); assert.equal(sv.hostName, 'Djibouti'); assert.ok(sv.nodes.length >= 3 && sv.chokes.includes('bab') && sv.options.length === SITES.djibouti.types.length);
});

test('foreign presence draws tension from the top hostile competitor in that theater (never the player, never an ally)', () => {
  const h = headless('usa'); const g = h.g; rich(g); g.gracePeriod = 999;
  g.rivalTension = {}; months(h, 1);
  // Kadena/Yokosuka/Osan sit in EA where China holds 70: +0.25/mo; no entry for the player or for allies
  assert.ok(g.rivalTension.china >= R.foreignTension - 1e-9, JSON.stringify(g.rivalTension)); assert.ok(!('usa' in g.rivalTension) && !('germany' in g.rivalTension));
  const jp = headless('japan'); jp.g.rivalTension = {}; months(jp, 1); assert.ok(!('usa' in jp.g.rivalTension), 'the US is Japan\'s ally, not a rival');
});

test('AI placement: after the grace period rivals break ground where they lead, prefer chokepoint sites, respect the cap and never use the player\'s soil; deterministic per seed', () => {
  const play = (seed) => { const h = headless('usa', seed); h.g.gracePeriod = 0; rich(h.g); months(h, 72); return h; };
  const a = play(3), b = play(3);
  const aiNodes = a.g.bases.nodes.filter((n) => !REAL_BASES.some((r) => nodeId(r.owner, r.site, r.type) === n.id));
  assert.ok(aiNodes.length >= 3, `AI placed ${aiNodes.length}`);
  for (const n of aiNodes) { assert.ok(AI_OWNERS('usa').includes(n.owner), n.id); assert.notEqual(SITES[n.site].host, 'usa'); assert.ok(['building', 'active'].includes(n.status)); }
  for (const [o, k] of Object.entries(a.g.bases.ai)) { assert.ok(k <= R.ai.max && o !== 'usa'); assert.equal(aiNodes.filter((n) => n.owner === o).length, k); }
  assert.deepEqual(a.g.bases.nodes.map((n) => n.id), b.g.bases.nodes.map((n) => n.id), 'same seed, same bases');
  const near = aiNodes.filter((n) => chokesCovered(n).length).length; assert.ok(near >= 1, 'at least one AI node reaches a chokepoint');
  assert.ok(a.ui.log.some((l) => /breaks ground/.test(l.msg)));
  const c = aiCandidates(headless('usa').g, 'china'); assert.ok(c.some((x) => x.sid === 'djibouti'), 'China crowds Djibouti (sphere 55 in Africa)'); assert.ok(c.every((x) => SITES[x.sid].host !== 'usa'));
  assert.ok(!aiCandidates(headless('usa').g, 'russia').some((x) => x.sid === 'ramstein'), 'a western host never lets Russia in');
});

test('240 months, every playable nation: invariants hold every month with bases in play (grace 0, AI placing)', () => {
  for (const c of COUNTRIES) {
    const h = headless(c.id, 7); h.g.gracePeriod = 0; rich(h.g);
    months(h, 240);
    assert.ok(h.g.bases.nodes.length >= REAL_BASES.length, c.id);
  }
});

test('App: bases survive the autosave round trip and the test hook can set them; 24 months stay clean', async () => {
  const origErr = console.error; console.error = () => {};
  const g = await mount(BUNDLES.app, { testHook: true });
  try {
    await g.pickCountry(0);
    assert.equal(typeof g.w.__wl.bases, 'function');
    const months2 = await g.advance(24); assert.ok(!g.faulted()); assert.ok(months2 >= 24 || gameEnded(g.doc));
    const save = JSON.parse(g.saves.at(-1)); assert.ok(Array.isArray(save.bases?.nodes) && save.bases.nodes.length >= REAL_BASES.length, 'bases in the autosave');
    assert.ok(save.bases.nodes.some((n) => n.owner === 'usa' && n.site === 'guam'));
  } finally { console.error = origErr; g.close(); }
});
