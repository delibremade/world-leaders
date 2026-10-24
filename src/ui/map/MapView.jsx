// The map is the interface (PLAYABLE-PLAN UI principle 1; v2 §3). Reads a view of game state, builds the scene once,
// and hands it to the 2.5D PixiJS renderer (WebGL) or the flat SVG fallback. Chrome is DOM so it stays accessible
// and testable: level chip top-left, zoom top-right, legend bottom-left, map-mode dock bottom-right with keys Q to U.
// Zero game logic here: taps bubble up as region ids; actions live in App/actions.js.
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildScene, MAP_MODES, MODE_KEYS } from './scene.js';
import { SvgMap } from './SvgMap.jsx';
import { LOD, lodFor } from './lod.js';
import { COLOR } from '../tokens.js';
import { useWide } from '../shell/useWide.js';
import { Operations } from './Operations.jsx';
import { SITES } from '../../data/bases.js';
import { CHOKEPOINTS } from '../../data/chokepoints.js';
import { Sheet } from '../shell/Sheet.jsx';
import {EconomicInspector} from './EconomicInspector.jsx';
import {ECONOMIC_HUBS,ECONOMIC_SECTORS,economicHubs} from '../../data/economic-hubs.js';

// jsdom has no WebGL2RenderingContext; the SVG renderer keeps the gate and old devices covered.
export const webglAvailable = () => {
  try { return typeof WebGL2RenderingContext !== 'undefined' && !globalThis.__WL_FORCE_SVG; } catch { return false; }
};

const hatchBg = `repeating-linear-gradient(45deg, ${COLOR.text.muted}55 0 1px, transparent 1px 4px)`;
const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable;

const focusSelection=(m,p)=>{if(!p)return;if(p.kind==='site')m.focusSite(p.id);else if(p.kind==='region')m.focus(p.id);else if(p.kind==='choke')m.focusPoint(CHOKEPOINTS[p.id]);else if(p.kind==='hub')m.focusPoint(ECONOMIC_HUBS[p.id]);else if(p.kind==='economy')m.focusEconomy();};

export function MapView({ view, mode = 'sphere', onModeChange, onRegionTap, onSiteTap, onBuildToggle, onMap, selectionRequest, game, dispatch, ask, onNation, onJump, allocation, height = 'clamp(240px, 58vw, 520px)' }) {
  const wide = useWide();
  const economy=mode==='economy';
  const [economicSector,setEconomicSector]=useState('all');
  const [selection,setSelection]=useState(selectionRequest||null), [previewType,setPreviewType]=useState(null);
  const pendingFocus=useRef(selectionRequest||null);
  const inspect=(sel)=>{setSelection(sel);setPreviewType(sel?.kind==='site'?(view.bases?.nodes.find(n=>n.site===sel.id&&n.owner===view.country?.id)?.type||SITES[sel.id]?.types[0]):null);pendingFocus.current=sel;};
  const select=(kind,id)=>{if(economy&&kind==='region'){inspect({kind:'hubList'});return;}if(!id){if(wide)inspect(null);return;}if(wide&&game)inspect({kind,id});else if(kind==='site')onSiteTap?.(id);else if(kind==='region')onRegionTap?.(id);else inspect({kind,id});};
  const scene = useMemo(() => buildScene({...view,selectedRegion:selection?.kind==='region'?selection.id:view.selectedRegion,selectedSite:selection?.kind==='site'?selection.id:view.selectedSite,selectedHub:selection?.kind==='hub'?selection.id:null,economicSector,previewType}, mode), [view, mode, selection, previewType,economicSector]);
  useEffect(()=>{inspect(selectionRequest||null);},[selectionRequest]);
  useEffect(()=>{if(economy){inspect(null);pendingFocus.current={kind:'economy'};}else if(selection?.kind?.startsWith('hub'))inspect(null);},[mode]);
  const chooseSector=k=>{setEconomicSector(k);if(selection?.kind==='hub'&&k!=='all'&&!ECONOMIC_HUBS[selection.id].sectors.includes(k))inspect(null);else if(selection?.kind==='hubCluster')inspect(null);pendingFocus.current={kind:'economy'};};
  const selectRef=useRef(select);selectRef.current=select;
  const inspectRef=useRef(inspect);inspectRef.current=inspect;
  const key = JSON.stringify(scene);
  const host = useRef(null); const map = useRef(null); const latest = useRef(scene); latest.current = scene;
  const tapRef = useRef(onRegionTap); tapRef.current = onRegionTap;
  const siteRef = useRef(onSiteTap); siteRef.current = onSiteTap;
  const modeRef = useRef(onModeChange); modeRef.current = onModeChange;
  const onMapRef = useRef(onMap); onMapRef.current = onMap; // FIX 2: hands the live renderer to the App so an outliner row can pan the map
  const [renderer, setRenderer] = useState(() => (webglAvailable() ? 'pixi' : 'svg'));
  const [level, setLevel] = useState('strategic');
  // On-device fps readout for manual capture on the owner's phone: open the build with #fps in the URL.
  const [fps, setFps] = useState(null);
  const wantFps = typeof location !== 'undefined' && /fps/.test(location.hash + location.search);

  useEffect(() => {
    if (renderer !== 'pixi' || !host.current) return;
    let alive = true; let lastLevel = 'strategic';
    import('./pixi-map.js').then(({ createPixiMap }) => createPixiMap(host.current, {
      onTap: (rid) => selectRef.current('region',rid), onSiteTap: (sid) => selectRef.current('site',sid), onChokeTap: id=>selectRef.current('choke',id), onClusterTap: ids=>inspectRef.current({kind:'cluster',ids}), onHubTap:id=>inspectRef.current({kind:'hub',id}),onHubClusterTap:ids=>inspectRef.current({kind:'hubCluster',ids}),
      onViewChange: (scale) => { const l = lodFor(scale).id; if (l !== lastLevel) { lastLevel = l; setLevel(l); } },
    }))
      .then((m) => { if (!alive) { m.destroy(); return; } map.current = m; m.update(latest.current); onMapRef.current?.(m); focusSelection(m,pendingFocus.current);pendingFocus.current=null; if (globalThis.__WL_TEST) globalThis.__wlMap = { renderer: 'pixi', app: m.app, viewport: m.viewport, fps: m.fps, frames: m.frames, pan: m.pan, zoom: m.zoom, zoomBy: m.zoomBy, fit: m.fit, scale: m.scale, level: m.level, layers: m.layers, tilt: m.tilt, projection: m.projection, relativeZoom: m.relativeZoom, screenPoint: m.screenPoint, visibleSites: m.visibleSites, visibleHubs:m.visibleHubs, inspect: sel=>inspectRef.current(sel), focus: m.focus, focusSite: m.focusSite, scene: () => latest.current, tapRegion: (rid) => tapRef.current?.(rid), tapSite: (sid) => siteRef.current?.(sid) }; })
      .catch((e) => { console.error('pixi map unavailable, falling back to SVG', e); if (alive) setRenderer('svg'); });
    return () => { alive = false; map.current?.destroy(); map.current = null; onMapRef.current?.(null); if (globalThis.__wlMap?.renderer === 'pixi') delete globalThis.__wlMap; };
  }, [renderer]);
  useEffect(() => { map.current?.update(scene); const sel=pendingFocus.current; if(map.current&&sel){focusSelection(map.current,sel);pendingFocus.current=null;} }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!wantFps || renderer !== 'pixi') return; const id = setInterval(() => setFps(map.current?.fps() ?? null), 1000); return () => clearInterval(id); }, [wantFps, renderer]);
  useEffect(() => { if (globalThis.__WL_TEST && renderer === 'svg') globalThis.__wlMap = { renderer: 'svg', level: () => 'strategic', inspect: sel=>inspectRef.current(sel), scene: () => latest.current, tapRegion: (rid) => tapRef.current?.(rid), tapSite: (sid) => siteRef.current?.(sid) }; }, [renderer, key]); // eslint-disable-line react-hooks/exhaustive-deps
  // Map-mode hotkeys (v2 §1 rule 2): Q W E R T Y U while the map is on screen; never while typing, never with a modifier.
  useEffect(() => {
    const onKey = (e) => { if(e.key==='Escape'&&!document.querySelector('[role=dialog]')){inspectRef.current(null);return;} if (document.querySelector('[role=dialog]') || e.metaKey || e.ctrlKey || e.altKey || typing(e)) return; const i = MODE_KEYS.indexOf(e.key.toUpperCase()); if (i < 0 || !MAP_MODES[i]) return; e.preventDefault(); modeRef.current?.(MAP_MODES[i].id); };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, []);

  const { legend } = scene; const lod = LOD.find((l) => l.id === level) || LOD[0];
  const zoomBy = (f) => map.current?.zoomBy?.(f); const fit = () => economy?map.current?.focusEconomy?.():map.current?.fit?.();
  const economicInspector=<EconomicInspector g={game||view} selection={selection} sector={economicSector} onSector={chooseSector} onSelect={inspect} onClose={()=>inspect(null)} onJump={route=>{inspect(null);onJump?.(route);}} dispatch={dispatch} allocation={allocation}/>;
  return (
    <div className="wl-mv" data-map data-map-mode={mode} data-map-renderer={renderer} data-map-level={level}>
      {economy&&<div className="wl-economy-map-bar" data-economic-layer><label>Sector<select aria-label="Economic sector" value={economicSector} onChange={e=>chooseSector(e.target.value)}><option value="all">All sectors</option>{Object.entries(ECONOMIC_SECTORS).map(([k,s])=><option key={k} value={k}>{s.name}</option>)}</select></label><span>{view.country?.name} · {economicHubs(view.country?.id,economicSector).length} hubs</span><button className="wl-btn" data-browse-hubs onClick={()=>inspect({kind:'hubList'})}>Browse cities</button></div>}
      <div className="wl-atlas-workspace"><div className="wl-mv-stage" style={{ position: 'relative' }}>
        {renderer === 'pixi'
          ? <div ref={host} className="wl-mv-host" style={{ height, borderRadius: 6, overflow: 'hidden', background: COLOR.bg.ocean, touchAction: 'none' }} />
          : <SvgMap scene={scene} onRegionTap={(rid) => select('region',rid)} onSiteTap={(sid) => select('site',sid)} onChokeTap={id=>select('choke',id)} onHubTap={id=>inspect({kind:'hub',id})} />}
        <div className="wl-mv-lod wl-chip" data-map-lod={level} title={`Zoom level: ${lod.label}. ${lod.layers.join(', ')}`}>{lod.label}</div>
        <div className="wl-mv-zoom" data-map-zoom role="group" aria-label="Zoom">
          <button type="button" aria-label="Zoom in" title="Zoom in" disabled={renderer !== 'pixi'} onClick={() => zoomBy(1.5)}>+</button>
          <button type="button" aria-label="Zoom out" title="Zoom out" disabled={renderer !== 'pixi'} onClick={() => zoomBy(1 / 1.5)}>−</button>
          <button type="button" aria-label={economy?'Fit economic hubs':'Fit the world'} title={economy?'Fit economic hubs':'Fit the world'} disabled={renderer !== 'pixi'} onClick={fit}>⌂</button>
          {/* F9b (#57): the build toggle sits with the zoom controls. On, every candidate site is a tappable marker. */}
          {!economy&&onBuildToggle && <button type="button" className={`wl-btn${scene.build ? ' wl-btn-good' : ''}`} data-build-toggle aria-pressed={!!scene.build} onClick={() => onBuildToggle(!scene.build)} title="Build: show every candidate site; tap one to place a base">🏗️ {scene.build ? 'Building' : 'Build'}</button>}
        </div>
        <div className="wl-mv-legend" data-map-legend>
          <span className="wl-label">{legend.title}</span>
          {legend.items.map(([c, l]) => <span key={l} className="wl-mv-legend-i"><span className="wl-mv-swatch" style={{ background: c === 'hatch' ? hatchBg : c + '8c', borderColor: c === 'hatch' ? COLOR.text.dim : c }} />{l}</span>)}
          <span className="wl-mv-glyphs">{legend.glyphs}</span>
          {fps != null && <span className="wl-chip wl-chip-command" data-map-fps>{fps.toFixed(0)} fps · {renderer}</span>}
        </div>
        <div className="wl-mv-dock" role="tablist" aria-label="Map mode" data-map-modes>
          {MAP_MODES.map((m, i) => { const on = m.id === mode; return (
            <button key={m.id} role="tab" aria-selected={on} data-map-mode-btn={m.id} data-key={MODE_KEYS[i]} onClick={() => onModeChange?.(m.id)} title={`${m.hint} (${MODE_KEYS[i]})`}>
              <span aria-hidden="true" className="wl-mv-dock-i">{m.icon}</span><span className="wl-mv-dock-l">{m.label} <kbd>{MODE_KEYS[i]}</kbd></span>
            </button>); })}
        </div>
      </div>
      {wide&&game&&(economy?economicInspector:<Operations mode={mode} g={game} selection={selection} previewType={previewType} onPreview={setPreviewType} onSelect={inspect} onClose={()=>inspect(null)} onDetails={(kind,id)=>kind==='site'?onSiteTap?.(id):onRegionTap?.(id)} onNation={onNation} onJump={onJump} dispatch={dispatch} ask={ask} build={scene.build}/>)} </div>
      {!wide&&game&&<Sheet open={!!selection} onClose={()=>inspect(null)} title={economy?'Civilian economy':selection?.kind==='choke'?CHOKEPOINTS[selection.id]?.n:'Map selection'}>{economy?economicInspector:<Operations mode={mode} g={game} selection={selection} previewType={previewType} onPreview={setPreviewType} onSelect={sel=>sel.kind==='site'?(inspect(null),onSiteTap?.(sel.id)):inspect(sel)} onClose={()=>inspect(null)} onDetails={(kind,id)=>{inspect(null);kind==='site'?onSiteTap?.(id):onRegionTap?.(id);}} onNation={id=>{inspect(null);onNation?.(id);}} onJump={route=>{inspect(null);onJump?.(route);}} dispatch={dispatch} ask={ask} build={scene.build}/>}</Sheet>}
      <div className="wl-mv-hint">{MAP_MODES.find((m) => m.id === mode)?.hint}</div>
    </div>
  );
}
