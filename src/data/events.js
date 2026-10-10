// Event rules (E2, #14). Rule change: parity with v57 ends for the event system.
// World events: eligibility (`when`), context weight (`w`), and 2-3 in-place responses wired to engine actions.
// Flashpoints: four inline responses. Answering closes the card and leaves an "in effect" row in the outliner.
// Pure data + pure predicates over the live state `g`. Costs are $M.
import { navalWeight, panamaPriorityBlock } from '../sim/formulas.js';
import { CHOKEPOINTS } from './chokepoints.js';
import { maxTen, memberOf, ownedMembers, squeezed, squeezedCount, mineralName, lowestReadiness } from './event-ctx.js';
import { NATIONS } from './nations.js';

export const EVENT_COOLDOWN = 60;   // months before the same world event may fire again
export const CHAIN_PATIENCE = 6;    // a queued follow-up that cannot fire (cooldown, busy slot) is dropped after this many months

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
    when: (g) => (g.stats?.healthcare ?? 0) < 85, // E6 (#18): a prepared health system is not hit
    w: (g) => 1 + Math.max(0, 70 - (g.stats?.healthcare ?? 0)) / 40,
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
  breakthrough: { when: (g) => Object.values(g.defLevels || {}).some((v) => v >= 3), w: (g) => 1 + Object.values(g.defLevels || {}).filter((v) => v >= 3).length / 4, instant: true, responses: [] }, // no card: a rival lab publishes, nothing to answer
  nuclear_taboo: {
    when: () => false, w: () => 0, // only ever follows an actual nuclear employment (actions.js)
    responses: [
      { id: 'summit', label: 'Call a disarmament summit', tags: ['Every rival −5 tension', 'Peace accord follows'], cost: 500,
        sfx: [{ k: 'tension', id: '$hottest', d: -5 }], now: { stability: 2 }, chain: { id: 'peace_accord', after: 6 } },
      { id: 'pledge', label: 'Pledge no first use', tags: ['Free', 'Relations +4 with the West'], cost: 0, sfx: [{ k: 'relBloc', bloc: 'west', d: 4 }], now: { stability: 1 } },
    ],
  },
  // ── E6 (#18): events that touch minerals, program partnerships, forces, SOF, cyber and escalation. Every one is gated on
  // state that the system itself produces (controls against you, a membership, readiness, a Tier 1 squadron, tension). ──
  mineral_controls_bite: {
    when: (g) => !!squeezed(g),
    w: (g) => 1 + squeezedCount(g) / 3,
    responses: [
      { id: 'reserve', label: 'Draw the strategic reserve', tags: ['Releases the squeezed mineral from reserve', 'Needs reserve > 0'], cost: 0,
        req: (g) => { const m = squeezed(g); if (!m) return 'No mineral is withheld'; return g.minerals.own[m].reserve <= 0 ? `No ${mineralName(m)} in reserve` : g.minerals.release.includes(m) ? 'Already releasing it' : null; },
        act: (g) => [{ verb: 'toggleStockpileRelease', payload: { mineral: squeezed(g) } }], now: { inflation: -0.1 }, cut: 1 },
      { id: 'spot', label: 'Pay the spot premium', tags: ['Buy through traders', 'Inflation relief while it lasts'], cost: 600,
        now: { gdpGrowth: 0.1 }, mods: { stats: { inflation: -0.05 }, cash: -20 }, cut: 2 },
      { id: 'recycle', label: 'Crash recycling program', tags: ['Recycling on for that mineral', 'Needs a recyclable mineral'], cost: 350,
        req: (g) => { const m = squeezed(g); if (!m) return 'No mineral is withheld'; return m === 'enrichment' ? 'Enriched uranium cannot be recycled' : g.minerals.recycle.includes(m) ? 'Already recycling it' : null; },
        act: (g) => [{ verb: 'toggleRecycling', payload: { mineral: squeezed(g) } }], now: { stability: 1 } },
    ],
  },
  export_backlash: {
    when: (g) => (g.minerals?.controls?.length || 0) > 0,
    w: (g) => 1 + (g.minerals.controls.length) / 2,
    responses: [
      { id: 'hold', label: 'Hold the line', tags: ['Stability +1', 'Tension +3', 'Rivals race for substitutes'], cost: 0,
        now: { stability: 1 }, sfx: [{ k: 'tension', id: '$hottest', d: 3 }], chain: { id: 'breakthrough', after: 8 } },
      { id: 'exempt', label: 'Exempt your bloc', tags: ['Relations +4 inside your bloc'], cost: 400,
        sfx: [{ k: 'relBloc', bloc: '$own', d: 4 }], mods: { cash: -10 } },
      { id: 'lift', label: 'Lift the controls', tags: ['Free', 'Tension −3', 'Gives up the leverage'], cost: 0,
        req: (g) => (g.minerals?.controls?.length ? null : 'No controls in force'),
        act: (g) => [{ verb: 'toggleExportControl', payload: { mineral: g.minerals.controls[0] } }], sfx: [{ k: 'tension', id: '$hottest', d: -3 }], now: { stability: -1 } },
    ],
  },
  partner_security_audit: {
    when: (g) => !!memberOf(g),
    w: (g) => 1 + (memberOf(g)?.tier === 'codev' ? 0 : 0.5),
    responses: [
      { id: 'harden', label: 'Fund counter-intelligence', tags: ['Relations +3 with the owner', 'Audit passes'], cost: 450,
        sfx: [{ k: 'rel', id: '$owner', d: 3 }], now: { stability: 1 }, mods: { cash: -10 } },
      { id: 'inspectors', label: 'Admit the inspectors', tags: ['Relations +5 with the owner', 'Stability −1 (sovereignty)'], cost: 0,
        sfx: [{ k: 'rel', id: '$owner', d: 5 }], now: { stability: -1 }, cut: 2 },
      { id: 'stonewall', label: 'Stonewall them', tags: ['Free', 'Suspends your membership', 'Relations −10 with the owner'], cost: 0,
        sfx: [{ k: 'suspend', pid: '$member' }], now: { stability: 1 } },
    ],
  },
  owner_leak_scare: {
    when: (g) => ownedMembers(g).length > 0,
    w: (g) => 1 + ownedMembers(g).filter((m) => g.arsenal.access[m.pid][m.nid] && NATIONS[m.nid]?.secFlag).length,
    responses: [
      { id: 'expel', label: 'Expel the likeliest source', tags: ['Partner expelled', 'Relations −15 with them', 'Export income lost'], cost: 0,
        req: (g) => (ownedMembers(g).length ? null : 'No partners admitted'),
        act: (g) => { const m = ownedMembers(g)[0]; return [{ verb: 'expelPartner', payload: { program: m.pid, nation: m.nid } }]; }, now: { stability: 1 } },
      { id: 'sweep', label: 'Joint counter-intel sweep', tags: ['Tension −2 on the hottest rival', 'Partners stay'], cost: 500,
        sfx: [{ k: 'tension', id: '$hottest', d: -2 }], now: { stability: 1 } },
      { id: 'tolerate', label: 'Tolerate it', tags: ['Free', 'A rival gains ground', 'Follow-up breakthrough abroad'], cost: 0,
        sfx: [{ k: 'gdbTop', id: '$hottest', d: 0.4 }], chain: { id: 'breakthrough', after: 6 } },
    ],
  },
  readiness_grounding: {
    when: (g) => !!g.forces && lowestReadiness(g) < 55,
    w: (g) => 1 + (55 - lowestReadiness(g)) / 30,
    responses: [
      { id: 'retrain', label: 'Emergency training surge', tags: ['Readiness +8 on every branch', 'Training to Intensive'], cost: 450,
        act: () => [{ verb: 'setTraining', payload: { level: 3 } }], sfx: [{ k: 'readiness', b: 'all', d: 8 }], now: { stability: 1 }, cut: 2 },
      { id: 'inspect', label: 'Stand down and inspect', tags: ['Retention +3', 'Shorter grounding'], cost: 150,
        sfx: [{ k: 'retention', d: 3 }], cut: 3 },
      { id: 'blame', label: 'Blame the contractor', tags: ['Free', 'Readiness −4 everywhere', 'Recruitment slump follows'], cost: 0,
        sfx: [{ k: 'readiness', b: 'all', d: -4 }], now: { stability: -1 }, chain: { id: 'recruitment_slump', after: 6 } },
    ],
  },
  recruitment_slump: {
    when: (g) => !!g.forces && (g.forces.retention < 45 || g.forces.active < 45),
    w: (g) => 1 + Math.max(0, 45 - g.forces.retention) / 30,
    responses: [
      { id: 'bonus', label: 'Enlistment bonuses', tags: ['Retention +10'], cost: 600, sfx: [{ k: 'retention', d: 10 }], mods: { cash: -15 } },
      { id: 'benefits', label: 'Education and housing benefits', tags: ['Education +1', 'Retention +5'], cost: 300,
        sfx: [{ k: 'retention', d: 5 }], now: { education: 1 }, mods: { cash: -10 } },
      { id: 'callup', label: 'Call up the reserve', tags: ['Active strength +6 from the reserve', 'Stability −2', 'Unemployment +0.3'], cost: 0,
        sfx: [{ k: 'manpower', d: 6 }], now: { stability: -2, unemployment: 0.3 }, cut: 2, chain: { id: 'readiness_grounding', after: 8 } },
    ],
  },
  hostage_crisis: {
    when: (g) => (g.forces?.sof?.t1 || 0) >= 1 && maxTen(g) >= 15,
    w: (g) => 1 + (g.forces.sof.t1) / 4,
    responses: [
      { id: 'raid', label: 'Send the Tier 1 squadron', tags: ['Stability +3', 'Tension +4', 'Land readiness −5', 'Needs Tier 1 and land readiness 50+'], cost: 300,
        req: (g) => ((g.forces?.sof?.t1 || 0) < 1 ? 'No Tier 1 squadron' : (g.forces.readiness?.land || 0) < 50 ? 'Land readiness below 50' : null),
        now: { stability: 3 }, sfx: [{ k: 'tension', id: '$hottest', d: 4 }, { k: 'readiness', b: 'land', d: -5 }], cut: 3 },
      { id: 'ransom', label: 'Pay through intermediaries', tags: ['Stability +1', 'Rewards the next kidnapping'], cost: 700,
        now: { stability: 1 }, sfx: [{ k: 'relBloc', bloc: '$own', d: -2 }], cut: 3 },
      { id: 'refuse', label: 'Refuse to negotiate', tags: ['Free', 'Stability −3'], cost: 0,
        now: { stability: -3 }, sfx: [{ k: 'tension', id: '$hottest', d: 2 }] },
    ],
  },
  sanctions_wave: {
    when: (g) => (g.sanctions?.size || 0) >= 1 && maxTen(g) >= 20,
    w: (g) => 1 + (g.sanctions.size) / 3,
    responses: [
      { id: 'waiver', label: 'Buy waivers from your bloc', tags: ['Relations +3 inside your bloc', 'Shorter wave'], cost: 500,
        sfx: [{ k: 'relBloc', bloc: '$own', d: 3 }], cut: 3, mods: { cash: -10 } },
      { id: 'neutrals', label: 'Route trade through neutrals', tags: ['Steadier trade, higher costs'], cost: 400,
        now: { gdpGrowth: 0.1 }, mods: { stats: { inflation: 0.03 }, cash: -15 }, cut: 2 },
      { id: 'retaliate', label: 'Retaliate in kind', tags: ['Free', 'Tension +4', 'Energy crunch follows'], cost: 0,
        sfx: [{ k: 'tension', id: '$hottest', d: 4 }], now: { stability: 1 }, chain: { id: 'energy_crunch', after: 3 } },
    ],
  },
  grid_attack: {
    when: (g) => ((g.defLevels?.cyber) || 0) < 5 && maxTen(g) >= 25,
    w: (g) => 1 + (5 - ((g.defLevels?.cyber) || 0)) / 5,
    responses: [
      { id: 'harden', label: 'Harden the grid', tags: ['Stability +1', 'Shorter outage'], cost: 500, now: { stability: 1 }, cut: 2, mods: { cash: -15 } },
      { id: 'attribute', label: 'Name the attacker', tags: ['Tension +5', 'Relations +2 inside your bloc'], cost: 0,
        sfx: [{ k: 'tension', id: '$hottest', d: 5 }, { k: 'relBloc', bloc: '$own', d: 2 }], now: { stability: 1 } },
      { id: 'retaliate', label: 'Hit back in cyberspace', tags: ['Tension +6', 'Their program set back', 'False alarm follows'], cost: 300,
        sfx: [{ k: 'tension', id: '$hottest', d: 6 }, { k: 'gdbTop', id: '$hottest', d: -0.3 }], chain: { id: 'false_alarm', after: 5 } },
    ],
  },
  false_alarm: {
    when: (g) => maxTen(g) >= 55,
    w: (g) => 1 + (maxTen(g) - 55) / 20,
    responses: [
      { id: 'hotline', label: 'Use the hotline', tags: ['Free', 'Tension −10', 'Peace accord follows'], cost: 0,
        sfx: [{ k: 'tension', id: '$hottest', d: -10 }], chain: { id: 'peace_accord', after: 6 } },
      { id: 'review', label: 'Joint data-center review', tags: ['Tension −5', 'Relations +2 inside your bloc'], cost: 300,
        sfx: [{ k: 'tension', id: '$hottest', d: -5 }, { k: 'relBloc', bloc: '$own', d: 2 }] },
      { id: 'alert', label: 'Raise alert levels', tags: ['Tension +8', 'Readiness +4', 'Stability −1'], cost: 0,
        sfx: [{ k: 'tension', id: '$hottest', d: 8 }, { k: 'readiness', b: 'all', d: 4 }], now: { stability: -1 } },
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
