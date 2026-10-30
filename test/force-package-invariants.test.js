import {test} from 'node:test';
import assert from 'node:assert/strict';
import {COUNTRIES} from '../src/data/nations.js';
import {newCampaign} from '../src/sim/state.js';
import {checkV57} from '../src/sim/invariants.js';
import {ownedUnits} from '../src/sim/force-inventory.js';
import {packageState,packageDeployments,reconcilePackages} from '../src/sim/force-packages.js';

const fresh=(id='usa')=>{
 const g=newCampaign(COUNTRIES.find(c=>c.id===id));
 g.forces=packageState(g);g.forceDeployments=packageDeployments(g.forces.packages);return g;
};
const errors=g=>checkV57(g).filter(n=>n.startsWith('force packages:'));
const mutate=fn=>{const g=fresh();fn(g,g.forces.packages[0]);return errors(g);};

test('package invariants accept every country, legacy saves and persisted formations with declining readiness',()=>{
 for(const c of COUNTRIES){const g=fresh(c.id);assert.deepEqual(errors(g),[],c.id);}
 const legacy=newCampaign(COUNTRIES[0]);assert.deepEqual(errors(legacy),[]);
 const g=fresh(),p=g.forces.packages.find(p=>p.template==='carrier_strike');p.region='EA';g.forceDeployments=packageDeployments(g.forces.packages);
 g.forces.fleet.cvn.mc=0;assert.deepEqual(errors(g),[],'unready assigned equipment remains an owned commitment');
 g.forces=JSON.parse(JSON.stringify(g.forces));assert.deepEqual(errors(g),[],'save/resume retains the same package book');
});

test('package invariants reject duplicate identities, stale counters and unknown control values',()=>{
 for(const fn of [
  (g,p)=>g.forces.packages.push({...p}),
  g=>{g.forces.nextPackageId=1;},
  g=>{g.forces.packageVersion=9;},
  (g,p)=>{p.id='fleet:usa:cvn';},
  (g,p)=>{p.service='imaginary';},
  (g,p)=>{p.template='imaginary';},
  (g,p)=>{p.region='imaginary';},
  (g,p)=>{p.posture='imaginary';},
 ])assert.ok(mutate(fn).length);
});

test('package invariants reject unknown, fractional or contradictory component requirements',()=>{
 for(const fn of [
  (g,p)=>{p.members={'fleet:china:cv':1};},
  (g,p)=>{p.members={made_up:1};},
  (g,p)=>{const id=Object.keys(p.members)[0];p.members[id]=.5;},
  (g,p)=>{const id=Object.keys(p.members)[0];p.members[id]=-1;},
  (g,p)=>{p.plannedMembers={};},
  (g,p)=>{const id=Object.keys(p.members)[0];p.requiredMembers={[id]:p.plannedMembers[id]+1};},
 ])assert.ok(mutate(fn).some(n=>n.includes('requirements')));
});

test('reservations count packages both at home and assigned, without requiring ready stock',()=>{
 const g=fresh(),id='fleet:usa:cvn',owned=ownedUnits(g,id);
 const p={id:'pkg:1',name:'First carrier',service:'navy',template:'detachment',members:{[id]:owned},plannedMembers:{[id]:owned},region:'EA',posture:'deter'};
 const q={...p,id:'pkg:2',name:'Duplicate carrier',members:{[id]:1},plannedMembers:{[id]:1},region:null};
 g.forces={...g.forces,packages:[p,q],nextPackageId:3};g.forceDeployments=packageDeployments(g.forces.packages);
 assert.ok(errors(g).some(n=>n.includes('reservations')));
 g.forces.packages=[p];assert.deepEqual(errors(g),[],'readiness is a deployment gate, not an ownership constraint');
});

test('package assignment projection detects phantom, missing and duplicate theater inventory',()=>{
 const g=fresh(),p=g.forces.packages[0];p.region='ME';g.forceDeployments=packageDeployments(g.forces.packages);assert.deepEqual(errors(g),[]);
 const saved=structuredClone(g.forceDeployments),id=Object.keys(p.members)[0];
 for(const deployments of [{}, {...saved,EA:{[id]:1}}, {...saved,ME:{...saved.ME,[id]:saved.ME[id]+1}}]){
  g.forceDeployments=deployments;assert.ok(errors(g).some(n=>n.includes('projection')));
 }
 g.forceDeployments=saved;assert.deepEqual(errors(g),[]);
});

test('loss reconciliation preserves missing requirements while removing nonexistent reservations',()=>{
 const g=fresh(),p=g.forces.packages.find(p=>p.template==='carrier_strike');p.region='EA';g.forceDeployments=packageDeployments(g.forces.packages);
 g.forces.fleet.cvn={...g.forces.fleet.cvn,n:0,at:{}};
 assert.ok(errors(g).some(n=>n.includes('reservations')));
 g.forces=reconcilePackages(g);g.forceDeployments=packageDeployments(g.forces.packages);
 const surviving=g.forces.packages.find(x=>x.id===p.id);assert.equal(surviving.members['fleet:usa:cvn'],undefined);assert.equal(surviving.plannedMembers['fleet:usa:cvn'],1);
 assert.deepEqual(errors(g),[]);
});
