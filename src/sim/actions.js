// Action vocabulary. The UI may ONLY change game state by dispatching these through tick().
// Add a type here + a reducer case in tick.js + a test. Never mutate state from the UI.
export const ACTION_TYPES = new Set([
  'noop',
  // task 001 ports the v57 verbs here, e.g. 'fund', 'field', 'sanction', 'embargo', 'blockade',
  // 'stateVisit', 'foreignAid', 'tradeAgreement', 'defensePact', 'setPosture', 'launchOp', ...
]);

export function applyAction(state, action, rng) {
  if (!action || !ACTION_TYPES.has(action.type)) {
    throw new Error(`Unknown action type: ${action && action.type}`);
  }
  switch (action.type) {
    case 'noop':
      return state;
    default:
      return state;
  }
}
