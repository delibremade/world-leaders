// Event content helpers (E6, #18). Pure predicates over the live state `g`, shared by the decision and world-event
// registries so a condition is written once (CLAUDE.md #8). No sim imports: data layer only.
import { NATIONS } from './nations.js';
import { MINERALS, MINERAL_IDS, MINERAL_START } from './minerals.js';
import { ALLIED_PROGRAMS } from './alliance.js';
import { SOF_RULES } from './forces.js';

export const meId = (g) => g.country?.id;
export const maxTen = (g) => Math.max(0, ...Object.values(g.rivalTension || {}));
export const hottest = (g) => Object.entries(g.rivalTension || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
export const cap1 = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
// Tone by seat: the line written from the player's chair. `map` is { nationId: text }, `dflt` the fallback.
export const seat = (c, map, dflt) => map[c?.id ?? c] ?? dflt;

// ── Allied programs (E7) ───────────────────────────────────────────────────
// The first program the player belongs to as a non-owner with an active (not suspended) record, as { pid, owner }.
export function memberOf(g) {
  const me = meId(g);
  for (const [pid, A] of Object.entries(ALLIED_PROGRAMS)) { const a = g.arsenal?.access?.[pid]?.[me]; if (a?.status === 'active' && A.owner !== me) return { pid, owner: A.owner, tier: a.tier, founder: !!a.founder }; }
  return null;
}
// Partners the player (as owner) has admitted: [{ pid, nid }], flagged-security nations first.
export function ownedMembers(g) {
  const me = meId(g); const out = [];
  for (const [pid, A] of Object.entries(ALLIED_PROGRAMS)) if (A.owner === me) for (const nid of Object.keys(g.arsenal?.access?.[pid] || {})) if (nid !== me) out.push({ pid, nid });
  return out.sort((a, b) => (NATIONS[b.nid]?.secFlag ? 1 : 0) - (NATIONS[a.nid]?.secFlag ? 1 : 0));
}

// ── Minerals (E4) ──────────────────────────────────────────────────────────
// A mineral some processor currently withholds from the player (aiControls, recomputed monthly).
export const squeezed = (g) => Object.values(g.minerals?.against || {}).flat()[0] || null;
export const squeezedCount = (g) => new Set(Object.values(g.minerals?.against || {}).flat()).size;
// The mineral the player processes with the fewest months of ore left, as { m, months } (null: no processing at all).
export function tightest(g) {
  let best = null;
  for (const m of MINERAL_IDS) { const o = g.minerals?.own?.[m]; if (!o || !(o.cap > 0)) continue; const months = o.ore / o.cap; if (!best || months < best.months) best = { m, months }; }
  return best;
}
// The mineral the player processes the most of (the one a control would bite on).
export function strongest(g) {
  let best = null;
  for (const m of MINERAL_IDS) { const o = g.minerals?.own?.[m]; if (o?.cap > 0 && (!best || o.cap * MINERALS[m].price > best.v)) best = { m, v: o.cap * MINERALS[m].price }; }
  return best?.m || null;
}
// A processor outside the player's own list that refines `m`, warm enough to sign with: offtake candidates by relations.
export function offtakeCandidate(g, m) {
  const me = meId(g);
  return Object.keys(MINERAL_START).filter((n) => n !== me && MINERAL_START[n][m]?.[1] > 0 && (g.nationRelations?.[n] || 0) >= 0 && !g.minerals?.against?.[n]?.includes(m) && !g.minerals?.deals?.some((d) => d.m === m && d.n === n))
    .sort((a, b) => (g.nationRelations?.[b] || 0) - (g.nationRelations?.[a] || 0))[0] || null;
}
export const mineralName = (m) => MINERALS[m]?.n || m;

// ── Forces (E8) ────────────────────────────────────────────────────────────
export const lowestReadiness = (g) => (g.forces ? Math.min(...Object.values(g.forces.readiness || { x: 100 })) : 100);
export const sofPipes = (g) => g.forces?.sof?.pipes?.length || 0;
export const sofRoom = (g) => sofPipes(g) < SOF_RULES.maxPipes;
