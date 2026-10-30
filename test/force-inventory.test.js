import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newCampaign} from '../src/sim/state.js';
import {COUNTRIES} from '../src/data/nations.js';
import {ORBAT,UNIT_PLATFORMS} from '../src/data/orbat.js';
import {PLATFORMS} from '../src/data/platforms.js';
import {effectiveForces,readyCount,stationInventory} from '../src/sim/forces.js';
import {ownedUnits,deploymentAvailabilityBase} from '../src/sim/force-inventory.js';
import {reconcilePackages,packageView,packageDeployments} from '../src/sim/force-packages.js';

const fresh=()=>newCampaign(COUNTRIES.find(c=>c.id==='usa'));
const stock=(g,id)=>deploymentAvailabilityBase(g,id);
const sync=g=>{g.forces=effectiveForces(g);};
const loss=(g,line,n)=>{g.forces.fleet[line]={...g.forces.fleet[line],n,at:n?{NA:n}:{}};};
const assign=(g,members)=>{g.forces={...g.forces,packageVersion:1,nextPackageId:2,packages:[{id:'pkg:1',template:'detachment',service:'joint',name:'Test',members,plannedMembers:{...members},region:null,posture:'deter'}]};};

test('small aircraft losses retain the surviving partial batch and its exact physical strength',()=>{
  const g=fresh();loss(g,'f22',168);assign(g,{'fleet:usa:f22':7});
  assert.equal(ownedUnits(g,'fleet:usa:f22'),7);
  loss(g,'f22',167);
  const x=stock(g,'fleet:usa:f22');
  assert.equal(x.owned,7);assert.equal(x.platforms,167);assert.equal(x.per,24);
  assert.ok(x.readyPlatforms<=167);
  assert.equal(reconcilePackages(g).packages[0].members['fleet:usa:f22'],7);
  loss(g,'f22',1);
  assert.equal(stock(g,'fleet:usa:f22').platforms,1);
  assert.equal(ownedUnits(g,'fleet:usa:f22'),1);
});

test('total fleet loss removes purchased and starting ownership without rewriting procurement history',()=>{
  const g=fresh();g.platforms.carrier_group=1;g.platformsImported.carrier_group=1;g.blackPrograms.ford=1;sync(g);
  assign(g,{carrier_group:2,ford:1,'fleet:usa:cvn':1});loss(g,'cvn',0);
  for(const id of ['carrier_group','ford','fleet:usa:cvn'])assert.deepEqual([stock(g,id).owned,stock(g,id).platforms,stock(g,id).ready],[0,0,0]);
  assert.deepEqual(reconcilePackages(g).packages[0].members,{});
  assert.equal(g.platforms.carrier_group,1);assert.equal(g.platformsImported.carrier_group,1);assert.equal(g.blackPrograms.ford,1);
  assert.equal(effectiveForces(g).fleet.cvn.n,0,'an unchanged purchase manifest does not regenerate lost ships');
});

test('purchased aliases share one bounded physical and readiness budget across domestic imports and programs',()=>{
  const g=fresh();g.platforms.fighter_wing=2;g.platformsImported.fighter_wing=1;g.blackPrograms.f35=2;sync(g);
  const ids=['fighter_wing','f35','fleet:usa:f35a'],line=ORBAT.usa.find(l=>l.id==='f35a');
  for(const remaining of [529,121,120,119,25,1,0]){
    loss(g,'f35a',remaining);const before=structuredClone(g),rows=ids.map(id=>stock(g,id));
    assert.equal(rows.reduce((n,x)=>n+x.platforms,0),remaining);
    assert.equal(rows.reduce((n,x)=>n+x.readyPlatforms,0),readyCount(effectiveForces(g),line));
    for(const x of rows){assert.ok(x.readyPlatforms<=x.platforms);assert.ok(x.ready<=x.owned);assert.ok(Number.isInteger(x.platforms));}
    assert.deepEqual(rows,ids.map(id=>stock(g,id)),'allocation is deterministic');
    assert.deepEqual(g,before,'selectors never mutate manifests or fleet');
  }
});

test('nondeployable purchases retain their share and cannot supply duplicate stock or readiness to another alias',()=>{
  const g=fresh();g.platforms.strategic_bombers=2;g.blackPrograms.b21=1;sync(g);loss(g,'b21',21);
  const rows=['strategic_bombers','b21'].map(id=>stock(g,id));
  assert.equal(rows.reduce((n,x)=>n+x.platforms,0),21);
  const line=ORBAT.usa.find(l=>l.id==='b21');
  assert.equal(rows.reduce((n,x)=>n+x.readyPlatforms,0),readyCount(effectiveForces(g),line));
  assert.ok(rows.every(x=>x.platforms>0));
});

test('a real new delivery after total loss restores only the newly delivered physical stock',()=>{
  const g=fresh();loss(g,'cvn',0);g.blackPrograms.ford=1;sync(g);
  assert.equal(g.forces.fleet.cvn.n,1);assert.equal(ownedUnits(g,'ford'),1);assert.equal(ownedUnits(g,'fleet:usa:cvn'),0);
  loss(g,'cvn',0);assert.equal(ownedUnits(g,'ford'),0);
  g.blackPrograms.ford=2;sync(g);
  assert.equal(g.forces.fleet.cvn.n,1);assert.equal(stock(g,'ford').platforms,1);assert.equal(stock(g,'ford').owned,1);
});

test('a multi-hull purchase retains an operational whole survivor at reduced batch strength',()=>{
  const g=fresh();g.platforms.sub_fleet=1;sync(g);loss(g,'ssn',1);g.forces.fleet.ssn.mc=100;
  const x=stock(g,'sub_fleet');
  assert.equal(x.per,UNIT_PLATFORMS.sub_fleet.per);assert.equal(x.platforms,1);assert.equal(x.owned,1);assert.equal(x.readyPlatforms,1);assert.equal(x.ready,1);
  assert.equal(stock(g,'fleet:usa:ssn').platforms,0);
  g.forces.fleet.ssn.mc=0;assert.equal(stock(g,'sub_fleet').ready,0);assert.equal(stock(g,'sub_fleet').owned,1);
});

test('carrier procurement identifies the hull rather than promising a complete strike group',()=>{
  assert.equal(PLATFORMS.carrier_group.n,'Carrier hull');
  assert.match(PLATFORMS.carrier_group.d,/aircraft and escorts separately/i);
});

const stationed=(g,packages)=>{
  g.forces={...g.forces,packageVersion:1,nextPackageId:packages.length+1,packages:packages.map((p,i)=>({id:`pkg:${i+1}`,name:`Package ${i+1}`,template:'detachment',service:'joint',plannedMembers:{...p.members},posture:'deter',...p}))};
  g.forceDeployments=packageDeployments(g.forces.packages);stationInventory(g,{setForces:f=>{g.forces=f;}});
};

test('stationing keeps a partial starting alias separate from purchased aircraft on the same force line',()=>{
  const g=fresh();g.platforms.fighter_wing=1;sync(g);loss(g,'f35a',25);
  stationed(g,[{region:'EA',members:{'fleet:usa:f35a':1}},{region:'WE',members:{fighter_wing:1}}]);
  assert.deepEqual(g.forces.fleet.f35a.at,{EA:1,WE:24});
  const components=packageView(g).packages.map(p=>p.components[0].platforms);assert.deepEqual(components,[1,24]);
});

test('stationing consumes physical stock in package order instead of grouping repeated theaters first',()=>{
  const g=fresh();loss(g,'f22',50);
  stationed(g,[{region:'EA',members:{'fleet:usa:f22':1}},{region:'WE',members:{'fleet:usa:f22':1}},{region:'EA',members:{'fleet:usa:f22':1}}]);
  assert.deepEqual(g.forces.fleet.f22.at,{EA:26,WE:24});
  assert.deepEqual(packageView(g).packages.map(p=>p.components[0].platforms),[24,24,2]);
});

test('home-region missions consume physical slices while unassigned packages yield to deployed ones',()=>{
  const g=fresh();loss(g,'f22',25);
  stationed(g,[{region:null,members:{'fleet:usa:f22':1}},{region:'NA',members:{'fleet:usa:f22':1}},{region:'EA',members:{'fleet:usa:f22':1}}]);
  assert.deepEqual(g.forces.fleet.f22.at,{NA:24,EA:1});
  assert.deepEqual(packageView(g).packages.map(p=>p.components[0].platforms),[0,24,1]);
});
