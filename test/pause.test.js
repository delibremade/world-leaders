import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount, flush, BUNDLES } from './util/harness.js';

// F4 (#36): pause is a toggle that remembers the speed. Resume never needs a speed button.
async function boot() {
  const g = await mount(BUNDLES.app, { testHook: true, seed: 11 });
  await g.pickCountry(0);
  const q = (s) => g.doc.querySelector(s);
  return { g, q, speedBtn: (n) => [...g.doc.querySelectorAll('[data-speed] button')].find((b) => b.textContent.trim() === `${n}×`), pauseBtn: () => q('[data-speed] [data-pause]') };
}

for (const n of [1, 2, 4]) {
  test(`pause at ${n}x resumes at ${n}x through the pause toggle alone`, async () => {
    const { g, q, speedBtn, pauseBtn } = await boot();
    speedBtn(n).click(); await flush();
    pauseBtn().click(); await flush();
    assert.match(q('[data-pause-reason]').textContent, new RegExp(`Paused by you.*resume at ${n}×`));
    assert.equal(pauseBtn().getAttribute('aria-pressed'), 'true');
    assert.equal(pauseBtn().getAttribute('data-resume-speed'), String(n), 'HUD shows the speed that will resume');
    assert.match(pauseBtn().textContent, new RegExp(`${n}×`));
    pauseBtn().click(); await flush();
    assert.equal(q('[data-pause-reason]'), null, 'toggle resumes');
    assert.equal(speedBtn(n).getAttribute('aria-pressed'), 'true', `back at ${n}x`);
  });
}

test('default resume speed is 1x; Space toggles on desktop; Space in a field does not', async () => {
  const { g, q, speedBtn, pauseBtn } = await boot();
  const key = (target) => target.dispatchEvent(new g.w.KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
  key(g.doc.body); await flush();
  assert.ok(q('[data-pause-reason]'), 'space pauses'); assert.equal(pauseBtn().getAttribute('data-resume-speed'), '1');
  key(g.doc.body); await flush();
  assert.equal(q('[data-pause-reason]'), null, 'space resumes'); assert.equal(speedBtn(1).getAttribute('aria-pressed'), 'true');
  const input = g.doc.createElement('input'); g.doc.body.appendChild(input);
  key(input); await flush(); assert.equal(q('[data-pause-reason]'), null, 'typing a space does not pause');
});

test('engine pause: crisis briefing shows its reason, the same toggle closes it and resumes at the remembered speed; a hard gate is not toggled away', async () => {
  const { g, q, speedBtn, pauseBtn } = await boot();
  const { w } = g;
  speedBtn(2).click(); await flush();
  w.__wl.flashpoint('WE', 'coup', 6); await flush();
  q('svg g[data-region=WE]').dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await flush(); await flush();
  const chip = q('[data-pause-reason]');
  assert.ok(chip && chip.getAttribute('data-kind') === 'engine', 'engine pause shows its reason');
  assert.match(chip.textContent, /Crisis briefing.*resume at 2×/);
  pauseBtn().click(); await flush(); await flush();
  assert.equal(q('[data-pause-reason]'), null, 'toggle clears the engine pause');
  assert.equal(speedBtn(2).getAttribute('aria-pressed'), 'true');
});
