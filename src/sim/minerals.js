// E4 (#16): minerals and processing chain. One implementation of flows, coverage and the monthly step, shared by the
// verbs (actions.js), the month (tick.js), the E7 mineral gate (selectors.js) and the Resources / Defense tabs.
// State g.minerals: own {mineral:{ore,cap,stock,reserve}}, built {mineral:plants}, plants [{m,mo}], deals [{m,n,units,price,mo}],
// recycle [m], release [m], pact bool, controls [m] (ours), against {nation:[m]} (AI controls on us, recomputed monthly),
// queue [{id,left:{m:u},need:{m:u}}] (tranches and, since E8 #20, platform builds waiting for minerals, FIFO).
import { MINERALS, MINERAL_IDS, MINERAL_START, ROW_CAP, SLOT_INPUTS, PROGRAM_INPUTS, PLATFORM_INPUTS, MINERAL_RULES as R } from '../data/minerals.js';
import { BLACK_PROGRAMS, PLATFORMS } from '../data/platforms.js';
import { NATIONS, NATION_BLOC } from '../data/nations.js';
import { ALLIED_PROGRAMS } from '../data/alliance.js';

const EPS = 1e-9;
const PROCESSORS = Object.keys(MINERAL_START);
export function newMinerals(nid) {
  const st = MINERAL_START[nid] || {};
  const own = Object.fromEntries(MINERAL_IDS.map((m) => { const [ore, cap, stock] = st[m] || [0, 0, 0]; return [m, { ore, cap, stock, reserve: 0 }]; }));
  return { own, built: {}, plants: [], deals: [], recycle: [], release: [], pact: false, controls: [], against: {}, queue: [] };
}
const M = (g) => g.minerals || newMinerals(g.country?.id);
const me = (g) => g.country?.id;

// Tranche inputs: a program override, else its role slot. A regular platform (PLATFORMS) declares its own per-unit inputs (E8, #20).
export const inputsOf = (id) => PROGRAM_INPUTS[id] || PLATFORM_INPUTS[id] || SLOT_INPUTS[BLACK_PROGRAMS[id]?.slot] || {};
const unitName = (id) => (BLACK_PROGRAMS[id] || PLATFORMS[id])?.n || id;
// The program's binding mineral for allied contributions (E7): the input with the largest value per tranche.
export const bindingMineral = (id) => Object.entries(inputsOf(id)).reduce((b, [m, u]) => (!b || u * MINERALS[m].price > b[1] ? [m, u * MINERALS[m].price] : b), null)?.[0] || null;

export const capOf = (g, n, m) => (n === me(g) ? M(g).own[m]?.cap || 0 : MINERAL_START[n]?.[m]?.[1] || 0);
const sameBloc = (g, n) => { const b = NATION_BLOC[me(g)]; return (b === 'west' || b === 'east') && NATION_BLOC[n] === b; };
// AI processors that control exports to the player: tension at the threshold, our sanctions or embargo on them, their embargo on us.
// A processing-pact partner never controls against us. Never keyed by the player (ruling 6).
export function aiControls(g) {
  const out = {}; const p = me(g); const mm = M(g);
  for (const n of PROCESSORS) {
    if (n === p) continue;
    const hostile = (g.rivalTension?.[n] || 0) >= R.aiTension || g.sanctions?.has?.(n) || g.embargoes?.has?.(n) || g.embargoedBy?.by === n;
    if (!hostile || (mm.pact && sameBloc(g, n))) continue;
    const ms = MINERAL_IDS.filter((m) => capOf(g, n, m) > 0);
    if (ms.length) out[n] = ms;
  }
  return out;
}
const controlling = (g, n, m) => !!M(g).against?.[n]?.includes(m);
const offtakeUnits = (n, m) => Math.min(R.offtake.units, (MINERAL_START[n]?.[m]?.[1] || 0) * R.offtake.partnerCut);
export const offtakePrice = (g, n, m) => Math.round(offtakeUnits(n, m) * MINERALS[m].price * (1 + Math.max(0, R.offtake.premiumRel - (g.nationRelations?.[n] || 0)) / 100));

// Monthly inflow per mineral. dom: home plants; rec: recycling; off: offtake deals; pact: bloc partners under the pact;
// mkt: open market. secure = everything but the open market (E7 contribution gate).
export function mineralFlows(g) {
  const mm = M(g); const p = me(g); const out = {};
  for (const m of MINERAL_IDS) {
    const o = mm.own[m];
    const dom = o.cap * (o.ore > 0 ? 1 : R.noOreEff);
    const rec = mm.recycle.includes(m) ? R.recycle.add : 0;
    const off = mm.deals.filter((d) => d.m === m && !controlling(g, d.n, m)).reduce((s, d) => s + d.units, 0);
    let mkt = (ROW_CAP[m] || 0) * R.marketShare, pact = 0;
    for (const n of PROCESSORS) {
      if (n === p || controlling(g, n, m)) continue;
      const c = capOf(g, n, m); if (!c) continue;
      if (mm.pact && sameBloc(g, n)) pact += c * R.marketShare * R.pact.share; else mkt += c * R.marketShare;
    }
    const secure = dom + rec + off + pact;
    out[m] = { dom, rec, off, pact, mkt, secure, total: secure + mkt };
  }
  return out;
}

// Coverage of a program's next tranche: per input (stock + one month of inflow) / need; the lowest names the binding mineral.
export function programSupply(g, id) {
  const inp = inputsOf(id); const mm = M(g); const f = mineralFlows(g);
  const rows = Object.entries(inp).map(([m, need]) => { const have = mm.own[m].stock + f[m].total; return { m, need, cov: Math.min(1, have / need), inflow: f[m].total }; });
  const low = rows.reduce((b, r) => (!b || r.cov < b.cov ? r : b), null);
  const queued = mm.queue.filter((q) => q.id === id).map((q) => {
    const worst = Object.entries(q.left).filter(([, u]) => u > EPS).map(([m, u]) => ({ m, u, mo: f[m].total > EPS ? Math.ceil(u / f[m].total - EPS) : Infinity })).sort((a, b) => b.mo - a.mo)[0];
    return { left: q.left, binding: worst?.m || null, months: worst?.mo ?? 0 };
  });
  return { rows, coverage: low ? low.cov : 1, binding: low && low.cov < 1 ? low.m : queued[0]?.binding || null, queued };
}

// Rival supply under our export controls: a nation that does not refine enough of a controlled mineral itself loses our share
// of world processing; its R&D growth is cut by rivalCut x the worst lost share. Our bloc is exempt. 1 = unaffected.
const SELF_SUFFICIENT = 10;
export function rivalSupplyFactor(g, n) {
  const mm = M(g); if (!mm.controls.length || n === me(g) || sameBloc(g, n)) return 1;
  let worst = 0;
  for (const m of mm.controls) {
    if (capOf(g, n, m) >= SELF_SUFFICIENT) continue;
    const world = PROCESSORS.reduce((s, k) => s + capOf(g, k, m), 0) + (ROW_CAP[m] || 0) + (PROCESSORS.includes(me(g)) ? 0 : mm.own[m].cap);
    worst = Math.max(worst, world > 0 ? mm.own[m].cap / world : 0);
  }
  return 1 - R.controls.rivalCut * worst;
}

// Monthly cost lines of the chain ($M, positive = cost), shared by the month and the Resources tab.
export function mineralCosts(g) {
  const mm = M(g); const by = {};
  const add = (m, v) => { if (v) by[m] = (by[m] || 0) + v; };
  for (const m of MINERAL_IDS) {
    add(m, (mm.built[m] || 0) * R.plant.upkeep);
    if (mm.recycle.includes(m)) add(m, R.recycle.cost);
    if (mm.controls.includes(m)) add(m, Math.round(mm.own[m].cap * MINERALS[m].price * R.controls.exportCost));
  }
  for (const d of mm.deals) if (!controlling(g, d.n, d.m)) add(d.m, d.price);
  return { by, pact: mm.pact ? R.pact.cost : 0, total: Object.values(by).reduce((a, b) => a + b, 0) + (mm.pact ? R.pact.cost : 0) };
}

// Programs where the player is a non-founding partner or co-developer: each owes its binding mineral at R.contribution/month.
const contributions = (g) => Object.entries(g.arsenal?.access || {}).filter(([pid, row]) => { const a = row[me(g)]; return ALLIED_PROGRAMS[pid] && a && !a.founder && a.status === 'active' && a.tier !== 'buyer'; }).map(([pid]) => bindingMineral(pid)).filter(Boolean);

// Start a production tranche: draw the stockpile; a shortfall queues the tranche (paid, never cancelled) and names the binding mineral.
// Returns true when it delivers now.
export function startTranche(g, S, fx, id) {
  const mm = M(g); const need = inputsOf(id); const own = { ...mm.own }; const left = {};
  for (const [m, u] of Object.entries(need)) { const take = Math.min(own[m].stock, u); own[m] = { ...own[m], stock: own[m].stock - take }; if (u - take > EPS) left[m] = u - take; }
  if (!Object.keys(left).length) { setM(g, S, { ...mm, own }); return true; }
  setM(g, S, { ...mm, own, queue: [...mm.queue, { id, left, need: { ...need } }] });
  const sup = programSupply(g, id); const q = sup.queued[sup.queued.length - 1]; const b = q?.binding || Object.keys(left)[0];
  fx.toast(`⏳ ${unitName(id)} ${PLATFORMS[id] ? 'build' : 'tranche'} slowed: ${MINERALS[b].n} short — ~${q?.months === Infinity ? '∞' : q?.months}mo at current supply`);
  return false;
}
const setM = (g, S, v) => { g.minerals = v; S.setMinerals(v); };

// The month. cash(k,v) is the ledger; ns the month's stats. No rng: deterministic in state alone.
export function stepMinerals(g, S, fx, cash, ns) {
  const p = me(g); if (!p) return;
  let mm = M(g);
  mm = { ...mm, against: aiControls(g) };
  g.minerals = mm;
  const own = Object.fromEntries(MINERAL_IDS.map((m) => [m, { ...mm.own[m] }]));
  const built = { ...mm.built };
  // Plants under construction come online.
  const plants = [];
  for (const pl of mm.plants) {
    if (pl.mo > 1) { plants.push({ ...pl, mo: pl.mo - 1 }); continue; }
    own[pl.m].cap = Math.min(R.capMax, own[pl.m].cap + R.plant.add); built[pl.m] = (built[pl.m] || 0) + 1;
    fx.toast(`🏭 ${MINERALS[pl.m].n} processing plant online — +${R.plant.add}/mo`);
  }
  mm = { ...mm, own, built, plants };
  g.minerals = mm;
  const cost = mineralCosts(g);
  if (cost.total) cash('Minerals', -cost.total);
  const f = mineralFlows(g);
  for (const m of MINERAL_IDS) {
    const o = own[m];
    o.ore = Math.max(0, o.ore - Math.min(o.ore, o.cap));
    o.stock += f[m].total;
    if (mm.release.includes(m) && o.reserve > 0) { const r = Math.min(R.stockpile.release, o.reserve); o.reserve -= r; o.stock += r; }
  }
  for (const m of contributions(g)) own[m].stock = Math.max(0, own[m].stock - R.contribution);
  // Waiting tranches draw supply first-in first-out; a tranche with nothing left delivers.
  const queue = []; let got = null; let mil = 0; let plat = null;
  for (const q of mm.queue) {
    const left = {};
    for (const [m, u] of Object.entries(q.left)) { const take = Math.min(own[m].stock, u); own[m].stock -= take; if (u - take > EPS) left[m] = u - take; }
    if (Object.keys(left).length) { queue.push({ ...q, left }); continue; }
    if (PLATFORMS[q.id]) { const p = PLATFORMS[q.id]; plat = { ...(plat || g.platforms), [q.id]: ((plat || g.platforms)?.[q.id] || 0) + 1 }; fx.toast(`${p.i} ${p.n} delivered — minerals in`); continue; }
    const bp = BLACK_PROGRAMS[q.id]; const bag = got || g.blackPrograms; const n = +bag?.[q.id] || 0;
    got = { ...bag, [q.id]: n + 1 }; mil += n > 0 ? bp.mil * (Math.sqrt(n + 1) - Math.sqrt(n)) : 0;
    fx.toast(`${bp.i} ${bp.n} unit #${n + 1} delivered — minerals in`);
  }
  for (const m of MINERAL_IDS) own[m].stock = Math.min(R.stockMax, own[m].stock);
  const deals = mm.deals.filter((d) => d.mo > 1).map((d) => ({ ...d, mo: d.mo - 1 }));
  for (const d of mm.deals) if (d.mo <= 1) fx.toast(`📄 ${MINERALS[d.m].n} offtake with ${NATIONS[d.n]?.n} expired`);
  if (plat) { g.platforms = plat; S.setPlatforms({ ...plat }); }
  if (got) { g.blackPrograms = got; S.setBlackPrograms({ ...got }); if (ns) ns.military = Math.min(100, ns.military + mil); }
  setM(g, S, { ...mm, own, queue, deals });
}

// ── Levers (verbs). Each toasts its outcome; blocked levers change nothing.
const pay = (g, S, v) => S.setStats((s) => ({ ...s, treasury: s.treasury - v }));
const bumpRel = (g, S, ids, d) => { const nr = { ...g.nationRelations }; for (const n of ids) if (n !== me(g) && n in nr) nr[n] = Math.max(-100, Math.min(100, nr[n] + d)); g.nationRelations = nr; S.setNationRelations(nr); };
const known = (m) => !!MINERALS[m];
function buildPlant(g, S, fx, m) {
  const mm = M(g); if (!known(m)) return;
  const pending = mm.plants.filter((p) => p.m === m).length;
  if (mm.own[m].cap + (pending + 1) * R.plant.add > R.capMax) { fx.toast(`⚠ ${MINERALS[m].n} capacity at its ${R.capMax}/mo bound`); return; }
  if ((g.stats?.treasury || 0) < R.plant.capex) { fx.toast(`⚠ Plant needs $${R.plant.capex.toLocaleString()}M`); return; }
  pay(g, S, R.plant.capex); setM(g, S, { ...mm, plants: [...mm.plants, { m, mo: R.plant.mo }] });
  fx.toast(`🏗️ ${MINERALS[m].n} processing plant — $${R.plant.capex.toLocaleString()}M, online in ${R.plant.mo}mo, $${R.plant.upkeep}M/mo upkeep`);
}
function signOfftake(g, S, fx, m, n) {
  const mm = M(g); if (!known(m) || !NATIONS[n] || n === me(g)) return;
  if (!(MINERAL_START[n]?.[m]?.[1] > 0)) { fx.toast(`⚠ ${NATIONS[n].n} does not refine ${MINERALS[m].n}`); return; }
  if (mm.deals.some((d) => d.m === m && d.n === n)) { fx.toast('Deal active'); return; }
  if (controlling(g, n, m)) { fx.toast(`⚠ ${NATIONS[n].n} controls ${MINERALS[m].n} exports to you`); return; }
  if ((g.nationRelations?.[n] || 0) < R.offtake.relMin) { fx.toast(`⚠ Relations with ${NATIONS[n].n} too cold for an offtake`); return; }
  const price = offtakePrice(g, n, m); const units = offtakeUnits(n, m);
  setM(g, S, { ...mm, deals: [...mm.deals, { m, n, units, price, mo: R.offtake.term }] });
  fx.toast(`📄 ${MINERALS[m].n} offtake with ${NATIONS[n].n}: ${units}/mo for $${price}M/mo, ${R.offtake.term}mo`);
}
function cancelOfftake(g, S, fx, m, n) {
  const mm = M(g); if (!mm.deals.some((d) => d.m === m && d.n === n)) return;
  setM(g, S, { ...mm, deals: mm.deals.filter((d) => !(d.m === m && d.n === n)) }); fx.toast(`📄 ${MINERALS[m].n} offtake with ${NATIONS[n].n} cancelled`);
}
function buyStockpile(g, S, fx, m) {
  const mm = M(g); if (!known(m)) return; const o = mm.own[m];
  const lot = Math.min(R.stockpile.lot, R.reserveMax - o.reserve); if (lot <= 0) { fx.toast(`⚠ ${MINERALS[m].n} reserve full`); return; }
  const price = Math.round(lot * MINERALS[m].price * R.stockpile.markup);
  if ((g.stats?.treasury || 0) < price) { fx.toast(`⚠ Need $${price}M`); return; }
  pay(g, S, price); setM(g, S, { ...mm, own: { ...mm.own, [m]: { ...o, reserve: o.reserve + lot } } });
  fx.toast(`📦 ${MINERALS[m].n} strategic reserve +${lot} — $${price}M`);
}
const toggleIn = (arr, m) => (arr.includes(m) ? arr.filter((x) => x !== m) : [...arr, m]);
function toggleStockpileRelease(g, S, fx, m) {
  const mm = M(g); if (!known(m)) return; const on = !mm.release.includes(m);
  setM(g, S, { ...mm, release: toggleIn(mm.release, m) }); fx.toast(on ? `📦 Releasing ${MINERALS[m].n} reserve — ${R.stockpile.release}/mo` : `📦 ${MINERALS[m].n} reserve on hold`);
}
function toggleRecycling(g, S, fx, m) {
  const mm = M(g); if (!known(m)) return;
  if (m === 'enrichment') { fx.toast('⚠ Enriched uranium cannot be recycled here'); return; }
  const on = !mm.recycle.includes(m); setM(g, S, { ...mm, recycle: toggleIn(mm.recycle, m) });
  fx.toast(on ? `♻️ ${MINERALS[m].n} recycling — +${R.recycle.add}/mo for $${R.recycle.cost}M/mo` : `♻️ ${MINERALS[m].n} recycling stopped`);
}
function toggleProcessingPact(g, S, fx) {
  const mm = M(g); const b = NATION_BLOC[me(g)];
  if (b !== 'west' && b !== 'east') { fx.toast('⚠ No bloc to pact with'); return; }
  setM(g, S, { ...mm, pact: !mm.pact });
  fx.toast(mm.pact ? '🤝 Allied processing pact ended' : `🤝 Allied processing pact — bloc processors supply you first, $${R.pact.cost}M/mo`);
}
function toggleExportControl(g, S, fx, m) {
  const mm = M(g); if (!known(m)) return;
  if (mm.controls.includes(m)) { setM(g, S, { ...mm, controls: mm.controls.filter((x) => x !== m) }); fx.toast(`🔓 ${MINERALS[m].n} export controls lifted`); return; }
  if (!(mm.own[m].cap > 0)) { fx.toast(`⚠ You do not process ${MINERALS[m].n}`); return; }
  setM(g, S, { ...mm, controls: [...mm.controls, m] });
  const hit = Object.keys(g.nationRelations || {}).filter((n) => !sameBloc(g, n));
  bumpRel(g, S, hit, -R.controls.relHit);
  fx.toast(`🔒 ${MINERALS[m].n} export controls — rivals cut off; relations −${R.controls.relHit} outside your bloc`);
}
export const MINERAL_VERBS = {
  buildPlant: (g, S, fx, { mineral }) => buildPlant(g, S, fx, mineral),
  signOfftake: (g, S, fx, { mineral, nation }) => signOfftake(g, S, fx, mineral, nation),
  cancelOfftake: (g, S, fx, { mineral, nation }) => cancelOfftake(g, S, fx, mineral, nation),
  buyStockpile: (g, S, fx, { mineral }) => buyStockpile(g, S, fx, mineral),
  toggleStockpileRelease: (g, S, fx, { mineral }) => toggleStockpileRelease(g, S, fx, mineral),
  toggleRecycling: (g, S, fx, { mineral }) => toggleRecycling(g, S, fx, mineral),
  toggleProcessingPact: (g, S, fx) => toggleProcessingPact(g, S, fx),
  toggleExportControl: (g, S, fx, { mineral }) => toggleExportControl(g, S, fx, mineral),
};

// One row per mineral for the Resources tab.
export function mineralView(g) {
  const mm = M(g); const f = mineralFlows(g); const c = mineralCosts(g); const p = me(g);
  return MINERAL_IDS.map((m) => {
    const o = mm.own[m];
    const partners = PROCESSORS.filter((n) => n !== p && NATIONS[n] && (MINERAL_START[n]?.[m]?.[1] || 0) > 0 && !mm.deals.some((d) => d.m === m && d.n === n))
      .map((n) => ({ id: n, n: NATIONS[n].n, cap: MINERAL_START[n][m][1], controls: controlling(g, n, m), price: offtakePrice(g, n, m), units: offtakeUnits(n, m) }))
      .sort((a, b) => b.cap - a.cap);
    return { id: m, ...MINERALS[m], ...o, flow: f[m], upkeep: c.by[m] || 0, plants: mm.plants.filter((x) => x.m === m), built: mm.built[m] || 0,
      deals: mm.deals.filter((d) => d.m === m).map((d) => ({ ...d, name: NATIONS[d.n]?.n, paused: controlling(g, d.n, m) })),
      recycling: mm.recycle.includes(m), releasing: mm.release.includes(m), controlled: mm.controls.includes(m),
      controlledBy: Object.entries(mm.against || {}).filter(([, ms]) => ms.includes(m)).map(([n]) => NATIONS[n]?.n || n),
      partners: partners.filter((x) => !x.controls).slice(0, 2), canControl: o.cap > 0 };
  });
}
