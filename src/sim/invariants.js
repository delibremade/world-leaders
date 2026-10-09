import { MONTHLY_SYSTEMS } from './systems.js';

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
