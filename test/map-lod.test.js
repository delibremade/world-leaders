import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOD, LOD_IDS, LAYERS, lodFor, layersAt, nameAlpha } from '../src/ui/map/lod.js';

// V2c (docs/DESIGN-SYSTEM-V2.md §3): three zoom levels, each a superset of the last. Strategic shows names and
// sphere chips; Operational adds base and chokepoint names; Tactical adds reach rings and unit detail.

test('lod: three ascending levels; each level keeps every layer of the one below and adds its own', () => {
  assert.deepEqual(LOD_IDS, ['strategic', 'operational', 'tactical']);
  assert.ok(LOD.every((l, i) => i === 0 || l.min > LOD[i - 1].min), 'thresholds ascend');
  for (let i = 1; i < LOD.length; i++) for (const k of LOD[i - 1].layers) assert.ok(LOD[i].layers.includes(k), `${LOD[i].id} keeps ${k}`);
  assert.deepEqual(LOD[1].layers.filter((k) => !LOD[0].layers.includes(k)), ['baseNames', 'chokeNames'], 'operational adds base and chokepoint names');
  assert.deepEqual(LOD[2].layers.filter((k) => !LOD[1].layers.includes(k)), ['rings', 'unitDetail'], 'tactical adds reach rings and unit detail');
  for (const k of ['names', 'chips', 'chokepoints', 'flashpoints', 'lanes']) assert.ok(LOD[0].layers.includes(k), `strategic shows ${k}`);
  assert.equal(new Set(LAYERS).size, LAYERS.length);
});

test('lod: the level follows the viewport scale; layers answer by level or by scale; names fade with zoom', () => {
  assert.equal(lodFor(0.4).id, 'strategic'); assert.equal(lodFor(1).id, 'strategic'); assert.equal(lodFor(1.05).id, 'operational');
  assert.equal(lodFor(1.5).id, 'operational'); assert.equal(lodFor(1.9).id, 'tactical'); assert.equal(lodFor(6).id, 'tactical');
  assert.equal(lodFor(NaN).id, 'strategic'); assert.equal(lodFor(-1).id, 'strategic');
  assert.equal(layersAt(0.5).rings, false); assert.equal(layersAt(0.5).baseNames, false); assert.equal(layersAt(0.5).names, true);
  assert.equal(layersAt(1.2).baseNames, true); assert.equal(layersAt(1.2).rings, false);
  assert.equal(layersAt(2.5).rings, true); assert.equal(layersAt(2.5).unitDetail, true);
  assert.deepEqual(layersAt('tactical'), layersAt(3)); assert.deepEqual(layersAt('nonsense'), layersAt(0));
  assert.equal(nameAlpha(0.5), 1); assert.ok(nameAlpha(2) < nameAlpha(1) && nameAlpha(6) >= 0.35, 'names fade, never vanish');
});
