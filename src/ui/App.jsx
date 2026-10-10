import { useState, useEffect, useRef, useCallback, Component } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { MONTHS, GOOD, SC, ss, sc } from '../data/stats.js';
import { NATIONS, COUNTRIES, BUYERS, DIP_TARGETS, INTEL_TARGETS, NATION_BLOC, NATION_TRAITS, INTEL_AGENCIES, GDB, RD_MODS } from '../data/nations.js';
import { REGIONS, COMP_COLORS, REGION_GEO, FLASHPOINTS, REGION_BONUS, POSTURE_LABELS } from '../data/regions.js';
import { PLATFORMS, BLACK_PROGRAMS, DV, DEPLOYABLE } from '../data/platforms.js';
import { SOCIAL_PROGRAMS, PA, ISSUES, BASE_SECTOR, SECTOR_GAINS, SECTOR_DECAY, SECTOR_LABELS, IP_POLICY_LABELS } from '../data/economy.js';
import { DOCTRINES, COMP_RESPONSES, WORLD_EVENTS, DECISIONS } from '../data/world.js';
import { COVERT_PROGRAMS, INTEL_INFRA, INTEL_OPS, CRISIS_FRIENDLY, CRISIS_HOSTILE, CRISIS_STOLEN, INTEL_POSTURE_LABELS } from '../data/intel.js';
import { BLOC_TRADE, CURRENCY_LABELS } from '../data/trade.js';
import { CHOKEPOINTS, IMPORT_ROUTES } from '../data/chokepoints.js';
import { RES_META, CONCESSIONS } from '../data/energy.js';
import { sumDep, isAllyOf, topHostile, wSum, isrScore, navalWeight, triadLegs, strategicWeight, kineticDamage, meetsReq, procurementCost, sapRate, sapRunCost, recapCost, calcSCost, getEnergyTier, getQualMult, getRefineMult, getDefLeverage } from '../sim/formulas.js';
import { naturalDrift } from '../sim/economy.js';
import { runMonth } from '../sim/tick.js';
import { applyVerb } from '../sim/actions.js';
import { stateView, openingPosition } from '../sim/state.js';
import { blocTierReqs, blocCanAdvance, euTierNeed, blocGroups } from '../sim/selectors.js';
import { VERSION, BUILD_STAMP } from './version.js';
import { MapView } from './map/MapView.jsx';
import { Hud } from './shell/Hud.jsx';
import { BottomNav } from './shell/BottomNav.jsx';
import { Help } from './shell/Help.jsx';
import { Sheet } from './shell/Sheet.jsx';
import { NationSheet } from './shell/NationSheet.jsx';
import { nationName } from './shell/nation-verbs.js';
import { Outliner } from './shell/Outliner.jsx';
import { buildOutliner } from './shell/outliner.js';
import { newEvState } from '../sim/events.js';
import { openEventCards, eventOptions } from '../sim/selectors.js';
import { EventCards } from './shell/EventCards.jsx';
import { SHELL_CSS } from './shell/styles.js';
const TABS=['overview','sitroom','economy','energy','resources','defense','intel','technology','trade'];
const HELP_TIPS=[['🔍','Investigate issues ($300M, 2 months) for intelligence briefs'],['📋','Deploy briefs — effects apply over time, tracked live'],['🌍','Click map regions to deploy influence actions'],['⚔️','Defense advantage multiplies trade deal outcomes'],['💡','Click any Vital stat to see drivers and interventions'],['🕵️','Defense tab → Intelligence to run covert operations']];
const TAB_SHORT={overview:'Overview',sitroom:'Sit Room',economy:'Economy',energy:'Energy',resources:'Resources',defense:'Defense',intel:'Intel',technology:'Tech',trade:'Trade'};
const TABM={overview:{i:'🌍',l:'Overview'},economy:{i:'💰',l:'Economy'},energy:{i:'⚡',l:'Energy'},resources:{i:'⛏️',l:'Resources'},sitroom:{i:'🎖️',l:'Situation Room'},defense:{i:'🛡️',l:'Defense'},intel:{i:'🕵️',l:'Intel'},technology:{i:'💻',l:'Technology'},trade:{i:'🤝',l:'Trade'}};
function genModelData(sk,cv,opt,drift){return Array.from({length:21},(_,m)=>{const np=cv+drift*m;const pct=Math.min(m/Math.max(opt.tm,1),1);const eff=(opt.fx||[]).find(e=>e.s===sk)?.d||0;const wp=cv+drift*Math.min(m,opt.tm*.5)+eff*pct*(opt.conf/100);return{m,'No Policy':+np.toFixed(2),'With Policy':+wp.toFixed(2)};});}

function WorldLeadersInner({resumeSignal}){
  const [phase,setPhase]=useState('select');
  const [country,setCountry]=useState(null);
  const [stats,setStats]=useState(null);
  const [issues,setIssues]=useState([]);
  const [investigations,setInvestigations]=useState({});
  const [briefs,setBriefs]=useState({});
  const [deployments,setDeployments]=useState([]);
  const [activeEffects,setActiveEffects]=useState([]);
  const [resources,setResources]=useState(null);
  const [resExtraction,setResExtraction]=useState({});
  const [defLevels,setDefLevels]=useState({});
  const [defResearch,setDefResearch]=useState({});
  const [spillApplied,setSpillApplied]=useState(new Set());
  const [globalDef,setGlobalDef]=useState({...GDB});
  const [defExports,setDefExports]=useState({});
  const [sphere,setSphere]=useState({});
  const [selectedRegion,setSelectedRegion]=useState(null);
  const [intelOps,setIntelOps]=useState([]);
  const [intelBudget,setIntelBudget]=useState(1);
  const [budgetAlloc,setBudgetAlloc]=useState({defense:100,energy:100,healthcare:100,education:100,technology:100});
  const [equilibriumStats,setEquilibriumStats]=useState(null);
  const [gracePeriod,setGracePeriod]=useState(0);
  const [doctrine,setDoctrine]=useState(null);
  const [platforms,setPlatforms]=useState({});
  const [socialPrograms,setSocialPrograms]=useState(new Set());
  const [victory,setVictory]=useState(false);
  const [victoryShown,setVictoryShown]=useState(false);
  const [hegHold,setHegHold]=useState(0);
  const [personnelPay,setPersonnelPay]=useState(100);
  const [procureMode,setProcureMode]=useState('balanced');
  const [forceDeployments,setForceDeployments]=useState({});
  const [flashpoint,setFlashpoint]=useState(null);
  const [sphereTrend,setSphereTrend]=useState({});
  const [gameSpeed,setGameSpeed]=useState(1);
  const [platformsImported,setPlatformsImported]=useState({});
  const [covertPrograms,setCovertPrograms]=useState(new Set());
  const [intelInfra,setIntelInfra]=useState({});
  const [moles,setMoles]=useState({});
  const [sanctions,setSanctions]=useState(new Set());
  const [importContracts,setImportContracts]=useState(new Set());
  const [rivalHolds,setRivalHolds]=useState({});
  const [nationRelations,setNationRelations]=useState({});
  const [embassies,setEmbassies]=useState(new Set());
  const [influenceAlloc,setInfluenceAlloc]=useState({});
  const [influenceBudget,setInfluenceBudget]=useState(0);
  const [proxyAlloc,setProxyAlloc]=useState({});
  const [proxyBudget,setProxyBudget]=useState(0);
  const [sapOffice,setSapOffice]=useState(false);
  const [blackPrograms,setBlackPrograms]=useState({});
  const [blackResearch,setBlackResearch]=useState(null);
  const [defensePacts,setDefensePacts]=useState(new Set());
  const [tradeAgreements,setTradeAgreements]=useState(new Set());
  const [selDipNation,setSelDipNation]=useState(null);
  const [continuousOps,setContinuousOps]=useState({});
  const [talentRetention,setTalentRetention]=useState(70);
  const [expertiseLease,setExpertiseLease]=useState(0);
  const [rivalTension,setRivalTension]=useState({});
  const [intelPosture,setIntelPosture]=useState('quiet');
  const [blockades,setBlockades]=useState({});
  const [confrontation,setConfrontation]=useState(null);
  const [blocTrade,setBlocTrade]=useState({eu:0,cn:0,opec:0});
  const [blocLock,setBlocLock]=useState({});
  const [opecSwing,setOpecSwing]=useState(null);
  const [ledger,setLedger]=useState({});
  const [usedTech,setUsedTech]=useState(new Set());
  const [worldEvent,setWorldEvent]=useState(null);
  const [demand,setDemand]=useState({});
  const [currencyPosture,setCurrencyPosture]=useState('neutral');
  const [embassyMissions,setEmbassyMissions]=useState({});
  const [ultimatum,setUltimatum]=useState(null);
  const [pariah,setPariah]=useState(0);
  const [forcePosture,setForcePosture]=useState({});
  const [evState,setEvState]=useState(newEvState());
  const [nukeLog,setNukeLog]=useState([]);
  const [embargoes,setEmbargoes]=useState(new Set());
  const [embargoedBy,setEmbargoedBy]=useState(null);
  const [spr,setSpr]=useState(0);
  const [sprRelease,setSprRelease]=useState(false);
  const [concessions,setConcessions]=useState(new Set());
  const [chokeStatus,setChokeStatus]=useState({});
  const [stewardship,setStewardship]=useState({});
  const [exportShare,setExportShare]=useState({oil:0.6,gas:0.6});
  const [chokeDeals,setChokeDeals]=useState({});
  const [platformDev,setPlatformDev]=useState({});
  const [developed,setDeveloped]=useState(new Set());
  const [victoryType,setVictoryType]=useState('hegemony');
  const [pathHold,setPathHold]=useState({econ:0,tech:0,dip:0});
  const [collapsed,setCollapsed]=useState(new Set());
  const [ipPortfolio,setIpPortfolio]=useState(0);
  const [ipPolicy,setIpPolicy]=useState('balanced');
  const [sectorMaturity,setSectorMaturity]=useState({defense:0,energy:0,healthcare:0,education:0,technology:0});
  const [sectorAge,setSectorAge]=useState({defense:0,energy:0});
  const [intelCrisis,setIntelCrisis]=useState(null);
  const [grrbState,setGrrbState]=useState({surveying:false,surveyMo:0,unlocked:false});
  const [activePolicies,setActivePolicies]=useState(new Set());
  const [actionCooldowns,setActionCooldowns]=useState({});
  const [darpaDisc,setDarpaDisc]=useState({});
  const [activeDecision,setActiveDecision]=useState(null);
  const [usedDecisions,setUsedDecisions]=useState(new Set());
  const [activeTab,setActiveTab]=useState('overview');
  const [mapMode,setMapMode]=useState('sphere');
  const [selNation,setSelNation]=useState(null);      // P3c nation sheet (presentation)
  const [outlinerOpen,setOutlinerOpen]=useState(false);
  const [history,setHistory]=useState([]);            // 24-month HUD sparklines (presentation, not saved)
  const [interestRate,setInterestRate]=useState(4.0);
  const [taxPolicy,setTaxPolicy]=useState(28);
  const [spendingMode,setSpendingMode]=useState('balanced');
  const [selIssue,setSelIssue]=useState(null);
  const [selOption,setSelOption]=useState(null);
  const [intelIssue,setIntelIssue]=useState(null); // Intel tab: the expanded issue (E9, #23)
  const [rightMode,setRightMode]=useState('intel');
  const [selDefVert,setSelDefVert]=useState(null);
  const [selExportVert,setSelExportVert]=useState(null);
  const [selIntelTarget,setSelIntelTarget]=useState(null);
  const [t1Target,setT1Target]=useState(null);
  const [vitalsDrill,setVitalsDrill]=useState(null);
  const [hovOpt,setHovOpt]=useState(null);
  const [date,setDate]=useState({yr:2024,mo:0});
  const [paused,setPaused]=useState(false);
  const [log,setLog]=useState([]);
  const [toasts,setToasts]=useState([]);
  const [statsTrend,setStatsTrend]=useState({});
  const [gameOver,setGameOver]=useState(null);
  const [saveInfo,setSaveInfo]=useState(null);
  const [lastSaved,setLastSaved]=useState(null);

  const sR=useRef(null),cR=useRef(null),issR=useRef([]),invR=useRef({}),depR=useRef([]),brR=useRef({});
  const dateR=useRef({yr:2024,mo:0}),aeR=useRef([]),resR=useRef(null),extR=useRef({});
  const dlR=useRef({}),drR=useRef({}),spR=useRef(new Set()),gdR=useRef({...GDB});
  const exR=useRef({}),sphR=useRef({}),apR=useRef(new Set()),cdR=useRef({});
  const ddR=useRef({}),decR=useRef(null),usedR=useRef(new Set());
  const irR=useRef(4.0),taxR=useRef('balanced'),spdR=useRef('balanced');
  const intelR=useRef([]),grrbR=useRef({surveying:false,surveyMo:0,unlocked:false});
  const budgetR=useRef({defense:100,energy:100,healthcare:100,education:100,technology:100});
  const equilibriumR=useRef(null);
  const graceR=useRef(0);
  const intelBudgetR=useRef(1);
  const doctrineR=useRef(null);
  const platformsR=useRef({});
  const socialR=useRef(new Set());
  const victoryR=useRef(false);
  const hegHoldR=useRef(0);
  const payR=useRef(100);
  const procR=useRef('balanced');
  const fdR=useRef({});
  const fpR=useRef(null);
  const trendSnapR=useRef(null);
  const trendTimerR=useRef(0);
  const impR=useRef({});
  const covR=useRef(new Set());
  const foreignOpR=useRef(0);
  const absorbR=useRef(0);
  const infraR=useRef({});
  const molesR=useRef({});
  const sanctR=useRef(new Set());
  const impCR=useRef(new Set());
  const relR=useRef({});
  const embR=useRef(new Set());
  const iaR=useRef({});
  const ibR=useRef(0);
  const paR=useRef({});
  const pbR=useRef(0);
  const sapR=useRef(false);
  const blackR=useRef({});
  const blackResR=useRef(null);
  const pactR=useRef(new Set());
  const tradeAgR=useRef(new Set());
  const contOpsR=useRef({});
  const leaseR=useRef(0);
  const retR=useRef(70);
  const tickCountR=useRef(0);
  const ipR=useRef(0);
  const ipPolR=useRef('balanced');
  const domR=useRef({count:0,regions:new Set()});
  const domLevR=useRef({trade:1,importCut:1});
  const respCdR=useRef({});
  const tenR=useRef({});
  const postR=useRef('quiet');
  const blkR=useRef({});
  const disinfoR=useRef({});
  const expelR=useRef({});
  const confR=useRef(null);
  const btR=useRef({eu:0,cn:0,opec:0});
  const bLockR=useRef({});
  const swingR=useRef(null);
  const wEvR=useRef(null);
  const demR=useRef({});
  const curR=useRef('neutral');
  const embMisR=useRef({});
  const embLockR=useRef({});
  const ultR=useRef(null);
  const pariahR=useRef(0);
  const confCdR=useRef({});
  const postureR=useRef({});
  const evR=useRef(newEvState());
  const nukeR=useRef([]);
  const embgR=useRef(new Set());
  const embByR=useRef(null);
  const sprR=useRef(0);
  const sprRelR=useRef(false);
  const concR=useRef(new Set());
  const chokeR=useRef({});
  const stewR=useRef({});
  const shareR=useRef({oil:0.6,gas:0.6});
  const cdealR=useRef({});
  const pdevR=useRef({});
  const devR=useRef(new Set());
  const pathHoldR=useRef({econ:0,tech:0,dip:0});
  const usedTechR=useRef(new Set());
  const rivalHoldR=useRef({});
  const maturityR=useRef({defense:0,energy:0,healthcare:0,education:0,technology:0});
  const ageR=useRef({defense:0,energy:0});
  const prevLvlR=useRef({defense:0,energy:0,healthcare:0,education:0,technology:0});
  const toastT=useRef(null),decTimer=useRef(8),compTimer=useRef(3);

  useEffect(()=>{sR.current=stats;},[stats]);
  useEffect(()=>{cR.current=country;},[country]);
  useEffect(()=>{issR.current=issues;},[issues]);
  useEffect(()=>{invR.current=investigations;},[investigations]);
  useEffect(()=>{depR.current=deployments;},[deployments]);
  useEffect(()=>{brR.current=briefs;},[briefs]);
  useEffect(()=>{dateR.current=date;},[date]);
  useEffect(()=>{aeR.current=activeEffects;},[activeEffects]);
  useEffect(()=>{resR.current=resources;},[resources]);
  useEffect(()=>{extR.current=resExtraction;},[resExtraction]);
  useEffect(()=>{dlR.current=defLevels;},[defLevels]);
  useEffect(()=>{drR.current=defResearch;},[defResearch]);
  useEffect(()=>{spR.current=spillApplied;},[spillApplied]);
  useEffect(()=>{gdR.current=globalDef;},[globalDef]);
  useEffect(()=>{exR.current=defExports;},[defExports]);
  useEffect(()=>{sphR.current=sphere;},[sphere]);
  useEffect(()=>{apR.current=activePolicies;},[activePolicies]);
  useEffect(()=>{cdR.current=actionCooldowns;},[actionCooldowns]);
  useEffect(()=>{ddR.current=darpaDisc;},[darpaDisc]);
  useEffect(()=>{irR.current=interestRate;},[interestRate]);
  useEffect(()=>{taxR.current=taxPolicy;},[taxPolicy]);
  useEffect(()=>{spdR.current=spendingMode;},[spendingMode]);
  useEffect(()=>{intelR.current=intelOps;},[intelOps]);
  useEffect(()=>{grrbR.current=grrbState;},[grrbState]);
  useEffect(()=>{usedR.current=usedDecisions;},[usedDecisions]);
  useEffect(()=>{budgetR.current=budgetAlloc;},[budgetAlloc]);
  useEffect(()=>{equilibriumR.current=equilibriumStats;},[equilibriumStats]);
  useEffect(()=>{graceR.current=gracePeriod;},[gracePeriod]);
  useEffect(()=>{intelBudgetR.current=intelBudget;},[intelBudget]);
  useEffect(()=>{doctrineR.current=doctrine;},[doctrine]);
  useEffect(()=>{platformsR.current=platforms;},[platforms]);
  useEffect(()=>{socialR.current=socialPrograms;},[socialPrograms]);
  useEffect(()=>{payR.current=personnelPay;},[personnelPay]);
  useEffect(()=>{procR.current=procureMode;},[procureMode]);
  useEffect(()=>{fdR.current=forceDeployments;},[forceDeployments]);
  useEffect(()=>{impR.current=platformsImported;},[platformsImported]);
  useEffect(()=>{covR.current=covertPrograms;},[covertPrograms]);
  useEffect(()=>{infraR.current=intelInfra;},[intelInfra]);
  useEffect(()=>{molesR.current=moles;},[moles]);
  useEffect(()=>{sanctR.current=sanctions;},[sanctions]);
  useEffect(()=>{impCR.current=importContracts;},[importContracts]);
  useEffect(()=>{relR.current=nationRelations;},[nationRelations]);
  useEffect(()=>{embR.current=embassies;},[embassies]);
  useEffect(()=>{iaR.current=influenceAlloc;},[influenceAlloc]);
  useEffect(()=>{ibR.current=influenceBudget;},[influenceBudget]);
  useEffect(()=>{paR.current=proxyAlloc;},[proxyAlloc]);
  useEffect(()=>{pbR.current=proxyBudget;},[proxyBudget]);
  useEffect(()=>{sapR.current=sapOffice;},[sapOffice]);
  useEffect(()=>{blackR.current=blackPrograms;},[blackPrograms]);
  useEffect(()=>{blackResR.current=blackResearch;},[blackResearch]);
  useEffect(()=>{pactR.current=defensePacts;},[defensePacts]);
  useEffect(()=>{tradeAgR.current=tradeAgreements;},[tradeAgreements]);
  useEffect(()=>{contOpsR.current=continuousOps;},[continuousOps]);
  useEffect(()=>{tenR.current=rivalTension;},[rivalTension]);
  useEffect(()=>{postR.current=intelPosture;},[intelPosture]);
  useEffect(()=>{blkR.current=blockades;},[blockades]);
  useEffect(()=>{btR.current=blocTrade;},[blocTrade]);
  useEffect(()=>{bLockR.current=blocLock;},[blocLock]);
  useEffect(()=>{swingR.current=opecSwing;},[opecSwing]);
  useEffect(()=>{wEvR.current=worldEvent;},[worldEvent]);
  useEffect(()=>{demR.current=demand;},[demand]);
  useEffect(()=>{curR.current=currencyPosture;},[currencyPosture]);
  useEffect(()=>{embMisR.current=embassyMissions;},[embassyMissions]);
  useEffect(()=>{usedTechR.current=usedTech;},[usedTech]);
  useEffect(()=>{postureR.current=forcePosture;},[forcePosture]);
  useEffect(()=>{evR.current=evState;},[evState]);
  useEffect(()=>{embgR.current=embargoes;},[embargoes]);
  useEffect(()=>{sprR.current=spr;},[spr]);
  useEffect(()=>{sprRelR.current=sprRelease;},[sprRelease]);
  useEffect(()=>{concR.current=concessions;},[concessions]);
  useEffect(()=>{stewR.current=stewardship;},[stewardship]);
  useEffect(()=>{shareR.current=exportShare;},[exportShare]);
  useEffect(()=>{cdealR.current=chokeDeals;},[chokeDeals]);
  useEffect(()=>{pdevR.current=platformDev;},[platformDev]);
  useEffect(()=>{devR.current=developed;},[developed]);
  useEffect(()=>{leaseR.current=expertiseLease;},[expertiseLease]);
  useEffect(()=>{ipR.current=ipPortfolio;},[ipPortfolio]);
  useEffect(()=>{ipPolR.current=ipPolicy;},[ipPolicy]);
  useEffect(()=>{maturityR.current=sectorMaturity;},[sectorMaturity]);
  useEffect(()=>{ageR.current=sectorAge;},[sectorAge]);

  const showToast=useCallback(msg=>{
    const sev=/^🚨/.test(msg)?'alert':/^⚠/.test(msg)?'warn':'info';
    const id=Date.now()+Math.random();
    setToasts(p=>[...p.slice(-2),{id,msg,sev}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),sev==='alert'?4600:sev==='warn'?3400:2400);
  },[]);

  const SAVE_VER=52;
  const ser=v=>v instanceof Set?{__set:[...v]}:v;
  const des=v=>(v&&typeof v==='object'&&Array.isArray(v.__set))?new Set(v.__set):v;
  const buildSave=()=>({ver:SAVE_VER,at:Date.now(),countryId:country?.id,doctrine,stats,date,tickCount:tickCountR.current,gracePeriod,issues,activeEffects,resources,resExtraction,defLevels,defResearch,spillApplied:ser(spillApplied),globalDef,defExports,sphere,intelOps,intelBudget,budgetAlloc,equilibriumStats,platforms,platformsImported,socialPrograms:ser(socialPrograms),victory,victoryShown,victoryType,hegHold,pathHold,personnelPay,procureMode,forceDeployments,flashpoint,gameSpeed,covertPrograms:ser(covertPrograms),intelInfra,moles,sanctions:ser(sanctions),importContracts:ser(importContracts),rivalHolds,nationRelations,embassies:ser(embassies),embassyMissions,influenceAlloc,influenceBudget,proxyAlloc,proxyBudget,sapOffice,blackPrograms,blackResearch,defensePacts:ser(defensePacts),tradeAgreements:ser(tradeAgreements),continuousOps,talentRetention,expertiseLease,rivalTension,intelPosture,blockades,blocTrade,blocLock,opecSwing,usedTech:ser(usedTech),worldEvent,demand,currencyPosture,ipPortfolio,ipPolicy,sectorMaturity,sectorAge,grrbState,activePolicies:ser(activePolicies),actionCooldowns,darpaDisc,usedDecisions:ser(usedDecisions),interestRate,taxPolicy,spendingMode,log,gameOver,
    forcePosture,evState,spr,sprRelease,concessions:ser(concessions),stewardship,exportShare,chokeDeals,platformDev,developed:ser(developed),nukeLog,embargoes:ser(embargoes),embargoedBy,refs:{respCd:respCdR.current,disinfo:disinfoR.current,expel:expelR.current,embLock:embLockR.current,ret:retR.current,ip:ipR.current,pariah:pariahR.current,confCd:confCdR.current}});
  const saveGame=async()=>{try{if(!window.storage||phase!=='play'||!country)return;await window.storage.set('wl_save',JSON.stringify(buildSave()));setLastSaved(`${MONTHS[date.mo]} ${date.yr}`);}catch(e){}};
  const restoreGame=async()=>{try{
    const r=await window.storage.get('wl_save');const g=JSON.parse(r.value);if(!g||g.ver!==SAVE_VER)return false;
    const cc=COUNTRIES.find(x=>x.id===g.countryId);if(!cc)return false;
    const S=(setter,ref,v)=>{setter(v);if(ref)ref.current=v;};
    setCountry(cc);cR.current=cc;S(setStats,sR,g.stats);S(setDate,dateR,g.date);tickCountR.current=g.tickCount||0;
    S(setDoctrine,doctrineR,g.doctrine);S(setGracePeriod,graceR,g.gracePeriod);setIssues(g.issues||[]);setActiveEffects(g.activeEffects||[]);
    setResources(g.resources);setResExtraction(g.resExtraction||{});S(setDefLevels,dlR,g.defLevels||{});setDefResearch(g.defResearch||{});setSpillApplied(des(g.spillApplied)||new Set());
    setGlobalDef(g.globalDef||{});S(setDefExports,exR,g.defExports||{});S(setSphere,sphR,g.sphere||{});setIntelOps(g.intelOps||[]);S(setIntelBudget,intelBudgetR,g.intelBudget??1);
    S(setBudgetAlloc,budgetR,g.budgetAlloc||{});S(setEquilibriumStats,equilibriumR,g.equilibriumStats||g.stats);S(setPlatforms,platformsR,g.platforms||{});S(setPlatformsImported,impR,g.platformsImported||{});
    S(setSocialPrograms,socialR,des(g.socialPrograms)||new Set());setVictory(!!g.victory);victoryR.current=!!g.victory;setVictoryShown(!!g.victoryShown);setVictoryType(g.victoryType||'hegemony');
    S(setHegHold,hegHoldR,g.hegHold||0);S(setPathHold,pathHoldR,g.pathHold||{econ:0,tech:0,dip:0});S(setPersonnelPay,payR,g.personnelPay??100);S(setProcureMode,procR,g.procureMode||'balanced');
    S(setForceDeployments,fdR,g.forceDeployments||{});S(setFlashpoint,fpR,g.flashpoint||null);setGameSpeed(g.gameSpeed||1);
    S(setCovertPrograms,covR,des(g.covertPrograms)||new Set());S(setIntelInfra,infraR,g.intelInfra||{});S(setMoles,molesR,g.moles||{});S(setSanctions,sanctR,des(g.sanctions)||new Set());
    S(setImportContracts,impCR,des(g.importContracts)||new Set());S(setRivalHolds,rivalHoldR,g.rivalHolds||{});S(setNationRelations,relR,g.nationRelations||{});S(setEmbassies,embR,des(g.embassies)||new Set());
    S(setEmbassyMissions,embMisR,g.embassyMissions||{});S(setInfluenceAlloc,iaR,g.influenceAlloc||{});S(setInfluenceBudget,ibR,g.influenceBudget||0);S(setProxyAlloc,paR,g.proxyAlloc||{});S(setProxyBudget,pbR,g.proxyBudget||0);
    S(setSapOffice,sapR,!!g.sapOffice);S(setBlackPrograms,blackR,g.blackPrograms||{});S(setBlackResearch,blackResR,g.blackResearch||null);S(setDefensePacts,pactR,des(g.defensePacts)||new Set());S(setTradeAgreements,tradeAgR,des(g.tradeAgreements)||new Set());
    S(setContinuousOps,contOpsR,g.continuousOps||{});setTalentRetention(g.talentRetention??70);retR.current=g.refs?.ret??g.talentRetention??70;S(setExpertiseLease,leaseR,g.expertiseLease||0);
    S(setRivalTension,tenR,g.rivalTension||{});S(setIntelPosture,postR,g.intelPosture||'quiet');S(setBlockades,blkR,g.blockades||{});S(setBlocTrade,btR,g.blocTrade||{eu:0,cn:0,opec:0});S(setBlocLock,bLockR,g.blocLock||{});S(setOpecSwing,swingR,g.opecSwing||null);
    S(setUsedTech,usedTechR,des(g.usedTech)||new Set());S(setWorldEvent,wEvR,g.worldEvent||null);S(setDemand,demR,g.demand||{});S(setCurrencyPosture,curR,g.currencyPosture||'neutral');
    setIpPortfolio(g.ipPortfolio||0);ipR.current=g.refs?.ip??g.ipPortfolio??0;S(setIpPolicy,ipPolR,g.ipPolicy||'balanced');S(setSectorMaturity,maturityR,g.sectorMaturity||{});S(setSectorAge,ageR,g.sectorAge||{});
    S(setGrrbState,grrbR,g.grrbState||{surveying:false,surveyMo:0,unlocked:false});S(setActivePolicies,apR,des(g.activePolicies)||new Set());S(setActionCooldowns,cdR,g.actionCooldowns||{});setDarpaDisc(g.darpaDisc||0);S(setUsedDecisions,usedR,des(g.usedDecisions)||new Set());
    S(setInterestRate,irR,g.interestRate??4);S(setTaxPolicy,taxR,g.taxPolicy??28);S(setSpendingMode,spdR,g.spendingMode||'balanced');setLog(g.log||[]);setGameOver(g.gameOver||null);
    respCdR.current=g.refs?.respCd||{};disinfoR.current=g.refs?.disinfo||{};pariahR.current=g.refs?.pariah||0;setPariah(pariahR.current);confCdR.current=g.refs?.confCd||{};S(setForcePosture,postureR,g.forcePosture||{});S(setEvState,evR,g.evState||newEvState());S(setSpr,sprR,g.spr||0);S(setSprRelease,sprRelR,!!g.sprRelease);S(setConcessions,concR,des(g.concessions)||new Set());S(setStewardship,stewR,g.stewardship||{});S(setExportShare,shareR,g.exportShare||{oil:0.6,gas:0.6});S(setChokeDeals,cdealR,g.chokeDeals||{});S(setPlatformDev,pdevR,g.platformDev||{});S(setDeveloped,devR,des(g.developed)||new Set());setNukeLog(g.nukeLog||[]);nukeR.current=g.nukeLog||[];S(setEmbargoes,embgR,des(g.embargoes)||new Set());setEmbargoedBy(g.embargoedBy||null);embByR.current=g.embargoedBy||null;expelR.current=g.refs?.expel||{};embLockR.current=g.refs?.embLock||{};
    setActiveTab('overview');setPhase('play');setLastSaved(`${MONTHS[g.date.mo]} ${g.date.yr}`);return true;}catch(e){try{console.error('restore failed',e);}catch(x){}return false;}};
  useEffect(()=>{(async()=>{try{if(!window.storage)return;const r=await window.storage.get('wl_save');const g=JSON.parse(r.value);if(g&&g.ver===SAVE_VER&&g.countryId){const cc=COUNTRIES.find(x=>x.id===g.countryId);setSaveInfo({flag:cc?.flag,name:cc?.n||g.countryId,when:`${MONTHS[g.date.mo]} ${g.date.yr}`});}}catch(e){}})();},[resumeSignal]);
  useEffect(()=>{if(phase==='play'&&date.mo%3===0&&tickCountR.current>0)saveGame();},[date.mo,date.yr,phase]);
  useEffect(()=>{try{if(typeof window!=='undefined'&&window.__WL_TEST){window.__wl={month:()=>tick(),setTension:(cid,v)=>{setRivalTension(p=>({...p,[cid]:v}));tenR.current={...tenR.current,[cid]:v};},field:(id,n)=>{blackR.current={...blackR.current,[id]:n};setBlackPrograms({...blackR.current});},fund:v=>setStats(p=>({...p,treasury:v})),platforms:o=>{platformsR.current={...platformsR.current,...o};setPlatforms({...platformsR.current});},levels:o=>{dlR.current={...dlR.current,...o};setDefLevels({...dlR.current});},event:(id,mo)=>{wEvR.current={id,mo};setWorldEvent({id,mo});},flashpoint:(rid,type,t)=>{const fp={rid,type,t};fpR.current=fp;setFlashpoint(fp);},deploy:(rid,pid,n)=>{setForceDeployments(pr=>{const n2={...pr,[rid]:{...(pr[rid]||{}),[pid]:n}};fdR.current=n2;return n2;});},stat:(k,v)=>{setStats(p=>({...p,[k]:v}));if(sR.current)sR.current={...sR.current,[k]:v};},rel:(id,v)=>{setNationRelations(p=>({...p,[id]:v}));relR.current={...relR.current,[id]:v};},unfreeze:()=>{setBlocLock({});bLockR.current={};},embargoBy:(by,mo)=>{const e={by,mo};embByR.current=e;setEmbargoedBy(e);},imports:(ks)=>{const n2=new Set(ks);impCR.current=n2;setImportContracts(n2);},sanction:(id)=>{setSanctions(prev=>{const n2=new Set(prev);n2.add(id);sanctR.current=n2;return n2;});}};}}catch(e){}},[]);
  const startGame=useCallback(c=>{
    const {stats:s,issues:pre,resources:initRes,sphere:initSphere,globalDef:excGDB,defLevels:sd,nationRelations:baseRel,prevSectorLevels}=openingPosition(c);
    setCountry(c);setStats(s);setIssues(pre);setInterestRate(c.ir||4.0);
    setResources(initRes);setResExtraction({});setSphere(initSphere);
    setGlobalDef(excGDB);gdR.current=excGDB;
    cR.current=c;sR.current=s;issR.current=pre;irR.current=c.ir||4.0;
    resR.current=initRes;extR.current={};sphR.current=initSphere;
    setBriefs({});brR.current={};setDeployments([]);depR.current=[];
    setActiveEffects([]);aeR.current=[];
    setInvestigations({});invR.current={};setActionCooldowns({});cdR.current={};
    setDefLevels(sd);dlR.current=sd;setDefResearch({});drR.current={};
    setSpillApplied(new Set());spR.current=new Set();
    setDefExports({});exR.current={};setDarpaDisc({});ddR.current={};
    setActivePolicies(new Set());apR.current=new Set();
    setActiveDecision(null);decR.current=null;
    setUsedDecisions(new Set());usedR.current=new Set();
    setIntelOps([]);intelR.current=[];setIntelCrisis(null);
    setBudgetAlloc({defense:100,energy:100,healthcare:100,education:100,technology:100});
    setEquilibriumStats({...c.stats});equilibriumR.current={...c.stats};
    setGracePeriod(24);graceR.current=24;
    setIntelBudget(1);intelBudgetR.current=1;
    setDoctrine(null);doctrineR.current=null;
    setPlatforms({});platformsR.current={};
    setSocialPrograms(new Set());socialR.current=new Set();
    setVictory(false);setVictoryShown(false);victoryR.current=false;
    setHegHold(0);hegHoldR.current=0;
    setPersonnelPay(100);payR.current=100;
    setProcureMode('balanced');procR.current='balanced';
    setForceDeployments({});fdR.current={};
    setGameSpeed(1);
    setPlatformsImported({});impR.current={};
    setCovertPrograms(new Set());covR.current=new Set();foreignOpR.current=0;absorbR.current=0;
    setIntelInfra({});infraR.current={};setMoles({});molesR.current={};setSanctions(new Set());sanctR.current=new Set();
    setImportContracts(new Set());impCR.current=new Set();setRivalHolds({});rivalHoldR.current={};
    setNationRelations(baseRel);relR.current=baseRel;
    setEmbassies(new Set());embR.current=new Set();
    setInfluenceAlloc({});iaR.current={};setInfluenceBudget(0);ibR.current=0;
    setDefensePacts(new Set());pactR.current=new Set();setTradeAgreements(new Set());tradeAgR.current=new Set();setSelDipNation(null);
    setContinuousOps({});contOpsR.current={};setTalentRetention(70);setExpertiseLease(0);leaseR.current=0;retR.current=70;tickCountR.current=0;respCdR.current={};setRivalTension({});tenR.current={};setIntelPosture('quiet');postR.current='quiet';setBlockades({});blkR.current={};setConfrontation(null);disinfoR.current={};expelR.current={};setBlocTrade({eu:0,cn:0,opec:0});btR.current={eu:0,cn:0,opec:0};setBlocLock({});bLockR.current={};setOpecSwing(null);swingR.current=null;setUsedTech(new Set());setWorldEvent(null);wEvR.current=null;setDemand({});demR.current={};setCurrencyPosture('neutral');curR.current='neutral';setEmbassyMissions({});embMisR.current={};embLockR.current={};setUltimatum(null);ultR.current=null;setPariah(0);pariahR.current=0;confCdR.current={};setForcePosture({});postureR.current={};setEvState(newEvState());evR.current=newEvState();setNukeLog([]);nukeR.current=[];setEmbargoes(new Set());embgR.current=new Set();setEmbargoedBy(null);embByR.current=null;setSpr(0);sprR.current=0;setSprRelease(false);sprRelR.current=false;setConcessions(new Set());concR.current=new Set();setChokeStatus({});chokeR.current={};setStewardship({});stewR.current={};setExportShare({oil:0.6,gas:0.6});shareR.current={oil:0.6,gas:0.6};setChokeDeals({});cdealR.current={};setPlatformDev({});pdevR.current={};setDeveloped(new Set());devR.current=new Set();setVictoryType('hegemony');setPathHold({econ:0,tech:0,dip:0});pathHoldR.current={econ:0,tech:0,dip:0};setIpPortfolio(0);ipR.current=0;setIpPolicy('balanced');ipPolR.current='balanced';
    setProxyAlloc({});paR.current={};setProxyBudget(0);pbR.current=0;
    setSapOffice(false);sapR.current=false;setBlackPrograms({});blackR.current={};setBlackResearch(null);blackResR.current=null;
    setFlashpoint(null);fpR.current=null;
    setSphereTrend({});trendSnapR.current=null;trendTimerR.current=0;
    budgetR.current={defense:100,energy:100,healthcare:100,education:100,technology:100};
    setSectorMaturity({defense:0,energy:0,healthcare:0,education:0,technology:0});
    maturityR.current={defense:0,energy:0,healthcare:0,education:0,technology:0};
    setSectorAge({defense:0,energy:0});ageR.current={defense:0,energy:0};
    prevLvlR.current=prevSectorLevels;
    setGrrbState({surveying:false,surveyMo:0,unlocked:false});grrbR.current={surveying:false,surveyMo:0,unlocked:false};
    taxR.current='balanced';setTaxPolicy('balanced');
    spdR.current='balanced';setSpendingMode('balanced');
    decTimer.current=8;compTimer.current=3;
    setDate({yr:2024,mo:0});dateR.current={yr:2024,mo:0};
    setPaused(false);setGameOver(null);setSelIssue(null);setSelOption(null);
    setSelDefVert(null);setSelIntelTarget(null);setVitalsDrill(null);setRightMode('intel');setActiveTab('overview');
    setLog([{msg:`🏛️ Government of ${c.name} established.`,yr:2024,mo:0}]);
    setPhase('play');
  },[]);

  // Engine seam (src/sim): a live view over the refs, the setter sink, and presentation effects, built per call from
  // stable refs/setters so nothing goes stale. The monthly tick runs runMonth (tick.js); every player verb is a
  // dispatch({type, payload}) into applyVerb (actions.js). The UI keeps only presentation state.
  const evView={worldEvent,flashpoint,stats:stats||{},spr,forceDeployments,chokeDeals,country,nationRelations,date,rivalTension,activeDecision};
  const evOpen=openEventCards(evView);
  const liveState=()=>stateView({stats:sR,country:cR,issues:issR,investigations:invR,deployments:depR,briefs:brR,date:dateR,activeEffects:aeR,resources:resR,resExtraction:extR,defLevels:dlR,defResearch:drR,spillApplied:spR,globalDef:gdR,defExports:exR,sphere:sphR,activePolicies:apR,actionCooldowns:cdR,darpaDisc:ddR,activeDecision:decR,usedDecisions:usedR,interestRate:irR,taxPolicy:taxR,spendingMode:spdR,intelOps:intelR,grrbState:grrbR,budgetAlloc:budgetR,equilibriumStats:equilibriumR,gracePeriod:graceR,intelBudget:intelBudgetR,doctrine:doctrineR,platforms:platformsR,socialPrograms:socialR,victory:victoryR,hegHold:hegHoldR,personnelPay:payR,procureMode:procR,forceDeployments:fdR,flashpoint:fpR,sphereSnapshot:trendSnapR,trendTimer:trendTimerR,platformsImported:impR,covertPrograms:covR,foreignOpTimer:foreignOpR,absorbBonus:absorbR,intelInfra:infraR,moles:molesR,sanctions:sanctR,importContracts:impCR,nationRelations:relR,embassies:embR,influenceAlloc:iaR,influenceBudget:ibR,proxyAlloc:paR,proxyBudget:pbR,sapOffice:sapR,blackPrograms:blackR,blackResearch:blackResR,defensePacts:pactR,tradeAgreements:tradeAgR,continuousOps:contOpsR,expertiseLease:leaseR,talentRetention:retR,tickCount:tickCountR,ipPortfolio:ipR,ipPolicy:ipPolR,dominance:domR,dominanceLeverage:domLevR,noticeCooldowns:respCdR,rivalTension:tenR,intelPosture:postR,blockades:blkR,disinfo:disinfoR,expelled:expelR,confrontation:confR,blocTrade:btR,blocLock:bLockR,opecSwing:swingR,worldEvent:wEvR,demand:demR,currencyPosture:curR,embassyMissions:embMisR,embassyLocks:embLockR,ultimatum:ultR,pariah:pariahR,confrontationCooldowns:confCdR,forcePosture:postureR,evState:evR,nukeLog:nukeR,embargoes:embgR,embargoedBy:embByR,spr:sprR,sprRelease:sprRelR,concessions:concR,chokeStatus:chokeR,stewardship:stewR,exportShare:shareR,chokeDeals:cdealR,platformDev:pdevR,developed:devR,pathHold:pathHoldR,usedTech:usedTechR,rivalHolds:rivalHoldR,sectorMaturity:maturityR,sectorAge:ageR,prevSectorLevels:prevLvlR,decisionTimer:decTimer,pressureTimer:compTimer});
  const sink={setCountry,setStats,setIssues,setInvestigations,setBriefs,setDeployments,setActiveEffects,setResources,setResExtraction,setDefLevels,setDefResearch,setSpillApplied,setGlobalDef,setDefExports,setSphere,setIntelOps,setIntelBudget,setBudgetAlloc,setEquilibriumStats,setGracePeriod,setDoctrine,setPlatforms,setSocialPrograms,setVictory,setHegHold,setPersonnelPay,setProcureMode,setForceDeployments,setFlashpoint,setSphereTrend,setPlatformsImported,setCovertPrograms,setIntelInfra,setMoles,setSanctions,setImportContracts,setRivalHolds,setNationRelations,setEmbassies,setInfluenceAlloc,setInfluenceBudget,setProxyAlloc,setProxyBudget,setSapOffice,setBlackPrograms,setBlackResearch,setDefensePacts,setTradeAgreements,setContinuousOps,setTalentRetention,setExpertiseLease,setRivalTension,setIntelPosture,setBlockades,setConfrontation,setBlocTrade,setBlocLock,setOpecSwing,setLedger,setUsedTech,setWorldEvent,setDemand,setCurrencyPosture,setEmbassyMissions,setUltimatum,setPariah,setForcePosture,setEvState,setNukeLog,setEmbargoes,setEmbargoedBy,setSpr,setSprRelease,setConcessions,setChokeStatus,setStewardship,setExportShare,setChokeDeals,setPlatformDev,setDeveloped,setVictoryType,setPathHold,setIpPortfolio,setIpPolicy,setSectorMaturity,setSectorAge,setIntelCrisis,setGrrbState,setActivePolicies,setActionCooldowns,setDarpaDisc,setActiveDecision,setUsedDecisions,setInterestRate,setTaxPolicy,setSpendingMode,setDate,setLog,setStatsTrend,setGameOver};
  const engineFx={toast:showToast,now:()=>Date.now(),defer:(fn,ms)=>setTimeout(fn,ms)};
  const dispatch=useCallback(a=>applyVerb(liveState(),sink,engineFx,a),[showToast]);

  // Monthly tick: the engine lives in src/sim/tick.js (runMonth). The component supplies a live view of its refs,
  // its setters, and presentation effects. Built per call from stable refs/setters, so nothing goes stale.
  const tick=useCallback(()=>{
   try{
    const g=liveState();
    runMonth(g,sink,engineFx);
   }catch(err){try{console.error('tick fault',err);showToast(`⚠ Simulation fault caught: ${String(err?.message||err).slice(0,70)}`);}catch(e){}}
  },[showToast]);

  useEffect(()=>{if(phase!=='play'||paused||gameOver||intelCrisis||(victory&&!victoryShown)||confrontation||ultimatum||(activeTab==='overview'&&selectedRegion&&flashpoint&&flashpoint.rid===selectedRegion))return;const id=setInterval(tick,2000/gameSpeed);return()=>clearInterval(id);},[phase,paused,gameOver,intelCrisis,victory,victoryShown,confrontation,ultimatum,activeTab,selectedRegion,flashpoint,tick,gameSpeed]);
  // ── HELPERS ────────────────────────────────────────────────────────────────
  // Render-time cost helpers (use state, not refs)
  const rMatDisc=s=>Math.min(0.4,Math.floor((sectorMaturity[s]||0)/12)*0.05);
  const rSCost=(s,a)=>BASE_SECTOR[s]*(1-rMatDisc(s))*Math.pow((a||100)/100,2.5);
  const fxBadge=(k,v,sm)=>{const ok=typeof v==='number'&&!isNaN(v);const pos=ok&&((GOOD.includes(k)&&v>0)||(!GOOD.includes(k)&&v<0));const d=ok?(Math.abs(v)<10?v.toFixed(1):String(Math.round(v))):String(v??'');return <span key={k} style={{fontSize:sm?'10px':'11px',padding:'2px 6px',background:'rgba(0,0,0,.4)',border:'1px solid #374151',borderRadius:'4px',color:pos?'#4ade80':'#ef4444',fontWeight:600,marginRight:'3px'}}>{SC[k]?.label||k}: {ok&&v>0?'+':''}{d}</span>;};
  const StatBar=({k,val,onClick})=>{
    if(!SC[k]||val==null||isNaN(val))return null;
    const st=ss(k,val);const col=sc(st);
    const fill=k==='treasury'?Math.max(0,Math.min(100,(val/8000)*100)):k==='debtGdp'?Math.max(0,Math.min(100,(val/300)*100)):k==='gdpGrowth'?Math.max(0,Math.min(100,((val+8)/33)*100)):k==='unemployment'||k==='inflation'?Math.max(0,Math.min(100,(val/50)*100)):Math.max(0,Math.min(100,val));
    const netEffect=activeEffects.filter(e=>e.stat===k).reduce((s,e)=>s+e.d,0);
    return <div style={{marginBottom:'10px',cursor:'pointer',padding:'4px',borderRadius:'5px',border:`1px solid ${vitalsDrill===k?col+'66':'transparent'}`}} onClick={()=>setVitalsDrill(vitalsDrill===k?null:k)}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
        <span style={{fontSize:'12px',color:'#9ca3af'}}>{SC[k].label}</span>
        <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
          {netEffect!==0&&<span style={{fontSize:'10px',color:netEffect>0?'#4ade80':'#ef4444'}}>{netEffect>0?'▲':'▼'}</span>}
          <span style={{fontSize:'13px',fontWeight:700,color:col}}>{SC[k]?.fmt?.(val)||String(Math.round(val))}</span>
        </div>
      </div>
      <div style={{height:'3px',background:'#1f2937',borderRadius:'2px'}}><div style={{height:'100%',width:`${fill}%`,background:col,borderRadius:'2px',transition:'width .5s'}}/></div>
    </div>;
  };
  // Plain render helper (not a component: an inner component would remount every render)
  const panelBox=(id,title,accent,content)=>{const open=!collapsed.has(id);
    const toggle=()=>setCollapsed(p=>{const n2=new Set(p);if(n2.has(id))n2.delete(id);else n2.add(id);return n2;});
    return <div key={id} style={{background:'#0d1117',border:`1px solid ${accent}`,borderRadius:'10px',overflow:'hidden'}}>
      <button onClick={toggle} style={{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',background:'transparent',border:'none',padding:'9px 11px',color:'#9ca3af',fontSize:'10px',textTransform:'uppercase',letterSpacing:'1px',textAlign:'left',cursor:'pointer'}}><span>{title}</span><span style={{color:'#4b5563'}}>{open?'▾':'▸'}</span></button>
      {open&&<div style={{padding:'0 11px 11px'}}>{content}</div>}
    </div>;};
  const ActionCard=({action,label})=>{
    const cd=actionCooldowns[action.id]||0;const onCd=cd>0;
    const why=action.why;
    const blocked=(action.blocks||[]).some(bid=>(actionCooldowns[bid]||0)>0);
    const restricted=(action.of&&!action.of.includes(country?.id))||(action.excludedFor?.includes(country?.id));
    const runningEffects=activeEffects.filter(e=>e.source===action.id&&e.monthsLeft>0);
    const isRunning=runningEffects.length>0;
    const lev=getDefLeverage(defLevels,globalDef,country?.id||'');
    const leverageNote=lev>1.1&&action.t==='trade'?` (+${Math.round((lev-1)*100)}% defense leverage)`:'';
    return <div style={{background:'#0d1117',border:`1px solid ${onCd||blocked||restricted?'#1f2937':'#1f2937'}`,borderRadius:'8px',padding:'13px',opacity:onCd||blocked||restricted?0.5:1}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'7px'}}><span style={{fontSize:'18px'}}>{action.i}</span><div style={{fontSize:'13px',fontWeight:700,color:'#f9fafb'}}>{label||action.n}</div></div>
        <div style={{fontSize:'12px',color:action.cost<0?'#4ade80':action.cost===0?'#9ca3af':'#f87171',fontWeight:700,flexShrink:0,marginLeft:'6px'}}>{action.cost<0?`+$${Math.abs(action.cost).toLocaleString()}M`:action.cost===0?'Free':`$${action.cost.toLocaleString()}M`}</div>
      </div>
      <div style={{fontSize:'12px',color:'#9ca3af',marginBottom:'7px'}}>{action.d}{leverageNote&&<span style={{color:'#4ade80',fontSize:'11px'}}>{leverageNote}</span>}{why&&<div style={{fontSize:'9px',color:'#60a5fa',marginTop:'3px'}}>Unlocked by: {why}</div>}</div>
      {(action.tx||[]).length>0&&<div style={{fontSize:'10px',color:'#6b7280',marginBottom:'6px'}}>Ongoing: {action.tx.map(t=>`${SC[t.stat]?.label||t.stat} ${t.d>0?'+':''}${t.d}/mo×${t.mo}mo`).join(', ')}</div>}
      <div style={{display:'flex',gap:'3px',flexWrap:'wrap',marginBottom:'7px'}}>{Object.entries(action.fx||{}).map(([k,v])=>fxBadge(k,v,true))}</div>
      {restricted?<div style={{fontSize:'11px',color:'#6b7280',padding:'5px 8px',background:'#111827',borderRadius:'4px'}}>Not available for {country?.name}</div>
       :blocked?<div style={{fontSize:'11px',color:'#f0c040',padding:'5px 8px',background:'rgba(240,192,64,.08)',borderRadius:'4px'}}>Blocked by active conflicting policy</div>
       :onCd?<div style={{fontSize:'11px',color:'#f0c040',padding:'5px 8px',background:'rgba(240,192,64,.08)',borderRadius:'4px'}}>Cooldown: {cd} months</div>
       :isRunning?<div style={{fontSize:'11px',color:'#4ade80',padding:'5px 8px',background:'rgba(74,222,128,.08)',borderRadius:'4px'}}>● Active — {Math.max(...runningEffects.map(e=>e.monthsLeft))}mo remaining</div>
       :<button onClick={()=>dispatch({type:'executePolicy',payload:{id:action.id}})} style={{width:'100%',background:'#1d4ed8',border:'none',color:'white',padding:'7px',borderRadius:'5px',fontSize:'12px',fontWeight:600}}>Execute</button>}
      {action.cd>0&&!onCd&&<div style={{fontSize:'10px',color:'#4b5563',marginTop:'3px',textAlign:'center'}}>{action.cd}-month cooldown</div>}
    </div>;
  };

  // P3c HUD sparklines: 24-month presentation history (not saved). Hooks must precede the select-phase return.
  const hegRef=useRef(0);
  useEffect(()=>{if(phase!=='play'||!stats){if(phase!=='play')setHistory(h=>h.length?[]:h);return;}setHistory(h=>{const t=`${date.yr}-${date.mo}`;if(h.length&&h[h.length-1].t===t)return h;return [...h.slice(-23),{t,treasury:stats.treasury,stability:stats.stability,heg:hegRef.current}];});},[phase,date.mo,date.yr]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SELECT ──────────────────────────────────────────────────────────────────
  if(phase==='select')return(
    <div style={{background:'#06090d',minHeight:'100vh',color:'#d1d5db',fontFamily:"'SF Pro Display',-apple-system,'Segoe UI',Roboto,'Helvetica Neue',sans-serif",WebkitFontSmoothing:'antialiased',padding:'36px 20px',backgroundImage:'radial-gradient(ellipse at 50% -20%,rgba(30,60,100,.4) 0%,transparent 60%)'}}>
      <style>{`.cc{transition:border-color .2s,transform .15s,box-shadow .2s}.cc:hover{border-color:#3b82f6!important;transform:translateY(-3px);box-shadow:0 8px 32px rgba(59,130,246,.2)} ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-track{background:#0a0e14} ::-webkit-scrollbar-thumb{background:#374151;border-radius:3px}`}</style>
      <div style={{textAlign:'center',marginBottom:'40px'}}>
        <div style={{fontSize:'11px',letterSpacing:'5px',color:'#3b82f6',marginBottom:'12px',textTransform:'uppercase'}}>▸ COMMAND TERMINAL · {BUILD_STAMP} ◂</div>
        <h1 style={{fontSize:'42px',fontWeight:900,margin:'0 0 8px',color:'#f9fafb',fontFamily:'Georgia,serif',letterSpacing:'-1px'}}>WORLD LEADERS</h1>
        <p style={{color:'#6b7280',fontSize:'13px',letterSpacing:'2px',textTransform:'uppercase',margin:0}}>Govern. Compete. Dominate. Survive.</p>
        {saveInfo&&<div style={{margin:'14px auto 0',maxWidth:'520px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'10px',background:'#0d1117',border:'1px solid #4ade80',borderRadius:'8px',padding:'10px 14px'}}>
          <span style={{fontSize:'12px',color:'#e5e7eb'}}>💾 Saved campaign: <b>{saveInfo.flag} {saveInfo.name}</b> · {saveInfo.when}</span>
          <span style={{display:'flex',gap:'6px'}}><button onClick={()=>restoreGame()} style={{background:'#14532d',border:'1px solid #4ade80',color:'#4ade80',padding:'6px 14px',borderRadius:'5px',fontSize:'12px',fontWeight:700}}>▶ Resume</button><button onClick={async()=>{try{await window.storage.delete('wl_save');}catch(e){}setSaveInfo(null);}} style={{background:'transparent',border:'1px solid #374151',color:'#6b7280',padding:'6px 10px',borderRadius:'5px',fontSize:'11px'}}>Discard</button></span>
        </div>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(265px,1fr))',gap:'14px',maxWidth:'1200px',margin:'0 auto'}}>
        {COUNTRIES.map(c=>(
          <div key={c.id} className="cc" onClick={()=>startGame(c)} style={{background:'#0d1117',border:'1px solid #1f2937',borderRadius:'10px',padding:'22px',cursor:'pointer'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'10px'}}><span style={{fontSize:'38px',lineHeight:1}}>{c.flag}</span><span style={{fontSize:'11px',color:'#6b7280',letterSpacing:'1px',textTransform:'uppercase',alignSelf:'flex-start',marginTop:'4px'}}>{c.region}</span></div>
            <div style={{fontSize:'17px',fontWeight:700,color:'#f9fafb',fontFamily:'Georgia,serif',marginBottom:'2px'}}>{c.name}</div>
            <div style={{fontSize:'11px',color:'#3b82f6',fontStyle:'italic',marginBottom:'8px'}}>{c.tagline}</div>
            <div style={{fontSize:'12px',color:'#9ca3af',lineHeight:'1.6',marginBottom:'14px'}}>{c.desc}</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'4px',marginBottom:'10px'}}>
              {[['💰',`$${(c.stats.treasury/1000).toFixed(1)}k`],['📈',`${c.stats.gdpGrowth}%`],['👷',`${c.stats.unemployment}%`],['🏛️',`${c.stats.stability}`],['🛡️',`${c.stats.military}`]].map(([icon,val])=>(
                <div key={icon} style={{background:'#1f2937',borderRadius:'5px',padding:'5px 3px',textAlign:'center'}}><div style={{fontSize:'13px'}}>{icon}</div><div style={{fontSize:'10px',color:'#e5e7eb',fontWeight:700,marginTop:'2px'}}>{val}</div></div>
              ))}
            </div>
            <div style={{borderTop:'1px solid #1f2937',paddingTop:'8px',fontSize:'10px',color:'#4b5563'}}>Agency: {INTEL_AGENCIES[c.id]||'Intelligence Services'} · {c.preload.map(t=>ISSUES[t]?.title).join(', ')}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── PLAY ───────────────────────────────────────────────────────────────────
  // Issue loop helpers (E9, #23): plain render helpers, not components. deployFx = what a running program has delivered so far.
  const fx1=v=>(v>0?'+':'')+(Math.abs(v)<10?v.toFixed(1):String(Math.round(v)));
  const deployFx=d=><div data-why-deploy={d.issueType} style={{display:'flex',flexWrap:'wrap',gap:'3px',marginTop:'6px'}}>{(d.effects||[]).map(e=>{const got=e.d*Math.min(1,(d.monthsElapsed||0)/(d.timeMonths||1));const pos=(GOOD.includes(e.s)&&e.d>0)||(!GOOD.includes(e.s)&&e.d<0);return <span key={e.s} style={{fontSize:'10px',padding:'1px 5px',background:'rgba(0,0,0,.4)',border:'1px solid #1f2937',borderRadius:'3px',color:pos?'#4ade80':'#ef4444'}}>{e.l||e.s} {fx1(got)} of {fx1(e.d)}</span>;})}</div>;
  const renderIssues=()=>{
    const nextIn=actionCooldowns.issue_next||0;
    const stColor={unexamined:'#ef4444',investigating:'#f0c040',briefed:'#3b82f6',deployed:'#4ade80'};
    const stLabel={unexamined:'UNEXAMINED',investigating:'EXAMINING',briefed:'BRIEF READY',deployed:'DEPLOYING'};
    const btn=(c)=>({width:'100%',minHeight:'44px',background:'rgba(0,0,0,.25)',border:`1px solid ${c}`,color:c,padding:'8px',borderRadius:'6px',fontSize:'12px',fontWeight:700});
    return <div data-issues-panel style={{display:'flex',flexDirection:'column',gap:'8px'}}>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px'}}><span>📄 Issues &amp; Briefs · {issues.length} open</span><span>{nextIn>0?`next window ~${nextIn}mo`:'window open'}</span></div>
      {issues.length===0&&<div style={{background:'#0d1117',border:'1px solid #1f2937',borderRadius:'8px',padding:'12px',fontSize:'12px',color:'#4b5563',textAlign:'center'}}>No open issues. New ones surface every 6–10 months.</div>}
      {issues.map(issue=>{
        const def=ISSUES[issue.type];if(!def)return null;
        const open=intelIssue===issue.type;const brief=briefs[issue.type];const dep=deployments.find(d=>d.issueType===issue.type&&d.status==='active');
        const timed=(issue.status==='unexamined'||issue.status==='briefed')&&issue.ttl>0;
        const preview=def.brief(stats||{},country)?.rc||'';
        return <div key={issue.id} data-issue={issue.type} data-issue-status={issue.status} style={{background:open?'#1f2937':'#0d1117',border:`1px solid ${open?def.color+'66':'#1f2937'}`,borderRadius:'8px',padding:'10px'}}>
          <button type="button" aria-expanded={open} onClick={()=>setIntelIssue(open?null:issue.type)} style={{display:'flex',alignItems:'center',gap:'8px',width:'100%',minHeight:'44px',background:'transparent',border:'none',padding:0,textAlign:'left',color:'inherit'}}>
            <span style={{fontSize:'20px'}}>{def.icon}</span>
            <span style={{flex:1,minWidth:0}}><span style={{display:'block',fontSize:'12px',fontWeight:700,color:'#f9fafb'}}>{def.title}</span><span style={{display:'block',fontSize:'10px',color:'#6b7280'}}>Detected {MONTHS[issue.mo]} {issue.yr}</span></span>
            <span style={{fontSize:'9px',border:`1px solid ${stColor[issue.status]}`,color:stColor[issue.status],padding:'2px 6px',borderRadius:'3px',letterSpacing:'1px',flexShrink:0}}>{stLabel[issue.status]}{issue.status==='investigating'?` · ${investigations[issue.type]||0}mo`:timed?` · ${issue.ttl}mo left`:''}</span>
          </button>
          {open&&<div style={{marginTop:'8px'}}>
            {issue.status==='unexamined'&&<div><div style={{fontSize:'11px',color:'#9ca3af',lineHeight:'1.5',marginBottom:'10px'}}>{preview.slice(0,170)}… Examine it for a brief with policy options. It lapses in {issue.ttl} months if ignored.</div><button type="button" onClick={()=>dispatch({type:'investigate',payload:{issue:issue.type}})} style={btn('#ef4444')}>🔍 Examine · $300M · 2 months</button></div>}
            {issue.status==='investigating'&&<div style={{fontSize:'12px',color:'#f0c040'}}>🔍 Brief in {investigations[issue.type]||0} months.</div>}
            {issue.status==='briefed'&&brief&&<div>
              <div style={{fontSize:'11px',color:'#9ca3af',lineHeight:'1.5',marginBottom:'8px',padding:'8px',background:'#0d1117',borderRadius:'5px',borderLeft:`3px solid ${def.color}`}}>{brief.rc}</div>
              {(brief.opts||[]).map(opt=><div key={opt.id} data-brief-option={opt.id} style={{background:'#0d1117',border:'1px solid #1f2937',borderRadius:'8px',padding:'10px',marginBottom:'6px'}}>
                <div style={{display:'flex',justifyContent:'space-between',gap:'6px'}}><b style={{fontSize:'12px',color:'#f9fafb'}}>{opt.n}</b><span style={{fontSize:'10px',color:'#3b82f6',flexShrink:0}}>{opt.conf}% · {opt.tm}mo</span></div>
                <div style={{fontSize:'11px',color:'#9ca3af',margin:'3px 0'}}>{opt.mech} <span style={{color:'#6b7280'}}>Cost {opt.cl}</span></div>
                <div style={{display:'flex',flexWrap:'wrap',gap:'3px',marginBottom:'6px'}}>{(opt.fx||[]).map(e=>{const pos=(GOOD.includes(e.s)&&e.d>0)||(!GOOD.includes(e.s)&&e.d<0);const now=stats?.[e.s];return <span key={e.s} style={{fontSize:'10px',padding:'1px 5px',background:'rgba(0,0,0,.4)',border:'1px solid #1f2937',borderRadius:'3px',color:pos?'#4ade80':'#ef4444'}}>{e.l}: {typeof now==='number'?`${now.toFixed(1)} → ${(now+e.d).toFixed(1)}`:fx1(e.d)} ({fx1(e.d)})</span>;})}</div>
                {(opt.risks||[]).map((r,ri)=><div key={ri} style={{fontSize:'10px',color:'#6b7280',marginBottom:'2px'}}>⚠ {r}</div>)}
                <button type="button" onClick={()=>{if(dispatch({type:'deployPolicy',payload:{issue:issue.type,option:opt.id}}))setIntelIssue(null);}} style={{...btn('#4ade80'),marginTop:'6px'}}>📋 Deploy · {opt.n}</button>
              </div>)}
            </div>}
            {issue.status==='deployed'&&<div style={{fontSize:'11px',color:'#9ca3af'}}>{dep?<div><b style={{color:'#f9fafb'}}>{dep.policyName}</b> · {dep.timeMonths-dep.monthsElapsed}mo left{deployFx(dep)}</div>:'Program complete; the issue closes next month.'}</div>}
          </div>}
        </div>;})}
    </div>;};
  const activeIssues=issues.filter(i=>i.status!=='resolved');
  const activeDeploys=deployments.filter(d=>d.status==='active');
  const defLev=getDefLeverage(defLevels,globalDef,country?.id||'');
  const canSurveyGGRB=country?.id==='usa'&&(defLevels.materials||0)>=3&&(defLevels.propulsion||0)>=2&&!grrbState.unlocked&&!grrbState.surveying;
  // Hegemony pillars (render scope)
  const hTotDL=Object.values(defLevels).reduce((a,b)=>a+(b||0),0);
  const hSphVals=Object.values(sphere).map(s2=>s2.player||0);
  const hAvgSph=hSphVals.length?hSphVals.reduce((a,b)=>a+b,0)/hSphVals.length:0;
  const pillarE=stats?Math.min(100,(Math.max(0,stats.treasury)/20000)*50+Math.max(0,stats.gdpGrowth)*6):0;
  const pillarM=stats?.military||0;
  const pillarI=hAvgSph;
  const pillarT=stats?Math.min(100,stats.education*0.4+(hTotDL/70)*100*0.6):0;
  const hegScore=(pillarE+pillarM+pillarI+pillarT)/4;
  hegRef.current=hegScore; // read by the sparkline effect above (hooks sit before the select-phase return)
  const rivalScores=Object.entries(globalDef).map(([cid,lvls])=>{
    const rAvg=Object.values(lvls).reduce((a,b)=>a+b,0)/Math.max(1,Object.keys(lvls).length);
    const rSph=Object.values(sphere).reduce((a,s2)=>a+(s2.competitors?.[cid]||0),0)/Math.max(1,hSphVals.length);
    return {cid,score:(rAvg/5)*55+rSph*0.45};
  }).sort((a,b)=>b.score-a.score);

  // Vitals drill-down panel content
  const VitalsDrillPanel=()=>{
    if(!vitalsDrill||!stats)return null;
    const val=stats[vitalsDrill];const cfg=SC[vitalsDrill];if(!cfg)return null;
    const contributing=activeEffects.filter(e=>e.stat===vitalsDrill);
    const netPerMo=contributing.reduce((s,e)=>s+e.d,0);
    const proj12=val+netPerMo*12;
    const relevantActions=PA.filter(a=>(a.tx||[]).some(t=>t.stat===vitalsDrill)).slice(0,3);
    return <div style={{position:'fixed',right:'14px',top:'110px',width:'300px',maxHeight:'calc(100vh - 130px)',overflowY:'auto',background:'#0d1117',border:'1px solid #3b82f6',borderRadius:'8px',padding:'14px',zIndex:400,boxShadow:'0 8px 40px rgba(0,0,0,.8)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
        <div><div style={{fontSize:'11px',color:'#3b82f6',textTransform:'uppercase',letterSpacing:'1px'}}>Vital Deep Dive</div><div style={{fontSize:'15px',fontWeight:700,color:'#f9fafb'}}>{cfg.label}: <span style={{color:sc(ss(vitalsDrill,val))}}>{cfg.fmt(val)}</span></div></div>
        <button onClick={()=>setVitalsDrill(null)} style={{background:'transparent',border:'none',color:'#6b7280',fontSize:'16px',cursor:'pointer'}}>✕</button>
      </div>
      {contributing.length>0&&<div style={{marginBottom:'8px'}}>
        <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',marginBottom:'4px'}}>Active Contributors</div>
        {contributing.map(e=><div key={e.id} style={{fontSize:'11px',color:e.d>0===GOOD.includes(vitalsDrill)?'#4ade80':'#ef4444',marginBottom:'2px'}}>• {e.source}: {e.d>0?'+':''}{e.d.toFixed(2)}/mo ({e.monthsLeft}mo left)</div>)}
        <div style={{fontSize:'11px',color:'#9ca3af',marginTop:'4px'}}>Net: {netPerMo>0?'+':''}{netPerMo.toFixed(2)}/mo · 12-month projection: {cfg.fmt(Math.max(-999,proj12))}</div>
      </div>}
      {contributing.length===0&&<div style={{fontSize:'11px',color:'#4b5563',marginBottom:'8px'}}>No active investments contributing to this stat.</div>}
      {vitalsDrill==='treasury'&&(()=>{
        const mm=procureMode==='efficiency'?0.85:procureMode==='surge'?1.2:1;
        const domM=Object.entries(platforms).reduce((s2,[pid,ct])=>s2+(PLATFORMS[pid]?.maint||0)*(ct||0),0)*mm;
        const impM=Object.entries(platformsImported).reduce((s2,[pid,ct])=>s2+(PLATFORMS[pid]?.maint||0)*(ct||0),0)*mm*1.25;
        const units=Object.values(platforms).reduce((a,b)=>a+(b||0),0)+Object.values(platformsImported).reduce((a,b)=>a+(b||0),0);
        const payroll=units*3*(personnelPay/100);
        const basing=Object.values(forceDeployments).reduce((a,b)=>a+sumDep(b),0)*4;
        const social=[...socialPrograms].reduce((s2,id)=>s2+(SOCIAL_PROGRAMS[id]?.cost||0),0);
        const covert=[...covertPrograms].reduce((s2,id)=>s2+(COVERT_PROGRAMS[id]?.cost||0),0);
        const lanes=Math.round(((platforms.carrier_group||0)+(platforms.sub_fleet||0)+((platformsImported.carrier_group||0)+(platformsImported.sub_fleet||0))*0.9)*10);
        const expInc=Object.entries(defExports).reduce((s2,[k,d])=>{const bid=k.split('_')[0];const dom=Object.entries(sphere).some(([rid,sp])=>rid===NATIONS[bid]?.region&&(sp?.player||0)>60)?1.18:1;const att=embassies.has(bid)?1.10:1;const euB=(blocTrade.eu>=2&&BLOC_TRADE.eu.members.includes(bid))?1.15:1;return s2+(d.revenue||0)/12*dom*att*euB;},0);
        const divInc=Object.entries(sphere).reduce((s2,[rid,sph])=>{if((sph.player||0)>60&&REGION_BONUS[rid]?.treasury)return s2+REGION_BONUS[rid].treasury*(doctrine==='hegemon'?1.5:1);return s2;},0);
        const rows=[
          ...Object.entries(budgetAlloc).map(([s2,a])=>({l:`${s2.charAt(0).toUpperCase()+s2.slice(1)} budget (${a}%)`,v:-rSCost(s2,a),adj:s2})),
          {l:'Platform maintenance',v:-(domM+impM)},{l:`Personnel (${units} units @ ${personnelPay}%)`,v:-payroll},
          {l:'Forward basing',v:-basing},{l:'Social programs',v:-social},{l:'Covert programs',v:-covert},
          {l:'Trade lane security',v:lanes},{l:'Defense exports',v:expInc},{l:'Region dividends',v:divInc},
        ].filter(r=>Math.abs(r.v)>0.5).sort((a,b)=>a.v-b.v);
        return <div style={{marginBottom:'8px'}}>
          <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',marginBottom:'5px'}}>Monthly Budget Breakdown</div>
          {rows.map(r=><div key={r.l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 6px',background:'#111827',borderRadius:'4px',marginBottom:'3px'}}>
            <span style={{fontSize:'11px',color:'#9ca3af'}}>{r.l}</span>
            <div style={{display:'flex',alignItems:'center',gap:'5px'}}>
              {r.adj&&<><button onClick={()=>dispatch({type:'adjustSectorBudget',payload:{sector:r.adj,delta:-10}})} style={{background:'transparent',border:'1px solid #374151',color:'#9ca3af',padding:'1px 7px',borderRadius:'3px',fontSize:'11px'}}>−</button><button onClick={()=>dispatch({type:'adjustSectorBudget',payload:{sector:r.adj,delta:10}})} style={{background:'transparent',border:'1px solid #374151',color:'#9ca3af',padding:'1px 7px',borderRadius:'3px',fontSize:'11px'}}>+</button></>}
              <span style={{fontSize:'11px',fontWeight:700,color:r.v<0?'#f87171':'#4ade80',minWidth:'58px',textAlign:'right'}}>{r.v<0?'−':'+'}${Math.abs(Math.round(r.v))}M</span>
            </div>
          </div>)}
          <div style={{fontSize:'10px',color:'#6b7280',marginTop:'4px'}}>Platforms/personnel adjust in Defense · programs toggle in Economy & Intel tabs</div>
        </div>;
      })()}
      {relevantActions.length>0&&<div>
        <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',marginBottom:'6px'}}>Targeted Interventions</div>
        {relevantActions.map(a=><div key={a.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 8px',background:'#111827',borderRadius:'5px',marginBottom:'4px'}}>
          <div><div style={{fontSize:'12px',fontWeight:600,color:'#f9fafb'}}>{a.i} {a.n}</div><div style={{fontSize:'10px',color:'#6b7280'}}>{(a.tx||[]).find(t=>t.stat===vitalsDrill)?.d>0?'+':''}{(a.tx||[]).find(t=>t.stat===vitalsDrill)?.d.toFixed(2)}/mo × {(a.tx||[]).find(t=>t.stat===vitalsDrill)?.mo}mo</div></div>
          <button onClick={()=>dispatch({type:'executePolicy',payload:{id:a.id}})} disabled={(actionCooldowns[a.id]||0)>0} style={{background:(actionCooldowns[a.id]||0)>0?'transparent':'#1d4ed8',border:`1px solid ${(actionCooldowns[a.id]||0)>0?'#374151':'#3b82f6'}`,color:(actionCooldowns[a.id]||0)>0?'#4b5563':'white',padding:'4px 10px',borderRadius:'4px',fontSize:'11px',cursor:'pointer'}}>{(actionCooldowns[a.id]||0)>0?`${actionCooldowns[a.id]}mo`:'Execute'}</button>
        </div>)}
      </div>}
    </div>;
  };

  return(
    <div className="wl-app" style={{backgroundImage:'radial-gradient(1100px 540px at 72% -8%,rgba(59,130,246,.07),transparent 62%),radial-gradient(900px 480px at -4% 108%,rgba(167,139,250,.05),transparent 58%)'}}>
      <style>{SHELL_CSS}</style>
      <style>{`
        *{font-variant-numeric:tabular-nums}
        ::selection{background:rgba(59,130,246,.35)}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes toastIn{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}
        @keyframes dashmove{to{stroke-dashoffset:-18}}
        ::-webkit-scrollbar{width:5px;height:5px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:#2a3441;border-radius:3px} ::-webkit-scrollbar-thumb:hover{background:#3b4757}
        button{cursor:pointer;transition:filter .12s ease,transform .08s ease,background .15s ease,border-color .15s ease}
        button:hover:not(:disabled){filter:brightness(1.18)}
        button:active:not(:disabled){transform:translateY(1px) scale(.985)}
        button:disabled{cursor:not-allowed}
        :focus-visible{outline:2px solid #3b82f6;outline-offset:2px;border-radius:4px}
        input[type=range]{cursor:pointer}
        .region-path{transition:fill-opacity .35s ease,filter .2s ease,stroke-opacity .2s ease}
        .region-path:hover{filter:brightness(1.35) drop-shadow(0 0 6px rgba(120,170,255,.35))}
        @media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
        /* P3b phone fallback until P3c's shell: stack the v57 columns under 900px so the map gets the full width */
        .wl-map-card{order:-1}.wl-right-idle{display:none!important}
        @media (max-width:899px){.wl-body{flex-direction:column!important;overflow:auto!important}.wl-body>:not(.wl-vitals){flex:0 0 auto!important;overflow:visible!important;flex-direction:column!important}.wl-body>:not(.wl-vitals)>.wl-side,.wl-body>:not(.wl-vitals)>div[style*="overflow"]{width:100%!important;flex:none!important;overflow:visible!important;border-right:none!important}.wl-vitals{width:100%!important;order:2;border-right:none!important;border-top:1px solid #1f2937;overflow:visible!important}.wl-overview{flex-direction:column!important;overflow:visible!important;flex:none!important}.wl-overview>div{overflow:visible!important;flex:none!important}.wl-right{width:100%!important;border-left:none!important;border-top:1px solid #1f2937}}
      `}</style>

      {toasts.length>0&&<div style={{position:'fixed',bottom:'20px',left:'50%',transform:'translateX(-50%)',zIndex:999,display:'flex',flexDirection:'column',gap:'6px',alignItems:'center',pointerEvents:'none',maxWidth:'86%'}}>
        {toasts.map(t=>{const c=t.sev==='alert'?'#ef4444':t.sev==='warn'?'#f0c040':'#3b82f6';return <div key={t.id} style={{background:'#111827',border:`1px solid ${c}`,borderRadius:'6px',padding:'8px 16px',fontSize:'12px',boxShadow:'0 4px 20px rgba(0,0,0,.7)',animation:'toastIn .22s cubic-bezier(.2,.8,.3,1)'}}>{t.msg}</div>;})}
      </div>}

      {victory&&!victoryShown&&(<div style={{position:'fixed',inset:0,background:'rgba(4,7,12,.78)',backdropFilter:'blur(7px)',WebkitBackdropFilter:'blur(7px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2100}}><div style={{background:'#111827',border:'1px solid #4ade80',borderRadius:'10px',padding:'44px 38px',textAlign:'center',maxWidth:'440px'}}>
        <div style={{fontSize:'48px',marginBottom:'12px'}}>🏆</div>
        <div style={{fontSize:'17px',color:'#f9fafb',fontFamily:'Georgia,serif',marginBottom:'8px'}}>{country?.name} — {({hegemony:'Global Hegemon',econ:'Economic Ascendancy',tech:'Technological Supremacy',dip:'Architect of the Diplomatic Order'})[victoryType]}</div>
        <div style={{fontSize:'13px',color:'#9ca3af',lineHeight:'1.7',marginBottom:'10px'}}>{({hegemony:'You held 85%+ Hegemony for two consecutive years.',econ:'Two years of surplus, a bloc bound to you at its deepest tier, a stable society — the world runs on your economy.',tech:'General intelligence deployed, research depth unmatched, a lead no rival can close — the future is yours to define.',dip:'Five allies sworn, six embassies flying your flag, three regions anchored — an order built on treaties, not tanks.'})[victoryType]} Your nation anchors the world order under the {doctrine?DOCTRINES[doctrine].n:''} doctrine — {MONTHS[date.mo]} {date.yr}.</div>
        <div style={{fontSize:'11px',color:'#6b7280',marginBottom:'24px'}}>The era is yours. You may continue governing — rivals will keep contesting.</div>
        <div style={{display:'flex',gap:'10px',justifyContent:'center'}}>
          <button onClick={()=>setVictoryShown(true)} style={{background:'#14532d',border:'1px solid #4ade80',color:'#4ade80',padding:'9px 20px',borderRadius:'6px',fontSize:'13px',fontWeight:700}}>👑 Continue Ruling</button>
          <button onClick={()=>{setPhase('select');setGameOver(null);}} style={{background:'transparent',border:'1px solid #374151',color:'#9ca3af',padding:'9px 20px',borderRadius:'6px',fontSize:'13px'}}>New Nation</button>
        </div>
      </div></div>)}
      {gameOver&&(<div style={{position:'fixed',inset:0,background:'rgba(4,7,12,.78)',backdropFilter:'blur(7px)',WebkitBackdropFilter:'blur(7px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000}}><div style={{background:'#111827',border:`1px solid ${gameOver?.startsWith('🏆')?'#4ade80':'#ef4444'}`,borderRadius:'10px',padding:'48px 40px',textAlign:'center',maxWidth:'400px'}}><div style={{fontSize:'48px',marginBottom:'14px'}}>{gameOver?.startsWith('🏆')?'🏆':'☠'}</div><div style={{fontSize:'16px',color:'#f9fafb',fontFamily:'Georgia,serif',marginBottom:'10px'}}>{country?.name}</div><div style={{fontSize:'13px',color:'#9ca3af',lineHeight:'1.7',marginBottom:'26px'}}>{gameOver}</div><div style={{display:'flex',gap:'10px',justifyContent:'center'}}><button onClick={()=>{setPhase('select');setGameOver(null);}} style={{background:'transparent',border:'1px solid #374151',color:'#9ca3af',padding:'9px 20px',borderRadius:'6px',fontSize:'13px'}}>New Nation</button><button onClick={()=>dispatch({type:'imfBailout'})} style={{background:'#14532d',border:'1px solid #4ade80',color:'#4ade80',padding:'9px 20px',borderRadius:'6px',fontSize:'13px'}}>💰 IMF Bailout</button></div></div></div>)}

      {ultimatum&&(()=>{const cid=ultimatum.cid;const rn=cid.charAt(0).toUpperCase()+cid.slice(1);const tlM=triadLegs(platforms,blackPrograms);return(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.88)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1500}}>
          <div style={{background:'#111827',border:'2px solid #f472b6',borderRadius:'10px',padding:'26px',maxWidth:'480px',width:'90%'}}>
            <div style={{fontSize:'11px',color:'#f472b6',textTransform:'uppercase',letterSpacing:'2px',marginBottom:'8px'}}>☢ Nuclear Ultimatum</div>
            <div style={{fontSize:'14px',fontWeight:700,color:'#f9fafb',marginBottom:'8px'}}>{rn} has placed strategic forces on alert and demands you stand down</div>
            <div style={{fontSize:'12px',color:'#9ca3af',marginBottom:'14px'}}>They are at the brink. Every month you hold, the roll comes again. Your triad: {tlM}/4.</div>
            <div style={{display:'grid',gap:'8px'}}>
              <button onClick={()=>dispatch({type:'ultimatumResponse',payload:{response:'standDown'}})} style={{background:'#0d1117',border:'1px solid #374151',color:'#9ca3af',padding:'10px',borderRadius:'7px',fontSize:'11px',fontWeight:700,textAlign:'left'}}>🕊 Stand down<div style={{fontSize:'9px',color:'#6b7280',fontWeight:400}}>Lift blockades against them · tension −25 · concede −6 sphere in their top region</div></button>
              <button onClick={()=>dispatch({type:'ultimatumResponse',payload:{response:'holdLine'}})} style={{background:'rgba(240,192,64,.08)',border:'1px solid #f0c040',color:'#f0c040',padding:'10px',borderRadius:'7px',fontSize:'11px',fontWeight:700,textAlign:'left'}}>✊ Hold the line<div style={{fontSize:'9px',color:'#9ca3af',fontWeight:400}}>Tension +6 · stability −2 · they may issue it again</div></button>
              <button onClick={()=>dispatch({type:'ultimatumResponse',payload:{response:'counterThreat'}})} style={{background:'rgba(239,68,68,.1)',border:'1px solid #ef4444',color:'#ef4444',padding:'10px',borderRadius:'7px',fontSize:'11px',fontWeight:700,textAlign:'left'}}>☢ Counter-threat{tlM<2?' 🔒':''}<div style={{fontSize:'9px',color:'#9ca3af',fontWeight:400}}>60% they back down (−20) · else +5 and −4 stability</div></button>
            </div>
          </div>
        </div>);})()}
      {confrontation&&(()=>{const rn=REGIONS[confrontation.rid]?.n;const tg=confrontation.target;return(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1500}}>
          <div style={{background:'#111827',border:'2px solid #60a5fa',borderRadius:'10px',padding:'26px',maxWidth:'480px',width:'90%'}}>
            <div style={{fontSize:'11px',color:'#60a5fa',textTransform:'uppercase',letterSpacing:'2px',marginBottom:'8px'}}>⚓ Blockade Confrontation</div>
            <div style={{fontSize:'14px',fontWeight:700,color:'#f9fafb',marginBottom:'8px'}}>{tg.charAt(0).toUpperCase()+tg.slice(1)} convoy, escorted by warships, is testing your {rn} cordon</div>
            <div style={{fontSize:'12px',color:'#9ca3af',marginBottom:'14px'}}>Tension is critical. How you answer sets the price of your blockade — and theirs.</div>
            <div style={{display:'grid',gap:'8px'}}>
              <button onClick={()=>dispatch({type:'confrontationResponse',payload:{response:'enforce'}})} style={{background:'rgba(239,68,68,.1)',border:'1px solid #ef4444',color:'#ef4444',padding:'10px',borderRadius:'7px',fontSize:'11px',fontWeight:700,textAlign:'left'}}>⚔️ Enforce — fire warning salvos<div style={{fontSize:'9px',color:'#9ca3af',fontWeight:400}}>Their sphere −18, yours +6 · tension +15 · stability −3 · their bloc −6 relations</div></button>
              <button onClick={()=>dispatch({type:'confrontationResponse',payload:{response:'board'}})} style={{background:'rgba(240,192,64,.08)',border:'1px solid #f0c040',color:'#f0c040',padding:'10px',borderRadius:'7px',fontSize:'11px',fontWeight:700,textAlign:'left'}}>⚓ Board & Seize<div style={{fontSize:'9px',color:'#9ca3af',fontWeight:400}}>Their sphere −8, yours +3 · +$150M cargo · tension +5</div></button>
              <button onClick={()=>dispatch({type:'confrontationResponse',payload:{response:'letPass'}})} style={{background:'#0d1117',border:'1px solid #374151',color:'#9ca3af',padding:'10px',borderRadius:'7px',fontSize:'11px',fontWeight:700,textAlign:'left'}}>🕊 Let it pass<div style={{fontSize:'9px',color:'#6b7280',fontWeight:400}}>Tension −5 · blockade becomes porous (half effect, no more runners)</div></button>
            </div>
          </div>
        </div>);})()}
      {intelCrisis&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1500}}><div style={{background:'#111827',border:'2px solid #ef4444',borderRadius:'10px',padding:'28px',maxWidth:'480px',width:'90%'}}><div style={{fontSize:'11px',color:'#ef4444',textTransform:'uppercase',letterSpacing:'2px',marginBottom:'8px'}}>🚨 Intelligence Crisis</div><div style={{fontSize:'14px',fontWeight:700,color:'#f9fafb',marginBottom:'8px'}}>{intelCrisis.type==='friendly'?'Operation Discovered by Ally':intelCrisis.type==='stolen'?'Foreign Operation Against You Detected':'Operation Discovered by Adversary'}</div><div style={{fontSize:'12px',color:'#9ca3af',marginBottom:'14px'}}>Target: {intelCrisis.targetId} · Op: {INTEL_OPS.find(o=>o.id===intelCrisis.opId)?.n}. Choose your response carefully — consequences are real.</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>{intelCrisis.responses.map(r=><div key={r.id} onClick={()=>dispatch({type:'respondIntelCrisis',payload:{response:r.id,crisis:intelCrisis}})} style={{background:'#0d1117',border:'1px solid #374151',borderRadius:'7px',padding:'10px',cursor:'pointer'}}><div style={{fontSize:'12px',fontWeight:700,color:'#f9fafb',marginBottom:'4px'}}>{r.label}</div>{r.tags.map((t,i)=><div key={i} style={{fontSize:'10px',color:'#6b7280'}}>· {t}</div>)}</div>)}</div></div></div>)}

      <Hud version={VERSION} country={country} date={date} stats={stats} ledger={ledger} history={history} hegScore={hegScore} pillars={{e:pillarE,m:pillarM,i:pillarI,t:pillarT}} activeEffects={activeEffects}
        pauseReason={paused?{kind:'you',label:'Paused by you'}:ultimatum?{kind:'engine',label:'Nuclear ultimatum'}:confrontation?{kind:'engine',label:'Blockade confrontation'}:intelCrisis?{kind:'engine',label:'Intel crisis'}:gameOver?{kind:'engine',label:'Game over'}:(victory&&!victoryShown)?{kind:'engine',label:'Victory'}:(activeTab==='overview'&&selectedRegion&&flashpoint&&flashpoint.rid===selectedRegion)?{kind:'engine',label:'Crisis briefing'}:null}
        paused={paused} onPause={setPaused} gameSpeed={gameSpeed} onSpeed={setGameSpeed} lastSaved={lastSaved} onQuit={()=>{setPhase('select');setGameOver(null);}} doctrineLabel={doctrine?`${DOCTRINES[doctrine].i} ${DOCTRINES[doctrine].n}`:null}/>
      <EventCards doctrine={doctrine} activeDecision={activeDecision} decisionDesc={activeDecision?(typeof activeDecision.desc==='function'?activeDecision.desc({ten:rivalTension,bt:blocTrade,ns:stats||{}}):activeDecision.desc):''} worldEvent={evOpen.world} flashpoint={evOpen.flashpoint} worldOpts={eventOptions(evView,'world')} fpOpts={eventOptions(evView,'flashpoint')} dispatch={dispatch} fxBadge={fxBadge} readyBriefs={issues.filter(i=>i.status==='briefed'&&briefs[i.type]).map(i=>({type:i.type,ttl:i.ttl,title:ISSUES[i.type]?.title,icon:ISSUES[i.type]?.icon,rc:briefs[i.type].rc,n:(briefs[i.type].opts||[]).length}))} onOpenBrief={t=>{setActiveTab('intel');setIntelIssue(t);}} onOpenRegion={rid=>{setActiveTab('overview');setSelNation(null);setSelectedRegion(rid);}}/>

      <div className="wl-body" style={{flex:1,display:'flex',overflow:'hidden'}}>
        {/* Left vitals — always visible, clickable */}
        <div className="wl-vitals" style={{width:'205px',background:'#0a0e14',borderRight:'1px solid #1f2937',overflowY:'auto',padding:'10px',flexShrink:0}}>
          <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'10px'}}>Nation Vitals <span style={{color:'#4b5563',fontWeight:400,textTransform:'none',letterSpacing:'0'}}>· click to drill</span></div>
          {stats&&Object.keys(SC).map(k=>stats[k]!=null?<StatBar key={k} k={k} val={stats[k]}/>:null)}
          {/* Active effects summary */}
          {activeEffects.length>0&&<div style={{marginTop:'10px',padding:'8px',background:'#0d1117',borderRadius:'6px',border:'1px solid #1f2937'}}>
            <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',marginBottom:'5px'}}>Active Effects</div>
            {activeEffects.slice(0,4).map(e=><div key={e.id} style={{fontSize:'10px',color:(GOOD.includes(e.stat)&&e.d>0)||(!GOOD.includes(e.stat)&&e.d<0)?'#4ade80':'#ef4444',marginBottom:'2px'}}>• {SC[e.stat]?.label||e.stat} {e.d>0?'+':''}{e.d.toFixed(2)}/mo ({e.monthsLeft}mo)</div>)}
            {activeEffects.length>4&&<div style={{fontSize:'10px',color:'#4b5563'}}>+{activeEffects.length-4} more</div>}
          </div>}
        </div>

        {/* OVERVIEW / MAP TAB */}
        {activeTab==='overview'&&<div className="wl-overview" style={{flex:1,display:'flex',overflow:'hidden'}}>
          <div style={{flex:1,overflowY:'auto',padding:'12px',display:'flex',flexDirection:'column',gap:'12px'}}>
            {/* Vitals drill-down */}
            {vitalsDrill&&<VitalsDrillPanel/>}
            {(()=>{const n=(flashpoint?1:0)+Object.values(rivalHolds||{}).filter(m=>m>0).length+Object.keys(blockades).length+Object.values(chokeStatus).filter(s=>s==='disrupted').length+Object.entries(rivalTension).filter(([cid,t])=>t>=70&&cid!==country?.id&&!isAllyOf(country?.id,cid)).length;return <button onClick={()=>setActiveTab('sitroom')} style={{width:'100%',background:n>0?'rgba(239,68,68,.08)':'#0d1117',border:`1px solid ${n>0?'#7f1d1d':'#1f2937'}`,color:n>0?'#ef4444':'#6b7280',padding:'8px',borderRadius:'8px',fontSize:'11px',fontWeight:700,textAlign:'left'}}>🎖️ Situation Room · {n>0?`${n} live situation${n>1?'s':''} — open`:'quiet — open'}</button>;})()}

            {/* ── COMMAND DECK ── */}



            {/* Intel Crisis */}
            {/* (handled by modal above) */}


            {/* ── HEGEMONY RACE ─────────────────────────────────── */}
            <div style={{background:'#0d1117',border:'1px solid #1f2937',borderRadius:'10px',padding:'12px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'9px'}}>
                <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px'}}>Hegemony Race · hold 85% for 24mo to win</div>
                <div style={{display:'flex',alignItems:'center',gap:'7px'}}>
                  {hegHold>0&&<span style={{fontSize:'10px',color:'#4ade80',padding:'2px 7px',background:'rgba(74,222,128,.1)',border:'1px solid #4ade80',borderRadius:'4px',animation:'pulse 2s infinite'}}>⏳ Holding {hegHold}/24mo</span>}
                  {victory&&<span style={{fontSize:'10px',color:'#fbbf24'}}>🏆 HEGEMON</span>}
                  <span style={{fontSize:'15px',fontWeight:800,color:hegScore>=85?'#4ade80':hegScore>=60?'#f0c040':'#9ca3af'}}>👑 {hegScore.toFixed(1)}%</span>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'7px',marginBottom:'10px'}}>
                {[['💰 Economic',pillarE,'#fbbf24'],['🛡️ Military',pillarM,'#ef4444'],['🌍 Influence',pillarI,'#3b82f6'],['🔬 Technology',pillarT,'#a78bfa']].map(([l,v,c])=>(
                  <div key={l} style={{background:'#111827',borderRadius:'6px',padding:'7px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}><span style={{fontSize:'10px',color:'#9ca3af'}}>{l}</span><span style={{fontSize:'11px',fontWeight:700,color:c}}>{v.toFixed(0)}</span></div>
                    <div style={{height:'3px',background:'#1f2937',borderRadius:'2px'}}><div style={{height:'100%',width:`${Math.min(100,v)}%`,background:c,borderRadius:'2px',transition:'width .5s'}}/></div>
                  </div>))}
              </div>
              {rivalScores.slice(0,2).map(r=>(<div key={r.cid} style={{marginBottom:'4px'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'2px'}}><span style={{fontSize:'10px',color:'#6b7280'}}>Rival: {r.cid.charAt(0).toUpperCase()+r.cid.slice(1)} {r.score>hegScore?'— AHEAD OF YOU':''}{(rivalHolds[r.cid]||0)>0&&<span style={{color:'#ef4444',fontWeight:700}}> ⚠ holding {rivalHolds[r.cid]}/24mo — knock their sphere down to reset</span>}</span><span style={{fontSize:'10px',color:r.score>hegScore?'#ef4444':'#9ca3af',fontWeight:700}}>{r.score.toFixed(1)}% / 85%</span></div>
                <div style={{height:'3px',background:'#1f2937',borderRadius:'2px'}}><div style={{height:'100%',width:`${Math.min(100,r.score/85*100)}%`,background:(rivalHolds[r.cid]||0)>0?'#ef4444':r.score>hegScore?'#f0c040':'#6b7280',borderRadius:'2px'}}/></div>
              </div>))}
            </div>
            {/* SVG WORLD MAP */}
            <div className="wl-map-card" style={{background:'#0a0f1a',borderRadius:'10px',border:'1px solid #1f2937',padding:'12px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px',marginBottom:'8px'}}><div style={{fontSize:'11px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px'}}>World Map · tap a region</div><Help items={HELP_TIPS}/></div>
              <MapView mode={mapMode} onModeChange={setMapMode} onRegionTap={rid=>setSelectedRegion(selectedRegion===rid?null:rid)}
                view={{country,sphere,selectedRegion,forceDeployments,flashpoint,sphereTrend,intelOps,defExports,doctrine,nationRelations,embassies,defensePacts,chokeStatus,rivalTension,blockades,tradeAgreements,importContracts,embargoes,embargoedBy,forcePosture,sanctions,moles,expelled:expelR.current,concessions}}/>

            </div>

            {/* Risk signals: moved out of the right column so the map owns the main column on desktop */}
              {stats&&<div style={{background:'#0d1117',border:'1px solid #1f2937',borderRadius:'10px',padding:'12px'}}>
                <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',marginBottom:'8px'}}>Risk Signals</div>
                {[[stats.gdpGrowth<0,'gdpGrowth','⚠ Negative GDP — debt and unemployment compounding'],[stats.debtGdp>120,'debtGdp',`⚠ Debt ${stats.debtGdp.toFixed(0)}% — credit access at risk`],[stats.debtGdp>85&&stats.debtGdp<=120,'debtGdp',`⚠ Debt ${stats.debtGdp.toFixed(0)}% — fiscal space constrained`],[stats.inflation>10,'inflation',`⚠ Inflation ${stats.inflation.toFixed(1)}% — wages eroding`],[stats.inequality>78,'inequality','⚠ Inequality near destabilization'],[stats.stability<35,'stability',`⚠ Stability ${stats.stability.toFixed(0)} — act immediately`]].filter(([c])=>c).map(([,k,msg],i)=><div key={i} style={{fontSize:'11px',color:'#9ca3af',lineHeight:'1.4',marginBottom:'6px',padding:'6px 8px',background:'#0d1117',borderRadius:'5px',borderLeft:`3px solid ${sc(ss(k,stats[k]))}`}}>{msg}</div>)}
                {![stats.gdpGrowth<0,stats.debtGdp>85,stats.inflation>7,stats.inequality>78,stats.stability<35].some(Boolean)&&<div style={{fontSize:'11px',color:'#4ade80'}}>✓ No critical signals</div>}
              </div>}
            {/* Active Issues */}
            <div>
              <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'}}>Active Issues</div>
              {activeIssues.length===0&&<div style={{background:'#0d1117',border:'1px solid #1f2937',borderRadius:'7px',padding:'12px',fontSize:'12px',color:'#4b5563',textAlign:'center'}}>No active issues.</div>}
              {activeIssues.map(issue=>{
                const def=ISSUES[issue.type];if(!def)return null;
                const isSel=selIssue===issue.type;
                const sColor={unexamined:'#ef4444',investigating:'#f0c040',briefed:'#3b82f6',deployed:'#4ade80'}[issue.status]||'#6b7280';
                const sLabel={unexamined:'UNEXAMINED',investigating:'INVESTIGATING',briefed:'BRIEF READY',deployed:'DEPLOYED'}[issue.status]||issue.status.toUpperCase();
                return(<div key={issue.id} style={{background:isSel?'#1f2937':'#0d1117',border:`1px solid ${isSel?def.color+'66':'#1f2937'}`,borderRadius:'7px',padding:'12px',marginBottom:'7px',cursor:'pointer',transition:'all .15s'}} onClick={()=>{setSelIssue(issue.type);setSelOption(null);setRightMode(issue.status==='briefed'||issue.status==='deployed'?'brief':'issue');}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'4px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}><span style={{fontSize:'18px'}}>{def.icon}</span><div><div style={{fontSize:'12px',fontWeight:700,color:'#f9fafb'}}>{def.title}</div><div style={{fontSize:'10px',color:'#6b7280',marginTop:'1px'}}>Detected {MONTHS[issue.mo]} {issue.yr||date.yr}</div></div></div>
                    <span style={{fontSize:'9px',border:`1px solid ${sColor}`,color:sColor,padding:'2px 7px',borderRadius:'3px',letterSpacing:'1px',flexShrink:0,marginLeft:'6px',animation:issue.status==='unexamined'?'pulse 1.8s infinite':'none'}}>{sLabel}{issue.status==='investigating'?` · ${investigations[issue.type]||0}mo`:''}{(issue.status==='unexamined'||issue.status==='briefed')&&issue.ttl>0?` · ${issue.ttl}mo left`:''}</span>
                  </div>
                  <div style={{fontSize:'11px',color:'#9ca3af',lineHeight:'1.4'}}>{def.brief?.(stats||{},country)?.rc?.slice(0,120)||''}...</div>
                </div>);
              })}
            </div>

            {activeDeploys.length>0&&<div>
              <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'}}>Active Deployments</div>
              {activeDeploys.map(d=>{const pct=Math.round((d.monthsElapsed/d.timeMonths)*100);return(<div key={d.id} style={{background:'#0d1117',border:'1px solid #14532d',borderRadius:'7px',padding:'11px',marginBottom:'7px'}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}><div><div style={{fontSize:'12px',fontWeight:700,color:'#f9fafb'}}>{d.policyName}</div><div style={{fontSize:'10px',color:'#6b7280'}}>{ISSUES[d.issueType]?.title}</div></div><div style={{textAlign:'right'}}><div style={{fontSize:'12px',color:'#4ade80',fontWeight:700}}>{pct}%</div><div style={{fontSize:'10px',color:'#6b7280'}}>{d.timeMonths-d.monthsElapsed}mo</div></div></div><div style={{height:'3px',background:'#1f2937',borderRadius:'2px'}}><div style={{height:'100%',width:`${pct}%`,background:'#4ade80',borderRadius:'2px',transition:'width .5s'}}/></div>{deployFx(d)}</div>);})}
            </div>}

            <div><div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'5px'}}>Log</div>{log.slice(0,6).map((e,i)=><div key={i} style={{fontSize:'11px',color:i===0?'#d1d5db':'#4b5563',padding:'3px 0',borderBottom:'1px solid #0d1117',lineHeight:'1.4'}}><span style={{color:'#374151',marginRight:'6px'}}>{MONTHS[e.mo]} {e.yr||''}</span>{e.msg}</div>)}</div>
          </div>

          {/* Right intel panel */}
          <div className={'wl-right'+(rightMode==='intel'?' wl-right-idle':'')} style={{width:'285px',background:'#0a0e14',borderLeft:'1px solid #1f2937',overflowY:'auto',padding:'12px',flexShrink:0}}>
            {rightMode==='issue'&&selIssue&&(()=>{
              const def=ISSUES[selIssue];if(!def)return null;
              const issue=issues.find(i=>i.type===selIssue);
              const isInv=issue?.status==='investigating';const moLeft=investigations[selIssue]||0;
              return <div>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'10px'}}><div style={{fontSize:'10px',color:def.color,textTransform:'uppercase',letterSpacing:'1px'}}>Situation Report</div><button onClick={()=>setRightMode('intel')} style={{background:'transparent',border:'none',color:'#6b7280',fontSize:'14px'}}>✕</button></div>
                <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}><span style={{fontSize:'22px'}}>{def.icon}</span><div style={{fontSize:'13px',fontWeight:700,color:'#f9fafb',fontFamily:'Georgia,serif'}}>{def.title}</div></div>
                {isInv?<div style={{textAlign:'center',padding:'24px',background:'#0d1117',borderRadius:'7px',border:'1px solid #1f2937'}}><div style={{fontSize:'24px',marginBottom:'8px',animation:'pulse 1.5s infinite'}}>🔍</div><div style={{fontSize:'12px',color:'#f0c040',fontWeight:600}}>Investigating — {moLeft}mo</div></div>
                :<div><div style={{fontSize:'12px',color:'#9ca3af',lineHeight:'1.6',marginBottom:'14px'}}>Commission an intelligence brief to unlock policy options.</div><button onClick={()=>dispatch({type:'investigate',payload:{issue:selIssue}})} style={{width:'100%',background:'rgba(239,68,68,.08)',border:'1px solid #ef4444',color:'#ef4444',padding:'11px',borderRadius:'5px',fontSize:'12px',fontWeight:700}}>🔍 Commission — $300M · 2 months</button></div>}
              </div>;
            })()}
            {rightMode==='brief'&&selIssue&&briefs[selIssue]&&(()=>{
              const brief=briefs[selIssue];const def=ISSUES[selIssue];if(!def||!brief)return null;
              const issue=issues.find(i=>i.type===selIssue);const isDep=issue?.status==='deployed';
              return <div>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}><div style={{fontSize:'10px',color:def.color,textTransform:'uppercase',letterSpacing:'1px'}}>Intelligence Brief</div><button onClick={()=>setRightMode('intel')} style={{background:'transparent',border:'none',color:'#6b7280',fontSize:'14px'}}>✕</button></div>
                <div style={{display:'flex',alignItems:'center',gap:'7px',marginBottom:'10px'}}><span style={{fontSize:'18px'}}>{def.icon}</span><div style={{fontSize:'13px',fontWeight:700,color:'#f9fafb',fontFamily:'Georgia,serif'}}>{def.title}</div></div>
                <div style={{fontSize:'11px',color:'#9ca3af',lineHeight:'1.6',marginBottom:'10px',padding:'8px',background:'#0d1117',borderRadius:'5px',borderLeft:`3px solid ${def.color}`}}>{brief.rc}</div>
                <div style={{marginBottom:'10px'}}>{brief.ind?.map(ind=><div key={ind.l} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:'1px solid #0d1117',fontSize:'11px'}}><span style={{color:'#9ca3af'}}>{ind.l}</span><span style={{color:sc(ind.s),fontWeight:700}}>{ind.v}</span></div>)}</div>
                <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'7px'}}>Policy Options</div>
                {(brief.opts||[]).map(opt=>{const isSel=selOption===opt.id;return(
                  <div key={opt.id} onClick={()=>!isDep&&setSelOption(isSel?null:opt.id)} style={{background:isSel?'#1f2937':'#0d1117',border:`1px solid ${isSel?'#3b82f6':'#1f2937'}`,borderRadius:'6px',padding:'10px',marginBottom:'6px',cursor:isDep?'default':'pointer',transition:'all .12s'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}><div style={{fontSize:'12px',fontWeight:700,color:'#f9fafb'}}>{opt.n}</div><div style={{fontSize:'10px',color:'#3b82f6',flexShrink:0,marginLeft:'4px'}}>{opt.conf}%</div></div>
                    <div style={{fontSize:'11px',color:'#9ca3af',marginBottom:'4px'}}>{opt.mech}</div>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',color:'#6b7280',marginBottom:'4px'}}><span>{opt.cl}</span><span>{opt.tm}mo</span></div>
                    <div style={{display:'flex',gap:'3px',flexWrap:'wrap',marginBottom:isSel?'7px':'0'}}>{(opt.fx||[]).map(e=>{const pos=(GOOD.includes(e.s)&&e.d>0)||(!GOOD.includes(e.s)&&e.d<0);return <span key={e.s} style={{fontSize:'10px',padding:'1px 5px',background:'rgba(0,0,0,.4)',border:'1px solid #1f2937',borderRadius:'3px',color:pos?'#4ade80':'#ef4444'}}>{e.l}: {e.d>0?'+':''}{e.d.toFixed(1)}</span>;})}</div>
                    {isSel&&<div><div style={{fontSize:'10px',color:'#f0c040',marginBottom:'3px',fontWeight:600}}>Risks:</div>{(opt.risks||[]).map((r,ri)=><div key={ri} style={{fontSize:'10px',color:'#6b7280',marginBottom:'2px'}}>⚠ {r}</div>)}<div style={{display:'flex',gap:'6px',marginTop:'7px'}}>{!isDep&&<button onClick={e=>{e.stopPropagation();if(dispatch({type:'deployPolicy',payload:{issue:selIssue,option:opt.id}})){setRightMode('intel');setSelIssue(null);setSelOption(null);}}} style={{flex:1,background:'#14532d',border:'1px solid #4ade80',color:'#4ade80',padding:'6px',borderRadius:'4px',fontSize:'11px',fontWeight:700}}>📋 Deploy</button>}</div></div>}
                  </div>
                );})}
              </div>;
            })()}
          </div>
        </div>}

        {/* ECONOMY TAB */}
        {activeTab==='sitroom'&&<div style={{flex:1,overflowY:'auto',padding:'12px',display:'flex',flexDirection:'column',gap:'10px'}}>
            {panelBox('paths','🏁 Paths to Victory · each held 24 months','#1e3a5f',(()=>{const totRDv=Object.values(defLevels).reduce((a,b)=>a+(b||0),0);const ledNet=Object.values(ledger).reduce((a,b)=>a+b,0);const sv=Object.values(sphere).map(s=>s?.player||0);const avgS=sv.length?sv.reduce((a,b)=>a+b,0)/sv.length:0;const hegemonyScore=((Math.min(100,(Math.max(0,stats?.treasury||0)/20000)*50+Math.max(0,stats?.gdpGrowth||0)*6))+(stats?.military||0)+avgS+Math.min(100,(stats?.education||0)*0.4+(totRDv/70)*100*0.6))/4;
                const rows=[
                  ['👑 Hegemony',`Composite ≥85 (now ${Math.round(hegemonyScore||0)})`,hegHold,'#a78bfa'],
                  ['💰 Economic Ascendancy',`Net ≥ +$600M/mo (${ledNet>=0?'+':'−'}$${Math.abs(Math.round(ledNet))}) · a bloc at T3 (${Math.max(blocTrade.eu||0,blocTrade.cn||0)}) · stability ≥70`,pathHold.econ,'#4ade80'],
                  ['🧠 Technological Supremacy',`R&D depth ≥55 (${totRDv}) · AGI deployed (${usedTech.has('t9')?'✓':'✗'}) · lead ≥1.6×`,pathHold.tech,'#60a5fa'],
                  ['🕊️ Diplomatic Order',`5 pacts (${defensePacts.size}) · 6 embassies (${embassies.size}) · 3 regions dominated (${Object.values(sphere).filter(s=>(s?.player||0)>60).length})`,pathHold.dip,'#f0c040'],
                ];
                return rows.map(([n,req,hold,col])=><div key={n} style={{marginBottom:'7px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px'}}><span style={{color:'#e5e7eb',fontWeight:700}}>{n}</span><span style={{color:hold>0?col:'#4b5563',fontWeight:700}}>{hold>0?`${hold}/24 mo`:'not qualifying'}</span></div>
                  <div style={{fontSize:'9px',color:'#6b7280',marginBottom:'3px'}}>{req}</div>
                  <div style={{height:'4px',background:'#111827',borderRadius:'2px'}}><div style={{height:'100%',width:`${Math.min(100,hold/24*100)}%`,background:col,borderRadius:'2px',transition:'width .4s'}}/></div>
                </div>);})())}
            {worldEvent&&(()=>{const def=WORLD_EVENTS[worldEvent.id];return <div style={{padding:'10px',background:'rgba(240,192,64,.05)',border:'1px solid #78350f',borderRadius:'10px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:'11px',fontWeight:700,color:'#f0c040'}}>{def.i} WORLD EVENT — {def.n}</span><span style={{fontSize:'10px',color:'#6b7280'}}>{worldEvent.mo}mo remaining</span></div>
              <div style={{fontSize:'10px',color:'#9ca3af',marginTop:'4px',lineHeight:'1.5'}}>{def.d}</div>
            </div>;})()}
            {/* ── Situation Room: live prompted decisions ── */}
            {(()=>{const items=[];
              Object.entries(blockades).forEach(([rid,b])=>{items.push({i:'⚓',c:'#60a5fa',t:`Blockading ${b.target} in ${REGIONS[rid]?.n}${b.half?' (porous)':''}`,d:`$120M/mo · their sphere ${b.half?'−0.15':'−0.30'}/mo · lanes cut both ways.`,acts:[
                  {lane:'🪖',l:'Reinforce cordon (carrier)',f:()=>dispatch({type:'deployUnit',payload:{region:rid,unit:'carrier_group'}})},{lane:'🪖',l:'Reinforce cordon (SSN(X))',f:()=>dispatch({type:'deployUnit',payload:{region:rid,unit:'ssnx'}})},
                  {lane:'🤝',l:'Back-channel ($250M · −8)',f:()=>{dispatch({type:'backChannel',payload:{nation:b.target}});}},
                  {lane:'⚓',l:'Lift blockade',f:()=>{dispatch({type:'liftBlockade',payload:{region:rid,from:'sitroom'}});}}]});});
              Object.entries(chokeStatus).forEach(([k,st])=>{if(st!=='disrupted')return;const cp=CHOKEPOINTS[k];const home=Object.entries(REGIONS).find(([,r])=>r.homeFor?.includes(country?.id))?.[0];const mine=(IMPORT_ROUTES[home]||[]).includes(k);
                items.push({i:'⚓',c:'#ef4444',t:`${cp.n} DISRUPTED${mine?' — on your import route':''}`,d:`${cp.d} ${mine?'Your fossil imports cost ×1.5 and inflation climbs until the lane reopens.':'Downstream exports −25%.'}`,acts:[
                  {lane:'🪖',l:`Station carrier in ${REGIONS[cp.region]?.n}`,f:()=>dispatch({type:'deployUnit',payload:{region:cp.region,unit:'carrier_group'}})},{lane:'🪖',l:`Station SSN(X) in ${REGIONS[cp.region]?.n}`,f:()=>dispatch({type:'deployUnit',payload:{region:cp.region,unit:'ssnx'}})},
                  {lane:'🚢',l:'Set Escort posture there',f:()=>{dispatch({type:'setPosture',payload:{region:cp.region,posture:'escort',from:'sitroom'}});}},
                  {lane:'🛢️',l:sprRelease?'Reserve releasing':`Release strategic reserve (${spr})`,f:()=>{dispatch({type:'releaseReserve',payload:{from:'chokepoint'}});}}]});});
              Object.entries(stewardship).forEach(([ck,st])=>{const cp=CONCESSIONS[ck];const nw=navalWeight(forceDeployments[cp.region]);if(nw<2)items.push({i:'🛢️',c:'#f0c040',t:`${NATIONS[cp.nation]?.n} stewardship exposed — no fleet offshore`,d:'Shipping runs at half and unrest brews without naval weight 2+ in the region.',acts:[{lane:'🪖',l:`Station carrier in ${REGIONS[cp.region]?.n}`,f:()=>dispatch({type:'deployUnit',payload:{region:cp.region,unit:'carrier_group'}})},{lane:'🪖',l:`Station SSN(X)`,f:()=>dispatch({type:'deployUnit',payload:{region:cp.region,unit:'ssnx'}})}]});});
              if(embargoedBy)items.push({i:'⛽',c:'#ef4444',t:`${embargoedBy.by.toUpperCase()} energy embargo — ${embargoedBy.mo}mo`,d:'Imports ×1.3, inflation and growth bleed unless you are diversified.',acts:[{lane:'🛢️',l:sprRelease?'Reserve releasing':`Release strategic reserve (${spr})`,f:()=>{dispatch({type:'releaseReserve'});}},{lane:'🤝',l:'Back-channel Russia ($250M · −8)',f:()=>{dispatch({type:'embargoBackChannel'});}}]});
              if(pariah>0)items.push({i:'☢️',c:'#ef4444',t:`Pariah state — ${pariah}mo`,d:'No nation will sign arms contracts; bloc doors are frozen. The taboo you broke is the price you pay.'});
              Object.entries(rivalTension).forEach(([cid,t])=>{if(t>=85&&cid!==country?.id&&!isAllyOf(country?.id,cid))items.push({i:'☢',c:'#f472b6',t:`${cid.charAt(0).toUpperCase()+cid.slice(1)} at the BRINK (${Math.round(t)})`,d:'Final options are unlocked in the Intel dossier. Any act of yours that pushes tension to 100 ends the world — and the game.'});});
              Object.entries(rivalTension).forEach(([cid,t])=>{if(t>=70&&t<85&&!isAllyOf(country?.id,cid))items.push({i:'⚔️',c:'#ef4444',t:`${cid.charAt(0).toUpperCase()+cid.slice(1)} tension CRITICAL (${Math.round(t)})`,d:`Confrontation risk is live.`,acts:[
                  {lane:'🤝',l:'Back-channel ($250M · −8)',f:()=>{dispatch({type:'backChannel',payload:{nation:cid}});}},
                  {lane:'🕵️',l:'Counter-intel sweep',f:()=>dispatch({type:'runIntelOp',payload:{op:'counter_int',nation:cid}})},
                  {lane:'🪖',l:'Ready the triad (Defense)',f:()=>setActiveTab('defense')}]});});
              if(flashpoint){const fp=FLASHPOINTS[flashpoint.type];const rid=flashpoint.rid;const embHere=DIP_TARGETS.some(d=>d.region===rid&&embassies.has(d.id));
                items.push({i:fp.i,c:'#ef4444',t:`${fp.n} in ${REGIONS[rid]?.n}`,d:`A crisis is unfolding — ${flashpoint.t}mo to respond.`,acts:[
                  {lane:'🪖',l:'Station fighter wing',f:()=>dispatch({type:'deployUnit',payload:{region:rid,unit:'fighter_wing'}})},{lane:'🪖',l:'Station carrier group',f:()=>dispatch({type:'deployUnit',payload:{region:rid,unit:'carrier_group'}})},
                  {lane:'🕵️',l:'Deploy intel ($600M)',f:()=>dispatch({type:'regionIntel',payload:{region:rid}})},
                  {lane:'🤝',l:embHere?'Open region panel → Diplomatic':'Establish embassy in region',f:()=>{if(embHere){setSelectedRegion(rid);}else dispatch({type:'establishRegionEmbassy',payload:{region:rid}});}}]});}
              // Rival hegemony threat
              Object.entries(rivalHolds||{}).forEach(([cid,mo])=>{if(mo>0&&cid!==country?.id){const topRg=Object.entries(sphere).map(([r2,s2])=>[r2,s2.competitors?.[cid]||0]).sort((a,b)=>b[1]-a[1])[0];
                items.push({i:'⚠',c:'#ef4444',t:`${cid.charAt(0).toUpperCase()+cid.slice(1)} nearing hegemony`,d:`Held the threshold ${mo}/24 months. Break their strongest position (${REGIONS[topRg?.[0]]?.n||'—'}).`,acts:[
                  {lane:'🪖',l:`Station SSN(X)/sub in ${REGIONS[topRg?.[0]]?.n||'their region'}`,f:()=>{if(topRg)dispatch({type:'stationHunterKiller',payload:{region:topRg[0]}});}},
                  {lane:'🕵️',l:'Destabilization op',f:()=>dispatch({type:'runIntelOp',payload:{op:'destab',nation:cid}})},{lane:'🕵️',l:'Deploy intel to their region',f:()=>{if(topRg)dispatch({type:'regionIntel',payload:{region:topRg[0]}});}},
                  {lane:'🤝',l:sanctions.has(cid)?'Sanctions active':'Impose sanctions',f:()=>{dispatch({type:'imposeSanctions',payload:{nation:cid}});}}]});}});
              // Diplomatic openings (near pact / trade-ready)
              DIP_TARGETS.forEach(t=>{const rel=Math.round(nationRelations[t.id]||0);if(rel>=55&&rel<60&&!defensePacts.has(t.id))items.push({i:'🤝',c:'#f0c040',t:`${t.n} near pact-ready (+${rel})`,d:`A few more points unlocks a defense pact.`,acts:[
                  {lane:'🤝',l:'State visit ($150M · +8)',f:()=>dispatch({type:'stateVisit',payload:{nation:t.id}})},{lane:'🤝',l:'Foreign aid ($600M · +15)',f:()=>dispatch({type:'foreignAid',payload:{nation:t.id}})},
                  {lane:'🤝',l:embassies.has(t.id)?'Embassy present':'Establish embassy ($300M)',f:()=>dispatch({type:'establishEmbassy',payload:{nation:t.id}})}]});});
              // Energy shortage risk
              const eTier=getEnergyTier(resources,resExtraction,importContracts);const fossilLow=['oil','gas','coal'].every(k=>(resources?.[k]?.r||0)<60);
              if(fossilLow&&eTier==='standard')items.push({i:'⚡',c:'#f0c040',t:'Energy security thin',d:'Domestic fossil reserves are running low with no nuclear/renewable cushion. Secure import contracts or build energy R&D before a shortage bites.'});
              // High-value export opportunity
              const richBuyer=BUYERS.filter(b=>b.id!==country?.id).find(b=>b.budget>=1500&&(nationRelations[b.id]??b.rel)>40&&!Object.keys(defExports).some(k=>k.startsWith(b.id)));
              if(richBuyer){const best=Object.entries(defLevels).filter(([v])=>!(richBuyer.noBuy||[]).includes(v)).sort((a,b)=>b[1]-a[1])[0];
                items.push({i:'💰',c:'#4ade80',t:`${richBuyer.n} is an open arms market`,d:`Budget $${richBuyer.budget}M, no deal yet.`,acts:[
                  {lane:'🤝',l:best?`Offer ${DV[best[0]]?.n} L${best[1]}`:'Develop a system first',f:()=>{if(best)dispatch({type:'sellDefTech',payload:{nation:richBuyer.id,vertical:best[0]}});}},
                  {lane:'🤝',l:embassies.has(richBuyer.id)?'Attaché in place (+10%)':'Establish embassy (+10% deals)',f:()=>dispatch({type:'establishEmbassy',payload:{nation:richBuyer.id}})}]});}
              if(!items.length)return <div style={{padding:'11px',background:'#0d1117',border:'1px solid #1f2937',borderRadius:'10px',fontSize:'11px',color:'#6b7280'}}>🗺️ Situation Room — no urgent decisions. Expand your sphere, deepen alliances, or advance research while the board is quiet.</div>;
              return <div style={{background:'#0d1117',border:'1px solid #1f2937',borderRadius:'10px',padding:'11px'}}>
                <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'9px'}}>🗺️ Situation Room · {items.length} active decision{items.length>1?'s':''}</div>
                <div style={{display:'flex',flexDirection:'column',gap:'7px'}}>
                  {items.slice(0,5).map((it,idx)=><div key={idx} style={{display:'flex',gap:'9px',padding:'8px',background:'#111827',borderRadius:'6px',borderLeft:`3px solid ${it.c}`}}>
                    <span style={{fontSize:'16px'}}>{it.i}</span>
                    <div style={{flex:1}}><div style={{fontSize:'11px',fontWeight:700,color:it.c}}>{it.t}</div><div style={{fontSize:'10px',color:'#9ca3af',lineHeight:'1.45',marginTop:'2px'}}>{it.d}</div>
                      {it.acts&&<div style={{display:'flex',flexWrap:'wrap',gap:'4px',marginTop:'6px'}}>{it.acts.map((a,ai)=><button key={ai} onClick={a.f} style={{background:'#0d1117',border:'1px solid #374151',color:'#d1d5db',padding:'4px 8px',borderRadius:'4px',fontSize:'10px',fontWeight:600}}>{a.lane} {a.l}</button>)}</div>}
                    </div>
                  </div>)}
                </div>
              </div>;})()}

            {/* ── Strategic Leverage ── */}
            {(()=>{const domCount=Object.values(sphere).filter(s=>(s?.player||0)>60).length;if(domCount===0)return null;const tradeB=Math.round(domCount*12);const impCut=Math.min(45,domCount*7);return(
              <div style={{padding:'10px',background:'#0d1117',border:'1px solid #1e3a5f',borderRadius:'10px',marginBottom:'2px'}}>
                <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'7px'}}>⚡ Strategic Leverage · {domCount} region{domCount>1?'s':''} dominated</div>
                <div style={{display:'flex',gap:'5px',flexWrap:'wrap'}}>
                  <span style={{fontSize:'9px',padding:'3px 7px',background:'rgba(74,222,128,.08)',border:'1px solid #14532d',borderRadius:'4px',color:'#4ade80'}}>Exports +{tradeB}% (sphere trade lanes)</span>
                  <span style={{fontSize:'9px',padding:'3px 7px',background:'rgba(96,165,250,.08)',border:'1px solid #1e3a5f',borderRadius:'4px',color:'#60a5fa'}}>Import costs −{impCut}% (resource access)</span>
                  <span style={{fontSize:'9px',padding:'3px 7px',background:'rgba(167,139,250,.08)',border:'1px solid #4c1d95',borderRadius:'4px',color:'#a78bfa'}}>Influence ×1.4 in your regions</span>
                  <span style={{fontSize:'9px',padding:'3px 7px',background:'rgba(240,192,64,.08)',border:'1px solid #78350f',borderRadius:'4px',color:'#f0c040'}}>+ security tribute where forces deploy</span>
                </div>
                <div style={{fontSize:'9px',color:'#6b7280',marginTop:'6px'}}>Map dominance compounds: controlled regions cheapen your imports, enrich your exports, amplify your diplomacy, and — with deployed forces — pay protection income. Spend on the map to leverage every other system.</div>
              </div>);})()}
            {/* ── In Progress: everything cooking, at a glance ── */}
            {(()=>{const items=[];
              Object.entries(defResearch).forEach(([v,mo])=>items.push({i:DV[v]?.i||'🔬',t:`${DV[v]?.n} L${(defLevels[v]||0)+1}`,mo:Math.ceil(mo)}));
              if(blackResearch)items.push({i:BLACK_PROGRAMS[blackResearch.id]?.i||'🔒',t:BLACK_PROGRAMS[blackResearch.id]?.n,mo:blackResearch.mo-blackResearch.prog});
              const co=Object.keys(continuousOps||{}).length;if(co)items.push({i:'♻️',t:`${co} standing op${co>1?'s':''}`,mo:null});
              if(!items.length)return null;
              return <div style={{display:'flex',gap:'6px',flexWrap:'wrap',alignItems:'center',padding:'7px 10px',background:'#0d1117',border:'1px solid #1f2937',borderRadius:'8px'}}>
                <span style={{fontSize:'9px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px'}}>In progress</span>
                {items.map((it,idx)=><span key={idx} style={{fontSize:'10px',padding:'2px 8px',background:'#111827',border:'1px solid #374151',borderRadius:'4px',color:'#9ca3af'}}>{it.i} {it.t}{it.mo!=null&&<b style={{color:'#60a5fa'}}> · {it.mo}mo</b>}</span>)}
              </div>;})()}

            {panelBox('nukes','☢ Nuclear Register · who fired, at whom, when','#831843',(()=>{if(!nukeLog.length)return <div style={{fontSize:'10px',color:'#6b7280'}}>No nuclear-tier events. The register records demonstrations, employments, ultimatums, and exchanges — yours and theirs.</div>;
              const L={demonstration:'☢ Demonstration strike',employment:'☢️ Tactical employment',ultimatum:'⚠ Nuclear ultimatum',exchange:'💀 Exchange'};
              return <div style={{display:'grid',gap:'3px'}}>{nukeLog.map((e,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:'10px',padding:'4px 6px',background:'#111827',borderRadius:'4px',borderLeft:`3px solid ${e.actor===country?.id?'#f0c040':'#ef4444'}`}}><span style={{color:'#e5e7eb'}}><b style={{color:e.actor===country?.id?'#f0c040':'#ef4444'}}>{(NATIONS[e.actor]?.n||e.actor)}</b> → {NATIONS[e.target]?.n||e.target}{e.region?` · ${REGIONS[e.region]?.n}`:''} — {L[e.type]||e.type}</span><span style={{color:'#6b7280'}}>{MONTHS[e.mo]} {e.yr}</span></div>)}</div>;})())}
        </div>}
        {activeTab==='economy'&&<div style={{flex:1,display:'flex',overflow:'hidden'}}>
          <div style={{width:'230px',background:'#0a0e14',borderRight:'1px solid #1f2937',overflowY:'auto',padding:'13px',flexShrink:0}}>
            <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'12px'}}>Monetary Policy</div>
            <div style={{marginBottom:'16px'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}><span style={{fontSize:'12px',color:'#9ca3af'}}>Interest Rate</span><span style={{fontSize:'15px',fontWeight:700,color:'#f0c040'}}>{(+interestRate||0).toFixed(2)}%</span></div>
              <input type="range" min="0" max="20" step="0.25" value={interestRate} onChange={e=>dispatch({type:'setInterestRate',payload:{rate:parseFloat(e.target.value)}})} style={{width:'100%',accentColor:'#3b82f6'}}/>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',color:'#4b5563'}}><span>0% loose</span><span>20% tight</span></div>
              <div style={{marginTop:'6px',padding:'7px',background:'#0d1117',borderRadius:'4px',fontSize:'11px',color:'#6b7280',lineHeight:'1.4'}}>{interestRate<2?'Ultra-loose — high inflation risk':interestRate<4?'Accommodative — stimulative bias':interestRate<6?'Neutral — balanced':interestRate<10?'Restrictive — cooling inflation':'Very tight — recession risk'}</div>
              <div style={{marginTop:'5px',display:'flex',gap:'3px',flexWrap:'wrap'}}>{(()=>{const ir=+(interestRate)||3,nd=3-ir;return[['Inflation',(nd*0.03).toFixed(2),'inflation'],['GDP Growth',(nd*0.02).toFixed(2),'gdpGrowth'],['Unemployment',(-nd*0.015).toFixed(2),'unemployment']].map(([l,v,k])=>{const nv=parseFloat(v);const pos=(GOOD.includes(k)&&nv>0)||(!GOOD.includes(k)&&nv<0);return <span key={l} style={{fontSize:'10px',padding:'2px 5px',background:'rgba(0,0,0,.4)',border:'1px solid #374151',borderRadius:'3px',color:pos?'#4ade80':'#ef4444'}}>{l}: {nv>0?'+':''}{v}/mo</span>;});})()}</div>
            </div>
            <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'}}>Fiscal Stance</div>
            <div style={{marginBottom:'12px'}}>{['austerity','balanced','stimulus'].map(m=><button key={m} onClick={()=>dispatch({type:'setFiscalStance',payload:{mode:m}})} style={{display:'block',width:'100%',marginBottom:'4px',background:spendingMode===m?'#1d4ed8':'transparent',border:`1px solid ${spendingMode===m?'#3b82f6':'#374151'}`,color:spendingMode===m?'white':'#9ca3af',padding:'6px 10px',borderRadius:'4px',fontSize:'11px',textAlign:'left',fontWeight:spendingMode===m?700:400}}>{m==='austerity'?'✂️ Austerity — -debt, -stability':m==='balanced'?'⚖️ Balanced — neutral':'📈 Stimulus — +growth, +debt'}</button>)}</div>
            <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'}}>Tax Policy</div>
            {(()=>{const rate=+taxPolicy||28;const ret=talentRetention||70;const edu=stats?.education||60;const gdpB=1600+edu*7+Math.max(0,stats?.gdpGrowth||0)*90;const breadth=0.6+(ret/100)*0.5+(edu>75?0.15:0);const rev=Math.round(gdpB*(rate/100)*breadth);const dev=rate-28;return(
            <div style={{marginBottom:'14px'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}><span style={{fontSize:'12px',color:'#9ca3af'}}>Effective Tax Rate</span><span style={{fontSize:'15px',fontWeight:700,color:'#f0c040'}}>{rate}%</span></div>
              <input type="range" min="8" max="48" step="1" value={rate} onChange={e=>dispatch({type:'setTaxRate',payload:{rate:parseInt(e.target.value)}})} style={{width:'100%',accentColor:'#3b82f6'}}/>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',color:'#4b5563'}}><span>8% lean</span><span>48% heavy</span></div>
              <div style={{marginTop:'7px',padding:'8px',background:'#0d1117',borderRadius:'5px',border:'1px solid #1f2937'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}><span style={{fontSize:'10px',color:'#6b7280'}}>Projected revenue</span><span style={{fontSize:'12px',fontWeight:700,color:'#4ade80'}}>+${rev}M/mo</span></div>
                <div style={{fontSize:'9px',color:'#6b7280',lineHeight:'1.5'}}>Tax base widened by talent retention ({Math.round(ret)}) & education ({Math.round(edu)}) — invest in human capital to grow revenue without raising rates.</div>
                <div style={{display:'flex',gap:'4px',marginTop:'5px',flexWrap:'wrap'}}>
                  <span style={{fontSize:'9px',padding:'2px 5px',background:'rgba(0,0,0,.4)',border:'1px solid #374151',borderRadius:'3px',color:dev>0?'#ef4444':'#4ade80'}}>GDP {(-dev*0.55).toFixed(2)}/mo</span>
                  <span style={{fontSize:'9px',padding:'2px 5px',background:'rgba(0,0,0,.4)',border:'1px solid #374151',borderRadius:'3px',color:dev>0?'#4ade80':'#ef4444'}}>Inequality {(-dev*0.5*0.1).toFixed(2)}/mo</span>
                  {rate>36&&<span style={{fontSize:'9px',padding:'2px 5px',background:'rgba(239,68,68,.1)',border:'1px solid #7f1d1d',borderRadius:'3px',color:'#ef4444'}}>over-taxation → brain drain</span>}
                  {rate<18&&<span style={{fontSize:'9px',padding:'2px 5px',background:'rgba(74,222,128,.1)',border:'1px solid #14532d',borderRadius:'3px',color:'#4ade80'}}>low tax retains talent</span>}
                </div>
              </div>
            </div>);})()}
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'12px'}}>
            {vitalsDrill&&<VitalsDrillPanel/>}
            {(()=>{const trait=NATION_TRAITS[country?.id]||{};const ret=Math.round(talentRetention);const rc=ret>70?'#4ade80':ret>45?'#f0c040':'#ef4444';const rdMult=(0.6+ret/100*0.8).toFixed(2);return(
            <div style={{marginBottom:'14px',padding:'11px',background:'#0d1117',borderRadius:'8px',border:`1px solid ${ret>70?'#14532d':ret<45?'#7f1d1d':'#1f2937'}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
                <span style={{fontSize:'11px',fontWeight:700,color:'#f9fafb'}}>🧠 Talent & Human Capital</span>
                <span style={{fontSize:'13px',fontWeight:800,color:rc}}>{ret}<span style={{fontSize:'10px',color:'#6b7280'}}>/100 retention</span></span>
              </div>
              <div style={{height:'4px',background:'#1f2937',borderRadius:'2px',marginBottom:'7px'}}><div style={{height:'100%',width:`${ret}%`,background:rc,borderRadius:'2px',transition:'width .5s'}}/></div>
              <div style={{fontSize:'10px',color:'#9ca3af',lineHeight:'1.5',marginBottom:'6px'}}>{trait.note||'A balanced human-capital base.'}</div>
              <div style={{display:'flex',gap:'5px',flexWrap:'wrap'}}>
                <span style={{fontSize:'9px',padding:'2px 6px',background:'rgba(0,0,0,.4)',border:'1px solid #374151',borderRadius:'3px',color:ret>60?'#4ade80':'#ef4444'}}>R&D speed ×{rdMult}</span>
                <span style={{fontSize:'9px',padding:'2px 6px',background:'rgba(0,0,0,.4)',border:'1px solid #374151',borderRadius:'3px',color:ret>60?'#4ade80':'#ef4444'}}>GDP {ret>60?'+':''}{((ret-60)/100*0.12).toFixed(2)}/mo</span>
                {trait.brainDrain>0&&<span style={{fontSize:'9px',padding:'2px 6px',background:'rgba(239,68,68,.1)',border:'1px solid #7f1d1d',borderRadius:'3px',color:'#ef4444'}}>structural brain drain</span>}
                {trait.energyDep>0&&<span style={{fontSize:'9px',padding:'2px 6px',background:'rgba(240,192,64,.08)',border:'1px solid #78350f',borderRadius:'3px',color:'#f0c040'}}>energy import-dependent</span>}
                {trait.svFund&&<span style={{fontSize:'9px',padding:'2px 6px',background:'rgba(74,222,128,.1)',border:'1px solid #14532d',borderRadius:'3px',color:'#4ade80'}}>sovereign wealth fund</span>}
              </div>
              <div style={{fontSize:'9px',color:'#6b7280',marginTop:'7px'}}>Education, growth, and stability retain talent → faster research and stronger growth → broader tax base. Brain drain reverses it.</div>
              {trait.leaseTalent&&(
                <div style={{marginTop:'9px',paddingTop:'9px',borderTop:'1px solid #1f2937'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
                    <span style={{fontSize:'10px',fontWeight:700,color:'#60a5fa'}}>🩺 Expertise Leasing — missions abroad</span>
                    <span style={{fontSize:'10px',color:'#4ade80'}}>+${expertiseLease*45}M/mo</span>
                  </div>
                  <div style={{fontSize:'9px',color:'#6b7280',marginBottom:'6px'}}>Lease biotech, medical, and military specialists to allied nations for hard currency — your economy's real lifeline. But sending your best people abroad accelerates brain drain.</div>
                  <div style={{display:'flex',gap:'4px'}}>{[0,1,2,3,4].map(v=><button key={v} onClick={()=>dispatch({type:'setExpertiseLease',payload:{level:v}})} style={{flex:1,background:expertiseLease>=v&&v>0?'#1e40af':expertiseLease===0&&v===0?'#374151':'transparent',border:`1px solid ${expertiseLease>=v&&v>0?'#3b82f6':'#374151'}`,color:expertiseLease>=v?'white':'#6b7280',padding:'4px 0',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>{v===0?'Off':v}</button>)}</div>
                </div>
              )}
            </div>);})()}
            {(()=>{const es=Object.entries(ledger).sort((a,b)=>b[1]-a[1]);if(!es.length)return null;const net=es.reduce((s,[,v])=>s+v,0);const mx=Math.max(...es.map(([,v])=>Math.abs(v)),1);return(
            <div style={{marginBottom:'14px',padding:'11px',background:'#0d1117',borderRadius:'8px',border:'1px solid #1f2937'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                <span style={{fontSize:'11px',fontWeight:700,color:'#f9fafb'}}>📒 Monthly Ledger — where the money actually moves</span>
                <span style={{fontSize:'12px',fontWeight:800,color:net>=0?'#4ade80':'#ef4444'}}>{net>=0?'+':'−'}${Math.abs(Math.round(net))}M net</span>
              </div>
              {es.map(([k,v])=><div key={k} style={{display:'flex',alignItems:'center',gap:'7px',marginBottom:'3px'}}>
                <span style={{fontSize:'9px',color:'#9ca3af',width:'118px',flexShrink:0}}>{k}</span>
                <div style={{flex:1,height:'6px',background:'#111827',borderRadius:'3px',overflow:'hidden'}}><div style={{height:'100%',width:`${Math.min(100,Math.abs(v)/mx*100)}%`,background:v>=0?'#14532d':'#7f1d1d',borderLeft:`2px solid ${v>=0?'#4ade80':'#ef4444'}`}}/></div>
                <span style={{fontSize:'9px',fontWeight:700,color:v>=0?'#4ade80':'#ef4444',width:'52px',textAlign:'right'}}>{v>=0?'+':'−'}${Math.abs(Math.round(v))}</span>
              </div>)}
              <div style={{fontSize:'9px',color:'#6b7280',marginTop:'6px'}}>One-off purchases and event costs aren't shown — this is your recurring position.</div>
            </div>);})()}
            {/* ── Sector Budget Dashboard ─────────────────────────────── */}
            <div style={{marginBottom:'14px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px'}}>Sector Budgets</div>
                <div style={{fontSize:'11px',color:'#9ca3af'}}>Total: <span style={{color:'#f9fafb',fontWeight:700}}>${Math.round(Object.entries(budgetAlloc).reduce((s,[sec,a])=>s+rSCost(sec,a),0)).toLocaleString()}M/mo</span></div>
              </div>
              {Object.entries(SECTOR_LABELS).map(([sector,label])=>{
                const alloc=budgetAlloc[sector]||100;
                const md=rMatDisc(sector);const cost=Math.round(rSCost(sector,alloc));
                const age=sectorAge[sector]||0;const decaying=age>480;const nearEnd=age>360&&age<=480;
                const isOver=alloc>100;const isUnder=alloc<100;
                const effLabel=isOver?`+${((alloc-100)/100).toFixed(2)}× gains`:isUnder?`−${((100-alloc)/100).toFixed(2)}× decay`:'Normal';
                const effColor=isOver?'#f87171':isUnder?'#4ade80':'#6b7280';
                return(<div key={sector} style={{background:'#0d1117',border:`1px solid ${decaying?'#ef4444':nearEnd?'#f0c04055':'#1f2937'}`,borderRadius:'7px',padding:'10px',marginBottom:'6px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'5px'}}>
                    <div style={{fontSize:'12px',fontWeight:700,color:'#f9fafb'}}>{label}</div>
                    <div style={{display:'flex',gap:'5px',alignItems:'center'}}>
                      {md>0&&<span style={{fontSize:'9px',color:'#4ade80',padding:'1px 5px',background:'rgba(74,222,128,.1)',border:'1px solid #4ade80',borderRadius:'3px'}}>−{Math.round(md*100)}% mature</span>}
                      {decaying&&<span style={{fontSize:'9px',color:'#ef4444',animation:'pulse 1.2s infinite'}}>⚠ AGING</span>}
                      {nearEnd&&!decaying&&<span style={{fontSize:'9px',color:'#f0c040'}}>⏱ {480-age}mo</span>}
                      <span style={{fontSize:'12px',fontWeight:700,color:isOver?'#f87171':isUnder?'#4ade80':'#9ca3af'}}>${cost}M/mo</span>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'7px',marginBottom:'4px'}}>
                    <span style={{fontSize:'10px',color:effColor,minWidth:'34px',fontWeight:600}}>{alloc}%</span>
                    <div style={{flex:1,position:'relative'}}>
                      <input type="range" min="0" max="200" step="5" value={alloc}
                        onChange={e=>dispatch({type:'setSectorBudget',payload:{sector,value:+e.target.value}})}
                        style={{width:'100%',accentColor:isOver?'#f87171':isUnder?'#4ade80':'#3b82f6'}}/>
                      <div style={{position:'absolute',left:'50%',top:'-2px',width:'1px',height:'14px',background:'#374151',pointerEvents:'none'}}/>
                    </div>
                    <span style={{fontSize:'9px',color:'#4b5563',minWidth:'22px',textAlign:'right'}}>200</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',color:effColor}}>
                    <span>{effLabel}</span>
                    {(sector==='defense'||sector==='energy')&&age>0&&<span style={{color:decaying?'#ef4444':nearEnd?'#f0c040':'#4b5563'}}>Age: {age}mo</span>}
                  </div>
                  {decaying&&<button onClick={()=>dispatch({type:'modernizeSector',payload:{sector}})} style={{width:'100%',marginTop:'6px',background:'rgba(239,68,68,.08)',border:'1px solid #ef4444',color:'#ef4444',padding:'6px',borderRadius:'4px',fontSize:'11px',fontWeight:700}}>
                    🔄 Great Modernization — costs 30% treasury (${Math.round((stats?.treasury||0)*0.3).toLocaleString()}M)
                  </button>}
                </div>);
              })}
              {(()=>{
                const defSpend=rSCost('defense',budgetAlloc.defense)+(intelBudget||1)*200/12;
                const socSpend=rSCost('healthcare',budgetAlloc.healthcare)+rSCost('education',budgetAlloc.education);
                const ratio=socSpend>0?defSpend/socSpend:99;
                if(ratio>2)return <div style={{fontSize:'11px',color:'#ef4444',padding:'6px 8px',background:'rgba(239,68,68,.07)',borderRadius:'5px',border:'1px solid #ef444455'}}>⚠ Defense/Intel {ratio.toFixed(1)}× social spending — legitimacy penalty (−0.07 stability/mo)</div>;
                return null;
              })()}
            </div>
            {/* ── Social Programs — quality of life levers ────────────── */}
            <div style={{marginBottom:'14px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px'}}>Social Programs · Quality of Life</div>
                {stats&&(()=>{const qol=(stats.healthcare+stats.education+stats.foodSecurity+(100-stats.inequality))/4;return <div style={{fontSize:'11px',color:qol>75?'#4ade80':qol<45?'#ef4444':'#9ca3af'}}>QoL: <span style={{fontWeight:700}}>{qol.toFixed(0)}/100</span> {qol>75?'(+stability, +growth)':qol<45?'(−stability)':''}</div>;})()}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'7px'}}>
                {Object.entries(SOCIAL_PROGRAMS).map(([spId,sp])=>{
                  const on=socialPrograms.has(spId);
                  return(<div key={spId} onClick={()=>dispatch({type:'toggleSocialProgram',payload:{program:spId}})} style={{background:on?'rgba(74,222,128,.05)':'#0d1117',border:`1px solid ${on?'#4ade80':'#1f2937'}`,borderRadius:'7px',padding:'10px',cursor:'pointer',transition:'all .15s'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'6px'}}><span style={{fontSize:'15px'}}>{sp.i}</span><div style={{fontSize:'11px',fontWeight:700,color:on?'#4ade80':'#f9fafb'}}>{sp.n}</div></div>
                      <span style={{fontSize:'11px',fontWeight:700,color:on?'#4ade80':'#9ca3af'}}>{on?'ACTIVE':'OFF'} · ${sp.cost}M/mo</span>
                    </div>
                    <div style={{fontSize:'10px',color:'#6b7280',marginBottom:'4px'}}>{sp.d}</div>
                    <div style={{display:'flex',gap:'3px',flexWrap:'wrap'}}>{Object.entries(sp.fx).map(([k,v])=>fxBadge(k,v,true))}</div>
                  </div>);
                })}
              </div>
            </div>
            {/* ── Fiscal Actions ──────────────────────────────────────────── */}
            <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'10px'}}>Fiscal & Debt Actions</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'9px'}}>{PA.filter(a=>a.t==='economy').map(a=><ActionCard key={a.id} action={a}/>)}</div>
          </div>
        </div>}

        {/* ENERGY TAB */}
        {activeTab==='energy'&&<div style={{flex:1,overflowY:'auto',padding:'12px'}}>{vitalsDrill&&<VitalsDrillPanel/>}
          {(()=>{const homeRid=Object.entries(REGIONS).find(([,r])=>r.homeFor?.includes(country?.id))?.[0];const routes=IMPORT_ROUTES[homeRid]||[];const fossil=['oil','gas','coal'].filter(k=>importContracts.has(k));
            const evOil=worldEvent?(WORLD_EVENTS[worldEvent.id]?.oilM||1):1;const price=(evOil*(opecSwing?(opecSwing.mode==='cut'?1.6:0.55):1)*(chokeStatus.hormuz==='disrupted'?1.4:1));
            const trait=NATION_TRAITS[country?.id]||{};const dep=trait.energyDep||0;const stC={secured:'#4ade80',escorted:'#60a5fa',open:'#9ca3af',disrupted:'#ef4444'};
            return <div style={{marginBottom:'14px',padding:'11px',background:'#0d1117',border:`1px solid ${routes.some(k=>chokeStatus[k]==='disrupted')?'#7f1d1d':'#1f2937'}`,borderRadius:'8px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}><span style={{fontSize:'11px',fontWeight:700,color:'#f9fafb'}}>⛽ Energy Security</span><span style={{fontSize:'11px',fontWeight:800,color:price>1.2?'#ef4444':price<0.8?'#4ade80':'#f0c040'}}>World oil ×{price.toFixed(2)}</span></div>
              <div style={{fontSize:'10px',color:'#9ca3af',marginBottom:'6px'}}>Import dependency: {dep>0?`structural (${Math.round(dep*100)}%)`:dep<0?'net exporter':'balanced'} · fossil import contracts: {fossil.length?fossil.join(', '):'none'}</div>
              <div style={{fontSize:'9px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'4px'}}>Your transit chokepoints</div>
              {routes.map(k=>{const cp=CHOKEPOINTS[k];const st=chokeStatus[k]||'open';return <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:'10px',marginBottom:'3px'}}><span style={{color:'#d1d5db'}}>{cp.i} {cp.n} <span style={{color:'#4b5563'}}>· {Math.round(cp.oilShare*100)}% of world oil</span></span><span style={{color:stC[st],fontWeight:700,textTransform:'uppercase'}}>{st}</span></div>;})}
              <div style={{fontSize:'9px',color:'#6b7280',marginTop:'4px'}}>Disrupted lanes: fossil imports ×1.5, inflation +0.1/mo, downstream exports −25%. Station naval weight 2+ in the governing region on <b>Escort</b> posture to keep it open — or burn reserve.</div>
              <div style={{marginTop:'9px',paddingTop:'9px',borderTop:'1px solid #1f2937',display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
                <span style={{fontSize:'10px',fontWeight:700,color:'#f0c040'}}>🛢️ Strategic Petroleum Reserve: {spr}/6</span>
                <button onClick={()=>dispatch({type:'fillReserve'})} style={{background:'transparent',border:'1px solid #374151',color:'#9ca3af',padding:'3px 9px',borderRadius:'4px',fontSize:'10px'}}>+ Fill $200M</button>
                <button onClick={()=>dispatch({type:'toggleReserveRelease'})} style={{background:sprRelease?'rgba(240,192,64,.12)':'transparent',border:`1px solid ${sprRelease?'#f0c040':'#374151'}`,color:sprRelease?'#f0c040':'#9ca3af',padding:'3px 9px',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>{sprRelease?'⏹ Stop release':'▶ Release'}</button>
              </div>
              <div style={{marginTop:'9px',paddingTop:'9px',borderTop:'1px solid #1f2937'}}>
                <div style={{fontSize:'9px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'4px'}}>Supply to market · how much of your production you sell abroad</div>
                {['oil','gas'].map(k=>{const sh=exportShare[k]??0.6;const ext=resExtraction[k]||0;return <div key={k} style={{marginBottom:'6px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px'}}><span style={{color:'#d1d5db'}}>{k==='oil'?'🛢️ Crude oil':'🔥 Natural gas'} — extraction {ext}/4</span><span style={{color:'#f0c040',fontWeight:700}}>{Math.round(sh*100)}% exported</span></div>
                  <input type="range" min="0" max="100" step="5" value={Math.round(sh*100)} onChange={e=>dispatch({type:'setExportShare',payload:{resource:k,share:parseInt(e.target.value)/100}})} style={{width:'100%',accentColor:'#f0c040'}}/>
                  <div style={{fontSize:'8px',color:'#6b7280'}}>Export revenue ×{(0.45+0.55*sh).toFixed(2)} · domestic retention: inflation −{(0.03*(1-sh)).toFixed(3)}/mo{ext===0?' · (no extraction — set it in Resources)':''}</div>
                </div>;})}
              </div>
              <div style={{marginTop:'9px',paddingTop:'9px',borderTop:'1px solid #1f2937'}}>
                <div style={{fontSize:'9px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'4px'}}>⛽ Energy embargo · the producer's weapon</div>
                {(()=>{const prod=(resExtraction.oil||0)>=2||(resExtraction.gas||0)>=2;const targets=Object.keys(NATIONS).filter(r=>r!==country?.id).sort((a,b)=>(embargoes.has(b)?1:0)-(embargoes.has(a)?1:0)||((rivalTension[b]||0)-(rivalTension[a]||0))||((nationRelations[a]||0)-(nationRelations[b]||0)));
                  return <div style={{marginBottom:'10px'}}>
                    {embargoedBy&&<div style={{fontSize:'10px',color:'#ef4444',fontWeight:700,marginBottom:'4px'}}>🚨 {embargoedBy.by.toUpperCase()} is embargoing you — {embargoedBy.mo}mo. Diversify (2+ fossil contracts, High/Nuclear tier) or release reserve to blunt it.</div>}
                    <div style={{fontSize:'9px',color:'#6b7280',marginBottom:'4px'}}>{prod?'You produce enough to withhold. Great powers: sphere −0.15/mo everywhere, pressure −25%, tension +10. Any nation: relations −25 then −0.5/mo, and they stop buying your arms. Allies: −3 stability and their bloc freezes. Your barrels −20% volume at +15% price.':'Needs oil or gas extraction ≥2 to withhold anything.'}</div>
                    <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>{targets.map(tg=>{const on=embargoes.has(tg);return <button key={tg} onClick={()=>dispatch({type:'toggleEmbargo',payload:{nation:tg}})} style={{flex:1,background:on?'rgba(239,68,68,.12)':'#0d1117',border:`1px solid ${on?'#ef4444':'#374151'}`,color:on?'#ef4444':'#9ca3af',padding:'5px',borderRadius:'4px',fontSize:'9px',fontWeight:700}}>{on?`⛽ Lift — ${NATIONS[tg]?.n}`:`⛽ Embargo ${NATIONS[tg]?.n}`}</button>;})}</div>
                  </div>;})()}
                <div style={{fontSize:'9px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'4px'}}>🇵🇦 Panama Canal · {chokeStatus.panama||'open'}</div>
                {(()=>{const cd=chokeDeals.panama||{};const naHome=homeRid==='NA'||homeRid==='SA';const saRel=DIP_TARGETS.filter(d=>d.region==='SA').reduce((s,d)=>s+(nationRelations[d.id]||0),0)/Math.max(1,DIP_TARGETS.filter(d=>d.region==='SA').length);const dom=(sphere.NA?.player||0)>60;
                  return <div>
                    <div style={{fontSize:'9px',color:'#6b7280',marginBottom:'5px'}}>{CHOKEPOINTS.panama.d} {dom?'You dominate North America — canal transit fees flow to you.':''}</div>
                    <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
                      <button onClick={()=>dispatch({type:'panamaDeal',payload:{deal:'priority'}})} style={{flex:1,background:cd.priority?'rgba(74,222,128,.1)':'#0d1117',border:`1px solid ${cd.priority?'#4ade80':'#374151'}`,color:cd.priority?'#4ade80':'#9ca3af',padding:'5px',borderRadius:'4px',fontSize:'9px',fontWeight:700}}>{cd.priority?'✓ Transit priority':'📜 Transit Priority Agreement · $800M'}</button>
                      <button onClick={()=>dispatch({type:'panamaDeal',payload:{deal:'locks'}})} style={{flex:1,background:cd.locks===0?'rgba(74,222,128,.1)':cd.locks>0?'rgba(59,130,246,.1)':'#0d1117',border:`1px solid ${cd.locks===0?'#4ade80':cd.locks>0?'#3b82f6':'#374151'}`,color:cd.locks===0?'#4ade80':cd.locks>0?'#60a5fa':'#9ca3af',padding:'5px',borderRadius:'4px',fontSize:'9px',fontWeight:700}}>{cd.locks===0?'✓ Third lane built':cd.locks>0?`🏗️ Locks — ${cd.locks}mo`:'🏗️ Finance lock expansion · $2B'}</button>
                    </div>
                    <div style={{fontSize:'8px',color:'#6b7280',marginTop:'4px'}}>Priority: your Panama-routed imports −15%, immune to drought rationing. Third lane: canal never disrupts for you; +$50M/mo transit fees while you dominate North America; China's SA sphere −0.1/mo (their belt-and-road port play loses its hinge).</div>
                  </div>;})()}
              </div>
              <div style={{marginTop:'9px',paddingTop:'9px',borderTop:'1px solid #1f2937'}}>
                <div style={{fontSize:'9px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'4px'}}>Foreign energy concessions · technology for barrels</div>
                {Object.entries(CONCESSIONS).map(([ck,cp])=>{const have=concessions.has(ck);const nat=NATIONS[cp.nation];const rel=Math.round(nationRelations[cp.nation]||0);const reqs=[[`Materials L${cp.req.materials} (upgrading tech)`,(defLevels.materials||0)>=cp.req.materials],[`${nat?.n} relations ≥${cp.req.rel} (${rel})`,rel>=cp.req.rel],[`Embassy in ${nat?.n}`,embassies.has(cp.nation)]];const ok=reqs.every(r=>r[1]);const susp=have&&(sanctions.has(cp.nation)||rel<0);
                  return <div key={ck} style={{padding:'8px',background:'#111827',border:`1px solid ${have?'#14532d':'#1f2937'}`,borderRadius:'6px'}}>
                    <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:'11px',fontWeight:700,color:'#e5e7eb'}}>{cp.i} {cp.n} <span style={{color:'#6b7280',fontWeight:400}}>· {nat?.flag} {nat?.n}</span></span><span style={{fontSize:'10px',fontWeight:700,color:have?(susp?'#ef4444':'#4ade80'):'#6b7280'}}>{have?(susp?'SUSPENDED':`+$${Math.round(cp.income*(1+Math.max(0,(defLevels.materials||4)-4)*0.15))}M/mo`):`$${cp.cost}M`}</span></div>
                    <div style={{fontSize:'9px',color:'#6b7280',margin:'3px 0'}}>{cp.d}</div>
                    {!have&&<div style={{fontSize:'9px',marginBottom:'5px'}}>{reqs.map(([l,o])=><span key={l} style={{color:o?'#4ade80':'#ef4444',marginRight:'8px'}}>{o?'✓':'✗'} {l}</span>)}</div>}
                    {!have&&<button onClick={()=>dispatch({type:'signConcession',payload:{concession:ck}})} style={{width:'100%',background:ok?'#1e3a8a':'rgba(0,0,0,.35)',border:`1px solid ${ok?'#3b82f6':'#374151'}`,color:ok?'white':'#4b5563',padding:'5px',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>Sign concession — ${cp.cost}M</button>}
                    {have&&!stewardship[ck]&&<div style={{fontSize:'9px',color:'#9ca3af'}}>Income scales with Materials level · SA sphere +0.1/mo · at risk if a hostile power out-spheres you in {REGIONS[cp.region]?.n} by 25+ · suspended if you sanction {nat?.n}</div>}
                    {cp.intervention&&(()=>{const iv=cp.intervention;const st=stewardship[ck];const nw=navalWeight(forceDeployments[cp.region]);const isrSc=isrScore(platforms,defLevels,intelInfra,blackPrograms);const icd=actionCooldowns[`interv_${ck}`]||0;
                      const hostile=Math.max(sphere[cp.region]?.competitors?.china||0,sphere[cp.region]?.competitors?.russia||0);const chance=Math.min(0.95,0.5+isrSc*0.03+nw*0.05-hostile/200);
                      const ireqs=[[`Military ≥${iv.req.military} (${Math.round(stats?.military||0)})`,(stats?.military||0)>=iv.req.military],[`Naval weight ≥${iv.req.naval} in ${REGIONS[cp.region]?.n} (${nw})`,nw>=iv.req.naval],[`ISR ≥${iv.req.isr} (${isrSc})`,isrSc>=iv.req.isr]];const iok=ireqs.every(r=>r[1]);
                      if(st){const ramp=1+Math.min(1,st.mo/24);const inc=Math.round(iv.income*ramp*(1+0.25*(st.tiers||0))*(1+Math.max(0,(defLevels.materials||4)-4)*0.15)*(nw>=2?1:0.5));const tierCost=1000;const canTier=(st.tiers||0)<3&&(defLevels.materials||0)>=4+(st.tiers||0);
                        return <div style={{marginTop:'6px',paddingTop:'6px',borderTop:'1px solid #1f2937'}}>
                          <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:'10px',fontWeight:700,color:'#4ade80'}}>🇺🇸 STEWARDSHIP · month {st.mo} · production {Math.round(ramp*100)}%{st.unrest>0?' · ⏸ UNREST':''}</span><span style={{fontSize:'10px',fontWeight:700,color:nw>=2?'#4ade80':'#ef4444'}}>+${inc}M/mo{nw<2?' (no fleet: ½)':''}</span></div>
                          <div style={{fontSize:'9px',color:'#9ca3af',margin:'3px 0'}}>Every barrel sells through your channels; proceeds buy your goods (+$60/mo, {nat?.n} +0.3 rel/mo). SA sphere +0.25/mo, China/Russia displaced −0.2/mo. Keep naval weight 2+ offshore or shipping halves and unrest brews.{blocTrade.opec>=1?' Undercutting OPEC: Gulf relations drift.':''}</div>
                          <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
                            <button onClick={()=>dispatch({type:'rehabilitateFields',payload:{concession:ck}})} style={{flex:1,background:canTier?'rgba(74,222,128,.1)':'rgba(0,0,0,.35)',border:`1px solid ${canTier?'#4ade80':'#374151'}`,color:canTier?'#4ade80':'#4b5563',padding:'5px',borderRadius:'4px',fontSize:'9px',fontWeight:700}}>🏗️ Rehabilitate fields {st.tiers||0}/3 · $1B · +25%</button>
                            <button onClick={()=>dispatch({type:'handOverStewardship',payload:{concession:ck}})} style={{flex:1,background:'transparent',border:'1px solid #374151',color:'#9ca3af',padding:'5px',borderRadius:'4px',fontSize:'9px'}}>🤝 Hand over to interim government</button>
                          </div></div>;}
                      return <div style={{marginTop:'6px',paddingTop:'6px',borderTop:'1px solid #1f2937'}}>
                        <div style={{fontSize:'10px',fontWeight:700,color:'#f472b6'}}>⚔️ Intervention — {iv.n} · ${iv.cost}M · success {Math.round(chance*100)}%</div>
                        <div style={{fontSize:'9px',color:'#6b7280',margin:'3px 0'}}>{iv.d}</div>
                        <div style={{fontSize:'9px',marginBottom:'5px'}}>{ireqs.map(([l,o])=><span key={l} style={{color:o?'#4ade80':'#ef4444',marginRight:'8px'}}>{o?'✓':'✗'} {l}</span>)}</div>
                        <button onClick={()=>dispatch({type:'launchIntervention',payload:{concession:ck}})}style={{width:'100%',background:iok&&icd===0?'rgba(244,114,182,.1)':'rgba(0,0,0,.35)',border:`1px solid ${iok&&icd===0?'#f472b6':'#374151'}`,color:iok&&icd===0?'#f472b6':'#4b5563',padding:'5px',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>{icd>0?`⚔️ Regrouping — ${icd}mo`:`⚔️ Launch ${iv.n} — $${iv.cost}M`}</button>
                        <div style={{fontSize:'8px',color:'#6b7280',marginTop:'3px'}}>Success: ~3× a concession's income, ramping to 2× over 24 months as production recovers, +25%/tier of field rehabilitation. China/Russia tension +12, region relations −10, stability −2. Failure: stability −4, relations −30, 12mo cooldown.</div>
                      </div>;})()}
                  </div>;})}
              </div>
            </div>;})()}
          <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'10px'}}>Energy Policy Actions</div><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'9px'}}>{PA.filter(a=>a.t==='energy').map(a=><ActionCard key={a.id} action={a}/>)}</div></div>}

        {/* RESOURCES TAB */}
        {activeTab==='resources'&&<div style={{flex:1,overflowY:'auto',padding:'12px'}}>
          <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'12px'}}>Natural Resource Management</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(1,1fr)',gap:'10px',maxWidth:'650px'}}>
            {resources&&Object.entries(RES_META).map(([k,meta])=>{
              if(!resources[k])return null;
              const res=resources[k];const pct=res.max>0?Math.round((res.r/res.max)*100):0;
              const rate=resExtraction[k]||0;const monthsLeft=rate>0&&res.r>0?Math.round(res.r/(rate*meta.depRate)):null;
              const revPerMo=rate*meta.rev*((['oil','gas'].includes(k)&&['usa','russia','norway'].includes(country?.id||''))?getRefineMult(defLevels):1);
              const isEmpty=pct<2;
              return(<div key={k} style={{background:'#0d1117',border:`1px solid ${isEmpty?'#ef444444':pct<20?'#f0c04044':'#1f2937'}`,borderRadius:'9px',padding:'14px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}><span style={{fontSize:'24px'}}>{meta.i}</span><div><div style={{fontSize:'14px',fontWeight:700,color:'#f9fafb'}}>{meta.n}</div><div style={{fontSize:'11px',color:'#6b7280'}}>{isEmpty?'Depleted':pct>70?'Abundant':pct>30?'Moderate':'Low reserves'}</div></div></div>
                  <div style={{textAlign:'right'}}><div style={{fontSize:'17px',fontWeight:700,color:isEmpty?'#ef4444':pct<20?'#f0c040':'#4ade80'}}>{pct}%</div></div>
                </div>
                <div style={{height:'5px',background:'#1f2937',borderRadius:'3px',marginBottom:'10px'}}><div style={{height:'100%',width:`${pct}%`,background:isEmpty?'#ef4444':pct<20?'#f0c040':'#4ade80',borderRadius:'3px',transition:'width .5s'}}/></div>
                {!isEmpty&&<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'6px',marginBottom:'10px'}}>
                  <div style={{background:'#111827',borderRadius:'5px',padding:'7px',textAlign:'center'}}><div style={{fontSize:'10px',color:'#6b7280',marginBottom:'2px'}}>Revenue/mo</div><div style={{fontSize:'13px',fontWeight:700,color:'#4ade80'}}>${Math.round(revPerMo).toLocaleString()}M</div></div>
                  <div style={{background:'#111827',borderRadius:'5px',padding:'7px',textAlign:'center'}}><div style={{fontSize:'10px',color:'#6b7280',marginBottom:'2px'}}>Depletion</div><div style={{fontSize:'13px',fontWeight:700,color:'#d1d5db'}}>{(rate*(meta.depRate||0.01)).toFixed(2)}/mo</div></div>
                  <div style={{background:'#111827',borderRadius:'5px',padding:'7px',textAlign:'center'}}><div style={{fontSize:'10px',color:'#6b7280',marginBottom:'2px'}}>Yrs Left</div><div style={{fontSize:'13px',fontWeight:700,color:monthsLeft&&monthsLeft<24?'#ef4444':monthsLeft&&monthsLeft<60?'#f0c040':'#4ade80'}}>{monthsLeft?Math.round(monthsLeft/12)+'y':'∞'}</div></div>
                </div>}
                {isEmpty?<div style={{fontSize:'11px',color:'#ef4444',padding:'7px',background:'rgba(239,68,68,.06)',borderRadius:'4px',textAlign:'center'}}>Reserves depleted. Import deals required.</div>
                :<div><div style={{fontSize:'11px',color:'#9ca3af',marginBottom:'5px'}}>Extraction Rate:</div><div style={{display:'flex',gap:'5px'}}>{[0,1,2,3,4,5].map(v=><button key={v} onClick={()=>dispatch({type:'setExtraction',payload:{resource:k,level:v}})} style={{flex:1,background:(resExtraction[k]||0)===v?'#1d4ed8':'#111827',border:`1px solid ${(resExtraction[k]||0)===v?'#3b82f6':'#374151'}`,color:(resExtraction[k]||0)===v?'white':'#9ca3af',padding:'5px 0',borderRadius:'4px',fontSize:'11px',fontWeight:(resExtraction[k]||0)===v?700:400}}>{v===0?'Off':v}</button>)}</div></div>}
              </div>);
            })}
            {/* Greater Green River Basin */}
            {country?.id==='usa'&&<div style={{background:'#0d1117',border:`1px solid ${grrbState.unlocked?'#d97706':'#1f2937'}`,borderRadius:'9px',padding:'14px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}><span style={{fontSize:'24px'}}>🏔️</span><div><div style={{fontSize:'14px',fontWeight:700,color:'#f9fafb'}}>Greater Green River Basin</div><div style={{fontSize:'11px',color:'#d97706'}}>~3 trillion barrels kerogen equivalent · WY/CO/UT</div></div></div>
              <div style={{fontSize:'11px',color:'#9ca3af',lineHeight:'1.5',marginBottom:'10px'}}>The largest known hydrocarbon deposit on Earth. Economically viable extraction requires advanced material science and propulsion technology.</div>
              {grrbState.unlocked&&resources?.shaleOil&&<div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'6px',marginBottom:'10px'}}>
                  <div style={{background:'#111827',borderRadius:'5px',padding:'7px',textAlign:'center'}}><div style={{fontSize:'10px',color:'#6b7280',marginBottom:'2px'}}>Reserves</div><div style={{fontSize:'13px',fontWeight:700,color:'#d97706'}}>{Math.round(resources.shaleOil.r).toLocaleString()}</div></div>
                  <div style={{background:'#111827',borderRadius:'5px',padding:'7px',textAlign:'center'}}><div style={{fontSize:'10px',color:'#6b7280',marginBottom:'2px'}}>Revenue/unit</div><div style={{fontSize:'13px',fontWeight:700,color:'#d97706'}}>$12M × {getRefineMult(defLevels).toFixed(1)}× mult</div></div>
                </div>
                <div style={{fontSize:'11px',color:'#9ca3af',marginBottom:'5px'}}>Extraction Rate {grrbState.phase2?'(☢ in-situ — surface impact −60%)':'(environmental cost matures with Materials R&D)'}:</div>
                <div style={{display:'flex',gap:'5px'}}>{[0,1,2,3].map(v=><button key={v} onClick={()=>dispatch({type:'setExtraction',payload:{resource:'shaleOil',level:v}})} style={{flex:1,background:(resExtraction.shaleOil||0)===v?'#92400e':'#111827',border:`1px solid ${(resExtraction.shaleOil||0)===v?'#d97706':'#374151'}`,color:(resExtraction.shaleOil||0)===v?'white':'#9ca3af',padding:'5px 0',borderRadius:'4px',fontSize:'11px'}}>{v===0?'Off':v}</button>)}</div>
                {grrbState.phase2?
                  <div style={{marginTop:'9px',padding:'9px',background:'rgba(74,222,128,.06)',border:'1px solid #4ade80',borderRadius:'6px'}}>
                    <div style={{fontSize:'11px',fontWeight:700,color:'#4ade80',marginBottom:'2px'}}>☢ In-Situ Nuclear Retorting — ACTIVE</div>
                    <div style={{fontSize:'10px',color:'#9ca3af'}}>Reactor process heat liquefies the deep kerogen tranche downhole. Output ×2.5 · surface disruption −60% · +2,000 units recoverable reserves added.</div>
                  </div>
                :(()=>{const pOK=(defLevels.propulsion||0)>=6;const mOK=(defLevels.materials||0)>=5;const ready=pOK&&mOK;return(
                  <div style={{marginTop:'9px',padding:'9px',background:'#111827',border:`1px solid ${ready?'#4ade80':'#1f2937'}`,borderRadius:'6px',opacity:ready?1:0.7}}>
                    <div style={{fontSize:'11px',fontWeight:700,color:ready?'#4ade80':'#9ca3af',marginBottom:'2px'}}>☢ Phase II: In-Situ Nuclear Retorting</div>
                    <div style={{fontSize:'10px',color:'#6b7280',marginBottom:'5px'}}>Nuclear process heat liquefies heavy crude locked in the formation — the deep tranche conventional methods can't touch. Output ×2.5, surface impact −60%, +2,000 units reserves.</div>
                    <div style={{fontSize:'10px',marginBottom:'6px'}}>Requires: <span style={{color:pOK?'#4ade80':'#ef4444'}}>Propulsion L6 (Nuclear Thermal Drive){pOK?' ✓':` — you: ${defLevels.propulsion||0}`}</span> · <span style={{color:mOK?'#4ade80':'#ef4444'}}>Materials L5{mOK?' ✓':` — you: ${defLevels.materials||0}`}</span></div>
                    <button onClick={()=>dispatch({type:'ggrbPhase2'})} style={{width:'100%',background:ready?'rgba(74,222,128,.1)':'rgba(0,0,0,.3)',border:`1px solid ${ready?'#4ade80':'#374151'}`,color:ready?'#4ade80':'#4b5563',padding:'8px',borderRadius:'5px',fontSize:'11px',fontWeight:700}}>☢ Activate Phase II — $2,500M</button>
                  </div>);})()}
              </div>}
              {grrbState.surveying&&<div style={{padding:'10px',background:'rgba(217,119,6,.08)',borderRadius:'5px',textAlign:'center'}}><div style={{fontSize:'12px',color:'#d97706',animation:'pulse 2s infinite'}}>🔍 Geological Survey in progress — {grrbState.surveyMo} months remaining</div></div>}
              {!grrbState.unlocked&&!grrbState.surveying&&<div>
                <div style={{fontSize:'11px',color:'#6b7280',marginBottom:'8px'}}>Requires: Material Science L{(defLevels.materials||0)>=3?<span style={{color:'#4ade80'}}>✓3</span>:'3'} + Propulsion L{(defLevels.propulsion||0)>=2?<span style={{color:'#4ade80'}}>✓2</span>:'2'}</div>
                {canSurveyGGRB?<button onClick={()=>dispatch({type:'ggrbSurvey'})} style={{width:'100%',background:'rgba(217,119,6,.1)',border:'1px solid #d97706',color:'#d97706',padding:'10px',borderRadius:'5px',fontSize:'12px',fontWeight:700}}>🏔️ Commission Geological Survey — $800M · 6 months</button>
                :<div style={{fontSize:'11px',color:'#4b5563',padding:'8px',background:'rgba(0,0,0,.3)',borderRadius:'4px',textAlign:'center'}}>Unlock prerequisites to access survey option</div>}
              </div>}
            </div>}
            {/* Renewables */}
            <div style={{background:'#0d1117',border:'1px solid #1f2937',borderRadius:'9px',padding:'14px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}><span style={{fontSize:'22px'}}>🌿</span><div><div style={{fontSize:'14px',fontWeight:700,color:'#f9fafb'}}>Renewable Energy</div><div style={{fontSize:'11px',color:'#4ade80'}}>Infinite — grows with investment</div></div></div>
              {(()=>{const rT=(resources?.renewable?.solar||0)+(resources?.renewable?.wind||0)+(resources?.renewable?.hydro||0);const tier=getEnergyTier(resources,resExtraction,importContracts);return <div style={{fontSize:'10px',padding:'7px 9px',background:'rgba(74,222,128,.05)',border:'1px solid rgba(74,222,128,.25)',borderRadius:'5px',marginBottom:'10px',lineHeight:'1.6'}}>
                <span style={{color:'#4ade80',fontWeight:700}}>Grid level {rT}/15 · tier: {tier}</span><span style={{color:'#9ca3af'}}> — paying <span style={{color:'#4ade80',fontWeight:700}}>+${rT*6+(rT>=12?40:0)}M/mo</span> · GDP +{(rT*0.004).toFixed(3)} · −{(rT*0.04).toFixed(2)} inflation</span>
                <div style={{color:'#6b7280',marginTop:'2px'}}>
                  <span style={{color:rT>=4?'#4ade80':'#4b5563'}}>4+: shock resilience −50%</span> · <span style={{color:rT>=8?'#4ade80':'#4b5563'}}>8+: −75% & +healthcare</span> · <span style={{color:rT>=10?'#4ade80':'#4b5563'}}>10+: oil exports ×1.2</span> · <span style={{color:rT>=12?'#4ade80':'#4b5563'}}>12+: +$40M/mo grid exports</span>
                </div>
              </div>;})()}
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'6px',marginBottom:'10px'}}>
                {[['☀️','Solar','solar','#fbbf24'],['💨','Wind','wind','#60a5fa'],['💧','Hydro','hydro','#4ade80']].map(([em,n,k,col])=>{const lvl=resources?.renewable?.[k]||0;return <div key={k} style={{background:'#111827',borderRadius:'5px',padding:'8px',textAlign:'center'}}><div style={{fontSize:'16px'}}>{em}</div><div style={{fontSize:'11px',color:'#9ca3af',marginBottom:'4px'}}>{n}</div><div style={{display:'flex',gap:'2px',justifyContent:'center'}}>{Array.from({length:5}).map((_,i)=><div key={i} style={{width:'6px',height:'6px',borderRadius:'50%',background:i<lvl?col:'#374151'}}/>)}</div><button onClick={()=>dispatch({type:'buildRenewable',payload:{kind:k}})} style={{marginTop:'5px',width:'100%',background:lvl>=5?'transparent':'rgba(0,0,0,.4)',border:`1px solid ${lvl>=5?'#374151':col}`,color:lvl>=5?'#4b5563':col,padding:'4px',borderRadius:'3px',fontSize:'10px'}}>{lvl>=5?'Max':`+$400M`}</button></div>;})}</div>
            </div>
          </div>
        </div>}

        {/* DEFENSE TAB */}
        {activeTab==='defense'&&<div style={{flex:1,display:'flex',overflow:'hidden'}}>
          <div style={{width:'300px',background:'#0a0e14',borderRight:'1px solid #1f2937',overflowY:'auto',padding:'11px',flexShrink:0}}>
            <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'10px'}}>Force Overview</div>
            <div style={{fontSize:'10px',color:'#6b7280',marginBottom:'10px',lineHeight:'1.5'}}>Research happens in the <span style={{color:'#a78bfa'}}>Technology</span> tab. Here you build and field what research unlocks — platforms, black programs, the nuclear triad.</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr',gap:'7px'}}>
              {Object.entries(DV).map(([vert,def])=>{const lvl=defLevels[vert]||0;return(
                <div key={vert} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 7px',background:'#0d1117',borderRadius:'5px'}}>
                  <span style={{fontSize:'10px',color:'#9ca3af'}}>{def.i} {def.n}</span>
                  <div style={{display:'flex',gap:'2px'}}>{Array.from({length:7}).map((_,i)=><div key={i} style={{width:'5px',height:'5px',borderRadius:'50%',background:i<lvl?def.col:'#374151'}}/>)}</div>
                </div>);})}
            </div>
            <div style={{marginTop:'10px',padding:'8px',background:'#0d1117',borderRadius:'6px'}}>
              <div style={{fontSize:'10px',color:'#6b7280',marginBottom:'4px'}}>Deployed military power</div>
              <div style={{fontSize:'18px',fontWeight:800,color:'#f9fafb'}}>{Math.round(stats?.military||0)}<span style={{fontSize:'11px',color:'#6b7280'}}>/100</span></div>
            </div>
          </div>

          <div style={{flex:1,overflowY:'auto',padding:'12px',display:'flex',flexDirection:'column',gap:'12px'}}>
            {/* Research queue */}
            {Object.keys(defResearch).length>0&&<div>
              <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'7px'}}>Research Queue</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'7px'}}>
                {Object.entries(defResearch).map(([vert,mo])=>{const def=DV[vert];if(!def)return null;const totalMo=def.lvl[defLevels[vert]||0]?.mo||mo;const pct=Math.max(0,Math.round(((totalMo-mo)/totalMo)*100));return(<div key={vert} style={{background:'#0d1117',border:'1px solid rgba(167,139,250,.3)',borderRadius:'7px',padding:'10px'}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}><div><div style={{fontSize:'11px',fontWeight:700,color:'#f9fafb'}}>{def.n}</div><div style={{fontSize:'9px',color:'#a78bfa'}}>→ L{(defLevels[vert]||0)+1}: {def.lvl[defLevels[vert]||0]?.n}</div></div><div style={{fontSize:'11px',color:'#a78bfa',fontWeight:700}}>{mo}mo</div></div><div style={{height:'3px',background:'#1f2937',borderRadius:'2px'}}><div style={{height:'100%',width:`${pct}%`,background:'#a78bfa',borderRadius:'2px'}}/></div></div>);})}
              </div>
            </div>}

            {/* Export Marketplace */}
            <div>
              <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'7px'}}>Export Marketplace</div>
              <div style={{display:'flex',gap:'4px',flexWrap:'wrap',marginBottom:'7px',alignItems:'center'}}>
                <span style={{fontSize:'9px',color:'#6b7280'}}>Market demand:</span>
                {(()=>{const movers=Object.entries(demand).filter(([,v])=>Math.abs((v||1)-1)>=0.08).sort((a,b)=>Math.abs(b[1]-1)-Math.abs(a[1]-1)).slice(0,4);
                  return movers.length?movers.map(([v,d])=><span key={v} style={{fontSize:'9px',padding:'2px 6px',borderRadius:'3px',background:d>1?'rgba(74,222,128,.08)':'rgba(239,68,68,.08)',border:`1px solid ${d>1?'#14532d':'#7f1d1d'}`,color:d>1?'#4ade80':'#ef4444'}}>{DV[v]?.i} {DV[v]?.n} {d>1?'▲':'▼'}{Math.abs(Math.round((d-1)*100))}%</span>):<span style={{fontSize:'9px',color:'#4b5563'}}>stable — prices lock at signing</span>;})()}
              </div>
              <div style={{fontSize:'11px',color:'#6b7280',marginBottom:'7px'}}>Pick any system you've developed (L1+), then offer it to a willing buyer. Leading the world (✦) pays more; buyers won't import what they build at home or accept from a hostile power. Leverage ×{defLev.toFixed(2)}.</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'4px',marginBottom:'9px'}}>
                {Object.entries(DV).map(([vert,def])=>{const lvl=defLevels[vert]||0;const sel=selExportVert===vert;return(
                  <button key={vert} onClick={()=>setSelExportVert(sel?null:vert)} style={{background:sel?'#1d4ed8':'#0d1117',border:`1px solid ${sel?'#3b82f6':'#1f2937'}`,color:sel?'white':lvl>0?'#9ca3af':'#4b5563',padding:'4px 8px',borderRadius:'5px',fontSize:'10px',fontWeight:sel?700:400}}>{def.i} {def.n} <span style={{opacity:0.7}}>L{lvl}</span></button>);})}
              </div>
              {selExportVert&&<div style={{fontSize:'10px',color:'#9ca3af',marginBottom:'7px'}}>Offering: <span style={{color:'#f9fafb',fontWeight:700}}>{DV[selExportVert]?.n} L{defLevels[selExportVert]||0}</span> · global avg {(Object.entries(globalDef).reduce((s,[,n])=>s+(n[selExportVert]||0),0)/Math.max(1,Object.keys(globalDef).length)).toFixed(1)}</div>}
              {selExportVert&&(defLevels[selExportVert]||0)>=1&&<button onClick={()=>dispatch({type:'sellAllVertical',payload:{vertical:selExportVert}})} style={{width:'100%',marginBottom:'8px',background:'rgba(74,222,128,.1)',border:'1px solid #4ade80',color:'#4ade80',padding:'7px',borderRadius:'5px',fontSize:'11px',fontWeight:700}}>🤝 Sell {DV[selExportVert]?.n} to All Eligible Buyers</button>}
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'7px'}}>
                {BUYERS.filter(b=>b.id!==country?.id).map(buyer=>{
                  const key=selExportVert?`${buyer.id}_${selExportVert}`:'';
                  const hasDeal=defExports[key];
                  const excGlobal=Object.entries(globalDef);
                  const avgGlobal2=selExportVert&&excGlobal.length?excGlobal.reduce((s,[,n])=>s+(n[selExportVert]||0),0)/excGlobal.length:0;
                  const wontBuy=selExportVert&&(buyer.noBuy||[]).includes(selExportVert);
                  const bRel=nationRelations[buyer.id]!==undefined?nationRelations[buyer.id]:buyer.rel;
                  const hostile=bRel<-30;
                  const canSell=selExportVert&&!wontBuy&&!hostile&&(defLevels[selExportVert]||0)>=1;
                  const advantage2=Math.max(0,(defLevels[selExportVert]||0)-Math.floor(avgGlobal2));
                  return(<div key={buyer.id} style={{background:'#0d1117',border:'1px solid #1f2937',borderRadius:'7px',padding:'10px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'6px'}}><span style={{fontSize:'18px'}}>{buyer.flag}</span><div><div style={{fontSize:'11px',fontWeight:700,color:'#f9fafb'}}>{buyer.n}</div><div style={{fontSize:'9px',color:'#6b7280'}}>{buyer.align} · ${buyer.budget}M budget</div></div></div>
                    </div>
                    {Object.entries(defExports).filter(([k])=>k.startsWith(buyer.id)).map(([k,d])=><div key={k} style={{fontSize:'9px',color:'#4ade80',marginBottom:'3px'}}>✓ {DV[k.split('_')[1]]?.n} L{d.level} — ${d.revenue}M/yr</div>)}
                    {selExportVert&&<button onClick={()=>dispatch({type:'offerArms',payload:{nation:buyer.id,vertical:selExportVert}})} style={{width:'100%',background:hasDeal?'#14532d':wontBuy||hostile?'rgba(0,0,0,.5)':canSell?'#1d4ed8':'rgba(0,0,0,.4)',border:`1px solid ${hasDeal?'#4ade80':wontBuy?'#1f2937':hostile?'#7f1d1d':canSell?'#3b82f6':'#374151'}`,color:hasDeal?'#4ade80':wontBuy?'#4b5563':hostile?'#ef4444':canSell?'white':'#4b5563',padding:'5px',borderRadius:'4px',fontSize:'10px',fontWeight:600}}>{hasDeal?'Active':wontBuy?'Domestic producer':hostile?'Hostile':canSell?`Offer L${defLevels[selExportVert]||0}${advantage2>0?' ✦':''}`:'Develop first'}</button>}
                    {selExportVert&&canSell&&!hasDeal&&(()=>{const ch=[];if((sphere[buyer.region]?.player||0)>60)ch.push('sphere ×1.18');if(embassies.has(buyer.id))ch.push('attaché ×1.10');if(blocTrade.eu>=2&&BLOC_TRADE.eu.members.includes(buyer.id))ch.push('EU ×1.15');if(advantage2>0)ch.push(`lead +${(advantage2*13)}%`);return ch.length?<div style={{fontSize:'8px',color:'#60a5fa',marginTop:'3px'}}>{ch.join(' · ')}</div>:null;})()}
                  </div>);
                })}
              </div>
            </div>

            {/* Intelligence Services */}
            {(()=>{const age=sectorAge.defense||0;if(age<=360)return null;const eff=age>480?Math.max(0.7,1-(age-480)*0.0008):1;const cost=recapCost(stats?.treasury);return(
              <div style={{padding:'10px',background:age>480?'rgba(239,68,68,.07)':'rgba(240,192,64,.06)',border:`1px solid ${age>480?'#ef4444':'#f0c040'}`,borderRadius:'8px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px'}}>
                  <div>
                    <div style={{fontSize:'12px',fontWeight:700,color:age>480?'#ef4444':'#f0c040'}}>{age>480?`⚠ Force Obsolescence — fleet effectiveness ×${eff.toFixed(2)}`:`⏱ Aging Force — obsolescence in ${480-age}mo`}</div>
                    <div style={{fontSize:'10px',color:'#9ca3af',marginTop:'2px'}}>Platforms older than 40 years lose effectiveness ({age}mo since last recapitalization). Recapitalize to reset the clock and restore full power.</div>
                  </div>
                  <button onClick={()=>dispatch({type:'recapitalizeForces'})} style={{background:'rgba(74,222,128,.1)',border:'1px solid #4ade80',color:'#4ade80',padding:'8px 14px',borderRadius:'6px',fontSize:'11px',fontWeight:700,flexShrink:0}}>🔄 Recapitalize Forces — ${cost.toLocaleString()}M</button>
                </div>
              </div>);})()}
            {panelBox('oob','🗺️ Order of Battle · every theater asset, where it is, what it is doing','#1e3a5f',(()=>{
              const T=DEPLOYABLE;const rows=T.map(pid=>{const meta=PLATFORMS[pid]||BLACK_PROGRAMS[pid];const own=BLACK_PROGRAMS[pid]?(+blackPrograms[pid]||0):((platforms[pid]||0)+(platformsImported[pid]||0));if(!own)return null;const where=Object.entries(forceDeployments).filter(([,o])=>(o?.[pid]||0)>0).map(([rid,o])=>[rid,o[pid]]);const st=where.reduce((a,[,n])=>a+n,0);return {pid,meta,own,where,st,res:own-st};}).filter(Boolean);
              if(!rows.length)return <div style={{fontSize:'10px',color:'#6b7280'}}>No theater assets yet — build carriers, wings, hulls or field a SAP below.</div>;
              return <div style={{display:'grid',gap:'6px'}}>{rows.map(r=><div key={r.pid} style={{padding:'7px',background:'#111827',border:'1px solid #1f2937',borderRadius:'6px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'3px'}}><span style={{fontSize:'11px',fontWeight:700,color:'#e5e7eb'}}>{r.meta.i} {r.meta.n}</span><span style={{fontSize:'10px',color:'#9ca3af'}}>{r.st}/{r.own} stationed · <b style={{color:r.res>0?'#4ade80':'#6b7280'}}>{r.res} in reserve</b></span></div>
                <div style={{display:'flex',flexWrap:'wrap',gap:'4px',alignItems:'center'}}>
                  {r.where.map(([rid,n])=><span key={rid} style={{fontSize:'9px',padding:'2px 6px',background:'#0d1117',border:'1px solid #374151',borderRadius:'4px',color:'#d1d5db'}}>{REGIONS[rid]?.n} ×{n} <span style={{color:'#60a5fa'}}>{({deter:'🛡️',escort:'🚢',isr:'👁️',exercise:'🤝',humanitarian:'🆘'})[forcePosture[rid]||'deter']}</span> <button onClick={()=>dispatch({type:'recallUnit',payload:{region:rid,unit:r.pid}})} style={{marginLeft:'3px',background:'transparent',border:'none',color:'#ef4444',fontSize:'10px',cursor:'pointer'}}>recall</button></span>)}
                  {r.res>0&&<span style={{display:'inline-flex',gap:'3px',alignItems:'center'}}><select id={`oob_${r.pid}`} defaultValue="" style={{background:'#0d1117',color:'#d1d5db',border:'1px solid #374151',borderRadius:'4px',fontSize:'9px',padding:'2px'}}><option value="" disabled>station in…</option>{Object.entries(REGIONS).map(([rid,rg])=><option key={rid} value={rid}>{rg.n}</option>)}</select><button onClick={()=>{const sel=document.getElementById(`oob_${r.pid}`);const rid=sel?.value;if(!rid){showToast('Pick a region');return;}dispatch({type:'deployUnit',payload:{region:rid,unit:r.pid}});}} style={{background:'#1d4ed8',border:'none',color:'white',padding:'2px 8px',borderRadius:'4px',fontSize:'9px',fontWeight:700}}>+ Station</button></span>}
                </div></div>)}</div>;})())}

            {Object.keys(blackPrograms).length>0&&(
              <div style={{padding:'8px 11px',background:'rgba(167,139,250,.06)',border:'1px solid #4c1d95',borderRadius:'8px',display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
                <span style={{fontSize:'10px',color:'#a78bfa',fontWeight:700,letterSpacing:'1px'}}>◆ OPERATIONAL</span>
                {Object.keys(blackPrograms).map(bid=><span key={bid} style={{fontSize:'10px',color:'#c4b5fd'}}>{BLACK_PROGRAMS[bid].i} {BLACK_PROGRAMS[bid].n}</span>)}
                <span style={{fontSize:'9px',color:'#6b7280'}}>· deployable below — B-21/SSN(X) suppress ×2, SR-72 runs regional recon</span>
              </div>)}
            {country?.id==='japan'&&!activePolicies.has('jp_normalization')&&(
              <div style={{padding:'10px',background:'rgba(239,68,68,.05)',border:'1px solid #ef444466',borderRadius:'8px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px'}}>
                  <div>
                    <div style={{fontSize:'12px',fontWeight:700,color:'#f9fafb'}}>🇯🇵 Article 9 — Constitutional Constraint</div>
                    <div style={{fontSize:'10px',color:'#9ca3af',marginTop:'2px',maxWidth:'520px'}}>Munitions and Missile programs carry +40% cost under the pacifist constitution. Defense Normalization removes the penalty permanently — counterstrike doctrine, standoff weapons, 2%-GDP posture — at real political cost: −6 stability now, political turmoil −0.05/mo for a year.</div>
                  </div>
                  <button onClick={()=>dispatch({type:'japanNormalization'})} style={{background:'rgba(239,68,68,.1)',border:'1px solid #ef4444',color:'#ef4444',padding:'8px 14px',borderRadius:'6px',fontSize:'11px',fontWeight:700,flexShrink:0}}>⚖️ Enact Normalization — $500M · −6 stability</button>
                </div>
              </div>)}
            {country?.id==='japan'&&activePolicies.has('jp_normalization')&&(
              <div style={{padding:'8px 10px',background:'rgba(74,222,128,.05)',border:'1px solid #4ade8055',borderRadius:'8px',fontSize:'10px',color:'#4ade80'}}>⚖️ Defense Normalization in force — Munitions & Missiles at standard cost. Counterstrike doctrine adopted.</div>)}
            {/* Black Programs — classified next-gen platforms */}
            <div>
              <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'7px'}}>Special Access Programs · the bleeding edge</div>
              {!sapOffice?(
                <div style={{padding:'10px',background:'#0d1117',border:'1px solid #1f2937',borderRadius:'8px'}}>
                  <div style={{fontSize:'11px',color:'#9ca3af',marginBottom:'7px'}}>Establish a classified Special Access Program office to pursue next-generation platforms — stealth bombers, 6th-gen fighters, hypersonic ISR. Requires deep R&D and a black budget. <span style={{color:'#f0c040'}}>These become prime espionage targets once fielded.</span></div>
                  <button onClick={()=>dispatch({type:'establishSapOffice'})} disabled={(stats?.treasury||0)<1500} style={{background:'rgba(167,139,250,.1)',border:`1px solid ${(stats?.treasury||0)<1500?'#7f1d1d':'#a78bfa'}`,color:(stats?.treasury||0)<1500?'#4b5563':'#a78bfa',padding:'8px 14px',borderRadius:'6px',fontSize:'11px',fontWeight:700,opacity:(stats?.treasury||0)<1500?0.7:1}}>🔒 Establish SAP Office — $1,500M{(stats?.treasury||0)<1500?' (short)':''}</button>
                </div>
              ):(
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'7px'}}>
                  {Object.entries(BLACK_PROGRAMS).map(([bid,bp])=>{
                    const owned=blackPrograms[bid];const researching=blackResearch?.id===bid;
                    const reqMet=meetsReq(bp.req,defLevels);
                    const busy=blackResearch&&!researching;
                    return(<div key={bid} style={{background:owned?'rgba(167,139,250,.06)':'#0d1117',border:`1px solid ${owned?'#a78bfa':researching?'#3b82f6':'#1f2937'}`,borderRadius:'7px',padding:'10px',opacity:reqMet||owned?1:0.55}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
                        <span style={{fontSize:'11px',fontWeight:700,color:owned?'#a78bfa':'#f9fafb'}}>{bp.i} {bp.n}</span>
                        {owned&&<span style={{fontSize:'10px',color:'#4ade80',fontWeight:700}}>✓ FIELDED</span>}
                      </div>
                      <div style={{fontSize:'9px',color:'#6b7280',marginBottom:'4px'}}>{bp.d}</div>
                      <div style={{fontSize:'9px',marginBottom:'5px'}}>Req: {Object.entries(bp.req).map(([v,rq])=><span key={v} style={{color:(defLevels[v]||0)>=rq?'#4ade80':'#ef4444',marginRight:'4px'}}>{DV[v]?.n} L{rq}</span>)}</div>
                      {owned?(()=>{const n=+blackPrograms[bid]||1;const rate=sapRate(n);const runCost=sapRunCost(bp,n);const indOk=(defLevels.materials||0)>=4;const canRun=indOk&&(stats?.treasury||0)>=runCost;
                        return <div>
                          <div style={{fontSize:'9px',color:'#a78bfa'}}>+{bp.mil} military{bp.bonus==='isr'?' · +6 ISR':bp.bonus==='multiplier'?' · air ×1.15':bp.bonus==='deterrent'?' · nuclear deterrent':''} · <b style={{color:'#c4b5fd'}}>{n} unit{n>1?'s':''}</b> · force mil +{Math.round(bp.mil*Math.sqrt(n))} · next tranche at {Math.round(rate*100)}% of program</div>
                          {<button onClick={()=>dispatch({type:'sapTranche',payload:{program:bid}})} style={{marginTop:'4px',width:'100%',background:canRun?'rgba(167,139,250,.12)':'rgba(0,0,0,.35)',border:`1px solid ${canRun?'#a78bfa':'#374151'}`,color:canRun?'#c4b5fd':'#4b5563',padding:'5px',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>🏭 Tranche #{n+1} — ${runCost}M{indOk?'':' · needs Materials L4'}</button>}
                        </div>;})()
                      :researching?<div style={{fontSize:'10px',color:'#3b82f6',fontWeight:700}}>⏳ {blackResearch.mo-blackResearch.prog}mo to operational</div>
                      :<button onClick={()=>dispatch({type:'sapInitiate',payload:{program:bid}})} style={{width:'100%',background:reqMet&&!busy?'#4c1d95':'rgba(0,0,0,.4)',border:`1px solid ${reqMet&&!busy?'#a78bfa':'#374151'}`,color:reqMet&&!busy?'white':'#4b5563',padding:'5px',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>{busy?'SAP busy':`Initiate $${(bp.cost/1000).toFixed(1)}B · ${bp.mo}mo`}</button>}
                    </div>);})}
                </div>
              )}
            </div>
            {/* Force Structure — converting R&D into deployed power */}
            <div>
              <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'7px'}}>Force Structure · military power comes from deployed platforms</div>
              <div style={{fontSize:'11px',color:'#6b7280',marginBottom:'8px',padding:'7px 9px',background:'#0d1117',borderRadius:'5px',border:'1px solid #1f2937'}}>
                Research unlocks designs — building them creates power. Effectiveness scales +7% per research level above requirement.
                Total deployed: <span style={{color:'#f9fafb',fontWeight:700}}>{Object.values(platforms).reduce((a,b)=>a+(b||0),0)} units</span> · Maintenance: <span style={{color:'#f87171',fontWeight:700}}>${Object.entries(platforms).reduce((s,[pid,ct])=>s+(PLATFORMS[pid]?.maint||0)*(ct||0),0)}M/mo</span>
                <div style={{marginTop:'4px'}}>
                  Deterrence: <span style={{color:(stats?.military||0)>=70?'#4ade80':'#6b7280'}}>{(stats?.military||0)>=85?'−50% foreign pressure & sphere loss':(stats?.military||0)>=70?'−25% foreign pressure & sphere loss':'none — reach Military 70+'}</span>
                  {' · '}Projection: <span style={{color:'#3b82f6'}}>+{Math.min(0.6,((platforms.carrier_group||0)*2+(platforms.sub_fleet||0)+(platforms.fighter_wing||0)*0.5+(platforms.drone_swarm||0)+(platforms.hypersonic_bty||0))*0.05).toFixed(2)}/mo sphere in contested regions</span>
                  {' · '}Trade lanes: <span style={{color:'#4ade80'}}>+${((platforms.carrier_group||0)+(platforms.sub_fleet||0))*10}M/mo</span>
                  {' · '}Exports: <span style={{color:'#fbbf24'}}>+25% revenue on fielded systems</span>
                </div>
                {(()=>{const legs=((platforms.ssbn_fleet||0)>0?1:0)+((platforms.strategic_bombers||0)>0?1:0)+((platforms.icbm_force||0)>0?1:0);return <div style={{marginTop:'4px'}}>
                  ☢ Nuclear Triad: <span style={{color:legs===3?'#4ade80':legs>0?'#f0c040':'#6b7280',fontWeight:700}}>{legs}/3 legs {legs===3?'— SUPREME DETERRENCE (foreign pressure −75%, +0.05 stability/mo)':legs===2?'— strong deterrent (−50%)':legs===1?'— minimal deterrent (−30%)':'— none (SSBN: Naval 5 + Missiles 4 · Bombers: Aircraft 4 + Munitions 3 · ICBM: Missiles 5 + Munitions 4)'}</span>
                </div>;})()}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'8px'}}>
                <div style={{background:'#0d1117',border:'1px solid #1f2937',borderRadius:'7px',padding:'10px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}><span style={{fontSize:'11px',color:'#9ca3af'}}>Personnel Pay</span><span style={{fontSize:'12px',fontWeight:700,color:personnelPay<90?'#ef4444':personnelPay>=120?'#4ade80':'#f0c040'}}>{personnelPay}%</span></div>
                  <input type="range" min="80" max="150" step="5" value={personnelPay} onChange={e=>dispatch({type:'setPersonnelPay',payload:{pay:+e.target.value}})} style={{width:'100%',accentColor:personnelPay<90?'#ef4444':personnelPay>=120?'#4ade80':'#3b82f6'}}/>
                  <div style={{fontSize:'10px',color:'#6b7280',marginTop:'3px'}}>
                    {personnelPay<90?'⚠ Readiness −15%, morale drain (−0.03 stability/mo)':personnelPay>=120?'✓ Readiness +10%, veteran loyalty (+0.02 stability/mo)':'Standard readiness'}
                  </div>
                  <div style={{fontSize:'10px',color:'#f87171',marginTop:'2px'}}>Payroll: ${Math.round(Object.values(platforms).reduce((a,b)=>a+(b||0),0)*3*(personnelPay/100))}M/mo ({Object.values(platforms).reduce((a,b)=>a+(b||0),0)} units)</div>
                </div>
                <div style={{background:'#0d1117',border:'1px solid #1f2937',borderRadius:'7px',padding:'10px'}}>
                  <div style={{fontSize:'11px',color:'#9ca3af',marginBottom:'6px'}}>Acquisition Policy</div>
                  {[['efficiency','💲 Efficiency','Build −15%, maint −15%, effectiveness −5%'],['balanced','⚖️ Balanced','Standard terms'],['surge','🚀 Surge','Build +25%, maint +20%, effectiveness +8%']].map(([m,l,d])=>(
                    <button key={m} onClick={()=>dispatch({type:'setProcurement',payload:{mode:m}})} style={{display:'block',width:'100%',marginBottom:'4px',background:procureMode===m?'#1d4ed8':'transparent',border:`1px solid ${procureMode===m?'#3b82f6':'#374151'}`,color:procureMode===m?'white':'#9ca3af',padding:'5px 8px',borderRadius:'4px',fontSize:'10px',textAlign:'left',fontWeight:procureMode===m?700:400}}>{l} — {d}</button>
                  ))}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'7px'}}>
                {Object.entries(PLATFORMS).map(([pid,p])=>{
                  const ct=platforms[pid]||0;
                  const reqsMet=meetsReq(p.req,defLevels);
                  const over=Object.entries(p.req).reduce((o,[v,rq])=>o+Math.max(0,(defLevels[v]||0)-rq),0);
                  const eff=Math.min(2,1+0.07*over)*(procureMode==='surge'?1.08:procureMode==='efficiency'?0.95:1);
                  const procCost=procurementCost(p,procureMode);
                  return(<div key={pid} style={{background:'#0d1117',border:`1px solid ${ct>0?'#14532d':'#1f2937'}`,borderRadius:'7px',padding:'10px',opacity:reqsMet?1:0.55}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'6px'}}><span style={{fontSize:'17px'}}>{p.i}</span><div style={{fontSize:'11px',fontWeight:700,color:'#f9fafb'}}>{p.n}</div></div>
                      {(ct>0||(platformsImported[pid]||0)>0)&&<span style={{fontSize:'12px',fontWeight:800,color:'#4ade80'}}>×{ct}{(platformsImported[pid]||0)>0&&<span style={{color:'#f0c040',fontSize:'10px'}}> +{platformsImported[pid]}🌐</span>}</span>}
                    </div>
                    <div style={{fontSize:'10px',color:'#6b7280',marginBottom:'4px'}}>Req: {Object.entries(p.req).map(([v,rq])=><span key={v} style={{color:(defLevels[v]||0)>=rq?'#4ade80':'#ef4444',marginRight:'5px'}}>{DV[v]?.n} L{rq}{(defLevels[v]||0)>=rq?'✓':` (you: ${defLevels[v]||0})`}</span>)}</div>
                    <div style={{fontSize:'10px',color:'#9ca3af',marginBottom:'6px'}}>+{(p.mil*eff).toFixed(1)} military each{eff>1?` (${Math.round((eff-1)*100)}% tech bonus)`:''} · ${p.maint}M/mo maint</div>
                    {p.d&&<div style={{fontSize:'9px',color:'#60a5fa',marginBottom:'4px'}}>{p.d}</div>}
                    <div style={{fontSize:'8px',letterSpacing:'1px',marginBottom:'4px',color:DEPLOYABLE.includes(pid)?'#f0c040':'#6b7280'}}>{DEPLOYABLE.includes(pid)?'THEATER ASSET — station it in a region to act':'NATIONAL ASSET — effect applies automatically'}</div>
                    {p.triad&&<div style={{fontSize:'9px',color:'#ef4444',marginBottom:'4px',letterSpacing:'1px'}}>☢ STRATEGIC — cannot be purchased abroad; domestic program only</div>}
                    <div style={{display:'flex',gap:'5px',flexWrap:'wrap'}}>
                      {p.dev&&!developed.has(pid)&&(()=>{const pd=platformDev[pid];if(pd)return <div style={{flex:1,fontSize:'10px',color:'#3b82f6',fontWeight:700,padding:'5px',background:'#0d1117',border:'1px solid #1e3a8a',borderRadius:'4px'}}>🔬 Developing — {pd.mo}mo</div>;return <button onClick={()=>dispatch({type:'developPlatform',payload:{platform:pid}})} style={{flex:1,background:reqsMet?'#1e3a8a':'rgba(0,0,0,.4)',border:`1px solid ${reqsMet?'#3b82f6':'#374151'}`,color:reqsMet?'white':'#4b5563',padding:'5px',borderRadius:'4px',fontSize:'10px',fontWeight:600}}>🔬 Develop ${p.dev.cost}M · {p.dev.mo}mo</button>;})()}
                      {(!p.dev||developed.has(pid))&&<button onClick={()=>dispatch({type:'buildPlatform',payload:{platform:pid}})} style={{flex:1,background:reqsMet?'#1d4ed8':'rgba(0,0,0,.4)',border:`1px solid ${reqsMet?'#3b82f6':'#374151'}`,color:reqsMet?'white':'#4b5563',padding:'5px',borderRadius:'4px',fontSize:'10px',fontWeight:600}}>Build ${procCost}M</button>}
                      {!reqsMet&&!p.triad&&<button onClick={()=>dispatch({type:'importPlatform',payload:{platform:pid}})} style={{flex:1,background:'rgba(240,192,64,.08)',border:'1px solid #f0c040',color:'#f0c040',padding:'5px',borderRadius:'4px',fontSize:'10px',fontWeight:600}}>🌐 Purchase ${Math.round(p.cost*1.8)}M</button>}
                      {ct>0&&<button onClick={()=>dispatch({type:'decommissionPlatform',payload:{platform:pid}})} style={{background:'rgba(239,68,68,.08)',border:'1px solid #ef4444',color:'#ef4444',padding:'5px 8px',borderRadius:'4px',fontSize:'10px'}}>−1</button>}
                      {(platformsImported[pid]||0)>0&&<button onClick={()=>dispatch({type:'retireImported',payload:{platform:pid}})} style={{background:'rgba(240,192,64,.06)',border:'1px solid #f0c040',color:'#f0c040',padding:'5px 8px',borderRadius:'4px',fontSize:'10px'}}>−1🌐</button>}
                    </div>
                  </div>);
                })}
              </div>
            </div>

                        {Object.keys(defExports).length>0&&<div>
              <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'7px'}}>Active Export Deals</div>
              {Object.entries(defExports).map(([k,d])=>{const[bid,vert]=k.split('_');const buyer=BUYERS.find(b=>b.id===bid);return(<div key={k} style={{background:'#0d1117',border:'1px solid #14532d',borderRadius:'6px',padding:'9px',marginBottom:'6px',display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><div style={{fontSize:'11px',fontWeight:700,color:'#f9fafb'}}>{buyer?.flag} {buyer?.n} — {DV[vert]?.n}</div><div style={{fontSize:'10px',color:'#4ade80'}}>${d.revenue}M/yr · Rel: {d.relationship}%</div></div><button onClick={()=>dispatch({type:'cutExportDeal',payload:{deal:k}})} style={{background:'rgba(239,68,68,.08)',border:'1px solid #ef4444',color:'#ef4444',padding:'3px 8px',borderRadius:'3px',fontSize:'10px'}}>Cut Off</button></div>);})}
            </div>}
          </div>
        </div>}

        {/* TECHNOLOGY TAB */}
        {activeTab==='technology'&&<div style={{flex:1,overflowY:'auto',padding:'12px'}}>
          {vitalsDrill&&<VitalsDrillPanel/>}
          <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'10px'}}>Technology & Innovation</div>
          {(()=>{const ip=Math.round(ipPortfolio);const lic=ipPolicy==='license'?Math.round(ip*0.6):ipPolicy==='balanced'?Math.round(ip*0.3):0;return(
          <div style={{marginBottom:'16px',padding:'11px',background:'#0d1117',borderRadius:'8px',border:'1px solid #1f2937'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
              <span style={{fontSize:'11px',fontWeight:700,color:'#f9fafb'}}>💡 Intellectual Property Portfolio</span>
              <span style={{fontSize:'13px',fontWeight:800,color:'#a78bfa'}}>{ip}<span style={{fontSize:'10px',color:'#6b7280'}}> IP value</span></span>
            </div>
            <div style={{fontSize:'10px',color:'#6b7280',marginBottom:'8px'}}>Your research depth compounds into IP. Choose how to wield it: license it for royalties (but rivals catch up), protect it as a moat (harder to steal), or balance both. {lic>0&&<span style={{color:'#4ade80'}}>Royalties: +${lic}M/mo.</span>}</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'5px'}}>
              {[['protect',IP_POLICY_LABELS.protect,'Theft-resistant moat'],['balanced',IP_POLICY_LABELS.balanced,'Some royalties + defense'],['license',IP_POLICY_LABELS.license,'Max royalties, opens you']].map(([k,lab,sub])=>(
                <button key={k} onClick={()=>dispatch({type:'setIpPolicy',payload:{policy:k}})} style={{background:ipPolicy===k?'#4c1d95':'transparent',border:`1px solid ${ipPolicy===k?'#a78bfa':'#374151'}`,color:ipPolicy===k?'white':'#9ca3af',padding:'6px 4px',borderRadius:'5px',fontSize:'10px',fontWeight:700,textAlign:'center'}}>{lab}<div style={{fontSize:'8px',color:ipPolicy===k?'#c4b5fd':'#6b7280',marginTop:'2px',fontWeight:400}}>{sub}</div></button>))}
            </div>
            <div style={{fontSize:'9px',color:'#6b7280',marginTop:'7px'}}>{ipPolicy==='protect'?'+12% espionage resistance — rivals struggle to steal your tech.':ipPolicy==='license'?'−8% espionage resistance, but maximum royalty income.':'Moderate royalties with baseline protection.'}</div>
          </div>);})()}
          <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'}}>Defense R&D — 10 verticals, research feeds Defense, Technology & Intel</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'8px',marginBottom:'16px'}}>
            <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'10px'}}>R&D Verticals</div>
            {Object.entries(DV).map(([vert,def])=>{
              const lvl=defLevels[vert]||0;const isRes=!!defResearch[vert];const moLeft=defResearch[vert]||0;
              const isSel=selDefVert===vert;const nextLvl=def.lvl[lvl];const qm=getQualMult(vert,defLevels);
              const disc=darpaDisc[vert]||0;const cost=nextLvl?Math.round(nextLvl.$*(1-disc)):0;
              const excGlobal=Object.entries(globalDef);
              const topGlobal=excGlobal.length?Math.max(...excGlobal.map(([,n])=>n[vert]||0)):0;
              const avgGlobal=excGlobal.length?excGlobal.reduce((s,[,n])=>s+(n[vert]||0),0)/excGlobal.length:0;
              return(<div key={vert} style={{background:isSel?'#1a1f2e':'#0d1117',border:`1px solid ${isSel?def.col+'88':'#1f2937'}`,borderRadius:'7px',padding:'10px',marginBottom:'6px',cursor:'pointer',transition:'all .15s'}} onClick={()=>setSelDefVert(isSel?null:vert)}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'4px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'7px'}}><span style={{fontSize:'16px'}}>{def.i}</span><div><div style={{fontSize:'11px',fontWeight:700,color:'#f9fafb'}}>{def.n}</div><div style={{fontSize:'10px',color:'#6b7280'}}>{lvl>0?def.lvl[lvl-1]?.n:'Not started'}</div></div></div>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'2px'}}>
                    <div style={{display:'flex',gap:'2px'}}>{Array.from({length:7}).map((_,i)=><div key={i} style={{width:'5px',height:'5px',borderRadius:'50%',background:i<lvl?def.col:'#374151'}}/>)}</div>
                    {lvl>=1&&<span style={{fontSize:'9px',color:lvl>Math.floor(avgGlobal)?'#4ade80':'#3b82f6',letterSpacing:'0.5px'}}>{lvl>Math.floor(avgGlobal)?'EXPORTABLE ✦':'EXPORTABLE'}</span>}
                  {lvl>0&&<span style={{fontSize:'8px',color:'#6b7280'}}>world avg {avgGlobal.toFixed(1)}</span>}
                  </div>
                </div>
                {isRes&&<div style={{fontSize:'9px',color:'#a78bfa',padding:'2px 5px',background:'rgba(167,139,250,.1)',borderRadius:'3px',marginBottom:'3px',animation:'pulse 2s infinite'}}>🔬 Researching L{lvl+1} — {Math.ceil(moLeft)}mo</div>}
                {isSel&&nextLvl&&<div style={{marginTop:'7px',borderTop:'1px solid #1f2937',paddingTop:'7px'}}>
                  <div style={{fontSize:'11px',color:'#9ca3af',marginBottom:'5px'}}>Next: <span style={{color:'#f9fafb',fontWeight:600}}>{nextLvl.n}</span></div>
                  <div style={{display:'flex',gap:'3px',flexWrap:'wrap',marginBottom:'5px'}}>
                    <span style={{fontSize:'10px',padding:'1px 5px',background:'rgba(0,0,0,.4)',border:'1px solid #374151',borderRadius:'3px',color:'#a78bfa'}}>+{nextLvl.mil} military</span>
                    {nextLvl.sp&&Object.entries(nextLvl.sp).map(([k,v])=>typeof v==='number'?fxBadge(k,v,true):null)}
                  </div>
                  {nextLvl.disc&&<div style={{fontSize:'9px',color:'#f0c040',marginBottom:'5px'}}>⚡ DARPA: {Object.entries(nextLvl.disc).map(([k,v])=>`${k} invest -${Math.round(v*100)}%`).join(', ')}</div>}
                  {qm<1&&<div style={{fontSize:'9px',color:'#f0c040',marginBottom:'5px'}}>⚠ {Math.round(qm*100)}% effectiveness — chain: {def.chain.join(', ')}</div>}
                  {disc>0&&<div style={{fontSize:'9px',color:'#4ade80',marginBottom:'5px'}}>🔬 DARPA discount: -{Math.round(disc*100)}%</div>}
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',color:'#6b7280',marginBottom:'6px'}}><span>Cost: ${cost.toLocaleString()}M{(RD_MODS[country?.id]?.cheap||[]).includes(vert)&&<span style={{color:'#4ade80'}}> · national focus −25%</span>}{(RD_MODS[country?.id]?.exp||[]).includes(vert)&&!(country?.id==='japan'&&activePolicies.has('jp_normalization'))&&<span style={{color:'#f0c040'}}> · constrained +40%</span>}</span><span>{Math.round(nextLvl.mo*(1+(1-qm)*0.5))}mo</span></div>
                  {!isRes&&lvl<7&&<button onClick={e=>{e.stopPropagation();dispatch({type:'investDefense',payload:{vertical:vert}});}} style={{width:'100%',background:'#1d4ed8',border:'none',color:'white',padding:'6px',borderRadius:'4px',fontSize:'11px',fontWeight:600}}>Invest ${cost.toLocaleString()}M → L{lvl+1}</button>}
                  {lvl<7&&<div style={{marginTop:'6px',fontSize:'9px',color:'#6b7280'}}>You({lvl}) | {excGlobal.slice(0,3).map(([n,nv])=>`${n}(${Math.round(nv[vert]||0)})`).join(' | ')}</div>}
                </div>}
                {isSel&&lvl>=7&&<div style={{marginTop:'6px',fontSize:'11px',color:'#4ade80',textAlign:'center',padding:'4px'}}>✓ Maximum level achieved</div>}
              </div>);
            })}
          </div>
          <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'}}>Civilian Technology Programs</div>
          {activeEffects.filter(e=>['education','gdpGrowth','healthcare'].includes(e.stat)).length>0&&<div style={{marginBottom:'10px',padding:'10px',background:'rgba(167,139,250,.06)',border:'1px solid rgba(167,139,250,.3)',borderRadius:'7px'}}>
            <div style={{fontSize:'11px',color:'#a78bfa',fontWeight:600,marginBottom:'5px'}}>Active Technology Effects</div>
            {activeEffects.filter(e=>['education','gdpGrowth','healthcare'].includes(e.stat)).map(e=><div key={e.id} style={{fontSize:'11px',color:'#9ca3af',marginBottom:'2px'}}>• {e.source}: {SC[e.stat]?.label} {e.d>0?'+':''}{e.d.toFixed(2)}/mo ({e.monthsLeft}mo remaining)</div>)}
          </div>}
          {Object.keys(darpaDisc).length>0&&<div style={{marginBottom:'10px',padding:'10px',background:'rgba(240,192,64,.06)',border:'1px solid rgba(240,192,64,.3)',borderRadius:'7px'}}>
            <div style={{fontSize:'11px',color:'#f0c040',fontWeight:600,marginBottom:'5px'}}>⚡ DARPA Spillover Discounts Active</div>
            {Object.entries(darpaDisc).map(([k,v])=><div key={k} style={{fontSize:'11px',color:'#9ca3af',marginBottom:'2px'}}>• {k.charAt(0).toUpperCase()+k.slice(1)} investment -{typeof v==='number'?Math.round(v*100):0}%</div>)}
          </div>}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'9px'}}>
            {(()=>{const totRD=Object.values(defLevels).reduce((a,b)=>a+(b||0),0);const stg=totRD>=40?4:totRD>=26?3:totRD>=12?2:1;const thr={2:12,3:26,4:40};
              const cctx={c:country?.id,dl:defLevels,bt:blocTrade,totRD};
              const live=PA.filter(a=>a.t==='technology'&&(a.stage||1)<=stg&&!usedTech.has(a.id)&&(!a.cond||a.cond(cctx)));
              const next=PA.filter(a=>a.t==='technology'&&(a.stage||1)===stg+1&&(!a.cond||a.cond(cctx))).slice(0,2);
              return <>
                <div style={{fontSize:'10px',color:'#60a5fa',marginBottom:'8px'}}>Era {stg}/4 — programs unlock as national R&D depth grows (now {totRD}, next era at {thr[stg+1]||'—'})</div>
                {live.length?live.map(a=><ActionCard key={a.id} action={a}/>):<div style={{fontSize:'11px',color:'#6b7280',padding:'10px',background:'#0d1117',border:'1px solid #1f2937',borderRadius:'7px',marginBottom:'9px'}}>This era's programs are complete — deepen R&D to open the next generation.</div>}
                {next.map(a=><div key={a.id} style={{background:'#0d1117',border:'1px dashed #374151',borderRadius:'8px',padding:'11px',marginBottom:'9px',opacity:0.6}}>
                  <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:'12px',fontWeight:700,color:'#6b7280'}}>{a.i} {a.n}</span><span style={{fontSize:'10px',color:'#4b5563'}}>🔒 Era {a.stage}</span></div>
                  <div style={{fontSize:'10px',color:'#4b5563',marginTop:'3px'}}>{a.d}</div>
                  <div style={{fontSize:'9px',color:'#60a5fa',marginTop:'4px'}}>Unlocks at R&D depth {thr[a.stage]} — now {totRD}</div>
                </div>)}
              </>;})()}
          </div>
        </div>}

        {/* INTEL TAB */}
        {activeTab==='intel'&&<div style={{flex:1,overflowY:'auto',padding:'12px',display:'flex',flexDirection:'column',gap:'12px'}}>
          {vitalsDrill&&<VitalsDrillPanel/>}
          <div style={{fontSize:'11px',color:'#6b7280',padding:'8px 10px',background:'#0d1117',borderRadius:'6px',border:'1px solid #1f2937'}}>
            🕵️ {INTEL_AGENCIES[country?.id||'']||'Intelligence Services'} Command — fund standing programs, set the budget, and run operations. Foreign services are running ops against you; interception depends on Cyber R&D, budget, Counter-Intel ops, and the Counter-Intelligence Grid.
          </div>
          {renderIssues()}
          {(()=>{const isrSc=isrScore(platforms,defLevels,intelInfra,blackPrograms);return <div style={{marginBottom:'12px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'7px'}}>
              <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px'}}>Strategic Intelligence Dossier · ISR reveals the adversary</div>
              <span style={{fontSize:'10px',color:isrSc>=10?'#4ade80':isrSc>=5?'#f0c040':'#ef4444'}}>ISR {isrSc} — {isrSc>=14?'total clarity':isrSc>=10?'strong coverage':isrSc>=5?'partial picture':'limited sight'}</span>
            </div>
            <div style={{fontSize:'9px',color:'#6b7280',marginBottom:'7px'}}>Sources: 🛰️ Satellites {(platforms.satellite_net||0)}×2 · 🚀 Space L{defLevels.space||0} · {intelInfra.isr_fusion?'Fusion +4 · ':''}{blackPrograms?.sr72?'SR-72 +6 · ':''}🛸 Drones {(platforms.drone_swarm||0)} — satellites also add +2%/net foreign-op interception (max +10%)</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'6px',marginBottom:'12px'}}>
              {['russia','china','usa','germany'].filter(r=>r!==country?.id).map(rid=>{
                const lvls=globalDef[rid]||{};const totDL=Object.values(lvls).reduce((a,b)=>a+(b||0),0);
                const topV=Object.entries(lvls).sort((a,b)=>b[1]-a[1])[0];
                const rname=rid.charAt(0).toUpperCase()+rid.slice(1);
                let body;
                if(embassies.has(rid)){body=<span style={{color:'#9ca3af'}}>🏛️ Embassy intel: R&D depth <b style={{color:'#f9fafb'}}>{totDL.toFixed(0)}/70</b>, leads in <b style={{color:'#60a5fa'}}>{topV?DV[topV[0]]?.n:'—'}</b>. Diplomatic channel open.</span>;}
                else if(isrSc<5){body=<span style={{color:'#6b7280'}}>Capability unclear — {totDL>20?'significant military activity detected':'limited activity'}. Build ISR (satellites, Space R&D, fusion cell) or open an embassy to see more.</span>;}
                else if(isrSc<10){body=<span style={{color:'#9ca3af'}}>Estimated strength: <b style={{color:'#f9fafb'}}>{totDL<15?'developing':totDL<28?'major power':'peer competitor'}</b>. Leading domain: {topV?DV[topV[0]]?.n:'unknown'}.</span>;}
                else {body=<span style={{color:'#9ca3af'}}>R&D depth <b style={{color:'#f9fafb'}}>{totDL.toFixed(0)}/70</b> · leads in <b style={{color:'#60a5fa'}}>{topV?DV[topV[0]]?.n+' L'+Math.round(topV[1]):'—'}</b>{isrSc>=14?<> · {topV&&topV[1]>=4?'pursuing classified programs':'no black programs detected'}</>:''}.</span>;}
                const ally=isAllyOf(country?.id,rid);const ten=Math.round(rivalTension[rid]||0);const tc=ten>=70?'#ef4444':ten>=40?'#f0c040':ten>=20?'#9ca3af':'#4ade80';
                const bcd=actionCooldowns[`bc_${rid}`]||0;
                return(<div key={rid} style={{background:'#0d1117',border:'1px solid #1f2937',borderRadius:'6px',padding:'8px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'3px'}}>
                    <span style={{fontSize:'11px',fontWeight:700,color:ally?'#60a5fa':NATION_BLOC[rid]==='east'?'#ef4444':'#9ca3af'}}>{rname}{ally?' 🤝 ALLY':NATION_BLOC[rid]==='east'?' ⚠':''}</span>
                    <span style={{fontSize:'9px',fontWeight:700,color:ten>=85?'#f472b6':tc}}>{ally?'Bloc partner · ':''}Tension {ten}{(nationRelations[rid]||0)>0?<span style={{color:'#4b5563'}}> (cap {Math.round(100-Math.max(0,nationRelations[rid]||0)*0.5)})</span>:null} · {ten>=85?'☢ BRINK':ten>=70?'critical':ten>=40?'hostile':ten>=20?'strained':'calm'}</span>
                  </div>
                  <div style={{height:'3px',background:'#1f2937',borderRadius:'2px',marginBottom:'4px'}}><div style={{height:'100%',width:`${ten}%`,background:tc,borderRadius:'2px',transition:'width .5s'}}/></div>
                  <div style={{fontSize:'9px',lineHeight:'1.5',marginBottom:ten>=20?'5px':'0'}}>{body}</div>
                  {!ally&&ten>=85&&(()=>{const tlF=triadLegs(platforms,blackPrograms);
                    const gl=globalDef[rid]||{};const rivalStrat=strategicWeight(gl);
                    const topRg=Object.entries(sphere).map(([r2,s2])=>[r2,s2.competitors?.[rid]||0]).sort((a,b)=>b[1]-a[1])[0];const dcd=actionCooldowns[`demo_${rid}`]||0;
                    return <div style={{marginBottom:'5px',padding:'6px',background:'rgba(244,114,182,.05)',border:'1px solid #831843',borderRadius:'5px'}}>
                      <div style={{fontSize:'9px',color:'#f472b6',fontWeight:700,marginBottom:'4px'}}>☢ FINAL OPTIONS · triad {tlF}/4 vs their strategic weight {rivalStrat}/3</div>
                      <div style={{display:'flex',gap:'4px'}}>
                        <button onClick={()=>dispatch({type:'nuclearDemonstration',payload:{nation:rid}})}
                          style={{flex:1,background:'rgba(240,192,64,.08)',border:'1px solid #f0c040',color:'#f0c040',padding:'5px',borderRadius:'4px',fontSize:'9px',fontWeight:700}}>{dcd>0?`Demo ${dcd}mo`:'☢ Demonstration · $1.5B'}</button>
                        <button onClick={()=>dispatch({type:'nuclearEmployment',payload:{nation:rid}})}
                          style={{flex:1,background:'rgba(239,68,68,.1)',border:'1px solid #ef4444',color:'#ef4444',padding:'5px',borderRadius:'4px',fontSize:'9px',fontWeight:700}}>☢️ Employ · $3B {rivalStrat>=tlF?'· PARITY = MAD':''}</button>
                      </div>
                      <div style={{fontSize:'8px',color:'#9ca3af',marginTop:'4px'}}>Demonstration: their top region −25, world −15 rel, tension 95. Employment: region cleared, but 36mo pariah (no arms deals, blocs frozen, −25 stability) — and if they hold parity, mutual destruction.</div>
                    </div>;})()}
                  {!ally&&(()=>{const home=NATIONS[rid]?.region;const w=wSum(forceDeployments[home]||{},blackPrograms);const saps=Object.values(blackPrograms).reduce((a,b)=>a+(+b||0),0);const rcd=actionCooldowns[`regime_${rid}`]||0;const ready=saps>=1&&w>=3;return <button onClick={()=>dispatch({type:'regimeChange',payload:{nation:rid}})} style={{width:'100%',marginBottom:'4px',background:rcd>0?'rgba(0,0,0,.35)':ready?'rgba(244,114,182,.08)':'rgba(0,0,0,.35)',border:`1px solid ${rcd>0?'#374151':ready?'#f472b6':'#374151'}`,color:rcd>0?'#4b5563':ready?'#f472b6':'#6b7280',padding:'4px',borderRadius:'4px',fontSize:'9px',fontWeight:700}}>{rcd>0?`🎯 Regime change · regrouping ${rcd}mo`:`🎯 Regime change · $6B · SAP + ISR 10 + weight 3 in ${REGIONS[home]?.n} + 2× overmatch`}</button>;})()}
                  {ten>=20&&<button onClick={()=>dispatch({type:'backChannel',payload:{nation:rid,from:'dossier'}})} style={{width:'100%',background:bcd>0?'rgba(0,0,0,.35)':'rgba(96,165,250,.08)',border:`1px solid ${bcd>0?'#374151':'#60a5fa'}`,color:bcd>0?'#4b5563':'#60a5fa',padding:'4px',borderRadius:'4px',fontSize:'9px',fontWeight:700}}>{bcd>0?`🕊 Back-channel · ${bcd}mo`:'🕊 Back-channel · $250M · tension −8'}</button>}
                </div>);})}
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'7px'}}>
              <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px'}}>Agency Infrastructure · capability is built, not just funded</div>
              <div style={{fontSize:'11px',color:'#3b82f6'}}>🎯 ISR: <span style={{fontWeight:800}}>{isrSc}</span> <span style={{color:'#6b7280'}}>(+{Math.min(10,isrSc)}% ops · +{Math.round(isrSc/2)} strike dmg)</span></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'7px'}}>
              {Object.entries(INTEL_INFRA).map(([fid,f])=>{
                const ct=intelInfra[fid]||0;
                const reqsMet=meetsReq(f.req,defLevels);
                const atMax=ct>=f.max;
                return(<div key={fid} style={{background:ct>0?'rgba(167,139,250,.05)':'#0d1117',border:`1px solid ${ct>0?'#a78bfa':'#1f2937'}`,borderRadius:'7px',padding:'10px',opacity:reqsMet?1:0.55}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
                    <div style={{fontSize:'11px',fontWeight:700,color:ct>0?'#a78bfa':'#f9fafb'}}>{f.i} {f.n}</div>
                    {ct>0&&<span style={{fontSize:'11px',fontWeight:800,color:'#a78bfa'}}>×{ct}{f.max>1?`/${f.max}`:''}</span>}
                  </div>
                  <div style={{fontSize:'9px',color:'#6b7280',marginBottom:'3px'}}>{f.d}</div>
                  {Object.keys(f.req).length>0&&<div style={{fontSize:'9px',marginBottom:'5px'}}>Req: {Object.entries(f.req).map(([v,rq])=><span key={v} style={{color:(defLevels[v]||0)>=rq?'#4ade80':'#ef4444',marginRight:'5px'}}>{DV[v]?.n} L{rq}{(defLevels[v]||0)>=rq?' ✓':''}</span>)}</div>}
                  <button onClick={()=>dispatch({type:'buildIntelInfra',payload:{facility:fid}})} style={{width:'100%',background:atMax?'rgba(0,0,0,.3)':reqsMet?'#4c1d95':'rgba(0,0,0,.4)',border:`1px solid ${atMax?'#374151':reqsMet?'#a78bfa':'#374151'}`,color:atMax?'#4b5563':reqsMet?'white':'#4b5563',padding:'5px',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>{atMax?'✓ At capacity':`Build $${f.cost}M · $${f.maint}M/mo`}</button>
                </div>);})}
            </div>
            {Object.keys(moles).length>0&&<div style={{padding:'7px 9px',background:'rgba(167,139,250,.06)',border:'1px solid #a78bfa55',borderRadius:'6px',marginTop:'7px'}}><span style={{fontSize:'10px',color:'#a78bfa',fontWeight:700}}>🪤 Active penetrations:</span>{Object.entries(moles).map(([t,m])=><span key={t} style={{fontSize:'10px',color:'#9ca3af',marginLeft:'7px'}}>{t} · {m}mo left (pushback ×0.5, R&D frozen)</span>)}</div>}
          </div>;})()}
            <div>
              <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'7px'}}>Intelligence Services — {INTEL_AGENCIES[country?.id||'']||'Intelligence'}</div>
              <div style={{marginBottom:'8px'}}>
                <div style={{marginBottom:'10px',padding:'9px',background:'#111827',borderRadius:'6px',border:'1px solid #374151'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}><span style={{fontSize:'11px',color:'#9ca3af'}}>Agency Budget Level</span><span style={{fontSize:'12px',fontWeight:700,color:'#a78bfa'}}>L{intelBudget} — ${intelBudget*200}M/yr</span></div>
                <div style={{fontSize:'10px',color:'#a78bfa',marginBottom:'4px'}}>L{intelBudget} — ${intelBudget*40}M/mo operating budget · +{(intelBudget-1)*4}% op success · +{intelBudget*5}% interception</div>
                <div style={{display:'flex',gap:'5px'}}>{[1,2,3,4,5].map(v=><button key={v} onClick={()=>dispatch({type:'setIntelBudget',payload:{level:v}})} style={{flex:1,background:intelBudget>=v?'#4c1d95':'transparent',border:`1px solid ${intelBudget>=v?'#a78bfa':'#374151'}`,color:intelBudget>=v?'white':'#6b7280',padding:'4px 0',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>{v}</button>)}</div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',color:'#6b7280',marginTop:'4px'}}><span>Success +{((intelBudget-1)*4).toFixed(0)}%</span><span>Discovery -{((intelBudget-1)*4).toFixed(0)}%</span></div>
              </div>
              <div style={{marginBottom:'12px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
                  <span style={{fontSize:'11px',color:'#9ca3af'}}>Proxy & Paramilitary Funding — directed sphere ops</span>
                  <span style={{fontSize:'10px',color:proxyBudget>0?'#4ade80':'#6b7280'}}>Pool: ${proxyBudget*80}M/mo</span>
                </div>
                <div style={{fontSize:'10px',color:'#6b7280',marginBottom:'7px'}}>Fund deniable proxies and front groups, weighted by region. Each region's share converts directly to your sphere there and erodes the local rival.</div>
                <div style={{display:'flex',gap:'4px',marginBottom:'9px'}}>{[0,1,2,3,4,5].map(v=><button key={v} onClick={()=>dispatch({type:'setProxyBudget',payload:{level:v}})} style={{flex:1,background:proxyBudget>=v&&v>0?'#7c2d12':proxyBudget===0&&v===0?'#374151':'transparent',border:`1px solid ${proxyBudget>=v&&v>0?'#ea580c':'#374151'}`,color:proxyBudget>=v?'white':'#6b7280',padding:'4px 0',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>{v===0?'Off':`$${v*80}M`}</button>)}</div>
                {(()=>{const totW=Object.keys(REGIONS).reduce((a,r)=>a+(proxyAlloc[r]||0),0);return <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
                  {Object.entries(REGIONS).map(([rid,reg])=>{const w=proxyAlloc[rid]||0;const pv=Math.round(sphere[rid]?.player||0);const share=totW>0&&proxyBudget>0?Math.round(proxyBudget*80*(w/totW)):0;return(
                    <div key={rid} style={{background:'#0d1117',border:`1px solid ${w>0?'#7c2d12':'#1f2937'}`,borderRadius:'6px',padding:'8px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
                        <span style={{fontSize:'10px',fontWeight:700,color:'#f9fafb'}}>{reg.n}</span>
                        <span style={{fontSize:'9px',color:'#60a5fa'}}>you {pv}%</span>
                      </div>
                      <input type="range" min="0" max="100" step="10" value={w} onChange={e=>dispatch({type:'setProxyAlloc',payload:{region:rid,weight:+e.target.value}})} style={{width:'100%',accentColor:'#ea580c',height:'3px'}}/>
                      <div style={{fontSize:'9px',color:share>0?'#fb923c':'#6b7280',marginTop:'3px'}}>{share>0?`$${share}M/mo → +sphere`:'unfunded'}</div>
                    </div>);})}
                </div>;})()}
              </div>
              {panelBox('t1ops','🎯 Tier-1 Operations · JSOC · decapitation, regime change, ministry seizure','#831843',(()=>{
                const cands=Object.keys(NATIONS).filter(n=>n!==country?.id).sort((a,b)=>(isAllyOf(country?.id,a)?1:0)-(isAllyOf(country?.id,b)?1:0)||((rivalTension[b]||0)-(rivalTension[a]||0))||((nationRelations[a]||0)-(nationRelations[b]||0)));
                const nid=t1Target&&cands.includes(t1Target)?t1Target:cands[0];const nat=NATIONS[nid];if(!nat)return <div style={{fontSize:'10px',color:'#6b7280'}}>No viable targets — everyone is allied or friendly.</div>;
                const home=nat.region;const w=wSum(forceDeployments[home]||{},blackPrograms);const saps=Object.values(blackPrograms).reduce((a,b)=>a+(+b||0),0);
                const isrSc=isrScore(platforms,defLevels,intelInfra,blackPrograms);
                const gl=globalDef[nid];const their=gl?40+Object.values(gl).reduce((a,b)=>a+(b||0),0)*2:(NATION_BLOC[nid]==='east'?45:30);const mine=(stats?.military||0)+isrSc*2+saps*10+w*5;const ratio=mine/their;
                const rcd=actionCooldowns[`regime_${nid}`]||0;const chance=Math.min(0.9,0.3+Math.max(0,ratio-2)*0.2+(embassies.has(nid)?0.1:0)+(embassyMissions[nid]==='intel'?0.1:0));
                const reqs=[[`Fielded SAP — the extreme asset (${saps})`,saps>=1],[`ISR ≥10 (${isrSc})`,isrSc>=10],[`Naval/air weight ≥3 in ${REGIONS[home]?.n} (${w.toFixed(1)})`,w>=3],[`2× overmatch — yours ${Math.round(mine)} vs theirs ${Math.round(their)} = ${ratio.toFixed(2)}×`,ratio>=2],[`$6,000M`,(stats?.treasury||0)>=6000]];const ok=reqs.every(r=>r[1]);
                const conc=Object.entries(CONCESSIONS).find(([,cp])=>cp.nation===nid&&cp.intervention);
                return <div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'3px',marginBottom:'7px'}}>{cands.map(n=>{const al=isAllyOf(country?.id,n);const hot=(rivalTension[n]||0)>=40||(nationRelations[n]||0)<0||sanctions.has(n);return <button key={n} onClick={()=>setT1Target(n)} style={{background:nid===n?'#831843':'#0d1117',border:`1px solid ${nid===n?'#f472b6':hot?'#7f1d1d':al?'#1e3a5f':'#374151'}`,color:nid===n?'white':hot?'#ef4444':al?'#60a5fa':'#9ca3af',padding:'3px 7px',borderRadius:'4px',fontSize:'9px'}}>{NATIONS[n]?.flag} {NATIONS[n]?.n} {Math.round(nationRelations[n]||0)}{al?' 🤝':hot?' ⚠':''}</button>;})}</div>
                  {isAllyOf(country?.id,nid)&&<div style={{fontSize:'9px',color:'#f0c040',marginBottom:'5px'}}>⚠ {nat.n} is a bloc partner — toppling an ally freezes every bloc for 24 months, −8 stability, world −30.</div>}
                  <div style={{padding:'8px',background:'#111827',border:'1px solid #1f2937',borderRadius:'6px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}><span style={{fontSize:'11px',fontWeight:700,color:'#f9fafb'}}>{nat.flag} {nat.n} — Regime Change</span><span style={{fontSize:'10px',fontWeight:700,color:ok?'#f472b6':'#6b7280'}}>success {Math.round(chance*100)}%</span></div>
                    <div style={{fontSize:'9px',marginBottom:'5px'}}>{reqs.map(([l,o])=><div key={l} style={{color:o?'#4ade80':'#ef4444'}}>{o?'✓':'✗'} {l}</div>)}</div>
                    <button onClick={()=>dispatch({type:'regimeChange',payload:{nation:nid}})} style={{width:'100%',background:rcd>0?'rgba(0,0,0,.35)':ok?'rgba(244,114,182,.12)':'rgba(0,0,0,.35)',border:`1px solid ${rcd>0?'#374151':ok?'#f472b6':'#374151'}`,color:rcd>0?'#4b5563':ok?'#f472b6':'#4b5563',padding:'6px',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>{rcd>0?`🎯 Regrouping — ${rcd}mo`:`🎯 Launch decapitation raid — topple ${nat.n} · $6B`}</button>
                    <div style={{fontSize:'8px',color:'#6b7280',marginTop:'4px'}}>Success: their home sphere −40, everywhere −10, programs set back, an aligned government at +60 · other rivals +15 tension · world −20 · stability −5. Failure: relations −40, tension +20, stability −6, 24mo regroup.</div>
                    {conc&&(()=>{const [ck,cp]=conc;const iv=cp.intervention;const st=stewardship[ck];const nw=navalWeight(forceDeployments[cp.region]);const icd=actionCooldowns[`interv_${ck}`]||0;const ireqs=[[`Military ≥${iv.req.military} (${Math.round(stats?.military||0)})`,(stats?.military||0)>=iv.req.military],[`Naval weight ≥${iv.req.naval} in ${REGIONS[cp.region]?.n} (${nw.toFixed(1)})`,nw>=iv.req.naval],[`ISR ≥${iv.req.isr} (${isrSc})`,isrSc>=iv.req.isr],[`$${iv.cost}M`,(stats?.treasury||0)>=iv.cost]];const iok=ireqs.every(r=>r[1]);
                      return <div style={{marginTop:'8px',paddingTop:'8px',borderTop:'1px solid #1f2937'}}>
                        <div style={{fontSize:'11px',fontWeight:700,color:'#f0c040'}}>⚔️ {iv.n} — seize the oil ministry {st?<span style={{color:'#4ade80'}}>· ACTIVE (month {st.mo})</span>:null}</div>
                        <div style={{fontSize:'9px',color:'#6b7280',margin:'3px 0'}}>{iv.d}</div>
                        {!st&&<div style={{fontSize:'9px',marginBottom:'5px'}}>{ireqs.map(([l,o])=><div key={l} style={{color:o?'#4ade80':'#ef4444'}}>{o?'✓':'✗'} {l}</div>)}</div>}
                        {!st&&<button onClick={()=>dispatch({type:'launchIntervention',payload:{concession:ck}})} style={{width:'100%',background:icd>0?'rgba(0,0,0,.35)':iok?'rgba(240,192,64,.1)':'rgba(0,0,0,.35)',border:`1px solid ${icd>0?'#374151':iok?'#f0c040':'#374151'}`,color:icd>0?'#4b5563':iok?'#f0c040':'#4b5563',padding:'6px',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>{icd>0?`⚔️ Regrouping — ${icd}mo`:`⚔️ Launch ${iv.n} · $${iv.cost}M`}</button>}
                        {st&&<div style={{fontSize:'9px',color:'#9ca3af'}}>Manage production tiers and handover on the Energy tab.</div>}
                      </div>;})()}
                  </div>
                </div>;})())}
              <div style={{marginBottom:'10px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
                  <span style={{fontSize:'11px',color:'#9ca3af'}}>Standing Covert Programs — {INTEL_AGENCIES[country?.id||'']||'Agency'} funding lines</span>
              </div>
              <div style={{marginBottom:'12px',padding:'9px',background:'#0d1117',border:'1px solid #1f2937',borderRadius:'7px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
                  <span style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px'}}>Response Doctrine · what happens when you catch them</span>
                  <span style={{fontSize:'10px',color:'#a78bfa'}}>Interception: {Math.min(92,Math.round((0.25+(defLevels.cyber||0)*0.06+intelBudget*0.05+(intelOps.some(o=>o.opId==='counter_int')?0.25:0)+(covertPrograms.has('counter_intel_grid')?0.25:0)+Math.min(0.10,(platforms.satellite_net||0)*0.02)+(ipPolicy==='protect'?0.12:ipPolicy==='license'?-0.08:0))*100))}%</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'5px'}}>
                  {[['quiet',INTEL_POSTURE_LABELS.quiet,'Flip their officer (30%) or feed disinfo — invisible leverage'],['expose',INTEL_POSTURE_LABELS.expose,'Public attribution: +stability, their sphere −2, tension +8'],['expel',INTEL_POSTURE_LABELS.expel,'Their station blind vs you 24mo, tension +5']].map(([k,lab,sub])=>(
                    <button key={k} onClick={()=>dispatch({type:'setIntelPosture',payload:{posture:k}})} style={{background:intelPosture===k?'#4c1d95':'transparent',border:`1px solid ${intelPosture===k?'#a78bfa':'#374151'}`,color:intelPosture===k?'white':'#9ca3af',padding:'6px 4px',borderRadius:'5px',fontSize:'10px',fontWeight:700}}>{lab}<div style={{fontSize:'8px',fontWeight:400,marginTop:'2px',color:intelPosture===k?'#c4b5fd':'#6b7280'}}>{sub}</div></button>))}
                </div>
              </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'6px'}}>
                  {Object.entries(COVERT_PROGRAMS).map(([cpId,cp])=>{const on=covertPrograms.has(cpId);return(
                    <div key={cpId} onClick={()=>dispatch({type:'toggleCovertProgram',payload:{program:cpId}})} style={{background:on?'rgba(167,139,250,.07)':'#0d1117',border:`1px solid ${on?'#a78bfa':'#1f2937'}`,borderRadius:'6px',padding:'8px',cursor:'pointer'}}>
                      <div style={{fontSize:'11px',fontWeight:700,color:on?'#a78bfa':'#f9fafb',marginBottom:'2px'}}>{cp.i} {cp.n}</div>
                      <div style={{fontSize:'9px',color:'#6b7280',marginBottom:'3px'}}>{cp.d}</div>
                      <div style={{fontSize:'10px',fontWeight:700,color:on?'#a78bfa':'#9ca3af'}}>{on?'FUNDED':'OFF'} · ${cp.cost}M/mo</div>
                    </div>);})}
                </div>
              </div>
              <div style={{fontSize:'11px',color:'#6b7280',marginBottom:'5px'}}>Select target nation:</div>
                <div style={{display:'flex',gap:'5px',flexWrap:'wrap'}}>
                  {INTEL_TARGETS.filter(t=>t.id!==country?.id).map(b=><button key={b.id} onClick={()=>setSelIntelTarget(selIntelTarget===b.id?null:b.id)} style={{background:selIntelTarget===b.id?'#1d4ed8':'transparent',border:`1px solid ${selIntelTarget===b.id?'#3b82f6':'#374151'}`,color:selIntelTarget===b.id?'white':'#9ca3af',padding:'4px 8px',borderRadius:'4px',fontSize:'11px'}}>{b.flag} {b.n}</button>)}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'7px'}}>
                {INTEL_OPS.map(op=>{const activeOp=intelOps.find(o=>o.opId===op.id&&o.targetId===selIntelTarget);const cyberLvl=defLevels.cyber||0;const bb=(intelBudget-1)*0.04;const db=doctrine==='shadow'?0.12:0;const dd=doctrine==='shadow'?0.10:0;const ab=covertPrograms.has('asset_recruitment')?0.08:0;const ad=covertPrograms.has('asset_recruitment')?0.05:0;const sr=Math.round(Math.min(0.95,op.baseSuccess+(cyberLvl-2)*0.05+bb+db+ab)*100);const dr=Math.round(Math.max(0.05,op.baseDiscover-(cyberLvl-2)*0.03-bb-dd-ad)*100);return(<div key={op.id} style={{background:'#0d1117',border:'1px solid #1f2937',borderRadius:'7px',padding:'10px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}><div style={{display:'flex',alignItems:'center',gap:'5px'}}><span style={{fontSize:'16px'}}>{op.i}</span><div style={{fontSize:'11px',fontWeight:700,color:'#f9fafb'}}>{op.n}</div></div><div style={{fontSize:'11px',color:'#f87171',fontWeight:700}}>${(op.cost/1000).toFixed(1)}k</div></div>
                  <div style={{fontSize:'10px',color:'#9ca3af',marginBottom:'5px'}}>{op.desc}</div>
                  <div style={{fontSize:'10px',color:'#6b7280',marginBottom:'5px'}}>Success: {sr}% · Discovery: {dr}% · {op.mo}mo</div>
                  {activeOp?<div style={{fontSize:'10px',color:'#a78bfa',padding:'4px',background:'rgba(167,139,250,.08)',borderRadius:'3px',textAlign:'center'}}>Active — {activeOp.monthsLeft}mo</div>
                  :<div style={{display:'flex',gap:'5px'}}><button onClick={()=>{if(!selIntelTarget){showToast('⚠ Select a target nation first');return;}dispatch({type:'runIntelOp',payload:{op:op.id,nation:selIntelTarget}});}} style={{flex:1,background:'rgba(167,139,250,.1)',border:'1px solid #a78bfa',color:'#a78bfa',padding:'5px',borderRadius:'4px',fontSize:'10px',fontWeight:600}}>Launch Op</button>{op.type==='covert'&&selIntelTarget&&(()=>{const ck=`${op.id}@${selIntelTarget}`;const on=continuousOps[ck];return <button onClick={()=>dispatch({type:'toggleContinuousOp',payload:{op:op.id,nation:selIntelTarget}})} title="Run continuously" style={{background:on?'rgba(74,222,128,.15)':'transparent',border:`1px solid ${on?'#4ade80':'#374151'}`,color:on?'#4ade80':'#6b7280',padding:'5px 9px',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>{on?'♻️ On':'♻️'}</button>;})()}</div>}
                </div>);})}
              </div>
            </div>

            {/* Active exports summary */}
          {intelOps.length>0&&<div>
            <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'7px'}}>Operations in Progress</div>
            {intelOps.map(o=>{const op=INTEL_OPS.find(x=>x.id===o.opId);return <div key={o.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 10px',background:'#0d1117',border:'1px solid rgba(167,139,250,.3)',borderRadius:'6px',marginBottom:'5px'}}><span style={{fontSize:'11px',color:'#f9fafb'}}>{op?.i} {op?.n} → {o.targetId}</span><span style={{fontSize:'11px',color:'#a78bfa',fontWeight:700}}>{o.monthsLeft}mo · {Math.round((o.successRate||0)*100)}% success</span></div>;})}
          </div>}
        </div>}

        {/* TRADE TAB */}
        {activeTab==='trade'&&<div style={{flex:1,overflowY:'auto',padding:'12px'}}>
          {vitalsDrill&&<VitalsDrillPanel/>}
          <div style={{marginBottom:'12px'}}>
<div style={{marginBottom:'14px'}}>
            {panelBox('bloc','🌐 Bloc Trade Architecture · tiered alignment with real exit costs','#1f2937',(<>
            <div style={{display:'grid',gap:'7px',marginBottom:'14px'}}>
              {Object.entries(BLOC_TRADE).map(([bk,bm])=>{
                if(bm.members.includes(country?.id))return(<div key={bk} style={{background:'#0d1117',border:'1px solid #1e3a5f',borderRadius:'8px',padding:'10px',display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:'11px',fontWeight:700,color:'#f9fafb'}}>{bm.i} {bm.n}</span><span style={{fontSize:'10px',color:'#60a5fa',fontWeight:700}}>HOME BLOC — you set the terms others join</span></div>);
                const tier=blocTrade[bk]||0;const lock=blocLock[bk]||0;
                const avgRel=bm.members.reduce((s,i)=>s+(nationRelations[i]||0),0)/bm.members.length;
                const embC=bm.members.filter(i=>embassies.has(i)).length;
                const pactC=bm.members.filter(i=>defensePacts.has(i)).length;
                const reqs=blocTierReqs(bk,{nationRelations,embassies,defensePacts,blocTrade,resExtraction},bm.members);
                const effects={
                  eu:['imports −10%','+15% EU export revenue · +$60/mo','+$150/mo · WE sphere anchor · China drifts'],
                  cn:['imports −15% · −inflation','+$120/mo · espionage +8% unless Cyber L4 · USA tension','+$220/mo yuan settlement · USA tension/mo · EU drifts'],
                  opec:['fossil import contracts −20%','oil price ×1.35 under quota (extraction ≤2)','swing lever: Cut / Flood the market'],
                };
                const next=tier<3?reqs[tier]:null;const canUp=blocCanAdvance(bk,tier,next,lock,blocTrade);
                return(<div key={bk} style={{background:'#0d1117',border:`1px solid ${tier>0?'#1e3a5f':'#1f2937'}`,borderRadius:'8px',padding:'10px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'5px'}}>
                    <span style={{fontSize:'11px',fontWeight:700,color:'#f9fafb'}}>{bm.i} {bm.n}</span>
                    <span style={{fontSize:'10px',fontWeight:700,color:lock?'#ef4444':tier>0?'#60a5fa':'#6b7280'}}>{lock?`FROZEN ${lock}mo`:tier>0?`Tier ${tier}`:'Unaligned'}</span>
                  </div>
                  <div style={{display:'flex',gap:'4px',marginBottom:'6px'}}>{[1,2,3].map(t=><div key={t} style={{flex:1,height:'4px',borderRadius:'2px',background:tier>=t?'#3b82f6':'#1f2937'}}/>)}</div>
                  {lock>0&&(()=>{const sm=bm.members.filter(m=>sanctions.has(m));const bl=Object.entries(blockades).filter(([rid])=>bm.members.some(m=>NATIONS[m]?.region===rid));return <div style={{fontSize:'9px',color:'#ef4444',padding:'6px',background:'rgba(239,68,68,.06)',border:'1px solid #7f1d1d',borderRadius:'4px',marginBottom:'6px'}}>⛔ Suspended {lock}mo — a hostile act against members (sanctions, blockading their waters) or nuclear employment freezes the bloc and resets the tier. Tiers cannot be joined until the freeze lifts.{sm.length?<div style={{marginTop:'3px'}}>Sanctions still on: {sm.map(m=>NATIONS[m]?.n).join(', ')} — <button onClick={()=>dispatch({type:'liftBlocSanctions',payload:{bloc:bk}})} style={{background:'transparent',border:'1px solid #ef4444',color:'#ef4444',padding:'1px 6px',borderRadius:'3px',fontSize:'9px'}}>lift them</button></div>:null}{bl.length?<div style={{marginTop:'3px'}}>Blockade in members' waters: {bl.map(([rid])=>REGIONS[rid]?.n).join(', ')} — lift it from the region panel.</div>:null}</div>;})()}
                  {[0,1,2].map(ti=><div key={ti} style={{fontSize:'9px',color:tier>ti?'#4ade80':'#6b7280',marginBottom:'2px'}}>{tier>ti?'✓':reqs[ti][1]?'○':'✗'} T{ti+1}: {effects[bk][ti]} <span style={{color:'#4b5563'}}>— {reqs[ti][0]}</span></div>)}
                  <div style={{display:'flex',gap:'5px',marginTop:'6px'}}>
                    {bk==='eu'&&(()=>{const need=euTierNeed(tier);const lag=bm.members.filter(m=>(nationRelations[m]||0)<need);const scd=actionCooldowns['eu_summit']||0;const nearPact=bm.members.map(m=>[m,nationRelations[m]||0]).sort((a,b)=>b[1]-a[1])[0];return <div style={{width:'100%',marginBottom:'4px'}}>
                      <div style={{display:'flex',flexWrap:'wrap',gap:'3px',marginBottom:'4px'}}>{bm.members.map(m=>{const r=Math.round(nationRelations[m]||0);const ok=r>=need;return <span key={m} style={{fontSize:'9px',padding:'2px 6px',borderRadius:'3px',background:ok?'rgba(74,222,128,.08)':'rgba(239,68,68,.08)',border:`1px solid ${ok?'#14532d':'#7f1d1d'}`,color:ok?'#4ade80':'#ef4444'}}>{NATIONS[m]?.flag} {r}{ok?'':` (−${need-r})`}</span>;})}</div>
                      <div style={{display:'flex',gap:'4px'}}>
                        <button onClick={()=>dispatch({type:'euFocusInfluence'})} style={{flex:1,background:'#0d1117',border:'1px solid #374151',color:'#9ca3af',padding:'4px',borderRadius:'4px',fontSize:'9px'}}>🗳️ Focus influence on lagging members</button>
                        <button onClick={()=>dispatch({type:'euSummit'})} style={{flex:1,background:scd>0?'rgba(0,0,0,.35)':'#1e3a8a',border:`1px solid ${scd>0?'#374151':'#3b82f6'}`,color:scd>0?'#4b5563':'white',padding:'4px',borderRadius:'4px',fontSize:'9px',fontWeight:700}}>{scd>0?`🇪🇺 Summit · ${scd}mo`:'🇪🇺 EU Summit · $1.2B · all +6'}</button>
                      </div>
                      {pactC<1&&(()=>{const best=nearPact;const ok=best&&best[1]>=60;const needEmb=best&&!embassies.has(best[0]);const cost=800+(needEmb?300:0);return <div style={{marginTop:'4px'}}>
                        <div style={{fontSize:'9px',color:'#f0c040',marginBottom:'3px'}}>T3 needs one EU defense pact — best candidate: {NATIONS[best?.[0]]?.n} at {Math.round(best?.[1]||0)} {ok?'':'(pact unlocks at +60)'}</div>
                        <button onClick={()=>dispatch({type:'euDefensePact'})} style={{width:'100%',background:ok?'#4c1d95':'rgba(0,0,0,.35)',border:`1px solid ${ok?'#a78bfa':'#374151'}`,color:ok?'white':'#4b5563',padding:'5px',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>🛡️ Sign EU defense pact with {NATIONS[best?.[0]]?.n} · ${cost}M{needEmb?' (incl. embassy)':''}</button>
                      </div>;})()}
                    </div>;})()}
                    {tier<3&&<button onClick={()=>dispatch({type:'blocAdvance',payload:{bloc:bk}})} style={{flex:1,background:canUp?'#1e3a8a':'rgba(0,0,0,.35)',border:`1px solid ${canUp?'#3b82f6':'#374151'}`,color:canUp?'white':'#4b5563',padding:'5px',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>{tier===0?'Join':'Deepen'} → T{tier+1}</button>}
                    {tier>0&&<button onClick={()=>dispatch({type:'blocStepDown',payload:{bloc:bk}})} style={{flex:1,background:'transparent',border:'1px solid #374151',color:'#9ca3af',padding:'5px',borderRadius:'4px',fontSize:'10px'}}>Step down</button>}
                    {bk==='opec'&&tier>=3&&!opecSwing&&(()=>{const scd=actionCooldowns['opec_swing']||0;return <>
                      <button onClick={()=>dispatch({type:'opecSwing',payload:{mode:'cut'}})} style={{flex:1,background:'rgba(240,192,64,.08)',border:'1px solid #f0c040',color:'#f0c040',padding:'5px',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>{scd>0?`Swing ${scd}mo`:'✂️ Cut'}</button>
                      <button onClick={()=>dispatch({type:'opecSwing',payload:{mode:'flood'}})} style={{flex:1,background:'rgba(96,165,250,.08)',border:'1px solid #60a5fa',color:'#60a5fa',padding:'5px',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>{scd>0?'':'🌊 Flood'}</button></>;})()}
                    {bk==='opec'&&opecSwing&&<span style={{flex:1,fontSize:'9px',color:'#f0c040',alignSelf:'center'}}>{opecSwing.mode==='cut'?'✂️ Cutting':'🌊 Flooding'} · {opecSwing.mo}mo left</span>}
                  </div>
                </div>);})}
            </div>
            </>))}
            <div style={{height:'12px'}}/>
            <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'6px'}}>Statecraft · spend relations on outcomes</div>
            {doctrine&&<div style={{fontSize:'10px',marginBottom:'8px',padding:'7px 9px',background:'#0d1117',borderRadius:'5px',border:'1px solid #1f2937',color:'#9ca3af'}}>{DOCTRINES[doctrine]?.i} <b style={{color:DOCTRINES[doctrine]?.col}}>{DOCTRINES[doctrine]?.n}</b> doctrine: {doctrine==='hegemon'?'influence ×1.5, trade income ×1.25, wider map reach':doctrine==='fortress'?'influence abroad ×0.7 — strength is at home':doctrine==='vanguard'?'R&D level amplifies your diplomatic weight':doctrine==='shadow'?'proxy & covert effectiveness ×1.5':'standard'}.</div>}
            <div style={{fontSize:'10px',color:'#6b7280',marginBottom:'8px'}}>Blocs first. Open a bloc to work its members — or use the bloc-level actions to act on all of them at once.</div>
            {(()=>{const totW=DIP_TARGETS.reduce((a,t)=>a+(influenceAlloc[t.id]||0),0);
              const GROUPS=blocGroups(country?.id);
              return <div style={{display:'grid',gap:'7px',marginBottom:'6px'}}>{GROUPS.map(([gid,gn,ms])=>{const open=!collapsed.has('g_'+gid)&&collapsed.has('!g_'+gid);const avg=ms.reduce((s,m)=>s+(nationRelations[m]||0),0)/ms.length;const nEmb=ms.filter(m=>embassies.has(m)).length;const nP=ms.filter(m=>defensePacts.has(m)).length;const nT=ms.filter(m=>tradeAgreements.has(m)).length;const wSumG=ms.reduce((s,m)=>s+(influenceAlloc[m]||0),0);const missing=ms.filter(m=>!embassies.has(m)&&(embLockR.current[m]||0)===0);const rc=avg>60?'#4ade80':avg>20?'#9ca3af':avg<-20?'#ef4444':'#6b7280';
                const toggle=()=>setCollapsed(p=>{const n2=new Set(p);if(n2.has('!g_'+gid))n2.delete('!g_'+gid);else n2.add('!g_'+gid);return n2;});
                return <div key={gid} style={{background:'#0d1117',border:`1px solid ${open?'#1e3a5f':'#1f2937'}`,borderRadius:'8px'}}>
                  <button onClick={toggle} style={{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',background:'transparent',border:'none',padding:'9px 11px',textAlign:'left',cursor:'pointer'}}>
                    <span style={{fontSize:'11px',fontWeight:700,color:'#f9fafb'}}>{gn} <span style={{color:'#6b7280',fontWeight:400}}>· {ms.length}</span></span>
                    <span style={{fontSize:'9px',color:'#9ca3af'}}>avg <b style={{color:rc}}>{avg>0?'+':''}{Math.round(avg)}</b> · 🏛️ {nEmb}/{ms.length} · 🛡️ {nP} · 📜 {nT} · 🗳️ {totW>0?Math.round(wSumG/totW*100):0}% <span style={{color:'#4b5563'}}>{open?'▾':'▸'}</span></span>
                  </button>
                  {open&&<div style={{padding:'0 11px 11px'}}>
                    <div style={{display:'flex',flexWrap:'wrap',gap:'4px',marginBottom:'8px'}}>
                      <button onClick={()=>dispatch({type:'groupEmbassies',payload:{group:gid}})} style={{background:'#0d1117',border:'1px solid #374151',color:'#9ca3af',padding:'4px 8px',borderRadius:'4px',fontSize:'9px'}}>🏛️ Embassies in all ({missing.length} × $300M)</button>
                      {[['trade','🏪'],['intel','🕵️'],['culture','🎭']].map(([mk,mi])=><button key={mk} onClick={()=>dispatch({type:'groupMissions',payload:{group:gid,mission:mk}})} style={{background:'#0d1117',border:'1px solid #374151',color:'#9ca3af',padding:'4px 8px',borderRadius:'4px',fontSize:'9px'}}>{mi} All missions → {mk}</button>)}
                      <button onClick={()=>dispatch({type:'groupVisits',payload:{group:gid}})} style={{background:'#0d1117',border:'1px solid #374151',color:'#9ca3af',padding:'4px 8px',borderRadius:'4px',fontSize:'9px'}}>🤝 Visit all off-cooldown</button>
                      <button onClick={()=>dispatch({type:'groupTradeAgreements',payload:{group:gid}})} style={{background:'#0d1117',border:'1px solid #374151',color:'#9ca3af',padding:'4px 8px',borderRadius:'4px',fontSize:'9px'}}>📜 Trade agreements with all eligible</button>
                      <button onClick={()=>dispatch({type:'groupInfluenceEven',payload:{group:gid}})} style={{background:'#0d1117',border:'1px solid #374151',color:'#9ca3af',padding:'4px 8px',borderRadius:'4px',fontSize:'9px'}}>🗳️ Even influence</button>
                      <button onClick={()=>dispatch({type:'groupInfluenceClear',payload:{group:gid}})} style={{background:'#0d1117',border:'1px solid #374151',color:'#6b7280',padding:'4px 8px',borderRadius:'4px',fontSize:'9px'}}>✖ Clear</button>
                    </div>
                    <div style={{display:'grid',gap:'5px'}}>{ms.map(m=>{const t=DIP_TARGETS.find(d=>d.id===m);if(!t)return null;const rel=Math.round(nationRelations[m]||0);const w=influenceAlloc[m]||0;const hasEmb=embassies.has(m);const pact=defensePacts.has(m);const ta=tradeAgreements.has(m);const vcd=actionCooldowns[`visit_${m}`]||0;const acd=actionCooldowns[`aid_${m}`]||0;const share=totW>0&&influenceBudget>0?Math.round(influenceBudget*100*(w/totW)):0;const relCol=rel>60?'#4ade80':rel>20?'#9ca3af':rel<-20?'#ef4444':'#6b7280';const lock=embLockR.current[m]||0;
                      return <div key={m} style={{padding:'7px 8px',background:'#111827',border:`1px solid ${w>0?'#1e40af':'#1f2937'}`,borderRadius:'6px'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'6px'}}>
                          <span style={{fontSize:'11px',fontWeight:700,color:'#f9fafb'}}>{t.flag} {t.n} <span style={{color:relCol}}>{rel>0?'+':''}{rel}</span>{pact&&' 🛡️'}{ta&&' 📜'}</span>
                          <span style={{fontSize:'9px',color:share>0?'#4ade80':'#6b7280'}}>{share>0?`$${share}M/mo`:'unfunded'}</span>
                        </div>
                        <input type="range" min="0" max="100" step="10" value={w} onChange={e=>dispatch({type:'setInfluence',payload:{nation:m,weight:parseInt(e.target.value)}})} style={{width:'100%',accentColor:'#3b82f6',margin:'3px 0'}}/>
                        <div style={{display:'flex',flexWrap:'wrap',gap:'3px'}}>
                          <button onClick={()=>dispatch({type:'toggleEmbassy',payload:{nation:m}})} style={{background:hasEmb?'rgba(74,222,128,.12)':'transparent',border:`1px solid ${hasEmb?'#4ade80':lock>0?'#7f1d1d':'#374151'}`,color:hasEmb?'#4ade80':lock>0?'#ef4444':'#9ca3af',padding:'2px 7px',borderRadius:'3px',fontSize:'9px',fontWeight:700}}>{hasEmb?(embassyMissions[m]?{trade:'🏪',intel:'🕵️',culture:'🎭'}[embassyMissions[m]]+' Embassy':'🏛️ Embassy'):lock>0?`PNG ${lock}mo`:'+ Embassy $300M'}</button>
                          {hasEmb&&<span style={{display:'inline-flex',gap:'2px'}}>{[['trade','🏪'],['intel','🕵️'],['culture','🎭']].map(([mk,mi])=><button key={mk} onClick={()=>dispatch({type:'setEmbassyMission',payload:{nation:m,mission:mk}})} style={{background:embassyMissions[m]===mk?'#1e3a8a':'transparent',border:`1px solid ${embassyMissions[m]===mk?'#3b82f6':'#374151'}`,color:'#9ca3af',padding:'1px 5px',borderRadius:'3px',fontSize:'9px'}}>{mi}</button>)}</span>}
                          <button onClick={()=>dispatch({type:'stateVisit',payload:{nation:m}})} style={{background:'transparent',border:`1px solid ${vcd>0?'#374151':'#3b82f6'}`,color:vcd>0?'#4b5563':'#93c5fd',padding:'2px 7px',borderRadius:'3px',fontSize:'9px'}}>{vcd>0?`Visit ${vcd}mo`:'🤝 State Visit'}</button>
                          <button onClick={()=>dispatch({type:'foreignAid',payload:{nation:m}})} style={{background:'transparent',border:`1px solid ${acd>0?'#374151':'#3b82f6'}`,color:acd>0?'#4b5563':'#93c5fd',padding:'2px 7px',borderRadius:'3px',fontSize:'9px'}}>{acd>0?`Aid ${acd}mo`:'💵 Aid'}</button>
                          <button onClick={()=>dispatch({type:'tradeAgreement',payload:{nation:m}})} style={{background:ta?'rgba(74,222,128,.12)':'transparent',border:`1px solid ${ta?'#4ade80':rel>=30?'#3b82f6':'#374151'}`,color:ta?'#4ade80':rel>=30?'#93c5fd':'#4b5563',padding:'2px 7px',borderRadius:'3px',fontSize:'9px'}}>{ta?'📜 Trade ✓':'📜 Trade'}</button>
                          <button onClick={()=>dispatch({type:'defensePact',payload:{nation:m}})} style={{background:pact?'rgba(74,222,128,.12)':'transparent',border:`1px solid ${pact?'#4ade80':rel>=60?'#a78bfa':'#374151'}`,color:pact?'#4ade80':rel>=60?'#c4b5fd':'#4b5563',padding:'2px 7px',borderRadius:'3px',fontSize:'9px'}}>{pact?'🛡️ Pact ✓':'🛡️ Pact'}</button>
                          {rel<20&&<button onClick={()=>dispatch({type:'regimeChange',payload:{nation:m}})} style={{background:'transparent',border:'1px solid #831843',color:'#f472b6',padding:'2px 7px',borderRadius:'3px',fontSize:'9px'}}>🎯 Regime</button>}
                        </div>
                      </div>;})}</div>
                  </div>}
                </div>;})}</div>;})()}
          </div>
          <div style={{marginBottom:'14px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
              <span style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px'}}>Diplomatic Influence · allocate where it goes</span>
              {embassies.size>0&&<span style={{fontSize:'9px',color:'#60a5fa'}}>🏛️ {embassies.size} — ×1.8 influence · +10% arms deals · crisis back-channels</span>}
              <span style={{fontSize:'10px',color:influenceBudget>0?'#4ade80':'#6b7280'}}>Pool: ${influenceBudget*100}M/mo</span>
            </div>
            <div style={{fontSize:'10px',color:'#6b7280',marginBottom:'7px'}}>Set the monthly pool here; weight it per nation inside each bloc above. Each nation's share builds relations — allies (&gt;60) feed your sphere in their region and buy your arms eagerly; embassies multiply influence ×1.8.</div>
            <div style={{display:'flex',gap:'4px',marginBottom:'9px'}}>{[0,1,2,3,4,5].map(v=><button key={v} onClick={()=>dispatch({type:'setInfluenceBudget',payload:{level:v}})} style={{flex:1,background:influenceBudget>=v&&v>0?'#1e40af':influenceBudget===0&&v===0?'#374151':'transparent',border:`1px solid ${influenceBudget>=v&&v>0?'#3b82f6':'#374151'}`,color:influenceBudget>=v?'white':'#6b7280',padding:'4px 0',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>{v===0?'Off':`$${v*100}M`}</button>)}</div>
          </div>
          <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'5px'}}>Sanctions Regimes · economic statecraft</div>
            <div style={{fontSize:'10px',color:'#6b7280',marginBottom:'7px'}}>Sanctioned rivals' military-industrial growth drops ~60%. Each regime costs you $60M/mo and 0.02 GDP growth (lost trade). Pair with HUMINT Penetration to freeze them completely.</div>
            <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
              {Object.keys(NATIONS).filter(id=>id!==country?.id).sort((a,b)=>(sanctions.has(b)?1:0)-(sanctions.has(a)?1:0)||((rivalTension[b]||0)-(rivalTension[a]||0))||((nationRelations[a]||0)-(nationRelations[b]||0))).map(id=>{const on=sanctions.has(id);const myBloc=NATION_BLOC[country?.id]||'neutral';const theirBloc=NATION_BLOC[id]||'neutral';const ally=myBloc!=='neutral'&&theirBloc===myBloc;return <button key={id} onClick={()=>dispatch({type:'toggleSanctions',payload:{nation:id}})} style={{background:on?'rgba(239,68,68,.12)':ally?'rgba(240,192,64,.04)':'transparent',border:`1px solid ${on?'#ef4444':ally?'#f0c04055':'#374151'}`,color:on?'#ef4444':ally?'#f0c040':'#9ca3af',padding:'5px 12px',borderRadius:'5px',fontSize:'11px',fontWeight:on?700:400}}>{on?'🚫 ':ally?'🤝':''}{id.charAt(0).toUpperCase()+id.slice(1)}{on?' — SANCTIONED':ally?' (ally)':''}</button>;})}
            </div>
          </div>
          <div style={{marginBottom:'12px'}}>
            <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'5px'}}>Resource Import Contracts · supply continuity</div>
            <div style={{fontSize:'10px',color:'#6b7280',marginBottom:'7px'}}>When domestic reserves run dry, imports keep the lights on: $80M/mo + 0.03 inflation each. Without fossils, renewables (6+), or imports, expect an energy shortage (+0.12 inflation, −0.04 GDP, −0.05 stability/mo).</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'6px'}}>
              {['oil','gas','coal','uranium','rareEarth'].map(k=>{const meta=RES_META[k];if(!meta)return null;const r=resources?.[k]?.r||0;const on=importContracts.has(k);const low=r<50;return(
                <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 9px',background:on?'rgba(74,222,128,.05)':'#0d1117',border:`1px solid ${on?'#4ade80':low?'#ef4444':'#1f2937'}`,borderRadius:'6px'}}>
                  <div><div style={{fontSize:'11px',fontWeight:700,color:'#f9fafb'}}>{meta.i} {meta.n}</div><div style={{fontSize:'9px',color:low?'#ef4444':'#6b7280'}}>{r<=1?'⚠ DEPLETED':`reserves: ${Math.round(r)}${low?' — running low':''}`}</div></div>
                  <button onClick={()=>dispatch({type:'toggleImportContract',payload:{resource:k}})} style={{background:on?'rgba(74,222,128,.12)':'transparent',border:`1px solid ${on?'#4ade80':'#374151'}`,color:on?'#4ade80':'#9ca3af',padding:'4px 10px',borderRadius:'4px',fontSize:'10px',fontWeight:on?700:400}}>{on?'✓ Importing':'Sign $80M/mo'}</button>
                </div>);})}
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
            <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px'}}>Trade, Diplomacy & Currency</div>
            {defLev>1.1&&<div style={{fontSize:'11px',color:'#4ade80',padding:'3px 8px',background:'rgba(74,222,128,.1)',border:'1px solid #4ade80',borderRadius:'4px'}}>⚔ Defense Leverage ×{defLev.toFixed(2)} — all deal terms boosted</div>}
          </div>
          {activePolicies.has('petrodollar')&&<div style={{marginBottom:'10px',padding:'10px',background:'rgba(251,191,36,.06)',border:'1px solid rgba(251,191,36,.3)',borderRadius:'7px',fontSize:'11px',color:'#fbbf24'}}>💵 Petrodollar Dominance Active — inflation -0.25/mo, GDP +0.08/mo, treasury +$400M/mo, debt drift reduced 40%</div>}
          {activeEffects.filter(e=>e.source?.startsWith('tr')).length>0&&<div style={{marginBottom:'10px',padding:'9px',background:'rgba(74,222,128,.06)',border:'1px solid rgba(74,222,128,.2)',borderRadius:'7px'}}>
            <div style={{fontSize:'11px',color:'#4ade80',fontWeight:600,marginBottom:'4px'}}>Active Trade Income Streams</div>
            {activeEffects.filter(e=>e.source?.startsWith('tr')).map(e=><div key={e.id} style={{fontSize:'11px',color:'#9ca3af',marginBottom:'2px'}}>• {e.source}: {SC[e.stat]?.label||e.stat} {e.d>0?'+':''}{e.d.toFixed(2)}/mo ({e.monthsLeft}mo left)</div>)}
          </div>}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'9px'}}>
            <div style={{marginBottom:'14px',padding:'10px',background:'#0d1117',border:'1px solid #1f2937',borderRadius:'8px'}}>
              <div style={{fontSize:'10px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'6px'}}>Currency Posture · a standing bet, not a card</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'5px'}}>
                {[['usd',CURRENCY_LABELS.usd,country?.id==='usa'?'You are the dollar':'+$30/mo · −inflation · East drifts away'],['neutral',CURRENCY_LABELS.neutral,'No commitments either way'],['dedollar',CURRENCY_LABELS.dedollar,'+China/Russia relations · USA tension · +$40/mo with CN bloc T2']].map(([k,lab,sub])=>{
                  const locked=country?.id==='usa'&&k!=='usd';
                  return <button key={k} onClick={()=>dispatch({type:'setCurrencyPosture',payload:{posture:k}})} style={{background:currencyPosture===k||(country?.id==='usa'&&k==='usd')?'#1e3a8a':'transparent',border:`1px solid ${currencyPosture===k?'#3b82f6':'#374151'}`,color:locked?'#4b5563':currencyPosture===k?'white':'#9ca3af',padding:'7px 4px',borderRadius:'5px',fontSize:'10px',fontWeight:700}}>{lab}<div style={{fontSize:'8px',fontWeight:400,marginTop:'2px',color:'#6b7280'}}>{sub}</div></button>;})}
              </div>
            </div>
            {PA.filter(a=>a.t==='trade').map(a=><ActionCard key={a.id} action={a}/>)}
          </div>
        </div>}

      </div>
      <BottomNav active={activeTab} onSelect={t=>{setActiveTab(t);setVitalsDrill(null);}} tabs={TABS.map(id=>{const live=(flashpoint?1:0)+Object.values(rivalHolds||{}).filter(m=>m>0).length+Object.keys(blockades).length+Object.values(chokeStatus).filter(st=>st==='disrupted').length+Object.entries(rivalTension).filter(([cid,t])=>t>=70&&cid!==country?.id&&!isAllyOf(country?.id,cid)).length;
        const badge={overview:(activeDecision?1:0)+(doctrine?0:1),sitroom:live+(ultimatum?1:0)+(confrontation?1:0),economy:issues.filter(i=>i.status==='unexamined'||i.status==='ready').length,energy:Object.values(chokeStatus).filter(st=>st==='disrupted').length,intel:intelCrisis?1:0,trade:Object.keys(blocLock||{}).length}[id]||0;
        return {id,icon:TABM[id].i,label:TABM[id].l,short:TAB_SHORT[id],badge,sev:(id==='sitroom'||id==='intel')&&badge?'alert':'warn'};})}/>
      <Outliner open={outlinerOpen} onOpenChange={setOutlinerOpen} onJump={({tab,region,nation,issue})=>{setActiveTab(tab);if(issue)setIntelIssue(issue);setVitalsDrill(null);if(region){setSelNation(null);setSelectedRegion(region);}if(nation)setSelNation(nation);setOutlinerOpen(false);}}
        rows={buildOutliner({issues,evState,flashpoint,worldEvent,ultimatum,confrontation,blockades,intelOps,continuousOps,investigations,platformDev,blackResearch,deployments,defResearch,defLevels,gracePeriod,pariah,hegHold,embargoedBy,expelled:expelR.current,embassyLocks:embLockR.current,blocLock,concessions,sprRelease,actionCooldowns})}/>
      <Sheet open={!!selectedRegion||!!selNation} onClose={()=>{setSelectedRegion(null);setSelNation(null);}} back={!!selNation&&!!selectedRegion} onBack={()=>setSelNation(null)}
        title={selNation?`${NATIONS[selNation]?.flag||''} ${nationName(selNation)}`:selectedRegion?REGIONS[selectedRegion]?.n:''} subtitle={selNation?'Every action on this nation':selectedRegion?`${Math.round(sphere[selectedRegion]?.player||0)}% your sphere · tap a nation for its actions`:''}>
        {selNation?<NationSheet nation={selNation} dispatch={dispatch} view={{country,stats,nationRelations,embassies,defensePacts,tradeAgreements,sanctions,embargoes,embassyMissions,influenceAlloc,influenceBudget,dominance:domR.current,doctrine,defLevels,defExports,intelOps,continuousOps,rivalTension,actionCooldowns,embassyLocks:embLockR.current,resExtraction,platforms,blackPrograms,intelInfra,covertPrograms,intelBudget,absorbBonus:absorbR.current}}/>
        :<>
          {selectedRegion&&<div data-region-nations><div className="wl-label" style={{margin:'4px 0 2px'}}>Nations here · tap for every action</div>
            {Object.entries(NATIONS).filter(([,n])=>n.region===selectedRegion).map(([id,n])=><button key={id} type="button" className="wl-nation-row" data-nation-row={id} onClick={()=>setSelNation(id)}><span aria-hidden="true" style={{fontSize:18}}>{n.flag}</span><b>{n.n}</b><span className={`wl-chip${id===country?.id?' wl-chip-command':isAllyOf(country?.id,id)?' wl-chip-good':''}`}>{id===country?.id?'you':isAllyOf(country?.id,id)?'ally':NATION_BLOC[id]||'non-aligned'}</span></button>)}
          </div>}
          {selectedRegion&&<div data-region-panel style={{marginTop:'8px',background:'#111827',borderRadius:'8px',padding:'12px',border:`1px solid ${country?.color||'#4ade80'}55`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                  <div style={{fontSize:'14px',fontWeight:700,color:'#f9fafb'}}>{REGIONS[selectedRegion].n}</div>
                  <button onClick={()=>setSelectedRegion(null)} style={{background:'transparent',border:'none',color:'#6b7280',fontSize:'14px'}}>✕</button>
                </div>
                {/* Sphere bars */}
                <div style={{marginBottom:'10px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}><span style={{fontSize:'11px',color:'#9ca3af'}}>Your Influence</span><span style={{fontSize:'12px',fontWeight:700,color:country?.color||'#4ade80'}}>{Math.round(sphere[selectedRegion]?.player||0)}%</span></div>
                  <div style={{height:'4px',background:'#1f2937',borderRadius:'2px',marginBottom:'6px'}}><div style={{height:'100%',width:`${sphere[selectedRegion]?.player||0}%`,background:country?.color||'#4ade80',borderRadius:'2px'}}/></div>
                  {Object.entries(sphere[selectedRegion]?.competitors||{}).sort(([ca,a],[cb,b])=>(isAllyOf(country?.id,ca)?1:0)-(isAllyOf(country?.id,cb)?1:0)||b-a).slice(0,3).map(([cid,pct])=>{const al=isAllyOf(country?.id,cid);return <div key={cid} style={{marginBottom:'4px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:'2px'}}><span style={{fontSize:'11px',color:al?'#60a5fa':'#6b7280'}}>{cid.charAt(0).toUpperCase()+cid.slice(1)}{al?' · allied presence':''}</span><span style={{fontSize:'11px',color:'#9ca3af'}}>{Math.round(pct)}%</span></div>
                    <div style={{height:'3px',background:'#1f2937',borderRadius:'2px'}}><div style={{height:'100%',width:`${pct}%`,background:al?'#1e3a8a':{usa:'#3b82f6',russia:'#ef4444',china:'#d97706',germany:'#f59e0b'}[cid]||'#6b7280',borderRadius:'2px'}}/></div>
                  </div>;})}
                </div>
                {REGION_BONUS[selectedRegion]&&<div style={{fontSize:'11px',padding:'6px 8px',background:'rgba(74,222,128,.06)',border:'1px solid rgba(74,222,128,.25)',borderRadius:'5px',marginBottom:'7px'}}>
                  <span style={{color:'#4ade80',fontWeight:600}}>Dominance dividend (hold &gt;60%):</span> <span style={{color:'#9ca3af'}}>{Object.entries(REGION_BONUS[selectedRegion]).map(([k,v])=>`${SC[k]?.label||k} ${v>0?'+':''}${v}/mo`).join(' · ')}{doctrine==='hegemon'?' (×1.5 Hegemon)':''}</span>
                  {(sphere[selectedRegion]?.player||0)>60&&<span style={{color:'#4ade80',fontWeight:700}}> — PAYING NOW</span>}
                </div>}
                <div style={{fontSize:'11px',color:'#6b7280',marginBottom:'8px'}}>Contested by: {REGIONS[selectedRegion].contestedBy?.join(', ')}</div>
                {flashpoint?.rid===selectedRegion&&(()=>{const fp=FLASHPOINTS[flashpoint.type];const dep=sumDep(forceDeployments[selectedRegion]);const canInt=dep>0||(stats?.military||0)>=70;return <div style={{marginBottom:'8px',padding:'9px',background:'rgba(239,68,68,.07)',border:'1px solid #ef4444',borderRadius:'6px'}}>
                  <div style={{fontSize:'12px',fontWeight:700,color:'#ef4444',marginBottom:'3px'}}>{fp.i} {fp.n} — {flashpoint.t}mo to act</div>
                  <div style={{fontSize:'10px',color:'#9ca3af',marginBottom:'7px'}}>{fp.d} Ignoring cedes ground to rivals (−5 you, +12 them).</div>
                  <div style={{display:'flex',gap:'6px'}}>
                    <button onClick={()=>dispatch({type:'flashpointResponse',payload:{region:selectedRegion,response:'intervene'}})} style={{flex:1,background:'rgba(239,68,68,.12)',border:'1px solid #ef4444',color:'#ef4444',padding:'6px',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>🪖 Intervene $500M{!canInt?' 🔒':''}</button>
                    <button onClick={()=>dispatch({type:'flashpointResponse',payload:{region:selectedRegion,response:'mediate'}})} style={{flex:1,background:'rgba(74,222,128,.08)',border:'1px solid #4ade80',color:'#4ade80',padding:'6px',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>🕊 Mediate $300M</button>
                    {(()=>{const embHere=DIP_TARGETS.some(d=>d.region===selectedRegion&&embassies.has(d.id));return <button onClick={()=>dispatch({type:'flashpointResponse',payload:{region:selectedRegion,response:'diplomatic'}})} style={{flex:1,background:embHere?'rgba(96,165,250,.1)':'rgba(0,0,0,.35)',border:`1px solid ${embHere?'#60a5fa':'#374151'}`,color:embHere?'#60a5fa':'#4b5563',padding:'6px',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>🏛️ Diplomatic $200M{embHere?'':' 🔒'}</button>;})()}
                  </div>
                </div>;})()}
                {(()=>{
                                    const owned=pid=>(platforms[pid]||0)+(platformsImported[pid]||0);
                  const deployedOf=pid=>Object.values(forceDeployments).reduce((a,r)=>a+((r&&r[pid])||0),0);
                  const hereObj=forceDeployments[selectedRegion]||{};
                  const hereTot=sumDep(hereObj);
                  const poolTot=DEPLOYABLE.reduce((a,p)=>a+(BLACK_PROGRAMS[p]?(+blackPrograms[p]||0):owned(p)),0);
                  const availTot=poolTot-Object.values(forceDeployments).reduce((a,r)=>a+sumDep(r),0);
                  return <div style={{marginBottom:'8px',padding:'8px',background:'#0d1117',borderRadius:'6px',border:`1px solid ${hereTot>0?'#1d4ed8':'#1f2937'}`}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'5px'}}>
                    <span style={{fontSize:'11px',color:hereTot>0?'#60a5fa':'#9ca3af',fontWeight:600}}>⚓ Forward Deployment — {hereTot} stationed · {Math.max(0,availTot)} available fleet-wide</span>
                  </div>
                  {DEPLOYABLE.map(pid=>BLACK_PROGRAMS[pid]?{pid,meta:BLACK_PROGRAMS[pid],own:+blackPrograms[pid]||0}:{pid,meta:PLATFORMS[pid],own:owned(pid)}).map(({pid,meta:p,own})=>{if(own<=0)return null;const hereN=hereObj[pid]||0;const avail=own-deployedOf(pid);return(
                    <div key={pid} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 6px',background:'#111827',borderRadius:'4px',marginBottom:'3px'}}>
                      <span style={{fontSize:'10px',color:'#9ca3af'}}>{p.i} {p.n} <span style={{color:'#4b5563'}}>· {hereN} here / {avail} free / {own} owned</span></span>
                      <div style={{display:'flex',gap:'4px'}}>
                        <button onClick={()=>dispatch({type:'adjustDeployment',payload:{region:selectedRegion,unit:pid,delta:1}})} style={{background:'#1d4ed8',border:'none',color:'white',padding:'2px 9px',borderRadius:'4px',fontSize:'11px',fontWeight:700}}>+</button>
                        <button onClick={()=>dispatch({type:'adjustDeployment',payload:{region:selectedRegion,unit:pid,delta:-1}})} style={{background:'transparent',border:'1px solid #374151',color:'#9ca3af',padding:'2px 9px',borderRadius:'4px',fontSize:'11px'}}>−</button>
                      </div>
                    </div>);})}
                  <div style={{fontSize:'10px',color:'#6b7280',marginTop:'3px'}}>+0.12 sphere/mo each · suppression weight: B-21/SSN(X) ×2, SR-72 ×0.6, F-47 ×1 (+up to 50% with CCA wings) · top rival −{(wSum(hereObj,blackPrograms)*0.08).toFixed(2)}/mo · halves rival pushback · unlocks Intervene & Kinetic Strike · $4M/unit/mo basing</div>
                  {hereTot>0&&(()=>{const cur=forcePosture[selectedRegion]||'deter';const cpHere=Object.entries(CHOKEPOINTS).find(([,cp])=>cp.region===selectedRegion);const nw=navalWeight(hereObj);
                    const P=[['deter',POSTURE_LABELS.deter,'+0.12/unit · suppresses top hostile'],['escort',POSTURE_LABELS.escort,cpHere?`Keeps ${cpHere[1].n} open for you (naval 2+, have ${nw}) · +tension`:'No chokepoint here — presence only'],['isr',POSTURE_LABELS.isr,'+25% op success in-region · rival pressure −30% · half suppression'],['exercise',POSTURE_LABELS.exercise,'Allies here +0.5 rel/mo · coalition ×2 · +0.06/unit'],['humanitarian',POSTURE_LABELS.humanitarian,'During crises: +1 rel/mo region-wide, +0.2/unit · $30M/unit/mo']];
                    return <div style={{marginTop:'7px'}}><div style={{fontSize:'9px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'4px'}}>Posture · what your {hereTot} unit{hereTot>1?'s':''} here are actually doing</div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'4px'}}>{P.map(([k,l,sub])=><button key={k} onClick={()=>dispatch({type:'setPosture',payload:{region:selectedRegion,posture:k}})} style={{background:cur===k?'#1e3a8a':'#0d1117',border:`1px solid ${cur===k?'#3b82f6':'#374151'}`,color:cur===k?'white':'#9ca3af',padding:'5px 6px',borderRadius:'4px',fontSize:'10px',fontWeight:700,textAlign:'left'}}>{l}<div style={{fontSize:'8px',fontWeight:400,color:cur===k?'#bfdbfe':'#6b7280'}}>{sub}</div></button>)}</div></div>;})()}
                  {(()=>{const navalW=navalWeight(hereObj);const blk=blockades[selectedRegion];const topR2=topHostile(sphere[selectedRegion]?.competitors,country?.id);
                    if(blk)return <button onClick={()=>dispatch({type:'liftBlockade',payload:{region:selectedRegion}})} style={{width:'100%',marginTop:'6px',background:'rgba(96,165,250,.1)',border:'1px solid #60a5fa',color:'#60a5fa',padding:'6px',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>⚓ Lift Blockade vs {blk.target}{blk.half?' (porous)':''} — saving $120M/mo</button>;
                    if(!topR2||topR2[1]<8)return null;
                    const can=navalW>=4;
                    return <button onClick={()=>dispatch({type:'declareBlockade',payload:{region:selectedRegion}})}
                      style={{width:'100%',marginTop:'6px',background:can?'rgba(96,165,250,.1)':'rgba(0,0,0,.3)',border:`1px solid ${can?'#60a5fa':'#374151'}`,color:can?'#60a5fa':'#4b5563',padding:'6px',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>⚓ Declare Blockade vs {topR2[0]} — $120M/mo · their sphere strangled · arms lanes cut{can?'':` · need naval 4+ (have ${navalW})`}</button>;})()}
                  {hereTot>=3&&(()=>{const topR=topHostile(sphere[selectedRegion]?.competitors,country?.id);const kcd=actionCooldowns[`kin_${selectedRegion}`]||0;if(!topR||topR[1]<10)return null;const isrSc=isrScore(platforms,defLevels,intelInfra,blackPrograms);const kDmg=kineticDamage(isrSc,hereObj);return <button onClick={()=>dispatch({type:'kineticStrike',payload:{region:selectedRegion}})} style={{width:'100%',marginTop:'6px',background:kcd>0?'rgba(0,0,0,.3)':'rgba(239,68,68,.12)',border:`1px solid ${kcd>0?'#374151':'#ef4444'}`,color:kcd>0?'#4b5563':'#ef4444',padding:'6px',borderRadius:'4px',fontSize:'10px',fontWeight:700}}>{kcd>0?`🎯 Regrouping — ${kcd}mo`:`🎯 Kinetic Strike vs ${topR[0]} — $400M · their sphere −${kDmg}, yours +6, stability −3`}</button>;})()}
                </div>;})()}
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'6px'}}>
                  {(()=>{const iaW2=influenceAlloc||{};const iTot=Object.values(iaW2).reduce((a,b)=>a+(b||0),0);const pool=(influenceBudget||0)*50;
                    const infl=DIP_TARGETS.filter(d=>d.region===selectedRegion).reduce((s,d)=>{const w=iaW2[d.id]||0;if(!w||!iTot)return s;const sh=pool*(w/iTot);const stC=(stats?.stability||60)<40?0.6:(stats?.stability||60)>75?1.15:1;const rgC=(sphere[selectedRegion]?.player||0)>60?1.4:1;return s+0.04*Math.min(6,(sh/40)*(embassies.has(d.id)?1.8:1)*(doctrine==='hegemon'?1.5:doctrine==='fortress'?0.7:1)*stC*rgC);},0);
                    const prox=(()=>{const paW2=proxyAlloc||{};const pTot=Object.values(paW2).reduce((a,b)=>a+(b||0),0);const pPool=(proxyBudget||0)*80;const w=paW2[selectedRegion]||0;if(!w||!pTot)return 0;return Math.min(1.4,(pPool*(w/pTot)/120)*(doctrine==='shadow'?1.5:1));})();
                    const hereObj2=forceDeployments[selectedRegion]||{};const dep=Object.values(hereObj2).reduce((a,b)=>a+(b||0),0)*0.12+((forceDeployments[selectedRegion]?.sr72||0)>0?0.04:0);
                    const pact2=[...defensePacts].some(nid=>DIP_TARGETS.find(d=>d.id===nid)?.region===selectedRegion)?0.06:0;
                    const allies=DIP_TARGETS.filter(d=>d.region===selectedRegion&&(nationRelations[d.id]||0)>60).length*0.04;
                    const supp=wSum(hereObj2,blackPrograms)*0.08;
                    const rows=[['🗳️ Influence',infl],['🕵️ Proxy ops',prox],['🪖 Deployments',dep],['🛡️ Pact anchor',pact2],['🤝 Allied trickle',allies]].filter(([,v])=>v>0.001);
                    return <div style={{marginBottom:'8px',padding:'8px',background:'#0d1117',border:'1px solid #1f2937',borderRadius:'6px'}}>
                      <div style={{fontSize:'9px',color:'#6b7280',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'5px'}}>Sphere flows here · per month</div>
                      {rows.length?rows.map(([l,v])=><div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:'10px',color:'#9ca3af',marginBottom:'2px'}}><span>{l}</span><span style={{color:'#4ade80',fontWeight:700}}>+{v.toFixed(2)}</span></div>):<div style={{fontSize:'10px',color:'#4b5563'}}>No active levers — fund influence, proxies, or station forces.</div>}
                      {supp>0&&<div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',color:'#9ca3af'}}><span>⚔️ Rival suppression</span><span style={{color:'#ef4444',fontWeight:700}}>−{supp.toFixed(2)} them</span></div>}
                    </div>;})()}
                  {[['pact','🛡️ Activate Alliance','Requires a Defense Pact ally here: basing rights +18% (12mo cd)',0],['intel','🕵️ Deploy Intel','ISR-scaled: boosts you, suppresses rival, lasting network',600]].map(([type,label,desc,cost])=>{const short=cost>0&&(stats?.treasury||0)<cost;return <button key={type} onClick={()=>dispatch({type:type==='intel'?'regionIntel':'activateAlliance',payload:{region:selectedRegion}})} disabled={short} style={{background:'#0d1117',border:`1px solid ${short?'#7f1d1d':'#374151'}`,color:short?'#4b5563':'#d1d5db',padding:'8px',borderRadius:'6px',fontSize:'11px',textAlign:'left',lineHeight:'1.4',opacity:short?0.7:1}}><div style={{fontWeight:700,marginBottom:'2px'}}>{label}{cost>0&&<span style={{color:short?'#ef4444':'#6b7280',fontWeight:400}}> · ${cost}M</span>}</div><div style={{color:short?'#ef4444':'#6b7280',fontSize:'10px'}}>{short?`Need $${cost}M — treasury short`:desc}</div></button>;})}
                </div>
              </div>}
        </>}
      </Sheet>
    </div>
  );
}

// ── Crash containment: a thrown render error becomes a resumable pause, not a reset ──
class ErrorGate extends Component{
  constructor(p){super(p);this.state={err:null,key:0};}
  static getDerivedStateFromError(err){return {err};}
  componentDidCatch(err,info){try{console.error('WorldLeaders crash',err,info);}catch(e){}}
  render(){
    if(this.state.err){const m=String(this.state.err?.message||this.state.err).slice(0,220);
      return <div style={{minHeight:'100vh',background:'#0a0e14',color:'#e5e7eb',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif',padding:'20px'}}>
        <div style={{maxWidth:'460px',background:'#111827',border:'1px solid #ef4444',borderRadius:'10px',padding:'22px'}}>
          <div style={{fontSize:'12px',color:'#ef4444',letterSpacing:'2px',textTransform:'uppercase',marginBottom:'8px'}}>Simulation fault contained</div>
          <div style={{fontSize:'13px',color:'#9ca3af',lineHeight:'1.6',marginBottom:'10px'}}>A subsystem threw an error. Your campaign is autosaved every 3 months — reload and resume from the last save.</div>
          <div style={{fontSize:'10px',color:'#6b7280',fontFamily:'monospace',background:'#0d1117',padding:'8px',borderRadius:'5px',marginBottom:'14px',wordBreak:'break-all'}}>{m}</div>
          <button onClick={()=>this.setState({err:null,key:this.state.key+1})} style={{background:'#14532d',border:'1px solid #4ade80',color:'#4ade80',padding:'9px 18px',borderRadius:'6px',fontSize:'13px',fontWeight:700}}>🔄 Reload & Resume</button>
        </div></div>;}
    return <WorldLeadersInner key={this.state.key} resumeSignal={this.state.key}/>;
  }
}
export default function WorldLeaders(){return <ErrorGate/>;}
