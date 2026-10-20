// PixiJS renderer for the 2.5D situation-room map (docs/DESIGN-SYSTEM-V2.md §3). Browser only; MapView falls back
// to SvgMap without WebGL. pixi.js is imported lazily so the App bundle evaluates in jsdom without touching WebGL.
//
// Two coordinate spaces. `plane` holds everything that lies on the surface (ocean, grid, plates, flat names, reach
// rings, lanes, ground shadows) in the 1000x520 REGION_GEO frame and is tilted by scaling y with TILT. `bill` holds
// the billboards that stand upright (value chips, markers, chokepoint diamonds, flashpoints, base and chokepoint
// names) at (x, y * TILT), counter-scaled so they keep their screen size. Both are children of the pixi-viewport, so
// pan, pinch, wheel and inertia move them together. Natural Earth geography is untouched: plates are REGION_GEO.
// Level of detail comes from lod.js (one table for the renderer, the chip and the tests).
import { REGION_GEO } from '../../data/regions.js';
import { parseRegions, regionAt, WORLD } from './path.js';
import { COLOR, FONT, pixiHex } from '../tokens.js';
import { lodFor, layersAt, nameAlpha } from './lod.js';

export const TILT = 0.72;          // cos of the plane tilt (~44 degrees)
const DEPTH = 8;                   // plate extrusion in screen px at scale 1
const LIFT = 5;                    // the same plate, lifted so its southern wall shows
const WORLD_T = { w: WORLD.w, h: WORLD.h * TILT + DEPTH + LIFT + 6 };
const MAX_SCALE = 6;
const LAND = '#0b1626';            // plate top before the mode tint (v2: never flood land with saturated fill)
const WALL = '#060d18';
const EDGE_DEFAULT = 0x7fd8ff;     // rgba(127,216,255,.55): the default plate edge glow
const DIAMOND = '#f5c451';         // chokepoints are raised gold diamonds

const parsed = parseRegions(REGION_GEO);
for (const r of Object.values(parsed)) r.small = (r.bounds.x1 - r.bounds.x0) < 165; // label crowding at fit zoom on a phone

// 35% tint of `tint` over the dark land (v2 §3).
const mix = (a, b, t) => { const A = pixiHex(a), B = pixiHex(b); const ch = (s) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t); return (ch(16) << 16) | (ch(8) << 8) | ch(0); };
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const dashed = (g, x1, y1, x2, y2, dash, gap, phase) => {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy); if (!len) return;
  const ux = dx / len, uy = dy / len; const period = dash + gap;
  let t = -(((phase % period) + period) % period);
  while (t < len) {
    const a = Math.max(0, t), b = Math.min(len, t + dash);
    if (b > a) { g.moveTo(x1 + ux * a, y1 + uy * a); g.lineTo(x1 + ux * b, y1 + uy * b); }
    t += period;
  }
};

export async function createPixiMap(container, { onTap, onSiteTap, onViewChange } = {}) {
  const [{ Application, Container, Graphics, Text, FillPattern, FillGradient }, { Viewport }] = await Promise.all([import('pixi.js'), import('pixi-viewport')]);
  const app = new Application();
  await app.init({
    resizeTo: container, background: pixiHex(COLOR.bg.ocean), antialias: true, autoDensity: true,
    resolution: Math.min(globalThis.devicePixelRatio || 1, 2), preference: 'webgl', powerPreference: 'high-performance',
  });
  app.canvas.style.display = 'block'; app.canvas.style.touchAction = 'none';
  container.appendChild(app.canvas);
  const still = reduced();

  const sw = () => container.clientWidth || 390, sh = () => container.clientHeight || 300;
  const viewport = new Viewport({ screenWidth: sw(), screenHeight: sh(), worldWidth: WORLD_T.w, worldHeight: WORLD_T.h, events: app.renderer.events, passiveWheel: false, stopPropagation: true });
  app.stage.addChild(viewport);
  const fitScale = () => Math.min(sw() / WORLD_T.w, sh() / WORLD_T.h);
  viewport.drag({ clampWheel: true }).pinch().wheel({ smooth: 4 }).decelerate({ friction: 0.93 });
  const applyClamp = () => { viewport.clampZoom({ minScale: fitScale(), maxScale: MAX_SCALE }); viewport.clamp({ direction: 'all', underflow: 'center' }); };
  // The tilted plane is wider than tall: fit it whole (the ocean letterbox is the host background anyway).
  applyClamp(); viewport.setZoom(fitScale(), true); viewport.moveCenter(WORLD_T.w / 2, WORLD_T.h / 2);

  // The surface, tilted. Layers in draw order.
  const plane = new Container(); plane.scale.set(1, TILT); plane.position.set(0, LIFT);
  const ocean = new Graphics(); const shadows = new Graphics(); const walls = new Graphics(); const tops = new Container(); const edges = new Container();
  const hatch = new Container(); const rings = new Graphics(); const lines = new Graphics(); const names = new Container(); const ground = new Graphics();
  plane.addChild(ocean, shadows, walls, tops, hatch, edges, rings, lines, ground, names);
  // Upright things, in the viewport's frame, at (x, y * TILT).
  const bill = new Container();
  viewport.addChild(plane, bill);
  const up = (x, y) => [x, y * TILT + LIFT];

  // Ocean: deep blue radial (#0B2546 -> #04101F) with a faint lat/long grid.
  let oceanFill;
  try { const g = new FillGradient({ type: 'radial', center: { x: 0.5, y: 0.42 }, innerRadius: 0, outerCenter: { x: 0.5, y: 0.42 }, outerRadius: 0.75, colorStops: [{ offset: 0, color: pixiHex(COLOR.bg.oceanHi) }, { offset: 1, color: pixiHex(COLOR.bg.ocean) }] }); oceanFill = { fill: g }; }
  catch { oceanFill = { color: pixiHex(COLOR.bg.oceanHi), alpha: 1 }; }
  ocean.rect(0, 0, WORLD.w, WORLD.h).fill(oceanFill);
  for (let i = 1; i <= 19; i++) ocean.moveTo(i * 50, 0).lineTo(i * 50, WORLD.h);
  for (let i = 1; i <= 9; i++) ocean.moveTo(0, i * 52).lineTo(WORLD.w, i * 52);
  ocean.stroke({ color: EDGE_DEFAULT, alpha: 0.07, width: 0.6 });

  // Contested hatch pattern: 8x8 diagonal stripe rendered once to a texture.
  const hg = new Graphics(); hg.rect(0, 0, 8, 8).fill({ color: 0x000000, alpha: 0.001 }); hg.moveTo(0, 8).lineTo(8, 0).stroke({ color: pixiHex(COLOR.text.muted), width: 1.4, alpha: 0.35 });
  const hatchTex = app.renderer.generateTexture({ target: hg, resolution: 2 }); const hatchFill = new FillPattern(hatchTex, 'repeat');

  const style = (size, fill, weight = '600', family = FONT.sans, extra = {}) => ({ fontFamily: family, fontSize: size, fill, fontWeight: weight, align: 'center', ...extra });
  const mkText = (parent, size, fill, weight, family, anchorX = 0.5, anchorY = 0.5, extra = {}) => { const t = parent.addChild(new Text({ text: '', style: style(size, fill, weight, family, extra), resolution: 2 })); t.anchor.set(anchorX, anchorY); return t; };

  // Per region: plate top, edge glow, hatch, flat name, and a billboard (value chip, deployed badge, flashpoint, intel dot).
  const R = {};
  const wallDy = (DEPTH) / TILT;
  for (const rid of Object.keys(parsed)) {
    const top = tops.addChild(new Graphics()); const edge = edges.addChild(new Graphics()); const h = hatch.addChild(new Graphics());
    const name = mkText(names, 15, COLOR.text.secondary, '700', FONT.display, 0.5, 0.5, { letterSpacing: 2.5 }); name.position.set(parsed[rid].cx, parsed[rid].cy - 14);
    const c = bill.addChild(new Container()); c.position.set(...up(parsed[rid].cx, parsed[rid].cy));
    const chip = c.addChild(new Graphics());
    const line2 = mkText(c, 10, COLOR.accent.commandHi, '800', FONT.mono); line2.position.set(0, 2);
    const line3 = mkText(c, 8, COLOR.text.muted, '700', FONT.display); line3.position.set(0, 14);
    const badge = c.addChild(new Graphics()); const dep = mkText(c, 8.5, COLOR.accent.commandHi, '700', FONT.mono); dep.position.set(0, 29);
    const fpRing = c.addChild(new Graphics()); const fp = mkText(c, 14, COLOR.text.primary, '600'); fp.position.set(0, -30);
    const fpT = mkText(c, 8, COLOR.accent.alert, '800', FONT.mono, 0); fpT.position.set(14, -30);
    const trend = mkText(c, 9.5, COLOR.accent.good, '800', FONT.mono, 0); trend.position.set(36, 2);
    const intel = c.addChild(new Graphics());
    R[rid] = { top, edge, h, name, c, chip, line2, line3, badge, dep, fpRing, fp, fpT, trend, intel, flashpoint: false };
  }
  // Chokepoints: a ground shadow on the plane, a post and a gold diamond standing up, a name at operational zoom.
  const C = {};
  const chokeMark = (k) => { if (C[k]) return C[k]; const c = bill.addChild(new Container()); const g = c.addChild(new Graphics()); const n = mkText(c, 8.5, COLOR.text.secondary, '700', FONT.display, 0.5, 0, { letterSpacing: 1 }); n.position.set(0, 6); return (C[k] = { c, g, n }); };
  // Sites (F9b): one marker per site (base icon, owner colour, count), lazily built and reused; name at operational zoom.
  const S = {};
  const siteMark = (id) => { if (S[id]) return S[id]; const c = bill.addChild(new Container()); const g = c.addChild(new Graphics()); const t = mkText(c, 8, COLOR.text.primary, '700'); const n = mkText(c, 6, COLOR.text.primary, '800', FONT.mono); n.position.set(7, -6); const nm = mkText(c, 8, COLOR.text.muted, '600', FONT.display, 0.5, 0, { letterSpacing: 0.5 }); nm.position.set(0, 9); return (S[id] = { c, g, t, n, nm }); };

  let scene = null; let phase = 0; let frames = 0; let fpsWindow = { t: performance.now(), n: 0, fps: 0 }; let level = lodFor(viewport.scaled).id;
  const lod = () => { const s = viewport.scaled; const k = Math.min(2.2, Math.max(1, 1 / s)); return { k, s, layers: layersAt(s), lvl: lodFor(s) }; };

  const layout = () => {
    const { k, s, layers, lvl } = lod();
    for (const rid of Object.keys(R)) {
      const L = R[rid]; L.c.scale.set(k);
      const small = parsed[rid].small;
      L.name.alpha = nameAlpha(s); L.name.visible = layers.names && (!small || s >= 0.75);
      L.chip.visible = L.line2.visible = layers.chips && (s >= 0.75 || !small);
      L.line3.visible = layers.chips && !!L.line3.text && (s >= 0.75 || !small);
      L.trend.visible = layers.chips && L.trend.text !== '' && s >= 0.75;
      L.badge.visible = L.dep.visible = layers.markers && L.dep.text !== '';
      L.fp.visible = L.fpT.visible = L.fpRing.visible = layers.flashpoints && L.flashpoint;
    }
    for (const m of Object.values(C)) { m.c.scale.set(k); m.c.visible = layers.chokepoints; m.n.visible = layers.chokeNames; }
    for (const m of Object.values(S)) { m.c.scale.set(k); m.nm.visible = layers.baseNames && !!m.nm.text; }
    drawRings(layers.rings);
    if (lvl.id !== level) { level = lvl.id; }
  };

  const draw = (sc) => {
    scene = sc;
    const tinted = sc.mode === 'sphere' || sc.mode === 'tension';
    shadows.clear(); walls.clear(); ground.clear();
    for (const r of sc.regions) {
      const polys = parsed[r.rid].polys; const L = R[r.rid];
      // Extrusion: a soft ground shadow, then the wall (the plate shifted down by DEPTH), then the top.
      for (const poly of polys) shadows.poly(poly.map(([x, y]) => [x + 3, y + wallDy + 5]).flat(), true);
      shadows.fill({ color: 0x000000, alpha: 0.45 });
      for (const poly of polys) walls.poly(poly.map(([x, y]) => [x, y + wallDy]).flat(), true);
      walls.fill({ color: pixiHex(WALL), alpha: 1 });
      L.top.clear(); for (const poly of polys) L.top.poly(poly.flat(), true);
      L.top.fill({ color: mix(LAND, r.fill, 0.35), alpha: 1 });
      const edgeColor = r.selected ? pixiHex(COLOR.text.primary) : tinted ? pixiHex(r.fill) : EDGE_DEFAULT;
      L.edge.clear();
      for (const poly of polys) L.edge.poly(poly.flat(), true);
      L.edge.stroke({ color: edgeColor, alpha: r.selected ? 0.35 : 0.22, width: 4.5 });
      for (const poly of polys) L.edge.poly(poly.flat(), true);
      L.edge.stroke({ color: edgeColor, alpha: r.selected ? 1 : 0.85, width: r.selected ? 1.6 : 1 });
      L.h.clear(); if (r.hatch) { for (const poly of polys) L.h.poly(poly.flat(), true); L.h.fill({ fill: hatchFill }); }
      L.name.text = r.name.toUpperCase();
      // Value chip: a small well standing up at the plate's centre.
      L.line2.text = r.line2; L.line2.style.fill = r.line2Color; L.line3.text = r.line3 || '';
      L.chip.clear(); const w = Math.max(44, r.line2.length * 6.4 + 12);
      L.chip.roundRect(-w / 2, -5, w, 14, 3).fill({ color: pixiHex(COLOR.bg.inset), alpha: 0.92 }).stroke({ color: pixiHex(r.line2Color), alpha: 0.55, width: 0.8 });
      L.badge.clear(); L.dep.text = '';
      if (r.deployed > 0) { L.badge.roundRect(-16, 23, 32, 13, 3).fill({ color: pixiHex(COLOR.bg.panel) }).stroke({ color: pixiHex(COLOR.accent.command), width: 0.7 }); L.dep.text = `⚓ ${r.deployed}`; ground.ellipse(r.cx, r.cy + 24 / TILT, 14, 5).fill({ color: 0x000000, alpha: 0.35 }); }
      L.flashpoint = !!r.flashpoint;
      L.fp.text = r.flashpoint ? `${r.flashpoint.icon}⚠` : ''; L.fpT.text = r.flashpoint ? `${r.flashpoint.t}mo` : '';
      L.fpRing.clear(); if (r.flashpoint) { L.fpRing.circle(0, -30, 14).stroke({ color: pixiHex(COLOR.accent.alert), width: 1.6, alpha: 0.7 }); ground.ellipse(r.cx, r.cy, 12, 4.5).fill({ color: pixiHex(COLOR.accent.alert), alpha: 0.18 }); }
      L.trend.text = r.trend ? `${r.trend > 0 ? '▲' : '▼'}${Math.abs(r.trend)}` : ''; L.trend.style.fill = r.trend > 0 ? COLOR.accent.good : COLOR.accent.alert;
      L.intel.clear(); if (r.intel) L.intel.circle(-38, -12, 3.2).fill({ color: pixiHex(COLOR.accent.intel), alpha: 0.9 });
    }
    for (const c of sc.chokepoints) {
      const m = chokeMark(c.k); m.c.position.set(...up(c.x, c.y)); m.g.clear();
      m.g.moveTo(0, 0).lineTo(0, -9).stroke({ color: pixiHex(DIAMOND), width: 1, alpha: 0.7 });
      m.g.poly([0, -15, 5, -9, 0, -3, -5, -9], true).fill({ color: pixiHex(DIAMOND), alpha: 0.95 }).stroke({ color: pixiHex(COLOR.bg.surface), width: 0.8 });
      m.g.circle(0, -9, 1.8).fill({ color: pixiHex(c.color), alpha: 1 });
      if (c.ring) m.g.circle(0, -9, 9).stroke({ color: pixiHex(COLOR.accent.alert), width: 1, alpha: 0.6 });
      if (c.mine) m.g.circle(0, -9, 7).stroke({ color: pixiHex(COLOR.accent.energy), width: 1, alpha: 0.9 });
      m.n.text = c.name;
      ground.ellipse(c.x, c.y, 6, 2.4).fill({ color: 0x000000, alpha: 0.4 });
    }
    for (const m of Object.values(S)) m.c.visible = false;
    for (const st of sc.sites || []) {
      const m = siteMark(st.id); m.c.visible = true; m.c.position.set(...up(st.x, st.y)); m.g.clear();
      const col = pixiHex(st.color);
      if (st.candidate) { m.g.circle(0, -4, 6).fill({ color: pixiHex(COLOR.bg.panel), alpha: 0.85 }).stroke({ color: pixiHex(COLOR.accent.good), width: 1.2, alpha: 0.9 }); m.t.text = '+'; m.t.style.fill = COLOR.accent.good; }
      else { m.g.circle(0, -4, 6.5).fill({ color: col, alpha: st.mine ? 0.95 : 0.55 }).stroke({ color: pixiHex(st.selected ? COLOR.text.primary : COLOR.bg.surface), width: st.selected ? 1.6 : 1 }); m.t.text = st.icon; m.t.style.fill = COLOR.text.primary; }
      m.t.position.set(0, -4); m.n.position.set(7, -10);
      if (st.closed) m.g.circle(0, -4, 9).stroke({ color: pixiHex(COLOR.accent.alert), width: 1, alpha: 0.9 });
      else if (st.building) m.g.circle(0, -4, 9).stroke({ color: pixiHex(COLOR.accent.warn), width: 1, alpha: 0.8 });
      const cnt = st.mine + st.theirs; m.n.text = cnt > 1 ? String(cnt) : ''; m.nm.text = st.name;
      ground.ellipse(st.x, st.y, 7, 2.8).fill({ color: 0x000000, alpha: 0.4 });
    }
    drawLines(); layout();
  };
  // Reach rings lie flat on the plane (circles in plane units become ellipses under the tilt), tactical zoom only.
  const drawRings = (show) => {
    rings.clear(); if (!scene || !show) return;
    for (const r of scene.rings || []) { rings.circle(r.x, r.y, r.r).stroke({ color: pixiHex(r.color), width: r.mine ? 1.2 / viewport.scaled : 0.7 / viewport.scaled, alpha: r.mine ? 0.75 : 0.35 }); if (r.mine) rings.circle(r.x, r.y, r.r).fill({ color: pixiHex(r.color), alpha: 0.05 }); }
  };
  // Trade lanes flow along the surface; influence lines are static dashes.
  const drawLines = () => {
    lines.clear(); if (!scene) return;
    for (const l of scene.routes) { dashed(lines, l.x1, l.y1, l.x2, l.y2, 6, 5, phase); lines.stroke({ color: pixiHex(l.color), width: 1.2, alpha: 0.55 }); }
    for (const l of scene.influence) { dashed(lines, l.x1, l.y1, l.x2, l.y2, 2, 4, 0); lines.stroke({ color: pixiHex(l.color), width: l.width, alpha: l.alpha }); }
  };

  app.ticker.add((t) => {
    frames++; fpsWindow.n++;
    const now = performance.now(); if (now - fpsWindow.t >= 1000) { fpsWindow.fps = fpsWindow.n * 1000 / (now - fpsWindow.t); fpsWindow = { t: now, n: 0, fps: fpsWindow.fps }; }
    if (!scene || still) return;
    if (scene.routes.length) { phase += t.deltaTime * 0.35; drawLines(); }
    // Pulses on live flashpoints only; markers bob 3px (screen px, so divided by the zoom).
    const k = Math.min(2.2, Math.max(1, 1 / viewport.scaled)); const bob = Math.sin(now / 380) * 3 * k / Math.max(1, viewport.scaled);
    for (const rid of Object.keys(R)) { const L = R[rid]; if (!L.flashpoint) continue; L.fpRing.alpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(now / 160)); L.fp.position.y = -30 + bob; L.fpT.position.y = -30 + bob; L.fpRing.position.y = bob; }
  });

  // A tap lands on the nearest site marker within 22 screen px first (44px target), then on a region. Viewport
  // world -> plane: undo the lift and the tilt.
  const toPlane = (p) => ({ x: p.x, y: (p.y - LIFT) / TILT });
  const siteAt = (x, y) => { let best = null, bd = (22 / viewport.scaled) ** 2; for (const st of scene?.sites || []) { const d = (st.x - x) ** 2 + ((st.y - y) * TILT) ** 2; if (d < bd) { bd = d; best = st.id; } } return best; };
  viewport.on('clicked', (e) => { const p = toPlane(e.world); const sid = siteAt(p.x, p.y); if (sid) { onSiteTap?.(sid); return; } const rid = regionAt(parsed, p.x, p.y, 22 / viewport.scaled); if (onTap) onTap(rid, p); });
  viewport.on('zoomed', () => { layout(); onViewChange?.(viewport.scaled, level); });
  viewport.on('moved', () => onViewChange?.(viewport.scaled, level));
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { app.resize(); viewport.resize(sw(), sh(), WORLD_T.w, WORLD_T.h); applyClamp(); if (viewport.scaled < fitScale()) { viewport.setZoom(fitScale(), true); viewport.moveCenter(WORLD_T.w / 2, WORLD_T.h / 2); } layout(); }) : null;
  ro?.observe(container);

  const zoomTo = (s, cx, cy) => { viewport.setZoom(Math.max(fitScale(), Math.min(MAX_SCALE, s)), true); if (cx != null) viewport.moveCenter(cx, cy); layout(); viewport.emit('zoomed', { viewport, type: 'manual' }); };
  return {
    kind: 'pixi', app, viewport, tilt: TILT,
    update: draw,
    focus(rid) { const r = parsed[rid]; if (!r) return; const [x, y] = up(r.cx, r.cy); viewport.animate({ time: still ? 0 : 320, position: { x, y }, scale: Math.max(viewport.scaled, 1.4), ease: 'easeOutQuad', removeOnInterrupt: true }); },
    focusSite(sid, scale = 2.4) { const st = (scene?.sites || []).find((x) => x.id === sid); if (!st) return; const [x, y] = up(st.x, st.y); zoomTo(Math.max(viewport.scaled, scale), x, y); viewport.emit('moved', { viewport, type: 'manual' }); },
    pan(dx, dy) { viewport.x += dx; viewport.y += dy; viewport.emit('moved', { viewport, type: 'manual' }); },
    zoom(s) { zoomTo(s); },
    zoomBy(f) { zoomTo(viewport.scaled * f); },
    fit() { zoomTo(fitScale(), WORLD_T.w / 2, WORLD_T.h / 2); },
    level: () => level, layers: () => layersAt(viewport.scaled),
    fps: () => fpsWindow.fps, frames: () => frames, scale: () => viewport.scaled,
    destroy() { ro?.disconnect(); app.destroy(true, { children: true, texture: true }); },
  };
}
