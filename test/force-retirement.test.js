import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newCampaign} from '../src/sim/state.js';
import {COUNTRIES} from '../src/data/nations.js';
import {effectiveForces} from '../src/sim/forces.js';
import {ownedUnits,deploymentAvailabilityBase} from '../src/sim/force-inventory.js';
import {retirementQuote} from '../src/sim/force-retirement.js';

const fresh=()=>newCampaign(COUNTRIES.find(c=>c.id==='usa'));
const prepare=(g,members={},region=null)=>{g.forces=effectiveForces(g);g.forces={...g.forces,packageVersion:1,nextPackageId:2,packages:Object.keys(members).length?[{id:'pkg:1',name:'Reserved',template:'detachment',service:'joint',members,plannedMembers:{...members},region,posture:'deter'}]:[]};};
const apply=(g,q)=>{assert.equal(q.block,null);if(q.platform){const key=q.source==='imported'?'platformsImported':'platforms';g[key]={...g[key],[q.platform]:q.nextCount};}g.forces=q.nextForces;};

test('purchase retirement protects components reserved at home and deployed overseas',()=>{
  for(const region of [null,'EA']){
    const g=fresh();g.platforms.carrier_group=1;prepare(g,{carrier_group:1},region);
    const before=structuredClone(g),q=retirementQuote(g,{platform:'carrier_group'});
    assert.match(q.block,/reserved/i);assert.equal(q.available,0);assert.deepEqual(g,before);
  }
});

test('raw line retirement removes only unreserved starting stock and never purchased carriers',()=>{
  const g=fresh();g.platforms.carrier_group=2;g.blackPrograms.ford=1;prepare(g,{'fleet:usa:cvn':2,carrier_group:1});
  const q=retirementQuote(g,{line:'cvn',n:9});assert.equal(q.available,9);assert.equal(q.platforms,9);apply(g,q);
  assert.equal(g.forces.fleet.cvn.n,5);assert.equal(ownedUnits(g,'fleet:usa:cvn'),2);assert.equal(ownedUnits(g,'carrier_group'),2);assert.equal(ownedUnits(g,'ford'),1);
  assert.match(retirementQuote(g,{line:'cvn',n:1}).block,/reserved/i);
  prepare(g);assert.equal(retirementQuote(g,{line:'cvn',n:3}).block!==null,true,'purchased hulls cannot be retired through the starting line');
});

test('domestic and imported retirement update only the chosen source and subtract physical stock once',()=>{
  const g=fresh();g.platforms.carrier_group=1;g.platformsImported.carrier_group=2;prepare(g,{carrier_group:1});
  const before=structuredClone(g),q=retirementQuote(g,{platform:'carrier_group',source:'imported',n:2});
  assert.deepEqual(g,before);assert.equal(q.platforms,2);assert.equal(q.nextCount,0);assert.equal(q.nextFielded,1);apply(g,q);
  assert.equal(g.platforms.carrier_group,1);assert.equal(g.platformsImported.carrier_group,0);assert.equal(g.forces.fleet.cvn.n,12);
  assert.equal(effectiveForces(g).fleet.cvn.n,12,'sync cannot subtract the same two hulls again');assert.equal(ownedUnits(g,'carrier_group'),1);
});

test('partial-loss retirement removes exact surviving physical stock and can clear destroyed manifest entries',()=>{
  const g=fresh();g.platforms.fighter_wing=2;prepare(g);
  g.forces.fleet.f35a={...g.forces.fleet.f35a,n:10,at:{NA:10}};
  prepare(g,{fighter_wing:1});
  const ghost=retirementQuote(g,{platform:'fighter_wing',n:1});assert.equal(ghost.platforms,0);apply(g,ghost);
  assert.equal(g.forces.fleet.f35a.n,10);assert.equal(ownedUnits(g,'fighter_wing'),1);
  assert.match(retirementQuote(g,{platform:'fighter_wing'}).block,/reserved/i);
  prepare(g);const final=retirementQuote(g,{platform:'fighter_wing'});assert.equal(final.platforms,10);apply(g,final);
  assert.equal(effectiveForces(g).fleet.f35a.n,0);assert.equal(ownedUnits(g,'fighter_wing'),0);
});

test('retiring one purchased alias does not destroy surviving stock assigned to another alias',()=>{
  const g=fresh();g.platforms.fighter_wing=2;g.blackPrograms.f35=2;prepare(g);
  g.forces.fleet.f35a={...g.forces.fleet.f35a,n:25,at:{NA:25}};prepare(g,{f35:1});
  const before=deploymentAvailabilityBase(g,'f35'),q=retirementQuote(g,{platform:'fighter_wing',n:2});apply(g,q);
  assert.equal(ownedUnits(g,'f35'),1);assert.ok(deploymentAvailabilityBase(g,'f35').platforms>=before.platforms);
  assert.equal(effectiveForces(g).fleet.f35a.n,before.platforms);
});

test('retiring a stale manifest cannot reduce a reserved partial batch through alias reallocation',()=>{
  const g=fresh();g.platforms.fighter_wing=2;g.blackPrograms.f35=2;prepare(g);
  g.forces.fleet.f35a={...g.forces.fleet.f35a,n:25,at:{NA:25}};prepare(g,{fighter_wing:1});
  const before=structuredClone(g),q=retirementQuote(g,{platform:'fighter_wing',n:1});
  assert.match(q.block,/reserved/i,'one surviving batch must retain its 12 aircraft, not fall to 8');
  assert.equal(deploymentAvailabilityBase(g,'fighter_wing').platforms,12);assert.deepEqual(g,before);
});

test('strategic starting lines without deployable aliases can retire real stock and invalid requests are rejected',()=>{
  const g=fresh();prepare(g);const q=retirementQuote(g,{line:'mm3',n:1});assert.equal(q.platforms,1);apply(g,q);assert.equal(g.forces.fleet.mm3.n,399);
  for(const p of [{line:'cvn',n:0},{line:'cvn',n:1.5},{line:'missing'},{platform:'carrier_group',source:'unknown'}])assert.ok(retirementQuote(g,p).block);
});
