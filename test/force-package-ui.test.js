import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mount,BUNDLES,flush} from './util/harness.js';

async function campaign(){
 const g=await mount(BUNDLES.app,{testHook:true,seed:714});
 await g.pickCountry(0);g.doc.querySelector('[data-doctrine=fortress]').click();await flush();
 const q=selector=>g.doc.querySelector(selector);
 const click=async selector=>{const el=q(selector);assert.ok(el,selector);assert.notEqual(el.disabled,true,`${selector} is enabled`);el.click();await flush();await flush();};
 const choose=async(selector,value)=>{const el=q(selector);assert.ok(el,selector);el.value=value;el.dispatchEvent(new g.w.Event('change',{bubbles:true}));await flush();await flush();};
 await click('[data-tab=forces]');await click('[data-seg=deployments]');
 return {g,q,click,choose};
}

test('package orders require review and keep two formations in one theater on separate missions',async()=>{
 const {g,q,click,choose}=await campaign();try{
  assert.equal(g.doc.querySelectorAll('[data-force-package-card]').length,6);
  await click('[data-force-package-card="pkg:1"]');
  assert.match(q('[data-package-composition]').textContent,/carrier|Carrier/);
  await choose('[data-package-destination]','ME');await choose('[data-package-mission]','deter');
  const before=g.w.__wl.dispatched().length;
  await click('[data-package-review="assignForcePackage"]');
  assert.ok(q('[data-package-quote]'));assert.equal(g.w.__wl.dispatched().length,before,'review alone never assigns units');
  await click('[data-package-cancel]');assert.equal(q('[data-package-quote]'),null);assert.equal(g.w.__wl.dispatched().length,before);
  await click('[data-package-review="assignForcePackage"]');await click('[data-package-confirm]');
  assert.equal(g.w.__wl.dispatched().at(-1),'assignForcePackage');
  assert.equal(g.w.__wl.assignments().ME['fleet:usa:cvn'],1);
  await choose('[aria-label="Deployment theater"]','ME');await choose('[aria-label="Force package"]','fleet:usa:cvn');
  assert.equal(q('[data-map-recall="fleet:usa:cvn"]').disabled,true,'an individual recall cannot split an organized package');
  await choose('[aria-label="Mission posture"]','exercise');
  assert.equal(q('[data-package-mission]').value,'deter','individual-asset defaults do not overwrite package missions');
  await click('[data-force-package-card="pkg:4"]');await choose('[data-package-destination]','ME');await choose('[data-package-mission]','escort');
  await click('[data-package-review="assignForcePackage"]');await click('[data-package-confirm]');
  assert.match(q('[data-force-package-card="pkg:4"]').textContent,/Escort/);
  await click('[data-force-package-card="pkg:1"]');assert.equal(q('[data-package-mission]').value,'deter');
  await click('[data-package-review="recallForcePackage"]');await click('[data-package-confirm]');
  assert.equal(g.w.__wl.assignments().ME['fleet:usa:cvn']||0,0);
  assert.match(q('[data-force-package-card="pkg:4"]').textContent,/Assigned/,'recall does not affect another package');
  assert.equal(g.faulted(),false);
 }finally{g.close();}
});

test('service filtering explains missing inventory and assembly reserves actual components',async()=>{
 const {g,q,click,choose}=await campaign();try{
  await choose('[data-package-service]','space');assert.equal(g.doc.querySelectorAll('[data-force-package-card]').length,0);
  assert.match(q('[data-force-package-desk]').textContent,/No matching packages/);
  assert.equal(q('[data-package-review="assignForcePackage"]'),null);
  await choose('[data-package-service]','navy');assert.equal(g.doc.querySelectorAll('[data-force-package-card]').length,3);
  await click('[data-package-assemble-toggle]');await choose('[data-package-template]','carrier_strike');
  await click('[data-package-review="assembleForcePackage"]');
  assert.match(q('[data-package-quote]').textContent,/No equipment is purchased or created/);
  await click('[data-package-confirm]');
  assert.equal(g.w.__wl.dispatched().at(-1),'assembleForcePackage');
  assert.equal(g.doc.querySelectorAll('[data-force-package-card]').length,4);
  assert.match(q('[data-package-inspector]').textContent,/Carrier strike group/);
  assert.equal(g.faulted(),false);
 }finally{g.close();}
});

test('package map connection keeps both selected formation and destination',async()=>{
 const {g,q,click,choose}=await campaign();try{
  await click('[data-force-package-card="pkg:4"]');await choose('[data-package-destination]','ME');
  await click('[data-package-map]');
  assert.ok(q('[data-force-package-desk="compact"]'));
  assert.equal(q('[data-package-select]').value,'pkg:4');
  assert.equal(q('[data-package-destination]').getAttribute('data-package-destination'),'ME');
  const before=g.w.__wl.dispatched().length;
  await click('[data-package-review="assignForcePackage"]');
  assert.equal(g.doc.querySelectorAll('[data-sheet]').length,1,'package review stays inside the existing map inspector');
  assert.equal(g.w.__wl.dispatched().length,before);
  await click('[data-package-confirm]');assert.equal(g.w.__wl.dispatched().at(-1),'assignForcePackage');
  assert.ok(g.w.__wl.assignments().ME);assert.equal(g.faulted(),false);
 }finally{g.close();}
});

test('intelligence support opens an actual collection package with target theater and ISR selected',async()=>{
 const {g,q,click,choose}=await campaign();try{
  await click('[data-tab=overview]');await click('[data-seg=sitroom]');
  await choose('[data-covert-target]','china');await click('[data-intel-assign-support]');
  assert.equal(q('[data-package-destination]').value,'EA');assert.equal(q('[data-package-mission]').value,'isr');
  const selected=g.w.__wl.packages().packages.find(p=>p.id===q('[data-package-inspector]').getAttribute('data-package-inspector'));
  assert.ok(selected.ready);assert.ok(selected.capabilities.includes('isr'),'country collection needs ISR aircraft, not maritime-only submarine reconnaissance');
  assert.equal(q('[data-package-review="assignForcePackage"]').disabled,false);
 }finally{g.close();}
});

test('maintenance remedy preserves the formation and intended mission when returning to orders',async()=>{
 const {g,q,click,choose}=await campaign();try{
  await click('[data-force-package-card="pkg:4"]');await choose('[data-package-destination]','ME');
  await click('[data-package-maintenance]');
  assert.equal(q('[data-forces]').getAttribute('data-forces-sub'),'equipment');
  assert.equal(q('[data-package-context]').getAttribute('data-package-context'),'pkg:4');
  assert.ok(q('[data-line-detail]'),'maintenance focuses a component of the selected package');
  await click('[data-package-return]');
  assert.equal(q('[data-package-inspector]').getAttribute('data-package-inspector'),'pkg:4');
  assert.equal(q('[data-package-destination]').value,'ME');assert.equal(q('[data-package-mission]').value,'escort');
 }finally{g.close();}
});

test('equipment retirement controls protect components reserved by a package at home',async()=>{
 const {g,q,click}=await campaign();try{
  g.w.__wl.forceLine('cvn',{n:1});await flush();
  await click('[data-seg=equipment]');await click('[data-line=cvn]');
  assert.equal(q('[data-retire=cvn]').disabled,true);
  assert.match(q('[data-retire=cvn]').textContent,/Reserved by force packages/);
  assert.equal(q('[data-command-card=fleet] [data-cmd=retire]').getAttribute('aria-disabled'),'true');
  assert.equal(q('[data-retire-all=cvn]'),null,'retire-all does not offer reserved components');
 }finally{g.close();}
});
