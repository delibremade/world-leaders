// Event card queue (Frostpunk 2 / Suzerain): non-blocking cards for things that want a decision but do not
// pause the engine: the doctrine choice, decisions, the world event, the flashpoint. Blocking modals
// (ultimatum, confrontation, intel crisis, game over, victory) stay modals because the engine's pause gate
// requires them; the HUD chip names the reason.
// DOM contract kept for the parity click script: decision options are pointer divs under a card whose text
// holds "Decision Required"; doctrine options are pointer divs whose text starts with icon+name; the doctrine
// card carries data-modal=1900 (v57's overlay z-index) so a stalled harness answers it first, as in v57.
import { DOCTRINES, WORLD_EVENTS } from '../../data/world.js';
import { REGIONS, FLASHPOINTS } from '../../data/regions.js';
import { COLOR } from '../tokens.js';

export function EventCards({ doctrine, activeDecision, decisionDesc, worldEvent, flashpoint, dispatch, onOpenRegion, fxBadge }) {
  const cards = [];
  if (!doctrine) cards.push(
    <div key="doctrine" className="wl-card-ev" data-event-card="doctrine" data-modal="1900" style={{ '--ev': COLOR.accent.command }}>
      <div className="wl-label">Choose your national doctrine</div>
      <h4>This defines your path to hegemony</h4>
      <p>First nation to 80% Hegemony wins the era. Rivals are racing you. The game runs while you choose.</p>
      <div className="wl-opts">
        {Object.entries(DOCTRINES).map(([id, d]) => (
          <div key={id} className="wl-opt" style={{ cursor: 'pointer', borderColor: d.col + '55' }} onClick={() => dispatch({ type: 'chooseDoctrine', payload: { doctrine: id } })}>
            <span style={{ fontSize: 18 }}>{d.i}</span><b style={{ color: d.col }}>{d.n}</b><small>{d.d}</small>
            {d.pros.map((p) => <small key={p} style={{ color: COLOR.accent.good }}>+ {p}</small>)}{d.cons.map((c) => <small key={c} style={{ color: COLOR.accent.alert }}>− {c}</small>)}
          </div>))}
      </div>
    </div>);
  if (activeDecision) cards.push(
    <div key="decision" className="wl-card-ev" data-event-card="decision" style={{ '--ev': COLOR.accent.warn }}>
      <div className="wl-label">{activeDecision.icon} Decision Required</div>
      <h4>{activeDecision.title}</h4>
      <p>{decisionDesc}</p>
      <div className="wl-opts" style={{ display: 'grid' }}>
        {activeDecision.options.map((opt) => (
          <div key={opt.id} className="wl-opt" style={{ cursor: 'pointer' }} onClick={() => dispatch({ type: 'makeDecision', payload: { option: opt.id } })}>
            <b>{opt.label}</b>{opt.tags.map((t, i) => <small key={i}>· {t}</small>)}
            {fxBadge && <span style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>{Object.entries(opt.effects || {}).map(([k, v]) => fxBadge(k, v, true))}</span>}
          </div>))}
      </div>
    </div>);
  if (flashpoint) { const fp = FLASHPOINTS[flashpoint.type]; cards.push(
    <div key="fp" className="wl-card-ev" data-event-card="flashpoint" style={{ '--ev': COLOR.accent.alert }}>
      <div className="wl-label">{fp?.i} Flashpoint · {flashpoint.t}mo to act</div>
      <h4>{fp?.n} · {REGIONS[flashpoint.rid]?.n}</h4>
      <p>{fp?.d} Ignoring cedes ground to rivals (−5 you, +12 them).</p>
      <button type="button" className="wl-btn wl-btn-alert" onClick={() => onOpenRegion(flashpoint.rid)}>Open {REGIONS[flashpoint.rid]?.n}</button>
    </div>); }
  if (worldEvent) { const we = WORLD_EVENTS[worldEvent.id]; cards.push(
    <div key="we" className="wl-card-ev" data-event-card="world" style={{ '--ev': COLOR.accent.energy }}>
      <div className="wl-label">{we?.i} World event · {worldEvent.mo}mo left</div>
      <h4>{we?.n || worldEvent.id}</h4>
      <p>{we?.d}</p>
    </div>); }
  return <div className="wl-cards" data-event-cards>{cards}</div>;
}
