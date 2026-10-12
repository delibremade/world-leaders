# UI upgrade: research and build plan

Research only, no gameplay code. Written 2026-10-12 against v0.85.0 with the desktop-first stack in flight
([#73](https://github.com/delibremade/world-leaders/pull/73) Overview, [#74](https://github.com/delibremade/world-leaders/pull/74) Arsenal,
[#75](https://github.com/delibremade/world-leaders/pull/75) Forces, [#76](https://github.com/delibremade/world-leaders/pull/76) Resources,
[#77](https://github.com/delibremade/world-leaders/pull/77) Trade). Owner verdict after playing v0.85: it reads as a dashboard of text cards, not a game.

**Verdict:** the bones are right (tokens, map modes, outliner, why-popovers, cards). The dashboard feel comes from five things that
no vertical PR fixes on its own: system fonts and emoji as the entire icon system, one panel style with one visual weight, native
`<input type=range>` and `<select>` controls, nothing on screen moving when a month ticks, and a map that is a readout sitting
inside a card. Fix those five app-wide first (U1 to U5 below), then do the per-vertical redesigns on top of #73 to #77.
Add four small dependencies (fonts, icons, d3-sankey, TanStack Table), one planned one (motion), and nothing else.

Effort scale as in `docs/QOL-RESEARCH.md`: **S** under ~300 lines with tests, **M** 300 to 800 lines, **L** multi-PR or engine seam.

## 1. Critique of the current UI

### 1.1 Reference set
Interfaces this plan measures against, with the one thing each does that we do not:

| Reference | What it does well | Source |
|---|---|---|
| Victoria 3 / CK3 | Nested tooltips: every term in a tooltip opens its own, so the UI is its own wiki | [PCGamesN](https://www.pcgamesn.com/victoria-3/nested-tooltip-system), [Dev diary 74](https://www.paradoxinteractive.com/games/victoria-3/news/dev-diary-74-ux-improvements) |
| Victoria 3 | Map modes with a configurable crossfade between them; budget is a weekly balance, not lump sums | [Dev diary 74](https://www.paradoxinteractive.com/games/victoria-3/news/dev-diary-74-ux-improvements), [Dev diary 12 Treasury](https://admin-forum.paradoxplaza.com/forum/developer-diary/victoria-3-dev-diary-12-treasury.1488588) |
| Stellaris | Outliner at the side that moves you to the action; resource status shown on the map itself; OS idioms (right-click, loading bars) | [PC Gamer](https://www.pcgamer.com/uk/why-i-love-stellaris-slick-interface), [GamesBeat](https://gamesbeat.com/stellaris-impressions-paradox-finds-the-sweet-spot-between-4x-and-grand-strategy/), [UX dev diary 154](https://admin-forum.paradoxplaza.com/forum/developer-diary/stellaris-dev-diary-154-ux-design-in-stellaris.1244013/page-2) |
| Hearts of Iron IV | Production lines as rows with a visible efficiency bar that grows while the line runs unchanged | [Dev diary 5 Production lines](https://forum.paradoxplaza.com/forum/threads/hearts-of-iron-iv-development-diary-5-production-lines.774778/post-17366461), [Guild Order wiki](https://guildorder.com/games/hoi4/wiki/production-efficiency-and-factories) |
| Command: Modern Operations | Hover info box on map icons answers "too little data on the icon"; player picks which fields it shows | [Warfare Sims UI part I](https://www.warfaresims.com/?p=4954), [part II](https://www.warfaresims.com/?p=4975) |
| DEFCON | Vector map, glow, one palette; the whole game is recognisable from one screenshot | [Wikipedia](https://en.wikipedia.org/wiki/DEFCON_(video_game)), [Videogamer interview](https://www.videogamer.com/?p=143865), [bit-tech](https://bit-tech.net/news/gaming/darwinia_defcon/1) |
| Plague Inc / Rebel Inc | The map is the main interface; cosmetic elements made functional | [Quarter to Three](https://www.quartertothree.com/fp/?p=15749) |
| Democracy 4 | Policy sliders show the political cost of the move inline, red/green if affordable now; effects as a bubble web | [Positech blog](https://www.positech.co.uk/cliffsblog/2020/05/14/democracy-4-variable-slider-costs/), [Legacy of Games](https://legacyofgames.com/2021/06/23/first-impressions-democracy-4/) |
| Frostpunk 2 | Council votes as a 100-delegate board with for / against / hesitant per faction | [PCGamesN](https://www.pcgamesn.com/frostpunk-2/council), [Keengamer](https://www.keengamer.com/articles/guides/frostpunk-2-how-to-unlock-use-council/) |
| Twilight Struggle | DEFCON as a five-space track you can see from across the table | [Wikipedia](https://en.wikipedia.org/wiki/Twilight_Struggle), [Misut Meeple review](https://misutmeeple.com/?p=246094) |
| Terra Invicta, Rule the Waves 3 | Cautionary: dense data with no hierarchy reads as clutter (TI) or a 1990s spreadsheet (RTW3) | [inkl review](https://www.inkl.com/news/terra-invicta-review), [Gamepressure](https://www.gamepressure.com/S013-amp.asp?ID=22212), [Naval Gazing](https://www.navalgazing.net/Review-Rule-the-Waves-3) |

### 1.2 App-wide weaknesses (the dashboard causes)
1. **Type.** `FONT.sans` is SF Pro / Segoe / Roboto by platform ([src/ui/tokens.js](../src/ui/tokens.js)). On the owner's desktop that is Segoe UI, the font of every admin panel. Georgia for nation names is the only display voice and it fights the terminal brief. No figure size above 24px exists outside the title screen; the biggest number on any panel is 17px, so nothing reads as the key figure.
2. **Icons are emoji.** 288 emoji glyphs in [src/ui/App.jsx](../src/ui/App.jsx) and 244 in [src/data](../src/data) (counted 2026-10-12). Bloc names, panel titles, nav, minerals, platforms and flags all depend on the OS emoji font: colour, weight and size differ per platform, Windows Chrome renders flag emoji as two letters because Segoe UI Emoji has no flag glyphs ([Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/5554132/it-s-time-for-microsoft-to-fully-support-flag-emoj)), and nothing can be tinted to a state colour. This single choice is most of "looks like a chat app".
3. **One container, one weight.** Every panel is `.wl-panel` with a 10px uppercase caption and a 12px body ([src/ui/shell/styles.js](../src/ui/shell/styles.js)). Primary buttons are full-width blue bars; the Resources > Deals screen shows 20 identical primary buttons ([e5c-deals-1280](../reports/screens/e5c-deals-1280.png)). With no secondary weight there is no hierarchy, so the eye has nothing to land on.
4. **Native controls.** 10 `type="range"` inputs and a native `<select>` ([src/ui](../src/ui), count 2026-10-12). Browser sliders have no projection, no tick marks, no cost readout. The core loop spec asks for "drag to set, see the projected effect inline" ([CORE-LOOP-SPEC](CORE-LOOP-SPEC.md)); the controls cannot do it.
5. **Nothing moves on a tick.** A month passes and only the date string changes. There is no number tween, no delta flash, no feed entry animation, and the map does not react to pause. The DESIGN-SYSTEM motion tokens exist but only `wl-rise` on cards and the trade dash use them.
6. **Tokens not applied.** 1,160 six-digit hex literals remain in App.jsx despite the "no new hex literal after P3" rule ([DESIGN-SYSTEM](DESIGN-SYSTEM.md)). The verticals cannot be restyled from one place until this is paid down; U2 depends on it.
7. **Colour collisions.** Faction yellow (china #eab308) vs warn (#f0c040), faction red (russia) vs alert, faction cyan (usa) vs `accent.cyan`. A yellow chip next to a Chinese label is ambiguous. Factions need to be confined to the map and flags; state colours to chrome.
8. **The map lives in a card.** It has a caption, a legend line in 10px text, and a situation strip under it. DEFCON and Plague Inc put chrome on the map, not the map in chrome. #73 makes it dominant at desktop; it still has a card border and text legend.

### 1.3 Per-vertical weaknesses
No desktop screenshots exist for Economy, Energy, Intel, Technology or Trade in `docs/shots` or `reports/screens`; those rows are read from the code.

| Vertical | Today | Specific weakness |
|---|---|---|
| Overview | PixiJS map with 6 modes, 12-row vitals column, victory pillars, event cards, feed ([43-shell-1440](shots/43-shell-1440.png)) | Region labels collide ("Western Europe" over "Germany 70%"); markers are emoji in circles with no size or state encoding; legend is a sentence; vitals are 12 identical label/number/bar rows with no grouping (fiscal, social, military); victory progress is below the fold |
| Arsenal | Programs as stacked cards, pipeline chips, tranche CTAs; Supply per-program coverage bars ([e5b-programs-1280](../reports/screens/e5b-programs-1280.png)) | Pipeline stage chips look like buttons; the stage (R&D / Prototype / LRIP / Full rate) is text, not a position on a track; mineral inputs are an emoji string "🧲8 🪨3 🏹2"; no cost-over-time, no tranche history. #74 adds a table + detail, which fixes density, not hierarchy |
| Forces | Equipment: 47 types with MC-vs-target bullet bars, station/recall via native select ([e5a-equipment-1280](../reports/screens/e5a-equipment-1280.png)) | The real order of battle (8,047 platforms, 5,431 ready) is the best data in the game and is shown as list rows; theater summary is buried; no unit symbology; deploy is a dropdown, not the map |
| Resources | Ten minerals with ore bars and time-to-zero, named plants, deals grid ([e5c-reserves-1280](../reports/screens/e5c-reserves-1280.png)) | Bars have no scale or threshold marks; "unrefined" repeats 4 times as plain text instead of a state; plants (Mountain Pass, Norilsk) are names in a sentence rather than nodes in a chain; deals are 20 same-weight buttons |
| Trade | Bloc accordion, nation sheet with 9 stacked action rows ([35-after-nation-sheet-1280](shots/35-after-nation-sheet-1280.png)) | Tier progress is text; the nation sheet is a form (visit, aid, pact, embassy, sanctions, embargo, arms) with identical row weight; dominance multipliers are not visible where they apply; influence weight is a 4-button segmented control |
| Intel | Issues & briefs as prose cards, ops catalog, Tier-1 panel ([e9-brief-390](../reports/screens/e9-brief-390.png)) | Two paragraphs of 12px prose before any control; exposure and counter-intel are numbers in sentences; no per-target file, so "who am I running against" is reconstructed from a list |
| Economy | Tax policy, fiscal stance, monetary policy, sector budgets, ledger from `cash(category)` as sorted bars | The ledger is the one waterfall-ready dataset and it renders as a bar list with no sign colouring or running total; the 8 to 48% tax slider is native; projected revenue is a number, not a curve |
| Energy | Chokepoint rows, SPR, export shares, concessions, GGRB, renewables | Import routes per region exist in data (`IMPORT_ROUTES`, 5 chokepoints) but are never drawn as flows; disruption is a status word, not a visible cut in a line |
| Technology | 10 verticals as dot rows L0-L7 ([e9-pane-defense-390](../reports/screens/e9-pane-defense-390.png)), queue, era programs with stage/cond/why | Dots are the right idea but 8px with no era columns; locked programs explain themselves in text; no sense of the clock (what unlocks next year) |

## 2. Repo and library survey

Versions and licences read from the npm registry on 2026-10-12 (links are the npm pages); sizes from the sources cited, since bundlephobia is blocked from this environment (verify with `npx bundlephobia` before pinning). Pin rule: exact versions at least two weeks old ([PLAYABLE-PLAN](PLAYABLE-PLAN.md)). Current dist is 2,363 KB single-file ([#74](https://github.com/delibremade/world-leaders/pull/74)).

### 2.1 Data-dense tables and grids
| Package | Latest | Licence | Cost | Fit |
|---|---|---|---|---|
| [@tanstack/react-table](https://www.npmjs.com/package/@tanstack/react-table) | 9.3.1 (2026-10-12); v8.21.x stable | MIT ([repo](https://github.com/TanStack/table)) | ~14.6 kB gz for v8.21.3 ([Vercel guide](https://vercel.com/i/tanstack-table)) | **Adopt** under the `DataTable` from #74: headless, so our tokens style it; buys grouping (ORBAT by branch), column pinning, multi-sort, row selection, filters. v9 released this week; pin a v8.21.x or a v9 that clears the two-week rule and note the API moved |
| [react-virtuoso](https://www.npmjs.com/package/react-virtuoso) | 4.18.16 | MIT ([repo](https://github.com/petyosi/react-virtuoso)) | ~17 kB ([PkgPulse](https://www.pkgpulse.com/guides/tanstack-virtual-vs-react-window-vs-react-virtuoso-2026)) | Not needed: our longest list is the 200-entry feed; measure first |
| [@tanstack/react-virtual](https://www.npmjs.com/package/@tanstack/react-virtual) | 3.14.17 | MIT ([repo](https://github.com/TanStack/virtual)) | 10-15 kB per README | Same; only if the feed or a 240-month timeline janks |
| [ag-grid-community](https://www.npmjs.com/package/ag-grid-community) | 36.2.0 | MIT; enterprise is commercial ([repo](https://github.com/ag-grid/ag-grid)) | hundreds of kB | Reject: brings its own theme and DOM, fights the design system |
| [@glideapps/glide-data-grid](https://www.npmjs.com/package/@glideapps/glide-data-grid) | 6.0.3 (2024-02) | MIT ([repo](https://github.com/glideapps/glide-data-grid)) | canvas grid | Reject: spreadsheet idiom, 20 months since release |
| [react-data-grid](https://www.npmjs.com/package/react-data-grid) | 7.0.0-beta.61 | MIT | | Reject: beta for years |

### 2.2 Charts beyond recharts
| Package | Latest | Licence | Cost | Fit |
|---|---|---|---|---|
| [recharts](https://www.npmjs.com/package/recharts) (installed 2.15.4) | 3.10.1 | MIT ([repo](https://github.com/recharts/recharts)) | ~150 kB per [TanStack comparison](https://tanstack.com/charts/latest/docs/comparison) | **Keep** for sparklines, ledger, timeline. SVG is fine at our sizes (24 to 240 points). The 2 to 3 upgrade is a separate S task |
| [uplot](https://www.npmjs.com/package/uplot) | 1.6.32 (2025-03) | MIT ([repo](https://github.com/leeoniya/uPlot)) | ~50 kB min per README; 166k points in 25 ms | Only if Q5 history (240 months x ~10 series x rivals) measures slow. It will not at that size |
| [@visx/xychart](https://www.npmjs.com/package/@visx/shape) | 4.0.0 | MIT ([repo](https://github.com/airbnb/visx)) | 49 kB gz ([TanStack comparison](https://tanstack.com/charts/latest/docs/comparison)) | Rejected in PLAYABLE-PLAN; still correct, duplicates recharts |
| [echarts](https://www.npmjs.com/package/echarts) | 6.1.0 | Apache-2.0 ([repo](https://github.com/apache/echarts)) | canvas, large | Reject: second chart stack with its own theme |
| [chart.js](https://www.npmjs.com/package/chart.js) | 4.5.1 | MIT ([repo](https://github.com/chartjs/Chart.js)) | canvas | Reject, same reason |
| [lightweight-charts](https://www.npmjs.com/package/lightweight-charts) | 5.2.1 | Apache-2.0 with attribution + link requirement ([repo](https://github.com/tradingview/lightweight-charts)) | canvas | Reject: finance idiom, attribution clause |
| [@observablehq/plot](https://www.npmjs.com/package/@observablehq/plot) | 0.6.17 | ISC ([repo](https://github.com/observablehq/plot)) | | Reject: not React-native, exploratory grammar |
| [d3-sankey](https://www.npmjs.com/package/d3-sankey) | 0.12.3 (2019) | BSD-3 ([repo](https://github.com/d3/d3-sankey)) | tiny, depends on d3-array/d3-shape | **Adopt** as a layout function only: it returns node x0/x1/y0/y1 and link widths; we draw the SVG with tokens. Energy flows (section 4.8). Old but complete; the algorithm has not needed changes |

Rule to add to DESIGN-SYSTEM: micro-visuals (bullet bars, ladders, dot levels, gauges, tracks) are inline SVG components in `src/ui/shell/viz/`, not a chart library. They are 20-line components and the library cost is never worth it.

### 2.3 Map and geo on top of PixiJS
| Package | Latest | Licence | Fit |
|---|---|---|---|
| [pixi.js](https://www.npmjs.com/package/pixi.js) (installed 8.21.0) | 8.22.0 | MIT ([repo](https://github.com/pixijs/pixijs)) | Keep. BitmapText for the 30+ region labels and marker counts (official guide: no rasterise on change, built for "thousands of changing labels" ([PixiJS text guide](https://pixijs.com/8.x/guides/components/scene-objects/text))). Culling is off by default and only helps when GPU-bound ([performance tips](https://pixijs.com/8.x/guides/concepts/performance-tips)); do not enable without a measurement |
| [pixi-filters](https://www.npmjs.com/package/pixi-filters) | 6.1.5 | MIT ([repo](https://github.com/pixijs/filters)); v6 pairs with Pixi v8 | **Adopt** two filters: GlowFilter for the selected region and flashpoints, AdvancedBloomFilter on the lines container for lanes. One filter on the parent container, never per child (cost note in the [filters skill guide](https://skills.sh/pixijs/pixijs-skills/pixijs-filters)) |
| [pixi-viewport](https://www.npmjs.com/package/pixi-viewport) (installed 6.0.3) | 6.0.3 (2024-11) | MIT ([repo](https://github.com/davidfig/pixi-viewport)) | Keep; `follow`, `snap`, `animate` are unused and give us "fly to region" for outliner jumps |
| [@pixi/ui](https://www.npmjs.com/package/@pixi/ui) | 2.4.1 | MIT ([repo](https://github.com/pixijs/ui)); v2 for Pixi v8 | Reject: buttons and sliders inside the canvas lose DOM a11y, tests and the token stylesheet. HTML overlays on the canvas, as now |
| [@pixi/layout](https://www.npmjs.com/package/@pixi/layout) | 3.2.1 | MIT ([repo](https://github.com/pixijs/layout)), Yoga flexbox | Reject for the same reason |
| [milsymbol](https://www.npmjs.com/package/milsymbol) | 3.0.4 | MIT ([repo](https://github.com/spatialillusions/milsymbol)); APP-6 B/D/E, MIL-STD-2525 C/D/E; SVG or Canvas out; 1,000 symbols under 20 ms | **Adopt** for unit markers on the map and in the ORBAT: generate the SVG once per (affiliation, type), upload as a texture. Friendly blue frame, hostile red diamond, neutral green square is the one symbology the audience already reads |
| deck.gl, MapLibre | | | Stay rejected ([PLAYABLE-PLAN](PLAYABLE-PLAN.md)): second renderer |

### 2.4 Node and graph editors
[@xyflow/react](https://www.npmjs.com/package/@xyflow/react) 12.12.0, MIT ([repo](https://github.com/xyflow/xyflow)), ships MiniMap, Controls, Background, custom nodes. **Keep for the policy web only** (V3), where edges carry effect values and the layout is a graph. **Disagree with PLAYABLE-PLAN on tech lanes (V8):** eras x verticals is a grid, not a graph. A CSS grid with an SVG overlay for prerequisite arrows is 150 lines, is testable with jsdom, and does not pay xyflow's bundle or its pan/zoom gestures inside a scrolling pane. Proposed as a ruling change note, not implemented here.

### 2.5 Drag and allocation primitives
| Package | Latest | Licence | Cost | Fit |
|---|---|---|---|---|
| [@use-gesture/react](https://www.npmjs.com/package/@use-gesture/react) (installed 10.3.1) | 10.3.1 (2024-03) | MIT ([repo](https://github.com/pmndrs/use-gesture)) | drag, pinch, wheel, move, hover | **Keep and use more**: the budget surface boundaries, map drag-to-deploy, slider thumbs. No release in 19 months; stable, 44 open issues |
| [@radix-ui/react-slider](https://www.npmjs.com/package/@radix-ui/react-slider) | 1.6.1 | MIT ([repo](https://github.com/radix-ui/primitives)) | small; Radix already a dep (popover) | **Adopt** as the one slider primitive: keyboard, touch, multi-thumb, unstyled. Replaces the 10 native ranges |
| [@dnd-kit/core](https://www.npmjs.com/package/@dnd-kit/core) | 6.3.1 (2024-12) | MIT ([repo](https://github.com/clauderic/dnd-kit)) | 94 open issues, 45 PRs; new `@dnd-kit/react` architecture in progress | Defer: nothing in the plan needs cross-container drag until the research queue (Q10 / C1). Revisit then |
| [@atlaskit/pragmatic-drag-and-drop](https://www.npmjs.com/package/@atlaskit/pragmatic-drag-and-drop) | | Apache-2.0, ~4.7 kB core ([repo](https://github.com/atlassian/pragmatic-drag-and-drop)) | framework-agnostic, synced daily from Atlassian's monorepo | The alternative when a queue needs reorder; smaller and more active than dnd-kit |

### 2.6 Animation
[motion](https://www.npmjs.com/package/motion) 14.1.0, MIT ([repo](https://github.com/motiondivision/motion)), `motion/react`, React 18 ok. Planned in PLAYABLE-PLAN, not yet installed. Use `LazyMotion` + `m` with `domAnimation` (about 4.6 kB vs 34 kB for the full component, per a [secondary source](https://tessl.io/registry/skills/github/secondsky/claude-skills/motion); confirm on motion.dev before pinning). Earns its place for three things only: `AnimatePresence` exits (cards, feed), number tweens (`animate` on a motion value), and sheet travel. Everything else stays CSS transitions and the Pixi ticker.

### 2.7 Icon sets
| Set | Licence | Count | Use |
|---|---|---|---|
| [Tabler Icons](https://github.com/tabler/tabler-icons) | MIT | 6,238 (5,184 outline, 1,054 filled) | **Adopt for UI verbs and nav**: 24-grid, 1.5 to 2px stroke; confirm per icon that the military nouns we need exist before U1 (plane, ship, submarine, rocket, radar, satellite, atom are listed in its browser). Tree-shake via `@tabler/icons-react` 3.49.0 or an SVG sprite built at `npm run build` |
| [game-icons.net](https://game-icons.net/about.html) | CC BY 3.0, credit required ("Icons made by {author}, game-icons.net") | 4,000+ | **Adopt for domain nouns** that Tabler lacks: minerals, warheads, carriers, missiles, factions. Credits screen required (already a PLAYABLE-PLAN rule) |
| [milsymbol](https://github.com/spatialillusions/milsymbol) | MIT | generated | Map and ORBAT unit symbols (2.3) |
| [flag-icons](https://github.com/lipis/flag-icons) | MIT | all ISO 3166-1 | **Adopt** for nation flags; emoji flags fail on Windows. Subset to the 27 nations in `NATIONS` |
| [circle-flags](https://github.com/HatScripts/circle-flags) | MIT | 400+ | Alternative round style if the HUD wants discs |
| [Lucide](https://github.com/lucide-icons/lucide) | ISC | 1,600+ | Fine but smaller than Tabler; pick one, not both |
| [Phosphor](https://github.com/phosphor-icons/homepage) | MIT | 1,248 x 6 weights | Fine; the duotone weight is tempting for a HUD but doubles the sprite |
| [Kenney](https://kenney-assets.itch.io/ui-pack) | CC0 | UI pack 400+ sprites | Study for HUD bevels and panel corners; usable without credit |

### 2.8 Fonts
| Font | Licence | Why |
|---|---|---|
| [Inter](https://github.com/rsms/inter) | OFL-1.1 | Tabular numbers, `ss01` alternate digits, built for screens. The sans of the situation room |
| [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) | OFL-1.1 | Figures, timestamps, seeds, coordinates. One mono, used for anything that must align |
Both subset to Latin and embedded base64 woff2 in the single-file dist. Budget: under 250 KB total for 2 sans weights + 1 mono weight; measure in U1.

### 2.9 Open-source game UI to study (licence decides what we may do)
| Project | Licence | Status | What to study |
|---|---|---|---|
| [OpenFrontIO](https://github.com/openfrontio/OpenFrontIO) | AGPL-3.0 code, CC BY-SA 4.0 assets | **Study only, never copy** | Territory shading, alliance flow, browser RTS HUD on a 2D map |
| [freeciv-web](https://github.com/freeciv/freeciv-web) | AGPL-3.0 client | Study only | Overlay panels on a canvas map, city dialog density |
| [OpenRA](https://github.com/OpenRA/OpenRA) | GPL-3.0 | Study only | Sidebar production queue, radar minimap |
| [0 A.D.](https://github.com/0ad/0ad) | GPL-2.0 / MIT / LGPL mix | Study only; check file headers | Tooltips with stat deltas |
| [Endless Sky](https://github.com/endless-sky/endless-sky) | GPL-3.0 | Study only | Minimal vector map, trade panel |
| [Widelands](https://github.com/widelands/widelands) | GPL-2.0+ | Study only | Economy targets panel (stock thresholds per ware) |
| [Unciv](https://github.com/yairm210/Unciv) | MPL-2.0, libGDX | Study only (file-level copyleft; safer to treat as GPL) | Civilopedia in-game reference, notifications strip |
| Kenney UI pack | CC0 | Usable | Panel chrome, 9-slice frames |

## 3. Visual language proposal

Keeps the situation-room direction ([PLAYABLE-PLAN](PLAYABLE-PLAN.md)) and the token module as the single source. Everything below is a token change or a new primitive; no vertical gets its own style.

### 3.1 Typography scale
| Token | Font | px | Use |
|---|---|---|---|
| micro / caption / small / body / md / lg | Inter | 9 / 10 / 11 / 12 / 13 / 14 | unchanged roles |
| xl | Inter 600 | 17 | panel titles (unchanged) |
| **fig** | JetBrains Mono 500 | **28** | the one key figure per panel (new) |
| **hero** | JetBrains Mono 500 | **36** | HUD treasury, stability, hegemony at desktop (new) |
| h2 / h1 | Inter 700 | 19 / 24 | nation name, screen titles |
| display | Inter 800, tracking 5px | 42 | title screen only; Georgia retired |
Rules: labels uppercase 10px tracked 1px as now; every figure in mono with `tabular-nums`; prose line-height 1.5; a panel has exactly one `fig`. Phone keeps `fig` at 22 and `hero` at 26.

### 3.2 Colour semantics per system
Factions stay on the map Sphere fill, nation chips and flags only. Systems get a hue that appears in exactly three places: the rail icon, a 2px panel rule, and the mode legend. Values are Tailwind palette names at the 400 step for text and 500 for rules ([Tailwind colours](https://github.com/tailwindlabs/tailwindcss), MIT):

| System | Hue | Text (400) | Rule (500) |
|---|---|---|---|
| Overview / command (player) | blue | #60a5fa | #3b82f6 (unchanged) |
| Situation / escalation | rose | #fb7185 | #f43f5e (distinct from alert red #ef4444 by context: rose is a system, red is a state) |
| Economy | emerald | #34d399 | #10b981 |
| Energy | amber | #fbbf24 | #f59e0b (unchanged) |
| Resources | orange | #fb923c | #f97316 (germany faction orange leaves the chrome, map only) |
| Arsenal | sky | #38bdf8 | #0ea5e9 |
| Forces | lime | #a3e635 | #84cc16 (olive at 600 for unit frames) |
| Intel | violet | #a78bfa | #8b5cf6 (unchanged) |
| Technology | teal | #2dd4bf | #14b8a6 |
| Trade | indigo | #818cf8 | #6366f1 |
| Nuclear | pink | #f472b6 | #ec4899 (unchanged) |
State colours stay: good #4ade80, warn #f0c040, alert #ef4444, and keep the redundancy rule (sign, arrow or ring, never colour alone). All eleven 400-step values clear 6:1 on `bg.panel` (WCAG 2.1 relative luminance, computed 2026-10-12; lowest is indigo at 6.34:1), so `test/tokens.test.js` extends to them at the 4.5:1 bar.

### 3.3 Panel chrome
- **Base**: `bg.panel`, 1px `border.base`, radius 4 at desktop (10 on phone). Rounded 10px corners are the dashboard tell.
- **Title row**: 2px system rule on the left edge, 10px caption, then the status chip right-aligned. Below it the `fig` and its delta.
- **Selected / focused**: four 6px corner ticks in `accent.command` drawn with `::before/::after`, no glow box-shadow (glow is reserved for the map).
- **Texture**: a 2% opacity 64px noise tile on `bg.canvas` only, and the existing ocean grid. Nothing on panels; texture on data surfaces costs legibility.
- **Density**: desktop rows 28px, phone 44px, as DESIGN-SYSTEM already says; tables use 1px row hairlines, no zebra.
- **Buttons**: `-primary` is the one filled style and a panel shows at most one. Everything else is outline or text. The Deals screen becomes a table with one "Sign" per row in outline.

### 3.4 Data visualization conventions (inline SVG primitives in `src/ui/shell/viz/`)
| Primitive | Encodes | Where |
|---|---|---|
| **Bullet bar** | now vs target with a tick for the target and a shaded "acceptable" band | MC vs target, retention now vs target, stockpile months vs 6 |
| **Track** | a position on a labelled ordinal scale | Arsenal pipeline (R&D > Prototype > LRIP > Full rate), bloc tier, escalation ladder rungs |
| **Dot level** | L0 to L7 as 8 filled or hollow 10px discs | R&D verticals (keep, enlarge) |
| **Sparkline** | 24-month trend, no axes | HUD, vitals, any `fig` |
| **Waterfall** | signed categories to a running net | Economy ledger |
| **Sankey** | source > route > chokepoint > home with width = volume, red cut when disrupted | Energy flows |
| **Horizon bar** | time to zero with "now" at left, plant markers along it | Resource depletion |
| **Delta chip** | value, sign, 24-month arrow | every figure |
| **Odds bar** | success % with blowback % stacked, overmatch as a threshold line | Intel ops, Tier-1 |
No gauges or radials: they cost 4x the space of a bar for the same number.

### 3.5 Iconography
Tabler at 16px (rows) and 20px (nav, titles), stroke 1.5, `currentColor`; game-icons at 20px single-tint for nouns; milsymbol frames at 24px on the map and 16px in tables; flags as 16x12 SVG. Emoji are removed from `src/ui` and from the display strings in `src/data` (the data change is a label change, not a rule change; parity goldens hash state, not labels, but confirm in the PR). A `credits` sheet lists game-icons authors.

### 3.6 State transitions
| Event | Treatment | Token |
|---|---|---|
| Month tick | date flips with a 80ms vertical slide; every `fig` tweens to its new value over 220ms; a changed figure flashes its delta chip once | fast, slow |
| Feed entry | slides in from the bell, 220ms, stays | slow |
| Card enter / exit | rise in; collapse out via AnimatePresence | slow |
| Pause | map desaturates 25% and the HUD pause chip pulses once; resume restores in 150ms (DEFCON-style "the board is frozen") | base, pulse |
| Map mode switch | 150ms crossfade of region fills (Victoria 3 configurable fade, [Dev diary 74](https://www.paradoxinteractive.com/games/victoria-3/news/dev-diary-74-ux-improvements)) | base |
| Selection | corner ticks snap in 80ms; the map region gets GlowFilter | fast |
| Brink / nuclear | the only strobe: 1.5s pulse on the rival card and the HUD chip until the cause clears | pulse |
| Outliner jump | viewport `animate` to the region over 320ms, then the sheet opens | drawer |
`prefers-reduced-motion` disables all of it, as now.

## 4. Per-vertical redesign sketches

Each sketch names the real data it uses (file or engine selector), the layout at 1440, and what collapses at 390.

### 4.1 Overview (map)
Data: `REGION_GEO` regions with sphere shares, 6 mode ramps ([src/ui/map/scene.js](../src/ui/map/scene.js)), flashpoints with timers, 5 chokepoints with status, bases and candidate sites (F9b), deployed units per theater, 12 vitals, 4 victory pillars, decision cards, feed.
- The map fills the main column edge to edge, no card. Mode switcher as a vertical strip of 6 icon buttons on the map's left edge; the legend is a 1-row ramp with 5 ticks under it, not a sentence.
- Labels in BitmapText with a halo; region name 12px, the holder share as a 10px mono line; collision solved by hiding the share line below zoom 1.3 and the name below 0.9 (Stellaris shows resources on the map only when relevant, [PC Gamer](https://www.pcgamer.com/uk/why-i-love-stellaris-slick-interface)).
- Markers: flashpoint = rose triangle with a 24-month ring that empties; chokepoint = diamond in its status colour, red with a cut when disrupted; deployed force = milsymbol friendly frame with a count; base = square. Hover shows a CMO-style info box with the four figures that matter for the mode ([Warfare Sims](https://www.warfaresims.com/?p=4954)).
- Vitals column becomes three groups (Fiscal: treasury, GDP growth, inflation, debt/GDP; Social: stability, healthcare, education, food, inequality; Power: military, unemployment) each with one `fig` and sparklines, the rest as small rows.
- Victory pillars as a 4-segment track in the HUD row at desktop, each with "held N/24 months".
- 390: mode strip becomes the existing horizontal row; labels drop to names only.

### 4.2 Arsenal (programs and supply)
Data: programs with stage, cost, months, `Req` levels, tranche cost and mineral inputs per tranche (`programSupply` rows with needT, inflowT, haveT), SAP office, partnerships, buyers with willingness and advantage, triad and nuclear register.
- Programs table (on #74) gains a **pipeline track** column: four rungs R&D > Prototype > LRIP > Full rate with the program's dot on the rung and months to next rung under it (HOI4's line efficiency idea: the line matters, not the label, [dev diary 5](https://forum.paradoxplaza.com/forum/threads/hearts-of-iron-iv-development-diary-5-production-lines.774778/post-17366461)).
- Detail pane: `fig` = next tranche cost; under it a supply strip of mineral icons with a bullet bar each (haveT vs needT, inflow as the arrow); one `-primary` "Tranche #n". Fielded count and history as a 24-month sparkline of units.
- Supply sub-tab becomes a matrix: minerals as columns, programs as rows, cell = coverage %, red when the stockpile cannot cover the next tranche. One screen answers "what starves what".
- Exports: buyers table with willingness and advantage as two bullet bars; row action outline.
- 390: track column becomes a chip; matrix scrolls horizontally with a sticky first column.

### 4.3 Forces (order of battle)
Data: 47 types (US), 8,047 platforms, 5,431 ready, MC vs target, crewless, block, depot months; crews per branch; manpower 1,283,000 active / 761,000 reserve, recruits, attrition, propensity why; SOF units with operators and committed ops; deployments per theater; posture.
- ORBAT table with TanStack grouping by branch (Air / Sea / Land / Nuclear / SOF), group header shows ready / total as a `fig` and the branch equipment factor. Columns: milsymbol glyph + type, count, ready (bullet vs MC target), crews (bullet vs need), depot months, stationed theaters as small flag-less chips.
- Detail pane: 2024 count vs now, MC sparkline, "Retire 12" and "Station" as outline actions; Station opens the map in Military mode with droppable theaters (section 5.3).
- Manpower: one `fig` per headcount, recruits and attrition as a waterfall to next month's strength; propensity as a 4-term why.
- Theater summary becomes a strip of theater cards along the top: name, milsymbol stack of what is there, posture chip, tension chip from the Situation data (ruling 2: tension always visible).
- 390: groups collapse to branch rows; detail in a sheet.

### 4.4 Resources (tonnes and plants)
Data: ten minerals with ore t, refined t/yr, years to zero, % of world, named plants with shares (Mountain Pass, Urenco Eunice, Norilsk, VSMPO-AVISMA, Georges Besse II, Kokkola, Nikkelverk), stockpile t, offtake deals, processing pact, controls against you, GGRB and renewables.
- Reserves as **horizon bars**: one row per mineral, bar = years to zero on a shared 0 to 100-year axis with a red tick at 10 years, plant markers sit on the bar at the point their capacity would be reached; "unrefined" becomes a hollow bar with a "build processing" outline action, not a repeated sentence.
- Processing: a three-column chain per mineral: ore (t) > plants (named nodes with t/yr and % world) > programs that consume it (from Arsenal supply). This is the supply chain the owner asked for in F10 and it already exists as numbers.
- Deals: a table (on #76): partner flag, mineral, t/mo, $/mo, term, relation-priced rate; one outline "Sign" per row; pact as a toggle row at the top with its $/mo.
- 390: horizon bars keep the axis; chain stacks vertically.

### 4.5 Trade (blocs)
Data: 6 bloc groups with members, tier per bloc, trade tiers (EU / CN / OPEC, quota, swing), agreements, sanctions, embassies, influence weight 0 to 3 per nation, defense pacts, currency posture, leverage multiplier, active trade income streams.
- Bloc board: six bloc cards in a 3x2 grid, each with a **tier track** (T1 > T2 > T3 with the exit cost on the rungs), member flags as a row with chips for agreement / embassy / pact / sanctioned, the bloc's monthly income as the `fig`.
- Nation desk (on #77): a table of 27 nations with columns relations (bullet), tension (ramp cell), agreement, embassy, pact, influence weight (a 4-step track you click), sanctions, embargo. Row click opens the side panel with the same verbs grouped Statecraft / Economic / Military, one `-primary` at most.
- Leverage: the dominance multiplier shown as a chip on the income `fig` ("x1.19 leverage") with a why.
- 390: bloc cards stack; the table becomes the existing sheet.

### 4.6 Intel (dossiers)
Data: issues and briefs with options, costs, projected deltas and risks; ops catalog with odds; counter-intel; exposure; moles, expelled, embassies per nation; Tier-1 units and overmatch; continuous ops.
- Target dossier per nation (Suzerain's codex idea: the file is the UI, [launch note](https://gamingtrend.com/topor-games-announces-suzerain-and-kingdom-of-rizia-dlc-launch-on-xbox-and-playstation)): header with flag, relations, tension, exposure as three `fig`s; a timeline strip of past ops and their outcomes; op cards as a grid with an **odds bar** (success stacked with blowback) and cost; Tier-1 checklist with the overmatch bullet and the SOF units it commits.
- Briefs: option cards keep their projected deltas but as delta chips, not inline text; the paragraph moves into a "Why now" disclosure.
- Counter-intel: exposure as a bullet vs the interception threshold with the four terms (Cyber R&D, budget, CI ops, grid) as a why.
- 390: dossier is the nation sheet's Intel tab.

### 4.7 Economy (ledger)
Data: `cash(category)` ledger, tax rate 8 to 48% and breadth, fiscal stance, interest rate, fiscal and debt actions, sector budgets, policies, projected revenue, vitals drill.
- Ledger as a **waterfall**: income categories up in emerald, expenses down in rose, running net line to the treasury `fig`; click a bar for its why (ruling: every number explains itself). Sorted by magnitude; a 24-month stacked sparkline underneath.
- Tax and interest as Radix sliders with a projection curve drawn above the thumb (revenue vs rate over the slider's range, from the engine's projection selector) and the political cost chip (Democracy 4's affordable-now red/green, [Positech](https://www.positech.co.uk/cliffsblog/2020/05/14/democracy-4-variable-slider-costs/)).
- Sector budgets become the budget surface (section 5.1).
- 390: waterfall rotates to horizontal bars with the running net as a column.

### 4.8 Energy (flows)
Data: `IMPORT_ROUTES` per region over 5 chokepoints with status, SPR level, export shares, embargoes (both directions), concessions with ramp curves, escort posture, oil price, renewables.
- **Sankey**: left nodes are supplier regions, middle nodes the five chokepoints, right node is home; link width is import volume; a disrupted chokepoint draws its links cut with a red gap and the lost volume rerouted as dashed lines; embargoes grey out a supplier. Oil price as the `fig` with a 24-month sparkline that marks disruption months.
- SPR as a bullet (months of cover vs the 20% rule from Q3) with the release toggle beside it.
- Concessions as cards with their ramp curve as a sparkline and the intervention option behind the confirm sheet.
- Map Energy mode gets the same flows as lanes, so the vertical and the map agree.
- 390: sankey becomes a vertical three-tier list with the same colouring.

### 4.9 Technology (eras)
Data: 10 verticals at L0 to L7, research queue, era-gated programs with stage / cond / why / sfx, civilian programs, active effects, AGI (t9), rdSpeedMult.
- **Tech lanes** as a CSS grid: rows are the 10 verticals, columns are eras; each cell is the program available at that level with its state (done / in progress with a bullet / locked with the unlock condition in one line). An SVG overlay draws prerequisite arrows between cells. The queue is a strip at the top with drag reorder deferred until Q10.
- The current dot-level rows stay as the row headers, at 12px discs.
- A "next 12 months" marker: a vertical line across the grid where the current research rate will reach, so the clock is visible.
- AGI (t9) is the last column with the four conditions as a checklist.
- 390: one vertical at a time, columns scroll horizontally.

## 5. Allocation and direct manipulation (from the core loop spec)

### 5.1 One budget surface
A single horizontal stacked bar is the whole budget: segments for every allocation the engine already has (sector budgets, personnel pay, R&D split, agency budget, influence pool, SPR purchases, stockpile targets), each boundary draggable with use-gesture. Dragging one boundary grows that segment and shrinks its neighbour by default; holding Shift (or the "lock others" toggle on phone) takes from the unallocated pool instead. Under every segment: this month's cost, next month's projected effect from the engine's projection selector (E4 in QOL-RESEARCH: "selectors that compute the month's term for a hypothetical value"), and the delta chip. Nothing commits until "Apply", which dispatches one action per changed segment. The widget reads only `cash(category)` and the existing lever state; new levers from G1 to G4 add a segment, not a screen. Acceptance: every allocation reachable in the game is on this bar; a drag shows the projection within one frame; keyboard arrows move a boundary by 1%.

### 5.2 Sliders with live projections
One `Slider` component on Radix: track with tick marks at the engine's gates (tax 8 to 48%, pay bands), a thumb that shows the value, and a 24-point projection curve drawn above the track for the slider's range. The curve comes from a selector `project(lever, value) -> {term, delta}` in `src/sim` (pure, tested), never from the UI. Cost of the move as a chip that turns red when unaffordable this month. Replaces all 10 native ranges. Acceptance: no `type="range"` in `src/ui`; each slider has a projection test against the engine's own next-month term.

### 5.3 Map as control surface
- **Deploy by drag**: in Military mode, dragging a milsymbol from the theater strip or the ORBAT onto a region dispatches `deployUnit`; the region highlights with the posture and tension it would have.
- **Build by click**: Build mode (F9b) stays; candidate sites show cost on hover and place on click, with the reach ring previewed before confirm.
- **Posture on the region**: the region sheet's posture segmented control also appears as a small radial of 5 icons on the selected region at desktop.
- **Target by click**: sanctions, embargo, ops and Tier-1 start from the nation chip on the map, as now through the sheet, with the confirm sheet for anything escalatory.
- **Hover is the readout**: CMO-style box with the mode's four figures; click is the act. Acceptance: deploy, station, build and posture each work from the map without opening a vertical (the core loop's done condition).

## 6. Build plan (ordered by impact per effort)

All items are UI-only unless marked; parity goldens untouched; `npm test` green; 390px renders; shots at 390 and 1440 in the PR. Model split follows [PLAYABLE-PLAN](PLAYABLE-PLAN.md): Sonnet 5.5 for vertical and primitive PRs, Fable 5.1 for the map and long-horizon work, Opus 5.5 for engine seams and reviews. Lands after #73 to #77 merge; U1 to U5 are app-wide and come first because every vertical inherits them.

| # | Item | Effort | Model | Depends on | Acceptance |
|---|---|---|---|---|---|
| U1 | **Type and icon foundation**: Inter + JetBrains Mono subset embedded in dist; Tabler sprite; game-icons for nouns; flag-icons subset; emoji removed from `src/ui` and data labels; credits sheet; `fig` / `hero` tokens | M | Sonnet | none | zero emoji in `src/ui` (test); fonts render offline from `dist/world-leaders.html`; dist growth under 300 KB; contrast test green; credits sheet lists every game-icons author |
| U2 | **Panel chrome v2 and token pay-down**: title row with system rule and one `fig`, corner-tick selection, radius 4 at desktop, one `-primary` per panel, system hues; replace the 1,160 hex literals in App.jsx with tokens | M (mechanical) | Sonnet | U1 | `grep -c '#[0-9a-f]\{6\}' src/ui/App.jsx` = 0 (test); every panel has exactly one `.wl-fig`; 390 and 1440 shots per vertical |
| U3 | **Figures that move**: motion (LazyMotion) installed; number tween and delta flash on tick; feed slide; card exits; pause desaturation; mode crossfade | S | Sonnet | U2 | reduced-motion test passes; a stepped month changes every HUD figure with a tween (jsdom asserts the final value, Playwright asserts the class) |
| U4 | **Slider primitive with projections**: Radix slider + `project()` selectors in `src/sim`; replaces the 10 native ranges | M (engine seam S) | Opus (selectors) + Sonnet (UI) | U2 | no native range in `src/ui`; a projection test per lever equals the engine's next-month term |
| U5 | **Map as HUD**: edge-to-edge map, mode strip, ramp legend, BitmapText labels with zoom-gated lines, pixi-filters glow and bloom, milsymbol markers, chokepoint cut state, hover info box, outliner fly-to via viewport `animate` | L | Fable | U1, #73 | 60 fps pan at 1440 on the owner's machine and on a phone (map-bench.json extended); every marker type has a Playwright hit test; labels never overlap at fit zoom (test over all regions) |
| U6 | **Budget surface** (5.1) on the Economy tab, over existing levers | M | Sonnet | U4 | every allocation lever appears as a segment (test enumerates them); drag then Apply dispatches the same actions as the old controls (verb parity) |
| U7 | **Forces ORBAT** with TanStack Table grouping, bullet bars, milsymbol, theater strip, drag-to-deploy on the map (5.3) | M | Sonnet (table) + Fable (map drag) | U5, #75 | 47 US types grouped by branch; station via drag dispatches `deployUnit`; 28px rows at 1440, 44px at 390 |
| U8 | **Energy sankey** with d3-sankey layout and own SVG; Energy map mode draws the same flows | M | Sonnet | U2, U5 | disrupting Hormuz through `window.__wl` cuts its links and moves the oil price `fig` in the same render; embargo greys the supplier |
| U9 | **Economy waterfall** ledger with why per bar | S | Sonnet | U2 | sum of bars equals treasury net (test); every category has a why |
| U10 | **Arsenal pipeline track and supply matrix** | M | Sonnet | U2, #74 | each program's rung matches its stage; a tranche the stockpile cannot cover turns its cell red (test via `__wl.fund`) |
| U11 | **Resources horizon bars and supply chain** | M | Sonnet | U2, #76 | years-to-zero bar per mineral equals `mineralView.years`; plant nodes name every `FACILITIES` row |
| U12 | **Trade bloc board and nation desk table** | M | Sonnet | U2, #77 | six blocs with tier tracks; 27 nations in the table; every nation sanctionable from the row (ruling 7) |
| U13 | **Intel dossier** per nation with odds bars and Tier-1 overmatch | M | Sonnet | U2 | dossier reachable from the nation sheet and the map; "no viable targets" never renders (test) |
| U14 | **Escalation ladder** (Situation): rungs per rival, what moves each rung | M | Sonnet | U2 | every rival's rung equals its tension band; nuclear rung reachable through `__wl.setTension` |
| U15 | **Tech lanes** as CSS grid with SVG prerequisite arrows (proposal: not xyflow) | M | Sonnet | U2 | locked cells show their condition; era gating reads the engine (ruling 5); queue persists across saves |
| U16 | **Policy web** with xyflow (V3 Tier 2) | M-L | Sonnet | U6 | active policies lit; each edge carries the engine's effect term |
| U17 | Audio cues (howler) for alerts, escalation, month tick at 4x off | S | Sonnet | U3 | mute persists; no sound under reduced-motion unless opted in |

Sequencing: U1 > U2 > U3 > U4 > U5 in series (each is a prerequisite), then U6 to U15 in parallel branches stacked on their vertical PR, then U16 and U17. Expected total: 17 PRs, 3 of them Fable, 1 Opus seam.

### Dependencies added by this plan
| Package | Why (one line, for the PR) |
|---|---|
| Inter, JetBrains Mono (woff2 subsets, OFL) | system fonts are the dashboard look; tabular mono figures |
| Tabler sprite, game-icons SVGs, flag-icons subset | emoji are platform-dependent and untintable |
| motion | planned in PLAYABLE-PLAN; AnimatePresence and number tweens |
| @radix-ui/react-slider | one accessible multi-thumb slider; Radix already present |
| @tanstack/react-table | grouping and pinning for ORBAT and the nation desk |
| d3-sankey | layout math for energy flows, drawn with our own SVG |
| pixi-filters | glow and bloom on the map |
| milsymbol | APP-6 unit symbols |
Not added: visx, uPlot, echarts, dnd-kit, virtualization, @pixi/ui, deck.gl.

### Ruling and plan changes to raise as issues (not implemented here)
1. Tech lanes as a grid, not xyflow (2.4).
2. Georgia display font retired for Inter (3.1); DESIGN-SYSTEM type section.
3. Faction colours confined to map and flags; system hues added (3.2).
4. Radius 4 at desktop (3.3).
