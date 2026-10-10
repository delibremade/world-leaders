# Feature gaps vs v57 (PLAYABLE-PLAN guardrail 3)

Every v57 function must exist in the new build or be listed here with a reason. The owner signs off on this list.

| Phase | v57 function | Status | Reason / where |
|---|---|---|---|
| P3b | Political sphere map: affiliation fill, contested hatch, labels, deployed badge, flashpoint + timer, 6-month trend, intel dot, trade routes, influence lines, chokepoints | Preserved | `src/ui/map/scene.js` (one implementation for PixiJS and SVG) |
| P3b | Click region -> region panel (posture, deploy +/-, blockade, strike, intel, alliance, flashpoint responses) | Preserved | region tap -> v57 panel below the map; P3c moves it into the bottom sheet |
| P3b | Vitals column + drill on phones | Preserved, moved | under 900px the column stacks below the content until P3c's HUD |
| P3c | HUD stat chips (treasury, GDP, unemployment, inflation, stability, military) with trend arrows | Preserved, changed | HUD shows treasury, stability, hegemony with sparklines and why; the other three stay in Nation Vitals (every tab) |
| P3c | Doctrine modal | Preserved as a non-blocking card | the engine never paused for it; the card keeps every option and the HUD badge counts it |
| P3c | Decision Required block on the overview | Preserved, moved | event card strip on every tab |
| P3c | Region panel below the map | Preserved, moved | bottom sheet on region tap, with the region's nations as rows |
| P3c | Top tab strip | Replaced | bottom nav (phone) / side rail (desktop), same nine verticals |
| P3c | Leverage, Petrodollar, Grace, Decision and unexamined-issue HUD chips | Partly moved | grace and leverage are outliner timers / badges; petrodollar chip dropped from the HUD (still on the Economy tab) |
| E5a | Nine-vertical nav (Situation Room, Resources as verticals) | Replaced | eight verticals, 48.7px each at 390px (the only count that meets 44px): Situation folds under Overview and Resources under Economy behind a segmented control (Map / Situation, Ledger / Resources); every pane and action is unchanged, the Situation threat badge rolls up onto the Overview icon (owner ruling 2026-10-10) |
| E5a | Defense tab: Forces panel, Order of Battle, personnel pay slider | Moved | Forces vertical: Manpower (strength, retention, pay), Quality, Training, Equipment (crews, inventory, station/recall, theaters, maintenance), Specialized (SOF, ISR, cyber, nuclear crews) |
| E5b | Defense tab (platforms, SAP catalog, allied programs, export marketplace, force structure, R&D dots, aging force, Article 9) | Moved | Arsenal vertical: Programs (pipeline, SAP office, catalog), Procurement (platforms, acquisition policy, recapitalize, Article 9, R&D readiness), Supply (mineral inputs and coverage, jump to Resources), Partnerships (gates, compliance, tiers, admit/expel), Exports (buyers, willingness, advantage, deals), Deterrence (triad, deterrence tiers, MAD parity per rival, nuclear register) |
| E5b | Nuclear register on the Situation panel | Preserved | same component also in Arsenal > Deterrence (`src/ui/shell/NukeRegister.jsx`) |
| E5c | Resources tab: natural resources, rare-earth export extraction, GGRB, renewables, minerals | Moved, merged | Resources (under Economy) has six sub-tabs: Reserves (ore with time-to-zero, plus the v57 rare-earth export extraction, kept apart from the processing feedstock it was never linked to), Processing, Stockpile, Deals, Controls, Natural (oil, gas, coal, uranium extraction, Greater Green River Basin, renewables, unchanged) |
| E5c | Energy tab import contract for rare earths | Preserved, not merged | it is an energy-security import row (`importContracts`), not an export view; stays in Energy |

### Reachability check, DEFENSE-RESOURCES-SPEC Parts 1-7 (E5, 2026-10-10)
Every mechanic has a control or a figure on a screen; each row is asserted by `test/layout.test.js` at 390 and 1280px or by a flow test.

| Part | Mechanic | Where |
|---|---|---|
| 1 | F-47 and every deployable platform: station, recall, theater summary | Forces > Equipment (`test/deploy.test.js`, catalogs test) |
| 2 | Nation catalog by role slot, stage, fund/initiate/produce, J-36 and J-50 parallel funding | Arsenal > Programs |
| 3 | Ore reserves and depletion, processing plants, recycling | Resources > Reserves, Processing |
| 3 | Refined stockpile, strategic reserve buy and release | Resources > Stockpile |
| 3 | Offtake deals, allied processing pact | Resources > Deals |
| 3 | Export controls (confirm sheet), controls against you, rival R&D impact | Resources > Controls |
| 3 | Shortfall slows a tranche and names the binding mineral | Arsenal > Programs (supply line), Arsenal > Supply (coverage why) |
| 4, 8 | Pipeline, procurement, supply, partnerships, exports, deterrence | Arsenal, six sub-tabs |
| 6 | Tiers, gates, compliance, join/order/reinstate/defect, owner admit and expel | Arsenal > Partnerships; nation sheet rows |
| 7 | Strength, recruitment, retention, pay with live effect | Forces > Manpower |
| 7 | Quality index and drivers with why and Economy jump | Forces > Quality |
| 7 | Training budget, readiness, decay countdown, crew pipelines | Forces > Training |
| 7 | Crews vs units, crew gap, inventory, maintenance | Forces > Equipment |
| 7 | SOF tiers and selection (confirm sheet), ISR, cyber, nuclear crews | Forces > Specialized |
| 7 | Capability per branch, Tier-1 odds, export edge | Forces > Training (per-branch multiplier), Intel Tier-1 card, Arsenal > Exports (buyer terms) |
| 5 | Event cards and responses | not in E5 scope (E2 event cards and outliner, unchanged) |

Nothing from Parts 1-7 is unreachable. Known thin spots, for sign-off: the equipment factor in capability is shown only through the branch multiplier, not as its own line; Part 5 stays in the event-card strip.

No gaps open; the petrodollar HUD chip is the one cosmetic removal, listed for sign-off.
