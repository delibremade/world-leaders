// F7 (#55), spec Part 9: the tangible order of battle. Real 2024 inventories per playable nation by type (airframes, hulls,
// formations, launchers), real crew ratios, recruitable-population parameters, and the owner-set parameters where real plans are
// contested. Data only; the engine (F7b) reads it. Every line carries a `status_source`: these are open-source figures as of 2024
// (IISS Military Balance 2024, FlightGlobal World Air Forces 2024, the US Naval Vessel Register, service fact sheets), rounded;
// the owner corrects.
//
// Line: id (unique per nation), n name, b branch (land|air|sea), cls (CLASSES), role (a CREW_RATIOS key), gen (airframe generation),
// count (2024 platforms: airframes, hulls, formations or launchers), mc (2024 mission-capable rate, %; for hulls and formations the share
// not in depot maintenance or reset), crew/mx (optional overrides of the role's crew ratio), reserve (manned by the reserve, not active),
// buys (game units whose procurement adds UNIT_PLATFORMS[unit].per platforms to this line: procurement adds to an existing fleet).
export const CLASSES = ['airframe', 'hull', 'formation', 'launcher'];

// Crew ratios per role. sets: crew sets per platform (the crew ratio); heads: people per crew set; mx: maintainers per platform.
// A formation's crew set is its own headcount. Drones attached to a host fly with the host's crews (sets 0).
const USAF = 'USAF crew-ratio standards (AFI 11-412 era; GAO-18-113 fighter pilot shortfall) and maintainer manning (GAO-19-439), owner to verify';
const USN = 'US Naval Vessel Register / NAVSEA manning (ship\'s company), owner to verify';
const ARMY = 'US Army FM 3-96 / force-structure tables (BCT authorized strength), owner to verify';
export const CREW_RATIOS = {
  fighter: { sets: 1.25, heads: 1, mx: 12, status_source: `${USAF}: 1.25 pilots per combat-coded fighter; ~300 maintainers per 24-ship squadron` },
  attack: { sets: 1.25, heads: 1, mx: 11, status_source: `${USAF}: fighter ratio applies to A-10/Su-25 squadrons` },
  bomber: { sets: 1.33, heads: 4, mx: 25, status_source: `${USAF}: 1.33 crews per bomber; crew 5 (B-52), 4 (B-1), 2 (B-2) set per line` },
  tanker: { sets: 1.5, heads: 3, mx: 10, status_source: `${USAF}: mobility crew ratio 1.5; KC-135/KC-46 crew 3` },
  awacs: { sets: 1.5, heads: 18, mx: 20, status_source: `${USAF}: E-3 flight crew 4 + mission crew 13-19` },
  airlift: { sets: 1.5, heads: 3, mx: 12, status_source: `${USAF}: mobility crew ratio 1.5; C-17 crew 3 (C-5 7, C-130 5 per line)` },
  mpa: { sets: 1.5, heads: 9, mx: 15, status_source: 'US Navy P-8A fact file: crew 9; patrol-squadron crew ratio ~1.5, owner to verify' },
  ew: { sets: 1.25, heads: 2, mx: 12, status_source: 'US Navy EA-18G fact file: crew 2; strike-fighter crew ratio, owner to verify' },
  isr: { sets: 1, heads: 2, mx: 10, status_source: 'USAF MQ-9 / RQ-4 fact sheets: pilot + sensor operator per crew, owner to verify' },
  drone: { sets: 0, heads: 0, mx: 4, status_source: 'game rule (spec Part 7): collaborative drones fly with the host wing\'s crews' },
  helo: { sets: 1.2, heads: 3, mx: 8, status_source: 'US Army aviation: AH-64 crew 2, UH-60 crew 4; ~1.2 crews per aircraft, owner to verify' },
  carrier: { sets: 1, heads: 3000, mx: 0, status_source: `${USN}: Nimitz/Ford ship's company ~3,000 (air wing counted by its airframes)` },
  ssn: { sets: 1, heads: 135, mx: 0, status_source: `${USN}: Virginia-class crew ~135` },
  ssbn: { sets: 2, heads: 155, mx: 0, status_source: `${USN}: Ohio-class SSBN crew 155, Blue and Gold crews per hull` },
  ssgn: { sets: 2, heads: 160, mx: 0, status_source: `${USN}: Ohio-class SSGN crew ~160, two crews per hull` },
  ssk: { sets: 1, heads: 50, mx: 0, status_source: 'IISS 2024 class notes: diesel-electric submarine crews 30-60, owner to verify' },
  cruiser: { sets: 1, heads: 330, mx: 0, status_source: `${USN}: Ticonderoga CG crew ~330` },
  destroyer: { sets: 1, heads: 320, mx: 0, status_source: `${USN}: Arleigh Burke DDG crew ~320` },
  frigate: { sets: 1, heads: 200, mx: 0, status_source: `${USN}: Constellation FFG planned crew ~200; European frigates 120-250` },
  lcs: { sets: 1.5, heads: 70, mx: 0, status_source: `${USN}: LCS core crew ~70, three crews per two hulls` },
  corvette: { sets: 1, heads: 80, mx: 0, status_source: 'IISS 2024 class notes: corvette crews 40-110, owner to verify' },
  amphib: { sets: 1, heads: 400, mx: 0, status_source: `${USN}: LHD ~1,200, LPD ~380, LSD ~330 (set per line)` },
  armor: { sets: 1, heads: 4200, mx: 0, status_source: `${ARMY}: armored BCT ~4,200` },
  infantry: { sets: 1, heads: 4400, mx: 0, status_source: `${ARMY}: infantry BCT ~4,400` },
  stryker: { sets: 1, heads: 4500, mx: 0, status_source: `${ARMY}: Stryker BCT ~4,500` },
  battalion: { sets: 1, heads: 900, mx: 0, status_source: 'USMC infantry battalion ~900 (Force Design 2030), owner to verify' },
  icbm: { sets: 1, heads: 2, mx: 20, status_source: 'USAF missile wings: ~3,000 airmen per 150-missile wing (missileers, maintenance, security), owner to verify' },
};
export const crewOfLine = (l) => { const r = CREW_RATIOS[l.role] || { sets: 1, heads: 1, mx: 0 }; return { sets: l.crew?.[0] ?? r.sets, heads: l.crew?.[1] ?? r.heads, mx: l.mx ?? r.mx }; };
// People one line needs at full manning: crews (sets x heads) plus maintainers, per platform.
export const crewHeads = (l, n = l.count) => { const c = crewOfLine(l); return n * (c.sets * c.heads + c.mx); };

// ── Inventories. Shorthand sources per nation; each line appends what it rests on.
const MB = 'IISS Military Balance 2024';
const WAF = 'FlightGlobal World Air Forces 2024';
const NVR = 'US Naval Vessel Register (2024)';
const AFA = 'Air & Space Forces Almanac 2024 (FY2023 TAI and MC rates)';
const EST = 'no open MC data; estimate';
const L = (id, n, b, cls, role, count, mc, status_source, o = {}) => ({ id, n, b, cls, role, count, mc, status_source, ...o });

export const ORBAT = {
  usa: [
    // Air (USAF, USN, USMC airframes)
    L('f22', 'F-22A Raptor', 'air', 'airframe', 'fighter', 183, 40, `${AFA}: 183 TAI, MC 40%`, { gen: 5 }),
    L('f35a', 'F-35A Lightning II', 'air', 'airframe', 'fighter', 410, 51, `${AFA}; ${WAF}: ~410 USAF, MC 51%`, { gen: 5, buys: ['f35', 'fighter_wing'] }),
    L('f35b', 'F-35B (USMC)', 'air', 'airframe', 'fighter', 140, 55, `${WAF}: ~140 USMC; GAO-23-106217 fleet MC ~55%`, { gen: 5 }),
    L('f35c', 'F-35C (USN/USMC)', 'air', 'airframe', 'fighter', 75, 55, `${WAF}: ~75; GAO-23-106217 fleet MC ~55%`, { gen: 5 }),
    L('fa18ef', 'F/A-18E/F Super Hornet', 'air', 'airframe', 'fighter', 560, 68, `${WAF}: ~560 USN; NAVAIR strike-fighter MC ~68%`, { gen: 4 }),
    L('ea18g', 'EA-18G Growler', 'air', 'airframe', 'ew', 160, 65, `${WAF}: ~160 USN`, { gen: 4 }),
    L('f15e', 'F-15E Strike Eagle', 'air', 'airframe', 'fighter', 218, 61, `${AFA}: 218 TAI, MC 61%`, { gen: 4 }),
    L('f15ex', 'F-15EX Eagle II', 'air', 'airframe', 'fighter', 8, 70, `${AFA}: first operational deliveries 2024 (~8)`, { gen: 4 }),
    L('f15cd', 'F-15C/D Eagle', 'air', 'airframe', 'fighter', 110, 60, `${AFA}: ~110, retiring`, { gen: 4 }),
    L('f16', 'F-16C/D Fighting Falcon', 'air', 'airframe', 'fighter', 840, 67, `${WAF}: ~840 incl. ANG/AFRC; ${AFA}: MC 67%`, { gen: 4 }),
    L('a10', 'A-10C Thunderbolt II', 'air', 'airframe', 'attack', 260, 70, `${AFA}: ~260, divesting`, { gen: 3 }),
    L('b1b', 'B-1B Lancer', 'air', 'airframe', 'bomber', 45, 47, `${AFA}: 45 TAI, MC ~47%`, { gen: 4, crew: [1.33, 4] }),
    L('b2a', 'B-2A Spirit', 'air', 'airframe', 'bomber', 19, 55, `${AFA}: 20 built, 19 in service after the 2022 Whiteman mishap; MC ~55%`, { gen: 5, crew: [1.33, 2], mx: 40 }),
    L('b52h', 'B-52H Stratofortress', 'air', 'airframe', 'bomber', 76, 56, `${AFA}: 76 TAI, MC ~56%`, { gen: 3, crew: [1.33, 5] }),
    L('b21', 'B-21 Raider', 'air', 'airframe', 'bomber', 0, 60, 'USAF: LRIP 2024, test aircraft only (owner ruling on #55: planned buy 200+)', { gen: 6, crew: [1.33, 2], mx: 30, buys: ['b21', 'strategic_bombers'] }),
    L('f47', 'F-47 (NGAD)', 'air', 'airframe', 'fighter', 0, 60, 'USAF: NGAD in development 2024, F-47 award 2025; not in service', { gen: 6, buys: ['f47'] }),
    L('faxx', 'F/A-XX', 'air', 'airframe', 'fighter', 0, 60, 'US Navy: F/A-XX in development (owner ruling on #55: active); not in service', { gen: 6, buys: ['fa_xx'] }),
    L('cca', 'CCA Increment 1', 'air', 'airframe', 'drone', 0, 70, 'USAF: Increment 1 prototypes 2024; not in service', { gen: 6, buys: ['cca', 'drone_swarm'] }),
    L('kc135', 'KC-135R/T Stratotanker', 'air', 'airframe', 'tanker', 376, 69, `${AFA}: 376 TAI incl. ANG/AFRC, MC ~69%`),
    L('kc46', 'KC-46A Pegasus', 'air', 'airframe', 'tanker', 80, 55, `${AFA}: ~80 delivered by 2024, MC ~55%`),
    L('e3', 'E-3G Sentry (AWACS)', 'air', 'airframe', 'awacs', 16, 55, `${AFA}: 16 after the 2023-24 retirements`),
    L('c17', 'C-17A Globemaster III', 'air', 'airframe', 'airlift', 222, 71, `${AFA}: 222 TAI, MC ~71%`),
    L('c5m', 'C-5M Super Galaxy', 'air', 'airframe', 'airlift', 52, 46, `${AFA}: 52 TAI, MC ~46%`, { crew: [1.5, 7], mx: 25 }),
    L('c130', 'C-130H/J Hercules', 'air', 'airframe', 'airlift', 290, 70, `${AFA}: ~290 incl. ANG/AFRC`, { crew: [1.5, 5] }),
    L('p8', 'P-8A Poseidon', 'air', 'airframe', 'mpa', 120, 65, `${WAF}: ~120 USN`),
    L('mq9', 'MQ-9A Reaper', 'air', 'airframe', 'isr', 230, 75, `${WAF}: ~230 USAF`, { buys: ['rq170'] }),
    L('rq4', 'RQ-4B Global Hawk', 'air', 'airframe', 'isr', 20, 60, `${AFA}: ~20 Block 40 after Block 30 retirement`, { buys: ['rq180', 'sr72'] }),
    // Sea (battle force hulls)
    L('cvn', 'Aircraft carrier (CVN)', 'sea', 'hull', 'carrier', 11, 64, `${NVR}: 10 Nimitz + Ford; OFRP ~1/3 in maintenance`, { buys: ['ford', 'carrier_group'] }),
    L('ssn', 'Attack submarine (SSN)', 'sea', 'hull', 'ssn', 49, 63, `${NVR}: 49 (Virginia, Los Angeles, Seawolf); GAO-24-105915 ~37% in or awaiting maintenance`, { buys: ['ssnx', 'sub_fleet'] }),
    L('ssbn', 'Ballistic missile submarine (SSBN)', 'sea', 'hull', 'ssbn', 14, 70, `${NVR}: 14 Ohio`, { buys: ['ssbn_fleet'] }),
    L('ssgn', 'Guided missile submarine (SSGN)', 'sea', 'hull', 'ssgn', 4, 70, `${NVR}: 4 Ohio SSGN`),
    L('cg', 'Cruiser (CG)', 'sea', 'hull', 'cruiser', 13, 60, `${NVR}: 13 Ticonderoga at end 2024, decommissioning`),
    L('ddg', 'Destroyer (DDG-51)', 'sea', 'hull', 'destroyer', 73, 70, `${NVR}: 73 Arleigh Burke`),
    L('ddg1000', 'Zumwalt destroyer (DDG-1000)', 'sea', 'hull', 'destroyer', 2, 50, `${NVR}: 2 commissioned (DDG-1002 not yet)`, { crew: [1, 175], buys: ['zumwalt'] }),
    L('ffg', 'Frigate (FFG-62 Constellation)', 'sea', 'hull', 'frigate', 0, 70, `${NVR}: lead ship building, none delivered`, { buys: ['frigate', 'frigate_sqn'] }),
    L('lcs', 'Littoral combat ship (LCS)', 'sea', 'hull', 'lcs', 25, 60, `${NVR}: ~25 after early retirements`),
    L('lha_lhd', 'Amphibious assault ship (LHA/LHD)', 'sea', 'hull', 'amphib', 9, 55, `${NVR}: 7 Wasp + 2 America`, { crew: [1, 1200] }),
    L('lpd', 'Amphibious transport dock (LPD)', 'sea', 'hull', 'amphib', 13, 55, `${NVR}: 13 San Antonio`, { crew: [1, 380] }),
    L('lsd', 'Dock landing ship (LSD)', 'sea', 'hull', 'amphib', 8, 45, `${NVR}: ~8 Whidbey Island/Harpers Ferry`, { crew: [1, 330] }),
    // Land (formations) and the land-based leg of the triad
    L('abct', 'Armored brigade combat team', 'land', 'formation', 'armor', 11, 70, `${MB}: 11 active ABCTs; readiness ratings classified, ${EST}`, { buys: ['mech_division'] }),
    L('sbct', 'Stryker brigade combat team', 'land', 'formation', 'stryker', 6, 70, `${MB}: 6 active SBCTs; ${EST}`),
    L('ibct', 'Infantry brigade combat team', 'land', 'formation', 'infantry', 14, 70, `${MB}: 14 active IBCTs incl. airborne/air assault; ${EST}`),
    L('arng_bct', 'National Guard BCT', 'land', 'formation', 'infantry', 27, 55, `${MB}: 27 ARNG BCTs; ${EST}`, { reserve: true }),
    L('usmc_inf_bn', 'USMC infantry battalion', 'land', 'formation', 'battalion', 21, 70, `${MB}: 21 active battalions under Force Design 2030`),
    L('ah64', 'AH-64D/E Apache', 'land', 'airframe', 'helo', 750, 70, `${WAF}: ~750 US Army`, { crew: [1.2, 2] }),
    L('uh60', 'UH-60 Black Hawk', 'land', 'airframe', 'helo', 2100, 72, `${WAF}: ~2,100 US Army incl. ARNG`, { crew: [1.2, 4] }),
    L('mm3', 'Minuteman III ICBM', 'land', 'launcher', 'icbm', 400, 90, `${MB}: 400 deployed in 450 silos (New START)`, { buys: ['icbm_force'] }),
  ],
  russia: [
    L('su57', 'Su-57 Felon', 'air', 'airframe', 'fighter', 22, 55, `${MB}; ${WAF}: ~22; ${EST}`, { gen: 5, buys: ['su57'] }),
    L('su35s', 'Su-35S Flanker-E', 'air', 'airframe', 'fighter', 110, 60, `${MB}: ~110; ${EST}`, { gen: 4, buys: ['fighter_wing'] }),
    L('su30', 'Su-30SM/SM2', 'air', 'airframe', 'fighter', 100, 60, `${MB}: ~100 VKS + naval aviation; ${EST}`, { gen: 4 }),
    L('su34', 'Su-34 Fullback', 'air', 'airframe', 'attack', 110, 60, `${MB}: ~110 after war losses; ${EST}`, { gen: 4 }),
    L('mig31', 'MiG-31BM/K Foxhound', 'air', 'airframe', 'fighter', 110, 55, `${MB}: ~110; ${EST}`, { gen: 4 }),
    L('su25', 'Su-25SM Frogfoot', 'air', 'airframe', 'attack', 170, 55, `${MB}: ~170; ${EST}`, { gen: 3 }),
    L('tu160', 'Tu-160 Blackjack', 'air', 'airframe', 'bomber', 16, 50, `${MB}: ~16; ${EST}`, { gen: 4, buys: ['strategic_bombers'] }),
    L('tu95', 'Tu-95MS Bear-H', 'air', 'airframe', 'bomber', 55, 50, `${MB}: ~55; ${EST}`, { gen: 3, crew: [1.33, 7] }),
    L('tu22m3', 'Tu-22M3 Backfire', 'air', 'airframe', 'bomber', 55, 45, `${MB}: ~55; ${EST}`, { gen: 3 }),
    L('pakda', 'PAK DA', 'air', 'airframe', 'bomber', 0, 60, 'in development 2024; not in service', { gen: 6, buys: ['pakda'] }),
    L('s70', 'S-70 Okhotnik', 'air', 'airframe', 'drone', 0, 60, 'prototypes 2024; not in service', { gen: 6, buys: ['s70', 'drone_swarm'] }),
    L('il78', 'Il-78M Midas tanker', 'air', 'airframe', 'tanker', 15, 55, `${MB}: ~15; ${EST}`),
    L('a50', 'A-50/A-50U Mainstay', 'air', 'airframe', 'awacs', 6, 50, `${MB}: ~6 after 2024 losses; ${EST}`),
    L('il76', 'Il-76MD Candid', 'air', 'airframe', 'airlift', 110, 55, `${MB}: ~110; ${EST}`, { crew: [1.5, 5] }),
    L('cv', 'Aircraft carrier (Kuznetsov)', 'sea', 'hull', 'carrier', 1, 0, `${MB}: 1, in refit since 2017`, { crew: [1, 1960], buys: ['carrier_group'] }),
    L('ssbn', 'SSBN (Borei, Delta IV)', 'sea', 'hull', 'ssbn', 12, 60, `${MB}: 7 Borei + 5 Delta IV; ${EST}`, { buys: ['ssbn_fleet'] }),
    L('ssgn', 'SSGN (Yasen, Oscar II)', 'sea', 'hull', 'ssgn', 8, 55, `${MB}: 4 Yasen + 4 Oscar II; ${EST}`, { crew: [1, 100], buys: ['husky'] }),
    L('ssn', 'SSN (Akula, Sierra, Victor III)', 'sea', 'hull', 'ssn', 10, 45, `${MB}: ~10; ${EST}`, { crew: [1, 75], buys: ['sub_fleet'] }),
    L('ssk', 'SSK (Kilo, Lada)', 'sea', 'hull', 'ssk', 21, 60, `${MB}: ~21; ${EST}`),
    L('cg', 'Cruiser (Kirov, Slava)', 'sea', 'hull', 'cruiser', 2, 50, `${MB}: Pyotr Velikiy + Varyag (Moskva lost 2022); ${EST}`, { crew: [1, 500] }),
    L('ddg', 'Destroyer (Udaloy, Sovremenny)', 'sea', 'hull', 'destroyer', 10, 50, `${MB}: ~10; ${EST}`, { crew: [1, 250] }),
    L('ffg', 'Frigate (Gorshkov, Grigorovich, Neustrashimy)', 'sea', 'hull', 'frigate', 11, 60, `${MB}: ~11; ${EST}`, { buys: ['frigate', 'frigate_sqn'] }),
    L('corvette', 'Corvettes and missile boats', 'sea', 'hull', 'corvette', 80, 60, `${MB}: ~80 (Buyan-M, Karakurt, Steregushchiy...); ${EST}`),
    L('tank_div', 'Tank / motor rifle division', 'land', 'formation', 'armor', 25, 60, `${MB}: ~25 divisions (rebuilt after 2022 losses); ${EST}`, { crew: [1, 10000], buys: ['mech_division'] }),
    L('mr_bde', 'Motor rifle / airborne brigade', 'land', 'formation', 'infantry', 30, 60, `${MB}: ~30 manoeuvre brigades; ${EST}`, { crew: [1, 3800] }),
    L('icbm', 'ICBM launchers (Yars, Sarmat, SS-18)', 'land', 'launcher', 'icbm', 330, 85, `${MB}: ~330 launchers; ${EST}`, { buys: ['icbm_force'] }),
  ],
  china: [
    L('j20', 'J-20 Mighty Dragon', 'air', 'airframe', 'fighter', 200, 65, `${MB}; ${WAF}: ~200; ${EST}`, { gen: 5, buys: ['j20'] }),
    L('j35', 'J-35', 'air', 'airframe', 'fighter', 0, 60, 'J-35A shown Nov 2024, not yet in units', { gen: 5, buys: ['j35'] }),
    L('j16', 'J-16', 'air', 'airframe', 'fighter', 300, 65, `${MB}: ~300; ${EST}`, { gen: 4, buys: ['fighter_wing'] }),
    L('j10', 'J-10A/B/C', 'air', 'airframe', 'fighter', 600, 65, `${MB}: ~600; ${EST}`, { gen: 4 }),
    L('j11', 'J-11/Su-27/Su-30MKK', 'air', 'airframe', 'fighter', 400, 60, `${MB}: ~400; ${EST}`, { gen: 4 }),
    L('j36', 'J-36', 'air', 'airframe', 'fighter', 0, 60, 'prototype flying Dec 2024 (owner spec Part 2)', { gen: 6, buys: ['j36'] }),
    L('j50', 'J-50', 'air', 'airframe', 'fighter', 0, 60, 'prototype flying Dec 2024 (owner spec Part 2)', { gen: 6, buys: ['j50'] }),
    L('gj11', 'GJ-11 Sharp Sword', 'air', 'airframe', 'drone', 0, 60, 'prototypes and trials 2024; not in service', { gen: 5, buys: ['gj11', 'drone_swarm'] }),
    L('h6', 'H-6K/N bomber', 'air', 'airframe', 'bomber', 180, 60, `${MB}: ~180; ${EST}`, { gen: 3, buys: ['strategic_bombers'] }),
    L('h20', 'H-20', 'air', 'airframe', 'bomber', 0, 60, 'in development, not shown publicly', { gen: 6, buys: ['h20'] }),
    L('kj500', 'KJ-500 / KJ-2000 AEW&C', 'air', 'airframe', 'awacs', 45, 60, `${MB}: ~45; ${EST}`),
    L('y20', 'Y-20 / YY-20', 'air', 'airframe', 'airlift', 70, 65, `${MB}: ~70 incl. tankers; ${EST}`),
    L('wz8', 'WZ-8', 'air', 'airframe', 'isr', 6, 60, 'small numbers in service (shown 2019); estimate', { buys: ['wz8', 'rq170', 'rq180'] }),
    L('cv', 'Aircraft carrier (Liaoning, Shandong)', 'sea', 'hull', 'carrier', 2, 60, `${MB}: 2 in service, Fujian on sea trials; ${EST}`, { crew: [1, 2000], buys: ['fujian', 'carrier_group'] }),
    L('ssbn', 'SSBN (Type 094)', 'sea', 'hull', 'ssbn', 6, 55, `${MB}; DoD China Military Power Report 2024: 6; ${EST}`, { crew: [1, 140], buys: ['ssbn_fleet'] }),
    L('ssn', 'SSN (Type 093)', 'sea', 'hull', 'ssn', 6, 55, `${MB}: 6; ${EST}`, { crew: [1, 100], buys: ['t095', 'sub_fleet'] }),
    L('ssk', 'SSK (Yuan, Song, Kilo)', 'sea', 'hull', 'ssk', 48, 60, `${MB}: ~48; ${EST}`),
    L('cg', 'Cruiser (Type 055)', 'sea', 'hull', 'cruiser', 8, 65, `${MB}: 8; ${EST}`, { crew: [1, 300] }),
    L('ddg', 'Destroyer (Type 052D/C and older)', 'sea', 'hull', 'destroyer', 42, 65, `${MB}: ~42; ${EST}`, { crew: [1, 280] }),
    L('ffg', 'Frigate (Type 054A)', 'sea', 'hull', 'frigate', 45, 65, `${MB}: ~45; ${EST}`, { crew: [1, 165], buys: ['frigate', 'frigate_sqn'] }),
    L('corvette', 'Corvette (Type 056/056A)', 'sea', 'hull', 'corvette', 50, 65, `${MB}: ~50 after coast-guard transfers; ${EST}`),
    L('amphib', 'Amphibious ships (Type 075, 071)', 'sea', 'hull', 'amphib', 11, 60, `${MB}: 3 Type 075 + 8 Type 071; ${EST}`, { crew: [1, 700] }),
    L('ca_bde', 'Combined-arms brigade', 'land', 'formation', 'armor', 82, 65, `${MB}: 82 combined-arms brigades; ${EST}`, { crew: [1, 5000], buys: ['mech_division'] }),
    L('icbm', 'ICBM launchers (DF-41, DF-31, DF-5)', 'land', 'launcher', 'icbm', 350, 80, 'DoD China Military Power Report 2024: ~350 launchers; estimate', { buys: ['icbm_force'] }),
  ],
  germany: [
    L('ef2000', 'Eurofighter Typhoon', 'air', 'airframe', 'fighter', 138, 50, `${MB}; ${WAF}: ~138; Bundeswehr readiness report: MC ~50%`, { gen: 4, buys: ['fighter_wing'] }),
    L('tornado', 'Tornado IDS/ECR', 'air', 'airframe', 'attack', 85, 45, `${MB}: ~85, retiring 2030`, { gen: 3, crew: [1.25, 2] }),
    L('f35a', 'F-35A Lightning II', 'air', 'airframe', 'fighter', 0, 55, '35 ordered 2022, deliveries from 2026', { gen: 5, buys: ['f35'] }),
    L('fcas', 'FCAS / SCAF NGF', 'air', 'airframe', 'fighter', 0, 60, 'FCAS phase 1B demonstrator work; not in service', { gen: 6, buys: ['fcas'] }),
    L('a400m', 'A400M Atlas', 'air', 'airframe', 'airlift', 40, 55, `${WAF}: ~40`, { crew: [1.5, 4] }),
    L('p8', 'P-8A Poseidon', 'air', 'airframe', 'mpa', 0, 65, '8 ordered 2021, first delivery 2024-25', {}),
    L('ffg', 'Frigate (F123, F124, F125)', 'sea', 'hull', 'frigate', 11, 55, `${MB}: 4 F123 + 3 F124 + 4 F125`, { crew: [1, 190], buys: ['frigate', 'frigate_sqn'] }),
    L('corvette', 'Corvette (K130)', 'sea', 'hull', 'corvette', 7, 60, `${MB}: 5 batch 1 + batch 2 delivering`, { crew: [1, 65] }),
    L('ssk', 'Submarine (Type 212A)', 'sea', 'hull', 'ssk', 6, 35, `${MB}: 6; often only 1-2 available (Bundeswehr readiness reports)`, { crew: [1, 28], buys: ['sub_fleet'] }),
    L('pz_bde', 'Armoured / mechanised brigade', 'land', 'formation', 'armor', 8, 55, `${MB}: ~8 manoeuvre brigades incl. 45th (Lithuania) forming; Bundeswehr readiness reports`, { crew: [1, 5000], buys: ['mech_division'] }),
  ],
  japan: [
    L('f35a', 'F-35A Lightning II', 'air', 'airframe', 'fighter', 40, 60, `${MB}; ${WAF}: ~40; ${EST}`, { gen: 5, buys: ['f35'] }),
    L('f35b', 'F-35B', 'air', 'airframe', 'fighter', 3, 60, 'first JASDF F-35B arrived Aug 2024', { gen: 5 }),
    L('f15j', 'F-15J/DJ Eagle', 'air', 'airframe', 'fighter', 200, 65, `${MB}: ~200; ${EST}`, { gen: 4, buys: ['fighter_wing'] }),
    L('f2', 'Mitsubishi F-2', 'air', 'airframe', 'fighter', 90, 65, `${MB}: ~90; ${EST}`, { gen: 4 }),
    L('gcap', 'GCAP', 'air', 'airframe', 'fighter', 0, 60, 'GCAP development (UK/Italy/Japan), service ~2035', { gen: 6, buys: ['gcap'] }),
    L('gcap_cca', 'GCAP adjunct drones', 'air', 'airframe', 'drone', 0, 60, 'concept with GCAP; not in service', { gen: 6, buys: ['gcap_cca', 'drone_swarm'] }),
    L('aew', 'E-767 / E-2C/D AEW', 'air', 'airframe', 'awacs', 21, 60, `${MB}: 4 E-767 + ~17 E-2C/D; ${EST}`),
    L('tanker', 'KC-767 / KC-46A', 'air', 'airframe', 'tanker', 8, 60, `${MB}: 4 KC-767 + ~4 KC-46A; ${EST}`),
    L('c2', 'Kawasaki C-2', 'air', 'airframe', 'airlift', 15, 60, `${WAF}: ~15; ${EST}`),
    L('p1', 'Kawasaki P-1 / P-3C', 'air', 'airframe', 'mpa', 75, 60, `${MB}: ~35 P-1 + ~40 P-3C; ${EST}`, { crew: [1.5, 11] }),
    L('ddh', 'Helicopter destroyer (Izumo, Hyuga)', 'sea', 'hull', 'carrier', 4, 60, `${MB}: 2 Izumo (F-35B conversion) + 2 Hyuga; ${EST}`, { crew: [1, 470], buys: ['carrier_group'] }),
    L('ddg', 'Destroyer (incl. 8 Aegis)', 'sea', 'hull', 'destroyer', 36, 65, `${MB}: ~36; ${EST}`, { crew: [1, 280] }),
    L('ffg', 'Frigate (Mogami)', 'sea', 'hull', 'frigate', 8, 65, `${MB}: ~8 Mogami by end 2024; ${EST}`, { crew: [1, 90], buys: ['frigate', 'frigate_sqn'] }),
    L('ssk', 'Submarine (Soryu, Taigei)', 'sea', 'hull', 'ssk', 22, 65, `${MB}: 22 front-line; ${EST}`, { crew: [1, 70], buys: ['sub_fleet'] }),
    L('div', 'GSDF division / brigade', 'land', 'formation', 'infantry', 15, 65, `${MB}: 9 divisions + 6 brigades; ${EST}`, { crew: [1, 7000], buys: ['mech_division'] }),
  ],
  norway: [
    L('f35a', 'F-35A Lightning II', 'air', 'airframe', 'fighter', 52, 65, `${WAF}: all 52 delivered by 2024; ${EST}`, { gen: 5, buys: ['f35', 'fighter_wing'] }),
    L('p8', 'P-8A Poseidon', 'air', 'airframe', 'mpa', 5, 65, `${MB}: 5; ${EST}`),
    L('c130j', 'C-130J-30 Super Hercules', 'air', 'airframe', 'airlift', 4, 70, `${MB}: 4; ${EST}`, { crew: [1.5, 5] }),
    L('ffg', 'Frigate (Fridtjof Nansen)', 'sea', 'hull', 'frigate', 4, 55, `${MB}: 4 (Helge Ingstad lost 2018); ${EST}`, { crew: [1, 120], buys: ['frigate', 'frigate_sqn'] }),
    L('corvette', 'Corvette (Skjold)', 'sea', 'hull', 'corvette', 6, 60, `${MB}: 6; ${EST}`, { crew: [1, 21] }),
    L('ssk', 'Submarine (Ula)', 'sea', 'hull', 'ssk', 6, 55, `${MB}: 6; ${EST}`, { crew: [1, 21], buys: ['sub_fleet'] }),
    L('bde_nord', 'Brigade North (battalions)', 'land', 'formation', 'battalion', 4, 65, `${MB}: Brigade North, ~4 manoeuvre battalions; ${EST}`, { crew: [1, 900], buys: ['mech_division'] }),
  ],
  brazil: [
    L('gripen', 'F-39 Gripen E/F', 'air', 'airframe', 'fighter', 8, 60, `${WAF}: ~8 delivered by 2024; ${EST}`, { gen: 4, buys: ['gripen', 'fighter_wing'] }),
    L('f5', 'F-5EM/FM Tiger II', 'air', 'airframe', 'fighter', 45, 55, `${MB}: ~45; ${EST}`, { gen: 3 }),
    L('a29', 'A-29 Super Tucano', 'air', 'airframe', 'attack', 70, 60, `${MB}: ~70; ${EST}`, { gen: 3 }),
    L('kc390', 'KC-390 Millennium', 'air', 'airframe', 'airlift', 7, 60, `${WAF}: ~7; ${EST}`),
    L('pha', 'Helicopter carrier (Atlântico)', 'sea', 'hull', 'carrier', 1, 55, `${MB}: 1; ${EST}`, { crew: [1, 800], buys: ['carrier_group'] }),
    L('ssk', 'Submarine (Riachuelo, Tupi)', 'sea', 'hull', 'ssk', 6, 50, `${MB}: 3 Riachuelo + ~3 Tupi/Tikuna; ${EST}`, { crew: [1, 40], buys: ['sub_fleet'] }),
    L('ffg', 'Frigate (Niteroi, Greenhalgh)', 'sea', 'hull', 'frigate', 6, 50, `${MB}: ~6; ${EST}`, { crew: [1, 210], buys: ['frigate', 'frigate_sqn'] }),
    L('bde', 'Army brigade', 'land', 'formation', 'infantry', 27, 55, `${MB}: ~27 brigades; ${EST}`, { crew: [1, 4000], buys: ['mech_division'] }),
  ],
  cuba: [
    L('mig29', 'MiG-29 Fulcrum', 'air', 'airframe', 'fighter', 3, 40, `${MB}: ~3 serviceable; ${EST}`, { gen: 4, buys: ['fighter_wing'] }),
    L('mig23', 'MiG-23 Flogger', 'air', 'airframe', 'fighter', 12, 25, `${MB}: ~12, few serviceable; ${EST}`, { gen: 3 }),
    L('corvette', 'Patrol and missile craft', 'sea', 'hull', 'corvette', 8, 40, `${MB}: ~8 patrol / missile boats; ${EST}`, { crew: [1, 30], buys: ['frigate', 'frigate_sqn'] }),
    L('div', 'Army division / brigade', 'land', 'formation', 'infantry', 9, 50, `${MB}: ~9 manoeuvre formations (mostly cadre); ${EST}`, { crew: [1, 3000], buys: ['mech_division'] }),
  ],
};

// ── #93 fleet age and service life: [average age in 2024, service life] in years per line, with the basis. Lines not listed read
// FLEET_RULES.ageDef by class and generation. succ: the type a retired line's crews convert to (else the newest line of the same role).
// omX: sustainment cost per platform relative to its role weight (cost per flying hour vs the F-35A); 1 when absent.
const AGE = 'USAF / USN fleet age data FY2024 (Air & Space Forces Almanac; NVR commissioning dates), service-life plans; owner to verify';
export const FLEET_AGES = {
  usa: {
    f22: [17, 30, AGE + '; built 1997-2011, 8,000 h airframe, retirement planned from the 2030s'], f35a: [5, 35, AGE], f35b: [6, 35, AGE], f35c: [4, 35, AGE],
    fa18ef: [15, 30, AGE + '; SLEP to 10,000 h'], ea18g: [11, 30, AGE], f15e: [32, 45, AGE], f15ex: [1, 40, AGE], f15cd: [38, 40, AGE + '; divesting'], f16: [33, 45, AGE + '; SLEP to 12,000 h'],
    a10: [43, 45, AGE + '; divesting by 2029'], b1b: [38, 45, AGE], b2a: [30, 60, AGE], b52h: [62, 95, AGE + '; CERP and RMP keep it to the 2050s'], b21: [0, 40, AGE],
    f47: [0, 35, AGE], faxx: [0, 35, AGE], cca: [0, 15, AGE], kc135: [62, 80, AGE], kc46: [4, 40, AGE], e3: [45, 48, AGE + '; E-7 replacement'], c17: [20, 45, AGE], c5m: [40, 60, AGE],
    c130: [25, 40, AGE], p8: [9, 30, AGE], mq9: [10, 20, AGE], rq4: [12, 25, AGE],
    cvn: [30, 50, AGE], ssn: [20, 33, AGE], ssbn: [35, 42, AGE + '; Columbia from 2031'], ssgn: [41, 45, AGE], cg: [32, 35, AGE + '; all decommission by 2027'], ddg: [18, 40, AGE],
    ddg1000: [6, 30, AGE], ffg: [0, 30, AGE], lcs: [8, 25, AGE], lha_lhd: [22, 40, AGE], lpd: [14, 40, AGE], lsd: [34, 40, AGE],
    abct: [30, 50, AGE + '; M1 hulls rebuilt to SEPv3'], sbct: [18, 40, AGE], ibct: [15, 40, AGE], arng_bct: [25, 40, AGE], usmc_inf_bn: [15, 40, AGE], ah64: [18, 40, AGE], uh60: [22, 40, AGE],
    mm3: [54, 65, AGE + '; Sentinel replaces it in the 2030s'],
  },
};
export const FLEET_LINKS = {
  usa: { f22: { succ: 'f47', omX: 2.3, status_source: 'GAO-18-75 / USAF CPFH FY2021: F-22 ~$85k vs F-35A ~$36k per flying hour; F-47 is the F-22 successor' },
    b2a: { omX: 3.5, status_source: 'USAF CPFH FY2021: B-2 ~$130k per flying hour' }, f15cd: { succ: 'f15ex' }, a10: { succ: 'f35a' }, f16: { succ: 'f35a' }, fa18ef: { succ: 'faxx' },
    b1b: { succ: 'b21' }, b52h: { succ: 'b21' }, kc135: { succ: 'kc46' }, cg: { succ: 'ddg' }, lcs: { succ: 'ffg' } },
};

// ── Recruitable population. Headcounts. pop / cohort (ages 17-24, the recruiting window, cohortYears wide) / milAge (ages 18-49) in people;
// elig: share of the cohort that meets the standards; active / reserve: 2024 strength; accessions: 2024 annual intake. The engine (F7b)
// derives propensity = accessions x cohortYears / (cohort x elig) and moves it with pay, unemployment and stability.
const UN = 'UN World Population Prospects 2024 (cohorts)';
export const MANPOWER = {
  usa: { pop: 335e6, cohort: 34e6, cohortYears: 8, milAge: 140e6, elig: 0.23, active: 1283000, reserve: 761000, accessions: 155000, conscription: false,
    status_source: `${UN}; DoD QMA study 2020 (23% eligible); DMDC Sep 2024 strength; DoD FY2024 recruiting results` },
  russia: { pop: 144e6, cohort: 11e6, cohortYears: 8, milAge: 60e6, elig: 0.6, active: 1100000, reserve: 1500000, accessions: 600000, conscription: true,
    status_source: `${UN}; ${MB} strength; two annual drafts (~280k) plus contract recruitment, estimate` },
  china: { pop: 1410e6, cohort: 110e6, cohortYears: 8, milAge: 600e6, elig: 0.5, active: 2035000, reserve: 510000, accessions: 400000, conscription: true,
    status_source: `${UN}; ${MB} strength; annual intake ~400k, estimate` },
  germany: { pop: 84e6, cohort: 6.4e6, cohortYears: 8, milAge: 32e6, elig: 0.5, active: 181500, reserve: 34600, accessions: 20300, conscription: false,
    status_source: `${UN}; ${MB}; Bundeswehr 2024 personnel figures (20,300 new recruits)` },
  japan: { pop: 124e6, cohort: 9.0e6, cohortYears: 8, milAge: 45e6, elig: 0.6, active: 247150, reserve: 55900, accessions: 9960, conscription: false,
    status_source: `${UN}; ${MB}; MOD FY2023 recruitment (9,959 of 19,598 target)` },
  norway: { pop: 5.5e6, cohort: 0.53e6, cohortYears: 8, milAge: 2.3e6, elig: 0.5, active: 25400, reserve: 40000, accessions: 9000, conscription: true,
    status_source: `${UN}; ${MB}; selective conscription ~9,000 a year` },
  brazil: { pop: 216e6, cohort: 26e6, cohortYears: 8, milAge: 105e6, elig: 0.4, active: 366500, reserve: 1340000, accessions: 85000, conscription: true,
    status_source: `${UN}; ${MB}; annual conscript intake ~85k, estimate` },
  cuba: { pop: 11e6, cohort: 0.95e6, cohortYears: 8, milAge: 4.6e6, elig: 0.5, active: 49000, reserve: 39000, accessions: 15000, conscription: true,
    status_source: `${UN}; ${MB}; two-year conscription, intake estimate` },
};
// The hard population bound: active + reserve never exceed the eligible military-age population.
export const manpowerCap = (nid) => { const m = MANPOWER[nid]; return m ? Math.floor(m.milAge * m.elig) : 0; };

// ── Owner-set parameters where real plans are contested (spec Part 9).
export const OWNER_PARAMS = {
  b21: { plannedBuy: 200, programOfRecord: 100, status_source: 'owner ruling on #55 (2026-10-10): planned buy 200+; USAF program of record >= 100' },
  faxx: { status: 'active', ioc: 2035, status_source: 'owner ruling on #55 (2026-10-10): F/A-XX active; IOC target mid-2030s, owner to verify' },
};

// ── Platforms per game unit, and the role the unit fields. Procurement adds `per` platforms to the nation's line that `buys` the unit.
// Sizes are real unit sizes: a fighter squadron (24 PAA), a bomb squadron (~12), a missile squadron (50), one hull per ship.
export const UNIT_PLATFORMS = {
  fighter_wing: { per: 24, role: 'fighter' }, strategic_bombers: { per: 12, role: 'bomber' }, drone_swarm: { per: 24, role: 'drone' },
  rq170: { per: 10, role: 'isr' }, rq180: { per: 6, role: 'isr' }, fa_xx: { per: 24, role: 'fighter' }, mq25: { per: 12, role: 'tanker' },
  carrier_group: { per: 1, role: 'carrier' }, sub_fleet: { per: 2, role: 'ssn' }, ssbn_fleet: { per: 2, role: 'ssbn' }, frigate: { per: 1, role: 'frigate' },
  frigate_sqn: { per: 4, role: 'frigate' }, zumwalt: { per: 1, role: 'destroyer' }, mech_division: { per: 3, role: 'armor' }, icbm_force: { per: 50, role: 'icbm' },
  f35: { per: 24, role: 'fighter' }, j20: { per: 24, role: 'fighter' }, j35: { per: 24, role: 'fighter' }, su57: { per: 12, role: 'fighter' },
  gripen: { per: 12, role: 'fighter' }, x_gen5: { per: 24, role: 'fighter' }, f47: { per: 24, role: 'fighter' }, j36: { per: 12, role: 'fighter' },
  j50: { per: 12, role: 'fighter' }, gcap: { per: 24, role: 'fighter' }, fcas: { per: 24, role: 'fighter' }, x_gen6: { per: 24, role: 'fighter' },
  b21: { per: 20, role: 'bomber' }, h20: { per: 10, role: 'bomber' }, pakda: { per: 10, role: 'bomber' }, x_bomber: { per: 10, role: 'bomber' },
  cca: { per: 24, role: 'drone' }, gj11: { per: 24, role: 'drone' }, s70: { per: 12, role: 'drone' }, gcap_cca: { per: 24, role: 'drone' }, x_cca: { per: 24, role: 'drone' },
  sr72: { per: 6, role: 'isr' }, wz8: { per: 6, role: 'isr' }, x_isr: { per: 6, role: 'isr' },
  ssnx: { per: 2, role: 'ssn' }, t095: { per: 2, role: 'ssn' }, husky: { per: 2, role: 'ssgn' }, x_ssn: { per: 2, role: 'ssn' },
  ford: { per: 1, role: 'carrier' }, fujian: { per: 1, role: 'carrier' }, x_carrier: { per: 1, role: 'carrier' },
};
