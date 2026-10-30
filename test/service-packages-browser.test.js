import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {launch,openGame,settle,overflow} from './util/browser.js';
import {packageSnapshot,selectOperationalPackage,confirmPackageOrder,pointerReachable} from './util/force-packages-browser.js';

let browser;
before(async()=>{browser=await launch();});
after(async()=>{await browser?.close();});

for(const [width,height] of [[1280,800],[1440,900],[1920,1080],[390,844]]){
 test(`${width}px: service packages review whole formations, retain independent missions, rotate and resolve readiness on the map`,async()=>{
  const {ctx,page,errors}=await openGame(browser,{width,height,svg:true});
  const fits=async()=>{
   const o=await overflow(page,width);assert.equal(o.scrollWidth,width);assert.deepEqual(o.bad,[]);assert.deepEqual(errors,[]);
   if(width<900){
    const small=await page.locator('[data-force-package-desk] button, [data-force-package-desk] select, [data-force-package-desk] input').evaluateAll(es=>es.filter(e=>!e.closest('details:not([open])')&&e.getClientRects().length&&e.getBoundingClientRect().height<43.5).map(e=>e.getAttribute('aria-label')||e.textContent));
    assert.deepEqual(small,[],'visible formation controls remain full touch targets');
   }
  };
  const stateOf=async id=>(await packageSnapshot(page)).packages.find(p=>p.id===id);
  try{
   await page.locator('[data-pulse=forces]').click();await settle(page);
   assert.equal(await page.locator('[data-force-package-desk=full]').count(),1);
   assert.equal(await page.locator('[data-individual-assets]').getAttribute('open'),null,'the first view presents formations, with individual equipment available explicitly');
   const initial=await packageSnapshot(page);
   const carrier=initial.packages.find(p=>p.template==='carrier_strike');
   const army=initial.packages.find(p=>p.template==='ground_task_force');
   assert.ok(carrier?.ready,'the US opens with an existing, crewed carrier formation');
   assert.ok(army?.ready,'the US opens with an existing, crewed ground formation');
   assert.equal(carrier.members['fleet:usa:cvn'],1);
   const escorts=carrier.components.filter(c=>['destroyer','cruiser','frigate'].includes(c.role));
   const aviation=carrier.components.filter(c=>c.role==='fighter');
   assert.equal(escorts.reduce((n,c)=>n+c.count,0),2,'carrier formation reserves two actual escorts');
   assert.equal(aviation.reduce((n,c)=>n+c.count,0),2,'carrier formation reserves two actual naval fighter squadrons');
   assert.ok([...escorts,...aviation].every(c=>c.service==='navy'&&carrier.members[c.id]===c.count));

   await selectOperationalPackage(page,carrier);
   const shown=await page.locator('[data-force-package-card]').evaluateAll(es=>es.map(e=>e.dataset.forcePackageCard));
   assert.ok(shown.length>0&&shown.every(id=>initial.packages.find(p=>p.id===id)?.service==='navy'),'service filter uses ownership');
   assert.equal(await page.locator('[data-package-destination]').inputValue(),'','selecting a home formation does not silently choose a theater');
   await page.locator('[data-package-destination]').selectOption('ME');
   await page.locator('[data-package-mission]').selectOption('deter');await settle(page);
   if(width>=1100)assert.ok(await pointerReachable(page.locator('[data-package-review=assignForcePackage]')),'primary package order is visible and pointer reachable without scrolling');
   await page.locator('[data-package-composition] summary').click();
   assert.match(await page.locator('[data-package-composition]').innerText(),/carrier|CVN/i);
   for(const component of carrier.components)assert.ok((await page.locator('[data-package-composition]').innerText()).includes(component.name),`${component.name} is inspectable by its equipment name`);
   await page.locator('[data-package-composition] summary').click();
   const before=await page.evaluate(()=>({orders:window.__wl.dispatched().length,assignments:window.__wl.assignments()}));
   await page.locator('[data-package-review=assignForcePackage]').click();await settle(page);
   assert.match(await page.locator('[data-package-quote]').innerText(),/\$[\d,.]+M\/mo/);
   const quotedCost=Number((await page.locator('[data-package-quote] .wl-package-quote-cost strong').innerText()).replace(/[^\d.]/g,''));
   assert.ok(quotedCost>0,'deployment review exposes its ongoing commitment');
   assert.equal(await page.evaluate(()=>window.__wl.dispatched().length),before.orders,'review has not issued a command');
   assert.deepEqual(await page.evaluate(()=>window.__wl.assignments()),before.assignments,'review reserves no partial formation');
   await page.locator('[data-package-cancel]').click();await settle(page);
   assert.equal((await stateOf(carrier.id)).region,null,'cancel leaves the formation at home');
   await confirmPackageOrder(page,'assignForcePackage');
   assert.equal(await page.evaluate(()=>window.__wl.dispatched().length),before.orders+1,'one atomic command deploys the complete package');
   const deployed=await stateOf(carrier.id);assert.equal(deployed.region,'ME');assert.equal(deployed.posture,'deter');assert.equal(deployed.costMonthly,quotedCost,'the executed formation costs exactly what the review quoted');
   const assignments=await page.evaluate(()=>window.__wl.assignments());
   for(const [unit,count] of Object.entries(carrier.members))assert.equal(assignments.ME[unit],count,`${unit} moves with its formation`);
   await fits();

   await selectOperationalPackage(page,army);
   await page.locator('[data-package-destination]').selectOption('ME');
   await page.locator('[data-package-mission]').selectOption('exercise');
   await confirmPackageOrder(page,'assignForcePackage');
   assert.equal((await stateOf(army.id)).posture,'exercise');
   assert.equal((await stateOf(carrier.id)).posture,'deter','another mission in the same theater retains its orders');

   await selectOperationalPackage(page,carrier);
   await page.locator('[data-package-assembly] summary').click();
   await page.locator('[data-package-template]').selectOption('carrier_strike');
   await page.getByLabel('New package name',{exact:true}).fill('Pacific relief group');
   const priorIds=(await packageSnapshot(page)).packages.map(p=>p.id);
   await confirmPackageOrder(page,'assembleForcePackage');
   const relief=(await packageSnapshot(page)).packages.find(p=>!priorIds.includes(p.id));
   assert.ok(relief?.ready,'a replacement is assembled from remaining ready inventory');
   assert.equal(relief.name,'Pacific relief group');assert.equal(relief.region,null);
   await selectOperationalPackage(page,carrier);
   await page.locator('[data-package-management] summary').click();
   await page.locator('[data-package-replacement]').selectOption(relief.id);
   await page.locator('[data-package-review=rotateForcePackage]').click();await settle(page);
   assert.equal((await stateOf(carrier.id)).region,'ME','rotation review does not recall early');
   assert.equal((await stateOf(relief.id)).region,null,'rotation review does not deploy early');
   await page.locator('[data-package-confirm]').click();await settle(page);
   assert.equal((await stateOf(carrier.id)).region,null);
   assert.equal((await stateOf(relief.id)).region,'ME');assert.equal((await stateOf(relief.id)).posture,'deter');
   assert.equal((await stateOf(army.id)).posture,'exercise');
   assert.equal(await page.evaluate(()=>window.__wl.assignments().ME['fleet:usa:cvn']),1,'rotation never counts both carriers on station');
   await fits();

   await selectOperationalPackage(page,relief);
   await page.locator('[data-package-map]').click();await settle(page);
   assert.equal(await page.locator('[data-force-package-desk=compact]').count(),1);
   assert.equal(await page.locator('[data-package-select]').inputValue(),relief.id,'map keeps the chosen formation');
   assert.equal(await page.locator('[data-package-destination]').getAttribute('data-package-destination'),'ME','map keeps the named destination');
   await confirmPackageOrder(page,'recallForcePackage');
   assert.equal((await stateOf(relief.id)).region,null);
   assert.equal((await stateOf(army.id)).region,'ME','recalling one formation leaves the other mission in place');
   await fits();

   await page.evaluate(()=>window.__wl.forceLine('cvn',{mc:0}));await settle(page);
   assert.equal((await stateOf(relief.id)).ready,false,'zero mission-capable hulls cannot be offered as a ready package');
   assert.equal(await page.locator('[data-package-review=assignForcePackage]').isDisabled(),true);
   assert.match(await page.locator('[data-package-block]').innerText(),/ready|capab|maintenance/i);
   await page.locator('[data-package-maintenance]').click();await settle(page);
   await page.locator('[data-sheet]').waitFor({state:'detached'});
   assert.equal(await page.locator('[data-forces]').getAttribute('data-forces-sub'),'equipment','readiness blocker has a working maintenance route');
   await fits();
  }finally{await ctx.close();}
 });
}
