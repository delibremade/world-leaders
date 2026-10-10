import { DIP_TARGETS, NATION_BLOC, COUNTRY_RES, GDB, START_DEF } from '../data/nations.js';
import { REGIONS, SPHERE_INIT } from '../data/regions.js';
import { RES_META } from '../data/energy.js';
import { newEvState } from './events.js';

// Canonical game state. Plain JSON-serializable data only: no classes, no functions, no Dates.
// Anything the UI needs to render must live here or be derivable from here by a pure selector.
export const SAVE_VERSION = 58;
// E3 (#15) program state: prototype lines {id:{prog,mo,slipped?}}. Old saves load without it.
export const newArsenal=()=>({dev:{}});

export function newGame({ seed, player = 'usa' }) {
  if (!Number.isInteger(seed)) throw new Error('newGame: seed must be an integer');
  return {
    version: SAVE_VERSION,
    seed,
    player,
    month: 0,
    money: 1000,        // placeholder units until the v57 economy is ported
    stability: 60,      // 0..100
    hegemony: 0,        // 0..100
    rivals: [],         // nation ids; player is NEVER in here (invariant)
    tension: {},        // rivalId -> 0..100; player key is NEVER present (invariant)
    systems: { lastRun: {} }, // systemId -> month it last ran (cadence invariant)
    log: [],            // [{ month, type, text }] capped by tick()
  };
}

// ── v57 game state (P2). One object, one field per v57 ref: the monthly tick (src/sim/tick.js runMonth) reads and
// writes only these. Field names follow the v57 save keys where a save key exists.
export const STATE_FIELDS=Object.freeze([
  'stats','country','issues','investigations','deployments','briefs','date','activeEffects',
  'resources','resExtraction','defLevels','defResearch','spillApplied','globalDef','defExports','sphere',
  'activePolicies','actionCooldowns','darpaDisc','activeDecision','usedDecisions','interestRate','taxPolicy','spendingMode',
  'intelOps','grrbState','budgetAlloc','equilibriumStats','gracePeriod','intelBudget','doctrine','platforms',
  'socialPrograms','victory','hegHold','personnelPay','procureMode','forceDeployments','flashpoint','sphereSnapshot',
  'trendTimer','platformsImported','covertPrograms','foreignOpTimer','absorbBonus','intelInfra','moles','sanctions',
  'importContracts','nationRelations','embassies','influenceAlloc','influenceBudget','proxyAlloc','proxyBudget','sapOffice',
  'blackPrograms','blackResearch','defensePacts','tradeAgreements','continuousOps','expertiseLease','talentRetention','tickCount',
  'ipPortfolio','ipPolicy','dominance','dominanceLeverage','noticeCooldowns','rivalTension','intelPosture','blockades',
  'disinfo','expelled','confrontation','blocTrade','blocLock','opecSwing','worldEvent','demand',
  'currencyPosture','embassyMissions','embassyLocks','ultimatum','pariah','confrontationCooldowns','forcePosture','nukeLog',
  'embargoes','embargoedBy','spr','sprRelease','concessions','chokeStatus','stewardship','exportShare',
  'chokeDeals','platformDev','developed','pathHold','usedTech','rivalHolds','sectorMaturity','sectorAge',
  'prevSectorLevels','decisionTimer','pressureTimer','evState','arsenal',
]);

// Live view over holders of {current} (the App's refs): reads and writes go straight through, so in-month writes
// are visible to the rest of the month and to React updaters that run later, exactly as in v57.
// Sealed: writing a field that is not in STATE_FIELDS throws.
export function stateView(holders){
  const v={};
  for(const k of STATE_FIELDS){
    const h=holders[k];if(!h||!('current' in h))throw new Error('stateView: missing holder for '+k);
    Object.defineProperty(v,k,{get:()=>h.current,set:(x)=>{h.current=x;},enumerable:true});
  }
  for(const k of Object.keys(holders))if(!STATE_FIELDS.includes(k))throw new Error('stateView: unknown field '+k);
  return Object.seal(v);
}

// v57 startGame as data: the opening position of a playable nation (a COUNTRIES entry). Same expressions as v57.
export function openingPosition(c){
  const stats={...c.stats};
  const issues=c.preload.map(t=>({type:t,id:`${t}_init`,status:'unexamined',yr:2024,mo:0}));
  const cres=COUNTRY_RES[c.id]||{};
  const resources={};
  Object.keys(RES_META).forEach(k=>{resources[k]={r:cres[k]||0,max:cres[k]||0};});
  resources.renewable={solar:0,wind:0,hydro:0};
  // Player gets the home-region bonus; rivals start from SPHERE_INIT; the player never appears as a competitor.
  const sphere={};
  Object.entries(REGIONS).forEach(([rid,reg])=>{
    const playerPct=reg.homeFor?.includes(c.id)?60:10;
    const comps={};
    Object.entries(SPHERE_INIT[rid]||{}).forEach(([k,v])=>{if(k!==c.id)comps[k]=v;});
    sphere[rid]={player:playerPct,competitors:comps};
  });
  const globalDef={};
  Object.entries(GDB).forEach(([k,v])=>{if(k!==c.id)globalDef[k]=v;});
  const defLevels={...(START_DEF[c.id]||{})};
  const nationRelations={};DIP_TARGETS.forEach(t=>{const b=NATION_BLOC[t.id],mb=NATION_BLOC[c.id];nationRelations[t.id]=mb&&b===mb?40:b==='neutral'||mb==='neutral'?0:-20;});
  const prevSectorLevels={defense:Object.values(START_DEF[c.id]||{}).reduce((a,b)=>a+(b||0),0),energy:0,healthcare:Math.floor((c.stats.healthcare||0)/20),education:Math.floor((c.stats.education||0)/20),technology:0};
  return {stats,issues,resources,sphere,globalDef,defLevels,nationRelations,prevSectorLevels};
}

// Full month-0 engine state for a fresh session: the App's refs right after startGame and one render
// (startGame values, else the useState initial for ref-synced fields, else the useRef initial).
export function newCampaign(c){
  const o=openingPosition(c);
  const g={
    stats:o.stats,country:c,issues:o.issues,investigations:{},deployments:[],briefs:{},date:{yr:2024,mo:0},activeEffects:[],
    resources:o.resources,resExtraction:{},defLevels:o.defLevels,defResearch:{},spillApplied:new Set(),globalDef:o.globalDef,defExports:{},sphere:o.sphere,
    activePolicies:new Set(),actionCooldowns:{},darpaDisc:{},activeDecision:null,usedDecisions:new Set(),interestRate:c.ir||4.0,taxPolicy:'balanced',spendingMode:'balanced',
    intelOps:[],grrbState:{surveying:false,surveyMo:0,unlocked:false},budgetAlloc:{defense:100,energy:100,healthcare:100,education:100,technology:100},equilibriumStats:{...c.stats},gracePeriod:24,intelBudget:1,doctrine:null,platforms:{},
    socialPrograms:new Set(),victory:false,hegHold:0,personnelPay:100,procureMode:'balanced',forceDeployments:{},flashpoint:null,sphereSnapshot:null,
    trendTimer:0,platformsImported:{},covertPrograms:new Set(),foreignOpTimer:0,absorbBonus:0,intelInfra:{},moles:{},sanctions:new Set(),
    importContracts:new Set(),nationRelations:o.nationRelations,embassies:new Set(),influenceAlloc:{},influenceBudget:0,proxyAlloc:{},proxyBudget:0,sapOffice:false,
    blackPrograms:{},blackResearch:null,defensePacts:new Set(),tradeAgreements:new Set(),continuousOps:{},expertiseLease:0,talentRetention:70,tickCount:0,
    ipPortfolio:0,ipPolicy:'balanced',dominance:{count:0,regions:new Set()},dominanceLeverage:{trade:1,importCut:1},noticeCooldowns:{},rivalTension:{},intelPosture:'quiet',blockades:{},
    disinfo:{},expelled:{},confrontation:null,blocTrade:{eu:0,cn:0,opec:0},blocLock:{},opecSwing:null,worldEvent:null,demand:{},
    currencyPosture:'neutral',embassyMissions:{},embassyLocks:{},ultimatum:null,pariah:0,confrontationCooldowns:{},forcePosture:{},nukeLog:[],
    embargoes:new Set(),embargoedBy:null,spr:0,sprRelease:false,concessions:new Set(),chokeStatus:{},stewardship:{},exportShare:{oil:0.6,gas:0.6},
    chokeDeals:{},platformDev:{},developed:new Set(),pathHold:{econ:0,tech:0,dip:0},usedTech:new Set(),rivalHolds:{},sectorMaturity:{defense:0,energy:0,healthcare:0,education:0,technology:0},sectorAge:{defense:0,energy:0},
    prevSectorLevels:o.prevSectorLevels,decisionTimer:8,pressureTimer:3,evState:newEvState(),arsenal:newArsenal(),
  };
  return Object.seal(g);
}
