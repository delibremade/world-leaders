import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCampaign, STATE_FIELDS } from '../src/sim/state.js';
import { COUNTRIES } from '../src/data/nations.js';
import { applyVerb } from '../src/sim/actions.js';
import { runMonth } from '../src/sim/tick.js';
import { setRngSource,mulberry32 } from '../src/sim/rng.js';
import { energySituation, importCost } from '../src/sim/energy-view.js';
const campaign=()=>{const g=newCampaign(COUNTRIES.find(c=>c.id==='germany'));g.doctrine='hegemon';g.gracePeriod=999;g.importContracts=new Set(['oil','gas']);g.bases={nodes:[],agreements:{},ai:{}};g.blocTrade={};g.dominanceLeverage={};return g;};
test('energy: disruption, reserve protection and the actual monthly import bill use the same calculation',()=>{
  const g=campaign();g.worldEvent={id:'hormuz_closure',mo:6};g.chokeStatus={hormuz:'disrupted',suez:'open',bab:'open'};
  const ui={log:[],ledger:{}};const S=new Proxy({},{get:(_,name)=>(v)=>{const k=name[3].toLowerCase()+name.slice(4),box=STATE_FIELDS.includes(k)?g:ui;box[k]=typeof v==='function'?v(box[k]):v;}});
  const fx={toast:()=>{},now:()=>0,defer:f=>f()};setRngSource(mulberry32(17));
  const before=energySituation(g);assert.equal(before.imports,240);assert.equal(before.releaseSavings,80);assert.equal(before.exposed,true);
  const treasury=g.stats.treasury;applyVerb(g,S,fx,{type:'fillReserve'});assert.equal(g.stats.treasury,treasury-200);assert.equal(g.spr,1);
  applyVerb(g,S,fx,{type:'toggleReserveRelease'});assert.equal(energySituation(g).imports,160);
  runMonth(g,S,fx);assert.equal(ui.ledger.Imports,-160);assert.equal(g.spr,0);assert.equal(energySituation(g).shield,false,'an empty reserve cannot shield the next month');
  runMonth(g,S,fx);assert.equal(ui.ledger.Imports,-240);assert.equal(g.sprRelease,false);
});
test('energy: global disruption is not labelled direct exposure for a country whose imports use another route',()=>{
  const g=campaign();g.country=COUNTRIES.find(c=>c.id==='usa');g.chokeStatus={hormuz:'disrupted',panama:'open'};
  assert.equal(energySituation(g).exposed,false);assert.equal(energySituation(g).imports,160);
  g.importContracts=new Set();assert.equal(energySituation(g).imports,0);assert.equal(energySituation(g).releaseSavings,0);
});
test('energy: protection weight includes own and rival bases; discounts and embargoes are preserved',()=>{
  const g=campaign();g.chokeStatus={suez:'secured',bab:'secured',hormuz:'secured'};g.blocTrade={eu:1,cn:1,opec:1};g.embargoedBy={by:'russia',mo:6};
  assert.equal(importCost(g),78); // 160 × .9 × .85 × .9 − 2 × 16, diversified
  const a=energySituation(g).routes.find(r=>r.id==='hormuz');assert.equal(a.weight,0);
});
