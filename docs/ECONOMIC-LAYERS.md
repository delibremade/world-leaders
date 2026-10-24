# Civilian economic geography

## Root cause and implemented scope

The atlas was built around `SITES`, which contains bases, logistics facilities and strategic ports. Civilian budgets, services, resource extraction, private processing investment, research and trade existed elsewhere, with no geographic entry point. Adding more bases would perpetuate that mismatch.

The Economy lens has its own civilian hub registry. Every hub references an existing `NATIONS` identity and uses the same geographic projection as the atlas. Military construction, force counts, reach rings and diplomatic ownership shading are absent from this lens. The other lenses retain their roles.

The US has 25 anchors: Seattle–Tacoma, Portland, San Francisco Bay Area, Los Angeles–Long Beach, San Diego, Central Valley/Fresno, Phoenix, Salt Lake City, Denver, Midland/Permian Basin, Dallas–Fort Worth, Austin, Houston, Omaha, Des Moines, Kansas City, Minneapolis–Saint Paul, Chicago, Detroit, Pittsburgh, Memphis, Atlanta, New York–New Jersey, Boston and Miami. Each other playable country has at least three starter hubs; this is representative coverage, not an exhaustive global economic gazetteer.

## Layer contract

| Sector | Existing readouts | Existing controls |
| --- | --- | --- |
| Technology | Education and IP portfolio | Technology/education funding; research and IP policy; material suppliers |
| Industry | Power tier and processing projects | Technology/energy funding; private processing investment; research and supply |
| Food | Food security and assistance status | Food assistance; social programs; trade agreements |
| Energy | Power tier and import bill | Energy funding; generation, extraction, imports and reserves |
| Materials | Processing projects and supply agreements | Private processing investment and supplier contracts |
| Trade & logistics | Trade agreements and disrupted import routes | Diplomacy, supplier contracts, routes and reserves |
| Services | Healthcare and education | Healthcare/education funding; social programs and tax policy |

The same national allocation component serves the map and Economy, including pool holds, locks, cost preview and a single action on slider release. Hubs never multiply the budget. Costs use `calcSCost`; energy readouts use `energySituation`. Food assistance dispatches the existing policy verb. City and cluster selection never dispatch economic actions automatically.

Nation and Economy both link to the lens. Sector filters narrow the map and searchable city list together. Clustering retains every hub ID. The SVG fallback supports keyboard selection; the city browser works independently of WebGL and is reachable on phones. Relevant links close the phone dialog before opening their destination. Opening the layer on a phone resets the previous workspace scroll position so the map is immediately in view.

## What these numbers mean

All numeric readouts and controls are **national**, explicitly labeled in the inspector. Hub sector tags describe representative economic activity, not a measured share of local GDP. Coordinates are approximate metropolitan anchors, not building footprints or municipal boundaries. No city GDP, workforce, local inventory, transportation flow, productive capacity or dependency is fabricated. Platform production remains in Arsenal; its orders are not presented as civilian output.

This is the geographic and interaction foundation for `CORE-LOOP-SPEC.md`, not completion of G1–G4. There is no new campaign state or save migration.

## Next simulation increment

1. Add local production records keyed to these stable hub IDs: capacity, workers, inputs, output and queued projects. Begin with one power/materials/industry loop.
2. Reconcile local totals to national accounting. National energy, taxation, services and sector income must each have one source of truth; never add local GDP on top of existing aggregate revenue.
3. Introduce actual labor and electricity constraints, then freight capacity and input transfers. Show a bottleneck only when it changes production, and link it to a valid remedy.
4. Add local investment quantities and policies once their costs, completion, staffing and resulting output are modeled. Use the same inspector with local controls clearly separated from national policy.

Acceptance: investment changes local production over time; local production changes the national ledger; input shortages reduce actual output; save/resume preserves all quantities; no duplicate revenue, workers or stock.

## Geographic role references

These primary sources support the civilian-sector approach and representative US activity, not a calibrated economic dataset:

- Seattle Office of Economic Development, [key industries](https://www.seattle.gov/economic-development/key-industries) and [maritime, manufacturing and logistics](https://www.seattle.gov/economic-development/key-industries/maritime-manufacturing-and-logistics).
- Washington Department of Commerce, [key industries](https://www.commerce.wa.gov/key-sectors/).
- Los Angeles EWDD, [workforce development plan](https://ewdd.lacity.gov/images/reports/ap25/AnnualPlanYear25_VirtualCommunityForum_1May2024.pdf), including trade/logistics, entertainment and healthcare.
- US Economic Development Administration, [regional technology hubs](https://www.eda.gov/news/press-release/2023/10/23/biden-harris-administration-designates-31-tech-hubs-across-america), illustrating inland clusters as well as coastal centers.

Tropico's selected-place control panel and the explicit place/action relationship from RTS and Risk informed interaction, as documented in `COMMAND-CONNECTIONS.md`. No proprietary artwork, source or external map subscription is needed.
