import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERBS, applyVerb } from '../src/sim/actions.js';
import { newCampaign, STATE_FIELDS } from '../src/sim/state.js';
import { COUNTRIES } from '../src/data/nations.js';

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

test('every verb the App dispatches exists, and every verb is dispatched by the App', () => {
  const src = readFileSync('src/ui/App.jsx', 'utf8');
  const used = new Set([...src.matchAll(/dispatch\(\{type:'(\w+)'/g)].map((m) => m[1]));
  for (const m of src.matchAll(/type:\w+==='\w+'\?'(\w+)':'(\w+)'/g)) { used.add(m[1]); used.add(m[2]); }
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
  const UI = /^set(Phase|SelectedRegion|SelDipNation|SelIssue|SelOption|RightMode|SelDefVert|SelExportVert|SelIntelTarget|T1Target|VitalsDrill|HovOpt|ActiveTab|Toasts|Collapsed|Paused|GameSpeed|SaveInfo|LastSaved|VictoryShown|Interval)$/;
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
