// Persistent task organization over the existing inventory. Components remain owned once;
// forceDeployments is the compatibility projection consumed by existing theater effects.
import {REGIONS,POSTURE_LABELS} from '../data/regions.js';
import {WORLD_EVENTS} from '../data/world.js';
import {CHOKEPOINTS} from '../data/chokepoints.js';
import {deploymentIds,unitMeta} from '../data/deployment-catalog.js';
import {PACKAGE_TEMPLATES,templatesFor,templateCandidates} from '../data/force-package-templates.js';
import {unitProfile,servicesFor,serviceMeta} from '../data/services.js';
import {effectiveForces,stationInventory,unitCrew,crewStatus,crewBlock} from './forces.js';
import {ownedUnits,deploymentAvailabilityBase} from './force-inventory.js';
import {theaterWeight,navalWeight} from './formulas.js';

const positive=n=>Number.isInteger(n)&&n>0;
const total=members=>Object.values(members||{}).reduce((n,k)=>n+k,0);
const copy=p=>({...p,members:{...p.members},plannedMembers:{...(p.plannedMembers||p.members)},requiredMembers:{...(p.requiredMembers||p.plannedMembers||p.members)}});
const ordered=packages=>packages.map((p,i)=>({p,i})).sort((a,b)=>Number(!!b.p.region)-Number(!!a.p.region)||a.i-b.i).map(x=>x.p);
const cost=(p,region=p.region,posture=p.posture)=>region?total(p.members)*(4+(posture==='humanitarian'?30:0)):0;
const idFor=n=>`pkg:${n}`;
export const ESCORT_REQUIRED=2;
const escortEffect=(rid,strength)=>`Combined mission-ready escort strength in ${REGIONS[rid]?.n||rid}: ${Math.round(strength*100)/100} / ${ESCORT_REQUIRED} before local basing support. Additional escort packages combine; protection depends on the lane's disruption and basing.`;
const requiredFrom=coverage=>{const out={};for(const slot of coverage)if(slot.required)for(const x of slot.picked)out[x.id]=(out[x.id]||0)+x.count;return out;};
const supports=(caps,mission)=>!['isr','escort','humanitarian'].includes(mission)||caps.includes(mission)||(mission==='isr'&&caps.includes('maritime_isr'));
const capabilitiesFor=(nid,members)=>{
 const roles=new Set(Object.keys(members).map(id=>unitProfile(nid,id).role)),out=[];
 if([...roles].some(r=>['isr','awacs','ew','mpa','space'].includes(r)))out.push('isr');
 if([...roles].some(r=>['ssn','ssgn','ssk'].includes(r)))out.push('maritime_isr');
 if([...roles].some(r=>['carrier','destroyer','cruiser','frigate','corvette','lcs','ssn','ssgn','ssk','mpa'].includes(r)))out.push('escort');
 if([...roles].some(r=>['airlift','helo','amphib','infantry','battalion','stryker','armor'].includes(r)))out.push('humanitarian');
 return out;
};
function missionsFor(nid,p){
 const listed=PACKAGE_TEMPLATES[p.template]?.missions||Object.keys(POSTURE_LABELS),caps=capabilitiesFor(nid,p.members);
 return listed.filter(m=>supports(caps,m));
}
export function packageDeployments(packages){
 const out={};for(const p of packages||[]){if(!p.region||!REGIONS[p.region])continue;
  for(const [id,n]of Object.entries(p.members||{})){if(!positive(n))continue;out[p.region]||={};out[p.region][id]=(out[p.region][id]||0)+n;}}
 return out;
}
const reservations=(packages,exclude)=>{const out={};for(const p of packages)if(p.id!==exclude)for(const [id,n]of Object.entries(p.members))out[id]=(out[id]||0)+n;return out;};
function stock(g,f){
 return Object.fromEntries(deploymentIds(g.country.id).map(id=>[id,{id,name:unitMeta(id)?.n||id,...unitProfile(g.country.id,id),...deploymentAvailabilityBase(g,id,f)}]));
}
function assembly(g,f,packages,template,inventory=stock(g,f),preferred={}){
 const t=PACKAGE_TEMPLATES[template],slots=templateCandidates(g.country.id,template),used=reservations(packages),members={},missing=[],coverage=[];
 if(!t)return {block:'Unknown force-package template',members,coverage};
 for(const slot of slots){let need=slot.count;const picked=[];
  const candidates=[...slot.candidates].sort((a,b)=>Number(!!preferred[b])-Number(!!preferred[a]));
  for(const id of candidates){const x=inventory[id];if(!x)continue;const free=Math.max(0,Math.min(x.owned,x.ready)-(used[id]||0));const n=Math.min(need,free);
   if(n){members[id]=(members[id]||0)+n;used[id]=(used[id]||0)+n;picked.push({id,count:n});need-=n;}if(!need)break;}
  coverage.push({id:slot.id,name:slot.name,required:slot.required,count:slot.count,filled:slot.count-need,picked});
  if(slot.required&&need)missing.push(`${slot.name}: ${slot.count-need}/${slot.count} available`);
 }
 return {block:missing.length?`Needs ${missing.join('; ')}`:null,members,coverage};
}
function makePackage(g,n,template,members,name,extra={}){
 const t=PACKAGE_TEMPLATES[template],profiles=Object.keys(members).map(id=>unitProfile(g.country.id,id)),owners=[...new Set(profiles.map(p=>p.service))];
 const service=template==='detachment'&&owners.length===1?owners[0]:t?.service||'joint';
 return {id:idFor(n),name:(typeof name==='string'&&name.trim()?name.trim().slice(0,80):`${t?.name||'Force package'} ${n}`),service,template,members:{...members},plannedMembers:{...members},requiredMembers:{...members},region:null,posture:t?.defaultMission||'deter',...extra};
}
// Lazy deterministic migration: old assignments are retained before any optional new formation.
// Existing saves do not need a new top-level field; the organization travels with forces.
export function packageState(g){
 const f=effectiveForces(g);if(f.packageVersion===1&&Array.isArray(f.packages))return f;
 const packages=[];let nextPackageId=1;
 for(const [region,units]of Object.entries(g.forceDeployments||{}))for(const [id,n]of Object.entries(units||{}))if(positive(n)){
  packages.push(makePackage(g,nextPackageId++,'detachment',{[id]:n},`${unitMeta(id)?.n||id} · ${REGIONS[region]?.n||region}`,{region,posture:g.forcePosture?.[region]||'deter',legacy:true}));
 }
 // Defaults organize the starting order of battle only. Equipment the player has
 // just purchased remains free until explicitly assembled into a package.
 const inventory=Object.fromEntries(Object.entries(stock(g,f)).filter(([id])=>id.startsWith('fleet:')));
 for(const t of templatesFor(g.country.id).filter(t=>t.initial)){
  const a=assembly(g,f,packages,t.id,inventory);if(!a.block&&total(a.members))packages.push(makePackage(g,nextPackageId++,t.id,a.members,undefined,{requiredMembers:requiredFrom(a.coverage)}));
 }
 return {...f,packageVersion:1,nextPackageId,packages};
}
export const packageReservations=(g,{excludePackage}={})=>reservations(packageState(g).packages,excludePackage);

// Reconcile genuine physical losses only. Planned composition stays visible for reinforcement;
// a maintenance/readiness dip does not delete aircraft, ships or personnel.
export function reconcilePackages(g){
 const f=packageState(g),left=Object.fromEntries(deploymentIds(g.country.id).map(id=>[id,ownedUnits(g,id,f)])),changed=new Map();
 for(const p of ordered(f.packages)){const members={};for(const [id,n]of Object.entries(p.members)){const have=Math.min(n,Math.max(0,left[id]||0));if(have)members[id]=have;left[id]=(left[id]||0)-have;}
  if(JSON.stringify(members)!==JSON.stringify(p.members))changed.set(p.id,{...copy(p),members});}
 if(!changed.size)return f;
 return {...f,packages:f.packages.map(p=>changed.get(p.id)||p)};
}
function persist(g,S,f){
 g.forces=f;S.setForces(f);g.forceDeployments=packageDeployments(f.packages);S.setForceDeployments(g.forceDeployments);stationInventory(g,S);
 return g.forces;
}
export function initializePackages(g,S){
 if(g.forces?.packageVersion===1)return g.forces;
 return persist(g,S,packageState(g));
}
export const syncPackages=(g,S)=>persist(g,S,reconcilePackages(g));

function packageRows(g,f,inventory){
 const left=Object.fromEntries(Object.entries(inventory).map(([id,x])=>[id,x.readyPlatforms])),physical=Object.fromEntries(Object.entries(inventory).map(([id,x])=>[id,x.platforms])),rows=new Map();
 for(const p of ordered(f.packages)){
  const planned=p.plannedMembers||p.members,mandatory=p.requiredMembers||planned,ids=[...new Set([...Object.keys(planned),...Object.keys(p.members)])];
  const components=ids.map(id=>{const x=inventory[id]||{id,name:unitMeta(id)?.n||id,per:1,owned:0,readyPlatforms:0,...unitProfile(g.country.id,id)},count=p.members[id]||0,required=planned[id]||count,platforms=Math.min(count*x.per,Math.max(0,physical[id]||0));
   physical[id]=(physical[id]||0)-platforms;
   const readyPlatforms=Math.min(platforms,Math.max(0,left[id]||0));left[id]=(left[id]||0)-readyPlatforms;
   const readyUnits=Math.min(count,Math.ceil(readyPlatforms/x.per));
   return {id,name:x.name,service:x.service,role:x.role,count,required,mandatory:mandatory[id]||0,optional:!(mandatory[id]>0),per:x.per,platforms,readyPlatforms,readyUnits,readiness:platforms?readyPlatforms/platforms:0,owned:x.owned,note:x.note||''};
  });
  const missing=components.filter(c=>c.count<c.mandatory),unready=components.filter(c=>c.readyUnits<Math.min(c.count,c.mandatory));
  const capabilities=capabilitiesFor(g.country.id,Object.fromEntries(components.filter(c=>c.readyUnits>0).map(c=>[c.id,c.readyUnits])));
  const block=!components.length||!total(p.members)?'No components assigned':missing.length?`Missing ${missing.map(c=>`${c.name} ${c.count}/${c.mandatory}`).join('; ')}`:unready.length?`Not mission-ready: ${unready.map(c=>`${c.name} ${c.readyPlatforms}/${c.platforms} ready`).join('; ')}`:p.region&&!supports(capabilities,p.posture)?`No mission-ready capability for ${POSTURE_LABELS[p.posture]||p.posture}`:null;
  const warnings=components.filter(c=>c.count<c.required||c.readyUnits<c.count).map(c=>`${c.name}: ${c.readyPlatforms}/${c.required*c.per} planned platforms ready${c.optional?' (optional support)':''}`);
  // Average component coverage avoids a single large infantry headcount hiding an unavailable hull.
  const readiness=components.length?components.reduce((n,c)=>n+(c.required?c.readyPlatforms/(c.required*c.per):0),0)/components.length:0;
  const t=PACKAGE_TEMPLATES[p.template];
  rows.set(p.id,{...p,components,ready:!block,block,warnings,readiness,missions:missionsFor(g.country.id,p),capabilities,costMonthly:cost(p),monthlyCost:cost(p),
   status:block?'Needs attention':p.region?'Assigned':readiness<.999?'Reduced strength':'Available',description:t?.description||'Existing assigned units',serviceName:serviceMeta(g.country.id,p.service)?.name||p.service});
 }
 const result=f.packages.map(p=>rows.get(p.id)),strengths=strengthsOf(result);
 return result.map(p=>p.region&&p.posture==='escort'?{...p,escortStrength:navalWeight(strengths[p.region]?.escort),escortRequired:ESCORT_REQUIRED,missionEffects:[escortEffect(p.region,navalWeight(strengths[p.region]?.escort))]}:{...p,missionEffects:[]});
}
export function packageView(g){
 const f=packageState(g),inventory=stock(g,f),packages=packageRows(g,f,inventory),reserved=reservations(f.packages);
 const templates=templatesFor(g.country.id).map(t=>{const a=assembly(g,f,f.packages,t.id,inventory),remaining=[...f.packages];let available=0;
  // Capped display count; exact eligibility is always rechecked for the requested one assembly.
  if(!a.block){for(let n=0;n<99;n++){const next=assembly(g,f,remaining,t.id,inventory);if(next.block||!total(next.members))break;available++;remaining.push({id:`preview:${n}`,members:next.members});}}
  return {...t,block:a.block,available,components:Object.entries(a.members).map(([id,count])=>({...inventory[id],count,platforms:count*inventory[id].per})),coverage:a.coverage};});
 return {packages,templates,services:servicesFor(g.country.id),inventory:Object.values(inventory).filter(x=>x.owned||reserved[x.id]).map(x=>({...x,reserved:reserved[x.id]||0,free:Math.max(0,Math.min(x.owned,x.ready)-(reserved[x.id]||0))})),
  summary:{total:packages.length,ready:packages.filter(p=>p.ready&&!p.region).length,assigned:packages.filter(p=>p.region).length,attention:packages.filter(p=>p.block).length,costMonthly:packages.reduce((n,p)=>n+p.costMonthly,0)}};
}
export function missionDeployments(g,rid,posture){
 const f=packageState(g);return packageDeployments(f.packages.filter(p=>p.region===rid&&p.posture===posture))[rid]||{};
}
// Fractional effective components carry actual mission-ready strength into existing formulas.
// This is a readout, never a fractional inventory or a second deployment reservation.
function strengthsOf(rows){
 const out={};
 for(const p of rows)if(p.ready&&p.region)for(const c of p.components)if(c.readyPlatforms>0){out[p.region]||={};out[p.region][p.posture]||={};const units=out[p.region][p.posture];units[c.id]=(units[c.id]||0)+c.readyPlatforms/c.per;}
 return out;
}
export function missionStrengths(g){
 const f=packageState(g);return strengthsOf(packageRows(g,f,stock(g,f)));
}
// The monthly simulation and regional readouts share the same mission-specific
// rates. Application gates (grace, sphere saturation, rival presence) stay with tick.
export function regionalMissionEffects(g,rid,strength=missionStrengths(g)){
 const missions=strength[rid]||{},counts=Object.fromEntries(Object.entries(missions).map(([post,units])=>[post,total(units)]));
 const weights=Object.fromEntries(Object.entries(missions).map(([post,units])=>[post,theaterWeight({...g,forceDeployments:{[rid]:units}},rid)]));
 const emergency=!!(g.flashpoint?.rid===rid||(g.worldEvent&&WORLD_EVENTS[g.worldEvent.id]?.choke&&CHOKEPOINTS[WORLD_EVENTS[g.worldEvent.id].choke]?.region===rid));
 const gain=Object.entries(counts).reduce((n,[post,count])=>n+count*(post==='deter'?0.12:post==='humanitarian'?(emergency?0.2:0.04):0.06),0);
 return {counts,total:total(counts),weights,emergency,influence:Math.min(0.6,gain),suppression:Math.min(0.5,((weights.deter||0)+(weights.isr||0)*0.5)*0.08),sr72Bonus:(missions.isr?.sr72||0)>0?0.04:0};
}
export function missionReadyDeployments(g,rid,posture){
 const missions=missionStrengths(g)[rid]||{};if(posture)return missions[posture]||{};
 const out={};for(const units of Object.values(missions))for(const [id,n]of Object.entries(units))out[id]=(out[id]||0)+n;return out;
}
export function missionCapability(g,rid,posture){
 const units=missionReadyDeployments(g,rid,posture);return theaterWeight({...g,forces:packageState(g),forceDeployments:{[rid]:units}},rid);
}
export function packageSupport(g,rid,capability='isr'){
 const f=packageState(g),rows=packageRows(g,f,stock(g,f)),posture=capability==='maritime_isr'?'isr':capability;
 return rows.filter(p=>p.region===rid&&p.posture===posture&&p.ready&&p.capabilities.includes(capability)).map(p=>({id:p.id,name:p.name,service:p.service,capabilities:p.capabilities,ready:p.ready,readiness:p.readiness,region:p.region,posture:p.posture}));
}
function crewReason(g,f,p,region){
 if(!region)return null;
 const others=f.packages.filter(x=>x.id!==p.id),view={...g,forces:f,forceDeployments:packageDeployments(others)},status=crewStatus(view,f),need={};
 for(const [id,n]of Object.entries(p.members)){const c=unitCrew(view,id,f);need[c.b]=(need[c.b]||0)+c.n*n;}
 for(const [branch,n]of Object.entries(need))if(n>(status[branch]?.free||0))return `Not enough trained ${branch} personnel: ${status[branch]?.free||0}/${n} free. Recall assigned forces or inspect training.`;
 return null;
}
const alias={assemble:'assembleForcePackage',assign:'assignForcePackage',recall:'recallForcePackage',disband:'disbandForcePackage',posture:'setForcePackagePosture',reinforce:'reinforceForcePackage',rotate:'rotateForcePackage'};
export function packageOrder(g,type,payload={}){
 type=alias[type]||type;
 const f=packageState(g),inventory=stock(g,f),packages=f.packages.map(copy),id=payload.package||payload.packageId,p=packages.find(x=>x.id===id),before=packages.reduce((n,x)=>n+cost(x),0);
 let nextPackageId=f.nextPackageId||1,block=null,title='',focus=p,lines=[];
 const reject=reason=>({block:reason,costMonthly:p?cost(p):0,costDelta:0,title:'Order unavailable',lines:[reason],package:p||null});
 const add=(template,members,name,extra)=>{const row=makePackage(g,nextPackageId++,template,members,name,extra);packages.push(row);focus=row;return row;};
 const validate=(row,region,posture)=>{
  if(!REGIONS[region])return 'Choose a destination theater';if(!POSTURE_LABELS[posture])return 'Choose a valid mission';
  if(!missionsFor(g.country.id,row).includes(posture))return 'This package lacks the capability for that mission';
  // New assignments join after existing commitments, before the home reserve. Persisting
  // that order keeps a later assignment from taking readiness already supporting a mission.
  if(!row.region){packages.splice(packages.indexOf(row),1);packages.push(row);}
  const prospective=packages.map(x=>x.id===row.id?{...x,region,posture}:x);
  const rowView=packageRows(g,{...f,packages:prospective},inventory).find(x=>x.id===row.id);return rowView?.block||crewReason(g,{...f,packages:prospective},row,region);
 };
 if(type==='assembleForcePackage'){
  const t=PACKAGE_TEMPLATES[payload.template];if(!t)return reject('Choose a force-package template');
  const a=assembly(g,f,packages,t.id,inventory);if(a.block)return reject(a.block);
  add(t.id,a.members,payload.name,{requiredMembers:requiredFrom(a.coverage)});title=`Assemble ${focus.name}`;lines=['Reserves existing equipment. Crew availability is checked before assignment. No equipment is purchased or created.'];
 }else if(type==='deployAsset'){
  const unit=payload.unit,x=inventory[unit],n=payload.count??1;if(!x||!positive(n))return reject('Choose an existing unit and a positive whole quantity');
  const trained=x.owned?crewBlock(g,unit,undefined,f):null;if(trained)return reject(trained);
  const home=packages.find(row=>!row.region&&(row.template==='detachment'||row.legacy)&&Object.keys(row.members).length===1&&row.members[unit]===n&&row.plannedMembers[unit]===n);
  const used=reservations(packages),free=Math.max(0,Math.min(x.owned,x.ready)-(used[unit]||0));
  if(!home&&free<n)return reject(`No free mission-ready ${x.name}: ${free}/${n} available. Inspect package assignments, recall or disband an unassigned package.`);
  const row=home||add('detachment',{[unit]:n},payload.name||x.name);focus=row;const posture=payload.posture||g.forcePosture?.[payload.region]||row.posture||'deter';
  block=validate(row,payload.region,posture);if(block)return reject(block);row.region=payload.region;row.posture=posture;title=`Assign ${row.name}`;
 }else if(type==='recallAsset'){
  const n=payload.count??1;if(!positive(n))return reject('Recall quantity must be a positive whole number');
  const rows=packages.filter(x=>x.region===payload.region&&x.members[payload.unit]);
  const detachable=rows.filter(x=>Object.keys(x.members).length===1&&(x.template==='detachment'||x.legacy));
  if(detachable.reduce((a,x)=>a+x.members[payload.unit],0)<n)return reject(rows.length?'This unit belongs to a force package. Recall the complete package.':'No matching assigned units');
  let left=n;for(const row of detachable){if(!left)break;const take=Math.min(left,row.members[payload.unit]);if(take===row.members[payload.unit])row.region=null;
   else{row.members[payload.unit]-=take;row.plannedMembers[payload.unit]-=take;row.requiredMembers[payload.unit]-=take;add('detachment',{[payload.unit]:take},row.name);}left-=take;focus=row;}
  title='Recall detachment';
 }else{
  if(!p)return reject('Choose a force package');
  if(type==='assignForcePackage'){
   const posture=payload.posture||p.posture||'deter';block=validate(p,payload.region,posture);if(block)return reject(block);
   p.region=payload.region;p.posture=posture;title=`${f.packages.find(x=>x.id===p.id)?.region?'Transfer':'Assign'} ${p.name}`;
  }else if(type==='recallForcePackage'){if(!p.region)return reject('This package is already at home');p.region=null;title=`Recall ${p.name}`;
  }else if(type==='setForcePackagePosture'){
   if(!POSTURE_LABELS[payload.posture]||!missionsFor(g.country.id,p).includes(payload.posture))return reject('This package lacks the capability for that mission');
   if(p.region){block=validate(p,p.region,payload.posture);if(block)return reject(block);}p.posture=payload.posture;title=`Change ${p.name} mission`;
  }else if(type==='disbandForcePackage'){
   if(p.region)return reject('Recall this package before disbanding it');packages.splice(packages.indexOf(p),1);title=`Disband ${p.name}`;lines=['Returns the existing components to unassigned inventory. Nothing is retired.'];
  }else if(type==='reinforceForcePackage'){
   const used=reservations(packages,p.id),planned=p.plannedMembers||p.members;let changed=false;
   for(const [unit,n]of Object.entries(planned))if(n>(p.members[unit]||0))changed=true;
   if(!changed)return reject('The package already has its planned components');
   if(p.template!=='detachment'&&PACKAGE_TEMPLATES[p.template]){
    const a=assembly(g,f,packages.filter(x=>x.id!==p.id),p.template,inventory,p.members);if(a.block)return reject(a.block);
    p.members={...a.members};p.plannedMembers={...a.members};p.requiredMembers=requiredFrom(a.coverage);lines.push('Compatible owned replacements fill the template. Existing components are preferred; no automatic purchase.');
   }else{
    for(const [unit,n]of Object.entries(planned)){const x=inventory[unit],free=Math.max(0,Math.min(x?.owned||0,x?.ready||0)-(used[unit]||0));if(free<n)return reject(`${x?.name||unit}: ${free}/${n} mission-ready units available for this package`);}p.members={...planned};
   }
   if(p.region){block=validate(p,p.region,p.posture);if(block)return reject(block);}title=`Reinforce ${p.name}`;
  }else if(type==='rotateForcePackage'){
   const r=packages.find(x=>x.id===payload.replacement);if(!p.region)return reject('Choose an assigned package to rotate');if(!r||r.id===p.id)return reject('Choose a replacement package');if(r.region)return reject('The replacement is already assigned');
   if(r.template!==p.template&&r.service!==p.service)return reject('Choose a compatible replacement from the same service or formation type');
   const destination=p.region,posture=p.posture;p.region=null;block=validate(r,destination,posture);if(block)return reject(block);r.region=destination;r.posture=posture;focus=r;title=`Rotate ${p.name}`;lines=[`${r.name} takes over in ${REGIONS[destination].n}. ${p.name} returns home in the same order.`];
  }else return reject('Unknown package order');
 }
 const after=packages.reduce((n,x)=>n+cost(x),0),nextForces={...f,packageVersion:1,nextPackageId,packages};
 if(focus?.region)lines.push(`${REGIONS[focus.region].n} · ${POSTURE_LABELS[focus.posture]}. Orders apply to this package only.`);
 if(focus?.region&&focus.posture==='escort')lines.push(escortEffect(focus.region,navalWeight(strengthsOf(packageRows(g,nextForces,inventory))[focus.region]?.escort)));
 lines.push(`Forward basing and mission cost: $${focus?cost(focus):0}M/month. Existing national maintenance and payroll are unchanged.`);
 return {block:null,title,lines,package:focus,costMonthly:focus?cost(focus):0,costDelta:after-before,nextForces,nextDeployments:packageDeployments(packages)};
}
const execute=(type)=>(g,S,fx,payload)=>{const q=packageOrder(g,type,payload);if(q.block){fx.toast(`⚠ ${q.block}`);return false;}persist(g,S,q.nextForces);fx.toast(q.title);return true;};
export const PACKAGE_VERBS=Object.fromEntries(['assembleForcePackage','assignForcePackage','recallForcePackage','setForcePackagePosture','disbandForcePackage','reinforceForcePackage','rotateForcePackage','deployAsset','recallAsset'].map(type=>[type,execute(type)]));
export const PUBLIC_PACKAGE_VERBS=Object.fromEntries(['assembleForcePackage','assignForcePackage','recallForcePackage','disbandForcePackage','reinforceForcePackage','rotateForcePackage'].map(type=>[type,PACKAGE_VERBS[type]]));
