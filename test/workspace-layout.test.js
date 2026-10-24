import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { launch, openGame, settle, overflow } from './util/browser.js';
let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const [W,H] of [[1280,800],[1440,900],[1920,1080],[390,844]]) {
  test(`${W}px: workspace controls fit, budget is immediately reachable, reserve updates and supply map opens`, async () => {
    const {ctx,page,errors} = await openGame(browser,{width:W,height:H,svg:false});
    const shot=async name=>{if(process.env.WL_SHOTS){await mkdir(process.env.WL_SHOTS,{recursive:true});await page.screenshot({path:`${process.env.WL_SHOTS}/${name}-${W}.png`});}};
    try {
      assert.match(await page.locator('[data-pulse=forces] .wl-pulse-value').innerText(), new RegExp('^85\\s*Strength / 100$'));
      if(W>=1100){
        const hud=await page.evaluate(()=>({wellRight:Math.max(...[...document.querySelectorAll('[data-wells] [data-why]')].map(e=>e.getBoundingClientRect().right)),pauseLeft:document.querySelector('[data-pause-reason]').getBoundingClientRect().left}));
        assert.ok(hud.wellRight<=hud.pauseLeft,`national figures overlap pause status: ${JSON.stringify(hud)}`);
        const rects=await page.locator('[data-national-pulse],.wl-queue-deck,.wl-mv-stage').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
        for(const r of rects)assert.ok(r.x>=0&&r.y>=0&&r.right<=W&&r.bottom<=H,JSON.stringify(r));
      }
      assert.equal((await overflow(page,W)).scrollWidth,W);
      await shot('overview');
      await page.locator('[data-tab=economy]').click();await settle(page);
      if(W>=1100){const budget=await page.locator('[data-sector-budgets]').boundingBox();assert.ok(budget.y<350,'budget starts above the fold');}
      await page.locator('[data-budget-line=healthcare]').click();await settle(page);
      assert.ok(await page.locator('[data-command-card=budget]').isVisible());
      await shot('economy');
      await page.locator('[data-tab=energy]').click();await settle(page);
      await page.evaluate(()=>window.__wl.fund(10000));await settle(page);
      const fill=page.getByRole('button',{name:/Fill \$200M/});
      await fill.click();await settle(page);
      assert.equal(await page.locator('[data-energy-summary] progress').getAttribute('value'),'1');
      assert.equal((await overflow(page,W)).scrollWidth,W);
      await shot('energy');
      assert.equal(await page.locator('[data-energy-diplomacy]').getAttribute('open'),null);
      await page.locator('[data-energy-diplomacy] summary').click();
      assert.ok(await page.getByRole('button',{name:'⛽ Embargo Germany',exact:true}).isVisible());
      await page.locator('[data-energy-diplomacy] summary').click();
      await page.locator('[data-energy-map]').click();await settle(page);
      assert.equal(await page.locator('[data-map]').getAttribute('data-map-mode'),'energy');
      assert.deepEqual(errors,[]);
    } finally {await ctx.close();}
  });
}
