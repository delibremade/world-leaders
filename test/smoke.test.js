import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

// UI smoke test: bundle, mount in jsdom, click, assert. Task 002 ports the 78-step v57 tab-walk harness here
// (sentinel text per tab, rare branches via window.__WL_TEST / window.__wl).
test('UI mounts and advances a month', async () => {
  const r = await build({ entryPoints: ['src/ui/main.jsx'], bundle: true, write: false, format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
  const js = r.outputFiles[0].text;
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.eval(js);
  await new Promise((res) => setTimeout(res, 50));
  const doc = dom.window.document;
  assert.match(doc.body.textContent, /World Leaders/);
  assert.equal(doc.querySelector('[data-testid=month]').textContent, '0');
  doc.querySelector('button').click();
  await new Promise((res) => setTimeout(res, 50));
  assert.equal(doc.querySelector('[data-testid=month]').textContent, '1');
});
