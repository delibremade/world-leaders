// F9 (#57): reach and the effects of bases. Pure over g.bases, g.country and static data; no imports from formulas.js, so both
// formulas.js and bases.js can read it. One implementation per effect (CLAUDE.md rule 8): every consumer (tick.js, formulas.js,
// events.js, actions.js, the UI) calls these.
//   chokeWeight(g,k)      control weight your active naval and logistics nodes add at chokepoint k, less half of what rivals add
//   theaterMult(g,rid,b)  deployed-weight bonus for branch b in theater rid (air: sortie, sea: sustain, land: land; hubs sustain all)
//   baseIsr(bases,pid)    global ISR from radar sites (and a little from air, SOF and missile-defense sites), capped
//   responseAt(g,rid)     extra flashpoint months in rid and the intervene gate (air, garrison, logistics, SOF in reach)
//   shieldAt(g,rid)       rival pressure swing in rid scaled down by missile-defense sites in reach
//   sphereGain(g,rid)     monthly sphere pull from garrisons and ports sitting in rid
//   laneCut(g,routes)     import-cost cut from naval bases and ports on your import routes
//   t1Bonus(g,home)       Tier-1 odds bonus from SOF staging within reach of the target's home theater
// Every aggregator counts only `active` nodes, so a closed node contributes nothing (spec: closure removes its effects).
import { NODE_TYPES, SITES, distanceKm, unproject } from '../data/bases.js';
import { REGIONS, REGION_GEO } from '../data/regions.js';
import { CHOKEPOINTS } from '../data/chokepoints.js';
import { parseRegions } from '../data/geo.js';

export const REACH_CAPS = { theater: 0.6, isr: 6, response: 3, shield: 0.5, sphere: 0.12, lane: 0.1, t1: 0.1 };

// ── Reach ──────────────────────────────────────────────────────────────────
export const siteLL = (sid) => ({ lon: SITES[sid].lon, lat: SITES[sid].lat });
export const regionLL = (rid) => unproject(REGION_GEO[rid].cx, REGION_GEO[rid].cy);
export const chokeLL = (k) => unproject(CHOKEPOINTS[k].x, CHOKEPOINTS[k].y);
export const reachOf = (node) => NODE_TYPES[node.type]?.reach || 0;
export const kmTo = (node, ll) => distanceKm(siteLL(node.site), ll);
// Coastline points per theater. A stray Natural Earth fragment far from the theater's main landmass (the Horn of Africa carries one
// tagged EE) is dropped: a polygon counts only within 60 map units of the main polygon's box. REGION_GEO itself is never hand-edited.
let REGION_PTS = null;
const regionPts = (rid) => {
  if (!REGION_PTS) {
    const parsed = parseRegions(REGION_GEO); REGION_PTS = {};
    for (const [r, p] of Object.entries(parsed)) {
      const main = p.main; const bx = { x0: Math.min(...main.map((q) => q[0])) - 60, x1: Math.max(...main.map((q) => q[0])) + 60, y0: Math.min(...main.map((q) => q[1])) - 60, y1: Math.max(...main.map((q) => q[1])) + 60 };
      REGION_PTS[r] = p.polys.filter((poly) => poly.some(([x, y]) => x >= bx.x0 && x <= bx.x1 && y >= bx.y0 && y <= bx.y1)).flat().map(([x, y]) => unproject(x, y));
    }
  }
  return REGION_PTS[rid];
};
export const kmToRegion = (ll, rid) => regionPts(rid).reduce((m, p) => Math.min(m, distanceKm(ll, p)), Infinity);
const COVER = new Map();
export const coversChoke = (node, k) => reachOf(node) > 0 && kmTo(node, chokeLL(k)) <= reachOf(node);
export const coversRegion = (node, rid) => regionsCovered(node).includes(rid);
export const chokesCovered = (node) => Object.keys(CHOKEPOINTS).filter((k) => coversChoke(node, k));
export function regionsCovered(node) {
  const key = `${node.site}:${node.type}`; if (COVER.has(key)) return COVER.get(key);
  const out = Object.keys(REGIONS).filter((rid) => SITES[node.site].region === rid || (reachOf(node) > 0 && kmToRegion(siteLL(node.site), rid) <= reachOf(node)));
  COVER.set(key, out); return out;
}

// ── Effects ────────────────────────────────────────────────────────────────
const pidOf = (g) => g.country?.id;
const active = (g, owner = pidOf(g)) => (g.bases?.nodes || []).filter((n) => n.owner === owner && n.status === 'active');
const activeRivals = (g) => (g.bases?.nodes || []).filter((n) => n.owner !== pidOf(g) && n.status === 'active');
const m = (n, k) => NODE_TYPES[n.type].mult[k] || 0;
const sum = (nodes, f) => nodes.reduce((a, n) => a + f(n), 0);

export const ownChokeWeight = (g, k, owner = pidOf(g)) => sum(active(g, owner).filter((n) => m(n, 'choke') && coversChoke(n, k)), (n) => m(n, 'choke'));
export const rivalChokeWeight = (g, k) => sum(activeRivals(g).filter((n) => m(n, 'choke') && coversChoke(n, k)), (n) => m(n, 'choke'));
// Net control weight at a chokepoint: yours less half of the rivals' (a crowded Djibouti is contestable, not owned).
export const chokeWeight = (g, k) => Math.max(0, ownChokeWeight(g, k) - 0.5 * rivalChokeWeight(g, k));
const BRANCH_KEY = { air: 'sortie', sea: 'sustain', land: 'land' };
export const theaterMult = (g, rid, b) => Math.min(REACH_CAPS.theater, sum(active(g).filter((n) => coversRegion(n, rid)), (n) => (n.type === 'logistics' ? m(n, 'sustain') : m(n, BRANCH_KEY[b]))));
export const baseIsr = (bases, pid) => Math.min(REACH_CAPS.isr, sum((bases?.nodes || []).filter((n) => n.owner === pid && n.status === 'active'), (n) => m(n, 'isr')));
export const responseAt = (g, rid) => Math.min(REACH_CAPS.response, sum(active(g).filter((n) => m(n, 'response') && coversRegion(n, rid)), (n) => m(n, 'response')));
export const shieldAt = (g, rid) => Math.min(REACH_CAPS.shield, sum(active(g).filter((n) => m(n, 'shield') && coversRegion(n, rid)), (n) => m(n, 'shield')));
export const sphereGain = (g, rid) => Math.min(REACH_CAPS.sphere, sum(active(g).filter((n) => m(n, 'sphere') && SITES[n.site].region === rid), (n) => m(n, 'sphere')));
export const sphereGains = (g) => Object.fromEntries(Object.keys(REGIONS).map((rid) => [rid, sphereGain(g, rid)]).filter(([, v]) => v > 0));
export const laneCut = (g, routes) => Math.min(REACH_CAPS.lane, sum(active(g).filter((n) => m(n, 'lane') && (routes || []).some((k) => NODE_TYPES[n.type].reach ? coversChoke(n, k) : CHOKEPOINTS[k].region === SITES[n.site].region)), (n) => m(n, 'lane')));
export const t1Bonus = (g, home) => (home ? Math.min(REACH_CAPS.t1, sum(active(g).filter((n) => m(n, 't1') && coversRegion(n, home)), (n) => m(n, 't1'))) : 0);
// Everything a node of yours does, for the site sheet and tests.
export const nodeEffects = (g, n) => ({ chokes: chokesCovered(n), regions: regionsCovered(n), mult: NODE_TYPES[n.type].mult });
