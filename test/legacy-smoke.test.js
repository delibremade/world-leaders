import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { legacyBuildOptions } from '../scripts/build-legacy.js';

const TABS = ['overview', 'sitroom', 'economy', 'energy', 'resources', 'defense', 'intel', 'technology', 'trade'];
const flush = () => new Promise((r) => setTimeout(r, 0));

test('v57 bundle: 120 months, no ErrorGate fault, 9 tabs render', async () => {
  const js = (await build(legacyBuildOptions)).outputFiles[0].text;
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window;
  // Fake timers: v57 advances months via setInterval. Only intervals are faked; React scheduling stays real.
  const intervals = new Map(); let nextId = 1;
  w.setInterval = (fn) => { const id = nextId++; intervals.set(id, fn); return id; };
  w.clearInterval = (id) => { intervals.delete(id); };
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  const errs = []; const origErr = console.error;
  console.error = (...a) => { errs.push(a.map(String).join(' ')); };
  try {
    w.eval(js);
    await flush();
    const doc = w.document;
    assert.match(doc.body.textContent, /WORLD LEADERS/);
    doc.querySelector('.cc').click();
    await flush(); await flush();
    const tabBtn = (t) => [...doc.querySelectorAll('button')].find((b) => b.style.borderBottom && b.textContent.toLowerCase().includes(t === 'sitroom' ? 'situation' : t));
    assert.ok(tabBtn('overview'), 'game started, tab bar present');

    // v57 pauses for modals (doctrine, decisions, intel crises, confrontations). Answer the first option.
    const answerModal = () => {
      const overlays = [...doc.querySelectorAll('div')].filter((d) => d.style.position === 'fixed' && d.style.inset);
      const overlay = overlays.sort((x, y) => (+y.style.zIndex || 0) - (+x.style.zIndex || 0))[0];
      const target = overlay && [...overlay.querySelectorAll('button, div')].find((d) => d.tagName === 'BUTTON' || d.style.cursor === 'pointer');
      if (!target) return false;
      target.click(); return true;
    };
    let months = 0, stall = 0;
    while (months < 120 && stall < 40) {
      assert.doesNotMatch(doc.body.textContent, /Simulation fault contained/, `ErrorGate fault at month ${months}`);
      const fn = [...intervals.values()].pop();
      if (fn) { stall = 0; fn(); months++; await flush(); } else { stall++; answerModal(); await flush(); }
    }
    assert.doesNotMatch(doc.body.textContent, /Simulation fault contained/, 'ErrorGate fault');
    assert.ok(months >= 120 || gameEnded(doc), `advanced only ${months} months`);
    const saved = JSON.parse((await w.storage.get('wl_save')).value);
    assert.ok(saved && saved.countryId, 'autosave written via window.storage shim');

    for (const t of TABS) {
      const b = tabBtn(t); assert.ok(b, `tab button ${t}`);
      b.click(); await flush(); await flush();
      assert.doesNotMatch(doc.body.textContent, /Simulation fault contained/, `fault on tab ${t}`);
      const text = doc.body.textContent.length;
      assert.ok(text > 500, `tab ${t} renders non-empty (${text} chars)`);
    }
  } finally { console.error = origErr; w.close(); }
});
function gameEnded(doc) { return /game over|victory|defeat/i.test(doc.body.textContent); }
