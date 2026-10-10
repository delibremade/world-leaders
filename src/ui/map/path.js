// REGION_GEO path strings (Natural Earth, pre-projected into the 1000x520 map frame) -> polygons.
// Paths are "M x,y L x,y ... Z" repeated per island; no curves. Shared by the PixiJS renderer (fills, hit test)
// and the headless tests. Never hand-edit REGION_GEO (ruling 9); regenerate it and this still parses.

export const WORLD = Object.freeze({ w: 1000, h: 520 });

// 'M1,2 L3,4 Z M5,6 ...' -> [[[1,2],[3,4]], [[5,6], ...]]
export function parsePath(d) {
  const polys = [];
  let cur = null;
  const re = /([MLZ])\s*(-?\d+(?:\.\d+)?)?\s*,?\s*(-?\d+(?:\.\d+)?)?/g;
  let m;
  while ((m = re.exec(d))) {
    const [, cmd, x, y] = m;
    if (cmd === 'M') { cur = [[+x, +y]]; polys.push(cur); }
    else if (cmd === 'L') { if (!cur) throw new Error('L before M'); cur.push([+x, +y]); }
    else if (cmd === 'Z') { cur = null; }
  }
  return polys.filter((p) => p.length >= 3);
}

export function bounds(polys) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys) for (const [x, y] of p) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
}

export function area(poly) {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % n]; a += x1 * y2 - x2 * y1; }
  return Math.abs(a) / 2;
}

// Ray casting. Even-odd over all islands of a region.
export function pointInPolygons(polys, x, y) {
  let inside = false;
  for (const p of polys) {
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [xi, yi] = p[i], [xj, yj] = p[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

// Parse every region once; the largest island is the label anchor fallback when cx,cy falls in water.
export function parseRegions(REGION_GEO) {
  return Object.fromEntries(Object.entries(REGION_GEO).map(([rid, g]) => {
    const polys = parsePath(g.d);
    const main = polys.reduce((a, b) => (area(b) > area(a) ? b : a), polys[0]);
    return [rid, { polys, main, bounds: bounds(polys), cx: g.cx, cy: g.cy }];
  }));
}

// Hit test with a tolerance ring so small islands stay tappable (44px rule): exact hit first, then nearest
// region whose centre is within `near` world units.
export function regionAt(parsed, x, y, near = 0) {
  for (const [rid, r] of Object.entries(parsed)) if (pointInPolygons(r.polys, x, y)) return rid;
  if (near > 0) {
    let best = null, bd = near * near;
    for (const [rid, r] of Object.entries(parsed)) { const d = (r.cx - x) ** 2 + (r.cy - y) ** 2; if (d < bd) { bd = d; best = rid; } }
    return best;
  }
  return null;
}
