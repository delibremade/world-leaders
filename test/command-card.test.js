import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { regionCommands, fleetCommands, budgetCommands, runCommand, REGION_KEYS, FLEET_KEYS, BUDGET_KEYS } from '../src/ui/shell/commands.js';
import { mount, BUNDLES, flush } from './util/harness.js';
import { launch, openGame, settle } from './util/browser.js';

// V2d (docs/DESIGN-SYSTEM-V2.md §4): command cards. Region: Deploy A, Station base S, Influence D, State visit F,
// Sanction Z, Embargo X, Intel op C, Build node V. Escalatory actions are orange and go through the confirm sheet.

const view = (o = {}) => ({ country: { id: 'usa' }, stats: { treasury: 5000 }, nationRelations: { france: 60, germany: 40, uk: 70 }, sanctions: new Set(), embargoes: new Set(), actionCooldowns: {}, influenceAlloc: {}, platforms: {}, platformsImported: {}, blackPrograms: {}, forceDeployments: {}, resExtraction: { oil: 3 }, bases: { nodes: [] }, intelOps: [], sphere: {}, ...o });

test('commands: the region card has the eight v2 actions with their keys; escalatory ones carry a confirm; targets follow the state', () => {
  const v = view();
  const a = regionCommands(v, 'WE');
  assert.deepEqual(a.map((x) => x.id), ['deploy', 'station', 'influence', 'visit', 'sanction', 'embargo', 'intel', 'build']);
  assert.deepEqual(a.map((x) => x.key), ['A', 'S', 'D', 'F', 'Z', 'X', 'C', 'V']); assert.deepEqual(Object.values(REGION_KEYS), a.map((x) => x.key));
  const by = Object.fromEntries(a.map((x) => [x.id, x]));
  assert.deepEqual(a.filter((x) => x.escalate).map((x) => x.id), ['sanction', 'embargo', 'intel'], 'sanction, embargo and intel escalate');
  for (const x of a.filter((x) => x.escalate)) assert.ok(x.confirm && x.confirm.title && x.confirm.label && x.confirm.lines.length, `${x.id} confirms`);
  assert.equal(by.deploy.disabled, true); assert.match(by.deploy.reason, /No free units/);
  assert.equal(by.visit.target, 'United Kingdom', 'best relations, not sanctioned'); assert.deepEqual(by.visit.dispatch, { type: 'stateVisit', payload: { nation: 'uk' } });
  assert.equal(by.influence.dispatch.payload.weight, 1); assert.deepEqual(by.station.ui, { site: 'rota' }); assert.deepEqual(by.build.ui, { build: true, site: 'rota' });
  assert.equal(by.sanction.target, 'Germany', 'the rival great power present'); assert.equal(by.embargo.dispatch.type, 'toggleEmbargo');
  assert.equal(by.intel.dispatch.type, 'runIntelOp'); assert.equal(by.intel.dispatch.payload.op, 'influence', 'cheapest covert op');
  // state changes the card: units free the deploy, a sanction flips to lift (no longer escalatory), cooldown gates the visit, low extraction gates the embargo
  const b = Object.fromEntries(regionCommands(view({ platforms: { carrier_group: 2 }, sanctions: new Set(['germany']), actionCooldowns: { visit_uk: 4 }, resExtraction: { oil: 1 } }), 'WE').map((x) => [x.id, x]));
  assert.equal(b.deploy.disabled, false); assert.deepEqual(b.deploy.dispatch, { type: 'adjustDeployment', payload: { region: 'WE', unit: 'carrier_group', delta: 1 } });
  assert.equal(b.sanction.label, 'Lift sanctions'); assert.equal(b.sanction.escalate, false); assert.equal(b.sanction.confirm, null);
  assert.equal(b.visit.disabled, true); assert.match(b.visit.reason, /cooldown 4mo/);
  assert.equal(b.embargo.disabled, true); assert.match(b.embargo.reason, /Extraction too low/);
  assert.deepEqual(regionCommands(v, 'nope'), []);
});

test('commands: fleet and budget cards; runCommand routes confirm, ui and dispatch', () => {
  const l = { id: 'f22', n: 'F-22', cls: 'airframe', count: 180, cost: 400, blk: 1, modCost: 900, modWhy: '', mx: 100, target: 70 };
  const fl = { modMo: 18, depot: 80, rules: { modShare: 0.2, blkGain: 0.1, mcBlk: 0.05 } };
  const f = fleetCommands(l, fl, 12);
  assert.deepEqual(f.map((x) => x.key), Object.values(FLEET_KEYS)); assert.deepEqual(f.filter((x) => x.escalate).map((x) => x.id), ['retire', 'retireAll']);
  assert.deepEqual(f[1].dispatch, { type: 'retire', payload: { line: 'f22', n: 12 } }); assert.deepEqual(f[3].dispatch, { type: 'setMaintenance', payload: { line: 'f22', pct: 110 } });
  assert.equal(f[0].confirm.kind, 'warn', 'modernize confirms without escalating');
  assert.equal(fleetCommands({ ...l, mx: 150 }, fl, 12)[3].disabled, true);
  const bgt = budgetCommands('defense', 100, { age: 10, treasury: 1000 });
  assert.deepEqual(bgt.map((x) => x.key), Object.values(BUDGET_KEYS)); assert.equal(bgt[2].disabled, true, 'reset off at 100');
  assert.deepEqual(bgt[0].dispatch, { type: 'adjustSectorBudget', payload: { sector: 'defense', delta: 10 } }); assert.equal(bgt[3].disabled, true, 'modernize only when aging');
  const old = budgetCommands('defense', 200, { age: 500, treasury: 1000 }); assert.equal(old[0].disabled, true); assert.equal(old[3].disabled, false); assert.match(old[3].confirm.cost, /\$300M/);
  // runner
  const log = []; const ctx = { dispatch: (d) => log.push(['dispatch', d]), ask: (a) => log.push(['ask', a.kind, a.escalate, a.title]), ui: (u) => log.push(['ui', u]) };
  assert.equal(runCommand({ disabled: true, dispatch: { type: 'x' } }, ctx), false); assert.equal(log.length, 0);
  runCommand(bgt[0], ctx); assert.deepEqual(log.pop(), ['dispatch', bgt[0].dispatch]);
  runCommand(regionCommands(view(), 'WE')[7], ctx); assert.deepEqual(log.pop(), ['ui', { build: true, site: 'rota' }]);
  runCommand(old[3], ctx); assert.deepEqual(log.pop(), ['ask', 'alert', true, 'Great Modernization · 🛡️ Defense']);
  runCommand(f[0], ctx); assert.deepEqual(log.pop(), ['ask', 'warn', false, 'F-22: block 2 upgrade']);
});

test('App (jsdom): region card opens on selection; F visits, Z opens an orange confirm then sanctions; Forces and Budget cards drive their verbs by key', async () => {
  const origErr = console.error; console.error = () => {};
  const g = await mount(BUNDLES.app, { testHook: true, seed: 5 });
  try {
    await g.pickCountry(0);
    const { doc, w } = g; const q = (s) => doc.querySelector(s), qa = (s) => [...doc.querySelectorAll(s)];
    [...q('[data-event-card=doctrine]').querySelectorAll('div')].find((d) => d.style.cursor === 'pointer' && /Military Superpower/.test(d.textContent)).click(); await flush();
    const press = async (k) => { doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true })); await flush(); await flush(); };
    const click = async (el) => { el.click(); await flush(); await flush(); };
    w.__wl.region('WE'); await flush(); await flush();
    const card = q('[data-command-card=region]'); assert.ok(card, 'region card'); assert.equal(card.dataset.placement, 'sheet', 'jsdom is narrow: the card tops the region sheet');
    assert.deepEqual(qa('[data-command-card=region] [data-cmd]').map((b) => b.dataset.key), ['A', 'S', 'D', 'F', 'Z', 'X', 'C', 'V']);
    assert.deepEqual(qa('[data-command-card=region] [data-escalate=true]').map((b) => b.dataset.cmd), ['sanction', 'embargo', 'intel']);
    const visitTarget = q('[data-cmd=visit] .wl-cmd-t').textContent;
    await press('f');
    assert.match(q('[data-cmd=visit]').getAttribute('title') || '', /cooldown/i, `F dispatched the state visit to ${visitTarget}; the card now shows the cooldown`);
    await press('z');
    assert.ok(q('[data-confirm]'), 'Z opens the confirm sheet'); assert.match(q('[data-confirm-ok]').className, /wl-btn-alert/, 'escalatory confirm is the alert family');
    await click(q('[data-confirm-ok]'));
    assert.equal(q('[data-cmd=sanction] .wl-cmd-l').textContent, 'Lift sanctions', 'sanctions applied through the verb');
    w.__wl.extract('oil', 3); await flush(); await flush(); // the embargo verb needs oil or gas extraction >= 2
    await press('x'); assert.ok(q('[data-confirm]'), 'X confirms too'); await click(q('[data-confirm-cancel]')); assert.equal(q('[data-confirm]'), null);
    assert.equal(q('[data-cmd=embargo] .wl-cmd-l').textContent, 'Embargo', 'cancel changed nothing');
    await press('v');
    assert.ok(q('[data-site-sheet]'), 'V opens the site sheet in build mode'); assert.equal(q('[data-build-toggle]').getAttribute('aria-pressed'), 'true');
    await click(q('[data-sheet-close]')); assert.equal(q('[data-command-card]'), null, 'card gone with the selection');
    // Forces: select a type, K raises maintenance by 10 through setMaintenance
    g.tabBtn('forces').click(); await flush(); q('[data-seg=equipment]').click(); await flush(); await flush();
    await click(q('[data-line=f22]'));
    assert.ok(q('[data-command-card=fleet]'), 'fleet card'); assert.deepEqual(qa('[data-command-card=fleet] [data-cmd]').map((b) => b.dataset.key), ['M', 'R', 'B', 'K', 'J']);
    const mx = () => +q('[data-line-detail=f22] input[type=range]').value; const m0 = mx();
    await press('k'); assert.equal(mx(), m0 + 10, 'K raised maintenance'); await press('j'); assert.equal(mx(), m0);
    await press('r'); assert.ok(q('[data-confirm]'), 'retire confirms'); assert.match(q('[data-confirm-ok]').className, /wl-btn-alert/); await click(q('[data-confirm-cancel]'));
    // Economy: a budget line opens its card; K raises the allocation through adjustSectorBudget
    g.tabBtn('economy').click(); await flush();
    await click(q('[data-budget-line=defense]'));
    assert.ok(q('[data-command-card=budget]'), 'budget card'); assert.deepEqual(qa('[data-command-card=budget] [data-cmd]').map((b) => b.dataset.key), ['K', 'J', 'N', 'M']);
    const alloc = () => +[...qa('input[type=range]')].find((i) => i.max === '200').value;
    const a0 = alloc(); await press('k'); assert.equal(alloc(), a0 + 10); await press('n'); assert.equal(alloc(), 100);
    assert.equal(q('[data-cmd=modernize]').getAttribute('aria-disabled'), 'true', 'modernize waits for aging');
    // typing never fires a card key
    const inp = doc.createElement('input'); doc.body.appendChild(inp); inp.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'k', bubbles: true })); await flush(); assert.equal(alloc(), 100); inp.remove();
    assert.ok(!g.faulted());
  } finally { console.error = origErr; g.close(); }
});

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const [W, H] of [[1440, 900], [390, 844]]) {
  test(`${W}px: the region card sits ${W >= 900 ? 'bottom-center over the map' : 'at the top of the region sheet'}, every action inside the viewport and tall enough to hit`, async () => {
    const { ctx, page, errors } = await openGame(browser, { svg: true, width: W, height: H });
    try {
      await page.evaluate(() => window.__wl.region('WE')); await settle(page, 800);
      const r = await page.evaluate(() => { const q = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, r: b.right, b: b.bottom, w: b.width, h: b.height }; }; return { card: q('[data-command-card=region]'), map: q('.wl-map-card'), sheet: q('[data-sheet]'), placement: document.querySelector('[data-command-card=region]')?.dataset.placement, btns: [...document.querySelectorAll('[data-command-card=region] [data-cmd]')].map((b) => { const x = b.getBoundingClientRect(); return { h: x.height, x: x.x, r: x.right }; }) }; });
      assert.ok(r.card, 'card rendered'); assert.equal(r.btns.length, 8);
      for (const b of r.btns) assert.ok(b.h >= 44 && b.x >= -0.5 && b.r <= W + 0.5, JSON.stringify(b));
      assert.ok(r.card.x >= -0.5 && r.card.r <= W + 0.5 && r.card.b <= H + 0.5, `card inside ${JSON.stringify(r.card)}`);
      if (W >= 900) { assert.equal(r.placement, 'map'); const cx = (r.card.x + r.card.r) / 2, mx = (r.map.x + r.map.r) / 2; assert.ok(Math.abs(cx - mx) < 4, `centered on the map ${cx} vs ${mx}`); assert.ok(r.card.b <= r.map.b + 0.5 && r.card.b > r.map.y + r.map.h * 0.5, 'in the lower half of the map card'); }
      else { assert.equal(r.placement, 'sheet'); assert.ok(r.card.y >= r.sheet.y - 0.5 && r.card.x >= r.sheet.x - 0.5, 'inside the sheet'); }
      assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}
