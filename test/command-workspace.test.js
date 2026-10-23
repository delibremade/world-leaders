import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount,flush,BUNDLES } from './util/harness.js';

test('Nation connects the shared allocation pool and service outcomes to energy actions and the World inspector',async()=>{
  const g=await mount(BUNDLES.app,{testHook:true});
  try{
    await g.pickCountry(0);const q=s=>g.doc.querySelector(s);const click=async s=>{assert.ok(q(s),s);q(s).click();await flush();await flush();};
    await click('[data-event-card=doctrine] .wl-opt');
    await click('[data-seg=nation]');assert.ok(q('[data-nation-workspace] [data-allocation]'));assert.ok(q('[data-nation-workspace] [aria-label="Public service outcomes"]'));
    await click('[data-lock=healthcare]');const health=+q('[data-sector=healthcare]').value;
    const input=q('[data-sector=defense]');input.value='130';input.dispatchEvent(new g.w.Event('change',{bubbles:true}));await flush();await flush();
    assert.equal(+q('[data-sector=healthcare]').value,health);assert.ok(+q('[data-sector=education]').value<100);
    await click('[data-nation-energy]');assert.ok(q('[data-energy-summary]'));
    g.w.__wl.fund(10000);g.w.__wl.imports(['oil','gas']);await flush();await flush();
    await click('[data-reserve-fill]');await click('[data-reserve-release]');assert.equal(q('[data-reserve-release]').getAttribute('aria-pressed'),'true');
    await click('[data-supply-route=panama]');assert.equal(q('[data-map]').dataset.mapMode,'energy');assert.match(q('[data-sheet]').textContent,/Panama Canal/);assert.ok(q('[data-reserve-release]'));
    await click('[data-sheet-close]');assert.equal(g.faulted(),false);
  }finally{g.close();}
});
