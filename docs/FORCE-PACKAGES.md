# Service-owned force packages

## Final implementation plan

The recurring UI problem is disconnected ownership and command state. A fleet row,
procurement batch, theater marker and intelligence support label could describe the
same asset differently. A shared theater posture also changed unrelated missions.

1. Use one physical inventory and readiness calculation for every deployment surface.
2. Organize owned components into persistent packages, with service ownership separate
   from operating domain and joint command. Reserve every component exactly once.
3. Review package composition, destination, mission and monthly cost before committing.
   Support assignment, transfer, recall, relief rotation, reinforcement and disbanding.
4. Connect Forces, map, Equipment, Procurement and Situation with destination and
   package context intact. Explain blockers and link to maintenance, training or supply.
5. Show intelligence service responsibilities and the actual SOF commitments, recovery,
   reconnaissance support and repeat-operation charge behind each mission.
6. Verify save migration, physical losses, retirement, per-package effects and costs,
   then exercise desktop and 390px layouts with the existing full test gate.

## Model and scope

`forces.packages` is the authoritative organization. `forceDeployments` is its derived
theater aggregate for existing consumers. `forcePosture` remains the default for
individual detachments; it cannot override a composed package's mission. Existing
assignments migrate into detachments before default formations reserve remaining
starting inventory. Purchases require explicit assembly or deployment.

Country service catalogs describe ownership without adding a second nation registry
or inventing units. Ambiguous existing lines remain explicitly joint. Templates use
the modeled components: carrier aviation and escorts, expeditionary air, Army ground,
surface escort, submarine patrol, limited Marine expeditionary, mobility, maritime
patrol and individual detachments. Missing command/logistics components are stated.

Physical stock and mission-ready platforms are apportioned across procurement aliases
once. Partial batches retain surviving aircraft or hulls. Packages keep planned
composition after losses; reinforcement uses compatible existing stock. Home packages
also reserve assets. Retirement protects these reservations and cannot subtract the
same purchased inventory twice. Readiness can fall while assigned without invalidating
ownership, and the associated operational effects fall with it.

Operating costs are incremental: $4M per assigned equipment batch per month, plus
$30M per batch on humanitarian missions. Existing maintenance and personnel costs
continue separately. Standing covert operations charge the full doctrine-adjusted
operation cost multiplied by 1.6, once per successful cycle launch.

## Acceptance evidence

The feature tests cover deterministic defaults, legacy assignments, independent missions,
atomic review/cancel/rotation, service filters, loss conservation, home reservations,
retirement, actual reconnaissance support, named SOF recovery, monthly billing and
save round trips. Browser flows and captures cover 1280, 1440, 1920 and 390px widths.
The pull request records the final full-gate result and build size.

## Follow-on work

- Package-specific transit, replenishment and facility capacity need a modeled logistics
  system before the interface can promise arrival times or sustained deployment ranges.
- Richer composition editing can follow this fixed-template foundation; command,
  support and replacement roles need actual inventory before adding those slots.
- Economic cities remain geographic access points to existing national sectors. Local
  production, freight and labor would need explicit inputs, outputs and dependencies.
- Procurement records do not retain historical loss attribution by purchase origin;
  surviving physical stock is apportioned deterministically and exposed as such.

These are additional simulation capabilities, not hidden effects of the new controls.
