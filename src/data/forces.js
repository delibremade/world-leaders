// E8 (#20): troops, training, force quality and SOF tiers (spec Part 7). Game abstractions tuned for play, not an order of battle.
//
// Units. Strength (active, reserve) is an index 0..100: 60 = a fully manned 2024 force for that nation. Readiness per branch
// 0..100: 70 = standard training. Crews are trained crew sets (one fills one unit's crew requirement); the trained pool caps
// them at active strength x CREW_PER. Money in $M/month, on the scale of the v57 ledger (Personnel was $3M per unit).
import { PLATFORMS, BLACK_PROGRAMS } from './platforms.js';

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
  // Payroll $M/mo at 100% pay (scaled by pay): per point of active and reserve strength, per SOF unit.
  payroll: { active: 0.25, reserve: 0.05, t2: 2, t1: 4 },
  // Quality lags its vitals target by qualityLag/month (a cohort trains for years): neglect shows up years later.
  qualityLag: 1 / 36,
  // Readiness rises at most riseMo/month toward the training target (pipeline months), decays decayMo/month when above it.
  riseMo: 1.5, decayMo: 1, exercise: { target: 10, rise: 0.5 },
  // Crews: pool = active x CREW_PER[branch]; pipeline months per branch; spare crews trained beyond owned units.
  crewPer: { land: 0.6, air: 0.5, sea: 0.4 }, pipeMo: { land: 6, air: 12, sea: 15 }, spare: { land: 6, air: 6, sea: 6 },
  crewAttrition: 0.01,
};

// SOF: Tier 2 feeds Tier 1 through selection. Pipelines charge monthly to Training while they run; units draw Personnel pay.
// Tier-1 selection takes t1MoMax - (t1MoMax - t1MoMin) x quality/100 months (24..36): better recruits pass faster.
export const SOF_RULES = { t2Mo: 24, t2Cost: 10, t1MoMin: 24, t1MoMax: 36, t1Cost: 20, maxPipes: 2, max: { t2: 12, t1: 8 },
  // Tier-1 overmatch: each squadron adds odds points to `mine`, plus a capped chance bonus (existing overmatch math, intel Tier-1 ops).
  t1Points: 8, t1Chance: 0.03, t1ChanceMax: 0.15 };

// Nation-specific unit names. status_source: where the name comes from; China and Brazil stay generic until the owner supplies names.
const GK = 'general knowledge, owner to verify';
export const SOF_UNITS = {
  usa: { t2: '75th Ranger Regiment', t1: '1st SFOD-D (Delta)', status_source: GK },
  germany: { t2: 'Division Schnelle Kräfte paratroopers', t1: 'KSK', status_source: GK },
  brazil: { t2: 'Tier 2 special forces', t1: 'Tier 1 special mission unit', status_source: 'generic until the owner supplies names' },
  japan: { t2: '1st Airborne Brigade', t1: 'Special Forces Group (SFGp)', status_source: GK },
  russia: { t2: 'GRU Spetsnaz brigades', t1: 'KSSO', status_source: GK },
  cuba: { t2: 'Avispas Negras', t1: 'Tier 1 special mission unit', status_source: `${GK}; Tier 1 generic` },
  norway: { t2: 'Telemark Battalion', t1: 'FSK', status_source: GK },
  china: { t2: 'Tier 2 special forces', t1: 'Tier 1 special mission unit', status_source: 'generic until the owner supplies names' },
};
export const SOF_START = { usa: { t2: 3, t1: 2 }, russia: { t2: 3, t1: 1 }, china: { t2: 3, t1: 1 }, cuba: { t2: 1, t1: 0 } };
export const SOF_DEFAULT = { t2: 2, t1: 1 };
