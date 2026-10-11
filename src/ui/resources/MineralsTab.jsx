// Resources > minerals (E5c, spec Part 3 + Part 8): Reserves | Processing | Stockpile | Deals | Controls. Processing shows private builds and levers (F5, #37).
// Every row comes from mineralView / mineralFlows (the month's own rules). The v57 rare-earth export extraction lives
// on the Reserves screen next to the rare-earth ore it is not to be confused with.
import { useState } from 'react';
import { Panel, Row, Bar } from '../shell/Panel.jsx';
import { ConfirmSheet } from '../shell/Confirm.jsx';
import { WhyV, f1, tone } from '../shell/fmt.jsx';
import { MINERALS, MINERAL_RULES as R } from '../../data/minerals.js';
import { RES_META } from '../../data/energy.js';
import { NATIONS } from '../../data/nations.js';
import { mineralView, rivalSupplyFactor, leverCost } from '../../sim/minerals.js';

export const RES_SUBS = [
  { id: 'reserves', label: 'Reserves' }, { id: 'processing', label: 'Processing' }, { id: 'stockpile', label: 'Stockpile' },
  { id: 'deals', label: 'Deals' }, { id: 'controls', label: 'Controls' }, { id: 'natural', label: 'Natural' },
];
// F5 (#37): a private build (processing plant or GGRB retort) and the state levers on it. o = projectOutlook from the engine.
export function PrivateBuild({ o, label, dispatch }) {
  const pct = Math.round((o.prog / o.need) * 100);
  const head = o.block === 'not authorized' ? null : o.block ? `${label}: ${o.block}`
    : o.profitable ? `🏗️ Private ${label} ${pct}% · ~${o.eta}mo` : `${label} not profitable for investors`;
  if (!head) return null;
  return <div data-private={o.id} style={{ marginTop: 4 }}>
    <div className="wl-row" style={{ justifyContent: 'space-between' }}>
      <small>{head}</small>
      <WhyV title={`Investor margin: ${label}`} terms={[...o.terms, ...o.levers.filter((k) => R.levers[k].margin).map((k) => ({ label: R.levers[k].n, value: R.levers[k].margin }))]} total={o.margin}
        note={`Builds when margin ≥ 1${o.levers.includes('guarantee') ? ' (offtake guarantee floors it at 1)' : ''}. Pace ${f1(o.pace)} months of work per month. Capex $${o.capex.toLocaleString()}M is the investors'.`}>×{o.margin.toFixed(2)}</WhyV>
    </div>
    {o.profitable && <Bar pct={pct} tone="good" />}
    {!o.block && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 6, marginTop: 4 }} role="group" aria-label={`State levers: ${label}`}>
      {Object.entries(R.levers).map(([k, L]) => { const on = o.levers.includes(k); return <button key={k} type="button" className={`wl-btn${on ? '' : ' wl-btn-primary'}`} aria-pressed={on} data-lever={k} title={L.n} aria-label={`${L.n}${on ? ' (in force)' : ` $${leverCost(o.capex, k)}M`}`}
        onClick={() => dispatch({ type: 'enactLever', payload: { project: o.id, lever: k } })}>{L.i} {L.s} {on ? '✓' : `$${leverCost(o.capex, k)}M`}</button>; })}
    </div>}
  </div>;
}

const mo = (r) => (r.cap > 0 && r.ore > 0 ? Math.ceil(r.ore / r.cap) : null);

function RareEarthExport({ v, dispatch }) {
  const res = v.resources?.rareEarth; if (!res) return null;
  const meta = RES_META.rareEarth; const pct = res.max > 0 ? Math.round((res.r / res.max) * 100) : 0; const rate = v.resExtraction.rareEarth || 0;
  const left = rate > 0 && res.r > 0 ? Math.round(res.r / (rate * meta.depRate)) : null;
  return <Panel id="re-export" title="Rare earths · export extraction (v57)" figure={`${pct}%`} tone={tone(pct, 20, 50)} data-re-export>
    <Row title="Export reserve" sub="Sells ore on the world market. Separate from the processing feedstock above: it does not feed your plants."
      value={left ? `${Math.round(left / 12)}y left` : rate ? '∞' : 'off'} tone={left && left < 24 ? 'alert' : undefined}><Bar pct={pct} tone={tone(pct, 20, 50)} /></Row>
    <Row title="Revenue" sub={`Depletes ${(rate * meta.depRate).toFixed(2)}/mo at this rate`} value={`$${Math.round(rate * meta.rev).toLocaleString()}M/mo`} tone="good" />
    {pct < 2 ? <div className="wl-note" data-tone="alert">Reserves depleted. Import deals required.</div>
      : <div className="wl-row" role="group" aria-label="Rare-earth extraction rate">{[0, 1, 2, 3, 4, 5].map((l) => <button key={l} type="button" className="wl-btn" style={{ flex: 1 }} aria-pressed={rate === l} onClick={() => dispatch({ type: 'setExtraction', payload: { resource: 'rareEarth', level: l } })}>{l === 0 ? 'Off' : l}</button>)}</div>}
  </Panel>;
}

function Reserves({ rows, v, dispatch }) {
  const top = Math.max(1, ...rows.map((r) => r.ore));
  return <>
    <Panel id="ore" title="Ore reserves" figure={`${rows.filter((r) => r.ore > 0).length}/${rows.length} with ore`}>
      {rows.map((r) => { const m = mo(r); return (
        <Row key={r.id} data-mineral={r.id} title={`${r.i} ${r.n}`}
          sub={r.ore > 0 && !r.cap ? `${Math.round(r.ore)} ore, no refining: worth nothing until investors build processing` : r.cap && !r.ore ? `No ore: plants run at ${R.noOreEff * 100}% on imported concentrate` : `${Math.round(r.ore)} ore · ${r.use}`}
          value={m ? `${m}mo to zero` : r.ore > 0 ? 'unrefined' : '—'} tone={m && m < 24 ? 'alert' : m && m < 60 ? 'warn' : undefined}><Bar pct={(r.ore / top) * 100} tone={m && m < 24 ? 'alert' : undefined} /></Row>); })}
      <div className="wl-note">Home plants refine up to their capacity each month and the ore depletes with it. Time to zero = ore / capacity.</div>
    </Panel>
    <RareEarthExport v={v} dispatch={dispatch} />
  </>;
}

function Processing({ rows, dispatch }) {
  return <Panel id="proc" title="Processing capacity" figure={`${rows.reduce((a, r) => a + r.cap, 0)}/mo`}>
    {rows.map((r) => (
      <Row key={r.id} data-mineral={r.id} title={`${r.i} ${r.n}`} stack
        sub={`${r.cap}/mo ≈ ${r.cap}% of world refining${r.built ? ` · ${r.built} private plant${r.built > 1 ? 's' : ''}` : ''}${r.income ? ` · sector +$${f1(r.income)}M/mo` : ''}${r.upkeep ? ` · $${r.upkeep}M/mo` : ''}`}
        value={<WhyV title={`${r.n} inflow / month`} terms={[{ label: 'Home processing', value: r.flow.dom }, { label: 'Recycling', value: r.flow.rec }, { label: 'Offtake deals', value: r.flow.off }, { label: 'Allied pact', value: r.flow.pact }, { label: 'Open market', value: r.flow.mkt }]} total={r.flow.total} note={`Secure supply ${f1(r.flow.secure)}/mo (no market).`}>+{f1(r.flow.total)}/mo</WhyV>}>
        <PrivateBuild o={r.proj} label="plant" dispatch={dispatch} />
        <div className="wl-row" style={{ flexWrap: 'wrap', marginTop: 4 }}>
          {r.id !== 'enrichment' && <button type="button" className="wl-btn" aria-pressed={r.recycling} onClick={() => dispatch({ type: 'toggleRecycling', payload: { mineral: r.id } })}>{r.recycling ? '♻️ Stop recycling' : `♻️ Recycle +${R.recycle.add}/mo · $${R.recycle.cost}M/mo`}</button>}
        </div>
      </Row>))}
    <div className="wl-note">Private capital builds plants (+{R.plant.add}/mo, {R.plant.mo} months at pace 1) while they are profitable: world price, scarcity from others' export controls, demand from your programs. Levers (permits, tax credit, loan guarantee, DPA funding, offtake guarantee) cost a fraction of the ${R.plant.capex.toLocaleString()}M capex and last until that plant is online. New capacity pays royalties and tax. 1 unit/mo = 1% of 2024 world refining; capped at {R.capMax}/mo.</div>
  </Panel>;
}

function Stockpile({ rows, dispatch }) {
  return <Panel id="stock" title="Stockpile and reserve" figure={`${rows.reduce((a, r) => a + Math.floor(r.stock), 0)} units`}>
    {rows.map((r) => (
      <Row key={r.id} data-mineral={r.id} title={`${r.i} ${r.n}`} stack sub={`reserve ${r.reserve}/${R.reserveMax} · ${r.releasing ? 'releasing' : 'on hold'} · inflow +${f1(r.flow.total)}/mo`} value={`${Math.floor(r.stock)}/${R.stockMax}`} tone={r.stock < 5 ? 'alert' : undefined}>
        <Bar pct={(r.stock / R.stockMax) * 100} tone={r.stock < 5 ? 'alert' : 'good'} />
        <div className="wl-row" style={{ flexWrap: 'wrap', marginTop: 4 }}>
          <button type="button" className="wl-btn wl-btn-primary" onClick={() => dispatch({ type: 'buyStockpile', payload: { mineral: r.id } })}>📦 Buy reserve ${Math.round(R.stockpile.lot * r.price * R.stockpile.markup)}M</button>
          <button type="button" className="wl-btn" aria-pressed={r.releasing} onClick={() => dispatch({ type: 'toggleStockpileRelease', payload: { mineral: r.id } })}>{r.releasing ? '⏸ Hold reserve' : '▶ Release reserve'}</button>
        </div>
      </Row>))}
    <div className="wl-note">Buy {R.stockpile.lot} units at {Math.round((R.stockpile.markup - 1) * 100)}% over market; a released reserve feeds {R.stockpile.release}/mo into the stockpile.</div>
  </Panel>;
}

function Deals({ rows, v, dispatch }) {
  const nb = NATIONS[v.country?.id]?.bloc; const canPact = nb === 'west' || nb === 'east'; const pact = v.minerals?.pact;
  const deals = rows.flatMap((r) => r.deals.map((d) => ({ ...d, r })));
  return <>
    {canPact && <Panel id="pact" title="Allied processing pact" figure={pact ? 'active' : 'off'} tone={pact ? 'good' : undefined}>
      <button type="button" className={`wl-btn ${pact ? 'wl-btn-warn' : 'wl-btn-primary'}`} style={{ width: '100%' }} onClick={() => dispatch({ type: 'toggleProcessingPact', payload: {} })}>{pact ? `🤝 Processing pact active · $${R.pact.cost}M/mo — end` : `🤝 Processing pact · bloc partners supply you first — $${R.pact.cost}M/mo`}</button>
      <div className="wl-note">Bloc partners sell you ×{R.pact.share} their open-market share and never control exports against you.</div>
    </Panel>}
    <Panel id="deals" title="Offtake deals" figure={deals.length}>
      {deals.length === 0 && <div className="wl-note">No offtake deals. Sign one below: a fixed {R.offtake.term}-month supply at a relation-priced rate.</div>}
      {deals.map((d) => <Row key={`${d.m}_${d.n}`} data-deal={`${d.m}_${d.n}`} title={`📄 ${d.r.n} · ${d.name}`} sub={`${d.units}/mo · ${d.mo}mo left${d.paused ? ' · paused: they control exports' : ''}`} value={`$${d.price}M/mo`} tone={d.paused ? 'alert' : undefined}
        trailing={<button type="button" className="wl-btn wl-btn-alert" onClick={() => dispatch({ type: 'cancelOfftake', payload: { mineral: d.m, nation: d.n } })}>Cancel</button>} />)}
    </Panel>
    <Panel id="partners" title="Available partners" figure={rows.reduce((a, r) => a + r.partners.length, 0)}>
      {rows.map((r) => <Row key={r.id} data-mineral={r.id} title={`${r.i} ${r.n}`} sub={r.partners.length ? undefined : 'No willing processor (none refines it, or all control exports)'} stack>
        <div className="wl-row" style={{ flexWrap: 'wrap', marginTop: 4 }}>{r.partners.map((pn) => <button key={pn.id} type="button" className="wl-btn wl-btn-primary" onClick={() => dispatch({ type: 'signOfftake', payload: { mineral: r.id, nation: pn.id } })}>📄 Offtake · {pn.n} {pn.units}/mo ${pn.price}M/mo</button>)}</div>
      </Row>)}
    </Panel>
  </>;
}

function Controls({ rows, v, dispatch, ask }) {
  const rivals = Object.keys(v.globalDef).filter((id) => id !== v.country?.id && NATIONS[id]);
  const against = rows.filter((r) => r.controlledBy.length);
  const mine = rows.filter((r) => r.canControl);
  const turnOn = (r) => ask({ title: `Export control: ${r.n}`, cost: `$${r.controlCost}M/mo in lost sales`, kind: 'alert', label: 'Impose control',
    lines: [`Rivals that do not refine ${r.n} lose up to ${R.controls.rivalCut * 100}% of R&D growth, scaled by your world share.`, `Relations −${R.controls.relHit} with nations outside your bloc.`, 'Costs trade income every month until lifted.'], run: () => dispatch({ type: 'toggleExportControl', payload: { mineral: r.id } }) });
  return <>
    <Panel id="my-controls" title="Your export controls" figure={`${mine.filter((r) => r.controlled).length} active`} tone={mine.some((r) => r.controlled) ? 'warn' : undefined}>
      {mine.length === 0 && <div className="wl-note">You process none of the list yet. Build capacity first.</div>}
      {mine.map((r) => <Row key={r.id} data-mineral={r.id} stack title={`${r.i} ${r.n}`} sub={`${r.cap}/mo processed${r.controlled ? ` · costs $${r.controlCost}M/mo` : ''}`} value={r.controlled ? '🔒 on' : 'open'} tone={r.controlled ? 'warn' : undefined}
        trailing={<button type="button" className={`wl-btn ${r.controlled ? '' : 'wl-btn-warn'}`} onClick={() => (r.controlled ? dispatch({ type: 'toggleExportControl', payload: { mineral: r.id } }) : turnOn(r))}>{r.controlled ? '🔓 Lift export control' : `🔒 Export control · −${R.controls.relHit} relations`}</button>} />)}
    </Panel>
    <Panel id="against" title="Controls against you" figure={against.length} tone={against.length ? 'alert' : 'good'}>
      {against.length === 0 && <div className="wl-note">No processor is controlling exports to you.</div>}
      {against.map((r) => <Row key={r.id} data-mineral={r.id} title={`${r.i} ${r.n}`} sub={`${r.controlledBy.join(', ')} control${r.controlledBy.length > 1 ? '' : 's'} exports to you`} value="⛔" tone="alert" />)}
      <div className="wl-note">An AI processor controls exports at tension ≥{R.aiTension}, while you sanction or embargo it, or while it embargoes you. Never against bloc partners under your pact.</div>
    </Panel>
    <Panel id="rivals" title="Rival impact of your controls" figure={`${mine.filter((r) => r.controlled).length ? 'live' : 'none'}`}>
      {rivals.map((id) => { const f = rivalSupplyFactor(v, id); return <Row key={id} data-rival={id} title={`${NATIONS[id].flag || ''} ${NATIONS[id].n}`} sub="R&D growth multiplier" value={`×${f.toFixed(2)}`} tone={f < 1 ? 'alert' : undefined} />; })}
    </Panel>
  </>;
}

export function MineralsTab({ sub, view, dispatch }) {
  const [act, setAct] = useState(null);
  const rows = mineralView(view);
  const body = sub === 'processing' ? <Processing rows={rows} dispatch={dispatch} /> : sub === 'stockpile' ? <Stockpile rows={rows} dispatch={dispatch} />
    : sub === 'deals' ? <Deals rows={rows} v={view} dispatch={dispatch} /> : sub === 'controls' ? <Controls rows={rows} v={view} dispatch={dispatch} ask={setAct} />
    : <Reserves rows={rows} v={view} dispatch={dispatch} />;
  return <div className="wl-tabroot" data-minerals data-minerals-sub={sub}>{body}<ConfirmSheet act={act} onClose={() => setAct(null)} /></div>;
}
