// SVG renderer for the map scene: the fallback when WebGL is unavailable (jsdom gate, old devices).
// Same scene as the PixiJS renderer, so overlays exist exactly once (scene.js). DOM contract kept from v57 for
// the parity click script: each region is a <g> whose first <text> is the region name; the flashpoint marker
// is a <text> ending in ⚠ inside that <g>.
import { COLOR } from '../tokens.js';
import { symbolPath } from './symbols.js';
import { visibleLayers } from './layout.js';
import {economicBounds} from '../../data/economic-hubs.js';

export function SvgMap({ scene, onRegionTap, onSiteTap, onChokeTap, onHubTap, style }) {
  const { regions, routes, influence, chokepoints, sites = [], rings = [] } = scene;
  const layers=visibleLayers(scene.mode),economy=scene.mode==='economy';
  const bounds=economicBounds(scene.hubs||[]),glyphScale=economy?bounds.w/700:1;
  const keyTap=(e,fn)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn();}};
  return (
    <svg viewBox={economy?`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`:'0 0 1000 520'} style={{ width: '100%', borderRadius: '6px', display: 'block', ...style }} data-map-renderer="svg" data-map-mode={scene.mode}>
      <defs>
        <pattern id="contestedHatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke={COLOR.text.muted} strokeWidth="1.6" strokeOpacity="0.3" />
        </pattern>
        <filter id="landGlow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.5" stdDeviation="3" floodColor="#000" floodOpacity="0.55" /></filter>
        <radialGradient id="oceanGrad" cx="50%" cy="38%" r="85%"><stop offset="0%" stopColor={COLOR.bg.oceanHi} /><stop offset="100%" stopColor={COLOR.bg.ocean} /></radialGradient>
      </defs>
      <rect x="0" y="0" width="1000" height="520" fill="url(#oceanGrad)" />
      {[...Array(9)].map((_, i) => <line key={'gv' + i} x1={(i + 1) * 100} y1="0" x2={(i + 1) * 100} y2="520" stroke={COLOR.bg.inset} strokeOpacity="0.22" strokeWidth="0.6" />)}
      {[...Array(4)].map((_, i) => <line key={'gh' + i} x1="0" y1={(i + 1) * 104} x2="1000" y2={(i + 1) * 104} stroke={COLOR.bg.inset} strokeOpacity="0.22" strokeWidth="0.6" />)}
      {regions.map((r) => (
        <g key={r.rid} role="button" tabIndex="0" aria-label={`Inspect ${r.name}`} onKeyDown={e=>keyTap(e,()=>onRegionTap(r.rid))} onClick={() => onRegionTap(r.rid)} style={{ cursor: 'pointer' }} data-region={r.rid}>
          <path d={r.d} className="region-path" filter="url(#landGlow)" fill={r.fill} fillOpacity={r.fillAlpha} stroke={r.stroke} strokeOpacity={r.selected ? 0.95 : 0.55} strokeWidth={r.selected ? 1.8 : 0.9} />
          {r.hatch && <path d={r.d} fill="url(#contestedHatch)" stroke="none" pointerEvents="none" />}
          {!economy&&<><text x={r.cx} y={r.cy - 8} textAnchor="middle" fill={COLOR.text.secondary} fontSize="11.5" fontWeight="600" pointerEvents="none">{r.name}</text>
          <text x={r.cx} y={r.cy + 7} textAnchor="middle" fill={r.line2Color} fontSize="10" fontWeight="800" pointerEvents="none">{r.line2}</text>
          {r.line3 && <text x={r.cx} y={r.cy + 19} textAnchor="middle" fill={COLOR.text.muted} fontSize="8" pointerEvents="none">{r.line3}</text>}
          {r.deployed > 0 && <g pointerEvents="none"><rect x={r.cx - 16} y={r.cy + 23} width="32" height="13" rx="3" fill={COLOR.bg.panel} stroke={COLOR.accent.command} strokeWidth="0.7" /><text x={r.cx} y={r.cy + 33} textAnchor="middle" fill={COLOR.accent.commandHi} fontSize="8.5" fontWeight="700">⚓ {r.deployed}</text></g>}
          {r.flashpoint && <text x={r.cx} y={r.cy - 24} textAnchor="middle" fontSize="14" pointerEvents="none" className="wl-pulse">{r.flashpoint.icon}⚠</text>}
          {r.flashpoint && <text x={r.cx + 14} y={r.cy - 24} fill={COLOR.accent.alert} fontSize="8" fontWeight="800" pointerEvents="none">{r.flashpoint.t}mo</text>}
          {r.trend !== 0 && <text x={r.cx + 38} y={r.cy + 7} fill={r.trend > 0 ? COLOR.accent.good : COLOR.accent.alert} fontSize="9.5" fontWeight="800" pointerEvents="none">{r.trend > 0 ? '▲' : '▼'}{Math.abs(r.trend)}</text>}
          {r.intel && <circle cx={r.cx - 38} cy={r.cy - 12} r="3.2" fill={COLOR.accent.intel} fillOpacity="0.9" pointerEvents="none" />}
          </>}
        </g>
      ))}
      {(layers.routes?routes:[]).map((l) => <line key={`tr_${l.id||l.rid}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.color} strokeWidth="1.2" strokeOpacity="0.5" strokeDasharray="6,5" style={{ animation: 'wl-dash 1.1s linear infinite' }} pointerEvents="none" />)}
      {(layers.influence?influence:[]).map((l) => <line key={`inf_${l.rid}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.color} strokeWidth={l.width} strokeOpacity={l.alpha} strokeDasharray="2,4" pointerEvents="none" />)}
      {/* F9b: reach rings of the selected site (no zoom in the fallback), then one marker per site */}
      {rings.filter((r) => sites.find((s) => s.id === r.site)?.selected).map((r, i) => <circle key={`ring_${r.site}_${i}`} cx={r.x} cy={r.y} r={r.r} fill={r.color} fillOpacity={r.mine ? 0.06 : 0} stroke={r.color} strokeWidth={r.mine ? 1.2 : 0.7} strokeOpacity={r.mine ? 0.75 : 0.35} pointerEvents="none" data-ring={r.site} />)}
      {(layers.sites||scene.build?sites:sites.filter(s=>s.selected)).map((s) => <g key={s.id} role="button" tabIndex="0" aria-label={s.name} data-site={s.id} data-candidate={s.candidate ? 'true' : undefined} onKeyDown={e=>keyTap(e,()=>onSiteTap?.(s.id))} onClick={e=>{e.stopPropagation();onSiteTap?.(s.id);}} style={{cursor:'pointer'}}>
        <rect x={s.x-14} y={s.y-14} width="28" height="28" rx="4" fill={COLOR.bg.panel} stroke={s.selected?COLOR.text.primary:s.building?COLOR.accent.warn:s.color} strokeWidth={s.selected?2:1}/>
        <path d={symbolPath(s.type)} transform={`translate(${s.x} ${s.y}) scale(.75)`} fill={s.candidate?COLOR.accent.good:s.color}/>
        {s.mine+s.theirs>1&&<text x={s.x+11} y={s.y-9} fontSize="9" fill={COLOR.text.primary}>{s.mine+s.theirs}</text>}
      </g>)}
      {economy&&(scene.hubs||[]).map(h=><g key={h.id} data-economic-hub={h.id} role="button" tabIndex="0" aria-label={`Inspect ${h.name}`} transform={`translate(${h.x} ${h.y}) scale(${glyphScale})`} onClick={()=>onHubTap?.(h.id)} onKeyDown={e=>keyTap(e,()=>onHubTap?.(h.id))} style={{cursor:'pointer'}}><title>{h.name} · {h.role}</title><rect x="-13" y="-13" width="26" height="26" rx="3" fill="#0b202b" stroke={h.selected?'#fff':h.color} strokeWidth={h.selected?2:1}/><path d="M-8 8V-2H-3V-8H3V1H8V8Z" fill={h.color}/><text y="25" textAnchor="middle" fontSize="11" fill="#d9f3e8">{h.name}</text></g>)}
      {(layers.chokepoints?chokepoints:[]).map(c=><g key={c.k} role="button" tabIndex="0" aria-label={c.name} onKeyDown={e=>keyTap(e,()=>onChokeTap?.(c.k))} onClick={()=>onChokeTap?.(c.k)} style={{cursor:'pointer'}}><path d={`M${c.x} ${c.y-8}l8 8-8 8-8-8Z`} fill={c.color} stroke={COLOR.bg.surface} strokeWidth="1.5"/></g>)}

    </svg>
  );
}
