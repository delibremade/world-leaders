import { NATIONS, BUYERS, DIP_TARGETS, NATION_BLOC, RD_MODS } from '../data/nations.js';
import { REGIONS, POSTURE_LABELS } from '../data/regions.js';
import { DOCTRINES } from '../data/world.js';
import { PLATFORMS, BLACK_PROGRAMS, DV } from '../data/platforms.js';
import { PA, ISSUES, SOCIAL_PROGRAMS, SECTOR_LABELS, IP_POLICY_LABELS } from '../data/economy.js';
import { COVERT_PROGRAMS, INTEL_INFRA, INTEL_OPS, INTEL_POSTURE_LABELS } from '../data/intel.js';
import { BLOC_TRADE } from '../data/trade.js';
import { CONCESSIONS } from '../data/energy.js';
import { sumDep, isAllyOf, topHostile, wSum, isrScore, navalWeight, triadLegs, strategicWeight, kineticDamage, meetsReq, procurementCost, sapRunCost, recapCost, getQualMult } from './formulas.js';
import { rng } from './rng.js';

// ── Toy-engine action vocabulary (scaffold for the pure tick(state, actions, rng) API in tick.js). Not used by the v57 UI.
export const ACTION_TYPES = new Set([
  'noop',
]);

export function applyAction(state, action, rng) {
  if (!action || !ACTION_TYPES.has(action.type)) {
  throw new Error(`Unknown action type: ${action && action.type}`);
  }
  switch (action.type) {
  case 'noop':
    return state;
  default:
    return state;
  }
}

// ── v57 player verbs (P2b). The UI changes game state only by dispatch({type, payload}) -> applyVerb(g, S, fx, action).
// Same seam as runMonth (tick.js): g is the game state (STATE_FIELDS; the App passes a live view over its refs),
// S is the state-commit sink (v57 setter names), fx = { toast(msg), now(), defer(fn, ms) }. Bodies are the v57
// handlers moved verbatim: test/parity-app.test.js drives every verb family through the UI and proves the App's
// autosaves stay byte-identical to v57. Payloads are keyed by nation / region / id so a nation sheet can dispatch them.

function investigate(g,S,fx,t){
  const s=g.stats;if(!s)return;
  if(s.treasury<300){fx.toast('⚠ Insufficient treasury');return;}
  S.setStats(p=>({...p,treasury:p.treasury-300}));
  S.setInvestigations(p=>({...p,[t]:2}));
  S.setIssues(p=>p.map(i=>i.type===t?{...i,status:'investigating'}:i));
  S.setLog(p=>[{msg:`🔍 ${ISSUES[t]?.title}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
  fx.toast('🔍 Investigation started — brief in 2 months ($300M)');
}

function deployPolicy(g,S,fx,issueType,optId){
  const s=g.stats;const brief=g.briefs?.[issueType];if(!s||!brief)return;
  const opt=(brief?.opts||[]).find(o=>o.id===optId);if(!opt)return;
  const cost=Math.max(0,opt.cost||0);
  if(cost>0&&s.treasury<cost){fx.toast('⚠ Insufficient treasury');return;}
  if(cost>0)S.setStats(p=>({...p,treasury:p.treasury-cost}));
  S.setDeployments(p=>[...p,{id:`${issueType}_${optId}_${fx.now()}`,issueType,policyName:opt.n,effects:opt.fx||[],timeMonths:opt.tm,monthsElapsed:0,status:'active'}]);
  S.setIssues(p=>p.map(i=>i.type===issueType?{...i,status:'deployed'}:i));
  S.setLog(p=>[{msg:`📋 ${opt.n}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
  fx.toast(`📋 ${opt.n} initiated`);
  return true;
}

const ownedUnits=(g,pid)=>BLACK_PROGRAMS[pid]?(+g.blackPrograms?.[pid]||0):((g.platforms[pid]||0)+(g.platformsImported[pid]||0));
const deployedTotal=(g,pid)=>Object.values(g.forceDeployments||{}).reduce((a,o)=>a+(o?.[pid]||0),0);
function deployUnit(g,S,fx,rid,pid){
  const avail=ownedUnits(g,pid)-deployedTotal(g,pid);const nm=(PLATFORMS[pid]||BLACK_PROGRAMS[pid])?.n||pid;
  if(avail<=0){fx.toast(`⚠ No free ${nm} — build more or recall from other regions`);return false;}
  S.setForceDeployments(pr=>{const n2={...pr,[rid]:{...(pr[rid]||{}),[pid]:((pr[rid]||{})[pid]||0)+1}};g.forceDeployments=n2;return n2;});
  fx.toast(`🪖 ${nm} stationed in ${REGIONS[rid]?.n}`);return true;
}
function establishEmbassy(g,S,fx,nid){
  const t=DIP_TARGETS.find(d=>d.id===nid);if(!t||g.embassies.has(nid))return;
  if((g.embassyLocks[nid]||0)>0){fx.toast(`⚠ Persona non grata in ${t.n} — ${g.embassyLocks[nid]}mo`);return;}
  if((g.stats?.treasury||0)<300){fx.toast('⚠ Embassy costs $300M');return;}
  S.setStats(p=>({...p,treasury:p.treasury-300}));S.setEmbassies(prev=>{const n2=new Set(prev);n2.add(nid);g.embassies=n2;return n2;});fx.toast(`🏛️ Embassy established in ${t.n}`);
}
function launchIntervention(g,S,fx,ck){
  const cp=CONCESSIONS[ck];const iv=cp?.intervention;const s=g.stats;const c=g.country;if(!iv||!s||!c)return;
  const nat=NATIONS[cp.nation];const dep=g.forceDeployments?.[cp.region]||{};const nw=navalWeight(dep);
  const isrSc=isrScore(g.platforms,g.defLevels,g.intelInfra,g.blackPrograms);
  const icd=g.actionCooldowns[`interv_${ck}`]||0;const hostile=Math.max(g.sphere[cp.region]?.competitors?.china||0,g.sphere[cp.region]?.competitors?.russia||0);
  const chance=Math.min(0.95,0.5+isrSc*0.03+nw*0.05-hostile/200);
  if(icd>0){fx.toast(`Forces regrouping — ${icd}mo`);return;}
  if((s.military||0)<iv.req.military){fx.toast(`⚠ Military ≥${iv.req.military} required`);return;}
  if(nw<iv.req.naval){fx.toast(`⚠ Naval weight ≥${iv.req.naval} in ${REGIONS[cp.region]?.n} required (have ${nw.toFixed(1)})`);return;}
  if(isrSc<iv.req.isr){fx.toast(`⚠ ISR ≥${iv.req.isr} required (have ${isrSc})`);return;}
  if(s.treasury<iv.cost){fx.toast(`⚠ Need $${iv.cost}M`);return;}
  S.setStats(p=>({...p,treasury:p.treasury-iv.cost}));g.actionCooldowns={...g.actionCooldowns,[`interv_${ck}`]:12};S.setActionCooldowns(p=>({...p,[`interv_${ck}`]:12}));
  if(rng()<chance){
    S.setStewardship(p=>{const n2={...p,[ck]:{mo:0,tiers:0,unrest:0}};g.stewardship=n2;return n2;});
    S.setNationRelations(p=>{const n2={...p,[cp.nation]:30};DIP_TARGETS.forEach(t=>{if(t.region===cp.region&&t.id!==cp.nation)n2[t.id]=Math.max(-100,(n2[t.id]||0)-10);});if(g.blocTrade.opec>=1){n2.saudi=Math.max(-100,(n2.saudi||0)-10);}return n2;});
    S.setRivalTension(p=>{const n2={...p};['china','russia'].forEach(r=>{if(r!==c.id)n2[r]=Math.min(99,(n2[r]||0)+12);});return n2;});S.setStats(p=>({...p,stability:p.stability-2}));
    fx.toast(`⚔️ ${iv.n} — the raid succeeds. ${nat?.n}'s leader is in custody; its oil now sells through your channels.`);S.setLog(p=>[{msg:`⚔️ ${iv.n}: stewardship of ${nat?.n} oil`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
  } else {
    S.setStats(p=>({...p,stability:p.stability-4}));S.setNationRelations(p=>{const n2={...p,[cp.nation]:Math.max(-100,(p[cp.nation]||0)-30)};DIP_TARGETS.forEach(t=>{if(t.region===cp.region&&t.id!==cp.nation)n2[t.id]=Math.max(-100,(n2[t.id]||0)-10);});return n2;});
    S.setRivalTension(p=>{const n2={...p};['china','russia'].forEach(r=>{if(r!==c.id)n2[r]=Math.min(99,(n2[r]||0)+8);});return n2;});
    fx.toast(`💥 ${iv.n} failed — the raid was repelled. Stability −4, the region hardens against you.`);S.setLog(p=>[{msg:`💥 ${iv.n} failed`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
  }
}
function regimeChange(g,S,fx,nid){
  const s=g.stats;const c=g.country;if(!s||!c||nid===c.id)return;const ally=isAllyOf(c.id,nid);
  const home=NATIONS[nid]?.region;const dep=g.forceDeployments?.[home]||{};const w=wSum(dep);
  const isr=isrScore(g.platforms,g.defLevels,g.intelInfra,g.blackPrograms);
  const saps=Object.values(g.blackPrograms||{}).reduce((a,b)=>a+(+b||0),0);
  const gl=g.globalDef[nid];const their=gl?40+Object.values(gl).reduce((a,b)=>a+(b||0),0)*2:(NATION_BLOC[nid]==='east'?45:30);
  const mine=(s.military||0)+isr*2+saps*10+w*5;const ratio=mine/their;
  const cd=g.actionCooldowns[`regime_${nid}`]||0;
  if(cd>0){fx.toast(`Forces regrouping — ${cd}mo`);return;}
  if(saps<1){fx.toast('⚠ Regime change needs a fielded Special Access Program — the extreme asset');return;}
  if(isr<10){fx.toast(`⚠ ISR ≥10 required (have ${isr})`);return;}
  if(w<3){fx.toast(`⚠ Naval/air weight ≥3 stationed in ${REGIONS[home]?.n} required (have ${w.toFixed(1)})`);return;}
  if(ratio<2){fx.toast(`⚠ Overmatch insufficient — ${ratio.toFixed(2)}× (need 2×). Yours ${Math.round(mine)} vs theirs ${Math.round(their)}`);return;}
  if(s.treasury<6000){fx.toast('⚠ $6,000M required');return;}
  S.setStats(p=>({...p,treasury:p.treasury-6000}));g.actionCooldowns={...g.actionCooldowns,[`regime_${nid}`]:24};S.setActionCooldowns(p=>({...p,[`regime_${nid}`]:24}));
  const chance=Math.min(0.9,0.3+(ratio-2)*0.2+(g.embassies.has(nid)?0.1:0)+(g.embassyMissions[nid]==='intel'?0.1:0));
  const nm=NATIONS[nid]?.n||nid;
  if(rng()<chance){
    S.setSphere(p=>{const n2={...p};Object.keys(n2).forEach(rid=>{const v=n2[rid].competitors?.[nid]||0;if(v>0)n2[rid]={...n2[rid],competitors:{...n2[rid].competitors,[nid]:Math.max(0,v-(rid===home?40:10))}};});if(!gl&&n2[home])n2[home]={...n2[home],player:Math.min(100,(n2[home].player||0)+30)};return n2;});
    if(gl)S.setGlobalDef(p=>{const ng={...p};const lv={...ng[nid]};Object.keys(lv).forEach(v=>{lv[v]=Math.max(0,lv[v]-0.5);});ng[nid]=lv;return ng;});
    S.setNationRelations(p=>{const n2={...p};DIP_TARGETS.forEach(t=>{n2[t.id]=Math.max(-100,(n2[t.id]||0)-(ally?30:20));});n2[nid]=60;return n2;});
    S.setRivalTension(p=>{const n2={...p};Object.keys(n2).forEach(k=>{if(k!==nid&&k!==c.id)n2[k]=Math.min(99,(n2[k]||0)+15);});n2[nid]=40;return n2;});
    S.setStats(p=>({...p,stability:p.stability-(ally?8:5)}));
    if(ally){S.setBlocTrade(p=>{const nb={eu:0,cn:0,opec:0};g.blocTrade=nb;return nb;});S.setBlocLock(p=>{const nl={eu:24,cn:24,opec:24};g.blocLock=nl;return nl;});}
    fx.toast(`🎯 REGIME CHANGE — ${nm}'s government has fallen. An aligned administration takes office; the world recoils −20`);
    S.setLog(p=>[{msg:`🎯 Regime change: ${nm}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
  } else {
    S.setStats(p=>({...p,stability:p.stability-6}));S.setNationRelations(p=>{const n2={...p};n2[nid]=Math.max(-100,(n2[nid]||0)-40);DIP_TARGETS.forEach(t=>{if(t.id!==nid)n2[t.id]=Math.max(-100,(n2[t.id]||0)-10);});return n2;});
    S.setRivalTension(p=>({...p,[nid]:Math.min(99,(p[nid]||0)+20)}));
    fx.toast(`💥 Regime change FAILED in ${nm} — the operation was blown. Stability −6, relations −40, tension +20`);
    S.setLog(p=>[{msg:`💥 Regime change failed: ${nm}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
  }
}
export function recordNuke(g,S,fx,e){const entry={...e,yr:g.date.yr,mo:g.date.mo};g.nukeLog=[entry,...g.nukeLog].slice(0,40);S.setNukeLog(g.nukeLog);}
function recallUnit(g,S,fx,rid,pid){S.setForceDeployments(pr=>{const here={...(pr[rid]||{})};if(!here[pid])return pr;here[pid]-=1;if(here[pid]<=0)delete here[pid];const n2={...pr,[rid]:here};g.forceDeployments=n2;return n2;});}
export function pushTension(g,S,fx,cid,d,why){
  const cur=g.rivalTension[cid]||0;const nv=Math.max(0,cur+d);
  if(nv>=100){S.setGameOver(`☢️ NUCLEAR EXCHANGE. Your ${why} pushed ${cid.charAt(0).toUpperCase()+cid.slice(1)} past the brink and the world did not survive the reply. Whoever "started it," it ended on your watch.`);return;}
  S.setRivalTension(p=>({...p,[cid]:nv}));g.rivalTension={...g.rivalTension,[cid]:nv};
  if(d>0)S.setNationRelations(p=>({...p,[cid]:Math.max(-100,(p[cid]||0)-d*0.8)}));
}
function applySfx(g,S,fx,ops){
  (ops||[]).forEach(op=>{
    const hot=()=>Object.entries(g.rivalTension).sort((a,b)=>b[1]-a[1])[0]?.[0];
    if(op.k==='tension'){const id=op.id==='$hottest'?hot():op.id;if(id&&id!==g.country?.id)S.setRivalTension(p=>({...p,[id]:Math.max(0,Math.min(100,(p[id]||0)+op.d))}));}
    else if(op.k==='relBloc'){S.setNationRelations(p=>{const n2={...p};DIP_TARGETS.forEach(t=>{if(NATION_BLOC[t.id]===op.bloc)n2[t.id]=Math.max(-100,Math.min(100,(n2[t.id]||0)+op.d));});return n2;});}
    else if(op.k==='rel'){S.setNationRelations(p=>({...p,[op.id]:Math.max(-100,Math.min(100,(p[op.id]||0)+op.d))}));}
    else if(op.k==='relBuyers'){S.setNationRelations(p=>{const n2={...p};Object.keys(g.defExports).forEach(k2=>{const bid=k2.split('_')[0];n2[bid]=Math.max(-100,Math.min(100,(n2[bid]||0)+op.d));});return n2;});}
    else if(op.k==='gdbTop'){const id=op.id==='$hottest'?hot():op.id;if(id)S.setGlobalDef(p=>{const ng={...p};const lv=ng[id];if(!lv)return p;const top=Object.entries(lv).sort((a,b)=>b[1]-a[1])[0];if(top)ng[id]={...lv,[top[0]]:Math.max(0,top[1]+op.d)};return ng;});}
    else if(op.k==='relAnchor'||op.k==='relRivalAnchor'){const mine=g.blocTrade.cn>=2?'cn':'eu';const key=op.k==='relAnchor'?mine:(mine==='cn'?'eu':'cn');const aid=BLOC_TRADE[key].anchor;S.setNationRelations(p=>({...p,[aid]:Math.max(-100,Math.min(100,(p[aid]||0)+op.d))}));}
    else if(op.k==='blocStep'){const mine=g.blocTrade.cn>=2?'cn':'eu';S.setBlocTrade(p=>{const nb={...p,[mine]:Math.max(0,(p[mine]||0)+op.d)};g.blocTrade=nb;return nb;});}
  });
}
function executeAction(g,S,fx,action){
  if(action.oneTime)S.setUsedTech(prev=>new Set([...prev,action.id]));
  if(action.sfx)applySfx(g,S,fx,action.sfx);
  const s=g.stats;const c=g.country;if(!s||!c)return;
  if(action.of&&!action.of.includes(c.id)){fx.toast('⚠ Not available for '+c.name);return;}
  if(action.excludedFor?.includes(c.id)){fx.toast('⚠ Self-dealing not applicable — you already ARE this market');return;}
  const cd=g.actionCooldowns[action.id]||0;
  if(cd>0){fx.toast(`⚠ On cooldown — ${cd} months remaining`);return;}
  // Blocks check
  const blocked=(action.blocks||[]).some(bid=>(g.actionCooldowns[bid]||0)>0);
  if(blocked){fx.toast('⚠ Conflicting policy active — wait for it to complete');return;}
  const cost=action.cost>0?action.cost:0;
  if(cost>0&&s.treasury<cost){fx.toast('⚠ Insufficient treasury');return;}
  S.setStats(p=>{
    const ns={...p};
    if(action.cost>0)ns.treasury-=action.cost;
    else if(action.cost<0)ns.treasury+=Math.abs(action.cost);
    Object.entries(action.fx||{}).forEach(([k,v])=>{if(k in ns&&typeof v==='number')ns[k]+=v;});
    return ns;
  });
  // Add ongoing effects
  if((action.tx||[]).length>0){
    const newAE=(action.tx).map(t=>({id:`${action.id}_${t.stat}_${fx.now()}`,source:action.id,stat:t.stat,d:t.d,monthsLeft:t.mo,totalMonths:t.mo}));
    S.setActiveEffects(p=>[...p,...newAE]);
  }
  if(action.cd>0){g.actionCooldowns={...g.actionCooldowns,[action.id]:action.cd};S.setActionCooldowns(p=>({...p,[action.id]:action.cd}));}
  // Petrodollar activation
  if(action.id==='tr5'&&c.id==='usa'){
    S.setActivePolicies(p=>new Set([...p,'petrodollar']));
    fx.toast('💵 Petrodollar Dominance activated — inflation suppression + buying power uplift');
  }
  // Sphere update for trade deals
  if(action.region){
    S.setSphere(p=>{const ns={...p};if(ns[action.region])ns[action.region]={...ns[action.region],player:Math.min(100,(ns[action.region].player||0)+12)};return ns;});
  }
  S.setLog(p=>[{msg:`${action.i} ${action.n}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
  fx.toast(`${action.i} ${action.n} executed`);
}

function investDefense(g,S,fx,vert){
  const s=g.stats;if(!s)return;
  const lvl=g.defLevels[vert]||0;
  if(lvl>=7){fx.toast('Maximum level reached');return;}
  if(g.defResearch[vert]){fx.toast('Research already in progress for this vertical');return;}
  const lvlDef=DV[vert]?.lvl[lvl];if(!lvlDef)return;
  const disc=g.darpaDisc[vert]||0;
  const qm=getQualMult(vert,g.defLevels);
  const docM=g.doctrine==='fortress'?0.8:g.doctrine==='hegemon'?1.15:1;
  const cid=g.country?.id;const nm0=RD_MODS[cid]||{};const expPen=(nm0.exp||[]).includes(vert)&&!(cid==='japan'&&g.activePolicies.has('jp_normalization'));const natM=(nm0.cheap||[]).includes(vert)?0.75:expPen?1.4:1;
  const cost=Math.round(lvlDef.$*(1-disc)*docM*natM);
  const mo=Math.round(lvlDef.mo*(1+(1-qm)*0.5)*(g.doctrine==='fortress'?0.8:1));
  if(s.treasury<cost){fx.toast('⚠ Insufficient treasury');return;}
  S.setStats(p=>({...p,treasury:p.treasury-cost}));
  S.setDefResearch(p=>({...p,[vert]:mo}));
  S.setLog(p=>[{msg:`🔬 ${DV[vert].n} L${lvl+1}: ${lvlDef.n}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
  fx.toast(`🔬 Researching ${DV[vert].n} L${lvl+1} — ${mo} months`);
}

function sellDefTech(g,S,fx,buyerId,vert){
  const c=g.country;const s=g.stats;if(!c||!s)return;
  const playerLvl=g.defLevels[vert]||0;
  const buyer=BUYERS.filter(b=>b.id!==c.id).find(b=>b.id===buyerId);if(!buyer)return;
  if((buyer.noBuy||[]).includes(vert)){fx.toast(`⚠ ${buyer.n} produces ${DV[vert].n} domestically — won't import it`);return;}
  const key=`${buyerId}_${vert}`;
  if(g.defExports[key]){fx.toast('Deal already active with this nation');return;}
  if(g.blockades[buyer.region]){fx.toast(`⚓ ${REGIONS[buyer.region]?.n} sea lanes are blockaded — deliveries impossible`);return;}
  if(g.pariah>0){fx.toast(`☢️ Pariah state — no nation will sign arms contracts with you (${g.pariah}mo)`);return;}
  if(g.embargoes.has(buyerId)){fx.toast(`⛽ ${buyer.n} won't buy from a supplier embargoing them — lift the embargo first`);return;}
  // Exportable if you've actually developed the system (L1+). Buyers won't take obsolete kit:
  // it must be at least as good as what the world average fields, but you don't have to lead the world.
  const excGlobal=Object.entries(g.globalDef);
  const globalAvg=excGlobal.length?excGlobal.reduce((s,[,n])=>s+(n[vert]||0),0)/excGlobal.length:0;
  if(playerLvl<1){fx.toast(`⚠ Develop ${DV[vert].n} before exporting it`);return;}
  const advantage=Math.max(0,playerLvl-Math.floor(globalAvg)); // 0 at parity; positive when ahead → more revenue
  // Relations gate: hostile nations won't buy; allies pay a premium (relations from influence allocation)
  const rel=g.nationRelations[buyerId]!==undefined?g.nationRelations[buyerId]:buyer.rel;
  if(rel<-30){fx.toast(`⚠ ${buyer.n} relations too hostile to buy (${Math.round(rel)}). Build influence first.`);return;}
  const relMult=1+Math.max(-0.3,Math.min(0.4,rel/180));
  const fielded=Object.entries(PLATFORMS).some(([pid2,p2])=>p2.req[vert]!=null&&(g.platforms[pid2]||0)>0);
  const buyerInSphere=g.dominance.regions?.has(buyer.region)?1.18:1;
  const demandM=g.demand[vert]??1; // world market at signing — prices lock into the contract
  const attache=g.embassies.has(buyerId)?1.10:1; // defense attaché brokering // exports flow through territory you dominate
  const revenue=Math.round(buyer.budget*(0.20+Math.max(0.10,advantage*0.13))*(fielded?1.25:1)*relMult*buyerInSphere*attache*demandM);
  S.setDefExports(p=>({...p,[key]:{buyerId,vert,level:playerLvl,relationship:Math.round(rel),revenue}}));
  S.setSphere(p=>{const ns={...p};const r=buyer.region;if(ns[r])ns[r]={...ns[r],player:Math.min(100,(ns[r].player||0)+15)};return ns;});
  // Arms sales deepen ties with the buyer (+8 relations)
  S.setNationRelations(p=>({...p,[buyerId]:Math.min(100,(p[buyerId]!==undefined?p[buyerId]:buyer.rel)+8)}));
  // Selling advanced arms to a contested ally angers the opposing bloc's lead (the Taiwan dilemma)
  const buyerBloc=NATION_BLOC[buyerId];const rivalLead=buyerBloc==='west'?(c.id==='china'?null:'china'):buyerBloc==='east'?'usa':null;
  if(rivalLead&&advantage>=2){S.setNationRelations(p=>({...p,[rivalLead]:Math.max(-100,(p[rivalLead]!==undefined?p[rivalLead]:0)-6)}));}
  S.setLog(p=>[{msg:`🤝 ${DV[vert].n} → ${buyer.flag}${buyer.n} $${revenue}M/yr`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
  fx.toast(`🤝 Export deal: ${DV[vert].n} → ${buyer.n} ($${revenue}M/yr)${rel>60?' — ally premium':''}`);
}

function sellAllVert(g,S,fx,vert){
  const c=g.country;if(!c)return;
  const eligible=BUYERS.filter(b=>b.id!==c.id).filter(b=>{
    if((b.noBuy||[]).includes(vert))return false;
    if(g.defExports[`${b.id}_${vert}`])return false;
    const rel=g.nationRelations[b.id]!==undefined?g.nationRelations[b.id]:b.rel;
    if(rel<-30)return false;
    return (g.defLevels[vert]||0)>=1;
  });
  if(!eligible.length){fx.toast('No eligible buyers for this system right now');return;}
  eligible.forEach(b=>sellDefTech(g,S,fx,b.id,vert));
  fx.toast(`🤝 Offered ${DV[vert].n} to ${eligible.length} eligible nation${eligible.length>1?'s':''}`);
}

function runIntelOp(g,S,fx,opId,targetId){
  const s=g.stats;if(!s)return;
  const op=INTEL_OPS.find(o=>o.id===opId);const c=g.country;
  if(!op||!c)return;
  if(opId==='sabotage'&&!(g.intelInfra.paramilitary>0)){fx.toast('⚠ Requires Special Activities Wing (Intel infrastructure)');return;}
  if(opId==='mole'&&(g.intelInfra.overseas_stations||0)<3){fx.toast('⚠ Requires 3+ Overseas Stations');return;}
  const opCost=Math.round(op.cost*(g.doctrine==='shadow'?0.75:1));
  if(s.treasury<opCost){fx.toast('⚠ Insufficient treasury');return;}
  const cyberLvl=g.defLevels.cyber||0;
  const budgetBonus=((g.intelBudget||1)-1)*0.04;
  const shB=g.doctrine==='shadow'?0.12:0;const shD=g.doctrine==='shadow'?0.10:0;
  const asB=g.covertPrograms.has('asset_recruitment')?0.08:0;const asD=g.covertPrograms.has('asset_recruitment')?0.05:0;
  const stB=Math.min(0.15,(g.intelInfra.overseas_stations||0)*0.03);
  const isrSc=isrScore(g.platforms,g.defLevels,g.intelInfra,g.blackPrograms);
  const isrB=Math.min(0.10,isrSc*0.01);const lpD=g.intelInfra.listening_posts?0.04:0;
  const abB=g.absorbBonus>0?0.15:0;if(g.absorbBonus>0)g.absorbBonus--;
  const successRate=Math.min(0.95,op.baseSuccess+(cyberLvl-2)*0.05+budgetBonus+shB+asB+abB+stB+isrB);
  const discoverRate=Math.max(0.05,op.baseDiscover-(cyberLvl-2)*0.03-budgetBonus-shD-asD-lpD);
  S.setStats(p=>({...p,treasury:p.treasury-opCost}));
  S.setIntelOps(p=>[...p,{id:`${opId}_${targetId}_${fx.now()}`,opId,targetId,monthsLeft:op.mo,successRate,discoverRate,type:op.type}]);
  S.setLog(p=>[{msg:`${op.i} Op launched vs ${targetId} — ${op.mo}mo`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
  fx.toast(`${op.i} ${op.n} operation underway`);
}

function respondIntelCrisis(g,S,fx,responseId,intelCrisis){
  if(!intelCrisis)return;
  const {type,responses}=intelCrisis;
  const resp=responses.find(r=>r.id===responseId);if(!resp)return;
  S.setStats(p=>{const ns={...p};Object.entries(resp.effect||{}).forEach(([k,v])=>{if(k in ns&&typeof v==='number')ns[k]+=v;});return ns;});
  if(resp.sphereEffect){
    S.setSphere(p=>{const ns={...p};let count=0;Object.keys(ns).forEach(rid=>{if(count<(resp.sphereEffect.regions||1)){ns[rid]={...ns[rid],player:Math.max(0,(ns[rid].player||0)+resp.sphereEffect.delta)};count++;}});return ns;});
  }
  if(responseId==='absorb')g.absorbBonus=2;
  if(responseId==='retaliate'&&intelCrisis.targetId)fx.defer(()=>runIntelOp(g,S,fx,'destab',intelCrisis.targetId),50);
  S.setLog(p=>[{msg:`🕵️ Intel crisis response: ${resp.label}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
  fx.toast(`Response: ${resp.label}`);
  S.setIntelCrisis(null);
}

function diplomaticAction(g,S,fx,nid,action){
  const s=g.stats;if(!s||!nid)return;
  const nat=DIP_TARGETS.find(d=>d.id===nid);if(!nat)return;
  const rel=g.nationRelations[nid]||0;const reg=nat.region;
  const bump=(d)=>{S.setNationRelations(p=>({...p,[nid]:Math.max(-100,Math.min(100,(p[nid]||0)+d))}));};
  const sphereBump=(d)=>{S.setSphere(p=>{const ns={...p};if(ns[reg])ns[reg]={...ns[reg],player:Math.min(100,(ns[reg].player||0)+d)};return ns;});};
  if(action==='visit'){
    const cd=g.actionCooldowns[`visit_${nid}`]||0;if(cd>0){fx.toast(`State visit on cooldown — ${cd}mo`);return;}
    if(s.treasury<150){fx.toast('⚠ Need $150M');return;}
    S.setStats(p=>({...p,treasury:p.treasury-150}));bump(8);
    g.actionCooldowns={...g.actionCooldowns,[`visit_${nid}`]:6};S.setActionCooldowns(p=>({...p,[`visit_${nid}`]:6}));
    fx.toast(`🤝 State visit to ${nat.n} — relations +8`);
  } else if(action==='aid'){
    const cd=g.actionCooldowns[`aid_${nid}`]||0;if(cd>0){fx.toast(`Aid package on cooldown — ${cd}mo`);return;}
    if(s.treasury<600){fx.toast('⚠ Foreign aid package costs $600M');return;}
    S.setStats(p=>({...p,treasury:p.treasury-600}));bump(15);sphereBump(5);
    g.actionCooldowns={...g.actionCooldowns,[`aid_${nid}`]:12};S.setActionCooldowns(p=>({...p,[`aid_${nid}`]:12}));
    fx.toast(`💵 Foreign aid to ${nat.n} — relations +15, sphere +5 in ${REGIONS[reg]?.n}`);
  } else if(action==='trade'){
    if(g.tradeAgreements.has(nid)){S.setTradeAgreements(prev=>{const n2=new Set(prev);n2.delete(nid);g.tradeAgreements=n2;return n2;});fx.toast(`Trade agreement with ${nat.n} ended`);return;}
    if(rel<30){fx.toast(`⚠ Need +30 relations for a trade agreement (currently ${Math.round(rel)})`);return;}
    S.setTradeAgreements(prev=>{const n2=new Set(prev);n2.add(nid);g.tradeAgreements=n2;return n2;});
    fx.toast(`📜 Trade agreement signed with ${nat.n} — +$40M/mo, relations grow`);
    S.setLog(p=>[{msg:`📜 Trade agreement — ${nat.n}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
  } else if(action==='pact'){
    if(g.defensePacts.has(nid)){S.setDefensePacts(prev=>{const n2=new Set(prev);n2.delete(nid);g.defensePacts=n2;return n2;});fx.toast(`Defense pact with ${nat.n} dissolved`);return;}
    if(!g.embassies.has(nid)){fx.toast(`⚠ Establish an embassy in ${nat.n} before a defense pact`);return;}
    if(rel<60){fx.toast(`⚠ Need +60 relations for a defense pact (currently ${Math.round(rel)})`);return;}
    if(s.treasury<800){fx.toast('⚠ Defense pact requires $800M to formalize');return;}
    S.setStats(p=>({...p,treasury:p.treasury-800}));
    S.setDefensePacts(prev=>{const n2=new Set(prev);n2.add(nid);g.defensePacts=n2;return n2;});bump(10);
    fx.toast(`🛡️ Defense pact with ${nat.n} — permanent sphere in ${REGIONS[reg]?.n}, shared deterrence, bloc-aligned`);
    S.setLog(p=>[{msg:`🛡️ Defense pact signed — ${nat.n}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
  }
}

function applyRegionAction(g,S,fx,regionId,actionType){
  const s=g.stats;if(!s||!regionId)return;
  const costs={trade:0,intel:600,military:800,pact:0};
  const cost=costs[actionType]||0;
  if(cost>0&&s.treasury<cost){fx.toast('⚠ Insufficient treasury');return;}
  if(cost>0)S.setStats(p=>({...p,treasury:p.treasury-cost}));
  // Intel op is special: ISR-scaled, suppresses the local rival, and grants lasting collection
  if(actionType==='intel'){
    const isrSc=isrScore(g.platforms,g.defLevels,g.intelInfra,g.blackPrograms);
    const youGain=8+Math.round(isrSc/2);const rivalLoss=6+Math.round(isrSc/3);
    S.setSphere(p=>{const ns={...p};const sph=ns[regionId];if(sph){const top=Object.entries(sph.competitors||{}).sort((a,b)=>b[1]-a[1])[0];ns[regionId]={...sph,player:Math.min(100,(sph.player||0)+youGain),competitors:top&&top[1]>3?{...sph.competitors,[top[0]]:Math.max(0,top[1]-rivalLoss)}:sph.competitors};}return ns;});
    // Lasting intel network: small ongoing sphere + intercept boost is represented as a covert effect
    S.setActiveEffects(p=>[...p,{id:`intelnet_${regionId}_${fx.now()}`,source:'intel_network',stat:'stability',d:0.01,monthsLeft:12,totalMonths:12}]);
    fx.toast(`🕵️ Intel network in ${REGIONS[regionId]?.n} — +${youGain} you, −${rivalLoss} rival (ISR ${isrSc})`);
    S.setLog(p=>[{msg:`🕵️ Intelligence network established — ${REGIONS[regionId]?.n}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
    return;
  }
  // 'pact' region action = ACTIVATE an existing Defense Pact ally in this region (basing rights surge).
  // It no longer bypasses the earned per-nation pact system — it leverages it.
  if(actionType==='pact'){
    const allyHere=[...g.defensePacts].find(nid=>DIP_TARGETS.find(d=>d.id===nid)?.region===regionId);
    if(!allyHere){fx.toast(`⚠ No Defense Pact ally in ${REGIONS[regionId]?.n} — sign one via Trade → Statecraft first`);return;}
    const cdk=`allyact_${regionId}`;const cd=g.actionCooldowns[cdk]||0;
    if(cd>0){fx.toast(`Alliance activation on cooldown — ${cd}mo`);return;}
    S.setSphere(p=>{const ns2={...p};if(ns2[regionId])ns2[regionId]={...ns2[regionId],player:Math.min(100,(ns2[regionId].player||0)+18)};return ns2;});
    g.actionCooldowns={...g.actionCooldowns,[cdk]:12};S.setActionCooldowns(p=>({...p,[cdk]:12}));
    const an=DIP_TARGETS.find(d=>d.id===allyHere)?.n;
    fx.toast(`🛡️ Alliance activated — ${an} grants basing rights (+18% sphere)`);
    S.setLog(p=>[{msg:`🛡️ Alliance activated with ${an} — ${REGIONS[regionId]?.n}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
    return;
  }
  // No generic fall-through: every region action is an explicit branch above.
}


function makeDecision(g,S,fx,optId){
  const d=g.activeDecision;if(!d)return;
  const opt=d.options.find(o=>o.id===optId);if(!opt)return;
  S.setStats(p=>{const ns={...p};Object.entries(opt.effects||{}).forEach(([k,v])=>{if(k in ns)ns[k]+=v;});return ns;});
  applySfx(g,S,fx,opt.sfx);
  S.setLog(p=>[{msg:`🎯 ${d.title}: ${opt.label}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
  fx.toast(`🎯 ${opt.label}`);
  S.setActiveDecision(null);g.activeDecision=null;
  S.setUsedDecisions(prev=>new Set([...prev,d.id]));g.decisionTimer=7+Math.floor(rng()*6);
}


// ── Inline v57 handlers (render-time locals are recomputed from g with the same expressions; render-state values
// are snapshotted at the start of the verb, exactly as the click-time closure saw them).
const cap=(id)=>id.charAt(0).toUpperCase()+id.slice(1);

// Economy drill: sector budget -/+ 10.
function adjustSectorBudget(g,S,fx,sector,delta){S.setBudgetAlloc(p=>({...p,[sector]:delta<0?Math.max(0,(p[sector]||100)+delta):Math.min(200,(p[sector]||100)+delta)}));}

// Modals: doctrine, IMF bailout, nuclear ultimatum, blockade confrontation.
function chooseDoctrine(g,S,fx,id){const d=DOCTRINES[id];
  S.setDoctrine(id);g.doctrine=id;fx.toast(`${d.i} ${d.n} doctrine adopted`);S.setLog(p=>[{msg:`${d.i} National Doctrine: ${d.n}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
}
function imfBailout(g,S,fx){S.setGameOver(null);S.setStats(p=>({...p,treasury:p.treasury+4000,stability:Math.min(100,p.stability+20)}));}
function ultimatumResponse(g,S,fx,response){
  const cid=g.ultimatum.cid;const rn=cap(cid);const tlM=triadLegs(g.platforms,g.blackPrograms);const sphere=g.sphere;const close=()=>{g.ultimatum=null;S.setUltimatum(null);};
  if(response==='standDown'){S.setBlockades(p=>{const n2={};Object.entries(p).forEach(([r2,b])=>{if(b.target!==cid)n2[r2]=b;});g.blockades=n2;return n2;});S.setRivalTension(p=>({...p,[cid]:Math.max(0,(p[cid]||0)-25)}));const top=Object.entries(sphere).map(([r2,s2])=>[r2,s2.competitors?.[cid]||0]).sort((a,b)=>b[1]-a[1])[0];if(top)S.setSphere(p=>({...p,[top[0]]:{...p[top[0]],player:Math.max(0,(p[top[0]].player||0)-6)}}));fx.toast(`🕊 Stood down — blockades vs ${rn} lifted, tension −25, a region conceded −6`);S.setLog(p=>[{msg:`🕊 Stood down to ${rn} ultimatum`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);close();}
  else if(response==='holdLine'){S.setRivalTension(p=>({...p,[cid]:Math.min(99,(p[cid]||0)+6)}));S.setStats(p=>({...p,stability:p.stability-2}));fx.toast(`⚠ Holding firm — ${rn} tension +6, the world holds its breath`);close();}
  else if(response==='counterThreat'){if(tlM<2){fx.toast('⚠ Counter-threat needs 2+ strategic legs — they know you cannot answer');return;}const backs=rng()<0.6;if(backs){S.setRivalTension(p=>({...p,[cid]:Math.max(0,(p[cid]||0)-20)}));fx.toast(`🛡 ${rn} blinked — tension −20`);S.setLog(p=>[{msg:`🛡 Counter-threat: ${rn} backed down`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);}else{S.setRivalTension(p=>({...p,[cid]:Math.min(99,(p[cid]||0)+5)}));S.setStats(p=>({...p,stability:p.stability-4}));fx.toast(`⚠ ${rn} did not blink — tension +5, stability −4`);}close();}
}
function confrontationResponse(g,S,fx,response){
  const confrontation=g.confrontation;const rn=REGIONS[confrontation.rid]?.n;const tg=confrontation.target;const close=()=>{g.confrontation=null;S.setConfrontation(null);};
  if(response==='enforce'){S.setSphere(p=>{const n2={...p};const s2=n2[confrontation.rid];if(s2)n2[confrontation.rid]={...s2,player:Math.min(100,(s2.player||0)+6),competitors:{...s2.competitors,[tg]:Math.max(0,(s2.competitors?.[tg]||0)-18)}};return n2;});S.setStats(p=>({...p,stability:p.stability-3}));pushTension(g,S,fx,tg,15,'enforcement under fire');S.setNationRelations(p=>{const n2={...p};DIP_TARGETS.forEach(d=>{if(NATION_BLOC[d.id]===NATION_BLOC[tg])n2[d.id]=Math.max(-100,(n2[d.id]||0)-6);});return n2;});fx.toast('⚔️ Cordon enforced — their convoy turned back under fire');S.setLog(p=>[{msg:`⚔️ Enforced blockade vs ${tg} — ${rn}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);close();}
  else if(response==='board'){S.setSphere(p=>{const n2={...p};const s2=n2[confrontation.rid];if(s2)n2[confrontation.rid]={...s2,player:Math.min(100,(s2.player||0)+3),competitors:{...s2.competitors,[tg]:Math.max(0,(s2.competitors?.[tg]||0)-8)}};return n2;});S.setStats(p=>({...p,treasury:p.treasury+150}));S.setRivalTension(p=>({...p,[tg]:Math.min(100,(p[tg]||0)+5)}));fx.toast('⚓ Convoy boarded — cargo seized (+$150M)');S.setLog(p=>[{msg:`⚓ Boarded ${tg} convoy — ${rn}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);close();}
  else if(response==='letPass'){S.setBlockades(p=>{const n2={...p};if(n2[confrontation.rid])n2[confrontation.rid]={...n2[confrontation.rid],half:true};g.blockades=n2;return n2;});S.setRivalTension(p=>({...p,[tg]:Math.max(0,(p[tg]||0)-5)}));fx.toast('🕊 Convoy passed — blockade credibility halved');S.setLog(p=>[{msg:`🕊 Let ${tg} convoy pass — ${rn}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);close();}
}

// Map region panel: flashpoint responses, forward deployment +/-, posture, blockade, kinetic strike.
function flashpointResponse(g,S,fx,selectedRegion,response){
  const stats=g.stats;const forceDeployments=g.forceDeployments;const embassies=g.embassies;
  if(response==='intervene'){const dep=sumDep(forceDeployments[selectedRegion]);const canInt=dep>0||(stats?.military||0)>=70;
    if(!canInt){fx.toast('⚠ Requires deployed forces here or Military 70+');return;}if((g.stats?.treasury||0)<500){fx.toast('⚠ Insufficient treasury');return;}S.setStats(p=>({...p,treasury:p.treasury-500,stability:p.stability-2}));S.setSphere(p=>{const n2={...p};const sph=n2[selectedRegion];if(sph){const top=Object.entries(sph.competitors||{}).sort((a,b)=>b[1]-a[1])[0];n2[selectedRegion]={...sph,player:Math.min(100,(sph.player||0)+15),competitors:top?{...sph.competitors,[top[0]]:Math.max(0,top[1]-8)}:sph.competitors};}return n2;});g.flashpoint=null;S.setFlashpoint(null);fx.toast('🪖 Intervention successful — region secured (+15 sphere)');S.setLog(p=>[{msg:`🪖 Intervened: ${REGIONS[selectedRegion]?.n}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);}
  else if(response==='mediate'){if((g.stats?.treasury||0)<300){fx.toast('⚠ Insufficient treasury');return;}S.setStats(p=>({...p,treasury:p.treasury-300}));S.setSphere(p=>{const n2={...p};const sph=n2[selectedRegion];if(sph)n2[selectedRegion]={...sph,player:Math.min(100,(sph.player||0)+7)};return n2;});g.flashpoint=null;S.setFlashpoint(null);fx.toast('🕊 Mediation holds (+7 sphere)');S.setLog(p=>[{msg:`🕊 Mediated: ${REGIONS[selectedRegion]?.n}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);}
  else if(response==='diplomatic'){const embHere=DIP_TARGETS.some(d=>d.region===selectedRegion&&embassies.has(d.id));
    if(!embHere){fx.toast('⚠ Requires an embassy in this region — establish one via Trade');return;}if((g.stats?.treasury||0)<200){fx.toast('⚠ Insufficient treasury');return;}S.setStats(p=>({...p,treasury:p.treasury-200}));S.setSphere(p=>{const n2={...p};const sph=n2[selectedRegion];if(sph){const top=Object.entries(sph.competitors||{}).sort((a,b)=>b[1]-a[1])[0];n2[selectedRegion]={...sph,player:Math.min(100,(sph.player||0)+6),competitors:top?{...sph.competitors,[top[0]]:Math.max(0,top[1]-4)}:sph.competitors};}return n2;});g.flashpoint=null;S.setFlashpoint(null);fx.toast('🏛️ Diplomatic resolution — embassy back-channels defused the crisis');S.setLog(p=>[{msg:`🏛️ Diplomatic resolution: ${REGIONS[selectedRegion]?.n}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);}
}
// v57 quirk preserved (inventory §8.4): the map +/- commits forceDeployments without writing the live ref.
const MAP_BLACK=['b21','sr72','ssnx'];
function adjustDeployment(g,S,fx,selectedRegion,pid,delta){
  const forceDeployments=g.forceDeployments;const hereObj=forceDeployments[selectedRegion]||{};
  if(delta>0){const p=PLATFORMS[pid]||BLACK_PROGRAMS[pid];const own=MAP_BLACK.includes(pid)?(+g.blackPrograms[pid]||1):(g.platforms[pid]||0)+(g.platformsImported[pid]||0);
    const avail=own-Object.values(forceDeployments).reduce((a,r)=>a+((r&&r[pid])||0),0);
    if(avail<=0){fx.toast(`⚠ No free ${p.n} — build more or recall from other regions`);return;}S.setForceDeployments(pr=>({...pr,[selectedRegion]:{...(pr[selectedRegion]||{}),[pid]:((pr[selectedRegion]||{})[pid]||0)+1}}));}
  else{const hereN=hereObj[pid]||0;if(hereN<=0)return;S.setForceDeployments(pr=>({...pr,[selectedRegion]:{...(pr[selectedRegion]||{}),[pid]:Math.max(0,((pr[selectedRegion]||{})[pid]||0)-1)}}));}
}
function setPosture(g,S,fx,selectedRegion,k,from){
  if(from==='sitroom'){S.setForcePosture(p=>{const n2={...p,[selectedRegion]:k};g.forcePosture=n2;return n2;});fx.toast(`🚢 Escort posture — ${REGIONS[selectedRegion]?.n}`);return;}
  const l=POSTURE_LABELS[k];S.setForcePosture(p=>{const n2={...p,[selectedRegion]:k};g.forcePosture=n2;return n2;});fx.toast(`${l} posture set — ${REGIONS[selectedRegion]?.n}`);
}
function liftBlockade(g,S,fx,selectedRegion,from){
  S.setBlockades(p=>{const n2={...p};delete n2[selectedRegion];g.blockades=n2;return n2;});fx.toast(`⚓ ${REGIONS[selectedRegion]?.n} blockade lifted`);if(from==='sitroom')return;S.setLog(p=>[{msg:`⚓ Blockade lifted — ${REGIONS[selectedRegion]?.n}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
}
function declareBlockade(g,S,fx,selectedRegion){
  const hereObj=g.forceDeployments[selectedRegion]||{};const navalW=navalWeight(hereObj);const topR2=topHostile(g.sphere[selectedRegion]?.competitors,g.country?.id);const blocTrade=g.blocTrade;
  if(!topR2||topR2[1]<8)return;const can=navalW>=4;
  if(!can){fx.toast(`⚓ Need naval weight 4+ here (carriers/subs, SSN(X) ×2) — currently ${navalW}`);return;}
  S.setBlockades(p=>{const n2={...p,[selectedRegion]:{target:topR2[0]}};g.blockades=n2;return n2;});
  pushTension(g,S,fx,topR2[0],20,'blockade');
  Object.entries(BLOC_TRADE).forEach(([bk,bm])=>{if(blocTrade[bk]>0&&bm.members.some(m=>NATIONS[m]?.region===selectedRegion)){S.setBlocTrade(p=>{const nb={...p,[bk]:0};g.blocTrade=nb;return nb;});S.setBlocLock(p=>{const nl={...p,[bk]:12};g.blocLock=nl;return nl;});fx.toast(`💥 ${bm.n} suspended — you blockaded members' waters. 12mo freeze`);}});
  const tBloc=NATION_BLOC[topR2[0]];
  S.setNationRelations(p=>{const n2={...p};DIP_TARGETS.forEach(d=>{if(d.region===selectedRegion&&NATION_BLOC[d.id]===tBloc)n2[d.id]=Math.max(-100,(n2[d.id]||0)-10);});return n2;});
  fx.toast(`⚓ Naval blockade declared — ${REGIONS[selectedRegion]?.n} sealed against ${topR2[0]}. An act of war: tension +20`);
  S.setLog(p=>[{msg:`⚓ BLOCKADE: ${REGIONS[selectedRegion]?.n} vs ${topR2[0]}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
}
function kineticStrike(g,S,fx,selectedRegion){
  const hereObj=g.forceDeployments[selectedRegion]||{};const topR=topHostile(g.sphere[selectedRegion]?.competitors,g.country?.id);const kcd=g.actionCooldowns[`kin_${selectedRegion}`]||0;
  if(sumDep(hereObj)<3||!topR||topR[1]<10)return;
  const kDmg=kineticDamage(isrScore(g.platforms,g.defLevels,g.intelInfra,g.blackPrograms),hereObj);
  if(kcd>0){fx.toast(`⚠ Forces regrouping — ${kcd} months`);return;}if((g.stats?.treasury||0)<400){fx.toast('⚠ Insufficient treasury');return;}S.setStats(p=>({...p,treasury:p.treasury-400,stability:p.stability-3}));S.setSphere(p=>{const n2={...p};const sph=n2[selectedRegion];if(sph){n2[selectedRegion]={...sph,player:Math.min(100,(sph.player||0)+6),competitors:{...sph.competitors,[topR[0]]:Math.max(0,(sph.competitors?.[topR[0]]||0)-kDmg)}};}return n2;});g.actionCooldowns={...g.actionCooldowns,[`kin_${selectedRegion}`]:8};S.setActionCooldowns(p=>({...p,[`kin_${selectedRegion}`]:8}));pushTension(g,S,fx,topR[0],15,'kinetic strike');fx.toast(`🎯 Kinetic strike: ${topR[0]} assets degraded in ${REGIONS[selectedRegion]?.n} (−${kDmg} their sphere)`);S.setLog(p=>[{msg:`🎯 Kinetic strike vs ${topR[0]} — ${REGIONS[selectedRegion]?.n}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
}

// Situation Room lanes and the intel dossier. `from` selects the v57 wording of the same act (text only).
function backChannel(g,S,fx,nation,from){
  const label=from==='dossier'?cap(nation):nation;
  const cd=g.actionCooldowns[`bc_${nation}`]||0;if(cd>0){fx.toast(`Back-channel exhausted — ${cd}mo`);return;}if((g.stats?.treasury||0)<250){fx.toast('⚠ Need $250M');return;}S.setStats(p=>({...p,treasury:p.treasury-250}));S.setRivalTension(p=>({...p,[nation]:Math.max(0,(p[nation]||0)-8)}));g.actionCooldowns={...g.actionCooldowns,[`bc_${nation}`]:12};S.setActionCooldowns(p=>({...p,[`bc_${nation}`]:12}));fx.toast(`🕊 Back-channel with ${label} — tension −8`);
}
// v57: the embargo lane's Russia back-channel has no cooldown.
function embargoBackChannel(g,S,fx){if((g.stats?.treasury||0)<250){fx.toast('⚠ Need $250M');return;}S.setStats(p=>({...p,treasury:p.treasury-250}));S.setRivalTension(p=>({...p,russia:Math.max(0,(p.russia||0)-8)}));fx.toast('🕊 Back-channel with Russia — tension −8');}
function releaseReserve(g,S,fx,from){const spr=g.spr;if(spr<=0){fx.toast(from==='chokepoint'?'⚠ Reserve empty — fill it on the Energy tab':'⚠ Reserve empty');return;}g.sprRelease=true;S.setSprRelease(true);fx.toast('🛢️ Releasing reserve');}
function establishRegionEmbassy(g,S,fx,rid){const embassies=g.embassies;const d=DIP_TARGETS.find(x=>x.region===rid&&!embassies.has(x.id));if(d)establishEmbassy(g,S,fx,d.id);else fx.toast('No embassy candidate in this region');}
function stationHunterKiller(g,S,fx,rid){if(!deployUnit(g,S,fx,rid,'ssnx'))deployUnit(g,S,fx,rid,'sub_fleet');}
// v57: the rival-hegemony lane only adds the sanction (no bloc suspension, no ally cost), unlike the Trade toggle.
function imposeSanctions(g,S,fx,cid){const sanctions=g.sanctions;if(!sanctions.has(cid)){S.setSanctions(prev=>{const n2=new Set(prev);n2.add(cid);g.sanctions=n2;return n2;});fx.toast(`🚫 Sanctions imposed on ${cid}`);}}

// Economy tab: monetary, fiscal and tax policy, sector budgets, expertise leasing, social programs, modernization.
function setInterestRate(g,S,fx,rate){S.setInterestRate(rate);}
function setFiscalStance(g,S,fx,mode){S.setSpendingMode(mode);}
function setTaxRate(g,S,fx,rate){S.setTaxPolicy(rate);}
function setSectorBudget(g,S,fx,sector,value){S.setBudgetAlloc(p=>({...p,[sector]:value}));}
function setExpertiseLease(g,S,fx,v){S.setExpertiseLease(v);g.expertiseLease=v;fx.toast(v===0?'Expertise missions recalled':`Leasing ${v} specialist corps — +$${v*45}M/mo`);}
function toggleSocialProgram(g,S,fx,spId){const sp=SOCIAL_PROGRAMS[spId];S.setSocialPrograms(prev=>{const ns2=new Set(prev);if(ns2.has(spId)){ns2.delete(spId);fx.toast(`${sp.i} ${sp.n} discontinued`);}else{ns2.add(spId);fx.toast(`${sp.i} ${sp.n} enacted — $${sp.cost}M/mo`);}g.socialPrograms=ns2;return ns2;});}
function modernizeSector(g,S,fx,sector){const label=SECTOR_LABELS[sector];
  const mCost=Math.round((g.stats?.treasury||0)*0.3);
  if((g.stats?.treasury||0)<mCost){fx.toast('⚠ Insufficient treasury');return;}
  S.setStats(p=>({...p,treasury:p.treasury-mCost}));
  S.setSectorAge(p=>({...p,[sector]:0}));g.sectorAge={...g.sectorAge,[sector]:0};
  S.setSectorMaturity(p=>({...p,[sector]:0}));g.sectorMaturity={...g.sectorMaturity,[sector]:0};
  S.setLog(p=>[{msg:`🔄 ${label} Modernization: −$${mCost.toLocaleString()}M`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
  fx.toast(`🔄 ${label} Modernized — 40-year clock reset`);
}

// Energy tab: strategic reserve, export shares, energy embargo, Panama deals, concessions and stewardship.
function fillReserve(g,S,fx){const spr=g.spr;if(spr>=6){fx.toast('Reserve full');return;}if((g.stats?.treasury||0)<200){fx.toast('⚠ $200M per tranche');return;}S.setStats(p=>({...p,treasury:p.treasury-200}));g.spr=spr+1;S.setSpr(spr+1);fx.toast('🛢️ Reserve tranche filled');}
function toggleReserveRelease(g,S,fx){const spr=g.spr,sprRelease=g.sprRelease;if(spr<=0){fx.toast('⚠ Reserve empty');return;}g.sprRelease=!sprRelease;S.setSprRelease(!sprRelease);fx.toast(sprRelease?'Release halted':'🛢️ Releasing reserve — 1 tranche/mo shields you from lane disruption');}
function setExportShare(g,S,fx,k,v){S.setExportShare(p=>{const n2={...p,[k]:v};g.exportShare=n2;return n2;});}
function toggleEmbargo(g,S,fx,tg){
  const resExtraction=g.resExtraction;const prod=(resExtraction.oil||0)>=2||(resExtraction.gas||0)>=2;const on=g.embargoes.has(tg);const country=g.country;const blocTrade=g.blocTrade;
  if(!prod){fx.toast('⚠ Extraction too low to embargo');return;}if(on){S.setEmbargoes(prev=>{const n2=new Set(prev);n2.delete(tg);g.embargoes=n2;return n2;});fx.toast(`⛽ Embargo on ${tg} lifted`);}else{S.setEmbargoes(prev=>{const n2=new Set(prev);n2.add(tg);g.embargoes=n2;return n2;});if(['usa','russia','china','germany'].includes(tg))pushTension(g,S,fx,tg,10,'energy embargo');else S.setNationRelations(p=>({...p,[tg]:Math.max(-100,(p[tg]||0)-25)}));if(isAllyOf(country?.id,tg)){S.setStats(p=>({...p,stability:Math.max(0,p.stability-3)}));Object.entries(BLOC_TRADE).forEach(([bk,bm])=>{if(bm.members.includes(tg)&&blocTrade[bk]>0){S.setBlocTrade(p=>{const nb={...p,[bk]:0};g.blocTrade=nb;return nb;});S.setBlocLock(p=>{const nl={...p,[bk]:12};g.blocLock=nl;return nl;});fx.toast(`💥 ${bm.n} suspended — you cut energy to a member`);}});}fx.toast(`⛽ ENERGY EMBARGO on ${NATIONS[tg]?.n||tg} — the taps close`);S.setLog(p=>[{msg:`⛽ Embargo: ${tg}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);}
}
function panamaDeal(g,S,fx,deal){
  const cd=g.chokeDeals.panama||{};
  if(deal==='priority'){const homeRid=Object.entries(REGIONS).find(([,r])=>r.homeFor?.includes(g.country?.id))?.[0];const naHome=homeRid==='NA'||homeRid==='SA';const nationRelations=g.nationRelations;const saRel=DIP_TARGETS.filter(d=>d.region==='SA').reduce((s,d)=>s+(nationRelations[d.id]||0),0)/Math.max(1,DIP_TARGETS.filter(d=>d.region==='SA').length);
    if(cd.priority){fx.toast('Transit priority already in force');return;}if(!(naHome||saRel>=30)){fx.toast('⚠ Needs a hemispheric home or South American relations ≥30');return;}if((g.stats?.treasury||0)<800){fx.toast('⚠ $800M');return;}S.setStats(p=>({...p,treasury:p.treasury-800}));S.setChokeDeals(p=>{const n2={...p,panama:{...(p.panama||{}),priority:true}};g.chokeDeals=n2;return n2;});fx.toast('🇵🇦 Transit Priority Agreement — your hulls jump the queue; drought rationing no longer applies to you');}
  else if(deal==='locks'){if(cd.locks!==undefined){fx.toast(cd.locks>0?`Lock expansion — ${cd.locks}mo remaining`:'Third lane complete');return;}if((g.stats?.treasury||0)<2000){fx.toast('⚠ $2,000M');return;}S.setStats(p=>({...p,treasury:p.treasury-2000}));S.setChokeDeals(p=>{const n2={...p,panama:{...(p.panama||{}),locks:24}};g.chokeDeals=n2;return n2;});fx.toast('🏗️ Lock expansion financed — 24 months to a third lane. Capacity beats drought, and fees follow.');}
}
function signConcession(g,S,fx,ck){
  const cp=CONCESSIONS[ck];const nat=NATIONS[cp.nation];const rel=Math.round(g.nationRelations[cp.nation]||0);const ok=(g.defLevels.materials||0)>=cp.req.materials&&rel>=cp.req.rel&&g.embassies.has(cp.nation);
  if(!ok){fx.toast('⚠ Requirements not met — see checklist');return;}if((g.stats?.treasury||0)<cp.cost){fx.toast(`⚠ Need $${cp.cost}M`);return;}S.setStats(p=>({...p,treasury:p.treasury-cp.cost}));S.setConcessions(prev=>{const n2=new Set(prev);n2.add(ck);g.concessions=n2;return n2;});S.setNationRelations(p=>({...p,[cp.nation]:Math.min(100,(p[cp.nation]||0)+10)}));fx.toast(`${cp.i} ${cp.n} signed — your engineers arrive in ${nat?.n}`);S.setLog(p=>[{msg:`${cp.i} Concession: ${cp.n}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
}
function rehabilitateFields(g,S,fx,ck){
  const st=g.stewardship[ck];const tierCost=1000;const canTier=(st.tiers||0)<3&&(g.defLevels.materials||0)>=4+(st.tiers||0);
  if(!canTier){fx.toast((st.tiers||0)>=3?'Fields fully rehabilitated':`⚠ Tier ${(st.tiers||0)+1} needs Materials L${4+(st.tiers||0)}`);return;}if((g.stats?.treasury||0)<tierCost){fx.toast('⚠ $1,000M per rehabilitation tier');return;}S.setStats(p=>({...p,treasury:p.treasury-tierCost}));S.setStewardship(p=>{const n2={...p,[ck]:{...p[ck],tiers:(p[ck]?.tiers||0)+1}};g.stewardship=n2;return n2;});fx.toast(`🏗️ Field rehabilitation tier ${(st.tiers||0)+1} — output +25%`);
}
function handOverStewardship(g,S,fx,ck){
  const cp=CONCESSIONS[ck];const nat=NATIONS[cp.nation];
  S.setStewardship(p=>{const n2={...p};delete n2[ck];g.stewardship=n2;return n2;});S.setConcessions(prev=>{const n2=new Set(prev);n2.add(ck);g.concessions=n2;return n2;});S.setNationRelations(p=>{const n2={...p};DIP_TARGETS.forEach(t=>{if(t.region===cp.region)n2[t.id]=Math.min(100,(n2[t.id]||0)+20);});return n2;});S.setRivalTension(p=>({...p,china:Math.max(0,(p.china||0)-6),russia:Math.max(0,(p.russia||0)-6)}));fx.toast(`🤝 Handed the ministry back — ${nat?.n} keeps you as concession partner; the region exhales`);
}

// Resources tab: extraction rates, Greater Green River Basin survey and Phase II, renewables.
function setExtraction(g,S,fx,k,v){S.setResExtraction(p=>({...p,[k]:v}));}
function ggrbPhase2(g,S,fx){
  const ready=(g.defLevels.propulsion||0)>=6&&(g.defLevels.materials||0)>=5;
  if(!ready){fx.toast('⚠ Requires Propulsion L6 + Materials L5');return;}if((g.stats?.treasury||0)<2500){fx.toast('⚠ Insufficient treasury');return;}S.setStats(p=>({...p,treasury:p.treasury-2500}));S.setGrrbState(p=>({...p,phase2:true}));g.grrbState={...g.grrbState,phase2:true};S.setResources(p=>({...p,shaleOil:{...p.shaleOil,r:(p.shaleOil?.r||0)+2000}}));fx.toast('☢ In-Situ Nuclear Retorting online — deep tranche unlocked, output ×2.5');S.setLog(p=>[{msg:'☢ GGRB Phase II: nuclear retorting operational — +2,000 units',yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
}
function ggrbSurvey(g,S,fx){if((g.stats?.treasury||0)<800){fx.toast('⚠ Insufficient treasury');return;}S.setStats(p=>({...p,treasury:p.treasury-800}));S.setGrrbState({surveying:true,surveyMo:6,unlocked:false});g.grrbState={surveying:true,surveyMo:6,unlocked:false};fx.toast('🏔️ GGRB Geological Survey started — 6 months');}
function buildRenewable(g,S,fx,k){const lvl=g.resources?.renewable?.[k]||0;
  if(!g.stats||g.stats.treasury<400){fx.toast('⚠ Insufficient');return;}if(lvl>=5){fx.toast('Max level');return;}S.setStats(p=>({...p,treasury:p.treasury-400}));S.setResources(p=>({...p,renewable:{...p.renewable,[k]:(p.renewable?.[k]||0)+1}}));S.setActiveEffects(p=>[...p,{id:`ren_${k}_${fx.now()}`,source:`renewable_${k}`,stat:'inflation',d:-0.04,monthsLeft:999,totalMonths:999}]);
}

// Defense tab: arms marketplace, recapitalization, Japan normalization, SAP office and programs, pay, procurement,
// platform develop / build / import / decommission, export deal cut-off. Technology tab: IP policy.
function offerArms(g,S,fx,buyerId,vert){
  const buyer=BUYERS.find(b=>b.id===buyerId);const hasDeal=g.defExports[`${buyer.id}_${vert}`];const wontBuy=vert&&(buyer.noBuy||[]).includes(vert);
  const nationRelations=g.nationRelations;const bRel=nationRelations[buyer.id]!==undefined?nationRelations[buyer.id]:buyer.rel;const hostile=bRel<-30;const canSell=vert&&!wontBuy&&!hostile&&(g.defLevels[vert]||0)>=1;
  hasDeal?fx.toast('Deal active'):wontBuy?fx.toast(`${buyer.n} builds ${DV[vert].n} domestically`):hostile?fx.toast(`${buyer.n} relations too hostile (${Math.round(bRel)}) — build influence first`):canSell?sellDefTech(g,S,fx,buyer.id,vert):fx.toast(`⚠ Develop ${DV[vert].n} first`);
}
function recapitalizeForces(g,S,fx){const cost=recapCost(g.stats?.treasury);
  if((g.stats?.treasury||0)<cost){fx.toast('⚠ Insufficient treasury');return;}S.setStats(p=>({...p,treasury:p.treasury-cost,military:Math.min(100,p.military+12)}));S.setSectorAge(p=>({...p,defense:0}));g.sectorAge={...g.sectorAge,defense:0};fx.toast(`🔄 Force recapitalization complete — next-generation fleet fielded`);S.setLog(p=>[{msg:`🔄 Defense recapitalization — $${cost.toLocaleString()}M`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
}
function japanNormalization(g,S,fx){if((g.stats?.treasury||0)<500){fx.toast('⚠ Insufficient treasury');return;}S.setStats(p=>({...p,treasury:p.treasury-500,stability:Math.max(0,p.stability-6)}));S.setActiveEffects(p=>[...p,{id:`jpn_${fx.now()}`,source:'jp_normalization',stat:'stability',d:-0.05,monthsLeft:12,totalMonths:12}]);S.setActivePolicies(p=>{const n2=new Set(p);n2.add('jp_normalization');g.activePolicies=n2;return n2;});fx.toast('🇯🇵 Defense Normalization enacted — weapons R&D penalty lifted');S.setLog(p=>[{msg:'🇯🇵 Constitutional reinterpretation: Defense Normalization',yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);}
function establishSapOffice(g,S,fx){if((g.stats?.treasury||0)<1500){fx.toast('⚠ SAP office requires $1,500M');return;}S.setStats(p=>({...p,treasury:p.treasury-1500}));S.setSapOffice(true);g.sapOffice=true;fx.toast('🔒 Special Access Program office established — black projects unlocked');S.setLog(p=>[{msg:'🔒 SAP office established',yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);}
function sapTranche(g,S,fx,bid){
  const bp=BLACK_PROGRAMS[bid];const n=+g.blackPrograms[bid]||1;const runCost=sapRunCost(bp,n);const indOk=(g.defLevels.materials||0)>=4;
  if(!indOk){fx.toast('⚠ Production run needs Material Science L4+ (industrial base)');return;}if((g.stats?.treasury||0)<runCost){fx.toast(`⚠ Need $${runCost}M for a production run`);return;}S.setStats(p=>({...p,treasury:p.treasury-runCost,military:Math.min(100,p.military+bp.mil*(Math.sqrt(n+1)-Math.sqrt(n)))}));g.blackPrograms={...g.blackPrograms,[bid]:n+1};S.setBlackPrograms({...g.blackPrograms});fx.toast(`${bp.i} ${bp.n} unit #${n+1} delivered — production line hot`);S.setLog(p=>[{msg:`${bp.i} ${bp.n} #${n+1} produced`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
}
function sapInitiate(g,S,fx,bid){
  const bp=BLACK_PROGRAMS[bid];const blackResearch=g.blackResearch;const busy=blackResearch&&!(blackResearch?.id===bid);const reqMet=meetsReq(bp.req,g.defLevels);
  if(busy){fx.toast('⚠ SAP office already running a program');return;}if(!reqMet){fx.toast('⚠ R&D requirements not met');return;}if((g.stats?.treasury||0)<bp.cost){fx.toast('⚠ Insufficient black budget');return;}S.setStats(p=>({...p,treasury:p.treasury-bp.cost}));S.setBlackResearch({id:bid,prog:0,mo:bp.mo});g.blackResearch={id:bid,prog:0,mo:bp.mo};fx.toast(`🔒 ${bp.n} program initiated — $${bp.cost.toLocaleString()}M, ${bp.mo}mo`);
}
function setPersonnelPay(g,S,fx,pay){S.setPersonnelPay(pay);}
function setProcurement(g,S,fx,mode){S.setProcureMode(mode);}
function developPlatform(g,S,fx,pid){const p=PLATFORMS[pid];const reqsMet=meetsReq(p.req,g.defLevels);
  if(!reqsMet){fx.toast('⚠ Research requirements not met');return;}if((g.stats?.treasury||0)<p.dev.cost){fx.toast(`⚠ Program needs $${p.dev.cost}M`);return;}S.setStats(pr=>({...pr,treasury:pr.treasury-p.dev.cost}));S.setPlatformDev(pr=>{const n2={...pr,[pid]:{mo:p.dev.mo}};g.platformDev=n2;return n2;});fx.toast(`🔬 ${p.n} program launched — ${p.dev.mo}mo to first article`);S.setLog(pr=>[{msg:`🔬 ${p.n} development started`,yr:g.date.yr,mo:g.date.mo},...pr.slice(0,19)]);
}
function buildPlatform(g,S,fx,pid){const p=PLATFORMS[pid];const reqsMet=meetsReq(p.req,g.defLevels);const procCost=procurementCost(p,g.procureMode);
  if(!reqsMet){fx.toast('⚠ Research requirements not met');return;}if((g.stats?.treasury||0)<procCost){fx.toast('⚠ Insufficient treasury');return;}S.setStats(pr=>({...pr,treasury:pr.treasury-procCost}));S.setPlatforms(pr=>({...pr,[pid]:(pr[pid]||0)+1}));S.setLog(pr=>[{msg:`${p.i} ${p.n} deployed — $${procCost}M`,yr:g.date.yr,mo:g.date.mo},...pr.slice(0,19)]);fx.toast(`${p.i} ${p.n} deployed`);
}
function importPlatform(g,S,fx,pid){const p=PLATFORMS[pid];
  const impCost=Math.round(p.cost*1.8);if((g.stats?.treasury||0)<impCost){fx.toast('⚠ Insufficient treasury');return;}S.setStats(pr=>({...pr,treasury:pr.treasury-impCost}));S.setPlatformsImported(pr=>({...pr,[pid]:(pr[pid]||0)+1}));S.setLog(pr=>[{msg:`🌐 ${p.n} purchased abroad — $${impCost}M`,yr:g.date.yr,mo:g.date.mo},...pr.slice(0,19)]);fx.toast(`🌐 ${p.n} imported (90% effectiveness, +25% maintenance)`);
}
function decommissionPlatform(g,S,fx,pid){const p=PLATFORMS[pid];S.setPlatforms(pr=>({...pr,[pid]:Math.max(0,(pr[pid]||0)-1)}));fx.toast(`${p.n} decommissioned`);}
function retireImported(g,S,fx,pid){const p=PLATFORMS[pid];S.setPlatformsImported(pr=>({...pr,[pid]:Math.max(0,(pr[pid]||0)-1)}));fx.toast(`Imported ${p.n} retired`);}
function cutExportDeal(g,S,fx,k){const nd={...g.defExports};delete nd[k];S.setDefExports(nd);fx.toast('Deal terminated');}
function setIpPolicy(g,S,fx,k){const lab=IP_POLICY_LABELS[k];S.setIpPolicy(k);g.ipPolicy=k;fx.toast(`IP policy: ${lab.replace(/[^ -~]/g,'').trim()}`);}

// Intel tab: final options (nuclear demonstration / employment), infrastructure, agency and proxy budgets, response
// doctrine, covert programs, standing operations.
function nuclearDemonstration(g,S,fx,rid){
  const rname=cap(rid);const country=g.country;const tlF=triadLegs(g.platforms,g.blackPrograms);const topRg=Object.entries(g.sphere).map(([r2,s2])=>[r2,s2.competitors?.[rid]||0]).sort((a,b)=>b[1]-a[1])[0];const dcd=g.actionCooldowns[`demo_${rid}`]||0;
  if(tlF<1){fx.toast('⚠ No strategic leg to demonstrate with');return;}if(dcd>0){fx.toast(`Demonstration on cooldown — ${dcd}mo`);return;}if((g.stats?.treasury||0)<1500){fx.toast('⚠ Need $1,500M');return;}
  S.setStats(p=>({...p,treasury:p.treasury-1500,stability:p.stability-5}));if(topRg&&topRg[1]>0)S.setSphere(p=>({...p,[topRg[0]]:{...p[topRg[0]],competitors:{...p[topRg[0]].competitors,[rid]:Math.max(0,(p[topRg[0]].competitors?.[rid]||0)-25)}}}));
  S.setNationRelations(p=>{const n2={...p};DIP_TARGETS.forEach(t=>{n2[t.id]=Math.max(-100,(n2[t.id]||0)-15);});return n2;});
  S.setRivalTension(p=>({...p,[rid]:95}));g.rivalTension={...g.rivalTension,[rid]:95};g.actionCooldowns={...g.actionCooldowns,[`demo_${rid}`]:12};S.setActionCooldowns(p=>({...p,[`demo_${rid}`]:12}));
  recordNuke(g,S,fx,{actor:country?.id,target:rid,region:topRg?.[0],type:'demonstration'});S.setNationRelations(p=>({...p,[rid]:Math.max(-100,(p[rid]||0)-40)}));
  fx.toast(`☢ Demonstration strike — ${rname} watched the sky burn. Their ${REGIONS[topRg?.[0]]?.n||'position'} collapses −25; the world recoils −15`);S.setLog(p=>[{msg:`☢ Demonstration strike vs ${rname}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
}
function nuclearEmployment(g,S,fx,rid){
  const rname=cap(rid);const country=g.country;const tlF=triadLegs(g.platforms,g.blackPrograms);const rivalStrat=strategicWeight(g.globalDef[rid]||{});const topRg=Object.entries(g.sphere).map(([r2,s2])=>[r2,s2.competitors?.[rid]||0]).sort((a,b)=>b[1]-a[1])[0];
  if(tlF<2){fx.toast('⚠ Employment requires 2+ strategic legs');return;}if((g.stats?.treasury||0)<3000){fx.toast('⚠ Need $3,000M');return;}
  if(rivalStrat>=tlF){S.setGameOver(`☢️ NUCLEAR EXCHANGE. ${rname} held strategic parity. Your tactical employment was answered in kind within the hour. There is no second move.`);return;}
  S.setStats(p=>({...p,treasury:p.treasury-3000,stability:p.stability-25}));
  if(topRg)S.setSphere(p=>({...p,[topRg[0]]:{...p[topRg[0]],player:Math.min(100,(p[topRg[0]].player||0)+20),competitors:{...p[topRg[0]].competitors,[rid]:0}}}));
  S.setNationRelations(p=>{const n2={...p};DIP_TARGETS.forEach(t=>{n2[t.id]=Math.max(-100,(n2[t.id]||0)-60);});return n2;});
  S.setBlocTrade(p=>{const nb={eu:0,cn:0,opec:0};g.blocTrade=nb;return nb;});S.setBlocLock(p=>{const nl={eu:36,cn:36,opec:36};g.blocLock=nl;return nl;});
  g.pariah=36;S.setPariah(36);S.setRivalTension(p=>{const n2={...p};Object.keys(n2).forEach(k=>{n2[k]=Math.min(99,(n2[k]||0)+20);});n2[rid]=92;return n2;});g.rivalTension={...g.rivalTension,[rid]:92};
  g.worldEvent={id:'nuclear_taboo',mo:24};S.setWorldEvent({id:'nuclear_taboo',mo:24});
  recordNuke(g,S,fx,{actor:country?.id,target:rid,region:topRg?.[0],type:'employment'});S.setNationRelations(p=>({...p,[rid]:-100}));
  fx.toast(`☢️ TACTICAL EMPLOYMENT — ${REGIONS[topRg?.[0]]?.n||'the region'} is yours. You are a pariah for 36 months.`);S.setLog(p=>[{msg:`☢️ Tactical nuclear employment vs ${rname}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
}
function buildIntelInfra(g,S,fx,fid){
  const f=INTEL_INFRA[fid];const ct=g.intelInfra[fid]||0;const reqsMet=meetsReq(f.req,g.defLevels);const atMax=ct>=f.max;
  if(atMax)return;if(!reqsMet){fx.toast('⚠ R&D requirements not met');return;}if((g.stats?.treasury||0)<f.cost){fx.toast('⚠ Insufficient treasury');return;}S.setStats(p=>({...p,treasury:p.treasury-f.cost}));S.setIntelInfra(p=>({...p,[fid]:(p[fid]||0)+1}));fx.toast(`${f.i} ${f.n} operational — $${f.maint}M/mo upkeep`);S.setLog(p=>[{msg:`${f.i} ${f.n} built`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
}
function setIntelBudget(g,S,fx,v){S.setIntelBudget(v);fx.toast(`Agency budget: L${v} — $${v*40}M/mo`);}
function setProxyBudget(g,S,fx,v){S.setProxyBudget(v);fx.toast(v===0?'Proxy funding paused':`Proxy pool: $${v*80}M/mo`);}
function setProxyAlloc(g,S,fx,rid,w){S.setProxyAlloc(p=>({...p,[rid]:w}));}
function setIntelPosture(g,S,fx,k){const lab=INTEL_POSTURE_LABELS[k];S.setIntelPosture(k);g.intelPosture=k;fx.toast(`Response doctrine: ${lab}`);}
function toggleCovertProgram(g,S,fx,cpId){const cp=COVERT_PROGRAMS[cpId];S.setCovertPrograms(prev=>{const n2=new Set(prev);if(n2.has(cpId)){n2.delete(cpId);fx.toast(`${cp.i} ${cp.n} defunded`);}else{n2.add(cpId);fx.toast(`${cp.i} ${cp.n} funded — $${cp.cost}M/mo`);}g.covertPrograms=n2;return n2;});}
function toggleContinuousOp(g,S,fx,opId,target){const op=INTEL_OPS.find(o=>o.id===opId);const ck=`${op.id}@${target}`;S.setContinuousOps(p=>{const n2={...p};if(n2[ck]){delete n2[ck];fx.toast(`${op.n} standing program ended`);}else{n2[ck]=true;fx.toast(`♻️ ${op.n} now continuous vs ${target} — auto-relaunches (~1.6× cost)`);}g.continuousOps=n2;return n2;});}

// type -> (g, S, fx, payload). Return values are UI hints only (true = the verb went through).
export const VERBS={
  // issues, policies, decisions
  investigate:(g,S,fx,{issue})=>investigate(g,S,fx,issue),
  deployPolicy:(g,S,fx,{issue,option})=>deployPolicy(g,S,fx,issue,option),
  executePolicy:(g,S,fx,{id})=>executeAction(g,S,fx,PA.find(a=>a.id===id)),
  makeDecision:(g,S,fx,{option})=>makeDecision(g,S,fx,option),
  // forces
  deployUnit:(g,S,fx,{region,unit})=>deployUnit(g,S,fx,region,unit),
  recallUnit:(g,S,fx,{region,unit})=>recallUnit(g,S,fx,region,unit),
  regionIntel:(g,S,fx,{region})=>applyRegionAction(g,S,fx,region,'intel'),
  activateAlliance:(g,S,fx,{region})=>applyRegionAction(g,S,fx,region,'pact'),
  // statecraft
  establishEmbassy:(g,S,fx,{nation})=>establishEmbassy(g,S,fx,nation),
  stateVisit:(g,S,fx,{nation})=>diplomaticAction(g,S,fx,nation,'visit'),
  foreignAid:(g,S,fx,{nation})=>diplomaticAction(g,S,fx,nation,'aid'),
  tradeAgreement:(g,S,fx,{nation})=>diplomaticAction(g,S,fx,nation,'trade'),
  defensePact:(g,S,fx,{nation})=>diplomaticAction(g,S,fx,nation,'pact'),
  // R&D and arms exports
  investDefense:(g,S,fx,{vertical})=>investDefense(g,S,fx,vertical),
  sellDefTech:(g,S,fx,{nation,vertical})=>sellDefTech(g,S,fx,nation,vertical),
  sellAllVertical:(g,S,fx,{vertical})=>sellAllVert(g,S,fx,vertical),
  // intel and Tier-1
  runIntelOp:(g,S,fx,{op,nation})=>runIntelOp(g,S,fx,op,nation),
  respondIntelCrisis:(g,S,fx,{response,crisis})=>respondIntelCrisis(g,S,fx,response,crisis),
  regimeChange:(g,S,fx,{nation})=>regimeChange(g,S,fx,nation),
  launchIntervention:(g,S,fx,{concession})=>launchIntervention(g,S,fx,concession),
  // modals and economy drill
  adjustSectorBudget:(g,S,fx,{sector,delta})=>adjustSectorBudget(g,S,fx,sector,delta),
  chooseDoctrine:(g,S,fx,{doctrine})=>chooseDoctrine(g,S,fx,doctrine),
  imfBailout:(g,S,fx)=>imfBailout(g,S,fx),
  ultimatumResponse:(g,S,fx,{response})=>ultimatumResponse(g,S,fx,response),
  confrontationResponse:(g,S,fx,{response})=>confrontationResponse(g,S,fx,response),
  // map region panel
  flashpointResponse:(g,S,fx,{region,response})=>flashpointResponse(g,S,fx,region,response),
  adjustDeployment:(g,S,fx,{region,unit,delta})=>adjustDeployment(g,S,fx,region,unit,delta),
  setPosture:(g,S,fx,{region,posture,from})=>setPosture(g,S,fx,region,posture,from),
  liftBlockade:(g,S,fx,{region,from})=>liftBlockade(g,S,fx,region,from),
  declareBlockade:(g,S,fx,{region})=>declareBlockade(g,S,fx,region),
  kineticStrike:(g,S,fx,{region})=>kineticStrike(g,S,fx,region),
  // situation room lanes
  backChannel:(g,S,fx,{nation,from})=>backChannel(g,S,fx,nation,from),
  embargoBackChannel:(g,S,fx)=>embargoBackChannel(g,S,fx),
  releaseReserve:(g,S,fx,{from})=>releaseReserve(g,S,fx,from),
  establishRegionEmbassy:(g,S,fx,{region})=>establishRegionEmbassy(g,S,fx,region),
  stationHunterKiller:(g,S,fx,{region})=>stationHunterKiller(g,S,fx,region),
  imposeSanctions:(g,S,fx,{nation})=>imposeSanctions(g,S,fx,nation),
  // economy
  setInterestRate:(g,S,fx,{rate})=>setInterestRate(g,S,fx,rate),
  setFiscalStance:(g,S,fx,{mode})=>setFiscalStance(g,S,fx,mode),
  setTaxRate:(g,S,fx,{rate})=>setTaxRate(g,S,fx,rate),
  setSectorBudget:(g,S,fx,{sector,value})=>setSectorBudget(g,S,fx,sector,value),
  setExpertiseLease:(g,S,fx,{level})=>setExpertiseLease(g,S,fx,level),
  toggleSocialProgram:(g,S,fx,{program})=>toggleSocialProgram(g,S,fx,program),
  modernizeSector:(g,S,fx,{sector})=>modernizeSector(g,S,fx,sector),
  // energy
  fillReserve:(g,S,fx)=>fillReserve(g,S,fx),
  toggleReserveRelease:(g,S,fx)=>toggleReserveRelease(g,S,fx),
  setExportShare:(g,S,fx,{resource,share})=>setExportShare(g,S,fx,resource,share),
  toggleEmbargo:(g,S,fx,{nation})=>toggleEmbargo(g,S,fx,nation),
  panamaDeal:(g,S,fx,{deal})=>panamaDeal(g,S,fx,deal),
  signConcession:(g,S,fx,{concession})=>signConcession(g,S,fx,concession),
  rehabilitateFields:(g,S,fx,{concession})=>rehabilitateFields(g,S,fx,concession),
  handOverStewardship:(g,S,fx,{concession})=>handOverStewardship(g,S,fx,concession),
  // resources
  setExtraction:(g,S,fx,{resource,level})=>setExtraction(g,S,fx,resource,level),
  ggrbPhase2:(g,S,fx)=>ggrbPhase2(g,S,fx),
  ggrbSurvey:(g,S,fx)=>ggrbSurvey(g,S,fx),
  buildRenewable:(g,S,fx,{kind})=>buildRenewable(g,S,fx,kind),
  // defense and technology
  offerArms:(g,S,fx,{nation,vertical})=>offerArms(g,S,fx,nation,vertical),
  recapitalizeForces:(g,S,fx)=>recapitalizeForces(g,S,fx),
  japanNormalization:(g,S,fx)=>japanNormalization(g,S,fx),
  establishSapOffice:(g,S,fx)=>establishSapOffice(g,S,fx),
  sapTranche:(g,S,fx,{program})=>sapTranche(g,S,fx,program),
  sapInitiate:(g,S,fx,{program})=>sapInitiate(g,S,fx,program),
  setPersonnelPay:(g,S,fx,{pay})=>setPersonnelPay(g,S,fx,pay),
  setProcurement:(g,S,fx,{mode})=>setProcurement(g,S,fx,mode),
  developPlatform:(g,S,fx,{platform})=>developPlatform(g,S,fx,platform),
  buildPlatform:(g,S,fx,{platform})=>buildPlatform(g,S,fx,platform),
  importPlatform:(g,S,fx,{platform})=>importPlatform(g,S,fx,platform),
  decommissionPlatform:(g,S,fx,{platform})=>decommissionPlatform(g,S,fx,platform),
  retireImported:(g,S,fx,{platform})=>retireImported(g,S,fx,platform),
  cutExportDeal:(g,S,fx,{deal})=>cutExportDeal(g,S,fx,deal),
  setIpPolicy:(g,S,fx,{policy})=>setIpPolicy(g,S,fx,policy),
  // intel
  nuclearDemonstration:(g,S,fx,{nation})=>nuclearDemonstration(g,S,fx,nation),
  nuclearEmployment:(g,S,fx,{nation})=>nuclearEmployment(g,S,fx,nation),
  buildIntelInfra:(g,S,fx,{facility})=>buildIntelInfra(g,S,fx,facility),
  setIntelBudget:(g,S,fx,{level})=>setIntelBudget(g,S,fx,level),
  setProxyBudget:(g,S,fx,{level})=>setProxyBudget(g,S,fx,level),
  setProxyAlloc:(g,S,fx,{region,weight})=>setProxyAlloc(g,S,fx,region,weight),
  setIntelPosture:(g,S,fx,{posture})=>setIntelPosture(g,S,fx,posture),
  toggleCovertProgram:(g,S,fx,{program})=>toggleCovertProgram(g,S,fx,program),
  toggleContinuousOp:(g,S,fx,{op,nation})=>toggleContinuousOp(g,S,fx,op,nation),
};

export function applyVerb(g,S,fx,action){
  const f=action&&VERBS[action.type];
  if(!f)throw new Error(`Unknown verb: ${action&&action.type}`);
  return f(g,S,fx,action.payload||{});
}

