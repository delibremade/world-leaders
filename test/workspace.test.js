import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount, flush, BUNDLES } from './util/harness.js';
import { clockPlan } from '../src/ui/shell/clock.js';

test('doctrine selection holds the clock and blocks a manual month', () => {
  const p = clockPlan({ hard: { doctrine: true } });
  assert.equal(p.running, false);
  assert.equal(p.canStep, false);
  assert.equal(p.reason.label, 'Choose your doctrine');
});

test('national overview, project queue and energy routes open the working management panels', async () => {
  const g = await mount(BUNDLES.app, { testHook: true, seed: 5 });
  try {
    await g.pickCountry(0);
    const q = s => g.doc.querySelector(s);
    const click = async s => { assert.ok(q(s), s); q(s).click(); await flush(); await flush(); };
    assert.match(q('[data-pause-reason]').textContent, /Choose your doctrine/);
    assert.equal(q('[data-step]').getAttribute('aria-disabled'), 'true');
    await click('[data-event-card=doctrine] .wl-opt');
    assert.ok(q('[data-national-pulse]'));
    await click('[data-queue=research]');
    assert.equal(q('[data-tab=technology]').getAttribute('aria-current'), 'page');
    await click('[data-tab=overview]');
    g.w.__wl.ops([
      {id:'later',opId:'tech_acq',targetId:'china',monthsLeft:3,successRate:.6,discoverRate:.2},
      {id:'next',opId:'tech_acq',targetId:'russia',monthsLeft:1,successRate:.6,discoverRate:.2},
    ]);
    await flush(); await flush();
    assert.match(q('[data-queue=ops]').textContent, /2 active.*Russia.*1 month remaining/);
    await click('[data-queue=ops]');
    assert.equal(q('[data-op-row=next]').getAttribute('data-focus'), 'true', 'queue opens the next operation detail');
    await click('[data-tab=overview]');
    await click('[data-pulse=economy]');
    assert.ok(q('[data-sentinel=economy] [data-sector-budgets]'));
    await click('[data-budget-line=defense]');
    assert.ok(q('[data-command-card=budget]'));
    const health = +q('[data-sector=healthcare]').value;
    await click('[data-lock=healthcare]');
    await click('[data-command-card=budget] [data-cmd=raise]');
    assert.equal(+q('[data-sector=healthcare]').value, health, 'budget commands preserve locked lines');
    assert.ok(+q('[data-sector=education]').value < 100, 'raising a line through the command card squeezes the held pool');
    await click('[data-tab=energy]');
    assert.ok(q('[data-energy-summary]'));
    await click('.wl-energy-metrics button:first-child');
    assert.equal(q('[data-tab=resources]').getAttribute('aria-current'), 'page');
    assert.equal(q('[data-seg=natural]').getAttribute('aria-selected'), 'true');
    await click('[data-tab=energy]');
    await click('[data-energy-map]');
    assert.equal(q('[data-map]').dataset.mapMode, 'energy');
    assert.equal(g.faulted(), false);
  } finally { g.close(); }
});
