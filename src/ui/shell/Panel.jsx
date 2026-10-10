// Panel primitive (PLAYABLE-PLAN Tier 1): collapsible card with a title, one key figure and a detail drawer.
// Row and Bar are the outliner-row and meter vocabulary every vertical shares. Top-level components only: nothing
// here is defined inside another component, so state survives parent renders.
import { useState } from 'react';

export function Panel({ id, title, figure, tone, defaultOpen = true, children, ...rest }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="wl-panel wl-p" data-panel={id} {...rest}>
      <button type="button" className="wl-p-head" aria-expanded={open} onClick={() => setOpen(!open)} data-panel-head={id}>
        <span className="wl-label wl-p-title">{title}</span>
        {figure != null && <span className="wl-num wl-p-fig" data-tone={tone}>{figure}</span>}
        <span aria-hidden="true" className="wl-p-chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="wl-p-body">{children}</div>}
    </section>
  );
}

// An outliner-style row: title and sub on the left, a value on the right, optional trailing control. >= 44px tall.
export function Row({ title, sub, value, tone, children, trailing, stack, ...rest }) {
  return (
    <div className={stack ? 'wl-r wl-r-stack' : 'wl-r'} {...rest}>
      <div className="wl-r-main">
        <b>{title}</b>
        {sub != null && <small>{sub}</small>}
        {children}
      </div>
      {value != null && <span className="wl-r-v" data-tone={tone}>{value}</span>}
      {trailing}
    </div>
  );
}

export function Bar({ pct, tone, marker }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <span className="wl-bar" data-tone={tone} aria-hidden="true">
      <i style={{ width: `${p}%` }} />
      {marker != null && <u style={{ left: `${Math.max(0, Math.min(100, marker))}%` }} />}
    </span>
  );
}
