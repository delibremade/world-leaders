// One implementation per formula (CLAUDE.md rule 8). Pure: plain data in, number/bool out.
import { NATION_BLOC } from '../data/nations.js';
import { DEP_W, DV } from '../data/platforms.js';
import { BASE_SECTOR } from '../data/economy.js';

// Units deployed in one region, unweighted.
export const sumDep=o=>Object.values(o||{}).reduce((a,b)=>a+(b||0),0);
// Bloc partner (never yourself, never a neutral).
export const isAllyOf=(pid,cid)=>cid!==pid&&NATION_BLOC[cid]&&NATION_BLOC[cid]!=='neutral'&&NATION_BLOC[cid]===NATION_BLOC[pid];
// Strongest non-allied competitor entry [id, share] in a region's competitors map.
export const topHostile=(comps,pid)=>Object.entries(comps||{}).filter(([cid])=>!isAllyOf(pid,cid)).sort((a,b)=>b[1]-a[1])[0];
// CCA wings attach to stationed F-47 wings: up to +50% on F-47 weight, scaled by CCA wings owned per F-47 owned (E1, #13).
export const ccaMult=black=>{const f=+black?.f47||0,c=+black?.cca||0;return f>0&&c>0?1+0.5*Math.min(1,c/f):1;};
// Deployment weight in one region (DEP_W per platform, default 1). `black` (optional) = owned black programs, for the CCA multiplier.
export const wSum=(o,black)=>Object.entries(o||{}).reduce((a,[k,v])=>a+(v||0)*(DEP_W[k]||1)*(k==='f47'?ccaMult(black):1),0);
// ISR score: satellites x2, RQ-170 x2, RQ-180 x4, Space R&D level, ISR fusion cell +4, SR-72 +6, drone swarms x1.
// Was duplicated at 8 sites in v57 (4 tick/handler sites on refs, 4 render sites on state).
export const isrScore=(platforms,levels,infra,black)=>(platforms.satellite_net||0)*2+(platforms.rq170||0)*2+(platforms.rq180||0)*4+(levels.space||0)+(infra.isr_fusion?4:0)+(black?.sr72?6:0)+(platforms.drone_swarm||0);
// Naval weight of the forces stationed in one region: carriers + subs + SSN(X) x2 + frigates x0.5 + Zumwalts x1.2.
// Was duplicated at 7 sites in v57.
export const navalWeight=o=>{o=o||{};return (o.carrier_group||0)+(o.sub_fleet||0)+(o.ssnx||0)*2+(o.frigate||0)*0.5+(o.zumwalt||0)*1.2;};

// Monthly cost of one sector budget line; mature sectors (12+ months unchanged) get up to 40% cheaper.
export function calcSCost(sector,alloc,maturity){
  const md=Math.min(0.4,Math.floor((maturity?.[sector]||0)/12)*0.05);
  return BASE_SECTOR[sector]*(1-md)*Math.pow((alloc||100)/100,2.5);
}
export function getEnergyTier(res,ext,imp){
  const ren=((res?.renewable?.solar||0)+(res?.renewable?.wind||0)+(res?.renewable?.hydro||0));
  if(ren>=8||((ext?.uranium||0)>=2&&(res?.uranium?.r||0)>1))return 'nuclear';
  if(ren>=4||(imp&&imp.has&&imp.has('uranium')))return 'high';
  if((ext?.coal||0)>=3&&(res?.coal?.r||0)>1)return 'coal';
  return 'standard';
}
// Energy-embargo cushion: two fossil import contracts, or a nuclear/high energy tier. One implementation for both read sites in tick.js.
export function isDiversified(g){return ['oil','gas','coal'].filter(k=>g.importContracts.has(k)).length>=2||['nuclear','high'].includes(getEnergyTier(g.resources,g.resExtraction,g.importContracts));}
export function getQualMult(v,dl){const p=DV[v]?.chain||[];if(!p.length)return 1;const ml=dl[v]||0;const ap=p.reduce((s,k)=>s+(dl[k]||0),0)/p.length;return ap>=ml?1:Math.max(0.4,1-(ml-ap)*0.2);}
export function getRefineMult(dl){const ms=dl.materials||0,pr=dl.propulsion||0;if(ms>=5&&pr>=4)return 2.4;if(ms>=3&&pr>=2)return 1.6;if(ms>=2&&pr>=1)return 1.3;return 1.0;}
export function getDefLeverage(dl,gdb,cid){const excl=Object.entries(gdb).filter(([k])=>k!==cid);if(!excl.length)return 1;const verts=Object.keys(DV);const pAvg=verts.reduce((s,v)=>s+(dl[v]||0),0)/verts.length;const gAvg=verts.reduce((s,v)=>s+(excl.reduce((mx,[,n])=>Math.max(mx,n[v]||0),0)),0)/verts.length/excl.length;return Math.min(1.5,1+Math.max(0,pAvg-gAvg)*0.1);}
// Strategic legs fielded (SSBN, bombers, ICBM, B-21). Ultimatum counter-threat and the final-options panel.
export const triadLegs=(platforms,black)=>((platforms.ssbn_fleet||0)>0?1:0)+((platforms.strategic_bombers||0)>0?1:0)+((platforms.icbm_force||0)>0?1:0)+((+black.b21||0)>0?1:0);
// Kinetic strike damage to the top hostile's sphere in a region: ISR-scaled plus strike platforms stationed there.
export const kineticDamage=(isr,dep)=>18+Math.round(isr/2)+(dep.fa_xx||0)*2+(dep.zumwalt||0)*3+(dep.mq25||0)*1;
// Every R&D requirement of a platform / SAP / facility met.
export const meetsReq=(req,dl)=>Object.entries(req).every(([v,rq])=>(dl[v]||0)>=rq);
// Platform procurement price under the procurement mode.
export const procurementCost=(p,mode)=>Math.round(p.cost*(mode==='efficiency'?0.85:mode==='surge'?1.25:1));
// SAP production tranche price: cheaper per unit as the line matures.
export const sapRate=(n)=>n<3?0.35:n<6?0.30:0.25;
export const sapRunCost=(bp,n)=>Math.round(bp.cost*sapRate(n));
// Force recapitalization price: 8% of treasury, clamped to $1.5B..$8B.
export const recapCost=(treasury)=>Math.max(1500,Math.min(8000,Math.round((treasury||0)*0.08)));
// A rival's strategic weight (aircraft / missiles / naval at L5+), 0..3. Parity with your triad = MAD.
export const strategicWeight=(gl)=>((gl.aircraft||0)>=5?1:0)+((gl.missiles||0)>=5?1:0)+((gl.naval||0)>=5?1:0);
