// Top-bar alert chips (v2 §4): colour-coded by family so the kind reads before the text. Pure: a builder over the
// outliner rows (each carries its `kind`) and the chokepoint register. A chip names the outliner rows it focuses and
// the map mode that shows its subject; it never recomputes a rule.
import { CHOKEPOINTS } from '../../data/chokepoints.js';

// family -> chip label, icon, map mode, outliner kinds it gathers.
export const FAMILIES = {
  situation: { label: 'situation', plural: 'situations', icon: '⚠', mode: 'tension', kinds: ['situation'] },
  brief: { label: 'brief', plural: 'briefs', icon: '📄', mode: 'intel', kinds: ['brief'] },
  chokepoint: { label: 'lock', plural: 'locks', icon: '🔒', mode: 'energy', kinds: ['lock'] },
  good: { label: 'timer', plural: 'timers', icon: '⏳', mode: 'sphere', kinds: ['timer', 'build'] },
};
export const FAMILY_IDS = Object.keys(FAMILIES);

// rows: buildOutliner() output. chokeStatus: {hormuz: 'disrupted', ...} from the engine; a disrupted chokepoint is a lock
// even when no outliner row names it. Returns one chip per family that has anything live, in family order.
export function buildAlerts(rows = [], { chokeStatus = {} } = {}) {
  const chips = [];
  for (const fam of FAMILY_IDS) {
    const f = FAMILIES[fam];
    const mine = rows.filter((r) => f.kinds.includes(r.kind));
    const extra = fam === 'chokepoint' ? Object.entries(chokeStatus).filter(([, st]) => st === 'disrupted').map(([k]) => `${CHOKEPOINTS[k]?.n || k} cut`) : [];
    const n = mine.length + extra.length;
    if (!n) continue;
    const urgent = mine.some((r) => r.sev === 'alert');
    const first = mine[0]?.title || extra[0] || '';
    chips.push({ id: fam, family: fam, icon: f.icon, count: n, label: n === 1 ? f.label : f.plural, title: n === 1 ? first : `${first} +${n - 1}`, mode: f.mode, rowIds: mine.map((r) => r.id), group: mine[0]?.group || null, urgent, extra });
  }
  return chips;
}
