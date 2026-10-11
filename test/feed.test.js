import { test } from 'node:test';
import assert from 'node:assert/strict';
import { game } from './util/headless-month.js';
import { MONTH_PHASES } from '../src/sim/tick.js';
import { REGIONS } from '../src/data/regions.js';
import { NATIONS } from '../src/data/nations.js';
import {
  createNotifier, pushEntry, checkFeed, jumpFor, sanitizeRoutes, defaultRoutes, unreadCount, markAllRead,
  CLASSES, CLASS_IDS, PHASE_CLASS, FEED_CAP, DEDUPE_WINDOW,
} from '../src/ui/shell/feed.js';

// Q1 (#41): the notification feed. Headless: drives the same notifier the App uses through runMonth.

const entry = (o = {}) => ({ id: 1, tick: 0, date: { yr: 2024, mo: 0 }, cls: 'world', sev: 'info', text: 'x', jump: { tab: 'overview' }, n: 1, read: false, ...o });

function run(seed, idx, months, { routes, act } = {}) {
  let G; const raw = []; const toasts = []; const pauses = [];
  const n = createNotifier({ tick: () => G.g.tickCount, date: () => G.g.date, onToast: (e) => toasts.push(e), onPause: (e) => pauses.push(e) });
  if (routes) for (const [c, r] of Object.entries(routes)) n.setRoute(c, r);
  const fx = { toast: (m, meta) => { raw.push({ tick: G.g.tickCount, text: String(m) }); return n.fx.toast(m, meta); }, phase: n.fx.phase };
  G = game(seed, idx, fx);
  for (let i = 0; i < months; i++) { act?.(G, i); G.step(); }
  G.done();
  return { n, raw, toasts, pauses, G };
}

test('every monthly phase maps to a class and every class has a label, icon and a real pane', () => {
  for (const p of MONTH_PHASES) assert.ok(CLASSES[PHASE_CLASS[p.id]], `phase ${p.id} has no class`);
  for (const [id, c] of Object.entries(CLASSES)) { assert.ok(c.label && c.icon, id); assert.ok(c.tab === null || typeof c.tab === 'string', id); }
  assert.equal(CLASSES.orders.tab, null);
});

test('240 months, 3 nations: no notice is toast-only (all enter the feed), every entry has class, severity, month and a jump', () => {
  for (const [seed, idx] of [[7, 0], [8, 1], [9, 2]]) {
    const { n, raw } = run(seed, idx, 240);
    assert.ok(raw.length > 40, `seed ${seed}: only ${raw.length} notices, run too quiet to prove anything`);
    const total = n.feed.reduce((s, e) => s + e.n, 0);
    if (n.feed.length < FEED_CAP) assert.equal(total, raw.length, 'every notice is in the feed, folded or not');
    assert.ok(n.feed.length <= FEED_CAP);
    assert.deepEqual(checkFeed(n.feed), []);
    for (const e of n.feed) {
      assert.ok(CLASSES[e.cls], `class ${e.cls}`); assert.ok(['info', 'warn', 'alert'].includes(e.sev));
      assert.ok(Number.isInteger(e.tick) && e.date && Number.isInteger(e.date.mo) && e.date.yr >= 2024);
      assert.ok(e.jump && typeof e.jump.tab === 'string', `jump for "${e.text}"`);
      assert.equal(e.cls === 'orders', false, 'a tick notice is never filed as a player order');
    }
  }
});

test('240-month seeded run: no duplicate entries inside noticeCooldowns windows', () => {
  const gated = /blockade runners slipped|downgraded to Tier/; // the noticeCooldowns sites in tick.js whose text is fixed (the third, `⚠ ${resp.msg}`, is covered by the feed check below)
  for (const [seed, idx] of [[7, 0], [8, 1], [9, 2], [10, 3]]) {
    const { n, raw } = run(seed, idx, 240);
    // Engine throttle: a cooldown-gated message never fires twice inside 12 ticks.
    const last = {};
    for (const r of raw) {
      if (!gated.test(r.text)) continue;
      if (last[r.text] !== undefined) assert.ok(r.tick - last[r.text] >= DEDUPE_WINDOW, `"${r.text}" repeated after ${r.tick - last[r.text]} ticks`);
      last[r.text] = r.tick;
    }
    // Feed guarantee for everything else: one text, one class, one entry per window.
    for (const [i, a] of n.feed.entries()) for (const b of n.feed.slice(i + 1)) if (a.cls === b.cls && a.text === b.text) assert.ok(Math.abs(a.tick - b.tick) >= DEDUPE_WINDOW, `duplicate "${a.text}" ${a.tick} vs ${b.tick}`);
    assert.deepEqual(checkFeed(n.feed), []);
  }
});

test('feed cap: 500 pushes leave 200, newest first, invariant holds; the invariant catches an uncapped or duplicated feed', () => {
  let f = [];
  for (let i = 0; i < 500; i++) f = pushEntry(f, entry({ id: i + 1, tick: i * 20, text: `n${i}` }));
  assert.equal(f.length, FEED_CAP); assert.equal(f[0].text, 'n499'); assert.deepEqual(checkFeed(f), []);
  assert.ok(checkFeed([...f, entry({ id: 9999, tick: 0, text: 'old' })]).includes('feed is capped at 200'));
  assert.ok(checkFeed([entry({ id: 1 }), entry({ id: 1 })]).includes('entry ids are unique'));
  assert.ok(checkFeed([entry({ id: 1, tick: 5, text: 'a' }), entry({ id: 2, tick: 5, text: 'a' })]).includes('no two entries with one text in one class inside the dedupe window'));
  assert.ok(checkFeed([entry({ cls: 'nope' })]).length);
});

test('dedupe: same class+text folds inside 12 months (count, refreshed month, unread again); outside the window it lists again; another class never folds', () => {
  let f = pushEntry([], entry({ id: 1, tick: 3, text: 'dup' }));
  f = markAllRead(f); assert.equal(unreadCount(f), 0);
  f = pushEntry(f, entry({ id: 2, tick: 8, text: 'dup' }));
  assert.equal(f.length, 1); assert.equal(f[0].n, 2); assert.equal(f[0].tick, 8); assert.equal(f[0].read, false); assert.equal(unreadCount(f), 1);
  f = pushEntry(f, entry({ id: 3, tick: 8 + DEDUPE_WINDOW, text: 'dup' })); assert.equal(f.length, 2, 'window elapsed');
  f = pushEntry(f, entry({ id: 4, tick: 8 + DEDUPE_WINDOW, text: 'dup', cls: 'intel' })); assert.equal(f.length, 3, 'other class');
  const f2 = pushEntry(pushEntry([], entry({ id: 1, text: 'e', sev: 'alert' })), entry({ id: 2, text: 'e', sev: 'info' }));
  assert.equal(f2[0].sev, 'alert', 'a fold never lowers severity');
});

test('routing: toast shows and feeds, feed only feeds, pause feeds, shows and pauses; orders cannot pause', () => {
  const t = [], p = []; const n = createNotifier({ onToast: (e) => t.push(e.text), onPause: (e) => p.push(e.text) });
  n.fx.phase('statecraft');
  n.fx.toast('a');                                      // diplomacy, default toast
  n.setRoute('diplomacy', 'feed'); n.fx.toast('b');
  n.setRoute('diplomacy', 'pause'); n.fx.toast('c');
  n.fx.phase(null);
  n.setRoute('orders', 'pause'); n.fx.toast('d');       // refused: orders stay toast
  assert.deepEqual(t, ['a', 'c', 'd']); assert.deepEqual(p, ['c']);
  assert.deepEqual(n.feed.map((e) => e.text), ['d', 'c', 'b', 'a'], 'all four are in the feed');
  assert.equal(n.routes.orders, 'toast'); assert.equal(n.routes.diplomacy, 'pause');
  assert.deepEqual(n.feed.map((e) => e.cls), ['orders', 'diplomacy', 'diplomacy', 'diplomacy']);
});

test('240 months with every class set to pause: each tick notice fires onPause exactly once, none from orders', () => {
  const routes = Object.fromEntries(CLASS_IDS.filter((c) => !CLASSES[c].noPause).map((c) => [c, 'pause']));
  const { n, raw, pauses } = run(7, 0, 60, { routes });
  assert.ok(pauses.length > 5 && pauses.length === raw.length, `${pauses.length} pauses for ${raw.length} notices`);
  assert.ok(pauses.every((e) => e.cls !== 'orders'));
  assert.deepEqual(checkFeed(n.feed), []);
});

test('verbs raise "orders" entries and a rejected order is still in the feed', () => {
  const { n } = run(7, 0, 1, { act: (G) => G.act({ type: 'establishEmbassy', payload: { nation: 'france' } }) });
  const o = n.feed.filter((e) => e.cls === 'orders');
  assert.ok(o.length >= 1, 'the verb toast was filed'); assert.ok(o.every((e) => e.jump === null || e.jump.nation || e.jump.region), 'an order jumps only to the place it names');
});

test('jumpFor: a named region or nation opens its sheet on the right pane; longest name wins; no place -> the class pane', () => {
  const rid = Object.keys(REGIONS)[0];
  assert.deepEqual(jumpFor('world', `Flashpoint in ${REGIONS[rid].n}. Respond on the map.`), { tab: 'overview', region: rid });
  assert.deepEqual(jumpFor('intel', 'Quietly turned the Germany approach'), { tab: 'intel', nation: 'germany' });
  assert.deepEqual(jumpFor('escalation', 'Russia blockade runners slipped'), { tab: 'overview', nation: 'russia' }, 'sitroom is folded under overview for a nation sheet');
  assert.deepEqual(jumpFor('economy', 'Treasury is low'), { tab: 'economy' });
  assert.equal(jumpFor('orders', 'Pick a region'), null);
  assert.deepEqual(jumpFor('world', 'Unrussian words'), { tab: 'overview' }, 'whole words only');
  for (const id of Object.keys(NATIONS)) if (id.length >= 4) assert.ok(jumpFor('intel', `op against ${id}`).nation, id);
});

test('settings: unknown classes and bad routes fall back to the default; defaults are all toast (same behavior as before the feed)', () => {
  assert.deepEqual(defaultRoutes(), Object.fromEntries(CLASS_IDS.map((c) => [c, 'toast'])));
  const r = sanitizeRoutes({ intel: 'feed', world: 'bogus', orders: 'pause', zzz: 'feed' });
  assert.equal(r.intel, 'feed'); assert.equal(r.world, 'toast'); assert.equal(r.orders, 'toast'); assert.ok(!('zzz' in r));
  const n = createNotifier(); n.fx.toast('hello'); n.setRoute('intel', 'feed');
  const m = createNotifier(); m.load(JSON.parse(JSON.stringify(n.feed))); m.setRoutes(JSON.parse(JSON.stringify(n.routes)));
  assert.equal(m.feed.length, 1); assert.equal(m.routes.intel, 'feed'); m.fx.toast('next'); assert.equal(m.feed[0].id, 2, 'ids continue after a load');
  m.load(null); assert.equal(m.feed.length, 0); assert.equal(m.routes.intel, 'feed', 'routes outlive a game');
  m.setRoutes({ intel: 'bogus' }); assert.deepEqual(m.routes, defaultRoutes());
});
