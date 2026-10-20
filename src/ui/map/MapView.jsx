// The map is the interface (PLAYABLE-PLAN UI principle 1; v2 §3). Reads a view of game state, builds the scene once,
// and hands it to the 2.5D PixiJS renderer (WebGL) or the flat SVG fallback. Chrome is DOM so it stays accessible
// and testable: level chip top-left, zoom top-right, legend bottom-left, map-mode dock bottom-right with keys Q to Y.
// Zero game logic here: taps bubble up as region ids; actions live in App/actions.js.
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildScene, MAP_MODES, MODE_KEYS } from './scene.js';
import { SvgMap } from './SvgMap.jsx';
import { LOD, lodFor } from './lod.js';
import { COLOR } from '../tokens.js';

// jsdom has no WebGL2RenderingContext; the SVG renderer keeps the gate and old devices covered.
export const webglAvailable = () => {
  try { return typeof WebGL2RenderingContext !== 'undefined' && !globalThis.__WL_FORCE_SVG; } catch { return false; }
};

const hatchBg = `repeating-linear-gradient(45deg, ${COLOR.text.muted}55 0 1px, transparent 1px 4px)`;
const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable;

export function MapView({ view, mode = 'sphere', onModeChange, onRegionTap, onSiteTap, onBuildToggle, height = 'clamp(240px, 58vw, 520px)' }) {
  const scene = useMemo(() => buildScene(view, mode), [view, mode]);
  const key = JSON.stringify(scene);
  const host = useRef(null); const map = useRef(null); const latest = useRef(scene); latest.current = scene;
  const tapRef = useRef(onRegionTap); tapRef.current = onRegionTap;
  const siteRef = useRef(onSiteTap); siteRef.current = onSiteTap;
  const modeRef = useRef(onModeChange); modeRef.current = onModeChange;
  const [renderer, setRenderer] = useState(() => (webglAvailable() ? 'pixi' : 'svg'));
  const [level, setLevel] = useState('strategic');
  // On-device fps readout for manual capture on the owner's phone: open the build with #fps in the URL.
  const [fps, setFps] = useState(null);
  const wantFps = typeof location !== 'undefined' && /fps/.test(location.hash + location.search);

  useEffect(() => {
    if (renderer !== 'pixi' || !host.current) return;
    let alive = true; let lastLevel = 'strategic';
    import('./pixi-map.js').then(({ createPixiMap }) => createPixiMap(host.current, {
      onTap: (rid) => rid && tapRef.current?.(rid), onSiteTap: (sid) => siteRef.current?.(sid),
      onViewChange: (scale) => { const l = lodFor(scale).id; if (l !== lastLevel) { lastLevel = l; setLevel(l); } },
    }))
      .then((m) => { if (!alive) { m.destroy(); return; } map.current = m; m.update(latest.current); if (globalThis.__WL_TEST) globalThis.__wlMap = { renderer: 'pixi', app: m.app, viewport: m.viewport, fps: m.fps, frames: m.frames, pan: m.pan, zoom: m.zoom, zoomBy: m.zoomBy, fit: m.fit, scale: m.scale, level: m.level, layers: m.layers, tilt: m.tilt, focus: m.focus, focusSite: m.focusSite, scene: () => latest.current, tapRegion: (rid) => tapRef.current?.(rid), tapSite: (sid) => siteRef.current?.(sid) }; })
      .catch((e) => { console.error('pixi map unavailable, falling back to SVG', e); if (alive) setRenderer('svg'); });
    return () => { alive = false; map.current?.destroy(); map.current = null; if (globalThis.__wlMap?.renderer === 'pixi') delete globalThis.__wlMap; };
  }, [renderer]);
  useEffect(() => { map.current?.update(scene); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!wantFps || renderer !== 'pixi') return; const id = setInterval(() => setFps(map.current?.fps() ?? null), 1000); return () => clearInterval(id); }, [wantFps, renderer]);
  useEffect(() => { if (globalThis.__WL_TEST && renderer === 'svg') globalThis.__wlMap = { renderer: 'svg', level: () => 'strategic', scene: () => latest.current, tapRegion: (rid) => tapRef.current?.(rid), tapSite: (sid) => siteRef.current?.(sid) }; }, [renderer, key]); // eslint-disable-line react-hooks/exhaustive-deps
  // Map-mode hotkeys (v2 §1 rule 2): Q W E R T Y while the map is on screen; never while typing, never with a modifier.
  useEffect(() => {
    const onKey = (e) => { if (e.metaKey || e.ctrlKey || e.altKey || typing(e)) return; const i = MODE_KEYS.indexOf(e.key.toUpperCase()); if (i < 0 || !MAP_MODES[i]) return; e.preventDefault(); modeRef.current?.(MAP_MODES[i].id); };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, []);

  const { legend } = scene; const lod = LOD.find((l) => l.id === level) || LOD[0];
  const zoomBy = (f) => map.current?.zoomBy?.(f); const fit = () => map.current?.fit?.();
  return (
    <div className="wl-mv" data-map data-map-mode={mode} data-map-renderer={renderer} data-map-level={level}>
      <div className="wl-mv-stage" style={{ position: 'relative' }}>
        {renderer === 'pixi'
          ? <div ref={host} className="wl-mv-host" style={{ height, borderRadius: 6, overflow: 'hidden', background: COLOR.bg.ocean, touchAction: 'none' }} />
          : <SvgMap scene={scene} onRegionTap={(rid) => onRegionTap?.(rid)} onSiteTap={(sid) => onSiteTap?.(sid)} />}
        <div className="wl-mv-lod wl-chip" data-map-lod={level} title={`Zoom level: ${lod.label}. ${lod.layers.join(', ')}`}>{lod.label}</div>
        <div className="wl-mv-zoom" data-map-zoom role="group" aria-label="Zoom">
          <button type="button" aria-label="Zoom in" title="Zoom in" disabled={renderer !== 'pixi'} onClick={() => zoomBy(1.5)}>+</button>
          <button type="button" aria-label="Zoom out" title="Zoom out" disabled={renderer !== 'pixi'} onClick={() => zoomBy(1 / 1.5)}>−</button>
          <button type="button" aria-label="Fit the world" title="Fit the world" disabled={renderer !== 'pixi'} onClick={fit}>⌂</button>
          {/* F9b (#57): the build toggle sits with the zoom controls. On, every candidate site is a tappable marker. */}
          {onBuildToggle && <button type="button" className={`wl-btn${scene.build ? ' wl-btn-good' : ''}`} data-build-toggle aria-pressed={!!scene.build} onClick={() => onBuildToggle(!scene.build)} title="Build: show every candidate site; tap one to place a base">🏗️ {scene.build ? 'Building' : 'Build'}</button>}
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
      <div className="wl-mv-hint">{MAP_MODES.find((m) => m.id === mode)?.hint}</div>
    </div>
  );
}
