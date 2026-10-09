// National Doctrines — strategic identity. Pick one path; it shapes everything.
export const DOCTRINES={
  hegemon: {n:'Economic Hegemon',i:'💰',col:'#fbbf24',
    d:'Currency and trade as weapons. Trade effects +25%, region dividends +50%. Defense research costs +15%.',
    pros:['Trade income +25%','Region dividends +50%'],cons:['Defense research +15% cost']},
  fortress:{n:'Military Superpower',i:'🛡️',col:'#ef4444',
    d:'Peace through strength. Defense research −20% cost and time, military +0.04/mo, social friction relaxed to 3:1.',
    pros:['Defense R&D −20% cost/time','Military +0.04/mo','Friction threshold 3:1'],cons:['No economic bonuses']},
  vanguard:{n:'Technological Vanguard',i:'🔬',col:'#a78bfa',
    d:'Win the future first. Tech/education investments +40% effect, DARPA spillovers doubled. Military growth −20%.',
    pros:['Tech effects +40%','DARPA spillover ×2'],cons:['Military growth −20%']},
  shadow:  {n:'Shadow Power',i:'🕵️',col:'#06b6d4',
    d:'Influence unseen. Intel ops 25% cheaper, success +12%, discovery −10%. Constant low-grade stability drag.',
    pros:['Ops −25% cost','Success +12%','Discovery −10%'],cons:['Stability −0.015/mo']},
};
// Competitor AI responses — domain-specific per real-world behavior
export const COMP_RESPONSES={
  usa:    [{domain:'trade',    effect:{gdpGrowth:-0.1,treasury:-70},  msg:'US imposes targeted trade sanctions'},
           {domain:'currency', effect:{inflation:0.35,treasury:-90},  msg:'US dollar pressure campaign activated'},
           {domain:'defense',  effect:{stability:-1,military:-1.5},   msg:'US arms regional opponents'}],
  russia: [{domain:'energy',   effect:{inflation:0.6,stability:-1.2}, msg:'Russia signals energy supply disruption'},
           {domain:'defense',  effect:{stability:-1.5,military:-2},   msg:'Russia increases regional military presence'},
           {domain:'intel',    effect:{stability:-1.2,treasury:-50},  msg:'Russian intelligence operation detected'}],
  china:  [{domain:'trade',    effect:{gdpGrowth:-0.08,treasury:-55}, msg:'China restricts bilateral trade volume'},
           {domain:'currency', effect:{inflation:0.25,debtGdp:0.6},   msg:'China adjusts yuan swap line terms'},
           {domain:'technology',effect:{education:-0.8,gdpGrowth:-0.06},msg:'China restricts technology cooperation'}],
  germany:[{domain:'trade',    effect:{gdpGrowth:-0.07,treasury:-35}, msg:'EU-led diplomatic and trade pressure'}],
  japan:  [{domain:'technology',effect:{education:-0.6,gdpGrowth:-0.05},msg:'Japan reduces technology cooperation'}],
};

export const WORLD_EVENTS={
  hormuz_closure:{n:'Hormuz Closure',i:'⛽',dur:6,choke:'hormuz',fx:{},d:'Mines and missiles close the Gulf. Tankers anchor; the world bids for whatever oil is already at sea.'},
  red_sea_attacks:{n:'Red Sea Shipping Attacks',i:'🚀',dur:9,choke:'bab',fx:{},d:'Drones and anti-ship missiles turn Bab al-Mandab into a gauntlet. Carriers reroute around Africa unless someone escorts.'},
  panama_drought:{n:'Panama Drought',i:'🌵',dur:6,choke:'panama',fx:{},d:'Gatún Lake falls; transits are rationed. Atlantic–Pacific trade queues for weeks.'},
  regional_war:{n:'Regional War Erupts',i:'⚔️',dur:10,demand:{munitions:0.35,aircraft:0.25,missiles:0.22,airdef:0.2},oilM:1.25,fx:{},
    d:'Two non-aligned states have gone to open war. Arms buyers are writing checks; oil is jittery.'},
  pandemic:{n:'Global Pandemic',i:'🦠',dur:8,allMult:0.9,fx:{stability:-0.15,gdpGrowth:-0.1},
    d:'A novel pathogen closes borders and ports. Markets contract; publics look to the state.'},
  financial_crisis:{n:'Global Financial Crisis',i:'📉',dur:8,allMult:0.85,fx:{gdpGrowth:-0.2},
    d:'Credit seizes worldwide. Defense budgets shrink and growth stalls until it clears.'},
  energy_crunch:{n:'Energy Supply Crunch',i:'⚡',dur:9,oilM:1.35,fx:{inflation:0.15},demand:{propulsion:0.15},
    d:'Cascading outages and chokepoint failures. Producers feast; importers bleed.'},
  breakthrough:{n:'Foreign Tech Breakthrough',i:'💡',dur:0,fx:{},
    d:'A rival laboratory publishes a leap. Their programs jump; your lead narrows.'},
  nuclear_taboo:{n:'Nuclear Taboo Broken',i:'☢️',dur:24,allMult:0.75,fx:{stability:-0.2,gdpGrowth:-0.15},
    d:'A nuclear weapon was used in anger. Markets seize, publics panic, and every capital re-examines its arsenal.'},
  peace_accord:{n:'Regional Peace Accord',i:'🕊️',dur:12,demand:{munitions:-0.25,aircraft:-0.15,missiles:-0.12},fx:{},
    d:'A landmark settlement cools a hot theater. Good for the world; hard on the arms business.'},
};

export const DECISIONS=[
  {id:'summit',title:'Rival Demands Summit',icon:'🤝',when:ctx=>Math.max(0,...Object.values(ctx.ten))>=50,
   desc:c2=>{const h=Object.entries(c2.ten).sort((a,b)=>b[1]-a[1])[0];return `${(h?.[0]||'A rival').charAt(0).toUpperCase()+(h?.[0]||'rival').slice(1)} is signaling openness to a leaders' summit as tension nears the red line.`;},
   options:[
    {id:'a',label:'Attend the Summit',tags:['Tension vents −14','Costs $300M','Allies read it as softness'],effects:{treasury:-300},sfx:[{k:'tension',id:'$hottest',d:-14},{k:'relBloc',bloc:'west',d:-3}]},
    {id:'b',label:'Talks with Preconditions',tags:['Tension −6','No commitments'],effects:{},sfx:[{k:'tension',id:'$hottest',d:-6}]},
    {id:'c',label:'Refuse Publicly',tags:['Domestic rally +3 stability','Tension +6'],effects:{stability:3},sfx:[{k:'tension',id:'$hottest',d:6}]}]},
  {id:'defector',title:'Rival Scientist Defects',icon:'🧑‍🔬',when:ctx=>Math.max(0,...Object.values(ctx.ten))>=35,
   desc:()=>'A senior weapons scientist from your hottest rivalry has reached your embassy requesting asylum — with design documents.',
   options:[
    {id:'a',label:'Grant Asylum, Debrief',tags:['Education +3','Their program setback','Tension +8'],effects:{education:3},sfx:[{k:'tension',id:'$hottest',d:8},{k:'gdbTop',id:'$hottest',d:-0.4}]},
    {id:'b',label:'Quiet Third-Country Handoff',tags:['+$150M from partner service','Tension +2'],effects:{treasury:150},sfx:[{k:'tension',id:'$hottest',d:2}]},
    {id:'c',label:'Return Them',tags:['Tension −6','A signal of restraint'],effects:{},sfx:[{k:'tension',id:'$hottest',d:-6}]}]},
  {id:'expo',title:'International Arms Expo',icon:'🎪',when:ctx=>Object.keys(ctx.ex).length>=3,
   desc:()=>'The year\u2019s largest defense exhibition. Your export portfolio qualifies for a national pavilion.',
   options:[
    {id:'a',label:'Flagship Pavilion',tags:['All buyer relations +4','+$200M orders','Costs $250M'],effects:{treasury:-50},sfx:[{k:'relBuyers',d:4}]},
    {id:'b',label:'Undercut the Rival Booth',tags:['+$350M poached orders','Hottest rival tension +6'],effects:{treasury:350},sfx:[{k:'tension',id:'$hottest',d:6}]},
    {id:'c',label:'Skip It',tags:['No exposure either way'],effects:{}}]},
  {id:'pole_test',title:'The Pole Demands a Gesture',icon:'⚖️',when:ctx=>ctx.bt.cn>=2||ctx.bt.eu>=2,
   desc:ctx=>ctx.bt.cn>=2?'Beijing wants a public affirmation of the partnership — and a cooling toward Brussels.':'Brussels wants regulatory alignment signaled — and distance from Beijing.',
   options:[
    {id:'a',label:'Give the Gesture',tags:['Bloc anchor +6 relations','Rival pole anchor −6'],effects:{},sfx:[{k:'relAnchor',d:6},{k:'relRivalAnchor',d:-6}]},
    {id:'b',label:'Studied Ambiguity',tags:['Both anchors −2','You keep your options'],effects:{},sfx:[{k:'relAnchor',d:-2},{k:'relRivalAnchor',d:-2}]},
    {id:'c',label:'Defy — Sovereignty First',tags:['Stability +3','Bloc tier drops one level'],effects:{stability:3},sfx:[{k:'blocStep',d:-1}]}]},
  {id:'labor',title:'Labor Dispute',when:ctx=>ctx.ns.unemployment>5||ctx.ns.inequality>62,icon:'⚒️',desc:'Manufacturing unions demand 15% wage increases. Strike threat is credible.',
   options:[{id:'a',label:'Accept Terms',tags:['Workers satisfied','Wage costs rise'],effects:{stability:6,inflation:1.2,gdpGrowth:-0.4}},{id:'b',label:'Negotiate',tags:['Partial settlement'],effects:{stability:3,inflation:0.5}},{id:'c',label:'Reject',tags:['Short-term gain','Strike risk'],effects:{stability:-12,gdpGrowth:0.6,inequality:4}}]},
  {id:'fdi',title:'Foreign Investment Bid',when:ctx=>ctx.ns.gdpGrowth<2.5,icon:'🌐',desc:'Foreign consortium offers major capital for regulatory concessions.',
   options:[{id:'a',label:'Open Doors',tags:['Capital influx','Regulatory loss'],effects:{treasury:1200,gdpGrowth:0.8,inequality:5}},{id:'b',label:'Conditional Access',tags:['Negotiate safeguards'],effects:{treasury:600,gdpGrowth:0.4}},{id:'c',label:'Protect Domestic',tags:['Industry shielded','Slower growth'],effects:{gdpGrowth:-0.3,stability:4}}]},
  {id:'protest',title:'Mass Protests',when:ctx=>ctx.ns.stability<58||ctx.ns.inequality>70,icon:'✊',desc:'Hundreds of thousands demanding economic reform.',
   options:[{id:'a',label:'Commit to Reform',tags:['Satisfied','Fiscal cost'],effects:{stability:12,inequality:-8,treasury:-600}},{id:'b',label:'Dialogue',tags:['Buys time','Risk'],effects:{stability:4,inequality:-2}},{id:'c',label:'Security Response',tags:['Order restored','Legitimacy damage'],effects:{stability:-20,gdpGrowth:0.2}}]},
  {id:'tech_wave',title:'Automation Wave',when:ctx=>Object.values(ctx.dl).reduce((a,b)=>a+(b||0),0)>=10,icon:'🤖',desc:'Industrial automation available. Productivity gains real — displacement too.',
   options:[{id:'a',label:'Rapid Adoption',tags:['Productivity leap','Job loss'],effects:{gdpGrowth:1.2,unemployment:3,inequality:6}},{id:'b',label:'Managed Transition',tags:['Balanced'],effects:{gdpGrowth:0.5,education:4}},{id:'c',label:'Protect Workforce',tags:['Jobs protected','Competitiveness loss'],effects:{stability:6,unemployment:-1}}]},
];
