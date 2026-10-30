// Energy security read model. The import bill is shared with the monthly tick, including discount order.
import { ENERGY_SECURITY as E } from '../data/energy.js';
import { REGIONS } from '../data/regions.js';
import { CHOKEPOINTS, IMPORT_ROUTES } from '../data/chokepoints.js';
import { NATION_TRAITS } from '../data/nations.js';
import { isDiversified, navalWeight, getEnergyTier } from './formulas.js';
import { chokeWeight, laneCut } from './reach.js';
import { missionStrengths } from './force-packages.js';
export const energyRoutes=g=>IMPORT_ROUTES[Object.entries(REGIONS).find(([,r])=>r.homeFor?.includes(g.country?.id))?.[0]]||[];
export const hasFossilImports=g=>['oil','gas','coal'].some(k=>g.importContracts?.has(k));
export function importCost(g,{myRoutes=energyRoutes(g),cs=g.chokeStatus||{},sprShield=!!g.sprRelease&&g.spr>0,routeHit=hasFossilImports(g)&&myRoutes.some(k=>cs[k]==='disrupted')}={}) {
  if(!g.importContracts?.size)return 0;
  const bloc=g.blocTrade||{};
  const blocCut=(bloc.eu>=1?.9:1)*(bloc.cn>=1?.85:1);
  const secured=myRoutes.length&&myRoutes.every(k=>cs[k]==='secured'||cs[k]==='escorted');
  let cost=g.importContracts.size*E.contractCost*(g.dominanceLeverage?.importCut||1)*blocCut*(routeHit&&!sprShield?1.5:1)*(secured?.9-laneCut(g,myRoutes):1)*(g.embargoedBy&&!isDiversified(g)&&!sprShield?1.3:1);
  if(Object.keys(g.stewardship||{}).length&&g.importContracts.has('oil'))cost-=40;
  if(g.chokeDeals?.panama?.priority&&myRoutes.includes('panama'))cost*=.85;
  if(bloc.opec>=1){let foss=0;['oil','gas','coal'].forEach(k=>{if(g.importContracts.has(k))foss++;});cost-=foss*16;}
  return Math.round(Math.max(0,cost));
}
// General sea presence can secure an open route. A disruption additionally needs
// an actual ready escort on station; bases support that mission but cannot sail it.
// Passing a shared mission snapshot keeps tick and multi-route UI reads inexpensive.
export function routeProtection(g,id,strength=missionStrengths(g)){
  const missions=strength[CHOKEPOINTS[id]?.region]||{},bases=chokeWeight(g,id);
  const naval=Object.values(missions).reduce((n,units)=>n+navalWeight(units),0),escortNaval=navalWeight(missions.escort);
  const weight=naval+bases,escortWeight=escortNaval+bases;
  return {naval,bases,weight,escortNaval,escortWeight,canEscort:escortNaval>0&&escortWeight>=2,missions:Object.keys(missions)};
}
export const protectionWeight=(g,id)=>routeProtection(g,id).weight;
export const escortProtectionWeight=(g,id)=>routeProtection(g,id).escortWeight;
export function energySituation(g) {
  const ids=energyRoutes(g),cs=g.chokeStatus||{},strength=missionStrengths(g);
  const routes=ids.map(id=>({id,...CHOKEPOINTS[id],status:cs[id]||'open',...routeProtection(g,id,strength)}));
  const exposed=hasFossilImports(g)&&routes.some(r=>r.status==='disrupted');
  const shield=!!g.sprRelease&&g.spr>0;
  const imports=importCost(g),unprotected=importCost(g,{sprShield:false}),protectedBill=importCost(g,{sprShield:true});
  return {routes,exposed,shield,imports,unprotected,protectedBill,releaseSavings:Math.max(0,unprotected-protectedBill),
    tier:getEnergyTier(g.resources||{},g.resExtraction||{},g.importContracts||new Set()),
    reserve:g.spr||0,canFill:(g.spr||0)<E.reserveCapacity&&(g.stats?.treasury||0)>=E.reserveCost,
    inflation:exposed&&!shield?E.routeInflation:0,growth:exposed&&!shield?E.routeGrowth:0,
    dependency:NATION_TRAITS[g.country?.id]?.energyDep||0,
  };
}
