// Confirm sheet (PLAYABLE-PLAN Shell chrome): every irreversible or escalatory act shows cost and consequences
// before it commits. `act` is {title, lines:[string], cost, label, kind, run}; null closes it.
import { Sheet } from './Sheet.jsx';

export function ConfirmSheet({ act, onClose }) {
  return (
    <Sheet open={!!act} onClose={onClose} title={act?.title || ''} subtitle="Confirm before you commit">
      {act && (
        <div data-confirm>
          {act.cost != null && <div className="wl-r"><div className="wl-r-main"><b>Cost</b></div><span className="wl-r-v">{act.cost}</span></div>}
          {(act.lines || []).map((l, i) => <div key={i} className="wl-r"><div className="wl-r-main"><small style={{ fontSize: 12 }}>{l}</small></div></div>)}
          <div className="wl-row" style={{ marginTop: 12 }}>
            <button type="button" className="wl-btn" style={{ flex: 1 }} onClick={onClose} data-confirm-cancel>Cancel</button>
            <button type="button" className={`wl-btn wl-btn-${act.kind || 'warn'}`} style={{ flex: 1 }} onClick={() => { act.run(); onClose(); }} data-confirm-ok>{act.label || 'Confirm'}</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
