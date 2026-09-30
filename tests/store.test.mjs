import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, dayNum, dayKey, INTERVALS } from '../js/store.js';
import { estimate, pCorrect } from '../js/readiness.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const T0 = new Date(2026, 8, 30, 12, 0, 0).getTime();
const DAY = 86400000;

test('leitner: a correct answer advances the box only when the question was due; wrong resets', () => {
  let t = T0; const s = createStore(mem(), () => t);
  assert.equal(s.statusOf(1), 'new');
  s.recordAnswer(1, true);
  assert.equal(s.rec(1).b, 1);
  assert.equal(s.rec(1).d, dayNum(T0) + INTERVALS[1]);
  assert.equal(s.statusOf(1), 'learning');
  // cramming: answering it again the same day does NOT promote it
  s.recordAnswer(1, true); s.recordAnswer(1, true);
  assert.equal(s.rec(1).b, 1);
  assert.equal(s.statusOf(1), 'learning');
  // when it is due (next day, then day 1+3, ...) it climbs
  t = T0 + DAY; s.recordAnswer(1, true); assert.equal(s.rec(1).b, 2);
  t = T0 + 4 * DAY; s.recordAnswer(1, true); assert.equal(s.rec(1).b, 3);
  assert.equal(s.statusOf(1), 'strong');
  s.recordAnswer(1, false);
  assert.equal(s.rec(1).b, 0);
  assert.equal(s.statusOf(1), 'weak');
  assert.ok(s.isDue(1));
  // a mistake answered right in the same sitting (retry) goes back to box 1
  s.recordAnswer(1, true); assert.equal(s.rec(1).b, 1);
  let day = 0; for (let i = 0; i < 9; i++) { day += 40; t = T0 + (10 + day) * DAY; s.recordAnswer(2, true); }
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

test('two tabs: a stale idle tab never overwrites newer progress; a busy tab merges', () => {
  const st = mem();
  const a = createStore(st, () => T0), b = createStore(st, () => T0);   // same storage = two tabs
  b.recordAnswer(5, true); b.recordAnswer(6, false); b.flush();
  a.flush();                                       // A changed nothing: must not write
  assert.equal(createStore(st, () => T0).state.xp, 12);
  a.recordAnswer(7, true);                         // A has an unsaved change while B's progress is in storage
  a.reloadFromStorage();                           // -> merge, nothing lost
  assert.ok(a.rec(5) && a.rec(6) && a.rec(7));
  a.flush();
  const c = createStore(st, () => T0);
  assert.ok(c.rec(5) && c.rec(6) && c.rec(7));
  assert.equal(c.state.xp, 22);
});

test('backup import validates and sanitises', () => {
  const s = createStore(mem(), () => T0);
  const good = s.parseBackup(JSON.stringify({ profile: { lic: 'Z', fontScale: 50, dailyGoal: 7, theme: 'x', name: 'x'.repeat(99) }, q: {}, flags: 'abc', exams: {}, xp: 'NaN' }));
  assert.equal(good.profile.lic, 'B'); assert.equal(good.profile.fontScale, 1.3); assert.equal(good.profile.dailyGoal, 20);
  assert.equal(good.profile.theme, 'auto'); assert.equal(good.profile.name.length, 24);
  assert.deepEqual(good.flags, []); assert.deepEqual(good.exams, []); assert.equal(good.xp, 0);
  assert.throws(() => s.parseBackup('{"q":[],"profile":{}}'));
  assert.throws(() => s.parseBackup('not json'));
  assert.equal(s.state.xp, 0); // parsing alone changes nothing
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

test('readiness blends in recent full mock exams (focus exams are ignored)', () => {
  const ids = Array.from({ length: 200 }, (_, i) => i + 1), today = dayNum(T0);
  const mk = (correct, kind = 'full') => ({ kind, correct, total: 30 });
  const base = estimate(ids, {}, today);
  assert.equal(estimate(ids, {}, today, [mk(29, 'focus')]).pass, base.pass);       // biased sample: ignored
  const one = estimate(ids, {}, today, [mk(27)]), three = estimate(ids, {}, today, [mk(27), mk(28), mk(27)]);
  assert.ok(one.pass > base.pass && three.pass > one.pass);
  assert.ok(three.expected > 24 && three.mocks === 3);
  assert.ok(estimate(ids, {}, today, [mk(15), mk(14), mk(16)]).pass < 0.01);
});

test('streak walks calendar days, not 24h steps (DST safe)', () => {
  for (const tz of ['Asia/Jerusalem']) {
    const saved = process.env.TZ; process.env.TZ = tz;
    try {
      let t = new Date(2026, 9, 25, 23, 30).getTime();     // 25 Oct 2026 is the 25-hour day in Israel
      const s = createStore(mem(), () => t);
      for (const d of [22, 23, 24, 25]) { t = new Date(2026, 9, d, 12).getTime(); for (let i = 0; i < 5; i++) s.recordAnswer(100 + i + d * 10, true); }
      t = new Date(2026, 9, 25, 23, 30).getTime();
      assert.equal(s.streak(), 4);
      t = new Date(2026, 9, 26, 0, 30).getTime();
      assert.equal(s.streak(), 4);
    } finally { if (saved === undefined) delete process.env.TZ; else process.env.TZ = saved; }
  }
});
