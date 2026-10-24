import { TradeDesk } from './TradeDesk.jsx';
// Resources > minerals (E5c, spec Part 3 + Part 8): Reserves | Processing | Stockpile | Deals | Controls. Processing shows private builds and levers (F5, #37).
// Every row comes from mineralView / mineralFlows (the month's own rules). The v57 rare-earth export extraction lives
// on the Reserves screen next to the rare-earth ore it is not to be confused with.
import { useState } from 'react';
import { Panel, Row, Bar } from '../shell/Panel.jsx';
import { DataTable } from '../shell/DataTable.jsx';
import { useWide } from '../shell/useWide.js';
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

// F10 (#58): real units. t = tonnes (or kSWU for enrichment); every figure is game units x tPerUnit, source on the row.
const fmtT = (t) => (t <= 0 ? '0' : t >= 1e6 ? `${(t / 1e6).toFixed(1)}M` : t >= 1e4 ? `${Math.round(t / 1e3)}k` : t >= 1e3 ? `${(t / 1e3).toFixed(1)}k` : t >= 10 ? `${Math.round(t)}` : t.toFixed(1));
const yrs = (y) => (y >= 100 ? '100y+' : y >= 10 ? `${Math.round(y)}y` : `${y.toFixed(1)}y`);
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

function ReserveRow({ r, top }) {
  const m = mo(r);
  return (

        <Row key={r.id} data-mineral={r.id} title={`${r.i} ${r.n}`}
          sub={r.ore > 0 && !r.cap ? `${fmtT(r.oreT)} ${r.unit} ore, no refining: worth nothing until investors build processing` : r.cap && !r.ore ? `No ore: plants run at ${R.noOreEff * 100}% on imported concentrate` : `${fmtT(r.oreT)} ${r.unit} ore · ${fmtT(r.capT)} ${r.unit}/yr refined · ${r.use}`}
          value={r.years != null ? `${yrs(r.years)} to zero` : r.ore > 0 ? 'unrefined' : '—'} tone={m && m < 24 ? 'alert' : m && m < 60 ? 'warn' : undefined}><Bar pct={(r.ore / top) * 100} tone={m && m < 24 ? 'alert' : undefined} />
          <small className="wl-note" data-source>{r.status_source}</small></Row>
  );
}

function ProcRow({ r, dispatch }) {
  return (
      <Row key={r.id} data-mineral={r.id} title={`${r.i} ${r.n}`} stack
        sub={`${fmtT(r.capT)} ${r.unit}/yr ≈ ${r.cap}% of world (${fmtT(r.worldT)})${r.built ? ` · ${r.built} private plant${r.built > 1 ? 's' : ''}` : ''}${r.income ? ` · sector +$${f1(r.income)}M/mo` : ''}${r.upkeep ? ` · $${r.upkeep}M/mo` : ''}`}
        value={<WhyV title={`${r.n} inflow / month`} terms={[{ label: 'Home processing', value: r.flow.dom }, { label: 'Recycling', value: r.flow.rec }, { label: 'Offtake deals', value: r.flow.off }, { label: 'Allied pact', value: r.flow.pact }, { label: 'Open market', value: r.flow.mkt }]} total={r.flow.total} note={`Secure supply ${f1(r.flow.secure)}/mo (no market).`}>+{f1(r.flow.total)}/mo</WhyV>}>
        <div data-plants={r.id}>{r.plants.map((pl) => <small key={pl.name} className="wl-note" style={{ display: 'block' }}>🏭 {pl.name} · {fmtT(pl.t)} {r.unit}/yr</small>)}</div>
        <small className="wl-note" data-source style={{ display: 'block' }}>{r.status_source}</small>
        <PrivateBuild o={r.proj} label="plant" dispatch={dispatch} />
        <div className="wl-row" style={{ flexWrap: 'wrap', marginTop: 4 }}>
          {r.id !== 'enrichment' && <button type="button" className="wl-btn" aria-pressed={r.recycling} onClick={() => dispatch({ type: 'toggleRecycling', payload: { mineral: r.id } })}>{r.recycling ? '♻️ Stop recycling' : `♻️ Recycle +${R.recycle.add}/mo · $${R.recycle.cost}M/mo`}</button>}
        </div>
      </Row>
  );
}

function StockRow({ r, dispatch }) {
  return (
      <Row key={r.id} data-mineral={r.id} title={`${r.i} ${r.n}`} stack sub={`reserve ${r.reserve}/${R.reserveMax} · ${r.releasing ? 'releasing' : 'on hold'} · inflow +${fmtT(r.inflowT)} ${r.unit}/mo`} value={`${fmtT(r.stockT)}/${fmtT(r.stockMaxT)} ${r.unit}`} tone={r.stock < 5 ? 'alert' : undefined}>
        <Bar pct={(r.stock / R.stockMax) * 100} tone={r.stock < 5 ? 'alert' : 'good'} />
        <div className="wl-row" style={{ flexWrap: 'wrap', marginTop: 4 }}>
          <button type="button" className="wl-btn wl-btn-primary" onClick={() => dispatch({ type: 'buyStockpile', payload: { mineral: r.id } })}>📦 Buy reserve ${Math.round(R.stockpile.lot * r.price * R.stockpile.markup)}M</button>
          <button type="button" className="wl-btn" aria-pressed={r.releasing} onClick={() => dispatch({ type: 'toggleStockpileRelease', payload: { mineral: r.id } })}>{r.releasing ? '⏸ Hold reserve' : '▶ Release reserve'}</button>
        </div>
      </Row>
  );
}

const RES_NOTE = <div className="wl-note">Home plants refine up to their capacity each year and the ore depletes with it. Years to zero = ore tonnes / capacity tonnes per year. Ore is feedstock in refined-equivalent tonnes, game-scaled, not USGS reserves.</div>;
const PROC_NOTE = <div className="wl-note">Private capital builds plants (+{R.plant.add}/mo, {R.plant.mo} months at pace 1) while they are profitable: world price, scarcity from others' export controls, demand from your programs. Levers (permits, tax credit, loan guarantee, DPA funding, offtake guarantee) cost a fraction of the ${R.plant.capex.toLocaleString()}M capex and last until that plant is online. New capacity pays royalties and tax. 1% of 2024 world refining = 1 game unit/mo; tonnes are units x tonnes-per-unit; capped at {R.capMax}%.</div>;
const STK_NOTE = <div className="wl-note">Buy {R.stockpile.lot} units (a lot is 10 x the tonnes in 1 unit, shown on each row) at {Math.round((R.stockpile.markup - 1) * 100)}% over market; a released reserve feeds {R.stockpile.release}/mo into the stockpile.</div>;

// Desktop master-detail for the three per-mineral screens: a sortable table of every mineral beside the selected one's
// full row (all its levers). Phone keeps the stacked panels. Top-level component; the selection is its own state.
function MineralMD({ id, title, rows, cols, render, notes, extra }) {
  const [sel, setSel] = useState(null);
  const cur = rows.find((r) => r.id === sel) || rows[0];
  return <div className="wl-md" data-master-detail={id}>
    <div><DataTable id={id} label={title} title={title} columns={cols} rows={rows} rowId={(r) => r.id} selected={cur?.id} onSelect={setSel} rowProps={(r) => ({ 'data-mineral-row': r.id })} />{notes}</div>
    <div data-detail={id}>{cur && <Panel key={cur.id} id={`${id}-detail`} title="Selected mineral" figure={`${cur.i} ${cur.n}`}>{render(cur)}</Panel>}{extra}</div>
  </div>;
}
const nameCol = { id: 'n', label: 'Mineral', get: (r) => r.n, cell: (r) => `${r.i} ${r.n}` };

function Reserves({ rows, v, dispatch }) {
  const wide = useWide(); const top = Math.max(1, ...rows.map((r) => r.ore));
  if (wide) {
    const cols = [nameCol,
      { id: 'ore', label: 'Ore', num: true, get: (r) => r.oreT, cell: (r) => (r.ore > 0 ? `${fmtT(r.oreT)} ${r.unit}` : '—') },
      { id: 'cap', label: 'Processed', num: true, get: (r) => r.cap, cell: (r) => (r.cap ? `${r.cap}%` : '—') },
      { id: 'years', label: 'To zero', num: true, get: (r) => (r.years == null ? (r.ore > 0 ? 1e9 : 1e10) : r.years), cell: (r) => (r.years != null ? yrs(r.years) : r.ore > 0 ? 'unrefined' : '—'), tone: (r) => { const m = mo(r); return m && m < 24 ? 'alert' : m && m < 60 ? 'warn' : undefined; } }];
    return <MineralMD id="ore" title="Ore reserves" rows={rows} cols={cols} render={(r) => <ReserveRow r={r} top={top} />} notes={RES_NOTE} extra={<RareEarthExport v={v} dispatch={dispatch} />} />;
  }
  return <>
    <Panel id="ore" title="Ore reserves" figure={`${rows.filter((r) => r.ore > 0).length}/${rows.length} with ore`}>
      {rows.map((r) => <ReserveRow key={r.id} r={r} top={top} />)}
      <div className="wl-note">Home plants refine up to their capacity each year and the ore depletes with it. Years to zero = ore tonnes / capacity tonnes per year. Ore is feedstock in refined-equivalent tonnes, game-scaled, not USGS reserves.</div>
    </Panel>
    <RareEarthExport v={v} dispatch={dispatch} />
  </>;
}

function Processing({ rows, dispatch }) {
  const wide = useWide();
  if (wide) {
    const cols = [nameCol,
      { id: 'capT', label: 'Capacity /yr', num: true, get: (r) => r.capT, cell: (r) => `${fmtT(r.capT)} ${r.unit}` },
      { id: 'cap', label: 'World', num: true, get: (r) => r.cap, cell: (r) => `${r.cap}%` },
      { id: 'built', label: 'Private plants', num: true, get: (r) => r.built || 0, cell: (r) => r.built || '—' },
      { id: 'income', label: 'Income', num: true, get: (r) => r.income || 0, cell: (r) => (r.income ? `+$${f1(r.income)}M/mo` : '—'), tone: (r) => (r.income ? 'good' : undefined) },
      { id: 'rec', label: 'Recycling', get: (r) => (r.recycling ? 1 : 0), cell: (r) => (r.recycling ? '♻️ on' : '—') }];
    return <MineralMD id="proc" title="Processing capacity" rows={rows} cols={cols} render={(r) => <ProcRow r={r} dispatch={dispatch} />} notes={PROC_NOTE} />;
  }
  return <Panel id="proc" title="Processing capacity" figure={`${rows.filter((r) => r.cap > 0).length}/${rows.length} processed`}>
    {rows.map((r) => <ProcRow key={r.id} r={r} dispatch={dispatch} />)}
    <div className="wl-note">Private capital builds plants (+{R.plant.add}/mo, {R.plant.mo} months at pace 1) while they are profitable: world price, scarcity from others' export controls, demand from your programs. Levers (permits, tax credit, loan guarantee, DPA funding, offtake guarantee) cost a fraction of the ${R.plant.capex.toLocaleString()}M capex and last until that plant is online. New capacity pays royalties and tax. 1% of 2024 world refining = 1 game unit/mo; tonnes are units x tonnes-per-unit; capped at {R.capMax}%.</div>
  </Panel>;
}

function Stockpile({ rows, dispatch }) {
  const wide = useWide();
  if (wide) {
    const cols = [nameCol,
      { id: 'stock', label: 'Stock', num: true, get: (r) => r.stock, cell: (r) => `${fmtT(r.stockT)}/${fmtT(r.stockMaxT)}`, tone: (r) => (r.stock < 5 ? 'alert' : undefined) },
      { id: 'reserve', label: 'Reserve', num: true, get: (r) => r.reserve, cell: (r) => `${r.reserve}/${R.reserveMax}` },
      { id: 'rel', label: 'Reserve mode', get: (r) => (r.releasing ? 1 : 0), cell: (r) => (r.releasing ? 'releasing' : 'on hold') },
      { id: 'in', label: 'Inflow /mo', num: true, get: (r) => r.inflowT, cell: (r) => `+${fmtT(r.inflowT)} ${r.unit}` }];
    return <MineralMD id="stock" title="Stockpile and reserve" rows={rows} cols={cols} render={(r) => <StockRow r={r} dispatch={dispatch} />} notes={STK_NOTE} />;
  }
  return <Panel id="stock" title="Stockpile and reserve" figure={`${rows.filter((r) => r.stock >= 1).length}/${rows.length} stocked`}>
    {rows.map((r) => <StockRow key={r.id} r={r} dispatch={dispatch} />)}
    <div className="wl-note">Buy {R.stockpile.lot} units (a lot is 10 x the tonnes in 1 unit, shown on each row) at {Math.round((R.stockpile.markup - 1) * 100)}% over market; a released reserve feeds {R.stockpile.release}/mo into the stockpile.</div>
  </Panel>;
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

export function MineralsTab({ sub, view, dispatch, onOpenNation, initialMineral }) {
  const [act, setAct] = useState(null);
  const rows = mineralView(view);
  const body = sub === 'processing' ? <Processing rows={rows} dispatch={dispatch} /> : sub === 'stockpile' ? <Stockpile rows={rows} dispatch={dispatch} />
    : sub === 'deals' ? <TradeDesk key={initialMineral||"all"} initialMineral={initialMineral} rows={rows} v={view} dispatch={dispatch} onOpenNation={onOpenNation} /> : sub === 'controls' ? <Controls rows={rows} v={view} dispatch={dispatch} ask={setAct} />
    : <Reserves rows={rows} v={view} dispatch={dispatch} />;
  const wide = useWide(); const md = sub === 'reserves' || sub === 'processing' || sub === 'stockpile' || !sub;
  return <div className={`wl-tabroot${wide && !md && sub!=='deals' ? ' wl-cols' : ''}`} data-minerals data-minerals-sub={sub}>{body}<ConfirmSheet act={act} onClose={() => setAct(null)} /></div>;
}
