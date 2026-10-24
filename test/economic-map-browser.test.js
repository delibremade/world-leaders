import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {launch,openGame,settle,overflow} from './util/browser.js';
let browser;before(async()=>{browser=await launch();});after(async()=>{await browser?.close();});
for(const [width,height] of [[1280,800],[1440,900],[1920,1080],[390,844]]){
 test(`${width}px: civilian city selection, funding, food support and processing links stay connected`,async()=>{
  const {ctx,page,errors}=await openGame(browser,{width,height});
  const fits=async()=>{const o=await overflow(page,width);assert.equal(o.scrollWidth,width);assert.deepEqual(o.bad,[]);};
  const browse=async()=>{if(width<1100){await page.locator('[data-browse-hubs]').click();await settle(page);}};
  try{
    await page.locator('[data-seg=nation]').click();await page.locator('[data-nation-economy]').click();
    await page.waitForFunction(()=>window.__wlMap?.renderer==='pixi'&&window.__wlMap.scene().mode==='economy');await settle(page);
    assert.equal(await page.locator('[data-build-toggle]').count(),0);
    assert.equal(await page.evaluate(()=>window.__wlMap.scene().hubs.length),25);
    await fits();
    // Use real canvas hit-testing, not a selection hook. Every cluster remains addressable.
    const hit=await page.evaluate(()=>{const m=window.__wlMap,box=document.querySelector('canvas').getBoundingClientRect();for(const h of m.visibleHubs()){const p=m.screenPoint(h.x,h.y);if(p.x>25&&p.x<box.width-25&&p.y>60&&p.y<box.height-110)return {x:box.x+p.x,y:box.y+p.y,ids:h.ids};}return null;});
    assert.ok(hit,'at least one civilian marker is visible clear of map chrome');
    await page.mouse.click(hit.x,hit.y);await settle(page);
    assert.equal(await page.locator('[data-economic-inspector]').count(),1);
    if(hit.ids.length>1)assert.equal(await page.locator('[data-locate-hub]').count(),hit.ids.length);
    else assert.match(await page.locator('[data-economic-inspector]').innerText(),/National controls/);
    if(width<1100){await page.locator('[data-sheet-close]').click();await page.locator('[data-sheet]').waitFor({state:'detached'});}
    else await page.getByLabel('Clear city selection').click();
    await page.getByLabel('Economic sector',{exact:true}).selectOption('technology');await browse();
    await page.getByLabel('Find a city or economic activity').fill('Seattle');await page.locator('[data-locate-hub=seattle]').click();await settle(page);
    assert.match(await page.locator('[data-economic-inspector] h3').innerText(),/Seattle/);
    await fits();
    const slider=page.locator('[data-economic-inspector] [data-sector=technology]');await slider.focus();await page.keyboard.press('End');await settle(page);
    assert.equal(await slider.inputValue(),'200');
    await page.locator('[data-economy-budget]').click();await settle(page);await page.locator('[data-sheet]').waitFor({state:'detached'});
    assert.equal(await page.locator('[data-sector=technology]').inputValue(),'200','one national budget shared by map and Economy');
    await page.locator('[data-open-economic-map]').click();await settle(page);
    await page.getByLabel('Economic sector',{exact:true}).selectOption('food');await browse();
    await page.locator('[data-locate-hub=central_valley]').click();await settle(page);
    await page.locator('[data-economic-food]').click();await settle(page);
    assert.equal(await page.locator('[data-economic-food]').getAttribute('aria-pressed'),'true');await fits();
    if(width<1100){await page.locator('[data-sheet-close]').click();await page.locator('[data-sheet]').waitFor({state:'detached'});}
    await page.getByLabel('Economic sector',{exact:true}).selectOption('industry');await browse();
    await page.getByLabel('Find a city or economic activity').fill('Detroit');await page.locator('[data-locate-hub=detroit]').click();
    await page.locator('[data-economy-route=processing]').click();await settle(page);await page.locator('[data-sheet]').waitFor({state:'detached'});
    assert.equal(await page.locator('[data-seg=processing]').getAttribute('aria-selected'),'true');await fits();
    assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
 });
}
