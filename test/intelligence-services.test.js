import {test} from 'node:test';
import assert from 'node:assert/strict';
import {COUNTRIES,NATIONS} from '../src/data/nations.js';
import {INTEL_OPS} from '../src/data/intel.js';
import {intelligenceServices,intelServiceFor,infrastructureService} from '../src/data/intelligence-services.js';
import {intelCycleCost,intelStandingOrder,intelOrder,intelCommitments,intelRecovery,intelSupport,intelResolutionOdds} from '../src/sim/intel-operations.js';
import {game} from './util/headless-month.js';

test('intelligence ownership follows country and mission responsibility without creating asset pools',()=>{
 for(const c of COUNTRIES){
  const agencies=intelligenceServices(c.id);assert.ok(agencies.length,c.id);
  for(const a of agencies){assert.ok(NATIONS[a.nation]);assert.ok(a.id&&a.name&&a.role);assert.equal(a.staff,undefined);assert.equal(a.capacity,undefined);}
  for(const op of INTEL_OPS){const lead=intelServiceFor(c.id,op.id);assert.ok(agencies.some(a=>a.id===lead.id));}
  for(const id of ['listening_posts','overseas_stations','crypt_center','paramilitary','isr_fusion'])assert.ok(infrastructureService(c.id,id));
 }
 assert.equal(intelServiceFor('usa','counter_int').short,'FBI');
 assert.equal(intelServiceFor('usa','mole').short,'CIA');
 assert.equal(infrastructureService('usa','listening_posts').short,'NSA');
 assert.ok(intelligenceServices('usa').some(a=>a.short==='NRO'));
 assert.ok(intelligenceServices('usa').some(a=>a.short==='NGA'));
 assert.ok(intelligenceServices('japan').some(a=>a.short==='DIH'));
 assert.deepEqual(intelligenceServices('missing'),[]);
});

test('standing intelligence quotes the full cycle including doctrine and validates foreign targets',()=>{
 const h=game(901);try{
  h.g.stats.treasury=10000;
  assert.equal(intelCycleCost(h.g,'tech_acq'),600);
  assert.equal(intelCycleCost(h.g,'tech_acq',{standing:true}),960);
  h.g.doctrine='shadow';assert.equal(intelCycleCost(h.g,'tech_acq'),450);assert.equal(intelCycleCost(h.g,'tech_acq',{standing:true}),720);
  const quote=intelStandingOrder(h.g,'tech_acq','china');assert.equal(quote.cost,720);assert.equal(quote.months,4);assert.equal(quote.block,null);
  for(const [op,nation] of [['counter_int','china'],['tech_acq','usa'],['bad','china'],['mole','missing']])assert.ok(intelStandingOrder(h.g,op,nation).block);
  h.g.intelOps=[{id:'ongoing',opId:'tech_acq',targetId:'china',monthsLeft:2}];
  assert.equal(intelStandingOrder(h.g,'tech_acq','china').block,null,'an existing mission may finish before the standing order starts another cycle');
 }finally{h.done();}
});

test('intelligence plan exposes actual named SOF commitment, service ownership, recovery and an actionable blocker',()=>{
 const h=game(902);try{
  h.g.stats.treasury=10000;
  let q=intelOrder(h.g,'sabotage','china');assert.match(q.block,/Special Activities/);assert.equal(q.remedy.jump.tab,'intel');
  h.g.intelInfra.paramilitary=1;q=intelOrder(h.g,'sabotage','china');assert.equal(q.block,null);assert.ok(q.commitments.length);
  const before=JSON.stringify(h.g);for(const p of q.commitments){assert.ok(p.serviceLabel);assert.ok(p.operators>0);assert.equal(p.months,5);assert.equal(p.recovery,6);}
  assert.equal(JSON.stringify(h.g),before,'planning does not reserve or mutate personnel');
  h.act({type:'runIntelOp',payload:{op:'sabotage',nation:'china'}});
  const actual=intelCommitments(h.g,h.g.intelOps[0]);assert.ok(actual.length);assert.equal(actual[0].unit,q.commitments[0].unit);assert.equal(actual[0].recovery,6);
  for(const unit of Object.values(h.g.forces.sof.units))unit.ops=0;
  q=intelOrder(h.g,'sabotage','russia');assert.match(q.block,/Tier 2/);assert.equal(q.remedy.jump.sub,'specialized');
 }finally{h.done();}
});

test('intelligence support requires a ready collection package on station and stacks once with target liaison',()=>{
 const h=game(903);try{
  const g=h.g,p={id:'pkg:1',name:'Pacific collection',service:'air_force',template:'detachment',members:{'fleet:usa:rq4':1},plannedMembers:{'fleet:usa:rq4':1},region:'EA',posture:'isr'};
  g.forces={...g.forces,packageVersion:1,nextPackageId:3,packages:[p]};g.forceDeployments={EA:{'fleet:usa:rq4':1}};
  assert.deepEqual(intelSupport(g,'china').map(s=>[s.kind,s.bonus,s.packages]),[['packages',.25,['pkg:1']]]);
  assert.deepEqual(intelSupport(g,'russia'),[]);assert.deepEqual(intelSupport(g,'usa'),[]);
  g.forces.packages.push({...p,id:'pkg:2',name:'Second collection element'});
  g.embassyMissions.china='intel';const support=intelSupport(g,'china');assert.equal(support.length,2);assert.equal(support.reduce((n,s)=>n+s.bonus,0),.37);
  const odds=intelResolutionOdds(g,{opId:'tech_acq',targetId:'china',successRate:.9,discoverRate:.2});assert.equal(odds.successRate,.95);assert.equal(odds.support,.37);assert.deepEqual(odds.supportSources,support);
  assert.equal(intelResolutionOdds(g,{opId:'counter_int',targetId:'china',successRate:1,discoverRate:0}).support,0,'domestic protection receives no foreign collection bonus');
  g.embassyMissions={};g.forces.packages=[p];p.posture='deter';assert.deepEqual(intelSupport(g,'china'),[]);
  p.posture='isr';g.forces.fleet.rq4.mc=0;assert.deepEqual(intelSupport(g,'china'),[],'unavailable aircraft do not provide support');
  g.forces.fleet.rq4.mc=60;p.members={'fleet:usa:f16':1};p.plannedMembers={...p.members};assert.deepEqual(intelSupport(g,'china'),[],'a fighter-only package cannot manufacture collection capability');
  p.members={'fleet:usa:ssn':1};p.plannedMembers={...p.members};assert.deepEqual(intelSupport(g,'china'),[],'maritime reconnaissance does not grant countrywide collection support');
 }finally{h.done();}
});

test('legacy collection assignments retain their role-qualified support without mutating the save',()=>{
 const h=game(904);try{
  h.g.forceDeployments={EA:{'fleet:usa:rq4':1}};h.g.forcePosture={EA:'isr'};
  const before=JSON.stringify(h.g);assert.equal(intelSupport(h.g,'china')[0]?.bonus,.25);assert.equal(JSON.stringify(h.g),before);
  h.g.forceDeployments={EA:{'fleet:usa:f16':1}};assert.deepEqual(intelSupport(h.g,'china'),[]);
 }finally{h.done();}
});

test('completed SOF elements leave active missions and remain visible through their recovery period',()=>{
 const h=game(905);try{
  h.g.stats.treasury=10000;h.g.intelInfra.paramilitary=1;h.act({type:'runIntelOp',payload:{op:'sabotage',nation:'china'}});
  const op=h.g.intelOps[0],active=intelCommitments(h.g,op);assert.ok(active.length);assert.deepEqual(intelRecovery(h.g),[]);
  for(const unit of Object.values(h.g.forces.sof.units))for(const out of unit.out){out.mo=0;out.rec=4;}
  assert.deepEqual(intelCommitments(h.g,op),[]);const recovering=intelRecovery(h.g);assert.equal(recovering[0].unit,active[0].unit);assert.equal(recovering[0].months,0);assert.equal(recovering[0].recovery,4);
  const unit=h.g.forces.sof.units[active[0].unit];unit.out.push({...unit.out[0],rec:2});assert.deepEqual(intelRecovery(h.g).map(p=>p.recovery),[2,4],'staggered returns remain separate so the next available element is visible');
  for(const unit of Object.values(h.g.forces.sof.units))unit.out=[];assert.deepEqual(intelRecovery(h.g),[]);
 }finally{h.done();}
});

test('standing orders charge their full discounted quote once per launched cycle and nothing while blocked',()=>{
 const h=game(906);try{
  h.g.doctrine='shadow';h.g.stats.treasury=100000;h.g.gracePeriod=99;
  for(const [op,nation] of [['bad','china'],['tech_acq','usa'],['counter_int','china']])h.act({type:'toggleContinuousOp',payload:{op,nation}});
  assert.deepEqual(h.g.continuousOps,{});
  h.act({type:'toggleContinuousOp',payload:{op:'tech_acq',nation:'china'}});h.step();
  assert.equal(h.g.ledger['Intel operations'],-720);assert.equal(h.g.intelOps.filter(o=>o.opId==='tech_acq').length,1);
  h.step();assert.equal(h.g.ledger['Intel operations']||0,0,'an active cycle is not billed again');
  for(let n=0;n<3;n++)h.step();assert.equal(h.g.ledger['Intel operations'],-720,'the replacement cycle pays the same full quote');
  h.act({type:'toggleContinuousOp',payload:{op:'tech_acq',nation:'china'}});assert.equal(h.g.continuousOps['tech_acq@china'],undefined);assert.equal(h.g.intelOps.length,1,'stopping repeats leaves the active mission in place');
  h.g.intelOps=[];h.act({type:'toggleContinuousOp',payload:{op:'sabotage',nation:'china'}});h.step();assert.equal(h.g.ledger['Intel operations']||0,0,'missing infrastructure has no launch charge');
  h.g.intelInfra.paramilitary=1;h.step();assert.equal(h.g.ledger['Intel operations'],-1080);assert.ok(h.g.intelOps[0].commitments.length,'automatic launches retain their named service elements');
 }finally{h.done();}
});

import {mount,BUNDLES,flush} from './util/harness.js';
test('Situation mission UI connects agency responsibility, SOF commitments, repeat controls and support assignment',async()=>{
 const h=await mount(BUNDLES.app,{testHook:true,seed:907});try{
  await h.pickCountry(0);h.answerModal();await flush();h.w.__wl.fund(100000);await flush();h.tabBtn('sitroom').click();await flush();
  const q=s=>h.doc.querySelector(s);
  assert.equal(q('[data-intel-lead]').textContent,'CIA');assert.equal(q('[data-intel-domestic-lead]').textContent,'FBI');assert.equal(h.doc.querySelectorAll('[data-intel-service]').length,6);
  q('[data-covert-op=sabotage]').click();await flush();assert.match(q('[data-covert-assessment]').textContent,/Requires Special Activities/);
  q('[data-intel-remedy]').click();await flush();assert.ok(!q('[data-covert-desk]'),'facility blocker opens agency infrastructure');
  h.w.__wl.infra({paramilitary:1});h.tabBtn('sitroom').click();await flush();q('[data-covert-op=sabotage]').click();await flush();
  assert.match(q('[data-intel-commitment]').textContent,/Army|Navy|Air Force|Marine/);assert.match(q('[data-intel-commitment]').textContent,/6 mo recovery/);
  q('[data-intel-repeat]').click();await flush();assert.match(q('[data-confirm]').textContent,/\$1,440M per automatic launch/);q('[data-confirm-ok]').click();await flush();assert.equal(q('[data-intel-repeat]').getAttribute('aria-pressed'),'true');
  q('[data-intel-repeat]').click();await flush();assert.equal(q('[data-intel-repeat]').getAttribute('aria-pressed'),'false');
  q('[data-intel-assign-support]').click();await flush();assert.ok(!q('[data-covert-desk]'),'support order reaches the force package workspace');assert.ok(h.w.__wl.dispatched().includes('toggleContinuousOp'));assert.ok(!h.faulted());
  h.tabBtn('intel').click();await flush();[...h.doc.querySelectorAll('button')].find(b=>b.textContent==='🇨🇳 China').click();await flush();
  assert.match(q('[data-infra-service=listening_posts]').textContent,/NSA/);assert.match(q('[data-intel-order=counter_int] [data-intel-order-service]').textContent,/FBI/);
  q('[data-intel-legacy-repeat=tech_acq]').click();await flush();assert.match(q('[data-confirm]').textContent,/\$960M per automatic launch/);q('[data-confirm-ok]').click();await flush();
  [...q('[data-intel-order=tech_acq]').querySelectorAll('button')].find(b=>b.textContent==='Launch Op').click();await flush();assert.match(q('[data-intel-order=tech_acq]').textContent,/Active — 4mo/);
  const stop=q('[data-intel-legacy-repeat=tech_acq]');assert.equal(stop.getAttribute('aria-pressed'),'true');stop.click();await flush();assert.equal(q('[data-intel-legacy-repeat=tech_acq]').getAttribute('aria-pressed'),'false');assert.match(q('[data-intel-order=tech_acq]').textContent,/Active — 4mo/,'the legacy panel can stop repeats while keeping the current mission');assert.ok(!h.faulted());
 }finally{h.close();}
});
