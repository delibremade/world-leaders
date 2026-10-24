// Command cards (docs/DESIGN-SYSTEM-V2.md §4): pure builders from the game view to the actions a selection offers,
// each with its key, its target, whether it escalates (orange, always through the confirm sheet) and the exact
// actions.js verb it dispatches. Nothing here computes a rule: gates are quoted from the verbs, which still enforce
// them. runCommand() is the one place a card's action turns into a dispatch, a UI side effect or a confirm sheet.
import { deploymentOptions } from '../../sim/deployment-view.js';
import { NATIONS, DIP_TARGETS, INTEL_TARGETS } from '../../data/nations.js';
import { SITES, NODE_TYPES } from '../../data/bases.js';
import { REGIONS } from '../../data/regions.js';
import { SECTOR_LABELS } from '../../data/economy.js';
import { nationName, isRival } from './nation-verbs.js';

export const REGION_KEYS = { deploy: 'A', station: 'S', influence: 'D', visit: 'F', sanction: 'Z', embargo: 'X', intel: 'C', build: 'V' };
export const FLEET_KEYS = { modernize: 'M', retire: 'R', retireAll: 'B', maintUp: 'K', maintDown: 'J' };
export const BUDGET_KEYS = { raise: 'K', lower: 'J', reset: 'N', modernize: 'M' };

const rel = (v, n) => v.nationRelations?.[n] ?? 0;
const money = (v) => v.stats?.treasury || 0;
const cd = (v, k) => v.actionCooldowns?.[k] || 0;
const nationsIn = (v, rid) => Object.keys(NATIONS).filter((n) => NATIONS[n].region === rid && n !== v.country?.id);
// The partner here: the diplomatic target with the best relations that is not under your sanctions.
const partnerIn = (v, rid) => DIP_TARGETS.filter((d) => d.region === rid && d.id !== v.country?.id && !v.sanctions?.has(d.id)).sort((a, b) => rel(v, b.id) - rel(v, a.id))[0]?.id || null;
// The adversary here: a rival great power present in the region, else the nation you get on worst with.
const adversaryIn = (v, rid) => { const ids = nationsIn(v, rid); return ids.find((n) => isRival(v, n)) || ids.sort((a, b) => rel(v, a) - rel(v, b))[0] || null; };
const intelTargetIn = (v, rid) => INTEL_TARGETS.filter((t) => t.region === rid && t.id !== v.country?.id).sort((a, b) => rel(v, a.id) - rel(v, b.id))[0]?.id || null;
export const freeUnit = v => deploymentOptions(v).find(u=>u.free>0&&!u.reason)?.id||null;
const sitesIn = (rid) => Object.entries(SITES).filter(([, s]) => s.region === rid).map(([id]) => id);
const myNodeAt = (v, sid) => (v.bases?.nodes || []).some((n) => n.site === sid && n.owner === v.country?.id);

const act = (id, keys, icon, label, rest) => ({ id, key: keys[id], icon, label, escalate: false, disabled: false, reason: '', ...rest });

// The Overview card for a region: Deploy A, Station base S, Influence D, State visit F, Sanction Z, Embargo X, Intel op C, Build node V.
export function regionCommands(v, rid) {
  if (!rid || !REGIONS[rid]) return [];
  const K = REGION_KEYS; const region = REGIONS[rid].n;
  const partner = partnerIn(v, rid); const adversary = adversaryIn(v, rid); const spy = intelTargetIn(v, rid);
  const sites = sitesIn(rid); const stationSite = sites.find((s) => myNodeAt(v, s)) || sites[0] || null; const buildSite = sites.find((s) => !myNodeAt(v, s)) || sites[0] || null;
  const sanctioned = adversary ? v.sanctions?.has(adversary) : false; const embargoed = adversary ? v.embargoes?.has(adversary) : false;
  const canEmbargo = (v.resExtraction?.oil || 0) >= 2 || (v.resExtraction?.gas || 0) >= 2;
  const infl = partner ? (v.influenceAlloc?.[partner] || 0) : 0;
  const visitCd = partner ? cd(v, `visit_${partner}`) : 0;
  return [
    act('deploy', K, '🪖', 'Deploy / recall', { target: region, hint: 'Choose the force package, review availability and set its mission', ui: {deploy:rid} }),
    act('station', K, '◎', 'Station base', { target: stationSite ? SITES[stationSite].n : 'no site', hint: 'Open the site: nodes here and what you can build', disabled: !stationSite, reason: stationSite ? '' : 'No base site in this region', ui: stationSite ? { site: stationSite } : null }),
    act('influence', K, '📡', 'Influence', { target: partner ? `${nationName(partner)} · weight ${infl} → ${Math.min(3, infl + 1)}` : 'no partner', hint: 'Raise the influence weight one step (from the pool)', disabled: !partner || infl >= 3, reason: !partner ? 'No diplomatic target here' : infl >= 3 ? 'Already at the top weight' : '', dispatch: partner ? { type: 'setInfluence', payload: { nation: partner, weight: Math.min(3, infl + 1) } } : null }),
    act('visit', K, '🤝', 'State visit', { target: partner ? nationName(partner) : 'no partner', hint: '$150M · relations +8 · 6-month cooldown', disabled: !partner || visitCd > 0 || money(v) < 150, reason: !partner ? 'No diplomatic target here' : visitCd > 0 ? `On cooldown ${visitCd}mo` : money(v) < 150 ? 'Need $150M' : '', dispatch: partner ? { type: 'stateVisit', payload: { nation: partner } } : null }),
    act('sanction', K, '🚫', sanctioned ? 'Lift sanctions' : 'Sanction', { escalate: !sanctioned, target: adversary ? nationName(adversary) : 'no nation', hint: 'Ruling 7: any nation. An ally costs −10 standing, bloc reset, 12-month freeze', disabled: !adversary, reason: adversary ? '' : 'No nation here', dispatch: adversary ? { type: 'toggleSanctions', payload: { nation: adversary } } : null,
      confirm: adversary && !sanctioned ? { title: `Impose sanctions on ${nationName(adversary)}`, cost: 'trade income with them stops', label: 'Impose sanctions', lines: ['Relations fall and their bloc hardens. An ally costs −10 standing, a bloc reset and a 12-month freeze (ruling 7).', 'Lift them from this card or the nation sheet at any time.'] } : null }),
    act('embargo', K, '⛽', embargoed ? 'Lift embargo' : 'Embargo', { escalate: !embargoed, target: adversary ? nationName(adversary) : 'no nation', hint: 'Needs oil or gas extraction ≥2 · price ×1.15, your volume ×0.8 · they may embargo back', disabled: !adversary || (!embargoed && !canEmbargo), reason: !adversary ? 'No nation here' : !embargoed && !canEmbargo ? 'Extraction too low to embargo (need oil or gas ≥2)' : '', dispatch: adversary ? { type: 'toggleEmbargo', payload: { nation: adversary } } : null,
      confirm: adversary && !embargoed ? { title: `Energy embargo on ${nationName(adversary)}`, cost: 'your export volume ×0.8', label: 'Declare embargo', lines: ['Their import price ×1.15 and tension rises. They may answer with an embargo of their own.', 'Lift it from this card or the nation sheet at any time.'] } : null }),
    act('intel', K, '🕵️', 'Plan intel', { target: spy ? nationName(spy) : 'no target', hint: 'Choose a mission in Situation Room; review its requirements, cost and consequences', disabled: !spy, reason: spy ? '' : 'No foreign intelligence target here', ui: spy ? {jump:{tab:'sitroom',target:spy}} : null }),
    act('build', K, '🏗️', 'Build node', { target: buildSite ? SITES[buildSite].n : 'no site', hint: buildSite ? `Build mode on, then ${SITES[buildSite].types.map((t) => NODE_TYPES[t].n).join(' / ')}` : '', disabled: !buildSite, reason: buildSite ? '' : 'No candidate site in this region', ui: buildSite ? { build: true, site: buildSite } : null }),
  ];
}

// The Forces card for one order-of-battle line (fleetView line l, the fleet view fl, the retire step for its class).
export function fleetCommands(l, fl, step) {
  const K = FLEET_KEYS; const n = Math.min(l.count, step || 1);
  const retire = (k) => ({ title: `Retire ${k} ${l.n}`, cost: `saves about $${Math.round(l.cost * k / Math.max(1, l.count))}M/mo maintenance`, label: 'Retire', lines: [`${l.count - k} left in service. Retired units do not come back; procurement adds new ones to this line.`, 'Their crews return to the pool for the rest of the fleet.'] });
  return [
    act('modernize', K, '🔧', 'Modernize', { target: `block ${l.blk + 1} · $${l.modCost}M`, hint: l.modWhy || `${fl.modMo} months in the depot`, disabled: !!l.modWhy, reason: l.modWhy || '', dispatch: { type: 'modernize', payload: { line: l.id } },
      confirm: { title: `${l.n}: block ${l.blk + 1} upgrade`, cost: `$${l.modCost}M once`, label: 'Start upgrade', kind: 'warn', lines: [`${fl.modMo} months in the depot at ${fl.depot}% throughput; ${Math.round(fl.rules.modShare * 100)}% of the fleet is unavailable meanwhile.`, `Then +${Math.round(fl.rules.blkGain * 100)}% effectiveness and +${Math.round(fl.rules.mcBlk * 100)}% MC target.`] } }),
    act('retire', K, '📉', `Retire ${n}`, { escalate: true, target: l.count ? `${l.count - n} left` : 'none in service', hint: 'Retired units do not come back', disabled: !l.count, reason: l.count ? '' : 'None in service', dispatch: { type: 'retire', payload: { line: l.id, n } }, confirm: l.count ? retire(n) : null }),
    act('retireAll', K, '🗑️', `Retire all ${l.count}`, { escalate: true, target: l.n, hint: 'The whole line leaves service', disabled: l.count <= n, reason: l.count <= n ? 'Nothing beyond one step' : '', dispatch: { type: 'retire', payload: { line: l.id, n: l.count } }, confirm: l.count > n ? retire(l.count) : null }),
    act('maintUp', K, '▲', 'Maintenance +10', { target: `${l.mx}% → ${Math.min(150, l.mx + 10)}%`, hint: `MC target ${Math.round(l.target)}%`, disabled: l.mx >= 150, reason: l.mx >= 150 ? 'At the ceiling' : '', dispatch: { type: 'setMaintenance', payload: { line: l.id, pct: Math.min(150, l.mx + 10) } } }),
    act('maintDown', K, '▼', 'Maintenance −10', { target: `${l.mx}% → ${Math.max(0, l.mx - 10)}%`, hint: 'Readiness follows the money', disabled: l.mx <= 0, reason: l.mx <= 0 ? 'At the floor' : '', dispatch: { type: 'setMaintenance', payload: { line: l.id, pct: Math.max(0, l.mx - 10) } } }),
  ];
}

// The Economy card for one sector budget line. age is the sector's months since modernization; treasury prices the modernization.
export function budgetCommands(sector, alloc = 100, { age = 0, treasury = 0 } = {}) {
  const K = BUDGET_KEYS; const label = SECTOR_LABELS[sector] || sector; const decaying = age > 480;
  return [
    act('raise', K, '▲', 'Raise +10', { target: `${alloc}% → ${Math.min(200, alloc + 10)}%`, hint: 'Cost grows with the 2.5 power of the allocation', disabled: alloc >= 200, reason: alloc >= 200 ? 'At the ceiling' : '', dispatch: { type: 'adjustSectorBudget', payload: { sector, delta: 10 } } }),
    act('lower', K, '▼', 'Lower −10', { target: `${alloc}% → ${Math.max(0, alloc - 10)}%`, hint: 'Below 100% the sector decays', disabled: alloc <= 0, reason: alloc <= 0 ? 'At the floor' : '', dispatch: { type: 'adjustSectorBudget', payload: { sector, delta: -10 } } }),
    act('reset', K, '↺', 'Reset to 100', { target: label, hint: 'Normal funding', disabled: alloc === 100, reason: alloc === 100 ? 'Already at 100%' : '', dispatch: { type: 'setSectorBudget', payload: { sector, value: 100 } } }),
    act('modernize', K, '🔄', 'Modernize', { escalate: true, target: decaying ? `$${Math.round(treasury * 0.3).toLocaleString()}M` : `${age}mo old`, hint: 'Great Modernization: 30% of the treasury, resets the 40-year clock', disabled: !decaying, reason: decaying ? '' : 'Only once the sector is aging (480 months)', dispatch: { type: 'modernizeSector', payload: { sector } },
      confirm: decaying ? { title: `Great Modernization · ${label}`, cost: `$${Math.round(treasury * 0.3).toLocaleString()}M (30% of the treasury)`, label: 'Modernize', lines: ['Resets the sector age and its maturity discount; the aging penalty ends.', 'This is a large one-off spend; the ledger shows it next month.'] } : null }),
  ];
}

// One implementation of "run this card action": escalatory (or any confirm-carrying) actions go through the confirm
// sheet, UI side effects (open a site, build mode) run through `ui`, everything else dispatches the verb as is.
export function runCommand(a, { dispatch, ask, ui } = {}) {
  if (!a || a.disabled) return false;
  const go = () => { if (a.ui && ui) ui(a.ui); if (a.dispatch && dispatch) dispatch(a.dispatch); };
  if (a.confirm && ask) { ask({ ...a.confirm, kind: a.escalate ? 'alert' : (a.confirm.kind || 'warn'), escalate: a.escalate, run: go }); return true; }
  go(); return true;
}
