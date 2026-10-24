// Shared order gate and assessment: Situation, Intel and the command handler read the same rules.
import {INTEL_OPS} from '../data/intel.js';
import {INTEL_TARGETS, NATIONS} from '../data/nations.js';
import {DV} from '../data/platforms.js';
import {REGIONS} from '../data/regions.js';
import {opOdds, opOddsTerms} from './selectors.js';
import {intelPlan} from './forces.js';
import {sumDep} from './formulas.js';

export function intelResolutionOdds(g,order){
 const odds=opOdds(g,order),rid=NATIONS[order.targetId]?.region;
 const support=(g.embassyMissions?.[order.targetId]==='intel'?0.12:0)+(rid&&g.forcePosture?.[rid]==='isr'&&sumDep(g.forceDeployments?.[rid])>0?0.25:0);
 return {...odds,support,successRate:Math.min(.95,odds.successRate+support)};
}
export function intelOrder(g,opId,targetId,{cost:quotedCost}={}){
 const op=INTEL_OPS.find(o=>o.id===opId);if(!op)return {block:'Unknown operation',cost:0};
 const defensive=op.type==='defensive',cost=quotedCost??Math.round(op.cost*(g.doctrine==='shadow'?.75:1));
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
 return {op,target,cost,block,plan,odds,resolution,defensive,effect:intelOutcome(g,opId,target)};
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
