// Design tokens: situation-room tactical (docs/DESIGN-SYSTEM.md). Dark-first, data-dense, legible at 390px.
// One source for three consumers: React inline styles (TOKENS.*), the PixiJS map (hex numbers via pixiHex),
// and the global stylesheet (TOKEN_CSS, custom properties --wl-*). Never hard-code a colour in src/ui again;
// P4 replaces v57's inline hexes tab by tab with these.

export const COLOR = {
  bg: {
    canvas: '#06090d',   // page background (shell.js body)
    surface: '#0a0e14',  // rails, vitals column, map chrome
    panel: '#0d1117',    // panels, cards, HUD
    raised: '#111827',   // modals, nested cards, region sheet
    inset: '#1f2937',    // chips, bars, inputs
    ocean: '#060b14',    // map ocean (gradient end); start is #0b1422
    oceanHi: '#0b1422',
  },
  border: { base: '#1f2937', strong: '#374151', focus: '#3b82f6' },
  text: { primary: '#f9fafb', secondary: '#d1d5db', muted: '#9ca3af', dim: '#6b7280', faint: '#4b5563', onAccent: '#ffffff' },
  accent: {
    command: '#3b82f6', commandHi: '#60a5fa', commandDeep: '#1d4ed8',
    good: '#4ade80', goodDeep: '#14532d',
    warn: '#f0c040', warnDeep: '#78350f',
    alert: '#ef4444',
    intel: '#a78bfa',
    energy: '#fbbf24',
    cyan: '#22d3ee', cyanDeep: '#06b6d4',
    nuclear: '#f472b6',
  },
  // Competitor affiliation (map choropleth). COMP_COLORS in src/data/regions.js stays the engine-facing copy.
  faction: { player: '#3b82f6', usa: '#22d3ee', russia: '#ef4444', china: '#eab308', germany: '#f97316', neutral: '#a78bfa' },
  choke: { secured: '#4ade80', escorted: '#60a5fa', open: '#9ca3af', disrupted: '#ef4444' },
  // Sequential ramps for the map modes (low -> high). Tension/intel read "hotter is worse"; trade/energy/military "more is brighter".
  ramp: {
    tension: ['#1f2937', '#4ade80', '#f0c040', '#f97316', '#ef4444'],
    trade: ['#1f2937', '#166534', '#22c55e', '#4ade80', '#bbf7d0'],
    energy: ['#1f2937', '#78350f', '#d97706', '#fbbf24', '#fde68a'],
    military: ['#1f2937', '#1e3a8a', '#1d4ed8', '#3b82f6', '#93c5fd'],
    intel: ['#1f2937', '#4c1d95', '#7c3aed', '#a78bfa', '#ddd6fe'],
  },
  scrim: 'rgba(4,7,12,.78)',
};

export const FONT = {
  sans: "'SF Pro Display',-apple-system,'Segoe UI',Roboto,'Helvetica Neue',sans-serif",
  display: 'Georgia,serif',
  mono: "ui-monospace,'SF Mono',Menlo,Consolas,monospace",
};

// Type scale in px. The v57 sizes, named. Body copy never drops below `small` on a phone.
export const SIZE = { micro: 9, caption: 10, small: 11, body: 12, md: 13, lg: 14, xl: 17, h2: 19, h1: 24, display: 42 };
export const WEIGHT = { regular: 400, medium: 600, bold: 700, heavy: 800, black: 900 };
export const LINE = { tight: 1.2, base: 1.5, loose: 1.7 };
export const TRACK = { label: '1px', wide: '2px', title: '3px', hero: '5px' };

export const SPACE = { 0: 0, 1: 2, 2: 4, 3: 6, 4: 8, 5: 10, 6: 12, 7: 14, 8: 16, 9: 20, 10: 24, 12: 36 };
export const RADIUS = { xs: 3, sm: 4, md: 5, lg: 6, xl: 8, xxl: 10, pill: 999 };
// Minimum tap target (ruling 8: one thumb at 390px). Buttons and list rows inherit it from .wl-tap.
export const TAP = 44;

export const ELEVATION = {
  flat: 'none',
  panel: '0 1px 0 rgba(0,0,0,.4)',
  raised: '0 4px 20px rgba(0,0,0,.7)',
  glow: '0 8px 32px rgba(59,130,246,.2)',
  landGlow: '0 1.5px 3px rgba(0,0,0,.55)',
  blur: '7px',
};

export const MOTION = {
  fast: '80ms', base: '150ms', slow: '220ms', drawer: '320ms',
  ease: 'cubic-bezier(.2,.8,.3,1)', pulse: '1.5s', dash: '1.1s',
};

// Stacking order. Map < panels < chrome < sheet < outliner < toast < modal < game over < victory.
export const Z = { map: 0, panel: 10, chrome: 100, sheet: 500, outliner: 600, toast: 999, modal: 1500, gameOver: 2000, victory: 2100 };

export const BREAK = { phone: 430, tablet: 900 };

export const TOKENS = { color: COLOR, font: FONT, size: SIZE, weight: WEIGHT, line: LINE, track: TRACK, space: SPACE, radius: RADIUS, tap: TAP, elevation: ELEVATION, motion: MOTION, z: Z, break: BREAK };

// '#3b82f6' -> 0x3b82f6 for PixiJS fills.
export const pixiHex = (hex) => parseInt(hex.slice(1, 7), 16);

// Flatten {a:{b:'x'}} -> [['a-b','x']] for CSS custom properties.
const flat = (obj, prefix = []) => Object.entries(obj).flatMap(([k, v]) =>
  (v && typeof v === 'object' && !Array.isArray(v)) ? flat(v, [...prefix, k]) : [[[...prefix, k].join('-'), Array.isArray(v) ? v.join(',') : String(v)]]);

export const TOKEN_VARS = Object.fromEntries(flat({ color: COLOR, font: FONT, size: SIZE, space: SPACE, radius: RADIUS, elevation: ELEVATION, motion: MOTION, z: Z }).map(([k, v]) => ['--wl-' + k, v]));

const px = (n) => (typeof n === 'number' ? n + 'px' : n);

// Global stylesheet: custom properties + the primitives every vertical shares. Injected once by installTheme().
export const TOKEN_CSS = `:root{${Object.entries(TOKEN_VARS).map(([k, v]) => `${k}:${/^(size|space|radius)-/.test(k.slice(5)) ? px(+v) : v}`).join(';')}}
html,body{height:100%;margin:0;background:${COLOR.bg.canvas};color:${COLOR.text.secondary};font-family:${FONT.sans};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
*{box-sizing:border-box}
::selection{background:rgba(59,130,246,.35)}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#2a3441;border-radius:3px}
button{font-family:inherit;cursor:pointer;transition:filter ${MOTION.base} ease,transform ${MOTION.fast} ease,background ${MOTION.base} ease,border-color ${MOTION.base} ease}
button:hover:not(:disabled){filter:brightness(1.18)}button:active:not(:disabled){transform:translateY(1px) scale(.985)}button:disabled{cursor:not-allowed}
:focus-visible{outline:2px solid ${COLOR.border.focus};outline-offset:2px;border-radius:${RADIUS.sm}px}
input[type=range]{cursor:pointer}
@keyframes wl-pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes wl-fade-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
@keyframes wl-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes wl-dash{to{stroke-dashoffset:-18}}
.wl-label{font-size:${SIZE.caption}px;color:${COLOR.text.dim};text-transform:uppercase;letter-spacing:${TRACK.label}}
.wl-num{font-variant-numeric:tabular-nums;font-weight:${WEIGHT.bold}}
.wl-panel{background:${COLOR.bg.panel};border:1px solid ${COLOR.border.base};border-radius:${RADIUS.xxl}px;padding:${SPACE[6]}px}
.wl-card{background:${COLOR.bg.raised};border:1px solid ${COLOR.border.base};border-radius:${RADIUS.xl}px;padding:${SPACE[6]}px}
.wl-chip{display:inline-flex;align-items:center;gap:${SPACE[2]}px;font-size:${SIZE.caption}px;padding:${SPACE[1]}px ${SPACE[4]}px;border-radius:${RADIUS.sm}px;border:1px solid ${COLOR.border.strong};background:rgba(0,0,0,.3);color:${COLOR.text.muted};white-space:nowrap}
.wl-chip-good{color:${COLOR.accent.good};border-color:${COLOR.accent.good};background:rgba(74,222,128,.1)}
.wl-chip-warn{color:${COLOR.accent.warn};border-color:${COLOR.accent.warnDeep};background:rgba(240,192,64,.08)}
.wl-chip-alert{color:${COLOR.accent.alert};border-color:${COLOR.accent.alert};background:rgba(239,68,68,.1)}
.wl-chip-command{color:${COLOR.accent.commandHi};border-color:${COLOR.accent.command};background:rgba(59,130,246,.12)}
.wl-btn{min-height:${TAP}px;min-width:${TAP}px;padding:${SPACE[4]}px ${SPACE[6]}px;border-radius:${RADIUS.lg}px;border:1px solid ${COLOR.border.strong};background:transparent;color:${COLOR.text.muted};font-size:${SIZE.body}px;font-weight:${WEIGHT.bold};display:inline-flex;align-items:center;justify-content:center;gap:${SPACE[3]}px}
.wl-btn-primary{background:${COLOR.accent.commandDeep};border-color:${COLOR.accent.command};color:${COLOR.text.onAccent}}
.wl-btn-good{background:${COLOR.accent.goodDeep};border-color:${COLOR.accent.good};color:${COLOR.accent.good}}
.wl-btn-alert{background:rgba(239,68,68,.1);border-color:${COLOR.accent.alert};color:${COLOR.accent.alert}}
.wl-btn-warn{background:rgba(240,192,64,.08);border-color:${COLOR.accent.warn};color:${COLOR.accent.warn}}
.wl-btn-sm{min-height:32px;min-width:32px;padding:${SPACE[2]}px ${SPACE[4]}px;font-size:${SIZE.small}px}
.wl-tap{min-height:${TAP}px}
.wl-row{display:flex;align-items:center;gap:${SPACE[4]}px}
.wl-scrim{position:fixed;inset:0;background:${COLOR.scrim};backdrop-filter:blur(${ELEVATION.blur});-webkit-backdrop-filter:blur(${ELEVATION.blur});display:flex;align-items:center;justify-content:center}
.wl-pulse{animation:wl-pulse ${MOTION.pulse} infinite}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
`;
