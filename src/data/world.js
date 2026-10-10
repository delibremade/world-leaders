import { seat, cap1, maxTen, hottest, memberOf, ownedMembers, squeezed, tightest, strongest, offtakeCandidate, mineralName, lowestReadiness, sofRoom } from './event-ctx.js';
import { ALLIED_PROGRAMS, ACCESS_RULES } from './alliance.js';
import { NATIONS } from './nations.js';
import { SOF_RULES } from './forces.js';
import { MINERALS, MINERAL_RULES } from './minerals.js';
import { accessGates, memberGates, shareCost, myAccess } from '../sim/selectors.js';
import { crewStatus } from '../sim/forces.js';
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
  // E6 (#18). `d` may be a function of the player's nation (the card is written from the player's seat).
  mineral_controls_bite:{n:'Mineral Export Controls Bite',i:'⛏️',dur:9,fx:{inflation:0.1,gdpGrowth:-0.04},
    d:c=>seat(c,{china:'A rival bloc closes its refineries to you in kind. Your own controls drew the answer; the substitutes you need are on their side of the line.',russia:'Sanctioned refiners abroad stop shipping. Plants that run on imported inputs are already on short shifts.',usa:'A processor you leaned on has stopped shipping. Defense primes report inputs stalling at the dock.'},'A processor has stopped shipping a mineral your programs need. Lines that run on it slow until you source it elsewhere.')},
  export_backlash:{n:'Export Control Backlash',i:'🔒',dur:6,fx:{},
    d:c=>seat(c,{china:'Importers protest your controls at the WTO and in every capital. Buyers quietly fund substitutes.',usa:'Allies protest that your controls hit them too. Rivals fund substitutes the moment the licences are required.'},'Customers protest your controls and start funding substitutes. The leverage is real; so is the bill.')},
  partner_security_audit:{n:'Partner Security Audit',i:'🕵️',dur:6,fx:{},
    d:'The program owner sends auditors. Counter-intelligence, foreign deals and exposure are all on the table, and membership is the stake.'},
  owner_leak_scare:{n:'Program Leak Scare',i:'🚨',dur:6,fx:{},
    d:'Fragments of your partners\u2019 program data surface on a rival\u2019s test range. One of your admitted partners is the likeliest source.'},
  readiness_grounding:{n:'Grounding Order',i:'🛑',dur:6,fx:{stability:-0.05},
    d:'A training accident and thin maintenance crews ground a branch. Commanders say the force is stretched past what its funding supports.'},
  recruitment_slump:{n:'Recruitment Slump',i:'🪖',dur:8,fx:{},
    d:c=>seat(c,{china:'Provincial quotas go unfilled. Conscript-age graduates choose the private sector, and the PLA\u2019s technical branches feel it first.',russia:'Mobilization fatigue shows: contract soldier numbers fall short, and the call-up lists lengthen.',usa:'Recruiting offices miss their numbers. Civilian wages are high and the all-volunteer force feels it.'},'Enlistment falls short and reenlistment softens. The force is thinner than the budget assumes.')},
  hostage_crisis:{n:'Hostages Abroad',i:'🪂',dur:5,fx:{},
    d:c=>seat(c,{china:'Overseas workers on a belt-and-road site are seized. Domestic opinion demands the state do something visible.',russia:'Contractors are taken by a militia in a failing state. Moscow\u2019s credibility with its other clients is at stake.',usa:'Americans are held in a hostile capital. The hostage-rescue task force is on alert.'},'Citizens are held abroad. Your special operators can reach them, at a price.')},
  sanctions_wave:{n:'Secondary Sanctions Wave',i:'📜',dur:9,allMult:0.95,fx:{gdpGrowth:-0.05},
    d:'The sanctions you started are widening. Third countries are told to choose, and banks that touch your partners are cut off.'},
  grid_attack:{n:'Grid Cyber Attack',i:'🔌',dur:5,fx:{stability:-0.1,gdpGrowth:-0.1},
    d:'Substations go dark across a region. Forensics point abroad; attribution is political and the repair bill is not.'},
  false_alarm:{n:'Early-Warning False Alarm',i:'☢️',dur:3,fx:{stability:-0.1},
    d:'A sensor fault reads as a launch. Minutes decide whether this is a footnote or the last decision anyone makes. Parity means the answer is deterrence, not a win.'},
};

export const DECISIONS=[
  {id:'summit',title:'Rival Demands Summit',icon:'🤝',when:ctx=>Math.max(0,...Object.values(ctx.ten))>=50,
   desc:c2=>{const h=Object.entries(c2.ten).sort((a,b)=>b[1]-a[1])[0];return `${(h?.[0]||'A rival').charAt(0).toUpperCase()+(h?.[0]||'rival').slice(1)} is signaling openness to a leaders' summit as tension nears the red line.`;},
   options:[
    {id:'a',label:'Attend the Summit',tags:['Tension vents −14','Allies read it as softness'],effects:{treasury:-300},sfx:[{k:'tension',id:'$hottest',d:-14},{k:'relBloc',bloc:'west',d:-3}]},
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
    {id:'a',label:'Flagship Pavilion',tags:['All buyer relations +4','+$200M orders'],effects:{treasury:-50},sfx:[{k:'relBuyers',d:4}]},
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
  {id:'protest',title:'Mass Protests',urgent:ctx=>ctx.ns.stability<45,when:ctx=>ctx.ns.stability<58||ctx.ns.inequality>70,icon:'✊',desc:'Hundreds of thousands demanding economic reform.',
   options:[{id:'a',label:'Commit to Reform',tags:['Satisfied','Fiscal cost'],effects:{stability:12,inequality:-8,treasury:-600}},{id:'b',label:'Dialogue',tags:['Buys time','Risk'],effects:{stability:4,inequality:-2}},{id:'c',label:'Security Response',tags:['Order restored','Legitimacy damage'],effects:{stability:-20,gdpGrowth:0.2}}]},
  {id:'tech_wave',title:'Automation Wave',when:ctx=>Object.values(ctx.dl).reduce((a,b)=>a+(b||0),0)>=10,icon:'🤖',desc:'Industrial automation available. Productivity gains real — displacement too.',
   options:[{id:'a',label:'Rapid Adoption',tags:['Productivity leap','Job loss'],effects:{gdpGrowth:1.2,unemployment:3,inequality:6}},{id:'b',label:'Managed Transition',tags:['Balanced'],effects:{gdpGrowth:0.5,education:4}},{id:'c',label:'Protect Workforce',tags:['Jobs protected','Competitiveness loss'],effects:{stability:6,unemployment:-1}}]},
  // ── E6 (#18): 22 decisions on the E4/E7/E8 systems and the nation-specific programs. `when` reads the live state through
  // ctx.g; `cost` is charged on top of `effects` and gates the option; `req` explains why an option is closed; `act` drives
  // an engine verb; `chain` queues a world event. Each card is written from the player's seat (desc takes ctx.country). ──
  // Nation programs
  {id:'j36_setback',seatBound:true,title:'J-36 Flight-Test Setback',icon:'🦅',when:({g})=>g.country?.id==='china'&&!!g.arsenal?.dev?.j36,
   desc:'Chengdu’s test review flags a center-engine vibration fault on the tailless heavy. Shenyang’s competing airframe is unaffected, and the Air Force wants a date.',
   options:[
    {id:'a',label:'Fund a Redundant Test Rig',cost:800,tags:['J-36 schedule +3 months ahead'],effects:{},sfx:[{k:'devSlip',id:'j36',mo:-3}]},
    {id:'b',label:'Shift Weight to J-50',tags:['J-36 slips 6 months','J-50 3 months ahead'],effects:{},sfx:[{k:'devSlip',id:'j36',mo:6},{k:'devSlip',id:'j50',mo:-3}]},
    {id:'c',label:'Accept the Slip, Protect Face',tags:['J-36 slips 12 months','Stability +2'],effects:{stability:2},sfx:[{k:'devSlip',id:'j36',mo:12}]}]},
  {id:'j50_setback',seatBound:true,title:'J-50 Airframe Fatigue Finding',icon:'🦅',when:({g})=>g.country?.id==='china'&&!!g.arsenal?.dev?.j50,
   desc:'Shenyang’s fatigue article cracks early at the wing root. The design bureau blames the composite supplier; the Central Military Commission blames the schedule.',
   options:[
    {id:'a',label:'Rebuild the Test Article',cost:600,tags:['J-50 schedule +3 months ahead'],effects:{},sfx:[{k:'devSlip',id:'j50',mo:-3}]},
    {id:'b',label:'Borrow J-36 Structures',tags:['J-50 slips 3 months','J-36 3 months ahead'],effects:{},sfx:[{k:'devSlip',id:'j50',mo:3},{k:'devSlip',id:'j36',mo:-3}]},
    {id:'c',label:'Replace the Supplier',cost:300,tags:['J-50 slips 6 months','Education +1 (new lab)'],effects:{education:1},sfx:[{k:'devSlip',id:'j50',mo:6}]}]},
  {id:'s70_engines',seatBound:true,title:'Okhotnik Engine Shortfall',icon:'🛩️',when:({g})=>g.country?.id==='russia'&&!!g.arsenal?.dev?.s70,
   desc:'The flying-wing demonstrator waits on engines the sanctioned supply chain cannot deliver. Beijing has offered a workaround; the design bureau wants to build its own.',
   options:[
    {id:'a',label:'Domestic Engine Crash Program',cost:700,tags:['S-70 3 months ahead'],effects:{},sfx:[{k:'devSlip',id:'s70',mo:-3}]},
    {id:'b',label:'Buy Chinese Engines',cost:300,tags:['Relations +5 with China','Exposure to Beijing'],effects:{},sfx:[{k:'rel',id:'china',d:5}]},
    {id:'c',label:'Let the Program Slip',tags:['S-70 slips 9 months','Stability +1'],effects:{stability:1},sfx:[{k:'devSlip',id:'s70',mo:9}]}]},
  {id:'gcap_workshare',seatBound:true,title:'GCAP Workshare Dispute',icon:'🇯🇵',when:({g})=>g.country?.id==='japan'&&myAccess(g,'gcap')?.status==='active',
   desc:'London and Rome want the final assembly line and the engine work. Tokyo’s industry wants avionics and the radar. The three-way split decides who keeps the jobs.',
   options:[
    {id:'a',label:'Match the Cost Share Increase',cost:700,tags:['UK +6, Italy +4 relations'],effects:{},sfx:[{k:'rel',id:'uk',d:6},{k:'rel',id:'italy',d:4}]},
    {id:'b',label:'Trade Assembly for Avionics',tags:['Unemployment −1','UK −4 relations'],effects:{unemployment:-1},sfx:[{k:'rel',id:'uk',d:-4}]},
    {id:'c',label:'Threaten a Go-Alone Option',tags:['Stability +2','UK −8, Italy −6 relations'],effects:{stability:2},sfx:[{k:'rel',id:'uk',d:-8},{k:'rel',id:'italy',d:-6}]}]},
  {id:'fcas_defection',seatBound:true,title:'FCAS Falls Apart',icon:'🇩🇪',when:({g})=>g.country?.id==='germany'&&!!myAccess(g,'fcas')?.founder&&myAccess(g,'fcas').status==='active'&&!g.arsenal.defected?.fcas,
   desc:'Paris wants to lead the fighter and keep the engine work. Berlin’s industry says the workshare is a fraud. London is quietly offering a seat at the table.',
   options:[
    {id:'a',label:'Stay and Pay for Workshare',cost:600,tags:['France +6, Spain +4 relations'],effects:{},sfx:[{k:'rel',id:'france',d:6},{k:'rel',id:'spain',d:4}]},
    {id:'b',label:'Defect to GCAP',tags:['Co-developer of GCAP','France −20, Spain −10 relations','Cost share paid'],effects:{},
     req:g=>{if(g.arsenal.defected?.fcas)return 'Already defected';const f=accessGates(g,'gcap','codev').find(x=>!x.met&&x.id!=='minerals');if(f)return f.label;return (g.stats?.treasury||0)<shareCost('gcap','codev')?`Need $${shareCost('gcap','codev')}M cost share`:null;},
     act:()=>[{verb:'defectProgram',payload:{from:'fcas',to:'gcap'}}]},
    {id:'c',label:'Stall at the Table',tags:['Stability +1','France −4 relations'],effects:{stability:1},sfx:[{k:'rel',id:'france',d:-4}]}]},
  {id:'f47_buyer_offer',seatBound:true,title:'F-47 Export Slot Offered',icon:'🇺🇸',when:({g,rel})=>['japan','germany','norway'].includes(g.country?.id)&&!myAccess(g,'f47')&&(rel.usa||0)>=45,
   desc:'Washington will open the sixth-generation fighter to a handful of allies. Buyers get an export variant behind the owner’s sustainment; partners buy workshare and a better variant.',
   options:[
    {id:'a',label:'Sign as a Buyer',tags:['Buyer tier of the F-47','Export variant, owner sustains it'],effects:{},
     req:g=>{const f=accessGates(g,'f47','buyer').find(x=>!x.met);return f?f.label:null;},act:()=>[{verb:'joinProgram',payload:{program:'f47',tier:'buyer'}}]},
    {id:'b',label:'Lobby for Partner Terms',cost:300,tags:['US +6 relations'],effects:{},sfx:[{k:'rel',id:'usa',d:6}]},
    {id:'c',label:'Buy European',tags:['Stability +1','US −3 relations'],effects:{stability:1},sfx:[{k:'rel',id:'usa',d:-3}]}]},
  {id:'usa_admission',seatBound:true,title:'Allies Ask for F-47 Access',icon:'🛂',when:({g,rel})=>g.country?.id==='usa'&&!g.arsenal?.access?.f47?.japan&&!g.arsenal?.access?.f47?.norway&&((rel.japan||0)>=45||(rel.norway||0)>=45),
   desc:'Tokyo and Oslo both want in. Admission brings export income and bloc cohesion; every new partner is also a new leak surface.',
   options:[
    {id:'a',label:'Admit Japan as a Buyer',tags:['+export income','Leak risk','Relations +5 with Japan'],effects:{},
     req:g=>{const f=memberGates(g,'f47','japan','buyer').find(x=>!x.met);return f?`Japan fails the ${f.id} gate`:null;},act:()=>[{verb:'admitPartner',payload:{program:'f47',nation:'japan',tier:'buyer'}}],chain:{id:'owner_leak_scare',after:12}},
    {id:'b',label:'Admit Norway as a Partner',tags:['+cost share income','Leak risk','Relations +5 with Norway'],effects:{},
     req:g=>{const f=memberGates(g,'f47','norway','partner').find(x=>!x.met);return f?`Norway fails the ${f.id} gate`:null;},act:()=>[{verb:'admitPartner',payload:{program:'f47',nation:'norway',tier:'partner'}}],chain:{id:'owner_leak_scare',after:12}},
    {id:'c',label:'Defer and Tighten the Gates',tags:['Japan −2, Norway −2 relations','Stability +1'],effects:{stability:1},sfx:[{k:'rel',id:'japan',d:-2},{k:'rel',id:'norway',d:-2}]}]},
  {id:'flagged_trade_offer',seatBound:true,title:'Cheap Components, Flagged Source',icon:'🧩',when:({g,ns})=>!!memberOf(g)&&!g.tradeAgreements?.has('china')&&(ns.gdpGrowth??3)<3,
   desc:'Beijing offers a trade agreement with components at half the going price. Your program owner reads flagged deals as a security breach, and Turkey has shown what that costs.',
   options:[
    {id:'a',label:'Sign the Agreement',tags:['Growth +1','Flagged deal: membership suspended next month'],effects:{gdpGrowth:1},sfx:[{k:'tradeDeal',id:'china'}]},
    {id:'b',label:'Source Through a Neutral',cost:250,tags:['Inflation −1'],effects:{inflation:-1}},
    {id:'c',label:'Decline and Say So',tags:['Owner +4 relations','China −4 relations'],effects:{},sfx:[{k:'rel',id:'$owner',d:4},{k:'rel',id:'china',d:-4}]}]},
  // Minerals and export controls
  {id:'ore_runout',title:'The Ore Is Running Out',icon:'⛏️',urgent:({g})=>{const t=tightest(g);return !!t&&t.months<12;},when:({g})=>{const t=tightest(g);return !!t&&t.months<24;},
   desc:ctx=>seat(ctx.country,{china:'Geologists at the ministry warn that a key mine is nearly exhausted. The refineries are the leverage; the ore beneath them is finite.',usa:'The Geological Survey reports that domestic ore for a defense-critical mineral will not last the decade.',russia:'Plants in the Urals report thin seams. Sanctions make buying elsewhere the harder route.',brazil:'Mining ministry maps show the richest seams nearly worked out. Exporting raw ore has run ahead of building refineries.',cuba:'Moa Bay yields are falling. The state mine has no capital to open the next seam.'},'Geologists warn that a mineral you refine is running out of ore. Output falls to a fraction when it does.'),
   options:[
    {id:'a',label:'Recycling Mandate',cost:300,tags:['Recycling on for the scarcest mineral'],effects:{},
     req:g=>{const t=tightest(g);return t.m==='enrichment'?'Enriched uranium cannot be recycled':g.minerals.recycle.includes(t.m)?'Already recycling it':null;},act:g=>[{verb:'toggleRecycling',payload:{mineral:tightest(g).m}}]},
    {id:'b',label:'Buy Into the Strategic Reserve',tags:['One lot of reserve','Priced at 1.2x market'],effects:{},
     req:g=>{const t=tightest(g);const o=g.minerals.own[t.m];const price=Math.round(Math.min(MINERAL_RULES.stockpile.lot,MINERAL_RULES.reserveMax-o.reserve)*MINERALS[t.m].price*MINERAL_RULES.stockpile.markup);return o.reserve>=MINERAL_RULES.reserveMax?'Reserve full':(g.stats?.treasury||0)<price?`Need $${price}M`:null;},act:g=>[{verb:'buyStockpile',payload:{mineral:tightest(g).m}}]},
    {id:'c',label:'Ration Civilian Use',tags:['Inflation +1','Stability −1','Saves the ore'],effects:{inflation:1,stability:-1}}]},
  {id:'controls_temptation',title:'Hardliners Want Export Controls',icon:'🔒',when:({g,ten})=>!!strongest(g)&&(g.minerals.controls.length===0)&&Math.max(0,...Object.values(ten))>=30,
   desc:ctx=>seat(ctx.country,{china:'The commerce ministry has a licensing regime drafted for your strongest refined mineral. Every importer would need a permit, and permits can be slow.',usa:'Commerce and the NSC argue that your processing lead is a weapon you are not using. Allies fear the precedent.',russia:'The industry ministry proposes a licence on your strongest refined export. Customers who need it have few other sellers.'},'Hardliners say your processing lead is leverage. Controls cut rivals off, cost money to enforce and cost relations outside your bloc.'),
   options:[
    {id:'a',label:'Impose the Controls',cost:250,tags:['Rivals lose access','Relations −8 outside your bloc','Backlash follows'],effects:{},
     req:g=>{const m=strongest(g);return g.minerals.own[m].cap>0?null:'You process nothing worth controlling';},act:g=>[{verb:'toggleExportControl',payload:{mineral:strongest(g)}}],chain:{id:'export_backlash',after:4}},
    {id:'b',label:'Signal, Do Not Act',tags:['Tension −3','Keeps the option'],effects:{},sfx:[{k:'tension',id:'$hottest',d:-3}]},
    {id:'c',label:'Offer Allies Priority Access',cost:300,tags:['Relations +4 inside your bloc'],effects:{},sfx:[{k:'relBloc',bloc:'$own',d:4}]}]},
  {id:'controls_review',title:'Allies Lobby to Relax Your Controls',icon:'🧾',when:({g})=>g.minerals.controls.length>0,
   desc:'Your own manufacturers cannot get inputs, partners say the controls hit them too, and rivals are breaking ground on substitutes.',
   options:[
    {id:'a',label:'Exempt Your Bloc',cost:350,tags:['Relations +4 inside your bloc','Controls stay on rivals'],effects:{},sfx:[{k:'relBloc',bloc:'$own',d:4}]},
    {id:'b',label:'Stand Firm',tags:['Stability +2','Tension +3','Backlash follows'],effects:{stability:2},sfx:[{k:'tension',id:'$hottest',d:3}],chain:{id:'export_backlash',after:6}},
    {id:'c',label:'Lift the Controls',tags:['Controls lifted','Tension −3'],effects:{},req:g=>(g.minerals.controls.length?null:'No controls in force'),act:g=>[{verb:'toggleExportControl',payload:{mineral:g.minerals.controls[0]}}],sfx:[{k:'tension',id:'$hottest',d:-3}]}]},
  {id:'processing_pact_offer',title:'Allied Processing Pact Proposed',icon:'🤝',when:({g,ten})=>['west','east'].includes(NATIONS[g.country?.id]?.bloc)&&!g.minerals.pact&&!!tightest(g)&&(Math.max(0,...Object.values(ten))>=25||!!squeezed(g)),
   desc:'Your bloc’s refiners offer to supply you first and never control exports against you, for a monthly fee and a seat at their table.',
   options:[
    {id:'a',label:'Join the Processing Pact',tags:['Bloc processors supply you first','$60M/month'],effects:{},req:g=>(g.minerals.pact?'Already in the pact':null),act:()=>[{verb:'toggleProcessingPact',payload:{}}]},
    {id:'b',label:'Sign a Bilateral Offtake',tags:['One partner, 36 months','Priced by relations'],effects:{},
     req:g=>{const t=tightest(g);return offtakeCandidate(g,t.m)?null:`No willing partner refines ${mineralName(t.m)}`;},act:g=>{const t=tightest(g);return [{verb:'signOfftake',payload:{mineral:t.m,nation:offtakeCandidate(g,t.m)}}];}},
    {id:'c',label:'Go It Alone',tags:['Stability +1','Relations −2 inside your bloc'],effects:{stability:1},sfx:[{k:'relBloc',bloc:'$own',d:-2}]}]},
  // Forces, crews, readiness
  {id:'pay_dispute',title:'Soldiers’ Pay Dispute',icon:'💵',urgent:({g})=>!!g.forces&&g.forces.retention<35,when:({g})=>!!g.forces&&g.forces.retention<45&&(g.personnelPay??100)<110,
   desc:ctx=>seat(ctx.country,{china:'Technical NCOs are leaving for the private sector. The Central Military Commission is told the pay scale has not kept up with Shenzhen.',russia:'Contract soldiers complain of late and unequal pay. The regional commands are quietly short of men.',usa:'Sergeants are taking civilian offers that pay half again as much. Retention in the technical ratings is slipping.'},'Pay has not kept up with civilian wages and the best soldiers are leaving. The payroll fix is a standing cost; a bonus is a one-off.'),
   options:[
    {id:'a',label:'Raise Pay to 115%',tags:['Payroll up every month','Retention climbs'],effects:{},act:()=>[{verb:'setPersonnelPay',payload:{pay:115}}]},
    {id:'b',label:'One-Time Retention Bonus',cost:400,tags:['Retention +8'],effects:{},sfx:[{k:'retention',d:8}]},
    {id:'c',label:'Hold the Line',tags:['Stability −1','Retention −4','Recruitment slump follows'],effects:{stability:-1},sfx:[{k:'retention',d:-4}],chain:{id:'recruitment_slump',after:4}}]},
  {id:'crew_shortfall',title:'Hulls and Wings Without Crews',icon:'🧑‍✈️',when:({g})=>!!g.forces&&Object.values(crewStatus(g)).some(b=>b.gap>0),
   desc:'Procurement delivered faster than the training pipelines. Some of what you own cannot deploy because nobody is qualified to crew it.',
   options:[
    {id:'a',label:'Surge the Training Pipelines',cost:400,tags:['Training to Intensive','Readiness +4 everywhere'],effects:{},act:()=>[{verb:'setTraining',payload:{level:3}}],sfx:[{k:'readiness',b:'all',d:4}]},
    {id:'b',label:'Cross-Train From the Reserve',tags:['Active strength +4 from the reserve','Stability −1'],effects:{stability:-1},sfx:[{k:'manpower',d:4}]},
    {id:'c',label:'Contract Out Maintenance',cost:600,tags:['Readiness +6 on every branch'],effects:{},sfx:[{k:'readiness',b:'all',d:6}]}]},
  {id:'quality_warning',title:'Recruits Cannot Read the Manuals',icon:'📉',when:({g})=>!!g.forces&&g.forces.quality<48,
   desc:'Instructors report that new recruits arrive with weak schooling, poor health and little trust in the state. Neglect shows up years later, and this is it.',
   options:[
    {id:'a',label:'Fund Recruit Schooling',cost:600,tags:['Education +3'],effects:{education:3}},
    {id:'b',label:'Fitness and Nutrition Program',cost:350,tags:['Healthcare +2, food security +2'],effects:{healthcare:2,foodSecurity:2}},
    {id:'c',label:'Lower the Entry Bar',tags:['Retention +4','Readiness −3 everywhere','Grounding order follows'],effects:{},sfx:[{k:'retention',d:4},{k:'readiness',b:'all',d:-3}],chain:{id:'readiness_grounding',after:9}}]},
  {id:'joint_exercise',title:'Allied Joint Exercise',icon:'🎖️',when:({g})=>!!g.forces&&(g.defensePacts?.size||0)>=1&&Math.min(...Object.values(g.forces.readiness))<80,
   desc:ctx=>seat(ctx.country,{china:'Partners propose a large combined drill. It would show the flag and rehearse the logistics you rarely get to test.',russia:'Allied commands offer a combined strategic exercise. It is expensive and it is also the one real test of your mobilization plan.'},'Your pact partners propose a large joint exercise. It tests the plan, trains the crews and shows the flag.'),
   options:[
    {id:'a',label:'Host the Exercise',cost:350,tags:['Readiness +6 everywhere','Relations +3 inside your bloc'],effects:{},sfx:[{k:'readiness',b:'all',d:6},{k:'relBloc',bloc:'$own',d:3}]},
    {id:'b',label:'Send Observers Only',cost:100,tags:['Readiness +2 everywhere'],effects:{},sfx:[{k:'readiness',b:'all',d:2}]},
    {id:'c',label:'Decline',tags:['Relations −2 inside your bloc','Saves the budget'],effects:{treasury:150},sfx:[{k:'relBloc',bloc:'$own',d:-2}]}]},
  // Special operations
  {id:'sof_raid',title:'Raid on a Courier Network',icon:'🎯',when:({g,ten})=>(g.forces?.sof?.t1||0)>=1&&Math.max(0,...Object.values(ten))>=20&&!(g.nukeLog||[]).length,
   desc:ctx=>seat(ctx.country,{china:'Intelligence locates a courier cell moving a rival’s sensitive files through a third country. A deniable team could reach it.',russia:'Security services trace a rival’s courier line to a villa abroad. Spetsnaz could be there in a night.',usa:'The Agency has a window on a courier cell carrying a rival’s weapons data. The task force can be there in 48 hours.'},'Intelligence has a window on a rival’s courier cell. A Tier 1 team could hit it, if you accept the exposure.'),
   options:[
    {id:'a',label:'Authorize the Raid',cost:250,tags:['Their program set back','Tension +5','Land readiness −4'],effects:{stability:1},sfx:[{k:'tension',id:'$hottest',d:5},{k:'gdbTop',id:'$hottest',d:-0.3},{k:'readiness',b:'land',d:-4}]},
    {id:'b',label:'Pass the Intel to a Partner',tags:['Relations +3 inside your bloc','No exposure'],effects:{},sfx:[{k:'relBloc',bloc:'$own',d:3}]},
    {id:'c',label:'Shelve It',tags:['Retention −2','Keeps tension flat'],effects:{},sfx:[{k:'retention',d:-2}]}]},
  {id:'sof_selection',title:'Selection Course Oversubscribed',icon:'🥾',when:({g,ten})=>Math.max(0,...Object.values(ten))>=15&&(g.forces?.sof?.t2||0)>=1&&sofRoom(g)&&(g.forces.sof.t1+g.forces.sof.pipes.filter(p=>p.t===1).length)<SOF_RULES.max.t1,
   desc:'More Tier 2 operators qualify for selection than the course takes. Tier 1 takes two to three years to grow, so the decision is also a bet on where the threat will be.',
   options:[
    {id:'a',label:'Open a Tier 1 Selection Course',tags:['A Tier 1 pipeline starts','24 to 36 months','$20M/month'],effects:{},
     req:g=>((g.forces.sof.t2<1)?'No Tier 2 candidates':(g.stats?.treasury||0)<SOF_RULES.t1Cost?`Need $${SOF_RULES.t1Cost}M/mo`:null),act:()=>[{verb:'selectTier1',payload:{}}]},
    {id:'b',label:'Grow the Tier 2 Base',tags:['A Tier 2 pipeline starts','24 months','$10M/month'],effects:{},
     req:g=>((g.forces.sof.t2+g.forces.sof.pipes.filter(p=>p.t===2).length)>=SOF_RULES.max.t2?'Tier 2 at its ceiling':(g.stats?.treasury||0)<SOF_RULES.t2Cost?`Need $${SOF_RULES.t2Cost}M/mo`:null),act:()=>[{verb:'trainSof',payload:{}}]},
    {id:'c',label:'Bank the Savings',tags:['+$200M now','Same force'],effects:{treasury:200}}]},
  {id:'sof_scandal',title:'Operators Accused of Abuses',icon:'📰',when:({g})=>(g.usedDecisions?.has('sof_raid'))&&(g.forces?.sof?.t1||0)>=1,
   desc:'After the raid, a leaked review alleges unlawful killings by the Tier 1 team. The press has names. Allies want a response and the unit wants protection.',
   options:[
    {id:'a',label:'Independent Inquiry',cost:300,tags:['Stability +2'],effects:{stability:2}},
    {id:'b',label:'Cover It Up',tags:['Stability −3','Relations −3 inside your bloc'],effects:{stability:-3},sfx:[{k:'relBloc',bloc:'$own',d:-3}]},
    {id:'c',label:'Stand Down a Squadron',tags:['Tier 1 −1 squadron (24 to 36 months to rebuild)','Stability +3'],effects:{stability:3},req:g=>((g.forces.sof.t1<1)?'No Tier 1 squadron':null),sfx:[{k:'sof',t:1,d:-1}]}]},
  // Energy, intel, escalation
  {id:'reserve_window',title:'A Window to Refill the Reserve',icon:'🛢️',when:({g,ten,ns})=>(g.spr||0)<4&&!g.embargoedBy&&Math.max(0,...Object.values(ten))<40&&(ns.inflation??0)<4,
   desc:'Prices dip and the lanes are quiet. Strategists say a refilled reserve is the cheapest insurance you will be offered before the next chokepoint closes.',
   options:[
    {id:'a',label:'Fill a Tranche Now',tags:['+1 reserve tranche','$200M'],effects:{},req:g=>((g.spr||0)>=6?'Reserve full':(g.stats?.treasury||0)<200?'Need $200M':null),act:()=>[{verb:'fillReserve',payload:{}}]},
    {id:'b',label:'Sign a Long-Term Oil Contract',tags:['Import contract for oil','Steadier supply'],effects:{inflation:-1},req:g=>(g.importContracts?.has('oil')?'Oil contract already signed':null),act:()=>[{verb:'toggleImportContract',payload:{resource:'oil'}}]},
    {id:'c',label:'Wait for a Better Price',tags:['Inflation +1','Reserve stays thin'],effects:{inflation:1}}]},
  {id:'double_agent',title:'A Station Chief Walks In',icon:'🕶️',when:({g,ten})=>(g.intelOps||[]).length>=1&&Math.max(0,...Object.values(ten))>=15,
   desc:ctx=>seat(ctx.country,{china:'A senior officer from a rival service offers a list of assets in exchange for resettlement. The Ministry of State Security wants him debriefed before anyone else.',russia:'A foreign station chief asks for asylum with a ledger of his agents. The SVR wants the names before the rival service moves its people.',usa:'A rival’s station chief crosses at an embassy gate with a ledger of agents. The Agency has hours before his service notices.'},'A rival’s intelligence officer offers names and methods. The price is protection and a promise to use them quietly.'),
   options:[
    {id:'a',label:'Run Him Against the Rival',cost:400,tags:['Their program set back','Tension +4'],effects:{},sfx:[{k:'gdbTop',id:'$hottest',d:-0.4},{k:'tension',id:'$hottest',d:4}]},
    {id:'b',label:'Share With Allies',tags:['Relations +4 inside your bloc','No tension'],effects:{},sfx:[{k:'relBloc',bloc:'$own',d:4}]},
    {id:'c',label:'Send Him Home',tags:['Tension −4','A signal of restraint'],effects:{},sfx:[{k:'tension',id:'$hottest',d:-4}]}]},
  {id:'coastal_standoff',title:'Warships Off Your Coast',icon:'🚢',urgent:({g,ten})=>Math.max(0,...Object.values(ten))>=65,when:({g,ten})=>Math.max(0,...Object.values(ten))>=45&&!(g.nukeLog||[]).length,
   desc:ctx=>seat(ctx.country,{china:'A rival task group loiters inside your first island chain. The fleet wants orders and the leadership wants no incident.',russia:'A foreign destroyer group shadows your fleet near the approaches. Commanders ask for rules of engagement.',usa:'A rival task group parks off a US seaboard. Congress wants a response and the Joint Staff wants a ladder.'},'A rival task group parks off your coast. Matching it risks an incident; ignoring it reads as weakness.'),
   options:[
    {id:'a',label:'Match With a Naval Deployment',cost:500,tags:['Stability +2','Tension +3','Sea readiness −3'],effects:{stability:2},sfx:[{k:'tension',id:'$hottest',d:3},{k:'readiness',b:'sea',d:-3}]},
    {id:'b',label:'Back-Channel Through a Neutral',cost:150,tags:['Tension −7'],effects:{},sfx:[{k:'tension',id:'$hottest',d:-7}]},
    {id:'c',label:'Issue a Public Warning',tags:['Stability +2','Tension +5','Early-warning scare follows'],effects:{stability:2},sfx:[{k:'tension',id:'$hottest',d:5}],chain:{id:'false_alarm',after:6}}]},
];
