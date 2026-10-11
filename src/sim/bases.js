// F9 (#57), spec Part 11: bases and nodes. One implementation of placement, host consent, reach and the monthly step, shared by
// the verbs (actions.js), the month (tick.js), the effects F9c wires into chokepoints, deployed power, ISR, flashpoints and sphere,
// and the map build layer (F9b). State g.bases: { nodes: [{id, owner, site, type, status, mo, since, lease?, closed?}], ai: {owner: n} }.
//   status: 'building' (mo months left) | 'active' | 'closed' (host consent lost; `closed` counts months shut)
//   id = owner:site:type, so one node per owner, site and type (invariant).
// Every nation's real bases are pre-placed (REAL_BASES); the player's are the ones owned by g.country.id. Ruling 6: AI nodes are keyed
// by their owner, never by the player; nothing here writes tension against the player.
import { NODE_TYPES, SITES, SITE_IDS, REAL_BASES, BASE_RULES as R, distanceKm, unproject } from '../data/bases.js';
import { NATIONS, NATION_BLOC } from '../data/nations.js';
import { REGIONS, REGION_GEO, SPHERE_INIT } from '../data/regions.js';
import { parseRegions } from '../data/geo.js';
import { CHOKEPOINTS, IMPORT_ROUTES } from '../data/chokepoints.js';
import { isAllyOf, topHostile } from './formulas.js';
import { rng } from './rng.js';

export const nodeId = (owner, site, type) => `${owner}:${site}:${type}`;
export function newBases() {
  return { nodes: REAL_BASES.map((b) => ({ id: nodeId(b.owner, b.site, b.type), owner: b.owner, site: b.site, type: b.type, status: 'active', mo: 0, since: 0, ...(b.lease ? { lease: true } : {}) })), ai: {} };
}
const BS = (g) => g.bases || newBases();
const me = (g) => g.country?.id;
// The AI nations that place nodes: the sphere competitors (SPHERE_INIT keys), minus the player.
export const AI_OWNERS = (pid) => [...new Set(Object.values(SPHERE_INIT).flatMap((o) => Object.keys(o)))].filter((n) => n !== pid);
const nationName = (id) => NATIONS[id]?.n || id;
export const hostName = (site) => (site.host ? NATIONS[site.host]?.n || site.host : site.local);

// ── Reach ──────────────────────────────────────────────────────────────────
export const siteLL = (sid) => ({ lon: SITES[sid].lon, lat: SITES[sid].lat });
export const regionLL = (rid) => unproject(REGION_GEO[rid].cx, REGION_GEO[rid].cy);
export const chokeLL = (k) => unproject(CHOKEPOINTS[k].x, CHOKEPOINTS[k].y);
export const reachOf = (node) => NODE_TYPES[node.type]?.reach || 0;
export const kmTo = (node, ll) => distanceKm(siteLL(node.site), ll);
// A node covers a chokepoint within its reach, and a theater it sits in or whose coastline (any REGION_GEO vertex) is within reach.
// Sites and reaches are static, so coverage is memoized per site and type.
let REGION_PTS = null;
const regionPts = (rid) => { if (!REGION_PTS) { const parsed = parseRegions(REGION_GEO); REGION_PTS = Object.fromEntries(Object.entries(parsed).map(([r, p]) => [r, p.polys.flat().map(([x, y]) => unproject(x, y))])); } return REGION_PTS[rid]; };
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

// ── Nodes ──────────────────────────────────────────────────────────────────
export const nodesOf = (g, owner = me(g)) => BS(g).nodes.filter((n) => n.owner === owner);
export const activeNodes = (g, owner = me(g)) => nodesOf(g, owner).filter((n) => n.status === 'active');
export const nodesAt = (g, sid) => BS(g).nodes.filter((n) => n.site === sid);
export const findNode = (g, owner, sid, type) => BS(g).nodes.find((n) => n.id === nodeId(owner, sid, type)) || null;
export const isForeign = (node) => SITES[node.site].host !== node.owner;
// Monthly cost of one node to its owner: upkeep while active; the basing agreement only on foreign soil.
export function nodeCost(type, sid, owner) {
  const t = NODE_TYPES[type]; const site = SITES[sid];
  return { capex: t.capex, mo: t.mo, upkeep: t.upkeep, host: site.host === owner ? 0 : t.host, private: !!t.private };
}

// ── Host consent (player's nodes). A registry host consents on relations and pacts; a local host on your sphere in its region.
// Two thresholds: `open` (build or reopen) and `lost` (the host closes it). Own soil and a treaty lease always consent.
export function consent(g, sid, node = null) {
  const site = SITES[sid]; const pid = me(g);
  if (site.host === pid || node?.lease) return { ok: true, lost: false, reason: null };
  if (site.host) {
    const h = site.host; const rel = g.nationRelations?.[h] ?? 0;
    if (g.sanctions?.has?.(h)) return { ok: false, lost: true, reason: `You sanction ${nationName(h)}` };
    if (g.embargoes?.has?.(h)) return { ok: false, lost: true, reason: `You embargo ${nationName(h)}` };
    if (rel < R.consentLose) return { ok: false, lost: true, reason: `${nationName(h)} relations ${Math.round(rel)} (below ${R.consentLose})` };
    const ok = rel >= R.consentRel || g.defensePacts?.has?.(h) || isAllyOf(pid, h);
    return { ok, lost: false, reason: ok ? null : `${nationName(h)} relations ${Math.round(rel)} (need ${R.consentRel}, a pact or an ally)` };
  }
  const pv = g.sphere?.[site.region]?.player || 0;
  if (pv < R.localLose) return { ok: false, lost: true, reason: `${site.local}: your sphere in ${REGIONS[site.region].n} is ${Math.round(pv)}% (below ${R.localLose})` };
  const ok = pv >= R.localOpen;
  return { ok, lost: false, reason: ok ? null : `${site.local}: your sphere in ${REGIONS[site.region].n} is ${Math.round(pv)}% (need ${R.localOpen})` };
}

// What the player may build at a site: one row per node type the site allows, with cost and the reason it is closed.
export function siteOptions(g, sid) {
  const site = SITES[sid]; const pid = me(g); if (!site || !pid) return [];
  const c = consent(g, sid); const treasury = g.stats?.treasury || 0;
  return site.types.map((type) => {
    const cost = nodeCost(type, sid, pid); const have = findNode(g, pid, sid, type);
    const reason = have ? (have.status === 'closed' ? 'Closed by the host' : have.status === 'building' ? `Building, ${have.mo} mo` : 'Built') : !c.ok ? c.reason : treasury < cost.capex ? `Need $${cost.capex}M` : null;
    return { type, ...NODE_TYPES[type], ...cost, have, ok: !reason, reason };
  });
}
// One site as the map sheet reads it: who is here, what you may build, consent.
export function siteView(g, sid) {
  const site = SITES[sid]; if (!site) return null;
  return { id: sid, ...site, hostName: hostName(site), consent: consent(g, sid), nodes: nodesAt(g, sid), options: siteOptions(g, sid), chokes: Object.keys(CHOKEPOINTS).filter((k) => distanceKm(siteLL(sid), chokeLL(k)) <= 1500) };
}
// Every node the player holds, with its reach summary and monthly cost.
export function basesView(g) {
  const pid = me(g); const nodes = BS(g).nodes.map((n) => ({ ...n, siteName: SITES[n.site].n, region: SITES[n.site].region, hostName: hostName(SITES[n.site]), mine: n.owner === pid, cost: nodeCost(n.type, n.site, n.owner), chokes: chokesCovered(n), regions: regionsCovered(n), foreign: isForeign(n) }));
  const mine = nodes.filter((n) => n.mine); const active = mine.filter((n) => n.status === 'active');
  return { nodes, mine, theirs: nodes.filter((n) => !n.mine), upkeep: active.reduce((s, n) => s + n.cost.upkeep, 0), hostPay: active.reduce((s, n) => s + n.cost.host, 0), building: mine.filter((n) => n.status === 'building'), closed: mine.filter((n) => n.status === 'closed') };
}

const commit = (g, S, nodes, ai = BS(g).ai) => { const nb = { ...BS(g), nodes, ai }; g.bases = nb; S.setBases(nb); return nb; };
const logLine = (g, S, msg) => S.setLog((p) => [{ msg, yr: g.date.yr, mo: g.date.mo }, ...p.slice(0, 19)]);

// ── Verbs ──────────────────────────────────────────────────────────────────
// Place a node at a site. Capex now; it comes online after `mo` months; upkeep and the basing agreement run while active.
function buildNode(g, S, fx, sid, type) {
  const pid = me(g); if (!pid || !SITES[sid] || !NODE_TYPES[type]) return false;
  const opt = siteOptions(g, sid).find((o) => o.type === type);
  if (!opt) { fx.toast(`⚠ ${SITES[sid].n} cannot host a ${NODE_TYPES[type].n}`); return false; }
  if (!opt.ok) { fx.toast('⚠ ' + opt.reason); return false; }
  S.setStats((p) => ({ ...p, treasury: p.treasury - opt.capex }));
  const node = { id: nodeId(pid, sid, type), owner: pid, site: sid, type, status: 'building', mo: opt.mo, since: g.tickCount || 0 };
  commit(g, S, [...BS(g).nodes, node]);
  const t = NODE_TYPES[type]; const site = SITES[sid];
  fx.toast(`${t.i} ${t.n} at ${site.n}: $${opt.capex}M, online in ${opt.mo} months${opt.host ? `, $${opt.host}M/mo to ${hostName(site)}` : ''}`);
  logLine(g, S, `${t.i} Breaking ground: ${t.n}, ${site.n}`);
  return true;
}
// Decommission one of your nodes. No refund; upkeep and the agreement stop.
function closeNode(g, S, fx, id) {
  const pid = me(g); const node = BS(g).nodes.find((n) => n.id === id && n.owner === pid);
  if (!node) return false;
  commit(g, S, BS(g).nodes.filter((n) => n.id !== id));
  const t = NODE_TYPES[node.type]; fx.toast(`${t.i} ${t.n} at ${SITES[node.site].n} decommissioned`);
  logLine(g, S, `${t.i} Decommissioned: ${t.n}, ${SITES[node.site].n}`);
  return true;
}
export const BASE_VERBS = {
  buildNode: (g, S, fx, { site, type }) => buildNode(g, S, fx, site, type),
  closeNode: (g, S, fx, { id }) => closeNode(g, S, fx, id),
};

// ── AI placement. Every 3 months after the grace period each AI nation may break ground where it leads (sphere >= lead) on a host
// that is not hostile to its bloc, preferring sites that reach a chokepoint (Djibouti crowds). Deterministic through the seeded rng.
const opposed = (a, b) => (a === 'west' && b === 'east') || (a === 'east' && b === 'west');
const TYPE_PREF = ['naval', 'air', 'garrison', 'logistics', 'radar', 'sof', 'bmd', 'port'];
export function aiCandidates(g, ai) {
  const pid = me(g); const out = [];
  for (const sid of SITE_IDS) {
    const site = SITES[sid]; if (site.host === pid) continue;
    const share = site.host === ai ? 100 : g.sphere?.[site.region]?.competitors?.[ai] || 0;
    if (share < R.ai.lead) continue;
    if (site.host && site.host !== ai && opposed(NATION_BLOC[site.host], NATION_BLOC[ai])) continue;
    const near = Object.keys(CHOKEPOINTS).some((k) => distanceKm(siteLL(sid), chokeLL(k)) <= NODE_TYPES.naval.reach);
    const type = TYPE_PREF.find((t) => site.types.includes(t) && !findNode(g, ai, sid, t) && (t !== 'naval' || near || site.host === ai));
    if (type) out.push({ sid, type, w: near ? 3 : 1 });
  }
  return out;
}
function aiPlace(g, S, fx, nodes, ai) {
  const placed = { ...ai }; const pid = me(g); let changed = false;
  for (const owner of AI_OWNERS(pid)) {
    if ((placed[owner] || 0) >= R.ai.max) continue;
    if (rng() >= R.ai.p) continue;
    const cands = aiCandidates({ ...g, bases: { ...BS(g), nodes } }, owner); if (!cands.length) continue;
    const tot = cands.reduce((s, c) => s + c.w, 0); let r = rng() * tot; let pick = cands[0];
    for (const c of cands) { r -= c.w; if (r <= 0) { pick = c; break; } }
    nodes.push({ id: nodeId(owner, pick.sid, pick.type), owner, site: pick.sid, type: pick.type, status: 'building', mo: NODE_TYPES[pick.type].mo, since: g.tickCount || 0 });
    placed[owner] = (placed[owner] || 0) + 1; changed = true;
    const site = SITES[pick.sid]; const t = NODE_TYPES[pick.type];
    const home = Object.entries(REGIONS).find(([, r2]) => r2.homeFor?.includes(pid))?.[0];
    const myRoute = (IMPORT_ROUTES[home] || []).some((k) => distanceKm(siteLL(pick.sid), chokeLL(k)) <= t.reach);
    logLine(g, S, `${t.i} ${nationName(owner)} breaks ground: ${t.n}, ${site.n}`);
    if (myRoute) fx.toast(`${t.i} ${nationName(owner)} is building a ${t.n} at ${site.n}, on your import route`);
  }
  return { placed, changed };
}

// ── Monthly step (tick.js phase `bases`, after forces). Runs every month; the AI cadence no-ops internally.
export function stepBases(g, S, fx, cash) {
  const pid = me(g); if (!pid) return;
  let changed = false; const nodes = BS(g).nodes.map((n) => ({ ...n }));
  for (const n of nodes) {
    if (n.status === 'building') { n.mo -= 1; changed = true; if (n.mo <= 0) { n.status = 'active'; n.mo = 0; if (n.owner === pid) { fx.toast(`${NODE_TYPES[n.type].i} ${NODE_TYPES[n.type].n} at ${SITES[n.site].n} is operational`); logLine(g, S, `${NODE_TYPES[n.type].i} Operational: ${NODE_TYPES[n.type].n}, ${SITES[n.site].n}`); } } }
    if (n.owner !== pid) continue;
    const c = consent(g, n.site, n);
    if (n.status !== 'closed' && c.lost) { n.status = 'closed'; n.closed = 0; changed = true; fx.toast(`🚫 ${hostName(SITES[n.site])} closes your ${NODE_TYPES[n.type].n} at ${SITES[n.site].n}: ${c.reason}`); logLine(g, S, `🚫 Base closed by host: ${NODE_TYPES[n.type].n}, ${SITES[n.site].n}`); }
    else if (n.status === 'closed') { n.closed = (n.closed || 0) + 1; changed = true; if (n.closed >= R.reopenMo && c.ok) { n.status = 'active'; delete n.closed; fx.toast(`${NODE_TYPES[n.type].i} ${SITES[n.site].n} reopened: ${hostName(SITES[n.site])} consents again`); logLine(g, S, `${NODE_TYPES[n.type].i} Base reopened: ${NODE_TYPES[n.type].n}, ${SITES[n.site].n}`); } }
  }
  // Costs: upkeep on active nodes, basing agreements on active foreign ones.
  let upkeep = 0, hostPay = 0;
  for (const n of nodes) { if (n.owner !== pid || n.status !== 'active') continue; const c = nodeCost(n.type, n.site, pid); upkeep += c.upkeep; hostPay += c.host; }
  if (upkeep) cash('Base upkeep', -upkeep);
  if (hostPay) cash('Basing agreements', -hostPay);
  // Foreign presence draws tension: the top hostile competitor with a real stake (>= 25) in a region where you hold an active foreign node.
  const regionsWithForeign = new Set(nodes.filter((n) => n.owner === pid && n.status === 'active' && isForeign(n)).map((n) => SITES[n.site].region));
  if (regionsWithForeign.size) {
    const t2 = { ...g.rivalTension }; let tCh = false;
    for (const rid of regionsWithForeign) { const top = topHostile(g.sphere?.[rid]?.competitors, pid); if (top && top[1] >= 25 && top[0] !== pid) { t2[top[0]] = Math.min(99, (t2[top[0]] || 0) + R.foreignTension); tCh = true; } }
    if (tCh) { g.rivalTension = t2; S.setRivalTension(t2); }
  }
  // AI placement, every 3 months once the grace period is over.
  let ai = BS(g).ai;
  if ((g.gracePeriod || 0) <= 0 && (g.tickCount || 0) % R.ai.every === 0) { const r = aiPlace(g, S, fx, nodes, ai); if (r.changed) { ai = r.placed; changed = true; } }
  if (changed) commit(g, S, nodes, ai);
}
