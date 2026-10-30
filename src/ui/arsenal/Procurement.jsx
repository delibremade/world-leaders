// Arsenal > Procurement: develop, build, import and retire platforms; acquisition policy; aging force; R&D readiness.
// Platform order is PLATFORMS order (the parity scripts press the first matching button). Prices come from formulas.js.
import { useState } from 'react';
import { Panel, Row, Bar } from '../shell/Panel.jsx';
import { DataTable } from '../shell/DataTable.jsx';
import { useWide } from '../shell/useWide.js';
import { f0, tone } from '../shell/fmt.jsx';
import { PLATFORMS, DV, DEPLOYABLE } from '../../data/platforms.js';
import { REGIONS } from '../../data/regions.js';
import { MINERALS } from '../../data/minerals.js';
import { platformAcquisition } from '../../sim/procurement-view.js';
import { deployedTotal, deploymentOptions } from '../../sim/deployment-view.js';
import { retirementQuote } from '../../sim/force-retirement.js';
import { meetsReq, procurementCost, recapCost } from '../../sim/formulas.js';

const POLICIES = [['efficiency', '💲 Efficiency', 'Build −15%, maint −15%, effectiveness −5%'], ['balanced', '⚖️ Balanced', 'Standard terms'], ['surge', '🚀 Surge', 'Build +25%, maint +20%, effectiveness +8%']];

function PlatformRow({ pid, v, dispatch, onJump, availability }) {
  const acquisition=platformAcquisition(v,pid),[region,setRegion]=useState('');
  const available=availability?.free||0;
  const domesticRetire=retirementQuote(v,{platform:pid,source:'domestic'}),importedRetire=retirementQuote(v,{platform:pid,source:'imported'});
  const { platforms, platformsImported, platformDev, developed, defLevels, procureMode } = v; const p = PLATFORMS[pid];
    const ct = platforms[pid] || 0; const imp = platformsImported[pid] || 0; const ok = meetsReq(p.req, defLevels);
  const over = Object.entries(p.req).reduce((o, [vv, rq]) => o + Math.max(0, (defLevels[vv] || 0) - rq), 0);
  const e = Math.min(2, 1 + 0.07 * over) * (procureMode === 'surge' ? 1.08 : procureMode === 'efficiency' ? 0.95 : 1);
  const pd = platformDev[pid];
  return <Row key={pid} data-platform={pid} title={`${p.i} ${p.n}`} value={ct > 0 || imp > 0 ? `×${acquisition.owned} surviving` : undefined} tone="good"
    sub={`+${(p.mil * e).toFixed(1)} military each${e > 1 ? ` (${Math.round((e - 1) * 100)}% tech bonus)` : ''} · $${p.maint}M/mo · ${DEPLOYABLE.includes(pid) ? 'theater asset' : 'national asset'}${p.triad ? ' · ☢ strategic, domestic only' : ''}`}>
    <div className="wl-acquisition-path" data-acquisition-phase={acquisition.phase}><b>{acquisition.phase}</b><small>Research → Develop → Produce → Deliver → Deploy</small></div>
    <small style={{ display: 'block' }}>Req: {Object.entries(p.req).length ? Object.entries(p.req).map(([vv, rq]) => <span key={vv} data-tone={(defLevels[vv] || 0) >= rq ? 'good' : 'alert'} style={{ marginRight: 6 }}>{DV[vv]?.n} L{rq}{(defLevels[vv] || 0) >= rq ? ' ✓' : ` (you: ${defLevels[vv] || 0})`}</span>) : 'none'}</small>
    {pd && <><small data-tone="warn" style={{ display: 'block' }}>🔬 Developing: {pd.mo}mo left</small><Bar pct={p.dev ? (1 - pd.mo / p.dev.mo) * 100 : 0} /></>}
    <div className="wl-row" style={{ flexWrap: 'wrap', marginTop: 4 }}>
      {p.dev && !developed.has(pid) && !pd && <button type="button" className="wl-btn wl-btn-primary" disabled={!!acquisition.reason} onClick={() => dispatch({ type: 'developPlatform', payload: { platform: pid } })}>🔬 Develop ${p.dev.cost}M · {p.dev.mo}mo</button>}
      {(!p.dev || developed.has(pid)) && <button type="button" className="wl-btn wl-btn-primary" disabled={!!acquisition.reason} onClick={() => dispatch({ type: 'buildPlatform', payload: { platform: pid } })}>Build ${procurementCost(p, procureMode)}M</button>}
      {!ok && !p.triad && !p.dev && <button type="button" className="wl-btn wl-btn-warn" onClick={() => dispatch({ type: 'importPlatform', payload: { platform: pid } })}>🌐 Purchase ${Math.round(p.cost * 1.8)}M</button>}
      {ct > 0 && <button type="button" className="wl-btn wl-btn-alert" disabled={!!domesticRetire.block} title={domesticRetire.block||'Retire one domestic purchase'} onClick={() => dispatch({ type: 'decommissionPlatform', payload: { platform: pid } })}>Retire 1</button>}
      {imp > 0 && <button type="button" className="wl-btn wl-btn-warn" disabled={!!importedRetire.block} title={importedRetire.block||'Retire one imported purchase'} onClick={() => dispatch({ type: 'retireImported', payload: { platform: pid } })}>Retire 1 import</button>}
    </div>
    {acquisition.reason&&<p className="wl-reason" data-procurement-gate>{acquisition.reason}</p>}
    {(ct>0&&domesticRetire.block||imp>0&&importedRetire.block)&&<p className="wl-reason" data-retirement-gate>{ct>0?domesticRetire.block:importedRetire.block}</p>}
    {onJump&&<div className="wl-map-shortcuts">{!ok&&<button data-procurement-research onClick={()=>onJump({tab:"technology"})}>Open required research →</button>}{acquisition.supply.binding&&<button data-procurement-supply={pid} onClick={()=>onJump({tab:"resources",sub:"deals",mineral:acquisition.supply.binding})}>Secure {MINERALS[acquisition.supply.binding]?.n} supply →</button>}{acquisition.crewReason&&<button onClick={()=>onJump({tab:"forces",sub:"training"})}>Crews & training →</button>}{DEPLOYABLE.includes(pid)&&acquisition.owned>0&&<button data-procurement-orders={pid} onClick={()=>onJump({tab:"forces",sub:"deployments",region:region||undefined,unit:pid})}>Assignments & recall →</button>}</div>}
    {acquisition.supply.queued.length>0&&<p className="wl-note" data-production-queue>{acquisition.supply.queued.length} paid order(s) waiting on minerals. Next delivery: {acquisition.supply.queued[0].months===Infinity?'supply needed':`about ${acquisition.supply.queued[0].months} months`}. {acquisition.supply.binding&&`Binding input: ${MINERALS[acquisition.supply.binding]?.n}.`}</p>}
    {DEPLOYABLE.includes(pid)&&acquisition.owned>0&&<div className="wl-procurement-station"><p>{available} ready & available · {availability?.reserved||0} reserved in packages · {deployedTotal(v,pid)} stationed</p>{availability?.reason&&<p className="wl-reason">{availability.reason}</p>}<select className="wl-sel" aria-label="Deploy purchased platform to" value={region} onChange={e=>setRegion(e.target.value)}><option value="">Choose destination…</option>{Object.entries(REGIONS).map(([id,r])=><option key={id} value={id}>{r.n}</option>)}</select><button type="button" className="wl-btn wl-btn-primary" data-procurement-deploy={pid} disabled={!region||available<=0||!!availability?.reason} onClick={()=>dispatch({type:'deployUnit',payload:{unit:pid,region}})}>Deploy {p.n}</button></div>}
  </Row>;
}

export function Procurement({ v, dispatch, initialPlatform, onJump }) {
  const availability=Object.fromEntries(deploymentOptions(v).map(o=>[o.id,o]));
  const { platforms, platformsImported, platformDev, developed, defLevels, defResearch, procureMode, stats, sectorAge, activePolicies, country } = v;
  const units = Object.values(platforms).reduce((a, b) => a + (b || 0), 0);
  const maint = Object.entries(platforms).reduce((s, [pid, ct]) => s + (PLATFORMS[pid]?.maint || 0) * (ct || 0), 0);
  const age = sectorAge.defense || 0; const eff = age > 480 ? Math.max(0.7, 1 - (age - 480) * 0.0008) : 1;
  const queue = Object.entries(defResearch);
  const wide = useWide(); const [sel, setSel] = useState(initialPlatform||null); const [query,setQuery]=useState(initialPlatform?PLATFORMS[initialPlatform].n:'');
  const visibleIds=Object.keys(PLATFORMS).filter(id=>PLATFORMS[id].n.toLowerCase().includes(query.toLowerCase()));
  const search=<label className="wl-field">Find platform<input aria-label="Find platform" placeholder="F/A-XX, carrier, submarine…" value={query} onChange={e=>setQuery(e.target.value)}/></label>;
  const structure = (
    <Panel id="structure" title="New procurements" figure={`${units} units`}>
      <Row title="Purchased packages" sub="The starting order of battle and its deployment controls are in Forces" value={units} />
      <Row title="Maintenance" sub="Per-unit upkeep, charged monthly" value={`$${maint}M/mo`} tone="warn" />
      <Row title="Projection" sub="Sphere gain in contested regions" value={`+${Math.min(0.6, ((platforms.carrier_group || 0) * 2 + (platforms.sub_fleet || 0) + (platforms.fighter_wing || 0) * 0.5 + (platforms.drone_swarm || 0) + (platforms.hypersonic_bty || 0)) * 0.05).toFixed(2)}/mo`} />
      <Row title="Trade lanes" sub="Carrier and submarine presence" value={`+$${((platforms.carrier_group || 0) + (platforms.sub_fleet || 0)) * 10}M/mo`} tone="good" />
      <Row title="Exports" sub="Fielded systems sell for more" value="+25%" tone="good" />
      <div className="wl-note">Effectiveness scales +7% per research level above a platform's requirement.</div>
    </Panel>
  );
  const aging = (
    age > 360 && <Panel id="aging" title={age > 480 ? 'Force obsolescence' : 'Aging force'} figure={age > 480 ? `×${eff.toFixed(2)}` : `${480 - age}mo`} tone={age > 480 ? 'alert' : 'warn'}>
      <Row stack title={age > 480 ? `Fleet effectiveness ×${eff.toFixed(2)}` : `Obsolescence in ${480 - age}mo`} sub={`Platforms older than 40 years lose effectiveness (${age}mo since the last recapitalization)`}
        trailing={<button type="button" className="wl-btn wl-btn-good" onClick={() => dispatch({ type: 'recapitalizeForces' })}>🔄 Recapitalize Forces — ${recapCost(stats?.treasury).toLocaleString()}M</button>} />
    </Panel>
  );
  const article9 = (
    country?.id === 'japan' && <Panel id="article9" title="Article 9" figure={activePolicies.has('jp_normalization') ? 'normalized' : '+40% cost'} tone={activePolicies.has('jp_normalization') ? 'good' : 'alert'}>
      {activePolicies.has('jp_normalization')
        ? <div className="wl-note">⚖️ Defense Normalization in force: Munitions and Missiles at standard cost. Counterstrike doctrine adopted.</div>
        : <Row stack title="🇯🇵 Constitutional constraint" sub="Munitions and Missile programs carry +40% cost. Normalization removes it for good: −6 stability now, turmoil −0.05/mo for a year."
          trailing={<button type="button" className="wl-btn wl-btn-alert" onClick={() => dispatch({ type: 'japanNormalization' })}>⚖️ Enact Normalization — $500M · −6 stability</button>} />}
    </Panel>
  );
  const policy = (
    <Panel id="policy" title="Acquisition policy" figure={procureMode}>
      <div role="group" aria-label="Acquisition policy">
        {POLICIES.map(([m, l, d]) => <button key={m} type="button" className="wl-verb" aria-pressed={procureMode === m} onClick={() => dispatch({ type: 'setProcurement', payload: { mode: m } })}><span><b>{l}</b><small>{d}</small></span></button>)}
      </div>
    </Panel>
  );
  const platformsPanel = (
    <Panel id="platforms" title="Platforms" figure={Object.keys(PLATFORMS).length}>
      {search}{visibleIds.map((pid) => <PlatformRow key={pid} pid={pid} v={v} dispatch={dispatch} onJump={onJump} availability={availability[pid]} />)}
    </Panel>
  );
  const rd = (
    <Panel id="rd" title="R&D readiness" figure={`${Object.values(defLevels).reduce((a, b) => a + (b || 0), 0)} levels`}>
      {Object.entries(DV).map(([vert, def]) => { const lvl = defLevels[vert] || 0; return <Row key={vert} title={`${def.i} ${def.n}`} value={`L${lvl}/7`} tone={tone(lvl, 2, 4)}><Bar pct={(lvl / 7) * 100} tone={tone(lvl, 2, 4)} /></Row>; })}
      {queue.map(([vert, mo]) => { const def = DV[vert]; if (!def) return null; const tot = def.lvl[defLevels[vert] || 0]?.mo || mo; return <Row key={`q_${vert}`} title={`In research: ${def.n}`} sub={`→ L${(defLevels[vert] || 0) + 1}: ${def.lvl[defLevels[vert] || 0]?.n}`} value={`${mo}mo`}><Bar pct={Math.max(0, ((tot - mo) / tot) * 100)} /></Row>; })}
    </Panel>
  );
  if (wide) {
    const ids=visibleIds; const cur=ids.includes(sel)?sel:ids[0];
    const st = pid=>platformAcquisition(v,pid).phase;
    const cols = [
      { id: 'n', label: 'Platform', get: (pid) => PLATFORMS[pid].n, cell: (pid) => `${PLATFORMS[pid].i} ${PLATFORMS[pid].n}` },
      { id: 'own', label: 'Owned', num: true, get: (pid) => (platforms[pid] || 0) + (platformsImported[pid] || 0), cell: (pid) => ((platforms[pid] || 0) + (platformsImported[pid] || 0) > 0 ? `×${platforms[pid] || 0}${platformsImported[pid] ? ` +${platformsImported[pid]}🌐` : ''}` : '—'), tone: (pid) => ((platforms[pid] || 0) > 0 ? 'good' : undefined) },
      { id: 'cost', label: 'Build', num: true, get: (pid) => procurementCost(PLATFORMS[pid], procureMode), cell: (pid) => `$${procurementCost(PLATFORMS[pid], procureMode)}M` },
      { id: 'st', label: 'Status', get: (pid) => st(pid), tone: (pid) => (platformDev[pid] ? 'warn' : undefined) },
    ];
    return <div className="wl-md" data-master-detail="platforms">
      <div>{search}<DataTable id="platforms" label="Platforms" title="Platforms" columns={cols} rows={ids} rowId={(pid) => pid} selected={cur} onSelect={setSel} /></div>
      <div data-detail="platforms">{cur&&<Panel key={cur} id="platform-detail" title="Selected platform" figure={PLATFORMS[cur].n}><PlatformRow pid={cur} v={v} dispatch={dispatch} onJump={onJump} availability={availability[cur]} /></Panel>}{structure}{aging}{article9}{policy}{rd}</div>
    </div>;
  }
  return <>
    {platformsPanel}
    {structure}
    {aging}
    {article9}
    {policy}
    {rd}
  </>;
}
