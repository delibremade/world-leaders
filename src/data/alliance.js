// E7 (#19): allied access to programs (spec Part 6). Owner = the nation whose line builds it; founders start as co-developers.
// ioc = the year the owner's line delivers to partners when an AI nation owns it (general knowledge, owner to verify).
export const ALLIED_PROGRAMS = {
  f47: { owner: 'usa', ioc: 2029, status_source: 'general knowledge, owner to verify: F-47 first flight ~2028' },
  b21: { owner: 'usa', ioc: 2024, status_source: 'general knowledge, owner to verify: LRIP 2024 (ruling on #15)' },
  cca: { owner: 'usa', ioc: 2026, natoOnly: true, status_source: 'general knowledge, owner to verify: Increment 1 fielding ~2026' },
  gcap: { owner: 'uk', founders: ['uk', 'italy', 'japan'], ioc: 2035, status_source: 'general knowledge, owner to verify: service target 2035' },
  fcas: { owner: 'france', founders: ['france', 'germany', 'spain'], ioc: 2040, status_source: 'general knowledge, owner to verify: service target ~2040' },
};
// Tiers, shallow to deep. eff = variant performance vs domestic; price = x program tranche (35% of program cost) per airframe;
// queue = delivery months; share = cost share of the program paid to join; work = monthly workshare income as a share of program cost.
export const TIERS = {
  buyer: { n: 'Buyer', eff: 0.875, price: 1.3, queue: 18, share: 0, work: 0 },
  partner: { n: 'Partner', eff: 0.95, price: 1.0, queue: 12, share: 0.15, work: 0.005 },
  codev: { n: 'Co-developer', eff: 1, price: 0.9, queue: 9, share: 0.3, work: 0.008 },
};
export const TIER_ORDER = ['buyer', 'partner', 'codev'];
// Gates and compliance. ciFloor: counter-intel (interceptChance) floor; exposureCeil: espionage exposure ceiling.
// Every playable member starts at 0.36 counter-intel, so the floor bites only when the player opens up (IP licensing, cut intel).
export const ACCESS_RULES = {
  rel: 70, natoGdp: 2, ciFloor: 0.35, exposureCeil: 0.25, flagged: ['china', 'russia'],
  suspendMo: 12, breachRel: 10, reentryRel: 5, expelRel: 15, admitRel: 5, joinRel: 3,
  defect: { from: 'fcas', to: 'gcap', who: 'germany', rel: { france: -20, spain: -10 } },
  sustainmentCut: 0.5, // a suspended Buyer/Partner fleet runs at half strength: the owner holds sustainment
};
// Owner view (USA player): export income per member per month, and the monthly chance a member leaks the program to a rival.
export const MEMBER_INCOME = { buyer: 40, partner: 80, codev: 120 };
export const LEAK = { base: 0.01, flagged: 0.04 };
