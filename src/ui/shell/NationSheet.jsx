// Nation sheet body: status chips, the influence why-breakdown, and every nation-keyed verb as a row.
// Verbs with a choice (mission, weight, vertical, op) show their options as a chip strip; the row dispatches.
import { useState } from 'react';
import { NATIONS, NATION_BLOC } from '../../data/nations.js';
import { REGIONS } from '../../data/regions.js';
import { isAllyOf } from '../../sim/formulas.js';
import { influencePool, influenceGain } from '../../sim/selectors.js';
import { verbsFor, isRival } from './nation-verbs.js';
import { Why } from './Why.jsx';
import { COLOR } from '../tokens.js';

export function NationSheet({ nation, view, dispatch }) {
  const n = NATIONS[nation]; const [picked, setPicked] = useState({});
  if (!n) return null;
  const rel = view.nationRelations?.[nation] || 0; const ten = view.rivalTension?.[nation];
  const ally = isAllyOf(view.country?.id, nation);
  const { infPool, totW } = influencePool(view);
  const inf = influenceGain(view, view.stats?.stability || 0, { id: nation, region: n.region }, infPool, totW);
  const chips = [
    [`${n.flag} ${REGIONS[n.region]?.n || n.region}`, ''], [NATION_BLOC[nation] ? `${NATION_BLOC[nation]} bloc` : 'non-aligned', ''], ally ? ['Ally', 'good'] : null,
    isRival(view, nation) ? [`Tension ${Math.round(ten || 0)}`, (ten || 0) >= 70 ? 'alert' : (ten || 0) >= 40 ? 'warn' : ''] : null,
    view.embassies?.has(nation) ? ['Embassy', 'command'] : null, view.defensePacts?.has(nation) ? ['Pact', 'good'] : null, view.tradeAgreements?.has(nation) ? ['Trade', 'good'] : null,
    view.sanctions?.has(nation) ? ['Sanctioned', 'warn'] : null, view.embargoes?.has(nation) ? ['Embargoed', 'alert'] : null,
  ].filter(Boolean);
  const rows = verbsFor(view, nation);
  return (
    <div data-nation-sheet={nation}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>{chips.map(([l, k]) => <span key={l} className={`wl-chip${k ? ' wl-chip-' + k : ''}`}>{l}</span>)}</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <Why title={`Influence on ${n.n}`} mult terms={inf.terms.map((t) => ({ key: t.k, label: t.label, value: t.m }))} total={inf.gain} totalLabel="Relations gain / month" note={infPool > 0 ? `Capped at +6. Pool $${infPool}M across weight ${totW}.` : 'Influence budget is off (Trade tab).'} className="wl-fig" style={{ flex: 1 }}>
          <div><div className="wl-fig-l">Relations</div><div className="wl-fig-v" style={{ color: rel >= 50 ? COLOR.accent.good : rel < 0 ? COLOR.accent.alert : COLOR.text.primary }}>{Math.round(rel)}<span className="wl-fig-d" style={{ color: COLOR.accent.good }}>{inf.gain > 0 ? `+${inf.gain.toFixed(1)}/mo` : ''}</span></div></div>
        </Why>
      </div>
      {rows.map((r) => {
        const cur = picked[r.type] ?? r.cur ?? r.opts?.[0]?.[0];
        return (
          <div key={r.type} data-verb-row={r.type}>
            <button type="button" className="wl-verb" data-kind={r.kind} disabled={!!r.note || (r.opts && !r.opts.length)} title={r.note || r.fx} onClick={() => dispatch({ type: r.type, payload: r.payload(nation, cur) })}>
              <span aria-hidden="true" style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{r.icon}</span>
              <span style={{ flex: 1, minWidth: 0 }}><b>{r.label}</b><small>{r.note || r.fx}</small></span>
              {r.cost && <span className="wl-verb-cost">{r.cost}</span>}
            </button>
            {r.opts && <div className="wl-verb-opts" role="group" aria-label={`${r.label} options`}>{r.opts.length ? r.opts.map(([id, l]) => <button key={id} type="button" aria-pressed={cur === id} onClick={() => setPicked((p) => ({ ...p, [r.type]: id }))}>{l}</button>) : <span className="wl-label">Nothing eligible yet</span>}</div>}
          </div>);
      })}
    </div>
  );
}
