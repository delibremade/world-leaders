// Outliner drawer: live list of operations, builds, research, timers, flashpoints, cooldowns. Swipe up on a
// phone (use-gesture on the handle), a side column on desktop (CSS). Each row jumps to its context.
import { useEffect, useRef, useState } from 'react';
import { useDrag } from '@use-gesture/react';
import { GROUPS } from './outliner.js';
import { COLOR } from '../tokens.js';

// focus: {ids: [...row ids], family} from a top-bar alert chip; the rows rise to L2 and the first scrolls into view.
export function Outliner({ rows, open, onOpenChange, onJump, focus = null }) {
  const focused = new Set(focus?.ids || []);
  const [open2, setOpen2] = useState(() => new Set()); // rows whose explanation is unfolded (timers and cooldowns act by explaining themselves)
  const inline = (r) => !r.jump?.site && (r.group === 'timers' || r.group === 'cooldowns');
  const act = (r) => { if (inline(r)) setOpen2((p) => { const n = new Set(p); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; }); else onJump(r.jump, r); };
  const body = useRef(null);
  useEffect(() => { if (!focus || !body.current) return; const el = body.current.querySelector('[data-focus=true]'); el?.scrollIntoView?.({ block: 'nearest' }); }, [focus]);
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
    <aside className="wl-outliner" data-outliner data-open={open ? 'true' : 'false'} data-focus-family={focus?.family || undefined} aria-label="Outliner">
      <button type="button" className="wl-outliner-handle" {...bind()} onClick={toggle} aria-expanded={open} data-outliner-handle>
        {open ? '▼' : '▲'} Outliner · {live} live{alerts ? ` · ${alerts} urgent` : ''}
      </button>
      <div className="wl-outliner-body" ref={body}>
        {live === 0 && <div className="wl-label" style={{ padding: '12px 0' }}>Nothing in motion. Quiet months are for building.</div>}
        {GROUPS.map(([g, label]) => { const rs = rows.filter((r) => r.group === g); if (!rs.length) return null; return (
          <div key={g} data-outliner-group={g}>
            <div className="wl-ol-group">{label} · {rs.length}</div>
            {rs.map((r) => (
              <button key={r.id} type="button" className="wl-ol-row" onClick={() => act(r)} data-outliner-row={r.id} data-kind={r.kind} data-action={inline(r) ? 'explain' : r.jump?.op ? 'op' : r.jump?.card ? 'card' : 'jump'} aria-expanded={inline(r) ? open2.has(r.id) : undefined} title={r.explain} data-focus={focused.has(r.id) ? 'true' : undefined}>
                <span aria-hidden="true" style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{r.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}><b style={{ color: r.sev === 'alert' ? COLOR.accent.alert : r.sev === 'warn' ? COLOR.accent.warn : undefined }}>{r.title}</b><small>{r.sub}</small>
                  {r.pct != null && <span className="wl-ol-bar"><i style={{ width: `${Math.max(0, Math.min(100, r.pct * 100))}%` }} /></span>}
                  {inline(r) && open2.has(r.id) && <small className="wl-ol-explain" data-explain>{r.explain}</small>}</span>
                {r.months != null && <span className="wl-ol-t">{r.months}mo</span>}
              </button>))}
          </div>); })}
      </div>
    </aside>
  );
}
