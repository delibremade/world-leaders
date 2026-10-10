// "Why now" lines (F2, #33): one per decision and world event, naming the state that opened its gate, with the number.
// Pure functions of the same context the gate read: { g, ns, ten, rel, bt, ex, dl }. Written beside the gates in
// world.js / events.js, not inside them, so the 50 gates stay untouched. test/briefing.test.js asserts every
// registered id has one and that it returns a non-empty string on a live game.
import { cap1, maxTen, hottest, memberOf, ownedMembers, squeezed, tightest, strongest, mineralName, lowestReadiness } from './event-ctx.js';
import { crewStatus } from '../sim/forces.js';
import { myAccess } from '../sim/selectors.js';

const n1 = (v) => (Math.round((v ?? 0) * 10) / 10).toFixed(1);
const n0 = (v) => String(Math.round(v ?? 0));
const rival = (c) => { const h = hottest(c.g); return h ? `${cap1(h)} tension ${n0(maxTen(c.g))}` : `tension ${n0(maxTen(c.g))}`; };
const me = (c) => c.g.country?.name || cap1(c.g.country?.id);

export const DECISION_WHY = {
  summit: (c) => `${rival(c)}, past the 50 where talks open`,
  defector: (c) => `${rival(c)}, high enough to tempt a defector`,
  expo: (c) => `${Object.keys(c.ex).length} arms deals live, enough for an expo`,
  pole_test: (c) => `Bloc trade at ${c.bt.cn ?? 0} (China) and ${c.bt.eu ?? 0} (EU) tiers: a pole is being tested`,
  labor: (c) => c.ns.unemployment > 5 ? `Unemployment ${n1(c.ns.unemployment)}%, above 5` : `Inequality ${n0(c.ns.inequality)}, above 62`,
  fdi: (c) => `GDP growth ${n1(c.ns.gdpGrowth)}%, below 2.5`,
  protest: (c) => c.ns.stability < 58 ? `Stability ${n0(c.ns.stability)}, below 58` : `Inequality ${n0(c.ns.inequality)}, above 70`,
  tech_wave: (c) => `Defense levels total ${n0(Object.values(c.dl).reduce((a, b) => a + (b || 0), 0))}, at least 10`,
  j36_setback: (c) => `${me(c)} has the J-36 in development`,
  j50_setback: (c) => `${me(c)} has the J-50 in development`,
  s70_engines: (c) => `${me(c)} has the S-70 in development`,
  gcap_workshare: (c) => `${me(c)} is an active GCAP partner`,
  fcas_defection: (c) => `${me(c)} founded FCAS and it is still active`,
  f47_buyer_offer: (c) => `Relations with the USA at ${n0(c.rel.usa)}, past 45, with no F-47 access`,
  usa_admission: (c) => `Relations with Japan ${n0(c.rel.japan)} and Norway ${n0(c.rel.norway)}: one is past 45, neither is in F-47`,
  flagged_trade_offer: (c) => `Growth ${n1(c.ns.gdpGrowth)}% and ${memberOf(c.g)?.pid?.toUpperCase()} membership leave a China deal open`,
  ore_runout: (c) => { const t = tightest(c.g); return `${mineralName(t.m)} ore lasts ${n0(t.months)} more months`; },
  controls_temptation: (c) => `${rival(c)}, and you process ${mineralName(strongest(c.g))} with no controls set`,
  controls_review: (c) => `${c.g.minerals.controls.length} export control(s) in force`,
  processing_pact_offer: (c) => { const t = tightest(c.g); return squeezed(c.g) ? `${mineralName(squeezed(c.g))} is being withheld from you` : `${mineralName(t.m)} is tight and ${rival(c)}`; },
  pay_dispute: (c) => `Retention ${n0(c.g.forces.retention)}%, pay at ${n0(c.g.personnelPay ?? 100)}%`,
  crew_shortfall: (c) => { const b = Object.entries(crewStatus(c.g)).find(([, s]) => s.gap > 0); return `${cap1(b?.[0])} is ${n0(b?.[1].gap)} crew short of its hulls`; },
  quality_warning: (c) => `Force quality ${n0(c.g.forces.quality)}, below 48`,
  joint_exercise: (c) => `${c.g.defensePacts?.size || 0} defense pact(s) and readiness down to ${n0(lowestReadiness(c.g))}`,
  sof_raid: (c) => `${rival(c)} and ${c.g.forces.sof.t1} Tier-1 operator unit(s) ready`,
  sof_selection: (c) => `${rival(c)} and a Tier-2 pool of ${c.g.forces.sof.t2} to draw from`,
  sof_scandal: (c) => 'The raid is on record and Tier-1 units are fielded',
  reserve_window: (c) => `Reserve at ${n1(c.g.spr)}, inflation ${n1(c.ns.inflation)}%, ${rival(c)}: a cheap refill window`,
  double_agent: (c) => `${(c.g.intelOps || []).length} intel op(s) running with ${rival(c)}`,
  coastal_standoff: (c) => `${rival(c)}, past 45 and no nuclear use on record`,
};

export const WORLD_WHY = {
  hormuz_closure: (g) => `${cap1(hottest(g))} tension ${n0(maxTen(g))}, past the 25 that closes the Gulf`,
  red_sea_attacks: (g) => `${cap1(hottest(g))} tension ${n0(maxTen(g))}, past 20`,
  panama_drought: (g) => 'Dry season (December to May): the canal runs short',
  regional_war: (g) => `${cap1(hottest(g))} tension ${n0(maxTen(g))}, past 35`,
  pandemic: (g) => `Healthcare ${n0(g.stats?.healthcare)}, below 85`,
  financial_crisis: (g) => (g.stats?.inflation ?? 0) > 3 ? `Inflation ${n1(g.stats.inflation)}%, above 3` : (g.stats?.debtGdp ?? 0) > 70 ? `Debt ${n0(g.stats.debtGdp)}% of GDP, above 70` : `GDP growth ${n1(g.stats?.gdpGrowth)}%, below 2`,
  energy_crunch: (g) => g.embargoedBy ? `Embargoed by ${cap1(g.embargoedBy.by)}` : (g.spr || 0) < 2 ? `Reserve down to ${n1(g.spr)}` : `${cap1(hottest(g))} tension ${n0(maxTen(g))}, past 20`,
  breakthrough: (g) => `A defense vertical reached level ${n0(Math.max(0, ...Object.values(g.defLevels || {})))}`,
  nuclear_taboo: () => 'Nuclear weapons were used',
  mineral_controls_bite: (g) => `${mineralName(squeezed(g))} is withheld by a processor`,
  export_backlash: (g) => `${g.minerals?.controls?.length || 0} export control(s) of yours in force`,
  partner_security_audit: (g) => `You belong to ${memberOf(g)?.pid?.toUpperCase()}, owned by ${cap1(memberOf(g)?.owner)}`,
  owner_leak_scare: (g) => `${ownedMembers(g).length} partner(s) admitted to your programs`,
  readiness_grounding: (g) => `Readiness down to ${n0(lowestReadiness(g))}, below 55`,
  recruitment_slump: (g) => `Retention ${n0(g.forces?.retention)}%, active manpower ${n0(g.forces?.active)}`,
  hostage_crisis: (g) => `${g.forces?.sof?.t1 || 0} Tier-1 unit(s) abroad and tension ${n0(maxTen(g))}`,
  sanctions_wave: (g) => `${g.sanctions?.size || 0} sanction(s) of yours and tension ${n0(maxTen(g))}`,
  grid_attack: (g) => `Cyber level ${n0(g.defLevels?.cyber)} and tension ${n0(maxTen(g))}`,
  false_alarm: (g) => `${cap1(hottest(g))} tension ${n0(maxTen(g))}, on the brink`,
  peace_accord: (g) => `${cap1(hottest(g))} tension ${n0(maxTen(g))}: both capitals want an exit`,
};

// Always a non-empty string: a missing or throwing entry falls back to the three loudest vitals, so a card never
// opens without a reason. (The registry test makes the fallback unreachable for shipped ids.)
export function whyFor(kind, id, ctx) {
  const f = (kind === 'decision' ? DECISION_WHY : WORLD_WHY)[id];
  try { const s = f?.(kind === 'decision' ? ctx : ctx.g); if (s) return String(s); } catch { /* fall through */ }
  const s = ctx.g.stats || {};
  return `Inflation ${n1(s.inflation)}%, unemployment ${n1(s.unemployment)}%, stability ${n0(s.stability)}`;
}
