// Bottom sheet (vaul): tap a region or nation -> sheet slides up with every action available on it.
// Children render only while open so the DOM clears at once (vaul keeps the frame mounted for its exit animation).
import { Drawer } from 'vaul';
import { useEffect, useState } from 'react';
import { BREAK } from '../tokens.js';

// Desktop (>= BREAK.tablet): a right-side panel that never spans or clips under the outliner column; phone: bottom sheet.
const wideQuery = `(min-width:${BREAK.tablet}px)`;
const isWide = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(wideQuery).matches;
function useWide() {
  const [wide, setWide] = useState(isWide);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const m = window.matchMedia(wideQuery); const f = () => setWide(m.matches);
    f(); m.addEventListener?.('change', f); return () => m.removeEventListener?.('change', f);
  }, []);
  return wide;
}

export function Sheet({ open, onClose, title, subtitle, back, onBack, children }) {
  const wide = useWide();
  return (
    <Drawer.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }} shouldScaleBackground={false} direction={wide ? 'right' : 'bottom'}>
      <Drawer.Portal>
        <Drawer.Overlay className="wl-sheet-overlay" />
        <Drawer.Content className="wl-sheet" data-sheet aria-describedby={undefined}>
          <div className="wl-sheet-grab" />
          <div className="wl-sheet-head">
            {back && <button type="button" className="wl-btn wl-btn-sm" onClick={onBack} aria-label="Back" data-sheet-back>‹</button>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Drawer.Title asChild><h3>{title}</h3></Drawer.Title>
              {subtitle && <div className="wl-label">{subtitle}</div>}
            </div>
            <button type="button" className="wl-btn wl-btn-sm" onClick={onClose} aria-label="Close sheet" data-sheet-close>✕</button>
          </div>
          <div className="wl-sheet-body">{open ? children : null}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
