import { DIP_TARGETS } from '../data/nations.js';
import { BLOC_GROUPS } from '../data/trade.js';
import { WORLD_EVENTS } from '../data/world.js';
import { INTEL_OPS } from '../data/intel.js';
import { isrScore, panamaPriorityBlock, meetsReq, trancheCost, devCost } from './formulas.js';
import { BLACK_PROGRAMS, nationCatalog, catalogEntry } from '../data/platforms.js';
import { WORLD_RULES } from '../data/events.js';
import { worldOptions, flashpointOptions } from './events.js';

// Derived views shared by the UI (display) and the verbs (gates), so a rule has one implementation.

// Bloc trade tier requirements: [label, met] per tier (T1..T3). v57 expressions.
export function blocTierReqs(bk,{nationRelations,embassies,defensePacts,blocTrade,resExtraction},members){
  const avgRel=members.reduce((s,i)=>s+(nationRelations[i]||0),0)/members.length;
  const embC=members.filter(i=>embassies.has(i)).length;
  const pactC=members.filter(i=>defensePacts.has(i)).length;
  return {
    eu:[[`avg EU relations ≥30 (${Math.round(avgRel)})`,avgRel>=30],[`≥50 + 2 embassies (${embC})`,avgRel>=50&&embC>=2],[`avg ≥70 (${Math.round(avgRel)}) AND a Defense Pact with any member (${pactC} signed — pact needs +60, an embassy there, $800M)`,avgRel>=70&&pactC>=1]],
    cn:[[`China relations ≥20 (${Math.round(nationRelations.china||0)})`,(nationRelations.china||0)>=20],[`≥45`,(nationRelations.china||0)>=45],[`≥65 · excludes EU T3`,(nationRelations.china||0)>=65&&(blocTrade.eu||0)<3]],
    opec:[[`Saudi relations ≥25 (${Math.round(nationRelations.saudi||0)})`,(nationRelations.saudi||0)>=25],[`oil producer · quota: extraction ≤2 (now ${resExtraction.oil||0})`,(resExtraction.oil||0)>0],[`Saudi ≥60 — swing producer`,(nationRelations.saudi||0)>=60]],
  }[bk];
}
// Can the player advance bloc bk from `tier`? EU and CN Tier 3 are mutually exclusive.
export const blocCanAdvance=(bk,tier,next,lock,blocTrade)=>next&&next[1]&&!lock&&!(bk==='eu'&&tier===2&&(blocTrade.cn||0)>=3)&&!(bk==='cn'&&tier===2&&(blocTrade.eu||0)>=3);
// EU relations threshold for the next tier.
export const euTierNeed=(tier)=>tier<1?30:tier<2?50:70;
// Statecraft groups for a player: [id, label, members] with the player and non-diplomatic nations removed.
export const blocGroups=(playerId)=>BLOC_GROUPS.map(([id,n,ms])=>[id,n,ms.filter(m=>m!==playerId&&DIP_TARGETS.some(d=>d.id===m))]).filter(([,,ms])=>ms.length);

// ── Why-breakdown sources (P3c). The tick and the verbs call these; the HUD/sheets show the same terms.
export const renewableTotal=(g)=>(g.resources?.renewable?.solar||0)+(g.resources?.renewable?.wind||0)+(g.resources?.renewable?.hydro||0);

// Oil export price multiplier. Order of the product is load-bearing (parity): keep it.
export function oilPriceTerms(g,{renTot,hormuzHit}){
  const opecPrem=(g.blocTrade.opec>=2&&(g.resExtraction.oil||0)<=2)?1.35:1;
  const swingM=g.opecSwing?(g.opecSwing.mode==='cut'?1.6:0.55):1;
  const evOilM=g.worldEvent?(WORLD_EVENTS[g.worldEvent.id]?.oilM||1):1;
  const terms=[
    {k:'renewables',label:'Renewables ≥10 (grid surplus)',m:renTot>=10?1.2:1},
    {k:'opec',label:'OPEC quota (T2+, extraction ≤2)',m:opecPrem},
    {k:'swing',label:g.opecSwing?(g.opecSwing.mode==='cut'?'OPEC swing: cut':'OPEC swing: flood'):'OPEC swing',m:swingM},
    {k:'event',label:g.worldEvent?`World event: ${WORLD_EVENTS[g.worldEvent.id]?.n||g.worldEvent.id}`:'World event',m:evOilM},
    {k:'hormuz',label:'Hormuz disrupted',m:hormuzHit?1.4:1},
    {k:'embargoLift',label:'Embargo withholding lifts price',m:g.embargoes.size?1.15:1},
    {k:'embargoVol',label:'Embargo cuts your volume',m:g.embargoes.size?0.8:1},
  ];
  const mult=terms.reduce((m,t)=>m*t.m,1);
  return {terms,mult};
}

// Intel op odds. No side effects: runIntelOp spends absorbBonus after reading these.
export function opOddsTerms(g,opId){
  const op=INTEL_OPS.find(o=>o.id===opId);if(!op)return null;
  const cyberLvl=g.defLevels.cyber||0;
  const budgetBonus=((g.intelBudget||1)-1)*0.04;
  const shB=g.doctrine==='shadow'?0.12:0;const shD=g.doctrine==='shadow'?0.10:0;
  const asB=g.covertPrograms.has('asset_recruitment')?0.08:0;const asD=g.covertPrograms.has('asset_recruitment')?0.05:0;
  const stB=Math.min(0.15,(g.intelInfra.overseas_stations||0)*0.03);
  const isrSc=isrScore(g.platforms,g.defLevels,g.intelInfra,g.blackPrograms);
  const isrB=Math.min(0.10,isrSc*0.01);const lpD=g.intelInfra.listening_posts?0.04:0;
  const abB=g.absorbBonus>0?0.15:0;
  const successRate=Math.min(0.95,op.baseSuccess+(cyberLvl-2)*0.05+budgetBonus+shB+asB+abB+stB+isrB);
  const discoverRate=Math.max(0.05,op.baseDiscover-(cyberLvl-2)*0.03-budgetBonus-shD-asD-lpD);
  const terms=[
    {k:'base',label:`${op.n} base`,d:op.baseSuccess},
    {k:'cyber',label:`Cyber L${cyberLvl} (vs L2)`,d:(cyberLvl-2)*0.05},
    {k:'budget',label:`Agency budget tier ${g.intelBudget||1}`,d:budgetBonus},
    {k:'shadow',label:'Shadow doctrine',d:shB},
    {k:'assets',label:'Asset recruitment program',d:asB},
    {k:'absorb',label:'Absorbed foreign op (one-time)',d:abB},
    {k:'stations',label:`Overseas stations ×${g.intelInfra.overseas_stations||0}`,d:stB},
    {k:'isr',label:`ISR score ${isrSc}`,d:isrB},
    {k:'cap',label:'Cap 95%',d:successRate-(op.baseSuccess+(cyberLvl-2)*0.05+budgetBonus+shB+asB+abB+stB+isrB)},
  ];
  return {op,successRate,discoverRate,terms,cyberLvl,budgetBonus,lpD};
}

// Influence pool and per-nation relation gain (tick: diplomacy phase).
export function influencePool(g){const infPool=(g.influenceBudget||0)*100;const iaW=g.influenceAlloc||{};const totW=Object.values(iaW).reduce((a,b)=>a+(b||0),0);return {infPool,iaW,totW};}
export function influenceGain(g,stability,t,infPool,totW){
  const w=(g.influenceAlloc||{})[t.id]||0;
  const share=totW>0?infPool*(w/totW):0;
  const embMult=g.embassies.has(t.id)?1.8:1;
  const stabConf=stability<40?0.6:stability>75?1.15:1;
  const regControl=g.dominance.regions?.has(t.region)?1.4:1;
  const docInfM=g.doctrine==='hegemon'?1.5:g.doctrine==='fortress'?0.7:g.doctrine==='vanguard'?1+(Object.values(g.defLevels).reduce((a,b)=>a+(b||0),0)/200):1;
  const gain=Math.min(6,(share/40)*embMult*docInfM*stabConf*regControl);
  const terms=[
    {k:'share',label:`Pool share $${Math.round(share)}M of $${infPool}M (weight ${w})`,m:share/40},
    {k:'embassy',label:'Embassy amplifies',m:embMult},
    {k:'doctrine',label:`Doctrine (${g.doctrine||'none'})`,m:docInfM},
    {k:'stability',label:`Your stability ${Math.round(stability)}`,m:stabConf},
    {k:'dominance',label:'You dominate their region',m:regControl},
  ];
  return {w,share,embMult,stabConf,regControl,docInfM,gain,terms};
}

// ── Event cards (E2, #14). One predicate for what is open, shared by the UI and the fuzz: an answered or expired
// event/flashpoint is never a card.
export const openEventCards=(g)=>({
  world:g.worldEvent&&!g.worldEvent.ans&&g.worldEvent.mo>0&&WORLD_RULES[g.worldEvent.id]&&!WORLD_RULES[g.worldEvent.id].instant?g.worldEvent:null,
  flashpoint:g.flashpoint&&g.flashpoint.t>0?g.flashpoint:null,
  decision:g.activeDecision||null,
});
export const eventOptions=(g,kind)=>kind==='flashpoint'?flashpointOptions(g):worldOptions(g);
export { panamaPriorityBlock };

// ── Nation catalogs (E3, #15). One stage rule for the verbs, the tick and the Defense tab.
// Stage of a program for the player: owned or in-service lines are LRIP until six units (full rate if the catalog starts it there);
// a prototype line is Prototype; the SAP R&D slot shows R&D for its first half and Prototype for the second.
export function programStage(g,id){
  const e=catalogEntry(g.country?.id,id);const n=+g.blackPrograms?.[id]||0;const start=e?.start;
  if(n>0||start==='lrip'||start==='full')return start==='full'||n>=6?'full':'lrip';
  if(g.arsenal?.dev?.[id])return 'proto';
  if(g.blackResearch?.id===id)return g.blackResearch.prog<g.blackResearch.mo/2&&start!=='proto'?'rd':'proto';
  return start||null;
}
// Why a catalog action is blocked right now (null = allowed). kind: produce | fund | initiate.
export function programBlock(g,id,kind){
  const bp=BLACK_PROGRAMS[id];const e=catalogEntry(g.country?.id,id);const n=+g.blackPrograms?.[id]||0;const stage=programStage(g,id);const t=g.stats?.treasury||0;
  if(kind==='produce'){
    if(!(n>0||(e&&(stage==='lrip'||stage==='full'))))return `${bp?.n||id} is not in production`;
    const inService=e&&(e.start==='lrip'||e.start==='full');
    if(!inService&&(g.defLevels.materials||0)<4)return 'Production run needs Material Science L4+ (industrial base)';
    const c=trancheCost(bp,n,stage,e?.buy);return t<c?`Need $${c}M for a production run`:null;
  }
  if(!e)return 'Not in your national catalog';
  if(e.start==='lrip'||e.start==='full'||n>0)return `${bp.n} is already in production`;
  if(!g.sapOffice)return 'Establish a SAP office first';
  if(g.arsenal?.dev?.[id]||g.blackResearch?.id===id)return `${bp.n} already funded`;
  if(kind==='initiate'&&g.blackResearch)return 'SAP office already running a program';
  if(!meetsReq(bp.req,g.defLevels))return 'R&D requirements not met';
  return t<devCost(bp,e.start).cost?'Insufficient black budget':null;
}
// The player's catalog as rows for the Defense tab: stage, units, months left, next action and its price or block.
export function programView(g){
  return nationCatalog(g.country?.id).map(e=>{
    const bp=BLACK_PROGRAMS[e.id];const n=+g.blackPrograms?.[e.id]||0;const stage=programStage(g,e.id);
    const d=g.arsenal?.dev?.[e.id];const r=g.blackResearch?.id===e.id?g.blackResearch:null;
    const monthsLeft=d?d.mo-d.prog:r?r.mo-r.prog:null;
    const action=stage==='lrip'||stage==='full'?'produce':d||r?'wait':e.start==='proto'?'fund':'initiate';
    const cost=action==='produce'?trancheCost(bp,n,stage,e.buy):action==='wait'?null:devCost(bp,e.start).cost;
    const months=action==='fund'||action==='initiate'?devCost(bp,e.start).mo:null;
    return {id:e.id,bp,slot:bp.slot,start:e.start,status_source:e.status_source,buy:!!e.buy,n,stage,monthsLeft,action,cost,months,block:action==='wait'?null:programBlock(g,e.id,action)};
  });
}
