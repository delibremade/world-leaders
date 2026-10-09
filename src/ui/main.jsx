import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { newGame, tick, makeRng } from '../sim/index.js';

// Placeholder UI. Task 002 replaces this with the v57 interface, re-wired to dispatch actions through tick().
// Rule: the UI never contains game logic and never defines a component inside another component.
function App() {
  const [seed] = useState(() => 1);
  const [rng] = useState(() => makeRng(seed));
  const [state, setState] = useState(() => newGame({ seed }));
  const advance = () => setState((s) => tick(s, [{ type: 'noop' }], rng));
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 16, maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>World Leaders</h1>
      <p style={{ margin: '0 0 12px', opacity: 0.8 }}>Repo scaffold v0.58.0. Engine extraction pending (task 001).</p>
      <p>Month: <strong data-testid="month">{state.month}</strong> · Seed: {state.seed}</p>
      <button onClick={advance} style={{ padding: '10px 16px', fontSize: 16 }}>Advance month</button>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
