// Every nation-keyed verb in src/sim/actions.js, as a sheet row: label, cost, consequence, availability and
// the payload to dispatch. Costs and gates are quoted from the verb bodies (the verb still enforces them; the
// sheet only explains). test/shell.test.js asserts this table covers every VERBS entry whose payload has `nation`.
import { NATIONS, DIP_TARGETS, BUYERS, INTEL_TARGETS } from '../../data/nations.js';
import { INTEL_OPS } from '../../data/intel.js';
import { DV } from '../../data/platforms.js';
import { COMP_COLORS } from '../../data/regions.js';
import { opOddsTerms, memberGates } from '../../sim/selectors.js';
import { ALLIED_PROGRAMS, TIERS, TIER_ORDER } from '../../data/alliance.js';
import { BLACK_PROGRAMS } from '../../data/platforms.js';

const dip = (v, n) => DIP_TARGETS.some((d) => d.id === n);
const intel = (v, n) => INTEL_TARGETS.some((d) => d.id === n);
const buyer = (v, n) => BUYERS.some((b) => b.id === n);
export const isRival = (v, n) => n !== v.country?.id && (Object.keys(COMP_COLORS).includes(n) || v.rivalTension?.[n] != null);
const cd = (v, k) => v.actionCooldowns?.[k] || 0;
const money = (v) => v.stats?.treasury || 0;

// Two verbs are aliases of rows below: imposeSanctions (lane variant) runs toggleSanctions when adding (0.61.1);
// sellDefTech is what offerArms calls after its buyer checks.
export const NATION_VERB_ALIASES = { imposeSanctions: 'toggleSanctions', sellDefTech: 'offerArms' };

export const NATION_VERBS = [
  // E7 (#19): the owner (USA player) admits and expels program partners. Gates: relations 70, pact or NATO (CCA: NATO only), NATO 2%.
  { type: 'admitPartner', icon: '🤝', label: 'Admit to a program', cost: 'they pay the cost share', fx: 'Export income each month and +5 relations · leak risk, higher for flagged nations', when: (v, n) => admitOpts(v, n).length > 0, options: (v, n) => admitOpts(v, n), payload: (n, o) => ({ nation: n, program: o.split(':')[0], tier: o.split(':')[1] }) },
  { type: 'expelPartner', icon: '✖', label: 'Expel from a program', cost: '', fx: 'Stops their export income · relations −15', kind: 'warn', when: (v, n) => expelOpts(v, n).length > 0, options: (v, n) => expelOpts(v, n), payload: (n, o) => ({ nation: n, program: o }) },
  { type: 'stateVisit', icon: '🤝', label: 'State visit', cost: '$150M', fx: 'Relations +8 · 6-month cooldown', when: dip, note: (v, n) => cd(v, `visit_${n}`) ? `On cooldown ${cd(v, `visit_${n}`)}mo` : money(v) < 150 ? 'Need $150M' : '' },
  { type: 'foreignAid', icon: '💵', label: 'Foreign aid package', cost: '$600M', fx: 'Relations +15 · your sphere +5 in their region · 12-month cooldown', when: dip, note: (v, n) => cd(v, `aid_${n}`) ? `On cooldown ${cd(v, `aid_${n}`)}mo` : money(v) < 600 ? 'Need $600M' : '' },
  { type: 'tradeAgreement', icon: '📜', label: (v, n) => v.tradeAgreements?.has(n) ? 'Dissolve trade agreement' : 'Trade agreement', cost: 'free', fx: 'Monthly trade income stream · counts toward bloc tiers', when: dip, kind: (v, n) => v.tradeAgreements?.has(n) ? 'warn' : 'command' },
  { type: 'defensePact', icon: '🛡️', label: (v, n) => v.defensePacts?.has(n) ? 'Dissolve defense pact' : 'Defense pact', cost: '$800M', fx: 'Permanent sphere in their region · shared deterrence · needs embassy and +60 relations', when: dip, kind: (v, n) => v.defensePacts?.has(n) ? 'warn' : 'command', note: (v, n) => v.defensePacts?.has(n) ? '' : !v.embassies?.has(n) ? 'Establish an embassy first' : (v.nationRelations?.[n] || 0) < 60 ? `Need +60 relations (now ${Math.round(v.nationRelations?.[n] || 0)})` : '' },
  { type: 'establishEmbassy', icon: '🏛️', label: 'Establish embassy', cost: '$300M', fx: 'Relations +2/mo · $15M/mo upkeep · unlocks missions and pacts', when: (v, n) => dip(v, n) && !v.embassies?.has(n), note: (v, n) => (v.embassyLocks?.[n] || 0) > 0 ? `Persona non grata ${v.embassyLocks[n]}mo` : money(v) < 300 ? 'Need $300M' : '' },
  { type: 'toggleEmbassy', icon: '🏛️', label: 'Close embassy', cost: '', fx: 'Stops upkeep and the relations floor', kind: 'warn', when: (v, n) => dip(v, n) && v.embassies?.has(n) },
  { type: 'setEmbassyMission', icon: '🎯', label: 'Embassy mission', cost: '', fx: 'intel: counter-ops in country · trade: +$60M facilitation with an agreement · culture: +2.6 relations and sphere drip', when: (v, n) => v.embassies?.has(n), options: () => [['intel', '🕵️ Intel'], ['trade', '📜 Trade'], ['culture', '🎭 Culture']], current: (v, n) => v.embassyMissions?.[n] || 'intel', payload: (n, o) => ({ nation: n, mission: o }) },
  { type: 'setInfluence', icon: '📡', label: 'Influence weight', cost: 'from the pool', fx: 'Share of your monthly influence pool; embassy ×1.8, dominance ×1.4', when: dip, options: () => [[0, 'Off'], [1, '1'], [2, '2'], [3, '3']], current: (v, n) => v.influenceAlloc?.[n] || 0, payload: (n, o) => ({ nation: n, weight: o }) },
  { type: 'toggleSanctions', icon: '🚫', label: (v, n) => v.sanctions?.has(n) ? 'Lift sanctions' : 'Impose sanctions', cost: '', fx: 'Ruling 7: any nation. An ally costs −10 standing, bloc reset and a 12-month freeze', kind: (v, n) => v.sanctions?.has(n) ? 'good' : 'warn', when: () => true },
  { type: 'toggleEmbargo', icon: '⛽', label: (v, n) => v.embargoes?.has(n) ? 'Lift energy embargo' : 'Energy embargo', cost: '', fx: 'Needs oil or gas extraction ≥2 · price ×1.15, your volume ×0.8 · they may embargo back', kind: (v, n) => v.embargoes?.has(n) ? 'good' : 'alert', when: () => true, note: (v) => ((v.resExtraction?.oil || 0) >= 2 || (v.resExtraction?.gas || 0) >= 2) ? '' : 'Extraction too low to embargo' },
  { type: 'offerArms', icon: '✈️', label: 'Offer arms', cost: 'buyer pays', fx: 'Export revenue per month while relations hold · needs the vertical at L1+', when: buyer, options: (v, n) => { const b = BUYERS.find((x) => x.id === n); return Object.keys(DV).filter((k) => (v.defLevels?.[k] || 0) >= 1 && !(b?.noBuy || []).includes(k)).map((k) => [k, `${DV[k].i || ''} ${DV[k].n}`]); }, payload: (n, o) => ({ nation: n, vertical: o }), note: (v, n) => { const b = BUYERS.find((x) => x.id === n); const rel = v.nationRelations?.[n] !== undefined ? v.nationRelations[n] : b?.rel; return rel < -30 ? `Too hostile (${Math.round(rel)})` : ''; } },
  { type: 'runIntelOp', icon: '🕵️', label: 'Launch operation', cost: 'per op', fx: 'Odds from cyber, budget, doctrine, stations, ISR (tap a figure for the why)', kind: 'warn', when: intel, options: (v) => INTEL_OPS.map((o) => { const t = opOddsTerms(v, o.id); return [o.id, `${o.i} ${o.n} · $${o.cost}M · ${t ? Math.round(t.successRate * 100) : '?'}%`]; }), payload: (n, o) => ({ op: o, nation: n }) },
  { type: 'toggleContinuousOp', icon: '♻️', label: 'Standing program', cost: 'monthly', fx: 'Re-runs the op every month until stopped', when: intel, options: (v, n) => INTEL_OPS.map((o) => [o.id, `${v.continuousOps?.[`${o.id}@${n}`] ? '■ ' : ''}${o.i} ${o.n}`]), payload: (n, o) => ({ op: o, nation: n }) },
  { type: 'backChannel', icon: '📞', label: 'Back-channel', cost: '$250M', fx: 'Tension down · cooldown afterwards', when: isRival, payload: (n) => ({ nation: n, from: 'dossier' }), note: (v, n) => cd(v, `bc_${n}`) ? `Exhausted ${cd(v, `bc_${n}`)}mo` : '' },
  { type: 'regimeChange', icon: '🎯', label: 'Regime change (Tier-1)', cost: '$6B', fx: 'Overmatch math from deployed weight and ISR · an ally costs −8 stability, world −30, blocs frozen 24mo (ruling 7)', kind: 'alert', when: (v, n) => n !== v.country?.id },
  { type: 'nuclearDemonstration', icon: '☢', label: 'Nuclear demonstration', cost: '$1.5B', fx: 'Stability −5 · their sphere shaken · needs one strategic leg', kind: 'alert', when: isRival },
  { type: 'nuclearEmployment', icon: '☢️', label: 'Nuclear employment', cost: '$3B', fx: 'Ruling 3: parity means MAD. Needs 2+ strategic legs. Loss-adjacent.', kind: 'alert', when: isRival },
];

export const nationName = (n) => NATIONS[n]?.n || (n ? n.charAt(0).toUpperCase() + n.slice(1) : '');

// Rows for one nation under the current view.
export const verbsFor = (v, n) => NATION_VERBS.filter((r) => r.when(v, n)).map((r) => ({
  ...r,
  label: typeof r.label === 'function' ? r.label(v, n) : r.label,
  kind: typeof r.kind === 'function' ? r.kind(v, n) : r.kind || 'command',
  note: r.note ? r.note(v, n) : '',
  opts: r.options ? r.options(v, n) : null,
  cur: r.current ? r.current(v, n) : undefined,
  payload: r.payload || ((nation) => ({ nation })),
}));

const ownedPrograms = (v) => Object.keys(ALLIED_PROGRAMS).filter((p) => ALLIED_PROGRAMS[p].owner === v.country?.id);
function admitOpts(v, n) { return ownedPrograms(v).filter((p) => !v.arsenal?.access?.[p]?.[n]).flatMap((p) => TIER_ORDER.filter((t) => memberGates(v, p, n, t).every((x) => x.met)).map((t) => [`${p}:${t}`, `${BLACK_PROGRAMS[p].n} · ${TIERS[t].n}`])); }
function expelOpts(v, n) { return ownedPrograms(v).filter((p) => v.arsenal?.access?.[p]?.[n]).map((p) => [p, BLACK_PROGRAMS[p].n]); }
