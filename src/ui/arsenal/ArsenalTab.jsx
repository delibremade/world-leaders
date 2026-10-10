// Arsenal vertical (E5b, spec Part 8): the industrial side of defense. Programs | Procurement | Supply | Partnerships |
// Exports | Deterrence. State is read through programView, programSupply, accessView (the verbs' own rules); no game logic here.
import { Seg } from '../shell/Seg.jsx';
import { Panel, Row, Bar } from '../shell/Panel.jsx';
import { NukeRegister } from '../shell/NukeRegister.jsx';
import { f0, tone, WhyV } from '../shell/fmt.jsx';
import { Procurement } from './Procurement.jsx';
import { Partnerships, Exports } from './Trade.jsx';
import { BLACK_PROGRAMS, PLATFORMS, SLOTS, STAGES, DV } from '../../data/platforms.js';
import { MINERALS } from '../../data/minerals.js';
import { NATIONS } from '../../data/nations.js';
import { meetsReq, sapRate, devCost, triadLegs, strategicWeight } from '../../sim/formulas.js';
import { programView } from '../../sim/selectors.js';
import { programSupply, inputsOf, mineralView } from '../../sim/minerals.js';

export const ARSENAL_SUBS = [
  { id: 'programs', label: 'Programs' }, { id: 'procurement', label: 'Procurement' }, { id: 'supply', label: 'Supply' },
  { id: 'partnerships', label: 'Partnerships' }, { id: 'exports', label: 'Exports' }, { id: 'deterrence', label: 'Deterrence' },
];
const stageName = (k) => STAGES.find(([x]) => x === k)?.[1];
const mn = (m) => MINERALS[m]?.n || m;

function Programs({ v, dispatch }) {
  const rows = programView(v); const { sapOffice, blackResearch, arsenal, defLevels, blackPrograms, stats } = v;
  const by = Object.fromEntries(STAGES.map(([k]) => [k, rows.filter((r) => r.stage === k).length]));
  const short = (stats?.treasury || 0) < 1500;
  return <>
    <Panel id="pipeline" title="Pipeline · R&D → prototype → LRIP → full rate" figure={`${rows.length} programs`}>
      <div className="wl-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {STAGES.map(([k, n]) => <span key={k} className={`wl-chip${by[k] ? ' wl-chip-command' : ''}`} data-stage-count={k}>{n} {by[k]}</span>)}
      </div>
      {!sapOffice
        ? <Row stack title="Special Access Program office" sub="Needed to fund next-generation programs. Fielded programs become espionage targets."
          trailing={<button type="button" className="wl-btn wl-btn-primary" aria-disabled={short} onClick={() => dispatch({ type: 'establishSapOffice' })}>🔒 Establish SAP Office — $1,500M{short ? ' (short)' : ''}</button>} />
        : <Row title="SAP office" sub={blackResearch ? `Running ${BLACK_PROGRAMS[blackResearch.id]?.n || blackResearch.id}: ${Math.max(0, blackResearch.mo - blackResearch.prog)}mo left` : 'Idle: ready for the next program'} value={blackResearch ? 'busy' : 'idle'} tone={blackResearch ? 'warn' : 'good'}>
          {blackResearch && <Bar pct={(blackResearch.prog / blackResearch.mo) * 100} />}</Row>}
      {Object.keys(blackPrograms).length > 0 && <Row title="◆ Operational" sub={Object.keys(blackPrograms).map((b) => `${BLACK_PROGRAMS[b].i} ${BLACK_PROGRAMS[b].n}`).join(' · ')} />}
    </Panel>
    <div data-catalog={v.country?.id} className="wl-stack">
      {rows.map((r) => {
        const bid = r.id, bp = r.bp, n = r.n; const slotN = SLOTS.find(([k]) => k === r.slot)?.[1]; const live = r.action === 'produce'; const waiting = r.action === 'wait';
        const d = arsenal.dev?.[bid]; const rs = blackResearch?.id === bid ? blackResearch : null; const prog = d ? d.prog / d.mo : rs ? rs.prog / rs.mo : 0;
        const sp = programSupply(v, bid); const q = sp.queued;
        const burnRow = d || rs ? devCost(bp, r.start) : null;
        return <Panel key={bid} id={`prog_${bid}`} data-program={bid} title={`${bp.i} ${bp.n}${n > 0 ? ' ✓' : ''}`} figure={stageName(r.stage)} tone={r.stage === 'full' ? 'good' : r.stage === 'lrip' ? 'good' : undefined}>
          <Row title={slotN} sub={`${bp.d}${r.buy ? ' · bought from the USA' : ''}`} value={n > 0 ? 'FIELDED' : undefined} tone="good" data-source={r.status_source} />
          {Object.keys(bp.req).length > 0 && <small className="wl-note" style={{ display: 'block' }}>Req: {Object.entries(bp.req).map(([vv, rq]) => <span key={vv} data-tone={(defLevels[vv] || 0) >= rq ? 'good' : 'alert'} style={{ marginRight: 6 }}>{DV[vv]?.n} L{rq}</span>)}</small>}
          {(waiting || burnRow) && <Row title="In development" sub={burnRow ? `Burn about $${Math.round(burnRow.cost / burnRow.mo)}M/mo of $${(burnRow.cost / 1000).toFixed(1)}B` : undefined} value={`⏳ ${r.monthsLeft}mo to ${r.start === 'proto' ? 'LRIP' : 'operational'}`} tone="warn"><Bar pct={prog * 100} /></Row>}
          {live && <>
            <Row title="Fielded" sub={`+${bp.mil} military${bp.isr ? ` · +${bp.isr} ISR` : bp.bonus === 'multiplier' ? ' · air ×1.15' : bp.bonus === 'deterrent' ? ' · nuclear deterrent' : ''}${n > 0 ? ` · force mil +${Math.round(bp.mil * Math.sqrt(n))} · next tranche at ${Math.round(sapRate(r.stage === 'full' ? Math.max(n, 6) : n) * 100)}% of program` : ''}`} value={`${n} unit${n === 1 ? '' : 's'}`} />
            <Row data-supply title="Supply" tone={q.length ? 'alert' : sp.coverage < 1 ? 'warn' : undefined}
              sub={`per tranche ${Object.entries(inputsOf(bid)).map(([m, u]) => `${MINERALS[m].i}${u}`).join(' ')}`}
              value={q.length ? `⏳ ${q.length} tranche${q.length > 1 ? 's' : ''} slowed: ${mn(q[0].binding)} short · ~${q[0].months === Infinity ? '∞' : q[0].months}mo` : `Supply ${Math.round(sp.coverage * 100)}%${sp.binding ? ` · short of ${mn(sp.binding)}` : ''}`} />
            <button type="button" className="wl-btn wl-btn-primary" style={r.block ? { opacity: 0.55 } : undefined} aria-disabled={!!r.block} onClick={() => dispatch({ type: 'sapTranche', payload: { program: bid } })}>
              {n > 0 ? `🏭 Tranche #${n + 1} — $${r.cost}M${/industrial base/.test(r.block || '') ? ' · needs Materials L4' : ''}` : `🏭 Produce ${bp.n} — $${r.cost}M`}</button>
            {r.block && <div className="wl-note" data-tone="alert">{r.block}</div>}
          </>}
          {!live && !waiting && (!sapOffice ? <div className="wl-note">🔒 Needs the SAP office · ${(r.cost / 1000).toFixed(1)}B · {r.months}mo</div>
            : <><button type="button" className="wl-btn wl-btn-primary" style={r.block ? { opacity: 0.55 } : undefined} aria-disabled={!!r.block} onClick={() => dispatch({ type: 'sapInitiate', payload: { program: bid } })}>
              {r.action === 'initiate' && blackResearch ? 'SAP busy' : `${r.action === 'fund' ? 'Fund prototype' : 'Initiate'} $${(r.cost / 1000).toFixed(1)}B · ${r.months}mo`}</button>
              {r.block && <div className="wl-note" data-tone="alert">{r.block}</div>}</>)}
        </Panel>;
      })}
    </div>
  </>;
}

function Supply({ v, onJump }) {
  const prog = programView(v); const rows = mineralView(v);
  const units = [...prog.map((r) => ({ id: r.id, name: `${r.bp.i} ${r.bp.n}`, kind: 'program', on: r.n > 0 || r.action === 'produce' })), ...Object.entries(PLATFORMS).map(([pid, p]) => ({ id: pid, name: `${p.i} ${p.n}`, kind: 'platform', on: (v.platforms[pid] || 0) > 0 }))].filter((u) => Object.keys(inputsOf(u.id)).length);
  const blocked = rows.filter((m) => m.controlledBy.length);
  return <>
    <Panel id="supply-sum" title="Mineral supply" figure={blocked.length ? `${blocked.length} controlled` : 'open'} tone={blocked.length ? 'alert' : 'good'}>
      {blocked.length ? blocked.map((m) => <Row key={m.id} title={`${m.i} ${m.n}`} sub={`${m.controlledBy.join(', ')} control exports to you`} tone="alert" value="⛔" />) : <div className="wl-note">No supplier is controlling exports to you.</div>}
      <button type="button" className="wl-btn wl-btn-primary" style={{ marginTop: 8 }} onClick={() => onJump('resources')} data-jump="resources">Open Resources: processing, stockpile, deals ›</button>
    </Panel>
    {['program', 'platform'].map((kind) => <Panel key={kind} id={`supply_${kind}`} title={kind === 'program' ? 'Programs: inputs and coverage' : 'Platforms: inputs and coverage'} figure={units.filter((u) => u.kind === kind).length}>
      {units.filter((u) => u.kind === kind).map((u) => {
        const sp = programSupply(v, u.id); const pct = Math.round(sp.coverage * 100); const q = sp.queued;
        return <Row key={u.id} data-supply-row={u.id} title={u.name} sub={`${Object.entries(inputsOf(u.id)).map(([m, n]) => `${MINERALS[m].i}${n}`).join(' ')} per ${kind === 'program' ? 'tranche' : 'unit'}${sp.binding ? ` · binding: ${mn(sp.binding)}` : ''}${q.length ? ` · ⏳ ${q.length} queued ~${q[0].months === Infinity ? '∞' : q[0].months}mo` : ''}`}
          value={<WhyV title={`${u.name} coverage`} fmt={(x) => `${x.toFixed(0)}%`} terms={sp.rows.map((r) => ({ label: `${mn(r.m)} (need ${r.need})`, value: Math.round(r.cov * 100) }))} total={pct} note="Coverage is the scarcest input: (stock + a month's inflow) / need.">{pct}%</WhyV>} tone={tone(pct, 50, 100)}>
          <Bar pct={pct} tone={tone(pct, 50, 100)} />
        </Row>;
      })}
    </Panel>)}
  </>;
}

function Deterrence({ v }) {
  const { platforms, blackPrograms, stats, globalDef, country, nukeLog } = v;
  const legs = triadLegs(platforms, blackPrograms); const mil = stats?.military || 0;
  const stealth = ['b21', 'h20', 'pakda', 'x_bomber'].some((b) => blackPrograms[b]);
  const ctl = [['ssbn_fleet', 'SSBN fleet', 'Naval 5 + Missiles 4'], ['strategic_bombers', 'Strategic bomber wing', 'Aircraft 4 + Munitions 3'], ['icbm_force', 'ICBM silo force', 'Missiles 5 + Munitions 4']];
  const foes = Object.keys(globalDef).filter((id) => id !== country?.id && NATIONS[id]);
  return <>
    <Panel id="triad" title="Nuclear triad" figure={`${legs}/4 legs`} tone={legs >= 3 ? 'good' : legs ? 'warn' : undefined}>
      {ctl.map(([pid, n, req]) => <Row key={pid} title={n} sub={(platforms[pid] || 0) > 0 ? 'Fielded' : `Needs ${req}`} value={(platforms[pid] || 0) > 0 ? '✓' : '—'} tone={(platforms[pid] || 0) > 0 ? 'good' : undefined} />)}
      <Row title="Stealth bomber (deterrent program)" sub="Counts as the air leg" value={stealth ? '✓' : '—'} tone={stealth ? 'good' : undefined} />
      <div className="wl-note">{legs >= 3 ? 'Supreme deterrence: foreign pressure −75%, +0.05 stability/mo.' : legs === 2 ? 'Strong deterrent: foreign pressure −50%.' : legs === 1 ? 'Minimal deterrent: foreign pressure −30%.' : 'No deterrent.'}</div>
    </Panel>
    <Panel id="power" title="Deployed military power" figure={`${Math.round(mil)}/100`} tone={tone(mil, 40, 70)}>
      <Row title="Conventional deterrence" sub="Military 70+ and 85+" value={mil >= 85 ? '−50%' : mil >= 70 ? '−25%' : 'none'} tone={mil >= 70 ? 'good' : undefined}><Bar pct={mil} tone={tone(mil, 40, 70)} marker={70} /></Row>
      <div className="wl-note">−25% foreign pressure and sphere loss at Military 70, −50% at 85.</div>
    </Panel>
    <Panel id="mad" title="MAD parity · your triad vs their strategic weight" figure={`${foes.filter((id) => strategicWeight(globalDef[id] || {}) >= legs && legs > 0).length} parity`}>
      {foes.map((id) => { const w = strategicWeight(globalDef[id] || {}); const par = w >= legs && legs > 0; return <Row key={id} data-mad={id} title={`${NATIONS[id].flag || ''} ${NATIONS[id].n}`} sub={`Strategic weight ${w}/3 vs your triad ${legs}/4`} value={par ? 'PARITY = MAD' : w < legs ? 'you lead' : 'no triad'} tone={par ? 'alert' : legs > w ? 'good' : undefined} />; })}
      <div className="wl-note">Parity is mutual destruction: a nuclear exchange ends most runs badly for everyone. Final options live in the Situation Room.</div>
    </Panel>
    <Panel id="register" title="Nuclear register · who fired, at whom, when" figure={nukeLog.length}>
      <NukeRegister log={nukeLog} me={country?.id} />
    </Panel>
  </>;
}

export function ArsenalTab({ sub, onSub, view, dispatch, toast, onJump, exportVert, onExportVert }) {
  const body = sub === 'procurement' ? <Procurement v={view} dispatch={dispatch} /> : sub === 'supply' ? <Supply v={view} onJump={onJump} />
    : sub === 'partnerships' ? <Partnerships v={view} dispatch={dispatch} /> : sub === 'exports' ? <Exports v={view} dispatch={dispatch} vert={exportVert} onVert={onExportVert} />
    : sub === 'deterrence' ? <Deterrence v={view} /> : <Programs v={view} dispatch={dispatch} />;
  return (
    <div className="wl-pane-wrap" data-sentinel="arsenal">
      <Seg id="arsenal" label="Arsenal" items={ARSENAL_SUBS} active={sub} onSelect={onSub} cols={3} />
      <div className="wl-tabroot" data-arsenal data-arsenal-sub={sub}>{body}</div>
    </div>
  );
}
