// Sheets and confirms hold the clock while open (Q2, #42). Sheet.jsx and Confirm.jsx call useClockHold, so every
// sheet in the app, including the ones a tab owns (Forces, Resources), pauses the month timer with no per-tab wiring.
import { createContext, useContext, useEffect } from 'react';

export const ClockGateContext = createContext(null);

// While `open`, register a hold of `kind` ('sheet' | 'confirm') with the App's clock; released on close and unmount.
export function useClockHold(open, kind) {
  const gate = useContext(ClockGateContext);
  useEffect(() => (open && gate ? gate.hold(kind) : undefined), [open, kind, gate]);
}
