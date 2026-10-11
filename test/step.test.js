import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount, flush, BUNDLES } from './util/harness.js';
import { MONTH_PHASES } from '../src/sim/tick.js';
import { MONTHLY_SYSTEMS } from '../src/sim/systems.js';
import { tick } from '../src/sim/tick.js';
import { newGame } from '../src/sim/state.js';
import { makeRng } from '../src/sim/rng.js';
import { clockPlan } from '../src/ui/shell/clock.js';

// Q2 (#42): Next steps one month while the clock is stopped; an open sheet or confirm stops the clock with a named
// reason and closing it resumes the remembered speed; per-class pause rules (Q1) stop it too.

const PHASE_IDS = MONTH_PHASES.map((p) => p.id);
async function boot() {
  const g = await mount(BUNDLES.app, { testHook: true, seed: 31 });
  await g.pickCountry(0);
  const q = (s) => g.doc.querySelector(s);
  const settle = async () => { await flush(); await flush(); };
  const speed = async (n) => { [...g.doc.querySelectorAll('[data-speed] button')].find((b) => b.textContent.trim() === `${n}×`).click(); await settle(); };
  const when = () => q('.wl-hud-nation small').textContent.match(/[A-Z]{3} \d{4}/i)[0];
  const next = async () => { q('[data-step]').click(); await settle(); };
  return { g, q, settle, speed, when, next, pause: async () => { q('[data-speed] [data-pause]').click(); await settle(); } };
}

test('clockPlan: precedence of reasons, run vs step, and Next is refused only under a hard gate', () => {
  assert.deepEqual(clockPlan({}), { mode: 'run', running: true, reason: null, canStep: true });
  assert.equal(clockPlan({ inPlay: false }).mode, 'step');
  assert.equal(clockPlan({ held: { sheet: 1 } }).reason.label, 'Paused: sheet open');
  assert.equal(clockPlan({ held: { sheet: 1, confirm: 1 } }).reason.label, 'Paused: confirm open', 'confirm outranks sheet');
  assert.equal(clockPlan({ paused: true, held: { sheet: 1 } }).reason.label, 'Paused by you', 'your pause outranks a sheet');
  assert.equal(clockPlan({ paused: true, pauseWhy: 'Intelligence notice' }).reason.label, 'Paused: Intelligence notice');
  assert.equal(clockPlan({ crisisBrief: true, held: { sheet: 1 } }).reason.label, 'Crisis briefing');
  for (const k of ['ultimatum', 'confrontation', 'intelCrisis', 'gameOver', 'victory']) { const p = clockPlan({ hard: { [k]: true }, held: { sheet: 1 } }); assert.equal(p.mode, 'step', k); assert.equal(p.canStep, false, `${k}: Next refused`); assert.equal(p.reason.kind, 'engine'); }
  assert.equal(clockPlan({ held: { sheet: 1 } }).canStep, true); assert.equal(clockPlan({ crisisBrief: true }).canStep, true);
});

test('headless: stepping one tick at a time never skips a monthly system (lastRun stamped every month, 36 months)', () => {
  const rng = makeRng(5); let s = newGame({ seed: 5, player: 'usa' });
  for (let m = 1; m <= 36; m++) {
    s = tick(s, [], rng);
    for (const sys of MONTHLY_SYSTEMS) assert.equal(s.systems.lastRun[sys.id], m, `${sys.id} at month ${m}`);
  }
});

for (const n of [1, 2, 4]) {
  test(`Next at ${n}x advances exactly one month per tap, runs every monthly phase once, and keeps the speed`, async () => {
    const { g, q, speed, when, next, pause } = await boot();
    await speed(n); await pause();
    assert.equal(q('[data-step]').getAttribute('aria-disabled'), null, 'Next is live while paused');
    const m0 = when(), p0 = g.w.__wl.phases().length;
    await next();
    assert.notEqual(when(), m0, 'a month passed');
    assert.deepEqual(Array.from(g.w.__wl.phases().slice(p0)), PHASE_IDS, 'every phase ran once, in order');
    await next(); await next();
    assert.equal(g.w.__wl.phases().length - p0, 3 * PHASE_IDS.length, 'three taps, three months, no phase skipped or doubled');
    assert.ok(q('[data-pause-reason]'), 'still paused after stepping');
    assert.equal(q('[data-speed] [data-pause]').getAttribute('data-resume-speed'), String(n), 'remembered speed untouched');
    q('[data-speed] [data-pause]').click(); await flush(); await flush();
    assert.equal(q('[data-pause-reason]'), null); assert.equal([...g.doc.querySelectorAll('[data-speed] button')].find((b) => b.textContent.trim() === `${n}×`).getAttribute('aria-pressed'), 'true', `resumed at ${n}x`);
  });
}

test('Next is disabled while the clock runs and does nothing', async () => {
  const { g, q, when, settle } = await boot();
  assert.equal(q('[data-step]').getAttribute('aria-disabled'), 'true'); const m0 = when(), p0 = g.w.__wl.phases().length;
  q('[data-step]').click(); await settle(); assert.equal(when(), m0); assert.equal(g.w.__wl.phases().length, p0);
});

for (const n of [1, 2, 4]) {
  test(`opening a sheet at ${n}x stops the clock ("Paused: sheet open"); closing resumes at ${n}x`, async () => {
    const { g, q, settle, speed } = await boot();
    await speed(n);
    assert.equal(await g.advance(1), 1, 'runs before the sheet');
    g.w.__wl.region('NA'); await settle(); await settle();
    assert.ok(q('[data-sheet]'), 'sheet open');
    assert.match(q('[data-pause-reason]').textContent, new RegExp(`Paused: sheet open.*resume at ${n}×`));
    assert.equal(await g.advance(1), 0, 'no month passes while the sheet is open');
    assert.equal(q('[data-step]').getAttribute('aria-disabled'), null, 'Next works with a sheet open');
    q('[data-sheet-close]').click(); await settle(); await settle(); await settle();
    assert.equal(q('[data-pause-reason]'), null, 'closing resumes');
    assert.equal([...g.doc.querySelectorAll('[data-speed] button')].find((b) => b.textContent.trim() === `${n}×`).getAttribute('aria-pressed'), 'true');
    assert.equal(await g.advance(1), 1, 'clock runs again');
  });
}

test('a confirm sheet stops the clock with its own reason and closing it resumes', async () => {
  const { g, q, settle } = await boot();
  g.w.__wl.confirm({ title: 'Test act', lines: ['Cost and consequence'], label: 'Do it', run() {} }); await settle(); await settle();
  assert.match(q('[data-pause-reason]').textContent, /Paused: confirm open/); assert.equal(await g.advance(1), 0);
  q('[data-confirm-cancel]').click(); await settle(); await settle(); await settle();
  assert.equal(q('[data-pause-reason]'), null); assert.equal(await g.advance(1), 1);
});

test('a per-class pause rule stops the clock; Next still steps and the pause stays', async () => {
  const { g, q, settle, when, next } = await boot();
  q('[data-bell]').click(); await settle(); await settle();
  q('[data-feed-tab=routing]').click(); await settle(); q('[data-route-class=intel] [data-route=pause]').click(); await settle();
  q('[data-sheet-close]').click(); await settle(); await settle(); await settle();
  g.w.__wl.phase('intelOps'); g.w.__wl.notify('🕵️ Asset placed'); g.w.__wl.phase(null); await settle();
  assert.match(q('[data-pause-reason]').textContent, /Paused: Intelligence notice/); assert.equal(await g.advance(1), 0);
  const m0 = when(); await next(); assert.notEqual(when(), m0); assert.match(q('[data-pause-reason]').textContent, /Paused: Intelligence notice/, 'still paused after the step');
});
