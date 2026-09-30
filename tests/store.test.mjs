import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, dayNum, dayKey, INTERVALS } from '../js/store.js';
import { estimate, pCorrect } from '../js/readiness.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const T0 = new Date(2026, 8, 30, 12, 0, 0).getTime();
const DAY = 86400000;

test('leitner: right answers climb boxes and schedule reviews, wrong resets', () => {
  let t = T0; const s = createStore(mem(), () => t);
  assert.equal(s.statusOf(1), 'new');
  s.recordAnswer(1, true);
  assert.equal(s.rec(1).b, 1);
  assert.equal(s.rec(1).d, dayNum(T0) + INTERVALS[1]);
  assert.equal(s.statusOf(1), 'learning');
  s.recordAnswer(1, true); s.recordAnswer(1, true);
  assert.equal(s.statusOf(1), 'strong');
  s.recordAnswer(1, false);
  assert.equal(s.rec(1).b, 0);
  assert.equal(s.statusOf(1), 'weak');
  assert.ok(s.isDue(1));
  for (let i = 0; i < 9; i++) s.recordAnswer(2, true);
  assert.equal(s.rec(2).b, 5);
});

test('xp and daily log', () => {
  const s = createStore(mem(), () => T0);
  s.recordAnswer(1, true); s.recordAnswer(2, false);
  assert.equal(s.state.xp, 12);
  assert.equal(s.todayLog().n, 2);
  assert.equal(s.todayLog().r, 1);
});

test('streak counts consecutive days with >= min answers and survives an unfinished today', () => {
  let t = T0; const s = createStore(mem(), () => t);
  for (let d = 3; d >= 1; d--) { t = T0 - d * DAY; for (let i = 0; i < 5; i++) s.recordAnswer(100 + i, true); }
  t = T0; // today: nothing yet
  assert.equal(s.streak(), 3);
  for (let i = 0; i < 5; i++) s.recordAnswer(200 + i, true);
  assert.equal(s.streak(), 4);
  assert.equal(s.bestStreak(), 4);
  t = T0 + 2 * DAY; // skipped a whole day
  assert.equal(s.streak(), 0);
});

test('flags, level, persistence and backup round-trip', () => {
  const st = mem(); const a = createStore(st, () => T0);
  assert.equal(a.toggleFlag(5), true); assert.equal(a.toggleFlag(5), false); a.toggleFlag(7);
  a.recordAnswer(9, true); a.flush();
  const b = createStore(st, () => T0);
  assert.deepEqual(b.state.flags, [7]);
  assert.equal(b.rec(9).r, 1);
  const c = createStore(mem(), () => T0); c.importJSON(a.exportJSON());
  assert.deepEqual(c.state.flags, [7]);
  assert.throws(() => c.importJSON('{"x":1}'));
  assert.equal(createStore(mem()).level().level, 1);
});

test('corrupted storage falls back to defaults', () => {
  const st = mem(); st.setItem('road26.v1', '{not json');
  const s = createStore(st, () => T0);
  assert.equal(s.state.profile.lic, 'B');
});

test('readiness: monotone in knowledge, sane extremes', () => {
  const ids = Array.from({ length: 200 }, (_, i) => i + 1);
  const today = dayNum(T0);
  const none = estimate(ids, {}, today);
  assert.ok(none.pass < 0.001 && Math.abs(none.expected - 13.5) < 0.01);
  const mk = (b, r) => Object.fromEntries(ids.map((i) => [i, { b, d: today + 5, r, w: 0, l: 1, t: 0 }]));
  const mid = estimate(ids, mk(2, 2), today), top = estimate(ids, mk(5, 6), today);
  assert.ok(none.pass < mid.pass && mid.pass < top.pass);
  assert.ok(top.pass > 0.9, `top.pass=${top.pass}`);
  assert.ok(pCorrect({ b: 4, d: today - 60, r: 4, w: 0, l: 1 }, today) < pCorrect({ b: 4, d: today, r: 4, w: 0, l: 1 }, today));
  assert.equal(estimate([], {}, today).pass, 0);
});
