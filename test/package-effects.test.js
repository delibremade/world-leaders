import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FORCE_RULES} from '../src/data/forces.js';
import {game} from './util/headless-month.js';
import {packageState,packageView,packageDeployments,packageReservations,missionDeployments,missionStrengths,PACKAGE_VERBS} from '../src/sim/force-packages.js';

const count=units=>Object.values(units||{}).reduce((n,k)=>n+k,0);
function campaign(seed){
 const h=game(seed);h.g.stats.treasury=100000;h.g.gracePeriod=9;h.g.forces=packageState(h.g);h.g.forceDeployments=packageDeployments(h.g.forces.packages);
 h.S=new Proxy({},{get:(_,name)=>value=>{const key=name[3].toLowerCase()+name.slice(4);h.g[key]=typeof value==='function'?value(h.g[key]):value;}});
 h.order=(type,payload)=>assert.equal(PACKAGE_VERBS[type](h.g,h.S,{toast:m=>h.toasts.push(m)},payload),true,h.toasts.at(-1));
 return h;
}
function assign(h,template,posture,region='ME'){
 const p=h.g.forces.packages.find(p=>p.template===template&&!p.region);assert.ok(p,template);
 h.order('assignForcePackage',{package:p.id,region,posture});return h.g.forces.packages.find(x=>x.id===p.id);
}
function mixed(h){return {aid:assign(h,'ground_task_force','humanitarian'),air:assign(h,'air_expeditionary','exercise'),escort:assign(h,'surface_escort','escort')};}

test('mixed packages in one theater pay basing per batch and humanitarian cost only for aid during grace',()=>{
 const h=campaign(941);try{
  const p=mixed(h),batches=count(h.g.forceDeployments.ME),aid=count(p.aid.members);
  assert.ok(batches>aid);assert.equal(count(missionDeployments(h.g,'ME','exercise')),count(p.air.members));assert.equal(count(missionDeployments(h.g,'ME','escort')),count(p.escort.members));
  const quote=packageView(h.g).summary.costMonthly;assert.equal(quote,batches*4+aid*30);
  h.g.forcePosture.ME='deter';h.step();assert.ok(h.g.gracePeriod>0,'opening grace is still active');
  assert.equal(h.g.ledger['Forward basing'],-batches*4);assert.equal(h.g.ledger['Humanitarian ops'],-aid*30);
  assert.equal(-(h.g.ledger['Forward basing']+h.g.ledger['Humanitarian ops']),quote,'the quoted recurring total is the amount charged');
 }finally{h.done();}
});

test('an exercise package trains its branch independently of other missions and theater defaults',()=>{
 const h=campaign(942);try{
  mixed(h);h.g.forcePosture.ME='humanitarian';h.g.forces.readiness={land:60,air:60,sea:60};h.g.forces.train=2;h.step();
  assert.equal(h.g.forces.readiness.air,60+FORCE_RULES.riseMo+FORCE_RULES.exercise.rise);
  assert.equal(h.g.forces.readiness.land,60+FORCE_RULES.riseMo,'aid mission does not grant an exercise training bonus');
  assert.equal(h.g.forces.readiness.sea,60+FORCE_RULES.riseMo,'escort mission does not grant an exercise training bonus');
 }finally{h.done();}
});

test('the individual-asset posture command cannot overwrite named package missions in the same theater',()=>{
 const h=campaign(943);try{
  mixed(h);h.order('deployAsset',{unit:'fleet:usa:rq4',region:'ME',posture:'isr'});
  const named=h.g.forces.packages.filter(p=>p.region==='ME'&&p.template!=='detachment').map(p=>[p.id,p.posture]);
  const assignments=structuredClone(h.g.forceDeployments);
  h.act({type:'setPosture',payload:{region:'ME',posture:'exercise'}});
  assert.equal(h.g.forcePosture.ME,'exercise');assert.deepEqual(h.g.forces.packages.filter(p=>p.region==='ME'&&p.template!=='detachment').map(p=>[p.id,p.posture]),named);
  assert.equal(h.g.forces.packages.find(p=>p.region==='ME'&&p.template==='detachment').posture,'exercise');assert.deepEqual(h.g.forceDeployments,assignments);
 }finally{h.done();}
});

test('maintenance failure removes an assigned escort effect while retaining its reservation and basing bill',()=>{
 const h=campaign(944);try{
  const p=assign(h,'carrier_strike','escort'),batches=count(p.members),reservation=structuredClone(packageReservations(h.g));
  h.g.blockades.ME={by:'china',mo:6};h.step();assert.equal(h.g.chokeStatus.hormuz,'escorted');
  const inventory=Object.fromEntries(Object.keys(p.members).filter(id=>id.startsWith('fleet:')).map(id=>[id,h.g.forces.fleet[id.split(':')[2]].n]));
  for(const id of Object.keys(p.members))if(id.startsWith('fleet:'))h.g.forces.fleet[id.split(':')[2]].mc=0;
  assert.equal(missionStrengths(h.g).ME?.escort,undefined,'a failed package contributes no operational escort strength');
  assert.deepEqual(packageReservations(h.g),reservation);assert.equal(count(h.g.forceDeployments.ME),batches);
  h.step();assert.equal(h.g.chokeStatus.hormuz,'disrupted');assert.equal(h.g.ledger['Forward basing'],-batches*4);
  assert.deepEqual(packageReservations(h.g),reservation);for(const [id,n]of Object.entries(inventory))assert.equal(h.g.forces.fleet[id.split(':')[2]].n,n,'maintenance does not delete physical inventory');
 }finally{h.done();}
});

test('a grounded exercise package keeps its assignment but cannot provide operational exercise training',()=>{
 const h=campaign(945);try{
  const p=assign(h,'air_expeditionary','exercise');h.g.forces.readiness={land:60,air:60,sea:60};h.g.forces.train=2;
  for(const id of Object.keys(p.members))if(id.startsWith('fleet:'))h.g.forces.fleet[id.split(':')[2]].mc=0;
  assert.equal(missionStrengths(h.g).ME?.exercise,undefined);h.step();
  assert.equal(h.g.forces.readiness.air,60+FORCE_RULES.riseMo,'normal funded training continues; the unavailable forward mission adds no bonus');
  assert.equal(h.g.forces.packages.find(x=>x.id===p.id).region,'ME');assert.equal(h.g.ledger['Forward basing'],-count(p.members)*4);
 }finally{h.done();}
});

test('JSON roundtrip preserves independent package missions, composition, reservations and current mission strength',()=>{
 const h=campaign(946);try{
  mixed(h);h.g.forcePosture.ME='deter';const before=packageState(h.g),reservations=packageReservations(h.g),strength=missionStrengths(h.g);
  const snapshot=JSON.parse(JSON.stringify({forces:h.g.forces,forceDeployments:h.g.forceDeployments,forcePosture:h.g.forcePosture}));
  const restored={...h.g,...snapshot};assert.deepEqual(packageState(restored),before);assert.deepEqual(packageReservations(restored),reservations);assert.deepEqual(missionStrengths(restored),strength);
  assert.deepEqual(restored.forceDeployments,packageDeployments(restored.forces.packages));assert.deepEqual(restored.forces.packages.filter(p=>p.region==='ME').map(p=>p.posture).sort(),['escort','exercise','humanitarian']);
 }finally{h.done();}
});
