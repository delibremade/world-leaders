// The map, force inventory and action gate share the same owned packages and trained personnel.
import { BLACK_PROGRAMS } from '../data/platforms.js';
import { UNIT_PLATFORMS } from '../data/orbat.js';
import { FLEET_PACKAGES, deploymentIds, unitMeta } from '../data/deployment-catalog.js';
import { crewBlock, crewStatus, effectiveForces, buyLine } from './forces.js';
export function ownedUnits(g,pid,force){
  const pkg=FLEET_PACKAGES[pid];
  if(!pkg)return BLACK_PROGRAMS[pid]?(+g.blackPrograms?.[pid]||0):((g.platforms?.[pid]||0)+(g.platformsImported?.[pid]||0));
  if(pkg.nid!==g.country?.id||!g.forces)return 0;
  const f=force||effectiveForces(g),line=f.fleet?.[pkg.line];if(!line)return 0;
  // Purchases have their own package IDs. Count the surviving starting fleet once.
  const additions=Object.entries(f.fielded||{}).reduce((n,[id,k])=>n+(buyLine(f.nid,id)?.id===pkg.line?k*(UNIT_PLATFORMS[id]?.per||0):0),0);
  return Math.floor(Math.max(0,Math.min(pkg.initial,line.n-additions))/pkg.per);
}
export const deployedTotal=(g,pid)=>Object.values(g.forceDeployments||{}).reduce((a,o)=>a+(o?.[pid]||0),0);
export function deploymentOptions(g,region) {
  const f=effectiveForces(g),crews=crewStatus(g,f);
  return deploymentIds(g.country?.id).map(id=>{
    const meta=unitMeta(id),owned=ownedUnits(g,id,f),deployed=deployedTotal(g,id);
    const here=g.forceDeployments?.[region]?.[id]||0,free=Math.max(0,owned-deployed);
    return {id,name:meta.n,owned,here,free,source:FLEET_PACKAGES[id]?'Starting fleet':'Procurement',reason:free?crewBlock(g,id,crews,f):'No free units. Build or recall this platform.'};
  }).filter(o=>o.owned||o.here);
}
