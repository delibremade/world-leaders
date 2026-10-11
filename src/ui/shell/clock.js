// Clock planner (Q2, #42). One place that decides whether the month timer runs and why it does not, so the HUD
// chip and the interval gate can never disagree. Pure; the App feeds it flags and renders the result.
//   mode 'run'  the interval ticks at the remembered speed.
//   mode 'step' the clock is stopped; the Next button advances exactly one month (unless a hard gate needs an answer).
// Reason precedence (first match wins): player/rule pause, hard engine gate, crisis briefing, open confirm, open sheet.
// A pause always shows its reason (PLAYABLE-PLAN shell chrome).
export const HARD_LABELS = [['ultimatum', 'Nuclear ultimatum'], ['confrontation', 'Blockade confrontation'], ['intelCrisis', 'Intel crisis'], ['gameOver', 'Game over'], ['victory', 'Victory']];

export function clockPlan({ inPlay = true, paused = false, pauseWhy = null, hard = {}, crisisBrief = false, held = {} } = {}) {
  const hardHit = HARD_LABELS.find(([k]) => hard[k]);
  let reason = null;
  if (paused) reason = { kind: 'you', label: pauseWhy ? `Paused: ${pauseWhy}` : 'Paused by you' };
  else if (hardHit) reason = { kind: 'engine', label: hardHit[1] };
  else if (crisisBrief) reason = { kind: 'engine', soft: true, label: 'Crisis briefing' };
  else if (held.confirm > 0) reason = { kind: 'ui', label: 'Paused: confirm open' };
  else if (held.sheet > 0) reason = { kind: 'ui', label: 'Paused: sheet open' };
  const running = inPlay && !reason;
  return { mode: running ? 'run' : 'step', running, reason, canStep: inPlay && !hardHit };
}
