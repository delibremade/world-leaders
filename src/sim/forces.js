// E8 (#20): troops, training, force quality and SOF tiers. One implementation of the monthly step, the crew gate and the view,
// shared by the month (tick.js), the deploy verb (actions.js) and the Defense tab. Multipliers live in formulas.js.
// State g.forces: active, reserve, retention (0..100), recruits, attrition (last month), quality (0..100, lags forceQuality),
// train (TRAINING index), readiness {land,air,sea}, crews {land,air,sea} (trained crew sets), pipe [{b,mo}] (crews in training),
// sof {units:{id:{ops, out:[{op, tgt, mo, rec}]}}, pipes:[{u, t, mo, n}]} over src/data/sof.js (F8, #56: named units, operators).
// F7 (#55, spec Part 9) adds the tangible order of battle: active and reserve become headcounts (base: the 2024 strength they are
// measured against), nid, q0 (quality at the start), crewShare {branch: share of active that crews its fleet}, depot (throughput %),
// fleet {line: {n, mc, mx, blk, mod, loss, lost, at:{region:n}}} over src/data/orbat.js, fielded {unit: count already in the fleet}.
// #91: with a fleet, crews {land,air,sea} are trained crew headcounts, pipe [{b,mo,n}] cohorts of n trainees, cap {branch: heads/mo of
// pipeline throughput}, crewFund (0..150 %), crewWhy {branch: {starts, want, limits:{funding,pipeline,manpower}, binding}} from the month.
import { FORCE_RULES as R, FLEET_RULES as FL, TRAINING, SOF_UNITS, BRANCHES, BRANCH_IDS, crewOf } from '../data/forces.js';
import { SOF_RULES, OP_NAMES, sofOrbat, sofUnit, unitCap, freeSubs, freeOps, sofOps, sofFree, pickUnit, subsN } from '../data/sof.js';
import { INTEL_OPS } from '../data/intel.js';
import { ORBAT, MANPOWER, UNIT_PLATFORMS, crewHeads, crewOfLine, manpowerCap } from '../data/orbat.js';
import { NATIONS } from '../data/nations.js';
import { PLATFORMS, BLACK_PROGRAMS } from '../data/platforms.js';
import { forceQuality, forceMult, tier1Power, qualityF, manPts, lineW, typeQ, qualMC, fleetFill, fillOf, lineAvail, blkF, lineReady, equipF } from './formulas.js';

const cl = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const per = (b) => Object.fromEntries(BRANCH_IDS.map((k) => [k, b(k)]));
const CP = FL.crewPipe;
export function newForces(nid, stats) {
  const s = R.start;
  const f = { nid, active: s.active, reserve: s.reserve, retention: s.retention, recruits: 0, attrition: 0, quality: forceQuality(stats),
    train: s.train, readiness: per(() => s.readiness), crews: per((b) => R.spare[b]), pipe: [], sof: newSof(nid) };
  return withFleet(f, nid, {}, stats);
}
// F7: headcounts from MANPOWER and the 2024 fleet from ORBAT. A pre-F7 force (index strength) converts in place of its index points.
const home = (nid) => NATIONS[nid]?.region;
const newLine = (l, nid) => ({ n: l.count, mc: l.mc, mx: 100, blk: 0, mod: 0, loss: 0, lost: 0, at: l.count ? { [home(nid)]: l.count } : {} });
function withFleet(f, nid, fielded, ns) {
  const m = MANPOWER[nid]; if (!m || f.base) return f;
  const ls = ORBAT[nid] || [];
  const need = per((b) => ls.filter((l) => l.b === b && !l.reserve).reduce((a, l) => a + crewHeads(l), 0));
  const f1 = { ...f, nid, base: { active: m.active, reserve: m.reserve, labor: recruitLabor(ns || {}), stab: stabProp(ns || {}) }, active: m.active * f.active / R.start.active, reserve: m.reserve * f.reserve / R.start.reserve,
    q0: f.quality, depot: 100, crewShare: per((b) => need[b] / m.active * (1 + FL.crewSlack)), prop: Math.min(1, propensity0(m)),
    fleet: Object.fromEntries(ls.map((l) => [l.id, newLine(l, nid)])), fielded: { ...fielded } };
  return withPipes(f1);
}
// #91: trained crews as headcounts at the 2024 share of active, the pipelines full at their steady state (pipeMo cohorts of one month's
// replacement each), and capacity capX over replacement. Forces from before #91 (crew sets) convert here once.
export const turnover0 = (nid) => { const m = MANPOWER[nid]; return m ? m.accessions / m.active / 12 : 0; };
function withPipes(f) {
  if (!f.fleet || f.cap) return f;
  const r = turnover0(f.nid); const need = fleetFill(f).need; const crews = per((b) => crewTarget(need[b], b));
  const pipe = BRANCH_IDS.flatMap((b) => crews[b] * r > 0 ? Array.from({ length: R.pipeMo[b] }, (_, i) => ({ b, mo: i + 1, n: crews[b] * r })) : []);
  return { ...f, crews, pipe, cap: per((b) => crews[b] * r * CP.capX), crewFund: f.crewFund ?? 100, crewWhy: {} };
}
// F8: every named SOF unit at its 2024 operator strength. A pre-F8 force (abstract t1/t2 counts) converts to the 2024 units.
export const newSof = (nid) => ({ units: Object.fromEntries(sofOrbat(nid).map((u) => [u.id, { ops: u.ops, out: [] }])), pipes: [] });
const withSof = (f, nid) => (f.sof?.units ? f : { ...f, nid: f.nid ?? nid, sof: newSof(f.nid ?? nid) });
const F = (g) => { const f0 = g.forces || newForces(g.country?.id, g.stats); const f = g.country ? withSof(f0, g.country.id) : f0; return withPipes(f.base || !g.country ? f : withFleet(f, g.country.id, ownedOf(g), g.stats)); };
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
// #91: with a fleet, crew sets follow the headcount fill (trained heads / heads the fleet needs): a fully crewed branch can station
// every owned unit plus its spares; a branch at 70% fill, 70% of them.
export function crewStatus(g) {
  const f = F(g); const need = crewSum(ownedOf(g)); const dep = crewSum(deployedUnits(g));
  if (f.cap) { const fill = fillNow(g, f); return per((b) => { const crews = Math.floor((need[b] + R.spare[b]) * fill[b] + 1e-9); return { need: need[b], deployed: dep[b], crews, free: crews - dep[b], pool: Math.floor(f.crews[b] || 0), pipe: Math.round(pipeOf(f, b)), gap: Math.max(0, need[b] - crews) }; }); }
  return per((b) => { const crews = Math.floor(f.crews?.[b] || 0); return { need: need[b], deployed: dep[b], crews, free: crews - dep[b], pool: Math.floor(crewPool(f, b)), pipe: (f.pipe || []).filter((p) => p.b === b).length, gap: Math.max(0, need[b] - crews) }; });
}
// Fill per branch counting units bought but not yet landed in the fleet (they land on the next month): the gate sees a purchase at once.
function fillNow(g, f) {
  const { need } = fleetFill(f); const owned = ownedOf(g); const extra = per(() => 0);
  for (const [u, n] of Object.entries(owned)) { const d = (n || 0) - (f.fielded?.[u] || 0); const l = d > 0 && UNIT_PLATFORMS[u] ? buyLine(f.nid, u) : null; if (l && !l.reserve) extra[l.b] += crewHeads(l, d * UNIT_PLATFORMS[u].per); }
  return per((b) => (need[b] + extra[b] > 0 ? Math.min(1, (f.crews[b] || 0) / (need[b] + extra[b])) : 1));
}
const pipeOf = (f, b) => (f.pipe || []).filter((p) => p.b === b).reduce((a, p) => a + (p.n ?? 1), 0);
// Crew gate for stationing one unit: null when crews are free, else the reason (shown, never silent).
export function crewBlock(g, pid) {
  const c = crewOf(pid); if (!c.n) return null;
  const st = crewStatus(g)[c.b];
  if (st.free >= c.n) return null;
  const nm = (PLATFORMS[pid] || BLACK_PROGRAMS[pid])?.n || pid;
  return `${nm} has no trained crews — ${c.b} crews ${Math.max(0, st.free)}/${c.n} free (${st.pipe.toLocaleString('en-US')} in training)`;
}

export const sofPay = (f) => sofOps(f, 1) * SOF_RULES.pay.t1 + sofOps(f, 2) * SOF_RULES.pay.t2;
export const payrollOf = (f) => { if (!f) return 0; const p = manPts(f); return p.active * R.payroll.active + p.reserve * R.payroll.reserve + sofPay(f); };
const classCost = (p) => p.n * (p.t === 1 ? SOF_RULES.costPer.t1 : SOF_RULES.costPer.t2);
export const trainingCost = (f) => TRAINING[f.train].cost + (f.sof.pipes || []).reduce((a, p) => a + classCost(p), 0);
// #91: the crew pipelines' running cost and effective funding (zero while the training budget is Unfunded).
export const crewFundF = (f) => (TRAINING[f.train].crews > 0 ? Math.max(0, Math.min(CP.fundMax, f.crewFund ?? 100)) / 100 : 0);
export const pipeCost = (f) => (f.cap ? BRANCH_IDS.reduce((a, b) => a + (f.cap[b] || 0) * CP.perHead[b], 0) * crewFundF(f) : 0);
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
  if (f0.cap) {
    const pc = pipeCost(f0); if (pc) cash('Crew pipeline', -Math.round(pc));
    const sof = stepSof(f0, quality, fx);
    // Procurement lands in the fleet first, so this month's starts already train for this month's deliveries.
    const f1 = stepFleet(g, { ...f0, active, reserve, retention, recruits, attrition, quality, readiness, sof, ...(mp.prop != null ? { prop: mp.prop } : {}) }, fx, cash);
    setF(g, S, { ...f1, ...stepCrews({ ...f1, active: f0.active }, active, recruits, attrition) });
    return;
  }
  // Crews (pre-F7 index forces): attrition with retention, pipeline completions, new starts toward owned need + spares, capped by the trained pool.
  const crews = per((b) => (f0.crews[b] || 0) * (1 - (1 - retention / 100) * R.crewAttrition));
  const pipe = [];
  for (const p of f0.pipe) { if (p.mo > 1) pipe.push({ ...p, mo: p.mo - 1 }); else crews[p.b] += 1; }
  const need = crewSum(ownedOf(g)); const rate = TRAINING[f0.train].crews;
  for (const b of BRANCH_IDS) {
    const want = need[b] + R.spare[b] - Math.floor(crews[b]) - pipe.filter((p) => p.b === b).length;
    for (let i = 0; i < Math.min(rate, want); i++) pipe.push({ b, mo: R.pipeMo[b] });
    crews[b] = Math.min(crews[b], crewPool({ ...f0, active }, b));
  }
  const sof = stepSof(f0, quality, fx);
  const f1 = { ...f0, active, reserve, retention, recruits, attrition, quality, readiness, crews, pipe, sof, ...(mp.prop != null ? { prop: mp.prop } : {}) };
  setF(g, S, f0.fleet ? stepFleet(g, f1, fx, cash) : f1);
}
// #91: one month of the crew pipelines. Returns {crews, pipe, cap, crewWhy}. Deterministic in state alone.
// Graduations first, then turnover at the active force's rate, then starts = min(want, funding, capacity, recruits), split across branches
// by want when recruits bind; then capacity grows toward the target while funded. Trained + training never exceed active strength.
export const crewTarget = (need, b) => (need > 0 ? need + Math.max(FL.crewSlack * need, CP.spare[b]) : 0);
export function crewWant(f, b, need, r) { const T = crewTarget(need[b], b); return { T, want: Math.max(0, T * (1 + r * R.pipeMo[b]) - (f.crews[b] || 0) - pipeOf(f, b)) }; }
function stepCrews(f0, active, recruits, attrition) {
  const r = f0.active > 0 ? attrition / f0.active : 0; const need = fleetFill(f0).need; const fund = crewFundF(f0);
  const crews = { ...f0.crews }; const pipe = [];
  for (const p of f0.pipe) { if (p.mo > 1) pipe.push({ ...p, mo: p.mo - 1 }); else crews[p.b] = (crews[p.b] || 0) + p.n; }
  for (const b of BRANCH_IDS) crews[b] = Math.max(0, crews[b] * (1 - r));
  const mid = { ...f0, crews, pipe };
  const wants = per((b) => crewWant(mid, b, need, r)); const totWant = BRANCH_IDS.reduce((a, b) => a + wants[b].want, 0);
  const avail = Math.max(0, recruits) * CP.intake;
  const cap = { ...f0.cap }; const crewWhy = {};
  for (const b of BRANCH_IDS) {
    const { T, want } = wants[b];
    const limits = { funding: (f0.cap[b] || 0) * fund, pipeline: (f0.cap[b] || 0) * Math.max(1, fund), manpower: totWant > 0 ? avail * want / totWant : avail };
    const starts = Math.max(0, Math.min(want, limits.funding, limits.pipeline, limits.manpower));
    const lim = Math.min(limits.funding, limits.pipeline, limits.manpower);
    // The binding constraint: the smallest limit when it cut the starts; with nothing cutting them, a branch still short is waiting on
    // trainees already in its pipeline (pipeline: capacity was too small to have trained them ahead of the deliveries).
    const binding = want > lim + 1e-6 ? (limits.manpower <= Math.min(limits.funding, limits.pipeline) ? 'manpower' : limits.pipeline <= limits.funding ? 'pipeline' : 'funding')
      : (crews[b] || 0) < need[b] - 1e-6 ? 'pipeline' : null;
    if (starts > 1e-9) pipe.push({ b, mo: R.pipeMo[b], n: starts });
    crewWhy[b] = { starts, want, target: T, limits, binding };
    // Capacity follows the target while training is funded: one month's replacement x capX plus clearing what is still wanted over one pipeline.
    const desired = T * r * CP.capX + Math.max(0, want - starts) / R.pipeMo[b];
    const c0 = cap[b] || 0;
    if (fund >= 1 - 1e-9 && desired > c0) cap[b] = Math.min(desired, c0 * (1 + CP.grow) + 1);
    else if (desired * 1.5 < c0) cap[b] = Math.max(desired * 1.5, c0 * (1 - CP.shrink));
  }
  // Trained and training are serving members: they never exceed active strength.
  const held = BRANCH_IDS.reduce((a, b) => a + crews[b], 0) + pipe.reduce((a, p) => a + p.n, 0);
  if (held > active && held > 0) { const k = active / held; for (const b of BRANCH_IDS) crews[b] *= k; for (const p of pipe) p.n *= k; }
  return { crews, pipe: pipe.filter((p) => p.n > 1e-9), cap, crewWhy };
}

// ── F8 SOF month: turnover, the standing pipeline, surge classes graduating, committed sub-units counting down to rotation.
// Turnover takes turnYr a year; the standing pipeline replaces it at the 2024 rate x quality (capped at 1) and closes refill of any gap
// below the 2024 strength a month, never above it. Tier 1 replacements come t2Share from Tier 2. Surge classes can lift a unit to its cap.
const takeOps = (units, f, t, n) => {
  let left = n;
  for (const id of Object.keys(units).filter((k) => sofUnit(f.nid, k)?.tier === t).sort((a, b) => units[b].ops - units[a].ops)) {
    const d = Math.min(left, units[id].ops); if (d > 0) { units[id] = { ...units[id], ops: units[id].ops - d }; left -= d; }
  }
  return n - left;
};
function stepSof(f, q, fx) {
  const thr = Math.min(1, qualityF(q)); const units = {}; let draw = 0;
  for (const u of sofOrbat(f.nid)) {
    const s0 = f.sof.units[u.id] || { ops: u.ops, out: [] };
    let ops = s0.ops * (1 - SOF_RULES.turnYr / 12);
    if (ops < u.ops) { const gain = Math.min(u.ops - ops, u.ops * SOF_RULES.turnYr / 12 * thr + (u.ops - ops) * SOF_RULES.refill); ops += gain; if (u.tier === 1) draw += gain * SOF_RULES.t2Share; }
    const out = [];
    for (const o of s0.out) { const o1 = o.mo > 0 ? { ...o, mo: o.mo - 1 } : { ...o, rec: o.rec - 1 }; if (o1.mo > 0 || o1.rec > 0) out.push(o1); else fx.toast(`🎖️ ${u.n}: a ${u.sub} is back in rotation`); }
    units[u.id] = { ops, out };
  }
  takeOps(units, f, 2, draw);
  const pipes = [];
  for (const p of f.sof.pipes) {
    if (p.mo > 1) { pipes.push({ ...p, mo: p.mo - 1 }); continue; }
    const u = sofUnit(f.nid, p.u); if (!u) continue;
    units[p.u] = { ...units[p.u], ops: Math.min(unitCap(u), units[p.u].ops + p.n) };
    fx.toast(`🎖️ ${u.n}: ${p.n} new operators graduate`);
  }
  return { units, pipes };
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
// Surge classes. A Tier 2 class trains conventional volunteers (t2Mo); a Tier 1 class draws t2Share of its candidates from Tier 2 and
// the rest from conventional forces, and takes 24 to 36 months by quality. Classes charge costPer per trainee a month to Training.
const pendingOf = (f, id) => f.sof.pipes.filter((p) => p.u === id).reduce((a, p) => a + p.n, 0);
const roomOf = (f, u) => unitCap(u) - (f.sof.units[u.id]?.ops || 0) - pendingOf(f, u.id);
const classUnit = (f, t, want) => { const us = sofOrbat(f.nid).filter((u) => u.tier === t); return us.find((u) => u.id === want) || us.slice().sort((a, b) => roomOf(f, b) - roomOf(f, a))[0]; };
const costPerOf = (t) => (t === 1 ? SOF_RULES.costPer.t1 : SOF_RULES.costPer.t2);
// The reason a class cannot start, or null. One check for the verbs, the buttons and the event options.
export function classBlock(g, t, want, cash = true) {
  const f = F(g); const u = classUnit(f, t, want); if (!u) return 'No such unit';
  if (f.sof.pipes.length >= SOF_RULES.maxPipes) return `${SOF_RULES.maxPipes} SOF classes already running`;
  if (roomOf(f, u) < 1) return `${u.n} at its ceiling (${unitCap(u).toLocaleString('en-US')} operators)`;
  if (t === 1 && sofFreeOps(f, 2) < u.cls * SOF_RULES.t2Share) return 'Not enough free Tier 2 candidates';
  if (cash && (g.stats?.treasury || 0) < u.cls * costPerOf(t)) return `Need $${Math.round(u.cls * costPerOf(t))}M/mo`;
  return null;
}
const sofFreeOps = (f, t) => Object.keys(f.sof.units).filter((id) => sofUnit(f.nid, id)?.tier === t).reduce((a, id) => a + freeOps(f, id), 0);
function startClass(g, S, fx, t, want) {
  const why = classBlock(g, t, want); if (why) { fx.toast(`⚠ ${why}`); return; }
  const f = F(g); const u = classUnit(f, t, want); const n = u.cls;
  const units = { ...f.sof.units }; const fromT2 = t === 1 ? takeOps(units, f, 2, n * SOF_RULES.t2Share) : 0;
  // Conventional candidates stay on the active roll while they train (they are still serving), so only the Tier 2 draw moves operators.
  const mo = t === 1 ? selectionMo(f.quality) : SOF_RULES.t2Mo;
  setF(g, S, { ...f, sof: { units, pipes: [...f.sof.pipes, { u: u.id, t, mo, n }] } });
  fx.toast(`🎖️ ${u.n}: ${t === 1 ? 'selection' : 'qualification'} class of ${n} (${t === 1 ? `${Math.round(fromT2)} from Tier 2, ${n - Math.round(fromT2)}` : `all ${n}`} from conventional forces) — ${mo}mo at quality ${Math.round(f.quality)}, $${Math.round(classCost({ t, n }))}M/mo`);
}
// ── Operations commit sub-units for a duration plus recovery (spec Part 10). One plan for the verb, the Tier-1 card and the intel ops.
const SOF_OPS = SOF_RULES.ops;
export function sofPlan(f, op, spec, want) {
  const picks = [];
  for (const t of [1, 2]) {
    const k0 = spec[`t${t}`] || 0; if (!k0) continue;
    const id = pickUnit(f, t, k0, want, spec.small) || pickUnit(f, t, 1, want, spec.small); if (!id) continue;
    const u = sofUnit(f.nid, id); const k = Math.min(k0, freeSubs(f, id));
    picks.push({ u: id, n: u.n, t, k, sub: u.sub, ops: f.sof.units[id].ops * k / u.subs, text: `${u.n}: ${subsN(u, k)}` });
  }
  const mo = spec.mo; const rec = spec.rec;
  const ok = !spec.t1 || picks.some((p) => p.t === 1);
  return { op, ok, mo, rec, t1: picks.filter((p) => p.t === 1), t2: picks.filter((p) => p.t === 2), picks,
    label: picks.length ? `${picks.map((p) => p.text).join(', ')} for ${mo} mo + ${rec} mo recovery` : 'no unit free' };
}
export const tier1Plan = (g, want) => { const f = F(g); return sofPlan(f, 'regime', SOF_OPS.regime, want); };
export const intelPlan = (g, op) => { const f = F(g); return op?.sof ? sofPlan(f, op.id, { ...SOF_OPS.intel, mo: op.mo }) : null; };
// Commit a plan: each pick's sub-units go out for mo + rec; `loss` of the committed operators are casualties.
export function commitPlan(g, S, fx, plan, tgt, loss = 0) {
  const f = F(g); const units = { ...f.sof.units };
  for (const p of plan.picks) {
    const s = units[p.u]; const o = { op: plan.op, tgt, mo: plan.mo, rec: plan.rec };
    units[p.u] = { ops: Math.max(0, s.ops - p.ops * loss), out: [...s.out, ...Array.from({ length: p.k }, () => ({ ...o }))] };
  }
  setF(g, S, { ...f, sof: { ...f.sof, units } });
  if (plan.picks.length) fx.toast(`🎖️ Committed ${plan.label}${loss ? ` — ${Math.round(plan.picks.reduce((a, p) => a + p.ops, 0) * loss)} operators lost` : ''}`);
}
// Event effects: d sub-units' worth of operators to the strongest unit of a tier (d < 0 stands one down; the standing pipeline rebuilds).
export function sofAdjust(g, S, t, d) {
  const f = F(g); const id = Object.keys(f.sof.units).filter((k) => sofUnit(f.nid, k)?.tier === t).sort((a, b) => f.sof.units[b].ops - f.sof.units[a].ops)[0]; if (!id) return;
  const u = sofUnit(f.nid, id); const s = f.sof.units[id];
  setF(g, S, { ...f, sof: { ...f.sof, units: { ...f.sof.units, [id]: { ...s, ops: Math.max(0, Math.min(unitCap(u), s.ops + d * Math.max(s.ops, u.ops) / u.subs)) } } } });
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
// #91 verbs: crew pipeline funding (0..150 %) and buying pipeline capacity for one branch (expand x cap at once).
function setCrewFunding(g, S, fx, { pct: p }) {
  const f = F(g); if (!f.cap || !Number.isFinite(+p)) return;
  const v = Math.max(0, Math.min(CP.fundMax, Math.round(+p))); const f1 = { ...f, crewFund: v }; setF(g, S, f1);
  fx.toast(`🎓 Crew training funding ${v}% — $${Math.round(pipeCost(f1))}M/mo${v < 100 ? ', pipelines stop growing with the fleet' : ''}`);
}
export const expandCost = (f, b) => Math.round((f.cap?.[b] || 0) * CP.expand * CP.perHead[b] * CP.expandMo);
export function expandBlock(g, f, b) {
  if (!f.cap || !BRANCH_IDS.includes(b)) return 'No crew pipeline';
  if ((g.stats?.treasury || 0) < expandCost(f, b)) return `Need $${expandCost(f, b)}M`;
  return null;
}
function expandPipeline(g, S, fx, { branch: b }) {
  const f = F(g); const why = expandBlock(g, f, b); if (why) { fx.toast(`⚠ ${why}`); return; }
  const cost = expandCost(f, b); const cap = { ...f.cap, [b]: f.cap[b] * (1 + CP.expand) };
  S.setStats((p) => ({ ...p, treasury: p.treasury - cost }));
  setF(g, S, { ...f, cap });
  fx.toast(`🏫 ${b[0].toUpperCase() + b.slice(1)} crew pipeline +${Math.round(CP.expand * 100)}%: ${Math.round(cap[b]).toLocaleString('en-US')} trainees/mo for $${cost}M`);
}
export const FORCE_VERBS = {
  setCrewFunding: (g, S, fx, p) => setCrewFunding(g, S, fx, p || {}),
  expandPipeline: (g, S, fx, p) => expandPipeline(g, S, fx, p || {}),
  setMaintenance: (g, S, fx, p) => setMaintenance(g, S, fx, p || {}),
  setDepot: (g, S, fx, p) => setDepot(g, S, fx, p || {}),
  modernize: (g, S, fx, p) => modernize(g, S, fx, p || {}),
  retire: (g, S, fx, p) => retire(g, S, fx, p || {}),
  setTraining: (g, S, fx, { level }) => setTraining(g, S, fx, level),
  trainSof: (g, S, fx, p) => startClass(g, S, fx, 2, p?.unit),
  selectTier1: (g, S, fx, p) => startClass(g, S, fx, 1, p?.unit),
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
    selectionMo: selectionMo(f.quality), sofRules: SOF_RULES, sofUnits: sofView(g, f), sofFree: { t1: sofFree(f, 1), t2: sofFree(f, 2) }, sofOps: { t1: sofOps(f, 1), t2: sofOps(f, 2) },
    sofPay: sofPay(f) * pay / 100, classWhy: { t1: classBlock(g, 1), t2: classBlock(g, 2) }, classUnit: { t1: classUnit(f, 1)?.id, t2: classUnit(f, 2)?.id }, plan: tier1Plan(g), pipes: pipesView(g, f) };
}
// #91: the crew pipelines per branch as the Training screen reads them: trained vs needed, in training, capacity, funding, and which of
// funding, pipeline capacity and manpower bound last month's starts (crewWhy; before the first month, this month's projection).
function pipesView(g, f) {
  if (!f.cap) return null;
  const { fill, need } = fleetFill(f); const fund = crewFundF(f); const r = turnover0(f.nid);
  const branches = BRANCH_IDS.map((b) => {
    const w = f.crewWhy?.[b] || (() => { const x = crewWant(f, b, need, r); const avail = (f.recruits || MANPOWER[f.nid]?.accessions / 12 || 0) * CP.intake; return { ...x, target: x.T, starts: Math.min(x.want, f.cap[b] * fund), limits: { funding: f.cap[b] * fund, pipeline: f.cap[b] * Math.max(1, fund), manpower: avail }, binding: null }; })();
    return { id: b, n: BRANCHES.find(([k]) => k === b)[1], trained: f.crews[b] || 0, need: need[b], target: w.target, fill: fill[b], training: pipeOf(f, b), cap: f.cap[b], pipeMo: R.pipeMo[b],
      starts: w.starts, want: w.want, limits: w.limits, binding: w.binding, short: fill[b] < 1 - 1e-9, expandCost: expandCost(f, b), expandWhy: expandBlock(g, f, b), cost: (f.cap[b] || 0) * CP.perHead[b] * fund };
  });
  return { branches, fund: f.crewFund ?? 100, fundF: fund, cost: pipeCost(f), rules: CP };
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
  const branches = BRANCHES.map(([b, n]) => ({ id: b, n, fill: fill[b], need: need[b], pool: f.cap ? f.crews[b] || 0 : (f.active || 0) * (f.crewShare?.[b] || 0), equip: equipF(f, b),
    count: lines.filter((x) => x.b === b).reduce((a, x) => a + x.count, 0), ready: lines.filter((x) => x.b === b).reduce((a, x) => a + x.ready, 0) }));
  return { lines, branches, depot: f.depot ?? 100, maintenance: maintCost(f), depotCost: depotCost(f), modMo: modMonths(f), rules: FL,
    manpower: m && { active: f.active, reserve: f.reserve, base: f.base, cap: manpowerCap(f.nid), prop: propensityOf(m, s0, pay, f.base), prop0: propensity0(m),
      intakeMax: intakeMax(m), recruits: f.recruits, attrition: f.attrition, next: manpowerStep(f, s0, pay, f.retention), labor: recruitLabor(s0), stab: stabProp(s0), status_source: m.status_source } };
}

// F8: the Specialized screen's unit list. Every number from the same state the month and the verbs read.
const opName = (op) => OP_NAMES[op] || INTEL_OPS.find((o) => o.id === op)?.n || op;
function sofView(g, f) {
  return sofOrbat(f.nid).map((u) => {
    const s = f.sof.units[u.id] || { ops: 0, out: [] };
    return { id: u.id, n: u.n, tier: u.tier, role: u.role, sub: u.sub, subs: u.subs, cls: u.cls, ops: s.ops, ops0: u.ops, pers: u.pers, cap: unitCap(u), free: freeSubs(f, u.id),
      freeOps: freeOps(f, u.id), pipe: pendingOf(f, u.id), why: classBlock(g, u.tier, u.id), status_source: u.status_source,
      out: s.out.map((o) => ({ ...o, label: `${opName(o.op)} · ${NATIONS[o.tgt]?.n || o.tgt}`, left: o.mo + o.rec })) };
  });
}
