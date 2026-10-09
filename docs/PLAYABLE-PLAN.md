# Playable Build Plan (supersedes the 001/002 order in ROADMAP.md)

Priority set by owner 2026-10-09: **a playable build with proper visuals and every v57 core function**, first. Rule-based mitigation (exact parity, invariant fuzzing, balance bots, replay files) is deferred until the build is worth stabilizing.

## Guardrails (the minimum; non-negotiable)
1. **Thin seam.** Game state + monthly tick live in `src/sim/`, UI lives in `src/ui/`. The UI reads state and dispatches actions; it never computes game rules. No graphics work lands on the v57 monolith.
2. **Smoke gate.** `npm test` must show: 120 months autoplay with no crash, every tab renders its sentinel, save/resume round-trips. That is the whole gate for now.
3. **No silent feature loss.** Every v57 function listed in the vertical specs below must exist in the new build, or be listed in `reports/feature-gaps.md` with a reason. The owner signs off on that list.
4. **Mobile first.** Every screen works one-thumbed at 390px. Owner plays on a phone.
5. **v57 stays playable** at its URL until the new build reaches feature parity per this doc.
6. Existing rules still apply: CLAUDE.md process rules, docs/DESIGN-RULINGS.md, one task = one branch = one PR.

## Phases
| Phase | Goal | Model | Exit criteria |
|---|---|---|---|
| **P1** | v57 as-is, bundled from the repo and live on GitHub Pages | Sonnet | Playable at a URL on the phone; autosave works |
| **P2** | Thin seam: state + tick out of the component | Opus | Smoke gate green; v57 UI runs on the extracted engine; zero rule changes |
| **P3** | Visual foundation: design system + PixiJS world map | Opus | Map renders all v57 layers at 60fps on phone; tokens applied app-wide |
| **P4** | Vertical-by-vertical UI rebuild (V1..V9 below), one PR per vertical | Sonnet/Opus | Each vertical meets its acceptance list; feature-gaps list empty or signed off |

## Visual direction
Decision D1 (owner): one of **Situation-room tactical** · **Tropico-warm** · **Paradox-cartographic**. Recommended: **Situation-room tactical** (dense defense/intel data reads cleanly on a phone); owner confirms before P3 starts. Recorded in `docs/DESIGN-SYSTEM.md` by P3. All vertical UIs inherit the tokens; no per-tab styling.

## Shared UI shell (built in P3, used by every vertical)
- **HUD bar:** date, speed (pause/1x/2x/4x), treasury + monthly net, stability, hegemony, active pause reason chip (rule: a pause always shows its reason).
- **Bottom nav (mobile) / side rail (desktop):** the nine verticals, badge counts for pending decisions.
- **Notification queue:** event chips that pause and jump to the relevant panel (replaces vanishing toasts).
- **Panel primitive:** collapsible card with title, key figure, detail drawer. Replaces ad-hoc panels.
- **Confirm sheet:** every irreversible or escalatory act (blockade, Tier-1 op, nuclear option, ally sanction) shows cost and consequences before commit.

## Vertical specs
Each vertical: **core functions to preserve from v57** -> **UI target** -> **acceptance**.

### V1 Overview / World Map
- Preserve: real-geography map (REGION_GEO, Natural Earth), sphere shading per region, momentum arrows, trade routes, influence lines, chokepoint markers, flashpoint markers + timers, victory path progress (hegemony/econ/tech/dip), world event, nation vitals, national doctrine choice, decision-required count, budget breakdown.
- UI target: PixiJS map as the home screen; pinch-zoom/pan; tap region -> region sheet (sphere shares, units present, flashpoints, chokepoints); animated trade flows and fleet icons; victory paths as a compact rail.
- Acceptance: every v57 overlay present and toggleable; tap targets >= 44px; 60fps pan on phone.

### V2 Situation Room
- Preserve: action lanes (deployUnit, establishEmbassy, acts[] per item), tension per rival always visible, confrontations, ultimatums, blockades, brink rolls, nuclear register, rival demonstrations, final options (Twilight Struggle rule), hegemony-hold watch, pariah status.
- UI target: threat board sorted by tension; each rival a card with tension gauge, relations, posture, available responses; escalation ladder visualized as rungs.
- Acceptance: player never appears as a rival; every escalatory act goes through the confirm sheet; nuclear path reachable and clearly loss-adjacent.

### V3 Economy
- Preserve: tax engine (8-48% slider) and breadth, fiscal stance, monetary policy and interest rate, fiscal & debt actions, issue-brief policies (labor, infrastructure, healthcare, immigration, automation, diversification, green transition, diaspora, innovation zones, food/agri), ledger via cash(category), talent/retention, inequality, IP portfolio + policy.
- UI target: ledger as a waterfall (income/expense by category), sliders with live projected effect, policy cards with cost/effect/time.
- Acceptance: every treasury flow visible in the ledger by category; no dark flows.

### V4 Energy
- Preserve: oil/gas export share sliders, SPR, chokepoints (Hormuz, Suez, Bab al-Mandab, Panama, Malacca) + import routes, Panama Transit Priority / Lock Expansion, energy embargo (player->rival and Russia->player), concessions incl. Venezuela Orinoco + Absolute Resolve intervention + stewardship, renewables, energy policy actions, escort posture.
- UI target: flow diagram of imports by route with chokepoint status; SPR gauge; concession cards with ramp curves.
- Acceptance: disrupting a chokepoint visibly moves oil price and import cost; embargo available on every nation with consequences shown.

### V5 Resources
- Preserve: natural resource management, reserves and depletion, named basins (e.g. Greater Green River), acquisition policy, export deals, cut-off.
- UI target: reserve cards with depletion timelines; deal list with partner, value, term.
- Acceptance: all resource actions from v57 reachable; depletion visible as time-to-zero.

### V6 Defense
- Preserve: force overview, platforms with develop-then-build (rq170/rq180, fa_xx, mq25, frigate, zumwalt, carriers, triad legs), SAP production tranches (no caps), personnel pay, acquisition policy, export marketplace (sellDefTech, verticals), order of battle (deploy/recall by theater), force postures (Deterrence/Escort/ISR Overwatch/Joint Exercises/Humanitarian), nuclear triad, deployed military power.
- UI target: order of battle on the map (units as icons per theater); platform cards with dev progress; marketplace as buyer list with willingness/advantage.
- Acceptance: every v57 platform buildable; deploy/recall from the map; posture changes reflected in tension.

### V7 Intelligence
- Preserve: agency budget level, ops catalog incl. counter-intel and ops against Russia/China (all nations targetable, hostile-first, allies flagged), operations in progress, Tier-1 Operations (regime change with overmatch math, Absolute Resolve), embassy missions/expulsion, espionage exposure, intel crises.
- UI target: target dossier per nation; op cards with success odds and blowback; Tier-1 checklist with live overmatch bar.
- Acceptance: "no viable targets" can never appear when any nation exists; toppling an ally shows its price first.

### V8 Technology
- Preserve: R&D verticals and depth, research queue, dynamic era-gated tech programs (stage/cond/why/sfx), civilian technology programs, active technology effects, AGI (t9) for tech victory, rdSpeedMult from talent/traits.
- UI target: tech web or lanes by vertical with era gates; queue strip.
- Acceptance: era gating dynamic (ruling 5); queue persists across saves.

### V9 Trade & Diplomacy
- Preserve: bloc-first accordion (EU, Indo-Pacific, Middle East, South Asia, Americas, Great Powers) with bulk actions, statecraft (visit/aid/trade/pact), embassies, influence sliders, bloc trade tiers (EU/CN/OPEC, quota, swing), EU T3 path + EU Summit + one-tap pact, sanctions on every nation, currency posture, defense pacts, trade agreements, active trade income streams, leverage web (dominance multipliers).
- UI target: bloc cards with tier progress; nation sheet with all actions in one place; dominance multipliers shown where they apply.
- Acceptance: every nation sanctionable; frozen blocs explain why and offer the unfreeze path.

## Deferred (explicitly not now)
Exact parity proof, invariant fuzz expansion, balance bots, replay files, production queues/standing orders automation, JSOC task forces, military bases, rare-earth gating, theater/reach adjacency. Revisit after P4.
