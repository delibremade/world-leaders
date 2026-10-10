import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMonth } from '../src/sim/tick.js';
import { applyVerb } from '../src/sim/actions.js';
import { newCampaign, STATE_FIELDS } from '../src/sim/state.js';
import { checkV57 } from '../src/sim/invariants.js';
import { programStage, programView } from '../src/sim/selectors.js';
import { COUNTRIES } from '../src/data/nations.js';
import { BLACK_PROGRAMS, CATALOGS, SLOTS, STAGES, nationCatalog, DEPLOYABLE } from '../src/data/platforms.js';
import { sapRunCost, triadLegs, isrScore, navalWeight, wSum } from '../src/sim/formulas.js';
import { setRngSource, mulberry32 } from '../src/sim/rng.js';
import { buildOutliner } from '../src/ui/shell/outliner.js';
import { mount, BUNDLES } from './util/harness.js';

// E3 (#15): role slots filled per nation, stages R&D -> prototype -> LRIP -> full rate, real 2024 starting stages.
// Rule change: parity with v57 ends for the SAP catalog of non-US nations. The US keeps its v57 programs unchanged.
const idx = (id) => COUNTRIES.findIndex((c) => c.id === id);
function headless(nid = 'usa', seed = 1) {
  setRngSource(mulberry32(seed));
  const g = newCampaign(COUNTRIES[idx(nid)]); g.doctrine = 'hegemon';
  const ui = { log: [] }; const toasts = [];
  const S = new Proxy({}, { get: (_, name) => (v) => {
    const k = name[3].toLowerCase() + name.slice(4);
    const box = STATE_FIELDS.includes(k) ? g : ui;
    box[k] = typeof v === 'function' ? v(box[k]) : v;
  } });
  const fx = { toast: (m) => toasts.push(m), now: () => 0, defer: (fn) => fn() };
  return { g, toasts, month: () => runMonth(g, S, fx), run: (type, payload) => applyVerb(g, S, fx, { type, payload }) };
}
const cash = (g, v = 100000) => { g.stats = { ...g.stats, treasury: v }; };
const PLAYABLE = COUNTRIES.map((c) => c.id);
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };

test('every catalog entry is a known program with a valid 2024 start stage and a status_source', () => {
  const stages = STAGES.map(([k]) => k);
  for (const [nid, cat] of Object.entries(CATALOGS)) for (const e of cat) {
    assert.ok(BLACK_PROGRAMS[e.id], `${nid}/${e.id} known`);
    assert.ok(stages.includes(e.start), `${nid}/${e.id} start ${e.start}`);
    assert.ok(typeof e.status_source === 'string' && e.status_source.length > 8, `${nid}/${e.id} status_source`);
  }
  for (const nid of PLAYABLE) {
    assert.ok(CATALOGS[nid], `${nid} has a catalog`);
    const cat = nationCatalog(nid);
    for (const [slot] of SLOTS) assert.ok(cat.some((e) => BLACK_PROGRAMS[e.id].slot === slot), `${nid} fills ${slot}`);
    for (const e of cat) assert.ok(e.status_source, `${nid}/${e.id} status_source`);
  }
});

test('catalogs follow the spec table; the USA keeps the v57 programs in v57 order', () => {
  const ids = (nid) => nationCatalog(nid).map((e) => e.id);
  assert.deepEqual(ids('usa').slice(0, 5), ['b21', 'f47', 'cca', 'sr72', 'ssnx']);
  // Owner ruling on #15: real 2024 stages for the US too (B-21 LRIP, CCA prototype); F-47, SR-72, SSN(X) stay R&D.
  for (const [id, st] of [['b21', 'lrip'], ['f47', 'rd'], ['cca', 'proto'], ['sr72', 'rd'], ['ssnx', 'rd']]) assert.equal(nationCatalog('usa').find((e) => e.id === id).start, st, `${id} 2024 start`);
  for (const id of ['j20', 'j35', 'j36', 'j50', 'h20', 'gj11', 'wz8', 't095', 'fujian']) assert.ok(ids('china').includes(id), `china ${id}`);
  for (const id of ['su57', 'pakda', 's70', 'husky']) assert.ok(ids('russia').includes(id), `russia ${id}`);
  assert.ok(ids('japan').includes('gcap') && ids('japan').includes('f35'));
  assert.ok(ids('germany').includes('fcas') && ids('germany').includes('f35'));
  assert.ok(ids('norway').includes('f35') && ids('brazil').includes('gripen'));
  const st = (nid, id) => nationCatalog(nid).find((e) => e.id === id).start;
  assert.equal(st('china', 'j20'), 'full'); assert.equal(st('china', 'j35'), 'lrip');
  assert.equal(st('china', 'j36'), 'proto'); assert.equal(st('china', 'j50'), 'proto');
  assert.equal(st('russia', 'su57'), 'lrip');
  // "none" slots: an indigenous program at R&D
  assert.equal(st('russia', 'x_carrier'), 'rd'); assert.ok(ids('cuba').every((id) => id.startsWith('x_')));
  // each nation sees only its own catalog
  assert.ok(!ids('china').some((id) => ['b21', 'f47', 'cca', 'sr72', 'ssnx', 'f35'].includes(id)));
  assert.ok(!ids('usa').some((id) => ['j20', 'j36', 'su57', 'gcap'].includes(id)));
});

test('China campaign: J-20 and J-35 are built at start (no SAP office, China start R&D) and deploy', () => {
  const h = headless('china'); cash(h.g);
  assert.equal(h.g.sapOffice, false);
  assert.equal(programStage(h.g, 'j20'), 'full'); assert.equal(programStage(h.g, 'j35'), 'lrip');
  h.run('sapTranche', { program: 'j20' }); h.run('sapTranche', { program: 'j35' });
  assert.equal(h.g.blackPrograms.j20, 1); assert.equal(h.g.blackPrograms.j35, 1);
  assert.ok(DEPLOYABLE.includes('j20') && DEPLOYABLE.includes('j35'));
  h.run('deployUnit', { region: 'EA', unit: 'j20' }); h.run('deployUnit', { region: 'EA', unit: 'j35' });
  assert.equal(h.g.forceDeployments.EA.j20, 1); assert.equal(h.g.forceDeployments.EA.j35, 1);
  // full-rate price from unit #1; LRIP pays the early-line rate
  const fresh = headless('china'); cash(fresh.g); const t0 = fresh.g.stats.treasury;
  fresh.run('sapTranche', { program: 'j20' });
  assert.equal(t0 - fresh.g.stats.treasury, Math.round(BLACK_PROGRAMS.j20.cost * 0.25));
  fresh.run('sapTranche', { program: 'j35' });
  assert.equal(t0 - fresh.g.stats.treasury - Math.round(BLACK_PROGRAMS.j20.cost * 0.25), Math.round(BLACK_PROGRAMS.j35.cost * 0.35));
});

test('J-35 moves LRIP -> full rate at six airframes', () => {
  const h = headless('china'); cash(h.g, 1e6);
  for (let i = 0; i < 5; i++) h.run('sapTranche', { program: 'j35' });
  assert.equal(programStage(h.g, 'j35'), 'lrip');
  h.run('sapTranche', { program: 'j35' });
  assert.equal(h.g.blackPrograms.j35, 6); assert.equal(programStage(h.g, 'j35'), 'full');
});

test('China funds J-36 and J-50 in parallel through prototype to LRIP; production opens after', () => {
  const h = headless('china'); cash(h.g, 1e6);
  h.run('sapInitiate', { program: 'j36' });
  assert.ok(!h.g.arsenal.dev.j36, 'needs the SAP office');
  h.run('establishSapOffice');
  h.run('sapInitiate', { program: 'j36' });
  assert.ok(!h.g.arsenal.dev.j36, 'needs R&D levels');
  h.g.defLevels = { ...h.g.defLevels, aircraft: 3, propulsion: 3, computers: 3 };
  const t0 = h.g.stats.treasury;
  h.run('sapInitiate', { program: 'j36' }); h.run('sapInitiate', { program: 'j50' });
  assert.ok(h.g.arsenal.dev.j36 && h.g.arsenal.dev.j50, 'both funded at once');
  assert.equal(h.g.blackResearch, null, 'prototype lines do not occupy the single SAP R&D slot');
  assert.equal(t0 - h.g.stats.treasury, Math.round(BLACK_PROGRAMS.j36.cost * 0.5) + Math.round(BLACK_PROGRAMS.j50.cost * 0.5), 'remaining half of each program');
  assert.equal(programStage(h.g, 'j36'), 'proto'); assert.equal(programStage(h.g, 'j50'), 'proto');
  h.run('sapTranche', { program: 'j36' }); assert.ok(!h.g.blackPrograms.j36, 'no production before LRIP');
  h.g.gracePeriod = 999;
  for (let m = 0; m < 40 && !(h.g.blackPrograms.j36 && h.g.blackPrograms.j50); m++) { h.month(); assert.deepEqual(checkV57(h.g), [], `month ${m}`); }
  assert.equal(h.g.blackPrograms.j36, 1); assert.equal(h.g.blackPrograms.j50, 1);
  assert.equal(programStage(h.g, 'j36'), 'lrip'); assert.deepEqual(h.g.arsenal.dev, {});
  h.run('sapTranche', { program: 'j36' }); assert.equal(h.g.blackPrograms.j36, 1, 'a line you stood up needs the industrial base (v57 Materials L4)');
  h.g.defLevels = { ...h.g.defLevels, materials: 4 };
  h.run('sapTranche', { program: 'j36' }); assert.equal(h.g.blackPrograms.j36, 2);
  h.run('deployUnit', { region: 'EA', unit: 'j50' }); assert.equal(h.g.forceDeployments.EA.j50, 1);
});

test('funding both gen-6 prototypes halves the slip risk (seeded roll between 0.15 and 0.30)', () => {
  const run = (both) => {
    const h = headless('china'); cash(h.g, 1e6); h.run('establishSapOffice'); h.g.gracePeriod = 999;
    h.g.defLevels = { ...h.g.defLevels, aircraft: 3, propulsion: 3, computers: 3 };
    h.run('sapInitiate', { program: 'j36' }); if (both) h.run('sapInitiate', { program: 'j50' });
    const mo = h.g.arsenal.dev.j36.mo; h.g.arsenal = { ...h.g.arsenal, dev: { ...h.g.arsenal.dev, j36: { ...h.g.arsenal.dev.j36, prog: mo - 1 } } };
    setRngSource(() => 0.2);
    h.month();
    return h;
  };
  const one = run(false);
  assert.ok(!one.g.blackPrograms.j36, 'single program slipped');
  assert.equal(one.g.arsenal.dev.j36.mo - one.g.arsenal.dev.j36.prog, 12, 'slip is 12 months');
  assert.ok(one.g.arsenal.dev.j36.slipped, 'a program slips once');
  const two = run(true);
  assert.equal(two.g.blackPrograms.j36, 1, 'parallel funding de-risked it');
});

test('catalog gates: no foreign programs, no production before LRIP, US programs unchanged', () => {
  const cn = headless('china'); cash(cn.g, 1e6); cn.run('establishSapOffice'); cn.g.defLevels = { materials: 6, computers: 6, semiconductors: 6, munitions: 6, aircraft: 6, propulsion: 6, missiles: 6, space: 6, naval: 6, cyber: 6 };
  for (const id of ['b21', 'f47', 'ssnx', 'gcap']) { cn.run('sapInitiate', { program: id }); assert.ok(cn.g.blackResearch?.id !== id && !cn.g.arsenal.dev[id], `china cannot start ${id}`); }
  cn.run('sapTranche', { program: 'f35' }); assert.ok(!cn.g.blackPrograms.f35, 'china cannot buy F-35');
  const us = headless('usa'); cash(us.g, 1e6);
  us.run('sapTranche', { program: 'j20' }); assert.ok(!us.g.blackPrograms.j20);
  const tb = us.g.stats.treasury; us.run('sapTranche', { program: 'b21' });
  assert.equal(us.g.blackPrograms.b21, 1, 'B-21 in LRIP at the 2024 start (ruling)'); assert.equal(tb - us.g.stats.treasury, Math.round(8000 * 0.35));
  us.run('establishSapOffice'); us.g.defLevels = { ...cn.g.defLevels };
  us.run('sapInitiate', { program: 'b21' }); assert.equal(us.g.blackResearch, null, 'B-21 is in production, no R&D');
  us.run('sapInitiate', { program: 'cca' }); assert.deepEqual(us.g.arsenal.dev.cca, { prog: 0, mo: 12 }, 'CCA prototype line, half the months');
  const t0 = us.g.stats.treasury; us.run('sapInitiate', { program: 'f47' });
  assert.deepEqual(us.g.blackResearch, { id: 'f47', prog: 0, mo: 36 }); assert.equal(t0 - us.g.stats.treasury, 11000, 'v57 full price, single slot');
  us.run('sapInitiate', { program: 'sr72' }); assert.equal(us.g.blackResearch.id, 'f47', 'v57: SAP office busy');
  for (const n of [1, 2, 3, 5, 6, 9]) assert.equal(sapRunCost(BLACK_PROGRAMS.b21, n, programStage({ ...us.g, blackPrograms: { b21: n } }, 'b21')), sapRunCost(BLACK_PROGRAMS.b21, n), `v57 tranche price n=${n}`);
  us.run('sapTranche', { program: 'f35' }); assert.equal(us.g.blackPrograms.f35, 1, 'US F-35 line is open (spec table)');
});

test('buyers pay the foreign-line premium for F-35', () => {
  const no = headless('norway'); cash(no.g); const t0 = no.g.stats.treasury;
  no.run('sapTranche', { program: 'f35' });
  assert.equal(no.g.blackPrograms.f35, 1); assert.equal(t0 - no.g.stats.treasury, Math.round(BLACK_PROGRAMS.f35.cost * 0.25 * 1.2));
});

test('formulas read program data: H-20 is a triad leg, WZ-8 is ISR, Type 095 is naval weight, GJ-11 rides J-20', () => {
  assert.equal(triadLegs({}, { h20: 1 }), 1); assert.equal(triadLegs({}, { b21: 1 }), 1); assert.equal(triadLegs({}, { j20: 3 }), 0);
  assert.equal(isrScore({}, {}, {}, { wz8: 1 }), 4); assert.equal(isrScore({}, {}, {}, { sr72: 1 }), 6);
  assert.equal(navalWeight({ t095: 1, carrier_group: 1 }), 3); assert.equal(navalWeight({ ssnx: 1, frigate: 1 }), 2.5);
  assert.equal(wSum({ j20: 2 }, { j20: 2, gj11: 1 }), 2 * 1.25); assert.equal(wSum({ j20: 2 }, {}), 2);
  assert.equal(wSum({ su57: 1 }, { su57: 1, s70: 4 }), 1.5);
});

test('arsenal invariants catch corrupt program state', () => {
  const h = headless('china');
  assert.deepEqual(checkV57(h.g), []);
  h.g.arsenal = { ...h.g.arsenal, dev: { j36: { prog: 40, mo: 18 } } };
  assert.ok(checkV57(h.g).some((n) => /prototype lines/.test(n)));
  h.g.arsenal = { ...h.g.arsenal, dev: { nope: { prog: 0, mo: 5 } } };
  assert.ok(checkV57(h.g).some((n) => /prototype lines/.test(n)));
  h.g.arsenal = { ...h.g.arsenal, dev: {} }; h.g.blackPrograms = { j20: -1 };
  assert.ok(checkV57(h.g).some((n) => /owned programs/.test(n)));
});

test('programView lists only the nation catalog with stage, months and the next action; outliner shows prototype lines', () => {
  const h = headless('china'); cash(h.g, 1e6); h.run('establishSapOffice');
  h.g.defLevels = { ...h.g.defLevels, aircraft: 3, propulsion: 3, computers: 3 };
  h.run('sapInitiate', { program: 'j50' });
  const v = programView(h.g);
  assert.deepEqual(v.map((r) => r.id), nationCatalog('china').map((e) => e.id));
  const j50 = v.find((r) => r.id === 'j50'); assert.equal(j50.stage, 'proto'); assert.equal(j50.monthsLeft, Math.round(BLACK_PROGRAMS.j50.mo * 0.5));
  assert.equal(v.find((r) => r.id === 'j36').action, 'fund'); assert.equal(v.find((r) => r.id === 'j20').action, 'produce');
  assert.equal(v.find((r) => r.id === 'h20').action, 'initiate');
  assert.ok(buildOutliner(h.g).some((r) => r.id === 'proto_j50' && r.months > 0));
});

test('App: China sees only its catalog, produces a J-20 and funds J-36 from the Defense tab; the USA sees the v57 SAP list', async () => {
  const origErr = console.error; console.error = () => {};
  const g = await mount(BUNDLES.app, { seed: 5, testHook: true });
  try {
    await g.pickCountry(idx('china'));
    g.w.__wl.fund(200000);
    await settle(); g.tabBtn('defense').click(); await settle();
    const cat = g.doc.querySelector('[data-catalog]');
    assert.ok(cat, 'catalog rendered');
    const txt = cat.textContent;
    for (const n of ['J-20', 'J-35', 'J-36', 'J-50', 'H-20', 'GJ-11', 'WZ-8', 'Type 095', 'Fujian']) assert.ok(txt.includes(n), `china shows ${n}`);
    for (const n of ['B-21', 'F-47', 'SR-72', 'SSN(X)', 'F-35']) assert.ok(!txt.includes(n), `china hides ${n}`);
    assert.ok(/Full rate/.test(txt) && /Prototype/.test(txt) && /LRIP/.test(txt) && /R&D/.test(txt), 'stages shown');
    const btn = (re) => [...cat.querySelectorAll('button')].find((b) => re.test(b.textContent));
    btn(/Produce J-20/).click(); await settle();
    assert.match(g.doc.querySelector('[data-program=j20]').textContent, /1 unit/);
    g.w.__wl.levels({ aircraft: 3, propulsion: 3, computers: 3 }); await settle();
    [...g.doc.querySelectorAll('button')].find((b) => /Establish SAP Office/.test(b.textContent)).click(); await settle();
    [...g.doc.querySelectorAll('[data-program=j36] button')].find((b) => /Fund prototype/.test(b.textContent)).click(); await settle();
    assert.match(g.doc.querySelector('[data-program=j36]').textContent, /Prototype[^]*mo to LRIP/);
  } finally { console.error = origErr; g.close(); }
  const u = await mount(BUNDLES.app, { seed: 5 });
  try {
    await u.pickCountry(idx('usa')); u.tabBtn('defense').click(); await settle();
    const txt = u.doc.querySelector('[data-catalog]').textContent;
    for (const n of ['B-21', 'F-47', 'CCA', 'SR-72', 'SSN(X)', 'F-35', 'Ford']) assert.ok(txt.includes(n), `usa shows ${n}`);
    assert.ok(!/J-20|J-36|Su-57|GCAP/.test(txt));
    assert.deepEqual([...u.doc.querySelectorAll('[data-program]')].slice(0, 5).map((d) => d.dataset.program), ['b21', 'f47', 'cca', 'sr72', 'ssnx'], 'v57 order');
  } finally { u.close(); }
});
