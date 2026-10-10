// Tier 1 shell stylesheet (P3c): app grid, HUD, event-card strip, bottom nav / side rail, outliner, sheet,
// why-popover. Tokens only (docs/DESIGN-SYSTEM.md). Mobile first; the 900px query turns the bottom nav into
// a left rail and the outliner into a right column.
import { COLOR, SIZE, SPACE, RADIUS, TAP, ELEVATION, MOTION, Z, BREAK } from '../tokens.js';

const c = COLOR;
export const SHELL_CSS = `
.wl-app{display:grid;grid-template-columns:minmax(0,1fr);width:100%;max-width:100vw;grid-template-rows:auto auto minmax(0,1fr) auto;grid-template-areas:"hud" "cards" "main" "nav";height:100vh;height:100dvh;background:${c.bg.canvas};color:${c.text.secondary};overflow:hidden}
.wl-hud{grid-area:hud;background:${c.bg.panel};border-bottom:1px solid ${c.border.base};padding:${SPACE[2]}px ${SPACE[5]}px;display:flex;flex-direction:column;gap:${SPACE[2]}px}
.wl-hud-row{display:flex;flex-wrap:wrap;align-items:center;gap:${SPACE[2]}px ${SPACE[4]}px;min-height:${TAP - 8}px}
.wl-hud-nation{display:flex;align-items:center;gap:${SPACE[3]}px;min-width:0;flex:1}
.wl-hud-nation b{display:block;font-size:${SIZE.md}px;color:${c.text.primary};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wl-hud-nation>div{min-width:0;overflow:hidden}
.wl-hud-nation small{display:block;font-size:${SIZE.caption}px;color:${c.text.dim};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wl-speed{display:inline-flex;border:1px solid ${c.border.strong};border-radius:${RADIUS.lg}px;overflow:hidden;flex-shrink:0}
.wl-speed button{min-width:38px;min-height:36px;border:none;background:transparent;color:${c.text.muted};font-size:${SIZE.small}px;font-weight:700;padding:0 ${SPACE[3]}px}
.wl-speed button[aria-pressed=true]{background:${c.accent.commandDeep};color:${c.text.onAccent}}
.wl-speed button[data-pause][aria-pressed=true]{background:${c.accent.goodDeep};color:${c.accent.good}}
.wl-hud-figs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:${SPACE[2]}px}
.wl-fig{min-width:0;overflow:hidden;min-height:${TAP}px;display:flex;flex-direction:column-reverse;align-items:flex-start;justify-content:center;gap:2px;padding:${SPACE[2]}px ${SPACE[4]}px;border-radius:${RADIUS.lg}px;border:1px solid ${c.border.base};background:${c.bg.inset};color:inherit;text-align:left;font:inherit}
.wl-fig-l{font-size:${SIZE.micro}px;color:${c.text.dim};text-transform:uppercase;letter-spacing:.5px;line-height:1.2;white-space:nowrap}
.wl-fig-v{font-size:${SIZE.md}px;font-weight:700;line-height:1.2;white-space:nowrap}
.wl-fig-d{font-size:${SIZE.micro}px;font-weight:700;margin-left:3px}
.wl-fig svg,.wl-fig .recharts-wrapper{flex-shrink:0;max-width:100%}
.wl-fig>div{min-width:0;max-width:100%}
.wl-fig-v{overflow:hidden;text-overflow:ellipsis}
.wl-pause-chip{order:9;flex-basis:100%;text-align:center;font-size:${SIZE.caption}px;color:${c.accent.warn};border:1px solid ${c.accent.warnDeep};background:rgba(240,192,64,.08);padding:3px ${SPACE[4]}px;border-radius:${RADIUS.md}px;white-space:nowrap;flex-shrink:0}
.wl-pause-chip[data-kind=you]{color:${c.accent.good};border-color:${c.accent.good};background:rgba(74,222,128,.1)}
.wl-cards{grid-area:cards;display:flex;gap:${SPACE[4]}px;overflow-x:auto;padding:${SPACE[4]}px ${SPACE[6]}px;scroll-snap-type:x mandatory;background:${c.bg.surface};border-bottom:1px solid ${c.border.base}}
.wl-cards:empty{display:none}
.wl-card-ev{flex:0 0 min(86vw,420px);scroll-snap-align:start;background:${c.bg.raised};border:1px solid ${c.border.strong};border-left:3px solid var(--ev,${c.accent.command});border-radius:${RADIUS.xxl}px;padding:${SPACE[5]}px ${SPACE[6]}px;animation:wl-rise ${MOTION.slow} ${MOTION.ease}}
.wl-card-ev h4{margin:0 0 2px;font-size:${SIZE.lg}px;color:${c.text.primary}}
.wl-card-ev .wl-label{color:var(--ev,${c.accent.command})}
.wl-why-now{margin:${SPACE[2]}px 0 0;font-size:${SIZE.caption}px;color:var(--ev,${c.accent.command});line-height:1.4}
.wl-card-ev p{margin:${SPACE[2]}px 0 ${SPACE[4]}px;font-size:${SIZE.body}px;color:${c.text.muted};line-height:1.5}
.wl-opts{display:grid;gap:${SPACE[3]}px;grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}
.wl-opt{min-height:${TAP}px;background:${c.bg.panel};border:1px solid ${c.border.strong};border-radius:${RADIUS.xl}px;padding:${SPACE[4]}px;cursor:pointer;font-size:${SIZE.small}px;color:${c.text.secondary}}
.wl-opt b{display:block;color:${c.text.primary};font-size:${SIZE.body}px;margin-bottom:2px}
.wl-opt small{display:block;color:${c.text.dim};font-size:${SIZE.caption}px}
.wl-opt:hover{border-color:var(--ev,${c.accent.command})}
button.wl-opt{text-align:left;font-family:inherit;width:100%}
.wl-opt[aria-disabled=true]{opacity:.55;cursor:not-allowed}
.wl-opt .wl-reason{color:${c.accent.alert}}
.wl-main{grid-area:main;display:flex;min-height:0;overflow:hidden}
.wl-body{grid-area:main;overflow-x:clip;min-width:0}
.wl-body>*{min-width:0}
.wl-nav{grid-area:nav;display:flex;background:${c.bg.panel};border-top:1px solid ${c.border.base};padding-bottom:env(safe-area-inset-bottom)}
.wl-nav button{position:relative;flex:1 1 0;min-width:0;min-height:56px;border:none;background:transparent;color:${c.text.dim};font-size:${SIZE.caption}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:${SPACE[2]}px 0}
.wl-nav button span:first-child{font-size:18px;line-height:1}
.wl-nav button .wl-nav-l{display:none;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wl-nav button[aria-current=page] .wl-nav-l{display:block}
.wl-nav button[aria-current=page]{color:${c.text.primary}}
.wl-nav button[aria-current=page]::after{content:"";position:absolute;top:0;left:18%;right:18%;height:2px;background:${c.accent.command};border-radius:0 0 2px 2px}
.wl-badge{position:absolute;top:4px;right:calc(50% - 16px);min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:${c.accent.warn};color:#000;font-size:${SIZE.micro}px;font-weight:800;display:flex;align-items:center;justify-content:center}
.wl-help{width:${TAP - 8}px;height:${TAP - 8}px;border-radius:50%;border:1px solid ${c.border.strong};background:transparent;color:${c.text.muted};font-weight:700;font-size:${SIZE.body}px;flex-shrink:0}
.wl-help-row{display:flex;gap:${SPACE[3]}px;padding:4px 0;border-bottom:1px solid ${c.border.base};font-size:${SIZE.small}px;line-height:1.4}
.wl-help-row:last-of-type{border-bottom:none}
.wl-badge[data-sev=alert]{background:${c.accent.alert};color:#fff}
.wl-outliner{position:fixed;left:0;right:0;bottom:calc(56px + env(safe-area-inset-bottom));z-index:${Z.outliner};background:${c.bg.panel};border-top:1px solid ${c.border.strong};box-shadow:${ELEVATION.raised};display:flex;flex-direction:column;transition:height ${MOTION.drawer} ${MOTION.ease};height:32px;touch-action:none}
.wl-outliner[data-open=true]{height:62vh}
.wl-outliner-handle{height:32px;flex-shrink:0;display:flex;align-items:center;justify-content:center;gap:${SPACE[4]}px;font-size:${SIZE.caption}px;color:${c.text.muted};border:none;background:transparent;width:100%;text-transform:uppercase;letter-spacing:1px}
.wl-outliner-handle::before{content:"";width:36px;height:4px;border-radius:2px;background:${c.border.strong}}
.wl-outliner-body{overflow-y:auto;padding:0 ${SPACE[6]}px ${SPACE[6]}px;flex:1;min-height:0}
.wl-outliner[data-open=false] .wl-outliner-body{display:none}
.wl-ol-group{font-size:${SIZE.micro}px;color:${c.text.dim};text-transform:uppercase;letter-spacing:1px;margin:${SPACE[5]}px 0 ${SPACE[2]}px}
.wl-ol-row{width:100%;min-height:${TAP}px;display:flex;align-items:center;gap:${SPACE[4]}px;padding:${SPACE[2]}px 0;border:none;border-bottom:1px solid ${c.border.base};background:transparent;color:${c.text.secondary};text-align:left;font:inherit;font-size:${SIZE.small}px}
.wl-ol-row b{color:${c.text.primary};font-weight:600}
.wl-ol-row small{color:${c.text.dim};display:block;font-size:${SIZE.caption}px}
.wl-ol-row .wl-ol-t{margin-left:auto;font-weight:700;white-space:nowrap;color:${c.text.muted}}
.wl-ol-bar{height:3px;background:${c.bg.inset};border-radius:2px;margin-top:3px;overflow:hidden}
.wl-ol-bar i{display:block;height:100%;background:${c.accent.command}}
.wl-sheet-overlay{position:fixed;inset:0;background:rgba(4,7,12,.6);z-index:${Z.outliner + 9}}
.wl-sheet{position:fixed;left:0;right:0;bottom:0;max-height:92vh;max-height:92dvh;background:${c.bg.raised};border-top:1px solid ${c.border.strong};border-radius:16px 16px 0 0;display:flex;flex-direction:column;z-index:${Z.outliner + 10};outline:none;box-shadow:${ELEVATION.raised}}
.wl-sheet-grab{width:40px;height:4px;border-radius:2px;background:${c.border.strong};margin:${SPACE[4]}px auto 0;flex-shrink:0}
.wl-sheet-head{display:flex;align-items:center;gap:${SPACE[4]}px;padding:${SPACE[4]}px ${SPACE[6]}px 0}
.wl-sheet-head h3{margin:0;flex:1;font-size:${SIZE.xl}px;color:${c.text.primary};min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wl-sheet-body{overflow-y:auto;padding:${SPACE[4]}px ${SPACE[6]}px calc(${SPACE[8]}px + env(safe-area-inset-bottom));flex:1;min-height:0}
.wl-verb{width:100%;min-height:${TAP + 8}px;display:flex;align-items:center;gap:${SPACE[4]}px;padding:${SPACE[3]}px ${SPACE[4]}px;margin-bottom:${SPACE[3]}px;border-radius:${RADIUS.xl}px;border:1px solid ${c.border.strong};background:${c.bg.panel};color:${c.text.secondary};text-align:left;font:inherit;font-size:${SIZE.body}px}
.wl-verb[data-kind=alert]{border-color:${c.accent.alert}66}
.wl-verb[data-kind=warn]{border-color:${c.accent.warnDeep}}
.wl-verb[data-kind=good]{border-color:${c.accent.good}66}
.wl-verb:disabled{opacity:.45}
.wl-btn[aria-pressed=true]{border-color:${c.accent.command};color:${c.text.primary};background:rgba(59,130,246,.14)}
.wl-verb[aria-pressed=true]{border-color:${c.accent.command};background:rgba(59,130,246,.14)}
.wl-verb b{color:${c.text.primary};display:block}
.wl-verb small{display:block;color:${c.text.dim};font-size:${SIZE.caption}px;line-height:1.4}
.wl-verb .wl-verb-cost{margin-left:auto;font-weight:700;white-space:nowrap;color:${c.text.muted};font-size:${SIZE.small}px}
.wl-verb[data-kind=alert] .wl-verb-cost{color:${c.accent.alert}}
.wl-verb-opts{display:flex;flex-wrap:wrap;gap:${SPACE[2]}px;margin:-${SPACE[1]}px 0 ${SPACE[4]}px}
.wl-verb-opts button{min-height:36px;padding:0 ${SPACE[4]}px;border-radius:${RADIUS.md}px;border:1px solid ${c.border.strong};background:transparent;color:${c.text.muted};font-size:${SIZE.small}px}
.wl-verb-opts button[aria-pressed=true]{border-color:${c.accent.command};color:${c.text.primary};background:rgba(59,130,246,.14)}
.wl-nation-row{width:100%;min-height:${TAP}px;display:flex;align-items:center;gap:${SPACE[4]}px;border:none;border-bottom:1px solid ${c.border.base};background:transparent;color:${c.text.secondary};font:inherit;font-size:${SIZE.body}px;text-align:left;padding:${SPACE[2]}px 0}
.wl-nation-row b{color:${c.text.primary}}
.wl-nation-row .wl-chip{margin-left:auto}
.wl-why{max-height:var(--radix-popover-content-available-height);overflow-y:auto;z-index:${Z.modal - 1};width:min(92vw,360px);background:${c.bg.raised};border:1px solid ${c.accent.command};border-radius:${RADIUS.xxl}px;padding:${SPACE[5]}px ${SPACE[6]}px;box-shadow:${ELEVATION.raised};font-size:${SIZE.body}px;color:${c.text.secondary};animation:wl-fade-in ${MOTION.base} ${MOTION.ease};outline:none}
.wl-why h5{margin:0 0 ${SPACE[3]}px;font-size:${SIZE.caption}px;text-transform:uppercase;letter-spacing:1px;color:${c.accent.commandHi}}
.wl-why-row{display:flex;justify-content:space-between;gap:${SPACE[4]}px;padding:3px 0;border-bottom:1px solid ${c.border.base}}
.wl-why-row:last-of-type{border-bottom:none}
.wl-why-row span:last-child{font-weight:700;white-space:nowrap}
.wl-why-total{display:flex;justify-content:space-between;margin-top:${SPACE[3]}px;padding-top:${SPACE[3]}px;border-top:1px solid ${c.border.strong};color:${c.text.primary};font-weight:700}
.wl-why-note{margin-top:${SPACE[3]}px;font-size:${SIZE.caption}px;color:${c.text.dim}}
.wl-why-arrow{fill:${c.accent.command}}
.wl-pane-wrap{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.wl-seg{display:flex;gap:${SPACE[2]}px;padding:${SPACE[4]}px ${SPACE[6]}px 0;background:${c.bg.canvas};flex-shrink:0}
.wl-seg button{flex:1 1 0;min-width:0;min-height:${TAP}px;display:flex;align-items:center;justify-content:center;gap:${SPACE[2]}px;border:1px solid ${c.border.strong};border-radius:${RADIUS.lg}px;background:transparent;color:${c.text.muted};font:inherit;font-size:${SIZE.caption}px;font-weight:700;padding:0 2px;position:relative}
.wl-seg button[aria-selected=true]{background:rgba(59,130,246,.14);border-color:${c.accent.command};color:${c.text.primary}}
.wl-seg[data-cols='3']{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
.wl-stack{display:flex;flex-direction:column;gap:${SPACE[5]}px}
.wl-seg-l{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wl-seg-b{position:absolute;top:-6px;right:-3px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:${c.accent.warn};color:#000;font-size:${SIZE.micro}px;font-weight:800;display:inline-flex;align-items:center;justify-content:center}
.wl-seg-b[data-sev=alert]{background:${c.accent.alert};color:#fff}
.wl-tabroot{flex:1;overflow-y:auto;padding:${SPACE[6]}px;display:flex;flex-direction:column;gap:${SPACE[5]}px;min-width:0}
.wl-tabroot>*{flex-shrink:0}
.wl-r-stack{flex-wrap:wrap}
.wl-r-stack>.wl-btn,.wl-r-stack>span.wl-row{flex:1 1 100%}
.wl-p{padding:0;overflow:hidden}
.wl-p-head{width:100%;min-height:${TAP}px;display:flex;align-items:center;gap:${SPACE[4]}px;padding:${SPACE[2]}px ${SPACE[6]}px;border:none;background:transparent;color:inherit;font:inherit;text-align:left}
.wl-p-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wl-p-fig{font-size:${SIZE.lg}px;color:${c.text.primary};white-space:nowrap}
.wl-p-chev{color:${c.text.dim}}
.wl-p-body{padding:0 ${SPACE[6]}px ${SPACE[6]}px;display:flex;flex-direction:column}
[data-tone=good]{color:${c.accent.good}!important}
[data-tone=warn]{color:${c.accent.warn}!important}
[data-tone=alert]{color:${c.accent.alert}!important}
.wl-r{display:flex;align-items:center;gap:${SPACE[4]}px;min-height:${TAP}px;padding:${SPACE[2]}px 0;border-bottom:1px solid ${c.border.base};font-size:${SIZE.small}px;color:${c.text.secondary}}
.wl-r:last-child{border-bottom:none}
.wl-r-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.wl-r-main b{color:${c.text.primary};font-weight:600;font-size:${SIZE.body}px}
.wl-r-main small{color:${c.text.dim};font-size:${SIZE.caption}px;line-height:1.4}
.wl-r-v{font-weight:700;white-space:nowrap;color:${c.text.secondary}}
.wl-note{font-size:${SIZE.caption}px;color:${c.text.dim};line-height:1.5;margin-top:${SPACE[3]}px}
.wl-bar{position:relative;display:block;height:4px;background:${c.bg.inset};border-radius:2px;margin-top:3px;overflow:visible}
.wl-bar i{display:block;height:100%;background:${c.accent.command};border-radius:2px}
.wl-bar[data-tone=good] i{background:${c.accent.good}}
.wl-bar[data-tone=warn] i{background:${c.accent.warn}}
.wl-bar[data-tone=alert] i{background:${c.accent.alert}}
.wl-bar u{position:absolute;top:-3px;width:2px;height:10px;background:${c.text.primary};text-decoration:none}
.wl-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:${SPACE[3]}px}
.wl-lvl{min-height:${TAP + 8}px;border:1px solid ${c.border.strong};border-radius:${RADIUS.lg}px;background:transparent;color:${c.text.muted};font:inherit;font-size:${SIZE.body}px;font-weight:700;padding:${SPACE[2]}px;display:flex;flex-direction:column;align-items:center;justify-content:center}
.wl-lvl small{font-size:${SIZE.caption}px;font-weight:400;color:${c.text.dim}}
.wl-lvl[aria-pressed=true]{border-color:${c.accent.good};background:${c.accent.goodDeep};color:${c.text.primary}}
.wl-lvl:disabled{opacity:.45}
.wl-sel{min-height:${TAP}px;flex:1 1 120px;min-width:0;background:${c.bg.panel};color:${c.text.secondary};border:1px solid ${c.border.strong};border-radius:${RADIUS.lg}px;font:inherit;font-size:${SIZE.small}px;padding:0 ${SPACE[3]}px}
.wl-wy{background:none;border:none;color:inherit;font:inherit;font-weight:700;min-height:44px;padding:0 0 0 8px;text-decoration:underline dotted;text-underline-offset:3px;text-align:right}
.wl-slider{width:100%;height:${TAP}px;margin:0}
@media (min-width:${BREAK.tablet}px){
  .wl-app{grid-template-columns:76px minmax(0,1fr) 280px;grid-template-rows:auto auto minmax(0,1fr);grid-template-areas:"hud hud hud" "nav cards outliner" "nav main outliner"}
  .wl-nav{flex-direction:column;border-top:none;border-right:1px solid ${c.border.base};overflow-y:auto;padding-bottom:0}
  .wl-nav button,.wl-nav button[aria-current=page]{flex:0 0 auto;min-height:64px}
  .wl-nav button .wl-nav-l{display:block}
  .wl-sheet{left:auto;top:0;bottom:0;right:0;width:min(440px,100vw);max-height:none;border-top:none;border-left:1px solid ${c.border.strong};border-radius:0}
  .wl-sheet-grab{display:none}
  .wl-outliner{position:static;grid-area:outliner;height:auto!important;border-top:none;border-left:1px solid ${c.border.base};box-shadow:none;transition:none}
  .wl-outliner-handle::before{display:none}
  .wl-outliner[data-open=false] .wl-outliner-body{display:block}
  .wl-hud-figs{overflow:visible}
  .wl-hud-figs{grid-template-columns:repeat(3,minmax(0,220px))}
  .wl-fig{flex-direction:row;align-items:center;gap:${SPACE[3]}px}
}
`;
