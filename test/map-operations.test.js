import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutSites, visibleLayers } from '../src/ui/map/layout.js';
import { buildScene } from '../src/ui/map/scene.js';
import { newCampaign } from '../src/sim/state.js';
import { COUNTRIES } from '../src/data/nations.js';
import { NODE_TYPES, KM_PER_PX } from '../src/data/bases.js';

test('atlas: world view suppresses site clutter; nearby sites form one selectable group; selected sites stay addressable', () => {
  const sites = [{id:'a',x:100,y:100,mine:1},{id:'b',x:101,y:100,mine:0},{id:'c',x:200,y:200,mine:1}];
  assert.equal(layoutSites(sites, {zoom:1,scale:1}).length,0);
  const groups=layoutSites(sites,{zoom:2,scale:1});
  assert.equal(groups.length,2); assert.deepEqual(groups[0].ids,['a','b']);
  const selected=layoutSites(sites.map(s=>({...s,selected:s.id==='b'})),{zoom:1,scale:1});
  assert.equal(selected.length,1); assert.deepEqual(selected[0].ids,['b']);
  assert.equal(layoutSites(sites,{zoom:1,scale:1,build:true}).length,2);
});
test('atlas: lenses isolate relevant networks and coverage is selection-only, including a legal candidate preview', () => {
  assert.equal(visibleLayers('sphere').routes,false);
  assert.equal(visibleLayers('energy').chokepoints,true);
  assert.equal(visibleLayers('intel').chokepoints,false);
  const g=newCampaign(COUNTRIES[0]);
  const normal=buildScene(g,'military'); assert.equal(normal.rings.length,0);
  const chosen=buildScene({...g,selectedSite:'guam'},'military');
  assert.ok(chosen.rings.length>0); assert.ok(chosen.rings.every(r=>r.site==='guam'));
  const preview=buildScene({...g,build:true,selectedSite:'changi',previewType:'naval'},'military');
  assert.ok(preview.rings.some(r=>r.preview&&r.site==='changi'&&r.r===+(NODE_TYPES.naval.reach/KM_PER_PX).toFixed(1)));
  assert.ok(!buildScene({...g,selectedSite:'changi',previewType:'bmd'},'military').rings.some(r=>r.preview),'unsupported type cannot preview');
});
