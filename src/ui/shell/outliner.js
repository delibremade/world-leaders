// Outliner rows (Paradox-style): a pure builder over the game view. Groups: ops, builds, research, timers,
// flashpoints, cooldowns. Each row carries a jump target (tab + region/nation) so the drawer can open context.
import { programSupply } from '../../sim/minerals.js';
import { MINERALS } from '../../data/minerals.js';
import { INTEL_OPS } from '../../data/intel.js';
import { PLATFORMS, BLACK_PROGRAMS, DV } from '../../data/platforms.js';
import { WORLD_EVENTS } from '../../data/world.js';
import { REGIONS, FLASHPOINTS } from '../../data/regions.js';
import { ISSUES } from '../../data/economy.js';
import { NATIONS } from '../../data/nations.js';
import { monthsToBriefing } from '../../sim/events.js';
import { NODE_TYPES, SITES, BASE_RULES } from '../../data/bases.js';
import { CHOKEPOINTS } from '../../data/chokepoints.js';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const nat = (id) => NATIONS[id]?.n || cap(id);
// kind: the alert family a row belongs to (v2 §2 alert families): situation | brief | lock | timer | build.
export const KINDS = ['situation', 'brief', 'lock', 'timer', 'build'];
export const GROUPS = [['flashpoints', '⚠ Flashpoints & events'], ['ops', '🕵️ Operations'], ['builds', '🏗️ Builds & programs'], ['research', '🔬 Research'], ['timers', '⏳ Timers'], ['cooldowns', '🧊 Cooldowns']];

export function buildOutliner(v) {
  const rows = [];
  const push = (r) => rows.push(r);
  if (v.flashpoint) { const fp = FLASHPOINTS[v.flashpoint.type]; push({ id: 'fp', kind: 'situation', group: 'flashpoints', icon: fp?.i || '⚠', title: `${fp?.n || 'Flashpoint'} · ${REGIONS[v.flashpoint.rid]?.n}`, sub: 'Respond before the timer runs out', months: v.flashpoint.t, sev: 'alert', jump: { tab: 'overview', region: v.flashpoint.rid } }); }
  if (v.worldEvent) { const we = WORLD_EVENTS[v.worldEvent.id]; const row = (v.evState?.fx || []).find((r) => r.kind === 'world' && r.ev === v.worldEvent.id);
    push({ id: 'we', kind: we?.choke ? 'lock' : 'situation', group: 'flashpoints', icon: we?.i || '🌐', title: we?.n || v.worldEvent.id, sub: v.worldEvent.ans && row ? `in effect: ${row.choice}` : we?.choke ? `Chokepoint: ${we.choke}` : 'World event', months: v.worldEvent.mo, jump: { tab: 'energy' } }); }
  for (const r of v.evState?.fx || []) if (r.kind === 'flashpoint') push({ id: r.id, kind: 'timer', group: 'flashpoints', icon: FLASHPOINTS[r.ev]?.i || '⚠', title: `${FLASHPOINTS[r.ev]?.n || 'Flashpoint'} · ${REGIONS[r.rid]?.n}`, sub: `in effect: ${r.choice}`, months: r.mo, sev: 'good', jump: { tab: 'overview', region: r.rid } });
  if (v.ultimatum) push({ id: 'ult', kind: 'situation', group: 'flashpoints', icon: '☢', title: `Nuclear ultimatum · ${nat(v.ultimatum.cid)}`, sub: 'Answer it to resume', sev: 'alert', jump: { tab: 'sitroom' } });
  if (v.confrontation) push({ id: 'conf', kind: 'situation', group: 'flashpoints', icon: '⚓', title: `Blockade confrontation · ${REGIONS[v.confrontation.rid]?.n}`, sub: `${nat(v.confrontation.target)} convoy`, sev: 'alert', jump: { tab: 'overview', region: v.confrontation.rid } });
  for (const [rid, b] of Object.entries(v.blockades || {})) push({ id: `bl_${rid}`, kind: 'situation', group: 'flashpoints', icon: '🚢', title: `Blockade · ${REGIONS[rid]?.n}`, sub: `vs ${nat(b?.target)}${b?.porous ? ' · porous' : ''}`, sev: 'warn', jump: { tab: 'overview', region: rid } });

  for (const o of v.intelOps || []) { const op = INTEL_OPS.find((x) => x.id === o.opId); push({ id: o.id, kind: 'brief', group: 'ops', icon: op?.i || '🕵️', title: `${op?.n || o.opId} → ${nat(o.targetId)}`, sub: `${Math.round((o.successRate || 0) * 100)}% success · ${Math.round((o.discoverRate || 0) * 100)}% exposure`, months: o.monthsLeft, pct: op?.mo ? 1 - o.monthsLeft / op.mo : null, jump: { tab: 'intel', nation: o.targetId } }); }
  for (const [ck, on] of Object.entries(v.continuousOps || {})) { if (!on) continue; const [opId, target] = ck.split('@'); const op = INTEL_OPS.find((x) => x.id === opId); push({ id: `co_${ck}`, kind: 'brief', group: 'ops', icon: '♻️', title: `${op?.n || opId} → ${nat(target)}`, sub: 'Standing program', jump: { tab: 'intel', target } }); }
  // Issues (E9, #23): unexamined and briefed ones carry a lapse timer; deployed ones show under Builds as deployments.
  for (const i of v.issues || []) {
    const def = ISSUES[i.type]; if (!def) continue;
    if (i.status === 'unexamined') push({ id: `iss_${i.type}`, kind: 'brief', group: 'ops', icon: def.icon, title: def.title, sub: 'Unexamined · commission a brief', months: i.ttl, sev: i.ttl <= 3 ? 'alert' : 'warn', jump: { tab: 'intel', issue: i.type } });
    if (i.status === 'briefed') push({ id: `iss_${i.type}`, kind: 'brief', group: 'ops', icon: '📄', title: `Brief ready · ${def.title}`, sub: 'Deploy a policy before it lapses', months: i.ttl, sev: i.ttl <= 3 ? 'alert' : 'warn', jump: { tab: 'intel', issue: i.type } });
  }
  for (const [t, m] of Object.entries(v.investigations || {})) push({ id: `inv_${t}`, kind: 'brief', group: 'ops', icon: '🔍', title: `Brief: ${ISSUES[t]?.title || t}`, sub: 'Investigation', months: m, jump: { tab: 'intel', issue: t } });

  for(const id of new Set((v.minerals?.queue||[]).map(q=>q.id))){
    const q=programSupply(v,id).queued,p=PLATFORMS[id]||BLACK_PROGRAMS[id],first=q[0];
    push({id:'supply_'+id,kind:'build',group:'builds',icon:p?.i||'🏭',title:p?.n||id,sub:q.length+' paid order(s) awaiting '+(MINERALS[first?.binding]?.n||'materials'),months:Number.isFinite(first?.months)?first.months:undefined,sev:'warn',jump:{tab:'resources',sub:'deals',mineral:first?.binding}});
  }
  for (const [pid, d] of Object.entries(v.platformDev || {})) { const p = PLATFORMS[pid]; push({ id: `dev_${pid}`, kind: 'build', group: 'builds', icon: p?.i || '🛠️', title: `Develop ${p?.n || pid}`, sub: 'Platform development', months: d?.mo, pct: p?.dev?.mo ? 1 - (d?.mo || 0) / p.dev.mo : null, jump: { tab: 'arsenal', sub: 'procurement', platform:pid } }); }
  if (v.blackResearch) { const bp = BLACK_PROGRAMS[v.blackResearch.id]; push({ id: 'sap', kind: 'build', group: 'builds', icon: '🕶️', title: `SAP: ${bp?.n || v.blackResearch.id}`, sub: 'Special access program', pct: v.blackResearch.mo ? (v.blackResearch.prog || 0) / v.blackResearch.mo : null, months: v.blackResearch.mo ? Math.max(0, v.blackResearch.mo - (v.blackResearch.prog || 0)) : undefined, jump: { tab: 'arsenal', sub: 'programs' } }); }
  for (const [id, d] of Object.entries(v.arsenal?.dev || {})) { const bp = BLACK_PROGRAMS[id]; push({ id: `proto_${id}`, kind: 'build', group: 'builds', icon: bp?.i || '🛩️', title: `Prototype: ${bp?.n || id}`, sub: d.slipped ? 'Slipped once' : 'Prototype line', pct: d.prog / d.mo, months: d.mo - d.prog, jump: { tab: 'arsenal', sub: 'programs' } }); }
  // F9b (#57): your nodes under construction (private ports too) and the ones a host closed.
  for (const n of (v.bases?.nodes || []).filter((x) => x.owner === v.country?.id)) { const t = NODE_TYPES[n.type]; const st = SITES[n.site];
    if (n.status === 'building') push({ id: `node_${n.id}`, kind: 'build', group: 'builds', icon: t.i, title: `${t.n} · ${st.n}`, sub: t.private ? 'Private build (authorized)' : 'Under construction', months: n.mo, pct: t.mo ? 1 - n.mo / t.mo : null, jump: { tab: 'overview', site: n.site } });
    if (n.status === 'closed') push({ id: `node_${n.id}`, kind: 'lock', group: 'timers', icon: '🚫', title: `${t.n} closed · ${st.n}`, sub: 'Host consent lost; reopens once it returns', months: Math.max(0, BASE_RULES.reopenMo - (n.closed || 0)), sev: 'warn', jump: { tab: 'overview', site: n.site } }); }
  for (const d of v.deployments || []) if (d.status === 'active') push({ id: d.id, kind: 'build', group: 'builds', icon: '📋', title: d.policyName, sub: 'Policy deployment', months: Math.max(0, (d.timeMonths || 0) - (d.monthsElapsed || 0)), pct: d.timeMonths ? d.monthsElapsed / d.timeMonths : null, jump: { tab: 'intel', issue: d.issueType } });

  for (const [vert, ml] of Object.entries(v.defResearch || {})) if (ml > 0) push({ id: `rd_${vert}`, kind: 'build', group: 'research', icon: DV[vert]?.i || '🔬', title: `${DV[vert]?.n || vert} L${(v.defLevels?.[vert] || 0) + 1}`, sub: 'R&D in progress', months: ml, jump: { tab: 'technology' } });

  const timer = (id, icon, title, months, sub, jump, sev) => months > 0 && push({ id, kind: sev ? 'lock' : 'timer', group: 'timers', icon, title, sub, months, jump, sev });
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
  if (v.sprRelease) push({ id: 'spr', kind: 'timer', group: 'timers', icon: '🛢️', title: 'SPR release', sub: 'Drawing down the reserve', jump: { tab: 'energy' } });

  const cdLabel = { visit: 'State visit', aid: 'Aid package', bc: 'Back-channel', interv: 'Intervention', demo: 'Demonstration' };
  for (const [k, m] of Object.entries(v.actionCooldowns || {})) {
    if (!(m > 0) || k.startsWith('issue_')) continue; const [kind, ...rest] = k.split('_'); const who = rest.join('_');
    push({ id: `cd_${k}`, kind: 'timer', group: 'cooldowns', icon: '🧊', title: `${cdLabel[kind] || cap(kind)}${who ? ` · ${nat(who)}` : ''}`, sub: 'Cooldown', months: m, jump: { tab: kind === 'interv' ? 'energy' : kind === 'bc' || kind === 'demo' ? 'intel' : 'trade', nation: NATIONS[who] ? who : undefined } });
  }
  return rows.map((r) => decorate(r, v));
}

// FIX 2: every row acts. `explain` is the row's own account (shown inline for timers and cooldowns, as a tooltip elsewhere);
// `jump.card` names the dock card to focus, `jump.pan` the region the map pans to, `jump.op` the operation whose detail opens.
const pct = (x) => `${Math.round((x || 0) * 100)}%`;
export function decorate(r, v) {
  const j = { ...r.jump }; let explain = r.sub || '';
  const id = String(r.id);
  if (id === 'fp' && v.flashpoint) { const fp = FLASHPOINTS[v.flashpoint.type]; j.card = 'flashpoint'; j.pan = v.flashpoint.rid; explain = `${fp?.n || 'Flashpoint'} in ${REGIONS[v.flashpoint.rid]?.n}: ${v.flashpoint.t} months to respond. ${fp?.d || ''} Ignoring it cedes ground (−5 you, +12 rivals). The card is in the dock; the map pans to the region.`; }
  else if (id === 'we' && v.worldEvent) { const we = WORLD_EVENTS[v.worldEvent.id]; j.tab = 'overview'; j.card = 'world'; const rid = we?.choke ? CHOKEPOINTS[we.choke]?.region : null; if (rid) j.pan = rid; explain = `${we?.n || v.worldEvent.id}: ${v.worldEvent.mo} months left.${we?.choke ? ` Chokepoint ${CHOKEPOINTS[we.choke]?.n || we.choke}.` : ''} ${typeof we?.d === 'string' ? we.d : ''} Answer it on the card in the dock.`; }
  else if (id === 'ult') explain = 'A rival has put strategic forces on alert. The clock holds until you answer the ultimatum (stand down, hold the line, or counter-threaten).';
  else if (id === 'conf') explain = 'A convoy is testing your blockade. The clock holds until you answer (enforce, board, or let it pass).';
  else if (id.startsWith('bl_')) explain = 'Your blockade: $120M a month, their sphere strangled, arms lanes cut. Lift it from the region card (Overview) when it has done its work.';
  else if (r.group === 'ops' && r.months != null && !id.startsWith('iss_') && !id.startsWith('inv_') && !id.startsWith('co_')) { const o = (v.intelOps || []).find((x) => x.id === r.id); if (o) { j.op = o.id; j.target = o.targetId; const op = INTEL_OPS.find((x) => x.id === o.opId); explain = `${op?.n || o.opId} against ${nat(o.targetId)}: ${pct(o.successRate)} success, ${pct(o.discoverRate)} exposure, ${o.monthsLeft} months to resolution. Opens the operation on the Intel tab.`; } }
  else if (id.startsWith('co_')) explain = 'A standing program relaunches this operation after completion when its requirements are met. Manage it on the Intel tab.';
  else if (id.startsWith('iss_')) explain = r.sub.startsWith('Unexamined') ? 'An issue the cabinet has not examined. Commission a brief on the Intel tab before the lapse timer runs out.' : 'The brief is ready: deploy one of its policies on the Intel tab before it lapses.';
  else if (id.startsWith('inv_')) explain = 'An investigation in progress: the brief lands when the months run out.';
  else if (id.startsWith('dev_') || id === 'sap' || id.startsWith('proto_')) explain = `${r.title}: ${r.months != null ? `${r.months} months to go` : 'in progress'}. Opens the program on the Arsenal tab.`;
  else if (id.startsWith('node_')) explain = r.group === 'builds' ? `${r.title}: ${r.months} months until the node is online. Opens the site on the map.` : `${r.title}: the host withdrew consent; it reopens in ${r.months} months once consent returns. Opens the site on the map.`;
  else if (id.startsWith('rd_')) explain = `${r.title}: ${r.months} months of research left. Opens the Technology tab.`;
  else if (id === 'briefing') explain = `Decisions arrive at the quarterly cabinet briefing (January, April, July, October), one at a time, never within 3 months of a world event. Next briefing in ${r.months} months.`;
  else if (id === 'grace') explain = `Rivals hold back for ${r.months} more months: no pressure, no demonstrations, no ultimatums. Use it to build.`;
  else if (id === 'pariah') explain = `Pariah status after a nuclear act: arms buyers close their markets for ${r.months} more months.`;
  else if (id === 'heg') explain = `Hegemony hold: ${v.hegHold}/24 months above 85%. ${r.months} more months at 85% win the era.`;
  else if (id === 'embby') explain = `${nat(v.embargoedBy?.by)} embargoes your energy imports for ${r.months} more months: import contracts pay more. A back-channel on the Energy tab can end it early.`;
  else if (id.startsWith('exp_')) explain = `Their station stays closed for ${r.months} months after the expulsion.`;
  else if (id.startsWith('lock_')) explain = `Persona non grata: no embassy there for ${r.months} months.`;
  else if (id.startsWith('bloc_')) explain = `Bloc frozen for ${r.months} months after a sanction on a member: tier progress pauses.`;
  else if (id.startsWith('conc_')) explain = `Concession ramping up: ${r.months} months to full output.`;
  else if (id === 'spr') explain = 'The strategic reserve is releasing: lower import cost while it lasts. Stop it on the Energy tab.';
  else if (id.startsWith('cd_')) explain = `${r.title}: ${r.months} months before you can do this again.`;
  else if (r.group === 'builds' && v.deployments?.some((d) => d.id === r.id)) explain = `${r.title}: ${r.months} months of the policy deployment left. Opens the issue on the Intel tab.`;
  return { ...r, jump: j, explain };
}

export const counts = (rows) => rows.reduce((a, r) => { a[r.group] = (a[r.group] || 0) + 1; return a; }, {});
