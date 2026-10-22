import { MONTHLY_SYSTEMS } from './systems.js';
import { BLACK_PROGRAMS, PLATFORMS } from '../data/platforms.js';
import { BRANCH_IDS, TRAINING, SOF_RULES, FORCE_RULES, FLEET_RULES as FL } from '../data/forces.js';
import { ORBAT, manpowerCap } from '../data/orbat.js';
import { sofOrbat, sofUnit, unitCap } from '../data/sof.js';
import { REGIONS } from '../data/regions.js';
import { manPts } from './formulas.js';
import { NATIONS } from '../data/nations.js';
import { ALLIED_PROGRAMS, TIERS, ACCESS_RULES } from '../data/alliance.js';
import { WORLD_EVENTS, DECISIONS } from '../data/world.js';
import { MINERALS, MINERAL_IDS, MINERAL_RULES as MR } from '../data/minerals.js';
import { SITES, NODE_TYPES, BASE_RULES, TENURES } from '../data/bases.js';
import { INTEL_OPS } from '../data/intel.js';
import { PERMANENT } from './effects.js';

const in01 = (v) => Number.isFinite(v) && v >= 0 && v <= 100;

// Every rule here was a real bug once, or will be. Extend when you add state. Never delete.
export const INVARIANTS = [
  ['player is never a rival', (s) => !s.rivals.includes(s.player)],
  ['no tension entry for the player', (s) => !(s.player in s.tension)],
  ['rivals are unique', (s) => new Set(s.rivals).size === s.rivals.length],
  ['month is a non-negative integer', (s) => Number.isInteger(s.month) && s.month >= 0],
  ['money is finite', (s) => Number.isFinite(s.money)],
  ['stability in [0,100]', (s) => in01(s.stability)],
  ['hegemony in [0,100]', (s) => in01(s.hegemony)],
  ['all tension values in [0,100]', (s) => Object.values(s.tension).every(in01)],
  ['every registered monthly system ran this month', (s) =>
    s.month === 0 || MONTHLY_SYSTEMS.every((sys) => s.systems.lastRun[sys.id] === s.month)],
  ['log is capped at 500', (s) => s.log.length <= 500],
];

export class InvariantError extends Error {
  constructor(failed, state) {
    super(`Invariant(s) violated at month ${state.month}: ${failed.join('; ')}`);
    this.name = 'InvariantError';
    this.failed = failed;
    this.month = state.month;
  }
}

export function checkInvariants(state) {
  return INVARIANTS.filter(([, ok]) => !ok(state)).map(([name]) => name);
}

export function assertInvariants(state) {
  const failed = checkInvariants(state);
  if (failed.length) throw new InvariantError(failed, state);
  return state;
}

// v57 engine state (src/sim/state.js STATE_FIELDS). Ruling 6: the player never appears as a rival anywhere.
const pid = (g) => g.country?.id;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
export const V57_INVARIANTS = [
  ['player not in rivalTension', (g) => !pid(g) || !(pid(g) in (g.rivalTension || {}))],
  ['player not in rivalHolds', (g) => !pid(g) || !(g.rivalHolds || {})[pid(g)]],
  ['player not embargoed by self', (g) => !pid(g) || !(g.embargoes instanceof Set && g.embargoes.has(pid(g)))],
  ['player never a blockade target', (g) => !pid(g) || Object.values(g.blockades || {}).every((b) => b?.target !== pid(g))],
  ['tension values finite and in [0,100]', (g) => Object.values(g.rivalTension || {}).every((v) => finite(v) && v >= 0 && v <= 100)],
  ['month counter is a non-negative integer', (g) => Number.isInteger(g.tickCount) && g.tickCount >= 0],
  ['pressure timer within its 3-month gate', (g) => Number.isInteger(g.pressureTimer) && g.pressureTimer <= 3],
  // Event system (E2, #14)
  ['event cooldowns are integers in [0,60]', (g) => Object.values(g.evState?.cd || {}).every((v) => Number.isInteger(v) && v >= 0 && v <= 60)],
  ['in-effect rows have months left and a known kind', (g) => (g.evState?.fx || []).every((r) => Number.isInteger(r.mo) && r.mo > 0 && (r.kind === 'world' || r.kind === 'flashpoint'))],
  ['a live world event has months left', (g) => !g.worldEvent || (Number.isInteger(g.worldEvent.mo) && g.worldEvent.mo > 0)],
  ['an answered world event has its in-effect row', (g) => !g.worldEvent?.ans || (g.evState?.fx || []).some((r) => r.ev === g.worldEvent.id && r.kind === 'world')],
  ['a live flashpoint has months left', (g) => !g.flashpoint || (Number.isInteger(g.flashpoint.t) && g.flashpoint.t > 0)],
  ['latest world-event month is a finite number', (g) => !g.evState || g.evState.last === undefined || Number.isFinite(g.evState.last)],
  ['an open decision opened at a month with a why-now line (saves from before F2 carry neither)', (g) => !g.activeDecision || g.activeDecision.at === undefined || (Number.isFinite(g.activeDecision.at) && typeof g.activeDecision.why === 'string' && g.activeDecision.why.length > 0)],
  ['an open world event with a why-now line has a non-empty one', (g) => !g.worldEvent || g.worldEvent.why === undefined || (typeof g.worldEvent.why === 'string' && g.worldEvent.why.length > 0)],
  ['queued follow-ups name real events', (g) => (g.evState?.q || []).every((q) => typeof q.id === 'string' && Number.isFinite(q.at))],
  // Event content (E6, #18)
  ['queued follow-ups are registered world events', (g) => (g.evState?.q || []).every((q) => !!WORLD_EVENTS[q.id])],
  ['used decisions are registered decisions', (g) => [...(g.usedDecisions || [])].every((id) => DECISIONS.some((d) => d.id === id))],
  // Nation catalogs (E3, #15)
  ['prototype lines are known programs with integer 0 <= prog < mo', (g) => Object.entries(g.arsenal?.dev || {}).every(([id, d]) => BLACK_PROGRAMS[id] && Number.isInteger(d.prog) && Number.isInteger(d.mo) && d.prog >= 0 && d.prog < d.mo)],
  ['owned programs are known ids with non-negative integer counts', (g) => Object.entries(g.blackPrograms || {}).every(([id, n]) => BLACK_PROGRAMS[id] && Number.isInteger(+n) && +n >= 0)],
  // Allied access (E7, #19)
  ['access records name real programs and nations with a known tier, status and a 0..12 suspension clock', (g) => Object.entries(g.arsenal?.access || {}).every(([pid, row]) => ALLIED_PROGRAMS[pid] && Object.entries(row).every(([n, a]) => NATIONS[n] && TIERS[a.tier] && (a.status === 'active' || a.status === 'suspended') && Number.isInteger(a.susp) && a.susp >= 0 && a.susp <= ACCESS_RULES.suspendMo))],
  ['the player is never a member of its own program', (g) => !pid(g) || Object.entries(g.arsenal?.access || {}).every(([p, row]) => ALLIED_PROGRAMS[p].owner !== pid(g) || !(pid(g) in row))],
  // Intel operations (FIX 3): every op the engine holds is stamped; a relaunch without odds resolved as NaN and never succeeded.
  ['intel ops carry an id, a known op, a target and finite odds in [0,1]', (g) => (g.intelOps || []).every((o) => typeof o.id === 'string' && INTEL_OPS.some((x) => x.id === o.opId) && typeof o.targetId === 'string' && Number.isInteger(o.monthsLeft) && o.monthsLeft > 0 && finite(o.successRate) && o.successRate >= 0 && o.successRate <= 1 && finite(o.discoverRate) && o.discoverRate >= 0 && o.discoverRate <= 1)],
  // Active effects (FIX 4): timed rows count down, permanent rows hold; no two permanent rows share a source and stat.
  ['active effects carry a string id, source and stat, a finite d and integer months > 0', (g) => (g.activeEffects || []).every((e) => typeof e.id === 'string' && typeof e.source === 'string' && typeof e.stat === 'string' && finite(e.d) && Number.isInteger(e.monthsLeft) && e.monthsLeft > 0 && (!e.permanent || e.monthsLeft === PERMANENT))],
  ['one permanent effect per source and stat', (g) => { const seen = new Set(); return (g.activeEffects || []).every((e) => { if (!e.permanent) return true; const k = `${e.source}|${e.stat}`; if (seen.has(k)) return false; seen.add(k); return true; }); }],
  ['allied orders are for programs the player is a member of, with integer months > 0', (g) => (g.arsenal?.orders || []).every((o) => g.arsenal?.access?.[o.id]?.[pid(g)] && Number.isInteger(o.mo) && o.mo > 0)],
  ['a program is never both in prototype and owned', (g) => Object.keys(g.arsenal?.dev || {}).every((id) => !((+g.blackPrograms?.[id] || 0) > 0))],
  // Minerals and processing (E4, #16)
  ['mineral stocks non-negative and finite; capacity <= capMax, stockpile <= stockMax, reserve <= reserveMax', (g) => !g.minerals || MINERAL_IDS.every((m) => { const o = g.minerals.own?.[m]; return o && ['ore', 'cap', 'stock', 'reserve'].every((k) => finite(o[k]) && o[k] >= 0) && o.cap <= MR.capMax && o.stock <= MR.stockMax + 1e-9 && o.reserve <= MR.reserveMax; })],
  ['private projects (F5): a mineral or the retort, progress finite in [0, build months), levers known and unique', (g) => !g.minerals?.proj || Object.entries(g.minerals.proj).every(([id, pj]) => (MINERALS[id] || id === 'retort') && finite(pj.prog) && pj.prog >= 0 && pj.prog < (id === 'retort' ? MR.retort.mo : MR.plant.mo) && Array.isArray(pj.levers) && pj.levers.every((k) => MR.levers[k]) && new Set(pj.levers).size === pj.levers.length)],
  ['mineral offtake deals name real minerals and partners with integer months > 0', (g) => !g.minerals || (g.minerals.deals.every((d) => MINERALS[d.m] && NATIONS[d.n] && d.n !== pid(g) && Number.isInteger(d.mo) && d.mo > 0 && d.units > 0 && d.price >= 0))],
  ['export controls only on minerals the player processes', (g) => !g.minerals || g.minerals.controls.every((m) => (g.minerals.own[m]?.cap || 0) > 0)],
  ['AI export controls never keyed by the player', (g) => !g.minerals || !(pid(g) in (g.minerals.against || {}))],
  ['queued tranches are known programs or platforms with 0 < left <= need', (g) => !g.minerals || g.minerals.queue.every((q) => (BLACK_PROGRAMS[q.id] || PLATFORMS[q.id]) && Object.keys(q.left).length > 0 && Object.entries(q.left).every(([m, u]) => finite(u) && u > 0 && u <= (q.need?.[m] || 0) + 1e-9))],
  // Troops, training, quality, SOF (E8, #20)
  // F7 (#55): strength is headcounts once a force has its 2024 `base`; the index bound still holds for pre-F7 forces.
  ['force strength (active, reserve) and retention in [0,100]; F7 headcounts non-negative within the population bound (active + reserve <= military-age x eligibility)', (g) => !g.forces || (in01(g.forces.retention) && (g.forces.base
    ? ['active', 'reserve'].every((k) => finite(g.forces[k]) && g.forces[k] >= 0) && g.forces.active + g.forces.reserve <= manpowerCap(g.forces.nid) + 1e-6
    : ['active', 'reserve'].every((k) => in01(g.forces[k]))))],
  ['force quality in [0,100]', (g) => !g.forces || in01(g.forces.quality)],
  ['readiness per branch in [0,100]', (g) => !g.forces || BRANCH_IDS.every((b) => in01(g.forces.readiness?.[b]))],
  ['crews non-negative and <= the trained pool (active x crewPer)', (g) => !g.forces || BRANCH_IDS.every((b) => { const c = g.forces.crews?.[b]; return finite(c) && c >= 0 && c <= manPts(g.forces).active * FORCE_RULES.crewPer[b] + 1e-9; })],
  ['fleet (F7): lines from the nation\'s order of battle; integer counts >= 0 placed in known theaters summing to the count; MC in [0,100]; maintenance in [0,200]; blocks and depot months integers in range; depot throughput in [0,200]', (g) => !g.forces?.fleet || (in01(g.forces.depot / 2) && Object.entries(g.forces.fleet).every(([id, s]) => (ORBAT[g.forces.nid] || []).some((l) => l.id === id)
    && Number.isInteger(s.n) && s.n >= 0 && in01(s.mc) && finite(s.mx) && s.mx >= 0 && s.mx <= FL.pctMax && Number.isInteger(s.blk) && s.blk >= 0 && s.blk <= FL.maxBlk
    && Number.isInteger(s.mod) && s.mod >= 0 && finite(s.loss) && s.loss >= 0 && s.loss < 1 && Object.entries(s.at).every(([r, k]) => REGIONS[r] && Number.isInteger(k) && k > 0)
    && Object.values(s.at).reduce((a, k) => a + k, 0) === s.n))],
  ['fleet (F7): units already fielded into the fleet are integer counts >= 0', (g) => !g.forces?.fleet || Object.values(g.forces.fielded || {}).every((k) => Number.isInteger(k) && k >= 0)],
  ['crew pipeline: known branch with integer months > 0; training level is known', (g) => !g.forces || (g.forces.pipe.every((p) => BRANCH_IDS.includes(p.b) && Number.isInteger(p.mo) && p.mo > 0) && !!TRAINING[g.forces.train])],
  // F8 (#56): named SOF units
  ['SOF units (F8): exactly the nation\'s named units; operators finite in [0, cap]; committed sub-units <= subs, each with integer months >= 0 and time left', (g) => !g.forces?.sof?.units || (() => {
    const us = sofOrbat(g.forces.nid); const ids = Object.keys(g.forces.sof.units);
    return ids.length === us.length && us.every((u) => { const s = g.forces.sof.units[u.id]; return s && finite(s.ops) && s.ops >= 0 && s.ops <= unitCap(u) + 1e-9 && s.out.length <= u.subs
      && s.out.every((o) => Number.isInteger(o.mo) && Number.isInteger(o.rec) && o.mo >= 0 && o.rec >= 0 && o.mo + o.rec > 0 && typeof o.op === 'string' && !!NATIONS[o.tgt] && o.tgt !== g.country?.id); });
  })()],
  ['SOF classes (F8): at most maxPipes, each for a named unit of its tier with integer months > 0 and integer trainees > 0', (g) => !g.forces?.sof?.units || (g.forces.sof.pipes.length <= SOF_RULES.maxPipes
    && g.forces.sof.pipes.every((p) => sofUnit(g.forces.nid, p.u)?.tier === p.t && Number.isInteger(p.mo) && p.mo > 0 && Number.isInteger(p.n) && p.n > 0))],
  ['personnel pay >= 0 and finite', (g) => g.personnelPay == null || (finite(g.personnelPay) && g.personnelPay >= 0)],
  // Bases and nodes (F9, #57)
  ['base nodes name real sites, a type the site allows, an owner in NATIONS and a known status; building nodes have integer months > 0; closed ones count months shut', (g) => !g.bases || g.bases.nodes.every((n) => SITES[n.site] && NODE_TYPES[n.type] && SITES[n.site].types.includes(n.type) && NATIONS[n.owner] && n.id === `${n.owner}:${n.site}:${n.type}` && ((n.status === 'building' && Number.isInteger(n.mo) && n.mo > 0) || (n.status === 'active' && n.mo === 0) || (n.status === 'closed' && Number.isInteger(n.closed) && n.closed >= 0)))],
  ['one base node per owner, site and type', (g) => !g.bases || new Set(g.bases.nodes.map((n) => n.id)).size === g.bases.nodes.length],
  ['private base nodes under construction carry progress in [0, build months) and known, unique levers', (g) => !g.bases || g.bases.nodes.every((n) => n.prog === undefined || (NODE_TYPES[n.type].private && n.status === 'building' && finite(n.prog) && n.prog >= 0 && n.prog < NODE_TYPES[n.type].mo && Array.isArray(n.levers) && n.levers.every((k) => MR.levers[k]) && new Set(n.levers).size === n.levers.length))],
  ['closed base nodes belong to the player (AI nodes never lose consent)', (g) => !g.bases || g.bases.nodes.every((n) => n.status !== 'closed' || n.owner === pid(g))],
  ['AI base placements per nation stay within the cap and are never keyed by the player', (g) => !g.bases || Object.entries(g.bases.ai || {}).every(([n, k]) => n !== pid(g) && Number.isInteger(k) && k >= 0 && k <= BASE_RULES.ai.max)],
  // Host nations and tenure (#89, F15)
  ['base node tenure, when stamped, is a known F15 tenure; home soil only where the owner hosts the site', (g) => !g.bases || g.bases.nodes.every((n) => n.tenure === undefined || (TENURES[n.tenure] && (n.tenure === 'own') === (SITES[n.site].host === n.owner)))],
  ['basing agreements name host nations (never the player) and a since-month >= 0', (g) => !g.bases || Object.entries(g.bases.agreements || {}).every(([h, a]) => NATIONS[h]?.host && h !== pid(g) && Number.isInteger(a?.since) && a.since >= 0)],
  ['nation relations name real nations and stay in [-100, 100]', (g) => Object.entries(g.nationRelations || {}).every(([k, v]) => NATIONS[k] && Number.isFinite(v) && v >= -100 && v <= 100)],
  // Issues (E9, #23)
  ['issues are live, unique by type, with a positive ttl once ticked', (g) => { const l = g.issues || []; return new Set(l.map((i) => i.type)).size === l.length && l.every((i) => ['unexamined', 'investigating', 'briefed', 'deployed'].includes(i.status) && ((i.status !== 'unexamined' && i.status !== 'briefed') || i.ttl == null || (Number.isInteger(i.ttl) && i.ttl > 0))); }],
];
export const checkV57 = (g) => V57_INVARIANTS.filter(([, ok]) => !ok(g)).map(([n]) => n);
