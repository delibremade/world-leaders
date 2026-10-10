import { ISSUES } from '../data/economy.js';

// Issue lifecycle (E9, #23): unexamined -> investigating -> briefed -> deployed -> resolved, or lapsed.
// Pure over plain data; the intel phase (tick.js intelOps) applies the result. No rng: cadence is deterministic.
// g.issues holds only live issues (investigate/deployPolicy match by type, so history would be re-triggered).
// Memory between issues lives in g.actionCooldowns, which already ticks down monthly: `issue_next` (spawn gap)
// and `issue_<type>` (a finished type stays away for ISSUE_COOLDOWN months).
export const ISSUE_TTL = { unexamined: 12, briefed: 12 }; // months to act before the issue lapses
export const ISSUE_WATCH = 0.7;   // sev floor to surface an issue
export const ISSUE_COOLDOWN = 6;  // months before a lapsed/resolved type can return
export const ISSUE_MAX_OPEN = 3;   // unexamined issues at once
export const issueGap = (now) => 6 + ((now * 7) % 5); // 6..10 months between new issues

// briefed: types whose investigation finished this month. now: g.tickCount, date: {yr,mo}.
// Returns { issues, spawned: [type], lapsed: [type], resolved: [type], cool: { key: months } }.
export function stepIssues({ issues, deployments, stats, now, date, briefed = [], cooldowns = {} }) {
  const spawned = [], lapsed = [], resolved = [], cool = {};
  const list = [];
  for (const i of issues) {
    const o = { ...i };
    if (o.born == null) o.born = now;
    if (briefed.includes(o.type) && o.status === 'investigating') { o.status = 'briefed'; o.ttl = ISSUE_TTL.briefed + 1; }
    if (o.ttl == null && (o.status === 'unexamined' || o.status === 'briefed')) o.ttl = ISSUE_TTL[o.status];
    if (o.status === 'unexamined' || o.status === 'briefed') {
      o.ttl -= 1;
      if (o.ttl <= 0) { lapsed.push(o.type); cool[`issue_${o.type}`] = ISSUE_COOLDOWN + 1; continue; }
    } else if (o.status === 'deployed' && !deployments.some((d) => d.issueType === o.type && d.status === 'active')) {
      resolved.push(o.type); cool[`issue_${o.type}`] = ISSUE_COOLDOWN + 1; continue;
    }
    list.push(o);
  }
  const open = new Set(list.map((i) => i.type));
  const unexamined = list.filter((i) => i.status === 'unexamined').length;
  if (!(cooldowns.issue_next > 0) && unexamined < ISSUE_MAX_OPEN) {
    let best = null, bs = ISSUE_WATCH;
    for (const [type, def] of Object.entries(ISSUES)) {
      if (open.has(type) || cooldowns[`issue_${type}`] > 0 || cool[`issue_${type}`] || !def.sev) continue;
      const v = def.sev(stats);
      if (v > bs) { bs = v; best = type; }
    }
    if (best) {
      list.push({ type: best, id: `${best}_${now}`, status: 'unexamined', yr: date.yr, mo: date.mo, born: now, ttl: ISSUE_TTL.unexamined });
      spawned.push(best); cool.issue_next = issueGap(now) + 1;
    }
  }
  return { issues: list, spawned, lapsed, resolved, cool };
}
