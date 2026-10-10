# Defense, Resources and Events Spec (owner-approved 2026-10-10)

Scope: five changes the owner asked for after playing v0.64.0. Parts 1 and 5 fix broken behavior; parts 2 to 4 add rules. **Parity with v57 ends for the systems these touch**; the guard for them becomes tests and invariants. Every other system keeps byte-identical parity.

Build order: P3d (running) -> **E1** F-47 deployable + **E2** event system fixes (Sonnet) -> **E3** nation catalogs + **E4** minerals/processing engine (Opus) -> **E5** Defense + Resources UI (Sonnet) -> **E6** content expansion (Sonnet).

## Part 1. F-47 deployable (E1, bug)
- Found: `f47` exists in BLACK_PROGRAMS ($11B, 36 mo, +26 mil) but the deploy list is hard-coded to b21, sr72, ssnx. F-47 can be built, never stationed.
- Fix: deployable set comes from data (`deployable:true` on the platform), not a literal list. F-47 deploys by region like other air platforms. CCA wings attach to F-47 wings as a multiplier (no standalone deploy).
- Done when: F-47 can be deployed and recalled from the map and the Order of Battle; a test lists every platform flagged deployable and asserts each can be stationed.

## Part 2. Nation-specific catalogs (E3, rules)
Replace the single US-named black-program list with **role slots** filled per nation. Same slots, different platforms, costs, timelines and starting stage.

| Slot | USA | China | Russia | Japan / UK / Italy | Germany | Others |
|---|---|---|---|---|---|---|
| Gen 5 fighter | F-35 (in service) | J-20, J-35 (in service) | Su-57 (in service, low rate) | F-35 buyers | F-35 buyer | Norway F-35; Brazil Gripen E (gen 4.5) |
| Gen 6 fighter | F-47 (development) | **J-36 and J-50 (prototypes, parallel)** | none at start | GCAP (development, ~2035) | FCAS (development) | none |
| Stealth bomber | B-21 (development/LRIP) | H-20 (development) | PAK DA (development) | none | none | none |
| CCA / UCAV | CCA | GJ-11 | S-70 Okhotnik | GCAP adjunct | none | none |
| Hypersonic ISR | SR-72 (development) | WZ-8 | none | none | none | none |
| Next-gen SSN | SSN(X) | Type 095 | Husky | none | none | none |
| Carrier | Ford class | Fujian (Type 003) | none | none | none | none |

- Starting stage reflects real status as of the 2024 start; program stages: **R&D -> prototype -> LRIP -> full rate**. Nations with "none" can buy from allies (Exports) or start their own program at R&D.
- China gen 6: player may **fund J-36, J-50, or both**; funding both costs more but de-risks.
- Entries other than China gen 6 come from general knowledge; mark each with a `status_source` field and the owner corrects any.
- Done when: each nation's Defense tab shows only its own catalog; a China campaign can build and deploy J-20/J-35 at start and progress J-36/J-50 through stages; existing US behavior unchanged except Part 1.

## Part 3. Minerals and processing (E4, rules; un-defers "rare-earth gating")
- Minerals: rare earths, gallium, germanium, graphite, lithium, cobalt, nickel, tungsten, titanium, uranium enrichment.
- Per nation, per mineral, three stocks: **ore reserves -> processing capacity (units/month) -> refined stockpile**. Ore without processing is worth little; processing is the strategic bottleneck.
- Platforms declare mineral inputs per production tranche. Shortfall **slows production proportionally** (never silently cancels) and shows the binding mineral.
- Levers: build processing plant (multi-year, capex, upkeep), offtake deal with a partner (price, term, relation-dependent), strategic stockpile (buy, hold, release), recycling program, allied processing pact (bloc-level), **export controls** on any mineral you process (cuts rivals' supply; costs trade income and relations).
- China starts dominant in processing for most of the list; the US starts ore-rich, processing-poor in several; numbers are game abstractions tuned for play, documented in `src/data/minerals.js`.
- Done when: an embargoed or export-controlled mineral measurably slows a dependent platform; building processing measurably restores it; invariants keep all stocks non-negative and capacity within bounds.

## Part 4. Defense tab revamp (E5, UI)
Five sub-tabs, mobile-first at 390px:
- **Forces:** platforms grouped by role slot and generation; deploy/recall inline; theater summary.
- **Programs:** pipeline view (R&D / prototype / LRIP / full rate) with progress, months to next stage, cost burn.
- **Supply:** per program, its mineral inputs and coverage percent; tap to the Resources vertical.
- **Deterrence:** triad, MAD parity, nuclear register.
- **Exports:** buyers, willingness, advantage; which of your platforms are exportable.
Resources vertical (V5) gets the matching minerals view: reserves, processing, stockpile, deals, controls.

## Part 5. Event system (E2 fixes, E6 content)
Found in code: world-event cards have **no response options** (info only, linger for their full duration); flashpoint cards only offer "Open region"; **9 world events** drawn uniformly with no cooldown at ~4.5%/month; **8 decisions** that **reset and repeat** once exhausted.

E2 (fixes):
- **Every card is answerable in place.** World events get 2-3 responses wired to engine actions (e.g. Hormuz: escort convoys, release SPR, reroute and pay). Flashpoint cards carry their responses inline (mediate, deploy, fund, concede).
- **Answered cards resolve:** card closes; an outliner row shows "in effect: <choice>, N months left".
- **No repeats:** per-event cooldown (same world event not within 60 months); context weighting (event only eligible when its conditions hold); the decision pool never resets; empty pool means quiet months.
- **Consequence chains:** responses can schedule follow-up events.
- Tests: every response option changes state measurably; a 600-month seeded fuzz asserts zero repeats inside cooldown windows and no card outliving its resolution.

E6 (content): decisions 8 -> ~30, world events 9 -> ~20, each with conditions, responses and at least one chained follow-up where it makes sense.

## Part 6. Allied access to programs (E7, rules)
Programs with access pathways: F-47, B-21, CCA (owner USA); GCAP (founders UK, Italy, Japan); FCAS (founders France, Germany, Spain). Only Japan, Germany, Norway and USA are playable among these; UK, Italy, France, Spain act as AI partners.
- **Tiers per program:** Buyer (export variant at 85-90% of domestic performance, delivery queue, owner retains sustainment and can suspend it) -> Partner (cost share buys workshare: GDP and jobs at home, better variant) -> Co-developer (join at R&D stage only; full variant, say in upgrades).
- **Gates:** relations with owner >= 70; defense pact; NATO members spend >= 2% GDP on defense; cost share paid; **mineral contribution** (supply the program's binding minerals from Part 3 at an agreed rate).
- **Security compliance:** counter-intel strength above a floor, espionage exposure below a ceiling, no flagged tech or trade deals with China or Russia. A breach **suspends** membership mid-program (Turkey/F-35 precedent); re-entry costs relations and time.
- **Playing the owner (USA):** the player decides admissions; export income and bloc cohesion vs leak risk (rivals target partner nations' programs).
- CCA is open to USA + NATO allies as partners. Germany starts in FCAS and may defect to GCAP (relations cost with France).
- Done when: Norway or Germany can reach Buyer and Partner tiers for F-47/CCA by meeting the gates; a compliance breach suspends and reinstates correctly; a US player can admit and expel; tests cover each gate.

## Part 7. Troops, training and capability (E8, rules)
- **Manpower:** active and reserve strength, monthly recruitment (population, unemployment, pay), retention (pay vs civilian wages, stability).
- **Force quality index** = f(education, healthcare, foodSecurity, stability, inequality) using the existing vitals; no new stats, new effects of old ones. Neglect shows up years later.
- **Training:** budget + pipeline months -> readiness per branch; readiness decays without funding; Joint Exercises posture raises it.
- **Crews gate platforms:** each platform declares crew requirements; wings/hulls without trained crews cannot deploy (gap shown, never silent).
- **SOF:** Tier 2 (e.g. Rangers) feeds Tier 1 (e.g. Delta) through selection; pipelines 24-36 months, small, expensive. Tier 1 strength drives Intel Tier-1 operation odds (existing overmatch math) and un-defers the JSOC task-force item. Nation-specific unit names in data with `status_source`; China and Brazil generic until the owner supplies names.
- **Capability per branch = strength x quality x readiness x equipment**, consumed by deployed military power, posture-driven tension, the hegemony military pillar, export buyer advantage.
- **Cohesion rules:** force quality is defined once in `src/sim/formulas.js`; pay and training are `cash(category)` ledger lines; invariants bound strength, readiness, quality to 0..100, crews <= trained pool, pay >= 0.
- Done when: cutting education for 10 years measurably lowers force quality and Tier-1 op odds; an unpaid army loses retention; F-47 wings without crews cannot deploy; all consumers read the single formula.

## Part 8. Arsenal / Forces split (E5, UI; supersedes Part 4's single Defense tab)
Defense becomes two verticals:
- **Arsenal** (industrial): Programs pipeline (R&D / prototype / LRIP / full rate), Procurement, Supply (mineral inputs and coverage), Partnerships (allied access tiers, compliance status), Exports, Deterrence (triad, MAD, nuclear register).
- **Forces** (people and readiness): Manpower (strength, recruitment, retention, pay slider with live effect), Quality (index and its vitals drivers with why-breakdowns linking to Economy levers), Training (budget, pipelines, readiness, decay countdowns), Equipment (inventory by branch and generation, crews vs airframes, maintenance, theater assignment), Specialized (SOF tiers, ISR, cyber, nuclear crews, selection pipelines).
- Nav: 10 verticals in P3d's icon nav; if it crowds at 390px, Resources folds under Economy as a sub-tab.
- Done when: every Part 1-7 mechanic is reachable from these screens at 390px with no sideways scroll; 390px screenshots attached.

Build order (final): E1 -> E2 -> E3 + E7 -> E4 -> E8 -> E5 -> E6.
