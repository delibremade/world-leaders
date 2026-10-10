// Arsenal > Procurement: develop, build, import and retire platforms; acquisition policy; aging force; R&D readiness.
// Platform order is PLATFORMS order (the parity scripts press the first matching button). Prices come from formulas.js.
import { Panel, Row, Bar } from '../shell/Panel.jsx';
import { f0, tone } from '../shell/fmt.jsx';
import { PLATFORMS, DV, DEPLOYABLE } from '../../data/platforms.js';
import { meetsReq, procurementCost, recapCost } from '../../sim/formulas.js';

const POLICIES = [['efficiency', '💲 Efficiency', 'Build −15%, maint −15%, effectiveness −5%'], ['balanced', '⚖️ Balanced', 'Standard terms'], ['surge', '🚀 Surge', 'Build +25%, maint +20%, effectiveness +8%']];

export function Procurement({ v, dispatch }) {
  const { platforms, platformsImported, platformDev, developed, defLevels, defResearch, procureMode, stats, sectorAge, activePolicies, country } = v;
  const units = Object.values(platforms).reduce((a, b) => a + (b || 0), 0);
  const maint = Object.entries(platforms).reduce((s, [pid, ct]) => s + (PLATFORMS[pid]?.maint || 0) * (ct || 0), 0);
  const age = sectorAge.defense || 0; const eff = age > 480 ? Math.max(0.7, 1 - (age - 480) * 0.0008) : 1;
  const queue = Object.entries(defResearch);
  return <>
    <Panel id="structure" title="Force structure" figure={`${units} units`}>
      <Row title="Deployed units" sub="Military power comes from built platforms, not research alone" value={units} />
      <Row title="Maintenance" sub="Per-unit upkeep, charged monthly" value={`$${maint}M/mo`} tone="warn" />
      <Row title="Projection" sub="Sphere gain in contested regions" value={`+${Math.min(0.6, ((platforms.carrier_group || 0) * 2 + (platforms.sub_fleet || 0) + (platforms.fighter_wing || 0) * 0.5 + (platforms.drone_swarm || 0) + (platforms.hypersonic_bty || 0)) * 0.05).toFixed(2)}/mo`} />
      <Row title="Trade lanes" sub="Carrier and submarine presence" value={`+$${((platforms.carrier_group || 0) + (platforms.sub_fleet || 0)) * 10}M/mo`} tone="good" />
      <Row title="Exports" sub="Fielded systems sell for more" value="+25%" tone="good" />
      <div className="wl-note">Effectiveness scales +7% per research level above a platform's requirement.</div>
    </Panel>
    {age > 360 && <Panel id="aging" title={age > 480 ? 'Force obsolescence' : 'Aging force'} figure={age > 480 ? `×${eff.toFixed(2)}` : `${480 - age}mo`} tone={age > 480 ? 'alert' : 'warn'}>
      <Row stack title={age > 480 ? `Fleet effectiveness ×${eff.toFixed(2)}` : `Obsolescence in ${480 - age}mo`} sub={`Platforms older than 40 years lose effectiveness (${age}mo since the last recapitalization)`}
        trailing={<button type="button" className="wl-btn wl-btn-good" onClick={() => dispatch({ type: 'recapitalizeForces' })}>🔄 Recapitalize Forces — ${recapCost(stats?.treasury).toLocaleString()}M</button>} />
    </Panel>}
    {country?.id === 'japan' && <Panel id="article9" title="Article 9" figure={activePolicies.has('jp_normalization') ? 'normalized' : '+40% cost'} tone={activePolicies.has('jp_normalization') ? 'good' : 'alert'}>
      {activePolicies.has('jp_normalization')
        ? <div className="wl-note">⚖️ Defense Normalization in force: Munitions and Missiles at standard cost. Counterstrike doctrine adopted.</div>
        : <Row stack title="🇯🇵 Constitutional constraint" sub="Munitions and Missile programs carry +40% cost. Normalization removes it for good: −6 stability now, turmoil −0.05/mo for a year."
          trailing={<button type="button" className="wl-btn wl-btn-alert" onClick={() => dispatch({ type: 'japanNormalization' })}>⚖️ Enact Normalization — $500M · −6 stability</button>} />}
    </Panel>}
    <Panel id="policy" title="Acquisition policy" figure={procureMode}>
      <div role="group" aria-label="Acquisition policy">
        {POLICIES.map(([m, l, d]) => <button key={m} type="button" className="wl-verb" aria-pressed={procureMode === m} onClick={() => dispatch({ type: 'setProcurement', payload: { mode: m } })}><span><b>{l}</b><small>{d}</small></span></button>)}
      </div>
    </Panel>
    <Panel id="platforms" title="Platforms" figure={Object.keys(PLATFORMS).length}>
      {Object.entries(PLATFORMS).map(([pid, p]) => {
        const ct = platforms[pid] || 0; const imp = platformsImported[pid] || 0; const ok = meetsReq(p.req, defLevels);
        const over = Object.entries(p.req).reduce((o, [vv, rq]) => o + Math.max(0, (defLevels[vv] || 0) - rq), 0);
        const e = Math.min(2, 1 + 0.07 * over) * (procureMode === 'surge' ? 1.08 : procureMode === 'efficiency' ? 0.95 : 1);
        const pd = platformDev[pid];
        return <Row key={pid} data-platform={pid} title={`${p.i} ${p.n}`} value={ct > 0 || imp > 0 ? `×${ct}${imp > 0 ? ` +${imp}🌐` : ''}` : undefined} tone="good"
          sub={`+${(p.mil * e).toFixed(1)} military each${e > 1 ? ` (${Math.round((e - 1) * 100)}% tech bonus)` : ''} · $${p.maint}M/mo · ${DEPLOYABLE.includes(pid) ? 'theater asset' : 'national asset'}${p.triad ? ' · ☢ strategic, domestic only' : ''}`}>
          <small style={{ display: 'block' }}>Req: {Object.entries(p.req).length ? Object.entries(p.req).map(([vv, rq]) => <span key={vv} data-tone={(defLevels[vv] || 0) >= rq ? 'good' : 'alert'} style={{ marginRight: 6 }}>{DV[vv]?.n} L{rq}{(defLevels[vv] || 0) >= rq ? ' ✓' : ` (you: ${defLevels[vv] || 0})`}</span>) : 'none'}</small>
          {pd && <><small data-tone="warn" style={{ display: 'block' }}>🔬 Developing: {pd.mo}mo left</small><Bar pct={p.dev ? (1 - pd.mo / p.dev.mo) * 100 : 0} /></>}
          <div className="wl-row" style={{ flexWrap: 'wrap', marginTop: 4 }}>
            {p.dev && !developed.has(pid) && !pd && <button type="button" className="wl-btn wl-btn-primary" aria-disabled={!ok} style={ok ? undefined : { opacity: 0.55 }} onClick={() => dispatch({ type: 'developPlatform', payload: { platform: pid } })}>🔬 Develop ${p.dev.cost}M · {p.dev.mo}mo</button>}
            {(!p.dev || developed.has(pid)) && <button type="button" className="wl-btn wl-btn-primary" aria-disabled={!ok} style={ok ? undefined : { opacity: 0.55 }} onClick={() => dispatch({ type: 'buildPlatform', payload: { platform: pid } })}>Build ${procurementCost(p, procureMode)}M</button>}
            {!ok && !p.triad && <button type="button" className="wl-btn wl-btn-warn" onClick={() => dispatch({ type: 'importPlatform', payload: { platform: pid } })}>🌐 Purchase ${Math.round(p.cost * 1.8)}M</button>}
            {ct > 0 && <button type="button" className="wl-btn wl-btn-alert" onClick={() => dispatch({ type: 'decommissionPlatform', payload: { platform: pid } })}>−1</button>}
            {imp > 0 && <button type="button" className="wl-btn wl-btn-warn" onClick={() => dispatch({ type: 'retireImported', payload: { platform: pid } })}>−1🌐</button>}
          </div>
        </Row>;
      })}
    </Panel>
    <Panel id="rd" title="R&D readiness" figure={`${Object.values(defLevels).reduce((a, b) => a + (b || 0), 0)} levels`}>
      {Object.entries(DV).map(([vert, def]) => { const lvl = defLevels[vert] || 0; return <Row key={vert} title={`${def.i} ${def.n}`} value={`L${lvl}/7`} tone={tone(lvl, 2, 4)}><Bar pct={(lvl / 7) * 100} tone={tone(lvl, 2, 4)} /></Row>; })}
      {queue.map(([vert, mo]) => { const def = DV[vert]; if (!def) return null; const tot = def.lvl[defLevels[vert] || 0]?.mo || mo; return <Row key={`q_${vert}`} title={`In research: ${def.n}`} sub={`→ L${(defLevels[vert] || 0) + 1}: ${def.lvl[defLevels[vert] || 0]?.n}`} value={`${mo}mo`}><Bar pct={Math.max(0, ((tot - mo) / tot) * 100)} /></Row>; })}
    </Panel>
  </>;
}
