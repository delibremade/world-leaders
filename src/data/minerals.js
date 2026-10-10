// E4 (#16): minerals and processing (spec Part 3). Game abstractions tuned for play, not a commodity model.
//
// Units. Prices are $M per refined unit. 1 unit/month of processing capacity = 1% of 2024 world refining output of that mineral, so a nation's `cap`
// reads as its rough share of world processing. Ore reserves are in unit-months of feedstock; refined stockpiles in units.
// Sources: general knowledge of 2024 shares (USGS / IEA orders of magnitude), owner to correct. China dominates refining
// of most of the list; the USA holds ore it cannot refine at home (rare earths, graphite, lithium, cobalt, nickel, tungsten).
//
// Abstractions (documented so nobody reads them as rules of the real world):
//  - Processing runs at full capacity. With no domestic ore a plant runs on imported concentrate at NO_ORE_EFF throughput.
//    Ore depletes by what home plants refine. Ore without processing is worth nothing here; processing is the bottleneck.
//  - Commercial imports are priced into a production tranche (its cost already pays for materials), so the open market
//    costs no extra cash. The player's open-market draw is MARKET_SHARE of every foreign processor willing to sell.
//  - Only the player's three stocks evolve. AI nations' capacity is static start data (they are the world market).
//  - `row` is the rest of the world: processors outside NATIONS (Indonesia nickel, Chile lithium, Vietnam tungsten,
//    Kazakhstan titanium). It is a market bucket, not a nation, and nobody can export-control it.
//  - The v57 Resources `rareEarth` extraction is export revenue, unrelated to this feedstock (E5 merges the two views).
export const MINERALS = {
  rareEarth: { n: 'Rare earths', i: '🧲', price: 20, use: 'magnets in motors, actuators, guidance' },
  gallium: { n: 'Gallium', i: '📡', price: 25, use: 'GaN radar and EW transmitters' },
  germanium: { n: 'Germanium', i: '🔭', price: 25, use: 'infrared optics, night sights' },
  graphite: { n: 'Graphite', i: '✏️', price: 10, use: 'batteries, heat shields, refractories' },
  lithium: { n: 'Lithium', i: '🔋', price: 12, use: 'batteries for drones and subs' },
  cobalt: { n: 'Cobalt', i: '🧪', price: 15, use: 'superalloys in jet engines' },
  nickel: { n: 'Nickel', i: '⚙️', price: 8, use: 'superalloys and armor steel' },
  tungsten: { n: 'Tungsten', i: '🎯', price: 15, use: 'penetrators and hardened tooling' },
  titanium: { n: 'Titanium', i: '🛩️', price: 12, use: 'airframes and pressure hulls' },
  enrichment: { n: 'Uranium enrichment', i: '☢️', price: 40, use: 'naval reactor fuel' },
};
export const MINERAL_IDS = Object.keys(MINERALS);

// Start data per nation, per mineral: [ore reserves, processing capacity (units/month), refined stockpile].
// Every playable nation starts with one tranche of each in-service line in stock (test/minerals.test.js).
// Nations not listed hold nothing. Keys must exist in NATIONS (one registry); `row` is the market bucket above.
const z = [0, 0, 0];
export const MINERAL_START = {
  usa: { rareEarth: [180, 2, 20], gallium: [0, 0, 8], germanium: [40, 3, 10], graphite: [60, 0, 10], lithium: [120, 2, 10], cobalt: [40, 0, 10], nickel: [30, 0, 12], tungsten: [20, 0, 10], titanium: [30, 1, 15], enrichment: [60, 7, 12] },
  china: { rareEarth: [440, 90, 30], gallium: [200, 98, 30], germanium: [120, 68, 30], graphite: [300, 93, 30], lithium: [150, 65, 30], cobalt: [10, 75, 30], nickel: [20, 35, 30], tungsten: [240, 80, 30], titanium: [100, 55, 30], enrichment: [40, 25, 30] },
  russia: { rareEarth: [100, 2, 10], gallium: [30, 1, 4], germanium: [20, 5, 8], graphite: [40, 1, 6], lithium: [30, 1, 4], cobalt: [30, 3, 8], nickel: [200, 8, 15], tungsten: [40, 3, 8], titanium: [80, 13, 20], enrichment: [80, 44, 30] },
  japan: { rareEarth: [0, 0, 6], gallium: [0, 2, 10], germanium: [0, 1, 6], graphite: [0, 2, 8], lithium: [0, 0, 6], cobalt: [0, 4, 10], nickel: [0, 5, 12], tungsten: [0, 1, 6], titanium: [0, 15, 20], enrichment: [0, 1, 6] },
  germany: { rareEarth: [0, 0, 6], gallium: [0, 1, 4], germanium: [0, 2, 6], graphite: [0, 0, 4], lithium: [20, 1, 4], cobalt: [0, 0, 4], nickel: [0, 0, 6], tungsten: [0, 2, 6], titanium: [0, 0, 6], enrichment: [0, 3, 6] },
  norway: { rareEarth: [50, 0, 4], gallium: [0, 0, 2], germanium: [0, 0, 1], graphite: [20, 0, 2], lithium: z, cobalt: [0, 2, 4], nickel: [0, 3, 6], tungsten: z, titanium: [60, 0, 5], enrichment: z },
  brazil: { rareEarth: [210, 1, 4], gallium: [0, 0, 2], germanium: [0, 0, 1], graphite: [70, 1, 4], lithium: [20, 1, 2], cobalt: [0, 0, 2], nickel: [60, 1, 4], tungsten: [10, 0, 2], titanium: [20, 0, 5], enrichment: [40, 1, 2] },
  cuba: { rareEarth: z, gallium: z, germanium: z, graphite: z, lithium: z, cobalt: [20, 0, 1], nickel: [60, 1, 2], tungsten: z, titanium: z, enrichment: z },
  australia: { rareEarth: [57, 3, 0], lithium: [60, 3, 0], nickel: [80, 3, 0], cobalt: [20, 1, 0], titanium: [40, 1, 0] },
  finland: { cobalt: [5, 10, 0], nickel: [10, 2, 0] },
  france: { rareEarth: [0, 1, 0], enrichment: [0, 12, 0] },
  uk: { enrichment: [0, 3, 0] },
  netherlands: { enrichment: [0, 4, 0] },
  india: { rareEarth: [70, 1, 0], titanium: [30, 1, 0] },
  saudi: { titanium: [0, 2, 0] },
  skorea: { germanium: [0, 1, 0], nickel: [0, 2, 0], cobalt: [0, 1, 0] },
};
// Rest-of-world processing (units/month), outside NATIONS and outside anyone's export controls.
export const ROW_CAP = { rareEarth: 2, gallium: 1, germanium: 10, graphite: 3, lithium: 25, cobalt: 8, nickel: 40, tungsten: 10, titanium: 10, enrichment: 0 };

// Per production tranche, by role slot (spec: platforms declare mineral inputs per tranche). A program may override.
export const SLOT_INPUTS = {
  gen5: { rareEarth: 4, gallium: 2, germanium: 1, titanium: 5, cobalt: 2, nickel: 2 },
  gen6: { rareEarth: 6, gallium: 4, germanium: 2, titanium: 8, tungsten: 1, cobalt: 3, nickel: 3 },
  bomber: { rareEarth: 6, gallium: 3, germanium: 2, titanium: 6, graphite: 4, cobalt: 3, nickel: 3 },
  cca: { rareEarth: 3, gallium: 2, germanium: 1, lithium: 3, graphite: 2 },
  isr: { rareEarth: 3, gallium: 2, germanium: 3, titanium: 4, tungsten: 2, graphite: 3 },
  ssn: { rareEarth: 4, titanium: 4, nickel: 6, tungsten: 2, lithium: 2, enrichment: 6 },
  carrier: { rareEarth: 6, gallium: 3, nickel: 8, titanium: 4, tungsten: 2, enrichment: 8 },
};
export const PROGRAM_INPUTS = {};
// E8 (#20) closes E4's scope gap: regular platform builds (PLATFORMS) draw inputs too, per unit built. Smaller than a tranche.
// Imports are bought finished abroad and draw nothing.
export const PLATFORM_INPUTS = {
  fighter_wing: { titanium: 2, rareEarth: 1 }, missile_brigade: { tungsten: 1, rareEarth: 1 }, carrier_group: { nickel: 3, titanium: 2, rareEarth: 1 },
  sub_fleet: { nickel: 2, titanium: 1, rareEarth: 1 }, satellite_net: { gallium: 1, germanium: 1 }, cyber_command: { gallium: 1 },
  drone_swarm: { rareEarth: 1, lithium: 1, gallium: 1 }, rq170: { titanium: 1, gallium: 1 }, rq180: { titanium: 1, gallium: 1, germanium: 1 },
  fa_xx: { titanium: 2, rareEarth: 2, gallium: 1 }, mq25: { titanium: 1 }, frigate: { nickel: 1, rareEarth: 1 }, zumwalt: { nickel: 2, rareEarth: 1, gallium: 1 },
  hypersonic_bty: { tungsten: 2, rareEarth: 1, titanium: 1 }, mech_division: { nickel: 1 }, frigate_sqn: { nickel: 1 },
  ssbn_fleet: { nickel: 3, titanium: 2, enrichment: 2 }, strategic_bombers: { titanium: 2, rareEarth: 1 }, icbm_force: { tungsten: 1, enrichment: 2 },
};
// Monthly bounds and levers. capex/upkeep in $M; mo = build months; add = capacity units/month a plant brings online.
export const MINERAL_RULES = {
  capMax: 120, stockMax: 40, reserveMax: 80,
  marketShare: 0.08, // the player's open-market draw on each willing foreign processor
  noOreEff: 0.6,
  plant: { capex: 1800, upkeep: 15, mo: 36, add: 5 },
  offtake: { units: 3, partnerCut: 0.5, term: 36, relMin: 0, premiumRel: 60 }, // units = min(units, partner cap x partnerCut); price x (1 + (premiumRel - rel)/100) when rel < premiumRel
  stockpile: { lot: 10, markup: 1.2, release: 5 },
  recycle: { cost: 20, add: 1 }, // not for enrichment
  pact: { cost: 60, share: 3 }, // bloc partners sell you marketShare x share and never control against you
  controls: { exportCost: 0.05, relHit: 8, rivalCut: 0.5 }, // $M/mo = output x price x exportCost; rival R&D growth x (1 - rivalCut x lost share)
  aiTension: 60, // an AI processor controls exports to you at this tension, or while you sanction or embargo it, or it embargoes you
  contribution: 1, // E7: partner/co-developer mineral contribution, units/month of the program's binding mineral
};
