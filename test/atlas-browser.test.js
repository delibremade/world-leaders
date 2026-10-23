import { test,before,after } from 'node:test';
import assert from 'node:assert/strict';
import { launch,openGame,settle,overflow,appHtml } from './util/browser.js';
let browser;before(async()=>{browser=await launch();});after(async()=>{await browser?.close();});
for(const width of [1440,1920])test(`${width}px: atlas selection, facility preview and construction use the real engine; camera stays in place`,async()=>{
  const {ctx,page,errors}=await openGame(browser,{width,height:width===1440?900:1080});
  try{
    await page.waitForFunction(()=>window.__wlMap?.renderer==='pixi');
    assert.equal(await page.evaluate(()=>window.__wlMap.projection()),1);
    assert.equal(await page.evaluate(()=>window.__wlMap.visibleSites().length),0);
    const frame=await page.locator('.wl-mv-stage').boundingBox();
    await page.getByRole('textbox',{name:'Find a base or host nation'}).fill('Darwin');
    await page.locator('[data-map-inspector] .wl-map-row').first().click();await settle(page,500);
    await page.locator('[data-preview-type=air]').click();await settle(page);
    assert.match(await page.locator('[data-map-inspector]').innerText(),/\$1,000M/);
    assert.ok(await page.evaluate(()=>window.__wlMap.scene().rings.every(r=>r.site==='darwin')));
    assert.deepEqual(await page.locator('.wl-mv-stage').boundingBox(),frame);
    await page.evaluate(()=>window.__wl.fund(10000));await settle(page);
    await page.locator('[data-map-build]').click();await page.locator('[data-confirm-ok]').click();await settle(page,500);
    assert.match(await page.locator('[data-map-inspector]').innerText(),/Construction · 18 months left/);
    assert.equal(await page.locator('[data-map-build]').isDisabled(),true);
    await page.locator('[aria-label="Clear map selection"]').click();await page.locator('[aria-label="Fit the world"]').click();
    // A real canvas hit, not a synthetic selection hook.
    await page.locator('[data-map-mode-btn=energy]').click();await settle(page);
    const hit=await page.evaluate(()=>{const p=window.__wlMap.screenPoint(258,274),r=document.querySelector('canvas').getBoundingClientRect();return{x:r.x+p.x,y:r.y+p.y};});
    await page.mouse.click(hit.x,hit.y);await settle(page,400);
    assert.match(await page.locator('[data-map-inspector] h3').innerText(),/Panama/);
    assert.ok(await page.locator('[data-reserve-fill]').isVisible());
    assert.equal((await overflow(page,width)).scrollWidth,width);assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
});
test('DPR 2: drawing buffer follows pixel density; labels remain at screen size and reduced motion renders',async()=>{
  const ctx=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:2,reducedMotion:'reduce'});const page=await ctx.newPage();
  try{await page.setContent(await appHtml());await page.locator('.cc').first().click();await page.locator('text=Military Superpower').first().click();await page.waitForFunction(()=>window.__wlMap?.renderer==='pixi');
    const density=await page.locator('canvas').evaluate(c=>c.width/c.getBoundingClientRect().width);assert.ok(density>1.9&&density<2.1);
    await page.locator('[data-locate-region=SEA]').click();await settle(page,400);assert.ok(await page.evaluate(()=>window.__wlMap.relativeZoom()>2));
  }finally{await ctx.close();}
});
