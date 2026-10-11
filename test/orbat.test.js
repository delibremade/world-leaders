import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ORBAT, CREW_RATIOS, MANPOWER, OWNER_PARAMS, UNIT_PLATFORMS, CLASSES, crewOfLine, crewHeads, manpowerCap } from '../src/data/orbat.js';
import { BRANCH_IDS } from '../src/data/forces.js';
import { PLATFORMS, BLACK_PROGRAMS, nationCatalog } from '../src/data/platforms.js';
import { COUNTRIES } from '../src/data/nations.js';

// F7a (#55), spec Part 9: the real 2024 order of battle as data. Engine behavior is F7b; these guard the registry itself.
const sourced = (x) => typeof x?.status_source === 'string' && x.status_source.length > 8;

test('every playable nation has a 2024 order of battle; every line is typed, counted and sourced', () => {
  for (const c of COUNTRIES) {
    const ls = ORBAT[c.id]; assert.ok(Array.isArray(ls) && ls.length >= 4, `${c.id}: no order of battle`);
    const ids = new Set();
    for (const l of ls) {
      const at = `${c.id}.${l.id}`;
      assert.ok(l.id && !ids.has(l.id), `${at}: duplicate or missing id`); ids.add(l.id);
      assert.ok(l.n, `${at}: name`);
      assert.ok(BRANCH_IDS.includes(l.b), `${at}: branch ${l.b}`);
      assert.ok(CLASSES.includes(l.cls), `${at}: class ${l.cls}`);
      assert.ok(CREW_RATIOS[l.role], `${at}: role ${l.role} has no crew ratio`);
      assert.ok(Number.isInteger(l.count) && l.count >= 0, `${at}: count ${l.count}`);
      assert.ok(Number.isFinite(l.mc) && l.mc >= 0 && l.mc <= 100, `${at}: mc ${l.mc}`);
      assert.ok(sourced(l), `${at}: status_source`);
      const cr = crewOfLine(l); assert.ok(cr.sets >= 0 && cr.heads >= 0 && cr.mx >= 0, `${at}: crew`);
      for (const u of l.buys || []) assert.ok(UNIT_PLATFORMS[u], `${at}: buys unknown unit ${u}`);
    }
  }
});

test('the US starts with the real 2024 fleet: every type the spec names, at its real count', () => {
  const us = Object.fromEntries(ORBAT.usa.map((l) => [l.id, l]));
  const near = (id, lo, hi) => { assert.ok(us[id], `usa: no ${id} line`); assert.ok(us[id].count >= lo && us[id].count <= hi, `usa.${id} = ${us[id].count}, want ${lo}..${hi}`); };
  near('f22', 180, 190); near('f35a', 350, 480); near('f35b', 100, 180); near('f35c', 40, 110); near('fa18ef', 450, 620);
  near('f15e', 200, 225); near('f15ex', 1, 20); near('b1b', 44, 46); near('b2a', 19, 20); near('b52h', 72, 76);
  near('kc135', 350, 400); near('kc46', 60, 100); near('e3', 14, 20); near('c17', 220, 223);
  near('cvn', 11, 11); near('ssn', 47, 52); near('ssbn', 14, 14); near('ssgn', 4, 4); near('ddg', 70, 76); near('ffg', 0, 0);
  near('lha_lhd', 9, 10); near('lpd', 12, 14); near('lsd', 6, 10);
  near('abct', 10, 12); near('ibct', 12, 16); near('sbct', 5, 7); near('usmc_inf_bn', 21, 24);
  near('b21', 0, 0); near('f47', 0, 0); near('faxx', 0, 0);
  for (const id of ['b21', 'f47', 'faxx']) assert.ok(us[id].buys?.length, `${id} is a procurement line`);
  // Air, sea and land are all represented, with hulls, airframes and formations.
  for (const cls of ['airframe', 'hull', 'formation']) assert.ok(ORBAT.usa.some((l) => l.cls === cls), cls);
});

test('crew ratios are real ratios with a source: pilots per airframe, crew per hull, maintainers per platform', () => {
  for (const [role, r] of Object.entries(CREW_RATIOS)) {
    assert.ok(sourced(r), `${role}: status_source`);
    assert.ok(r.sets >= 0 && r.heads >= 0 && r.mx >= 0, role);
  }
  assert.equal(CREW_RATIOS.fighter.sets, 1.25, 'USAF fighter crew ratio');
  const us = Object.fromEntries(ORBAT.usa.map((l) => [l.id, l]));
  assert.equal(crewOfLine(us.ssbn).sets, 2, 'SSBNs run Blue and Gold crews');
  assert.ok(crewOfLine(us.cvn).heads >= 2500, 'carrier ship\'s company');
  assert.equal(crewOfLine(us.b52h).heads, 5, 'B-52 crew of five');
  assert.ok(crewHeads(us.f22) > us.f22.count * 1.25, 'pilots plus maintainers');
});

test('manpower is headcounts with recruitable-population parameters; the 2024 force fits its population and crews its fleet', () => {
  for (const c of COUNTRIES) {
    const m = MANPOWER[c.id]; assert.ok(m && sourced(m), `${c.id}: manpower`);
    for (const k of ['pop', 'cohort', 'milAge', 'elig', 'active', 'reserve', 'accessions', 'cohortYears']) assert.ok(Number.isFinite(m[k]) && m[k] > 0, `${c.id}.${k}`);
    assert.ok(m.elig <= 1 && m.cohort < m.milAge && m.milAge < m.pop, `${c.id}: cohort < military age < population`);
    assert.ok(m.active + m.reserve <= manpowerCap(c.id), `${c.id}: 2024 force within its population bound`);
    const need = ORBAT[c.id].filter((l) => !l.reserve).reduce((a, l) => a + crewHeads(l), 0);
    assert.ok(need <= m.active, `${c.id}: fleet needs ${Math.round(need)} heads, active ${m.active}`);
  }
  assert.ok(MANPOWER.usa.active > 1.2e6 && MANPOWER.usa.active < 1.4e6, 'US active ~1.28M');
});

test('owner parameters: B-21 planned buy 200+ (program of record >= 100), F/A-XX active', () => {
  const b = OWNER_PARAMS.b21; assert.ok(sourced(b) && /#55/.test(b.status_source));
  assert.ok(b.plannedBuy >= 200 && b.programOfRecord >= 100 && b.plannedBuy >= b.programOfRecord);
  assert.equal(b.plannedBuy % UNIT_PLATFORMS.b21.per, 0, 'the buy is whole tranches');
  const f = OWNER_PARAMS.faxx; assert.ok(sourced(f) && /#55/.test(f.status_source));
  assert.equal(f.status, 'active'); assert.ok(f.ioc >= 2030 && f.ioc <= 2040);
});

test('procurement adds to existing fleets: units name platforms per unit and a role; each nation buys a unit into at most one line', () => {
  for (const [u, p] of Object.entries(UNIT_PLATFORMS)) {
    assert.ok(PLATFORMS[u] || BLACK_PROGRAMS[u], `${u}: unknown unit`);
    assert.ok(Number.isInteger(p.per) && p.per > 0 && CREW_RATIOS[p.role], u);
  }
  for (const c of COUNTRIES) {
    const seen = {};
    for (const l of ORBAT[c.id]) for (const u of l.buys || []) { assert.ok(!seen[u], `${c.id}: ${u} bought by ${seen[u]} and ${l.id}`); seen[u] = l.id; }
    // Every program the nation's own catalog fields lands in a fleet line (CCA-style drones fly with their host's crews).
    for (const e of nationCatalog(c.id)) if (!BLACK_PROGRAMS[e.id].attachesTo && !e.id.startsWith('x_')) assert.ok(seen[e.id], `${c.id}: catalog ${e.id} has no fleet line`);
  }
});
