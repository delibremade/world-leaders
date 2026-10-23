import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount, flush, BUNDLES } from './util/harness.js';

// Q1 (#41), UI acceptance in jsdom: bell + unread badge, feed rows with class/severity/month/jump, jumps open the
// right pane and sheet, per-class routing (toast / feed / pause), and persistence with the autosave.

async function boot() {
  const g = await mount(BUNDLES.app, { testHook: true, seed: 21 });
  await g.pickCountry(0);
  const q = (s) => g.doc.querySelector(s), qa = (s) => [...g.doc.querySelectorAll(s)];
  const settle = async () => { await flush(); await flush(); };
  const openFeed = async () => { q('[data-bell]').click(); await settle(); await settle(); };
  const tapTab = async (id) => { q(`[data-feed-tab=${id}]`).click(); await settle(); };
  const notify = async (phase, text, meta) => { g.w.__wl.phase(phase); g.w.__wl.notify(text, meta); g.w.__wl.phase(null); await settle(); };
  const route = async (cls, r) => { await tapTab('routing'); q(`[data-route-class=${cls}] [data-route=${r}]`).click(); await settle(); };
  return { g, q, qa, settle, openFeed, tapTab, notify, route };
}
const toastText = (g) => [...g.doc.querySelectorAll('div')].filter((d) => d.style.position === 'fixed' && d.style.zIndex === '999').map((d) => d.textContent).join('|');

test('bell shows an unread badge for new notices and clears it when the feed is closed', async () => {
  const { g, q, settle, openFeed, notify } = await boot();
  assert.ok(q('[data-bell]'), 'bell in the HUD'); assert.equal(q('[data-bell-badge]'), null, 'no badge at start');
  await notify('intelOps', '🕵️ Asset placed inside russia'); await notify('statecraft', '🏛️ Embassy established in Germany'); await notify('forces', '🎖️ SEAL Teams: 12 operators graduate');
  assert.equal(q('[data-bell-badge]').textContent, '3'); assert.match(q('[data-bell]').getAttribute('aria-label'), /3 unread/);
  assert.match(toastText(g), /Embassy established/, 'toasts show while the feed is shut');
  await openFeed(); assert.equal(toastText(g), '', 'no popups over the open feed (the rows already show them)');
  assert.equal(g.doc.querySelectorAll('[data-feed-row]').length, 3); assert.equal(g.doc.querySelectorAll('[data-feed-row][data-read=false]').length, 3, 'rows show unread while open');
  g.doc.querySelector('[data-sheet-close]').click(); await settle(); await settle();
  assert.equal(q('[data-bell-badge]'), null, 'closing marks everything read');
  await openFeed(); assert.equal(g.doc.querySelectorAll('[data-feed-row][data-read=true]').length, 3);
});

test('every row has a class, a severity, a month and (unless it is an order) a jump; newest first; same notice folds with a count', async () => {
  const { g, q, qa, settle, openFeed, notify } = await boot();
  await notify('intelOps', '🚨 Intelligence operation discovered! Response required.');
  await notify('economy', '⚠ Treasury is low');
  await notify('world', '🌐 WORLD EVENT: Pandemic');
  await notify('world', '🌐 WORLD EVENT: Pandemic');
  g.w.__wl.notify('📝 Pick a region'); await settle();
  await openFeed();
  const rows = qa('[data-feed-row]');
  assert.deepEqual(rows.map((r) => r.getAttribute('data-class')), ['orders', 'world', 'economy', 'intel'], 'newest first, the repeat folded');
  assert.deepEqual(rows.map((r) => r.getAttribute('data-sev')), ['info', 'info', 'warn', 'alert']);
  for (const r of rows) assert.match(r.textContent, /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w* 2024/i, 'month');
  assert.match(rows[1].textContent, /×2/, 'fold count');
  assert.equal(rows[0].tagName, 'DIV', 'an order with no place has no jump'); assert.equal(rows[1].tagName, 'BUTTON');
  assert.match(q('[data-sheet]').textContent, /4 of 200 kept/);
});

test('jumps: a pane notice opens that pane; a region notice opens the region sheet; a nation notice opens the nation sheet', async () => {
  const { g, q, settle, openFeed, notify } = await boot();
  const row = (cls) => q(`[data-feed-row][data-class=${cls}]`);
  await notify('research', '🔬 Cyber L2 complete'); await openFeed(); row('research').click(); await settle(); await settle();
  assert.equal(q('[data-tab=technology]').getAttribute('aria-current'), 'page'); assert.equal(q('[data-sheet]'), null, 'feed closed after the jump');
  await notify('pressure', '⚠ Blockade runners slipped the cordon'); await openFeed(); row('escalation').click(); await settle(); await settle();
  assert.ok(q('[data-sentinel=sitroom]'), 'Situation pane');
  await notify('world', '⚠ Flashpoint in Western Europe resolved against you'); await openFeed(); row('world').click(); await settle(); await settle();
  assert.ok(q('[data-sentinel=overview]') && q('[data-region-nations]'), 'Overview with the Western Europe sheet');
  assert.match(q('[data-sheet]').textContent, /Western Europe/);
  g.doc.querySelector('[data-sheet-close]').click(); await settle(); await settle();
  await notify('statecraft', '🏛️ Embassy established in Germany'); await openFeed(); row('diplomacy').click(); await settle(); await settle();
  assert.ok(q('[data-nation-sheet=germany]'), 'Germany nation sheet'); assert.equal(q('[data-tab=trade]').getAttribute('aria-current'), 'page');
});

test('routing: toast pops and is kept; feed is kept without a popup; pause stops the clock with a named reason and resumes at the same speed; routes survive a reload', async () => {
  const { g, q, settle, openFeed, notify, route } = await boot();
  q('[data-event-card=doctrine] .wl-opt').click(); await settle();
  await notify('intelOps', '🕵️ Toast me'); assert.match(toastText(g), /Toast me/, 'default route toasts');
  await openFeed(); await route('intel', 'feed');
  assert.equal(q('[data-route-class=intel] [data-route=feed]').getAttribute('aria-pressed'), 'true');
  g.doc.querySelector('[data-sheet-close]').click(); await settle(); await settle();
  await notify('intelOps', '🕵️ Feed only'); assert.doesNotMatch(toastText(g), /Feed only/, 'feed route shows no popup');
  assert.equal(g.w.__wl.feed().filter((e) => /Feed only/.test(e.text)).length, 1, 'but it is in the feed');
  q('[data-speed] button:nth-child(3)').click(); await settle();   // 2x
  await openFeed(); await route('intel', 'pause'); g.doc.querySelector('[data-sheet-close]').click(); await settle(); await settle();
  await notify('intelOps', '🕵️ Pause me');
  const chip = q('[data-pause-reason]'); assert.ok(chip, 'pause chip'); assert.match(chip.textContent, /Paused: Intelligence notice.*resume at 2×/);
  assert.match(toastText(g), /Pause me/, 'a pause route also toasts');
  q('[data-speed] [data-pause]').click(); await settle(); assert.equal(q('[data-pause-reason]'), null, 'the pause toggle resumes');
  assert.equal(q('[data-speed] button:nth-child(3)').getAttribute('aria-pressed'), 'true', 'at 2x');
  await openFeed();
  assert.equal(JSON.parse((await g.w.storage.get('wl_feed_routes')).value).intel, 'pause', 'routes written');
  const g2 = await mount(BUNDLES.app, { testHook: true, seed: 21, preload: { wl_feed_routes: (await g.w.storage.get('wl_feed_routes')).value } });
  await g2.pickCountry(0);
  g2.w.__wl.phase('intelOps'); g2.w.__wl.notify('🕵️ After reload'); g2.w.__wl.phase(null); await flush(); await flush();
  assert.ok(g2.doc.querySelector('[data-pause-reason]'), 'the reloaded game pauses on the saved route'); g2.close();
});

test('orders can only toast or feed: no Pause button in that row', async () => {
  const { q, qa, openFeed, tapTab } = await boot();
  await openFeed(); await tapTab('routing');
  assert.deepEqual(qa('[data-route-class=orders] [data-route]').map((b) => b.getAttribute('data-route')), ['toast', 'feed']);
  assert.deepEqual(qa('[data-route-class=world] [data-route]').map((b) => b.getAttribute('data-route')), ['toast', 'feed', 'pause']);
  assert.equal(qa('[data-route-class]').length, 9);
});

test('the feed persists with the autosave: a resume brings back the same entries; a new game starts empty', async () => {
  const { g, settle, notify } = await boot();
  for (let i = 0; i < 5; i++) await notify('economy', `💰 Notice number ${i}`);
  await g.advance(3); await flush();
  const raw = (await g.w.storage.get('wl_save')).value, feedRaw = (await g.w.storage.get('wl_feed')).value;
  const saved = JSON.parse(feedRaw); assert.ok(saved.length >= 5);
  const g2 = await mount(BUNDLES.app, { testHook: true, seed: 21, preload: { wl_save: raw, wl_feed: feedRaw } });
  try {
    let resume; for (let i = 0; i < 20 && !resume; i++) { await flush(); resume = [...g2.doc.querySelectorAll('button')].find((b) => /Resume/.test(b.textContent)); }
    resume.click(); await flush(); await flush();
    assert.equal(g2.w.__wl.feed().length, saved.length); assert.equal(g2.doc.querySelector('[data-bell-badge]').textContent, String(saved.length), 'restored entries are unread');
    assert.deepEqual(Array.from(g2.w.__wl.feed(), (e) => e.id), saved.map((e) => e.id));
  } finally { g2.close(); }
  g.doc.querySelector('[aria-label="Quit to nation select"]').click(); await settle(); await g.pickCountry(0);
  assert.ok(!g.w.__wl.feed().some((e) => /Notice number/.test(e.text)), 'a new game does not inherit the old feed');
});
