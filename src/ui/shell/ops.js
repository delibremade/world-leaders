// FIX 3: the operations list grouped by op type and target with counts (UI view only; the engine's list is flat).
// groupOps(ops) -> [{type, label, count, targets: [{targetId, count, ops: [...]}]}] in INTEL_OPS type order, targets by count desc then id.
import { INTEL_OPS } from '../../data/intel.js';
import { NATIONS } from '../../data/nations.js';

export const TYPE_LABELS = { covert: 'Covert', defensive: 'Defensive' };
export const opName = (id) => NATIONS[id]?.n || id;

export function groupOps(ops = []) {
  const byType = new Map();
  for (const o of ops) {
    const def = INTEL_OPS.find((x) => x.id === o.opId);
    const type = o.type || def?.type || 'covert';
    if (!byType.has(type)) byType.set(type, new Map());
    const byTarget = byType.get(type);
    if (!byTarget.has(o.targetId)) byTarget.set(o.targetId, []);
    byTarget.get(o.targetId).push(o);
  }
  const order = [...new Set(INTEL_OPS.map((x) => x.type))];
  return [...byType.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map(([type, byTarget]) => {
    const targets = [...byTarget.entries()].map(([targetId, list]) => ({ targetId, name: opName(targetId), count: list.length, ops: list }))
      .sort((a, b) => b.count - a.count || a.targetId.localeCompare(b.targetId));
    return { type, label: TYPE_LABELS[type] || type, count: targets.reduce((n, t) => n + t.count, 0), targets };
  });
}
