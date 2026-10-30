// Shared inventory/readiness accounting for equipment, packages and command gates.
// A hull is indivisible. Air and ground formations may deploy at reduced strength.
import {ORBAT,UNIT_PLATFORMS} from '../data/orbat.js';
import {FLEET_PACKAGES} from '../data/deployment-catalog.js';
import {effectiveForces,buyLine,readyCount} from './forces.js';

const count=n=>Number.isFinite(+n)?Math.max(0,Math.floor(+n)):0;
const purchased=(g,id)=>count(g.platforms?.[id])+count(g.platformsImported?.[id])+count(g.blackPrograms?.[id]);
export function inventoryLine(g,pid,f=effectiveForces(g)){
  const pkg=FLEET_PACKAGES[pid];
  const line=pkg?buyLineForPackage(f,pkg):buyLine(f.nid,pid);
  return {line:line||null,per:pkg?.per||UNIT_PLATFORMS[pid]?.per||1};
}
const buyLineForPackage=(f,pkg)=>pkg.nid===f.nid?(ORBAT[f.nid]||[]).find(l=>l.id===pkg.line):null;

// Largest-remainder allocation conserves whole platforms, even when several purchase
// IDs feed the same ORBAT line. Stable tie breaking makes save/reload deterministic.
function apportion(rows,budget){
  const total=rows.reduce((n,r)=>n+r.physical,0);budget=Math.min(total,count(budget));
  if(!total)return {};
  let used=0;
  rows=rows.map(r=>{const exact=budget*r.physical/total,allocated=Math.floor(exact);used+=allocated;return {...r,allocated,remainder:exact-allocated};});
  rows.sort((a,b)=>b.remainder-a.remainder||a.id.localeCompare(b.id));
  for(const r of rows){if(used>=budget)break;if(r.allocated<r.physical){r.allocated++;used++;}}
  return Object.fromEntries(rows.map(r=>[r.id,r.allocated]));
}
function physicalAllocation(line,f){
  const physical=count(f.fleet?.[line.id]?.n);
  // fielded is a procurement manifest, not proof that every purchased platform
  // survived. Include nondeployable purchases too: they share this same stock.
  const claims=Object.entries(f.fielded||{}).filter(([id,n])=>count(n)>0&&UNIT_PLATFORMS[id]&&buyLine(f.nid,id)?.id===line.id)
    .map(([id,n])=>({id,physical:count(n)*UNIT_PLATFORMS[id].per}));
  const additions=claims.reduce((n,r)=>n+r.physical,0),alloc=apportion(claims,physical);
  // Loss attribution was never tracked per purchase. Preserve the existing rule:
  // purchases claim surviving stock first, and the starting fleet gets the rest.
  // This also lets a real new delivery replace a completely lost starting fleet.
  const baseline=Math.min(line.count,Math.max(0,physical-additions));
  if(baseline)alloc[`fleet:${f.nid}:${line.id}`]=baseline;
  const unrepresented=physical-Object.values(alloc).reduce((n,k)=>n+k,0);
  if(unrepresented>0)alloc['unrepresented:stock']=unrepresented;
  return alloc;
}
// Includes starting lines without a deployable alias (for example strategic forces).
// Retirement uses the same physical allocation as deployment, never raw manifests.
export function linePhysicalInventory(g,line,force){
  const f=force||effectiveForces(g),l=typeof line==='string'?(ORBAT[f.nid]||[]).find(x=>x.id===line):line;
  if(!l)return {platforms:0,starting:0,allocations:{}};
  const allocations=physicalAllocation(l,f);
  return {platforms:count(f.fleet?.[l.id]?.n),starting:allocations[`fleet:${f.nid}:${l.id}`]||0,allocations};
}
function inventory(g,pid,f){
  const pkg=FLEET_PACKAGES[pid],{line,per}=inventoryLine(g,pid,f);
  if(pkg&&pkg.nid!==g.country?.id)return {line:null,per,platforms:0,allocation:{}};
  const allocation=line?physicalAllocation(line,f):null;
  const platforms=line?(allocation[pid]||0):pkg?0:purchased(g,pid)*per;
  return {line,per,platforms,allocation};
}
export function ownedUnits(g,pid,force){
  const x=inventory(g,pid,force||effectiveForces(g));
  // A batch survives at reduced strength; its physical count remains the authority.
  // This also retains a surviving submarine in a nominal two-submarine purchase.
  return Math.ceil(x.platforms/x.per);
}
export function deploymentAvailabilityBase(g,pid,force){
  const f=force||effectiveForces(g),{line,per,platforms,allocation}=inventory(g,pid,f),owned=Math.ceil(platforms/per);
  const physical=line?(apportion(Object.entries(allocation).map(([id,n])=>({id,physical:n})),readyCount(f,line))[pid]||0):platforms;
  const ready=Math.min(owned,Math.ceil(physical/per));
  return {owned,ready,readyPlatforms:physical,platforms,per,readiness:platforms?physical/platforms:0,maintenance:Math.max(0,owned-ready),line:line?.id||null};
}
export const readyUnits=(g,pid,f)=>deploymentAvailabilityBase(g,pid,f).ready;
