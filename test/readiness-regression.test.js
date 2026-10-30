import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './util/headless-month.js';
import { crewStatus, crewBlock } from '../src/sim/forces.js';
import { deploymentOptions } from '../src/sim/deployment-view.js';
import { mineralView } from '../src/sim/minerals.js';
import { fleetFill } from '../src/sim/formulas.js';

test('starting US forces can deploy and recall existing hulls without purchasing a second navy', () => {
  const h=game(811), g=h.g;
  const options=deploymentOptions(g,'EA');
  const carrier=options.find(o=>o.id.startsWith('fleet:') && /carrier/i.test(o.name));
  assert.ok(carrier,'starting carriers visible on the map');
  assert.equal(carrier.reason,null);
  h.act({type:'deployUnit',payload:{region:'EA',unit:carrier.id}});
  assert.equal(g.forceDeployments.EA[carrier.id],1);
  h.act({type:'recallUnit',payload:{region:'EA',unit:carrier.id}});
  assert.equal(g.forceDeployments.EA?.[carrier.id]||0,0);
  assert.equal(crewStatus(g).sea.gap,0);
});

test('crew readiness and deployment share actual fleet personnel; old crew-set saves migrate', () => {
  const h=game(812),g=h.g;
  g.platforms.carrier_group=7;
  assert.equal(crewStatus(g).sea.crews,Math.floor(g.forces.crews.sea));
  assert.ok(crewStatus(g).sea.crews>90000);
  assert.equal(crewBlock(g,'carrier_group'),null);
  assert.equal(fleetFill(g.forces).fill.sea,1);
  delete g.forces.crewVersion; g.forces.crews={land:6,air:6,sea:6};
  assert.equal(crewBlock(g,'carrier_group'),null,'old abstract pool does not override real manning');
  g.forces.crewVersion=2;g.forces.crews.sea=0;
  assert.match(crewBlock(g,'carrier_group'),/crew/i,'genuine staff shortage still blocks');
});

test('home territory cannot receive or expire a foreign regional insurgency', () => {
  const h=game(813),g=h.g;g.gracePeriod=999;
  g.flashpoint={rid:'NA',type:'insurgency',t:1};
  h.step();
  assert.equal(g.flashpoint,null);
  assert.ok(!g.log.some(x=>/North America flashpoint ignored/.test(x.msg)));
  assert.ok(!h.toasts.some(x=>/rivals filled the vacuum/.test(x)));
});

test('F/A-XX development is enforced by the action, then production and deployment work', () => {
  const h=game(814),g=h.g;g.stats.treasury=1000000;g.gracePeriod=999;
  for(const k of Object.keys(g.defLevels))g.defLevels[k]=7;
  h.act({type:'buildPlatform',payload:{platform:'fa_xx'}});
  assert.equal(g.platforms.fa_xx||0,0,'cannot skip first article development');
  h.act({type:'developPlatform',payload:{platform:'fa_xx'}});
  assert.equal(g.platformDev.fa_xx.mo,24);
  const cash=g.stats.treasury;
  h.act({type:'developPlatform',payload:{platform:'fa_xx'}});
  assert.equal(g.stats.treasury,cash,'cannot pay twice to reset development');
  for(let i=0;i<24;i++){g.stats.treasury=1000000;h.step();}
  assert.ok(g.developed.has('fa_xx'));
  for(const o of Object.values(g.minerals.own))o.stock=100;
  h.act({type:'buildPlatform',payload:{platform:'fa_xx'}});
  assert.equal(g.platforms.fa_xx,1);
  h.act({type:'deployUnit',payload:{region:'EA',unit:'fa_xx'}});
  assert.equal(g.forceDeployments.EA?.fa_xx,1);
});

test('trade comparison exposes smaller suppliers and shows the same restrictions as signing', () => {
  const h=game(815),g=h.g;
  const rows=mineralView(g), candidates=rows.filter(r=>r.partners.length>2);
  assert.ok(candidates.length,'supplier list is not silently truncated to two');
  const r=candidates[0],p=r.partners[0];
  g.nationRelations[p.id]=-100;
  const blocked=mineralView(g).find(x=>x.id===r.id).partners.find(x=>x.id===p.id);
  assert.match(blocked.reason,/relations/i);
  h.act({type:'signOfftake',payload:{mineral:r.id,nation:p.id}});
  assert.equal(g.minerals.deals.length,0);
  g.nationRelations[p.id]=60;
  const willing=mineralView(g).find(x=>x.id===r.id).partners.find(x=>x.id===p.id);
  assert.equal(willing.reason,null);
  h.act({type:'signOfftake',payload:{mineral:r.id,nation:p.id}});
  assert.equal(g.minerals.deals[0].price,willing.price);
});

test('starting hull orders honor readiness and protect assembled packages through recall until disbanded',()=>{
 const h=game(816),g=h.g,id='fleet:usa:cvn',initial=g.forces.fleet.cvn.n;
 try{
  const carrier=deploymentOptions(g,'EA').find(x=>x.id===id);
  assert.equal(carrier.ready,7,'mission-capable hulls determine deployable strength');
  assert.equal(carrier.reserved,1,'the existing carrier strike group already owns one hull');
  assert.equal(carrier.free,6);
  for(let i=0;i<initial+2;i++)h.act({type:'deployUnit',payload:{region:'EA',unit:id}});
  assert.equal(g.forceDeployments.EA[id],carrier.free,'extra orders cannot deploy maintenance or reserved hulls');
  assert.equal(g.forces.fleet.cvn.at.EA,carrier.free);
  assert.equal(g.forces.fleet.cvn.at.NA,initial-carrier.free,'the assembled home carrier and maintenance hulls remain at home');
  assert.equal(deploymentOptions(g,'EA').find(x=>x.id===id).free,0);

  const maintenance=initial-carrier.ready;
  h.act({type:'retire',payload:{line:'cvn',n:maintenance+1}});
  assert.equal(g.forces.fleet.cvn.n,initial,'a bulk retirement cannot consume any reserved home or deployed hull');
  h.act({type:'retire',payload:{line:'cvn',n:maintenance}});
  assert.equal(g.forces.fleet.cvn.n,carrier.ready,'unreserved maintenance hulls may retire');
  assert.equal(g.forces.fleet.cvn.at.EA,carrier.free,'retirement does not remove stationed hulls');
  assert.equal(g.forces.fleet.cvn.at.NA,carrier.reserved,'the home formation remains physically present');
  h.act({type:'retire',payload:{line:'cvn',n:1}});
  assert.equal(g.forces.fleet.cvn.n,carrier.ready,'all remaining hulls are reserved');

  h.act({type:'recallUnit',payload:{region:'EA',unit:id}});
  assert.equal(g.forces.fleet.cvn.at.NA,carrier.reserved+1);
  assert.equal(g.forceDeployments.EA[id],carrier.free-1);
  const recalled=g.forces.packages.find(p=>p.template==='detachment'&&!p.region&&p.members[id]);
  assert.ok(recalled,'recall returns the same assembled detachment home');
  h.act({type:'retire',payload:{line:'cvn',n:1}});
  assert.equal(g.forces.fleet.cvn.n,carrier.ready,'recall retains the reservation until the package is disbanded');
  h.act({type:'disbandForcePackage',payload:{package:recalled.id}});
  assert.ok(!g.forces.packages.some(p=>p.id===recalled.id));
  h.act({type:'retire',payload:{line:'cvn',n:1}});
  assert.equal(g.forces.fleet.cvn.n,carrier.ready-1);
  assert.equal(g.forceDeployments.EA[id],carrier.free-1,'disbanding and retiring the home detachment leave deployed packages intact');
  assert.equal(deploymentOptions(g,'EA').find(x=>x.id===id).free,0);
  h.act({type:'deployUnit',payload:{region:'EA',unit:'fleet:china:cv'}});
  assert.equal(g.forceDeployments.EA?.['fleet:china:cv']||0,0,'foreign inventory is never available');
 }finally{h.done();}
});

test('funded training scales to new fleets, closes a real shortage, and stops when unfunded',()=>{
 const h=game(817),g=h.g;g.stats.treasury=1000000;g.gracePeriod=999;g.platforms.carrier_group=7;
 const gap=crewStatus(g).sea.gap;assert.ok(gap>0);
 h.act({type:'setTraining',payload:{level:3}});g.personnelPay=200;
 for(let i=0;i<36;i++){g.stats.treasury=1000000;h.step();}
 assert.equal(crewStatus(g).sea.gap,0,'no fixed 24-set cap');
 assert.ok(g.forces.crews.sea>120000);
 g.forces.pipe=[];g.forces.crews.sea=0;h.act({type:'setTraining',payload:{level:0}});
 for(let i=0;i<16;i++)h.step();
 assert.equal(g.forces.crews.sea,0);assert.ok(crewBlock(g,'carrier_group'));
});

test('foreign flashpoint rule applies to every playable home theater and preserves foreign contests',async()=>{
 const {COUNTRIES}=await import('../src/data/nations.js');const {REGIONS}=await import('../src/data/regions.js');
 const {foreignFlashpoint,flashpointEligible}=await import('../src/sim/flashpoints.js');
 for(const country of COUNTRIES){
  const g={country,sphere:Object.fromEntries(Object.keys(REGIONS).map(r=>[r,{player:50}]))};
  for(const [rid,r] of Object.entries(REGIONS)){
   const fp={rid,type:'insurgency',t:3},home=r.homeFor?.includes(country.id);
   assert.equal(flashpointEligible(g,rid),!home);
   assert.equal(foreignFlashpoint(fp,country.id),home?null:fp);
  }
 }
});
