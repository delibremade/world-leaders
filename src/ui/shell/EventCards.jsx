// Activity cards summarize ongoing decisions. Mandatory campaign setup has its own top-layer dialog.
// Every card can also open at reading width without moving the map or changing its engine actions.
import { WORLD_EVENTS } from '../../data/world.js';
import { REGIONS, FLASHPOINTS } from '../../data/regions.js';
import { cloneElement, useEffect, useRef, useState } from 'react';
import { COLOR } from '../tokens.js';
import { DecisionDialog } from './DecisionDialog.jsx';
import { DoctrineChoice } from './DoctrineChoice.jsx';

// Inline responses (E2, #14): each is a button wired to the `eventResponse` verb; an unavailable one stays visible and says why.
function Responses({ kind, opts, dispatch }) {
  return (
    <div className="wl-opts" style={{ display: 'grid' }} data-event-responses={kind}>
      {opts.map((o) => (
        <button key={o.id} type="button" className="wl-opt" data-response={o.id} aria-disabled={!o.ok}
          onClick={() => { if (o.ok) dispatch({ type: 'eventResponse', payload: { kind, response: o.id } }); }}>
          <b>{o.label}{o.cost ? ` · $${o.cost}M` : ''}</b>
          {o.ok ? o.tags.map((t, i) => <small key={i}>· {t}</small>) : <small className="wl-reason">{o.reason}</small>}
        </button>))}
    </div>);
}

// 'Why now' (F2, #33): the state that opened this card. Saves from before the line existed show a neutral stand-in.
function WhyNow({ text }) { return <div className="wl-why-now" data-why-now>Why now: {text || 'carried over from an earlier save'}</div>; }

export function EventCards({ dock = false, focus = null, doctrine, activeDecision, decisionDesc, worldEvent, flashpoint, worldOpts = [], fpOpts = [], decisionOpts = null, country = null, dispatch, onOpenRegion, fxBadge, readyBriefs = [], onOpenBrief, onBack }) {
  const [expanded, setExpanded] = useState(null);
  // FIX 2: focus = {card, at} from an outliner row; the named card rises and scrolls into view.
  const root = useRef(null);
  useEffect(() => { if (!focus || !root.current) return; root.current.querySelector('[data-focus=true]')?.scrollIntoView?.({ block: 'nearest', inline: 'center' }); }, [focus]);
  const fc = (k) => (focus?.card === k ? 'true' : undefined);
  const cards = [];
  if (activeDecision) cards.push(
    <div key="decision" className="wl-card-ev" data-event-card="decision" data-focus={fc('decision')} style={{ '--ev': COLOR.accent.warn }}>
      <div className="wl-label">{activeDecision.urgentNow ? '⚡ Urgent decision' : `${activeDecision.icon} Cabinet briefing`}</div>
      <h4>{activeDecision.title}</h4>
      <WhyNow text={activeDecision.why} />
      <p>{decisionDesc}</p>
      <div className="wl-opts" style={{ display: 'grid' }}>
        {activeDecision.options.map((opt) => { const st = decisionOpts?.find((o) => o.id === opt.id); const ok = !st || st.ok; return (
          <div key={opt.id} className="wl-opt" role="button" tabIndex={0} aria-disabled={!ok} style={{ cursor: 'pointer' }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }} onClick={() => { if (ok) dispatch({ type: 'makeDecision', payload: { option: opt.id } }); }}>
            <b>{opt.label}{opt.cost ? ` · $${opt.cost}M` : ''}</b>{ok ? opt.tags.map((t, i) => <small key={i}>· {t}</small>) : <small className="wl-reason">{st.reason}</small>}
            {fxBadge && <span style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>{Object.entries(opt.effects || {}).map(([k, v]) => fxBadge(k, v, true))}</span>}
          </div>); })}
      </div>
    </div>);
  if (flashpoint) { const fp = FLASHPOINTS[flashpoint.type]; cards.push(
    <div key="fp" className="wl-card-ev" data-event-card="flashpoint" data-focus={fc('flashpoint')} style={{ '--ev': COLOR.accent.alert }}>
      <div className="wl-label">{fp?.i} Flashpoint · {flashpoint.t}mo to act</div>
      <h4>{fp?.n} · {REGIONS[flashpoint.rid]?.n}</h4>
      <p>{fp?.d} Ignoring cedes ground to rivals (−5 you, +12 them).</p>
      <Responses kind="flashpoint" opts={fpOpts} dispatch={dispatch} />
      <button type="button" className="wl-btn" style={{ marginTop: 8 }} onClick={() => onOpenRegion(flashpoint.rid)}>Open {REGIONS[flashpoint.rid]?.n}</button>
    </div>); }
  if (worldEvent) { const we = WORLD_EVENTS[worldEvent.id]; cards.push(
    <div key="we" className="wl-card-ev" data-event-card="world" data-focus={fc('world')} style={{ '--ev': COLOR.accent.energy }}>
      <div className="wl-label">{we?.i} World event · {worldEvent.mo}mo left</div>
      <h4>{we?.n || worldEvent.id}</h4>
      <WhyNow text={worldEvent.why} />
      <p>{typeof we?.d === 'function' ? we.d(country) : we?.d}</p>
      <Responses kind="world" opts={worldOpts} dispatch={dispatch} />
    </div>); }
  // Intelligence brief ready (E9, #23): the investigation finished; the card carries the deploy timer and opens the Intel tab.
  for (const b of readyBriefs) cards.push(
    <div key={`brief_${b.type}`} className="wl-card-ev" data-event-card="brief" data-brief={b.type} style={{ '--ev': COLOR.accent.command }}>
      <div className="wl-label">{b.icon} Intelligence brief ready · {b.ttl}mo to deploy</div>
      <h4>{b.title}</h4>
      <p>{b.rc}</p>
      <button type="button" className="wl-btn" onClick={() => onOpenBrief(b.type)}>Open brief · {b.n} options</button>
    </div>);
  const selected = cards.find(card => card.key === expanded);
  const readable = cards.map(card => {
    const children=[card.props.children].flat();
    const review=<button key="review" type="button" className="wl-card-review" data-review-card={card.key} onClick={()=>setExpanded(card.key)}>Read full card · choose response ↗</button>;
    if(dock)return cloneElement(card,{'data-card-summary':true},...children.filter(child=>child?.type==='h4'||child?.props?.className==='wl-label'),review);
    return cloneElement(card,{},...children.flatMap(child=>child?.type==='h4'?[child,review]:[child]));
  });
  return <>
    {!doctrine && <DoctrineChoice country={country} dispatch={dispatch} onBack={onBack}/>}
    <div ref={root} className={dock ? 'wl-cards wl-dock' : 'wl-cards'} data-event-cards data-dock={dock || undefined} data-dock-count={dock ? cards.length : undefined}>
      {dock && <div className="wl-dock-head"><span className="wl-label">Cards</span><span className="wl-num">{cards.length}</span></div>}
      {readable.length ? readable : dock ? <div className="wl-dock-empty" data-dock-empty>No cards. Quiet months are for building.</div> : null}
    </div>
    {selected && <DecisionDialog title="Review decision" eyebrow="Time paused while you read" onClose={() => setExpanded(null)}>
      {cloneElement(selected, {onClick: e => { const action = e.target.closest('button,.wl-opt'); if (action && action.getAttribute('aria-disabled') !== 'true' && !action.disabled) setExpanded(null); }})}
    </DecisionDialog>}
  </>;
}
