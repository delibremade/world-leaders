// E8 (#20): troops, training, force quality and SOF tiers (spec Part 7). Game abstractions tuned for play, not an order of battle.
//
// Units. Strength (active, reserve) is an index 0..100: 60 = a fully manned 2024 force for that nation. Readiness per branch
// 0..100: 70 = standard training. Crews are trained crew sets (one fills one unit's crew requirement); the trained pool caps
// them at active strength x CREW_PER. Money in $M/month, on the scale of the v57 ledger (Personnel was $3M per unit).
import { PLATFORMS, BLACK_PROGRAMS } from './platforms.js';
import { SOF_ORBAT, SOF_RULES } from './sof.js';

export const BRANCHES = [['land', 'Land'], ['air', 'Air'], ['sea', 'Sea']];
export const BRANCH_IDS = BRANCHES.map(([b]) => b);

// Branch and crew sets per unit. Drone wings that attach to a host (CCA, GJ-11, S-70, GCAP adjuncts) fly with the host's crews.
export const PLATFORM_CREW = {
  fighter_wing: ['air', 2], missile_brigade: ['land', 1], carrier_group: ['sea', 4], sub_fleet: ['sea', 2], satellite_net: ['land', 1],
  cyber_command: ['land', 1], drone_swarm: ['air', 1], rq170: ['air', 1], rq180: ['air', 1], fa_xx: ['air', 2], mq25: ['air', 1],
  frigate: ['sea', 1], zumwalt: ['sea', 2], hypersonic_bty: ['land', 1], mech_division: ['land', 2], frigate_sqn: ['sea', 1],
  ssbn_fleet: ['sea', 3], strategic_bombers: ['air', 2], icbm_force: ['land', 1],
};
export const SLOT_CREW = { gen5: ['air', 2], gen6: ['air', 2], bomber: ['air', 2], cca: ['air', 0], isr: ['air', 1], ssn: ['sea', 2], carrier: ['sea', 4] };
export const crewOf = (id) => {
  const [b, n] = PLATFORM_CREW[id] || SLOT_CREW[BLACK_PROGRAMS[id]?.slot] || ['land', 1];
  return { b, n: BLACK_PROGRAMS[id]?.attachesTo ? 0 : n };
};
export const ALL_UNITS = [...Object.keys(PLATFORMS), ...Object.keys(BLACK_PROGRAMS)];

// Training budget levels: monthly cost, the readiness each sustains, crew sets entering the pipeline per branch per month.
export const TRAINING = [
  { id: 'none', n: 'Unfunded', cost: 0, target: 25, crews: 0 },
  { id: 'minimal', n: 'Minimal', cost: 8, target: 50, crews: 1 },
  { id: 'standard', n: 'Standard', cost: 20, target: 70, crews: 2 },
  { id: 'intensive', n: 'Intensive', cost: 45, target: 85, crews: 3 },
];

export const FORCE_RULES = {
  start: { active: 60, reserve: 36, retention: 50, readiness: 70, train: 2 },
  // Manpower. recruits/mo = recruit x (0.5 + unemployment/10, clamped 0.5..2) x pay/100. attrition/mo = active x attrition x (2 - retention/50).
  recruit: 0.48, attrition: 0.008, reserveIn: 0.5, reserveOut: 0.01,
  // Retention target = 40 + (pay - 100) x payW + (stability - 50) x stabW - civilian pull (growth above 2%) + slack labor market; moves retLag/month.
  payW: 0.6, stabW: 0.5, civW: 5, unempW: 1, retLag: 0.1,
  payMax: 200,
  // Payroll $M/mo at 100% pay (scaled by pay): per point of active and reserve strength (SOF pay premium per operator: SOF_RULES.pay).
  payroll: { active: 0.25, reserve: 0.05 },
  // Quality lags its vitals target by qualityLag/month (a cohort trains for years): neglect shows up years later.
  qualityLag: 1 / 36,
  // Readiness rises at most riseMo/month toward the training target (pipeline months), decays decayMo/month when above it.
  riseMo: 1.5, decayMo: 1, exercise: { target: 10, rise: 0.5 },
  // Crews: pool = active x CREW_PER[branch]; pipeline months per branch; spare crews trained beyond owned units.
  crewPer: { land: 0.6, air: 0.5, sea: 0.4 }, pipeMo: { land: 6, air: 12, sea: 15 }, spare: { land: 6, air: 6, sea: 6 },
  crewAttrition: 0.01,
};

// SOF: F8 (#56) moves the Tier 1 / Tier 2 units, their rules and selectors to src/data/sof.js (named units with operator counts).
// SOF_UNITS keeps the lead unit name per tier for text that names one.
export { SOF_RULES };
export const SOF_UNITS = Object.fromEntries(Object.entries(SOF_ORBAT).map(([nid, us]) => [nid, { t1: us.find((u) => u.tier === 1).n, t2: us.find((u) => u.tier === 2).n,
  status_source: [...new Set(us.map((u) => u.status_source))].join('; ') }]));

// ── F7 (#55), spec Part 9: the tangible order of battle (inventories in src/data/orbat.js). Game rules, tuned for play, on the v57
// money scale. Manpower is headcounts; `manPts` (formulas.js) maps them back to the 0..100 index above (60 = the nation's 2024 active).
export const FLEET_RULES = {
  // Capability weight per platform (F-35A = 1): role base x airframe generation. Game weights, not sourced.
  roleW: { fighter: 1, attack: 0.7, bomber: 3, tanker: 0.6, awacs: 2, airlift: 0.5, mpa: 0.8, ew: 0.8, isr: 0.4, drone: 0.3, helo: 0.25,
    carrier: 25, ssn: 6, ssbn: 10, ssgn: 8, ssk: 2.5, cruiser: 5, destroyer: 4, frigate: 2, lcs: 1, corvette: 0.8, amphib: 3,
    armor: 12, infantry: 9, stryker: 10, battalion: 2.5, icbm: 0.5 },
  genF: { 3: 0.6, 4: 0.8, 5: 1, 6: 1.3 },
  // Force quality applied per type: qualityF(q)^sens. Complex kit (5th/6th gen) feels quality most; launchers least.
  sens: { gen6: 1, gen5: 1, gen4: 0.8, gen3: 0.6, hull: 0.7, formation: 0.9, launcher: 0.4 },
  // Maintenance budget per type, % of 2024 funding (0..200). MC target = 2024 MC x (pct/100)^maintExp (capped at maintCap) x depot term
  // x quality term (relative to the start, half sensitivity) x (1 + mcBlk x block). MC moves converge x depot/100 of the gap a month,
  // so a 10% cut costs an F-22 fleet ~3 points of MC within 12 months.
  maintExp: 0.8, maintCap: 1.12, depotExp: 0.3, converge: 0.12, mcBlk: 0.04,
  // $M/mo: Maintenance = sum n x weight x om x pct/100 (US ~$60M at 100%); Depot = depotCost x Maintenance at 100% x (depot/100)^1.5.
  om: 0.01, depotCost: 0.25, pctMax: 200,
  // Modernization (block upgrade / SLEP): one-time n x weight x modCost $M, modMo x 100/depot months, modShare of the fleet in the depot
  // meanwhile; each block +blkGain effectiveness. maxBlk blocks per type.
  modCost: 8, modMo: 24, modShare: 0.15, blkGain: 0.08, maxBlk: 3,
  // Peacetime attrition (mishaps), share of airframes per year; hulls and formations 0.
  lossYr: { airframe: 0.003, hull: 0, formation: 0, launcher: 0 },
  // Crews: each branch's share of active strength that crews and maintains its fleet = 2024 need / 2024 active x (1 + crewSlack).
  // #91: crewShare only seeds the start; trained crews are then headcounts that grow with the fleet (CREW_PIPE below).
  crewSlack: 0.1,
  // #91 crew pipelines (headcounts, per branch). Trained crews = manpower x training funding x pipeline capacity:
  //   starts/mo = min(want, cap x fund, recruits x intake share): want refills the target (need x (1 + crewSlack)) plus the pipeline's
  //   own pipeMo months of replacement; cap is the schools' throughput (heads/mo); fund = crew funding % (0..fundMax) / 100, zero when the
  //   training budget is Unfunded; recruits are this month's accessions (population x propensity), of which `intake` may enter crew pipelines.
  //   Graduates join after FORCE_RULES.pipeMo months; trained crews leave at the active force's turnover.
  // cap starts at capX x replacement. While fund >= 1 it grows by up to `grow` of itself a month toward what the target needs (procurement
  // grows the matching pipeline); it shrinks `shrink` a month only above 1.5x that. expandPipeline buys `expand` x cap at once for
  // expandMo months of its running cost. Running cost: 'Crew pipeline' = sum cap x perHead x fund ($M per head-month of throughput).
  // spare: the trained-ahead floor per branch, heads: one fighter squadron's crews and maintainers (24 x 13.25 = 318) and one frigate's company (200), each +10%, so a
  // small force can take delivery of one unit without waiting a pipeline length. The target is need + max(crewSlack x need, spare).
  crewPipe: { spare: { land: 0, air: 350, sea: 220 }, intake: 0.8, capX: 1.25, grow: 0.15, shrink: 0.02, fundMax: 150, expand: 0.5, expandMo: 12, perHead: { land: 0.001, air: 0.02, sea: 0.008 } },
  // Equipment factor bounds (ready capability / 2024 capability at reference quality).
  eqMin: 0.3, eqMax: 1.25,
};
