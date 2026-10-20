// Design tokens v2: 2.5D situation room (docs/DESIGN-SYSTEM-V2.md, owner-approved 2026-10-20). Dark-first, data-dense,
// desktop-first (1440+), legible at 390px. One source for three consumers: React inline styles (TOKENS.*), the PixiJS
// map (hex numbers via pixiHex), and the global stylesheet (TOKEN_CSS, custom properties --wl-*).
// v1 keys (COLOR.bg/border/text/accent/faction/choke/ramp, SIZE, SPACE, ELEVATION.panel/raised/glow ...) are kept so
// every P3/P4 consumer keeps working; their values are now the v2 ones. New v2 groups: COLOR.system, SURFACE, ALERT,
// CONTROL, ELEVATION.L0..L3/well. Never hard-code a colour in src/ui; every hex is lowercase 6-digit.

export const COLOR = {
  bg: {
    canvas: '#05080f',      // L0 ground (page body)
    surface: '#070b14',     // L0 alt: rails, vitals column, map chrome
    panel: '#121c30',       // L1 top stop (solid fallback for panels, HUD; contrast is tested against this, the lighter stop)
    panelDeep: '#0c1424',   // L1 bottom stop
    raised: '#17233a',      // L2 top stop: focused panel, selected row, nested card
    raisedDeep: '#111a2c',  // L2 bottom stop
    card: '#1f3050',        // L3 top stop: command card, tooltip, confirm sheet
    cardDeep: '#152338',    // L3 bottom stop
    inset: '#0e1726',       // well top stop: numbers, inputs, bar tracks (inset, darker than the panel)
    insetDeep: '#0a111d',   // well bottom stop
    ocean: '#04101f',       // map ocean radial end
    oceanHi: '#0b2546',     // map ocean radial centre
  },
  border: { base: '#1c2a42', strong: '#2e3f5c', focus: '#4fb8ff' },
  // Five steps, same roles as v1: secondary is running copy, muted passes 4.5:1, dim (v2 "muted") is for key hints and labels of 11px+ only.
  text: { primary: '#e6edf7', secondary: '#c3cddc', muted: '#9aa8bf', dim: '#7c8aa3', faint: '#5b6880', onAccent: '#06111f' },
  accent: {
    command: '#4fb8ff', commandHi: '#8fdfff', commandDeep: '#1c4f7a',   // You / signal
    good: '#6ee7a8', goodDeep: '#0f2a1f',                                // Economy / gain
    warn: '#f5c451', warnDeep: '#33290f',                                // Chokepoint / lock / stage family
    alert: '#ff7a45', alertDeep: '#3a1c12',                              // Alert / escalation (always orange)
    intel: '#b49cff', intelDeep: '#261e42',                              // Brief / intel family
    energy: '#f5c451',
    cyan: '#4fd1c5', cyanDeep: '#1f5c57',                                // Technology
    nuclear: '#f472b6',                                                  // not in v2; the nuclear register keeps its own hue
  },
  // Each system owns one hue; reuse it on the map, the rail, alerts and cards (v2 §2).
  system: { you: '#4fb8ff', economy: '#6ee7a8', energy: '#f5c451', resources: '#e08a4f', trade: '#e9863f', arsenal: '#9db4d6', forces: '#8fa9c9', intel: '#b49cff', technology: '#4fd1c5', alert: '#ff7a45' },
  // Rival spheres (v2): colours that must be told apart also differ in lightness. COMP_COLORS in src/data/regions.js carries the same values for the map.
  faction: { player: '#4fb8ff', usa: '#22d3ee', russia: '#e5484d', china: '#e8b33a', germany: '#e9863f', neutral: '#b49cff' },
  choke: { secured: '#6ee7a8', escorted: '#4fb8ff', open: '#9aa8bf', disrupted: '#ff7a45', diamond: '#f5c451' },
  // Sequential ramps for the map modes (low -> high). Tension/intel read "hotter is worse"; trade/energy/military "more is brighter".
  ramp: {
    tension: ['#1c2a42', '#6ee7a8', '#f5c451', '#e9863f', '#ff7a45'],
    trade: ['#1c2a42', '#1f5a3f', '#3fb37a', '#6ee7a8', '#b8f5d6'],
    energy: ['#1c2a42', '#5a4310', '#b8902e', '#f5c451', '#fbe3a1'],
    military: ['#1c2a42', '#2e3f5c', '#5a7ba6', '#8fa9c9', '#c9d8ec'],
    intel: ['#1c2a42', '#3e2f73', '#7a5fd6', '#b49cff', '#ddd2ff'],
  },
  scrim: 'rgba(3,6,12,.78)',
};

// Elevation surfaces (v2 §2): depth ranks urgency. Inset wells hold numbers and inputs; raised surfaces hold actions.
export const SURFACE = {
  L0: COLOR.bg.canvas, L0b: COLOR.bg.surface,
  L1: `linear-gradient(180deg,${COLOR.bg.panel},${COLOR.bg.panelDeep})`,
  L2: `linear-gradient(180deg,${COLOR.bg.raised},${COLOR.bg.raisedDeep})`,
  L3: `linear-gradient(180deg,${COLOR.bg.card},${COLOR.bg.cardDeep})`,
  well: `linear-gradient(180deg,${COLOR.bg.inset},${COLOR.bg.insetDeep})`,
};

// Alert families (v2 §2): the kind reads before the text. Text / edge / fill per family.
export const ALERT = {
  situation: { text: '#ffb08a', edge: 'rgba(255,122,69,.45)', fill: 'linear-gradient(180deg,#3a1c12,#26130d)' },
  brief: { text: '#cdbbff', edge: 'rgba(180,156,255,.4)', fill: 'linear-gradient(180deg,#261e42,#19142d)' },
  chokepoint: { text: '#f5c451', edge: 'rgba(245,196,81,.45)', fill: 'linear-gradient(180deg,#33290f,#211b0a)' },
  good: { text: '#6ee7a8', edge: 'rgba(110,231,168,.35)', fill: '#0f2a1f' },
  signal: { text: '#8fdfff', edge: 'rgba(79,184,255,.45)', fill: 'linear-gradient(180deg,#14304a,#0e2238)' },
};

// Controls (v2 §2). Primary = commit, secondary = default, escalate = the orange family (always through the confirm sheet).
export const CONTROL = {
  primary: { bg: 'linear-gradient(180deg,#8fdfff,#4fb8e8)', fg: COLOR.text.onAccent, shadow: '0 6px 18px rgba(79,184,255,.35)', edge: 'rgba(143,223,255,.6)' },
  secondary: { bg: 'linear-gradient(180deg,#22324f,#172338)', fg: COLOR.text.primary, edge: 'rgba(255,255,255,.12)' },
  escalate: { bg: ALERT.situation.fill, fg: ALERT.situation.text, edge: ALERT.situation.edge },
  hover: 'brightness(1.15)',
  rowDesktop: 28,            // desktop rows may be 27 to 30px; touch targets stay TAP
  slider: { track: 6, thumb: 18 },
};

export const FONT = {
  display: "'Barlow Condensed','Barlow','Roboto Condensed','Arial Narrow',-apple-system,'Segoe UI',sans-serif", // 600/700, caps, tracked: display, labels, buttons
  sans: "Inter,'SF Pro Display',-apple-system,'Segoe UI',Roboto,'Helvetica Neue',sans-serif",                   // 400/500/600: prose
  mono: "'JetBrains Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace",                                       // 500/600: every number
};

// Type scale in px (v2: minimum text 12px; key hints 10 to 11px in text.dim only).
export const SIZE = { micro: 10, caption: 11, small: 12, body: 13, md: 14, lg: 15, xl: 18, h2: 20, h1: 24, display: 44 };
export const WEIGHT = { regular: 400, medium: 500, semibold: 600, bold: 700, heavy: 800, black: 900 };
export const LINE = { tight: 1.2, base: 1.5, loose: 1.7 };
// Tracking in em (v2: .04 to .16em on caps).
export const TRACK = { label: '.06em', wide: '.1em', title: '.14em', hero: '.16em' };

export const SPACE = { 0: 0, 1: 2, 2: 4, 3: 6, 4: 8, 5: 10, 6: 12, 7: 14, 8: 16, 9: 20, 10: 24, 12: 36 };
export const RADIUS = { xs: 3, sm: 4, md: 5, lg: 6, xl: 8, xxl: 10, pill: 999 };
// Minimum tap target (ruling 8: one thumb at 390px). Buttons and list rows inherit it from .wl-tap; desktop rows may be CONTROL.rowDesktop.
export const TAP = 44;

// Shadows per level (v2 §2). v1 names stay as aliases: panel = L1, raised = L3.
export const ELEVATION = {
  flat: 'none',
  L0: 'none',
  L1: 'inset 0 1px 0 rgba(255,255,255,.07), 0 18px 40px rgba(0,0,0,.55)',
  L2: 'inset 0 1px 0 rgba(255,255,255,.08), 0 22px 46px rgba(0,0,0,.6)',
  L3: 'inset 0 1px 0 rgba(255,255,255,.12), 0 24px 50px rgba(0,0,0,.7)',
  well: 'inset 0 2px 4px rgba(0,0,0,.6), 0 1px 0 rgba(255,255,255,.06)',
  panel: 'inset 0 1px 0 rgba(255,255,255,.07), 0 18px 40px rgba(0,0,0,.55)',
  raised: 'inset 0 1px 0 rgba(255,255,255,.12), 0 24px 50px rgba(0,0,0,.7)',
  glow: '0 8px 32px rgba(79,184,255,.25)',
  landGlow: '0 0 6px rgba(127,216,255,.55)',
  blur: '7px',
};

// Motion (v2 §4): panels rise 16px over 280ms; markers bob 3px; pulses on live flashpoints only.
export const MOTION = {
  fast: '80ms', base: '150ms', slow: '220ms', rise: '280ms', drawer: '320ms',
  ease: 'cubic-bezier(.2,.8,.3,1)', pulse: '1.5s', dash: '1.1s', bob: '2.4s',
};

// Stacking order. Map < panels < chrome < sheet < outliner < toast < modal < game over < victory.
export const Z = { map: 0, panel: 10, chrome: 100, card: 400, sheet: 500, outliner: 600, toast: 999, modal: 1500, gameOver: 2000, victory: 2100 };

export const BREAK = { phone: 430, tablet: 900, desktop: 1100 };

export const TOKENS = { color: COLOR, surface: SURFACE, alert: ALERT, control: CONTROL, font: FONT, size: SIZE, weight: WEIGHT, line: LINE, track: TRACK, space: SPACE, radius: RADIUS, tap: TAP, elevation: ELEVATION, motion: MOTION, z: Z, break: BREAK };

// '#4fb8ff' -> 0x4fb8ff for PixiJS fills.
export const pixiHex = (hex) => parseInt(hex.slice(1, 7), 16);

// Flatten {a:{b:'x'}} -> [['a-b','x']] for CSS custom properties.
const flat = (obj, prefix = []) => Object.entries(obj).flatMap(([k, v]) =>
  (v && typeof v === 'object' && !Array.isArray(v)) ? flat(v, [...prefix, k]) : [[[...prefix, k].join('-'), Array.isArray(v) ? v.join(',') : String(v)]]);

export const TOKEN_VARS = Object.fromEntries(flat({ color: COLOR, surface: SURFACE, alert: ALERT, control: CONTROL, font: FONT, size: SIZE, space: SPACE, radius: RADIUS, elevation: ELEVATION, motion: MOTION, z: Z }).map(([k, v]) => ['--wl-' + k, v]));

const px = (n) => (typeof n === 'number' ? n + 'px' : n);
const caps = `font-family:${FONT.display};font-weight:${WEIGHT.semibold};text-transform:uppercase;letter-spacing:${TRACK.label}`;
const family = (f) => `color:${f.text};border-color:${f.edge};background:${f.fill}`;

// Global stylesheet: custom properties + the primitives every vertical shares. Injected once by installTheme().
export const TOKEN_CSS = `:root{${Object.entries(TOKEN_VARS).map(([k, v]) => `${k}:${/^(size|space|radius)-/.test(k.slice(5)) ? px(+v) : v}`).join(';')}}
html,body{height:100%;margin:0;background:${COLOR.bg.canvas};color:${COLOR.text.secondary};font-family:${FONT.sans};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
*{box-sizing:border-box}
::selection{background:rgba(79,184,255,.35)}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${COLOR.border.strong};border-radius:3px}
button{font-family:inherit;cursor:pointer;transition:filter ${MOTION.base} ease,transform ${MOTION.fast} ease,background ${MOTION.base} ease,border-color ${MOTION.base} ease}
button:hover:not(:disabled){filter:${CONTROL.hover}}button:active:not(:disabled){transform:translateY(1px) scale(.985)}button:disabled{cursor:not-allowed}
:focus-visible{outline:2px solid ${COLOR.border.focus};outline-offset:2px;border-radius:${RADIUS.sm}px}
input[type=range]{cursor:pointer;-webkit-appearance:none;appearance:none;background:transparent}
input[type=range]::-webkit-slider-runnable-track{height:${CONTROL.slider.track}px;border-radius:${CONTROL.slider.track}px;background:${SURFACE.well};box-shadow:${ELEVATION.well}}
input[type=range]::-moz-range-track{height:${CONTROL.slider.track}px;border-radius:${CONTROL.slider.track}px;background:${SURFACE.well};box-shadow:${ELEVATION.well}}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:${CONTROL.slider.thumb}px;height:${CONTROL.slider.thumb}px;margin-top:${(CONTROL.slider.track - CONTROL.slider.thumb) / 2}px;border-radius:50%;background:${CONTROL.primary.bg};border:1px solid ${CONTROL.primary.edge};box-shadow:0 2px 6px rgba(0,0,0,.6)}
input[type=range]::-moz-range-thumb{width:${CONTROL.slider.thumb}px;height:${CONTROL.slider.thumb}px;border-radius:50%;background:${CONTROL.primary.bg};border:1px solid ${CONTROL.primary.edge};box-shadow:0 2px 6px rgba(0,0,0,.6)}
@keyframes wl-pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes wl-fade-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
@keyframes wl-rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes wl-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes wl-dash{to{stroke-dashoffset:-18}}
.wl-label{${caps};font-size:${SIZE.caption}px;color:${COLOR.text.dim}}
.wl-num{font-family:${FONT.mono};font-variant-numeric:tabular-nums;font-weight:${WEIGHT.semibold}}
.wl-display{font-family:${FONT.display};font-weight:${WEIGHT.bold};text-transform:uppercase;letter-spacing:${TRACK.wide}}
.wl-panel{background:${SURFACE.L1};box-shadow:${ELEVATION.L1};border:1px solid ${COLOR.border.base};border-radius:${RADIUS.xxl}px;padding:${SPACE[6]}px}
.wl-card{background:${SURFACE.L2};box-shadow:${ELEVATION.L2};border:1px solid ${COLOR.border.base};border-radius:${RADIUS.xl}px;padding:${SPACE[6]}px}
.wl-l2{background:${SURFACE.L2}!important;box-shadow:${ELEVATION.L2}}
.wl-l3{background:${SURFACE.L3};box-shadow:${ELEVATION.L3};border:1px solid ${COLOR.border.strong};border-radius:${RADIUS.xxl}px}
.wl-well{background:${SURFACE.well};box-shadow:${ELEVATION.well};border-radius:${RADIUS.lg}px;padding:${SPACE[2]}px ${SPACE[4]}px;font-family:${FONT.mono};font-variant-numeric:tabular-nums}
.wl-chip{display:inline-flex;align-items:center;gap:${SPACE[2]}px;${caps};font-size:${SIZE.caption}px;padding:${SPACE[1]}px ${SPACE[4]}px;border-radius:${RADIUS.sm}px;border:1px solid ${COLOR.border.strong};background:rgba(0,0,0,.3);color:${COLOR.text.muted};white-space:nowrap}
.wl-chip-good{${family(ALERT.good)}}
.wl-chip-warn{${family(ALERT.chokepoint)}}
.wl-chip-alert{${family(ALERT.situation)}}
.wl-chip-intel{${family(ALERT.brief)}}
.wl-chip-command{${family(ALERT.signal)}}
.wl-btn{min-height:${TAP}px;min-width:${TAP}px;padding:${SPACE[4]}px ${SPACE[6]}px;border-radius:${RADIUS.lg}px;border:1px solid ${CONTROL.secondary.edge};background:${CONTROL.secondary.bg};color:${CONTROL.secondary.fg};${caps};font-size:${SIZE.body}px;display:inline-flex;align-items:center;justify-content:center;gap:${SPACE[3]}px;box-shadow:0 1px 0 rgba(0,0,0,.4)}
.wl-btn-primary{background:${CONTROL.primary.bg};border-color:${CONTROL.primary.edge};color:${CONTROL.primary.fg};box-shadow:${CONTROL.primary.shadow}}
.wl-btn-good{${family(ALERT.good)}}
.wl-btn-alert{${family(ALERT.situation)}}
.wl-btn-warn{${family(ALERT.chokepoint)}}
.wl-btn-sm{min-height:32px;min-width:32px;padding:${SPACE[2]}px ${SPACE[4]}px;font-size:${SIZE.small}px}
.wl-tap{min-height:${TAP}px}
.wl-row{display:flex;align-items:center;gap:${SPACE[4]}px}
.wl-scrim{position:fixed;inset:0;background:${COLOR.scrim};backdrop-filter:blur(${ELEVATION.blur});-webkit-backdrop-filter:blur(${ELEVATION.blur});display:flex;align-items:center;justify-content:center}
.wl-pulse{animation:wl-pulse ${MOTION.pulse} infinite}
.wl-rise{animation:wl-rise ${MOTION.rise} ${MOTION.ease}}
kbd.wl-key{font-family:${FONT.mono};font-size:${SIZE.micro}px;color:${COLOR.text.dim};border:1px solid ${COLOR.border.strong};border-radius:3px;padding:0 4px;background:rgba(0,0,0,.3)}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
`;
