// Command card (docs/DESIGN-SYSTEM-V2.md §4, RTS convention): on selecting a region, a unit type or a budget line,
// a card rises bottom-center (map) or tops the right column (verticals): header with a colour bar, then a 4-column
// grid of actions, each with icon, label and key. Escalatory actions are orange and always confirm. Keys fire while
// the card is mounted, never while typing or with a modifier. Zero game logic: actions come from commands.js.
import { useEffect, useRef } from 'react';

const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable;

export function CommandCard({ id, title, sub, color, actions = [], onRun, onClose, placement = 'column' }) {
  const ref = useRef({ actions, onRun }); ref.current = { actions, onRun };
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || typing(e)) return;
      const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      const a = ref.current.actions.find((x) => x.key === k); if (!a) return;
      e.preventDefault(); if (!a.disabled) ref.current.onRun?.(a);
    };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <section className="wl-cmd wl-rise" data-command-card={id} data-placement={placement} style={{ '--cmd': color }} aria-label={`Commands: ${title}`}>
      <header className="wl-cmd-head">
        <div style={{ minWidth: 0, flex: 1 }}><b>{title}</b>{sub && <small>{sub}</small>}</div>
        {onClose && <button type="button" className="wl-cmd-x" onClick={onClose} aria-label="Close command card" data-command-close>✕</button>}
      </header>
      <div className="wl-cmd-grid">
        {actions.map((a) => (
          <button key={a.id} type="button" className="wl-cmd-btn" data-cmd={a.id} data-key={a.key} data-escalate={a.escalate || undefined} aria-disabled={a.disabled || undefined} title={a.disabled ? a.reason : `${a.hint || ''}${a.key ? ` (${a.key})` : ''}`} onClick={() => !a.disabled && onRun?.(a)}>
            <span className="wl-cmd-i" aria-hidden="true">{a.icon}</span>
            <span className="wl-cmd-l">{a.label}</span>
            <kbd className="wl-cmd-k">{a.key}</kbd>
            <small className="wl-cmd-t">{a.disabled ? a.reason : a.target}</small>
          </button>))}
      </div>
    </section>
  );
}
