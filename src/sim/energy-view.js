// Energy security read model. The import bill is shared with the monthly tick, including discount order.
import { REGIONS } from '../data/regions.js';
import { CHOKEPOINTS, IMPORT_ROUTES } from '../data/chokepoints.js';
import { NATION_TRAITS } from '../data/nations.js';
import { isDiversified, navalWeight, getEnergyTier } from './formulas.js';
import { chokeWeight, laneCut } from './reach.js';
export const energyRoutes=g=>IMPORT_ROUTES[Object.entries(REGIONS).find(([,r])=>r.homeFor?.includes(g.country?.id))?.[0]]||[];
export const hasFossilImports=g=>['oil','gas','coal'].some(k=>g.importContracts?.has(k));
export function importCost(g,{myRoutes=energyRoutes(g),cs=g.chokeStatus||{},sprShield=!!g.sprRelease&&g.spr>0,routeHit=hasFossilImports(g)&&myRoutes.some(k=>cs[k]==='disrupted')}={}) {
  if(!g.importContracts?.size)return 0;
  const bloc=g.blocTrade||{};
  const blocCut=(bloc.eu>=1?.9:1)*(bloc.cn>=1?.85:1);
  const secured=myRoutes.length&&myRoutes.every(k=>cs[k]==='secured'||cs[k]==='escorted');
  let cost=g.importContracts.size*80*(g.dominanceLeverage?.importCut||1)*blocCut*(routeHit&&!sprShield?1.5:1)*(secured?.9-laneCut(g,myRoutes):1)*(g.embargoedBy&&!isDiversified(g)&&!sprShield?1.3:1);
  if(Object.keys(g.stewardship||{}).length&&g.importContracts.has('oil'))cost-=40;
  if(g.chokeDeals?.panama?.priority&&myRoutes.includes('panama'))cost*=.85;
  if(bloc.opec>=1){let foss=0;['oil','gas','coal'].forEach(k=>{if(g.importContracts.has(k))foss++;});cost-=foss*16;}
  return Math.round(Math.max(0,cost));
}
export function energySituation(g) {
  const ids=energyRoutes(g),cs=g.chokeStatus||{};
  const routes=ids.map(id=>{const cp=CHOKEPOINTS[id],naval=navalWeight(g.forceDeployments?.[cp.region]),bases=chokeWeight(g,id);return {id,...cp,status:cs[id]||'open',naval,bases,weight:naval+bases,posture:g.forcePosture?.[cp.region]||'deter'};});
  const exposed=hasFossilImports(g)&&routes.some(r=>r.status==='disrupted');
  const shield=!!g.sprRelease&&g.spr>0;
  const imports=importCost(g),unprotected=importCost(g,{sprShield:false}),protectedBill=importCost(g,{sprShield:true});
  return {routes,exposed,shield,imports,unprotected,protectedBill,releaseSavings:Math.max(0,unprotected-protectedBill),
    tier:getEnergyTier(g.resources||{},g.resExtraction||{},g.importContracts||new Set()),
    reserve:g.spr||0,canFill:(g.spr||0)<6&&(g.stats?.treasury||0)>=200,
    inflation:exposed&&!shield?.1:0,growth:exposed&&!shield?-.02:0,
    dependency:NATION_TRAITS[g.country?.id]?.energyDep||0,
  };
}
