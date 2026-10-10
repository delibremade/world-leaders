// The map is the interface (PLAYABLE-PLAN UI principle 1). Reads a view of game state, builds the scene once,
// and hands it to the PixiJS renderer (WebGL) or the SVG fallback. Mode chips and legend are DOM so they stay
// accessible and testable. Zero game logic here: taps bubble up as region ids; actions live in App/actions.js.
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildScene, MAP_MODES } from './scene.js';
import { SvgMap } from './SvgMap.jsx';
import { COLOR, SIZE, SPACE, RADIUS, TAP } from '../tokens.js';

// jsdom has no WebGL2RenderingContext; the SVG renderer keeps the gate and old devices covered.
export const webglAvailable = () => {
  try { return typeof WebGL2RenderingContext !== 'undefined' && !globalThis.__WL_FORCE_SVG; } catch { return false; }
};

const hatchBg = `repeating-linear-gradient(45deg, ${COLOR.text.muted}55 0 1px, transparent 1px 4px)`;

export function MapView({ view, mode = 'sphere', onModeChange, onRegionTap, height = 'clamp(240px, 58vw, 520px)' }) {
  const scene = useMemo(() => buildScene(view, mode), [view, mode]);
  const key = JSON.stringify(scene);
  const host = useRef(null); const map = useRef(null); const latest = useRef(scene); latest.current = scene;
  const tapRef = useRef(onRegionTap); tapRef.current = onRegionTap;
  const [renderer, setRenderer] = useState(() => (webglAvailable() ? 'pixi' : 'svg'));
  // On-device fps readout for manual capture on the owner's phone: open the build with #fps in the URL.
  const [fps, setFps] = useState(null);
  const wantFps = typeof location !== 'undefined' && /fps/.test(location.hash + location.search);

  useEffect(() => {
    if (renderer !== 'pixi' || !host.current) return;
    let alive = true;
    import('./pixi-map.js').then(({ createPixiMap }) => createPixiMap(host.current, { onTap: (rid) => rid && tapRef.current?.(rid) }))
      .then((m) => { if (!alive) { m.destroy(); return; } map.current = m; m.update(latest.current); if (globalThis.__WL_TEST) globalThis.__wlMap = { renderer: 'pixi', fps: m.fps, frames: m.frames, pan: m.pan, zoom: m.zoom, scale: m.scale, focus: m.focus, scene: () => latest.current }; })
      .catch((e) => { console.error('pixi map unavailable, falling back to SVG', e); if (alive) setRenderer('svg'); });
    return () => { alive = false; map.current?.destroy(); map.current = null; if (globalThis.__wlMap?.renderer === 'pixi') delete globalThis.__wlMap; };
  }, [renderer]);
  useEffect(() => { map.current?.update(scene); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!wantFps || renderer !== 'pixi') return; const id = setInterval(() => setFps(map.current?.fps() ?? null), 1000); return () => clearInterval(id); }, [wantFps, renderer]);
  useEffect(() => { if (globalThis.__WL_TEST && renderer === 'svg') globalThis.__wlMap = { renderer: 'svg', scene: () => latest.current }; }, [renderer, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const { legend } = scene;
  return (
    <div data-map data-map-mode={mode} data-map-renderer={renderer}>
      <div role="tablist" aria-label="Map mode" style={{ display: 'flex', gap: SPACE[2], overflowX: 'auto', paddingBottom: SPACE[3], marginBottom: SPACE[3], scrollbarWidth: 'none' }}>
        {MAP_MODES.map((m) => { const on = m.id === mode; return (
          <button key={m.id} role="tab" aria-selected={on} data-map-mode-btn={m.id} onClick={() => onModeChange?.(m.id)} title={m.hint}
            style={{ minHeight: TAP, flexShrink: 0, padding: `0 ${SPACE[6]}px`, borderRadius: RADIUS.lg, border: `1px solid ${on ? COLOR.accent.command : COLOR.border.strong}`, background: on ? 'rgba(59,130,246,.16)' : 'transparent', color: on ? COLOR.text.primary : COLOR.text.muted, fontSize: SIZE.small, fontWeight: on ? 700 : 500, display: 'inline-flex', alignItems: 'center', gap: SPACE[2] }}>
            <span aria-hidden="true">{m.icon}</span>{m.label}
          </button>); })}
      </div>
      {renderer === 'pixi'
        ? <div ref={host} style={{ height, borderRadius: RADIUS.lg, overflow: 'hidden', background: COLOR.bg.ocean, touchAction: 'none' }} />
        : <SvgMap scene={scene} onRegionTap={(rid) => onRegionTap?.(rid)} />}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: `${SPACE[2]}px ${SPACE[5]}px`, marginTop: SPACE[4], fontSize: SIZE.micro, color: COLOR.text.muted }} data-map-legend>
        <span className="wl-label" style={{ fontSize: SIZE.micro, fontWeight: 700 }}>{legend.title}</span>
        {legend.items.map(([c, l]) => <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: SPACE[2] }}><span style={{ width: 11, height: 11, borderRadius: 2, background: c === 'hatch' ? hatchBg : c + '8c', border: `1px solid ${c === 'hatch' ? COLOR.text.dim : c}` }} />{l}</span>)}
        <span style={{ color: COLOR.text.dim, flexBasis: '100%' }}>{legend.glyphs}</span>
        {fps != null && <span className="wl-chip wl-chip-command" data-map-fps>{fps.toFixed(0)} fps · {renderer}</span>}
      </div>
      <div style={{ fontSize: SIZE.caption, color: COLOR.text.dim, marginTop: SPACE[2] }}>{MAP_MODES.find((m) => m.id === mode)?.hint}</div>
    </div>
  );
}
