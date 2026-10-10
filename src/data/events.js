// Event rules (E2, #14). Rule change: parity with v57 ends for the event system.
// World events: eligibility (`when`), context weight (`w`), and 2-3 in-place responses wired to engine actions.
// Flashpoints: four inline responses. Answering closes the card and leaves an "in effect" row in the outliner.
// Pure data + pure predicates over the live state `g`. Costs are $M.
import { navalWeight, panamaPriorityBlock } from '../sim/formulas.js';
import { CHOKEPOINTS } from './chokepoints.js';

export const EVENT_COOLDOWN = 60;   // months before the same world event may fire again
export const CHAIN_PATIENCE = 6;    // a queued follow-up that cannot fire (cooldown, busy slot) is dropped after this many months

const maxTen = (g) => Math.max(0, ...Object.values(g.rivalTension || {}));
const navalAt = (g, rid) => navalWeight(g.forceDeployments?.[rid]);
const needNaval = (rid, n = 2) => (g) => navalAt(g, rid) >= n ? null : `Station naval weight ${n}+ in ${rid} (have ${navalAt(g, rid).toFixed(1)})`;
const escort = (choke) => (g) => { const rid = CHOKEPOINTS[choke].region; return [{ verb: 'setPosture', payload: { region: rid, posture: 'escort' } }]; };
const spr = { act: () => [{ verb: 'releaseReserve', payload: {} }] };

// response: { id, label, tags, cost, req(g)->reason|null, now:{stat:delta}, sfx:[applySfx ops], act(g)->[{verb,payload}],
//   cut: months shaved off the event, dur: months the effect row lasts (default: until the event ends),
//   mods:{stats:{k:d/mo}, cash:$M/mo (negative = spend)}, chain:{id,after} }
export const WORLD_RULES = {
  hormuz_closure: {
    when: (g) => maxTen(g) >= 25,
    w: (g) => 1 + maxTen(g) / 40,
    responses: [
      { id: 'escort', label: 'Escort convoys', tags: ['Escort posture in the Gulf', 'Needs naval 2+ stationed', 'Escalation risk'], cost: 400,
        req: needNaval('ME'), act: escort('hormuz'), now: { stability: 1 }, sfx: [{ k: 'tension', id: '$hottest', d: 4 }], cut: 2, chain: { id: 'regional_war', after: 4 } },
      { id: 'spr', label: 'Release the reserve', tags: ['Strategic reserve drawdown', 'Needs reserve > 0'], cost: 0,
        req: (g) => (g.spr > 0 ? null : 'Reserve is empty'), ...spr, now: { inflation: -0.2 } },
      { id: 'reroute', label: 'Reroute and pay', tags: ['Paid up front', 'Inflation relief while it lasts'], cost: 500,
        now: { stability: 1 }, mods: { stats: { inflation: -0.08 }, cash: -20 } },
    ],
  },
  red_sea_attacks: {
    when: (g) => maxTen(g) >= 20,
    w: (g) => 1 + maxTen(g) / 50,
    responses: [
      { id: 'escort', label: 'Escort the lanes', tags: ['Escort posture off the Horn', 'Needs naval 2+ stationed'], cost: 300,
        req: needNaval('AF'), act: escort('bab'), now: { stability: 1 }, sfx: [{ k: 'tension', id: '$hottest', d: 3 }], cut: 3 },
      { id: 'reroute', label: 'Reroute around Africa', tags: ['Slower trade, steadier prices'], cost: 350,
        now: { gdpGrowth: -0.1 }, mods: { stats: { inflation: -0.05 }, cash: -15 } },
      { id: 'talks', label: 'Back-channel the sponsors', tags: ['Tension −5 on the hottest rival'], cost: 200,
        sfx: [{ k: 'tension', id: '$hottest', d: -5 }], cut: 1 },
    ],
  },
  panama_drought: {
    when: (g) => g.date.mo <= 4 || g.date.mo >= 11, // dry season
    w: () => 1,
    responses: [
      { id: 'slots', label: 'Pay for transit slots', tags: ['Trade keeps moving'], cost: 450, now: { gdpGrowth: 0.1 }, mods: { cash: -25 } },
      { id: 'priority', label: 'Negotiate priority', tags: ['Transit priority deal ($800M)', 'Needs a hemispheric home or SA relations'], cost: 0,
        req: panamaPriorityBlock, act: () => [{ verb: 'panamaDeal', payload: { deal: 'priority' } }], cut: 2 },
      { id: 'divert', label: 'Divert to the Suez route', tags: ['Free', 'Growth −0.2 while it lasts'], cost: 0, now: { inflation: 0.1 }, mods: { stats: { gdpGrowth: -0.03 } }, cut: 1 },
    ],
  },
  regional_war: {
    when: (g) => maxTen(g) >= 35,
    w: (g) => 1 + maxTen(g) / 30,
    responses: [
      { id: 'broker', label: 'Broker a ceasefire', tags: ['Tension −6', 'Peace accord follows'], cost: 400,
        sfx: [{ k: 'tension', id: '$hottest', d: -6 }], cut: 3, chain: { id: 'peace_accord', after: 3 } },
      { id: 'arms', label: 'Surge arms sales', tags: ['+$600M orders', 'Tension +4', 'Stability −1'], cost: -600,
        now: { stability: -1 }, sfx: [{ k: 'tension', id: '$hottest', d: 4 }], mods: { cash: 10 } },
      { id: 'neutral', label: 'Declare neutrality', tags: ['Stability +2', 'Allies read it as distance'], cost: 0,
        now: { stability: 2 }, sfx: [{ k: 'relBloc', bloc: 'west', d: -3 }] },
    ],
  },
  pandemic: {
    when: () => true,
    w: () => 1,
    responses: [
      { id: 'lockdown', label: 'Hard lockdown', tags: ['Stability +3', 'Growth −0.6', 'Recession follows'], cost: 0,
        now: { stability: 3, gdpGrowth: -0.6 }, cut: 3, chain: { id: 'financial_crisis', after: 4 } },
      { id: 'stimulus', label: 'Stimulus and testing', tags: ['Stability +2', 'Employment protected'], cost: 900,
        now: { stability: 2, unemployment: -0.4 }, mods: { stats: { healthcare: 0.1 }, cash: -30 } },
      { id: 'open', label: 'Stay open', tags: ['Growth +0.3', 'Stability −3'], cost: 0, now: { gdpGrowth: 0.3, stability: -3 }, mods: { stats: { healthcare: -0.1 } } },
    ],
  },
  financial_crisis: {
    when: (g) => (g.stats?.inflation ?? 0) > 3 || (g.stats?.debtGdp ?? 0) > 70 || (g.stats?.gdpGrowth ?? 3) < 2,
    w: (g) => 1 + Math.max(0, (g.stats?.debtGdp ?? 0) - 70) / 40,
    responses: [
      { id: 'bailout', label: 'Bank rescue', tags: ['Shorter, shallower'], cost: 1000, now: { stability: 1 }, cut: 3 },
      { id: 'austerity', label: 'Austerity', tags: ['+$600M saved', 'Stability −4'], cost: -600, now: { stability: -4 }, mods: { cash: 15 } },
      { id: 'stimulus', label: 'Counter-cyclical stimulus', tags: ['Growth +0.3 while it lasts'], cost: 700, mods: { stats: { gdpGrowth: 0.05 }, cash: -20 } },
    ],
  },
  energy_crunch: {
    when: (g) => maxTen(g) >= 20 || (g.spr || 0) < 2 || !!g.embargoedBy,
    w: (g) => 1 + ((g.spr || 0) < 2 ? 0.5 : 0) + (g.embargoedBy ? 0.5 : 0),
    responses: [
      { id: 'spr', label: 'Release the reserve', tags: ['Strategic reserve drawdown', 'Needs reserve > 0'], cost: 0,
        req: (g) => (g.spr > 0 ? null : 'Reserve is empty'), ...spr, now: { inflation: -0.2 } },
      { id: 'ration', label: 'Ration demand', tags: ['Stability −2', 'Inflation relief while it lasts'], cost: 0, now: { stability: -2 }, mods: { stats: { inflation: -0.06 } }, cut: 1 },
      { id: 'subsidy', label: 'Subsidize households', tags: ['Stability +2'], cost: 600, now: { stability: 2 }, mods: { cash: -20 } },
    ],
  },
  breakthrough: { when: () => true, w: () => 1, instant: true, responses: [] }, // no card: a rival lab publishes, nothing to answer
  nuclear_taboo: {
    when: () => false, w: () => 0, // only ever follows an actual nuclear employment (actions.js)
    responses: [
      { id: 'summit', label: 'Call a disarmament summit', tags: ['Every rival −5 tension', 'Peace accord follows'], cost: 500,
        sfx: [{ k: 'tension', id: '$hottest', d: -5 }], now: { stability: 2 }, chain: { id: 'peace_accord', after: 6 } },
      { id: 'pledge', label: 'Pledge no first use', tags: ['Free', 'Relations +4 with the West'], cost: 0, sfx: [{ k: 'relBloc', bloc: 'west', d: 4 }], now: { stability: 1 } },
    ],
  },
  peace_accord: {
    when: (g) => maxTen(g) >= 15,
    w: () => 1,
    responses: [
      { id: 'credit', label: 'Claim the credit', tags: ['Stability +2', 'Allies +2 relations'], cost: 0, now: { stability: 2 }, sfx: [{ k: 'relBloc', bloc: 'west', d: 2 }] },
      { id: 'reconstruct', label: 'Fund reconstruction', tags: ['Tension −4'], cost: 500, sfx: [{ k: 'tension', id: '$hottest', d: -4 }], mods: { cash: -15 } },
    ],
  },
};

// Flashpoints: four inline responses, same ids on the map panel. `lingers` is the monthly sphere swing in the region
// while the "in effect" row lasts (6 months).
export const FP_RESPONSES = [
  { id: 'mediate', label: 'Mediate', tags: ['Sphere +7'], sphere: 0.35 },
  { id: 'intervene', label: 'Deploy forces', tags: ['Sphere +15', 'Needs forces here or Military 70+'], sphere: 0.5 },
  { id: 'fund', label: 'Fund partners', tags: ['Sphere +9, rivals −3'], sphere: 0.4 },
  { id: 'concede', label: 'Concede', tags: ['Free', 'Sphere −3, rival +6'], sphere: -0.2 },
  { id: 'diplomatic', label: 'Diplomatic', tags: ['Needs an embassy here'], sphere: 0.25, mapOnly: true },
];
export const FP_LINGER = 6;
