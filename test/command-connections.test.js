import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mount,BUNDLES,flush} from './util/harness.js';
import {regionCommands,runCommand} from '../src/ui/shell/commands.js';
import {game} from './util/headless-month.js';
import {SITES} from '../src/data/bases.js';
import {buildOutliner} from '../src/ui/shell/outliner.js';

test('region deployment and intelligence commands open planning without silently choosing and spending',()=>{
 const h=game(23);try{
  const commands=regionCommands(h.g,'WE'),log=[];
  for(const id of ['deploy','intel']){
   const a=commands.find(a=>a.id===id);assert.equal(a.disabled,false);assert.ok(a.ui);assert.equal(a.dispatch,undefined);assert.equal(a.confirm,undefined);
   runCommand(a,{ui:x=>log.push(x),dispatch:()=>assert.fail('planning must not spend or deploy')});
  }
  assert.deepEqual(log[0],{deploy:'WE'});assert.equal(log[1].jump.tab,'sitroom');assert.ok(log[1].jump.target);
 }finally{h.done();}
});

test('paid mineral-blocked orders are visible and route to the actual binding input',()=>{
 const h=game(32);try{
  h.g.minerals.queue=[{id:'fa_xx',left:{gallium:500},need:{gallium:500}}];
  const r=buildOutliner(h.g).find(r=>r.id==='supply_fa_xx');
  assert.ok(r);assert.equal(r.group,'builds');assert.match(r.sub,/paid.*Gallium/);
  assert.deepEqual(r.jump,{tab:'resources',sub:'deals',mineral:'gallium'});
 }finally{h.done();}
});

test('production queue resolves its shortage in the correct supplier desk without opening a nation overlay',async()=>{
 const g=await mount(BUNDLES.app,{testHook:true,seed:35});try{
  await g.pickCountry(0);g.answerModal();await flush();await flush();
  g.w.__wl.minerals({queue:[{id:'fa_xx',left:{gallium:500},need:{gallium:500}}]});await flush();
  const row=g.doc.querySelector('[data-queue=builds]');assert.match(row.textContent,/F\/A-XX/);row.click();await flush();await flush();
  assert.equal(g.doc.querySelector('[aria-label="Compare mineral"]').value,'gallium');assert.equal(g.doc.querySelector('[data-sheet]'),null);assert.ok(!g.faulted());
  const selector=g.doc.querySelector('[aria-label="Compare mineral"]');selector.value='titanium';selector.dispatchEvent(new g.w.Event('change',{bubbles:true}));await flush();
  assert.equal(g.doc.querySelector('[aria-label="Compare mineral"]').value,'titanium');
  g.doc.querySelector('[data-outliner-row=supply_fa_xx]').click();await flush();await flush();
  assert.equal(g.doc.querySelector('[aria-label="Compare mineral"]').value,'gallium','repeated remedy restores its named mineral even within the same workspace');
 }finally{g.close();}
});

test('selected base exposes theater deployment; Defense opens orders; crew remedy opens Training',async()=>{
 const g=await mount(BUNDLES.app,{testHook:true,seed:61});try{
  await g.pickCountry(0);g.answerModal();await flush();await flush();
  const click=async sel=>{const el=g.doc.querySelector(sel);assert.ok(el,sel);el.click();await flush();await flush();};
  const choose=async(sel,value)=>{const el=g.doc.querySelector(sel);assert.ok(el,sel);el.value=value;el.dispatchEvent(new g.w.Event('change',{bubbles:true}));await flush();};
  g.w.__wlMap.inspect({kind:'site',id:'pcabello'});await flush();await flush();
  assert.ok(g.doc.querySelector('[data-deployment-orders]'),'base operations expose deployment');
  await choose('[aria-label="Force package"]','fleet:usa:cvn');
  await click('[data-map-deploy="fleet:usa:cvn"]');
  assert.equal(g.w.__wl.dispatched().at(-1),'adjustDeployment');assert.equal(g.w.__wl.assignments()[SITES.pcabello.region]['fleet:usa:cvn'],1);
  await click('[data-sheet-close]');await click('[data-pulse=forces]');
  assert.equal(g.doc.querySelector('[data-forces]').dataset.forcesSub,'deployments');
  await choose('[aria-label="Deployment theater"]','ME');await choose('[aria-label="Force package"]','fleet:usa:cvn');
  await click('[data-map-deploy="fleet:usa:cvn"]');assert.equal(g.w.__wl.assignments().ME['fleet:usa:cvn'],1);
  await click('[data-deployment-training]');assert.equal(g.doc.querySelector('[data-forces]').dataset.forcesSub,'training');
  assert.ok(!g.faulted());
 }finally{g.close();}
});
