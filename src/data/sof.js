// F8 (#56, spec Part 10): Tier 1 / Tier 2 special operations forces as named units. `ops` is operators (the assaulters and team
// members an operation draws on, not the unit's total personnel `pers`); `subs` the deployable sub-units an operation commits
// (squadron, troop, battalion, team); `cls` the graduates of one surge class. Sizes are approximate open-source figures as of 2024,
// rounded; status_source on every line. China and Brazil stay generic until the owner supplies names.
const GK = 'open sources (approximate), owner to verify';
const GEN = 'generic until the owner supplies names';
const U = (id, tier, n, ops, pers, subs, sub, cls, role, status_source) => ({ id, tier, n, ops, pers, subs, sub, cls, role, status_source });

export const SOF_ORBAT = {
  usa: [
    U('cag', 1, 'CAG / 1st SFOD-D (Delta)', 300, 1000, 4, 'squadron', 12, 'Hostage rescue, high-value target raids', `${GK}; four sabre squadrons`),
    U('devgru', 1, 'DEVGRU (SEAL Team 6)', 300, 1800, 4, 'squadron', 12, 'Maritime counterterrorism, high-value target raids', `${GK}; four assault squadrons`),
    U('sts24', 1, '24th Special Tactics Squadron', 100, 250, 3, 'team', 6, 'Combat control, JTAC and pararescue attached to Tier 1', GK),
    U('rangers', 2, '75th Ranger Regiment', 3600, 3600, 3, 'battalion', 120, 'Airfield seizure, raids, Tier 1 security element', `${GK}; three battalions`),
    U('sf', 2, 'Army Special Forces groups', 4500, 10000, 5, 'group', 90, 'Unconventional warfare, foreign internal defense', `${GK}; five active groups`),
    U('seals', 2, 'Navy SEAL Teams', 2500, 2500, 8, 'team', 60, 'Maritime special reconnaissance and direct action', `${GK}; eight teams`),
    U('marsoc', 2, 'MARSOC Raider Regiment', 900, 3500, 3, 'battalion', 40, 'Special reconnaissance, direct action, partner forces', `${GK}; three Raider battalions`),
  ],
  russia: [
    U('ksso', 1, 'KSSO (Special Operations Forces Command)', 500, 1500, 4, 'detachment', 15, 'Strategic raids and direct action abroad', `${GK}; Syria and Crimea record`),
    U('alpha', 1, 'FSB Alpha Group', 250, 700, 3, 'detachment', 10, 'Counterterrorism and hostage rescue', GK),
    U('spetsnaz', 2, 'GRU Spetsnaz brigades', 8000, 12000, 7, 'brigade', 250, 'Special reconnaissance and sabotage', `${GK}; heavy losses in Ukraine since 2022`),
    U('vdv45', 2, '45th Guards Spetsnaz Brigade (VDV)', 1000, 1500, 2, 'battalion', 40, 'Airborne reconnaissance and raids', GK),
  ],
  china: [
    U('t1', 1, 'Tier 1 special mission unit', 350, 800, 4, 'squadron', 12, 'Counterterrorism, high-value target raids', GEN),
    U('t2', 2, 'Theater command special operations brigades', 10000, 15000, 9, 'brigade', 300, 'Special reconnaissance, sabotage, raids', GEN),
  ],
  germany: [
    U('ksk', 1, 'KSK (Kommando Spezialkräfte)', 300, 1400, 4, 'company', 12, 'Hostage rescue, raids, special reconnaissance', `${GK}; four commando companies`),
    U('ksm', 1, 'KSM (Kommando Spezialkräfte Marine)', 100, 250, 2, 'team', 5, 'Maritime counterterrorism and boarding', GK),
    U('fsj', 2, 'Division Schnelle Kräfte paratroopers', 4000, 4000, 2, 'regiment', 120, 'Airborne raids, evacuation operations', `${GK}; Fallschirmjäger regiments 26 and 31`),
  ],
  japan: [
    U('sfgp', 1, 'Special Forces Group (SFGp)', 300, 300, 3, 'company', 10, 'Counterterrorism, island recovery', GK),
    U('sbu', 1, 'Special Boarding Unit (SBU)', 80, 100, 2, 'team', 4, 'Maritime interdiction and boarding', GK),
    U('abn1', 2, '1st Airborne Brigade', 1900, 1900, 3, 'battalion', 80, 'Airborne raids, island reinforcement', GK),
  ],
  norway: [
    U('fsk', 1, 'FSK (Forsvarets spesialkommando)', 200, 400, 3, 'troop', 8, 'Counterterrorism, special reconnaissance', GK),
    U('mjk', 1, 'MJK (Marinejegerkommandoen)', 150, 250, 2, 'troop', 6, 'Maritime special operations', GK),
    U('telemark', 2, 'Telemark Battalion', 500, 500, 4, 'company', 30, 'Rapid reaction, Tier 1 support', GK),
  ],
  brazil: [
    U('t1', 1, 'Tier 1 special mission unit', 350, 600, 3, 'detachment', 10, 'Counterterrorism, hostage rescue', GEN),
    U('t2', 2, 'Tier 2 special forces', 2500, 3500, 3, 'battalion', 90, 'Special reconnaissance, jungle operations', GEN),
  ],
  cuba: [
    U('t1', 1, 'Tier 1 special mission unit', 0, 0, 2, 'detachment', 10, 'None fielded in 2024; selection can raise one', `${GK}; Tier 1 generic`),
    U('avispas', 2, 'Avispas Negras', 1500, 1500, 3, 'battalion', 60, 'Special reconnaissance, internal security', GK),
  ],
};
// A nation with no entry fields one generic unit per tier.
export const SOF_GENERIC = [
  U('t1', 1, 'Tier 1 special mission unit', 350, 700, 3, 'squadron', 10, 'Counterterrorism, raids', GEN),
  U('t2', 2, 'Tier 2 special forces', 2500, 3500, 3, 'battalion', 90, 'Special reconnaissance, raids', GEN),
];
export const sofOrbat = (nid) => SOF_ORBAT[nid] || SOF_GENERIC;
export const sofUnit = (nid, id) => sofOrbat(nid).find((u) => u.id === id);

// Rules. Game parameters tuned for play on the v57 money scale.
export const SOF_RULES = {
  // Surge classes: Tier 2 qualification t2Mo months; Tier 1 selection and operator training t1MoMax - (t1MoMax - t1MoMin) x quality/100.
  t2Mo: 24, t1MoMin: 24, t1MoMax: 36, maxPipes: 2,
  // Training cost $M/month per trainee in a surge class (charged to Training while it runs).
  costPer: { t2: 0.08, t1: 1.5 },
  // Personnel pay premium $M/month per operator (scaled by the pay slider).
  pay: { t2: 0.0006, t1: 0.012 },
  // Turnover (retirement, injury, return to the line) per year. The standing pipeline replaces it at the 2024 rate scaled by force
  // quality (capped at 1) and closes a gap below the 2024 strength at `refill` of the gap a month (about 3 years to rebuild).
  turnYr: 0.08, refill: 1 / 36,
  // A Tier 1 graduate comes t2Share from Tier 2, the rest from conventional forces. Surge classes stop at capF x 2024 strength.
  t2Share: 0.7, capF: 1.5, capMin: 150,
  // Operations: sub-units committed per tier, months deployed, months of recovery after. Intel ops deploy for their own duration.
  ops: { regime: { t1: 2, t2: 1, mo: 3, rec: 9 }, intel: { t2: 1, rec: 6, small: true }, raid: { t1: 1, mo: 1, rec: 5 } },
  // Casualties as a share of the committed operators.
  loss: { ok: 0.03, fail: 0.1 },
  // Tier-1 overmatch: free Tier 1 operators / t1Eq (US 2024 = 2.0 squadron-equivalents) x quality x land readiness; each adds
  // t1Points to `mine` plus a capped chance bonus (existing overmatch math, intel Tier-1 ops). t2Eq scales Tier 2 the same way.
  t1Eq: 350, t2Eq: 3800, t1Points: 8, t1Chance: 0.03, t1ChanceMax: 0.15,
};
export const OP_NAMES = { regime: 'Regime change', raid: 'Courier raid' };
export const unitCap = (u) => Math.max(SOF_RULES.capMin, Math.round(u.ops * SOF_RULES.capF));

// Selectors over g.forces.sof.units {id: {ops, out:[{op, tgt, mo, rec}]}}. Free sub-units are those not deployed or recovering;
// a unit's free operators are its operators x free / subs.
const unitsOf = (f) => Object.entries(f?.sof?.units || {});
const tierOf = (f, id) => sofUnit(f?.nid, id)?.tier;
export const freeSubs = (f, id) => { const u = sofUnit(f?.nid, id); const s = f?.sof?.units?.[id]; return u && s ? Math.max(0, u.subs - s.out.length) : 0; };
export const freeOps = (f, id) => { const u = sofUnit(f?.nid, id); const s = f?.sof?.units?.[id]; return u && s ? s.ops * freeSubs(f, id) / u.subs : 0; };
export const sofOps = (f, t) => unitsOf(f).reduce((a, [id, s]) => a + (tierOf(f, id) === t ? s.ops : 0), 0);
export const sofFree = (f, t) => unitsOf(f).reduce((a, [id, s]) => a + (tierOf(f, id) === t && s.ops >= 1 ? freeSubs(f, id) : 0), 0);
// Squadron-equivalents of free operators per tier: the strength events and the Tier-1 odds read.
export const sofEq = (f, t) => unitsOf(f).reduce((a, [id]) => a + (tierOf(f, id) === t ? freeOps(f, id) : 0), 0) / (t === 1 ? SOF_RULES.t1Eq : SOF_RULES.t2Eq);
// The unit an operation draws k sub-units from: the free unit with the most operators per sub-unit (a raid wants the heaviest element),
// or the fewest when `small` (a covert team wants the lightest footprint); a payload can name one.
export function pickUnit(f, t, k, want, small) {
  const ok = (id) => tierOf(f, id) === t && f.sof.units[id].ops >= 1 && freeSubs(f, id) >= k;
  if (want && ok(want)) return want;
  const per = (id) => f.sof.units[id].ops / sofUnit(f.nid, id).subs;
  return Object.keys(f?.sof?.units || {}).filter(ok).sort((a, b) => (small ? per(a) - per(b) : per(b) - per(a)) || freeSubs(f, b) - freeSubs(f, a))[0] || null; // ties: the fresher unit
}
// Names and counts as shown: "2 squadrons".
export const subsN = (u, k) => `${k} ${k === 1 ? u.sub : u.sub.endsWith('y') ? `${u.sub.slice(0, -1)}ies` : `${u.sub}s`}`;
