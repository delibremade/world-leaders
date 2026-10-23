// Shared presentation of the existing deployment gate; crew eligibility comes from the force engine.
import { DEPLOYABLE, PLATFORMS, BLACK_PROGRAMS } from '../data/platforms.js';
import { crewBlock } from './forces.js';
export const ownedUnits=(g,pid)=>BLACK_PROGRAMS[pid]?(+g.blackPrograms?.[pid]||0):((g.platforms?.[pid]||0)+(g.platformsImported?.[pid]||0));
export const deployedTotal=(g,pid)=>Object.values(g.forceDeployments||{}).reduce((a,o)=>a+(o?.[pid]||0),0);
export function deploymentOptions(g,region) {
  return DEPLOYABLE.map(id=>{
    const meta=PLATFORMS[id]||BLACK_PROGRAMS[id];
    const owned=ownedUnits(g,id), deployed=deployedTotal(g,id);
    const here=g.forceDeployments?.[region]?.[id]||0,free=Math.max(0,owned-deployed);
    return {id,name:meta.n,owned,here,free,reason:free?crewBlock(g,id):'No free units. Build or recall this platform.'};
  }).filter(o=>o.owned||o.here);
}
