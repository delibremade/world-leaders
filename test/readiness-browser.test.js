import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {launch,openGame,settle,overflow} from './util/browser.js';
let browser;before(async()=>{browser=await launch();});after(async()=>{await browser?.close();});
for(const [width,height] of [[1280,800],[1440,900],[390,844]]){
 test(`${width}px: complete briefing, F/A-XX acquisition and supplier assessment remain usable`,async()=>{
  const {ctx,page,errors}=await openGame(browser,{width,height,svg:true});
  try{
   await page.evaluate(()=>window.__wl.decision('crew_shortfall','Sea needs qualified personnel for newly ordered hulls'));
   await page.evaluate(()=>window.__wl.event('panama_drought',6));
   await settle(page);
   if(width>=1100){
    for(const card of await page.locator('[data-card-summary]').all()){
     const geometry=await card.evaluate(el=>{const r=el.getBoundingClientRect(),d=el.closest('[data-dock]').getBoundingClientRect();const b=el.querySelector('[data-review-card]'),q=b.getBoundingClientRect();return {top:r.top,bottom:r.bottom,dockTop:d.top,dockBottom:d.bottom,clickable:b.contains(document.elementFromPoint(q.x+q.width/2,q.y+q.height/2)),options:el.querySelectorAll('.wl-opt').length};});
     assert.ok(geometry.top>=geometry.dockTop&&geometry.bottom<=geometry.dockBottom,JSON.stringify(geometry));assert.ok(geometry.clickable);assert.equal(geometry.options,0);
    }
   }else{
    assert.ok(await page.locator('[data-event-cards]').evaluate(el=>el.getBoundingClientRect().height<180),'compact cards leave room for the phone workspace');
   }
   await page.locator('[data-review-card=decision]').click();
   const reader=page.locator('[data-decision-dialog]');await reader.locator('.wl-opt').last().scrollIntoViewIfNeeded();
   assert.equal(await reader.locator('.wl-opt').count(),3);await page.locator('[data-decision-close]').click();
   await page.locator('[data-nav] [data-tab=arsenal]').click();await settle(page);
   await page.locator('[data-open-faxx]').click();await settle(page);
   assert.ok(await page.locator('[data-platform=fa_xx]').count());
   await page.evaluate(()=>{window.__wl.fund(1000000);window.__wl.levels({aircraft:7,naval:7,propulsion:7});});await settle(page);
   await page.locator('[data-platform=fa_xx]').getByRole('button',{name:/Develop/}).click();await settle(page);
   assert.match(await page.locator('[data-platform=fa_xx]').innerText(),/24mo left/);
   await page.evaluate(()=>window.__wl.platforms({fa_xx:1}));await settle(page);
   await page.locator('[data-procurement-deploy=fa_xx]').click();await settle(page);
   assert.match(await page.locator('[data-platform=fa_xx]').innerText(),/1 stationed/);
   await page.locator('[data-nav] [data-tab=resources]').click();await page.locator('[data-seg=deals]').click();await settle(page);
   assert.ok(await page.locator('[data-table=partners] tbody tr').count()>2);
   await page.getByLabel('Compare mineral').selectOption('gallium');await settle(page);
   await page.locator('[data-table=partners] tbody tr').filter({hasText:'Japan'}).click();await settle(page);
   await page.locator('[data-sign-offtake=gallium_japan]').click();await settle(page);
   assert.ok(await page.locator('[data-deal=gallium_japan]').count());
   if(width<1100){
    await page.evaluate(()=>window.__wl.region('EA'));await settle(page);
    await page.getByLabel('Force package',{exact:true}).selectOption('fleet:usa:cvn');
    await page.locator('[data-map-deploy="fleet:usa:cvn"]').click();await settle(page);
    assert.match(await page.locator('[data-sheet] .wl-map-unit').innerText(),/1 here/);
    await page.keyboard.press('Escape');await settle(page);
   }
   const o=await overflow(page,width);assert.equal(o.scrollWidth,width);assert.deepEqual(o.bad,[]);assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
 });
}
test('map deploys a starting carrier and recalls the same physical hull',async()=>{
 const {ctx,page,errors}=await openGame(browser,{width:1440,height:900,svg:true});
 try{
  await page.locator('[data-locate-region=EA]').click();await settle(page);
  await page.getByLabel('Force package',{exact:true}).selectOption('fleet:usa:cvn');await settle(page);
  await page.locator('[data-map-deploy="fleet:usa:cvn"]').click();await settle(page);
  assert.match(await page.locator('.wl-map-unit').innerText(),/1 here/);
  await page.locator('[data-map-recall="fleet:usa:cvn"]').click();await settle(page);
  assert.match(await page.locator('.wl-map-unit').innerText(),/0 here/);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
});
