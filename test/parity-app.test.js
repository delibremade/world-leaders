import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount, BUNDLES } from './util/harness.js';
import { script } from './util/parity-script.js';
import { verbScript, rotatingAnswer } from './util/parity-clicks.js';

// Zero-rule-change gate for P2: the extracted engine (src/ui/App.jsx on src/sim) must produce byte-identical
// autosaves to the v57 bundle under the same seeded Math.random/Date.now, the same modal answers, and the same
// scripted shocks (via the v57 window.__wl test hook) that push rare branches: triad, SAPs, deployments,
// chokepoints, brink tension, sanctions, world events, crises.
const MONTHS = Number(process.env.PARITY_MONTHS || 120);
const CASES = [
  { seed: 1, country: 0 }, // United States
  { seed: 2, country: 3 }, // Japan (energy-dependent, Article 9)
  { seed: 3, country: 4 }, // Russia (producer, rival-keyed paths without Russia)
];

async function play(entry, { seed, country }) {
  const origErr = console.error; console.error = () => {};
  const g = await mount(entry, { seed, testHook: true });
  try {
    await g.pickCountry(country);
    const months = await g.advance(MONTHS, script(g.w));
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
    return { months, saves: g.saves.slice(), text: g.text() };
  } finally { console.error = origErr; g.close(); }
}

for (const c of CASES) {
  test(`parity seed ${c.seed} country #${c.country}: App autosaves === v57 autosaves over ${MONTHS} months`, async () => {
    const a = await play(BUNDLES.legacy, c);
    const b = await play(process.env.PARITY_SELF ? BUNDLES.legacy : BUNDLES.app, c);
    assert.ok(a.saves.length >= 3, `legacy produced ${a.saves.length} saves`);
    assert.equal(b.months, a.months, 'months advanced');
    assert.equal(b.saves.length, a.saves.length, 'save count');
    for (let i = 0; i < a.saves.length; i++) {
      if (a.saves[i] !== b.saves[i]) {
        const x = JSON.parse(a.saves[i]), y = JSON.parse(b.saves[i]);
        const diff = Object.keys({ ...x, ...y }).filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k]));
        assert.fail(`save #${i} (${x.date.mo + 1}/${x.date.yr}) differs in: ${diff.join(', ')} :: ${diff.slice(0, 2).map((k) => JSON.stringify(x[k]).slice(0, 300) + ' vs ' + JSON.stringify(y[k]).slice(0, 300)).join(' | ')}`);
      }
    }
  });
}

// P2b gate: the same, plus a scripted click sequence through the rendered UI that exercises every verb family
// (test/util/parity-clicks.js). Verbs moving from App.jsx into src/sim/actions.js must keep these saves byte-identical.
const VERB_CASES = [{ seed: 10, country: 0 }, { seed: 11, country: 0 }];
const MUST_HIT = [/Kinetic Strike/, /Declare Blockade/, /Demonstration/, /Employ/, /decapitation/, /Regime change/, /Absolute Resolve/,
  /Rehabilitate/, /Hand over/, /Tranche/, /Initiate/, /Phase II/, /Cut Off/, /Back-channel/, /Deploy\$/, /^decision$/, /^flashpoint$/];
const modalsSeen = {};

async function playVerbs(entry, { seed, country }) {
  const origErr = console.error; console.error = () => {};
  const g = await mount(entry, { seed, testHook: true });
  try {
    await g.pickCountry(country);
    const vs = verbScript(g, script(g.w)); const answer = rotatingAnswer(g);
    const months = await g.advance(MONTHS, vs.onMonth, answer);
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
    return { months, saves: g.saves.slice(), hits: vs.hits, seen: answer.seen };
  } finally { console.error = origErr; g.close(); }
}

for (const c of VERB_CASES) {
  test(`verb parity seed ${c.seed}: scripted clicks over every verb family, App autosaves === v57 autosaves`, async () => {
    const a = await playVerbs(BUNDLES.legacy, c);
    const b = await playVerbs(process.env.PARITY_SELF ? BUNDLES.legacy : BUNDLES.app, c);
    for (const re of MUST_HIT) assert.ok(a.hits.some((h) => re.test(h)), `verb not exercised: ${re}`);
    for (const [k, n] of Object.entries(a.seen)) modalsSeen[k] = (modalsSeen[k] || 0) + n;
    assert.deepEqual(b.hits, a.hits, 'same clicks landed');
    assert.equal(b.months, a.months, 'months advanced');
    assert.equal(b.saves.length, a.saves.length, 'save count');
    for (let i = 0; i < a.saves.length; i++) {
      if (a.saves[i] !== b.saves[i]) {
        const x = JSON.parse(a.saves[i]), y = JSON.parse(b.saves[i]);
        const diff = Object.keys({ ...x, ...y }).filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k]));
        assert.fail(`save #${i} (${x.date.mo + 1}/${x.date.yr}) differs in: ${diff.join(', ')} :: ${diff.slice(0, 2).map((k) => JSON.stringify(x[k]).slice(0, 300) + ' vs ' + JSON.stringify(y[k]).slice(0, 300)).join(' | ')}`);
      }
    }
  });
}

test('verb parity runs answered every modal family (ultimatum, confrontation, intel crisis, IMF bailout)', () => {
  if (MONTHS < 120) return;
  for (const k of ['ult', 'conf', 'crisis', 'over']) assert.ok(modalsSeen[k] > 0, `modal never answered: ${k}`);
});
