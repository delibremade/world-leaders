import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mount,BUNDLES,flush} from './util/harness.js';

test('SVG civilian map: Nation entry, city selection, national food action and sector routing',async()=>{
  const app=await mount(BUNDLES.app,{testHook:true});
  try{
    await app.pickCountry(0);const q=s=>app.doc.querySelector(s);
    q('[data-doctrine=fortress]').click();await flush();q('[data-seg=nation]').click();await flush();
    q('[data-nation-economy]').click();await flush();await flush();
    assert.equal(q('[data-map]').dataset.mapMode,'economy');
    assert.equal(app.doc.querySelectorAll('[data-economic-hub]').length,25);
    assert.equal(q('[data-site]'),null);assert.equal(q('[data-build-toggle]'),null);
    q('[data-economic-hub=seattle]').dispatchEvent(new app.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await flush();
    assert.match(q('[data-economic-inspector]').textContent,/Seattle–Tacoma/);
    assert.match(q('[data-economy-scope]').textContent,/National controls/);
    q('[data-hub-sector=industry]').click();await flush();
    q('[data-economy-route=processing]').click();await flush();
    assert.equal(q('[data-seg=processing]').getAttribute('aria-selected'),'true');
    app.tabBtn('economy').click();await flush();q('[data-open-economic-map]').click();await flush();
    q('[data-economic-hub=central_valley]').dispatchEvent(new app.w.MouseEvent('click',{bubbles:true}));await flush();
    const before=app.w.__wl.dispatched().length;
    q('[data-economic-food]').click();await flush();
    assert.equal(app.w.__wl.dispatched().length,before+1);
    assert.equal(app.w.__wl.dispatched().at(-1),'toggleSocialProgram');
    assert.equal(q('[data-economic-food]').getAttribute('aria-pressed'),'true');
    assert.equal(app.faulted(),false);
  }finally{app.close();}
});
