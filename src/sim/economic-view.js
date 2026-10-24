import {ECONOMIC_SECTORS} from '../data/economic-hubs.js';
import {SECTOR_LABELS} from '../data/economy.js';
import {calcSCost} from './formulas.js';
import {energySituation} from './energy-view.js';

// Read-only bridge to existing national systems. Never allocate aggregate output to cities.
const route=(label,tab,extra={})=>({label,jump:{tab,...extra}});
export function economicSectorView(g,id){
  const def=ECONOMIC_SECTORS[id]||ECONOMIC_SECTORS.services,s=g.stats||{},e=energySituation(g);
  const score=k=>Number.isFinite(s[k])?`${Math.round(s[k])}/100`:'—';
  const metrics={
    technology:[['Education',score('education')],['IP portfolio',Math.round(g.ipPortfolio||0).toLocaleString('en-US')]],
    industry:[['Power tier',e.tier],['Material-delayed orders',String(g.minerals?.queue?.length||0)]],
    food:[['Food security',score('foodSecurity')],['Food assistance',g.socialPrograms?.has('food_assistance')?'Active':'Off']],
    energy:[['Power tier',e.tier],['Import bill',`$${e.imports}M/mo`]],
    materials:[['Processing projects',String(Object.keys(g.minerals?.proj||{}).length)],['Material-delayed orders',String(g.minerals?.queue?.length||0)]],
    trade:[['Trade agreements',String(g.tradeAgreements?.size||0)],['Import routes disrupted',String(e.routes.filter(r=>r.status==='disrupted').length)]],
    services:[['Healthcare',score('healthcare')],['Education',score('education')]],
  };
  const routes={
    technology:[route('Research & IP policy','technology'),route('Materials & suppliers','resources',{sub:'deals'})],
    industry:[route('Processing investment','resources',{sub:'processing'}),route('Energy & supply','energy'),route('Industrial research','technology')],
    food:[route('Food support & social programs','economy'),route('Trade agreements','trade')],
    energy:[route('Generation, reserves & imports','energy'),route('Extraction & resources','resources',{sub:'natural'})],
    materials:[route('Processing investment','resources',{sub:'processing'}),route('Supplier contracts','resources',{sub:'deals'})],
    trade:[route('Trade agreements & diplomacy','trade'),route('Mineral supplier contracts','resources',{sub:'deals'}),route('Import routes & reserves','energy')],
    services:[route('Public services & tax policy','economy'),route('Research & education','technology')],
  };
  return {...def,id,scope:'National',metrics:(metrics[id]||metrics.services).map(([label,value])=>({label,value})),routes:routes[id]||routes.services,
    budgets:def.budgets.map(sector=>({sector,label:SECTOR_LABELS[sector],value:g.budgetAlloc?.[sector]??100,cost:calcSCost(sector,g.budgetAlloc?.[sector]??100,g.sectorMaturity)}))};
}
