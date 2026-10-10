// E8 (#20): troops, training, force quality and SOF tiers. One implementation of the monthly step, the crew gate and the view,
// shared by the month (tick.js), the deploy verb (actions.js) and the Defense tab. Multipliers live in formulas.js.
// State g.forces: active, reserve, retention (0..100), recruits, attrition (last month), quality (0..100, lags forceQuality),
// train (TRAINING index), readiness {land,air,sea}, crews {land,air,sea} (trained crew sets), pipe [{b,mo}] (crews in training),
// sof {t2, t1, pipes:[{t,mo}]}.
import { FORCE_RULES as R, TRAINING, SOF_RULES, SOF_UNITS, SOF_START, SOF_DEFAULT, BRANCHES, BRANCH_IDS, crewOf } from '../data/forces.js';
import { PLATFORMS, BLACK_PROGRAMS } from '../data/platforms.js';
import { forceQuality, forceMult, tier1Power, qualityF } from './formulas.js';

const cl = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const per = (b) => Object.fromEntries(BRANCH_IDS.map((k) => [k, b(k)]));
export function newForces(nid, stats) {
  const s = R.start; const sof = SOF_START[nid] || SOF_DEFAULT;
  return { active: s.active, reserve: s.reserve, retention: s.retention, recruits: 0, attrition: 0, quality: forceQuality(stats),
    train: s.train, readiness: per(() => s.readiness), crews: per((b) => R.spare[b]), pipe: [], sof: { t2: sof.t2, t1: sof.t1, pipes: [] } };
}
const F = (g) => g.forces || newForces(g.country?.id, g.stats);
export const crewPool = (f, b) => (f.active || 0) * R.crewPer[b];

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

export const payrollOf = (f) => (f ? f.active * R.payroll.active + f.reserve * R.payroll.reserve + f.sof.t2 * R.payroll.t2 + f.sof.t1 * R.payroll.t1 : 0);
export const trainingCost = (f) => TRAINING[f.train].cost + f.sof.pipes.reduce((a, p) => a + (p.t === 2 ? SOF_RULES.t2Cost : SOF_RULES.t1Cost), 0);
export const retentionTarget = (pay, ns) => cl(40 + (pay - 100) * R.payW + ((ns.stability || 0) - 50) * R.stabW - Math.max(0, (ns.gdpGrowth || 0) - 2) * R.civW + ((ns.unemployment || 0) - 5) * R.unempW);
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
  const recruits = R.recruit * cl(0.5 + (ns.unemployment || 0) / 10, 0.5, 2) * pay / 100;
  const retention = cl(f0.retention + (retentionTarget(pay, ns) - f0.retention) * R.retLag);
  const attrition = f0.active * R.attrition * (2 - retention / 50);
  const active = cl(f0.active + recruits - attrition);
  const reserve = cl(f0.reserve + attrition * R.reserveIn - f0.reserve * R.reserveOut);
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
    crews[b] = Math.min(crews[b], active * R.crewPer[b]);
  }
  // SOF pipelines.
  const sof = { ...f0.sof, pipes: [] };
  for (const p of f0.sof.pipes) {
    if (p.mo > 1) { sof.pipes.push({ ...p, mo: p.mo - 1 }); continue; }
    const k = p.t === 2 ? 't2' : 't1'; sof[k] = Math.min(SOF_RULES.max[k], sof[k] + 1);
    const u = SOF_UNITS[g.country.id] || {}; fx.toast(`🎖️ ${p.t === 2 ? u.t2 || 'Tier 2' : u.t1 || 'Tier 1'}: a new ${p.t === 2 ? 'Tier 2 unit' : 'Tier 1 squadron'} is operational`);
  }
  setF(g, S, { ...f0, active, reserve, retention, recruits, attrition, quality, readiness, crews, pipe, sof });
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
export const FORCE_VERBS = {
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
  return { ...f, pay, retTarget: retentionTarget(pay, s), qTarget: forceQuality(s), qMult: qualityF(f.quality), drivers, levels: TRAINING, branches,
    payroll: payrollOf(f) * pay / 100, training: trainingCost(f), units: SOF_UNITS[g.country?.id] || {}, tier1: tier1Power(f),
    selectionMo: selectionMo(f.quality), sofRules: SOF_RULES };
}
