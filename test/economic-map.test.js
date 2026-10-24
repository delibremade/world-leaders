import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ECONOMIC_HUBS, ECONOMIC_SECTORS, economicHubs} from '../src/data/economic-hubs.js';
import {economicSectorView} from '../src/sim/economic-view.js';
import {COUNTRIES, NATIONS} from '../src/data/nations.js';
import {newCampaign} from '../src/sim/state.js';
import {buildScene} from '../src/ui/map/scene.js';
import {visibleLayers, layoutSites} from '../src/ui/map/layout.js';
import {calcSCost} from '../src/sim/formulas.js';

test('civilian geography covers every playable opening, West Coast and inland US, without adding nations',()=>{
  for(const c of COUNTRIES) assert.ok(economicHubs(c.id).length>=3,c.id);
  for(const [id,h] of Object.entries(ECONOMIC_HUBS)) {
    assert.ok(NATIONS[h.nation],id);assert.ok(h.x>=0&&h.x<=1000&&h.y>=0&&h.y<=520,id);
    assert.ok(h.sectors.length);for(const k of h.sectors)assert.ok(ECONOMIC_SECTORS[k],`${id}: ${k}`);
  }
  for(const id of ['seattle','portland','bay_area','los_angeles','san_diego','central_valley','phoenix','denver','chicago','detroit','kansas_city','houston'])assert.equal(ECONOMIC_HUBS[id].nation,'usa',id);
  for(const k of Object.keys(ECONOMIC_SECTORS))assert.ok(economicHubs('usa',k).length,k);
  assert.deepEqual(economicHubs('usa','food').map(h=>h.id).filter(id=>id==='central_valley'),['central_valley']);
  assert.equal(economicHubs('not-a-nation').length,0);
});
test('economic lens excludes military assets and only filters real civilian anchors, including clustered selections',()=>{
  const g=newCampaign(COUNTRIES[0]);
  const sc=buildScene({...g,build:true,selectedSite:'norfolk',economicSector:'technology',selectedHub:'seattle'},'economy');
  assert.equal(sc.sites.length,0);assert.equal(sc.rings.length,0);assert.equal(sc.build,false);
  assert.ok(sc.hubs.length);assert.ok(sc.hubs.every(h=>h.nation===g.country.id&&h.sectors.includes('technology')));
  assert.ok(sc.hubs.find(h=>h.id==='seattle').selected);
  assert.ok(sc.regions.every(r=>!r.deployed&&!r.intel&&!r.trend&&!r.hatch&&!r.flashpoint));
  assert.equal(visibleLayers('economy').chokepoints,false);assert.equal(visibleLayers('economy').sites,false);
  const grouped=layoutSites(sc.hubs,{build:true,scale:0.1});
  assert.deepEqual(grouped.flatMap(h=>h.ids).sort(),sc.hubs.map(h=>h.id).sort(),'clustering loses no hub');
});
test('sector readouts are national engine values, not invented city GDP or multiplied budgets',()=>{
  const g=newCampaign(COUNTRIES[0]);g.budgetAlloc.technology=160;
  const before=JSON.stringify(g);
  const v=economicSectorView(g,'technology');
  assert.equal(v.scope,'National');assert.equal(v.budgets[0].value,160);
  assert.equal(v.budgets[0].cost,calcSCost('technology',160,g.sectorMaturity));
  assert.ok(v.routes.some(r=>r.jump.tab==='technology'));
  for(const k of Object.keys(ECONOMIC_SECTORS)) {const s=economicSectorView(g,k);assert.ok(s.metrics.length);assert.ok(s.routes.length);assert.equal(s.scope,'National');}
  assert.equal(JSON.stringify(g),before,'read model never mutates campaign');
});
