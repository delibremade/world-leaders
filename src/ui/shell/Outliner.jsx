// Outliner drawer: live list of operations, builds, research, timers, flashpoints, cooldowns. Swipe up on a
// phone (use-gesture on the handle), a side column on desktop (CSS). Each row jumps to its context.
import { useRef } from 'react';
import { useDrag } from '@use-gesture/react';
import { GROUPS } from './outliner.js';
import { COLOR } from '../tokens.js';

export function Outliner({ rows, open, onOpenChange, onJump }) {
  // Swipes open/close through use-gesture; a plain click toggles (and is ignored right after a swipe, since the
  // browser fires click after a short touch drag too).
  const swiped = useRef(false);
  const bind = useDrag(({ swipe: [, sy], last, movement: [, my] }) => {
    if (sy === -1 || (last && my < -40)) { swiped.current = true; onOpenChange(true); }
    else if (sy === 1 || (last && my > 40)) { swiped.current = true; onOpenChange(false); }
    if (last) setTimeout(() => { swiped.current = false; }, 300);
  }, { filterTaps: true, axis: 'y', pointer: { touch: true } });
  const toggle = () => { if (swiped.current) return; onOpenChange(!open); };
  const live = rows.length;
  const alerts = rows.filter((r) => r.sev === 'alert').length;
  return (
    <aside className="wl-outliner" data-outliner data-open={open ? 'true' : 'false'} aria-label="Outliner">
      <button type="button" className="wl-outliner-handle" {...bind()} onClick={toggle} aria-expanded={open} data-outliner-handle>
        {open ? '▼' : '▲'} Outliner · {live} live{alerts ? ` · ${alerts} urgent` : ''}
      </button>
      <div className="wl-outliner-body">
        {live === 0 && <div className="wl-label" style={{ padding: '12px 0' }}>Nothing in motion. Quiet months are for building.</div>}
        {GROUPS.map(([g, label]) => { const rs = rows.filter((r) => r.group === g); if (!rs.length) return null; return (
          <div key={g} data-outliner-group={g}>
            <div className="wl-ol-group">{label} · {rs.length}</div>
            {rs.map((r) => (
              <button key={r.id} type="button" className="wl-ol-row" onClick={() => onJump(r.jump)} data-outliner-row={r.id}>
                <span aria-hidden="true" style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{r.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}><b style={{ color: r.sev === 'alert' ? COLOR.accent.alert : r.sev === 'warn' ? COLOR.accent.warn : undefined }}>{r.title}</b><small>{r.sub}</small>
                  {r.pct != null && <span className="wl-ol-bar"><i style={{ width: `${Math.max(0, Math.min(100, r.pct * 100))}%` }} /></span>}</span>
                {r.months != null && <span className="wl-ol-t">{r.months}mo</span>}
              </button>))}
          </div>); })}
      </div>
    </aside>
  );
}
