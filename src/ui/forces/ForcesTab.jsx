// Forces vertical (E5a, spec Part 8): people and readiness. Manpower | Quality | Training | Equipment | Specialized.
// Reads state through forceView / crewStatus (the month's own rules) and dispatches actions; no game logic here.
import { useState } from 'react';
import { Seg } from '../shell/Seg.jsx';
import { Panel, Row, Bar } from '../shell/Panel.jsx';
import { ConfirmSheet } from '../shell/Confirm.jsx';
import { Why } from '../shell/Why.jsx';
import { PLATFORMS, BLACK_PROGRAMS, DEPLOYABLE, SLOTS } from '../../data/platforms.js';
import { REGIONS, POSTURE_LABELS } from '../../data/regions.js';
import { BRANCHES, crewOf, FORCE_RULES } from '../../data/forces.js';
import { isrScore, triadLegs } from '../../sim/formulas.js';
import { forceView } from '../../sim/forces.js';

export const FORCES_SUBS = [
  { id: 'manpower', label: 'Manpower' }, { id: 'quality', label: 'Quality' }, { id: 'training', label: 'Training' },
  { id: 'equipment', label: 'Equipment' }, { id: 'specialized', label: 'Special' },
];
const R = FORCE_RULES;
const f0 = (x) => x.toFixed(0), f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2);
const tone = (v, lo, hi) => (v < lo ? 'alert' : v < hi ? 'warn' : 'good');
const BRANCH_N = Object.fromEntries(BRANCHES);
const WhyV = ({ title, terms, total, children, ...rest }) => <Why title={title} terms={terms} total={total} className="wl-wy" fmt={(v) => v.toFixed(1)} {...rest}>{children}</Why>;

function Manpower({ fv, v, dispatch }) {
  const pay = fv.pay;
  const units = Object.values(v.platforms).reduce((a, b) => a + (b || 0), 0) + Object.values(v.platformsImported).reduce((a, b) => a + (b || 0), 0);
  const payroll = Math.round(units * 3 * (pay / 100) + fv.payroll);
  return <>
    <Panel id="strength" title="Strength" figure={`${f0(fv.active)} / 100`} tone={tone(fv.active, 30, 50)}>
      <Row title="Active" sub="60 = a fully manned 2024 force" value={f1(fv.active)}><Bar pct={fv.active} tone={tone(fv.active, 30, 50)} marker={60} /></Row>
      <Row title="Reserve" sub={`Attrition feeds it ${R.reserveIn * 100}%`} value={f1(fv.reserve)}><Bar pct={fv.reserve} /></Row>
      <Row title="Recruits" sub="Unemployment and pay set the intake" value={<WhyV title="Recruits / month" mult total={R.recruit * fv.labor * pay / 100}
        terms={[{ label: 'Base intake', value: R.recruit }, { label: 'Labor market (unemployment)', value: fv.labor }, { label: `Pay ${pay}%`, value: pay / 100 }]}>+{f2(fv.recruits)}/mo</WhyV>} />
      <Row title="Attrition" sub="Leavers move to the reserve" value={`−${f2(fv.attrition)}/mo`} tone="alert" />
    </Panel>
    <Panel id="retention" title="Retention" figure={`${Math.round(fv.retention)}%`} tone={tone(fv.retention, 35, 50)}>
      <Row title="Retention now" sub={`Closes ${R.retLag * 100}% of the gap each month`} value={<WhyV title="Retention target" terms={fv.retTerms} total={fv.retTarget}>→ {Math.round(fv.retTarget)}%</WhyV>} tone={fv.retTarget < fv.retention - 1 ? 'alert' : undefined}><Bar pct={fv.retention} tone={tone(fv.retention, 35, 50)} marker={fv.retTarget} /></Row>
      <div className="wl-note">Pay against civilian wages, stability and the labor market. Payroll ${payroll}M/mo ({units} units + manpower).</div>
    </Panel>
    <Panel id="pay" title="Personnel pay" figure={`${pay}%`} tone={pay < 90 ? 'alert' : pay >= 120 ? 'good' : 'warn'}>
      <input className="wl-slider" type="range" min="0" max="150" step="5" value={pay} aria-label="Personnel pay" onChange={(e) => dispatch({ type: 'setPersonnelPay', payload: { pay: +e.target.value } })} style={{ accentColor: pay < 90 ? '#ef4444' : pay >= 120 ? '#4ade80' : '#3b82f6' }} />
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
    <Panel id="drivers" title="Drivers · tap a figure, or open the lever" figure={`${fv.drivers.length} vitals`}>
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

function Training({ fv, ask, dispatch }) {
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
    <Panel id="pipelines" title="Crew pipelines" figure={`${fv.pipe.length} training`}>
      {fv.branches.map((b) => {
        const mine = fv.pipe.filter((p) => p.b === b.id).map((p) => p.mo).sort((x, y) => x - y);
        return <Row key={b.id} title={`${b.n} crews`} sub={mine.length ? `${mine.length} in training, next in ${mine[0]}mo (${R.pipeMo[b.id]}mo pipeline)` : `${R.pipeMo[b.id]}mo pipeline, none in training`} value={`${b.crews} / ${b.need}`} tone={b.gap > 0 ? 'alert' : 'good'} />;
      })}
    </Panel>
  </>;
}

function Equipment({ fv, v, dispatch, toast }) {
  const own = (pid) => (BLACK_PROGRAMS[pid] ? +v.blackPrograms[pid] || 0 : (v.platforms[pid] || 0) + (v.platformsImported[pid] || 0));
  const meta = (pid) => PLATFORMS[pid] || BLACK_PROGRAMS[pid];
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
  return <>
    <Panel id="crews" title="Crews vs airframes and hulls" figure={fv.branches.some((b) => b.gap > 0) ? 'gap' : 'covered'} tone={fv.branches.some((b) => b.gap > 0) ? 'alert' : 'good'} data-forces-crews>
      {fv.branches.map((b) => (
        <Row key={b.id} title={b.n} sub={`${b.crews} crews / ${b.need} needed · ${b.deployed} stationed${b.pipe ? ` · ${b.pipe} training` : ''}`} value={b.gap > 0 ? `gap ${b.gap}` : 'covered'} tone={b.gap > 0 ? 'alert' : 'good'}>
          <Bar pct={b.need ? (b.crews / b.need) * 100 : 100} tone={b.gap > 0 ? 'alert' : 'good'} />
        </Row>))}
      <div className="wl-note">A unit without free crews cannot be stationed. Raise training or pay to close a gap.</div>
    </Panel>
    {BRANCHES.map(([bid, bn]) => {
      const mine = ids.filter((pid) => crewOf(pid).b === bid);
      return <Panel key={bid} id={`inv_${bid}`} title={`${bn} inventory`} figure={mine.reduce((a, pid) => a + own(pid), 0)}>
        {mine.length === 0 && <div className="wl-note">Nothing fielded. Build in the Defense tab.</div>}
        {mine.map((pid) => {
          const m = meta(pid); const n = own(pid); const w = where(pid); const st = w.reduce((a, [, k]) => a + k, 0); const dep = DEPLOYABLE.includes(pid); const c = crewOf(pid);
          return <Row key={pid} data-unit={pid} title={`${m.i} ${m.n}`} sub={`${gen(pid)} · ${c.n * n} crew sets · ${dep ? `${st}/${n} stationed, ${n - st} in reserve` : 'national asset, applies automatically'}`}
            value={PLATFORMS[pid] ? `$${m.maint * (v.platforms[pid] || 0)}M/mo` : `×${n}`}>
            {dep && <div className="wl-row" style={{ flexWrap: 'wrap', marginTop: 4 }}>
              {w.map(([rid, k]) => <span key={rid} className="wl-chip">{REGIONS[rid]?.n} ×{k} {POSTURE_LABELS[v.forcePosture[rid] || 'deter']?.slice(0, 2)} <button type="button" data-recall={pid} className="wl-btn wl-btn-sm wl-btn-alert" onClick={() => dispatch({ type: 'recallUnit', payload: { region: rid, unit: pid } })}>recall</button></span>)}
              {n - st > 0 && <><select id={`oob_${pid}`} className="wl-sel" defaultValue="" aria-label={`Station ${m.n} in`}><option value="" disabled>station in…</option>{Object.entries(REGIONS).map(([rid, rg]) => <option key={rid} value={rid}>{rg.n}</option>)}</select>
                <button type="button" className="wl-btn wl-btn-primary" onClick={() => station(pid)}>+ Station</button></>}
            </div>}
          </Row>;
        })}
      </Panel>;
    })}
    <Panel id="theaters" title="Theater summary" figure={`${theaters.length} regions`}>
      {theaters.length === 0 && <div className="wl-note">No theater assets stationed.</div>}
      {theaters.map(([rid, us]) => <Row key={rid} title={REGIONS[rid]?.n} sub={us.map(([pid, k]) => `${meta(pid)?.n} ×${k}`).join(' · ')} value={POSTURE_LABELS[v.forcePosture[rid] || 'deter']} />)}
    </Panel>
    <Panel id="maint" title="Maintenance" figure={`$${maint}M/mo`} tone="warn">
      <Row title="Platform upkeep" sub="Per-unit maintenance, charged monthly" value={<WhyV title="Maintenance / month" fmt={(x) => `$${x.toFixed(0)}M`} terms={Object.entries(v.platforms).filter(([, ct]) => ct).map(([pid, ct]) => ({ label: `${PLATFORMS[pid]?.n} ×${ct}`, value: -(PLATFORMS[pid]?.maint || 0) * ct }))} total={-maint}>${maint}M</WhyV>} />
    </Panel>
  </>;
}

function Specialized({ fv, v, ask, dispatch }) {
  const u = fv.units; const busy = fv.sof.pipes.length >= fv.sofRules.maxPipes;
  const isr = isrScore(v.platforms, v.defLevels, v.intelInfra, v.blackPrograms);
  const part = [['Reconnaissance constellation ×2', (v.platforms.satellite_net || 0) * 2], ['RQ-170 wings ×2', (v.platforms.rq170 || 0) * 2], ['RQ-180 wings ×4', (v.platforms.rq180 || 0) * 4], ['Space R&D level', v.defLevels.space || 0], ['ISR fusion', v.intelInfra?.isr_fusion ? 4 : 0]];
  const terms = [...part.map(([label, value]) => ({ label, value })), { label: 'Special access programs', value: isr - part.reduce((a, [, x]) => a + x, 0) }];
  const nuke = [['ssbn_fleet', 'SSBN fleet'], ['strategic_bombers', 'Strategic bombers'], ['icbm_force', 'ICBM silos']];
  const legs = triadLegs(v.platforms, v.blackPrograms);
  const cyber = v.platforms.cyber_command || 0;
  const selectT1 = () => ask({ title: `${u.t1 || 'Tier 1'} selection`, cost: `$${fv.sofRules.t1Cost}M/mo for ${fv.selectionMo}mo`, kind: 'warn', label: 'Start selection',
    lines: [`Draws one ${u.t2 || 'Tier 2'} unit out of service now (it returns only as Tier 1).`, `Each Tier 1 squadron adds ${fv.sofRules.t1Points} x quality x readiness to Tier-1 operation overmatch.`], run: () => dispatch({ type: 'selectTier1', payload: {} }) });
  return <>
    <Panel id="sof" title="Special operations" figure={`T2 ${fv.sof.t2} · T1 ${fv.sof.t1}`} data-forces-sof>
      <Row title={`Tier 2 · ${u.t2 || 'Tier 2'}`} sub={`Ceiling ${fv.sofRules.max.t2}`} value={fv.sof.t2} />
      <Row title={`Tier 1 · ${u.t1 || 'Tier 1'}`} sub={`Ceiling ${fv.sofRules.max.t1} · adds +${Math.round(fv.tier1 * fv.sofRules.t1Points)} Tier-1 overmatch (Intel)`} value={fv.sof.t1} />
      {fv.sof.pipes.map((p, i) => <Row key={i} title={p.t === 2 ? 'Tier 2 pipeline' : 'Tier 1 selection'} sub="Charged monthly to Training" value={`${p.mo}mo`} tone="good"><Bar pct={100 - (p.mo / (p.t === 2 ? fv.sofRules.t2Mo : fv.sofRules.t1MoMax)) * 100} tone="good" /></Row>)}
      <div className="wl-grid2" style={{ marginTop: 8 }}>
        <button type="button" className="wl-lvl" disabled={busy} onClick={() => dispatch({ type: 'trainSof', payload: {} })}>Train Tier 2<small>{fv.sofRules.t2Mo}mo · ${fv.sofRules.t2Cost}M/mo</small></button>
        <button type="button" className="wl-lvl" disabled={busy || fv.sof.t2 < 1} onClick={selectT1}>Tier 1 selection<small>{fv.selectionMo}mo · ${fv.sofRules.t1Cost}M/mo · −1 T2</small></button>
      </div>
      <div className="wl-note">Names: {u.status_source}. At most {fv.sofRules.maxPipes} pipelines at once; better recruits pass selection faster.</div>
    </Panel>
    <Panel id="isr" title="ISR" figure={isr} tone={tone(isr, 4, 10)}>
      <Row title="ISR score" sub="Kinetic damage and Tier-1 intel read it" value={<WhyV title="ISR score" terms={terms} total={isr}>{isr}</WhyV>} />
    </Panel>
    <Panel id="cyber" title="Cyber" figure={cyber ? `${cyber} command` : 'none'} tone={cyber ? 'good' : 'warn'}>
      <Row title="Cyber Command" sub={`Cyber R&D level ${v.defLevels.cyber || 0} · crews ${crewOf('cyber_command').n} each, land branch`} value={`×${cyber}`} />
    </Panel>
    <Panel id="nuclear" title="Nuclear crews" figure={`${legs}/3 legs`} tone={legs === 3 ? 'good' : legs ? 'warn' : undefined}>
      {nuke.map(([pid, n]) => { const ct = (v.platforms[pid] || 0) + (v.platformsImported[pid] || 0); const c = crewOf(pid); const b = fv.branches.find((x) => x.id === c.b); return <Row key={pid} title={n} sub={`${c.n * ct} ${BRANCH_N[c.b]} crew sets${b.gap > 0 ? ` · ${BRANCH_N[c.b]} gap ${b.gap}` : ''}`} value={`×${ct}`} tone={ct ? 'good' : undefined} />; })}
      {(v.blackPrograms.b21 || v.blackPrograms.h20 || v.blackPrograms.pakda || v.blackPrograms.x_bomber) ? <Row title="Stealth bomber (deterrent)" sub="Counts as the air leg" value="✓" tone="good" /> : null}
      <div className="wl-note">Triad legs and MAD parity are in the Arsenal vertical (Deterrence).</div>
    </Panel>
  </>;
}

export function ForcesTab({ sub, onSub, view, dispatch, toast, onJump }) {
  const [act, setAct] = useState(null);
  const fv = forceView(view);
  const gaps = fv.branches.filter((b) => b.gap > 0).length;
  const items = FORCES_SUBS.map((s) => (s.id === 'equipment' && gaps ? { ...s, badge: gaps, sev: 'alert' } : s));
  const body = sub === 'quality' ? <Quality fv={fv} onJump={onJump} /> : sub === 'training' ? <Training fv={fv} ask={setAct} dispatch={dispatch} />
    : sub === 'equipment' ? <Equipment fv={fv} v={view} dispatch={dispatch} toast={toast} /> : sub === 'specialized' ? <Specialized fv={fv} v={view} ask={setAct} dispatch={dispatch} />
    : <Manpower fv={fv} v={view} dispatch={dispatch} />;
  return (
    <div className="wl-pane-wrap" data-sentinel="forces">
      <Seg id="forces" label="Forces" items={items} active={sub} onSelect={onSub} />
      <div className="wl-tabroot" data-forces data-forces-sub={sub}>{body}</div>
      <ConfirmSheet act={act} onClose={() => setAct(null)} />
    </div>
  );
}
