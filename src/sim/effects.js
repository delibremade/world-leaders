// Active effects (FIX 4). A row is {id, source, stat, d, monthsLeft, totalMonths, permanent?}. Timed rows count down and
// expire; permanent rows (a renewable plant's inflation damper) hold for the life of the campaign and carry the PERMANENT
// stamp so older readers that print months see a number, never a countdown that matters. One permanent row per
// source and stat: a second build of the same kind raises its d instead of stacking an identical row (the "Inflation
// -0.04/mo (767mo)" x4 bug: four 999-month rows, one per build, each counting down).
export const PERMANENT = 999;
export const RENEWABLE_DAMPER = -0.04; // inflation per renewable level, per month (v57 rule, unchanged)
const r6 = (x) => Math.round(x * 1e6) / 1e6;

export const isRenewable = (e) => typeof e.source === 'string' && e.source.startsWith('renewable_');

// Set (not add) the permanent row for source+stat to d. Returns a new list.
export function setPermanent(list, { id, source, stat, d }) {
  const i = list.findIndex((e) => e.permanent && e.source === source && e.stat === stat);
  const row = { id, source, stat, d: r6(d), monthsLeft: PERMANENT, totalMonths: PERMANENT, permanent: true };
  if (i < 0) return [...list, row];
  const n = list.slice(); n[i] = { ...n[i], d: row.d }; return n;
}

// Saves from before FIX 4 hold one 999-month row per renewable build, each counting down. Fold them into one permanent
// row per source (d summed). Any other list comes back as is (same reference), so parity for runs without renewables holds.
export function migrateEffects(list) {
  if (!list.some((e) => isRenewable(e) && !e.permanent)) return list;
  const out = [];
  for (const e of list) {
    if (!isRenewable(e)) { out.push(e); continue; }
    const i = out.findIndex((x) => x.permanent && x.source === e.source && x.stat === e.stat);
    if (i < 0) out.push({ id: `ren_${e.source.slice('renewable_'.length)}`, source: e.source, stat: e.stat, d: r6(e.d), monthsLeft: PERMANENT, totalMonths: PERMANENT, permanent: true });
    else out[i] = { ...out[i], d: r6(out[i].d + e.d) };
  }
  return out;
}

// One month older: permanent rows hold, timed rows count down. Expired rows are dropped by the caller's filter.
export const ageEffect = (e) => (e.permanent ? e : { ...e, monthsLeft: e.monthsLeft - 1 });
export const liveEffect = (e) => e.permanent || e.monthsLeft > 0;
