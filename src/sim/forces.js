// E8 (#20): troops, training, force quality and SOF tiers. One implementation of the monthly step, the crew gate and the view,
// shared by the month (tick.js), the deploy verb (actions.js) and the Defense tab. Multipliers live in formulas.js.
// State g.forces: active, reserve, retention (0..100), recruits, attrition (last month), quality (0..100, lags forceQuality),
// train (TRAINING index), readiness {land,air,sea}, crews {land,air,sea} (trained crew sets), pipe [{b,mo}] (crews in training),
// sof {t2, t1, pipes:[{t,mo}]}.
// F7 (#55, spec Part 9) adds the tangible order of battle: active and reserve become headcounts (base: the 2024 strength they are
// measured against), nid, q0 (quality at the start), crewShare {branch: share of active that crews its fleet}, depot (throughput %),
// fleet {line: {n, mc, mx, blk, mod, loss, lost, at:{region:n}}} over src/data/orbat.js, fielded {unit: count already in the fleet}.
import { FORCE_RULES as R, FLEET_RULES as FL, TRAINING, SOF_RULES, SOF_UNITS, SOF_START, SOF_DEFAULT, BRANCHES, BRANCH_IDS, crewOf } from '../data/forces.js';
import { ORBAT, MANPOWER, UNIT_PLATFORMS, crewHeads, crewOfLine, manpowerCap } from '../data/orbat.js';
import { NATIONS } from '../data/nations.js';
import { PLATFORMS, BLACK_PROGRAMS } from '../data/platforms.js';
import { forceQuality, forceMult, tier1Power, qualityF, manPts, lineW, typeQ, qualMC, fleetFill, fillOf, lineAvail, blkF, lineReady, equipF } from './formulas.js';

const cl = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const per = (b) => Object.fromEntries(BRANCH_IDS.map((k) => [k, b(k)]));
export function newForces(nid, stats) {
  const s = R.start; const sof = SOF_START[nid] || SOF_DEFAULT;
  const f = { active: s.active, reserve: s.reserve, retention: s.retention, recruits: 0, attrition: 0, quality: forceQuality(stats),
    train: s.train, readiness: per(() => s.readiness), crews: per((b) => R.spare[b]), pipe: [], sof: { t2: sof.t2, t1: sof.t1, pipes: [] } };
  return withFleet(f, nid, {}, stats);
}
// F7: headcounts from MANPOWER and the 2024 fleet from ORBAT. A pre-F7 force (index strength) converts in place of its index points.
const home = (nid) => NATIONS[nid]?.region;
const newLine = (l, nid) => ({ n: l.count, mc: l.mc, mx: 100, blk: 0, mod: 0, loss: 0, lost: 0, at: l.count ? { [home(nid)]: l.count } : {} });
function withFleet(f, nid, fielded, ns) {
  const m = MANPOWER[nid]; if (!m || f.base) return f;
  const ls = ORBAT[nid] || [];
  const need = per((b) => ls.filter((l) => l.b === b && !l.reserve).reduce((a, l) => a + crewHeads(l), 0));
  return { ...f, nid, base: { active: m.active, reserve: m.reserve, labor: recruitLabor(ns || {}), stab: stabProp(ns || {}) }, active: m.active * f.active / R.start.active, reserve: m.reserve * f.reserve / R.start.reserve,
    q0: f.quality, depot: 100, crewShare: per((b) => need[b] / m.active * (1 + FL.crewSlack)), prop: Math.min(1, propensity0(m)),
    fleet: Object.fromEntries(ls.map((l) => [l.id, newLine(l, nid)])), fielded: { ...fielded } };
}
const F = (g) => { const f = g.forces || newForces(g.country?.id, g.stats); return f.base || !g.country ? f : withFleet(f, g.country.id, ownedOf(g), g.stats); };
export const crewPool = (f, b) => manPts(f).active * R.crewPer[b];

// Units owned (domestic + imported + programs) and deployed, as crew sets needed per branch.
const ownedOf = (g) => {
  const o = {};
  for (const [k, n] of Object.entries(g.platforms || {})) o[k] = (o[k] || 0) + (n || 0);
  for (const [k, n] of Object.entries(g.platformsImported || {})) o[k] = (o[k] || 0) + (n || 0);
  for (const [k, n] of Object.entries(g.blackPrograms || {})) o[k] = (o[k] || 0) + (+n || 0);
  return o;
};
const crewSum = (units) => { const by = per(() => 0); for (const [k, n] of Object.entries(units)) { const c = crewOf(k); by[c.b] += c.n * (n || 0); } return by; };
const deployedUnits = (g) => { const o = {}; for (const dep of Object.values(g.forceDeployments || {})) for (const [k, n] of Object.entries(dep || {})) o[k] = (o[k] || 0) + (n || 0); return o; };

// Per branch: crew sets needed by owned units, held by deployed units, trained, in the pipeline; gap = owned need not covered.
export function crewStatus(g) {
  const f = F(g); const need = crewSum(ownedOf(g)); const dep = crewSum(deployedUnits(g));
  return per((b) => { const crews = Math.floor(f.crews?.[b] || 0); return { need: need[b], deployed: dep[b], crews, free: crews - dep[b], pool: Math.floor(crewPool(f, b)), pipe: (f.pipe || []).filter((p) => p.b === b).length, gap: Math.max(0, need[b] - crews) }; });
}
// Crew gate for stationing one unit: null when crews are free, else the reason (shown, never silent).
export function crewBlock(g, pid) {
  const c = crewOf(pid); if (!c.n) return null;
  const st = crewStatus(g)[c.b];
  if (st.free >= c.n) return null;
  const nm = (PLATFORMS[pid] || BLACK_PROGRAMS[pid])?.n || pid;
  return `${nm} has no trained crews — ${c.b} crews ${Math.max(0, st.free)}/${c.n} free (${st.pipe} in training)`;
}

export const payrollOf = (f) => { if (!f) return 0; const p = manPts(f); return p.active * R.payroll.active + p.reserve * R.payroll.reserve + f.sof.t2 * R.payroll.t2 + f.sof.t1 * R.payroll.t1; };
export const trainingCost = (f) => TRAINING[f.train].cost + f.sof.pipes.reduce((a, p) => a + (p.t === 2 ? SOF_RULES.t2Cost : SOF_RULES.t1Cost), 0);
// Retention target as signed terms (the UI's why-breakdown); the target is their sum, clamped. Same operations in the same order as before.
export const retentionTerms = (pay, ns) => [
  { key: 'base', label: 'Baseline', value: 40 },
  { key: 'pay', label: `Pay ${Math.round(pay)}% vs civilian wages`, value: (pay - 100) * R.payW },
  { key: 'stab', label: 'Stability', value: ((ns.stability || 0) - 50) * R.stabW },
  { key: 'civ', label: 'Civilian pull (growth above 2%)', value: -(Math.max(0, (ns.gdpGrowth || 0) - 2) * R.civW) },
  { key: 'jobs', label: 'Slack labor market', value: ((ns.unemployment || 0) - 5) * R.unempW },
];
export const retentionTarget = (pay, ns) => cl(retentionTerms(pay, ns).reduce((a, t) => a + t.value, 0));
// Labor-market factor on recruitment (unemployment); recruits/mo = recruit x laborFactor x pay/100.
export const recruitLabor = (ns) => cl(0.5 + (ns.unemployment || 0) / 10, 0.5, 2);
const exerciseBranches = (g) => {
  const out = new Set();
  for (const [rid, dep] of Object.entries(g.forceDeployments || {})) if (g.forcePosture?.[rid] === 'exercise') for (const [k, n] of Object.entries(dep || {})) if (n > 0) out.add(crewOf(k).b);
  return out;
};
const readinessTarget = (f, b, ex) => TRAINING[f.train].target + (ex.has(b) ? R.exercise.target : 0);
const selectionMo = (q) => Math.round(SOF_RULES.t1MoMax - (SOF_RULES.t1MoMax - SOF_RULES.t1MoMin) * cl(q) / 100);

// The month. cash(k,v) is the ledger; ns the month's stats. No rng: deterministic in state alone.
export function stepForces(g, S, fx, cash, ns) {
  if (!g.country) return;
  const f0 = F(g); const pay = Math.max(0, g.personnelPay ?? 100);
  // Manpower: recruitment (population slack, pay), retention (pay vs civilian wages, stability), attrition into the reserve.
  const retention = cl(f0.retention + (retentionTarget(pay, ns) - f0.retention) * R.retLag);
  const mp = f0.base ? manpowerStep(f0, ns, pay, retention) : indexStep(f0, ns, pay, retention);
  const { active, reserve, recruits, attrition } = mp;
  const quality = cl(f0.quality + (forceQuality(ns) - f0.quality) * R.qualityLag);
  // Training: budget level sets the readiness each branch converges to; Joint Exercises posture lifts the exercising branches.
  const ex = exerciseBranches(g);
  const readiness = per((b) => {
    const r = f0.readiness[b]; const t = readinessTarget(f0, b, ex);
    return cl(r < t ? Math.min(t, r + R.riseMo + (ex.has(b) ? R.exercise.rise : 0)) : Math.max(t, r - R.decayMo));
  });
  cash('Training', -trainingCost(f0));
  // Crews: attrition with retention, pipeline completions, new starts toward owned need + spares, capped by the trained pool.
  const crews = per((b) => (f0.crews[b] || 0) * (1 - (1 - retention / 100) * R.crewAttrition));
  const pipe = [];
  for (const p of f0.pipe) { if (p.mo > 1) pipe.push({ ...p, mo: p.mo - 1 }); else crews[p.b] += 1; }
  const need = crewSum(ownedOf(g)); const rate = TRAINING[f0.train].crews;
  for (const b of BRANCH_IDS) {
    const want = need[b] + R.spare[b] - Math.floor(crews[b]) - pipe.filter((p) => p.b === b).length;
    for (let i = 0; i < Math.min(rate, want); i++) pipe.push({ b, mo: R.pipeMo[b] });
    crews[b] = Math.min(crews[b], crewPool({ ...f0, active }, b));
  }
  // SOF pipelines.
  const sof = { ...f0.sof, pipes: [] };
  for (const p of f0.sof.pipes) {
    if (p.mo > 1) { sof.pipes.push({ ...p, mo: p.mo - 1 }); continue; }
    const k = p.t === 2 ? 't2' : 't1'; sof[k] = Math.min(SOF_RULES.max[k], sof[k] + 1);
    const u = SOF_UNITS[g.country.id] || {}; fx.toast(`🎖️ ${p.t === 2 ? u.t2 || 'Tier 2' : u.t1 || 'Tier 1'}: a new ${p.t === 2 ? 'Tier 2 unit' : 'Tier 1 squadron'} is operational`);
  }
  const f1 = { ...f0, active, reserve, retention, recruits, attrition, quality, readiness, crews, pipe, sof, ...(mp.prop != null ? { prop: mp.prop } : {}) };
  setF(g, S, f0.fleet ? stepFleet(g, f1, fx, cash) : f1);
}
// Pre-F7 index manpower (forces of a nation without MANPOWER).
function indexStep(f0, ns, pay, retention) {
  const recruits = R.recruit * recruitLabor(ns) * pay / 100;
  const attrition = f0.active * R.attrition * (2 - retention / 50);
  return { recruits, attrition, active: cl(f0.active + recruits - attrition), reserve: cl(f0.reserve + attrition * R.reserveIn - f0.reserve * R.reserveOut) };
}
// F7 headcounts. The recruiting window's eligible cohort enters at cohort x elig / cohortYears a year; propensity (the share who enlist)
// starts at the 2024 accessions and moves with unemployment, pay and stability relative to the start, never above 1. Baseline turnover is
// the 2024 intake over the 2024 force (conscripts cycle fast), so 2024 conditions hold 2024 strength; retention below 50 adds the E8
// exits on top (R.attrition x (1 - retention/50)). The reserve drains so the 2024 reserve is its equilibrium. Active + reserve never pass
// the eligible military-age population (manpowerCap).
const propensity0 = (m) => m.accessions * m.cohortYears / (m.cohort * m.elig);
export const stabProp = (ns) => 0.8 + 0.4 * cl(ns.stability ?? 50) / 100;
export const propensityOf = (m, ns, pay, base) => Math.min(1, propensity0(m) * recruitLabor(ns) / (base?.labor || 1) * pay / 100 * stabProp(ns) / (base?.stab || 1));
export const intakeMax = (m) => m.cohort * m.elig / m.cohortYears / 12;
function manpowerStep(f0, ns, pay, retention) {
  const m = MANPOWER[f0.nid]; const cap = manpowerCap(f0.nid);
  const prop = propensityOf(m, ns, pay, f0.base);
  const a0 = m.accessions / m.active / 12; const out = m.accessions / 12 * R.reserveIn / m.reserve;
  const attrition = f0.active * Math.max(0, a0 + R.attrition * (1 - retention / 50));
  const reserve = Math.max(0, f0.reserve + attrition * R.reserveIn - f0.reserve * out);
  const recruits = Math.max(0, Math.min(intakeMax(m) * prop, cap - Math.max(0, f0.active - attrition) - reserve));
  const active = Math.max(0, Math.min(cap - reserve, f0.active + recruits - attrition));
  return { active, reserve, recruits, attrition, prop };
}

// ── F7 fleet: procurement into existing lines, attrition, modernization, mission-capable rates, the Maintenance and Depot ledger lines.
const lineOf = (nid, id) => (ORBAT[nid] || []).find((l) => l.id === id);
// The line a unit's procurement lands in: the line that `buys` it, else the newest line of the unit's role, else none (no fleet line).
export function buyLine(nid, unit) {
  const ls = ORBAT[nid] || []; const role = UNIT_PLATFORMS[unit]?.role;
  return ls.find((l) => l.buys?.includes(unit)) || ls.filter((l) => l.role === role).sort((a, b) => (b.gen || 0) - (a.gen || 0))[0] || null;
}
const addAt = (at, rid, k) => ({ ...at, [rid]: (at[rid] || 0) + k });
// Remove k platforms, the home theater first.
function takeAt(at, k, rid0) {
  const o = { ...at }; let left = k;
  for (const rid of [rid0, ...Object.keys(o).filter((r) => r !== rid0)]) { const d = Math.min(left, o[rid] || 0); if (d) { o[rid] -= d; left -= d; } if (!o[rid]) delete o[rid]; }
  return o;
}
const maintCost = (f, pctOf = (s) => s.mx) => Object.entries(f.fleet).reduce((a, [id, s]) => { const l = lineOf(f.nid, id); return a + (l ? s.n * lineW(l) * FL.om * pctOf(s) / 100 : 0); }, 0);
const depotCost = (f) => maintCost(f, () => 100) * FL.depotCost * Math.pow((f.depot ?? 100) / 100, 1.5);
export function mcTarget(f, l, s) {
  const maint = Math.min(FL.maintCap, Math.pow(s.mx / 100, FL.maintExp));
  const depot = Math.min(1.05, Math.pow((f.depot ?? 100) / 100, FL.depotExp));
  return cl(l.mc * maint * depot * qualMC(f, l) * (1 + FL.mcBlk * s.blk));
}
function stepFleet(g, f, fx, cash) {
  const nid = f.nid; const rid0 = home(nid); const owned = ownedOf(g);
  const fleet = { ...f.fleet }; const fielded = { ...f.fielded };
  // Procurement adds to existing fleets: every newly owned unit lands per-unit platforms in its line; a decommissioned unit takes them out.
  for (const u of new Set([...Object.keys(owned), ...Object.keys(fielded)])) {
    const d = (owned[u] || 0) - (fielded[u] || 0); if (!d) continue;
    fielded[u] = owned[u] || 0; const l = buyLine(nid, u); if (!l || !UNIT_PLATFORMS[u]) continue;
    const s = fleet[l.id] || newLine({ ...l, count: 0 }, nid); const k = d * UNIT_PLATFORMS[u].per;
    fleet[l.id] = k > 0 ? { ...s, n: s.n + k, at: addAt(s.at, rid0, k) } : { ...s, n: Math.max(0, s.n + k), at: takeAt(s.at, Math.min(s.n, -k), rid0) };
  }
  const rate = Math.min(1, FL.converge * (f.depot ?? 100) / 100);
  for (const [id, s0] of Object.entries(fleet)) {
    const l = lineOf(nid, id); if (!l) continue;
    let s = { ...s0 };
    // Attrition (peacetime mishaps): fractional losses accumulate; a whole airframe is struck off.
    s.loss += s.n * (FL.lossYr[l.cls] || 0) / 12;
    while (s.loss >= 1 && s.n > 0) { s.loss -= 1; s.n -= 1; s.lost += 1; s.at = takeAt(s.at, 1, rid0); }
    if (s.n === 0) s.loss = 0;
    if (s.mod > 0) { s.mod -= 1; if (s.mod === 0) { s.blk += 1; fx.toast(`🔧 ${l.n}: block ${s.blk} upgrade complete (+${Math.round(FL.blkGain * 100)}% effectiveness)`); } }
    s.mc = cl(s.mc + (mcTarget({ ...f, fleet }, l, s) - s.mc) * rate);
    fleet[id] = s;
  }
  const f1 = { ...f, fleet, fielded };
  cash('Maintenance', -Math.round(maintCost(f1))); cash('Depot', -Math.round(depotCost(f1)));
  return f1;
}

const setF = (g, S, v) => { g.forces = v; S.setForces(v); };

// ── Verbs. Each toasts its outcome; blocked verbs change nothing.
function setTraining(g, S, fx, level) {
  const f = F(g); const l = Math.round(+level); if (!TRAINING[l]) return;
  setF(g, S, { ...f, train: l }); fx.toast(`🎯 Training budget: ${TRAINING[l].n} — $${TRAINING[l].cost}M/mo, readiness → ${TRAINING[l].target}`);
}
const pipesOf = (f, t) => f.sof.pipes.filter((p) => p.t === t).length;
function trainSof(g, S, fx) {
  const f = F(g); const u = SOF_UNITS[g.country?.id] || {};
  if (f.sof.pipes.length >= SOF_RULES.maxPipes) { fx.toast(`⚠ ${SOF_RULES.maxPipes} SOF pipelines already running`); return; }
  if (f.sof.t2 + pipesOf(f, 2) >= SOF_RULES.max.t2) { fx.toast('⚠ Tier 2 at its ceiling'); return; }
  if ((g.stats?.treasury || 0) < SOF_RULES.t2Cost) { fx.toast(`⚠ Need $${SOF_RULES.t2Cost}M/mo`); return; }
  setF(g, S, { ...f, sof: { ...f.sof, pipes: [...f.sof.pipes, { t: 2, mo: SOF_RULES.t2Mo }] } });
  fx.toast(`🎖️ ${u.t2 || 'Tier 2'} pipeline — ${SOF_RULES.t2Mo}mo, $${SOF_RULES.t2Cost}M/mo`);
}
function selectTier1(g, S, fx) {
  const f = F(g); const u = SOF_UNITS[g.country?.id] || {};
  if (f.sof.t2 < 1) { fx.toast(`⚠ No ${u.t2 || 'Tier 2'} candidates — selection draws on Tier 2`); return; }
  if (f.sof.pipes.length >= SOF_RULES.maxPipes) { fx.toast(`⚠ ${SOF_RULES.maxPipes} SOF pipelines already running`); return; }
  if (f.sof.t1 + pipesOf(f, 1) >= SOF_RULES.max.t1) { fx.toast('⚠ Tier 1 at its ceiling'); return; }
  if ((g.stats?.treasury || 0) < SOF_RULES.t1Cost) { fx.toast(`⚠ Need $${SOF_RULES.t1Cost}M/mo`); return; }
  const mo = selectionMo(f.quality);
  setF(g, S, { ...f, sof: { ...f.sof, t2: f.sof.t2 - 1, pipes: [...f.sof.pipes, { t: 1, mo }] } });
  fx.toast(`🎖️ ${u.t1 || 'Tier 1'} selection from ${u.t2 || 'Tier 2'} — ${mo}mo at quality ${Math.round(f.quality)}, $${SOF_RULES.t1Cost}M/mo`);
}
// F7 verbs: maintenance per type, depot throughput, block upgrades, retirement. Rebasing between theaters waits for F9c (#57):
// `at` already holds where each line sits and theaterCapability reads it.
const pct = (v) => Math.max(0, Math.min(FL.pctMax, Math.round(+v)));
function setMaintenance(g, S, fx, { line, pct: p }) {
  const f = F(g); if (!f.fleet || !Number.isFinite(+p)) return;
  const ids = line === 'all' ? Object.keys(f.fleet) : f.fleet[line] ? [line] : [];
  if (!ids.length) { fx.toast('⚠ No such fleet line'); return; }
  const v = pct(p); const fleet = { ...f.fleet }; for (const id of ids) fleet[id] = { ...fleet[id], mx: v };
  const f1 = { ...f, fleet }; setF(g, S, f1);
  const nm = line === 'all' ? 'all types' : lineOf(f.nid, line).n;
  fx.toast(`🔧 Maintenance ${nm}: ${v}% — $${Math.round(maintCost(f1))}M/mo${line === 'all' ? '' : `, MC → ${Math.round(mcTarget(f1, lineOf(f.nid, line), fleet[line]))}%`}`);
}
function setDepot(g, S, fx, { pct: p }) {
  const f = F(g); if (!f.fleet || !Number.isFinite(+p)) return;
  const f1 = { ...f, depot: pct(p) }; setF(g, S, f1);
  fx.toast(`🏭 Depot throughput ${f1.depot}% — $${Math.round(depotCost(f1))}M/mo, block upgrades take ${modMonths(f1)} months`);
}
export const modMonths = (f) => Math.ceil(FL.modMo * 100 / Math.max(10, f.depot ?? 100));
export const modCostOf = (l, s) => Math.round(s.n * lineW(l) * FL.modCost);
// The reason a block upgrade is refused, or null.
export function modBlock(g, f, id) {
  const l = lineOf(f.nid, id); const s = f.fleet?.[id];
  if (!l || !s) return 'No such fleet line';
  if (s.n < 1) return `No ${l.n} in service`;
  if (s.mod > 0) return `${l.n} already in the depot (${s.mod} months)`;
  if (s.blk >= FL.maxBlk) return `${l.n} at its last block`;
  if ((g.stats?.treasury || 0) < modCostOf(l, s)) return `Need $${modCostOf(l, s)}M`;
  return null;
}
function modernize(g, S, fx, { line }) {
  const f = F(g); const why = modBlock(g, f, line); if (why) { fx.toast(`⚠ ${why}`); return; }
  const l = lineOf(f.nid, line); const s = f.fleet[line]; const cost = modCostOf(l, s); const mo = modMonths(f);
  S.setStats((p) => ({ ...p, treasury: p.treasury - cost }));
  setF(g, S, { ...f, fleet: { ...f.fleet, [line]: { ...s, mod: mo } } });
  fx.toast(`🔧 ${l.n}: block ${s.blk + 1} upgrade — $${cost}M, ${mo} months, ${Math.round(FL.modShare * 100)}% of the fleet in the depot meanwhile`);
}
function retire(g, S, fx, { line, n }) {
  const f = F(g); const l = lineOf(f.nid, line); const s = f.fleet?.[line];
  if (!l || !s) { fx.toast('⚠ No such fleet line'); return; }
  const k = Math.min(s.n, Math.max(1, Math.round(+n || 1)));
  if (!s.n) { fx.toast(`⚠ No ${l.n} left to retire`); return; }
  const before = maintCost(f); const f1 = { ...f, fleet: { ...f.fleet, [line]: { ...s, n: s.n - k, at: takeAt(s.at, k, home(f.nid)) } } };
  setF(g, S, f1);
  fx.toast(`📦 Retired ${k} ${l.n} — ${s.n - k} left, saves $${Math.round(before - maintCost(f1))}M/mo maintenance`);
}
export const FORCE_VERBS = {
  setMaintenance: (g, S, fx, p) => setMaintenance(g, S, fx, p || {}),
  setDepot: (g, S, fx, p) => setDepot(g, S, fx, p || {}),
  modernize: (g, S, fx, p) => modernize(g, S, fx, p || {}),
  retire: (g, S, fx, p) => retire(g, S, fx, p || {}),
  setTraining: (g, S, fx, { level }) => setTraining(g, S, fx, level),
  trainSof: (g, S, fx) => trainSof(g, S, fx),
  selectTier1: (g, S, fx) => selectTier1(g, S, fx),
};

// The Defense tab's Forces panel: every number from the same rules as the month.
export function forceView(g) {
  const f = F(g); const pay = Math.max(0, g.personnelPay ?? 100); const s = g.stats || {};
  const ex = exerciseBranches(g); const cs = crewStatus(g);
  const branches = BRANCHES.map(([id, n]) => {
    const r = f.readiness[id]; const t = readinessTarget(f, id, ex);
    const decayMo = r < 50 ? 0 : t < 50 && r > t ? Math.ceil((r - 50) / R.decayMo) : null;
    return { id, n, readiness: r, target: t, exercise: ex.has(id), decayMo, mult: forceMult(f, id), ...cs[id] };
  });
  const drivers = [['education', 'Education', 0.30], ['healthcare', 'Healthcare', 0.20], ['foodSecurity', 'Food security', 0.15], ['stability', 'Stability', 0.20], ['inequality', 'Equality (100 − inequality)', 0.15]]
    .map(([k, label, w]) => ({ k, label, w, v: k === 'inequality' ? 100 - (s[k] ?? 100) : s[k] || 0 }));
  return { ...f, idx: manPts(f), pay, retTarget: retentionTarget(pay, s), qTarget: forceQuality(s), qMult: qualityF(f.quality), drivers, levels: TRAINING, branches,
    retTerms: retentionTerms(pay, s), labor: recruitLabor(s), payroll: payrollOf(f) * pay / 100, training: trainingCost(f), units: SOF_UNITS[g.country?.id] || {}, tier1: tier1Power(f),
    selectionMo: selectionMo(f.quality), sofRules: SOF_RULES };
}

// ── F7 views. Capability per theater = platforms present x MC x crews x quality x block x basing.
// TODO(#57, F9c): basing multiplier per theater and line (air bases in reach raise sorties, naval bases sustainment). 1 until F9c wires it.
export const basingMult = (g, rid, l) => 1; // eslint-disable-line no-unused-vars
export function theaterCapability(g, rid) {
  const f = F(g); if (!f.fleet) return 0; const fill = fleetFill(f).fill;
  return Object.entries(f.fleet).reduce((a, [id, s]) => { const l = lineOf(f.nid, id); return a + (l && s.at[rid] ? lineReady(f, l, fill, s.at[rid]) * basingMult(g, rid, l) : 0); }, 0);
}
// Every number on the Equipment and Manpower screens, from the same rules as the month.
export function fleetView(g) {
  const f = F(g); if (!f.fleet) return null;
  const { fill, need } = fleetFill(f); const m = MANPOWER[f.nid]; const s0 = g.stats || {}; const pay = Math.max(0, g.personnelPay ?? 100);
  const lines = (ORBAT[f.nid] || []).filter((l) => f.fleet[l.id]).map((l) => {
    const s = f.fleet[l.id]; const fl = fillOf(fill, l); const crewed = Math.floor(s.n * fl + 1e-9);
    const ready = Math.floor(crewed * lineAvail(s) * s.mc / 100 + 1e-9); const c = crewOfLine(l);
    return { id: l.id, n: l.n, b: l.b, cls: l.cls, role: l.role, gen: l.gen, reserve: !!l.reserve, count: s.n, count2024: l.count, mc: s.mc, mc2024: l.mc,
      target: mcTarget(f, l, s), mx: s.mx, blk: s.blk, mod: s.mod, lost: s.lost, at: s.at, crewed, ready, unready: s.n - ready, crewless: s.n - crewed,
      crewRatio: c.sets, crewSize: c.heads, maintainers: c.mx, heads: crewHeads(l, s.n), quality: typeQ(f.quality, l), cost: s.n * lineW(l) * FL.om * s.mx / 100,
      modCost: modCostOf(l, s), modWhy: modBlock(g, f, l.id), buys: l.buys || [], status_source: l.status_source };
  });
  const branches = BRANCHES.map(([b, n]) => ({ id: b, n, fill: fill[b], need: need[b], pool: (f.active || 0) * (f.crewShare?.[b] || 0), equip: equipF(f, b),
    count: lines.filter((x) => x.b === b).reduce((a, x) => a + x.count, 0), ready: lines.filter((x) => x.b === b).reduce((a, x) => a + x.ready, 0) }));
  return { lines, branches, depot: f.depot ?? 100, maintenance: maintCost(f), depotCost: depotCost(f), modMo: modMonths(f), rules: FL,
    manpower: m && { active: f.active, reserve: f.reserve, base: f.base, cap: manpowerCap(f.nid), prop: propensityOf(m, s0, pay, f.base), prop0: propensity0(m),
      intakeMax: intakeMax(m), recruits: f.recruits, attrition: f.attrition, labor: recruitLabor(s0), stab: stabProp(s0), status_source: m.status_source } };
}
