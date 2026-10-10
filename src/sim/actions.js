import { NATIONS, BUYERS, DIP_TARGETS, NATION_BLOC, RD_MODS } from '../data/nations.js';
import { REGIONS, POSTURE_LABELS } from '../data/regions.js';
import { DOCTRINES } from '../data/world.js';
import { PLATFORMS, BLACK_PROGRAMS, DV } from '../data/platforms.js';
import { PA, ISSUES } from '../data/economy.js';
import { INTEL_OPS } from '../data/intel.js';
import { BLOC_TRADE } from '../data/trade.js';
import { CONCESSIONS } from '../data/energy.js';
import { sumDep, isAllyOf, topHostile, wSum, isrScore, navalWeight, triadLegs, kineticDamage, getQualMult } from './formulas.js';
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
function setPosture(g,S,fx,selectedRegion,k,lane){
  if(lane){S.setForcePosture(p=>{const n2={...p,[selectedRegion]:k};g.forcePosture=n2;return n2;});fx.toast(`🚢 Escort posture — ${REGIONS[selectedRegion]?.n}`);return;}
  const l=POSTURE_LABELS[k];S.setForcePosture(p=>{const n2={...p,[selectedRegion]:k};g.forcePosture=n2;return n2;});fx.toast(`${l} posture set — ${REGIONS[selectedRegion]?.n}`);
}
function liftBlockade(g,S,fx,selectedRegion,quiet){
  S.setBlockades(p=>{const n2={...p};delete n2[selectedRegion];g.blockades=n2;return n2;});fx.toast(`⚓ ${REGIONS[selectedRegion]?.n} blockade lifted`);if(quiet)return;S.setLog(p=>[{msg:`⚓ Blockade lifted — ${REGIONS[selectedRegion]?.n}`,yr:g.date.yr,mo:g.date.mo},...p.slice(0,19)]);
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
  setPosture:(g,S,fx,{region,posture,lane})=>setPosture(g,S,fx,region,posture,lane),
  liftBlockade:(g,S,fx,{region,quiet})=>liftBlockade(g,S,fx,region,quiet),
  declareBlockade:(g,S,fx,{region})=>declareBlockade(g,S,fx,region),
  kineticStrike:(g,S,fx,{region})=>kineticStrike(g,S,fx,region),
};

export function applyVerb(g,S,fx,action){
  const f=action&&VERBS[action.type];
  if(!f)throw new Error(`Unknown verb: ${action&&action.type}`);
  return f(g,S,fx,action.payload||{});
}

