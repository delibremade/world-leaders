import assert from 'node:assert/strict';
import {settle} from './browser.js';

// Raw equipment remains available through an explicit advanced disclosure. Package orders
// get their own assertions; legacy inventory tests must exercise the real disclosure first.
export async function openIndividualAssets(page){
  const details=page.locator('[data-individual-assets]');
  assert.equal(await details.count(),1,'one contextual individual-asset planner');
  if(await details.getAttribute('open')===null){await details.locator('summary').first().click();await settle(page);}
  return details;
}

export const packageSnapshot=page=>page.evaluate(()=>window.__wl.packages());

export async function selectOperationalPackage(page,pkg){
  const service=page.locator('[data-package-service]');
  if(await service.count()){await service.selectOption(pkg.service);await settle(page);}
  const card=page.locator(`[data-force-package-card="${pkg.id}"]`);
  if(await card.count())await card.click();
  else await page.locator('[data-package-select]').selectOption(pkg.id);
  await settle(page);
}

export async function confirmPackageOrder(page,type){
  await page.locator(`[data-package-review="${type}"]`).click();await settle(page);
  assert.equal(await page.locator('[data-package-quote]').count(),1,'one visible order review');
  assert.ok(await pointerReachable(page.locator('[data-package-confirm]')),`${type} confirmation is fully visible before automatic click scrolling`);
  await page.locator('[data-package-confirm]').click();await settle(page);
}

export async function pointerReachable(locator){
  return locator.evaluate(el=>{
    const r=el.getBoundingClientRect();
    let top=0,bottom=innerHeight;
    for(let p=el.parentElement;p;p=p.parentElement){
      const style=getComputedStyle(p);
      if(/auto|scroll|hidden|clip/.test(style.overflowY)){
        const b=p.getBoundingClientRect();top=Math.max(top,b.top);bottom=Math.min(bottom,b.bottom);
      }
    }
    const cx=r.x+r.width/2,cy=r.y+r.height/2;
    const points=[[cx,cy],[cx,r.top+1],[cx,r.bottom-1],[r.left+1,cy],[r.right-1,cy]];
    return r.top>=top-.5&&r.bottom<=bottom+.5&&r.left>=0&&r.right<=innerWidth+.5
      &&points.every(([x,y])=>el.contains(document.elementFromPoint(x,y)));
  });
}
