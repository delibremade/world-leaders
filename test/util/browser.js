// Real-Chromium helper for layout assertions jsdom cannot make (scrollWidth, clipping). playwright-core is a
// devDependency; the browser comes from PLAYWRIGHT_BROWSERS_PATH / the Playwright cache (CI: `npx playwright-core install chromium`).
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';
import { bundle, BUNDLES } from './harness.js';
import { shell } from '../../scripts/shell.js';

export const settle = (page, ms = 250) => page.waitForTimeout(ms);
// Wait until an element's box stops moving (sheets slide in): two reads 120ms apart agree, or 3s pass. Returns the last box or null.
export async function stableRect(page, sel, { within = null } = {}) { // within: {W,H} also waits (up to 5s) for the box to be inside it
  const read = () => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);
  let prev = await read();
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(120); const cur = await read(); const still = cur && prev && ['x', 'y', 'r', 'b'].every((k) => Math.abs(cur[k] - prev[k]) < 0.5); const fits = !within || (cur && cur.x >= -0.5 && cur.y >= -0.5 && cur.r <= within.W + 0.5 && cur.b <= within.H + 0.5); if (still && fits) return cur; prev = cur; }
  return prev;
}
const findChromium = () => {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined; // let playwright resolve its own cache
  const d = readdirSync(root).filter((n) => /^chromium-\d+$/.test(n)).sort().pop();
  const p = d && `${root}/${d}/chrome-linux/chrome`;
  return p && existsSync(p) ? p : undefined;
};
export async function launch() {
  return chromium.launch({ executablePath: findChromium(), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}
export async function appHtml({ split = false } = {}) {
  const js = await bundle(BUNDLES.app);
  return shell(js).replace('<script>', '<script>window.__WL_TEST=true;</script><script>');
}
// Open the app at a viewport, pick the first nation, answer the doctrine card, return the page.
export async function openGame(browser, { width = 390, height = 844, doctrine = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 900, hasTouch: width < 900 });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.setContent(await appHtml(), { waitUntil: 'load' });
  await settle(page, 300);
  await page.locator('.cc').first().click(); await settle(page, 400);
  if (doctrine) { await page.locator('text=Military Superpower').first().click(); await settle(page, 600); } else await settle(page, 600);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent === '⏸')?.click());
  await settle(page, 300);
  return { ctx, page, errors };
}
export const overflow = (page, width) => page.evaluate((W) => {
  const bad = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width && (r.right > W + 0.5 || r.left < -0.5)) {
      let clipped = false; // an ancestor with overflow other than visible that is itself inside W contains it
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a); if (/(auto|scroll)/.test(o.overflowX) && a.getBoundingClientRect().right <= W + 0.5) { clipped = true; break; } }
      if (!clipped && getComputedStyle(el).position !== 'fixed') bad.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''}[${Math.round(r.left)}..${Math.round(r.right)}] ${(el.textContent || '').trim().slice(0, 30)}`);
    }
  }
  const de = document.documentElement;
  return { scrollWidth: Math.max(de.scrollWidth, document.body.scrollWidth), bad: bad.slice(0, 12) };
}, width);
