// Canonical game state. Plain JSON-serializable data only: no classes, no functions, no Dates.
// Anything the UI needs to render must live here or be derivable from here by a pure selector.
export const SAVE_VERSION = 58;

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
  'prevSectorLevels','decisionTimer','pressureTimer',
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
