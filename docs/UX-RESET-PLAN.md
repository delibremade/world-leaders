# World Leaders: playable command interface

Status: proposal following the owner's request for a root-cause review, 2026-10-23. The map experiment is local and unmerged. It builds, but has not passed the full test gate or visual acceptance. No live deployment has changed.

## Diagnosis

The main problem is a weak decision loop: notice a problem -> understand its cause -> choose an intervention -> see its cost and timing -> observe the result. The current interface exposes an inventory of systems and makes the player assemble that loop.

Evidence:
- `docs/CORE-LOOP-SPEC.md` explicitly identifies nine strong silos and specifies missing population cohorts, civilian production, political survival and their integration (G1-G4).
- `src/sim/tick.js` already links energy disruption, reserve release, imports, inflation and GDP. Its budget, education, talent and tax effects also provide real feedback to expose now.
- `src/sim/economy.js` still models several domestic outcomes as aggregate statistics. A city-building picture would imply a level of population and building simulation not currently present.
- The existing map renderer mixes strategic regions, site markers, reach overlays and text. It uses fixed text textures that grow with zoom, near-identical circular site markers, and unfiltered reach rings at tactical zoom.
- Actual deployable forces are allocated to theaters. Bases have geographic sites; forces do not have individual movement paths. The UI must respect those different levels of detail.

## Recommended product structure

Use one desktop command shell with two main workspaces:

1. Nation: budget allocation, energy balance, services, production constraints and readiness. Use linked visual summaries, allocation controls and short explanations. Geography is used only where the simulation supplies a real spatial relationship.
2. World: geography, diplomatic relationships, trade exposure, theater deployments and basing. Use a crisp flat atlas, distinct facility silhouettes, zoom-dependent detail and a persistent selection inspector.

Shared shell: compact national HUD and time controls; central workspace; one contextual inspector; a compact queue for construction, research, operations and decisions. Keep specialist controls reachable through detail views. Do not duplicate controls across competing panels.

2.5D facility illustrations can make objects recognizable. They do not require a 3D engine, city simulation, tilted labels or continuous camera effects. Reveal coverage only for the selected facility or construction preview. Group nearby sites and expose every member. Each lens shows its relevant network. Motion represents actual progress or activity.

## First implementation milestone: energy decision loop

Build and verify this complete experience before spreading the visual treatment across every screen:

- A fuel/import problem identifies the affected route, its current state, reserve position and the existing engine's economic effects.
- Selecting it opens relevant actions in place: reserve release, import/extraction controls, or theater escort management where applicable. Costs, requirements and timing are visible before committing.
- The common allocation surface shows the competing budget uses and relevant service outcomes. Forecasts must come from engine selectors or a controlled simulation, never UI approximations.
- Advancing the simulation shows the observed change, the accounting breakdown and any unresolved constraint. Label structural delays and monthly updates explicitly.
- Construction preview and theater deployment provide the supporting spatial workflows, using existing consent, crew, platform and cost gates.

Second milestone: the existing minerals -> supply shortage -> arsenal production chain. A stalled program must name the binding input and lead directly to the relevant remedy and its queue.

Third milestone: apply the same interaction vocabulary to the remaining specialist systems. Preserve all existing actions, save compatibility and escalation confirmations.

## Simulation work is a separate scope

G1-G4 remain necessary for the full Tropico-inspired domestic ecosystem: population, jobs, industry, services, politics and logistics producing each other's outcomes. Implement those as explicit engine increments with tested links, not as decorative buildings or invented map activity. The UI milestone must work honestly with today's aggregate model and leave clear attachment points for those increments.

## Tools and verification

Keep React, PixiJS, the existing simulation, Playwright and GitHub CI. No new framework, rendering service, asset subscription or design plugin is needed. Generated images are optional style exploration; the acceptance artifact is a running build.

The local Chrome process currently aborts before a page opens. Use a working isolated Playwright browser or the repository's existing CI browser setup for visual and interaction verification; do not call source inspection or a successful bundle a visual review.

Acceptance:
- At 1440 and 1920px, the player can diagnose and address the energy scenario without searching unrelated screens. Selection does not shift or cover the map.
- At 390px, essential actions remain reachable and the page does not overflow.
- Labels remain readable at normal and high pixel density. Zoom and lens changes reduce irrelevant information; clustered sites remain selectable.
- Construction, deployment, reserve and allocation controls dispatch existing engine verbs and respect their gates.
- Movement and progress displays reflect actual simulation state; no invented unit travel, cargo or population behavior.
- Full npm test gate, build, save/resume and month progression pass. Capture the important states from the running build.
- Deliver a reviewable PR and playable preview. Keep the live site unchanged until release is authorized.
