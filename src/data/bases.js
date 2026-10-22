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
//   land     deployed land-unit weight                                       isr      ISR score, global (radar +2; air, SOF, missile defense +0.25; capped 6 in src/sim/reach.js)
//   response flashpoint months and the intervene gate in theaters within reach
//   sphere   monthly sphere gain in the host region                          lane     import-cost cut when a route's chokepoint is in reach
//   shield   rival pressure response in theaters within reach, scaled down   t1       Tier-1 operation odds when the target's home is in reach
// private: a private-capital node (Part 3 as amended by F5 #37). The state authorizes it for $0 and may pull the same levers as a processing
// plant (MINERAL_RULES.levers, priced as frac x this capex); investors build it while its margin is >= 1 (src/sim/bases.js portOutlook) at
// min(maxPace, margin) months per month; once online it pays `income` $M/mo to the treasury (port fees, royalties and tax), no upkeep.
export const NODE_TYPES = {
  naval:     { n: 'Naval base',          i: '⚓', reach: 1500, capex: 1500, mo: 24, upkeep: 10, host: 4, mult: { choke: 1.5, sustain: 0.25, lane: 0.05 }, d: 'Pier, fuel and repair for the fleet. Holds the chokepoints it can reach; escorts bite.' },
  air:       { n: 'Air base',            i: '✈️', reach: 1200, capex: 1000, mo: 18, upkeep: 7,  host: 3, mult: { sortie: 0.35, response: 1, isr: 0.25 }, d: 'Sortie generation in theater. Air units within reach weigh more; faster flashpoint response.' },
  garrison:  { n: 'Army garrison',       i: '🪖', reach: 600,  capex: 500,  mo: 12, upkeep: 5,  host: 3, mult: { land: 0.3, response: 2, sphere: 0.05 }, d: 'Boots in the host region. Land units weigh more, flashpoints wait longer, the region leans your way.' },
  logistics: { n: 'Logistics hub',       i: '📦', reach: 2000, capex: 400,  mo: 12, upkeep: 3,  host: 2, mult: { sustain: 0.15, choke: 0.5, response: 1 }, d: 'Prepositioned stock. Sustains every branch within a long reach; a little chokepoint weight.' },
  radar:     { n: 'Radar / ISR site',    i: '📡', reach: 2500, capex: 350,  mo: 9,  upkeep: 2,  host: 1, mult: { isr: 2 }, d: 'Early warning and collection. +2 ISR, which every op, strike and Tier-1 odds reads.' },
  bmd:       { n: 'Missile defense site', i: '🛡️', reach: 800,  capex: 800,  mo: 15, upkeep: 4,  host: 2, mult: { shield: 0.25, isr: 0.25 }, d: 'Interceptors over the host region. Rival pressure responses there land softer.' },
  sof:       { n: 'SOF forward staging', i: '🥷', reach: 1500, capex: 200,  mo: 6,  upkeep: 1,  host: 1, mult: { response: 2, t1: 0.05, isr: 0.25 }, d: 'A quiet compound for Tier 1. Faster flashpoint response; better odds on regime change nearby.' },
  port:      { n: 'Port / processing node', i: '🏗️', reach: 0, capex: 1200, mo: 18, upkeep: 0,  host: 0, private: true, income: 6, mult: { sphere: 0.03, lane: 0.05 }, d: 'Private capital builds it, you authorize and enable it. Port fees to the treasury, trade-lane access, a slow pull on the host region.' },
};
export const NODE_IDS = Object.keys(NODE_TYPES);

export const BASE_RULES = {
  consentRel: 20,   // relations a registry host needs before you may build or reopen
  agreementCost: 250, // #89: one-off fee to sign a basing agreement with a host nation (NATIONS[*].host); the per-node `host` payment still runs
  consentLose: 0,   // below this the host closes your base (sanctions and your embargo on them close it too)
  localOpen: 12,    // a host outside NATIONS (Panama, Syria, Cambodia...) consents once your sphere in its region reaches this (you start at 10 away from home: earn two points first)
  localLose: 6,     // and closes the base when your sphere there falls under this
  reopenMo: 6,      // months a closed base waits before consent can reopen it
  foreignTension: 0.25, // monthly tension with the top hostile competitor present (>= 25) in a region where you hold a foreign node
  ai: { every: 3, p: 0.25, max: 5, lead: 25 }, // AI nations place every 3 months with probability p while under max new nodes, where their sphere >= lead
  // Private port margin terms (F5 model): lane value when a chokepoint is within laneKm, host-region sphere, trade agreements with nations there.
  port: { laneKm: 1500, lane: 1.3, noLane: 0.85, sphereBase: 0.6, spherePer: 40, tradePer: 0.15 },
};

// Real candidate locations. host: a NATIONS id (consent runs on relations and pacts) or null (a local host outside the registry;
// consent runs on your sphere in the region). region: the theater the site sits in (ocean sites are assigned by hand).
const S = (n, host, local, region, lon, lat, types, status_source) => ({ n, host, local, region, lon, lat, types, status_source, ...project(lon, lat) });
export const SITES = {
  // North America, Caribbean
  norfolk:     S('Norfolk',               'usa', null, 'NA', -76.3, 36.9, ['naval', 'logistics', 'radar'], 'US Fleet Forces home port; open sources 2024'),
  guantanamo:  S('Guantanamo Bay',        'cuba', null, 'NA', -75.1, 19.9, ['naval', 'garrison'], 'US naval station under the 1903 lease; open sources 2024'),
  pituffik:    S('Pituffik (Thule)',      'greenland', null, 'NA', -68.7, 76.5, ['radar', 'air'], 'US Space Base Pituffik, early warning; open sources 2024'),
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
  lakenheath:  S('Lakenheath',            'uk', null, 'WE', 0.56, 52.41, ['air', 'logistics'], 'RAF Lakenheath, USAF 48th Fighter Wing (F-35A, F-15E); open sources 2024'),
  aviano:      S('Aviano',                'italy', null, 'WE', 12.6, 46.03, ['air'], 'Aviano AB, USAF 31st Fighter Wing; open sources 2024'),
  sigonella:   S('Sigonella',             'italy', null, 'WE', 14.92, 37.4, ['air', 'logistics', 'radar'], 'NAS Sigonella, P-8 and NATO AGS; open sources 2024'),
  moron:       S('Moron',                 'spain', null, 'WE', -5.62, 37.17, ['air', 'garrison'], 'Moron AB, SPMAGTF crisis response; open sources 2024'),
  alexandroupolis: S('Alexandroupolis',   'greece', null, 'WE', 25.9, 40.85, ['logistics', 'port'], 'US Army logistics hub since 2021; candidate'),
  wilhelmshaven: S('Wilhelmshaven',       'germany', null, 'WE', 8.1, 53.5, ['naval', 'port'], 'German Navy main base; open sources 2024'),
  haakonsvern: S('Haakonsvern',           'norway', null, 'WE', 5.2, 60.3, ['naval', 'logistics'], 'Royal Norwegian Navy main base; open sources 2024'),
  orland:      S('Orland',                'norway', null, 'WE', 9.6, 63.7, ['air', 'radar'], 'Norwegian F-35 main base; open sources 2024'),
  evenes:      S('Evenes',                'norway', null, 'WE', 16.7, 68.5, ['air', 'radar'], 'Norwegian P-8 and QRA base; open sources 2024'),
  keflavik:    S('Keflavik',              'iceland', null, 'WE', -22.6, 64.0, ['air', 'radar', 'logistics'], 'NATO air station, US P-8 rotations; open sources 2024'),
  lajes:       S('Lajes (Azores)',        null, 'Portugal', 'WE', -27.1, 38.8, ['air', 'logistics'], 'Lajes Field, US tenant; candidate'),
  souda:       S('Souda Bay',             'greece', null, 'WE', 24.1, 35.5, ['naval', 'air'], 'NATO naval support activity; candidate'),
  // Eastern Europe, Caucasus, Central Asia
  sevastopol:  S('Sevastopol',            'russia', null, 'EE', 33.5, 44.6, ['naval', 'port'], 'Black Sea Fleet base in occupied Crimea; open sources 2024'),
  severomorsk: S('Severomorsk',           'russia', null, 'EE', 33.4, 69.1, ['naval', 'logistics'], 'Northern Fleet headquarters; open sources 2024'),
  redzikowo:   S('Redzikowo',             'poland', null, 'EE', 17.1, 54.5, ['bmd', 'radar'], 'Aegis Ashore Poland, operational 2024; open sources'),
  deveselu:    S('Deveselu',              'romania', null, 'EE', 24.4, 44.1, ['bmd', 'radar'], 'Aegis Ashore Romania, operational 2016; open sources'),
  poznan:      S('Poznan',                'poland', null, 'EE', 16.93, 52.41, ['garrison', 'logistics'], 'US V Corps forward HQ, Camp Kosciuszko; open sources 2024'),
  lask:        S('Lask',                  'poland', null, 'EE', 19.18, 51.55, ['air'], 'Polish F-16 base, US rotational detachment; open sources 2024'),
  kogalniceanu: S('Mihail Kogalniceanu',  'romania', null, 'EE', 28.49, 44.36, ['air', 'garrison', 'logistics'], 'MK Air Base, NATO expansion under way 2024; open sources'),
  rukla:       S('Rukla',                 null, 'Lithuania', 'EE', 24.9, 55.2, ['garrison', 'logistics'], 'German Panzerbrigade 45 standing up 2025-27; open sources'),
  kant:        S('Kant',                  null, 'Kyrgyzstan', 'EE', 74.8, 42.9, ['air'], 'Russian air base; open sources 2024'),
  dushanbe:    S('Dushanbe',              null, 'Tajikistan', 'EE', 68.8, 38.6, ['garrison'], 'Russian 201st base; open sources 2024'),
  gyumri:      S('Gyumri',                null, 'Armenia', 'EE', 43.8, 40.8, ['garrison', 'radar'], 'Russian 102nd base; open sources 2024'),
  // Middle East
  tartus:      S('Tartus',                null, 'Syria', 'ME', 35.9, 34.9, ['naval', 'port'], 'Russian naval facility; status contested after 2024, owner corrects'),
  hmeimim:     S('Hmeimim',               null, 'Syria', 'ME', 35.9, 35.4, ['air', 'radar'], 'Russian air base; status contested after 2024, owner corrects'),
  bahrain:     S('Manama (NSA Bahrain)',  'bahrain', null, 'ME', 50.6, 26.2, ['naval', 'logistics'], 'US Fifth Fleet headquarters; open sources 2024'),
  aludeid:     S('Al Udeid',              'qatar', null, 'ME', 51.3, 25.1, ['air', 'logistics'], 'US CENTCOM forward air base; open sources 2024'),
  aldhafra:    S('Al Dhafra',             'uae', null, 'ME', 54.5, 24.2, ['air', 'radar'], 'US and French tenant air base; candidate'),
  alisalem:    S('Ali Al Salem',          'kuwait', null, 'ME', 47.52, 29.35, ['air'], 'US 386th Air Expeditionary Wing; open sources 2024'),
  jebelali:    S('Jebel Ali',             'uae', null, 'ME', 55.03, 25.01, ['naval', 'logistics', 'port'], 'Busiest US Navy port of call outside the US; open sources 2024'),
  kurecik:     S('Kurecik',               'turkey', null, 'ME', 37.98, 38.22, ['radar'], 'NATO AN/TPY-2 early-warning radar; open sources 2024'),
  arifjan:     S('Camp Arifjan',          'kuwait', null, 'ME', 48.1, 29.0, ['garrison', 'logistics'], 'US Army prepositioning; candidate'),
  incirlik:    S('Incirlik',              'turkey', null, 'ME', 35.4, 37.0, ['air', 'logistics'], 'NATO air base, US tenant; candidate'),
  alazraq:     S('Al-Azraq',              null, 'Jordan', 'ME', 36.8, 31.8, ['air', 'sof'], 'German Luftwaffe detachment since 2018; open sources'),
  // Africa, Indian Ocean
  djibouti:    S('Djibouti',              'djibouti', null, 'AF', 43.1, 11.5, ['naval', 'air', 'logistics', 'sof'], 'US Camp Lemonnier, PLA support base, JSDF base, French and Italian camps; open sources 2024'),
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
  humphreys:   S('Camp Humphreys',        'skorea', null, 'EA', 127.03, 36.96, ['garrison', 'logistics', 'air'], 'USFK and Eighth Army HQ; open sources 2024'),
  yulin:       S('Yulin (Hainan)',        'china', null, 'EA', 109.5, 18.2, ['naval', 'bmd'], 'PLAN South Sea Fleet submarine base; open sources 2024'),
  // Southeast Asia
  ream:        S('Ream',                  null, 'Cambodia', 'SEA', 103.6, 10.5, ['naval', 'port'], 'Chinese-funded pier, PLAN presence; open sources 2024'),
  subic:       S('Subic Bay',             'philippines', null, 'SEA', 120.3, 14.8, ['naval', 'air', 'logistics'], 'Former US base, EDCA access; candidate'),
  changi:      S('Changi Naval Base',     'singapore', null, 'SEA', 103.98, 1.32, ['naval', 'logistics', 'port'], 'Carrier-capable pier open to the US Navy under the 1990 MOU; COMLOG WESTPAC; open sources 2024'),
  payalebar:   S('Paya Lebar',            'singapore', null, 'SEA', 103.91, 1.36, ['air', 'radar'], 'RSAF base; US P-8 and fighter rotations; open sources 2024'),
  basa:        S('Basa (EDCA)',           'philippines', null, 'SEA', 120.49, 14.99, ['air', 'logistics'], 'EDCA site, 2014 list; open sources 2024'),
  magsaysay:   S('Fort Magsaysay (EDCA)', 'philippines', null, 'SEA', 121.1, 15.43, ['garrison', 'logistics'], 'EDCA site, 2014 list; open sources 2024'),
  bautista:    S('Antonio Bautista (EDCA)', 'philippines', null, 'SEA', 118.76, 9.74, ['air', 'radar', 'logistics'], 'EDCA site on Palawan, facing the Spratlys; open sources 2024'),
  osias:       S('Camilo Osias (EDCA)',   'philippines', null, 'SEA', 122.15, 18.47, ['naval', 'radar'], 'EDCA site added 2023, Luzon Strait; open sources 2024'),
  camranh:     S('Cam Ranh Bay',          null, 'Vietnam', 'SEA', 109.2, 11.9, ['naval', 'port'], 'Candidate; former Soviet base'),
  // Pacific
  guam:        S('Guam',                  'usa', null, 'PAC', 144.8, 13.5, ['naval', 'air', 'logistics', 'bmd'], 'Andersen AFB and Naval Base Guam; open sources 2024'),
  tindal:      S('Tindal',                'australia', null, 'PAC', 132.38, -14.52, ['air', 'logistics'], 'RAAF Tindal; US bomber apron works under the 2014 Force Posture Agreement; open sources 2024'),
  pinegap:     S('Pine Gap',              'australia', null, 'PAC', 133.74, -23.8, ['radar'], 'Joint Defence Facility Pine Gap, 1966 treaty; open sources 2024'),
  darwin:      S('Darwin',                'australia', null, 'PAC', 130.8, -12.5, ['air', 'garrison', 'logistics'], 'USMC rotational force; candidate'),
  honiara:     S('Honiara',               null, 'Solomon Islands', 'PAC', 160.0, -9.4, ['port', 'naval'], 'China-Solomons security pact 2022; candidate'),
};
export const SITE_IDS = Object.keys(SITES);

// F15 (#89, spec Part 13) node tenure. lease and treaty (SOFA, defense cooperation agreement) persist through a relations collapse and end only
// by a specific event (abrogation, war outcome, your choice); a host agreement (signed with basingAgreement) and an access arrangement depend on
// current relations. own: home soil.
export const TENURES = {
  own:       { n: 'Home soil',              persists: true },
  lease:     { n: 'Lease',                  persists: true },
  treaty:    { n: 'Treaty / SOFA',          persists: true },
  agreement: { n: 'Host-nation agreement',  persists: false },
  access:    { n: 'Access arrangement',     persists: false },
};
// Real bases pre-placed at campaign start, for every playable nation (AI nations hold theirs too). Each carries its tenure; status_source per
// line, the owner corrects.
const B = (owner, site, type, tenure, status_source) => ({ owner, site, type, tenure, status_source });
export const REAL_BASES = [
  B('usa', 'norfolk', 'naval', 'own', 'US Fleet Forces Command home port'),
  B('usa', 'guam', 'naval', 'own', 'Naval Base Guam; SSN forward base'),
  B('usa', 'guam', 'air', 'own', 'Andersen AFB; bomber task force'),
  B('usa', 'diegogarcia', 'naval', 'treaty', 'Naval Support Facility Diego Garcia; 1966 UK-US exchange of notes'),
  B('usa', 'kadena', 'air', 'treaty', 'Kadena AB, 18th Wing; 1960 US-Japan treaty and SOFA'),
  B('usa', 'yokosuka', 'naval', 'treaty', 'Fleet Activities Yokosuka, Seventh Fleet; 1960 treaty and SOFA'),
  B('usa', 'osan', 'air', 'treaty', 'Osan AB, 51st Fighter Wing; 1953 MDT and 1966 SOFA'),
  B('usa', 'rota', 'naval', 'treaty', 'Naval Station Rota; DDG forward deployed; 1988 Agreement on Defense Cooperation'),
  B('usa', 'ramstein', 'air', 'treaty', 'Ramstein AB, USAFE; NATO SOFA and Supplementary Agreement'),
  B('usa', 'djibouti', 'sof', 'lease', 'Camp Lemonnier, CJTF-HOA; 2014 lease, 20 years'),
  B('usa', 'bahrain', 'naval', 'treaty', 'NSA Bahrain, Fifth Fleet; 1991 Defense Cooperation Agreement'),
  B('usa', 'aludeid', 'air', 'treaty', 'Al Udeid AB, CENTCOM forward; 1992 DCA, extended 2024'),
  B('usa', 'redzikowo', 'bmd', 'treaty', 'Aegis Ashore Poland, 2024; 2008 BMD agreement'),
  B('usa', 'deveselu', 'bmd', 'treaty', 'Aegis Ashore Romania, 2016; 2011 BMD agreement'),
  B('usa', 'pituffik', 'radar', 'treaty', 'Pituffik Space Base, BMEWS; 1951 Defense of Greenland Agreement'),
  B('usa', 'guantanamo', 'naval', 'lease', 'Naval Station Guantanamo Bay, 1903 lease'),
  B('china', 'yulin', 'naval', 'own', 'PLAN Yulin submarine base'),
  B('china', 'djibouti', 'naval', 'lease', 'PLA Support Base Djibouti, 2017; reported 10-year lease'),
  B('china', 'ream', 'naval', 'agreement', 'Ream Naval Base pier, 2023-; Cambodian host agreement'),
  B('russia', 'severomorsk', 'naval', 'own', 'Northern Fleet'),
  B('russia', 'sevastopol', 'naval', 'own', 'Black Sea Fleet, occupied Crimea (held as home soil by Russia); owner corrects'),
  B('russia', 'tartus', 'naval', 'lease', 'Tartus naval facility, 2017 49-year lease; status after 2024 uncertain'),
  B('russia', 'hmeimim', 'air', 'treaty', 'Hmeimim AB, 2015 indefinite agreement; status after 2024 uncertain'),
  B('russia', 'kant', 'air', 'treaty', 'Kant AB, CSTO; 2012 agreement'),
  B('russia', 'dushanbe', 'garrison', 'treaty', '201st Military Base; 2012 agreement to 2042'),
  B('russia', 'gyumri', 'garrison', 'treaty', '102nd Military Base; 1995 treaty, extended to 2044'),
  B('germany', 'wilhelmshaven', 'naval', 'own', 'Deutsche Marine, Einsatzflottille 2'),
  B('germany', 'rukla', 'garrison', 'treaty', 'Panzerbrigade 45 Litauen, standing up 2025-27; 2023 German-Lithuanian agreement'),
  B('germany', 'alazraq', 'air', 'agreement', 'Luftwaffe Einsatzgeschwader Jordanien; bilateral arrangement'),
  B('japan', 'yokosuka', 'naval', 'own', 'JMSDF Self Defense Fleet'),
  B('japan', 'djibouti', 'logistics', 'treaty', 'JSDF Base Djibouti, 2011; 2009 status agreement'),
  B('brazil', 'rio', 'naval', 'own', 'Marinha do Brasil, 1o Distrito Naval'),
  B('brazil', 'anapolis', 'air', 'own', 'FAB Ala 2, F-39 Gripen'),
  B('cuba', 'cienfuegos', 'naval', 'own', 'Marina de Guerra Revolucionaria'),
  B('cuba', 'sanantonio', 'air', 'own', 'DAAFAR fighter base'),
  B('norway', 'haakonsvern', 'naval', 'own', 'Sjoforsvaret main base'),
  B('norway', 'orland', 'air', 'own', 'Luftforsvaret 132 Air Wing, F-35'),
  B('norway', 'evenes', 'radar', 'own', 'Evenes air station, P-8 and QRA'),
];
