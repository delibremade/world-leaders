// Arsenal > Partnerships (allied access tiers, gates, compliance) and Exports (buyers, willingness, advantage).
// Gates and prices come from accessView / compliance (one rule with the verbs); buyer maths mirrors the offerArms verb's inputs.
import { Panel, Row } from '../shell/Panel.jsx';
import { BLACK_PROGRAMS, DV, STAGES } from '../../data/platforms.js';
import { NATIONS, BUYERS } from '../../data/nations.js';
import { BLOC_TRADE } from '../../data/trade.js';
import { TIERS, ACCESS_RULES } from '../../data/alliance.js';
import { accessView, compliance } from '../../sim/selectors.js';
import { exportEdge, getDefLeverage } from '../../sim/formulas.js';

export function Partnerships({ v, dispatch }) {
  const rows = accessView(v); const cp = compliance(v);
  const nm = (id) => NATIONS[id].n;
  return <>
    <Panel id="compliance" title="Security compliance" figure={cp.ok ? 'compliant' : 'breach risk'} tone={cp.ok ? 'good' : 'alert'} data-compliance>
      <Row title="Counter-intelligence" sub={`Floor ${ACCESS_RULES.ciFloor * 100}%`} value={`${Math.round(cp.ci * 100)}%`} tone={cp.ci * 100 >= ACCESS_RULES.ciFloor * 100 ? 'good' : 'alert'} />
      <Row title="Espionage exposure" sub={`Ceiling ${ACCESS_RULES.exposureCeil * 100}%`} value={`${Math.round(cp.exposure * 100)}%`} tone={cp.exposure * 100 <= ACCESS_RULES.exposureCeil * 100 ? 'good' : 'alert'} />
      <Row title="Flagged deals" sub="Trade agreements with China or Russia suspend membership" value={cp.flagged.length ? cp.flagged.map(nm).join(', ') : 'none'} tone={cp.flagged.length ? 'alert' : 'good'} />
    </Panel>
    {rows.map((r) => {
      const own = NATIONS[r.A.owner]; const st = STAGES.find(([k]) => k === r.stage)?.[1];
      return <Panel key={r.id} id={`acc_${r.id}`} data-access={r.id} title={`${r.bp.i} ${r.bp.n}`} figure={r.mine ? `${TIERS[r.mine.tier].n} · ${r.mine.status}` : r.owner ? 'yours' : 'not a member'} tone={r.mine?.status === 'suspended' ? 'alert' : r.mine ? 'good' : undefined}>
        <div className="wl-note" data-source={r.status_source} style={{ marginTop: 0 }}>{r.owner ? 'Your program' : `Owner ${own.n}`}{r.A.founders ? ` · founders ${r.A.founders.map(nm).join(', ')}` : ''}{r.A.natoOnly ? ' · NATO only' : ''} · {st}{r.open ? ' · in production' : ` · deliveries from ${r.A.ioc}`}</div>
        {r.owner ? <>
          {r.members.map((m) => <Row key={m.id} title={`${m.n} · ${TIERS[m.tier].n}`} sub={m.flag ? `⚠ ${m.flag}` : m.status} tone={m.flag ? 'alert' : undefined}
            trailing={<button type="button" className="wl-btn wl-btn-alert" onClick={() => dispatch({ type: 'expelPartner', payload: { program: r.id, nation: m.id } })}>Expel</button>} />)}
          <div className="wl-note">{r.applicants.length ? 'Applicants (relations ≥70, pact or NATO, NATO 2%):' : 'No eligible applicants. Raise relations to 70 and sign pacts.'}</div>
          {r.applicants.map((a) => <Row stack key={a.id} title={`${a.n}${a.flag ? ' ⚠' : ''}`} trailing={<span className="wl-row" style={{ flexWrap: 'wrap' }}>{a.tiers.map((t) => <button key={t} type="button" className="wl-btn wl-btn-primary" onClick={() => dispatch({ type: 'admitPartner', payload: { program: r.id, nation: a.id, tier: t } })}>Admit {a.n} as {TIERS[t].n}</button>)}</span>} />)}
        </> : <>
          {r.mine && <Row title={`${TIERS[r.mine.tier].n} · ${r.mine.status}${r.mine.founder ? ' · founder' : ''}`} sub={r.mine.status === 'suspended' ? `re-entry review ${r.mine.susp}mo` : `variant ${Math.round(TIERS[r.mine.tier].eff * 100)}%`} tone={r.mine.status === 'suspended' ? 'alert' : 'good'} />}
          {r.mine?.status === 'suspended' && <button type="button" className="wl-btn wl-btn-warn" style={{ opacity: r.mine.susp === 0 && cp.ok ? 1 : 0.55 }} onClick={() => dispatch({ type: 'reinstateAccess', payload: { program: r.id } })}>Reinstate · relations −{ACCESS_RULES.reentryRel}</button>}
          {r.mine?.status === 'active' && !r.mine.founder && <button type="button" className="wl-btn wl-btn-primary" style={{ opacity: r.open ? 1 : 0.55 }} onClick={() => dispatch({ type: 'orderAllied', payload: { program: r.id } })}>{r.open ? `Order ${r.bp.n} — $${r.price.toLocaleString()}M · ${TIERS[r.mine.tier].queue}mo` : `Orders open ${r.A.ioc}`}</button>}
          {r.orders.length > 0 && <div className="wl-note">📦 {r.orders.length} in queue · next in {Math.min(...r.orders.map((o) => o.mo))}mo</div>}
          {r.next.map(({ tier, gates }) => <div key={tier} style={{ marginTop: 8 }}>
            <button type="button" className="wl-btn wl-btn-primary" style={{ width: '100%', opacity: gates.every((x) => x.met) ? 1 : 0.55 }} onClick={() => dispatch({ type: 'joinProgram', payload: { program: r.id, tier } })}>Join as {TIERS[tier].n}</button>
            {gates.map((x) => <Row key={x.id} title={x.label} value={x.met ? '✓' : '✗'} tone={x.met ? 'good' : 'alert'} />)}
          </div>)}
          {r.canDefect && <button type="button" className="wl-btn wl-btn-warn" style={{ marginTop: 8 }} onClick={() => dispatch({ type: 'defectProgram', payload: { from: ACCESS_RULES.defect.from, to: ACCESS_RULES.defect.to } })}>Defect to {BLACK_PROGRAMS[ACCESS_RULES.defect.to].n} · France −20, Spain −10</button>}
        </>}
      </Panel>;
    })}
  </>;
}

export function Exports({ v, dispatch, vert, onVert }) {
  const { defLevels, globalDef, defExports, demand, nationRelations, sphere, embassies, blocTrade, forces, country, blackPrograms } = v;
  const lev = getDefLeverage(defLevels, globalDef, country?.id || '');
  const movers = Object.entries(demand).filter(([, x]) => Math.abs((x || 1) - 1) >= 0.08).sort((a, b) => Math.abs(b[1] - 1) - Math.abs(a[1] - 1)).slice(0, 4);
  const others = Object.entries(globalDef); const avg = vert && others.length ? others.reduce((s, [, n]) => s + (n[vert] || 0), 0) / others.length : 0;
  const exportable = Object.keys(blackPrograms).filter((b) => blackPrograms[b] > 0);
  return <>
    <Panel id="market" title="Export marketplace" figure={`leverage ×${lev.toFixed(2)}`} tone="good">
      <div className="wl-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <span className="wl-label">Demand</span>
        {movers.length ? movers.map(([k, d]) => <span key={k} className={`wl-chip ${d > 1 ? 'wl-chip-good' : 'wl-chip-alert'}`}>{DV[k]?.i} {DV[k]?.n} {d > 1 ? '▲' : '▼'}{Math.abs(Math.round((d - 1) * 100))}%</span>) : <span className="wl-chip">stable: prices lock at signing</span>}
      </div>
      <div className="wl-note">Pick a developed system (L1+), then offer it to a willing buyer. Leading the world (✦) pays more; buyers will not import what they build at home or accept from a hostile power.</div>
      <div className="wl-row" style={{ flexWrap: 'wrap', marginTop: 8 }}>
        {Object.entries(DV).map(([k, def]) => <button key={k} type="button" className="wl-btn" aria-pressed={vert === k} onClick={() => onVert(vert === k ? null : k)}>{def.i} {def.n} <span style={{ opacity: 0.7 }}>L{defLevels[k] || 0}</span></button>)}
      </div>
      {vert && <Row title={`Offering ${DV[vert]?.n} L${defLevels[vert] || 0}`} sub={`World average ${avg.toFixed(1)}`} />}
      {vert && (defLevels[vert] || 0) >= 1 && <button type="button" className="wl-btn wl-btn-good" style={{ width: '100%' }} onClick={() => dispatch({ type: 'sellAllVertical', payload: { vertical: vert } })}>🤝 Sell {DV[vert]?.n} to All Eligible Buyers</button>}
    </Panel>
    <Panel id="buyers" title="Buyers · willingness and advantage" figure={BUYERS.filter((b) => b.id !== country?.id).length}>
      {BUYERS.filter((b) => b.id !== country?.id).map((b) => {
        const key = vert ? `${b.id}_${vert}` : ''; const has = defExports[key]; const wont = vert && (b.noBuy || []).includes(vert);
        const rel = nationRelations[b.id] !== undefined ? nationRelations[b.id] : b.rel; const hostile = rel < -30;
        const can = vert && !wont && !hostile && (defLevels[vert] || 0) >= 1; const adv = Math.max(0, (defLevels[vert] || 0) - Math.floor(avg));
        const ch = [];
        if (vert && can && !has) { if ((sphere[b.region]?.player || 0) > 60) ch.push('sphere ×1.18'); if (embassies.has(b.id)) ch.push('attaché ×1.10'); if (blocTrade.eu >= 2 && BLOC_TRADE.eu.members.includes(b.id)) ch.push('EU ×1.15'); if (adv > 0) ch.push(`lead +${adv * 13}%`); if (forces) ch.push(`force quality ×${exportEdge(forces).toFixed(2)}`); }
        return <Row key={b.id} data-buyer={b.id} title={`${b.flag} ${b.n}`} sub={`${b.align} · $${b.budget}M budget${ch.length ? ` · ${ch.join(' · ')}` : ''}`}
          value={Object.entries(defExports).filter(([k]) => k.startsWith(b.id)).map(([k, d]) => `✓ ${DV[k.split('_')[1]]?.n} L${d.level} $${d.revenue}M/yr`).join(' ') || undefined} tone="good"
          trailing={vert ? <button type="button" className={`wl-btn ${has ? 'wl-btn-good' : can ? 'wl-btn-primary' : ''}`} style={wont || hostile || !can ? { opacity: 0.55 } : undefined} onClick={() => dispatch({ type: 'offerArms', payload: { nation: b.id, vertical: vert } })}>{has ? 'Active' : wont ? 'Domestic producer' : hostile ? 'Hostile' : can ? `Offer L${defLevels[vert] || 0}${adv > 0 ? ' ✦' : ''}` : 'Develop first'}</button> : undefined} />;
      })}
    </Panel>
    <Panel id="exportable" title="Your exportable platforms" figure={exportable.length}>
      {exportable.length === 0 && <div className="wl-note">No fielded programs. Verticals above sell your R&D; programs sell to allies through Partnerships.</div>}
      {exportable.map((b) => <Row key={b} title={`${BLACK_PROGRAMS[b].i} ${BLACK_PROGRAMS[b].n}`} sub={BLACK_PROGRAMS[b].exportable ? 'Exportable to allies' : 'Domestic only'} value={BLACK_PROGRAMS[b].exportable ? '✓' : '—'} tone={BLACK_PROGRAMS[b].exportable ? 'good' : undefined} />)}
    </Panel>
    {Object.keys(defExports).length > 0 && <Panel id="deals" title="Active export deals" figure={Object.keys(defExports).length}>
      {Object.entries(defExports).map(([k, d]) => { const [bid, vv] = k.split('_'); const b = BUYERS.find((x) => x.id === bid); return <Row key={k} title={`${b?.flag} ${b?.n} — ${DV[vv]?.n}`} sub={`Relationship ${d.relationship}%`} value={`$${d.revenue}M/yr`} tone="good" trailing={<button type="button" className="wl-btn wl-btn-alert" onClick={() => dispatch({ type: 'cutExportDeal', payload: { deal: k } })}>Cut Off</button>} />; })}
    </Panel>}
  </>;
}
