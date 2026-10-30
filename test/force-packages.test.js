import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newCampaign,STATE_FIELDS} from '../src/sim/state.js';
import {COUNTRIES} from '../src/data/nations.js';
import {ownedUnits} from '../src/sim/force-inventory.js';
import {packageState,packageView,packageOrder,PACKAGE_VERBS,packageDeployments,packageReservations,missionDeployments,missionReadyDeployments,missionCapability,regionalMissionEffects,packageSupport,reconcilePackages,initializePackages} from '../src/sim/force-packages.js';
import {theaterWeight} from '../src/sim/formulas.js';

const fresh=(id='usa')=>newCampaign(COUNTRIES.find(c=>c.id===id));
const harness=g=>({g,S:new Proxy({},{get:(_,name)=>value=>{const key=name[3].toLowerCase()+name.slice(4);if(STATE_FIELDS.includes(key))g[key]=typeof value==='function'?value(g[key]):value;}}),fx:{toast:()=>{}}});
const run=(h,type,payload)=>PACKAGE_VERBS[type](h.g,h.S,h.fx,payload);
const materialize=g=>{g.forces=packageState(g);g.forceDeployments=packageDeployments(g.forces.packages);return g;};

test('package defaults are deterministic, preserve actual stock and crews, and reserve no component twice',()=>{
 for(const c of COUNTRIES){
  const g=fresh(c.id),before=structuredClone(g),f=packageState(g);
  assert.deepEqual(g,before,'read-only selector');assert.deepEqual(f,packageState(g));
  const r=packageReservations({...g,forces:f});
  for(const [id,n]of Object.entries(r))assert.ok(n<=ownedUnits(g,id),`${c.id} ${id} ${n}`);
  assert.deepEqual(f.crews,g.forces.crews);assert.deepEqual(f.fleet,g.forces.fleet);
  assert.deepEqual(packageDeployments(f.packages),{});
 }
 const g=fresh(),v=packageView(g);
 for(const t of ['carrier_strike','air_expeditionary','ground_task_force'])assert.ok(v.packages.some(p=>p.template===t),t);
 assert.ok(v.packages.find(p=>p.template==='carrier_strike').components.length>=3,'carrier includes assigned aviation and escorts');
});

test('legacy assignments migrate losslessly with their theater mission, never inventing a second inventory',()=>{
 const g=fresh();g.forceDeployments={EA:{'fleet:usa:cvn':1,'fleet:usa:fa18ef':2},WE:{'fleet:usa:ddg':2}};g.forcePosture={EA:'deter',WE:'escort'};
 const f=packageState(g);assert.deepEqual(packageDeployments(f.packages),g.forceDeployments);
 const old=f.packages.filter(p=>p.legacy);assert.equal(old.length,3);assert.ok(old.filter(p=>p.region==='WE').every(p=>p.posture==='escort'));
 const saved=JSON.parse(JSON.stringify(f));assert.deepEqual(packageState({...g,forces:saved}).packages,saved.packages);
});

test('a legacy save with a retired deployed asset migrates its missing plan without reserving nonexistent stock',()=>{
 const g=fresh();
 // The old decommission path could remove ownership while leaving the raw
 // deployment ledger behind. A valid submarine assignment must survive beside it.
 g.platforms={...g.platforms,carrier_group:0,sub_fleet:1};
 g.forceDeployments={EA:{carrier_group:1,sub_fleet:1}};g.forcePosture={EA:'escort'};
 const before=structuredClone(g),f=packageState(g),missing=f.packages.find(p=>p.plannedMembers.carrier_group);
 assert.deepEqual(missing.members,{});assert.equal(missing.plannedMembers.carrier_group,1);assert.equal(missing.requiredMembers.carrier_group,1);
 assert.equal(missing.region,'EA');assert.equal(missing.posture,'escort');
 assert.deepEqual(packageDeployments(f.packages),{EA:{sub_fleet:1}});
 assert.equal(packageReservations(g).carrier_group||0,0);
 const row=packageView(g).packages.find(p=>p.id===missing.id);assert.equal(row.ready,false);assert.equal(row.components[0].count,0);
 const quote=packageOrder(g,'recallForcePackage',{package:missing.id});assert.equal(quote.block,null);assert.deepEqual(quote.nextDeployments,{EA:{sub_fleet:1}});
 assert.equal(quote.nextForces.packages.find(p=>p.id===missing.id).plannedMembers.carrier_group,1);
 assert.deepEqual(g,before,'migration, view and order quote remain pure');
 const h=harness(g);initializePackages(g,h.S);
 assert.deepEqual(g.forceDeployments,{EA:{sub_fleet:1}});assert.equal(packageReservations(g).carrier_group||0,0);
 assert.equal(g.forces.packages.find(p=>p.id===missing.id).plannedMembers.carrier_group,1);
});

test('assign, transfer, independent posture and recall use one atomic package order',()=>{
 const h=harness(materialize(fresh())),p=h.g.forces.packages.find(p=>p.template==='carrier_strike'),a=h.g.forces.packages.find(p=>p.template==='air_expeditionary');
 const before=structuredClone(h.g),q=packageOrder(h.g,'assignForcePackage',{package:p.id,region:'ME',posture:'escort'});
 assert.equal(q.block,null);assert.ok(q.costMonthly>0);assert.deepEqual(h.g,before);
 run(h,'assignForcePackage',{package:p.id,region:'ME',posture:'escort'});
 run(h,'assignForcePackage',{package:a.id,region:'ME',posture:'exercise'});
 assert.ok(Object.keys(missionDeployments(h.g,'ME','escort')).length>0);
 assert.ok(Object.keys(missionDeployments(h.g,'ME','exercise')).length>0);
 assert.equal(h.g.forces.packages.find(x=>x.id===p.id).posture,'escort');
 run(h,'assignForcePackage',{package:p.id,region:'EA',posture:'deter'});
 assert.equal(h.g.forceDeployments.ME?.['fleet:usa:cvn']||0,0);assert.equal(h.g.forceDeployments.EA['fleet:usa:cvn'],1);
 run(h,'recallForcePackage',{package:p.id});assert.equal(h.g.forceDeployments.EA,undefined);
 assert.deepEqual(h.g.forceDeployments,packageDeployments(h.g.forces.packages));
});

test('zero mission capability blocks deployment and assembly with no partial assignment',()=>{
 const h=harness(materialize(fresh())),p=h.g.forces.packages.find(p=>p.template==='carrier_strike');
 h.g.forces.fleet.cvn={...h.g.forces.fleet.cvn,mc:0};const before=structuredClone(h.g);
 const q=packageOrder(h.g,'assignForcePackage',{package:p.id,region:'EA',posture:'deter'});
 assert.match(q.block,/ready|maintenance|capable/i);
 run(h,'assignForcePackage',{package:p.id,region:'EA',posture:'deter'});assert.deepEqual(h.g,before);
 assert.ok(packageOrder(h.g,'assembleForcePackage',{template:'carrier_strike'}).block);
});

test('raw orders cannot reuse a reserved package component and committed groups cannot disband',()=>{
 const h=harness(materialize(fresh()));const p=h.g.forces.packages.find(p=>p.template==='carrier_strike');
 run(h,'assignForcePackage',{package:p.id,region:'EA',posture:'escort'});
 const q=packageOrder(h.g,'disbandForcePackage',{package:p.id});assert.match(q.block,/recall/i);
 const reserved=packageReservations(h.g);
 for(const [id,n]of Object.entries(reserved))if(n>=ownedUnits(h.g,id))assert.ok(packageOrder(h.g,'deployAsset',{unit:id,region:'WE'}).block);
});

test('rotation transfers one mission to a ready replacement without double assignment',()=>{
 const h=harness(materialize(fresh()));
 run(h,'assembleForcePackage',{template:'surface_escort',name:'Relief escorts'});
 const list=h.g.forces.packages.filter(p=>p.template==='surface_escort');assert.ok(list.length>=2);
 const [p,r]=list;run(h,'assignForcePackage',{package:p.id,region:'ME',posture:'escort'});
 const totals=structuredClone(h.g.forceDeployments),q=packageOrder(h.g,'rotateForcePackage',{package:p.id,replacement:r.id});assert.equal(q.block,null);
 run(h,'rotateForcePackage',{package:p.id,replacement:r.id});
 assert.equal(h.g.forces.packages.find(x=>x.id===p.id).region,null);
 assert.equal(h.g.forces.packages.find(x=>x.id===r.id).region,'ME');
 assert.equal(h.g.forces.packages.find(x=>x.id===r.id).posture,'escort');assert.deepEqual(h.g.forceDeployments,totals);
});

test('physical losses preserve the package requirement and show a real replacement shortage',()=>{
 const h=harness(materialize(fresh())),p=h.g.forces.packages.find(p=>p.template==='carrier_strike');
 run(h,'assignForcePackage',{package:p.id,region:'ME',posture:'escort'});
 h.g.forces.fleet.cvn={...h.g.forces.fleet.cvn,n:0,at:{}};
 const next=reconcilePackages(h.g);h.g.forces=next;h.g.forceDeployments=packageDeployments(next.packages);
 const lost=h.g.forces.packages.find(x=>x.id===p.id);assert.equal(lost.members['fleet:usa:cvn']||0,0);assert.equal(lost.plannedMembers['fleet:usa:cvn'],1);
 assert.ok(packageView(h.g).packages.find(x=>x.id===p.id).block);assert.ok(packageOrder(h.g,'reinforceForcePackage',{package:p.id}).block);
});

test('intelligence support requires an assigned capable package and an ISR mission',()=>{
 const g=fresh();g.forces={...g.forces,packageVersion:1,nextPackageId:2,packages:[{id:'pkg:1',name:'Reconnaissance',template:'detachment',service:'air_force',members:{'fleet:usa:rq4':1},plannedMembers:{'fleet:usa:rq4':1},region:'EA',posture:'isr'}]};g.forceDeployments=packageDeployments(g.forces.packages);
 assert.equal(packageSupport(g,'EA','isr').length,1);
 g.forces.packages[0].posture='exercise';assert.equal(packageSupport(g,'EA','isr').length,0);
 g.forces.packages[0].posture='isr';g.forces.fleet.rq4.mc=0;assert.equal(packageSupport(g,'EA','isr').length,0);
});

test('a purchased compatible component can replace a lost starting component without multiplying inventory',()=>{
 const h=harness(materialize(fresh())),p=h.g.forces.packages.find(p=>p.template==='carrier_strike');
 h.g.forces.fleet.cvn={...h.g.forces.fleet.cvn,n:0,at:{}};
 h.g.forces=reconcilePackages(h.g);h.g.forceDeployments=packageDeployments(h.g.forces.packages);
 h.g.blackPrograms={...h.g.blackPrograms,ford:1};
 const q=packageOrder(h.g,'reinforceForcePackage',{package:p.id});assert.equal(q.block,null);
 run(h,'reinforceForcePackage',{package:p.id});const repaired=h.g.forces.packages.find(x=>x.id===p.id);
 assert.equal(repaired.members.ford,1);assert.equal(repaired.members['fleet:usa:cvn'],undefined);
 assert.equal(ownedUnits(h.g,'ford'),1);assert.equal(h.g.forces.fleet.cvn.n,1);
});

test('an assigned package loses operational effects at zero MC without deleting its inventory',()=>{
 const g=fresh();g.forces={...g.forces,packageVersion:1,nextPackageId:2,packages:[{id:'pkg:1',name:'Reconnaissance',template:'detachment',service:'air_force',members:{'fleet:usa:rq4':1},plannedMembers:{'fleet:usa:rq4':1},region:'EA',posture:'isr'}]};g.forceDeployments=packageDeployments(g.forces.packages);
 assert.ok(missionCapability(g,'EA','isr')>0);assert.ok(missionReadyDeployments(g,'EA','isr')['fleet:usa:rq4']>0);
 g.forces.fleet.rq4.mc=0;assert.equal(missionCapability(g,'EA','isr'),0);assert.deepEqual(missionReadyDeployments(g,'EA','isr'),{});
 assert.equal(g.forceDeployments.EA['fleet:usa:rq4'],1);assert.equal(g.forces.fleet.rq4.n,20);
});

test('optional support losses reduce coverage without blocking a functioning core formation',()=>{
 const h=harness(materialize(fresh())),p=h.g.forces.packages.find(p=>p.template==='air_expeditionary');
 h.g.forces.fleet.kc135.mc=0;h.g.forces.fleet.c17.mc=0;
 const v=packageView(h.g).packages.find(x=>x.id===p.id);
 assert.equal(v.ready,true);assert.ok(v.readiness<1);assert.ok(v.warnings.some(w=>w.includes('optional support')));
 assert.equal(v.components.find(c=>c.id==='fleet:usa:kc135').optional,true);
 assert.equal(packageOrder(h.g,'assignForcePackage',{package:p.id,region:'EA',posture:'deter'}).block,null);
 run(h,'assignForcePackage',{package:p.id,region:'EA',posture:'deter'});
 assert.ok(missionCapability(h.g,'EA','deter')>0);
});

test('mission-critical optional support must be ready for ISR, and an impaired ISR mission can switch to deterrence',()=>{
 const h=harness(materialize(fresh())),p=h.g.forces.packages.find(p=>p.template==='air_expeditionary');
 assert.equal(run(h,'assignForcePackage',{package:p.id,region:'EA',posture:'isr'}),true);
 assert.equal(packageSupport(h.g,'EA','isr').length,1);
 h.g.forces.fleet.e3.mc=0;
 assert.equal(packageSupport(h.g,'EA','isr').length,0);assert.equal(missionCapability(h.g,'EA','isr'),0);
 assert.match(packageView(h.g).packages.find(x=>x.id===p.id).block,/capability/i);
 assert.equal(run(h,'setForcePackagePosture',{package:p.id,posture:'deter'}),true);
 assert.ok(missionCapability(h.g,'EA','deter')>0);
 assert.ok(packageOrder(h.g,'setForcePackagePosture',{package:p.id,posture:'isr'}).block);
});

test('new assignments receive available readiness ahead of home reserves while preserving earlier commitments',()=>{
 const h=harness(materialize(fresh()));
 assert.equal(run(h,'assembleForcePackage',{template:'surface_escort'}),true);
 const reserve=h.g.forces.packages.find(p=>p.template==='surface_escort'),incoming=h.g.forces.packages.filter(p=>p.template==='surface_escort').at(-1);
 const core=Object.keys(incoming.requiredMembers)[0],line=core.split(':')[2];
 h.g.forces.fleet[line].mc=50;
 assert.equal(run(h,'assignForcePackage',{package:incoming.id,region:'ME',posture:'escort'}),true);
 assert.equal(packageView(h.g).packages.find(p=>p.id===incoming.id).ready,true);
 // The initial carrier and reserve escort may consume home readiness, but never the
 // readiness already supporting the newly assigned escort in the next order.
 const before=packageView(h.g).packages.find(p=>p.id===incoming.id).components.find(c=>c.id===core).readyPlatforms;
 const q=packageOrder(h.g,'assignForcePackage',{package:reserve.id,region:'EA',posture:'escort'});
 if(!q.block){run(h,'assignForcePackage',{package:reserve.id,region:'EA',posture:'escort'});assert.equal(packageView(h.g).packages.find(p=>p.id===incoming.id).components.find(c=>c.id===core).readyPlatforms,before);}
});

test('partial surviving aircraft batches never display or contribute more physical platforms than exist',()=>{
 const g=fresh();g.forces.fleet.f22={...g.forces.fleet.f22,n:25,mc:100};
 const member={'fleet:usa:f22':1};g.forces={...g.forces,packageVersion:1,nextPackageId:3,packages:[1,2].map(n=>({id:`pkg:${n}`,name:`Fighter ${n}`,service:'air_force',template:'detachment',members:{...member},plannedMembers:{...member},requiredMembers:{...member},region:'EA',posture:'deter'}))};
 g.forceDeployments=packageDeployments(g.forces.packages);
 const rows=packageView(g).packages,components=rows.flatMap(p=>p.components);
 assert.equal(components.reduce((n,c)=>n+c.platforms,0),25);
 assert.equal(components.reduce((n,c)=>n+c.readyPlatforms,0),25);
 assert.ok(rows.every(p=>p.ready));assert.equal(components[1].platforms,1);
 assert.equal(missionReadyDeployments(g,'EA','deter')['fleet:usa:f22'],25/24);
});

test('lazy default organization leaves newly purchased equipment free and raw recall preserves a reusable detachment',()=>{
 const h=harness(fresh());h.g.blackPrograms={...h.g.blackPrograms,f47:1};
 assert.equal(packageReservations(h.g).f47||0,0);
 assert.equal(run(h,'deployAsset',{unit:'f47',region:'EA'}),true);
 const p=h.g.forces.packages.find(p=>p.members.f47);
 assert.equal(run(h,'recallAsset',{unit:'f47',region:'EA'}),true);
 assert.equal(run(h,'deployAsset',{unit:'f47',region:'ME'}),true);
 assert.equal(h.g.forces.packages.find(x=>x.id===p.id).region,'ME');
 assert.equal(h.g.forces.packages.filter(x=>x.members.f47).length,1);
 assert.deepEqual(h.g.forceDeployments.ME,{f47:1});
});

test('regional mission effects share posture-specific influence, emergency aid and capped suppression rates',()=>{
 const g=fresh(),strength={ME:{deter:{fighter_wing:1},isr:{sr72:1},humanitarian:{airlift:1},exercise:{fighter_wing:1}}};
 const ordinary=regionalMissionEffects(g,'ME',strength);
 assert.equal(ordinary.total,4);assert.deepEqual(ordinary.counts,{deter:1,isr:1,humanitarian:1,exercise:1});
 assert.ok(Math.abs(ordinary.influence-.28)<1e-10);assert.equal(ordinary.sr72Bonus,.04);
 const deter=theaterWeight({...g,forceDeployments:{ME:strength.ME.deter}},'ME'),isr=theaterWeight({...g,forceDeployments:{ME:strength.ME.isr}},'ME');
 assert.equal(ordinary.suppression,Math.min(.5,(deter+isr*.5)*.08));
 g.flashpoint={rid:'ME'};assert.ok(Math.abs(regionalMissionEffects(g,'ME',strength).influence-.44)<1e-10);
 g.flashpoint=null;g.worldEvent={id:'hormuz_closure'};assert.equal(regionalMissionEffects(g,'ME',strength).emergency,true);
 const maximum=regionalMissionEffects(g,'ME',{ME:{deter:{fighter_wing:100}}});assert.equal(maximum.influence,.6);assert.equal(maximum.suppression,.5);
 const aid=regionalMissionEffects(g,'ME',{ME:{humanitarian:{airlift:2},exercise:{fighter_wing:1}}});assert.equal(aid.suppression,0);
 assert.deepEqual(regionalMissionEffects(g,'EA',strength).counts,{});
});
