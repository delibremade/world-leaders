// Allocation surface (docs/DESIGN-SYSTEM-V2.md §4): one pool, five lines. With the pool held, dragging one line
// squeezes the unlocked others proportionally (pool.js); a lock exempts a line; each line shows its change against
// the baseline; a "squeezed" alert lists what was cut. The same component is the quick drawer over the map (compact)
// and the full surface in Economy. Zero game logic: every change dispatches setSectorBudget; costs come from the
// engine's calcSCost through pool.js.
import { useEffect, useRef, useState } from 'react';
import { SECTOR_LABELS } from '../../data/economy.js';
import { SECTORS, ALLOC, costOf, poolCost, squeeze, deltas } from './pool.js';
import { COLOR } from '../tokens.js';

const money = (v) => `$${Math.round(v).toLocaleString('en-US')}M`;
const signed = (v, unit = '') => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}${unit}`;

export function Allocation({ allocs, maturity = {}, age = {}, treasury = 0, locks, onLock, hold, onHold, baseline = {}, dispatch, compact = false, selected = null, onSelect, children }) {
  const [last, setLast] = useState(null); // the last squeeze: what was cut, for the alert
  const [drag, setDrag] = useState(null); // {sector, value} while a slider moves: local until release, so a drag is one action
  const live = drag ? { ...allocs, [drag.sector]: drag.value } : allocs;
  const pool = poolCost(live, maturity); const base = poolCost(baseline, maturity); const d = deltas(live, baseline, maturity);
  const latest = useRef(null); latest.current = { allocs, locks, maturity, hold, dispatch };
  // Sliders and command-card buttons share this one commit path, including pool locks.
  const commit = (sector, value) => {
    const { allocs, locks, maturity, hold, dispatch } = latest.current;
    setDrag(null);
    if (!hold) { dispatch({ type: 'setSectorBudget', payload: { sector, value } }); setLast(null); return; }
    const r = squeeze({ allocs, locks, maturity, sector, value });
    dispatch({ type: 'setSectorBudgets', payload: { allocs: r.allocs } });
    setLast(r);
  };
  // Commit on the native change event: it fires once on pointer release (or key release), after the input events of a drag.
  const root = useRef(null);
  useEffect(() => {
    const el = root.current; if (!el) return;
    const onChange = (e) => {
      const t = e.target; if (!(t instanceof HTMLInputElement) || t.type !== 'range' || !t.dataset.sector) return;
      commit(t.dataset.sector, +t.value);
    };
    el.addEventListener('change', onChange); return () => el.removeEventListener('change', onChange);
  }, []);
  const move = (sector, value) => setDrag({ sector, value });
  return (
    <div ref={root} className={`wl-alloc${compact ? ' wl-alloc-compact' : ''}`} data-allocation={compact ? 'drawer' : 'full'} data-dragging={drag?.sector || undefined}>
      {drag && <div className="wl-alloc-preview" data-drag-preview>{SECTOR_LABELS[drag.sector]} → {drag.value}% · release to commit{hold ? ' (the unlocked lines give way)' : ''}</div>}
      <div className="wl-alloc-head">
        <div className="wl-well wl-alloc-pool" data-pool title="Sum of the five sector lines this month (engine calcSCost)">
          <span className="wl-label">Pool</span><b className="wl-num">{money(pool)}/mo</b>
          <small className="wl-num" data-pool-delta style={{ color: pool > base ? COLOR.accent.alert : pool < base ? COLOR.accent.good : COLOR.text.dim }}>{signed(Math.round(pool - base), 'M')} vs baseline</small>
        </div>
        <button type="button" className={`wl-btn wl-btn-sm${hold ? ' wl-btn-primary' : ''}`} data-pool-hold aria-pressed={!!hold} onClick={() => onHold(!hold)} title="Hold the pool: dragging one line squeezes the unlocked others proportionally. Off: each line moves alone.">{hold ? '🔒 Pool held' : '🔓 Pool free'}</button>
      </div>
      {last?.squeezed && <div className="wl-alloc-alert" data-squeezed role="status">
        <b>Squeezed</b> to pay for {SECTOR_LABELS[last.moved.sector]} {last.moved.from}% → {last.moved.to}%: {last.cuts.filter((c) => c.to < c.from).map((c) => `${SECTOR_LABELS[c.sector]} ${c.from}% → ${c.to}%`).join(' · ')}
      </div>}
      {last && !last.squeezed && last.fed && <div className="wl-alloc-alert" data-fed role="status"><b>Freed</b> money fed {last.cuts.map((c) => `${SECTOR_LABELS[c.sector]} ${c.from}% → ${c.to}%`).join(' · ')}</div>}
      {last && hold && !last.cuts.length && last.moved.from !== last.moved.to && <div className="wl-alloc-alert" data-unsqueezed role="status"><b>Pool grew</b>: every other line is locked or at its floor, so nothing could give way.</div>}
      {SECTORS.map((sector) => {
        const alloc = live[sector] ?? 100; const cost = costOf(sector, alloc, maturity); const locked = locks.has(sector); const dd = d[sector];
        const a = age[sector] || 0; const decaying = a > 480; const nearEnd = a > 360 && a <= 480;
        const tone = alloc > 100 ? COLOR.accent.warn : alloc < 100 ? COLOR.accent.good : COLOR.text.dim;
        return (
          <div key={sector} className="wl-alloc-line" data-alloc-line={sector} data-locked={locked || undefined} aria-selected={selected === sector || undefined}>
            <div className="wl-alloc-row">
              <button type="button" className="wl-alloc-name" data-budget-line={sector} aria-pressed={selected === sector} onClick={() => onSelect?.(selected === sector ? null : sector)}>{SECTOR_LABELS[sector]}</button>
              <span className="wl-chip" data-delta={sector} title="Change against the baseline (allocation when this game opened)" style={{ color: dd.dAlloc > 0 ? COLOR.accent.warn : dd.dAlloc < 0 ? COLOR.accent.good : COLOR.text.dim }}>{signed(dd.dAlloc, '%')} · {signed(Math.round(dd.dCost), 'M')}</span>
              {decaying && <span className="wl-chip wl-chip-alert wl-pulse">⚠ aging</span>}
              {nearEnd && !decaying && <span className="wl-chip wl-chip-warn">⏱ {480 - a}mo</span>}
              <span className="wl-num wl-alloc-cost" style={{ color: tone }}>{money(cost)}/mo</span>
              <button type="button" className="wl-btn wl-btn-sm" data-lock={sector} aria-pressed={locked} onClick={() => onLock(sector, !locked)} title={locked ? 'Locked: never squeezed. Tap to unlock.' : 'Unlocked: gives way when the pool is held. Tap to lock.'}>{locked ? 'Locked' : 'Lock'}</button>
            </div>
            <div className="wl-alloc-row">
              <span className="wl-num wl-alloc-pct" style={{ color: tone }}>{alloc}%</span>
              <input className="wl-slider" type="range" min={ALLOC.min} max={ALLOC.max} step={ALLOC.step} value={alloc} data-sector={sector} aria-label={`${SECTOR_LABELS[sector]} allocation`} onChange={(e) => move(sector, +e.target.value)} />
              <span className="wl-alloc-eff">{alloc > 100 ? `+${((alloc - 100) / 100).toFixed(2)}× gains` : alloc < 100 ? `−${((100 - alloc) / 100).toFixed(2)}× decay` : 'Normal'}</span>
            </div>
            {!compact && decaying && <button type="button" className="wl-btn wl-btn-alert" data-modernize-sector={sector} onClick={() => dispatch({ type: 'modernizeSector', payload: { sector } })}>🔄 Great Modernization — costs 30% treasury ({money(treasury * 0.3)})</button>}
            {selected === sector && (typeof children === 'function' ? children(commit) : children)}
          </div>);
      })}
    </div>
  );
}
