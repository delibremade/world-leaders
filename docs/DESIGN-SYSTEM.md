# Design system: situation-room tactical

Decided by the owner 2026-10-09 (docs/PLAYABLE-PLAN.md, "Visual direction"). Dark, vector, glowing data on a
command-terminal base. v57's palette is the seed; this document names it, fixes the scales, and sets the rules
every vertical inherits. Source of truth for values: `src/ui/tokens.js`. This file explains; the module decides.

## Consumers
| Consumer | Reads | How |
|---|---|---|
| React (src/ui) | `TOKENS.color.*`, `SIZE`, `SPACE` ... | inline styles and the `.wl-*` classes |
| PixiJS map (P3b) | `pixiHex(COLOR.faction.china)` | numeric fills |
| Global stylesheet | `TOKEN_CSS` | `installTheme(document)` in `src/ui/main.jsx`, once per page |

Rule: no new hex literal in `src/ui` after P3. P4 replaces v57's inline hexes tab by tab as each vertical is rebuilt.

## Colour
Dark-first. There is no light theme; the terminal is the brand.

| Role | Token | Value | Use |
|---|---|---|---|
| Canvas | `bg.canvas` | #06090d | page body |
| Surface | `bg.surface` | #0a0e14 | rails, vitals column, map chrome |
| Panel | `bg.panel` | #0d1117 | panels, HUD, cards |
| Raised | `bg.raised` | #111827 | modals, sheets, nested cards |
| Inset | `bg.inset` | #1f2937 | chips, bar tracks, inputs |
| Border | `border.base` / `border.strong` | #1f2937 / #374151 | hairlines / controls |
| Text | `text.primary` .. `text.faint` | #f9fafb #d1d5db #9ca3af #6b7280 #4b5563 | five steps; `dim` is the floor for labels, `faint` only for decoration |
| Command | `accent.command` | #3b82f6 | the player, primary actions, focus |
| Good / Warn / Alert | `accent.good` `accent.warn` `accent.alert` | #4ade80 #f0c040 #ef4444 | outcomes, never decoration |
| Intel / Energy / Nuclear | `accent.intel` `accent.energy` `accent.nuclear` | #a78bfa #fbbf24 #f472b6 | domain colours, one each |
| Factions | `faction.*` | usa #22d3ee russia #ef4444 china #eab308 germany #f97316 | map affiliation; player is always `command` |
| Chokepoints | `choke.*` | secured #4ade80 escorted #60a5fa open #9ca3af disrupted #ef4444 | |
| Ramps | `ramp.tension` `ramp.trade` `ramp.energy` `ramp.military` `ramp.intel` | 5 stops each, low to high | map modes; see "Map modes" |

Contrast (WCAG 2.1 against `bg.panel`, enforced by `test/tokens.test.js`): primary, secondary and muted text
meet 4.5:1; dim meets 3:1 and is reserved for labels of 11px+ uppercase or supporting copy next to a stronger
number. Alert red on panel is 4.6:1; warn and good are above 9:1.

Semantics: colour never carries a meaning alone. A number that is bad is red and has a sign or an arrow; a
chokepoint that is disrupted is red and has a ring. Colour-blind safe by redundancy, not by palette.

## Type
Stack: `font.sans` (SF Pro / system) for everything; `font.display` (Georgia) only for the title and nation
names; `font.mono` for log timestamps and seeds. Numerals are tabular everywhere (`html` rule).

| Token | px | Use |
|---|---|---|
| micro | 9 | chart ticks, legend keys, inside-chip counts only |
| caption | 10 | `.wl-label` uppercase labels, HUD date |
| small | 11 | secondary copy, chip text, table cells |
| body | 12 | default copy, buttons |
| md | 13 | sheet copy, modal body |
| lg | 14 | row titles, HUD key figure |
| xl | 17 | panel titles |
| h2 / h1 | 19 / 24 | nation name in HUD / screen titles |
| display | 42 | title screen |

Floor at 390px: running copy is `body`; nothing the player must read to decide is below `small`. Micro and
caption are for labels that sit next to a larger number.

Tracking: labels `1px`, section captions `2px`, titles `3px`, the hero stamp `5px`. Line height `1.5` for copy,
`1.2` for figures, `1.7` for modal prose.

## Spacing, radius, tap targets
4px base, named `SPACE[1..12]` = 2 4 6 8 10 12 14 16 20 24 36. Panels pad `SPACE[6]` (12), cards `SPACE[6]`,
chips `2 x 8`, gutters `SPACE[6]`. Radius: chips 4, buttons 6, cards 8, panels 10. Tap target `TAP` = 44px:
every button, nav item, list row and map marker hit area. `.wl-btn-sm` (32px) is allowed only inside a row that
is itself 44px tall.

## Elevation and layering
Flat by default. Depth comes from background steps (canvas -> surface -> panel -> raised), not shadows.
`elevation.raised` (soft black) for anything floating (toast, sheet); `elevation.glow` (blue) only for the hover
state of a selectable card. Overlays use `scrim` plus `7px` blur. z-order is fixed in `Z`: map 0, panel 10,
chrome 100, sheet 500, outliner 600, toast 999, modal 1500, game over 2000, victory 2100. A new surface picks an
existing slot; it does not invent a z-index.

## Motion
| Token | Value | Use |
|---|---|---|
| fast | 80ms | press feedback |
| base | 150ms | hover, colour, chip changes |
| slow | 220ms | toast, card entrance (`wl-fade-in`, `wl-rise`) |
| drawer | 320ms | sheet and outliner travel |
| pulse | 1.5s | attention: decision pending, flashpoint, holding streak |
| dash | 1.1s | moving trade dashes on the map |

Easing `cubic-bezier(.2,.8,.3,1)`. `prefers-reduced-motion` disables all animation and transition. Nothing
loops except pulse and dash, and both stop when their cause clears.

## Primitives (classes in `TOKEN_CSS`)
- `.wl-panel`, `.wl-card`: the two container steps. A panel holds a title row (`.wl-label`), one key figure
  (`.wl-num`), then detail. The Tier 1 "panel primitive" (collapsible, with detail drawer) is built on these in P3c.
- `.wl-chip` with `-good -warn -alert -command` variants: status, never an action.
- `.wl-btn` with `-primary -good -alert -warn` and `-sm`: the only button styles. Destructive and escalatory
  acts are `-alert`, costly reversible acts `-warn`, commits `-primary`.
- `.wl-scrim`: the one modal backdrop.
- `.wl-label`, `.wl-num`, `.wl-row`, `.wl-tap`, `.wl-pulse`: layout helpers.

## Layout at 390px (ruling 8)
Portrait phone is the design target; desktop is the same layout with more columns. Chrome: HUD 48px top,
bottom nav 56px plus safe-area inset. The map fills the rest. Sheets open to 55% of the viewport, drag to
92%. One column of content; no side-by-side panels under 900px. Horizontal scroll is only ever a deliberate
chip strip. Every screen is reachable one-thumbed: primary actions sit in the lower half.

## Map modes (P3b)
Sphere (affiliation fill, contested hatch), Tension (ramp per region from the max rival tension present),
Trade (ramp from export and lane income), Energy (ramp from import exposure, chokepoints emphasised), Military
(ramp from deployed weight), Intel (ramp from ops and exposure). One tap switches the fill; overlays stay.
Each mode carries a legend of its ramp and its glyphs.

## What this does not decide
Icons (game-icons.net / Kenney, credits screen required), audio, and per-vertical layouts are P4 and Tier 3.
