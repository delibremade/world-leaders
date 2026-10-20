# Design System v2: 2.5D situation room (owner-approved 2026-10-20)

Supersedes the P3a design system. Reference canvas (owner's account): https://claude.ai/artifact/PG8fbiDko8PNgqBDDkFMPz (boards: Overview, Budget, Forces, Visual language). This document is self-sufficient: build from it, not from the canvas.

Desktop-first (1440px+); 390px must still render. Implement tokens once in `src/ui/tokens` and consume everywhere. No per-vertical styling.

## 1. Genre rules (from the research round, sources in the canvas review)
1. **One map does most of the work.** Abstraction fades as you zoom in and specifics emerge; orders are given from the map. (Hearts of Iron IV)
2. **Map modes bottom-right with hotkeys; resources, alerts and time in the top bar.** (HoI4)
3. **Every number explains itself.** Hover or focus opens a tooltip; tooltips may hold tables. (CK3/Victoria 3 nested tooltips, "tables in tooltips")
4. **Alerts are color-coded** so the kind reads before the text. (Victoria 3)
5. **Same icon on the map and in the HUD; icons differ in shape and color, never one tint for everything.** (Age of Empires IV, and the player pushback on its monochrome icons)
6. **Command-console map:** dark land, glowing coastline, deep ocean. (DEFCON)
7. **Hierarchy through complexity and scale:** the map dominates; panels appear when called. (Victoria 3 art direction)
8. **Selection opens a command card** at bottom center, each action with its key; escalatory actions are always orange. (RTS convention: StarCraft II, AoE)

## 2. Tokens
### Elevation (depth ranks urgency)
| Level | Use | Surface | Shadow |
|---|---|---|---|
| L0 | ground | `#05080F` / `#070B14` | none |
| L1 | panels | `linear-gradient(180deg,#121C30,#0C1424)` | `inset 0 1px 0 rgba(255,255,255,.07), 0 18px 40px rgba(0,0,0,.55)` |
| L2 | focused panel, outliner focus | `linear-gradient(180deg,#17233A,#111A2C)` | `inset 0 1px 0 rgba(255,255,255,.08), 0 22px 46px rgba(0,0,0,.6)` |
| L3 | command card, tooltip, confirm sheet | `linear-gradient(180deg,#1F3050,#152338)` | `inset 0 1px 0 rgba(255,255,255,.12), 0 24px 50px rgba(0,0,0,.7)` |
| Well | numbers, inputs (inset) | `linear-gradient(180deg,#0E1726,#0A111D)` | `inset 0 2px 4px rgba(0,0,0,.6), 0 1px 0 rgba(255,255,255,.06)` |

Rule: inset wells hold numbers and inputs; raised surfaces hold actions.

### System color (each system owns one hue; reuse it on map, rail, alerts, cards)
| System | Hex | | System | Hex |
|---|---|---|---|---|
| You / signal | `#4FB8FF` | | Arsenal | `#9DB4D6` |
| Economy / gain | `#6EE7A8` | | Forces | `#8FA9C9` |
| Energy / chokepoint | `#F5C451` | | Intel | `#B49CFF` |
| Resources | `#E08A4F` | | Technology | `#4FD1C5` |
| Trade | `#E9863F` | | Alert / escalation | `#FF7A45` |

Rival spheres: Russia `#E5484D`, China `#E8B33A`, Germany `#E9863F`. Colors that must be told apart also differ in lightness. Text: primary `#E6EDF7`, secondary `#9AA8BF` (passes 4.5:1 on L1), muted `#7C8AA3` for key hints only.

### Alert families
| Kind | Text | Edge | Fill |
|---|---|---|---|
| Situation / escalation | `#FFB08A` | `rgba(255,122,69,.45)` | `linear-gradient(180deg,#3A1C12,#26130D)` |
| Brief / intel | `#CDBBFF` | `rgba(180,156,255,.4)` | `linear-gradient(180deg,#261E42,#19142D)` |
| Chokepoint / lock / stage | `#F5C451` | `rgba(245,196,81,.45)` | `linear-gradient(180deg,#33290F,#211B0A)` |
| Good / timer | `#6EE7A8` | `rgba(110,231,168,.35)` | `#0F2A1F` |

### Type
- **Barlow Condensed 600/700**: display, labels, buttons; caps, tracked .04 to .16em.
- **Inter 400/500/600**: prose and descriptions.
- **JetBrains Mono 500/600**: every number, so columns align.
- Minimum text 12px; key hints 10 to 11px muted.

### Controls
- Primary: `linear-gradient(180deg,#8FDFFF,#4FB8E8)`, dark text, glow shadow.
- Secondary: `linear-gradient(180deg,#22324F,#172338)`, light text, 1px `rgba(255,255,255,.12)` edge.
- Escalate: orange family above. Any escalatory act still routes through the confirm sheet.
- Hover: `filter: brightness(1.15)`. Targets 44px on touch; desktop rows may be 27 to 30px.
- Sliders: 6px inset track, 18 to 20px raised thumb.

## 3. The 2.5D map (PixiJS implementation of the canvas)
- **Plane:** world tilted ~46 to 50 degrees with perspective; ocean deep blue radial (`#0B2546` to `#04101F`), faint lat/long grid.
- **Regions:** extruded plates (base shadow layer, wall, glowing edge, top). Land fill dark `#0B1626`; edge glows `rgba(127,216,255,.55)` by default. In Sphere and Tension modes the top takes a 35% tint of the leader's color and the edge lights fully in that color. Never flood land with saturated fill.
- **Names on the surface:** region names lie flat on the plane, large and tracked, fading at higher zoom (Paradox convention). Values (sphere %) stand up as billboard chips.
- **Markers:** bases, units and labels stand upright (billboards) with a soft ground shadow; reach rings lie flat; chokepoints are raised gold diamonds; flashpoints pulse orange; trade lanes animate along the surface.
- **Level of detail (zoom):** Strategic (names + sphere chips) → Operational (+ base and chokepoint names) → Tactical (+ reach rings, unit detail). Show the current level as a chip top-left.
- **Map-mode dock** bottom-right: Sphere Q, Tension W, Trade E, Energy R, Military T, Intel Y; icon + label + key. Mode changes emphasis layers, not data.
- **Legend** bottom-left, per mode. Zoom controls top-right.
- Real geography stays Natural Earth (REGION_GEO); the canvas shapes are stylized stand-ins only.

## 4. Interaction patterns
- **Top bar:** identity and date; resource wells with tooltip tables; color-coded alert chips (click focuses the matching outliner rows and map mode); pause that remembers speed; speed pips; ALLOCATE.
- **Tooltip tables:** every HUD figure and every key number. Title, one-line subtitle, then a 2-column table. Values come from the engine's categories; never recomputed in the UI.
- **Command card:** on selecting a region, unit type or budget line, a card rises bottom-center (map) or tops the right column (verticals): header with color bar, then a 4-column grid of actions, each with icon, label and key (Overview: Deploy A, Station base S, Influence D, State visit F, Sanction Z, Embargo X, Intel op C, Build node V).
- **Allocation surface:** one pool; dragging one line squeezes the unlocked others proportionally; lock prevents squeeze; each line shows change vs baseline; a "squeezed" alert and a list of what was cut. Quick version as a drawer over the map; full version in Economy.
- **Outliner:** right column; icon chip in the item's family color; focused items rise to L2.
- **Master-detail:** list or table left, detail and command card right (Arsenal, Forces, Resources, Trade).
- **Motion:** panels rise 16px over 280ms; markers bob 3px; lanes flow; pulses on live flashpoints only. Respect prefers-reduced-motion.

## 5. Acceptance for any screen built on this
- Uses tokens only; no ad hoc hex values.
- Every key number has a tooltip table; every action has a key hint.
- Alert colors match their family; escalatory actions are orange and confirm.
- Same icon for the same thing in map, HUD, alerts and cards.
- 1440 and 1920 screenshots; 390 still renders with no sideways scroll.
