import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAlerts, FAMILIES, FAMILY_IDS } from '../src/ui/shell/alerts.js';
import { buildOutliner, KINDS } from '../src/ui/shell/outliner.js';
import { mount, BUNDLES, flush } from './util/harness.js';

// V2b top bar (docs/DESIGN-SYSTEM-V2.md §4): tooltip tables on every well, sourced from engine categories; alert chips
// per family that focus the outliner rows and switch the map mode; pause remembers its speed; speed pips.

test('alerts: every outliner row carries a kind; chips gather rows per family with the map mode of that family', () => {
  const rows = buildOutliner({
    flashpoint: { rid: 'ME', type: 'coup', t: 3 }, worldEvent: { id: 'hormuz_closure', mo: 4 }, blockades: { EA: { target: 'china' } },
    intelOps: [{ id: 'x', opId: 'tech_acq', targetId: 'china', monthsLeft: 2, successRate: 0.7, discoverRate: 0.2 }], investigations: { debt: 1 },
    platformDev: { frigate: { mo: 5 } }, defResearch: { cyber: 4 }, defLevels: { cyber: 2 }, gracePeriod: 6, pariah: 3, hegHold: 10, embargoedBy: { by: 'russia', mo: 5 }, blocLock: { eu: 9 },
    actionCooldowns: { visit_france: 3 }, issues: [{ type: 'debt_sustainability', status: 'unexamined', ttl: 2 }],
  });
  for (const r of rows) assert.ok(KINDS.includes(r.kind), `${r.id} kind ${r.kind}`);
  const chips = buildAlerts(rows);
  assert.deepEqual(chips.map((c) => c.family), FAMILY_IDS, 'one chip per family, in family order');
  const by = Object.fromEntries(chips.map((c) => [c.family, c]));
  assert.deepEqual(by.situation.rowIds, ['fp', 'bl_EA'], 'flashpoint and blockade are situations'); assert.equal(by.situation.mode, 'tension'); assert.equal(by.situation.urgent, true);
  assert.deepEqual(by.brief.rowIds.sort(), ['inv_debt', 'iss_debt_sustainability', 'x'], 'ops, briefs and investigations are briefs'); assert.equal(by.brief.mode, 'intel');
  assert.deepEqual(by.chokepoint.rowIds, ['we', 'pariah', 'embby', 'bloc_eu'], 'a chokepoint event, pariah, embargo and a frozen bloc are locks'); assert.equal(by.chokepoint.mode, 'energy');
  assert.deepEqual(by.good.rowIds, ['dev_frigate', 'rd_cyber', 'grace', 'heg', 'cd_visit_france'], 'builds, research and plain timers'); assert.equal(by.good.mode, 'sphere');
  assert.equal(by.situation.count, 2); assert.equal(by.situation.label, 'situations'); assert.equal(by.brief.count, 3);
  for (const c of chips) assert.ok(c.title && c.icon === FAMILIES[c.family].icon, c.family);
  // a disrupted chokepoint is a lock even without an outliner row; nothing live means no chips
  const cut = buildAlerts([], { chokeStatus: { hormuz: 'disrupted', suez: 'open' } });
  assert.equal(cut.length, 1); assert.equal(cut[0].family, 'chokepoint'); assert.equal(cut[0].count, 1); assert.match(cut[0].title, /Hormuz.*cut/); assert.deepEqual(cut[0].rowIds, []);
  assert.deepEqual(buildAlerts([]), []);
});

test('App: wells open tooltip tables from engine categories; an alert chip focuses its outliner rows and switches the map mode; pause remembers the speed', async () => {
  const origErr = console.error; console.error = () => {};
  const g = await mount(BUNDLES.app, { testHook: true, seed: 11 });
  try {
    await g.pickCountry(0);
    const { doc, w } = g;
    const q = (s) => doc.querySelector(s), qa = (s) => [...doc.querySelectorAll(s)];
    q('[data-doctrine=fortress]').click(); await flush();
    await g.advance(2);
    // three wells, each a tooltip table: title, subtitle, 2-column rows, a total row
    assert.deepEqual(qa('[data-hud] [data-well]').map((e) => e.getAttribute('data-well')), ['treasury', 'stability', 'hegemony']);
    const open = async (sel) => { q(sel).click(); await flush(); await flush(); const t = q('[data-why-content] [data-tooltip-table]'); assert.ok(t, `${sel} table`); return t; };
    const close = async () => { w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); doc.body.click(); await flush(); await flush(); };
    let t = await open('[data-well=treasury]');
    assert.match(q('[data-why-content] h5').textContent, /Treasury/); assert.match(q('[data-why-subtitle]').textContent, /Income \$.* · spending \$.* · net/);
    const terms = [...t.querySelectorAll('tbody tr[data-term]')];
    assert.ok(terms.length >= 3, `ledger rows ${terms.length}`);
    for (const tr of terms) assert.equal(tr.children.length, 2, 'two columns');
    const labels = terms.map((tr) => tr.getAttribute('data-term'));
    for (const k of ['Taxes', 'Sector budgets']) assert.ok(labels.includes(k), `engine category ${k}`);
    assert.match(t.querySelector('tfoot [data-total]').textContent, /Net \/ month/);
    await close();
    t = await open('[data-well=hegemony]');
    assert.deepEqual([...t.querySelectorAll('tbody tr[data-term]')].map((tr) => tr.getAttribute('data-term')).sort(), ['economic', 'influence', 'military', 'technology']);
    assert.match(q('[data-why-subtitle]').textContent, /hold 85% for 24 months/);
    await close();
    // alert chips: a flashpoint is a situation chip; clicking it opens the outliner on that row and maps tension
    assert.equal(q('[data-alert-chip=situation]'), null, 'no situation yet');
    w.__wl.flashpoint('ME', 'coup', 5); await flush(); await flush();
    const chip = q('[data-alert-chip=situation]'); assert.ok(chip, 'situation chip'); assert.match(chip.textContent, /1situation/); assert.equal(chip.getAttribute('data-urgent'), 'true');
    g.tabBtn('economy').click(); await flush();
    chip.click(); await flush(); await flush();
    assert.equal(q('[data-tab=overview]').getAttribute('aria-current'), 'page', 'back on the map');
    assert.equal(q('[data-map]').getAttribute('data-map-mode'), 'tension', 'map mode follows the family');
    assert.equal(q('[data-outliner]').getAttribute('data-open'), 'true'); assert.equal(q('[data-outliner]').getAttribute('data-focus-family'), 'situation');
    assert.equal(q('[data-outliner-row=fp]').getAttribute('data-focus'), 'true', 'flashpoint row focused');
    assert.equal(q('[data-alert-chip=situation]').getAttribute('aria-pressed'), 'true');
    // a chokepoint event is a lock chip; the lock chip maps energy
    w.__wl.event('hormuz_closure', 6); await flush(); await flush();
    const lock = q('[data-alert-chip=chokepoint]'); assert.ok(lock, 'lock chip'); lock.click(); await flush(); await flush();
    assert.equal(q('[data-map]').getAttribute('data-map-mode'), 'energy'); assert.equal(q('[data-outliner-row=we]').getAttribute('data-focus'), 'true');
    assert.equal(q('[data-outliner-row=fp]').getAttribute('data-focus'), null, 'previous focus cleared');
    // pause remembers the speed: 4x, pause, resume -> 4x; pips mark the live speed
    const pip = (v) => q(`[data-speed] [data-pip="${v}"]`);
    pip(4).click(); await flush(); assert.equal(pip(4).getAttribute('aria-pressed'), 'true');
    q('[data-pause]').click(); await flush(); assert.match(q('[data-pause]').textContent, /▶ 4×/); assert.equal(q('[data-pause]').getAttribute('data-resume-speed'), '4');
    assert.equal(pip(4).getAttribute('aria-pressed'), 'false', 'no pip lit while paused');
    q('[data-pause]').click(); await flush(); assert.equal(pip(4).getAttribute('aria-pressed'), 'true', 'resumes at 4x');
    assert.ok(!g.faulted());
  } finally { console.error = origErr; g.close(); }
});
