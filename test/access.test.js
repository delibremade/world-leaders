import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMonth } from '../src/sim/tick.js';
import { applyVerb } from '../src/sim/actions.js';
import { newCampaign, STATE_FIELDS } from '../src/sim/state.js';
import { checkV57 } from '../src/sim/invariants.js';
import { accessGates, compliance, variantEff, programView, accessView } from '../src/sim/selectors.js';
import { interceptChance } from '../src/sim/formulas.js';
import { COUNTRIES, NATIONS } from '../src/data/nations.js';
import { ALLIED_PROGRAMS, TIERS, ACCESS_RULES } from '../src/data/alliance.js';
import { BLACK_PROGRAMS } from '../src/data/platforms.js';
import { setRngSource, mulberry32 } from '../src/sim/rng.js';
import { mount, BUNDLES } from './util/harness.js';

// E7 (#19): allied access to programs. Tiers Buyer -> Partner -> Co-developer; gates; security compliance with suspension
// and reinstatement; the USA admits and expels; CCA open to NATO; GCAP founders UK/Italy/Japan; Germany may defect FCAS -> GCAP.
const idx = (id) => COUNTRIES.findIndex((c) => c.id === id);
function headless(nid = 'norway', seed = 1) {
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
const mine = (g, pid) => g.arsenal.access?.[pid]?.[g.country.id];
// Everything a Norway partner needs: relations 70 with the USA, NATO (counts as the pact), 2% GDP, rare-earth supply, cash.
const ready = (g, owner = 'usa') => {
  g.nationRelations = { ...g.nationRelations, [owner]: 75 }; g.stats = { ...g.stats, treasury: 50000 };
  g.resExtraction = { ...g.resExtraction, rareEarth: 1 };
};
const gate = (g, pid, tier, label) => accessGates(g, pid, tier).find((x) => x.id === label);

test('data: five programs with owners and founders; tiers 85-90% / better / full variant', () => {
  assert.deepEqual(Object.keys(ALLIED_PROGRAMS).sort(), ['b21', 'cca', 'f47', 'fcas', 'gcap']);
  for (const p of ['f47', 'b21', 'cca']) assert.equal(ALLIED_PROGRAMS[p].owner, 'usa');
  assert.deepEqual(ALLIED_PROGRAMS.gcap.founders, ['uk', 'italy', 'japan']);
  assert.deepEqual(ALLIED_PROGRAMS.fcas.founders, ['france', 'germany', 'spain']);
  assert.ok(ALLIED_PROGRAMS.cca.natoOnly);
  assert.ok(TIERS.buyer.eff >= 0.85 && TIERS.buyer.eff <= 0.9);
  assert.ok(TIERS.partner.eff > TIERS.buyer.eff && TIERS.codev.eff === 1);
  for (const id of ['usa', 'germany', 'norway', 'uk', 'italy', 'france', 'spain']) assert.ok(NATIONS[id].nato, `${id} NATO`);
  assert.ok(!NATIONS.japan.nato);
});

test('Norway reaches Buyer, then Partner, for F-47 and CCA by meeting the gates', () => {
  const h = headless('norway'); ready(h.g);
  for (const pid of ['f47', 'cca']) {
    h.run('joinProgram', { program: pid, tier: 'buyer' });
    assert.equal(mine(h.g, pid)?.tier, 'buyer', `${pid} buyer`);
    const t0 = h.g.stats.treasury;
    h.run('joinProgram', { program: pid, tier: 'partner' });
    assert.equal(mine(h.g, pid).tier, 'partner', `${pid} partner`);
    assert.equal(t0 - h.g.stats.treasury, Math.round(BLACK_PROGRAMS[pid].cost * TIERS.partner.share), `${pid} cost share paid`);
    assert.equal(mine(h.g, pid).status, 'active');
  }
  assert.deepEqual(checkV57(h.g), []);
});

test('each gate blocks on its own', () => {
  const cases = [
    ['relations', (g) => { g.nationRelations = { ...g.nationRelations, usa: 69 }; }, 'buyer'],
    ['nato2', (g) => { g.budgetAlloc = { ...g.budgetAlloc, defense: 80 }; }, 'buyer'],
    ['compliance', (g) => { g.ipPolicy = 'license'; }, 'buyer'],
    ['share', (g) => { g.stats = { ...g.stats, treasury: 100 }; }, 'partner'],
    ['minerals', (g) => { g.resExtraction = { ...g.resExtraction, rareEarth: 0 }; }, 'partner'],
  ];
  for (const [id, breakIt, tier] of cases) {
    const h = headless('norway'); ready(h.g);
    assert.ok(gate(h.g, 'f47', tier, id)?.met, `${id} met when ready`);
    breakIt(h.g);
    assert.equal(gate(h.g, 'f47', tier, id).met, false, `${id} fails`);
    h.run('joinProgram', { program: 'f47', tier });
    assert.ok(!mine(h.g, 'f47'), `${id}: not admitted as ${tier}`);
  }
  // pact gate: Japan (not NATO) needs a defense pact with the USA for F-47; CCA is NATO-only
  const j = headless('japan'); ready(j.g);
  assert.equal(gate(j.g, 'f47', 'buyer', 'pact').met, false);
  j.g.defensePacts = new Set(['usa']);
  assert.ok(gate(j.g, 'f47', 'buyer', 'pact').met);
  j.run('joinProgram', { program: 'f47', tier: 'buyer' }); assert.equal(mine(j.g, 'f47')?.tier, 'buyer');
  assert.equal(gate(j.g, 'cca', 'buyer', 'pact').met, false, 'CCA is open to NATO only');
  j.run('joinProgram', { program: 'cca', tier: 'buyer' }); assert.ok(!mine(j.g, 'cca'));
  // NATO 2% does not apply to non-members
  assert.ok(gate(j.g, 'f47', 'buyer', 'nato2').met);
});

test('co-developer joins at R&D only: F-47 yes, B-21 (LRIP) and CCA (prototype) no', () => {
  const h = headless('norway'); ready(h.g);
  assert.equal(gate(h.g, 'b21', 'codev', 'rd').met, false); assert.equal(gate(h.g, 'cca', 'codev', 'rd').met, false);
  h.run('joinProgram', { program: 'b21', tier: 'codev' }); assert.ok(!mine(h.g, 'b21'));
  h.run('joinProgram', { program: 'f47', tier: 'codev' }); assert.equal(mine(h.g, 'f47')?.tier, 'codev');
  assert.equal(variantEff(h.g, 'f47'), 1);
});

test('orders: production must be open; buyer queue delivers the export variant; delivered F-47 deploys', () => {
  const h = headless('norway'); ready(h.g);
  h.run('joinProgram', { program: 'f47', tier: 'buyer' });
  h.run('orderAllied', { program: 'f47' }); assert.equal(h.g.arsenal.orders.length, 0, 'F-47 not in production in 2024');
  h.g.date = { yr: ALLIED_PROGRAMS.f47.ioc, mo: 0 };
  const t0 = h.g.stats.treasury; h.run('orderAllied', { program: 'f47' });
  assert.equal(h.g.arsenal.orders.length, 1); assert.ok(t0 > h.g.stats.treasury);
  for (let m = 0; m < TIERS.buyer.queue; m++) { assert.ok(!h.g.blackPrograms.f47); h.month(); assert.deepEqual(checkV57(h.g), [], `m${m}`); }
  assert.equal(h.g.blackPrograms.f47, 1); assert.equal(h.g.arsenal.orders.length, 0);
  assert.equal(variantEff(h.g, 'f47'), TIERS.buyer.eff);
  h.run('deployUnit', { region: 'WE', unit: 'f47' }); assert.equal(h.g.forceDeployments.WE.f47, 1);
  // B-21 is in production at the 2024 start (ruling on #15)
  h.run('joinProgram', { program: 'b21', tier: 'buyer' }); h.run('orderAllied', { program: 'b21' }); assert.equal(h.g.arsenal.orders.length, 1);
});

test('a compliance breach suspends mid-program and reinstates after 12 months at a relations cost', () => {
  const h = headless('norway'); ready(h.g);
  h.run('joinProgram', { program: 'f47', tier: 'partner' });
  h.g.date = { yr: ALLIED_PROGRAMS.f47.ioc, mo: 0 }; h.run('orderAllied', { program: 'f47' });
  const left0 = h.g.arsenal.orders[0].mo;
  assert.ok(compliance(h.g).ok);
  h.g.tradeAgreements = new Set(['china']); // flagged deal with China
  assert.ok(!compliance(h.g).ok && compliance(h.g).flagged.includes('china'));
  const rel0 = h.g.nationRelations.usa; const cash0 = h.g.stats.treasury;
  h.month();
  assert.equal(mine(h.g, 'f47').status, 'suspended');
  assert.equal(h.g.nationRelations.usa, rel0 - ACCESS_RULES.breachRel);
  assert.equal(variantEff(h.g, 'f47'), TIERS.partner.eff * 0.5, 'owner cuts sustainment');
  assert.equal(h.g.arsenal.orders[0].mo, left0, 'deliveries frozen');
  h.run('reinstateAccess', { program: 'f47' }); assert.equal(mine(h.g, 'f47').status, 'suspended', 'still in breach');
  h.g.tradeAgreements = new Set();
  h.run('reinstateAccess', { program: 'f47' }); assert.equal(mine(h.g, 'f47').status, 'suspended', 'time cost not served');
  for (let m = 0; m < ACCESS_RULES.suspendMo; m++) h.month();
  assert.equal(mine(h.g, 'f47').susp, 0);
  const rel1 = h.g.nationRelations.usa;
  h.run('reinstateAccess', { program: 'f47' });
  assert.equal(mine(h.g, 'f47').status, 'active');
  assert.equal(h.g.nationRelations.usa, rel1 - ACCESS_RULES.reentryRel);
  h.month(); assert.equal(h.g.arsenal.orders[0].mo, left0 - 1, 'deliveries resume');
  assert.ok(cash0 !== h.g.stats.treasury);
});

test('counter-intel floor and exposure ceiling each trigger a breach', () => {
  const a = headless('norway'); ready(a.g); a.run('joinProgram', { program: 'cca', tier: 'buyer' });
  a.g.ipPolicy = 'license'; assert.ok(interceptChance(a.g) < ACCESS_RULES.ciFloor); a.month();
  assert.equal(mine(a.g, 'cca').status, 'suspended');
  const b = headless('norway'); ready(b.g); b.run('joinProgram', { program: 'cca', tier: 'buyer' });
  b.g.defLevels = { ...b.g.defLevels, cyber: 6 }; b.g.blocTrade = { ...b.g.blocTrade, cn: 2 };
  assert.ok(compliance(b.g).exposure > ACCESS_RULES.exposureCeil); b.month();
  assert.equal(mine(b.g, 'cca').status, 'suspended');
});

test('partner workshare pays GDP and jobs at home each month; buyers get none', () => {
  // each campaign runs to completion before the next starts: they share the seeded rng stream
  const one = (tier) => { const h = headless('norway'); ready(h.g); h.run('joinProgram', { program: 'f47', tier }); h.g.stats = { ...h.g.stats, treasury: 50000 }; h.month(); return h; };
  const p = one('partner'); const b = one('buyer');
  assert.ok(p.g.stats.treasury > b.g.stats.treasury, 'workshare income');
  assert.ok(p.g.stats.unemployment < b.g.stats.unemployment, 'jobs at home');
});

test('USA player admits and expels: cost share and export income in, relations out, gates enforced', () => {
  const h = headless('usa');
  h.g.nationRelations = { ...h.g.nationRelations, uk: 80, japan: 80 }; h.g.defensePacts = new Set(['japan']);
  const t0 = h.g.stats.treasury;
  h.run('admitPartner', { program: 'f47', nation: 'uk', tier: 'partner' });
  assert.equal(h.g.stats.treasury - t0, Math.round(BLACK_PROGRAMS.f47.cost * TIERS.partner.share), 'cost share paid to the owner');
  assert.equal(h.g.arsenal.access.f47.uk.tier, 'partner');
  h.run('admitPartner', { program: 'cca', nation: 'japan', tier: 'buyer' });
  assert.ok(!h.g.arsenal.access.cca?.japan, 'CCA is NATO only');
  h.run('admitPartner', { program: 'f47', nation: 'poland', tier: 'buyer' });
  assert.ok(!h.g.arsenal.access.f47?.poland, 'relations below 70');
  h.run('admitPartner', { program: 'b21', nation: 'uk', tier: 'codev' });
  assert.ok(!h.g.arsenal.access.b21?.uk, 'B-21 is past R&D');
  h.run('admitPartner', { program: 'f47', nation: 'usa', tier: 'buyer' });
  assert.ok(!h.g.arsenal.access.f47.usa, 'never a member of your own program');
  const v = accessView(h.g).find((r) => r.id === 'f47');
  assert.ok(v.owner && v.members.some((m) => m.id === 'uk'));
  assert.ok(v.applicants.some((a) => a.id === 'japan'), 'Japan applies for F-47 (pact or NATO)');
  const rel = h.g.nationRelations.uk;
  h.run('expelPartner', { program: 'f47', nation: 'uk' });
  assert.ok(!h.g.arsenal.access.f47.uk); assert.equal(h.g.nationRelations.uk, rel - ACCESS_RULES.expelRel);
  assert.deepEqual(checkV57(h.g), []);
});

test('USA: members pay export income; a flagged member (Turkey) leaks to rivals', () => {
  const one = (admit) => { const h = headless('usa'); h.g.nationRelations = { ...h.g.nationRelations, uk: 80 }; if (admit) h.run('admitPartner', { program: 'f47', nation: 'uk', tier: 'buyer' }); h.month(); return h; };
  const base = one(false); const mem = one(true);
  assert.ok(mem.g.stats.treasury > base.g.stats.treasury, 'export income');
  const t = headless('usa'); t.g.nationRelations = { ...t.g.nationRelations, turkey: 80 }; t.g.defensePacts = new Set(['turkey']);
  t.run('admitPartner', { program: 'f47', nation: 'turkey', tier: 'buyer' });
  assert.equal(t.g.arsenal.access.f47.turkey.tier, 'buyer', 'the player decides, even a flagged applicant');
  const gd0 = JSON.stringify(t.g.globalDef);
  setRngSource(() => 0.03); t.month();
  assert.notEqual(JSON.stringify(t.g.globalDef), gd0, 'leak to a rival');
  assert.ok(t.toasts.some((m) => /leak/i.test(m)));
});

test('GCAP founders: Japan starts as co-developer; Germany starts in FCAS and may defect to GCAP', () => {
  const j = headless('japan');
  assert.equal(mine(j.g, 'gcap').tier, 'codev'); assert.ok(mine(j.g, 'gcap').founder);
  const g = headless('germany');
  assert.equal(mine(g.g, 'fcas').tier, 'codev'); assert.ok(programView(g.g).some((r) => r.id === 'fcas'));
  g.run('defectProgram', { from: 'fcas', to: 'gcap' }); assert.ok(mine(g.g, 'fcas'), 'needs UK relations 70');
  g.g.nationRelations = { ...g.g.nationRelations, uk: 75, france: 40, spain: 40 }; g.g.stats = { ...g.g.stats, treasury: 50000 };
  g.run('defectProgram', { from: 'fcas', to: 'gcap' });
  assert.ok(!mine(g.g, 'fcas')); assert.equal(mine(g.g, 'gcap').tier, 'codev');
  assert.equal(g.g.nationRelations.france, 20, 'relations cost with France');
  const ids = programView(g.g).map((r) => r.id);
  assert.ok(ids.includes('gcap') && !ids.includes('fcas'), 'GCAP replaces FCAS in the catalog');
  g.run('defectProgram', { from: 'fcas', to: 'gcap' }); assert.deepEqual(checkV57(g.g), []);
});

test('suspension also freezes a founder catalog line', () => {
  const j = headless('japan'); j.g.stats = { ...j.g.stats, treasury: 50000 }; j.run('establishSapOffice');
  j.g.defLevels = { ...j.g.defLevels, aircraft: 4, propulsion: 4, computers: 4 };
  j.g.tradeAgreements = new Set(['russia']); j.month();
  assert.equal(mine(j.g, 'gcap').status, 'suspended');
  j.run('sapInitiate', { program: 'gcap' }); assert.equal(j.g.blackResearch, null);
  assert.ok(j.toasts.some((m) => /suspended/i.test(m)));
});

test('access invariants catch corrupt state', () => {
  const h = headless('usa');
  assert.deepEqual(checkV57(h.g), []);
  h.g.arsenal = { ...h.g.arsenal, access: { f47: { usa: { tier: 'buyer', status: 'active', susp: 0 } } } };
  assert.ok(checkV57(h.g).some((n) => /own program/.test(n)));
  h.g.arsenal = { ...h.g.arsenal, access: { f47: { uk: { tier: 'king', status: 'active', susp: 0 } } } };
  assert.ok(checkV57(h.g).some((n) => /access records/.test(n)));
  h.g.arsenal = { ...h.g.arsenal, access: {}, orders: [{ id: 'f47', mo: -1 }] };
  assert.ok(checkV57(h.g).some((n) => /orders/.test(n)));
});

test('App: Norway joins F-47 as Buyer then Partner from the Defense tab; the USA sees applicants', async () => {
  const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };
  const origErr = console.error; console.error = () => {};
  const g = await mount(BUNDLES.app, { seed: 7, testHook: true });
  try {
    await g.pickCountry(idx('norway')); g.w.__wl.fund(50000); g.w.__wl.rel('usa', 80); g.w.__wl.extract('rareEarth', 1); await settle();
    g.tabBtn('defense').click(); await settle();
    const card = () => g.doc.querySelector('[data-access=f47]');
    assert.ok(card(), 'partnerships card');
    const press = async (re) => { const b = [...card().querySelectorAll('button')].find((x) => re.test(x.textContent)); assert.ok(b, `button ${re}`); b.click(); await settle(); };
    await press(/Join as Buyer/); assert.match(card().textContent, /Buyer · active/);
    await press(/Join as Partner/); assert.match(card().textContent, /Partner · active/);
  } finally { console.error = origErr; g.close(); }
  const u = await mount(BUNDLES.app, { seed: 7, testHook: true });
  try {
    await u.pickCountry(idx('usa')); u.w.__wl.rel('uk', 80); await settle();
    u.tabBtn('defense').click(); await settle();
    const card = u.doc.querySelector('[data-access=f47]');
    const admit = [...card.querySelectorAll('button')].find((b) => /Admit UK|Admit United Kingdom/.test(b.textContent));
    assert.ok(admit, 'UK applies'); admit.click(); await settle();
    assert.match(u.doc.querySelector('[data-access=f47]').textContent, /United Kingdom[^]*Expel/);
  } finally { u.close(); }
});
