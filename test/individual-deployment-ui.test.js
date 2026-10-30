import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mount,BUNDLES,flush} from './util/harness.js';

async function campaign(){
 const h=await mount(BUNDLES.app,{testHook:true,seed:731});
 await h.pickCountry(0);h.answerModal();await flush();await flush();
 const q=selector=>h.doc.querySelector(selector);
 const click=async selector=>{const el=q(selector);assert.ok(el,selector);assert.equal(el.disabled,false);el.click();await flush();await flush();};
 const choose=async(selector,value)=>{const el=q(selector);assert.ok(el,selector);el.value=value;el.dispatchEvent(new h.w.Event('change',{bubbles:true}));await flush();await flush();};
 await click('[data-tab=forces]');await click('[data-seg=deployments]');await choose('[aria-label="Deployment theater"]','ME');
 return {h,q,click,choose};
}

test('individual deployment shows the complete humanitarian cost from the same order it executes',async()=>{
 const {h,q,click,choose}=await campaign();try{
  await choose('[aria-label="Force package"]','fleet:usa:c17');
  assert.match(q('[data-map-deploy="fleet:usa:c17"]').textContent,/\$4M\/mo/);
  await choose('[aria-label="Mission posture"]','humanitarian');
  const before=h.w.__wl.assignments().ME?.['fleet:usa:c17']||0;
  assert.match(q('[data-map-deploy="fleet:usa:c17"]').textContent,/\$34M\/mo/);
  assert.equal(h.w.__wl.assignments().ME?.['fleet:usa:c17']||0,before,'reading the cost does not issue an order');
  await click('[data-map-deploy="fleet:usa:c17"]');
  assert.equal(h.w.__wl.assignments().ME['fleet:usa:c17'],before+1);
  const assigned=h.w.__wl.packages().packages.find(p=>p.region==='ME'&&p.template==='detachment'&&p.members['fleet:usa:c17']);
  assert.equal(assigned.posture,'humanitarian');assert.equal(assigned.costMonthly,34);
  await choose('[aria-label="Mission posture"]','deter');
  assert.match(q('[data-map-deploy="fleet:usa:c17"]').textContent,/\$4M\/mo/);
  assert.equal(h.faulted(),false);
 }finally{h.close();}
});

test('individual deployment disables mission-incompatible equipment before an order is submitted',async()=>{
 const {h,q,choose}=await campaign();try{
  await choose('[aria-label="Force package"]','fleet:usa:cvn');await choose('[aria-label="Mission posture"]','humanitarian');
  const deploy=q('[data-map-deploy="fleet:usa:cvn"]'),before=h.w.__wl.dispatched().length;
  assert.equal(deploy.disabled,true);assert.match(q('[data-deployment-block]').textContent,/capability.*mission/);
  deploy.click();await flush();assert.equal(h.w.__wl.dispatched().length,before,'blocked UI does not dispatch an invalid order');
  await choose('[aria-label="Mission posture"]','escort');assert.equal(q('[data-map-deploy="fleet:usa:cvn"]').disabled,false);
  h.w.__wl.forceLine('cvn',{mc:0});await flush();assert.equal(q('[data-map-deploy="fleet:usa:cvn"]').disabled,true);
  assert.match(q('[data-deployment-block]').textContent,/mission-ready/);assert.equal(h.faulted(),false);
 }finally{h.close();}
});

test('Procurement direct deployment quotes the selected destination and blocks incompatible humanitarian orders',async()=>{
 const {h,q,click,choose}=await campaign();try{
  await choose('[aria-label="Mission posture"]','humanitarian');
  h.w.__wl.platforms({carrier_group:1});h.w.__wl.forceLine('cvn',{mc:100});await flush();
  await click('[data-tab=arsenal]');await click('[data-seg=procurement]');
  await choose('[data-platform="carrier_group"] [aria-label="Deploy purchased platform to"]','ME');
  const blocked=q('[data-procurement-deploy="carrier_group"]'),before=h.w.__wl.dispatched().length;
  assert.equal(blocked.disabled,true);assert.match(q('[data-procurement-deployment-block="carrier_group"]').textContent,/capability.*mission/);
  blocked.click();await flush();assert.equal(h.w.__wl.dispatched().length,before);
  await choose('[data-platform="carrier_group"] [aria-label="Deploy purchased platform to"]','EA');
  assert.match(q('[data-procurement-deploy="carrier_group"]').textContent,/\$4M\/mo/);
  await click('[data-procurement-deploy="carrier_group"]');assert.equal(h.w.__wl.assignments().EA.carrier_group,1);
  const assigned=h.w.__wl.packages().packages.find(p=>p.region==='EA'&&p.members.carrier_group);
  assert.equal(assigned.posture,'deter');assert.equal(assigned.costMonthly,4);assert.equal(h.faulted(),false);
 }finally{h.close();}
});
