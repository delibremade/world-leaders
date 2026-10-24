# World Leaders: remaining work after the Situation Room repair

## Diagnosis

The recurring problem is a mismatch between the game's rules, their descriptions, and the controls that expose them. A larger military cannot fix a map that labels a diplomatic score as ownership. A larger intelligence budget cannot reveal operations that a screen only renders during certain crises. More screen space cannot fix a flex panel that shrinks its contents behind `overflow:hidden`.

The game already has substantial military, research, minerals, basing, energy, trade and intelligence systems. Those systems need a consistent command interface before another visual redesign. The Tropico-inspired domestic ecosystem also needs actual producing systems: the existing aggregate vitals do not yet model population filling jobs, producing goods and consuming services.

## Delivered in this branch

- Existing starting forces deploy through the map; qualified personnel use real counts and old crew-set saves migrate. F/A-XX has an acquisition route with its actual research, development, mineral and production requirements.
- Trade shows real supplier choices, contract terms, restrictions, secured supply and production inputs together.
- Full decisions open in a scrolling keyboard-accessible reader. Situation Room now exposes covert missions, national sweeps, response doctrine and active operations even during quiet periods.
- Covert orders share gates with their UI and standing relaunches. Domestic sweeps cannot be discovered as foreign missions. Intelligence response descriptions report effects that the engine actually applies.
- Home theater identity remains visible when another nation's regional diplomatic index is higher. This does not erase saved influence or claim ownership of every country in the theater.
- Nuclear rows grow to fit their names, regions and dates; Situation sections cannot shrink behind their clipping boundary.

## Proposed sequence

| Priority | Smallest useful increment | Acceptance condition |
| --- | --- | --- |
| 1 | Finish the command contract: one eligibility check, quoted cost, applied effects and refusal reason per action. Start with procurement retirement, intelligence responses and standing orders. | A purchased or imported platform cannot retire while still assigned. Every displayed consequence is applied or removed from the description. Standing charges match the advertised billing model. No click silently consumes funds without its promised result. |
| 2 | Audit country openings and saved campaigns. Separate homeland identity, diplomatic alignment, foreign basing access and contested theaters in every relevant screen. | All eight playable starts have deployable inventories and coherent crews. A 120-month run plus save/resume preserves identity and inventory. Foreign influence remains possible without implying occupation. Domestic unrest requires an explicit domestic cause; military strength is one input, not blanket immunity. |
| 3 | Build one domestic production loop before expanding the full G1–G4 specification: working-age population → jobs → electricity and industrial output → taxes → services and training. | A funded power/industry project employs people, changes output and revenue, and competes for skilled workers. An input shortage slows real production; expanding capacity restores it over time. The monthly ledger explains each link. |
| 4 | Put that loop on the Nation map using existing 2.5D rendering and a persistent inspector. | Select a real region or facility, inspect inputs/workers/output, allocate or build, then observe a changed result. Use quantities and trends for planning; reveal explanations on selection. No decorative city simulation or invented activity. |
| 5 | Add political interests and regional logistics once jobs/output/services are stable. | Services and employment explain support and unrest; infrastructure changes regional capacity. A 240-month campaign demonstrates investment → capability → trade → revenue, with meaningful opportunity costs and failure conditions. |

## Specific remaining inconsistencies found in source

- `src/sim/actions.js`: `decommissionPlatform` and `retireImported` decrement procurement inventories without reconciling deployed assignments. The starting-fleet retirement gate does not cover these paths.
- `src/sim/tick.js`: continuous intelligence orders charge approximately `(operation cost / duration) × 1.6` when a new cycle starts, while their UI calls this an approximately 1.6× cost premium. Establish a clear per-cycle or per-month billing rule and show it before enabling a standing order.
- `src/data/intel.js` and `respondIntelCrisis` in `src/sim/actions.js`: older narrative response tags contain foreign-stat, relationship and long-term promises that are not all applied. The new response reader avoids those claims; the next command-contract pass should either implement deliberately chosen consequences or simplify the underlying definitions. Do not quietly add every old promise as a balance change.
- `src/sim/state.js`: the player's opening influence uses a common home/foreign baseline, while NPC indices use country-specific `SPHERE_INIT`. That is a balance choice requiring an all-country audit, separate from correcting the map's ownership language.
- `docs/CORE-LOOP-SPEC.md`: G1–G4 describes the missing domestic producers and dependencies. Existing service vitals and sector modifiers do not yet satisfy those acceptance criteria.

## Configuration needed

Keep the current repository, React interface, Pixi map, pure simulation selectors/commands, and GitHub Actions browser checks. No new paid service, account, engine or image-generation workflow is required for these repairs. Use the existing draft PR and playable preview for review before merging the release.

For each increment: reproduce the reported failure, test the rule independently, exercise the actual control in Chromium, inspect desktop and phone captures, and verify save/resume. Publish the exact tested build so a player can identify which version they are using. The immediate next increment should be priority 1; the first new game system should be the narrow domestic loop in priority 3.
