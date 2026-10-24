import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, openGame, settle, overflow } from './util/browser.js';
let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

for (const [width, height] of [[1280, 800], [1440, 900], [1920, 1080], [390, 844]]) {
  test(`${width}px: doctrine is readable above the outliner, traps focus and keeps all choices reachable; events open at reading width`, async () => {
    const { ctx, page, errors } = await openGame(browser, { width, height, doctrine: false, svg: true });
    try {
      const dialog = page.locator('[data-decision-dialog]');
      assert.equal(await dialog.evaluate(d => d.matches(':modal')), true);
      assert.equal(await dialog.locator('[data-doctrine]').count(), 4);
      if (width >= 1100) {
        const choices = await dialog.locator('[data-doctrine]').evaluateAll(es => es.map(e => {
          const r = e.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return { top: r.top, bottom: r.bottom, hit: e.contains(hit) };
        }));
        for (const c of choices) assert.ok(c.top >= 0 && c.bottom <= height && c.hit, JSON.stringify(c));
      }
      await page.keyboard.press('Escape'); assert.equal(await dialog.count(), 1, 'required decision cannot be accidentally dismissed');
      await page.keyboard.press('3'); assert.equal(await page.locator('[data-tab=overview]').getAttribute('aria-current'), 'page', 'background shortcuts are held');
      for (let i = 0; i < 7; i++) { await page.keyboard.press('Tab'); assert.equal(await dialog.evaluate(d => d.contains(document.activeElement)), true); }
      for (let i = 0; i < 7; i++) { await page.keyboard.press('Shift+Tab'); assert.equal(await dialog.evaluate(d => d.contains(document.activeElement)), true); }
      const o = await overflow(page, width); assert.equal(o.scrollWidth, width); assert.deepEqual(o.bad, []);
      await dialog.locator('[data-doctrine=shadow]').click(); await settle(page);
      assert.equal(await dialog.count(), 0); assert.match(await page.locator('.wl-hud-nation').innerText(), /Shadow Power/);
      await page.locator('[data-pause]').click();
      await page.evaluate(() => window.__wl.event('panama_drought', 6)); await settle(page);
      const frame = await page.locator('.wl-mv-stage').boundingBox();
      await page.locator('[data-review-card=we]').click(); await settle(page);
      if (width >= 1100) assert.ok((await dialog.boundingBox()).width >= 700);
      assert.deepEqual(await page.locator('.wl-mv-stage').boundingBox(), frame, 'opening the reader does not reflow the map');
      const responses = dialog.locator('[data-response]'); assert.ok(await responses.count() >= 3);
      for (let i = 0; i < await responses.count(); i++) { await responses.nth(i).scrollIntoViewIfNeeded(); assert.equal(await responses.nth(i).isVisible(), true); }
      await page.keyboard.press('Escape'); await settle(page); assert.equal(await dialog.count(), 0);
      await page.locator('[data-review-card=we]').click(); await settle(page);
      await dialog.locator('[data-response][aria-disabled=false]').first().click(); await settle(page);
      assert.equal(await dialog.count(), 0); assert.deepEqual(errors, []);
    } finally { await ctx.close(); }
  });
}
