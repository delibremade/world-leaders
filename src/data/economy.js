import { SC, ss } from './stats.js';

// Social Programs — direct levers on population quality of life. Each costs monthly, shapes vitals.
export const SOCIAL_PROGRAMS={
  universal_healthcare:{n:'Universal Healthcare',i:'🏥',cost:45,fx:{healthcare:0.25,inequality:-0.04},d:'Coverage for all citizens'},
  pension_system:      {n:'National Pension System',i:'👴',cost:35,fx:{stability:0.06,inequality:-0.05,debtGdp:0.02},d:'Old-age income security'},
  food_assistance:     {n:'Food Assistance Program',i:'🍞',cost:20,fx:{foodSecurity:0.2,inequality:-0.03},d:'Nutrition support for bottom 40%'},
  unemployment_benefits:{n:'Unemployment Insurance',i:'💼',cost:25,fx:{stability:0.05,inequality:-0.04,unemployment:0.01},d:'Income bridge between jobs'},
  public_education:    {n:'Public Education Expansion',i:'📚',cost:30,fx:{education:0.2,inequality:-0.03},d:'Free K-12 + subsidized university'},
  family_support:      {n:'Childcare & Family Support',i:'👨‍👩‍👧',cost:25,fx:{stability:0.04,gdpGrowth:0.01},d:'Childcare subsidies, parental leave'},
};

// Policy actions — tx: ongoing monthly effects [{stat,d,mo}]
// blocks: action ids that cannot run simultaneously
// Cost guard: cost>0 required to block; cost<=0 passes free
export const PA=[
  {id:'e1',t:'economy',n:'Sovereign Bond Issuance',i:'📜',d:'Issue bonds to raise capital.',cost:-1500,fx:{debtGdp:5,stability:-2},cd:12,blocks:[]},
  {id:'e2',t:'economy',n:'Debt Buyback',i:'🔄',d:'Retire outstanding bonds, reducing obligations.',cost:800,fx:{debtGdp:-6,stability:3},cd:8,blocks:[]},
  {id:'e3',t:'economy',n:'IMF Emergency Program',i:'🏦',d:'IMF standby with austerity conditions.',cost:-2000,fx:{debtGdp:-8,stability:-10,healthcare:-5},cd:24,blocks:['e4','e5']},
  {id:'e4',t:'economy',n:'Quantitative Easing',i:'💵',d:'Expand money supply to stimulate.',cost:0,fx:{},tx:[{stat:'inflation',d:0.18,mo:6},{stat:'gdpGrowth',d:0.08,mo:8},{stat:'treasury',d:150,mo:6}],cd:10,blocks:['e5','e3']},
  {id:'e5',t:'economy',n:'Fiscal Austerity',i:'✂️',d:'Enforce spending cuts to stabilize finances.',cost:0,fx:{},tx:[{stat:'debtGdp',d:-0.12,mo:12},{stat:'stability',d:-0.08,mo:12},{stat:'healthcare',d:-0.06,mo:10}],cd:12,blocks:['e4','e3']},
  {id:'e6',t:'economy',n:'Currency Defense Op',i:'💱',d:'Deploy reserves to defend exchange rate.',cost:800,fx:{inflation:-1.5,stability:4},cd:6,blocks:[]},
  {id:'e7',t:'economy',n:'Progressive Tax Reform',i:'📈',d:'Raise top-rate taxes, fund services.',cost:0,fx:{},tx:[{stat:'gdpGrowth',d:-0.015,mo:24},{stat:'inequality',d:-0.06,mo:24},{stat:'treasury',d:250,mo:24}],cd:18,blocks:['e8']},
  {id:'e8',t:'economy',n:'Supply-Side Tax Reform',i:'📉',d:'Cut corporate taxes, attract investment.',cost:0,fx:{},tx:[{stat:'gdpGrowth',d:0.025,mo:24},{stat:'inequality',d:0.06,mo:24},{stat:'treasury',d:-350,mo:24}],cd:18,blocks:['e7']},
  {id:'en1',t:'energy',n:'LNG Export Contract',i:'🚢',d:'Long-term LNG export agreement.',cost:0,fx:{},tx:[{stat:'treasury',d:35,mo:12},{stat:'gdpGrowth',d:0.025,mo:12}],cd:8,blocks:[]},
  {id:'en2',t:'energy',n:'Oil Production Boost',i:'🛢️',d:'Increase extraction quota.',cost:0,fx:{},tx:[{stat:'treasury',d:50,mo:4},{stat:'inflation',d:0.04,mo:4}],cd:4,blocks:[]},
  {id:'en3',t:'energy',n:'Nuclear Agreement',i:'⚛️',d:'Commission nuclear baseload capacity.',cost:1800,fx:{},tx:[{stat:'inflation',d:-0.1,mo:24},{stat:'stability',d:0.04,mo:24}],cd:24,blocks:[]},
  {id:'en4',t:'energy',n:'Renewable JV',i:'🌱',d:'Joint venture for solar and wind buildout.',cost:1000,fx:{},tx:[{stat:'inflation',d:-0.05,mo:18},{stat:'gdpGrowth',d:0.04,mo:18}],cd:14,blocks:[]},
  {id:'en5',t:'energy',n:'Strategic Reserve Release',i:'⛽',d:'Release reserves to cap price spikes.',cost:200,fx:{inflation:-1.5,stability:3},cd:10,blocks:[]},
  {id:'en6',t:'energy',n:'Import Diversification',i:'🔀',d:'Secure alternative supply routes.',cost:500,fx:{},tx:[{stat:'inflation',d:-0.04,mo:8},{stat:'stability',d:0.04,mo:8}],cd:8,blocks:[]},
  {id:'t1',t:'technology',stage:2,oneTime:true,n:'AI Development Partnership',i:'🤖',d:'Drives education +1.2/mo, GDP +0.1/mo. Cascades into lower unemployment and inequality.',cost:600,fx:{},tx:[{stat:'education',d:1.2,mo:18},{stat:'gdpGrowth',d:0.1,mo:24}],cd:12,blocks:[]},
  {id:'t2',t:'technology',stage:1,oneTime:true,n:'National 5G Rollout',i:'📡',d:'GDP +0.15/mo for 2 years. Enables AI, logistics, and industrial automation gains.',cost:1200,fx:{},tx:[{stat:'gdpGrowth',d:0.15,mo:24},{stat:'education',d:0.2,mo:12},{stat:'unemployment',d:-0.08,mo:18}],cd:18,blocks:[]},
  {id:'t3',t:'technology',stage:1,oneTime:true,n:'Space Collaboration',i:'🚀',d:'National prestige boosts stability +0.3/mo. Drives advanced STEM education gains.',cost:500,fx:{},tx:[{stat:'education',d:0.8,mo:14},{stat:'stability',d:0.3,mo:10},{stat:'military',d:0.12,mo:12}],cd:14,blocks:[]},
  {id:'t4',t:'technology',stage:1,n:'National R&D Fund',i:'🔭',d:'Broad-spectrum investment. Education +0.9/mo, GDP +0.07/mo. Foundation for all sector upgrades.',cost:700,fx:{},tx:[{stat:'education',d:0.9,mo:18},{stat:'gdpGrowth',d:0.07,mo:18},{stat:'inequality',d:-0.04,mo:18}],cd:10,blocks:[]},
  {id:'t5',t:'technology',stage:2,oneTime:true,n:'Biotech Initiative',i:'🧬',d:'Healthcare +1.5/mo feeds stability. GDP gains from pharma exports. Reduces inequality via health equity.',cost:900,fx:{},tx:[{stat:'healthcare',d:1.5,mo:12},{stat:'education',d:0.6,mo:18},{stat:'gdpGrowth',d:0.09,mo:16},{stat:'inequality',d:-0.06,mo:14}],cd:16,blocks:[]},
  {id:'t6',t:'technology',stage:3,oneTime:true,n:'Quantum Computing Initiative',i:'⚛️',d:'Post-silicon leap. Cryptography, materials, and finance advantages compound.',cost:1600,fx:{},tx:[{stat:'education',d:1.5,mo:18},{stat:'gdpGrowth',d:0.12,mo:24}],cd:1,blocks:[]},
  {id:'t7',t:'technology',stage:3,oneTime:true,n:'Autonomous Industrial Base',i:'🏭',d:'Dark factories. Massive output — and a labor reckoning you must manage.',cost:2000,fx:{},tx:[{stat:'gdpGrowth',d:0.28,mo:24},{stat:'unemployment',d:0.15,mo:18},{stat:'inequality',d:0.2,mo:18}],cd:1,blocks:[]},
  {id:'t8',t:'technology',stage:3,oneTime:true,n:'Orbital Manufacturing',i:'🛰️',d:'Zero-g fabrication for exotic alloys and pharma. Prestige and hard capability.',cost:1800,fx:{},tx:[{stat:'military',d:0.2,mo:18},{stat:'gdpGrowth',d:0.14,mo:20},{stat:'education',d:0.5,mo:14}],cd:1,blocks:[]},
  {id:'t9',t:'technology',stage:4,oneTime:true,n:'National AGI Deployment',i:'🧠',d:'General intelligence across government and industry. Transformative — and destabilizing without a strong social floor.',cost:3500,fx:{},tx:[{stat:'gdpGrowth',d:0.5,mo:24},{stat:'education',d:1.0,mo:24},{stat:'inequality',d:0.35,mo:20},{stat:'stability',d:-0.1,mo:12}],cd:1,blocks:[]},
  {id:'t10',t:'technology',stage:4,oneTime:true,n:'Fusion Grid Rollout',i:'☀️',d:'Commercial fusion at scale. Energy ceases to be a constraint.',cost:3000,fx:{},tx:[{stat:'inflation',d:-0.15,mo:24},{stat:'gdpGrowth',d:0.2,mo:24},{stat:'stability',d:0.15,mo:18}],cd:1,blocks:[]},
  {id:'nt_usa',t:'technology',stage:1,oneTime:true,cond:st=>st.c==='usa',why:'National trait — talent magnet',n:'Silicon Valley Compact',i:'🌉',d:'Federal-frontier alignment: visas, compute, and defense-adjacent venture capital.',cost:900,fx:{},tx:[{stat:'education',d:1.0,mo:18},{stat:'gdpGrowth',d:0.12,mo:20}],cd:1,blocks:[]},
  {id:'nt_cuba',t:'technology',stage:1,oneTime:true,cond:st=>st.c==='cuba',why:'National trait — biotech corps',n:'Medical Brigades Expansion',i:'🩺',d:'Scale the export of physicians and biotech advisors — hard currency for human capital.',cost:300,fx:{},tx:[{stat:'treasury',d:45,mo:18},{stat:'healthcare',d:0.8,mo:12}],cd:1,blocks:[]},
  {id:'nt_china',t:'technology',stage:2,oneTime:true,cond:st=>st.c==='china',why:'National trait — rare-earth dominance',n:'Rare-Earth Refining Complex',i:'🧲',d:'Move up the value chain from ore to magnets. The chokepoint deepens.',cost:1100,fx:{},tx:[{stat:'treasury',d:70,mo:24},{stat:'gdpGrowth',d:0.1,mo:18}],cd:1,blocks:[]},
  {id:'nt_japan',t:'technology',stage:2,oneTime:true,cond:st=>st.c==='japan',why:'National trait — robotics leadership',n:'Robotics Eldercare Program',i:'🦾',d:'Meet the demographic cliff with machines. Care capacity without labor.',cost:800,fx:{},tx:[{stat:'stability',d:0.25,mo:18},{stat:'healthcare',d:0.6,mo:16}],cd:1,blocks:[]},
  {id:'nt_norway',t:'technology',stage:2,oneTime:true,cond:st=>st.c==='norway',why:'National trait — sovereign wealth',n:'Sovereign Green Mandate',i:'🌱',d:'Direct the fund into national green-tech champions.',cost:600,fx:{},tx:[{stat:'gdpGrowth',d:0.14,mo:20},{stat:'inflation',d:-0.05,mo:16}],cd:1,blocks:[]},
  {id:'nt_russia',t:'technology',stage:2,oneTime:true,cond:st=>st.c==='russia',why:'National trait — energy superpower',n:'Arctic Energy Modernization',i:'🧊',d:'Next-generation extraction on the northern shelf.',cost:900,fx:{},tx:[{stat:'treasury',d:60,mo:20},{stat:'military',d:0.08,mo:14}],cd:1,blocks:[]},
  {id:'nt_germany',t:'technology',stage:2,oneTime:true,cond:st=>st.c==='germany',why:'National trait — engineering base',n:'Industrie 5.0 Initiative',i:'⚙️',d:'Human-machine manufacturing at precision scale.',cost:900,fx:{},tx:[{stat:'gdpGrowth',d:0.16,mo:20},{stat:'education',d:0.5,mo:14}],cd:1,blocks:[]},
  {id:'nt_brazil',t:'technology',stage:1,oneTime:true,cond:st=>st.c==='brazil',why:'National trait — agricultural power',n:'Agri-Tech Revolution',i:'🌾',d:'Precision agriculture and bio-inputs across the cerrado.',cost:500,fx:{},tx:[{stat:'gdpGrowth',d:0.12,mo:18},{stat:'foodSecurity',d:0.8,mo:14},{stat:'inequality',d:-0.08,mo:12}],cd:1,blocks:[]},
  {id:'bl_cn',t:'technology',stage:2,oneTime:true,cond:st=>st.bt.cn>=2,why:'Bloc — China Corridor T2',n:'Joint AI Laboratory',i:'🤝',d:'Shared frontier lab with Chinese institutes. Brilliant — and porous.',cost:700,fx:{},tx:[{stat:'education',d:1.4,mo:16},{stat:'gdpGrowth',d:0.12,mo:16}],sfx:[{k:'tension',id:'usa',d:6}],cd:1,blocks:[]},
  {id:'bl_eu',t:'technology',stage:2,oneTime:true,cond:st=>st.bt.eu>=2,why:'Bloc — EU Association T2',n:'Horizon Research Grant',i:'🇪🇺',d:'Full association with the continental research programme.',cost:400,fx:{},tx:[{stat:'education',d:1.2,mo:14}],cd:1,blocks:[]},
  {id:'sy_cloud',t:'technology',stage:3,oneTime:true,cond:st=>(st.dl.computers||0)>=5&&(st.dl.cyber||0)>=4,why:'Synergy — Computers L5 · Cyber L4',n:'Sovereign Cloud',i:'☁️',d:'National compute independence: your data, your silicon, your keys.',cost:1400,fx:{},tx:[{stat:'gdpGrowth',d:0.15,mo:20},{stat:'stability',d:0.1,mo:16}],cd:1,blocks:[]},
  {id:'tr8',t:'trade',n:'Free Trade Zone',i:'🏭',d:'Preferential FTZ to attract FDI.',cost:600,fx:{},tx:[{stat:'gdpGrowth',d:0.06,mo:14},{stat:'treasury',d:25,mo:14},{stat:'unemployment',d:0.12,mo:14}],cd:14,blocks:[]},
];

// sev(stats) = how close the issue's stat is to its trigger (1 = triggered). Issues surface from sev >= ISSUE_WATCH (src/sim/issues.js),
// so the loop runs at a playable cadence instead of waiting for a stat to cross a hard line.
export const ISSUES={
  high_inflation:{title:'Inflation Crisis',icon:'📈',color:'#f97316',trigger:s=>s.inflation>8,sev:s=>s.inflation/8,preloadedFor:[],ps:'inflation',drift:0.2,
   brief:s=>({rc:`Inflation at ${s.inflation.toFixed(1)}% reflects entrenched price pressure. ${s.debtGdp>80?'Expansionary stance adding demand. ':''}Without intervention projects ${(s.inflation+3.2).toFixed(1)}% in 8 months.`,
   ind:[{l:'Inflation',v:SC.inflation.fmt(s.inflation),s:ss('inflation',s.inflation)},{l:'Stability',v:SC.stability.fmt(s.stability),s:ss('stability',s.stability)}],
   opts:[{id:'m',n:'Monetary Tightening',ps:'inflation',mech:'Raise rates 2–4 points, cool demand.',cost:0,cl:'No cost',tm:4,fx:[{s:'inflation',d:-4.5,l:'Inflation'},{s:'gdpGrowth',d:-1.2,l:'GDP'},{s:'unemployment',d:1.8,l:'Unemployment'}],risks:['Unemployment rises 1.5–2.5pts'],conf:78},
        {id:'s',n:'Supply Chain Investment',ps:'inflation',mech:'Capital to import infrastructure targeting supply-side.',cost:900,cl:'$900M',tm:10,fx:[{s:'inflation',d:-2.2,l:'Inflation'},{s:'foodSecurity',d:9,l:'Food'}],risks:['3–4 month lag'],conf:55}]})},
  high_unemployment:{title:'Structural Unemployment',icon:'👷',color:'#eab308',trigger:s=>s.unemployment>10,sev:s=>s.unemployment/10,preloadedFor:[],ps:'unemployment',drift:0.15,
   brief:s=>({rc:`Unemployment at ${s.unemployment.toFixed(1)}% signals structural failure. Skills gaps are the primary bottleneck.`,
   ind:[{l:'Unemployment',v:SC.unemployment.fmt(s.unemployment),s:ss('unemployment',s.unemployment)},{l:'Education',v:SC.education.fmt(s.education),s:ss('education',s.education)}],
   opts:[{id:'l',n:'Active Labor Programs',ps:'unemployment',mech:'Retraining, job-matching, apprenticeship subsidies.',cost:700,cl:'$700M',tm:18,fx:[{s:'unemployment',d:-3.2,l:'Unemployment'},{s:'education',d:6,l:'Education'}],risks:['18-month delay'],conf:70},
        {id:'i',n:'Infrastructure Employment',ps:'unemployment',mech:'Government infrastructure providing direct employment.',cost:2200,cl:'$2.2B',tm:8,fx:[{s:'unemployment',d:-5.8,l:'Unemployment'},{s:'gdpGrowth',d:0.9,l:'GDP'}],risks:['Significant debt expansion'],conf:68}]})},
  political_instability:{title:'Governance Crisis',icon:'🔥',color:'#ef4444',trigger:s=>s.stability<40,sev:s=>40/Math.max(1,s.stability),preloadedFor:[],ps:'stability',drift:-0.4,
   brief:s=>({rc:`Stability at ${s.stability.toFixed(0)} reflects accumulated legitimacy deficit. Below 35, degradation is non-linear.`,
   ind:[{l:'Stability',v:SC.stability.fmt(s.stability),s:'critical'},{l:'Inequality',v:SC.inequality.fmt(s.inequality),s:ss('inequality',s.inequality)}],
   opts:[{id:'t',n:'Emergency Social Transfers',ps:'stability',mech:'Direct cash transfers to bottom 40%.',cost:1200,cl:'$1.2B/yr',tm:3,fx:[{s:'stability',d:10,l:'Stability'},{s:'inequality',d:-8,l:'Inequality'}],risks:['Creates fiscal dependency'],conf:70},
        {id:'r',n:'Governance Reform',ps:'stability',mech:'Constitutional consultation, civic engagement.',cost:200,cl:'$200M',tm:14,fx:[{s:'stability',d:18,l:'Stability'},{s:'inequality',d:-5,l:'Inequality'}],risks:['Instability worsens before improving'],conf:52}]})},
  debt_sustainability:{title:'Debt Sustainability',icon:'💳',color:'#a855f7',trigger:s=>s.debtGdp>88,sev:s=>s.debtGdp/88,preloadedFor:[],ps:'debtGdp',drift:0.3,
   brief:s=>({rc:`Debt/GDP at ${s.debtGdp.toFixed(0)}% creates refinancing vulnerability.`,
   ind:[{l:'Debt/GDP',v:SC.debtGdp.fmt(s.debtGdp),s:ss('debtGdp',s.debtGdp)},{l:'GDP Growth',v:SC.gdpGrowth.fmt(s.gdpGrowth),s:ss('gdpGrowth',s.gdpGrowth)}],
   opts:[{id:'c',n:'Fiscal Consolidation',ps:'debtGdp',mech:'Primary surplus targeting, spending rationalization.',cost:-1500,cl:'$1.5B/yr',tm:12,fx:[{s:'debtGdp',d:-12,l:'Debt'},{s:'stability',d:-10,l:'Stability'}],risks:['Recession risk'],conf:65},
        {id:'g',n:'Growth-Led Reduction',ps:'debtGdp',mech:'Invest in productivity to grow GDP faster than debt.',cost:1000,cl:'$1B',tm:18,fx:[{s:'gdpGrowth',d:1.2,l:'GDP'},{s:'debtGdp',d:-5,l:'Debt'}],risks:['Adds debt before reducing ratio'],conf:52}]})},
  inequality_pressure:{title:'Structural Inequality',icon:'⚖️',color:'#ec4899',trigger:s=>s.inequality>73,sev:s=>s.inequality/73,preloadedFor:[],ps:'inequality',drift:0.1,
   brief:s=>({rc:`Inequality at ${s.inequality.toFixed(0)} suppresses GDP 0.4–0.8% annually per IMF research.`,
   ind:[{l:'Inequality',v:SC.inequality.fmt(s.inequality),s:ss('inequality',s.inequality)},{l:'Healthcare',v:SC.healthcare.fmt(s.healthcare),s:ss('healthcare',s.healthcare)}],
   opts:[{id:'t',n:'Progressive Tax Reform',ps:'inequality',mech:'Top-rate reform, revenue into social investment.',cost:-500,cl:'+$500M revenue',tm:8,fx:[{s:'inequality',d:-10,l:'Inequality'},{s:'education',d:6,l:'Education'}],risks:['Capital flight risk'],conf:60},
        {id:'h',n:'Universal Healthcare',ps:'inequality',mech:'Eliminate healthcare access barriers.',cost:1400,cl:'$1.4B/yr',tm:12,fx:[{s:'healthcare',d:20,l:'Healthcare'},{s:'inequality',d:-7,l:'Inequality'}],risks:['High sustained cost'],conf:72}]})},
  demographic_decline:{title:'Demographic Decline',icon:'👴',color:'#94a3b8',trigger:_=>false,sev:_=>0,preloadedFor:['germany','japan'],ps:'gdpGrowth',drift:-0.05,
   brief:s=>({rc:`Working-age population peak passed. Labor force contraction suppressing GDP potential.`,
   ind:[{l:'GDP Growth',v:SC.gdpGrowth.fmt(s.gdpGrowth),s:ss('gdpGrowth',s.gdpGrowth)},{l:'Debt/GDP',v:SC.debtGdp.fmt(s.debtGdp),s:ss('debtGdp',s.debtGdp)}],
   opts:[{id:'i',n:'Strategic Immigration',ps:'gdpGrowth',mech:'Points-based system for working-age labor.',cost:300,cl:'$300M',tm:9,fx:[{s:'gdpGrowth',d:0.8,l:'GDP'},{s:'stability',d:-5,l:'Stability'}],risks:['Social cohesion stress'],conf:62},
        {id:'a',n:'Productivity Automation',ps:'gdpGrowth',mech:'Automation offsetting labor contraction.',cost:1500,cl:'$1.5B',tm:18,fx:[{s:'gdpGrowth',d:1.0,l:'GDP'},{s:'inequality',d:6,l:'Inequality'}],risks:['Worker displacement'],conf:57}]})},
  resource_dependency:{title:'Resource Dependency',icon:'🛢️',color:'#d97706',trigger:_=>false,sev:_=>0,preloadedFor:['norway'],ps:'stability',drift:-0.05,
   brief:s=>({rc:`Hydrocarbon revenues dominate government income. Dutch disease crowding out non-resource sectors.`,
   ind:[{l:'GDP Growth',v:SC.gdpGrowth.fmt(s.gdpGrowth),s:'warning'},{l:'Treasury',v:SC.treasury.fmt(s.treasury),s:'ok'}],
   opts:[{id:'d',n:'Diversification Fund',ps:'gdpGrowth',mech:'Sovereign capital to non-extractive sectors.',cost:1800,cl:'$1.8B',tm:20,fx:[{s:'gdpGrowth',d:0.6,l:'GDP'},{s:'stability',d:8,l:'Stability'}],risks:['Long payback'],conf:55},
        {id:'g',n:'Green Energy Transition',ps:'gdpGrowth',mech:'Leverage expertise for renewables export.',cost:2200,cl:'$2.2B',tm:24,fx:[{s:'gdpGrowth',d:0.9,l:'GDP'},{s:'stability',d:6,l:'Stability'}],risks:['Revenue gap in transition'],conf:55}]})},
  brain_drain:{title:'Skilled Labor Emigration',icon:'🎓',color:'#06b6d4',trigger:s=>s.education>65&&s.gdpGrowth<0.5&&s.stability<60,sev:s=>Math.min(s.education/65,(1-s.gdpGrowth)/0.5,60/Math.max(1,s.stability)),preloadedFor:[],ps:'education',drift:-0.15,
   brief:s=>({rc:`Skilled emigration accelerating. GDP at ${s.gdpGrowth.toFixed(1)}%, stability at ${s.stability.toFixed(0)}. Wage premium from emigration far exceeds domestic prospects.`,
   ind:[{l:'Education',v:SC.education.fmt(s.education),s:'warning'},{l:'GDP Growth',v:SC.gdpGrowth.fmt(s.gdpGrowth),s:ss('gdpGrowth',s.gdpGrowth)}],
   opts:[{id:'r',n:'Diaspora Return Program',ps:'education',mech:'Competitive packages targeting diaspora.',cost:500,cl:'$500M',tm:10,fx:[{s:'education',d:8,l:'Education'},{s:'gdpGrowth',d:0.4,l:'GDP'}],risks:['Contingent on stability'],conf:58},
        {id:'z',n:'Innovation Zones',ps:'education',mech:'SEZs with competitive compensation.',cost:800,cl:'$800M',tm:14,fx:[{s:'education',d:10,l:'Education'},{s:'gdpGrowth',d:0.7,l:'GDP'}],risks:['Zone inequality'],conf:60}]})},
  food_insecurity:{title:'Food Security Crisis',icon:'🌾',color:'#84cc16',trigger:s=>s.foodSecurity<50,sev:s=>50/Math.max(1,s.foodSecurity),preloadedFor:[],ps:'foodSecurity',drift:-0.4,
   brief:s=>({rc:`Food security at ${s.foodSecurity.toFixed(0)}. ${s.inflation>8?'Price inflation is the primary barrier.':'Agricultural productivity shortfalls constraining supply.'}`,
   ind:[{l:'Food Security',v:SC.foodSecurity.fmt(s.foodSecurity),s:'critical'},{l:'Inflation',v:SC.inflation.fmt(s.inflation),s:ss('inflation',s.inflation)}],
   opts:[{id:'s',n:'Food Subsidy Program',ps:'foodSecurity',mech:'Direct price subsidies for bottom 40%.',cost:600,cl:'$600M/yr',tm:2,fx:[{s:'foodSecurity',d:18,l:'Food'},{s:'stability',d:8,l:'Stability'}],risks:['Fiscal dependency'],conf:75},
        {id:'a',n:'Agricultural Investment',ps:'foodSecurity',mech:'Capital for irrigation, seeds, storage.',cost:1100,cl:'$1.1B',tm:14,fx:[{s:'foodSecurity',d:22,l:'Food'},{s:'gdpGrowth',d:0.6,l:'GDP'}],risks:['Long implementation'],conf:62}]})},
};

// ── Fiscal Engine Constants ──────────────────────────────────────────────────
export const BASE_SECTOR={defense:14,energy:8,healthcare:12,education:10,technology:9};
// Gains per month at 200% funding (linear between 100–200%)
export const SECTOR_GAINS={
  defense: {military:0.22},
  energy:  {inflation:-0.07,treasury:95},
  healthcare:{healthcare:0.38,stability:0.025},
  education: {education:0.32,inequality:-0.03},
  technology:{gdpGrowth:0.14,education:0.12},
};
// Decay per month at 0% funding (linear between 0–100%)
export const SECTOR_DECAY={
  defense: {military:0.30},
  energy:  {inflation:0.12,stability:-0.04},
  healthcare:{healthcare:0.32,stability:-0.04},
  education: {education:0.28,inequality:0.04},
  technology:{gdpGrowth:0.09,education:0.14},
};

// Sector labels (budget panel, modernization log).
export const SECTOR_LABELS={defense:'🛡️ Defense',energy:'⚡ Energy',healthcare:'🏥 Healthcare',education:'🎓 Education',technology:'💻 Technology'};
// IP policy labels (Technology tab).
export const IP_POLICY_LABELS={protect:'🛡️ Protect',balanced:'⚖️ Balanced',license:'💰 License'};
