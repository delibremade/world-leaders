import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGION_GEO, REGIONS } from '../src/data/regions.js';
import { CHOKEPOINTS } from '../src/data/chokepoints.js';
import { COUNTRIES } from '../src/data/nations.js';
import { parsePath, parseRegions, pointInPolygons, regionAt, area, WORLD } from '../src/ui/map/path.js';
import { buildScene, MAP_MODES } from '../src/ui/map/scene.js';
import { COLOR } from '../src/ui/tokens.js';
import { mount, flush, BUNDLES, gameEnded } from './util/harness.js';

// P3b gate: REGION_GEO parses into closed polygons, hit tests land, every map mode builds a full scene with
// every v57 overlay, and the App renders the map (SVG fallback in jsdom) with mode chips, legend and region taps.

const HEX = /^#[0-9a-f]{6}$/;
const parsed = parseRegions(REGION_GEO);

// The antimeridian wrap spills a few px past x=0; the frame check allows 40.
test('path: every REGION_GEO region parses into >=1 polygon of >=3 points inside the 1000x520 frame', () => {
  for (const [rid, g] of Object.entries(REGION_GEO)) {
    const polys = parsePath(g.d);
    assert.ok(polys.length >= 1, rid);
    for (const p of polys) { assert.ok(p.length >= 3); for (const [x, y] of p) { assert.ok(x >= -40 && x <= WORLD.w + 40 && y >= 0 && y <= WORLD.h, `${rid} ${x},${y}`); } }
    assert.ok(area(parsed[rid].main) > 100, `${rid} main island area`);
    assert.equal(polys.reduce((n, p) => n + p.length, 0), (g.d.match(/[ML]/g) || []).length, `${rid} every vertex kept`);
  }
});

test('path: hit test finds each region from inside its largest island, nothing in open ocean, tolerance ring near small islands', () => {
  for (const [rid, r] of Object.entries(parsed)) {
    if (rid === 'SEA') { assert.equal(pointInPolygons(r.polys, r.cx, r.cy), false, 'SEA label anchor sits in water (archipelago)'); assert.equal(regionAt(parsed, r.cx, r.cy, 30), 'SEA', 'tolerance ring catches it'); continue; }
    assert.equal(regionAt(parsed, r.cx, r.cy), rid, `${rid} hit at label anchor`);
  }
  assert.equal(regionAt(parsed, 500, 480), null, 'southern ocean');
  assert.equal(regionAt(parsed, REGION_GEO.PAC.cx + 2, REGION_GEO.PAC.cy + 2, 60), 'PAC', 'near-miss snaps to nearest centre');
});

const view = (over = {}) => ({ country: COUNTRIES[0], sphere: { NA: { player: 80, competitors: { china: 10 } }, EA: { player: 40, competitors: { china: 70 } }, ME: { player: 50, competitors: { russia: 40 } } }, ...over });

test('scene: six modes, ten regions each, valid fills, legend per mode, every v57 overlay present', () => {
  assert.deepEqual(MAP_MODES.map((m) => m.id), ['sphere', 'tension', 'trade', 'energy', 'military', 'intel']);
  const v = view({
    forceDeployments: { ME: { carrier: 2, frigate: 3 } }, flashpoint: { rid: 'AF', type: 'coup', t: 4 }, sphereTrend: { EA: -3, NA: 1 },
    intelOps: [{ targetId: 'china', monthsLeft: 2 }], defExports: { a: { buyerId: 'japan' } }, nationRelations: { france: 60 }, embassies: new Set(['india']), defensePacts: new Set(['japan']),
    chokeStatus: { hormuz: 'disrupted', panama: 'secured' }, rivalTension: { russia: 82, china: 30 }, blockades: { EA: { target: 'china' } }, tradeAgreements: new Set(['india']), importContracts: { saudi: 1 },
    embargoes: new Set(['venezuela']), forcePosture: { ME: 'escort' }, sanctions: new Set(['russia']), moles: { china: 1 }, expelled: {}, concessions: {},
  });
  for (const m of MAP_MODES) {
    const s = buildScene(v, m.id);
    assert.equal(s.mode, m.id); assert.equal(s.regions.length, 10);
    for (const r of s.regions) { assert.match(r.fill, HEX, `${m.id} ${r.rid}`); assert.match(r.stroke, HEX); assert.ok(r.fillAlpha > 0 && r.fillAlpha <= 1); assert.ok(typeof r.line2 === 'string' && r.line2.length); assert.ok(r.value >= 0 && r.value <= 1); assert.equal(r.name, REGIONS[r.rid].n); }
    assert.ok(s.legend.title && s.legend.items.length >= 5, 'legend');
    assert.equal(s.routes.length, 1, 'trade route to Japan'); assert.equal(s.routes[0].rid, 'EA');
    assert.ok(s.influence.some((l) => l.rid === 'EA' && l.strength === 3), 'pact line'); assert.ok(s.influence.some((l) => l.rid === 'WE' && l.strength === 1), 'relations line'); assert.ok(s.influence.some((l) => l.rid === 'SAS' && l.strength === 2), 'embassy line');
    assert.equal(s.chokepoints.length, Object.keys(CHOKEPOINTS).length);
    const hz = s.chokepoints.find((c) => c.k === 'hormuz'); assert.equal(hz.status, 'disrupted'); assert.ok(hz.ring); assert.equal(hz.color, COLOR.choke.disrupted);
    const me = s.regions.find((r) => r.rid === 'ME'); assert.equal(me.deployed, 5);
    const af = s.regions.find((r) => r.rid === 'AF'); assert.equal(af.flashpoint.t, 4); assert.equal(af.flashpoint.icon, '⚔️');
    assert.equal(s.regions.find((r) => r.rid === 'EA').trend, -3); assert.equal(s.regions.find((r) => r.rid === 'NA').trend, 0, 'below ±2 is not momentum');
    assert.ok(s.regions.find((r) => r.rid === 'EA').intel, 'intel dot from op on china');
  }
  const sphere = buildScene(v, 'sphere');
  assert.equal(sphere.regions.find((r) => r.rid === 'NA').line2, 'YOU 80%'); assert.equal(sphere.regions.find((r) => r.rid === 'EA').line2, 'CHINA 70%');
  assert.ok(sphere.regions.find((r) => r.rid === 'ME').hatch, 'contested within 15'); assert.ok(!sphere.regions.find((r) => r.rid === 'NA').hatch);
  const tension = buildScene(v, 'tension');
  assert.equal(tension.regions.find((r) => r.rid === 'EE').line2, 'RUSSIA 82'); assert.equal(tension.regions.find((r) => r.rid === 'EE').fill, COLOR.ramp.tension[3]);
  assert.equal(tension.regions.find((r) => r.rid === 'EA').line3, 'BLOCKADE');
  const trade = buildScene(v, 'trade'); assert.equal(trade.regions.find((r) => r.rid === 'SAS').line2, '1 DEAL'); assert.equal(trade.regions.find((r) => r.rid === 'EE').line3, '1 SANCTIONED');
  const energy = buildScene(v, 'energy'); assert.match(energy.regions.find((r) => r.rid === 'ME').line2, /HORMUZ ✕/); assert.ok(energy.chokepoints.find((c) => c.k === 'panama').mine, 'USA import route via Panama');
  const mil = buildScene(v, 'military'); assert.equal(mil.regions.find((r) => r.rid === 'ME').line2, '⚓ 5 DEPLOYED'); assert.equal(mil.regions.find((r) => r.rid === 'ME').line3, 'ESCORT'); assert.match(mil.regions.find((r) => r.rid === 'EA').line3, /BLOCKADE · CHINA/);
  const intel = buildScene(v, 'intel'); assert.equal(intel.regions.find((r) => r.rid === 'EA').line2, '1 OP LIVE'); assert.equal(intel.regions.find((r) => r.rid === 'EA').line3, '1 MOLE');
});

test('scene: the player never appears as a rival in tension mode (ruling 6)', () => {
  const s = buildScene(view({ rivalTension: { usa: 99, china: 10 } }), 'tension');
  assert.equal(s.regions.find((r) => r.rid === 'NA').line2, 'CHINA 10', 'home region reads the real rival, not the player');
  for (const r of s.regions) assert.ok(!/USA/.test(r.line2));
  assert.equal(buildScene(view({ rivalTension: { usa: 99 } }), 'tension').regions.find((r) => r.rid === 'NA').line2, 'CALM');
});

test('App: map renders (SVG fallback in jsdom), six mode chips switch fills and legend, region tap opens the panel, 120 months stay clean', async () => {
  const origErr = console.error; console.error = () => {};
  const g = await mount(BUNDLES.app, { testHook: true });
  try {
    await g.pickCountry(0);
    const { doc } = g;
    assert.equal(doc.querySelector('[data-map]')?.getAttribute('data-map-renderer'), 'svg');
    assert.equal(doc.querySelectorAll('[data-map-mode-btn]').length, 6);
    assert.equal(doc.querySelectorAll('svg g[data-region]').length, 10);
    const fillOf = (rid) => doc.querySelector(`svg g[data-region=${rid}] path`).getAttribute('fill');
    const before = fillOf('EA');
    doc.querySelector('[data-map-mode-btn=tension]').click(); await flush();
    assert.equal(doc.querySelector('[data-map]').getAttribute('data-map-mode'), 'tension');
    assert.match(doc.querySelector('[data-map-legend]').textContent, /Rival tension/);
    g.w.__wl.setTension('china', 90); await flush(); await flush();
    assert.equal(fillOf('EA'), COLOR.ramp.tension[4], 'EA goes red at tension 90');
    doc.querySelector('[data-map-mode-btn=sphere]').click(); await flush();
    assert.equal(fillOf('EA'), before, 'back to affiliation fill');
    const me = doc.querySelector('svg g[data-region=ME]'); me.dispatchEvent(new g.w.MouseEvent('click', { bubbles: true })); await flush();
    assert.match(g.text(), /Your Influence/, 'region panel opened');
    assert.ok(doc.querySelector('svg g[data-region=ME] path').getAttribute('stroke') === COLOR.text.primary, 'selected stroke');
    const months = await g.advance(120);
    assert.ok(!g.faulted()); assert.ok(months >= 120 || gameEnded(doc));
    assert.equal(doc.querySelectorAll('svg g[data-region]').length, 10, 'map still mounted');
  } finally { console.error = origErr; g.close(); }
});
