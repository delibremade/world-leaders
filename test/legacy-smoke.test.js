import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount, flush, LEGACY_TABS, PANES, SENTINEL_PANES, BUNDLES, gameEnded } from './util/harness.js';

// Smoke gate (PLAYABLE-PLAN guardrail 2): 120 months autoplay, no ErrorGate fault, every tab renders, autosave + resume.
// Runs against the new App (src/ui/App.jsx on src/sim) and the v57 bundle that stays live on Pages.
for (const [name, entry] of Object.entries(BUNDLES)) {
  test(`${name}: 120 months, no ErrorGate fault, every tab renders, save/resume round-trips`, async () => {
    const origErr = console.error; console.error = () => {};
    const g = await mount(entry);
    try {
      assert.match(g.text(), /WORLD LEADERS/);
      await g.pickCountry(0);
      assert.ok(g.tabBtn('overview'), 'game started, tab bar present');
      const months = await g.advance(120);
      assert.ok(!g.faulted(), 'ErrorGate fault');
      assert.ok(months >= 120 || gameEnded(g.doc), `advanced only ${months} months`);
      const saved = JSON.parse((await g.w.storage.get('wl_save')).value);
      assert.ok(saved && saved.countryId === 'usa', 'autosave written via window.storage shim');

      for (const t of (name === 'legacy' ? LEGACY_TABS : PANES)) {
        const b = g.tabBtn(t); assert.ok(b, `tab button ${t}`);
        b.click(); await flush(); await flush();
        assert.ok(!g.faulted(), `fault on tab ${t}`);
        const len = g.text().length;
        assert.ok(len > 500, `tab ${t} renders non-empty (${len} chars)`);
        if (name !== 'legacy' && SENTINEL_PANES.includes(t)) assert.ok(g.doc.querySelector(`[data-sentinel=${t}]`), `sentinel for ${t}`);
      }

      // Resume: a fresh page with the autosave in storage offers Resume and restores the campaign.
      const raw = (await g.w.storage.get('wl_save')).value;
      const g2 = await mount(entry, { preload: { wl_save: raw } });
      try {
        let resume; for (let i = 0; i < 20 && !resume; i++) { await flush(); resume = [...g2.doc.querySelectorAll('button')].find((b) => /Resume/.test(b.textContent)); }
        assert.ok(resume, 'resume offered'); resume.click(); await flush(); await flush();
        assert.ok(g2.tabBtn('overview'), 'back in game');
        const last = JSON.parse(raw).date; const when = `${['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][last.mo]} ${last.yr}`;
        assert.match(g2.text(), new RegExp(when), `resumed at ${when}`);
        assert.match(g2.text(), /United States/);
      } finally { g2.close(); }
    } finally { console.error = origErr; g.close(); }
  });
}
