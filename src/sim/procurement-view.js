import { PLATFORMS, DV } from '../data/platforms.js';
import { procurementCost } from './formulas.js';
import { programSupply } from './minerals.js';
import { crewBlock } from './forces.js';
import { ownedUnits } from './force-inventory.js';
export function platformBlock(g,id,action='build'){
  const p=PLATFORMS[id];if(!p)return 'Unknown platform';
  if(action==='import'&&p.dev)return 'Development program: complete the domestic first article before production';
  if(action==='develop'){
    if(!p.dev)return 'No development required';
    if(g.developed?.has(id))return 'Development already complete';
    if(g.platformDev?.[id])return `Development underway: ${g.platformDev[id].mo} months remaining`;
  }
  if(action==='build'&&p.dev&&!g.developed?.has(id))return g.platformDev?.[id]?`Development underway: ${g.platformDev[id].mo} months remaining`:'Develop the first article before production';
  if(action!=='import'){
    const missing=Object.entries(p.req).filter(([k,n])=>(g.defLevels?.[k]||0)<n);
    if(missing.length)return `Research required: ${missing.map(([k,n])=>`${DV[k]?.n||k} L${n}`).join(', ')}`;
  }
  const cost=action==='develop'?p.dev.cost:action==='import'?Math.round(p.cost*1.8):procurementCost(p,g.procureMode);
  return (g.stats?.treasury||0)<cost?`Need $${cost.toLocaleString('en-US')}M`:null;
}
export function platformAcquisition(g,id){
  const p=PLATFORMS[id],supply=programSupply(g,id),owned=ownedUnits(g,id);
  const action=p.dev&&!g.developed?.has(id)?'develop':'build';
  const reason=platformBlock(g,id,action),months=g.platformDev?.[id]?.mo;
  const phase=months?'Development':supply.queued.length?'Awaiting minerals':owned?'Delivered':reason?'Requirements':'Ready for production';
  return {phase,action,reason,months,owned,supply,crewReason:owned?crewBlock(g,id):null};
}
