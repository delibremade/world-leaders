// Outliner rows (Paradox-style): a pure builder over the game view. Groups: ops, builds, research, timers,
// flashpoints, cooldowns. Each row carries a jump target (tab + region/nation) so the drawer can open context.
import { INTEL_OPS } from '../../data/intel.js';
import { PLATFORMS, BLACK_PROGRAMS, DV } from '../../data/platforms.js';
import { WORLD_EVENTS } from '../../data/world.js';
import { REGIONS, FLASHPOINTS } from '../../data/regions.js';
import { ISSUES } from '../../data/economy.js';
import { NATIONS } from '../../data/nations.js';
import { monthsToBriefing } from '../../sim/events.js';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const nat = (id) => NATIONS[id]?.n || cap(id);
export const GROUPS = [['flashpoints', '⚠ Flashpoints & events'], ['ops', '🕵️ Operations'], ['builds', '🏗️ Builds & programs'], ['research', '🔬 Research'], ['timers', '⏳ Timers'], ['cooldowns', '🧊 Cooldowns']];

export function buildOutliner(v) {
  const rows = [];
  const push = (r) => rows.push(r);
  if (v.flashpoint) { const fp = FLASHPOINTS[v.flashpoint.type]; push({ id: 'fp', group: 'flashpoints', icon: fp?.i || '⚠', title: `${fp?.n || 'Flashpoint'} · ${REGIONS[v.flashpoint.rid]?.n}`, sub: 'Respond before the timer runs out', months: v.flashpoint.t, sev: 'alert', jump: { tab: 'overview', region: v.flashpoint.rid } }); }
  if (v.worldEvent) { const we = WORLD_EVENTS[v.worldEvent.id]; const row = (v.evState?.fx || []).find((r) => r.kind === 'world' && r.ev === v.worldEvent.id);
    push({ id: 'we', group: 'flashpoints', icon: we?.i || '🌐', title: we?.n || v.worldEvent.id, sub: v.worldEvent.ans && row ? `in effect: ${row.choice}` : we?.choke ? `Chokepoint: ${we.choke}` : 'World event', months: v.worldEvent.mo, jump: { tab: 'energy' } }); }
  for (const r of v.evState?.fx || []) if (r.kind === 'flashpoint') push({ id: r.id, group: 'flashpoints', icon: FLASHPOINTS[r.ev]?.i || '⚠', title: `${FLASHPOINTS[r.ev]?.n || 'Flashpoint'} · ${REGIONS[r.rid]?.n}`, sub: `in effect: ${r.choice}`, months: r.mo, sev: 'good', jump: { tab: 'overview', region: r.rid } });
  if (v.ultimatum) push({ id: 'ult', group: 'flashpoints', icon: '☢', title: `Nuclear ultimatum · ${nat(v.ultimatum.cid)}`, sub: 'Answer it to resume', sev: 'alert', jump: { tab: 'sitroom' } });
  if (v.confrontation) push({ id: 'conf', group: 'flashpoints', icon: '⚓', title: `Blockade confrontation · ${REGIONS[v.confrontation.rid]?.n}`, sub: `${nat(v.confrontation.target)} convoy`, sev: 'alert', jump: { tab: 'overview', region: v.confrontation.rid } });
  for (const [rid, b] of Object.entries(v.blockades || {})) push({ id: `bl_${rid}`, group: 'flashpoints', icon: '🚢', title: `Blockade · ${REGIONS[rid]?.n}`, sub: `vs ${nat(b?.target)}${b?.porous ? ' · porous' : ''}`, sev: 'warn', jump: { tab: 'overview', region: rid } });

  for (const o of v.intelOps || []) { const op = INTEL_OPS.find((x) => x.id === o.opId); push({ id: o.id, group: 'ops', icon: op?.i || '🕵️', title: `${op?.n || o.opId} → ${nat(o.targetId)}`, sub: `${Math.round((o.successRate || 0) * 100)}% success · ${Math.round((o.discoverRate || 0) * 100)}% exposure`, months: o.monthsLeft, pct: op?.mo ? 1 - o.monthsLeft / op.mo : null, jump: { tab: 'intel', nation: o.targetId } }); }
  for (const [ck, on] of Object.entries(v.continuousOps || {})) { if (!on) continue; const [opId, target] = ck.split('@'); const op = INTEL_OPS.find((x) => x.id === opId); push({ id: `co_${ck}`, group: 'ops', icon: '♻️', title: `${op?.n || opId} → ${nat(target)}`, sub: 'Standing program', jump: { tab: 'intel', nation: target } }); }
  // Issues (E9, #23): unexamined and briefed ones carry a lapse timer; deployed ones show under Builds as deployments.
  for (const i of v.issues || []) {
    const def = ISSUES[i.type]; if (!def) continue;
    if (i.status === 'unexamined') push({ id: `iss_${i.type}`, group: 'ops', icon: def.icon, title: def.title, sub: 'Unexamined · commission a brief', months: i.ttl, sev: i.ttl <= 3 ? 'alert' : 'warn', jump: { tab: 'intel', issue: i.type } });
    if (i.status === 'briefed') push({ id: `iss_${i.type}`, group: 'ops', icon: '📄', title: `Brief ready · ${def.title}`, sub: 'Deploy a policy before it lapses', months: i.ttl, sev: i.ttl <= 3 ? 'alert' : 'warn', jump: { tab: 'intel', issue: i.type } });
  }
  for (const [t, m] of Object.entries(v.investigations || {})) push({ id: `inv_${t}`, group: 'ops', icon: '🔍', title: `Brief: ${ISSUES[t]?.title || t}`, sub: 'Investigation', months: m, jump: { tab: 'intel', issue: t } });

  for (const [pid, d] of Object.entries(v.platformDev || {})) { const p = PLATFORMS[pid]; push({ id: `dev_${pid}`, group: 'builds', icon: p?.i || '🛠️', title: `Develop ${p?.n || pid}`, sub: 'Platform development', months: d?.mo, pct: p?.dev?.mo ? 1 - (d?.mo || 0) / p.dev.mo : null, jump: { tab: 'arsenal', sub: 'procurement' } }); }
  if (v.blackResearch) { const bp = BLACK_PROGRAMS[v.blackResearch.id]; push({ id: 'sap', group: 'builds', icon: '🕶️', title: `SAP: ${bp?.n || v.blackResearch.id}`, sub: 'Special access program', pct: v.blackResearch.mo ? (v.blackResearch.prog || 0) / v.blackResearch.mo : null, months: v.blackResearch.mo ? Math.max(0, v.blackResearch.mo - (v.blackResearch.prog || 0)) : undefined, jump: { tab: 'arsenal', sub: 'programs' } }); }
  for (const [id, d] of Object.entries(v.arsenal?.dev || {})) { const bp = BLACK_PROGRAMS[id]; push({ id: `proto_${id}`, group: 'builds', icon: bp?.i || '🛩️', title: `Prototype: ${bp?.n || id}`, sub: d.slipped ? 'Slipped once' : 'Prototype line', pct: d.prog / d.mo, months: d.mo - d.prog, jump: { tab: 'arsenal', sub: 'programs' } }); }
  for (const d of v.deployments || []) if (d.status === 'active') push({ id: d.id, group: 'builds', icon: '📋', title: d.policyName, sub: 'Policy deployment', months: Math.max(0, (d.timeMonths || 0) - (d.monthsElapsed || 0)), pct: d.timeMonths ? d.monthsElapsed / d.timeMonths : null, jump: { tab: 'intel', issue: d.issueType } });

  for (const [vert, ml] of Object.entries(v.defResearch || {})) if (ml > 0) push({ id: `rd_${vert}`, group: 'research', icon: DV[vert]?.i || '🔬', title: `${DV[vert]?.n || vert} L${(v.defLevels?.[vert] || 0) + 1}`, sub: 'R&D in progress', months: ml, jump: { tab: 'technology' } });

  const timer = (id, icon, title, months, sub, jump, sev) => months > 0 && push({ id, group: 'timers', icon, title, sub, months, jump, sev });
  // F2 (#33): decisions arrive at the quarterly briefing; this row is the countdown.
  if (v.date) timer('briefing', '🗂️', 'Cabinet briefing', monthsToBriefing(v), v.activeDecision ? 'A decision is on the table' : 'Decisions arrive here, one at a time', { tab: 'overview' });
  timer('grace', '🛡', 'Grace period', v.gracePeriod, 'Rivals hold back', { tab: 'sitroom' });
  timer('pariah', '☢️', 'Pariah status', v.pariah, 'Arms markets closed', { tab: 'arsenal', sub: 'exports' }, 'alert');
  timer('heg', '👑', 'Hegemony hold', v.hegHold > 0 ? 24 - v.hegHold : 0, `${v.hegHold}/24 months held`, { tab: 'overview' });
  if (v.embargoedBy) timer('embby', '⛽', `Embargoed by ${nat(v.embargoedBy.by)}`, v.embargoedBy.mo, 'Import contracts pay more', { tab: 'energy', nation: v.embargoedBy.by }, 'alert');
  for (const [n, m] of Object.entries(v.expelled || {})) timer(`exp_${n}`, '✈️', `Expulsion · ${nat(n)}`, m, 'Their station is closed', { tab: 'intel', nation: n });
  for (const [n, m] of Object.entries(v.embassyLocks || {})) timer(`lock_${n}`, '🏛️', `Persona non grata · ${nat(n)}`, m, 'No embassy until it clears', { tab: 'trade', nation: n }, 'warn');
  for (const [b, m] of Object.entries(v.blocLock || {})) timer(`bloc_${b}`, '🧊', `Bloc frozen · ${b.toUpperCase()}`, m, 'Tier progress paused', { tab: 'trade' }, 'warn');
  for (const [n, c] of Object.entries(v.concessions || {})) if (c?.ramp > 0 || c?.mo > 0) timer(`conc_${n}`, '🛢️', `Concession · ${nat(n)}`, c.ramp || c.mo, 'Ramping up', { tab: 'energy', nation: n });
  if (v.sprRelease) push({ id: 'spr', group: 'timers', icon: '🛢️', title: 'SPR release', sub: 'Drawing down the reserve', jump: { tab: 'energy' } });

  const cdLabel = { visit: 'State visit', aid: 'Aid package', bc: 'Back-channel', interv: 'Intervention', demo: 'Demonstration' };
  for (const [k, m] of Object.entries(v.actionCooldowns || {})) {
    if (!(m > 0) || k.startsWith('issue_')) continue; const [kind, ...rest] = k.split('_'); const who = rest.join('_');
    push({ id: `cd_${k}`, group: 'cooldowns', icon: '🧊', title: `${cdLabel[kind] || cap(kind)}${who ? ` · ${nat(who)}` : ''}`, sub: 'Cooldown', months: m, jump: { tab: kind === 'interv' ? 'energy' : kind === 'bc' || kind === 'demo' ? 'intel' : 'trade', nation: NATIONS[who] ? who : undefined } });
  }
  return rows;
}

export const counts = (rows) => rows.reduce((a, r) => { a[r.group] = (a[r.group] || 0) + 1; return a; }, {});
