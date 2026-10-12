// Trade desktop: every nation in one sortable table beside the selected nation's full action sheet (the same
// NationSheet the map opens), instead of tap-through accordions. Reads the view the sheet already takes; no game logic.
import { useState } from 'react';
import { DataTable } from '../shell/DataTable.jsx';
import { NationSheet } from '../shell/NationSheet.jsx';
import { NATIONS, NATION_BLOC } from '../../data/nations.js';
import { isAllyOf } from '../../sim/formulas.js';

const mark = (b) => (b ? '✓' : '—');
export function NationDesk({ view, dispatch }) {
  const me = view.country?.id; const [sel, setSel] = useState(null);
  const ids = Object.keys(NATIONS).filter((id) => id !== me);
  const cur = ids.includes(sel) ? sel : ids[0];
  const rel = (id) => Math.round(view.nationRelations?.[id] || 0);
  const cols = [
    { id: 'n', label: 'Nation', get: (id) => NATIONS[id].n, cell: (id) => `${NATIONS[id].flag || ''} ${NATIONS[id].n}${isAllyOf(me, id) ? ' · ally' : ''}` },
    { id: 'bloc', label: 'Bloc', get: (id) => NATION_BLOC[id] || 'non-aligned' },
    { id: 'rel', label: 'Rel', hint: 'Relations', num: true, get: rel, tone: (id) => (rel(id) >= 50 ? 'good' : rel(id) < 0 ? 'alert' : undefined) },
    { id: 'ten', label: 'Tens', hint: 'Tension', num: true, get: (id) => view.rivalTension?.[id] ?? -1, cell: (id) => (view.rivalTension?.[id] != null ? Math.round(view.rivalTension[id]) : '—'), tone: (id) => ((view.rivalTension?.[id] || 0) >= 70 ? 'alert' : (view.rivalTension?.[id] || 0) >= 40 ? 'warn' : undefined) },
    { id: 'emb', label: 'Emb', hint: 'Embassy', get: (id) => +!!view.embassies?.has(id), cell: (id) => mark(view.embassies?.has(id)), tone: (id) => (view.embassies?.has(id) ? 'good' : undefined) },
    { id: 'trade', label: 'Trade', get: (id) => +!!view.tradeAgreements?.has(id), cell: (id) => mark(view.tradeAgreements?.has(id)), tone: (id) => (view.tradeAgreements?.has(id) ? 'good' : undefined) },
    { id: 'pact', label: 'Pact', get: (id) => +!!view.defensePacts?.has(id), cell: (id) => mark(view.defensePacts?.has(id)), tone: (id) => (view.defensePacts?.has(id) ? 'good' : undefined) },
    { id: 'sanc', label: 'Sanc', hint: 'Sanctions or embargo', get: (id) => +!!view.sanctions?.has(id), cell: (id) => (view.embargoes?.has(id) ? 'embargo' : mark(view.sanctions?.has(id))), tone: (id) => (view.sanctions?.has(id) || view.embargoes?.has(id) ? 'warn' : undefined) },
    { id: 'inf', label: 'Infl', hint: 'Influence weight', num: true, get: (id) => view.influenceAlloc?.[id] || 0, cell: (id) => (view.influenceAlloc?.[id] ? `${view.influenceAlloc[id]}%` : '—') },
  ];
  return (
    <div className="wl-md wl-nation-desk" data-master-detail="nations">
      <div><DataTable id="nations" label="Nations" title="Nations · relations, ties and pressure" columns={cols} rows={ids} rowId={(id) => id} selected={cur} onSelect={setSel} rowProps={(id) => ({ 'data-nation-row': id })} /></div>
      <div data-detail="nations"><section className="wl-panel wl-p"><div className="wl-p-body" style={{ paddingTop: 12 }}>
        <div className="wl-label" style={{ marginBottom: 8 }}>{NATIONS[cur].flag} {NATIONS[cur].n} · every action</div>
        <NationSheet key={cur} nation={cur} view={view} dispatch={dispatch} />
      </div></section></div>
    </div>
  );
}
