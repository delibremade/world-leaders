// PixiJS renderer for the map scene (browser only; MapView falls back to SvgMap without WebGL).
// pixi.js is imported lazily so the App bundle evaluates in jsdom without touching WebGL.
// Pan / pinch / wheel / inertia come from pixi-viewport; region taps use the viewport's `clicked` event and a
// point-in-polygon hit test over REGION_GEO, with a 44px tolerance ring for small islands.
import { REGION_GEO } from '../../data/regions.js';
import { parseRegions, regionAt, WORLD } from './path.js';
import { COLOR, FONT, pixiHex } from '../tokens.js';

const parsed = parseRegions(REGION_GEO);
for (const r of Object.values(parsed)) r.small = (r.bounds.x1 - r.bounds.x0) < 165; // label crowding at fit zoom on a phone
const MAX_SCALE = 6;

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

export async function createPixiMap(container, { onTap, onViewChange } = {}) {
  const [{ Application, Container, Graphics, Text, FillPattern }, { Viewport }] = await Promise.all([import('pixi.js'), import('pixi-viewport')]);
  const app = new Application();
  await app.init({
    resizeTo: container, background: pixiHex(COLOR.bg.ocean), antialias: true, autoDensity: true,
    resolution: Math.min(globalThis.devicePixelRatio || 1, 2), preference: 'webgl', powerPreference: 'high-performance',
  });
  app.canvas.style.display = 'block'; app.canvas.style.touchAction = 'none';
  container.appendChild(app.canvas);

  const sw = () => container.clientWidth || 390, sh = () => container.clientHeight || 300;
  const viewport = new Viewport({ screenWidth: sw(), screenHeight: sh(), worldWidth: WORLD.w, worldHeight: WORLD.h, events: app.renderer.events, passiveWheel: false, stopPropagation: true });
  app.stage.addChild(viewport);
  const minScale = () => Math.min(sw() / WORLD.w, sh() / WORLD.h);
  viewport.drag({ clampWheel: true }).pinch().wheel({ smooth: 4 }).decelerate({ friction: 0.93 });
  const applyClamp = () => { viewport.clampZoom({ minScale: minScale(), maxScale: MAX_SCALE }); viewport.clamp({ direction: 'all', underflow: 'center' }); };
  const coverScale = () => Math.max(sw() / WORLD.w, sh() / WORLD.h);
  applyClamp(); viewport.setZoom(coverScale(), true); viewport.moveCenter(WORLD.w / 2, WORLD.h / 2);

  // Layers in draw order.
  const ocean = new Graphics(); const land = new Container(); const hatch = new Container(); const lines = new Graphics();
  const marks = new Container(); const labels = new Container();
  viewport.addChild(ocean, land, hatch, lines, marks, labels);
  ocean.rect(0, 0, WORLD.w, WORLD.h).fill({ color: pixiHex(COLOR.bg.oceanHi), alpha: 1 });
  for (let i = 1; i <= 9; i++) ocean.moveTo(i * 100, 0).lineTo(i * 100, WORLD.h);
  for (let i = 1; i <= 4; i++) ocean.moveTo(0, i * 104).lineTo(WORLD.w, i * 104);
  ocean.stroke({ color: pixiHex(COLOR.bg.inset), alpha: 0.35, width: 0.6 });

  // Contested hatch pattern: 8x8 diagonal stripe rendered once to a texture.
  const hg = new Graphics(); hg.rect(0, 0, 8, 8).fill({ color: 0x000000, alpha: 0.001 }); hg.moveTo(0, 8).lineTo(8, 0).stroke({ color: pixiHex(COLOR.text.muted), width: 1.4, alpha: 0.35 });
  const hatchTex = app.renderer.generateTexture({ target: hg, resolution: 2 }); const hatchFill = new FillPattern(hatchTex, 'repeat');

  const style = (size, fill, weight = '600', family = FONT.sans) => ({ fontFamily: family, fontSize: size, fill, fontWeight: weight, align: 'center' });
  const regionGfx = {}; const regionHatch = {}; const regionLabel = {};
  for (const rid of Object.keys(parsed)) {
    regionGfx[rid] = land.addChild(new Graphics()); regionHatch[rid] = hatch.addChild(new Graphics());
    const c = labels.addChild(new Container()); c.position.set(parsed[rid].cx, parsed[rid].cy);
    const mk = (y, size, fill, weight, anchorX = 0.5) => { const t = c.addChild(new Text({ text: '', style: style(size, fill, weight), resolution: 2 })); t.anchor.set(anchorX, 0.5); t.position.set(0, y); return t; };
    regionLabel[rid] = { c, name: mk(-12, 11.5, COLOR.text.secondary, '600'), line2: mk(2, 10, COLOR.accent.commandHi, '800'), line3: mk(14, 8, COLOR.text.muted, '600'), badge: c.addChild(new Graphics()), dep: mk(29, 8.5, COLOR.accent.commandHi, '700'), fp: mk(-28, 14, COLOR.text.primary, '600'), fpT: mk(-28, 8, COLOR.accent.alert, '800', 0), trend: mk(2, 9.5, COLOR.accent.good, '800', 0), intel: c.addChild(new Graphics()) };
    regionLabel[rid].fpT.position.x = 14; regionLabel[rid].trend.position.x = 36;
  }
  const chokeGfx = marks.addChild(new Graphics()); const flashGfx = marks.addChild(new Graphics());

  let scene = null; let phase = 0; let frames = 0; let fpsWindow = { t: performance.now(), n: 0, fps: 0 };
  const lod = () => { const s = viewport.scaled; const k = Math.min(2.2, Math.max(1, 1 / s)); return { k, detail: s >= 0.75 }; };
  const layoutLabels = () => {
    const { k, detail } = lod();
    for (const rid of Object.keys(regionLabel)) {
      const L = regionLabel[rid]; L.c.scale.set(k);
      const small = parsed[rid].small; L.line2.visible = detail || !small; L.name.position.y = (detail || !small) ? -12 : 0;
      L.line3.visible = detail && !!L.line3.text; L.trend.visible = detail && L.trend.text !== ''; L.badge.visible = L.dep.visible = detail || L.dep.text !== '';
    }
    chokeGfx.scale.set(1); // chokepoints stay in world units; their rings are large enough at any zoom
  };

  const draw = (s) => {
    scene = s;
    for (const r of s.regions) {
      const g = regionGfx[r.rid]; g.clear();
      for (const poly of parsed[r.rid].polys) g.poly(poly.flat(), true);
      g.fill({ color: pixiHex(r.fill), alpha: r.fillAlpha }).stroke({ color: pixiHex(r.stroke), alpha: r.selected ? 0.95 : 0.55, width: r.selected ? 1.8 : 0.9 });
      const h = regionHatch[r.rid]; h.clear();
      if (r.hatch) { for (const poly of parsed[r.rid].polys) h.poly(poly.flat(), true); h.fill({ fill: hatchFill }); }
      const L = regionLabel[r.rid];
      L.name.text = r.name; L.line2.text = r.line2; L.line2.style.fill = r.line2Color; L.line3.text = r.line3 || '';
      L.badge.clear(); L.dep.text = '';
      if (r.deployed > 0) { L.badge.roundRect(-16, 23, 32, 13, 3).fill({ color: pixiHex(COLOR.bg.panel) }).stroke({ color: pixiHex(COLOR.accent.command), width: 0.7 }); L.dep.text = `⚓ ${r.deployed}`; }
      L.fp.text = r.flashpoint ? `${r.flashpoint.icon}⚠` : ''; L.fpT.text = r.flashpoint ? `${r.flashpoint.t}mo` : '';
      L.trend.text = r.trend ? `${r.trend > 0 ? '▲' : '▼'}${Math.abs(r.trend)}` : ''; L.trend.style.fill = r.trend > 0 ? COLOR.accent.good : COLOR.accent.alert;
      L.intel.clear(); if (r.intel) L.intel.circle(-38, -12, 3.2).fill({ color: pixiHex(COLOR.accent.intel), alpha: 0.9 });
    }
    chokeGfx.clear();
    for (const c of s.chokepoints) {
      chokeGfx.circle(c.x, c.y, c.r).fill({ color: pixiHex(c.color), alpha: 0.9 }).stroke({ color: pixiHex(COLOR.bg.surface), width: 1 });
      if (c.ring) chokeGfx.circle(c.x, c.y, 9).stroke({ color: pixiHex(COLOR.accent.alert), width: 1, alpha: 0.6 });
      if (c.mine) chokeGfx.circle(c.x, c.y, 7).stroke({ color: pixiHex(COLOR.accent.energy), width: 1, alpha: 0.9 });
    }
    drawLines(); layoutLabels();
  };
  const drawLines = () => {
    lines.clear(); if (!scene) return;
    for (const l of scene.routes) { dashed(lines, l.x1, l.y1, l.x2, l.y2, 6, 5, phase); lines.stroke({ color: pixiHex(l.color), width: 1.2, alpha: 0.5 }); }
    for (const l of scene.influence) { dashed(lines, l.x1, l.y1, l.x2, l.y2, 2, 4, 0); lines.stroke({ color: pixiHex(l.color), width: l.width, alpha: l.alpha }); }
  };

  app.ticker.add((t) => {
    frames++; fpsWindow.n++;
    const now = performance.now(); if (now - fpsWindow.t >= 1000) { fpsWindow.fps = fpsWindow.n * 1000 / (now - fpsWindow.t); fpsWindow = { t: now, n: 0, fps: fpsWindow.fps }; }
    if (!scene) return;
    if (scene.routes.length) { phase += t.deltaTime * 0.35; drawLines(); }
    const fp = scene.regions.find((r) => r.flashpoint); flashGfx.clear();
    if (fp) { const a = 0.35 + 0.35 * Math.sin(now / 160); flashGfx.circle(fp.cx, fp.cy - 28, 14).stroke({ color: pixiHex(COLOR.accent.alert), width: 1.5, alpha: a }); }
  });

  viewport.on('clicked', (e) => { const rid = regionAt(parsed, e.world.x, e.world.y, 22 / viewport.scaled); if (onTap) onTap(rid, e.world); });
  viewport.on('zoomed', () => { layoutLabels(); onViewChange?.(viewport.scaled); });
  viewport.on('moved', () => onViewChange?.(viewport.scaled));
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { viewport.resize(sw(), sh(), WORLD.w, WORLD.h); applyClamp(); if (viewport.scaled < minScale()) { viewport.setZoom(coverScale(), true); viewport.moveCenter(WORLD.w / 2, WORLD.h / 2); } layoutLabels(); }) : null;
  ro?.observe(container);

  return {
    kind: 'pixi', app, viewport,
    update: draw,
    focus(rid) { const r = parsed[rid]; if (!r) return; viewport.animate({ time: 320, position: { x: r.cx, y: r.cy }, scale: Math.max(viewport.scaled, 1.4), ease: 'easeOutQuad', removeOnInterrupt: true }); },
    pan(dx, dy) { viewport.x += dx; viewport.y += dy; viewport.emit('moved', { viewport, type: 'manual' }); },
    zoom(s) { viewport.setZoom(s, true); layoutLabels(); },
    fps: () => fpsWindow.fps, frames: () => frames, scale: () => viewport.scaled,
    destroy() { ro?.disconnect(); app.destroy(true, { children: true, texture: true }); },
  };
}
