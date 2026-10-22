// F9 (#57), spec Part 11: bases and nodes. One implementation of placement, host consent, reach and the monthly step, shared by
// the verbs (actions.js), the month (tick.js), the effects F9c wires into chokepoints, deployed power, ISR, flashpoints and sphere,
// and the map build layer (F9b). State g.bases: { nodes: [{id, owner, site, type, status, mo, since, tenure, closed?}], ai: {owner: n},
// agreements: {host: {since}} }. #89: tenure (F15) per node; agreements are the player's basing agreements with host nations (NATIONS[*].host).
//   status: 'building' (mo months left) | 'active' | 'closed' (host consent lost; `closed` counts months shut)
//   id = owner:site:type, so one node per owner, site and type (invariant).
// Every nation's real bases are pre-placed (REAL_BASES); the player's are the ones owned by g.country.id. Ruling 6: AI nodes are keyed
// by their owner, never by the player; nothing here writes tension against the player.
import { NODE_TYPES, SITES, SITE_IDS, REAL_BASES, BASE_RULES as R, TENURES, distanceKm } from '../data/bases.js';
import { NATIONS, NATION_BLOC } from '../data/nations.js';
import { REGIONS, REGION_GEO, SPHERE_INIT } from '../data/regions.js';
import { CHOKEPOINTS, IMPORT_ROUTES } from '../data/chokepoints.js';
import { isAllyOf, topHostile, relOf } from './formulas.js';
import { rng } from './rng.js';
import { siteLL, chokeLL, chokesCovered, regionsCovered } from './reach.js';
import { leverCost } from './minerals.js';
import { MINERAL_RULES as MR } from '../data/minerals.js';
import { DIP_TARGETS } from '../data/nations.js';
const EPS = 1e-9;

export const nodeId = (owner, site, type) => `${owner}:${site}:${type}`;
export function newBases() {
  return { nodes: REAL_BASES.map((b) => ({ id: nodeId(b.owner, b.site, b.type), owner: b.owner, site: b.site, type: b.type, status: 'active', mo: 0, since: 0, tenure: b.tenure })), ai: {}, agreements: {} };
}
// F15 tenure of a node. Saves from before #89 carry `lease: true` or nothing; a pre-placed node reads its REAL_BASES line.
const REAL_TENURE = Object.fromEntries(REAL_BASES.map((b) => [nodeId(b.owner, b.site, b.type), b.tenure]));
export const tenureOf = (node) => node.tenure || (node.lease ? 'lease' : REAL_TENURE[node.id] || (SITES[node.site]?.host === node.owner ? 'own' : 'access'));
export const persists = (node) => !!TENURES[tenureOf(node)]?.persists;
// #89 host nations: a basing agreement in force, signed with basingAgreement, or implied by a lease or treaty base you already hold there.
export const isHostNation = (nid) => !!NATIONS[nid]?.host;
export const hostSites = (nid) => SITE_IDS.filter((sid) => SITES[sid].host === nid);
export const hasAgreement = (g, h) => !!BS(g).agreements?.[h] || BS(g).nodes.some((n) => n.owner === me(g) && SITES[n.site].host === h && n.status !== 'closed' && persists(n));
const BS = (g) => g.bases || newBases();
const me = (g) => g.country?.id;
// The AI nations that place nodes: the sphere competitors (SPHERE_INIT keys), minus the player.
export const AI_OWNERS = (pid) => [...new Set(Object.values(SPHERE_INIT).flatMap((o) => Object.keys(o)))].filter((n) => n !== pid);
const nationName = (id) => NATIONS[id]?.n || id;
export const hostName = (site) => (site.host ? NATIONS[site.host]?.n || site.host : site.local);

// ── Reach: lives in reach.js (shared with formulas.js); re-exported so callers keep one import.
export { siteLL, regionLL, chokeLL, reachOf, kmTo, kmToRegion, coversChoke, coversRegion, chokesCovered, regionsCovered } from './reach.js';

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
// Two thresholds: `open` (build or reopen) and `lost` (the host closes it). Own soil, a lease and a treaty always consent (F15: they end only by
// a specific event, never a relations threshold). A host nation (#89) consents to an ally, a pact partner, or under a basing agreement.
export function consent(g, sid, node = null) {
  const site = SITES[sid]; const pid = me(g);
  if (site.host === pid || (node && persists(node))) return { ok: true, lost: false, reason: null };
  if (site.host) {
    const h = site.host; const rel = relOf(g, h);
    if (g.sanctions?.has?.(h)) return { ok: false, lost: true, reason: `You sanction ${nationName(h)}` };
    if (g.embargoes?.has?.(h)) return { ok: false, lost: true, reason: `You embargo ${nationName(h)}` };
    if (rel < R.consentLose) return { ok: false, lost: true, reason: `${nationName(h)} relations ${Math.round(rel)} (below ${R.consentLose})` };
    const friend = g.defensePacts?.has?.(h) || isAllyOf(pid, h);
    if (isHostNation(h)) {
      if (friend || hasAgreement(g, h)) return { ok: true, lost: false, reason: null };
      return { ok: false, lost: !!node && tenureOf(node) === 'agreement', reason: `No basing agreement with ${nationName(h)} (relations ${Math.round(rel)}; need ${R.consentRel}, a pact or an ally to sign one)` };
    }
    const ok = rel >= R.consentRel || friend;
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
    const reason = have ? (have.status === 'closed' ? 'Closed by the host' : have.status === 'building' ? `Building, ${have.mo} mo` : 'Built') : !c.ok ? c.reason : !cost.private && treasury < cost.capex ? `Need $${cost.capex}M` : null;
    return { type, ...NODE_TYPES[type], ...cost, have, ok: !reason, reason };
  });
}
// One site as the map sheet reads it: who is here, what you may build, consent.
export function siteView(g, sid) {
  const site = SITES[sid]; if (!site) return null;
  return { id: sid, ...site, hostName: hostName(site), consent: consent(g, sid), nodes: nodesAt(g, sid), options: siteOptions(g, sid), chokes: Object.keys(CHOKEPOINTS).filter((k) => distanceKm(siteLL(sid), chokeLL(k)) <= 1500) };
}
// One host nation as its sheet reads it (#89): terms, agreement, candidate sites with the chokepoints each reaches at its longest node reach.
export function hostView(g, nid) {
  const H = NATIONS[nid]?.host; if (!H) return null;
  const sites = hostSites(nid).map((sid) => { const reach = Math.max(...SITES[sid].types.map((t) => NODE_TYPES[t].reach)); return { id: sid, n: SITES[sid].n, types: SITES[sid].types, chokes: Object.keys(CHOKEPOINTS).filter((k) => distanceKm(siteLL(sid), chokeLL(k)) <= reach), mine: nodesAt(g, sid).filter((n) => n.owner === me(g)).length }; });
  return { id: nid, ...H, agreement: hasAgreement(g, nid), signed: !!BS(g).agreements?.[nid], sign: agreementGate(g, nid), rel: relOf(g, nid), sites, chokes: [...new Set(sites.flatMap((s) => s.chokes))] };
}
// Why a basing agreement cannot be signed right now, or null.
export function agreementGate(g, nid) {
  const pid = me(g); if (!isHostNation(nid) || nid === pid) return 'Not a host nation';
  if (g.sanctions?.has?.(nid)) return `You sanction ${nationName(nid)}`;
  if (g.embargoes?.has?.(nid)) return `You embargo ${nationName(nid)}`;
  const rel = relOf(g, nid);
  if (!(rel >= R.consentRel || g.defensePacts?.has?.(nid) || isAllyOf(pid, nid))) return `Relations ${Math.round(rel)}: need ${R.consentRel}, a pact or an ally`;
  if ((g.stats?.treasury || 0) < R.agreementCost) return `Need $${R.agreementCost}M`;
  return null;
}
// Every node the player holds, with its reach summary and monthly cost.
export function basesView(g) {
  const pid = me(g); const nodes = BS(g).nodes.map((n) => ({ ...n, siteName: SITES[n.site].n, region: SITES[n.site].region, hostName: hostName(SITES[n.site]), mine: n.owner === pid, cost: nodeCost(n.type, n.site, n.owner), chokes: chokesCovered(n), regions: regionsCovered(n), foreign: isForeign(n), outlook: n.owner === pid && NODE_TYPES[n.type].private && n.status === 'building' ? portOutlook(g, n) : null }));
  const mine = nodes.filter((n) => n.mine); const active = mine.filter((n) => n.status === 'active');
  return { nodes, mine, theirs: nodes.filter((n) => !n.mine), upkeep: active.reduce((s, n) => s + n.cost.upkeep, 0), hostPay: active.reduce((s, n) => s + n.cost.host, 0), building: mine.filter((n) => n.status === 'building'), closed: mine.filter((n) => n.status === 'closed') };
}

const commit = (g, S, nodes, ai = BS(g).ai) => { const nb = { ...BS(g), nodes, ai, agreements: BS(g).agreements || {} }; g.bases = nb; S.setBases(nb); return nb; };
const logLine = (g, S, msg) => S.setLog((p) => [{ msg, yr: g.date.yr, mo: g.date.mo }, ...p.slice(0, 19)]);

// ── Verbs ──────────────────────────────────────────────────────────────────
// Place a node at a site. Capex now; it comes online after `mo` months; upkeep and the basing agreement run while active.
function buildNode(g, S, fx, sid, type) {
  const pid = me(g); if (!pid || !SITES[sid] || !NODE_TYPES[type]) return false;
  const opt = siteOptions(g, sid).find((o) => o.type === type);
  if (!opt) { fx.toast(`⚠ ${SITES[sid].n} cannot host a ${NODE_TYPES[type].n}`); return false; }
  if (!opt.ok) { fx.toast('⚠ ' + opt.reason); return false; }
  const t = NODE_TYPES[type]; const site = SITES[sid];
  if (t.private) { // F5 model: the state authorizes for $0; investors build while the margin holds
    const node = { id: nodeId(pid, sid, type), owner: pid, site: sid, type, status: 'building', mo: opt.mo, since: g.tickCount || 0, prog: 0, levers: [], tenure: newTenure(g, sid) };
    commit(g, S, [...BS(g).nodes, node]);
    const o = portOutlook(g, node);
    fx.toast(`${t.i} ${t.n} at ${site.n} authorized, no treasury capex: ${o.profitable ? `private build ~${o.eta} mo` : 'not yet profitable for investors; pull a lever'}`);
    logLine(g, S, `${t.i} Authorized: ${t.n}, ${site.n} (private capital)`);
    return true;
  }
  S.setStats((p) => ({ ...p, treasury: p.treasury - opt.capex }));
  const node = { id: nodeId(pid, sid, type), owner: pid, site: sid, type, status: 'building', mo: opt.mo, since: g.tickCount || 0, tenure: newTenure(g, sid) };
  commit(g, S, [...BS(g).nodes, node]);
  fx.toast(`${t.i} ${t.n} at ${site.n}: $${opt.capex}M, online in ${opt.mo} months${opt.host ? `, $${opt.host}M/mo to ${hostName(site)}` : ''}`);
  logLine(g, S, `${t.i} Breaking ground: ${t.n}, ${site.n}`);
  return true;
}
// Tenure of a node you build now: home soil, a host-nation agreement where one is signed, else an access arrangement.
const newTenure = (g, sid) => { const h = SITES[sid].host; return h === me(g) ? 'own' : h && BS(g).agreements?.[h] ? 'agreement' : 'access'; };
// #89: sign or end a basing agreement with a host nation. Signing costs a one-off fee and needs relations 20, a pact or an ally; it lets you
// build at every site the host offers and keeps those nodes open while relations stay above the loss line. Ending it closes them next month.
function basingAgreement(g, S, fx, nid) {
  const pid = me(g); if (!pid || !isHostNation(nid) || nid === pid) return false;
  const ag = { ...(BS(g).agreements || {}) };
  if (ag[nid]) { delete ag[nid]; const nb = { ...BS(g), agreements: ag }; g.bases = nb; S.setBases(nb); fx.toast(`📝 Basing agreement with ${nationName(nid)} ended`); logLine(g, S, `📝 Basing agreement ended: ${nationName(nid)}`); return true; }
  const why = agreementGate(g, nid); if (why) { fx.toast('⚠ ' + why); return false; }
  S.setStats((p) => ({ ...p, treasury: p.treasury - R.agreementCost }));
  if (g.nationRelations?.[nid] == null) { const nr = { ...g.nationRelations, [nid]: relOf(g, nid) }; g.nationRelations = nr; S.setNationRelations(nr); }
  ag[nid] = { since: g.tickCount || 0 }; const nb = { ...BS(g), agreements: ag }; g.bases = nb; S.setBases(nb);
  fx.toast(`📝 Basing agreement with ${nationName(nid)}: $${R.agreementCost}M; build at ${hostSites(nid).map((s) => SITES[s].n).join(', ')}`);
  logLine(g, S, `📝 Basing agreement signed: ${nationName(nid)}`);
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
// F5 lever on a private node you authorized: costs frac x capex once, in force until it comes online. Same table and pricing as plants.
function nodeLever(g, S, fx, id, k) {
  const pid = me(g); const node = BS(g).nodes.find((n) => n.id === id && n.owner === pid); const L = MR.levers[k];
  if (!node || !L || !NODE_TYPES[node.type].private) return false;
  if (node.status !== 'building') { fx.toast(`⚠ ${SITES[node.site].n} is not under construction`); return false; }
  if ((node.levers || []).includes(k)) { fx.toast(`${L.n} already in force`); return false; }
  const cost = leverCost(NODE_TYPES[node.type].capex, k);
  if ((g.stats?.treasury || 0) < cost) { fx.toast(`⚠ ${L.n} needs $${cost}M`); return false; }
  S.setStats((p) => ({ ...p, treasury: p.treasury - cost }));
  const nodes = BS(g).nodes.map((n) => (n.id === id ? { ...n, levers: [...(n.levers || []), k] } : n)); commit(g, S, nodes);
  const o = portOutlook(g, nodes.find((n) => n.id === id));
  fx.toast(`${L.i} ${L.n} · ${SITES[node.site].n}: $${cost}M — ${o.profitable ? `private build ~${o.eta} mo` : 'still not profitable for investors'}`);
  return true;
}
export const BASE_VERBS = {
  buildNode: (g, S, fx, { site, type }) => buildNode(g, S, fx, site, type),
  closeNode: (g, S, fx, { id }) => closeNode(g, S, fx, id),
  nodeLever: (g, S, fx, { id, lever }) => nodeLever(g, S, fx, id, lever),
  basingAgreement: (g, S, fx, { nation }) => basingAgreement(g, S, fx, nation),
};

// ── Private capital (F5 #37) for port nodes: investor margin from lane value, host-region sphere and trade ties, saturation across your
// ports; levers add margin and pace exactly as on a plant; pace = min(maxPace, margin) x (1 + lever paces), months of progress per month.
export function portOutlook(g, node) {
  const sid = node.site; const site = SITES[sid]; const P = R.port; const I = MR.invest; const t = NODE_TYPES[node.type];
  const levers = node.levers || []; const L = levers.map((k) => MR.levers[k]);
  const lane = Object.keys(CHOKEPOINTS).some((k) => distanceKm(siteLL(sid), chokeLL(k)) <= P.laneKm);
  const pv = g.sphere?.[site.region]?.player || 0;
  const ties = DIP_TARGETS.filter((d) => d.region === site.region && g.tradeAgreements?.has?.(d.id)).length;
  const ports = nodesOf(g).filter((n) => NODE_TYPES[n.type].private && n.status === 'active').length;
  const terms = [
    { label: lane ? 'Lane value: a chokepoint within reach' : 'No chokepoint within reach', value: lane ? P.lane : P.noLane },
    { label: `Host-region sphere ${Math.round(pv)}%`, value: P.sphereBase + pv / P.spherePer },
    { label: `Trade agreements in the region: ${ties}`, value: 1 + P.tradePer * ties },
    { label: `Saturation: ${ports} port${ports === 1 ? '' : 's'} held`, value: 1 / (1 + I.sat * ports) },
  ];
  const base = terms.reduce((a, x) => a * x.value, 1);
  const raw = base + L.reduce((a, l) => a + l.margin, 0);
  const margin = L.some((l) => l.floor) ? Math.max(raw, 1) : raw;
  const profitable = margin >= 1 - EPS;
  const pace = profitable ? Math.min(I.maxPace, margin) * (1 + L.reduce((a, l) => a + l.pace, 0)) : 0;
  const prog = node.prog || 0; const need = t.mo;
  return { terms, base, margin, profitable, pace, prog, need, eta: pace > 0 ? Math.ceil((need - prog) / pace - EPS) : Infinity, levers, capex: t.capex, income: t.income || 0 };
}

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
  // #89: a basing agreement lapses when the host would close a base (relations under the loss line, your sanctions or embargo on it).
  let agreements = BS(g).agreements || {};
  for (const h of Object.keys(agreements)) {
    const why = g.sanctions?.has?.(h) ? `you sanction ${nationName(h)}` : g.embargoes?.has?.(h) ? `you embargo ${nationName(h)}` : relOf(g, h) < R.consentLose ? `relations ${Math.round(relOf(g, h))}` : null;
    if (!why) continue;
    agreements = { ...agreements }; delete agreements[h]; changed = true;
    fx.toast(`📝 ${nationName(h)} suspends your basing agreement: ${why}`); logLine(g, S, `📝 Basing agreement suspended: ${nationName(h)}`);
  }
  g.bases = { ...BS(g), agreements };
  for (const n of nodes) {
    if (n.status === 'building' && n.owner === pid && NODE_TYPES[n.type].private) { // F5: investors advance it by its pace while the margin holds
      const o = portOutlook(g, n); if (o.pace <= 0) continue;
      changed = true; n.prog = (n.prog || 0) + o.pace;
      if (n.prog < o.need - EPS) { n.mo = Math.max(1, Math.ceil(o.need - n.prog - EPS)); continue; }
      n.status = 'active'; n.mo = 0; delete n.prog; delete n.levers;
      fx.toast(`${NODE_TYPES[n.type].i} Private ${NODE_TYPES[n.type].n} at ${SITES[n.site].n} online: $${NODE_TYPES[n.type].income}M/mo to the treasury, no capex`);
      logLine(g, S, `${NODE_TYPES[n.type].i} Online (private capital): ${NODE_TYPES[n.type].n}, ${SITES[n.site].n}`);
      continue;
    }
    if (n.status === 'building') { n.mo -= 1; changed = true; if (n.mo <= 0) { n.status = 'active'; n.mo = 0; if (n.owner === pid) { fx.toast(`${NODE_TYPES[n.type].i} ${NODE_TYPES[n.type].n} at ${SITES[n.site].n} is operational`); logLine(g, S, `${NODE_TYPES[n.type].i} Operational: ${NODE_TYPES[n.type].n}, ${SITES[n.site].n}`); } } }
    if (n.owner !== pid) continue;
    const c = consent(g, n.site, n);
    if (n.status !== 'closed' && c.lost) { n.status = 'closed'; n.closed = 0; changed = true; fx.toast(`🚫 ${hostName(SITES[n.site])} closes your ${NODE_TYPES[n.type].n} at ${SITES[n.site].n}: ${c.reason}`); logLine(g, S, `🚫 Base closed by host: ${NODE_TYPES[n.type].n}, ${SITES[n.site].n}`); }
    else if (n.status === 'closed') { n.closed = (n.closed || 0) + 1; changed = true; if (n.closed >= R.reopenMo && c.ok) { n.status = 'active'; delete n.closed; fx.toast(`${NODE_TYPES[n.type].i} ${SITES[n.site].n} reopened: ${hostName(SITES[n.site])} consents again`); logLine(g, S, `${NODE_TYPES[n.type].i} Base reopened: ${NODE_TYPES[n.type].n}, ${SITES[n.site].n}`); } }
  }
  // Costs: upkeep on active nodes, basing agreements on active foreign ones.
  let upkeep = 0, hostPay = 0, ports = 0;
  for (const n of nodes) { if (n.owner !== pid || n.status !== 'active') continue; const c = nodeCost(n.type, n.site, pid); upkeep += c.upkeep; hostPay += c.host; ports += NODE_TYPES[n.type].income || 0; }
  if (upkeep) cash('Base upkeep', -upkeep);
  if (hostPay) cash('Basing agreements', -hostPay);
  if (ports) cash('Ports sector', ports);
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
