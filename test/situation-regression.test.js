import {test} from 'node:test';
import assert from 'node:assert/strict';
import {game} from './util/headless-month.js';
import {COUNTRIES} from '../src/data/nations.js';
import {REGIONS} from '../src/data/regions.js';
import {buildScene} from '../src/ui/map/scene.js';
import {COLOR} from '../src/ui/tokens.js';

test('home theaters retain identity when a foreign diplomatic index overtakes the player',()=>{
 for(const country of COUNTRIES){
  const rid=Object.keys(REGIONS).find(r=>REGIONS[r].homeFor?.includes(country.id));if(!rid)continue;
  const sphere={[rid]:{player:5,competitors:{[country.id==='germany'?'usa':'germany']:90}}};
  const before=JSON.stringify(sphere),view={country,sphere};
  const r=buildScene(view).regions.find(r=>r.rid===rid);
  assert.equal(r.home,true,country.id);assert.equal(r.fill,COLOR.faction.player);assert.match(r.line2,/HOME/);assert.equal(r.hatch,false);
  assert.equal(JSON.stringify(sphere),before,'display must not overwrite diplomacy or saved progress');
  assert.equal(buildScene(view,'military').regions.find(r=>r.rid===rid).line2,'NO FORCES');
 }
 const r=buildScene({country:COUNTRIES[0],sphere:{WE:{player:5,competitors:{germany:90}}}}).regions.find(r=>r.rid==='WE');
 assert.equal(r.line2,'GERMANY 90%','foreign influence remains visible');
});

test('covert orders reject self targets, invalid targets and duplicate deployments before spending',()=>{
 const h=game(88);try{h.g.stats.treasury=10000;
  for(const nation of ['usa','invalid']){h.act({type:'runIntelOp',payload:{op:'influence',nation}});assert.equal(h.g.intelOps.length,0);assert.equal(h.g.stats.treasury,10000);}
  h.act({type:'runIntelOp',payload:{op:'influence',nation:'china'}});assert.equal(h.g.intelOps.length,1);const cash=h.g.stats.treasury;
  h.act({type:'runIntelOp',payload:{op:'influence',nation:'china'}});assert.equal(h.g.intelOps.length,1);assert.equal(h.g.stats.treasury,cash);
  h.act({type:'runIntelOp',payload:{op:'counter_int',nation:'usa'}});const after=h.g.stats.treasury;
  h.act({type:'runIntelOp',payload:{op:'counter_int',nation:'russia'}});assert.equal(h.g.stats.treasury,after,'one national sweep, regardless of selected foreign dossier');
 }finally{h.done();}
});

test('an expired domestic sweep cannot trigger a foreign discovery crisis, including old saves',()=>{
 const h=game(99);try{
  h.g.gracePeriod=99;
  h.g.intelOps=[{id:'old-sweep',opId:'counter_int',targetId:'germany',monthsLeft:1,type:'defensive',successRate:1,discoverRate:1}];
  h.step();assert.equal(h.g.intelCrisis??null,null);assert.equal(h.g.intelOps.length,0);
 }finally{h.done();}
});

test('standing orders cannot bypass infrastructure requirements or collect against the player',()=>{
 const h=game(38);try{
  h.g.stats.treasury=100000;h.g.continuousOps={'mole@china':true,'sabotage@china':true,'influence@usa':true};
  h.step();assert.equal(h.g.intelOps.length,0);
  h.g.intelInfra.overseas_stations=3;h.step();assert.equal(h.g.intelOps.length,1);assert.equal(h.g.intelOps[0].opId,'mole');
 }finally{h.done();}
});

import {mount,BUNDLES,flush} from './util/harness.js';
import {intelOrder} from '../src/sim/intel-operations.js';
test('saved foreign influence in the home theater resumes as diplomacy, never foreign ownership',async()=>{
 const first=await mount(BUNDLES.app,{testHook:true,seed:22});let save;
 try{await first.pickCountry(0);first.answerModal();await flush();await first.advance(3);save=JSON.parse(first.saves.at(-1));save.sphere.NA={player:5,competitors:{germany:90}};}finally{first.close();}
 const g=await mount(BUNDLES.app,{testHook:true,preload:{wl_save:JSON.stringify(save)},seed:22});
 try{
  [...g.doc.querySelectorAll('button')].find(b=>/Resume/.test(b.textContent)).click();await flush();await flush();
  assert.match(g.doc.querySelector('svg g[data-region=NA]').textContent,/HOME · USA/);
  g.tabBtn('sitroom').click();await flush();await flush();
  assert.equal(g.doc.querySelectorAll('[data-covert-op]').length,6);assert.ok(g.doc.querySelector('[data-nuke-register]'));
  g.w.__wl.month();await flush();assert.ok(!g.faulted());
 }finally{g.close();}
});

test('shared mission gate and command agree on discounted price, facilities and available personnel',()=>{
 const h=game(73);try{
  h.g.doctrine='shadow';h.g.stats.treasury=10000;
  const q=intelOrder(h.g,'tech_acq','china');const before=h.g.stats.treasury;
  h.act({type:'runIntelOp',payload:{op:'tech_acq',nation:'china'}});assert.equal(before-h.g.stats.treasury,q.cost);assert.equal(h.g.intelOps[0].successRate,q.odds.successRate);
  const cash=h.g.stats.treasury;
  for(const op of ['mole','sabotage']){assert.ok(intelOrder(h.g,op,'china').block);h.act({type:'runIntelOp',payload:{op,nation:'china'}});assert.equal(h.g.stats.treasury,cash);}
  h.g.intelInfra.paramilitary=1;
  for(const u of Object.values(h.g.forces.sof.units))u.ops=0;
  assert.match(intelOrder(h.g,'sabotage','china').block,/No Tier 2/);
 }finally{h.done();}
});

test('Situation deployment shortcuts open the existing-force picker for the affected theater',async()=>{
 const g=await mount(BUNDLES.app,{testHook:true,seed:61});try{
  await g.pickCountry(0);g.answerModal();await flush();g.w.__wl.flashpoint('ME','coup',4);await flush();
  g.tabBtn('sitroom').click();await flush();await flush();
  const assign=g.doc.querySelector('[data-assign-forces=ME]');assert.ok(assign,'assignment shortcut exists');assign.click();await flush();await flush();
  assert.ok(g.doc.querySelector('[data-map]'));const picker=g.doc.querySelector('[data-deployment-picker] select');assert.ok(picker);picker.value='fleet:usa:cvn';picker.dispatchEvent(new g.w.Event('change',{bubbles:true}));await flush();assert.ok(g.doc.querySelector('[data-map-deploy="fleet:usa:cvn"]'),'starting carrier available without buying another');
 }finally{g.close();}
});
