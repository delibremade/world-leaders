// Event system (E2, #14): spawn rules, cooldowns, follow-up chains, "in effect" rows, response execution.
// One implementation per rule (CLAUDE.md #8): the tick, the verbs and the UI selectors all go through here.
// Shape of g.evState: { cd:{eventId:monthsLeft}, fx:[row], q:[{id,at}], log:[{id,m}] }
//   row = { id, kind:'world'|'flashpoint', ev, rid, choice, mo, sync, mods:{stats,cash,sphere} }
import { WORLD_EVENTS, DECISIONS } from '../data/world.js';
import { REGIONS } from '../data/regions.js';
import { WORLD_RULES, FP_RESPONSES, FP_LINGER, EVENT_COOLDOWN, CHAIN_PATIENCE } from '../data/events.js';
import { rng } from './rng.js';

export const newEvState = () => ({ cd: {}, fx: [], q: [], log: [] });
export const absMonth = (g) => g.date.yr * 12 + g.date.mo;
const LOG_CAP = 200;
const evOf = (g) => g.evState || newEvState();
export const setEv = (g, S, n) => { g.evState = n; S.setEvState(n); };

// Eligible world events (off cooldown, conditions hold, weight > 0) -> weighted pick with roll in [0,1). null = quiet month.
export function pickWorldEvent(g, roll) {
  const cd = evOf(g).cd;
  const pool = Object.keys(WORLD_EVENTS)
    .filter((id) => !(cd[id] > 0) && WORLD_RULES[id]?.when(g))
    .map((id) => [id, WORLD_RULES[id].w(g)]).filter(([, w]) => w > 0);
  const tot = pool.reduce((a, [, w]) => a + w, 0);
  if (!pool.length) return null;
  let x = roll * tot;
  for (const [id, w] of pool) { if (x < w) return id; x -= w; }
  return pool[pool.length - 1][0];
}

// Start a world event: stamps the 60-month cooldown and the log. Breakthrough is instant (no card).
export function startWorldEvent(g, S, fx, id) {
  const def = WORLD_EVENTS[id]; const ev = evOf(g);
  setEv(g, S, { ...ev, cd: { ...ev.cd, [id]: EVENT_COOLDOWN }, log: [...ev.log, { id, m: absMonth(g) }].slice(-LOG_CAP) });
  if (id === 'breakthrough') {
    const c = g.country;
    const rv = ['russia', 'china', 'usa', 'germany'].filter((r) => r !== c.id); const tgt = rv[Math.floor(rng() * rv.length)];
    S.setGlobalDef((p) => { const ng = { ...p }; const lv = ng[tgt]; if (lv) { const top = Object.entries(lv).sort((a, b) => b[1] - a[1])[0]; if (top) ng[tgt] = { ...lv, [top[0]]: Math.min(7, top[1] + 0.8) }; } return ng; });
    fx.toast(`💡 ${tgt.charAt(0).toUpperCase() + tgt.slice(1)} announces a major breakthrough — your lead narrows`);
    S.setLog((l) => [{ msg: `💡 Breakthrough abroad: ${tgt}`, yr: g.date.yr, mo: g.date.mo }, ...l.slice(0, 19)]);
    return;
  }
  const we = { id, mo: def.dur }; g.worldEvent = we; S.setWorldEvent(we);
  fx.toast(`${def.i} WORLD EVENT: ${def.n}`);
  S.setLog((l) => [{ msg: `${def.i} ${def.n}`, yr: g.date.yr, mo: g.date.mo }, ...l.slice(0, 19)]);
}
// The nuclear-employment path stamps the same cooldown when it opens the taboo window.
export const stampEvent = (g, S, id) => { const ev = evOf(g); setEv(g, S, { ...ev, cd: { ...ev.cd, [id]: EVENT_COOLDOWN }, log: [...ev.log, { id, m: absMonth(g) }].slice(-LOG_CAP) }); };

// Month start: cooldowns count down. Runs every month (a system never skips its stamp), before spawn decisions.
export function eventCooldowns(g, S) {
  const ev = evOf(g); const cd = {}; let ch = false;
  for (const [k, v] of Object.entries(ev.cd)) { const n = Math.max(0, v - 1); ch = ch || n !== v; if (n > 0) cd[k] = n; }
  if (ch || Object.keys(ev.cd).length !== Object.keys(cd).length) setEv(g, S, { ...ev, cd });
}

// Queued follow-ups: fire the first that is due when the slot is free and its cooldown has cleared; drop it once it has
// waited CHAIN_PATIENCE months past due. Returns true when one fired.
export function fireChain(g, S, fx) {
  const ev = evOf(g); if (!ev.q.length) return false;
  const now = absMonth(g); let fired = null; const keep = [];
  for (const q of ev.q) {
    if (fired || q.at > now) { keep.push(q); continue; }
    if (!g.worldEvent && !(ev.cd[q.id] > 0)) { fired = q; continue; }
    if (now - q.at < CHAIN_PATIENCE && !(ev.cd[q.id] > 0)) keep.push(q); // slot busy: wait; cooldown: drop
  }
  setEv(g, S, { ...evOf(g), q: keep });
  if (fired) { startWorldEvent(g, S, fx, fired.id); return true; }
  return false;
}

// Monthly effects of "in effect" rows. Stats ride the month's working object `ns`; money goes through the ledger `cash`;
// region swings through the sphere. Synced rows mirror their world event's remaining months and vanish with it.
export function eventEffects(g, S, ns, cash) {
  const ev = evOf(g); if (!ev.fx.length) return;
  const out = [];
  for (const r of ev.fx) {
    const m = r.mods || {};
    Object.entries(m.stats || {}).forEach(([k, v]) => { if (k in ns) ns[k] += v; });
    if (m.cash) cash('Event: ' + r.choice, m.cash);
    if (m.sphere) S.setSphere((p) => { const sph = p[m.sphere.rid]; if (!sph) return p; return { ...p, [m.sphere.rid]: { ...sph, player: Math.max(0, Math.min(100, (sph.player || 0) + m.sphere.d)) } }; });
    if (r.sync) { if (g.worldEvent?.id !== r.ev) continue; out.push({ ...r, mo: g.worldEvent.mo }); }
    else if (r.mo - 1 > 0) out.push({ ...r, mo: r.mo - 1 });
  }
  setEv(g, S, { ...ev, fx: out });
}

// ── Options (UI + gates read the same thing) ────────────────────────────────
const treasury = (g) => g.stats?.treasury || 0;
export function worldOptions(g) {
  const we = g.worldEvent; const rule = we && WORLD_RULES[we.id]; if (!rule) return [];
  return rule.responses.map((r) => {
    const reason = we.ans ? 'Already answered' : r.req?.(g) || (r.cost > 0 && treasury(g) < r.cost ? `Need $${r.cost}M` : null);
    return { id: r.id, label: r.label, tags: r.tags, cost: Math.max(0, r.cost), ok: !reason, reason };
  });
}
// Decisions (E6, #18): an option may declare `cost` ($M, charged on top of `effects`), `req(g)` (a gate with a reason),
// `act(g)` (engine verbs) and `chain` (a queued world event). Options without them behave exactly as in v57.
export function decisionReason(g, opt) {
  if (opt.cost > 0 && treasury(g) < opt.cost) return `Need $${opt.cost}M`;
  return opt.req?.(g) || null;
}
export function decisionOptions(g) {
  const d = g.activeDecision; if (!d) return [];
  const def = DECISIONS.find((x) => x.id === d.id) || d;
  return def.options.map((o) => { const reason = decisionReason(g, o); return { id: o.id, label: o.label, tags: o.tags, cost: o.cost || 0, effects: o.effects || {}, ok: !reason, reason }; });
}
export function flashpointOptions(g) {
  const fp = g.flashpoint; if (!fp) return [];
  return FP_RESPONSES.filter((r) => !r.mapOnly).map((r) => {
    const reason = fpReason(g, fp.rid, r.id);
    return { id: r.id, label: r.label, tags: r.tags, cost: FP_COST[r.id] || 0, ok: !reason, reason };
  });
}
export const FP_COST = { mediate: 300, intervene: 500, fund: 400, concede: 0, diplomatic: 200 };
export function fpReason(g, rid, id) {
  if (treasury(g) < (FP_COST[id] || 0)) return `Need $${FP_COST[id]}M`;
  if (id === 'intervene') { const dep = Object.values(g.forceDeployments?.[rid] || {}).reduce((a, b) => a + (b || 0), 0); if (!(dep > 0 || (g.stats?.military || 0) >= 70)) return 'Needs forces here or Military 70+'; }
  return null;
}

// ── Row builders ────────────────────────────────────────────────────────────
export function pushFx(g, S, row) { const ev = evOf(g); setEv(g, S, { ...ev, fx: [...ev.fx.filter((r) => r.id !== row.id), row] }); }
export function flashpointRow(g, rid, type, id) {
  const r = FP_RESPONSES.find((x) => x.id === id);
  return { id: `fx_fp_${rid}_${id}`, kind: 'flashpoint', ev: type, rid, choice: `${r.label} · ${REGIONS[rid]?.n}`, mo: FP_LINGER, sync: false, mods: { sphere: { rid, d: r.sphere } } };
}
