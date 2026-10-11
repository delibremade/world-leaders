// Notification feed (Q1, #41). Presentation only: the engine keeps calling fx.toast(msg); this module turns each call
// into a persistent feed entry {class, severity, month, jump} and routes it per class: toast | feed | pause.
// Class comes from the monthly phase that was running (runMonth stamps fx.phase), never from message text; a toast
// raised outside a phase is the player's own order or a UI hint ('orders'). Pure and DOM-free so a headless run can
// drive it exactly as the App does.
import { REGIONS } from '../../data/regions.js';
import { NATIONS } from '../../data/nations.js';

export const FEED_CAP = 200;
export const DEDUPE_WINDOW = 12; // months; matches the 12-tick noticeCooldowns gate in tick.js
export const ROUTES = ['toast', 'feed', 'pause'];

// tab = where a jump lands when the text names no place. noPause: order feedback can never stop the clock.
export const CLASSES = {
  economy: { label: 'Economy', icon: '💰', tab: 'economy' },
  research: { label: 'Research', icon: '🔬', tab: 'technology' },
  resources: { label: 'Resources', icon: '⛏️', tab: 'resources' },
  military: { label: 'Forces & bases', icon: '🎖️', tab: 'forces' },
  escalation: { label: 'Escalation', icon: '⚓', tab: 'sitroom' },
  intel: { label: 'Intelligence', icon: '🕵️', tab: 'intel' },
  diplomacy: { label: 'Diplomacy', icon: '🤝', tab: 'trade' },
  world: { label: 'World events', icon: '🌐', tab: 'overview' },
  orders: { label: 'Your orders', icon: '📝', tab: null, noPause: true },
};
export const CLASS_IDS = Object.keys(CLASSES);
// runMonth phase id -> class (src/sim/tick.js MONTH_PHASES). A phase missing here files under 'world'.
export const PHASE_CLASS = {
  economy: 'economy', research: 'research', minerals: 'resources', forces: 'military', bases: 'military',
  pressure: 'escalation', intelOps: 'intel', counterIntel: 'intel', alliances: 'diplomacy', statecraft: 'diplomacy',
  market: 'economy', world: 'world',
};

export const defaultRoutes = () => Object.fromEntries(CLASS_IDS.map((c) => [c, 'toast']));
export const sanitizeRoutes = (r) => {
  const out = defaultRoutes();
  for (const c of CLASS_IDS) if (r && ROUTES.includes(r[c]) && !(r[c] === 'pause' && CLASSES[c].noPause)) out[c] = r[c];
  return out;
};

// Same severity rule the toasts always used.
export const sevOf = (msg) => (/^🚨/.test(msg) ? 'alert' : /^⚠/.test(msg) ? 'warn' : 'info');

// Jump target: a region or nation named in the text opens its sheet (same shape the outliner's onJump takes);
// otherwise the class's pane. Longest name wins so "South Africa" is not read as "Africa".
const PLACES = (() => {
  const out = [];
  for (const [id, r] of Object.entries(REGIONS)) if (r?.n) out.push([r.n.toLowerCase(), { region: id }]);
  for (const [id, n] of Object.entries(NATIONS)) { if (n?.n) out.push([n.n.toLowerCase(), { nation: id }]); if (id.length >= 4) out.push([id.toLowerCase(), { nation: id }]); }
  return out.sort((a, b) => b[0].length - a[0].length);
})();
const hasWord = (hay, w) => { const i = hay.indexOf(w); if (i < 0) return false; const b = hay[i - 1], a = hay[i + w.length]; return !(b && /[a-z]/.test(b)) && !(a && /[a-z]/.test(a)); };
export function jumpFor(cls, text) {
  const hay = String(text).toLowerCase();
  const hit = PLACES.find(([w]) => hasWord(hay, w));
  const tab = CLASSES[cls]?.tab;
  if (hit && hit[1].region) return { tab: 'overview', region: hit[1].region };
  if (hit && hit[1].nation) return { tab: tab === 'sitroom' ? 'overview' : (tab || 'overview'), nation: hit[1].nation };
  return tab ? { tab } : null;
}

// Add an entry newest-first. The same text in the same class inside the window folds into the existing entry
// (count n, month refreshed, unread again) so a throttled notice can never list twice.
export function pushEntry(feed, e) {
  const i = feed.findIndex((x) => x.cls === e.cls && x.text === e.text && e.tick - x.tick < DEDUPE_WINDOW && e.tick >= x.tick);
  if (i >= 0) {
    const hit = { ...feed[i], n: (feed[i].n || 1) + 1, tick: e.tick, date: e.date, read: false, sev: e.sev === 'alert' || feed[i].sev === 'alert' ? 'alert' : e.sev };
    return [hit, ...feed.slice(0, i), ...feed.slice(i + 1)].slice(0, FEED_CAP);
  }
  return [e, ...feed].slice(0, FEED_CAP);
}

export const unreadCount = (feed) => feed.reduce((n, e) => n + (e.read ? 0 : 1), 0);
export const markAllRead = (feed) => feed.map((e) => (e.read ? e : { ...e, read: true }));

// Invariants (CLAUDE.md: add one whenever you add state). Returns the names that fail; [] is healthy.
export const FEED_INVARIANTS = [
  ['feed is capped at 200', (f) => f.length <= FEED_CAP],
  ['every entry has a known class, a severity, a month and text', (f) => f.every((e) => CLASSES[e.cls] && ['info', 'warn', 'alert'].includes(e.sev) && Number.isInteger(e.tick) && e.date && Number.isInteger(e.date.mo) && typeof e.text === 'string' && e.text.length > 0)],
  ['entry ids are unique', (f) => new Set(f.map((e) => e.id)).size === f.length],
  ['newest first', (f) => f.every((e, i) => i === 0 || f[i - 1].tick >= e.tick)],
  ['no two entries with one text in one class inside the dedupe window', (f) => f.every((e, i) => f.every((x, j) => j <= i || x.cls !== e.cls || x.text !== e.text || Math.abs(e.tick - x.tick) >= DEDUPE_WINDOW))],
  ['a jump names a pane', (f) => f.every((e) => e.jump == null || typeof e.jump.tab === 'string')],
];
export const checkFeed = (feed) => FEED_INVARIANTS.filter(([, ok]) => !ok(feed)).map(([n]) => n);

// The notifier the App and the headless tests share. deps: tick() -> months elapsed, date() -> {yr, mo},
// onChange(feed), onToast(entry) for toast and pause routes, onPause(entry) for the pause route only.
export function createNotifier({ tick = () => 0, date = () => ({ yr: 0, mo: 0 }), onChange = () => {}, onToast = () => {}, onPause = () => {}, onPhase = () => {} } = {}) {
  let feed = [], seq = 1, phase = null, routes = defaultRoutes();
  const notify = (text, meta = {}) => {
    const cls = meta.cls || (phase ? (PHASE_CLASS[phase] || 'world') : 'orders');
    const d = date();
    const e = { id: seq++, tick: tick(), date: { yr: d.yr, mo: d.mo }, cls, sev: meta.sev || sevOf(text), text: String(text), jump: meta.jump || jumpFor(cls, text), n: 1, read: false };
    feed = pushEntry(feed, e); onChange(feed);
    const route = routes[cls];
    if (route === 'toast' || route === 'pause') onToast(e);
    if (route === 'pause') onPause(e);
    return e;
  };
  return {
    fx: { toast: notify, phase: (p) => { phase = p; onPhase(p); } },
    notify,
    get feed() { return feed; },
    get routes() { return routes; },
    setRoute(cls, route) { routes = sanitizeRoutes({ ...routes, [cls]: route }); return routes; },
    readAll() { feed = markAllRead(feed); onChange(feed); },
    reset() { feed = []; seq = 1; phase = null; onChange(feed); },
    // Feed and routes persist apart: the feed rides with the autosave (a resume restores the notices that belong to it),
    // the routes are player settings and outlive a game.
    load(saved) { feed = Array.isArray(saved) ? saved.slice(0, FEED_CAP) : []; seq = feed.reduce((m, e) => Math.max(m, e.id || 0), 0) + 1; phase = null; onChange(feed); },
    setRoutes(r) { routes = sanitizeRoutes(r); return routes; },
  };
}
