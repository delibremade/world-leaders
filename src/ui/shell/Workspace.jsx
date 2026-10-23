import { COLOR, FONT, SURFACE } from '../tokens.js';
import { SC, ss } from '../../data/stats.js';
import { CHOKEPOINTS } from '../../data/chokepoints.js';

const c = COLOR;
const score = v => Number.isFinite(v) ? Math.round(v) : '—';

// Entry points into existing systems. All numbers come from the simulation.
export function NationalPulse({ stats = {}, energyTier, spr, onJump }) {
  const cards = [
    { id:'economy', icon:'↗', label:'Economy', value:`${stats.gdpGrowth?.toFixed(1) ?? '—'}%`, unit:'GDP growth', detail:`${stats.inflation?.toFixed(1) ?? '—'}% inflation`, tone:c.system.economy },
    { id:'people', icon:'◎', label:'Living standards', value:score(stats.stability), unit:'Stability / 100', detail:`Health ${score(stats.healthcare)} · Education ${score(stats.education)}`, tone:c.accent.command, tab:'economy' },
    { id:'energy', icon:'ϟ', label:'Energy', value:energyTier, unit:'Power tier', detail:`${spr ?? 0}/6 strategic reserve`, tone:c.system.energy },
    { id:'forces', icon:'⚑', label:'Defense', value:score(stats.military), unit:'Strength / 100', detail:'Readiness & deployment →', tone:c.system.forces },
  ];
  return <div className="wl-national-pulse" data-national-pulse aria-label="National overview">
    {cards.map(x => <button type="button" key={x.id} data-pulse={x.id} style={{'--tone':x.tone}} onClick={() => onJump({tab:x.tab || x.id})}>
      <span className="wl-pulse-label"><i aria-hidden="true">{x.icon}</i>{x.label}<span>↗</span></span>
      <span className="wl-pulse-value">{x.value}<small>{x.unit}</small></span>
      <span className="wl-pulse-detail">{x.detail}</span>
    </button>)}
  </div>;
}

// The outliner owns the queue data and routing: these cards expose the next item in each lane.
export function QueueDeck({ rows, onJump }) {
  const lanes = [
    { id:'builds', label:'Production', icon:'▧', color:c.system.arsenal, jump:{tab:'arsenal',sub:'programs'}, empty:'Develop a platform' },
    { id:'research', label:'Research', icon:'⌬', color:c.system.technology, jump:{tab:'technology'}, empty:'Choose a technology' },
    { id:'ops', label:'Operations', icon:'◈', color:c.system.intel, jump:{tab:'intel'}, empty:'Commission intelligence' },
  ];
  return <section className="wl-queue-deck" aria-label="Active projects">
    {lanes.map(lane => {
      const items = rows.filter(r => r.group === lane.id && !r.id.startsWith('iss_'));
      const next = [...items].sort((a,b) => (a.months ?? Infinity) - (b.months ?? Infinity))[0];
      return <button type="button" key={lane.id} data-queue={lane.id} style={{'--tone':lane.color}} onClick={() => onJump(next?.jump || lane.jump)} title={next?.sub || lane.empty}>
        <span className="wl-queue-label">{lane.icon} {lane.label}<small>{items.length ? `${items.length} active` : 'Idle'}</small></span>
        <b>{next?.title || lane.empty}</b>
        <span className="wl-queue-time">{next ? next.months != null ? `${Math.ceil(next.months)} ${Math.ceil(next.months) === 1 ? 'month' : 'months'} remaining` : next.sub : 'Open workspace →'}</span>
        {next?.pct != null && <progress value={Math.max(0,Math.min(1,next.pct))} max="1" aria-label={`${next.title} progress`}/>}
      </button>;
    })}
  </section>;
}

export function ServiceStrip({ stats }) {
  return <div className="wl-service-strip" aria-label="Public service outcomes">
    {['healthcare','education','foodSecurity','inequality'].map(k => {
      const state = ss(k,stats[k]);
      const tone = state === 'critical' ? c.accent.alert : state === 'warning' ? c.accent.warn : c.accent.good;
      return <div key={k}><span>{SC[k].label}</span><b style={{color:tone}}>{Math.round(stats[k])}<small>/100</small></b><meter style={{'--meter-tone':tone}} min="0" max="100" value={stats[k]} aria-label={SC[k].label}/>{k==='inequality'&&<small>Lower is better</small>}</div>;
    })}
  </div>;
}

export function EnergySummary({ tier, spr, releasing, imports, disruptions, routeIds, chokeStatus, onMap, onResources }) {
  return <section className="wl-energy-summary" data-energy-summary>
    <div className="wl-workspace-title"><div><span className="wl-eyebrow">National infrastructure</span><h2>Energy & supply</h2><p>Secure supply routes. Build capacity. Keep reserves ready.</p></div><button className="wl-btn" data-energy-map onClick={onMap}>ϟ View supply map ↗</button></div>
    <div className="wl-energy-metrics">
      <button onClick={onResources}><small>Power tier</small><b>{tier}</b><span>Manage generation →</span></button>
      <div><small>Strategic reserve</small><b>{spr}/6 <em>{releasing ? 'Releasing' : 'Stored'}</em></b><progress value={spr} max="6" aria-label="Strategic reserve"/></div>
      <div><small>Import contracts</small><b>{imports}</b><span>Resources contracted</span></div>
      <button onClick={onMap}><small>Transit disruptions</small><b style={{color:disruptions ? c.accent.alert : c.accent.good}}>{disruptions}</b><span>{disruptions ? 'Inspect routes →' : 'Your transit routes are open'}</span></button>
    </div>
    <div className="wl-supply-routes" aria-label="Import transit routes">
      <span className="wl-eyebrow">Your supply routes</span>
      {routeIds.map(id => {const cp=CHOKEPOINTS[id],status=chokeStatus[id]||'open';return <button key={id} data-supply-route={id} onClick={() => onMap(cp.region)} style={{'--tone':c.choke[status]}}><span className="wl-route-dot"/><b>{cp.n}</b><small>{status}</small><span>↗</span></button>;})}
      {!routeIds.length && <span>No transit chokepoints for your home region.</span>}
    </div>
  </section>;
}

export const WORKSPACE_CSS = `
.wl-national-pulse{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;flex-shrink:0}
.wl-national-pulse>button,.wl-queue-deck>button,.wl-energy-metrics>*{min-width:0;text-align:left;color:${c.text.primary};border:1px solid ${c.border.base};border-radius:8px;background:${SURFACE.L1};padding:10px 12px;font:inherit}
.wl-national-pulse>button{border-top:2px solid var(--tone)}
.wl-national-pulse button:hover,.wl-queue-deck button:hover,.wl-energy-metrics button:hover{border-color:${c.accent.command};background:${SURFACE.L2}}
.wl-pulse-label,.wl-queue-label{display:flex;align-items:center;gap:6px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:${c.text.muted}}
.wl-pulse-label i{font-style:normal;color:var(--tone);font-size:16px}.wl-pulse-label>span{margin-left:auto;color:${c.text.dim}}
.wl-pulse-value{display:flex;align-items:baseline;gap:8px;margin:4px 0;color:var(--tone);font:600 23px ${FONT.display};text-transform:capitalize}
.wl-pulse-value small{font:10px ${FONT.sans};text-transform:none;color:${c.text.muted}}
.wl-pulse-detail{display:block;font-size:11px;color:${c.text.muted};line-height:1.4}
.wl-queue-deck{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;flex-shrink:0}
.wl-queue-deck>button{position:relative;min-height:86px;padding-bottom:14px;overflow:hidden}
.wl-queue-label{color:var(--tone)}.wl-queue-label small{margin-left:auto;color:${c.text.dim};font:10px ${FONT.mono};text-transform:none;letter-spacing:0}
.wl-queue-deck b{display:block;margin:6px 0 4px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wl-queue-time{font-size:11px;color:${c.text.muted}}
.wl-queue-deck progress{position:absolute;bottom:0;left:0;width:100%;height:4px;accent-color:var(--tone)}
.wl-energy-metrics progress{width:100%;height:5px;margin-top:8px;accent-color:${c.system.energy}}
.wl-workspace-title{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}.wl-workspace-title h2{font:600 28px ${FONT.display};color:${c.text.primary};margin:4px 0}.wl-workspace-title p{font-size:12px;color:${c.text.muted};margin:0;line-height:1.5}.wl-eyebrow{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:${c.text.dim}}
.wl-energy-summary{margin-bottom:18px}.wl-energy-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.wl-energy-metrics small,.wl-energy-metrics span{display:block;color:${c.text.muted};font-size:11px}.wl-energy-metrics b{display:block;font:600 25px ${FONT.display};text-transform:capitalize;margin:8px 0;color:${c.system.energy}}.wl-energy-metrics em{font:11px ${FONT.sans};color:${c.text.dim};font-style:normal}
.wl-economy-main>[data-sector-budgets]{background:${SURFACE.L1};border:1px solid ${c.border.base};border-radius:10px;padding:14px}
.wl-policy-panel input[type=range]{min-height:32px}.wl-policy-panel button{min-height:40px}
.wl-service-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px;padding-bottom:14px}
.wl-service-strip>div{padding:10px 12px;border:1px solid ${c.border.base};border-radius:8px;background:${SURFACE.L1}}.wl-service-strip span{font-size:11px;color:${c.text.muted}}.wl-service-strip b{display:block;font:600 22px ${FONT.display};margin:4px 0}.wl-service-strip small{font:10px ${FONT.mono};color:${c.text.dim};margin-left:4px}.wl-service-strip meter{width:100%;height:4px}.wl-service-strip meter::-webkit-meter-bar{background:${c.border.base};border:0}.wl-service-strip meter::-webkit-meter-optimum-value{background:var(--meter-tone)}
.wl-supply-routes{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:14px 0 0}.wl-supply-routes>button{display:flex;align-items:center;gap:8px;min-height:44px;padding:8px 12px;background:${SURFACE.L1};border:1px solid ${c.border.strong};border-radius:6px;color:${c.text.primary};font:12px ${FONT.sans}}.wl-supply-routes small{color:var(--tone);text-transform:uppercase;font-size:10px}.wl-route-dot{width:7px;height:7px;border-radius:50%;background:var(--tone)}
.wl-alloc-line [data-lock]{min-width:48px;font-size:10px}.wl-nav button>span:first-child{display:flex;align-items:center;justify-content:center}
.wl-economy-heading{padding:14px 14px 0;flex-shrink:0}.wl-economy-heading .wl-workspace-title{margin-bottom:0}
.wl-energy-help{font-size:11px;color:${c.text.muted};margin:12px 0}.wl-energy-help summary{cursor:pointer;min-height:32px;padding:8px 0}
.wl-energy-details{margin-top:12px;border:1px solid ${c.border.base};border-radius:8px;padding:0 12px;background:${c.bg.panelDeep}}.wl-energy-details>summary{cursor:pointer;min-height:48px;padding:15px 0;color:${c.text.primary};font-size:13px;font-weight:600}.wl-energy-details>summary span{float:right;color:${c.text.muted};font-size:11px;font-weight:400}.wl-energy-details[open]{padding-bottom:14px}.wl-energy-details button{min-height:40px}
.wl-energy-production{display:grid;grid-template-columns:minmax(200px,1fr) minmax(0,2fr);gap:20px;margin:12px 0}.wl-energy-production>div{margin:0!important;border:1px solid ${c.border.base}!important;border-radius:8px;padding:14px!important;background:${SURFACE.L1}}.wl-reserve-controls{display:flex;align-items:center;align-content:start;gap:8px;flex-wrap:wrap}.wl-reserve-controls>span{width:100%;font-size:13px!important;margin-bottom:10px}.wl-reserve-controls button{min-height:44px;padding:8px 12px!important;font-size:12px!important}.wl-energy-production input[type=range]{min-height:32px}
@media(max-width:899px){.wl-energy-production{grid-template-columns:minmax(0,1fr)}.wl-energy-details>summary span{float:none;display:block;margin-top:5px}}
@media(min-width:1100px){
 .wl-app{grid-template-columns:168px minmax(0,1fr) 264px}
 .wl-ov-col{grid-template-rows:auto minmax(0,1fr) auto;gap:10px!important}
 .wl-ov-col>.wl-national-pulse{order:0}.wl-ov-col>.wl-map-card{order:1}.wl-ov-col>.wl-queue-deck{order:2}
 .wl-economy-layout{display:grid!important;grid-template-columns:minmax(0,1fr) 250px;min-height:0}
 .wl-economy-main{order:0;min-width:0}.wl-policy-panel{order:1;width:auto!important;border-right:0!important;border-left:1px solid ${c.border.base}}
 .wl-alloc-row{flex-wrap:wrap}.wl-alloc-name{flex-basis:100px}.wl-alloc-eff{min-width:65px}
}
@media(min-width:1600px){.wl-app{grid-template-columns:184px minmax(0,1fr) 290px}.wl-economy-layout{grid-template-columns:minmax(0,1fr) 290px}}
@media(max-width:899px){
 .wl-economy-layout{display:flex!important;flex-direction:column!important;overflow:visible!important;width:100%}
 .wl-economy-layout>div{width:100%!important;flex:none!important;overflow:visible!important}
 .wl-economy-main{order:0}.wl-policy-panel{order:1;border-right:0!important}
 .wl-alloc-row{flex-wrap:wrap}.wl-alloc-name{flex-basis:90px}.wl-alloc-line [data-delta]{font-size:9px}
}
@media(max-width:1099px){.wl-ov-col>.wl-map-card{order:-1}.wl-national-pulse{grid-template-columns:repeat(2,minmax(0,1fr))}.wl-pulse-value{font-size:22px}.wl-queue-deck{grid-template-columns:1fr}.wl-energy-metrics,.wl-service-strip{grid-template-columns:repeat(2,minmax(0,1fr))}.wl-workspace-title{align-items:flex-start;flex-direction:column}}
`;
