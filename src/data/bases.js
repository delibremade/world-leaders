// F9 (#57), spec Part 11: bases, nodes and map placement. Node types with reach and multipliers, real candidate sites,
// and the real bases every playable nation starts with. Numbers are game abstractions on the v57 money scale ($M, $M/month;
// a carrier group costs $1,500M and $22M/mo to keep). Every real site and pre-placed base carries a `status_source`; the owner corrects.
//
// Geography is real: sites are lon/lat, projected into the 1000x520 REGION_GEO frame with the same plate carree the Natural Earth
// export used (measured against it: x = 485.5 + 2.858 * lon, y = 307 - 3.65 * lat; test/bases.test.js checks the chokepoints land on
// their v57 markers). Reach is in km over the great circle, so a ring on the map is the engine's own number.
export const project = (lon, lat) => ({ x: Math.round(485.5 + 2.858 * lon), y: Math.round(307 - 3.65 * lat) });
export const unproject = (x, y) => ({ lon: (x - 485.5) / 2.858, lat: (307 - y) / 3.65 });
export const KM_PER_PX = 111 / 3.65; // one degree of latitude is 3.65 px and 111 km
const R_EARTH = 6371;
export function distanceKm(a, b) {
  const rad = Math.PI / 180; const dLat = (b.lat - a.lat) * rad; const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Node types. reach km; capex $M once; mo months to build; upkeep $M/mo while active; host $M/mo basing agreement on foreign soil.
// mult: what a well-placed node multiplies (F9c wires each into its system):
//   choke    control weight added at every chokepoint within reach (naval base at Bab al-Mandab: +1.5, the 'secured' line is 2)
//   sortie   deployed air-unit weight in theaters within reach (+35%)        sustain  deployed naval (or any, for a hub) unit weight
//   land     deployed land-unit weight                                       isr      ISR score, global (radar site +3)
//   response flashpoint months and the intervene gate in theaters within reach
//   sphere   monthly sphere gain in the host region                          lane     import-cost cut when a route's chokepoint is in reach
//   shield   rival pressure response in theaters within reach, scaled down   t1       Tier-1 operation odds when the target's home is in reach
// private: a private-capital node (Part 3 / F5): capex is the government's enabling share, no upkeep. TODO(#57, #54): once F5 lands,
// route port enabling through the private-capital model in src/sim/minerals.js instead of a flat treasury share.
export const NODE_TYPES = {
  naval:     { n: 'Naval base',          i: '⚓', reach: 1500, capex: 1500, mo: 24, upkeep: 10, host: 4, mult: { choke: 1.5, sustain: 0.25, lane: 0.05 }, d: 'Pier, fuel and repair for the fleet. Holds the chokepoints it can reach; escorts bite.' },
  air:       { n: 'Air base',            i: '✈️', reach: 1200, capex: 1000, mo: 18, upkeep: 7,  host: 3, mult: { sortie: 0.35, response: 1, isr: 1 }, d: 'Sortie generation in theater. Air units within reach weigh more; faster flashpoint response.' },
  garrison:  { n: 'Army garrison',       i: '🪖', reach: 600,  capex: 500,  mo: 12, upkeep: 5,  host: 3, mult: { land: 0.3, response: 2, sphere: 0.05 }, d: 'Boots in the host region. Land units weigh more, flashpoints wait longer, the region leans your way.' },
  logistics: { n: 'Logistics hub',       i: '📦', reach: 2000, capex: 400,  mo: 12, upkeep: 3,  host: 2, mult: { sustain: 0.15, choke: 0.5, response: 1 }, d: 'Prepositioned stock. Sustains every branch within a long reach; a little chokepoint weight.' },
  radar:     { n: 'Radar / ISR site',    i: '📡', reach: 2500, capex: 350,  mo: 9,  upkeep: 2,  host: 1, mult: { isr: 3 }, d: 'Early warning and collection. +3 ISR, which every op, strike and Tier-1 odds reads.' },
  bmd:       { n: 'Missile defense site', i: '🛡️', reach: 800,  capex: 800,  mo: 15, upkeep: 4,  host: 2, mult: { shield: 0.25, isr: 1 }, d: 'Interceptors over the host region. Rival pressure responses there land softer.' },
  sof:       { n: 'SOF forward staging', i: '🥷', reach: 1500, capex: 200,  mo: 6,  upkeep: 1,  host: 1, mult: { response: 2, t1: 0.05, isr: 1 }, d: 'A quiet compound for Tier 1. Faster flashpoint response; better odds on regime change nearby.' },
  port:      { n: 'Port / processing node', i: '🏗️', reach: 0, capex: 300,  mo: 18, upkeep: 0,  host: 0, private: true, mult: { sphere: 0.03, lane: 0.05 }, d: 'Private capital builds it; you enable it. Trade-lane access and a slow pull on the host region.' },
};
export const NODE_IDS = Object.keys(NODE_TYPES);

export const BASE_RULES = {
  consentRel: 20,   // relations a registry host needs before you may build or reopen
  consentLose: 0,   // below this the host closes your base (sanctions and your embargo on them close it too)
  localOpen: 12,    // a host outside NATIONS (Djibouti, Bahrain...) consents once your sphere in its region reaches this (you start at 10 away from home: earn two points first)
  localLose: 6,     // and closes the base when your sphere there falls under this
  reopenMo: 6,      // months a closed base waits before consent can reopen it
  foreignTension: 0.25, // monthly tension with the top hostile competitor present (>= 25) in a region where you hold a foreign node
  ai: { every: 3, p: 0.25, max: 5, lead: 25 }, // AI nations place every 3 months with probability p while under max new nodes, where their sphere >= lead
};

// Real candidate locations. host: a NATIONS id (consent runs on relations and pacts) or null (a local host outside the registry;
// consent runs on your sphere in the region). region: the theater the site sits in (ocean sites are assigned by hand).
const S = (n, host, local, region, lon, lat, types, status_source) => ({ n, host, local, region, lon, lat, types, status_source, ...project(lon, lat) });
export const SITES = {
  // North America, Caribbean
  norfolk:     S('Norfolk',               'usa', null, 'NA', -76.3, 36.9, ['naval', 'logistics', 'radar'], 'US Fleet Forces home port; open sources 2024'),
  guantanamo:  S('Guantanamo Bay',        'cuba', null, 'NA', -75.1, 19.9, ['naval', 'garrison'], 'US naval station under the 1903 lease; open sources 2024'),
  pituffik:    S('Pituffik (Thule)',      'denmark', null, 'NA', -68.7, 76.5, ['radar', 'air'], 'US Space Base Pituffik, early warning; open sources 2024'),
  panama:      S('Panama (Rodman)',       null, 'Panama', 'NA', -79.6, 8.9, ['naval', 'logistics', 'port'], 'Former US naval station; candidate'),
  cienfuegos:  S('Cienfuegos',            'cuba', null, 'NA', -80.4, 22.1, ['naval', 'port'], 'Cuban naval base; open sources 2024'),
  sanantonio:  S('San Antonio de los Banos', 'cuba', null, 'NA', -82.5, 22.9, ['air', 'radar'], 'Cuban air base; open sources 2024'),
  // South America
  rio:         S('Rio de Janeiro',        'brazil', null, 'SA', -43.2, -22.9, ['naval', 'port', 'logistics'], 'Brazilian Navy main base; open sources 2024'),
  anapolis:    S('Anapolis',              'brazil', null, 'SA', -48.9, -16.3, ['air', 'radar'], 'Brazilian Air Force fighter base; open sources 2024'),
  manta:       S('Manta',                 null, 'Ecuador', 'SA', -80.0, -1.0, ['air', 'radar'], 'Former US forward operating location; candidate'),
  pcabello:    S('Puerto Cabello',        'venezuela', null, 'SA', -68.0, 10.5, ['naval', 'port'], 'Venezuelan naval base; candidate'),
  // Western Europe, Atlantic
  rota:        S('Rota',                  'spain', null, 'WE', -6.3, 36.6, ['naval', 'air', 'logistics'], 'US-Spanish naval station; open sources 2024'),
  ramstein:    S('Ramstein',              'germany', null, 'WE', 7.6, 49.4, ['air', 'logistics', 'bmd'], 'USAFE headquarters; open sources 2024'),
  wilhelmshaven: S('Wilhelmshaven',       'germany', null, 'WE', 8.1, 53.5, ['naval', 'port'], 'German Navy main base; open sources 2024'),
  haakonsvern: S('Haakonsvern',           'norway', null, 'WE', 5.2, 60.3, ['naval', 'logistics'], 'Royal Norwegian Navy main base; open sources 2024'),
  orland:      S('Orland',                'norway', null, 'WE', 9.6, 63.7, ['air', 'radar'], 'Norwegian F-35 main base; open sources 2024'),
  evenes:      S('Evenes',                'norway', null, 'WE', 16.7, 68.5, ['air', 'radar'], 'Norwegian P-8 and QRA base; open sources 2024'),
  keflavik:    S('Keflavik',              null, 'Iceland', 'WE', -22.6, 64.0, ['air', 'radar', 'logistics'], 'NATO air station; candidate'),
  lajes:       S('Lajes (Azores)',        null, 'Portugal', 'WE', -27.1, 38.8, ['air', 'logistics'], 'Lajes Field, US tenant; candidate'),
  souda:       S('Souda Bay',             null, 'Greece', 'WE', 24.1, 35.5, ['naval', 'air'], 'NATO naval support activity; candidate'),
  // Eastern Europe, Caucasus, Central Asia
  sevastopol:  S('Sevastopol',            'russia', null, 'EE', 33.5, 44.6, ['naval', 'port'], 'Black Sea Fleet base in occupied Crimea; open sources 2024'),
  severomorsk: S('Severomorsk',           'russia', null, 'EE', 33.4, 69.1, ['naval', 'logistics'], 'Northern Fleet headquarters; open sources 2024'),
  redzikowo:   S('Redzikowo',             'poland', null, 'EE', 17.1, 54.5, ['bmd', 'radar'], 'Aegis Ashore Poland, operational 2024; open sources'),
  deveselu:    S('Deveselu',              null, 'Romania', 'EE', 24.4, 44.1, ['bmd', 'radar'], 'Aegis Ashore Romania, operational 2016; open sources'),
  rukla:       S('Rukla',                 null, 'Lithuania', 'EE', 24.9, 55.2, ['garrison', 'logistics'], 'German Panzerbrigade 45 standing up 2025-27; open sources'),
  kant:        S('Kant',                  null, 'Kyrgyzstan', 'EE', 74.8, 42.9, ['air'], 'Russian air base; open sources 2024'),
  dushanbe:    S('Dushanbe',              null, 'Tajikistan', 'EE', 68.8, 38.6, ['garrison'], 'Russian 201st base; open sources 2024'),
  gyumri:      S('Gyumri',                null, 'Armenia', 'EE', 43.8, 40.8, ['garrison', 'radar'], 'Russian 102nd base; open sources 2024'),
  // Middle East
  tartus:      S('Tartus',                null, 'Syria', 'ME', 35.9, 34.9, ['naval', 'port'], 'Russian naval facility; status contested after 2024, owner corrects'),
  hmeimim:     S('Hmeimim',               null, 'Syria', 'ME', 35.9, 35.4, ['air', 'radar'], 'Russian air base; status contested after 2024, owner corrects'),
  bahrain:     S('Manama (NSA Bahrain)',  null, 'Bahrain', 'ME', 50.6, 26.2, ['naval', 'logistics'], 'US Fifth Fleet headquarters; open sources 2024'),
  aludeid:     S('Al Udeid',              null, 'Qatar', 'ME', 51.3, 25.1, ['air', 'logistics'], 'US CENTCOM forward air base; open sources 2024'),
  aldhafra:    S('Al Dhafra',             'uae', null, 'ME', 54.5, 24.2, ['air', 'radar'], 'US and French tenant air base; candidate'),
  arifjan:     S('Camp Arifjan',          null, 'Kuwait', 'ME', 48.1, 29.0, ['garrison', 'logistics'], 'US Army prepositioning; candidate'),
  incirlik:    S('Incirlik',              'turkey', null, 'ME', 35.4, 37.0, ['air', 'logistics'], 'NATO air base, US tenant; candidate'),
  alazraq:     S('Al-Azraq',              null, 'Jordan', 'ME', 36.8, 31.8, ['air', 'sof'], 'German Luftwaffe detachment since 2018; open sources'),
  // Africa, Indian Ocean
  djibouti:    S('Djibouti',              null, 'Djibouti', 'AF', 43.1, 11.5, ['naval', 'air', 'logistics', 'sof'], 'US Camp Lemonnier, PLA support base, JSDF base, French and Italian camps; open sources 2024'),
  mombasa:     S('Mombasa',               null, 'Kenya', 'AF', 39.7, -4.0, ['naval', 'port'], 'Candidate; port and naval access'),
  portsudan:   S('Port Sudan',            null, 'Sudan', 'AF', 37.2, 19.6, ['naval', 'port'], 'Russian basing agreement under negotiation; candidate'),
  bata:        S('Bata',                  null, 'Equatorial Guinea', 'AF', 9.8, 1.9, ['naval', 'port'], 'Reported Chinese Atlantic basing interest; candidate'),
  dakar:       S('Dakar',                 null, 'Senegal', 'AF', -17.4, 14.7, ['naval', 'air', 'port'], 'Candidate; former French base'),
  walvis:      S('Walvis Bay',            null, 'Namibia', 'AF', 14.5, -22.9, ['port', 'naval'], 'Candidate; deep-water port'),
  diegogarcia: S('Diego Garcia',          'uk', null, 'SAS', 72.4, -7.3, ['naval', 'air', 'logistics'], 'US-UK base, Chagos; open sources 2024'),
  gwadar:      S('Gwadar',                null, 'Pakistan', 'SAS', 62.3, 25.1, ['port', 'naval'], 'CPEC port; candidate'),
  hambantota:  S('Hambantota',            null, 'Sri Lanka', 'SAS', 81.1, 6.1, ['port'], 'Chinese-leased port; candidate'),
  // East Asia
  yokosuka:    S('Yokosuka',              'japan', null, 'EA', 139.7, 35.3, ['naval', 'logistics'], 'US Seventh Fleet and JMSDF Fleet headquarters; open sources 2024'),
  kadena:      S('Kadena (Okinawa)',      'japan', null, 'EA', 127.8, 26.4, ['air', 'sof', 'radar'], 'USAF 18th Wing; open sources 2024'),
  misawa:      S('Misawa',                'japan', null, 'EA', 141.4, 40.7, ['air', 'radar'], 'US-Japanese air base; candidate'),
  osan:        S('Osan',                  'skorea', null, 'EA', 127.0, 37.1, ['air', 'bmd'], 'USAF 51st Fighter Wing; open sources 2024'),
  yulin:       S('Yulin (Hainan)',        'china', null, 'EA', 109.5, 18.2, ['naval', 'bmd'], 'PLAN South Sea Fleet submarine base; open sources 2024'),
  // Southeast Asia
  ream:        S('Ream',                  null, 'Cambodia', 'SEA', 103.6, 10.5, ['naval', 'port'], 'Chinese-funded pier, PLAN presence; open sources 2024'),
  subic:       S('Subic Bay',             null, 'Philippines', 'SEA', 120.3, 14.8, ['naval', 'air', 'logistics'], 'Former US base, EDCA access; candidate'),
  changi:      S('Changi',                null, 'Singapore', 'SEA', 103.9, 1.4, ['naval', 'logistics', 'port'], 'US logistics presence; candidate'),
  camranh:     S('Cam Ranh Bay',          null, 'Vietnam', 'SEA', 109.2, 11.9, ['naval', 'port'], 'Candidate; former Soviet base'),
  // Pacific
  guam:        S('Guam',                  'usa', null, 'PAC', 144.8, 13.5, ['naval', 'air', 'logistics', 'bmd'], 'Andersen AFB and Naval Base Guam; open sources 2024'),
  darwin:      S('Darwin',                'australia', null, 'PAC', 130.8, -12.5, ['air', 'garrison', 'logistics'], 'USMC rotational force; candidate'),
  honiara:     S('Honiara',               null, 'Solomon Islands', 'PAC', 160.0, -9.4, ['port', 'naval'], 'China-Solomons security pact 2022; candidate'),
};
export const SITE_IDS = Object.keys(SITES);

// Real bases pre-placed at campaign start, for every playable nation (AI nations hold theirs too). `lease`: a treaty tenure that
// host consent cannot revoke (Guantanamo). status_source per line; the owner corrects.
const B = (owner, site, type, status_source, extra = {}) => ({ owner, site, type, status_source, ...extra });
export const REAL_BASES = [
  B('usa', 'norfolk', 'naval', 'US Fleet Forces Command home port'),
  B('usa', 'guam', 'naval', 'Naval Base Guam; SSN forward base'),
  B('usa', 'guam', 'air', 'Andersen AFB; bomber task force'),
  B('usa', 'diegogarcia', 'naval', 'Naval Support Facility Diego Garcia'),
  B('usa', 'kadena', 'air', 'Kadena AB, 18th Wing'),
  B('usa', 'yokosuka', 'naval', 'Fleet Activities Yokosuka, Seventh Fleet'),
  B('usa', 'osan', 'air', 'Osan AB, 51st Fighter Wing'),
  B('usa', 'rota', 'naval', 'Naval Station Rota; DDG forward deployed'),
  B('usa', 'ramstein', 'air', 'Ramstein AB, USAFE'),
  B('usa', 'djibouti', 'sof', 'Camp Lemonnier, CJTF-HOA'),
  B('usa', 'bahrain', 'naval', 'NSA Bahrain, Fifth Fleet'),
  B('usa', 'aludeid', 'air', 'Al Udeid AB, CENTCOM forward'),
  B('usa', 'redzikowo', 'bmd', 'Aegis Ashore Poland, 2024'),
  B('usa', 'deveselu', 'bmd', 'Aegis Ashore Romania, 2016'),
  B('usa', 'pituffik', 'radar', 'Pituffik Space Base, BMEWS'),
  B('usa', 'guantanamo', 'naval', 'Naval Station Guantanamo Bay, 1903 lease', { lease: true }),
  B('china', 'yulin', 'naval', 'PLAN Yulin submarine base'),
  B('china', 'djibouti', 'naval', 'PLA Support Base Djibouti, 2017'),
  B('china', 'ream', 'naval', 'Ream Naval Base pier, 2023-'),
  B('russia', 'severomorsk', 'naval', 'Northern Fleet'),
  B('russia', 'sevastopol', 'naval', 'Black Sea Fleet, occupied Crimea; owner corrects'),
  B('russia', 'tartus', 'naval', 'Tartus naval facility; status after 2024 uncertain'),
  B('russia', 'hmeimim', 'air', 'Hmeimim AB; status after 2024 uncertain'),
  B('russia', 'kant', 'air', 'Kant AB, CSTO'),
  B('russia', 'dushanbe', 'garrison', '201st Military Base'),
  B('russia', 'gyumri', 'garrison', '102nd Military Base'),
  B('germany', 'wilhelmshaven', 'naval', 'Deutsche Marine, Einsatzflottille 2'),
  B('germany', 'rukla', 'garrison', 'Panzerbrigade 45 Litauen, standing up 2025-27'),
  B('germany', 'alazraq', 'air', 'Luftwaffe Einsatzgeschwader Jordanien'),
  B('japan', 'yokosuka', 'naval', 'JMSDF Self Defense Fleet'),
  B('japan', 'djibouti', 'logistics', 'JSDF Base Djibouti, 2011'),
  B('brazil', 'rio', 'naval', 'Marinha do Brasil, 1o Distrito Naval'),
  B('brazil', 'anapolis', 'air', 'FAB Ala 2, F-39 Gripen'),
  B('cuba', 'cienfuegos', 'naval', 'Marina de Guerra Revolucionaria'),
  B('cuba', 'sanantonio', 'air', 'DAAFAR fighter base'),
  B('norway', 'haakonsvern', 'naval', 'Sjoforsvaret main base'),
  B('norway', 'orland', 'air', 'Luftforsvaret 132 Air Wing, F-35'),
  B('norway', 'evenes', 'radar', 'Evenes air station, P-8 and QRA'),
];
