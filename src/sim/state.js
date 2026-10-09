// Canonical game state. Plain JSON-serializable data only: no classes, no functions, no Dates.
// Anything the UI needs to render must live here or be derivable from here by a pure selector.
export const SAVE_VERSION = 58;

export function newGame({ seed, player = 'usa' }) {
  if (!Number.isInteger(seed)) throw new Error('newGame: seed must be an integer');
  return {
    version: SAVE_VERSION,
    seed,
    player,
    month: 0,
    money: 1000,        // placeholder units until the v57 economy is ported
    stability: 60,      // 0..100
    hegemony: 0,        // 0..100
    rivals: [],         // nation ids; player is NEVER in here (invariant)
    tension: {},        // rivalId -> 0..100; player key is NEVER present (invariant)
    systems: { lastRun: {} }, // systemId -> month it last ran (cadence invariant)
    log: [],            // [{ month, type, text }] capped by tick()
  };
}
