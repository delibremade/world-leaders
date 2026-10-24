import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildOutliner } from '../src/ui/shell/outliner.js';
import { mount, BUNDLES, flush } from './util/harness.js';
import { launch, openGame, settle } from './util/browser.js';

// FIX 2: every outliner row acts. A situation row opens its card in the dock and pans the map to its region; an
// operation row opens that operation's detail on the Intel tab; a timer or cooldown row explains itself inline.

const ACTIONS = new Set(['explain', 'op', 'card', 'jump']);
const FULL = {
  flashpoint: { rid: 'ME', type: 'coup', t: 3 }, worldEvent: { id: 'hormuz_closure', mo: 4 }, blockades: { EA: { target: 'china' } }, ultimatum: { cid: 'russia' },
  intelOps: [{ id: 'x', opId: 'tech_acq', targetId: 'china', monthsLeft: 2, successRate: 0.7, discoverRate: 0.2 }], continuousOps: { 'tech_acq@russia': true }, investigations: { debt: 1 },
  platformDev: { frigate: { mo: 5 } }, blackResearch: { id: 'ngad', mo: 10, prog: 2 }, defResearch: { cyber: 4 }, defLevels: { cyber: 2 }, gracePeriod: 6, pariah: 3, hegHold: 10, embargoedBy: { by: 'russia', mo: 5 }, blocLock: { eu: 9 },
  actionCooldowns: { visit_france: 3 }, issues: [{ type: 'debt_sustainability', status: 'unexamined', ttl: 2 }], sprRelease: true, concessions: { 'suez': { mo: 2 } },
  deployments: [{ id: 'dep1', status: 'active', policyName: 'Austerity', timeMonths: 6, monthsElapsed: 2, issueType: 'debt_sustainability' }],
};

test('buildOutliner: every row carries an explanation and a jump; situation rows name their dock card and region; op rows name their operation', () => {
  const rows = buildOutliner(FULL);
  assert.ok(rows.length >= 15, `rows ${rows.length}`);
  for (const r of rows) { assert.ok(r.explain && r.explain.length > 20, `${r.id} explains itself: ${r.explain}`); assert.ok(r.jump?.tab, `${r.id} jumps somewhere`); }
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(by.fp.jump.card, 'flashpoint'); assert.equal(by.fp.jump.pan, 'ME'); assert.equal(by.fp.jump.region, 'ME'); assert.match(by.fp.explain, /3 months/);
  assert.equal(by.we.jump.card, 'world'); assert.equal(by.we.jump.tab, 'overview'); assert.equal(by.we.jump.pan, 'ME', 'Hormuz sits in the Middle East'); assert.match(by.we.explain, /4 months left/);
  assert.equal(by.x.jump.op, 'x'); assert.equal(by.x.jump.target, 'china'); assert.equal(by.x.jump.tab, 'intel'); assert.match(by.x.explain, /70% success, 20% exposure, 2 months/);
  assert.match(by.cd_visit_france.explain, /3 months before/); assert.match(by.grace.explain, /6 more months/); assert.match(by.heg.explain, /10\/24/);
  assert.match(by.briefing?.explain || by.grace.explain, /months/);
});

test('App (jsdom): each row kind changes UI state when clicked: situation -> dock card focused + region; op -> Intel detail highlighted; timer/cooldown -> inline explanation', async () => {
  const origErr = console.error; console.error = () => {};
  const g = await mount(BUNDLES.app, { testHook: true, seed: 7 });
  try {
    await g.pickCountry(0);
    const { doc, w } = g; const q = (s) => doc.querySelector(s), qa = (s) => [...doc.querySelectorAll(s)];
    q('[data-doctrine=fortress]').click(); await flush();
    await g.advance(1);
    w.__wl.flashpoint('ME', 'coup', 5); w.__wl.event('hormuz_closure', 6);
    w.__wl.ops([{ id: 'op1', opId: 'tech_acq', targetId: 'china', monthsLeft: 3, successRate: 0.6, discoverRate: 0.2 }]); w.__wl.cooldown('visit_france', 3);
    await flush(); await flush();
    const rows = qa('[data-outliner-row]'); assert.ok(rows.length >= 5, `rows ${rows.length}`);
    for (const r of rows) { assert.ok(ACTIONS.has(r.dataset.action), `${r.dataset.outlinerRow} action ${r.dataset.action}`); assert.ok(r.title.length > 20, `${r.dataset.outlinerRow} tooltip`); }
    const row = (id) => q(`[data-outliner-row="${id}"]`);
    const tab = () => qa('[data-tab]').find((b) => b.getAttribute('aria-current') === 'page')?.dataset.tab;
    // situation: flashpoint row -> Overview, flashpoint card focused in the dock, region card open
    g.tabBtn('economy').click(); await flush(); assert.equal(tab(), 'economy');
    assert.equal(row('fp').dataset.action, 'card'); row('fp').click(); await flush(); await flush();
    assert.equal(tab(), 'overview'); assert.equal(q('[data-event-card=flashpoint]').getAttribute('data-focus'), 'true', 'flashpoint card focused');
    assert.equal(q('[data-event-card=world]').getAttribute('data-focus'), null);
    assert.match(q('[data-region-panel]')?.textContent || '', /Middle East/, 'region card opened');
    // world event row -> its card focused instead
    assert.equal(row('we').dataset.action, 'card'); row('we').click(); await flush(); await flush();
    assert.equal(tab(), 'overview'); assert.equal(q('[data-event-card=world]').getAttribute('data-focus'), 'true'); assert.equal(q('[data-event-card=flashpoint]').getAttribute('data-focus'), null);
    // operation row -> Intel tab, that op's detail row highlighted, its target selected
    assert.equal(row('op1').dataset.action, 'op'); row('op1').click(); await flush(); await flush();
    assert.equal(tab(), 'intel'); const opRow = q('[data-op-row=op1]'); assert.ok(opRow, 'op detail row'); assert.equal(opRow.getAttribute('data-focus'), 'true');
    assert.match(opRow.textContent, /60% success/);
    // cooldown and timer rows explain themselves inline; a second click folds the explanation
    for (const id of ['cd_visit_france', 'grace']) {
      const r = row(id); if (!r) { assert.equal(id, 'grace'); continue; }
      assert.equal(r.dataset.action, 'explain'); assert.equal(r.getAttribute('aria-expanded'), 'false'); assert.equal(r.querySelector('[data-explain]'), null);
      r.click(); await flush(); assert.equal(row(id).getAttribute('aria-expanded'), 'true'); assert.match(row(id).querySelector('[data-explain]').textContent, /months/);
      assert.equal(tab(), 'intel', 'an explanation does not navigate');
      row(id).click(); await flush(); assert.equal(row(id).getAttribute('aria-expanded'), 'false');
    }
    assert.ok(!g.faulted());
  } finally { console.error = origErr; g.close(); }
});

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

test('1440px (WebGL): the flashpoint row pans and zooms the map to its region and focuses the card', async () => {
  const { ctx, page, errors } = await openGame(browser, { width: 1440, height: 900 });
  try {
    await page.evaluate(() => document.querySelector('[data-tab=overview]').click()); await settle(page, 600);
    await page.waitForFunction(() => window.__wlMap?.renderer === 'pixi' && window.__wlMap.frames() > 5, null, { timeout: 15000 });
    const before = await page.evaluate(() => ({ scale: window.__wlMap.scale(), x: window.__wlMap.viewport.center.x, y: window.__wlMap.viewport.center.y }));
    await page.evaluate(() => { window.__wl.flashpoint('SA', 'coup', 5); }); await settle(page, 400);
    await page.click('[data-outliner-row=fp]'); await settle(page, 900);
    const after = await page.evaluate(() => ({ scale: window.__wlMap.scale(), x: window.__wlMap.viewport.center.x, y: window.__wlMap.viewport.center.y, focus: document.querySelector('[data-event-card=flashpoint]')?.getAttribute('data-focus') }));
    assert.ok(after.scale >= 1.39, `zoomed in ${before.scale} -> ${after.scale}`);
    assert.ok(Math.hypot(after.x - before.x, after.y - before.y) > 20, `panned ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
    assert.equal(after.focus, 'true');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
