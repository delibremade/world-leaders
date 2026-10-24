# Contextual command audit, v0.96

The supplied Puerto Cabello screenshot exposes the failure: selecting an operational naval base in the Military lens shows construction, price and reach, but no deployment control. The capability exists in another screen. This is a routing and selection problem, not a missing simulation or rendering technology.

## Interaction contract

Select a place or capability → choose an order → see availability, cost and requirements → execute → see the changed assignment or queue. Opening a planner must never silently choose a unit or buy an operation. A remedy must retain its theater, platform, mineral or foreign target. The previous panel must close when navigation opens a new workspace.

## Connections repaired

| Starting point | Problem | Working route |
| --- | --- | --- |
| Base inspector and site sheet | Construction-only controls hide operational uses | Deploy, recall and set theater posture directly at the selected site, above construction details |
| Defense overview card | Promises readiness/deployment but opens Manpower | Forces → Deployments, with destination selection and current assignments |
| Theater Deploy command | Instantly picks the first available package | Opens the full force picker for that theater; the player chooses the asset |
| Legacy theater command card | Appears outside its modal dialog, whose overlay blocks clicks | Commands live inside the active region sheet and are checked with real pointer hit tests |
| Starting order-of-battle type | Separate deployment control defaults to East Asia | Opens Deployments with that force type selected and an explicit destination |
| No available packages | Only says to build or recall | Opens current assignments with recall controls; crew and procurement links remain accessible |
| Forces → map | Context must be rebuilt | Keeps the chosen theater and force package |
| Crew requirement | Describes training elsewhere | Opens Forces → Training, including from the phone map sheet |
| Conventional procurement | Unchosen East Asia destination; missing research/supply remedies | Requires a destination, links research, binding mineral suppliers and assignments |
| Paid production queue | Mineral-blocked orders disappear from the main queue | Shows the paid order and opens Deals on its binding mineral |
| Arsenal Supply and Programs | Reports missing materials without a remedy | Opens supplier comparison for the named mineral |
| Theater Intel command | Chooses the cheapest mission automatically | Opens Situation Room planning with the foreign target selected; authorization still confirms the actual mission |
| Base / intelligence lens / Special Forces | Operational context does not lead to covert planning | Relevant foreign target or Special Forces links to Situation Room |
| Standing-operation entry | Opens a nation sheet over the Intel workspace | Opens the selected intelligence target |
| Closed-base entry | Explains lost consent without opening management | Opens the site's host/access management |

## Gameplay references and adaptation

- [Tropico 6 official PC manual](https://download.kalypsomedia.com/manuals/Tropico6/original_pdfs/T6_Manual_PC_UK_ONLINE.pdf), User Interface: the selected building/citizen panel exposes its statistics and functions, while tasks and actions have dedicated access. Applied here: the selected facility exposes the relevant operational orders.
- [Age of Empires: Definitive Edition, official quality-of-life guide](https://www.ageofempires.com/news/whats-new-age-empires-definitive-edition-2/): commands follow the selected unit/building; rally points, idle-unit selection and event navigation reduce repeated searching. Applied here: preserve selection across workspaces and link a shortage to its remedy. No fictional rally points or unit travel are added.
- [Hasbro Risk rules](https://www.hasbro.com/common/documents/dad2886d1c4311ddbd0b0800200c9a66/61364C2119B9F369106F6DE955E8C10A.pdf): placement and reinforcement explicitly relate armies to territories. Applied here: show available, assigned and recalled packages against a named theater. Risk's occupation and adjacency rules are not imposed on this game's diplomacy model.

These are interaction adaptations, not claims that the games simulate the same things.

## Scope and next work

The current engine assigns forces to theaters. A naval base contributes reach and support; it is not a physical parking slot for a particular carrier. The UI names the actual theater and explains this distinction. A future site-level basing model would require capacity, permission, transfer and supply rules before depicting ships moving between specific ports.

The current deployment verb moves one package at a time. Bulk transfers should be one atomic, validated engine order before adding a quantity control. Keep that separate from this connection repair.

The next priority remains action consistency: retirement must reconcile deployed inventories, intelligence response descriptions must match applied effects, and standing-operation billing must match its stated contract. The broader balance and domestic-production sequence remains in [REMAINING-WORK.md](REMAINING-WORK.md).

Use the existing React/Pixi interface, pure simulation, Node tests and GitHub Chromium gate. No new framework, plugin, subscription or dependency is required. Review the playable artifact before authorizing publication.
