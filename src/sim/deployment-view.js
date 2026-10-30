// Every deployment surface reads the same physical inventory and package reservations.
import { FLEET_PACKAGES, deploymentIds, unitMeta } from '../data/deployment-catalog.js';
import { crewBlock, crewStatus } from './forces.js';
import { deploymentAvailabilityBase } from './force-inventory.js';
import { packageState, packageReservations, packageDeployments } from './force-packages.js';
export { ownedUnits } from './force-inventory.js';
export const deployedTotal=(g,pid)=>Object.values(g.forceDeployments||{}).reduce((a,o)=>a+(o?.[pid]||0),0);
export function deploymentOptions(g,region) {
  const f=packageState(g),reserved=packageReservations({...g,forces:f}),deployments=packageDeployments(f.packages),view={...g,forces:f,forceDeployments:deployments},crews=crewStatus(view,f);
  return deploymentIds(g.country?.id).map(id=>{
    const meta=unitMeta(id),availability=deploymentAvailabilityBase(g,id,f),{owned,ready}=availability;
    const home=f.packages.filter(p=>!p.region&&(p.template==='detachment'||p.legacy)&&Object.keys(p.members).length===1&&p.members[id]===1&&(p.plannedMembers?.[id]||p.members[id])===1).length;
    const reusable=Math.min(home,Math.max(0,ready-Math.max(0,(reserved[id]||0)-home)));
    const here=deployments[region]?.[id]||0,free=Math.max(0,Math.min(owned,ready)-(reserved[id]||0))+reusable;
    const assigned=f.packages.filter(p=>p.region===region&&p.members[id]);
    const recallable=assigned.filter(p=>Object.keys(p.members).length===1&&(p.template==='detachment'||p.legacy)).reduce((n,p)=>n+p.members[id],0);
    const reason=free?crewBlock(view,id,crews,f):!ready?'No mission-ready units. Inspect fleet maintenance and trained personnel.':reserved[id]?'Reserved in force packages. Assign the package or disband an unassigned package to release its assets.':'No free units. Build or recall this platform.';
    return {id,name:meta.n,...availability,owned,here,free,reserved:reserved[id]||0,recallable,recallReason:here>recallable?'This asset belongs to a force package. Recall the complete package.':null,packages:assigned.map(p=>({id:p.id,name:p.name})),source:FLEET_PACKAGES[id]?'Starting fleet':'Procurement',reason};
  }).filter(o=>o.owned||o.here);
}
