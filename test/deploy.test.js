import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERBS, applyVerb } from '../src/sim/actions.js';
import { newCampaign, STATE_FIELDS } from '../src/sim/state.js';
import { COUNTRIES } from '../src/data/nations.js';
import { PLATFORMS, BLACK_PROGRAMS, DEPLOYABLE } from '../src/data/platforms.js';
import { wSum } from '../src/sim/formulas.js';

// E1 (#13): the deployable set is data (`deployable:true`), not a literal list. Parity with v57 ends for the deploy list.
function headless() {
  const g = newCampaign(COUNTRIES[0]);
  const toasts = [];
  const S = new Proxy({}, { get: (_, name) => (v) => {
    const k = name[3].toLowerCase() + name.slice(4);
    const box = STATE_FIELDS.includes(k) ? g : (g.__ui ||= { log: [] });
    box[k] = typeof v === 'function' ? v(box[k]) : v;
  } });
  const fx = { toast: (m) => toasts.push(m), now: () => 0, defer: (fn) => fn() };
  return { g, toasts, run: (type, payload) => applyVerb(g, S, fx, { type, payload }) };
}
const own = (g, pid) => { if (BLACK_PROGRAMS[pid]) g.blackPrograms = { ...g.blackPrograms, [pid]: 1 }; else g.platforms = { ...g.platforms, [pid]: 1 }; };
const here = (g, rid, pid) => g.forceDeployments?.[rid]?.[pid] || 0;
const ALL = { ...PLATFORMS, ...BLACK_PROGRAMS };

test('DEPLOYABLE is derived from the deployable flag and includes f47', () => {
  assert.deepEqual([...DEPLOYABLE].sort(), Object.keys(ALL).filter((k) => ALL[k].deployable).sort());
  assert.ok(DEPLOYABLE.includes('f47'));
  for (const k of ['carrier_group', 'sub_fleet', 'fighter_wing', 'drone_swarm', 'fa_xx', 'mq25', 'frigate', 'zumwalt', 'b21', 'sr72', 'ssnx']) assert.ok(DEPLOYABLE.includes(k), k);
  assert.ok(!DEPLOYABLE.includes('cca'), 'CCA attaches to F-47, no standalone deploy');
  assert.equal(BLACK_PROGRAMS.cca.attachesTo, 'f47');
});

test('every platform flagged deployable can be stationed and recalled', () => {
  for (const pid of DEPLOYABLE) {
    const h = headless(); own(h.g, pid);
    h.run('adjustDeployment', { region: 'ME', unit: pid, delta: 1 });
    assert.equal(here(h.g, 'ME', pid), 1, `${pid} stationed`);
    h.run('adjustDeployment', { region: 'ME', unit: pid, delta: -1 });
    assert.equal(here(h.g, 'ME', pid), 0, `${pid} recalled`);
    h.run('deployUnit', { region: 'EA', unit: pid });
    assert.equal(here(h.g, 'EA', pid), 1, `${pid} via deployUnit`);
    h.run('recallUnit', { region: 'EA', unit: pid });
    assert.equal(here(h.g, 'EA', pid), 0);
  }
});

test('nothing outside the deployable set can be stationed, owned or not', () => {
  for (const pid of Object.keys(ALL).filter((k) => !ALL[k].deployable).concat('nonsense')) {
    const h = headless(); own(h.g, pid);
    h.run('deployUnit', { region: 'ME', unit: pid });
    h.run('adjustDeployment', { region: 'ME', unit: pid, delta: 1 });
    assert.equal(here(h.g, 'ME', pid), 0, `${pid} must not deploy`);
  }
});

test('cannot station more F-47 than are owned', () => {
  const h = headless(); own(h.g, 'f47');
  h.run('deployUnit', { region: 'ME', unit: 'f47' }); h.run('deployUnit', { region: 'EA', unit: 'f47' });
  assert.equal(here(h.g, 'ME', 'f47') + here(h.g, 'EA', 'f47'), 1);
});

test('CCA wings multiply stationed F-47 weight, capped at +50%, and do nothing alone', () => {
  const dep = { f47: 2, carrier_group: 1 };
  const base = wSum(dep, {});
  assert.equal(base, 3);
  assert.equal(wSum(dep, { f47: 2, cca: 1 }), 1 + 2 * (1 + 0.25));
  assert.equal(wSum(dep, { f47: 2, cca: 9 }), 1 + 2 * 1.5);
  assert.equal(wSum({ carrier_group: 1 }, { cca: 5 }), 1, 'no F-47 on station, no multiplier');
  assert.equal(wSum(dep), 3, 'black arg is optional');
});

test('UI derives the deploy and Order of Battle lists from data', () => {
  const src = readFileSync('src/ui/App.jsx', 'utf8');
  assert.ok(!/\['b21',\s*'sr72',\s*'ssnx'\]/.test(src), 'no literal black-program deploy list');
  assert.ok(!/'zumwalt','b21','sr72','ssnx'/.test(src), 'no literal deploy list');
  assert.ok(/DEPLOYABLE/.test(src));
});
