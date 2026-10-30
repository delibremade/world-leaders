import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NATIONS} from '../src/data/nations.js';
import {ORBAT} from '../src/data/orbat.js';
import {FLEET_PACKAGES, deploymentIds} from '../src/data/deployment-catalog.js';
import {servicesFor,serviceMeta,unitService,unitProfile,lineService,sofService,sofCommand} from '../src/data/services.js';
import {PACKAGE_TEMPLATES,templatesFor,templateCandidates} from '../src/data/force-package-templates.js';

test('service ownership is distinct from operating domain and does not split mixed inventories',()=>{
  assert.equal(unitService('usa','fleet:usa:fa18ef'),'navy');
  assert.equal(unitProfile('usa','fleet:usa:fa18ef').domain,'air');
  assert.equal(unitService('usa','fleet:usa:f35b'),'marines');
  assert.equal(unitService('usa','fleet:usa:usmc_inf_bn'),'marines');
  assert.equal(unitService('usa','fleet:usa:f35c'),'joint');
  assert.match(unitProfile('usa','fleet:usa:f35c').note,/split.*not.*modeled/i);
  assert.equal(unitService('russia','fleet:russia:su30'),'joint');
  assert.equal(unitService('russia','fleet:russia:mr_bde'),'joint');
  assert.equal(lineService('usa','mm3'),'air_force');
  assert.equal(lineService('china','icbm'),'strategic');
  assert.equal(unitService('china','missile_brigade'),'strategic');
  assert.equal(unitService('japan','fleet:japan:p1'),'navy');
  assert.equal(unitService('norway','fleet:norway:p8'),'air_force');
  assert.equal(unitService('usa','fa_xx'),'navy');
  assert.equal(unitService('usa','mq25'),'navy');
});

test('every registered force line has a country-appropriate owner; unsupported services grant no inventory',()=>{
  const before=JSON.stringify(ORBAT);
  for(const [nid,n] of Object.entries(NATIONS).filter(([,n])=>n.play)){
    const ids=servicesFor(nid).map(s=>s.id);
    assert.equal(new Set(ids).size,ids.length);
    for(const l of ORBAT[nid])assert.ok(ids.includes(lineService(nid,l)),`${nid}:${l.id}`);
    for(const id of deploymentIds(nid))assert.ok(serviceMeta(nid,unitService(nid,id)),`${nid}:${id}`);
  }
  assert.match(serviceMeta('japan','army').name,/Ground Self-Defense/);
  assert.match(serviceMeta('germany','air_force').name,/Luftwaffe/);
  assert.equal(serviceMeta('usa','coast_guard').coverage,'not-modeled');
  assert.match(serviceMeta('usa','space').note,/inventory.*not.*modeled/i);
  assert.equal(Object.values(FLEET_PACKAGES).some(p=>unitService(p.nid,p.id)==='coast_guard'),false);
  assert.equal(JSON.stringify(ORBAT),before);
  assert.deepEqual(servicesFor('not-a-nation'),[]);
});

test('special operations retain service ownership under joint tasking',()=>{
  assert.equal(sofService('usa','cag'),'army');
  assert.equal(sofService('usa','devgru'),'navy');
  assert.equal(sofService('usa','sts24'),'air_force');
  assert.equal(sofService('usa','marsoc'),'marines');
  assert.match(sofCommand('usa','cag'),/JSOC/);
  assert.equal(sofService('russia','alpha'),'security');
  assert.equal(sofService('russia','vdv45'),'airborne');
  assert.equal(sofService('brazil','t1'),'joint');
});

test('package templates draw compatible existing units and preserve absent capability gaps',()=>{
  for(const nid of Object.keys(NATIONS).filter(id=>NATIONS[id].play)){
    const allowed=new Set(deploymentIds(nid));
    for(const t of templatesFor(nid)){
      assert.equal(PACKAGE_TEMPLATES[t.id],t);
      assert.ok(t.missions.includes(t.defaultMission));
      for(const slot of templateCandidates(nid,t.id)){
        assert.ok(Number.isInteger(slot.count)&&slot.count>0);
        assert.equal(new Set(slot.candidates).size,slot.candidates.length);
        assert.ok(slot.candidates.every(id=>allowed.has(id)));
      }
    }
  }
  const carrier=templateCandidates('usa','carrier_strike');
  const aviation=carrier.find(s=>s.id==='air_wing');
  assert.ok(aviation.required);
  assert.ok(aviation.candidates.includes('fleet:usa:fa18ef'));
  assert.ok(aviation.candidates.includes('fleet:usa:f35c'));
  assert.ok(!aviation.candidates.includes('fleet:usa:f35a'));
  assert.ok(!aviation.candidates.includes('fleet:usa:f35b'));
  assert.ok(templateCandidates('china','carrier_strike').find(s=>s.id==='air_wing').candidates.every(id=>!FLEET_PACKAGES[id]));
  const marine=templateCandidates('usa','marine_expeditionary');
  assert.ok(marine.find(s=>s.id==='landing_force').candidates.includes('fleet:usa:usmc_inf_bn'));
  assert.ok(!marine.find(s=>s.id==='landing_force').candidates.includes('fleet:usa:ibct'));
  assert.deepEqual(templateCandidates('usa','not-a-template'),[]);
  assert.equal(PACKAGE_TEMPLATES.detachment.initial,false);
});
