// F9b (#57): the build sheet for one site. Who is here, what each node of yours reaches, and one 44px row per node type the site
// allows; a row opens the confirm sheet (cost and consequences) and the confirm dispatches buildNode. Private ports show F5's levers.
// Zero game logic: everything comes from siteView / basesView (src/sim/bases.js) and the lever table (src/data/minerals.js).
import { NATIONS } from '../../data/nations.js';
import { REGIONS } from '../../data/regions.js';
import { CHOKEPOINTS } from '../../data/chokepoints.js';
import { NODE_TYPES, TENURES, BASE_RULES as R } from '../../data/bases.js';
import { MINERAL_RULES as MR } from '../../data/minerals.js';
import { leverCost } from '../../sim/minerals.js';
import { chokesCovered, regionsCovered, portOutlook, nodeCost } from '../../sim/bases.js';
import { COLOR } from '../tokens.js';

const money = (n) => `$${n.toLocaleString('en-US')}M`;
const reachLine = (n) => { const ch = chokesCovered(n).map((k) => CHOKEPOINTS[k].n); const rg = regionsCovered(n).map((r) => REGIONS[r].n); return [ch.length ? `Chokepoints: ${ch.join(', ')}` : NODE_TYPES[n.type].reach ? 'No chokepoint in reach' : null, `Theaters: ${rg.join(', ')}`].filter(Boolean); };
// Consequence lines for the confirm sheet: what the node reaches, what it costs monthly, who consents.
export function buildLines(site, opt, pid) {
  const probe = { site: site.id, type: opt.type, owner: pid };
  const lines = [NODE_TYPES[opt.type].d, ...reachLine(probe)];
  if (opt.private) lines.push('Private capital builds it; no treasury capex. Pull a lever to speed it up.', `Online: ${money(opt.income || 0)}/mo to the treasury.`);
  else lines.push(`Online in ${opt.mo} months. Upkeep ${money(opt.upkeep)}/mo${opt.host ? `, basing agreement ${money(opt.host)}/mo to ${site.hostName}` : ''}.`);
  if (site.host !== pid) lines.push(site.host ? `${site.hostName} consents while relations stay above ${R.consentLose} and you neither sanction nor embargo them${NATIONS[site.host]?.host ? ' (host-nation agreement or access tenure; leases and treaty sites persist)' : ''}.` : `${site.hostName} consents while your sphere in ${REGIONS[site.region].n} stays above ${R.localLose}%.`, 'A foreign node draws tension from the top hostile competitor in the theater.');
  return lines;
}

export function SiteSheet({ g, site, country, dispatch, ask, onNation }) {
  if (!site) return null;
  const pid = country?.id; const c = site.consent;
  const chips = [[`${REGIONS[site.region]?.n || site.region}`, ''], site.host && site.host !== pid ? null : [`Host: ${site.hostName}`, site.host === pid ? 'command' : ''],
    site.host !== pid ? (c.lost ? ['Consent lost', 'alert'] : c.ok ? ['Consent', 'good'] : ['No consent yet', 'warn']) : null,
    ...site.chokes.map((k) => [`⚓ ${CHOKEPOINTS[k].n}`, 'command'])].filter(Boolean);
  return (
    <div data-site-sheet={site.id}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>{site.host && site.host !== pid && <button type="button" className="wl-chip wl-chip-command" data-host-nation={site.host} title={`Open ${site.hostName}: relations, basing agreement, state visit`} onClick={() => onNation?.(site.host)}>Host: {site.hostName} ›</button>}{chips.map(([l, k]) => <span key={l} className={`wl-chip${k ? ' wl-chip-' + k : ''}`}>{l}</span>)}</div>
      <div className="wl-note" style={{ marginBottom: 8 }}>{site.status_source}</div>
      {site.nodes.length > 0 && <div className="wl-label" style={{ margin: '6px 0 2px' }}>Nodes here</div>}
      {site.nodes.map((n) => {
        const t = NODE_TYPES[n.type]; const mine = n.owner === pid; const cost = nodeCost(n.type, n.site, n.owner);
        const o = mine && t.private && n.status === 'building' ? portOutlook(g, n) : null;
        return (
          <div key={n.id} className="wl-r" data-node-row={n.id}>
            <div className="wl-r-main">
              <b>{t.i} {t.n} · {NATIONS[n.owner]?.flag} {mine ? 'yours' : NATIONS[n.owner]?.n}{n.tenure && n.tenure !== 'own' ? ` · ${TENURES[n.tenure].n.toLowerCase()}` : ''}</b>
              <small>{n.status === 'building' ? (t.private ? `Private build · ${n.mo} mo left${o && !o.profitable ? ' · stalled: not profitable' : ''}` : `Building · ${n.mo} mo left`) : n.status === 'closed' ? `Closed by the host · reopens ${Math.max(0, R.reopenMo - (n.closed || 0))} mo after consent returns` : mine ? `${reachLine(n).join(' · ')}${cost.upkeep ? ` · ${money(cost.upkeep)}/mo` : ''}${cost.host ? ` + ${money(cost.host)}/mo agreement` : ''}${t.income && n.status === 'active' ? ` · +${money(t.income)}/mo` : ''}` : reachLine(n).join(' · ')}</small>
              {o && <div className="wl-verb-opts" role="group" aria-label="State levers">{Object.entries(MR.levers).map(([k, L]) => { const on = o.levers.includes(k); return <button key={k} type="button" aria-pressed={on} data-lever={k} title={L.n} onClick={() => !on && dispatch({ type: 'nodeLever', payload: { id: n.id, lever: k } })}>{L.i} {L.s} {on ? '✓' : money(leverCost(o.capex, k))}</button>; })}</div>}
            </div>
            {mine && <button type="button" className="wl-btn wl-btn-sm" data-node-close={n.id} aria-label={`Decommission ${t.n}`} onClick={() => ask({ title: `Decommission ${t.n}`, cost: 'No refund', kind: 'alert', label: 'Decommission', back: site.id, lines: [`${site.n}: every effect of this node ends now.`, cost.upkeep ? `Saves ${money(cost.upkeep + cost.host)}/mo.` : 'No upkeep to save.'], run: () => dispatch({ type: 'closeNode', payload: { id: n.id } }) })}>✕</button>}
          </div>);
      })}
      <div className="wl-label" style={{ margin: '10px 0 2px' }}>Build here</div>
      {site.options.map((opt) => {
        const t = NODE_TYPES[opt.type];
        return (
          <button key={opt.type} type="button" className="wl-verb" data-build-option={opt.type} data-kind={opt.ok ? 'good' : ''} disabled={!opt.ok} title={opt.reason || t.d}
            onClick={() => ask({ title: `${t.i} ${t.n} · ${site.n}`, cost: opt.private ? 'Authorize: $0 (private capital)' : `${money(opt.capex)} now`, kind: opt.private ? 'good' : 'warn', label: opt.private ? 'Authorize' : 'Build', back: site.id, lines: buildLines(site, opt, pid), run: () => dispatch({ type: 'buildNode', payload: { site: site.id, type: opt.type } }) })}>
            <span aria-hidden="true" style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{t.i}</span>
            <span style={{ flex: 1, minWidth: 0 }}><b>{t.n}</b><small>{opt.reason || `${opt.private ? 'Private capital' : `${money(opt.capex)} · ${opt.mo} mo`}${opt.upkeep ? ` · ${money(opt.upkeep)}/mo` : ''}${opt.host ? ` + ${money(opt.host)}/mo to host` : ''} · reach ${t.reach ? `${t.reach.toLocaleString('en-US')} km` : 'theater'}`}</small></span>
            <span className="wl-verb-cost" style={{ color: opt.ok ? COLOR.text.muted : COLOR.text.faint }}>{opt.private ? '$0' : money(opt.capex)}</span>
          </button>);
      })}
    </div>
  );
}
