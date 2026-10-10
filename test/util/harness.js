// jsdom harness for the v57 UI (legacy bundle and src/ui/App.jsx bundle).
// Months advance by firing the game's setInterval by hand; React scheduling stays real.
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { mulberry32 } from '../../src/sim/rng.js';

// The v57 bundle's nine tabs; the App's nav has eight verticals (Situation folds under Overview, Resources under Economy).
export const LEGACY_TABS = ['overview', 'sitroom', 'economy', 'energy', 'resources', 'defense', 'intel', 'technology', 'trade'];
export const TABS = ['overview', 'economy', 'energy', 'arsenal', 'forces', 'intel', 'technology', 'trade'];
export const FOLDED = { sitroom: 'overview', resources: 'economy' };
// Every pane the App can show; a pane with a data-sentinel root proves its own content rendered (not just chrome).
export const PANES = ['overview', 'sitroom', 'economy', 'resources', 'energy', 'arsenal', 'forces', 'intel', 'technology', 'trade'];
export const SENTINEL_PANES = ['overview', 'sitroom', 'economy', 'resources', 'arsenal', 'forces'];
// Settle React: render, commit and passive effects (ref sync) each land in their own macrotask; drain 4 rounds.
export const flush = async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); };

export const BUNDLES = {
  legacy: 'src/legacy-entry.jsx',
  app: 'src/ui/main.jsx',
};

const cache = new Map();
export async function bundle(entry) {
  if (!cache.has(entry)) {
    cache.set(entry, build({
      entryPoints: [entry], bundle: true, write: false, format: 'iife', minify: true,
      jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, target: ['es2020'], logLevel: 'silent',
    }).then((r) => r.outputFiles[0].text));
  }
  return cache.get(entry);
}

// seed: when set, Math.random and Date.now inside the page are deterministic (parity runs).
export async function mount(entry, { seed = null, testHook = false, preload = null } = {}) {
  const js = await bundle(entry);
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window;
  const intervals = new Map(); let nextId = 1;
  w.setInterval = (fn) => { const id = nextId++; intervals.set(id, fn); return id; };
  w.clearInterval = (id) => { intervals.delete(id); };
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  if (seed != null) {
    const r = mulberry32(seed);
    w.eval('0'); // materialize the context globals before patching them
    w.Math.random = r;
  }
  if (testHook) w.__WL_TEST = true;
  if (preload) for (const [k, v] of Object.entries(preload)) w.localStorage.setItem('wl:' + k, v);
  const saves = [];
  w.eval(js);
  await flush();
  // The deterministic clock starts once the bundle has initialised: library start-up (lodash's shortOut in the
  // App bundle) must not shift the game's timestamps. Every game-time call is still counted on both bundles.
  if (seed != null) { let t = 1700000000000; w.Date.now = () => (t += 1000); }
  const set = w.storage.set.bind(w.storage);
  w.storage.set = (k, v) => { if (k === 'wl_save') saves.push(v); return set(k, v); };
  const doc = w.document;
  const api = {
    w, doc, saves,
    text: () => doc.body.textContent,
    faulted: () => /Simulation fault contained/.test(doc.body.textContent),
    pickCountry: async (i = 0) => { doc.querySelectorAll('.cc')[i].click(); await flush(); await flush(); },
    // Folded panes (sitroom, resources) have no nav button: .click() taps the parent vertical, then its segment.
    tabBtn: (t) => doc.querySelector(`[data-tab=${t}]`) || (t === 'defense' && doc.querySelector('[data-tab=arsenal]')) || (FOLDED[t] && doc.querySelector('[data-nav]') && {
      click: () => { doc.querySelector(`[data-tab=${FOLDED[t]}]`).click(); setTimeout(() => doc.querySelector(`[data-seg=${t}]`)?.click(), 0); },
    }) || [...doc.querySelectorAll('button')].find((b) => b.style.borderBottom && b.textContent.toLowerCase().includes(t === 'sitroom' ? 'situation' : t)),
    // v57 pauses for modals (doctrine, intel crises, confrontations, ultimatums, victory). Answer the first option.
    answerModal: () => {
      const overlay = topOverlay(doc);
      const target = overlay && [...overlay.querySelectorAll('button, div')].find((d) => d.tagName === 'BUTTON' || d.style.cursor === 'pointer');
      if (!target) return false;
      target.click(); return true;
    },
    // Advance up to n months. onMonth(m) runs before month m is ticked; answer() handles modals (default: first option).
    advance: async (n, onMonth, answer = api.answerModal) => {
      let months = 0, stall = 0; const hooked = new Set();
      while (months < n && stall < 40) {
        if (api.faulted()) throw new Error(`ErrorGate fault at month ${months}`);
        const fn = [...intervals.values()].pop();
        if (fn && onMonth && !hooked.has(months)) { hooked.add(months); await onMonth(months); await flush(); continue; }
        if (fn) { stall = 0; fn(); months++; await flush(); }
        else { stall++; answer(); await flush(); }
      }
      return months;
    },
    close: () => w.close(),
  };
  return api;
}

// The thing a player answers when the game stalls: the top-most fixed overlay (v57 modals), or a non-blocking
// decision card the new shell renders with data-modal=<priority> (P3c: the doctrine card keeps v57's z=1900 slot).
export const topOverlay = (doc) => {
  const fixed = [...doc.querySelectorAll('div')].filter((d) => d.style.position === 'fixed' && d.style.inset).map((d) => [d, +d.style.zIndex || 0]);
  const cards = [...doc.querySelectorAll('[data-modal]')].map((d) => [d, +d.getAttribute('data-modal') || 0]);
  return [...fixed, ...cards].sort((x, y) => y[1] - x[1])[0]?.[0];
};

export const gameEnded = (doc) => /game over|victory|defeat|NUCLEAR EXCHANGE|Treasury exhausted|Regime collapse|held global hegemony/i.test(doc.body.textContent);
