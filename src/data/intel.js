// Standing covert programs — CIA-style ongoing funding lines, distinct from one-off ops
export const COVERT_PROGRAMS={
  counter_intel_grid:{n:'Counter-Intelligence Grid',i:'🛡️',cost:30,d:'+25% interception of foreign operations against you'},
  influence_network: {n:'Global Influence Network', i:'📡',cost:40,d:'+0.08 sphere/mo in your two weakest contested regions'},
  asset_recruitment: {n:'Deep Asset Recruitment',   i:'🎭',cost:35,d:'+8% op success, −5% discovery on all operations'},
  disinfo_apparatus: {n:'Disinformation Apparatus',  i:'📰',cost:45,d:'Active measures degrade the leading rival: −0.06 their sphere/mo (slows their race)'},
  economic_espionage:{n:'Economic Espionage Bureau', i:'💼',cost:50,d:'Industrial secrets siphoned: +$70M/mo, slowly advances your strongest R&D vertical'},
  proxy_network:     {n:'Proxy & Front Network',     i:'🕴️',cost:40,d:'Deniable proxies suppress rival sphere growth in every region you contest: −0.05/mo'},
};
// Intelligence infrastructure — agency capital. Built once, compounds forever.
// Grounded in INT disciplines: SIGINT (listening), HUMINT (stations), cryptanalysis,
// covert action (paramilitary), and ISR fusion (F2T2EA: better sensing → better strikes).
export const INTEL_INFRA={
  listening_posts:  {n:'SIGINT Listening Grid',     i:'📻',cost:600, maint:12,max:1,req:{cyber:2},
    d:'Global signals collection. +12% interception, −4% op discovery.'},
  overseas_stations:{n:'Overseas Station Network',  i:'🏛️',cost:400, maint:10,max:5,req:{},
    d:'HUMINT presence abroad. +3% op success each (stack ×5). 3+ unlocks HUMINT Penetration.'},
  crypt_center:     {n:'Cryptanalysis Center',      i:'🔐',cost:800, maint:15,max:1,req:{computers:3},
    d:'Codebreaking at scale. +10% interception, Economic Warfare effects +50%.'},
  paramilitary:     {n:'Special Activities Wing',   i:'🗡️',cost:700, maint:14,max:1,req:{munitions:2},
    d:'Covert paramilitary capability. Unlocks Sabotage. Destabilization effects +50%.'},
  isr_fusion:       {n:'ISR Fusion Cell',           i:'🎯',cost:900, maint:16,max:1,req:{space:2,computers:2},
    d:'All-source targeting fusion. +4 ISR, kinetic strikes hit harder, +3mo flashpoint warning.'},
};
// Intel operations
export const INTEL_OPS=[
  {id:'tech_acq',   n:'Technology Acquisition', i:'💾',cost:600, mo:4,
   desc:'Extract defense research. Success → 40% cost reduction on stolen vertical.',
   baseSuccess:0.7, baseDiscover:0.2, type:'covert'},
  {id:'destab',     n:'Destabilization',        i:'💣',cost:800, mo:6,
   desc:'Covert ops to undermine target stability. Plausible deniability maintained.',
   statEffect:{stability:-15}, baseSuccess:0.65, baseDiscover:0.25, type:'covert'},
  {id:'econ_war',   n:'Economic Warfare',       i:'💸',cost:1000,mo:8,
   desc:'Financial destabilization: currency pressure, market manipulation.',
   statEffect:{inflation:4,treasury:-400}, baseSuccess:0.6, baseDiscover:0.3, type:'covert'},
  {id:'influence', n:'Covert Influence Campaign',i:'🗳️',cost:500, mo:5,
   desc:'Media placement, civil society funding, electoral influence in the target\'s region.',
   baseSuccess:0.7, baseDiscover:0.22, type:'covert'},
  {id:'sabotage',  n:'Covert Sabotage',          i:'💥',cost:900, mo:5,
   desc:'Special activities strike on research and industrial targets. Sets back their strongest program. Requires Special Activities Wing.',
   baseSuccess:0.6, baseDiscover:0.32, type:'covert'},
  {id:'mole',      n:'HUMINT Penetration',       i:'🪤',cost:1200,mo:8,
   desc:'Recruit a placed asset inside their services. 24mo: their pushback halved, their R&D frozen. Requires 3+ Overseas Stations.',
   baseSuccess:0.5, baseDiscover:0.25, type:'covert'},
  {id:'counter_int',n:'Counter-Intelligence',   i:'🛡️',cost:400, mo:24,
   desc:'Reduce foreign intel effectiveness against you by 30%.',
   statEffect:{}, baseSuccess:1.0, baseDiscover:0, type:'defensive'},
];

// Intel crisis response options
export const CRISIS_FRIENDLY=[
  {id:'deny',     label:'Deny Everything',
   tags:['Short: -5 stability','Long: deal terms -10% for 12 months'],
   effect:{stability:-5}, longEffect:{gdpGrowth:-0.08}, longMo:12},
  {id:'admit',    label:'Partial Admission + Apology',
   tags:['Short: -$300M, relationship -5','Long: normalizes in 6 months'],
   effect:{treasury:-300}},
  {id:'tech_trade',label:'Offer Technology Trade',
   tags:['Sacrifice 1 defense research level','Long: relationship +10, terms restored'],
   effect:{military:-5}},
  {id:'pressure', label:'Pressure Allies — Decouple Them',
   tags:['Short: +5 stability, assert dominance','Long: 2 nations shift sphere away'],
   effect:{stability:5}, sphereEffect:{delta:-15, regions:2}},
];
export const CRISIS_HOSTILE=[
  {id:'counter_accuse',label:'Deny + Counter-Accuse',
   tags:['Tension +20, opens counter-op window'],effect:{stability:-8}},
  {id:'economic_strike',label:'Economic Counter-Strike',
   tags:['Cancel their deals, treasury +400'],effect:{treasury:400,stability:-10}},
  {id:'backchannel',   label:'Back-Channel Settlement',
   tags:['Pay $800M, neutralizes crisis'],effect:{treasury:-800}},
];
export const CRISIS_STOLEN=[
  {id:'denounce',  label:'Public Denunciation',
   tags:['Their stability -10','Your reputation +5','Their allies rally'],effect:{stability:5}},
  {id:'retaliate', label:'Covert Retaliation',
   tags:['Immediate counter-op','Escalation risk'],effect:{}},
  {id:'demand_comp',label:'Demand Compensation via Allies',
   tags:['They pay $600M OR allies isolate them'],effect:{treasury:600}},
  {id:'absorb',    label:'Absorb + Invest Quietly',
   tags:['No diplomatic cost','+15% effectiveness on next 2 ops'],effect:{}},
];

// Response doctrine labels for foreign operations caught against you (Intel tab).
export const INTEL_POSTURE_LABELS={quiet:'🕳️ Quiet',expose:'🗞️ Expose',expel:'✈️ Expel'};
