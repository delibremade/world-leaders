import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {launch,openGame,settle,overflow} from './util/browser.js';
import {CRISIS_STOLEN} from '../src/data/intel.js';
let browser;before(async()=>{browser=await launch();});after(async()=>{await browser?.close();});
for(const [width,height] of [[1280,800],[1440,900],[390,844]]){
 test(`${width}px: Situation launches covert orders, explains locks, responds to crises and exposes complete nuclear records`,async()=>{
  const {ctx,page,errors}=await openGame(browser,{width,height,svg:true});
  try{
   await page.evaluate(()=>{window.__wl.fund(100000);window.__wl.sphere({NA:{player:5,competitors:{germany:90}},WE:{player:5,competitors:{germany:90}}});});await settle(page);
   const home=await page.evaluate(()=>window.__wlMap.scene().regions.find(r=>r.rid==='NA'));
   assert.match(home.line2,/HOME · USA/);assert.equal(home.home,true);assert.equal(home.hatch,false);
   await page.locator('[data-seg=sitroom]').click();await settle(page);
   assert.equal(await page.locator('[data-covert-op]').count(),6);
   await page.locator('[data-covert-target]').selectOption('china');
   await page.locator('[data-covert-op=mole]').click();await settle(page);
   assert.match(await page.locator('[data-covert-assessment]').innerText(),/Requires 3\+ Overseas Stations/);assert.equal(await page.locator('[data-covert-launch]').isDisabled(),true);
   await page.locator('[data-covert-op=influence]').click();await page.locator('[data-covert-launch]').click();await settle(page);
   assert.match(await page.locator('[data-confirm]').innerText(),/influence \+10/);await page.locator('[data-confirm-ok]').click();await settle(page);
   assert.equal(await page.locator('[data-situation-op=influence]').count(),1);assert.equal(await page.locator('[data-covert-launch]').isDisabled(),true);
   await page.locator('[data-covert-posture]').selectOption('expel');await settle(page);
   assert.match(await page.locator('[data-covert-response]').innerText(),/24 months.*Tension \+5/);
   await page.locator('[data-covert-sweep]').click();await settle(page);await page.locator('[data-confirm-ok]').click();await settle(page);
   assert.equal(await page.locator('[data-situation-op=counter_int]').count(),1);assert.equal(await page.locator('[data-covert-sweep]').isDisabled(),true);
   await page.evaluate(()=>{window.__wl.nukes([{actor:'usa',target:'russia',region:'EE',type:'demonstration',mo:9,yr:2026},{actor:'russia',target:'usa',region:'NA',type:'ultimatum',mo:10,yr:2026}]);for(const cid of ['russia','china','iran','north_korea','venezuela','belarus'])window.__wl.setTension(cid,86);});await settle(page);
   assert.ok(await page.locator('[data-situation-issue]').count()>5,'all live issues survive the old five-card limit');
   const panel=page.locator('[data-situation-panel=nukes]');await panel.scrollIntoViewIfNeeded();await settle(page);
   assert.equal(await panel.locator('[data-nuke-entry]').count(),2);
   for(const el of await panel.locator('[data-nuke-entry]').all()){
    await el.scrollIntoViewIfNeeded();const bounds=await el.evaluate(el=>{const r=el.getBoundingClientRect(),p=el.closest('[data-situation-panel]').getBoundingClientRect();return {top:r.top,bottom:r.bottom,pTop:p.top,pBottom:p.bottom,clipped:el.scrollHeight>el.clientHeight+1};});
    assert.ok(bounds.top>=bounds.pTop&&bounds.bottom<=bounds.pBottom,JSON.stringify(bounds));assert.equal(bounds.clipped,false);
   }
   await page.evaluate(responses=>window.__wl.crisis({type:'stolen',targetId:'china',opId:'tech_acq',responses}),CRISIS_STOLEN);await settle(page);
   const dialog=page.locator('[data-decision-dialog]');assert.equal(await dialog.locator('[data-intel-response]').count(),4);
   await page.keyboard.press('Escape');assert.equal(await dialog.count(),1,'required response stays open');
   const last=dialog.locator('[data-intel-response=absorb]');await last.scrollIntoViewIfNeeded();await last.focus();await page.keyboard.press('Tab');
   assert.equal(await page.locator('[data-intel-response=denounce]').evaluate(el=>el===document.activeElement),true,'focus stays in crisis reader');
   await last.click();await settle(page);assert.equal(await page.locator('[data-intel-crisis]').count(),0);
   await page.locator('[data-nav] [data-tab=arsenal]').click();await page.locator('[data-seg=deterrence]').click();await settle(page);
   const register=page.locator('[data-panel=register]');await register.scrollIntoViewIfNeeded();
   assert.equal(await register.locator('[data-nuke-entry]').count(),2);
   assert.equal(await register.locator('.wl-p-title').evaluate(el=>el.scrollWidth>el.clientWidth+1),false,'full nuclear heading wraps in Arsenal too');
   const o=await overflow(page,width);assert.equal(o.scrollWidth,width);assert.deepEqual(o.bad,[]);assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
 });
}
