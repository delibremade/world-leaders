// Review artifacts from the same browser and fonts as the gate. Does not deploy anything.
import {mkdir,writeFile} from 'node:fs/promises';
import {launch,openGame,settle,overflow} from '../test/util/browser.js';
const out='reports/ui-captures';await mkdir(out,{recursive:true});const browser=await launch();const results=[];
try{
 for(const width of [1280,1440,1920,390]){
  const {ctx,page,errors}=await openGame(browser,{width,height:width===1920?1080:width===1280?800:900,doctrine:false});
  const shot=async name=>{await settle(page,500);await page.screenshot({path:`${out}/${name}-${width}.png`});results.push({name,width,overflow:await overflow(page,width),errors:[...errors]});};
  try{
   await page.waitForFunction(()=>window.__wlMap?.renderer==='pixi',null,{timeout:20000});await shot('doctrine');
   await page.locator('[data-doctrine=fortress]').click();await settle(page);await page.locator('[data-pause]').click();await shot('world');
   if(width>=1100){await page.getByRole('textbox',{name:'Find a base or host nation'}).fill('Changi');await page.locator('[data-map-inspector] .wl-map-row').first().click();await shot('facility');}
   await page.locator('[data-seg=nation]').click();await shot('nation');
   await page.locator('[data-nation-energy]').click();await page.evaluate(()=>{window.__wl.fund(20000);window.__wl.imports(['oil','gas']);window.__wl.event('panama_drought',6);});await settle(page);
   await page.evaluate(()=>window.__wl.month());await settle(page);
   await page.locator('[data-reserve-fill]').click();await shot('energy');
   await page.locator('[data-review-card=we]').click();await shot('event-reader');await page.locator('[data-decision-close]').click();
   await page.locator('[data-supply-route=panama]').click();await shot('corridor');
   if(width<1100){await page.keyboard.press('Escape');await settle(page);}
   await page.evaluate(()=>window.__wl.decision('crew_shortfall','Sea needs qualified personnel for newly ordered hulls'));await shot('brief-summary');
   await page.locator('[data-review-card=decision]').click();await shot('brief-reader');await page.locator('[data-decision-close]').click();
   await page.locator('[data-nav] [data-tab=resources]').click();await page.locator('[data-seg=deals]').click();await shot('trade-desk');
   await page.locator('[data-nav] [data-tab=arsenal]').click();await page.locator('[data-open-faxx]').click();await shot('faxx-acquisition');
   if(width>=1100){await page.locator('[data-nav] [data-tab=overview]').click();await page.locator('[aria-label="Clear map selection"]').click();await page.locator('[data-map-mode-btn=sphere]').click();await page.locator('[data-locate-region=EA]').click();await page.getByLabel('Force package',{exact:true}).selectOption('fleet:usa:cvn');await shot('starting-carrier');}
  }catch(e){results.push({width,error:String(e)});await page.screenshot({path:`${out}/error-${width}.png`}).catch(()=>{});}
  finally{await ctx.close();}
 }
}finally{await browser.close();await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));}
console.log(JSON.stringify(results));
