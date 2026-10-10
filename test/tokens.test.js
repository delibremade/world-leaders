import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COLOR, SIZE, SPACE, TAP, Z, TOKEN_CSS, TOKEN_VARS, pixiHex } from '../src/ui/tokens.js';
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
  assert.equal(pixiHex('#3b82f6'), 0x3b82f6);
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
  assert.ok(TOKEN_CSS.includes('--wl-size-body:12px'), 'px units on sizes');
  for (const cls of ['.wl-panel', '.wl-card', '.wl-chip', '.wl-btn', '.wl-btn-primary', '.wl-label', '.wl-num', '.wl-scrim', '.wl-tap']) assert.ok(TOKEN_CSS.includes(cls + '{'), cls);
  assert.match(TOKEN_CSS, /\.wl-btn\{min-height:44px/);
  assert.match(TOKEN_CSS, /prefers-reduced-motion/);
  assert.equal((TOKEN_CSS.match(/^(\.|@|:|html|\*|button|input)/gm) || []).length > 20, true);
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
    assert.ok(styles[0].textContent.includes('--wl-color-accent-command:#3b82f6'));
    assert.equal(installTheme(g.doc), false, 'second install is a no-op');
    assert.match(g.text(), new RegExp(`COMMAND TERMINAL · BUILD v${VERSION.replace(/\./g, '\\.')} ◂`));
    assert.doesNotMatch(g.text(), /BUILD v57/);
    await g.pickCountry(0);
    assert.match(g.text(), new RegExp(`v${VERSION.replace(/\./g, '\\.')}`), 'HUD chip');
  } finally { console.error = origErr; g.close(); }
});
