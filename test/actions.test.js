import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NATION_VERBS } from '../src/ui/shell/nation-verbs.js';
import { VERBS, applyVerb } from '../src/sim/actions.js';
import { newCampaign, STATE_FIELDS } from '../src/sim/state.js';
import { COUNTRIES } from '../src/data/nations.js';
import { REGIONS } from '../src/data/regions.js';
import { navalWeight } from '../src/sim/formulas.js';

// Headless verb harness: setters commit straight into g (functional updaters applied immediately); setters for
// presentation state (log, gameOver, ...) land in `ui`. Enough to unit-test a single verb outside React.
function headless(countryIdx = 0) {
  const g = newCampaign(COUNTRIES[countryIdx]);
  const ui = { log: [] }; const toasts = [];
  const S = new Proxy({}, { get: (_, name) => (v) => {
    const k = name[3].toLowerCase() + name.slice(4);
    const box = STATE_FIELDS.includes(k) ? g : ui;
    box[k] = typeof v === 'function' ? v(box[k]) : v;
  } });
  const fx = { toast: (m) => toasts.push(m), now: () => 0, defer: (fn) => fn() };
  return { g, ui, toasts, run: (type, payload) => applyVerb(g, S, fx, { type, payload }) };
}

// The UI's dispatch sites: App.jsx plus the P3c shell (event cards, nation sheet rows in nation-verbs.js).
const uiFiles = () => { const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(jsx?|js)$/.test(f) ? [p] : []; }); return walk('src/ui'); };
test('every verb the UI dispatches exists, and every verb is dispatched by the UI', () => {
  const used = new Set();
  for (const f of uiFiles()) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/dispatch\(\{ ?type: ?'(\w+)'/g)) used.add(m[1]);
    for (const m of src.matchAll(/type:\w+==='\w+'\?'(\w+)':'(\w+)'/g)) { used.add(m[1]); used.add(m[2]); }
  }
  for (const r of NATION_VERBS) used.add(r.type);
  assert.deepEqual([...used].sort(), Object.keys(VERBS).sort());
});

test('applyVerb rejects unknown verbs', () => {
  const h = headless();
  assert.throws(() => h.run('launchTheMissiles', {}), /Unknown verb/);
});

test('UI layer no longer writes game state: no ref writes or game setters in render handlers', () => {
  const src = readFileSync('src/ui/App.jsx', 'utf8');
  const body = src.slice(src.indexOf('const tick=useCallback'));
  assert.equal((body.match(/\b\w+R\.current\s*=(?!=)/g) || []).length, 0, 'ref writes after the engine seam');
  const UI = /^set(Phase|SelectedRegion|SelDipNation|SelIssue|IntelIssue|SelOption|RightMode|SelDefVert|SelExportVert|SelIntelTarget|T1Target|VitalsDrill|HovOpt|ActiveTab|Toasts|Collapsed|Paused|GameSpeed|SaveInfo|LastSaved|VictoryShown|Interval|MapMode|SelNation|OutlinerOpen|History)$/;
  // New Nation (back to country select) is session lifecycle, like startGame/restoreGame: it clears gameOver.
  const game = [...body.matchAll(/(?<![\w.])(set[A-Z]\w*)\(/g)].map((m) => m[1]).filter((n) => !UI.test(n) && n !== 'setGameOver');
  assert.deepEqual(game, []);
  assert.ok(!/\brng\(/.test(body), 'UI must not draw from the sim rng');
});

// Verbs the 120-month parity script cannot reach (sector age > 480 months) get a direct test.
test('modernizeSector: pays 30% of treasury, resets the 40-year clock and maturity, logs', () => {
  const h = headless();
  h.g.stats = { ...h.g.stats, treasury: 1000 };
  h.g.sectorAge = { defense: 500, energy: 10 }; h.g.sectorMaturity = { ...h.g.sectorMaturity, defense: 30 };
  h.run('modernizeSector', { sector: 'defense' });
  assert.equal(h.g.stats.treasury, 700);
  assert.equal(h.g.sectorAge.defense, 0); assert.equal(h.g.sectorAge.energy, 10);
  assert.equal(h.g.sectorMaturity.defense, 0);
  assert.match(h.ui.log[0].msg, /🛡️ Defense Modernization: −\$300M/);
});

test('recapitalizeForces: price clamps to $1.5B..$8B of treasury, +12 military, defense age reset', () => {
  const h = headless();
  h.g.stats = { ...h.g.stats, treasury: 5000, military: 95 }; h.g.sectorAge = { defense: 400, energy: 0 };
  h.run('recapitalizeForces', {});
  assert.equal(h.g.stats.treasury, 3500); assert.equal(h.g.stats.military, 100); assert.equal(h.g.sectorAge.defense, 0);
});

test('imfBailout clears game over: +$4,000M, stability +20 capped at 100', () => {
  const h = headless();
  h.g.stats = { ...h.g.stats, treasury: -5000, stability: 90 }; h.ui.gameOver = 'Treasury exhausted.';
  h.run('imfBailout');
  assert.equal(h.ui.gameOver, null); assert.equal(h.g.stats.treasury, -1000); assert.equal(h.g.stats.stability, 100);
});

test('payloads are nation-keyed: statecraft and sanctions act on the named nation only', () => {
  const h = headless();
  h.g.stats = { ...h.g.stats, treasury: 5000 };
  const before = { ...h.g.nationRelations };
  h.run('stateVisit', { nation: 'india' });
  assert.equal(h.g.nationRelations.india, before.india + 8);
  assert.equal(h.g.actionCooldowns.visit_india, 6);
  h.run('toggleSanctions', { nation: 'india' });
  assert.ok(h.g.sanctions.has('india')); assert.equal(h.g.sanctions.size, 1);
});

// #5 (ruling 7): the Situation Room lane and the Trade tab must charge the same bloc and ally costs.
for (const target of ['france', 'japan', 'saudi']) { // ally + EU member, ally only, OPEC member only
  test(`#5 sanctions on ${target}: imposeSanctions and toggleSanctions leave identical state`, () => {
    const setup = () => { const h = headless(); h.g.blocTrade = { ...h.g.blocTrade, eu: 2, opec: 2 }; h.g.stats = { ...h.g.stats, stability: 60 }; return h; };
    const a = setup(), b = setup();
    a.run('imposeSanctions', { nation: target }); b.run('toggleSanctions', { nation: target });
    assert.deepEqual(a.g.sanctions, b.g.sanctions); assert.deepEqual(a.g.blocTrade, b.g.blocTrade);
    assert.deepEqual(a.g.blocLock, b.g.blocLock); assert.deepEqual(a.g.stats, b.g.stats);
    assert.deepEqual(a.toasts, b.toasts);
  });
}

test('#5 sanctioning an ally member costs -4 stability, resets the bloc and locks it 12 months', () => {
  const h = headless(); h.g.blocTrade = { ...h.g.blocTrade, eu: 2 }; h.g.stats = { ...h.g.stats, stability: 60 };
  h.run('imposeSanctions', { nation: 'france' });
  assert.equal(h.g.stats.stability, 56); assert.equal(h.g.blocTrade.eu, 0); assert.equal(h.g.blocLock.eu, 12);
  h.run('imposeSanctions', { nation: 'france' }); // already on: no second charge
  assert.equal(h.g.stats.stability, 56);
});

// #6: map +/- deploy writes the live state like deployUnit/recallUnit.
// React-like setters: the committed value lands in `committed`, never in g, so only the verb's own live write counts.
function reactLike() {
  const g = newCampaign(COUNTRIES[0]); const committed = {}; const toasts = [];
  const S = new Proxy({}, { get: (_, name) => (v) => { const k = name[3].toLowerCase() + name.slice(4); committed[k] = typeof v === 'function' ? v(k in committed ? committed[k] : g[k]) : v; } });
  const fx = { toast: (m) => toasts.push(m), now: () => 0, defer: (fn) => fn() };
  return { g, committed, toasts, run: (type, payload) => applyVerb(g, S, fx, { type, payload }) };
}
const RID = Object.keys(REGIONS)[0];

test('#6 map + deploy updates live forceDeployments in the same month and cannot over-assign', () => {
  const h = reactLike(); h.g.platforms = { ...h.g.platforms, sub_fleet: 1 };
  h.run('adjustDeployment', { region: RID, unit: 'sub_fleet', delta: 1 });
  assert.equal(h.g.forceDeployments[RID]?.sub_fleet, 1, 'live g sees the unit before any render');
  h.run('adjustDeployment', { region: RID, unit: 'sub_fleet', delta: 1 }); // second quick press
  assert.equal(h.g.forceDeployments[RID].sub_fleet, 1, 'no over-assign');
  assert.equal(h.committed.forceDeployments[RID].sub_fleet, 1);
  assert.match(h.toasts.at(-1), /No free/);
});

test('#6 map - recall and the blockade naval-weight read see the live deployment', () => {
  const h = reactLike(); h.g.platforms = { ...h.g.platforms, carrier_group: 2, sub_fleet: 2 };
  for (const u of ['carrier_group', 'carrier_group', 'sub_fleet', 'sub_fleet']) h.run('adjustDeployment', { region: RID, unit: u, delta: 1 });
  assert.equal(navalWeight(h.g.forceDeployments[RID]), 4);
  h.run('adjustDeployment', { region: RID, unit: 'sub_fleet', delta: -1 });
  assert.equal(navalWeight(h.g.forceDeployments[RID]), 3);
});
