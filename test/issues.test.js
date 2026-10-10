import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ISSUES } from '../src/data/economy.js';
import { stepIssues, ISSUE_TTL } from '../src/sim/issues.js';
import { checkV57 } from '../src/sim/invariants.js';
import { game } from './util/headless-month.js';

// E9 (#23): the Active issues / intelligence brief loop. Diagnosis before the fix: 0-2 issues per 120 months, flapping on trigger flip.

function passive(seed, idx, months) {
  const G = game(seed, idx); const seen = new Map(); const log = { spawned: [], flapped: [], lapsed: [] }; let prev = new Map();
  for (let m = 0; m < months; m++) {
    G.step();
    const cur = new Map(G.g.issues.map((i) => [i.id, i]));
    for (const [id, i] of cur) if (!seen.has(id)) { seen.set(id, i); if (!id.endsWith('_init')) log.spawned.push({ id, m }); }
    for (const [id, p] of prev) if (!cur.has(id) && p.status === 'unexamined') (p.ttl > 1 ? log.flapped : log.lapsed).push(id);
    assert.deepEqual(checkV57(G.g), [], `invariants month ${m}`);
    prev = cur;
  }
  G.done(); return { G, ...log };
}

test('cadence: 120 months, unattended, yields >=10 issues, none vanish before their timer', () => {
  const r = passive(1, 0, 120);
  assert.ok(r.spawned.length >= 10, `spawned ${r.spawned.length}`);
  assert.deepEqual(r.flapped, [], 'unexamined issues are removed only by their ttl');
  assert.ok(r.lapsed.length >= 8, 'unattended issues lapse');
  const gaps = r.spawned.slice(1).map((s, i) => s.m - r.spawned[i].m);
  assert.ok(gaps.every((g) => g >= 6), `gaps ${gaps}`);
  assert.ok(gaps.reduce((a, b) => a + b, 0) / gaps.length <= 12, `mean gap ${gaps}`);
});

test('persistence: a stat that recovers does not delete an unexamined issue', () => {
  const now = 50;
  const r = stepIssues({ issues: [{ type: 'high_inflation', id: 'x', status: 'unexamined', born: 40, ttl: 9 }], deployments: [], stats: { inflation: 1, unemployment: 1, stability: 90, debtGdp: 10, inequality: 10, education: 10, gdpGrowth: 3, foodSecurity: 99 }, now, date: { yr: 2030, mo: 0 }, cooldowns: { issue_next: 5 } });
  assert.equal(r.issues.length, 1); assert.equal(r.issues[0].ttl, 8);
});

test('lifecycle: investigate -> brief -> deploy -> resolved, timers visible', () => {
  const G = game(3, 0); const { g } = G;
  const t = g.issues[0].type;
  G.act({ type: 'investigate', payload: { issue: t } });
  assert.equal(g.issues.find((i) => i.type === t).status, 'investigating');
  G.step(); G.step();
  const iss = g.issues.find((i) => i.type === t);
  assert.equal(iss.status, 'briefed'); assert.ok(g.briefs[t]);
  assert.ok(iss.ttl >= ISSUE_TTL.briefed - 1, 'brief carries a visible timer');
  const opt = g.briefs[t].opts[0];
  G.act({ type: 'deployPolicy', payload: { issue: t, option: opt.id } });
  assert.equal(g.issues.find((i) => i.type === t).status, 'deployed');
  for (let m = 0; m < opt.tm + 2; m++) G.step();
  assert.ok(!g.issues.some((i) => i.type === t && i.id.endsWith('_init')), 'resolved issue leaves the list');
  assert.ok(g.actionCooldowns[`issue_${t}`] > 0 || g.issues.some((i) => i.type === t), 'cooldown or respawn');
  G.done();
});

test('briefed issue lapses (and its brief is dropped) when never deployed', () => {
  const G = game(3, 0); const { g } = G; const t = g.issues[0].type;
  G.act({ type: 'investigate', payload: { issue: t } });
  for (let m = 0; m < 2 + ISSUE_TTL.briefed + 1; m++) G.step();
  assert.ok(!g.issues.some((i) => i.type === t && i.id.endsWith('_init')), 'lapsed');
  assert.ok(!g.briefs[t], 'brief dropped');
  assert.ok(g.actionCooldowns[`issue_${t}`] > 0, 'type cools down before it can return');
  G.done();
});

// Per brief: every option, deployed vs not deployed on the same seed, moves each promised stat the promised way (>=60% of the delta).
for (const [type, def] of Object.entries(ISSUES)) {
  const probe = game(1, 0); const opts = def.brief(probe.g.stats, probe.g.country).opts; probe.done();
  for (const o of opts) {
    test(`brief ${type}/${o.id}: deploy changes state measurably over ${o.tm} months`, () => {
      const run = (deploy) => {
        const G = game(1, 0); const { g } = G;
        g.briefs = { [type]: def.brief(g.stats, g.country) };
        g.issues = [{ type, id: `${type}_t`, status: 'briefed', yr: 2024, mo: 0, born: 0, ttl: 12 }];
        g.stats = { ...g.stats, treasury: 50000 };
        const t0 = g.deployments.length;
        if (deploy) G.act({ type: 'deployPolicy', payload: { issue: type, option: o.id } });
        for (let m = 0; m < o.tm; m++) G.step();
        const out = { stats: { ...g.stats }, issue: g.issues.find((i) => i.type === type), dep: g.deployments.length - t0 };
        G.done(); return out;
      };
      const a = run(true), b = run(false);
      assert.equal(a.dep, 1, 'one deployment recorded');
      assert.equal(a.issue, undefined, 'deployed issue resolves when the program completes');
      assert.notEqual(b.issue?.status, 'deployed', 'control run never deploys');
      for (const e of o.fx) {
        const got = a.stats[e.s] - b.stats[e.s];
        assert.ok(Math.sign(got) === Math.sign(e.d) && Math.abs(got) >= 0.6 * Math.abs(e.d), `${e.s}: want ${e.d}, got ${got.toFixed(2)}`);
      }
    });
  }
}

test('outliner: unexamined and briefed issues are rows with a lapse timer; cooldown bookkeeping stays hidden', async () => {
  const { buildOutliner } = await import('../src/ui/shell/outliner.js');
  const rows = buildOutliner({ issues: [{ type: 'high_inflation', status: 'unexamined', ttl: 9 }, { type: 'debt_sustainability', status: 'briefed', ttl: 2 }], actionCooldowns: { issue_next: 5, issue_high_inflation: 3 } });
  const a = rows.find((r) => r.id === 'iss_high_inflation'), b = rows.find((r) => r.id === 'iss_debt_sustainability');
  assert.equal(a.months, 9); assert.equal(a.sev, 'warn'); assert.deepEqual(a.jump, { tab: 'intel', issue: 'high_inflation' });
  assert.equal(b.sev, 'alert'); assert.match(b.title, /Brief ready/);
  assert.ok(!rows.some((r) => r.group === 'cooldowns'), 'issue_* cooldowns are not rows');
});

// UI loop in the real App bundle (jsdom): Intel tab lists the issue, Examine -> ready-brief card -> Deploy -> deployed row with why-chips.
test('UI: Intel tab issue list -> examine -> brief card -> deploy shows delivered-of-promised', async () => {
  const { mount, BUNDLES, flush } = await import('./util/harness.js');
  const origErr = console.error; console.error = () => {};
  const g = await mount(BUNDLES.app, { seed: 5, testHook: true });
  try {
    await g.pickCountry(0);
    await g.advance(1);
    g.tabBtn('intel').click(); await flush();
    const panel = () => g.doc.querySelector('[data-issues-panel]');
    assert.ok(panel(), 'issues panel is on the Intel tab');
    const rows = () => [...g.doc.querySelectorAll('[data-issue]')];
    assert.ok(rows().length >= 1, 'preloaded issues are listed');
    assert.match(rows()[0].textContent, /\d+mo left/, 'unexamined issue shows its lapse timer');
    rows()[0].querySelector('button').click(); await flush();
    [...rows()[0].querySelectorAll('button')].find((b) => /Examine/.test(b.textContent)).click(); await flush();
    assert.equal(rows()[0].getAttribute('data-issue-status'), 'investigating');
    await g.advance(2);
    assert.ok(g.doc.querySelector('[data-event-card=brief]'), 'a ready brief shows as a card');
    assert.equal(rows()[0].getAttribute('data-issue-status'), 'briefed');
    const dep = [...rows()[0].querySelectorAll('button')].find((b) => /Deploy ·/.test(b.textContent)); assert.ok(dep, 'options are deployable from the Intel tab');
    dep.click(); await flush();
    await g.advance(2);
    assert.equal(g.doc.querySelector('[data-event-card=brief]'), null, 'card goes away once deployed');
    const open = rows()[0]; if (open.querySelector('button').getAttribute('aria-expanded') !== 'true') { open.querySelector('button').click(); await flush(); }
    assert.match(g.doc.querySelector('[data-why-deploy]')?.textContent || '', / of /, 'why-chips show delivered of promised');
  } finally { console.error = origErr; g.close(); }
});
