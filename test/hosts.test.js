import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMonth } from '../src/sim/tick.js';
import { applyVerb } from '../src/sim/actions.js';
import { newCampaign, STATE_FIELDS } from '../src/sim/state.js';
import { checkV57 } from '../src/sim/invariants.js';
import { COUNTRIES, NATIONS, DIP_TARGETS, HOST_NATIONS } from '../src/data/nations.js';
import { NODE_TYPES, SITES, BASE_RULES as R } from '../src/data/bases.js';
import { findNode, hostView, hostSites, consent, siteOptions, chokesCovered, tenureOf, hasAgreement } from '../src/sim/bases.js';
import { ownChokeWeight } from '../src/sim/reach.js';
import { relOf } from '../src/sim/formulas.js';
import { verbsFor } from '../src/ui/shell/nation-verbs.js';
import { setRngSource, mulberry32 } from '../src/sim/rng.js';
import { mount, flush, BUNDLES } from './util/harness.js';

// #89: non-playable host nations (spec Part 11, Part 13 F15). They live in NATIONS (ruling 10) with `host` data, take state visits, aid and
// a basing agreement, and their candidate sites live in SITES with `host` set to them.
function headless(nid = 'usa', seed = 1) {
  setRngSource(mulberry32(seed));
  const g = newCampaign(COUNTRIES[COUNTRIES.findIndex((c) => c.id === nid)]); g.doctrine = 'hegemon'; g.gracePeriod = 999;
  const ui = { log: [], ledger: {} }; const toasts = [];
  const S = new Proxy({}, { get: (_, name) => (v) => { const k = name[3].toLowerCase() + name.slice(4); const box = STATE_FIELDS.includes(k) ? g : ui; box[k] = typeof v === 'function' ? v(box[k]) : v; } });
  const fx = { toast: (m) => toasts.push(m), now: () => 0, defer: (fn) => fn() };
  return { g, ui, toasts, month: () => runMonth(g, S, fx), run: (type, payload) => applyVerb(g, S, fx, { type, payload }) };
}
const months = (h, n) => { for (let i = 0; i < n; i++) { h.month(); assert.deepEqual(checkV57(h.g), [], `month ${i + 1}`); } };

// The owner's list, each with the named sites that must be offered.
const HOSTS = {
  singapore: ['changi'], philippines: ['subic', 'basa', 'magsaysay', 'bautista', 'osias'], australia: ['darwin', 'tindal', 'pinegap'],
  skorea: ['osan', 'humphreys'], uk: ['lakenheath'], italy: ['aviano', 'sigonella'], spain: ['rota'], greece: ['souda'], turkey: ['incirlik'],
  poland: ['redzikowo', 'poznan'], romania: ['deveselu', 'kogalniceanu'], qatar: ['aludeid'], uae: ['aldhafra'], kuwait: ['arifjan'],
  bahrain: ['bahrain'], djibouti: ['djibouti'], iceland: ['keflavik'], greenland: ['pituffik'],
};

test('data: every host nation is one NATIONS entry with terms, a status_source, a region and its named candidate sites; chokepoints in reach derive from the sites', () => {
  assert.deepEqual(HOST_NATIONS.map((h) => h.id).sort(), Object.keys(HOSTS).sort());
  for (const [id, sites] of Object.entries(HOSTS)) {
    const n = NATIONS[id]; assert.ok(n && n.host && n.host.terms && n.host.status_source && n.region && n.flag, id);
    for (const sid of sites) assert.equal(SITES[sid]?.host, id, `${sid} hosted by ${id}`);
    assert.ok(hostSites(id).every((sid) => SITES[sid].region && SITES[sid].status_source), id);
  }
  const g = headless().g;
  assert.ok(hostView(g, 'singapore').chokes.includes('malacca')); assert.ok(hostView(g, 'bahrain').chokes.includes('hormuz')); assert.ok(hostView(g, 'djibouti').chokes.includes('bab'));
  assert.equal(hostView(g, 'germany'), null, 'a playable nation without host data has no host view');
  assert.equal(DIP_TARGETS.length, 25, 'host-only nations are not diplomacy targets (the v57 relations map is untouched)');
  assert.ok(!('singapore' in g.nationRelations), 'host-only relations are not seeded'); assert.equal(relOf(g, 'singapore'), 0, 'neutral: bloc start 0');
  assert.equal(relOf(g, 'philippines'), 40, 'western bloc: start +40');
});

test('done-when (#89): a US campaign raises relations with Singapore, signs a basing agreement, builds a naval node at Changi, and its reach covers Malacca', () => {
  const h = headless('usa'); const g = h.g; const t0 = g.stats.treasury;
  assert.equal(h.run('buildNode', { site: 'changi', type: 'naval' }), false); assert.match(h.toasts.at(-1), /No basing agreement with Singapore/);
  assert.equal(h.run('basingAgreement', { nation: 'singapore' }), false); assert.match(h.toasts.at(-1), /Relations 0: need 20/);
  h.run('stateVisit', { nation: 'singapore' }); h.run('foreignAid', { nation: 'singapore' });
  assert.equal(g.nationRelations.singapore, 23, 'visit +8, aid +15 from 0');
  assert.equal(h.run('basingAgreement', { nation: 'singapore' }), true); assert.ok(g.bases.agreements.singapore && hasAgreement(g, 'singapore'));
  assert.equal(g.stats.treasury, t0 - 150 - 600 - R.agreementCost);
  assert.ok(siteOptions(g, 'changi').every((o) => o.ok), 'every node type open at Changi');
  assert.equal(h.run('buildNode', { site: 'changi', type: 'naval' }), true);
  const n = findNode(g, 'usa', 'changi', 'naval'); assert.equal(n.tenure, 'agreement'); assert.equal(n.status, 'building');
  const before = ownChokeWeight(g, 'malacca');
  g.stats = { ...g.stats, treasury: 500000 }; months(h, NODE_TYPES.naval.mo);
  assert.equal(findNode(g, 'usa', 'changi', 'naval').status, 'active');
  assert.ok(chokesCovered(n).includes('malacca'), 'Changi reaches the Strait of Malacca');
  assert.equal(ownChokeWeight(g, 'malacca') - before, NODE_TYPES.naval.mult.choke, `control weight at Malacca ${before} -> ${ownChokeWeight(g, 'malacca')}`);
});

test('F15 tenure: an agreement lapses under sanctions and its nodes close; leases and treaty sites persist through a relations collapse; ending the agreement closes agreement nodes', () => {
  const h = headless('usa'); const g = h.g; g.stats = { ...g.stats, treasury: 500000 };
  g.nationRelations.kuwait = 30; h.run('basingAgreement', { nation: 'kuwait' }); h.run('buildNode', { site: 'alisalem', type: 'air' }); months(h, NODE_TYPES.air.mo);
  assert.equal(findNode(g, 'usa', 'alisalem', 'air').status, 'active');
  g.sanctions.add('kuwait'); months(h, 1);
  assert.ok(!g.bases.agreements.kuwait, 'agreement suspended'); assert.equal(findNode(g, 'usa', 'alisalem', 'air').status, 'closed'); assert.ok(h.toasts.some((t) => /Kuwait suspends your basing agreement/.test(t)));
  // relations collapse with Djibouti, Bahrain and Qatar: Lemonnier (lease), NSA Bahrain and Al Udeid (DCA treaties) stay open
  for (const k of ['djibouti', 'bahrain', 'qatar']) g.nationRelations[k] = -80;
  months(h, 2);
  for (const [s, t] of [['djibouti', 'sof'], ['bahrain', 'naval'], ['aludeid', 'air']]) { const x = findNode(g, 'usa', s, t); assert.equal(x.status, 'active', s); assert.ok(['lease', 'treaty'].includes(tenureOf(x)), s); }
  // ending an agreement by choice closes agreement nodes next month
  g.sanctions.delete('kuwait'); g.nationRelations.uae = 30; h.run('basingAgreement', { nation: 'uae' }); h.run('buildNode', { site: 'jebelali', type: 'naval' }); months(h, NODE_TYPES.naval.mo);
  assert.equal(findNode(g, 'usa', 'jebelali', 'naval').status, 'active');
  assert.equal(h.run('basingAgreement', { nation: 'uae' }), true); assert.ok(!g.bases.agreements.uae); months(h, 1);
  assert.equal(findNode(g, 'usa', 'jebelali', 'naval').status, 'closed');
  // re-signing reopens after the wait
  h.run('basingAgreement', { nation: 'uae' }); months(h, R.reopenMo); assert.equal(findNode(g, 'usa', 'jebelali', 'naval').status, 'active');
});

test('verbs: host-only nations take visits, aid and a basing agreement, never a trade agreement or pact; never against the player; the sheet lists them', () => {
  const h = headless('usa'); const g = h.g;
  h.run('tradeAgreement', { nation: 'singapore' }); h.run('defensePact', { nation: 'singapore' });
  assert.ok(!g.tradeAgreements.has('singapore') && !g.defensePacts.has('singapore'));
  assert.equal(h.run('basingAgreement', { nation: 'usa' }), false); assert.equal(h.run('basingAgreement', { nation: 'germany' }), false, 'not a host nation');
  const v = { ...g, embassies: new Set(), actionCooldowns: {} };
  const rows = verbsFor(v, 'singapore').map((r) => r.type);
  for (const t of ['stateVisit', 'foreignAid', 'basingAgreement', 'toggleSanctions']) assert.ok(rows.includes(t), t);
  for (const t of ['tradeAgreement', 'defensePact', 'establishEmbassy']) assert.ok(!rows.includes(t), t);
  const ba = verbsFor(v, 'singapore').find((r) => r.type === 'basingAgreement'); assert.match(ba.note, /need 20/); assert.match(ba.fx, /Changi Naval Base/);
  assert.equal(verbsFor(v, 'philippines').find((r) => r.type === 'basingAgreement').note, '', 'an ally may sign now');
  assert.ok(verbsFor(v, 'turkey').some((r) => r.type === 'tradeAgreement') && verbsFor(v, 'turkey').some((r) => r.type === 'basingAgreement'), 'a full diplomacy target that also hosts gets both');
});

test('240 months, every playable nation: invariants hold with host nations, agreements and tenure in play', () => {
  for (const c of COUNTRIES) {
    const h = headless(c.id, 9); h.g.gracePeriod = 0; h.g.stats = { ...h.g.stats, treasury: 500000 };
    for (const id of Object.keys(HOSTS)) if (id !== c.id) { h.run('stateVisit', { nation: id }); h.run('basingAgreement', { nation: id }); }
    months(h, 240);
    assert.ok(Object.keys(h.g.bases.agreements).every((k) => NATIONS[k].host && k !== c.id), c.id);
  }
});

test('App: the region list opens Singapore\'s nation sheet with its sites; a site opens the site sheet; the host chip goes back to the nation', async () => {
  const origErr = console.error; console.error = () => {};
  const g = await mount(BUNDLES.app, { testHook: true });
  try {
    await g.pickCountry(0); await flush();
    const { doc } = g; const q = (sel) => doc.querySelector(sel);
    const click = async (el) => { el.dispatchEvent(new g.w.MouseEvent('click', { bubbles: true })); await flush(); await flush(); };
    g.w.__wl.region('SEA'); await flush(); await flush();
    assert.ok(q('[data-nation-row=singapore]'), 'Singapore listed in Southeast Asia'); await click(q('[data-nation-row=singapore]'));
    assert.ok(q('[data-nation-sheet=singapore]')); assert.ok(q('[data-verb-row=basingAgreement]') && q('[data-verb-row=stateVisit]'));
    assert.match(q('[data-host-sites=singapore]').textContent, /Changi Naval Base.*Strait of Malacca/);
    await click(q('[data-verb-row=stateVisit] button'));
    await click(q('[data-host-site=changi]')); assert.ok(q('[data-site-sheet=changi]'), 'site sheet');
    await click(q('[data-host-nation=singapore]')); assert.ok(q('[data-nation-sheet=singapore]'), 'back to the nation sheet');
    assert.match(q('[data-nation-sheet=singapore]').textContent, /Relations8/, 'the visit landed');
  } finally { console.error = origErr; g.close(); }
});
