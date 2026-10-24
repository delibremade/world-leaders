// Forces vertical (E5a, spec Part 8): people and readiness. Manpower | Quality | Training | Equipment | Specialized.
// Reads state through forceView / crewStatus (the month's own rules) and dispatches actions; no game logic here.
import { DeploymentOrders } from '../map/DeploymentOrders.jsx';
import { deploymentOptions } from '../../sim/deployment-view.js';
import { useState } from 'react';
import { Seg } from '../shell/Seg.jsx';
import { DataTable } from '../shell/DataTable.jsx';
import { useWide } from '../shell/useWide.js';
import { Panel, Row, Bar } from '../shell/Panel.jsx';
import { ConfirmSheet } from '../shell/Confirm.jsx';
import { Why } from '../shell/Why.jsx';
import { PLATFORMS, BLACK_PROGRAMS, DEPLOYABLE, SLOTS } from '../../data/platforms.js';
import { REGIONS, POSTURE_LABELS } from '../../data/regions.js';
import { FLEET_PACKAGES, unitMeta } from '../../data/deployment-catalog.js';
import { ownedUnits } from '../../sim/deployment-view.js';
import { unitCrew } from '../../sim/forces.js';
import { BRANCHES, crewOf, FORCE_RULES } from '../../data/forces.js';
import { isrOf, triadLegs } from '../../sim/formulas.js';
import { baseIsr } from '../../sim/reach.js';
import { forceView, fleetView } from '../../sim/forces.js';
import { subsN } from '../../data/sof.js';
import { f0, f1, f2, tone, WhyV } from '../shell/fmt.jsx';
import { CommandCard } from '../shell/CommandCard.jsx';
import { fleetCommands, runCommand } from '../shell/commands.js';

export const FORCES_SUBS = [
  { id: 'deployments', label: 'Deployments' },
  { id: 'manpower', label: 'Manpower' }, { id: 'quality', label: 'Quality' }, { id: 'training', label: 'Training' },
  { id: 'equipment', label: 'Equipment' }, { id: 'specialized', label: 'Special' },
];
const R = FORCE_RULES;
// Headcounts and money, one formatter each (F7 #55).
const hc = (x) => Math.round(x).toLocaleString('en-US');
const pc = (x) => `${Math.round(x * 100)}%`;
const BRANCH_N = Object.fromEntries(BRANCHES);

function Deployments({v,request,dispatch,onJump}){
 const [destination,setDestination]=useState(request?.region||''),[selectedUnit,setSelectedUnit]=useState(request?.unit);
 const units=deploymentOptions(v),free=units.reduce((n,u)=>n+u.free,0);
 const regions=Object.entries(REGIONS).map(([rid,r])=>({rid,name:r.n,units:deploymentOptions(v,rid).filter(u=>u.here)})).filter(r=>r.units.length);
 return <div className="wl-deployment-workspace" data-force-orders>
  <Panel id="orders" title="Deploy your forces" figure={`${free} packages available`}>
   <DeploymentOrders g={v} region={request?.region} initialUnit={request?.unit} chooseRegion onRegion={setDestination} onUnit={setSelectedUnit} dispatch={dispatch} onJump={onJump}/>
   {destination&&<button className="wl-btn" data-deployment-map onClick={()=>onJump({tab:'overview',mode:'military',region:destination,unit:selectedUnit})}>Inspect {REGIONS[destination].n} on map →</button>}
  </Panel>
  <Panel id="assignments" title="Current assignments" figure={`${regions.length} theaters`}>
   {!regions.length&&<p className="wl-note">No forces forward deployed. Your starting forces are available in the order form.</p>}
   {regions.map(r=><div className="wl-deployment-assignment" key={r.rid} data-assignment-region={r.rid}><h3>{r.name}</h3><small>{POSTURE_LABELS[v.forcePosture?.[r.rid]||'deter']}</small>{r.units.map(u=><Row key={u.id} title={u.name} value={`×${u.here}`} trailing={<button className="wl-btn" data-assignment-recall={`${r.rid}:${u.id}`} onClick={()=>dispatch({type:'adjustDeployment',payload:{region:r.rid,unit:u.id,delta:-1}})}>Recall 1</button>}/>)}<button className="wl-btn" onClick={()=>onJump({tab:'forces',sub:'deployments',region:r.rid,unit:request?.unit})}>Manage this theater →</button></div>)}
  </Panel>
 </div>;
}

// F7 (#55): strength as headcounts against the 2024 force and the population bound; recruits as propensity of the eligible cohort.
function strengthPanel(fv, fl, pay) {
  const m = fl.manpower; const a = fv.idx.active; const used = (m.active + m.reserve) / m.cap;
  const terms = [{ label: '2024 propensity', value: m.prop0 }, { label: 'Labor market vs start', value: m.labor / (m.base.labor || 1) }, { label: `Pay ${pay}%`, value: pay / 100 }, { label: 'Stability vs start', value: m.stab / (m.base.stab || 1) }];
  return <Panel id="strength" title="Strength" figure={hc(m.active)} tone={tone(a, 30, 50)}>
    <Row title="Active" sub={`${pc(m.active / m.base.active)} of the 2024 force (${hc(m.base.active)})`} value={hc(m.active)}><Bar pct={a} tone={tone(a, 30, 50)} marker={60} /></Row>
    <Row title="Reserve" sub={`Leavers feed it ${R.reserveIn * 100}% · 2024: ${hc(m.base.reserve)}`} value={hc(m.reserve)}><Bar pct={fv.idx.reserve} marker={36} /></Row>
    <Row title="Recruits" sub={`Next month · eligible intake ${hc(m.intakeMax)}/mo x propensity ${pc(m.prop)}`} value={<WhyV title="Propensity (share of the eligible who enlist)" mult total={m.prop} terms={terms} fmt={(x) => x.toFixed(3)}>+{hc(m.next.recruits)}/mo</WhyV>} />
    <Row title="Attrition" sub={`Next month · leavers move to the reserve · retention ${Math.round(fv.retention)}%`} value={`−${hc(m.next.attrition)}/mo`} tone="alert" />
    <Row title="Population bound" sub={`Active + reserve vs eligible military age (${hc(m.cap)})`} value={pc(used)} tone={used > 0.8 ? 'alert' : undefined}><Bar pct={used * 100} /></Row>
    <div className="wl-note">Sources: {m.status_source}.</div>
  </Panel>;
}

function Manpower({ fv, v, dispatch }) {
  const pay = fv.pay; const fl = fleetView(v);
  const units = Object.values(v.platforms).reduce((a, b) => a + (b || 0), 0) + Object.values(v.platformsImported).reduce((a, b) => a + (b || 0), 0);
  const payroll = Math.round(units * 3 * (pay / 100) + fv.payroll);
  return <>
    {fl?.manpower ? strengthPanel(fv, fl, pay) : <Panel id="strength" title="Strength" figure={`${f0(fv.idx.active)} / 100`} tone={tone(fv.idx.active, 30, 50)}>
      <Row title="Active" sub="60 = a fully manned 2024 force" value={f1(fv.idx.active)}><Bar pct={fv.idx.active} tone={tone(fv.idx.active, 30, 50)} marker={60} /></Row>
      <Row title="Recruits" sub="Unemployment and pay set the intake" value={`+${f0(fv.recruits)}/mo`} />
    </Panel>}
    <Panel id="retention" title="Retention" figure={`${Math.round(fv.retention)}%`} tone={tone(fv.retention, 35, 50)}>
      <Row title="Retention now" sub={`Closes ${R.retLag * 100}% of the gap each month`} value={<WhyV title="Retention target" terms={fv.retTerms} total={fv.retTarget}>→ {Math.round(fv.retTarget)}%</WhyV>} tone={fv.retTarget < fv.retention - 1 ? 'alert' : undefined}><Bar pct={fv.retention} tone={tone(fv.retention, 35, 50)} marker={fv.retTarget} /></Row>
      <div className="wl-note">Pay against civilian wages, stability and the labor market. Payroll ${payroll}M/mo ({units} units + manpower).</div>
    </Panel>
    <Panel id="pay" title="Personnel pay" figure={`${pay}%`} tone={pay < 90 ? 'alert' : pay >= 120 ? 'good' : 'warn'}>
      <input className="wl-slider" type="range" min="0" max="150" step="5" value={pay} aria-label="Personnel pay" onChange={(e) => dispatch({ type: 'setPersonnelPay', payload: { pay: +e.target.value } })} style={{ accentColor: pay < 90 ? '#ff7a45' : pay >= 120 ? '#6ee7a8' : '#4fb8ff' }} />
      <div className="wl-note" data-pay-effect>{pay === 0 ? 'Unpaid: no recruits, retention falls to 0, strength drains.' : pay < 90 ? '⚠ Readiness −15%, morale drain (−0.03 stability/mo).' : pay >= 120 ? '✓ Readiness +10%, veteran loyalty (+0.02 stability/mo).' : 'Standard readiness.'} Payroll ${payroll}M/mo · retention → {Math.round(fv.retTarget)}%.</div>
    </Panel>
  </>;
}

function Quality({ fv, onJump }) {
  const gap = fv.qTarget - fv.quality;
  return <>
    <Panel id="quality" title="Force quality index" figure={Math.round(fv.quality)} tone={tone(fv.quality, 45, 65)}>
      <Row title="Index now → target" sub={`Moves ${f2(gap * R.qualityLag)}/mo: a cohort trains for years`} value={`${Math.round(fv.quality)} → ${Math.round(fv.qTarget)}`} tone={gap < -1 ? 'alert' : gap > 1 ? 'good' : undefined}><Bar pct={fv.quality} tone={tone(fv.quality, 45, 65)} marker={fv.qTarget} /></Row>
      <Row title="Capability multiplier" sub="Applied to strength x readiness x equipment" value={`×${f2(fv.qMult)}`} />
    </Panel>
    <Panel id="drivers" title="Drivers" figure={`${fv.drivers.length} vitals`}>
      {fv.drivers.map((d) => (
        <Row key={d.k} data-driver={d.k} title={d.label} sub={`weight ${d.w}`}
          value={<WhyV title={`${d.label} → quality`} total={d.v * d.w} terms={[{ label: `${d.label} ${Math.round(d.v)}`, value: d.v * d.w }]} note="Quality target = sum of weight x vital. Raise the vital on the Economy tab.">{f1(d.v * d.w)}</WhyV>}
          trailing={<button type="button" className="wl-btn wl-btn-sm" onClick={() => onJump('economy')} aria-label={`Open Economy to raise ${d.label}`} data-jump="economy">Economy ›</button>}>
          <Bar pct={d.v} tone={tone(d.v, 40, 60)} />
        </Row>))}
      <div className="wl-note">Neglect shows up years later: ten years of education cuts lower the index by several points.</div>
    </Panel>
  </>;
}

function Training({ fv, v, ask, dispatch }) {
  const fl = fleetView(v);
  const setLevel = (i) => {
    const l = fv.levels[i];
    if (i === 0 && fv.train !== 0) ask({ title: 'Unfund training', cost: '$0M/mo (saves $' + fv.levels[fv.train].cost + 'M/mo)', kind: 'alert', label: 'Unfund', lines: [`Readiness decays 1 point a month toward ${l.target}.`, 'No new crews enter the pipelines.', 'Units without trained crews cannot be stationed.'], run: () => dispatch({ type: 'setTraining', payload: { level: i } }) });
    else dispatch({ type: 'setTraining', payload: { level: i } });
  };
  return <>
    <Panel id="budget" title="Training budget" figure={`$${fv.training}M/mo`}>
      <div className="wl-grid2" role="group" aria-label="Training level">
        {fv.levels.map((l, i) => <button key={l.id} type="button" className="wl-lvl" aria-pressed={fv.train === i} onClick={() => setLevel(i)} data-train={l.id}>{l.n}<small>${l.cost}M · →{l.target}</small></button>)}
      </div>
      <div className="wl-note">Sustains readiness at the level's target. Joint Exercises posture (map region) adds +{R.exercise.target} for the exercising branch.</div>
    </Panel>
    <Panel id="readiness" title="Readiness by branch" figure={`${f0(fv.branches.reduce((a, b) => a + b.readiness, 0) / fv.branches.length)} avg`}>
      {fv.branches.map((b) => (
        <Row key={b.id} data-branch={b.id} title={`${b.n}${b.exercise ? ' · 🤝 exercising' : ''}`} sub={b.decayMo != null ? (b.decayMo > 0 ? `Decays below 50 in ${b.decayMo}mo` : 'Below 50: units lose effect') : `Capability ×${f2(b.mult)}`}
          value={`${f0(b.readiness)} → ${b.target}`} tone={b.decayMo != null ? 'alert' : tone(b.readiness, 50, 70)}><Bar pct={b.readiness} tone={tone(b.readiness, 50, 70)} marker={b.target} /></Row>))}
      <div className="wl-note">Readiness rises up to {R.riseMo}/mo and decays {R.decayMo}/mo above its funded level.</div>
    </Panel>
    {fl && <Panel id="fleetcrews" title="Fleet crews and readiness" figure={`${hc(fl.lines.reduce((a, l) => a + l.ready, 0))} ready`} data-forces-fleetcrews>
      {fl.branches.map((b) => {
        const ls = fl.lines.filter((l) => l.b === b.id && l.count > 0); const n = ls.reduce((a, l) => a + l.count, 0);
        const crewless = ls.reduce((a, l) => a + l.crewless, 0); const mc = n ? ls.reduce((a, l) => a + l.mc * l.count, 0) / n : 0;
        return <Row key={b.id} data-fleet-branch={b.id} title={`${b.n}: ${hc(b.ready)} of ${hc(n)} ready`} sub={`Crews ${hc(b.pool)} for ${hc(b.need)} needed · MC ${Math.round(mc)}% avg${crewless ? ` · ${hc(crewless)} crewless` : ''} · capability ×${f2(b.equip)}`}
          value={pc(b.fill)} tone={b.fill < 1 ? 'alert' : 'good'}><Bar pct={b.fill * 100} tone={b.fill < 1 ? 'alert' : 'good'} /></Row>;
      })}
      <div className="wl-note">Crews are people: pilots per airframe, crew per hull, maintainers per platform. Platforms beyond the crews sit unready.</div>
    </Panel>}
    <Panel id="pipelines" title="Crew pipelines" figure={`${fv.pipe.length} classes`}>
      {fv.branches.map((b) => {
        const mine = fv.pipe.filter((p) => p.b === b.id).map((p) => p.mo).sort((x, y) => x - y);
        return <Row key={b.id} title={`${b.n} crews`} sub={mine.length ? `${hc(b.pipe)} personnel in ${mine.length} classes, next in ${mine[0]}mo (${R.pipeMo[b.id]}mo pipeline)` : `${R.pipeMo[b.id]}mo pipeline, none in training`} value={`${hc(b.crews)} / ${hc(b.need)}`} tone={b.gap > 0 ? 'alert' : 'good'} />;
      })}
    </Panel>
  </>;
}

function Equipment({ fv, v, ask, dispatch, toast, onJump }) {
  const fl = fleetView(v); const [selLine, setSelLine] = useState(null); const wide = useWide();
  const own = (pid) => (BLACK_PROGRAMS[pid] ? +v.blackPrograms[pid] || 0 : (v.platforms[pid] || 0) + (v.platformsImported[pid] || 0));
  const meta = unitMeta;
  const ids = [...Object.keys(PLATFORMS), ...Object.keys(BLACK_PROGRAMS)].filter((pid) => own(pid) > 0);
  const maint = Object.entries(v.platforms).reduce((s, [pid, ct]) => s + (PLATFORMS[pid]?.maint || 0) * (ct || 0), 0);
  const where = (pid) => Object.entries(v.forceDeployments).filter(([, o]) => (o?.[pid] || 0) > 0).map(([rid, o]) => [rid, o[pid]]);
  const theaters = Object.entries(v.forceDeployments).map(([rid, o]) => [rid, Object.entries(o || {}).filter(([, n]) => n > 0)]).filter(([, us]) => us.length);
  const gen = (pid) => BLACK_PROGRAMS[pid] ? SLOTS.find(([k]) => k === BLACK_PROGRAMS[pid].slot)?.[1] || 'Program' : 'Fielded platform';
  const station = (pid) => {
    const rid = document.getElementById(`oob_${pid}`)?.value;
    if (!rid) { toast('Pick a region'); return; }
    dispatch({ type: 'deployUnit', payload: { region: rid, unit: pid } });
  };
  const crewsPanel = (
    <Panel id="crews" title="Crews vs airframes and hulls" figure={fv.branches.some((b) => b.gap > 0) ? 'gap' : 'covered'} tone={fv.branches.some((b) => b.gap > 0) ? 'alert' : 'good'} data-forces-crews>
      {fv.branches.map((b) => (
        <Row key={b.id} title={b.n} sub={`${hc(b.crews)} personnel / ${hc(b.need)} needed · ${hc(b.deployed)} stationed${b.pipe ? ` · ${b.pipe} training` : ''}`} value={b.gap > 0 ? `gap ${hc(b.gap)}` : 'covered'} tone={b.gap > 0 ? 'alert' : 'good'}>
          <Bar pct={b.need ? (b.crews / b.need) * 100 : 100} tone={b.gap > 0 ? 'alert' : 'good'} />
        </Row>))}
      <div className="wl-note">A unit without free crews cannot be stationed. Raise training or pay to close a gap.</div>
    </Panel>
  );
  const inventory = (
    <>{BRANCHES.map(([bid, bn]) => {
      const mine = ids.filter((pid) => crewOf(pid).b === bid);
      return <Panel key={bid} id={`inv_${bid}`} title={`${bn} inventory`} figure={mine.reduce((a, pid) => a + own(pid), 0)}>
        {mine.length === 0 && <div className="wl-note">Nothing fielded. Build in the Arsenal tab.</div>}
        {mine.map((pid) => {
          const m = meta(pid); const n = own(pid); const w = where(pid); const st = w.reduce((a, [, k]) => a + k, 0); const dep = DEPLOYABLE.includes(pid); const c = unitCrew(v,pid);
          return <Row key={pid} data-unit={pid} title={`${m.i} ${m.n}`} sub={`${gen(pid)} · ${c.n * n} personnel · ${dep ? `${st}/${n} stationed, ${n - st} in reserve` : 'national asset, applies automatically'}`}
            value={PLATFORMS[pid] ? `$${m.maint * (v.platforms[pid] || 0)}M/mo` : `×${n}`}>
            {dep && <div className="wl-row" style={{ flexWrap: 'wrap', marginTop: 4 }}>
              {w.map(([rid, k]) => <span key={rid} className="wl-chip">{REGIONS[rid]?.n} ×{k} {POSTURE_LABELS[v.forcePosture[rid] || 'deter']?.slice(0, 2)} <button type="button" data-recall={pid} className="wl-btn wl-btn-sm wl-btn-alert" onClick={() => dispatch({ type: 'recallUnit', payload: { region: rid, unit: pid } })}>recall</button></span>)}
              {n - st > 0 && <><select id={`oob_${pid}`} className="wl-sel" defaultValue="" aria-label={`Station ${m.n} in`}><option value="" disabled>station in…</option>{Object.entries(REGIONS).map(([rid, rg]) => <option key={rid} value={rid}>{rg.n}</option>)}</select>
                <button type="button" className="wl-btn wl-btn-primary" onClick={() => station(pid)}>+ Station</button></>}
            </div>}
          </Row>;
        })}
      </Panel>;
    })}</>
  );
  const theatersPanel = (
    <Panel id="theaters" title="Theater summary" figure={`${theaters.length} regions`}>
      {theaters.length === 0 && <div className="wl-note">No theater assets stationed.</div>}
      {theaters.map(([rid, us]) => <Row key={rid} title={REGIONS[rid]?.n} sub={us.map(([pid, k]) => `${meta(pid)?.n} ×${k}`).join(' · ')} value={POSTURE_LABELS[v.forcePosture[rid] || 'deter']} />)}
    </Panel>
  );
  const maintPanel = (
    <Panel id="maint" title="Maintenance" figure={`$${maint}M/mo`} tone="warn">
      <Row title="Platform upkeep" sub="Per-unit maintenance, charged monthly" value={<WhyV title="Maintenance / month" fmt={(x) => `$${x.toFixed(0)}M`} terms={Object.entries(v.platforms).filter(([, ct]) => ct).map(([pid, ct]) => ({ label: `${PLATFORMS[pid]?.n} ×${ct}`, value: -(PLATFORMS[pid]?.maint || 0) * ct }))} total={-maint}>${maint}M</WhyV>} />
    </Panel>
  );
  if (wide && fl) {
    const cur = fl.lines.find((l) => l.id === selLine) || fl.lines.find((l) => l.count > 0) || fl.lines[0];
    const cols = [
      { id: 'n', label: 'Type', get: (l) => l.n },
      { id: 'b', label: 'Branch', get: (l) => BRANCH_N[l.b] || l.b },
      { id: 'count', label: 'In service', num: true, get: (l) => l.count, cell: (l) => hc(l.count), tone: (l) => (l.count < l.count2024 ? 'warn' : undefined) },
      { id: 'ready', label: 'Ready', num: true, get: (l) => l.ready, cell: (l) => hc(l.ready) },
      { id: 'mc', label: 'MC', num: true, get: (l) => l.mc, cell: (l) => `${Math.round(l.mc)}%`, tone: (l) => tone(l.mc, 40, 60) },
      { id: 'target', label: 'Target', num: true, get: (l) => l.target, cell: (l) => `${Math.round(l.target)}%` },
      { id: 'crewless', label: 'Crewless', num: true, get: (l) => l.crewless, cell: (l) => (l.crewless ? hc(l.crewless) : '—'), tone: (l) => (l.crewless ? 'alert' : undefined) },
      { id: 'mx', label: 'Maint', num: true, get: (l) => l.mx, cell: (l) => `${l.mx}%` },
    ];
    return <div className="wl-md" data-master-detail="fleet">
      <div>
        <DataTable id="fleet" label="Order of battle" title="Order of battle · by type" columns={cols} rows={fl.lines} rowId={(l) => l.id} selected={cur?.id} onSelect={setSelLine} rowProps={(l) => ({ 'data-line': l.id })} />
        {inventory}{theatersPanel}
      </div>
      <div data-detail="fleet">{fleetSummary(fl, dispatch)}{cur && <Panel key={cur.id} id="line-detail" title="Selected type" figure={cur.n}>{lineDetail(cur, fl, ask, dispatch, v, onJump)}</Panel>}{crewsPanel}{maintPanel}</div>
    </div>;
  }
  return <>
    {fl && fleetSummary(fl, dispatch)}
    {fl && fleetBranches(fl, selLine, setSelLine, ask, dispatch, v, onJump)}
    {crewsPanel}
    {inventory}
    {theatersPanel}
    {maintPanel}
  </>;
}

// F7 (#55): the order of battle. Render helpers, not components (CLAUDE.md rule 4); the selected type lives in Equipment's state.
const RETIRE_STEP = { airframe: 12, hull: 1, formation: 1, launcher: 50 };
const CLS_N = { airframe: 'airframes', hull: 'hulls', formation: 'formations', launcher: 'launchers' };
function fleetSummary(fl, dispatch) {
  const n = fl.lines.reduce((a, l) => a + l.count, 0); const ready = fl.lines.reduce((a, l) => a + l.ready, 0);
  const mx = Math.round(fl.lines.reduce((a, l) => a + l.mx, 0) / Math.max(1, fl.lines.length));
  return <Panel id="fleet" title="Order of battle" figure={`${hc(ready)} / ${hc(n)} ready`} data-forces-fleet>
    <Row title="Maintenance, all types" sub={`$${Math.round(fl.maintenance)}M/mo · 100% = 2024 funding`} value={`${mx}%`}>
      <input className="wl-slider" type="range" min="0" max="150" step="5" value={mx} aria-label="Maintenance budget, all types" onChange={(e) => dispatch({ type: 'setMaintenance', payload: { line: 'all', pct: +e.target.value } })} />
    </Row>
    <Row title="Depot throughput" sub={`$${Math.round(fl.depotCost)}M/mo · upgrades take ${fl.modMo} months · faster MC recovery`} value={`${fl.depot}%`}>
      <input className="wl-slider" type="range" min="20" max="200" step="10" value={fl.depot} aria-label="Depot throughput" onChange={(e) => dispatch({ type: 'setDepot', payload: { pct: +e.target.value } })} />
    </Row>
    <div className="wl-note">Mission-capable (MC) rates move toward their target about {Math.round(fl.rules.converge * 100)}% of the gap a month. A 10% maintenance cut shows within a year.</div>
  </Panel>;
}
function lineRow(l, sel, onSel) {
  return <Row key={l.id} data-line={l.id} title={l.n} role="button" tabIndex={0} aria-expanded={sel} onClick={onSel} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSel(); } }} style={{ cursor: 'pointer' }}
    sub={`${hc(l.ready)} ready · MC ${Math.round(l.mc)}% → ${Math.round(l.target)}%${l.crewless ? ` · ${hc(l.crewless)} crewless` : ''}${l.blk ? ` · block ${l.blk}` : ''}${l.mod ? ` · depot ${l.mod}mo` : ''}${l.mx !== 100 ? ` · maint ${l.mx}%` : ''}`}
    value={hc(l.count)} tone={l.crewless ? 'alert' : l.count < l.count2024 ? 'warn' : undefined}><Bar pct={l.mc} tone={tone(l.mc, 40, 60)} marker={l.target} /></Row>;
}
function lineDetail(l, fl, ask, dispatch, v, onJump) {
  const packageId=`fleet:${fl.nid}:${l.id}`,pkg=FLEET_PACKAGES[packageId];
  const step = Math.min(l.count, RETIRE_STEP[l.cls] || 1);
  const retire = (n) => ask({ title: `Retire ${hc(n)} ${l.n}`, cost: `saves about $${Math.round(l.cost * n / Math.max(1, l.count))}M/mo maintenance`, kind: 'alert', label: 'Retire',
    lines: [`${hc(l.count - n)} left in service. Retired ${CLS_N[l.cls]} do not come back; procurement adds new ones to this line.`, 'Their crews return to the pool for the rest of the fleet.'], run: () => dispatch({ type: 'retire', payload: { line: l.id, n } }) });
  const modernize = () => ask({ title: `${l.n}: block ${l.blk + 1} upgrade`, cost: `$${hc(l.modCost)}M once`, kind: 'warn', label: 'Start upgrade',
    lines: [`${fl.modMo} months in the depot at ${fl.depot}% throughput; ${Math.round(fl.rules.modShare * 100)}% of the fleet is unavailable meanwhile.`, `Then +${Math.round(fl.rules.blkGain * 100)}% effectiveness and +${Math.round(fl.rules.mcBlk * 100)}% MC target.`], run: () => dispatch({ type: 'modernize', payload: { line: l.id } }) });
  return <div className="wl-r wl-r-stack" data-line-detail={l.id} key={`${l.id}-detail`}>
    <CommandCard id="fleet" placement="column" title={l.n} sub={`${hc(l.count)} ${CLS_N[l.cls]} · keys M R B K J`} color="#60a5fa" actions={fleetCommands(l, fl, step)} onRun={(a) => runCommand(a, { dispatch, ask })} />
    <div className="wl-r-main">
      <small>{hc(l.count)} {CLS_N[l.cls]} (2024: {hc(l.count2024)}{l.lost ? `, ${l.lost} lost` : ''}) · crew ratio {l.crewRatio} x {hc(l.crewSize)}{l.maintainers ? ` + ${l.maintainers} maintainers` : ''} · {hc(l.heads)} people · quality ×{f2(l.quality)}</small>
      <small>Based: {Object.entries(l.at).map(([r, k]) => `${REGIONS[r]?.n || r} ${hc(k)}`).join(' · ') || 'none'}{l.buys.length ? ` · procurement: ${l.buys.join(', ')}` : ''}</small>
      <small>Source: {l.status_source}</small>
      {pkg&&v&&ownedUnits(v,packageId)>0&&<button type="button" className="wl-btn wl-btn-primary" data-fleet-deploy={l.id} onClick={()=>onJump({tab:"forces",sub:"deployments",unit:packageId})}>Deploy / recall {l.n} →</button>}
      <Row title="Maintenance" sub={`$${Math.round(l.cost)}M/mo · MC target ${Math.round(l.target)}%`} value={`${l.mx}%`}>
        <input className="wl-slider" type="range" min="0" max="150" step="5" value={l.mx} aria-label={`Maintenance ${l.n}`} onChange={(e) => dispatch({ type: 'setMaintenance', payload: { line: l.id, pct: +e.target.value } })} />
      </Row>
      <div className="wl-grid2">
        <button type="button" className="wl-lvl" disabled={!!l.modWhy} data-modernize={l.id} onClick={modernize}>Modernize<small>{l.modWhy || `$${hc(l.modCost)}M · ${fl.modMo}mo · block ${l.blk + 1}`}</small></button>
        <button type="button" className="wl-lvl" disabled={!l.count} data-retire={l.id} onClick={() => retire(step)}>Retire {hc(step)}<small>{l.count ? `${hc(l.count - step)} left` : 'none in service'}</small></button>
      </div>
      {l.count > step && <button type="button" className="wl-btn wl-btn-alert" data-retire-all={l.id} onClick={() => retire(l.count)}>Retire all {hc(l.count)}</button>}
    </div>
  </div>;
}
function fleetBranches(fl, selId, setSel, ask, dispatch, v, onJump) {
  return BRANCHES.map(([bid, bn]) => {
    const ls = fl.lines.filter((l) => l.b === bid); const b = fl.branches.find((x) => x.id === bid);
    return <Panel key={bid} id={`fleet_${bid}`} title={`${bn} order of battle`} figure={`${hc(b.ready)} / ${hc(b.count)}`} tone={b.fill < 1 ? 'alert' : undefined} data-fleet-panel={bid}>
      {ls.map((l) => [lineRow(l, selId === l.id, () => setSel(selId === l.id ? null : l.id)), selId === l.id ? lineDetail(l, fl, ask, dispatch, v, onJump) : null])}
      <div className="wl-note">Tap a type to set its maintenance, modernize or retire it. Bar: MC now, marker: target.</div>
    </Panel>;
  });
}

// F8 (#56): named units with operator counts. Tap a unit to aim the next class at it; committed sub-units list their op and months.
function sofRow(u, sel, onSel) {
  return <Row key={u.id} data-sof-unit={u.id} title={u.n} role="button" tabIndex={0} aria-expanded={sel} onClick={onSel} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSel(); } }} style={{ cursor: 'pointer' }}
    sub={`${u.role} · ${u.free}/${subsN(u, u.subs)} free${u.pipe ? ` · ${u.pipe} in training` : ''}`}
    value={`${hc(u.ops)} operators`} tone={u.free < u.subs ? 'warn' : u.ops < u.ops0 * 0.9 ? 'alert' : undefined}><Bar pct={u.free / u.subs * 100} tone={tone(u.free / u.subs * 100, 34, 67)} marker={Math.min(100, u.ops / u.cap * 100)} /></Row>;
}
function sofOut(u) {
  return u.out.map((o, i) => <Row key={`${u.id}${i}`} data-sof-out={u.id} title={o.label} sub={`${u.n}: 1 ${u.sub} · ${o.mo ? `deployed ${o.mo} mo, then ${o.rec} mo recovery` : `recovering ${o.rec} mo`}`} value={`${o.left} mo`} tone="warn" />);
}
function Specialized({ fv, v, ask, dispatch, onJump }) {
  const [sel, setSel] = useState(null);
  const us = fv.sofUnits; const pick = (t) => us.find((u) => u.id === sel && u.tier === t); const dflt = (t) => us.find((u) => u.id === fv.classUnit[`t${t}`]);
  const t1u = pick(1); const t2u = pick(2); const r = fv.sofRules;
  const why1 = t1u ? t1u.why : fv.classWhy.t1; const why2 = t2u ? t2u.why : fv.classWhy.t2;
  // F9c (#57): the ISR every consumer reads, radar and forward sites included.
  const isr = isrOf(v); const sites = baseIsr(v.bases, v.country?.id);
  const part = [['Reconnaissance constellation ×2', (v.platforms.satellite_net || 0) * 2], ['RQ-170 wings ×2', (v.platforms.rq170 || 0) * 2], ['RQ-180 wings ×4', (v.platforms.rq180 || 0) * 4], ['Space R&D level', v.defLevels.space || 0], ['ISR fusion', v.intelInfra?.isr_fusion ? 4 : 0]];
  const terms = [...part.map(([label, value]) => ({ label, value })), { label: 'Special access programs', value: isr - sites - part.reduce((a, [, x]) => a + x, 0) }, { label: 'Radar and forward sites', value: sites }];
  const nuke = [['ssbn_fleet', 'SSBN fleet'], ['strategic_bombers', 'Strategic bombers'], ['icbm_force', 'ICBM silos']];
  const legs = triadLegs(v.platforms, v.blackPrograms);
  const cyber = v.platforms.cyber_command || 0;
  const c1 = t1u || dflt(1); const c2 = t2u || dflt(2); const t1n = c1?.n || 'Tier 1'; const cls1 = c1?.cls || 0;
  const selectT1 = () => ask({ title: `${t1n} selection`, cost: `$${Math.round(cls1 * r.costPer.t1)}M/mo for ${fv.selectionMo}mo`, kind: 'warn', label: 'Start selection',
    lines: [`${cls1} candidates: ${Math.round(cls1 * r.t2Share)} leave Tier 2 now, the rest come from conventional forces.`, `Free Tier 1 operators add ${r.t1Points} per ${hc(r.t1Eq)} x quality x readiness to Tier-1 operation overmatch.`], run: () => dispatch({ type: 'selectTier1', payload: { unit: t1u?.id } }) });
  const tier = (t) => us.filter((u) => u.tier === t).flatMap((u) => [sofRow(u, sel === u.id, () => setSel(sel === u.id ? null : u.id)), ...sofOut(u)]);
  return <>
    <Panel id="sof" title="Special operations" figure={`T1 ${hc(fv.sofOps.t1)} · T2 ${hc(fv.sofOps.t2)}`} data-forces-sof>
      <Row title="Tier 1" sub={`${fv.sofFree.t1} sub-units free · adds +${Math.round(fv.tier1 * r.t1Points)} Tier-1 overmatch (Intel)`} value={`${hc(fv.sofOps.t1)} operators`} />
      {tier(1)}
      <Row title="Tier 2" sub={`${fv.sofFree.t2} sub-units free · the Tier 1 selection pool`} value={`${hc(fv.sofOps.t2)} operators`} />
      {tier(2)}
      {fv.sof.pipes.map((p, i) => { const u = us.find((x) => x.id === p.u); return <Row key={`p${i}`} title={`${u?.n || p.u} ${p.t === 2 ? 'qualification' : 'selection'}`} sub={`${p.n} trainees · $${Math.round(p.n * (p.t === 1 ? r.costPer.t1 : r.costPer.t2))}M/mo to Training`} value={`${p.mo}mo`} tone="good"><Bar pct={100 - (p.mo / (p.t === 2 ? r.t2Mo : r.t1MoMax)) * 100} tone="good" /></Row>; })}
      <div className="wl-grid2" style={{ marginTop: 8 }}>
        <button type="button" className="wl-lvl" disabled={!!why2} onClick={() => dispatch({ type: 'trainSof', payload: { unit: t2u?.id } })}>Train Tier 2{t2u ? ` → ${t2u.n}` : ''}<small>{why2 || `${r.t2Mo}mo · $${Math.round((c2?.cls || 0) * r.costPer.t2)}M/mo`}</small></button>
        <button type="button" className="wl-lvl" disabled={!!why1} onClick={selectT1}>Tier 1 selection{t1u ? ` → ${t1u.n}` : ''}<small>{why1 || `${fv.selectionMo}mo · $${Math.round(cls1 * r.costPer.t1)}M/mo`}</small></button>
      </div>
      <button className="wl-btn wl-btn-primary" data-sof-plan onClick={()=>onJump({tab:'sitroom'})}>Plan covert operation →</button>
      <div className="wl-note">Tap a unit to aim the next class at it. Raids and special activities commit sub-units for the op plus recovery; turnover is replaced by the standing pipeline up to 2024 strength. Sources: {fv.units.status_source}.</div>
    </Panel>
    <Panel id="isr" title="ISR" figure={isr} tone={tone(isr, 4, 10)}>
      <Row title="ISR score" sub="Kinetic damage and Tier-1 intel read it" value={<WhyV title="ISR score" terms={terms} total={isr}>{isr}</WhyV>} />
    </Panel>
    <Panel id="cyber" title="Cyber" figure={cyber ? `${cyber} command` : 'none'} tone={cyber ? 'good' : 'warn'}>
      <Row title="Cyber Command" sub={`Cyber R&D level ${v.defLevels.cyber || 0} · crews ${hc(unitCrew(v,'cyber_command').n)} personnel each, land branch`} value={`×${cyber}`} />
    </Panel>
    <Panel id="nuclear" title="Nuclear crews" figure={`${legs}/3 legs`} tone={legs === 3 ? 'good' : legs ? 'warn' : undefined}>
      {nuke.map(([pid, n]) => { const ct = (v.platforms[pid] || 0) + (v.platformsImported[pid] || 0); const c = unitCrew(v,pid); const b = fv.branches.find((x) => x.id === c.b); return <Row key={pid} title={n} sub={`${hc(c.n * ct)} ${BRANCH_N[c.b]} personnel${b.gap > 0 ? ` · ${BRANCH_N[c.b]} gap ${b.gap}` : ''}`} value={`×${ct}`} tone={ct ? 'good' : undefined} />; })}
      {(v.blackPrograms.b21 || v.blackPrograms.h20 || v.blackPrograms.pakda || v.blackPrograms.x_bomber) ? <Row title="Stealth bomber (deterrent)" sub="Counts as the air leg" value="✓" tone="good" /> : null}
      <button className="wl-btn" onClick={()=>onJump({tab:'arsenal',sub:'deterrence'})}>Open deterrence & nuclear posture →</button>
    </Panel>
  </>;
}

export function ForcesTab({ sub, onSub, view, dispatch, toast, onJump, deploymentRequest }) {
  const wide = useWide();
  const [act, setAct] = useState(null);
  const fv = forceView(view);
  const gaps = fv.branches.filter((b) => b.gap > 0).length;
  const items = FORCES_SUBS.map((s) => (s.id === 'equipment' && gaps ? { ...s, badge: gaps, sev: 'alert' } : s));
  const body = sub === 'deployments' ? <Deployments key={deploymentRequest?.at||'orders'} v={view} request={deploymentRequest} dispatch={dispatch} onJump={onJump}/> : sub === 'quality' ? <Quality fv={fv} onJump={onJump} /> : sub === 'training' ? <Training fv={fv} v={view} ask={setAct} dispatch={dispatch} />
    : sub === 'equipment' ? <Equipment fv={fv} v={view} ask={setAct} dispatch={dispatch} toast={toast} onJump={onJump} /> : sub === 'specialized' ? <Specialized fv={fv} v={view} ask={setAct} dispatch={dispatch} onJump={onJump} />
    : <Manpower fv={fv} v={view} dispatch={dispatch} />;
  return (
    <div className="wl-pane-wrap" data-sentinel="forces">
      <Seg id="forces" label="Forces" cols={3} items={items} active={sub} onSelect={onSub} />
      <div className={`wl-tabroot${wide && !['equipment','deployments'].includes(sub) ? ' wl-cols' : ''}`} data-forces data-forces-sub={sub}>{body}</div>
      <ConfirmSheet act={act} onClose={() => setAct(null)} />
    </div>
  );
}
