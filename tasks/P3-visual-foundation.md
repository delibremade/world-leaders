# Task P3 — visual foundation: design system, PixiJS map, Tier 1 shell

Model: **Fable 5.1**. Read CLAUDE.md, docs/PLAYABLE-PLAN.md (guardrails, model split, tech stack, UI principles, Tier 1), docs/DESIGN-RULINGS.md. P2b must be merged (actions dispatch through src/sim/actions.js).

Goal: the new shell and map replace v57's layout; every v57 function stays reachable. Visual direction: Situation-room tactical.

Work in stacked PRs, each green on its own:
1. **P3a Design system:** docs/DESIGN-SYSTEM.md + src/ui/tokens (color, type, spacing, elevation, motion; dark-first, data-dense, legible at 390px). Relabel the title screen build stamp from "BUILD V57" to the package version.
2. **P3b Map:** PixiJS + pixi-viewport + d3-geo map from REGION_GEO; pan, pinch, inertia; all v57 overlays (sphere shading, momentum, trade routes, influence lines, chokepoints, flashpoints + timers); **map modes** Sphere/Tension/Trade/Energy/Military/Intel with legend. Target 60fps pan on a mid-range phone; report measured fps in jsdom-free browser test or manual capture.
3. **P3c Shell:** HUD with speed controls, pause-reason chip and sparklines; bottom nav (9 verticals, decision badges); **bottom sheet** (vaul) on region/nation tap listing every nation-keyed action from actions.js; **outliner drawer** (ops, builds, research, timers, flashpoints, cooldowns); **event cards** replacing blocking modals except where the engine pause gate requires; **why-breakdowns** (Radix popover) on treasury net, stability, oil price, op odds, influence, sourced from engine categories.
4. Existing tab content may render inside the new shell unchanged for now; P4 rebuilds each vertical.

Gate per PR: smoke test green (120 months, every vertical reachable, save/resume); parity untouched (no rule changes); 390px screenshots of every new surface attached; `reports/feature-gaps.md` updated if anything v57 offered is not reachable.
Cost control: never read whole large files; use reports/inventory-v57.md ranges. Stop at a green checkpoint per sub-PR.
