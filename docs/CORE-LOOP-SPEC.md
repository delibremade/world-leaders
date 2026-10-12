# Core Loop Spec (owner-approved 2026-10-11)

## Why
World Leaders has nine strong silos and no closed loop. Everything built so far projects power outward (forces, bases, minerals, diplomacy, escalation). Almost nothing models where that power comes from. The vitals the game already uses (education, healthcare, food security, inequality, stability) are free-floating inputs with no producers: you move a budget, a number moves. Tropico 6's lesson is not its content, it is that production, population, politics and logistics feed each other, so every decision has a second-order cost.

Grounding reference (study only, never copied): Tropico 6 system set supplied by the owner. Analogues named in the research pass.

## G1. Population as cohorts
- Pops by age band, education level, employment status and region. They fill jobs (civilian sectors, military, R&D, government), consume services, migrate between regions and abroad, and form the political base.
- Vitals become **outputs**: education level is the share of pops schooled, health is service coverage per capita, food security is supply vs consumption.
- Military manpower (F7) and force quality (E8) read from pops instead of their own abstractions.
- Done when: a 10-year education build-out visibly shifts cohort composition and raises R&D and force quality years later; emigration responds to stability and wages; no vital is set directly by a slider without a producing system behind it.

## G2. Industrial base and civilian production
- Sectors: agriculture, energy, extraction, heavy industry, electronics and semiconductors, defense industry, services. Each has capacity, labor demand by education level, input requirements, and output.
- Output feeds GDP, exports, tax base, service provision, and the defense-industrial capacity that platform tranches already consume.
- Capacity is built by private capital under the F5 model, steered by government levers; some sectors (defense industry) are state-directed.
- **This makes F13's isolation caps real**: sanctions and debanking bite because a sector starves of inputs, capital or labor, not because a multiplier dropped.
- Done when: losing semiconductor imports measurably slows electronics output and then platform production; building domestic capacity restores it over years; GDP is the sum of sector output, not a free variable.

## G3. Political survival
- Factions with interests: business, labor, military, nationalists, technocrats, regional blocs. Each reacts to policy, output, services, inequality, war and scandal.
- Legitimacy and the means of losing power domestically: elections where applicable, coup and unrest risk elsewhere. Today the player can only lose externally.
- Edict-style policies with faction costs; corruption as a drain on everything built.
- Done when: a player can win every external contest and still fall domestically; faction support explains stability rather than stability being a bare stat; each policy shows which factions it moves.

## G4. Close the loop
- Wire the chain end to end: taxes and export revenue -> budget allocation -> build capacity and services -> pops get jobs and schooling -> output, quality and research rise -> military and influence rise -> trade, resources and basing -> taxes.
- Every arrow is one tested function in `src/sim/formulas.js`; no duplicate implementations.
- Logistics constrains the domestic side the way chokepoints constrain the external side: regions have capacity and connection; underserved regions underperform.
- Done when: a 240-month run shows a visible feedback cycle (investment -> output -> capability -> revenue); breaking any one link measurably degrades the rest; no system is a dead end.

## Interaction model (owner ruling 2026-10-11): fewer clicks, more direct control
- **Sliders and direct manipulation for anything with a magnitude**: budget allocation per sector and service, tax rates, pay, maintenance, training, R&D split, stockpile targets, extraction and export shares. Drag to set, see the projected effect inline before committing, no tap-through sheets for a number.
- **Allocation widgets beat forms**: a single budget surface where sectors compete for one pool (drag one up, others show the squeeze), rather than one slider per screen.
- **The map is a control surface, not a readout**: build, deploy, station, place nodes, set postures and target regions directly on it. Hover for detail, drag to allocate, click to act. This is where Tropico-style building converts clicking into quality of life.
- **Standing settings over repeated clicks**: set a policy once and let it run, with alerts when it needs attention (the standing-orders qol item).
- Done when: any recurring numeric decision is a drag, not a sequence of taps; the main budget screen sets every major allocation in one place; placing, deploying and posturing all work from the map without opening a vertical.

## Sequencing
Finish the desktop UI stacks and F11-F16 first. Then research pass -> G1 -> G2 -> G3 -> G4, each as stacked PRs with the usual gate. The interaction model lands alongside G2 and G4, where the new numbers appear.
