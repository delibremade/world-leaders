// Map scene: one pure function from the game view + a map mode to the drawables both renderers consume
// (PixiJS in the browser, SVG in jsdom / no-WebGL). Presentation only: it reads engine values, it never
// computes a rule. Every v57 overlay lives here once: sphere shading, contested hatch, momentum (6-month
// trend), trade routes, influence lines, chokepoints, flashpoint + timer, deployed count, intel dot.
import { REGIONS, COMP_COLORS, REGION_GEO, FLASHPOINTS } from '../../data/regions.js';
import { NATIONS, BUYERS, DIP_TARGETS, INTEL_TARGETS } from '../../data/nations.js';
import { CHOKEPOINTS, IMPORT_ROUTES } from '../../data/chokepoints.js';
import { sumDep, isAllyOf } from '../../sim/formulas.js';
import { COLOR } from '../tokens.js';

export const MAP_MODES = [
  { id: 'sphere', label: 'Sphere', icon: '🌍', hint: 'Who holds each region. Hatch = contested within 15 points.' },
  { id: 'tension', label: 'Tension', icon: '🔥', hint: 'Highest rival tension present in each region (ruling 2: always visible).' },
  { id: 'trade', label: 'Trade', icon: '🤝', hint: 'Export deals, trade agreements and import contracts per region.' },
  { id: 'energy', label: 'Energy', icon: '⚡', hint: 'Chokepoint state, your import routes, embargoes, concessions.' },
  { id: 'military', label: 'Military', icon: '🛡️', hint: 'Deployed units, posture and blockades per theater.' },
  { id: 'intel', label: 'Intel', icon: '🕵️', hint: 'Operations in progress, embassies, moles and expulsions per region.' },
];

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const ramp = (name, t) => COLOR.ramp[name][Math.max(0, Math.min(4, Math.round(t * 4)))];
const nationsIn = (rid) => Object.entries(NATIONS).filter(([, n]) => n.region === rid).map(([id]) => id);
const homeRegion = (country) => Object.entries(REGIONS).find(([, r]) => r.homeFor?.includes(country?.id))?.[0] || null;

// view: the slice of App state the map reads (plain objects, Sets). mode: one of MAP_MODES ids.
export function buildScene(view, mode = 'sphere') {
  const {
    country, sphere = {}, selectedRegion = null, forceDeployments = {}, flashpoint = null, sphereTrend = {}, intelOps = [],
    defExports = {}, doctrine = null, nationRelations = {}, embassies = new Set(), defensePacts = new Set(), chokeStatus = {},
    rivalTension = {}, blockades = {}, tradeAgreements = new Set(), importContracts = {}, embargoes = new Set(), embargoedBy = null,
    forcePosture = {}, sanctions = new Set(), moles = {}, expelled = {}, concessions = {},
  } = view;
  const pid = country?.id;
  const homeRid = homeRegion(country);
  const myRoutes = new Set(IMPORT_ROUTES[homeRid] || []);

  const regions = Object.keys(REGION_GEO).map((rid) => {
    const g = REGION_GEO[rid];
    const sph = sphere[rid] || {}; const pv = sph.player || 0;
    const topC = Object.entries(sph.competitors || {}).sort((a, b) => b[1] - a[1])[0];
    const tv = topC ? topC[1] : 0; const isP = pv >= tv; const lead = Math.max(pv, tv); const margin = Math.abs(pv - tv);
    const affil = isP ? COLOR.faction.player : (COMP_COLORS[topC?.[0]] || COLOR.faction.neutral);
    const dep = sumDep(forceDeployments[rid]);
    const trend = sphereTrend[rid] || 0;
    const intelHere = intelOps.some((o) => o.targetId && INTEL_TARGETS.find((t) => t.id === o.targetId)?.region === rid) || (forceDeployments[rid]?.sr72 || 0) > 0;
    const ids = nationsIn(rid);
    const base = {
      rid, name: REGIONS[rid].n, cx: g.cx, cy: g.cy, d: g.d, selected: selectedRegion === rid,
      affil, isPlayer: isP, lead, margin, contested: margin < 15, deployed: dep, trend: Math.abs(trend) >= 2 ? Math.round(trend) : 0,
      intel: intelHere, flashpoint: flashpoint?.rid === rid ? { icon: FLASHPOINTS[flashpoint.type]?.i || '⚠', t: flashpoint.t, type: flashpoint.type } : null,
      fill: affil, fillAlpha: 0.14 + Math.min(0.5, lead / 150), stroke: selectedRegion === rid ? COLOR.text.primary : affil,
      line2: `${isP ? 'YOU' : (topC?.[0] || '').toUpperCase()} ${Math.round(lead)}%`, line2Color: isP ? COLOR.accent.commandHi : affil,
      line3: margin < 15 ? `CONTESTED ±${Math.round(margin)}` : '', hatch: margin < 15, value: lead / 100,
    };
    if (mode === 'tension') {
      const cands = new Set([...(REGIONS[rid].contestedBy || []), ...ids]);
      let top = null, tv2 = 0;
      for (const cid of cands) { if (cid === pid) continue; const t = rivalTension[cid] || 0; if (t > tv2) { tv2 = t; top = cid; } }
      const v = tv2 / 100;
      Object.assign(base, { fill: ramp('tension', v), fillAlpha: 0.22 + v * 0.5, stroke: selectedRegion === rid ? COLOR.text.primary : ramp('tension', v), value: v,
        line2: top ? `${cap(top).toUpperCase()} ${Math.round(tv2)}` : 'CALM', line2Color: v >= 0.7 ? COLOR.accent.alert : v >= 0.4 ? COLOR.accent.warn : COLOR.text.muted,
        line3: blockades[rid] ? 'BLOCKADE' : tv2 >= 70 ? 'BRINK' : '', hatch: false });
    } else if (mode === 'trade') {
      const exportsHere = Object.values(defExports).filter((d) => BUYERS.find((b) => b.id === d.buyerId)?.region === rid).length;
      const agreements = ids.filter((n) => tradeAgreements.has(n)).length;
      const imports = ids.filter((n) => importContracts[n]).length;
      const sanctioned = ids.filter((n) => sanctions.has(n)).length;
      const n = exportsHere + agreements + imports; const v = Math.min(1, n / 4);
      Object.assign(base, { fill: ramp('trade', v), fillAlpha: 0.2 + v * 0.5, stroke: selectedRegion === rid ? COLOR.text.primary : ramp('trade', v), value: v,
        line2: n ? `${n} DEAL${n === 1 ? '' : 'S'}` : 'NO TRADE', line2Color: n ? COLOR.accent.good : COLOR.text.dim,
        line3: sanctioned ? `${sanctioned} SANCTIONED` : exportsHere ? `${exportsHere} ARMS` : '', hatch: false });
    } else if (mode === 'energy') {
      const cps = Object.entries(CHOKEPOINTS).filter(([, c]) => c.region === rid);
      let score = 0; const bits = [];
      for (const [k, c] of cps) { const st = chokeStatus[k] || 'open'; score += st === 'disrupted' ? 2 : 1; if (myRoutes.has(k)) score += 1; bits.push(`${c.n.replace(/^(Strait of |Bab |)/, '').split(' ')[0].toUpperCase()} ${st === 'disrupted' ? '✕' : st === 'secured' ? '✓' : st === 'escorted' ? '⚓' : '·'}`); }
      const emb = ids.filter((n) => embargoes.has(n)).length;
      const conc = ids.filter((n) => concessions[n]).length;
      if (embargoedBy && ids.includes(embargoedBy.by)) { score += 2; bits.push('EMBARGOING YOU'); }
      const v = Math.min(1, score / 4);
      Object.assign(base, { fill: ramp('energy', v), fillAlpha: 0.2 + v * 0.5, stroke: selectedRegion === rid ? COLOR.text.primary : ramp('energy', v), value: v,
        line2: bits[0] || (emb ? `${emb} EMBARGOED` : conc ? 'CONCESSION' : 'NO ROUTE'), line2Color: score >= 3 ? COLOR.accent.alert : score > 0 ? COLOR.accent.energy : COLOR.text.dim,
        line3: bits.slice(1).join(' ') || (emb && bits[0] ? `${emb} EMBARGOED` : ''), hatch: false });
    } else if (mode === 'military') {
      const bl = blockades[rid]; const post = forcePosture[rid];
      const v = Math.min(1, (dep + (bl ? 3 : 0) + (post ? 1 : 0)) / 8);
      Object.assign(base, { fill: ramp('military', v), fillAlpha: 0.2 + v * 0.5, stroke: selectedRegion === rid ? COLOR.text.primary : ramp('military', v), value: v,
        line2: dep ? `⚓ ${dep} DEPLOYED` : 'NO FORCES', line2Color: dep ? COLOR.accent.commandHi : COLOR.text.dim,
        line3: bl ? `BLOCKADE · ${cap(bl.target || '')}`.toUpperCase() : post ? post.toUpperCase() : '', hatch: false });
    } else if (mode === 'intel') {
      const ops = intelOps.filter((o) => o.targetId && INTEL_TARGETS.find((t) => t.id === o.targetId)?.region === rid).length;
      const embs = ids.filter((n) => embassies.has(n)).length;
      const mol = ids.filter((n) => (moles[n] || 0) > 0).length;
      const exp = ids.filter((n) => expelled[n]).length;
      const v = Math.min(1, (ops * 2 + embs * 0.5 + mol + exp) / 5);
      Object.assign(base, { fill: ramp('intel', v), fillAlpha: 0.2 + v * 0.5, stroke: selectedRegion === rid ? COLOR.text.primary : ramp('intel', v), value: v,
        line2: ops ? `${ops} OP${ops === 1 ? '' : 'S'} LIVE` : embs ? `${embs} EMBASS${embs === 1 ? 'Y' : 'IES'}` : 'DARK', line2Color: ops ? COLOR.accent.intel : embs ? COLOR.text.muted : COLOR.text.dim,
        line3: mol ? `${mol} MOLE${mol === 1 ? '' : 'S'}` : exp ? `${exp} EXPELLED` : '', hatch: false });
    }
    return base;
  });

  // Trade routes: home -> every region that buys your platforms. Influence: home -> regions with embassy / pact / rel>=50.
  const h = homeRid && REGION_GEO[homeRid];
  const routes = []; const influence = [];
  if (h) {
    const dests = new Set(Object.values(defExports).map((d) => BUYERS.find((b) => b.id === d.buyerId)?.region).filter(Boolean));
    for (const rid of dests) { const r2 = REGION_GEO[rid]; if (r2 && rid !== homeRid) routes.push({ rid, x1: h.cx, y1: h.cy, x2: r2.cx, y2: r2.cy, color: COLOR.accent.good }); }
    const wide = doctrine === 'hegemon'; const links = {};
    DIP_TARGETS.forEach((t) => { const rel = nationRelations[t.id] || 0; const emb = embassies.has(t.id); const pact = defensePacts.has(t.id); if (pact || emb || rel >= 50) { const s = pact ? 3 : emb ? 2 : 1; if (s > (links[t.region] || 0)) links[t.region] = s; } });
    for (const [rid, strength] of Object.entries(links)) { const r2 = REGION_GEO[rid]; if (!r2 || rid === homeRid) continue; influence.push({ rid, strength, x1: h.cx, y1: h.cy, x2: r2.cx, y2: r2.cy, color: strength >= 3 ? COLOR.accent.intel : strength >= 2 ? COLOR.accent.commandHi : COLOR.accent.command, width: +(strength * 0.7 + (wide ? 0.6 : 0)).toFixed(1), alpha: wide ? 0.55 : 0.4 }); }
  }
  const chokepoints = Object.entries(CHOKEPOINTS).map(([k, cp]) => { const st = chokeStatus[k] || 'open'; return { k, name: cp.n, x: cp.x, y: cp.y, status: st, color: COLOR.choke[st], r: st === 'disrupted' ? 5 : 3.5, ring: st === 'disrupted', mine: myRoutes.has(k) && mode === 'energy' }; });

  return { mode, homeRid, regions, routes, influence, chokepoints, legend: legendFor(mode, country) };
}

export function legendFor(mode, country) {
  const glyphs = '⚓ deployed · ⚠ flashpoint · ▲▼ 6-mo trend · ● intel op';
  if (mode === 'sphere') return { title: 'Affiliation', items: [[COLOR.faction.player, 'You'], [COLOR.faction.russia, 'Russia'], [COLOR.faction.china, 'China'], [COLOR.faction.usa, 'USA'], [COLOR.faction.germany, 'Germany'], ['hatch', 'Contested (±15)']], glyphs };
  const stops = { tension: ['Calm', '25', '50', '75', 'Brink'], trade: ['None', '1', '2', '3', '4+ deals'], energy: ['Clear', 'Route', 'Transit', 'Threat', 'Cut'], military: ['None', '2', '4', '6', '8+ units'], intel: ['Dark', 'Embassy', 'Op', 'Ops+', 'Saturated'] }[mode];
  const titles = { tension: 'Rival tension', trade: 'Trade ties', energy: 'Energy exposure', military: 'Force weight', intel: 'Intel presence' };
  const extra = { energy: ' · ◎ your import route', military: ' · BLOCKADE · posture', tension: ' · BRINK ≥70' }[mode] || '';
  return { title: titles[mode], items: COLOR.ramp[mode].map((c, i) => [c, stops[i]]), glyphs: glyphs + extra, player: country?.name };
}
