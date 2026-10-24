import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, openGame, settle } from './util/browser.js';
import { mount, BUNDLES, flush } from './util/harness.js';
import { MAP_MODES, MODE_KEYS } from '../src/ui/map/scene.js';

// V2c (docs/DESIGN-SYSTEM-V2.md §3): the 2.5D PixiJS map. Chrome in the DOM (level chip, zoom, legend, dock with keys);
// the renderer exposes its level, layers and tilt through window.__wlMap for the real-Chromium checks.

test('App (jsdom, SVG fallback): dock carries six modes with keys Q to Y; pressing a key switches the mode; level chip and zoom controls present', async () => {
  const origErr = console.error; console.error = () => {};
  const g = await mount(BUNDLES.app, { testHook: true });
  try {
    await g.pickCountry(0);
    const { doc, w } = g; const q = (s) => doc.querySelector(s), qa = (s) => [...doc.querySelectorAll(s)];
    q('[data-doctrine=fortress]').click(); await flush(); await flush();
    assert.deepEqual(qa('[data-map-modes] [data-map-mode-btn]').map((b) => b.dataset.key), MODE_KEYS);
    assert.deepEqual(qa('[data-map-modes] kbd').map((k) => k.textContent), MODE_KEYS, 'each chip shows its key');
    assert.equal(q('[data-map-lod]').textContent, 'Strategic'); assert.equal(q('[data-map]').getAttribute('data-map-level'), 'strategic');
    assert.equal(qa('[data-map-zoom] button').length, 4, 'zoom in, out, fit, build'); assert.ok(q('[data-map-zoom] [data-build-toggle]'));
    const press = async (k) => { doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true })); await flush(); };
    for (let i = 0; i < MODE_KEYS.length; i++) { await press(MODE_KEYS[i].toLowerCase()); assert.equal(q('[data-map]').getAttribute('data-map-mode'), MAP_MODES[i].id, `key ${MODE_KEYS[i]}`); }
    await press('Q'); assert.equal(q('[data-map]').getAttribute('data-map-mode'), 'sphere', 'upper case too');
    // typing in a field never switches the map
    const inp = doc.createElement('input'); doc.body.appendChild(inp); inp.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'w', bubbles: true })); await flush();
    assert.equal(q('[data-map]').getAttribute('data-map-mode'), 'sphere'); inp.remove();
    assert.match(q('[data-map-legend]').textContent, /Affiliation/);
    assert.ok(!g.faulted());
  } finally { console.error = origErr; g.close(); }
});

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

test('1440px (WebGL): tilted plane renders; zoom walks Strategic -> Operational -> Tactical with the right layers; chip, dock and legend sit over the map; reduced motion stops the ticker work', async () => {
  const { ctx, page, errors } = await openGame(browser, { width: 1440, height: 900 });
  try {
    await page.evaluate(() => document.querySelector('[data-tab=overview]').click()); await settle(page, 800);
    await page.waitForFunction(() => window.__wlMap?.renderer === 'pixi' && window.__wlMap.frames() > 5, null, { timeout: 15000 });
    const m = await page.evaluate(() => ({ tilt: window.__wlMap.tilt, level: window.__wlMap.level(), scale: window.__wlMap.scale(), layers: window.__wlMap.layers(), chip: document.querySelector('[data-map-lod]').textContent }));
    assert.ok(m.tilt >= 0.84 && m.tilt <= 1, `plane tilt ${m.tilt}`); assert.equal(m.level, 'strategic'); assert.equal(m.chip, 'Strategic');
    assert.equal(m.layers.rings, false); assert.equal(m.layers.names, true); assert.equal(m.layers.chips, true);
    await page.evaluate(() => window.__wlMap.zoomBy(2)); await settle(page, 300);
    let r = await page.evaluate(() => ({ level: window.__wlMap.level(), layers: window.__wlMap.layers(), chip: document.querySelector('[data-map-lod]').textContent }));
    assert.equal(r.level, 'operational'); assert.equal(r.chip, 'Operational'); assert.equal(r.layers.baseNames, true); assert.equal(r.layers.rings, false);
    await page.evaluate(() => window.__wlMap.zoomBy(2)); await settle(page, 300);
    r = await page.evaluate(() => ({ level: window.__wlMap.level(), layers: window.__wlMap.layers(), chip: document.querySelector('[data-map-lod]').textContent }));
    assert.equal(r.level, 'tactical'); assert.equal(r.chip, 'Tactical'); assert.equal(r.layers.rings, false, 'zoom alone never exposes coverage'); assert.equal(r.layers.unitDetail, true);
    // zoom buttons drive the same renderer; fit returns to strategic
    await page.click('[data-map-zoom] [aria-label="Fit the world"]'); await settle(page, 300);
    assert.equal(await page.evaluate(() => window.__wlMap.level()), 'strategic');
    await page.click('[data-map-zoom] [aria-label="Zoom in"]'); await page.click('[data-map-zoom] [aria-label="Zoom in"]'); await settle(page, 300);
    assert.notEqual(await page.evaluate(() => window.__wlMap.level()), 'strategic', 'two zoom-ins leave strategic');
    // chrome over the stage: chip top-left, zoom top-right, legend bottom-left, dock bottom-right, all inside the stage
    const box = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);
    const st = await box('.wl-mv-stage'), lod = await box('[data-map-lod]'), zm = await box('[data-map-zoom]'), lg = await box('[data-map-legend]'), dk = await box('[data-map-modes]');
    const inside = (b, what) => assert.ok(b.x >= st.x - 0.5 && b.y >= st.y - 0.5 && b.r <= st.r + 0.5 && b.b <= st.b + 0.5, `${what} inside the stage ${JSON.stringify(b)} vs ${JSON.stringify(st)}`);
    inside(lod, 'level chip'); inside(zm, 'zoom'); inside(lg, 'legend'); inside(dk, 'dock');
    assert.ok(lod.x < st.x + st.w / 2 && lod.y < st.y + st.h / 2, 'chip top-left'); assert.ok(zm.r > st.x + st.w / 2 && zm.y < st.y + st.h / 2, 'zoom top-right');
    assert.ok(lg.x < st.x + st.w / 2 && lg.b > st.y + st.h / 2, 'legend bottom-left'); assert.ok(dk.r > st.x + st.w / 2 && dk.b > st.y + st.h / 2, 'dock bottom-right');
    assert.ok(lg.b <= dk.y + 0.5, 'legend sits above the lens bar');
    // hotkey on the live map, then the mode's emphasis layer: W tints by tension
    await page.keyboard.press('w'); await settle(page, 200);
    assert.equal(await page.evaluate(() => document.querySelector('[data-map]').getAttribute('data-map-mode')), 'tension');
    // the ticker keeps running (lanes, pulses) and stops doing work under reduced motion
    // the ticker keeps running: a software-GL runner may need seconds per frame, so wait for the count to move rather than sample a window
    const f0 = await page.evaluate(() => window.__wlMap.frames());
    await page.waitForFunction((f0) => window.__wlMap.frames() > f0, f0, { timeout: 20000 });
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('1440px (WebGL, prefers-reduced-motion): the map still renders and reports its level', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  try {
    const { appHtml } = await import('./util/browser.js');
    await page.setContent(await appHtml(), { waitUntil: 'load' }); await settle(page, 300);
    await page.locator('.cc').first().click(); await settle(page, 400);
    await page.locator('text=Military Superpower').first().click(); await settle(page, 800);
    await page.waitForFunction(() => window.__wlMap?.renderer === 'pixi' && window.__wlMap.frames() > 2, null, { timeout: 15000 });
    assert.equal(await page.evaluate(() => window.__wlMap.level()), 'strategic');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('[data-map-lod]')).animationName), 'none');
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
