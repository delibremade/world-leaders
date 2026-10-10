// Scripted player clicks for parity runs: every verb family, driven through the rendered UI (not the test hook),
// so the same sequence runs against the v57 bundle and the App bundle. Every target must exist when clicked:
// a missing button throws, so a silent UI change cannot quietly drop coverage.
// Avoided on purpose: a player embargoed by Russia while holding import contracts (PR #3 fixed that fault in the
// engine, so v57 and App legitimately differ there). Import contracts are signed only while nobody embargoes us.
import { flush } from './harness.js';

export function clickDriver(g) {
  const { w, doc } = g;
  const hits = [];
  const tab = async (t) => { g.tabBtn(t).click(); await flush(); };
  const all = (sel, root = doc) => [...root.querySelectorAll(sel)];
  const find = (re, { sel = 'button', root = doc, nth = 0 } = {}) => all(sel, root).filter((b) => re.test(b.textContent))[nth];
  const click = async (re, opts = {}) => {
    const el = find(re, opts);
    if (!el) throw new Error(`click target not found: ${re} (${opts.sel || 'button'})` + (process.env.CLICK_DEBUG ? '\n' + [...new Set(all('button').map((b) => b.textContent.trim().slice(0, 50)))].join(' | ') : ''));
    el.click(); hits.push(String(re)); await flush();
    return el;
  };
  const tryClick = async (re, opts = {}) => { const el = find(re, opts); if (!el) return false; el.click(); hits.push(String(re)); await flush(); return true; };
  // Pointer divs (issue cards, social programs, covert programs, decision options, doctrine cards).
  const div = (re, root = doc) => all('div', root).filter((d) => d.style.cursor === 'pointer' && re.test(d.textContent)).pop();
  const clickDiv = async (re, root) => { const d = div(re, root); if (!d) throw new Error(`div target not found: ${re}`); d.click(); hits.push(String(re)); await flush(); };
  const range = async (pred, value, nth = 0) => {
    const el = all('input[type=range]').filter(pred)[nth];
    if (!el) throw new Error('range input not found');
    Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, String(value));
    el.dispatchEvent(new w.Event('input', { bubbles: true })); hits.push('range'); await flush();
  };
  const mm = (min, max) => (el) => el.min === String(min) && el.max === String(max);
  // Map region: the <g> whose first label is the region name.
  const region = async (name) => {
    const gEl = all('svg g').find((x) => x.querySelector('text')?.textContent === name);
    if (!gEl) throw new Error('region not found: ' + name);
    gEl.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await flush();
  };
  const closeRegion = async () => { const x = all('button').find((b) => b.textContent === '✕' && !/border/.test(b.getAttribute('style') || '') && /Your Influence/.test(b.parentElement?.parentElement?.textContent || '')); if (!x) throw new Error('region close not found'); x.click(); await flush(); };
  return { tab, find, click, tryClick, div, clickDiv, range, mm, region, closeRegion, hits };
}

// Modal answerer that rotates through options so every modal choice gets exercised over a run. Game-over prefers the
// IMF bailout (second button) so the run continues.
export function rotatingAnswer(g, offset = 0) {
  const seen = {};
  const answer = () => {
    const { doc } = g;
    const overlays = [...doc.querySelectorAll('div')].filter((d) => d.style.position === 'fixed' && d.style.inset);
    const overlay = overlays.sort((x, y) => (+y.style.zIndex || 0) - (+x.style.zIndex || 0))[0];
    if (!overlay) return false;
    const opts = [...overlay.querySelectorAll('button, div')].filter((d) => d.tagName === 'BUTTON' || d.style.cursor === 'pointer');
    if (!opts.length) return false;
    const txt = overlay.textContent;
    const kind = /Nuclear Ultimatum/.test(txt) ? 'ult' : /Blockade Confrontation/.test(txt) ? 'conf' : /Intelligence Crisis/.test(txt) ? 'crisis' : /IMF Bailout/.test(txt) ? 'over' : 'other';
    let i;
    if (kind === 'over') { i = 1; seen.over = (seen.over || 0) + 1; }
    else { seen[kind] = (seen[kind] || 0) + 1; i = (seen[kind] - 1 + offset) % opts.length; }
    opts[i].click(); return true;
  };
  answer.seen = seen;
  return answer;
}

// The scenario: one month per verb family, then recurring checks (decisions, flashpoints, briefs) every month.
// `shocks` is the existing hook script (fund, platforms, deployments, tension) that makes the verbs reachable.
export const verbScript = (g, shocks) => {
  const d = clickDriver(g);
  const { tab, click, tryClick, clickDiv, range, mm, region, closeRegion, find } = d;
  const h = () => g.w.__wl;
  const plan = {
    2: async () => { // doctrine; economy: rate, stance, tax, sector budget, social program, policy action, budget drill +/-
      await clickDiv(/^🛡️Military Superpower/);
      await tab('economy');
      await range(mm(0, 20), 5.5); await click(/Stimulus/); await range(mm(8, 48), 33); await range(mm(0, 200), 130, 0);
      await clickDiv(/National Pension System/); await click(/^Execute$/);
      const bar = [...g.doc.querySelectorAll('div')].find((x) => x.style.cursor === 'pointer' && /^Treasury/.test(x.textContent));
      bar.click(); await d.tryClick(/^\+$/); await d.tryClick(/^−$/); bar.click();
    },
    3: async () => { // energy: SPR, export share, embargo, Panama, concession, policy
      await tab('energy');
      await click(/Fill \$200M/); await click(/Fill \$200M/); await click(/▶ Release/);
      await range(mm(0, 100), 40, 0);
      await click(/Transit Priority Agreement/); await click(/Finance lock expansion/);
      await click(/Sign concession/); await click(/^Execute$/);
    },
    4: async () => { // resources: extraction, GGRB survey, renewables
      await tab('resources');
      await click(/^2$/, { nth: 0 }); await click(/^2$/, { nth: 1 }); await tryClick(/Commission Geological Survey/); await click(/^\+\$400M$/);
      await tab('energy'); await click(/Embargo Venezuela/); await click(/Embargo Germany/);
    },
    5: async () => { // defense: SAP office, develop, build, import, decommission, pay, procurement, exports
      await tab('defense');
      await click(/Establish SAP Office/); await click(/Develop \$400M/); await click(/^Build \$400M$/);
      await click(/^−1$/); await click(/^−1🌐$/);
      await range(mm(80, 150), 120); await click(/Surge/);
      await click(/Material Science L/); await click(/Sell .* to All Eligible Buyers/);
    },
    6: async () => { // technology: R&D invest, IP policy, era program
      await tab('technology');
      await clickDiv(/Semiconductors/); await click(/^Invest \$/); await click(/Protect/); await click(/^Execute$/);
    },
    7: async () => { // intel: infra, budget, proxies, doctrine, covert program, ops
      await tab('intel');
      await click(/^Build \$600M/); await click(/^3$/); await click(/^\$160M$/); await range(mm(0, 100), 50, 0);
      await click(/Expose/); await clickDiv(/Counter-Intelligence Grid/);
      await click(/^🇨🇳 China$/); await click(/^Launch Op$/, { nth: 0 }); await click(/^♻️$/);
    },
    8: async () => { // trade: influence, sanctions, blocs, bulk statecraft, per-nation statecraft, imports, currency
      await tab('trade');
      await click(/^\$200M$/); await click(/^Russia$/); await click(/^🤝France \(ally\)$/);
      await click(/European Union ·/);
      await click(/Embassies in all/); await click(/All missions → trade/); await click(/Visit all off-cooldown/);
      await click(/Trade agreements with all eligible/); await click(/Even influence/);
      await range(mm(0, 100), 80, 0);
      await click(/^🕵️$/); await click(/^💵 Aid$/); await click(/^📜 Trade/); await click(/^🛡️ Pact$/);
      await click(/Join → T1/); await click(/EU Summit · \$1.2B/); await tryClick(/Sign EU defense pact/);
      await click(/^Sign \$80M\/mo$/); await click(/Non-Aligned/);
    },
    9: async () => { // overview: issue brief, map region actions (posture, deploy +/-, blockade, strike, intel, alliance)
      // Map +/- deploy intentionally diverges from v57 (#6); station via OOB (shared deployUnit path) instead.
      await tab('defense');
      { const sel = g.doc.querySelector('select[id^=oob_]'); if (sel) { sel.value = 'ME'; await click(/^\+ Station$/); } }
      await tab('overview');
      await region('Middle East');
      await click(/Escort \/ FON/);
      await click(/Declare Blockade/); await tryClick(/Kinetic Strike/); await click(/Deploy Intel/); await click(/Activate Alliance/);
      await closeRegion();
    },
    10: async () => { h().rel('venezuela', 60);  await tab('trade'); await click(/^Sign \$80M\/mo$/, { nth: 0 }).catch(() => {}); await click(/✓ Importing/); await click(/^Russia — SANCTIONED|🚫 Russia/); },
    11: async () => { // sitroom lanes + intel dossier back-channel + final options (demonstration)
      await tab('sitroom');
      await tryClick(/Back-channel \(\$250M/); await tryClick(/Set Escort posture/);
      h().setTension('china', 90); await tab('intel');
      await tryClick(/☢ Demonstration · \$1.5B/); await tryClick(/Back-channel · \$250M/);
    },
    12: async () => { // SAP program, OOB station + recall, Tier-1 intervention
      await tab('defense');
      await tryClick(/^Initiate \$/);
      const sel = g.doc.querySelector('select[id^=oob_]');
      if (sel) { sel.value = 'EU'; await click(/^\+ Station$/); }
      await click(/^recall$/);
      await tab('energy'); await click(/Launch Absolute Resolve/);
    },
    16: async () => { await tab('defense'); await tryClick(/Tranche #/); await tab('energy'); await tryClick(/Rehabilitate fields/); },
    20: async () => { await tab('intel'); await tryClick(/Launch decapitation raid/); await tab('trade'); await click(/Step down/); },
    24: async () => { await tab('energy'); await tryClick(/Hand over to interim/); await click(/Lift — Venezuela/); await tab('resources'); await tryClick(/Activate Phase II/); },
    30: async () => { await tab('defense'); await tryClick(/Recapitalize Forces/); await tryClick(/Cut Off/); },
    41: async () => { await tab('overview'); await region('Middle East'); await tryClick(/Lift Blockade/); await closeRegion(); },
    40: async () => { await tab('intel'); await tryClick(/🎯 Regime change · \$6B/); },
    60: async () => { await tab('trade'); await tryClick(/✂️ Cut/); await click(/✖ Clear/); },
    110: async () => { h().fund(-9000); },
    100: async () => { h().setTension('china', 92); await tab('intel'); await tryClick(/☢️ Employ · \$3B/); },
  };
  let deploys = 0;
  const every = async (m) => {
    await tab('overview');
    // Decisions: answer with the option index rotating by month.
    const opts = [...g.doc.querySelectorAll('div')].filter((x) => x.style.cursor === 'pointer' && x.parentElement && /Decision Required/.test(x.parentElement.parentElement?.textContent || ''));
    if (opts.length) { opts[m % opts.length].click(); d.hits.push('decision'); await flush(); }
    // Flashpoints: open the region and respond, rotating intervene / mediate / diplomatic.
    const fp = [...g.doc.querySelectorAll('svg text')].find((t) => /⚠$/.test(t.textContent));
    if (fp) {
      fp.parentElement.dispatchEvent(new g.w.MouseEvent('click', { bubbles: true })); await flush();
      const bs = [...g.doc.querySelectorAll('button')].filter((b) => /Intervene|Mediate \$300M|Diplomatic/.test(b.textContent));
      if (bs.length) { bs[m % bs.length].click(); d.hits.push('flashpoint'); await flush(); }
      if (/Your Influence/.test(g.doc.body.textContent)) await closeRegion();
    }
    // Issue briefs: deploy the first option of a ready brief, else commission the first unexamined issue.
    const cards = [...g.doc.querySelectorAll('div')].filter((x) => x.style.cursor === 'pointer' && x.style.borderRadius === '7px' && x.querySelector('span'));
    const ready = cards.find((x) => /BRIEF READY/.test(x.textContent));
    const fresh = cards.find((x) => /UNEXAMINED/.test(x.textContent));
    if (ready && deploys < 2) {
      ready.click(); await flush();
      const opt = [...g.doc.querySelectorAll('div')].find((x) => x.style.cursor === 'pointer' && x.style.borderRadius === '6px');
      if (opt) { opt.click(); await flush(); if (await tryClick(/^📋 Deploy$/)) deploys++; }
    } else if (fresh && m % 4 === 0) { fresh.click(); await flush(); await tryClick(/Commission — \$300M/); }
    if (m % 6 === 0) h().fund(60000);
  };
  const onMonth = async (m) => {
    if (m >= 10 && m <= 40) h().setTension('russia', 82);
    if (m === 1) { await tab('defense'); await click(/^🌐 Purchase/); }
    await shocks(m);
    if (m >= 2) { if (plan[m]) await plan[m](); await every(m); }
  };
  return { onMonth, hits: d.hits };
};
