import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount, flush, BUNDLES } from './util/harness.js';

test('required doctrine choice has its own dialog and four native buttons, outside the activity rail', async () => {
  const g = await mount(BUNDLES.app, { testHook: true });
  try {
    await g.pickCountry(0);
    const dialog = g.doc.querySelector('[data-decision-dialog]');
    assert.ok(dialog);
    assert.equal(dialog.getAttribute('aria-modal'), 'true');
    assert.equal(dialog.closest('[data-event-cards]'), null);
    assert.equal(dialog.querySelectorAll('button[data-doctrine]').length, 4);
    assert.equal(g.doc.querySelector('[data-step]').getAttribute('aria-disabled'), 'true');
    dialog.querySelector('[data-doctrine=shadow]').click(); await flush(); await flush();
    assert.equal(g.doc.querySelector('[data-decision-dialog]'), null);
    assert.match(g.doc.querySelector('.wl-hud-nation').textContent, /Shadow Power/);
    assert.ok(g.w.__wl.dispatched().includes('chooseDoctrine'));
  } finally { g.close(); }
});

test('a cramped event card opens in a full decision dialog; the clock holds and responding uses its existing verb', async () => {
  const g = await mount(BUNDLES.app, { testHook: true });
  try {
    await g.pickCountry(0); g.doc.querySelector('[data-doctrine=fortress]').click(); await flush();
    g.w.__wl.event('panama_drought', 6); await flush(); await flush();
    g.doc.querySelector('[data-review-card=we]').click(); await flush(); await flush();
    const dialog = g.doc.querySelector('[data-decision-dialog]');
    assert.match(dialog.textContent, /Panama Drought/);
    assert.ok(dialog.querySelectorAll('[data-response]').length >= 3);
    assert.match(g.doc.querySelector('[data-pause-reason]').textContent, /sheet open/);
    dialog.querySelector('[data-response][aria-disabled=false]').click(); await flush(); await flush();
    assert.equal(g.doc.querySelector('[data-decision-dialog]'), null);
    assert.ok(g.w.__wl.dispatched().includes('eventResponse'));
    assert.equal(g.faulted(), false);
  } finally { g.close(); }
});
