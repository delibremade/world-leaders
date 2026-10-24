// Operational packages drawn from the real starting order of battle. Existing equipment never aliases a future program.
import { ORBAT, crewHeads } from './orbat.js';
import { PLATFORMS, BLACK_PROGRAMS, DEPLOYABLE } from './platforms.js';
const perOf=l=>l.cls==='airframe'?Math.min(l.count,l.role==='fighter'?24:12):1;
export const FLEET_PACKAGES=Object.fromEntries(Object.entries(ORBAT).flatMap(([nid,ls])=>ls.filter(l=>l.count>0&&!l.reserve&&!['icbm','ssbn'].includes(l.role)).map(l=>{
  const per=perOf(l),id=`fleet:${nid}:${l.id}`;
  const weight=l.role==='carrier'?1.5:l.role==='ssn'||l.role==='ssgn'?1:l.b==='sea'?0.5:1;
  return [id,{id,nid,line:l.id,n:`${l.n} · ${per} ${l.cls==='airframe'?'aircraft':l.cls==='hull'?'hull':'formation'}${per>1&&l.cls!=='airframe'?'s':''}`,b:l.b,i:l.b==='air'?'✈️':l.b==='sea'?'🚢':'🪖',per,heads:Math.ceil(crewHeads(l,per)),weight,naval:l.b==='sea'?weight:0,initial:l.count}];
})));
export const unitMeta=id=>FLEET_PACKAGES[id]||PLATFORMS[id]||BLACK_PROGRAMS[id];
export const canStation=(nid,id)=>DEPLOYABLE.includes(id)||FLEET_PACKAGES[id]?.nid===nid;
export const deploymentIds=nid=>[...DEPLOYABLE,...Object.keys(FLEET_PACKAGES).filter(id=>FLEET_PACKAGES[id].nid===nid)];
