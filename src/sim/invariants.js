import { MONTHLY_SYSTEMS } from './systems.js';
import { BLACK_PROGRAMS } from '../data/platforms.js';
import { NATIONS } from '../data/nations.js';
import { ALLIED_PROGRAMS, TIERS, ACCESS_RULES } from '../data/alliance.js';

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
  ['queued follow-ups name real events', (g) => (g.evState?.q || []).every((q) => typeof q.id === 'string' && Number.isFinite(q.at))],
  // Nation catalogs (E3, #15)
  ['prototype lines are known programs with integer 0 <= prog < mo', (g) => Object.entries(g.arsenal?.dev || {}).every(([id, d]) => BLACK_PROGRAMS[id] && Number.isInteger(d.prog) && Number.isInteger(d.mo) && d.prog >= 0 && d.prog < d.mo)],
  ['owned programs are known ids with non-negative integer counts', (g) => Object.entries(g.blackPrograms || {}).every(([id, n]) => BLACK_PROGRAMS[id] && Number.isInteger(+n) && +n >= 0)],
  // Allied access (E7, #19)
  ['access records name real programs and nations with a known tier, status and a 0..12 suspension clock', (g) => Object.entries(g.arsenal?.access || {}).every(([pid, row]) => ALLIED_PROGRAMS[pid] && Object.entries(row).every(([n, a]) => NATIONS[n] && TIERS[a.tier] && (a.status === 'active' || a.status === 'suspended') && Number.isInteger(a.susp) && a.susp >= 0 && a.susp <= ACCESS_RULES.suspendMo))],
  ['the player is never a member of its own program', (g) => !pid(g) || Object.entries(g.arsenal?.access || {}).every(([p, row]) => ALLIED_PROGRAMS[p].owner !== pid(g) || !(pid(g) in row))],
  ['allied orders are for programs the player is a member of, with integer months > 0', (g) => (g.arsenal?.orders || []).every((o) => g.arsenal?.access?.[o.id]?.[pid(g)] && Number.isInteger(o.mo) && o.mo > 0)],
  ['a program is never both in prototype and owned', (g) => Object.keys(g.arsenal?.dev || {}).every((id) => !((+g.blackPrograms?.[id] || 0) > 0))],
  // Issues (E9, #23)
  ['issues are live, unique by type, with a positive ttl once ticked', (g) => { const l = g.issues || []; return new Set(l.map((i) => i.type)).size === l.length && l.every((i) => ['unexamined', 'investigating', 'briefed', 'deployed'].includes(i.status) && ((i.status !== 'unexamined' && i.status !== 'briefed') || i.ttl == null || (Number.isInteger(i.ttl) && i.ttl > 0))); }],
];
export const checkV57 = (g) => V57_INVARIANTS.filter(([, ok]) => !ok(g)).map(([n]) => n);
