import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveGroups, questionIds, groupsForQuestion, groupStats, drillPlan, buildRounds } from '../js/confusable.js';
import { D } from '../js/data.js';
import { createStore } from '../js/store.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const qs = load('questions.json'), raw = load('confusable.json').groups;
D.questions = qs; D.byId = new Map(qs.map((q) => [q.id, q])); D.confusable = raw;
const memStore = () => { const m = new Map(); return createStore({ getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }); };

test('every group resolves for the private-car license with pictures, meanings and cues', () => {
  const groups = resolveGroups('B');
  assert.equal(groups.length, raw.length);
  for (const g of groups) {
    assert.ok(g.signs.length >= 2, g.id);
    assert.equal(new Set(g.signs.map((s) => s.img)).size, g.signs.length, `${g.id}: a picture appears twice`);
    for (const s of g.signs) assert.ok(s.img && s.meaning && s.cue, `${g.id}/${s.q}`);
  }
});

test('a sign whose question is not valid for the license is left out, and a group needs two signs', () => {
  const fake = [{ id: 'g', title: 't', tip: 'x', signs: [{ q: 1, cue: 'a' }, { q: 2, cue: 'b' }, { q: 3, cue: 'c' }] }];
  const byId = new Map([[1, { id: 1, img: 'a.jpg', a: ['m1'], c: 0, lic: ['B'], u: 'u' }], [2, { id: 2, img: 'b.jpg', a: ['m2'], c: 0, lic: ['A'], u: 'u' }], [3, { id: 3, img: 'c.jpg', a: ['m3'], c: 0, lic: ['B', 'A'], u: 'u' }]]);
  assert.deepEqual(resolveGroups('B', fake, byId)[0].signs.map((s) => s.q), [1, 3]);
  assert.equal(resolveGroups('A', fake, byId)[0].signs.length, 2);
  assert.equal(resolveGroups('C', fake, byId).length, 0);
});

test('the practice pool of a group contains every licensed question that shows one of its pictures, once', () => {
  for (const g of resolveGroups('B')) {
    const ids = questionIds(g, 'B');
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.length >= g.signs.length, `${g.id}: fewer questions than signs`);
    const imgs = new Set(g.signs.map((s) => s.img));
    for (const id of ids) { const q = D.byId.get(id); assert.ok(imgs.has(q.img) && q.lic.includes('B')); }
    for (const s of g.signs) assert.ok(ids.includes(s.q), `${g.id}: the sign's own question is in the pool`);
  }
});

test('a question links to the group of its picture', () => {
  const groups = resolveGroups('B');
  const stop = D.byId.get(184);
  assert.ok(groupsForQuestion(stop, 'B', groups).some((g) => g.id === 'stop-yield'));
  assert.deepEqual(groupsForQuestion({ id: 1 }, 'B', groups), []);
});

test('the drill starts from the groups where the learner made mistakes and keeps look-alikes together', () => {
  const st = memStore(), groups = resolveGroups('B');
  const target = groups.find((g) => g.id === 'overtaking'), pool = questionIds(target, 'B');
  st.recordAnswer(pool[0], false); st.recordAnswer(pool[1], false);
  for (const id of questionIds(groups.find((g) => g.id === 'speed'), 'B').slice(0, 3)) st.recordAnswer(id, true);
  const plan = drillPlan('B', { limit: 15, st });
  assert.equal(plan.basis, 'mistakes');
  assert.equal(plan.parts[0].group.id, 'overtaking');
  assert.ok(plan.parts[0].ids.includes(pool[0]) && plan.parts[0].ids.includes(pool[1]), 'the mistakes are in the drill');
  assert.ok(plan.ids.length > 0 && plan.ids.length <= 15);
  assert.equal(new Set(plan.ids).size, plan.ids.length);
  // each group's questions are one contiguous block
  const flat = plan.parts.flatMap((p) => p.ids);
  assert.deepEqual(flat, plan.ids);
  assert.equal(groupStats(target, 'B', st).weak, 2);
});

test('a learner with no history gets the first groups of the curated list', () => {
  const plan = drillPlan('B', { limit: 12, st: memStore() });
  assert.equal(plan.basis, 'new');
  assert.equal(plan.parts[0].group.id, raw[0].id);
  assert.ok(plan.ids.length >= 8 && plan.ids.length <= 12);
});

test('reviews that are due count after mistakes but before new material', () => {
  const st = memStore(), groups = resolveGroups('B');
  const gDue = groups.find((g) => g.id === 'lights'), ids = questionIds(gDue, 'B');
  st.recordAnswer(ids[0], true); // answered right today: not yet due
  st.state.q[ids[0]].d = st.today() - 1; // ... and now it is due
  const stats = groupStats(gDue, 'B', st);
  assert.equal(stats.due, 1); assert.equal(stats.weak, 0);
  const plan = drillPlan('B', { limit: 10, st });
  assert.equal(plan.basis, 'due'); assert.equal(plan.parts[0].group.id, 'lights');
});

test('the game asks each sign once with the right one among the options', () => {
  for (const g of resolveGroups('B')) {
    const rounds = buildRounds(g);
    assert.equal(rounds.length, Math.min(8, g.signs.length));
    assert.equal(new Set(rounds.map((r) => r.target.q)).size, rounds.length);
    for (const r of rounds) {
      assert.ok(r.options.includes(r.target));
      assert.equal(new Set(r.options.map((o) => o.q)).size, r.options.length);
      assert.equal(r.options.length, Math.min(4, g.signs.length));
    }
  }
  // deterministic with a fixed generator
  const g = resolveGroups('B')[0];
  const seq = () => { let i = 0; return () => ((i = (i * 7 + 3) % 10) / 10); };
  assert.deepEqual(buildRounds(g, { rnd: seq() }).map((r) => r.target.q), buildRounds(g, { rnd: seq() }).map((r) => r.target.q));
});
