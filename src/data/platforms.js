// Force Structure — research unlocks designs; PLATFORMS convert R&D into actual military power.
// Each platform: req (research gates), cost (build), maint (per month), mil (power contribution).
// Effectiveness scales +7% per research level ABOVE requirement (cap ×2) — learnings feed systems.
export const PLATFORMS={
  fighter_wing:    {n:'Fighter Wing',          i:'✈️',req:{aircraft:2,propulsion:2},          cost:400, maint:6,  mil:4,deployable:true,dOrder:3},
  missile_brigade: {n:'Missile Brigade',       i:'🚀',req:{missiles:2,munitions:2},           cost:600, maint:8,  mil:6},
  carrier_group:   {n:'Carrier Strike Group',  i:'🛳️',req:{naval:3,aircraft:3},              cost:1500,maint:22, mil:12,deployable:true,dOrder:1},
  sub_fleet:       {n:'Attack Submarine Fleet',i:'🌊',req:{naval:4,propulsion:3},             cost:1200,maint:16, mil:10,deployable:true,dOrder:2},
  satellite_net:   {n:'Reconnaissance Constellation',i:'🛰️',req:{space:3,computers:3},        cost:900, maint:10, mil:7},
  cyber_command:   {n:'Cyber Command',         i:'⚡',req:{cyber:3},                          cost:500, maint:7,  mil:5},
  drone_swarm:     {n:'Autonomous Drone Swarm',i:'🛸',req:{aircraft:5,computers:4},           cost:1800,maint:20, mil:14,deployable:true,dOrder:4},
  rq170:           {n:'RQ-170 Sentinel Wing',  i:'🦇',req:{aircraft:3,computers:3},           cost:500, maint:5,  mil:2, isr:2, dev:{cost:400,mo:8},  d:'Stealth ISR drone. +2 ISR per wing; the quiet eye over denied airspace.'},
  rq180:           {n:'RQ-180 Penetrating ISR',i:'🌑',req:{aircraft:5,computers:5,materials:4},cost:1400,maint:12, mil:4, isr:4, dev:{cost:1200,mo:16},d:'High-altitude stealth ISR. +4 ISR per wing; sees what satellites cannot.'},
  fa_xx:           {n:'F/A-XX Naval Fighter',  i:'🛩️',req:{aircraft:6,naval:5,propulsion:5}, cost:2200,maint:24, mil:9, dev:{cost:2500,mo:24},d:'6th-gen carrier fighter. Deployable; +2 kinetic damage per wing in-region.',deployable:true,dOrder:5},
  mq25:            {n:'MQ-25 Stingray Tankers',i:'⛽',req:{aircraft:4,naval:4},               cost:700, maint:7,  mil:2, dev:{cost:500,mo:10}, d:'Carrier-based refueling UAV. Deployable; extends carrier air wing reach (+weight, +kinetic).',deployable:true,dOrder:6},
  frigate:         {n:'Constellation Frigate', i:'🚢',req:{naval:3,missiles:2},               cost:600, maint:7,  mil:3, dev:{cost:350,mo:8},  d:'Escort workhorse. Deployable naval weight 0.5; cheap presence for escort/FON postures.',deployable:true,dOrder:7},
  zumwalt:         {n:'Zumwalt Destroyer',     i:'⚔️',req:{naval:5,missiles:4,computers:4},  cost:1600,maint:18, mil:7, dev:{cost:1500,mo:18},d:'Stealth strike destroyer. Deployable naval weight 1.2; +3 kinetic damage per hull in-region.',deployable:true,dOrder:8},
  hypersonic_bty:  {n:'Hypersonic Battery',    i:'☄️',req:{missiles:5,propulsion:4},          cost:2500,maint:28, mil:18},
  mech_division:   {n:'Mechanized Division',   i:'🪖',req:{},                                  cost:220, maint:4,  mil:3},
  frigate_sqn:     {n:'Frigate Squadron',      i:'⛵',req:{naval:1},                           cost:350, maint:6,  mil:4},
  ssbn_fleet:      {n:'SSBN Ballistic Sub Fleet',i:'☢️',req:{naval:5,missiles:4},              cost:3500,maint:40, mil:20,triad:true},
  strategic_bombers:{n:'Strategic Bomber Wing',i:'☢️',req:{aircraft:4,munitions:3},            cost:2800,maint:32, mil:16,triad:true},
  icbm_force:      {n:'ICBM Silo Force',       i:'☢️',req:{missiles:5,munitions:4},            cost:3000,maint:30, mil:18,triad:true},
};
// Black Programs — classified next-gen platforms. Require a Special Access Program office + deep R&D.
// Bleeding-edge capability AND the highest-value espionage targets (rivals will try to steal them).
export const BLACK_PROGRAMS={
  b21:  {n:'B-21 Raider',i:'🛩️',cost:8000, mo:30,req:{aircraft:5,munitions:4,materials:4},mil:22,cap:6,
    d:'Stealth strategic bomber. +22 military, strengthens nuclear deterrent.',bonus:'deterrent',exportable:false,deployable:true,dOrder:9,slot:'bomber'},
  f47:  {n:'F-47 (NGAD)',i:'✈️',cost:11000,mo:36,req:{aircraft:6,propulsion:5,computers:5},mil:26,cap:8,
    d:'6th-gen air dominance fighter. +26 military, commands CCA drone formations.',bonus:'air',exportable:false,deployable:true,dOrder:10,slot:'gen6'},
  cca:  {n:'CCA Drone Wings',i:'🛸',cost:6000,mo:24,req:{aircraft:5,computers:5,cyber:4},mil:18,cap:12,
    d:'Collaborative Combat Aircraft. +18 military, force-multiplies all air platforms.',bonus:'multiplier',exportable:true,attachesTo:'f47',slot:'cca'},
  sr72: {n:'SR-72 Darkstar',i:'🚀',cost:9000,mo:30,req:{propulsion:6,materials:5,space:4},mil:14,cap:3,
    d:'Hypersonic ISR/strike. +14 military, +6 ISR (deep reconnaissance).',bonus:'isr',isr:6,exportable:false,deployable:true,dOrder:11,slot:'isr'},
  ssnx: {n:'SSN(X) Attack Sub',i:'🌑',cost:10000,mo:34,req:{naval:6,propulsion:5,materials:4},mil:24,cap:8,
    d:'Next-gen nuclear attack submarine. +24 military, undetectable sea control.',bonus:'naval',exportable:true,deployable:true,dOrder:12,slot:'ssn'},
  // E3 (#15): nation programs. Same role slots, different platforms. `req:{}` + `kv` = a line already in service (kv: the vertical a theft hits).
  // `risk`: chance a prototype slips 12 months at first flight; funding the parallel program halves it.
  f35:   {n:'F-35 Lightning II',i:'✈️',cost:4000,mo:24,req:{},kv:'aircraft',mil:12,cap:12,d:'5th-gen multirole. In service: production open from day one.',bonus:'air',exportable:true,deployable:true,dOrder:13,slot:'gen5'},
  j20:   {n:'J-20 Mighty Dragon',i:'✈️',cost:3500,mo:24,req:{},kv:'aircraft',mil:11,cap:12,d:'5th-gen air superiority fighter. In service; GJ-11 wingmen attach to it.',bonus:'air',exportable:false,deployable:true,dOrder:14,slot:'gen5'},
  j35:   {n:'J-35',i:'🛩️',cost:3200,mo:24,req:{},kv:'aircraft',mil:10,cap:12,d:'5th-gen medium stealth fighter, land and carrier variants. Early production.',bonus:'air',exportable:true,deployable:true,dOrder:15,slot:'gen5'},
  su57:  {n:'Su-57 Felon',i:'✈️',cost:3800,mo:24,req:{},kv:'aircraft',mil:10,cap:8,d:'5th-gen fighter at low rate. S-70 Okhotnik attaches to it.',bonus:'air',exportable:true,deployable:true,dOrder:16,slot:'gen5'},
  gripen:{n:'Gripen E',i:'🛩️',cost:2000,mo:18,req:{},kv:'aircraft',mil:6,cap:10,d:'Gen 4.5 multirole, Swedish design built under licence in Brazil.',bonus:'air',exportable:true,deployable:true,dOrder:17,slot:'gen5'},
  x_gen5:{n:'Indigenous 5th-gen fighter',i:'🛠️',cost:9000,mo:36,req:{aircraft:4,propulsion:4,computers:4},mil:12,cap:8,d:'Your own stealth fighter from a blank sheet. Slow and costly; no foreign veto.',bonus:'air',exportable:true,deployable:true,dOrder:18,slot:'gen5'},
  j36:   {n:'J-36',i:'🦅',cost:10000,mo:36,req:{aircraft:3,propulsion:3,computers:3},mil:24,cap:8,risk:0.3,parallel:'j50',d:'Tailless tri-engine 6th-gen heavy fighter. Prototype flying.',bonus:'air',exportable:false,deployable:true,dOrder:19,slot:'gen6'},
  j50:   {n:'J-50',i:'🦅',cost:8000,mo:30,req:{aircraft:3,propulsion:2,computers:3},mil:20,cap:8,risk:0.3,parallel:'j36',d:'Tailless twin-engine 6th-gen fighter. Prototype flying.',bonus:'air',exportable:false,deployable:true,dOrder:20,slot:'gen6'},
  gcap:  {n:'GCAP Tempest',i:'🦅',cost:12000,mo:48,req:{aircraft:4,propulsion:4,computers:4},mil:24,cap:8,d:'UK-Italy-Japan 6th-gen fighter, service target ~2035.',bonus:'air',exportable:false,deployable:true,dOrder:21,slot:'gen6'},
  fcas:  {n:'FCAS / SCAF',i:'🦅',cost:12000,mo:48,req:{aircraft:4,propulsion:4,computers:4},mil:24,cap:8,d:'France-Germany-Spain next-generation air combat system.',bonus:'air',exportable:false,deployable:true,dOrder:22,slot:'gen6'},
  x_gen6:{n:'Indigenous 6th-gen fighter',i:'🛠️',cost:16000,mo:54,req:{aircraft:6,propulsion:5,computers:5},mil:24,cap:6,d:'A sovereign 6th-gen program. Enormous cost, total control.',bonus:'air',exportable:false,deployable:true,dOrder:23,slot:'gen6'},
  h20:   {n:'H-20',i:'🛩️',cost:9000,mo:36,req:{aircraft:4,munitions:3,materials:3},mil:20,cap:6,d:'Stealth strategic bomber. Adds the air leg of the nuclear triad.',bonus:'deterrent',exportable:false,deployable:true,dOrder:24,slot:'bomber'},
  pakda: {n:'PAK DA',i:'🛩️',cost:8500,mo:40,req:{aircraft:4,munitions:3,materials:3},mil:18,cap:6,d:'Subsonic flying-wing strategic bomber. Adds the air leg of the nuclear triad.',bonus:'deterrent',exportable:false,deployable:true,dOrder:25,slot:'bomber'},
  x_bomber:{n:'Indigenous stealth bomber',i:'🛠️',cost:12000,mo:48,req:{aircraft:5,munitions:4,materials:4},mil:20,cap:4,d:'A sovereign penetrating bomber. Adds the air leg of the nuclear triad.',bonus:'deterrent',exportable:false,deployable:true,dOrder:26,slot:'bomber'},
  gj11:  {n:'GJ-11 Sharp Sword',i:'🛸',cost:4500,mo:24,req:{aircraft:3,computers:3},mil:14,cap:12,d:'Stealth UCAV. Attaches to J-20 wings as loyal wingmen.',bonus:'multiplier',exportable:true,attachesTo:'j20',slot:'cca'},
  s70:   {n:'S-70 Okhotnik',i:'🛸',cost:4000,mo:24,req:{aircraft:3,computers:2},mil:12,cap:10,d:'Heavy stealth UCAV. Attaches to Su-57 wings.',bonus:'multiplier',exportable:true,attachesTo:'su57',slot:'cca'},
  gcap_cca:{n:'GCAP adjunct drones',i:'🛸',cost:5000,mo:30,req:{aircraft:4,computers:4,cyber:3},mil:14,cap:12,d:'Uncrewed adjuncts flying with GCAP. Attach to GCAP wings.',bonus:'multiplier',exportable:true,attachesTo:'gcap',slot:'cca'},
  x_cca: {n:'Indigenous combat drones',i:'🛠️',cost:7000,mo:30,req:{aircraft:5,computers:5,cyber:4},mil:14,cap:10,d:'Sovereign collaborative combat aircraft. Air force multiplier.',bonus:'multiplier',exportable:true,slot:'cca'},
  wz8:   {n:'WZ-8',i:'🚀',cost:3000,mo:18,req:{},kv:'propulsion',mil:6,cap:4,isr:4,d:'Rocket-powered hypersonic reconnaissance drone, air-launched. +4 ISR.',bonus:'isr',exportable:false,deployable:true,dOrder:27,slot:'isr'},
  x_isr: {n:'Indigenous hypersonic ISR',i:'🛠️',cost:10000,mo:36,req:{propulsion:6,materials:5,space:4},mil:12,cap:3,isr:6,d:'Sovereign hypersonic reconnaissance. +6 ISR.',bonus:'isr',exportable:false,deployable:true,dOrder:28,slot:'isr'},
  t095:  {n:'Type 095 SSN',i:'🌑',cost:8000,mo:36,req:{naval:3,propulsion:3,materials:2},mil:18,cap:8,d:'Next-gen quieter nuclear attack submarine.',bonus:'naval',exportable:false,deployable:true,dOrder:29,slot:'ssn'},
  husky: {n:'Husky SSN',i:'🌑',cost:9000,mo:42,req:{naval:4,propulsion:3,materials:3},mil:18,cap:6,d:'Fifth-generation nuclear attack submarine.',bonus:'naval',exportable:false,deployable:true,dOrder:30,slot:'ssn'},
  x_ssn: {n:'Indigenous next-gen SSN',i:'🛠️',cost:12000,mo:48,req:{naval:6,propulsion:5,materials:4},mil:20,cap:6,d:'Sovereign nuclear attack submarine.',bonus:'naval',exportable:false,deployable:true,dOrder:31,slot:'ssn'},
  ford:  {n:'Ford-class carrier',i:'🛳️',cost:13000,mo:48,req:{},kv:'naval',mil:14,cap:4,d:'Supercarrier with EMALS. In service; hulls in build.',bonus:'naval',exportable:false,deployable:true,dOrder:32,slot:'carrier'},
  fujian:{n:'Fujian (Type 003)',i:'🛳️',cost:9000,mo:36,req:{naval:2,aircraft:1},mil:12,cap:4,d:'First catapult carrier. Sea trials.',bonus:'naval',exportable:false,deployable:true,dOrder:33,slot:'carrier'},
  x_carrier:{n:'Indigenous carrier',i:'🛠️',cost:15000,mo:60,req:{naval:5,aircraft:4,materials:4},mil:12,cap:3,d:'A sovereign fleet carrier program.',bonus:'naval',exportable:false,deployable:true,dOrder:34,slot:'carrier'},
};
// The deployable set is data (`deployable:true`), never a literal list (E1, #13). Display order is `dOrder` (v57 order, F-47 after the B-21).
// CCA wings are not deployable: they attach to F-47 wings as a weight multiplier (see ccaMult in formulas.js).
export const DEPLOYABLE=[...Object.keys(PLATFORMS),...Object.keys(BLACK_PROGRAMS)].filter(k=>(PLATFORMS[k]||BLACK_PROGRAMS[k]).deployable).sort((a,b)=>(PLATFORMS[a]||BLACK_PROGRAMS[a]).dOrder-(PLATFORMS[b]||BLACK_PROGRAMS[b]).dOrder);
// Deployment weight per unit (default 1).
export const DEP_W={b21:2,ssnx:2,sr72:0.6,frigate:0.5,zumwalt:1.2,mq25:0.8,fa_xx:1,h20:2,pakda:2,x_bomber:2,t095:2,husky:2,x_ssn:2,wz8:0.6,x_isr:0.6,ford:1.5,fujian:1.3,x_carrier:1.2};
// Naval weight of E3 hulls (the v57 hulls keep their literal terms in navalWeight).
export const NAV_W={t095:2,husky:2,x_ssn:2,ford:1.5,fujian:1.3,x_carrier:1.2};

// ── E3 (#15) nation catalogs. Role slots in display order: the v57 SAP order first (bomber, gen6, CCA, ISR, SSN), new slots after.
export const SLOTS=[['bomber','Stealth bomber'],['gen6','Gen 6 fighter'],['cca','CCA / UCAV'],['isr','Hypersonic ISR'],['ssn','Next-gen SSN'],['gen5','Gen 5 fighter'],['carrier','Carrier']];
// Program stages. `start` in a catalog is the real 2024 stage; lrip/full = production open at start, no SAP office needed.
export const STAGES=[['rd','R&D'],['proto','Prototype'],['lrip','LRIP'],['full','Full rate']];
// status_source: where the 2024 stage comes from. "general knowledge" entries are for the owner to correct (spec Part 2).
// USA: the five v57 programs keep v57 behavior (start R&D) by owner rule "US unchanged except E1"; their real 2024 stage is in status_source.
const GK='general knowledge, owner to verify';
export const CATALOGS={
  usa:[
    {id:'b21',start:'rd',status_source:`${GK}: real 2024 stage LRIP; kept at R&D (v57 behavior, US unchanged)`},
    {id:'f47',start:'rd',status_source:`${GK}: NGAD in development 2024 (F-47 award 2025)`},
    {id:'cca',start:'rd',status_source:`${GK}: Increment 1 prototypes 2024; kept at R&D (v57 behavior)`},
    {id:'sr72',start:'rd',status_source:`${GK}: R&D, unacknowledged`},
    {id:'ssnx',start:'rd',status_source:`${GK}: design phase 2024`},
    {id:'f35',start:'full',status_source:`${GK}: full-rate production declared March 2024`},
    {id:'ford',start:'lrip',status_source:`${GK}: CVN-78 in service, CVN-79..81 building`}],
  china:[
    {id:'h20',start:'rd',status_source:`${GK}: in development, not shown publicly`},
    {id:'j36',start:'proto',status_source:'owner spec Part 2: prototype flying (Dec 2024), funded in parallel with J-50'},
    {id:'j50',start:'proto',status_source:'owner spec Part 2: prototype flying (Dec 2024), funded in parallel with J-36'},
    {id:'gj11',start:'proto',status_source:`${GK}: prototypes and trials`},
    {id:'wz8',start:'lrip',status_source:`${GK}: in service in small numbers (shown 2019)`},
    {id:'t095',start:'rd',status_source:`${GK}: in development / early construction`},
    {id:'j20',start:'full',status_source:`${GK}: serial production since ~2017`},
    {id:'j35',start:'lrip',status_source:`${GK}: J-35A shown Nov 2024, early production`},
    {id:'fujian',start:'proto',status_source:`${GK}: sea trials from May 2024`}],
  russia:[
    {id:'pakda',start:'rd',status_source:`${GK}: in development`},
    {id:'s70',start:'proto',status_source:`${GK}: prototypes flying`},
    {id:'husky',start:'rd',status_source:`${GK}: design phase`},
    {id:'su57',start:'lrip',status_source:`${GK}: in service at low rate`}],
  japan:[
    {id:'gcap',start:'rd',status_source:`${GK}: GCAP development (UK/Italy/Japan), service ~2035`},
    {id:'gcap_cca',start:'rd',status_source:`${GK}: adjunct concept with GCAP`},
    {id:'f35',start:'full',buy:true,status_source:`${GK}: F-35A/B buyer, final assembly in Nagoya`}],
  germany:[
    {id:'fcas',start:'rd',status_source:`${GK}: FCAS phase 1B demonstrator work`},
    {id:'f35',start:'full',buy:true,status_source:`${GK}: 35 F-35A ordered 2022, deliveries from 2026`}],
  norway:[
    {id:'f35',start:'full',buy:true,status_source:`${GK}: F-35A fleet operational 2022`}],
  brazil:[
    {id:'gripen',start:'lrip',status_source:`${GK}: Gripen E deliveries and local assembly ongoing`}],
  cuba:[],
};
// Foreign-built lines (F-35 for buyers) cost this much more per tranche: delivered from the owner's line.
export const BUY_PREMIUM=1.2;
// Indigenous programs fill any slot a nation's catalog leaves empty (spec: "start their own program at R&D").
export const INDIGENOUS={gen5:'x_gen5',gen6:'x_gen6',bomber:'x_bomber',cca:'x_cca',isr:'x_isr',ssn:'x_ssn',carrier:'x_carrier'};
// A nation's full catalog: its own entries plus an R&D indigenous entry for every empty slot, in SLOTS order.
export function nationCatalog(nid){
  const own=CATALOGS[nid]||[];
  return SLOTS.flatMap(([slot])=>{const xs=own.filter(e=>BLACK_PROGRAMS[e.id].slot===slot);return xs.length?xs:[{id:INDIGENOUS[slot],start:'rd',status_source:'game abstraction: indigenous program'}];});
}
// Display order inside the v57 grid: catalog order (keeps the v57 SAP order for the USA).
export const catalogEntry=(nid,id)=>nationCatalog(nid).find(e=>e.id===id)||null;

// Defense verticals
export const DV={
  materials:  {n:'Material Science', i:'🧪',col:'#60a5fa',chain:[],
    lvl:[{n:'Advanced Alloys',$:500,mo:8,mil:5,sp:null},
         {n:'Composite Structures',$:800,mo:10,mil:8,sp:{healthcare:2}},
         {n:'Smart Materials',$:1200,mo:12,mil:12,sp:{healthcare:4},disc:{healthcare:0.15,energy:0.10}},
         {n:'Nanomaterials',$:2000,mo:16,mil:18,sp:{healthcare:6}},
         {n:'Quantum Metamaterials',$:3500,mo:24,mil:30,sp:{healthcare:8,gdpGrowth:0.3}},
         {n:'Adaptive Metamaterials',$:6500,mo:36,mil:46,sp:{healthcare:14,gdpGrowth:0.6,education:6}},
         {n:'Programmable Matter',$:11000,mo:50,mil:62,sp:{healthcare:20,gdpGrowth:1.0,education:12,stability:5}}]},
  computers:  {n:'Computer Systems',i:'💻',col:'#a78bfa',chain:[],
    lvl:[{n:'Microprocessors',$:600,mo:9,mil:4,sp:null},
         {n:'Distributed Systems',$:900,mo:11,mil:7,sp:{education:2}},
         {n:'AI-Assisted Systems',$:1400,mo:13,mil:12,sp:{education:4,gdpGrowth:0.2},disc:{education:0.15}},
         {n:'Neural Architectures',$:2200,mo:17,mil:18,sp:{education:6}},
         {n:'Quantum Supremacy',$:4000,mo:26,mil:28,sp:{education:8,gdpGrowth:0.5}},
         {n:'Neuromorphic AGI',$:7500,mo:40,mil:44,sp:{education:16,gdpGrowth:0.8,inequality:-4}},
         {n:'Sovereign AI Defense Grid',$:13000,mo:54,mil:60,sp:{education:24,gdpGrowth:1.4,inequality:-8,stability:6}}]},
  semiconductors:{n:'Semiconductors',i:'🔬',col:'#22d3ee',chain:['computers','materials'],
    lvl:[{n:'Silicon Fabrication',$:700,mo:9,mil:4,sp:null},
         {n:'Advanced Node 7nm',$:1100,mo:12,mil:8,sp:{gdpGrowth:0.1}},
         {n:'EUV Lithography',$:1800,mo:15,mil:14,sp:{gdpGrowth:0.3},disc:{finance:0.15}},
         {n:'3D-IC Stacking',$:2800,mo:18,mil:20,sp:{gdpGrowth:0.5}},
         {n:'Atomic-Scale Logic',$:4500,mo:28,mil:30,sp:{gdpGrowth:0.8,inequality:-4}},
         {n:'2nm Quantum Nodes',$:9000,mo:42,mil:46,sp:{gdpGrowth:1.3,inequality:-6,education:6}},
         {n:'Photonic Quantum Logic',$:15000,mo:58,mil:58,sp:{gdpGrowth:2.0,inequality:-10,education:10,stability:4}}]},
  munitions:  {n:'Munitions',i:'💣',col:'#f97316',chain:['materials'],
    lvl:[{n:'Precision-Guided',$:500,mo:7,mil:6,sp:null},
         {n:'Smart Munitions',$:800,mo:9,mil:10,sp:{stability:2}},
         {n:'Autonomous Systems',$:1300,mo:12,mil:16,sp:{stability:3}},
         {n:'Hypersonic Glide Body',$:2200,mo:16,mil:24,sp:{stability:5}},
         {n:'Directed Energy',$:3800,mo:22,mil:35,sp:{stability:8,military:10}},
         {n:'Compact Fusion Warheads',$:7000,mo:36,mil:54,sp:{stability:16,military:14}},
         {n:'Kinetic Bombardment Platform',$:12000,mo:48,mil:72,sp:{stability:24,military:22}}]},
  aircraft:   {n:'Aircraft Systems',i:'✈️',col:'#4ade80',chain:['materials','computers'],
    lvl:[{n:'4th Gen Fighter',$:800,mo:10,mil:8,sp:null},
         {n:'Stealth Aircraft',$:1200,mo:13,mil:14,sp:{gdpGrowth:0.2}},
         {n:'5th Gen Multi-Role',$:2000,mo:16,mil:20,sp:{gdpGrowth:0.3},disc:{trade:0.10}},
         {n:'6th Gen Combat',$:3200,mo:20,mil:28,sp:{gdpGrowth:0.4}},
         {n:'Autonomous Swarms',$:5000,mo:28,mil:38,sp:{gdpGrowth:0.6,foodSecurity:2}},
         {n:'SCRAM Hypersonic Platform',$:9500,mo:42,mil:58,sp:{gdpGrowth:1.0,military:8,stability:4}},
         {n:'Trans-Atmospheric Strike',$:16000,mo:56,mil:76,sp:{gdpGrowth:1.5,military:16,stability:10}}]},
  propulsion: {n:'Propulsion',i:'🔥',col:'#fbbf24',chain:['materials'],
    lvl:[{n:'High-Bypass Turbofan',$:600,mo:9,mil:5,sp:null},
         {n:'Variable-Cycle Engine',$:1000,mo:12,mil:9,sp:{inflation:-0.3}},
         {n:'Scramjet Mach 5+',$:1800,mo:15,mil:15,sp:{inflation:-0.6},disc:{energy:0.15}},
         {n:'Rotating Detonation',$:3000,mo:20,mil:22,sp:{inflation:-1.0}},
         {n:'TBCC Hypersonic',$:5500,mo:28,mil:32,sp:{inflation:-1.5,gdpGrowth:0.4}},
         {n:'Nuclear Thermal Drive',$:9000,mo:42,mil:50,sp:{inflation:-2.2,gdpGrowth:0.8}},
         {n:'Inertial Confinement Propulsion',$:15000,mo:56,mil:66,sp:{inflation:-3.5,gdpGrowth:1.4}}]},
  missiles:   {n:'Missile Systems',i:'🚀',col:'#ef4444',chain:['munitions','propulsion'],
    lvl:[{n:'Cruise Missiles',$:700,mo:10,mil:7,sp:null},
         {n:'IRBM Systems',$:1100,mo:12,mil:12,sp:{stability:3}},
         {n:'Hypersonic Cruise',$:1800,mo:15,mil:18,sp:{stability:5}},
         {n:'MARV Hypersonic',$:3000,mo:20,mil:26,sp:{stability:8}},
         {n:'Scramjet Boost-Glide',$:5000,mo:26,mil:36,sp:{stability:12,military:8}},
         {n:'Fractional Orbital Strike',$:9000,mo:40,mil:58,sp:{stability:20,military:14}},
         {n:'Global Precision Strike Grid',$:15000,mo:54,mil:76,sp:{stability:28,military:22}}]},
  space:      {n:'Space Systems',i:'🛸',col:'#8b5cf6',chain:['propulsion','computers'],
    lvl:[{n:'Satellite Comms',$:800,mo:10,mil:5,sp:null},
         {n:'Reconnaissance Sat',$:1200,mo:12,mil:9,sp:{stability:2}},
         {n:'GPS Constellation',$:2000,mo:16,mil:14,sp:{foodSecurity:5,gdpGrowth:0.3}},
         {n:'Space Domain Control',$:3500,mo:22,mil:20,sp:{foodSecurity:8,gdpGrowth:0.5}},
         {n:'Orbital Denial',$:6000,mo:30,mil:28,sp:{foodSecurity:10,stability:8}},
         {n:'Space Superiority Platform',$:11000,mo:46,mil:44,sp:{foodSecurity:18,gdpGrowth:1.0,stability:12}},
         {n:'Cislunar Domain Control',$:18000,mo:60,mil:58,sp:{foodSecurity:26,gdpGrowth:1.6,stability:18,military:8}}]},
  naval:      {n:'Naval Systems',i:'🌊',col:'#06b6d4',chain:['materials','munitions'],
    lvl:[{n:'Blue-Water Capability',$:700,mo:10,mil:7,sp:null},
         {n:'Carrier Strike Group',$:1200,mo:13,mil:12,sp:{treasury:200}},
         {n:'Hypersonic Naval Strike',$:2000,mo:16,mil:18,sp:{treasury:300,gdpGrowth:0.3}},
         {n:'Subsurface Dominance',$:3200,mo:20,mil:25,sp:{treasury:500}},
         {n:'Sea Control Platform',$:5500,mo:28,mil:34,sp:{treasury:800,stability:6}},
         {n:'Autonomous Strike Fleet',$:10000,mo:44,mil:54,sp:{treasury:1500,stability:10,military:5}},
         {n:'Maritime Dominance Platform',$:17000,mo:58,mil:72,sp:{treasury:2400,stability:18,military:12}}]},
  cyber:      {n:'Cyber & EW',i:'⚡',col:'#f59e0b',chain:['computers','semiconductors'],
    lvl:[{n:'Cyber Defense',$:500,mo:8,mil:4,sp:null},
         {n:'Offensive Cyber',$:800,mo:10,mil:8,sp:{stability:3}},
         {n:'Electronic Warfare',$:1400,mo:13,mil:14,sp:{stability:5,debtGdp:-2}},
         {n:'Full-Spectrum EW',$:2400,mo:17,mil:20,sp:{stability:8,gdpGrowth:0.2}},
         {n:'Quantum Crypto EW',$:4000,mo:24,mil:28,sp:{stability:12,gdpGrowth:0.4,debtGdp:-3}},
         {n:'AI-Sovereign Cyber Grid',$:8000,mo:40,mil:46,sp:{stability:20,gdpGrowth:0.8,debtGdp:-5}},
         {n:'Persistent Domain Supremacy',$:14000,mo:54,mil:62,sp:{stability:30,gdpGrowth:1.2,debtGdp:-7,military:6}}]},
};
