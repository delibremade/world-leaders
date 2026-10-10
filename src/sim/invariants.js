import { MONTHLY_SYSTEMS } from './systems.js';
import { BLACK_PROGRAMS, PLATFORMS } from '../data/platforms.js';
import { BRANCH_IDS, TRAINING, SOF_RULES, FORCE_RULES } from '../data/forces.js';
import { NATIONS } from '../data/nations.js';
import { ALLIED_PROGRAMS, TIERS, ACCESS_RULES } from '../data/alliance.js';
import { WORLD_EVENTS, DECISIONS } from '../data/world.js';
import { MINERALS, MINERAL_IDS, MINERAL_RULES as MR } from '../data/minerals.js';

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
  ['allied orders are for programs the player is a member of, with integer months > 0', (g) => (g.arsenal?.orders || []).every((o) => g.arsenal?.access?.[o.id]?.[pid(g)] && Number.isInteger(o.mo) && o.mo > 0)],
  ['a program is never both in prototype and owned', (g) => Object.keys(g.arsenal?.dev || {}).every((id) => !((+g.blackPrograms?.[id] || 0) > 0))],
  // Minerals and processing (E4, #16)
  ['mineral stocks non-negative and finite; capacity <= capMax, stockpile <= stockMax, reserve <= reserveMax', (g) => !g.minerals || MINERAL_IDS.every((m) => { const o = g.minerals.own?.[m]; return o && ['ore', 'cap', 'stock', 'reserve'].every((k) => finite(o[k]) && o[k] >= 0) && o.cap <= MR.capMax && o.stock <= MR.stockMax + 1e-9 && o.reserve <= MR.reserveMax; })],
  ['mineral plants and offtake deals name real minerals and partners with integer months > 0', (g) => !g.minerals || (g.minerals.plants.every((p) => MINERALS[p.m] && Number.isInteger(p.mo) && p.mo > 0) && g.minerals.deals.every((d) => MINERALS[d.m] && NATIONS[d.n] && d.n !== pid(g) && Number.isInteger(d.mo) && d.mo > 0 && d.units > 0 && d.price >= 0))],
  ['export controls only on minerals the player processes', (g) => !g.minerals || g.minerals.controls.every((m) => (g.minerals.own[m]?.cap || 0) > 0)],
  ['AI export controls never keyed by the player', (g) => !g.minerals || !(pid(g) in (g.minerals.against || {}))],
  ['queued tranches are known programs or platforms with 0 < left <= need', (g) => !g.minerals || g.minerals.queue.every((q) => (BLACK_PROGRAMS[q.id] || PLATFORMS[q.id]) && Object.keys(q.left).length > 0 && Object.entries(q.left).every(([m, u]) => finite(u) && u > 0 && u <= (q.need?.[m] || 0) + 1e-9))],
  // Troops, training, quality, SOF (E8, #20)
  ['force strength (active, reserve) and retention in [0,100]', (g) => !g.forces || ['active', 'reserve', 'retention'].every((k) => in01(g.forces[k]))],
  ['force quality in [0,100]', (g) => !g.forces || in01(g.forces.quality)],
  ['readiness per branch in [0,100]', (g) => !g.forces || BRANCH_IDS.every((b) => in01(g.forces.readiness?.[b]))],
  ['crews non-negative and <= the trained pool (active x crewPer)', (g) => !g.forces || BRANCH_IDS.every((b) => { const c = g.forces.crews?.[b]; return finite(c) && c >= 0 && c <= g.forces.active * FORCE_RULES.crewPer[b] + 1e-9; })],
  ['crew pipeline and SOF pipelines: known branch/tier with integer months > 0', (g) => !g.forces || (g.forces.pipe.every((p) => BRANCH_IDS.includes(p.b) && Number.isInteger(p.mo) && p.mo > 0) && g.forces.sof.pipes.length <= SOF_RULES.maxPipes && g.forces.sof.pipes.every((p) => (p.t === 1 || p.t === 2) && Number.isInteger(p.mo) && p.mo > 0))],
  ['SOF tiers are integers within their ceilings; training level is known', (g) => !g.forces || (['t1', 't2'].every((k) => Number.isInteger(g.forces.sof[k]) && g.forces.sof[k] >= 0 && g.forces.sof[k] <= SOF_RULES.max[k]) && !!TRAINING[g.forces.train])],
  ['personnel pay >= 0 and finite', (g) => g.personnelPay == null || (finite(g.personnelPay) && g.personnelPay >= 0)],
  // Issues (E9, #23)
  ['issues are live, unique by type, with a positive ttl once ticked', (g) => { const l = g.issues || []; return new Set(l.map((i) => i.type)).size === l.length && l.every((i) => ['unexamined', 'investigating', 'briefed', 'deployed'].includes(i.status) && ((i.status !== 'unexamined' && i.status !== 'briefed') || i.ttl == null || (Number.isInteger(i.ttl) && i.ttl > 0))); }],
];
export const checkV57 = (g) => V57_INVARIANTS.filter(([, ok]) => !ok(g)).map(([n]) => n);
