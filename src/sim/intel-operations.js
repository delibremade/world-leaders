// Shared order gate and assessment: Situation, Intel and the command handler read the same rules.
import {INTEL_OPS} from '../data/intel.js';
import {INTEL_TARGETS, NATIONS} from '../data/nations.js';
import {DV} from '../data/platforms.js';
import {REGIONS} from '../data/regions.js';
import {opOdds, opOddsTerms} from './selectors.js';
import {intelPlan,effectiveForces} from './forces.js';
import {sofUnit} from '../data/sof.js';
import {sofService,serviceLabel} from '../data/services.js';
import {intelligenceServices,intelServiceFor,infrastructureService} from '../data/intelligence-services.js';
import {packageSupport} from './force-packages.js';

// One bill per launch. Standing orders pay the full operation cost plus the automation
// premium, including the doctrine discount, when a new cycle actually starts.
export function intelCycleCost(g,opId,{standing=false}={}){
 const op=INTEL_OPS.find(o=>o.id===opId);if(!op)return 0;
 return Math.round(op.cost*(g.doctrine==='shadow'?.75:1)*(standing?1.6:1));
}
export function intelStandingOrder(g,opId,targetId){
 const op=INTEL_OPS.find(o=>o.id===opId);
 const block=!op||op.type!=='covert'?'Standing orders require a foreign covert mission':!INTEL_TARGETS.some(t=>t.id===targetId)||targetId===g.country?.id?'Choose a foreign intelligence target':null;
 return {op,target:targetId,cost:intelCycleCost(g,opId,{standing:true}),months:op?.mo||0,block};
}
export function intelSupport(g,targetId){
 if(!NATIONS[targetId]||targetId===g.country?.id)return [];
 const rid=NATIONS[targetId]?.region,support=[];
 if(g.embassyMissions?.[targetId]==='intel')support.push({id:`embassy:${targetId}`,name:`${NATIONS[targetId]?.n||targetId} intelligence liaison`,kind:'embassy',bonus:.12,jump:{tab:'trade',nation:targetId}});
 const packages=rid?packageSupport(g,rid,'isr'):[];
 if(packages.length)support.push({id:`isr:${rid}`,name:packages.map(p=>`${p.name} · ${serviceLabel(g.country?.id,p.service)}`).join(', '),kind:'packages',bonus:.25,packages:packages.map(p=>p.id),jump:{tab:'forces',sub:'deployments',region:rid}});
 return support;
}
const commitment=(nid,u,operators,k,months,recovery)=>({unit:u.id,name:u.n,service:sofService(nid,u.id),serviceLabel:serviceLabel(nid,sofService(nid,u.id)),operators:Math.round(operators),subunits:k,subunit:u.sub,months,recovery});
export function intelCommitments(g,order){
 const f=effectiveForces(g),nid=g.country?.id||f.nid;
 return Object.entries(f.sof?.units||{}).flatMap(([id,s])=>{
  const u=sofUnit(nid,id),out=s.out.filter(o=>o.op===order.opId&&o.tgt===order.targetId&&o.mo>0);
  return u&&out.length?[commitment(nid,u,s.ops*out.length/u.subs,out.length,Math.max(...out.map(o=>o.mo)),Math.max(...out.map(o=>o.rec)))]:[];
 });
}
export function intelRecovery(g){
 const f=effectiveForces(g),nid=g.country?.id||f.nid;
 return Object.entries(f.sof?.units||{}).flatMap(([id,s])=>{
  const u=sofUnit(nid,id);if(!u)return [];
  const returns=new Map();for(const o of s.out)if(o.mo===0&&o.rec>0)returns.set(o.rec,(returns.get(o.rec)||0)+1);
  return [...returns].sort((a,b)=>a[0]-b[0]).map(([months,count])=>commitment(nid,u,s.ops*count/u.subs,count,0,months));
 });
}
export function intelServicesView(g){
 const infra=g.intelInfra||{};
 return intelligenceServices(g.country?.id).map(a=>({...a,facilities:Object.entries(infra).filter(([id,n])=>n>0&&infrastructureService(g.country?.id,id)?.id===a.id).map(([id,count])=>({id,count}))}));
}

export function intelResolutionOdds(g,order){
 const odds=opOdds(g,order),supportSources=order.opId==='counter_int'?[]:intelSupport(g,order.targetId);
 const support=supportSources.reduce((n,s)=>n+s.bonus,0);
 return {...odds,support,supportSources,successRate:Math.min(.95,odds.successRate+support)};
}
export function intelOrder(g,opId,targetId,{cost:quotedCost}={}){
 const op=INTEL_OPS.find(o=>o.id===opId);if(!op)return {block:'Unknown operation',cost:0};
 const defensive=op.type==='defensive',cost=quotedCost??intelCycleCost(g,opId);
 const target=defensive?g.country.id:targetId;
 let block=null;
 if(!defensive&&(!INTEL_TARGETS.some(t=>t.id===target)||target===g.country.id))block='Choose a foreign intelligence target';
 else if(g.intelOps.some(o=>o.opId===opId&&(defensive||o.targetId===target)))block=defensive?'A national sweep is already active':'This operation is already underway against this target';
 else if(opId==='sabotage'&&!(g.intelInfra.paramilitary>0))block='Requires Special Activities Wing';
 else if(opId==='mole'&&(g.intelInfra.overseas_stations||0)<3)block='Requires 3+ Overseas Stations';
 const plan=intelPlan(g,op);
 if(!block&&plan&&!plan.picks.length)block='No Tier 2 element free — deployed or recovering';
 if(!block&&g.stats.treasury<cost)block='Insufficient treasury';
 const odds=opOddsTerms(g,opId),resolution=intelResolutionOdds(g,{opId,targetId:target,...odds});
 const commitments=(plan?.picks||[]).map(p=>commitment(g.country.id,sofUnit(g.country.id,p.u),p.ops,p.k,plan.mo,plan.rec));
 const remedy=block&&/Special Activities|Overseas Stations/.test(block)?{label:'Agency infrastructure',jump:{tab:'intel',target}}:block&&/Tier 2/.test(block)?{label:'Special forces & recovery',jump:{tab:'forces',sub:'specialized'}}:block==='Insufficient treasury'?{label:'Budget & treasury',jump:{tab:'economy'}}:null;
 return {op,target,cost,block,plan,odds,resolution,defensive,commitments,remedy,lead:intelServiceFor(g.country.id,opId),standing:intelStandingOrder(g,opId,target),effect:intelOutcome(g,opId,target)};
}
export function intelOutcome(g,id,target){
 const amp=g.intelInfra.paramilitary?1.5:1;
 if(id==='counter_int')return 'National interception chance +25 percentage points while the sweep is active (overall cap 95%). Coverage starts immediately and lasts 24 months.';
 if(id==='tech_acq'){
  const tech=Object.keys(DV).reduce((b,v)=>{const gap=(g.globalDef[target]?.[v]||0)-(g.defLevels[v]||0);return gap>b.gap?{v,gap}:b;},{v:Object.keys(DV)[0],gap:-99});
  return `On success: +40 percentage points of research discount (cap 60%). Current target: ${DV[tech.v].n}, chosen by the largest research gap at completion.`;
 }
 if(id==='destab')return `On success: their regional influence −${Math.round(20*amp)} and yours +${Math.round(9*amp)} in every theater where their influence exceeds 5.`;
 if(id==='influence')return `On success: your influence +10 and theirs −6 in ${REGIONS[NATIONS[target]?.region]?.n||'the target region'}. This changes diplomatic alignment.`;
 if(id==='sabotage')return 'On success: their leading research vertical loses 0.8 levels. A Tier 2 element is committed for the operation and recovery.';
 if(id==='mole')return 'On success: their research freezes and their influence pushback is halved for 24 months.';
 if(id==='econ_war'){const a=g.intelInfra.crypt_center?1.5:1;return `On success: your treasury +$${Math.round(130*a)}M/month and GDP growth +${(.12*a).toFixed(2)} points/month for 6 months.`;}
 return '';
}
export const RESPONSE_POSTURES=[
 {id:'quiet',name:'Quiet exploitation',text:'On interception: 30% chance to turn an asset for 12 months; otherwise plant disinformation that burns their next attempt. No tension increase.'},
 {id:'expose',name:'Public exposure',text:'On interception: their strongest regional influence −2. Tension +3 at relations 60+, otherwise +8.'},
 {id:'expel',name:'Expel the station',text:'On interception: block that country’s operations for 24 months. Tension +5.'},
];
