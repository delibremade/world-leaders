import { DIP_TARGETS } from '../data/nations.js';
import { BLOC_GROUPS } from '../data/trade.js';

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
