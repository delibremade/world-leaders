import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {launch,openGame,settle,overflow} from './util/browser.js';
let browser;before(async()=>{browser=await launch();});after(async()=>{await browser?.close();});
for(const [width,height] of [[1280,800],[1440,900],[1920,1080],[390,844]]){
 test(`${width}px: facility orders, chosen destinations, assignments, supply remedies and intelligence stay connected`,async()=>{
  const {ctx,page,errors}=await openGame(browser,{width,height,svg:true});
  try{
   const fits=async()=>{const o=await overflow(page,width);assert.equal(o.scrollWidth,width);assert.deepEqual(o.bad,[]);};
   if(width>=1100){await page.getByLabel('Find a base or host nation').fill('Puerto Cabello');await page.locator('[data-map-inspector] .wl-map-row').click();}
   else{await page.locator('svg [data-region=SA]').click();await page.locator('[data-site-row=pcabello]').click();}
   await settle(page);assert.equal(await page.locator('[data-deployment-orders=SA]').count(),1);
   await page.getByLabel('Force package',{exact:true}).selectOption('fleet:usa:cvn');
   if(width>=1100){
    const visible=await page.locator('[data-map-deploy="fleet:usa:cvn"]').evaluate(el=>{const b=el.getBoundingClientRect(),p=el.closest('.wl-operations-scroll').getBoundingClientRect();return {inside:b.top>=p.top&&b.bottom<=p.bottom,clickable:el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))};});
    assert.deepEqual(visible,{inside:true,clickable:true},'base Deploy must be fully visible before automatic action scrolling');
   }
   await page.locator('[data-map-deploy="fleet:usa:cvn"]').click();await settle(page);
   assert.equal(await page.evaluate(()=>window.__wl.assignments().SA['fleet:usa:cvn']),1);
   await page.getByLabel('Mission posture',{exact:true}).selectOption('escort');await settle(page);
   await page.locator('[data-map-recall="fleet:usa:cvn"]').click();await settle(page);
   assert.match(await page.locator('.wl-deployment-stock').innerText(),/0 here/);
   await fits();
   if(width<1100)await page.locator('[data-sheet-close]').click();
   await page.locator('[data-pulse=forces]').click();await settle(page);
   assert.equal(await page.getByLabel('Deployment theater').inputValue(),'','no silent East Asia destination');
   await page.getByLabel('Deployment theater').selectOption('ME');await page.getByLabel('Force package',{exact:true}).selectOption('fleet:usa:cvn');
   await page.getByLabel('Deployment theater').selectOption('EA');await settle(page);
   assert.equal(await page.getByLabel('Force package',{exact:true}).inputValue(),'fleet:usa:cvn','changing destination retains the chosen force');
   await page.getByLabel('Deployment theater').selectOption('ME');
   await page.locator('[data-map-deploy="fleet:usa:cvn"]').click();await settle(page);
   assert.equal(await page.evaluate(()=>window.__wl.assignments().ME['fleet:usa:cvn']),1);
   assert.equal(await page.locator('[data-assignment-region=ME]').count(),1);
   await fits();
   await page.locator('[data-deployment-map]').click();await settle(page);
   assert.equal(await page.locator('[data-deployment-orders=ME]').count(),1);
   assert.equal(await page.getByLabel('Force package',{exact:true}).inputValue(),'fleet:usa:cvn','map retains the chosen force');
   await fits();
   await page.locator('[data-deployment-training]').click();await settle(page);
   assert.equal(await page.locator('[data-forces]').getAttribute('data-forces-sub'),'training');
   assert.equal(await page.locator('[data-sheet]').count(),0,'context links close the prior phone sheet');
   await page.evaluate(()=>window.__wl.minerals({queue:[{id:'fa_xx',left:{gallium:500},need:{gallium:500}}]}));
   await page.locator('[data-nav] [data-tab=overview]').click();await settle(page);
   assert.match(await page.locator('[data-queue=builds]').innerText(),/F\/A-XX/);
   await page.locator('[data-queue=builds]').click();await settle(page);
   assert.equal(await page.getByLabel('Compare mineral').inputValue(),'gallium');
   await page.getByLabel('Compare mineral').selectOption('titanium');
   if(width<1100)await page.locator('[data-alert-chip=good]').click();
   await page.locator('[data-outliner-row=supply_fa_xx]').click();await settle(page);
   assert.equal(await page.getByLabel('Compare mineral').inputValue(),'gallium','repeated shortage link restores its input');
   await fits();
   await page.locator('[data-nav] [data-tab=overview]').click();await settle(page);
   await page.evaluate(()=>window.__wl.region('WE'));await settle(page);
   const before=await page.evaluate(()=>window.__wl.dispatched().length);
   await page.locator('[data-cmd=intel]').click();await settle(page);
   assert.equal(await page.locator('[data-covert-desk]').count(),1);
   assert.equal(await page.getByLabel('Foreign target').inputValue(),'germany');
   assert.equal(await page.evaluate(()=>window.__wl.dispatched().length),before,'planning does not buy an arbitrary mission');
   await fits();assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
 });
}
