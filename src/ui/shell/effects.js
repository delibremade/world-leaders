// FIX 4: active effects for people. groupEffects folds rows with the same source and stat into one line (count, summed
// d, longest clock) and names the source; sourceLabel maps an engine source id to its policy or program name.
import { PA } from '../../data/economy.js';
import { SC } from '../../data/stats.js';

const KIND = { solar: 'Solar', wind: 'Wind', hydro: 'Hydro' };
export function sourceLabel(source) {
  if (!source) return 'Unknown';
  if (source.startsWith('renewable_')) { const k = source.slice('renewable_'.length); return `Renewables · ${KIND[k] || k}`; }
  if (source === 'intel_network') return 'Intel network';
  if (source === 'econ_war') return 'Economic warfare';
  if (source === 'jp_normalization') return 'Normalization';
  const a = PA.find((x) => x.id === source); if (a) return a.n;
  return source;
}
export const statLabel = (stat) => SC[stat]?.label || stat;
export const clockLabel = (g) => (g.permanent ? 'permanent' : `${g.months}mo`);

export function groupEffects(effects = []) {
  const out = []; const idx = new Map();
  for (const e of effects) {
    const key = `${e.source}|${e.stat}`;
    if (!idx.has(key)) { idx.set(key, out.length); out.push({ key, source: e.source, label: sourceLabel(e.source), stat: e.stat, statLabel: statLabel(e.stat), d: 0, months: 0, permanent: false, count: 0, ids: [] }); }
    const g = out[idx.get(key)];
    g.d = Math.round((g.d + e.d) * 1e6) / 1e6; g.count++; g.ids.push(e.id); g.permanent = g.permanent || !!e.permanent; g.months = Math.max(g.months, e.permanent ? 0 : e.monthsLeft || 0);
  }
  return out;
}
