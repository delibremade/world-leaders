// Trigger evidence (FIX 5): the causal chain behind every decision and world event, as data the card renders.
//   { key, label, value, unit, cmp, threshold, trend: { months, dir, from }, cause }
// key/label/value: the metric the gate read and its value at the fire; cmp/threshold: the gate ('>=' 25);
// trend: how many consecutive months the metric moved one way before the fire (from the 12-month history the
// event system keeps in evState.hist); cause: the upstream state that moved it (what drained the reserve, what
// raised the tension). Gates stay where they are (world.js, events.js); this file mirrors them like event-why.js
// does, and test/event-evidence.test.js asserts every registered id has an entry and every fire records one.
import { cap1, maxTen, hottest, memberOf, ownedMembers, squeezed, squeezedCount, tightest, strongest, mineralName, lowestReadiness } from './event-ctx.js';
import { crewStatus } from '../sim/forces.js';
import { sofFree, sofOps } from './sof.js';
import { myAccess } from '../sim/selectors.js';
import { NATIONS } from './nations.js';

export const HIST_MONTHS = 12;
const n1 = (v) => Math.round((v ?? 0) * 10) / 10;
const lvl = (g) => Object.values(g.defLevels || {});

// Metrics the gates read. `read` is pure over g; numeric ones are tracked monthly for the trend.
export const METRICS = {
  tension:      { label: 'Rival tension', unit: '', read: (g) => maxTen(g) },
  spr:          { label: 'Strategic reserve', unit: ' mo', read: (g) => n1(g.spr || 0) },
  healthcare:   { label: 'Healthcare', unit: '', read: (g) => n1(g.stats?.healthcare) },
  inflation:    { label: 'Inflation', unit: '%', read: (g) => n1(g.stats?.inflation) },
  debtGdp:      { label: 'Debt/GDP', unit: '%', read: (g) => n1(g.stats?.debtGdp) },
  gdpGrowth:    { label: 'GDP growth', unit: '%', read: (g) => n1(g.stats?.gdpGrowth) },
  unemployment: { label: 'Unemployment', unit: '%', read: (g) => n1(g.stats?.unemployment) },
  inequality:   { label: 'Inequality', unit: '', read: (g) => n1(g.stats?.inequality) },
  stability:    { label: 'Stability', unit: '', read: (g) => n1(g.stats?.stability) },
  readiness:    { label: 'Lowest readiness', unit: '', read: (g) => n1(lowestReadiness(g)) },
  retention:    { label: 'Retention', unit: '%', read: (g) => n1(g.forces?.retention ?? 100) },
  quality:      { label: 'Force quality', unit: '', read: (g) => n1(g.forces?.quality ?? 100) },
  defTop:       { label: 'Top defense level', unit: '', read: (g) => Math.max(0, ...lvl(g)) },
  defSum:       { label: 'Defense levels total', unit: '', read: (g) => lvl(g).reduce((a, b) => a + (b || 0), 0) },
  cyber:        { label: 'Cyber level', unit: '', read: (g) => g.defLevels?.cyber || 0 },
  controls:     { label: 'Export controls', unit: '', read: (g) => g.minerals?.controls?.length || 0 },
  squeezed:     { label: 'Minerals withheld from you', unit: '', read: (g) => squeezedCount(g) },
  sanctions:    { label: 'Your sanctions', unit: '', read: (g) => g.sanctions?.size || 0 },
  armsDeals:    { label: 'Arms deals', unit: '', read: (g) => Object.keys(g.defExports || {}).length },
  intelOps:     { label: 'Intel ops running', unit: '', read: (g) => (g.intelOps || []).length },
  pacts:        { label: 'Defense pacts', unit: '', read: (g) => g.defensePacts?.size || 0 },
  partners:     { label: 'Partners admitted', unit: '', read: (g) => ownedMembers(g).length },
  blocTier:     { label: 'Top bloc tier', unit: '', read: (g) => Math.max(0, g.blocTrade?.cn || 0, g.blocTrade?.eu || 0) },
  relUsa:       { label: 'Relations with the USA', unit: '', read: (g) => n1(g.nationRelations?.usa) },
  relAllies:    { label: 'Best of Japan / Norway relations', unit: '', read: (g) => n1(Math.max(g.nationRelations?.japan || 0, g.nationRelations?.norway || 0)) },
  oreMonths:    { label: 'Tightest ore', unit: ' mo', read: (g) => { const t = tightest(g); return t ? n1(t.months) : 999; } },
  sofT1:        { label: 'Tier-1 sub-units free', unit: '', read: (g) => sofFree(g.forces, 1) },
  sofT2:        { label: 'Tier-2 operators', unit: '', read: (g) => Math.round(sofOps(g.forces, 2)) },
  crewGap:      { label: 'Crew gap', unit: '', read: (g) => (g.forces ? Object.values(crewStatus(g)).reduce((a, s) => a + Math.max(0, s.gap || 0), 0) : 0) },
  month:        { label: 'Calendar month', unit: '', read: (g) => (g.date?.mo ?? 0) + 1 },
};
export const HIST_KEYS = ['tension', 'spr', 'healthcare', 'inflation', 'debtGdp', 'gdpGrowth', 'unemployment', 'inequality', 'stability', 'readiness', 'retention', 'quality'];

// Month step for evState.hist: each tracked metric keeps its last HIST_MONTHS values, oldest first.
export function recordHist(hist, g) {
  const out = {};
  for (const k of HIST_KEYS) { const v = METRICS[k].read(g); const prev = hist?.[k] || []; out[k] = [...prev, Number.isFinite(v) ? v : 0].slice(-HIST_MONTHS); }
  return out;
}
// Consecutive months the metric moved one way up to `value` (the value now), from the oldest point of that run.
export function trendOf(hist, key, value) {
  const h = [...(hist?.[key] || []), value];
  let months = 0, dir = 'flat';
  for (let i = h.length - 1; i > 0; i--) {
    const d = h[i] - h[i - 1]; const s = d > 1e-9 ? 'rising' : d < -1e-9 ? 'falling' : 'flat';
    if (s === 'flat') break;
    if (dir === 'flat') dir = s; else if (s !== dir) break;
    months++;
  }
  return { months, dir, from: months ? h[h.length - 1 - months] : value };
}

// Upstream causes, per metric: what in the state is moving it right now.
const rivalCause = (g) => {
  const r = hottest(g); if (!r) return 'no rival on the register';
  const parts = [];
  if (Object.values(g.blockades || {}).some((b) => b?.target === r)) parts.push(`your blockade on ${cap1(r)}`);
  if (g.sanctions?.has?.(r)) parts.push(`your sanctions on ${cap1(r)}`);
  const ops = (g.intelOps || []).filter((o) => o.targetId === r).length; if (ops) parts.push(`${ops} intel op(s) against ${cap1(r)}`);
  const rg = NATIONS[r]?.region; const dep = rg && Object.values(g.forceDeployments?.[rg] || {}).reduce((a, b) => a + (b || 0), 0); if (dep) parts.push(`${dep} unit(s) deployed in ${cap1(r)}'s region`);
  if (g.ultimatum?.cid === r) parts.push('a live ultimatum');
  return parts.length ? `${cap1(r)}: ${parts.join(', ')}` : `${cap1(r)}: rival pressure cycle (no escalation of yours on record)`;
};
const CAUSES = {
  tension: rivalCause,
  spr: (g) => { const p = []; if (g.sprRelease) p.push('a reserve release in progress (−1 mo each month)'); if (g.embargoedBy) p.push(`an energy embargo by ${cap1(g.embargoedBy.by)}`); const cut = Object.entries(g.chokeStatus || {}).filter(([, s]) => s && s !== 'open').map(([k]) => k); if (cut.length) p.push(`chokepoint(s) ${cut.join(', ')} not open`); const ic = g.importContracts?.size || 0; p.push(ic ? `${ic} import contract(s) covering the gap` : 'no import contracts'); return p.join('; '); },
  healthcare: (g) => `healthcare budget at ${Math.round(g.budgetAlloc?.healthcare ?? 100)}% of baseline${(g.activeEffects || []).some((e) => e.stat === 'healthcare' && e.d < 0) ? ', an active effect pulling it down' : ''}`,
  inflation: (g) => `spending ${g.spendingMode || 'balanced'}, interest rate ${n1(g.interestRate)}%${g.sprRelease ? ', reserve release easing it' : ''}${g.embargoedBy ? `, embargo by ${cap1(g.embargoedBy.by)} raising import cost` : ''}`,
  debtGdp: (g) => `spending ${g.spendingMode || 'balanced'}, taxes ${g.taxPolicy || 'balanced'}, interest rate ${n1(g.interestRate)}%`,
  gdpGrowth: (g) => `taxes ${g.taxPolicy || 'balanced'}, ${g.tradeAgreements?.size || 0} trade agreement(s), ${g.sanctions?.size || 0} sanction(s) of yours${g.embargoedBy ? `, embargoed by ${cap1(g.embargoedBy.by)}` : ''}`,
  unemployment: (g) => `GDP growth ${n1(g.stats?.gdpGrowth)}%, technology budget at ${Math.round(g.budgetAlloc?.technology ?? 100)}%`,
  inequality: (g) => `taxes ${g.taxPolicy || 'balanced'}, education budget at ${Math.round(g.budgetAlloc?.education ?? 100)}%`,
  stability: (g) => `inflation ${n1(g.stats?.inflation)}%, unemployment ${n1(g.stats?.unemployment)}%, inequality ${n1(g.stats?.inequality)}`,
  readiness: (g) => `training level ${g.forces?.training ?? '?'}, ${Object.keys(g.forceDeployments || {}).length} theater(s) with deployments`,
  retention: (g) => `pay at ${Math.round(g.personnelPay ?? 100)}% of baseline`,
  quality: (g) => `training level ${g.forces?.training ?? '?'}, education ${n1(g.stats?.education)}`,
  defTop: (g) => `research funded to level ${Math.max(0, ...lvl(g))} in ${Object.entries(g.defLevels || {}).filter(([, v]) => v >= 3).map(([k]) => k).join(', ') || 'no vertical'}`,
  defSum: (g) => `${Object.keys(g.defLevels || {}).length} verticals funded`,
  cyber: (g) => `cyber R&D at level ${g.defLevels?.cyber || 0}`,
  controls: (g) => `controls set on ${(g.minerals?.controls || []).map(mineralName).join(', ') || 'nothing'}`,
  squeezed: (g) => `${mineralName(squeezed(g))} withheld by a processor after ${rivalCause(g)}`,
  sanctions: (g) => `sanctions on ${[...(g.sanctions || [])].map(cap1).join(', ') || 'no one'}`,
  armsDeals: (g) => `${Object.keys(g.defExports || {}).length} export deal(s) signed on the Arsenal tab`,
  intelOps: (g) => `${(g.intelOps || []).length} op(s) launched from the Intel tab`,
  pacts: (g) => `pacts with ${[...(g.defensePacts || [])].map(cap1).join(', ') || 'no one'}`,
  partners: (g) => `${ownedMembers(g).length} nation(s) admitted to your programs`,
  blocTier: (g) => `bloc trade tiers China ${g.blocTrade?.cn || 0}, EU ${g.blocTrade?.eu || 0}`,
  relUsa: (g) => `relations built with the USA (visits, aid, trade)`,
  relAllies: (g) => `relations built with Japan ${Math.round(g.nationRelations?.japan || 0)} and Norway ${Math.round(g.nationRelations?.norway || 0)}`,
  oreMonths: (g) => { const t = tightest(g); return t ? `${mineralName(t.m)} processing outruns its ore` : 'no processing'; },
  sofT1: () => 'Tier-1 units fielded and not deployed',
  sofT2: () => 'the Tier-2 pool with room to select from',
  crewGap: (g) => `hulls and wings bought faster than crews trained (retention ${Math.round(g.forces?.retention ?? 100)}%)`,
  month: () => 'the dry season (December to May)',
};

// Gate mirrors. num(key, cmp, threshold) reads METRICS[key]; state(label, text) is a non-numeric gate.
const num = (key, cmp, threshold, cause = null) => (g) => ({ key, cmp, threshold, cause: cause ? cause(g) : CAUSES[key](g) });
const state = (label, text, cause) => (g) => ({ key: 'state', label, text: text(g), cause: cause(g) });
const ten = (t, cause = null) => num('tension', '>=', t, cause);
export const WORLD_EVIDENCE = {
  hormuz_closure: ten(25), red_sea_attacks: ten(20), regional_war: ten(35), false_alarm: ten(70), peace_accord: ten(40),
  panama_drought: num('month', 'in', 'Dec–May'),
  pandemic: num('healthcare', '<', 85),
  financial_crisis: (g) => ((g.stats?.inflation ?? 0) > 3 ? num('inflation', '>', 3) : (g.stats?.debtGdp ?? 0) > 70 ? num('debtGdp', '>', 70) : num('gdpGrowth', '<', 2))(g),
  energy_crunch: (g) => (g.embargoedBy ? state('Energy embargo', (g) => `embargoed by ${cap1(g.embargoedBy.by)}`, CAUSES.spr) : (g.spr || 0) < 2 ? num('spr', '<', 2) : ten(20))(g),
  breakthrough: num('defTop', '>=', 3),
  nuclear_taboo: state('Nuclear use', () => 'nuclear weapons were used', (g) => `${(g.nukeLog || []).length} employment(s) on the register`),
  mineral_controls_bite: num('squeezed', '>=', 1),
  export_backlash: num('controls', '>=', 1),
  partner_security_audit: state('Program membership', (g) => `member of ${memberOf(g)?.pid?.toUpperCase()} (owner ${cap1(memberOf(g)?.owner)})`, (g) => `admitted at tier ${memberOf(g)?.tier}`),
  owner_leak_scare: num('partners', '>=', 1),
  readiness_grounding: num('readiness', '<', 55),
  recruitment_slump: num('retention', '<', 40),
  hostage_crisis: num('sofT1', '>=', 1, (g) => `${rivalCause(g)}; Tier-1 free`),
  sanctions_wave: num('sanctions', '>=', 1, (g) => `${CAUSES.sanctions(g)}; ${rivalCause(g)}`),
  grid_attack: num('cyber', '<=', 2, (g) => `${CAUSES.cyber(g)}; ${rivalCause(g)}`),
};
export const DECISION_EVIDENCE = {
  summit: ten(50), defector: ten(35), coastal_standoff: ten(45),
  expo: num('armsDeals', '>=', 3),
  pole_test: num('blocTier', '>=', 2),
  labor: (g) => ((g.stats?.unemployment ?? 0) > 5 ? num('unemployment', '>', 5) : num('inequality', '>', 62))(g),
  fdi: num('gdpGrowth', '<', 2.5),
  protest: (g) => ((g.stats?.stability ?? 100) < 58 ? num('stability', '<', 58) : num('inequality', '>', 70))(g),
  tech_wave: num('defSum', '>=', 10),
  j36_setback: state('Program', () => 'J-36 in development', () => 'the prototype line is live'),
  j50_setback: state('Program', () => 'J-50 in development', () => 'the prototype line is live'),
  s70_engines: state('Program', () => 'S-70 in development', () => 'the prototype line is live'),
  gcap_workshare: state('Program', () => 'active GCAP partner', (g) => `GCAP access ${myAccess(g, 'gcap')?.status}`),
  fcas_defection: state('Program', () => 'FCAS founder, program active', (g) => `FCAS access ${myAccess(g, 'fcas')?.status}`),
  f47_buyer_offer: num('relUsa', '>=', 45),
  usa_admission: num('relAllies', '>=', 45),
  flagged_trade_offer: num('gdpGrowth', '<', 3, (g) => `${CAUSES.gdpGrowth(g)}; member of ${memberOf(g)?.pid?.toUpperCase()} with no China agreement`),
  ore_runout: num('oreMonths', '<', 24),
  controls_temptation: ten(30),
  controls_review: num('controls', '>=', 1),
  processing_pact_offer: (g) => (squeezed(g) ? num('squeezed', '>=', 1) : num('oreMonths', '<', 24))(g),
  pay_dispute: num('retention', '<', 45),
  crew_shortfall: num('crewGap', '>=', 1),
  quality_warning: num('quality', '<', 48),
  joint_exercise: num('readiness', '<', 80, (g) => `${CAUSES.pacts(g)}; ${CAUSES.readiness(g)}`),
  sof_raid: ten(20, (g) => `${rivalCause(g)}; ${sofFree(g.forces, 1)} Tier-1 sub-unit(s) free`),
  sof_selection: ten(15, (g) => `${rivalCause(g)}; ${CAUSES.sofT2(g)}`),
  sof_scandal: state('Record', () => 'the raid is on record', (g) => `Tier-1 units fielded: ${sofFree(g.forces, 1)} free`),
  reserve_window: num('spr', '<', 4, (g) => `${CAUSES.spr(g)}; inflation ${n1(g.stats?.inflation)}%, tension ${maxTen(g)}`),
  double_agent: num('intelOps', '>=', 1, (g) => `${CAUSES.intelOps(g)}; ${rivalCause(g)}`),
};

// Always returns an object. kind: 'world' | 'decision'; ctx: { g, ... } (the gate's context); hist: evState.hist.
export function evidenceFor(kind, id, ctx, hist = {}) {
  const g = ctx.g; const f = (kind === 'decision' ? DECISION_EVIDENCE : WORLD_EVIDENCE)[id];
  try {
    const e = f?.(g);
    if (e && e.key === 'state') return { key: 'state', label: e.label, text: e.text, value: null, unit: '', cmp: '', threshold: null, trend: { months: 0, dir: 'flat', from: null }, cause: String(e.cause || '') };
    if (e && METRICS[e.key]) { const m = METRICS[e.key]; const value = m.read(g); return { key: e.key, label: m.label, value, unit: m.unit, cmp: e.cmp, threshold: e.threshold, trend: trendOf(hist, e.key, value), cause: String(e.cause || '') }; }
  } catch { /* fall through */ }
  const s = g.stats || {};
  return { key: 'fallback', label: 'Vitals', value: null, unit: '', cmp: '', threshold: null, trend: { months: 0, dir: 'flat', from: null }, cause: `inflation ${n1(s.inflation)}%, unemployment ${n1(s.unemployment)}%, stability ${Math.round(s.stability ?? 0)}` };
}
// The line the card prints under "Why now".
export function evidenceLine(ev) {
  if (!ev) return '';
  const cmpWord = { '>=': 'at or above', '>': 'above', '<': 'below', '<=': 'at or below', in: 'in' }[ev.cmp] || ev.cmp;
  const head = ev.key === 'state' || ev.key === 'fallback' ? `${ev.label}: ${ev.text || ev.cause}` : `${ev.label} ${ev.value}${ev.unit}, ${cmpWord} ${ev.threshold}${typeof ev.threshold === 'number' ? ev.unit : ''}`;
  const t = ev.trend; const trend = t && t.months > 0 ? ` · ${t.dir} ${t.months} month${t.months > 1 ? 's' : ''} (from ${t.from}${ev.unit})` : (ev.key !== 'state' && ev.key !== 'fallback' ? ' · steady this month' : '');
  const cause = ev.key === 'state' || ev.key === 'fallback' ? (ev.key === 'state' ? ` · ${ev.cause}` : '') : ` · driven by ${ev.cause}`;
  return `${head}${trend}${cause}`;
}
