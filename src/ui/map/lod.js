// Level of detail for the 2.5D map (docs/DESIGN-SYSTEM-V2.md §3). One pure table from the viewport scale to the
// level and the layers it shows, shared by the PixiJS renderer (what it draws), the level chip (what it says) and
// the tests. Strategic: names and sphere chips. Operational: + base and chokepoint names. Tactical: + reach rings
// and unit detail. Thresholds are in viewport scale units (1 = one world px per screen px).
export const LOD = [
  { id: 'strategic', label: 'Strategic', min: 0, layers: ['names', 'chips', 'markers', 'lanes', 'chokepoints', 'flashpoints'] },
  { id: 'operational', label: 'Operational', min: 1.05, layers: ['names', 'chips', 'markers', 'lanes', 'chokepoints', 'flashpoints', 'baseNames', 'chokeNames'] },
  { id: 'tactical', label: 'Tactical', min: 1.9, layers: ['names', 'chips', 'markers', 'lanes', 'chokepoints', 'flashpoints', 'baseNames', 'chokeNames', 'rings', 'unitDetail'] },
];
export const LOD_IDS = LOD.map((l) => l.id);
export const LAYERS = [...new Set(LOD.flatMap((l) => l.layers))];

// The level for a viewport scale. Below the first threshold is strategic; NaN or negative reads as strategic too.
export function lodFor(scale) {
  const s = Number.isFinite(scale) ? scale : 0;
  let cur = LOD[0];
  for (const l of LOD) if (s >= l.min) cur = l;
  return cur;
}
// {names: true, rings: false, ...} for a level id or a scale.
export function layersAt(levelOrScale) {
  const l = typeof levelOrScale === 'string' ? LOD.find((x) => x.id === levelOrScale) || LOD[0] : lodFor(levelOrScale);
  return Object.fromEntries(LAYERS.map((k) => [k, l.layers.includes(k)]));
}
// Region names lie flat and fade as the zoom climbs (Paradox convention): full at strategic, half at tactical.
export const nameAlpha = (scale) => Math.max(0.35, Math.min(1, 1.15 - 0.35 * Math.max(0, scale - 0.6)));
