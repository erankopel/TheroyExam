// Pass-probability estimate: how likely is a random exam to score >= passScore, given what the learner has practised.
import { APP } from './config.js';

const P_BOX = [0.30, 0.62, 0.78, 0.88, 0.94, 0.97];
export const P_NEW = 0.45; // an unseen question: chance is 25%, common sense lifts it

/** Probability that the learner answers this question correctly right now. */
export function pCorrect(rec, today) {
  if (!rec) return P_NEW;
  const hist = (rec.r + 1) / (rec.r + rec.w + 2);
  let p = 0.5 * P_BOX[rec.b] + 0.5 * hist;
  if (rec.b >= 1) { const overdue = Math.max(0, today - rec.d); p *= Math.max(0.8, 1 - 0.01 * overdue); }
  return Math.min(0.99, Math.max(0.05, p));
}

function binomTailAtLeast(n, p, k) {
  // P[X >= k], X ~ Bin(n, p)
  let sum = 0, c = 1; // c = C(n, i)
  const pmf = [];
  for (let i = 0; i <= n; i++) {
    pmf.push(c * Math.pow(p, i) * Math.pow(1 - p, n - i));
    c = (c * (n - i)) / (i + 1);
  }
  for (let i = k; i <= n; i++) sum += pmf[i];
  return Math.min(1, Math.max(0, sum));
}

/**
 * @param ids    question ids relevant for the learner's license class
 * @param recs   map id -> record from the store
 * @param exams  finished mock exams of this license (optional). Full (random) mock exams are the best evidence of how a
 *               random real exam will go, so they are blended into the per-question model.
 */
export function estimate(ids, recs, today, exams = []) {
  const { questions: n, passScore } = APP.exam;
  if (!ids.length) return { pAvg: 0, expected: 0, pass: 0, seen: 0, total: 0, mastered: 0, mocks: 0, mockAvg: null };
  let sum = 0, seen = 0, mastered = 0;
  for (const id of ids) {
    const r = recs[id];
    if (r) { seen++; if (r.l === 1 && r.b >= 3) mastered++; }
    sum += pCorrect(r, today);
  }
  let pAvg = sum / ids.length;
  const mocks = exams.filter((e) => e.kind !== 'focus' && e.total > 0).slice(-5);
  let mockAvg = null;
  if (mocks.length) {
    const c = mocks.reduce((s, e) => s + e.correct, 0), t = mocks.reduce((s, e) => s + e.total, 0);
    const w = Math.min(0.9, 0.3 * mocks.length); // one mock is noisy, three or more dominate
    pAvg = w * (c / t) + (1 - w) * pAvg;
    mockAvg = (c / t) * n;
  }
  return { pAvg, expected: pAvg * n, pass: binomTailAtLeast(n, pAvg, passScore), seen, total: ids.length, mastered, mocks: mocks.length, mockAvg };
}

export function readinessLabel(pass) {
  if (pass >= 0.9) return { key: 'ready', text: 'מוכנות מלאה למבחן!', tone: 'good' };
  if (pass >= 0.7) return { key: 'almost', text: 'כמעט שם', tone: 'good' };
  if (pass >= 0.4) return { key: 'mid', text: 'בדרך הנכונה', tone: 'warn' };
  if (pass >= 0.15) return { key: 'early', text: 'עוד קצת עבודה', tone: 'warn' };
  return { key: 'start', text: 'בתחילת הדרך', tone: 'brand' };
}
