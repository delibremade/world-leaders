// Review artifacts from the same browser and fonts as the gate. Does not deploy anything.
import {mkdir,writeFile} from 'node:fs/promises';
import {launch,openGame,settle,overflow} from '../test/util/browser.js';
const out='reports/ui-captures';await mkdir(out,{recursive:true});const browser=await launch();const results=[];
try{
 for(const width of [1280,1440,1920,390]){
  const {ctx,page,errors}=await openGame(browser,{width,height:width===1920?1080:900});
  const shot=async name=>{await settle(page,500);await page.screenshot({path:`${out}/${name}-${width}.png`});results.push({name,width,overflow:await overflow(page,width),errors:[...errors]});};
  try{
   await page.waitForFunction(()=>window.__wlMap?.renderer==='pixi',null,{timeout:20000});await shot('world');
   if(width>=1100){await page.getByRole('textbox',{name:'Find a base or host nation'}).fill('Changi');await page.locator('[data-map-inspector] .wl-map-row').first().click();await shot('facility');}
   await page.locator('[data-seg=nation]').click();await shot('nation');
   await page.locator('[data-nation-energy]').click();await page.evaluate(()=>{window.__wl.fund(20000);window.__wl.imports(['oil','gas']);window.__wl.event('panama_drought',6);});await settle(page);
   await page.evaluate(()=>window.__wl.month());await settle(page);
   await page.locator('[data-reserve-fill]').click();await shot('energy');
   await page.locator('[data-supply-route=panama]').click();await shot('corridor');
  }catch(e){results.push({width,error:String(e)});await page.screenshot({path:`${out}/error-${width}.png`}).catch(()=>{});}
  finally{await ctx.close();}
 }
}finally{await browser.close();await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));}
console.log(JSON.stringify(results));
