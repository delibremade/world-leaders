import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COLOR, SIZE, SPACE, TAP, Z, TOKEN_CSS, TOKEN_VARS, pixiHex, SURFACE, ALERT, CONTROL, ELEVATION, FONT } from '../src/ui/tokens.js';
import { installTheme, THEME_STYLE_ID } from '../src/ui/theme.js';
import { VERSION, BUILD_STAMP } from '../src/ui/version.js';
import { mount, BUNDLES } from './util/harness.js';

// Design-system gate (docs/DESIGN-SYSTEM.md): tokens are well-formed, text meets WCAG contrast on the panel
// background, the stylesheet carries every token as a custom property, and the App installs it once.

const HEX = /^#[0-9a-f]{6}$/;
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('tokens: every colour is a 6-digit hex; ramps have 5 stops; scales are ascending', () => {
  const walk = (o, path = []) => Object.entries(o).forEach(([k, v]) => {
    if (Array.isArray(v)) { assert.equal(v.length, 5, `${path.join('.')}.${k} ramp`); v.forEach((h) => assert.match(h, HEX)); }
    else if (typeof v === 'object') walk(v, [...path, k]);
    else if (k !== 'scrim') assert.match(v, HEX, `${[...path, k].join('.')}`);
  });
  walk(COLOR);
  const asc = (o) => Object.values(o).every((v, i, a) => i === 0 || v > a[i - 1]);
  assert.ok(asc(SIZE), 'type scale ascending'); assert.ok(asc(SPACE), 'spacing ascending');
  assert.equal(TAP, 44);
  assert.ok(Z.map < Z.chrome && Z.chrome < Z.sheet && Z.sheet < Z.toast && Z.toast < Z.modal && Z.modal < Z.victory, 'z-order');
  assert.equal(pixiHex('#4fb8ff'), 0x4fb8ff);
});

test('tokens: text contrast on bg.panel meets WCAG AA (4.5 primary/secondary/muted, 3.0 dim and accents)', () => {
  const bg = COLOR.bg.panel;
  for (const k of ['primary', 'secondary', 'muted']) assert.ok(contrast(COLOR.text[k], bg) >= 4.5, `text.${k} ${contrast(COLOR.text[k], bg).toFixed(2)}`);
  assert.ok(contrast(COLOR.text.dim, bg) >= 3, 'text.dim');
  for (const k of ['command', 'commandHi', 'good', 'warn', 'alert', 'intel', 'energy', 'cyan', 'nuclear']) {
    assert.ok(contrast(COLOR.accent[k], bg) >= 3, `accent.${k} ${contrast(COLOR.accent[k], bg).toFixed(2)}`);
  }
  for (const [k, v] of Object.entries(COLOR.faction)) assert.ok(contrast(v, COLOR.bg.ocean) >= 3, `faction.${k} on ocean`);
});

test('stylesheet: every token is a --wl-* custom property; primitives and reduced-motion rule present', () => {
  assert.ok(Object.keys(TOKEN_VARS).length > 80);
  for (const k of Object.keys(TOKEN_VARS)) assert.ok(TOKEN_CSS.includes(k + ':'), `missing ${k}`);
  assert.ok(TOKEN_CSS.includes('--wl-size-small:12px'), 'px units on sizes');
  for (const cls of ['.wl-panel', '.wl-card', '.wl-chip', '.wl-btn', '.wl-btn-primary', '.wl-label', '.wl-num', '.wl-scrim', '.wl-tap', '.wl-well', '.wl-l3', '.wl-chip-intel', '.wl-rise']) assert.ok(TOKEN_CSS.includes(cls + '{'), cls);
  assert.match(TOKEN_CSS, /\.wl-btn\{min-height:44px/);
  assert.match(TOKEN_CSS, /prefers-reduced-motion/);
  assert.equal((TOKEN_CSS.match(/^(\.|@|:|html|\*|button|input)/gm) || []).length > 20, true);
});

// v2 (docs/DESIGN-SYSTEM-V2.md): elevation L0-L3 and wells, one hue per system, alert families, type and controls.
test('tokens v2: elevation levels and wells, system colours, alert families, type stack, controls; v1 aliases still resolve', () => {
  for (const k of ['L1', 'L2', 'L3', 'well']) { assert.match(SURFACE[k], /^linear-gradient\(180deg,#[0-9a-f]{6},#[0-9a-f]{6}\)$/, `surface ${k}`); assert.match(ELEVATION[k], /rgba\(0,0,0,\.\d+\)/, `shadow ${k}`); }
  assert.equal(SURFACE.L0, COLOR.bg.canvas); assert.equal(ELEVATION.panel, ELEVATION.L1); assert.equal(ELEVATION.raised, ELEVATION.L3);
  assert.deepEqual(Object.keys(COLOR.system), ['you', 'economy', 'energy', 'resources', 'trade', 'arsenal', 'forces', 'intel', 'technology', 'alert']);
  assert.equal(COLOR.system.you, COLOR.accent.command); assert.equal(COLOR.system.alert, COLOR.accent.alert); assert.equal(COLOR.system.energy, COLOR.accent.energy);
  assert.equal(COLOR.faction.player, COLOR.system.you); assert.equal(COLOR.faction.russia, '#e5484d'); assert.equal(COLOR.faction.china, '#e8b33a');
  for (const k of ['situation', 'brief', 'chokepoint', 'good', 'signal']) { const f = ALERT[k]; assert.match(f.text, HEX, `${k}.text`); assert.match(f.edge, /^rgba\(/, `${k}.edge`); assert.ok(f.fill.startsWith('linear-gradient') || HEX.test(f.fill), `${k}.fill`); assert.ok(contrast(f.text, COLOR.bg.panel) >= 4.5, `${k}.text on panel`); }
  assert.equal(ALERT.situation.text, '#ffb08a'); assert.equal(ALERT.chokepoint.text, COLOR.accent.warn); assert.equal(ALERT.good.text, COLOR.accent.good);
  assert.match(FONT.display, /Barlow Condensed/); assert.match(FONT.sans, /^Inter/); assert.match(FONT.mono, /JetBrains Mono/);
  assert.ok(SIZE.small >= 12, 'minimum text 12px'); assert.ok(SIZE.micro >= 10 && SIZE.caption <= 11, 'key hints 10 to 11px');
  assert.match(CONTROL.primary.bg, /^linear-gradient\(180deg,#8fdfff,#4fb8e8\)$/); assert.equal(CONTROL.primary.fg, COLOR.text.onAccent); assert.ok(contrast(CONTROL.primary.fg, '#4fb8e8') >= 4.5, 'dark text on the primary control');
  assert.match(CONTROL.secondary.bg, /^linear-gradient\(180deg,#22324f,#172338\)$/); assert.equal(CONTROL.escalate.fg, ALERT.situation.text, 'escalate is the orange family');
  assert.equal(CONTROL.hover, 'brightness(1.15)'); assert.equal(CONTROL.slider.track, 6); assert.ok(CONTROL.slider.thumb >= 18 && CONTROL.slider.thumb <= 20);
  // the stylesheet consumes them: wells, chips per family, the escalate button, sliders
  assert.ok(TOKEN_CSS.includes(`.wl-well{background:${SURFACE.well};box-shadow:${ELEVATION.well}`), 'well class');
  assert.ok(TOKEN_CSS.includes(`.wl-chip-alert{color:${ALERT.situation.text}`) && TOKEN_CSS.includes(`.wl-btn-alert{color:${ALERT.situation.text}`), 'alert chip and button are the situation family');
  assert.ok(TOKEN_CSS.includes(`.wl-btn-primary{background:${CONTROL.primary.bg}`), 'primary button');
  assert.ok(TOKEN_CSS.includes(`input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:${CONTROL.slider.thumb}px`), 'slider thumb');
  assert.ok(TOKEN_CSS.includes('button:hover:not(:disabled){filter:brightness(1.15)}'), 'hover');
  for (const k of ['--wl-surface-L1', '--wl-alert-situation-text', '--wl-control-primary-bg', '--wl-color-system-forces']) assert.ok(TOKEN_VARS[k], k);
});

test('version: BUILD_STAMP reads package.json', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(VERSION, pkg.version);
  assert.equal(BUILD_STAMP, `BUILD v${pkg.version}`);
});

test('App: installs the theme once; title screen stamps the package version instead of v57', async () => {
  const origErr = console.error; console.error = () => {};
  const g = await mount(BUNDLES.app);
  try {
    const styles = g.doc.querySelectorAll('#' + THEME_STYLE_ID);
    assert.equal(styles.length, 1, 'theme style installed once');
    assert.ok(styles[0].textContent.includes('--wl-color-accent-command:#4fb8ff'));
    assert.equal(installTheme(g.doc), false, 'second install is a no-op');
    assert.match(g.text(), new RegExp(`COMMAND TERMINAL · BUILD v${VERSION.replace(/\./g, '\\.')} ◂`));
    assert.doesNotMatch(g.text(), /BUILD v57/);
    await g.pickCountry(0);
    assert.match(g.text(), new RegExp(`v${VERSION.replace(/\./g, '\\.')}`), 'HUD chip');
  } finally { console.error = origErr; g.close(); }
});
