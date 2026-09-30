// Groups of easily confused road signs (data/confusable.json): resolution against the bank, the learner's own
// mistakes per group, the "smart drill" planner and the rounds of the "which one?" game. Pure functions, no DOM.
import { D } from './data.js';
import { store } from './ctx.js';
import { smartOrder } from './session.js';
import { shuffle } from './ui.js';

const imgIndexCache = new WeakMap();
/** picture file -> ids of all questions that show it (a sign can be asked about in several questions) */
function imgIndex(questions) {
  let m = imgIndexCache.get(questions);
  if (!m) {
    m = new Map();
    for (const q of questions) if (q.img && q.cat === 'signs') { const l = m.get(q.img); if (l) l.push(q.id); else m.set(q.img, [q.id]); }
    imgIndexCache.set(questions, m);
  }
  return m;
}

/**
 * The groups that make sense for a license class: every sign gets its picture, official meaning (from the bank) and the
 * visual cue. Signs whose question is not valid for the license are left out, and a group needs at least two signs.
 */
export function resolveGroups(lic, raw = D.confusable, byId = D.byId) {
  const out = [];
  for (const g of raw || []) {
    const signs = [];
    for (const s of g.signs) {
      const q = byId.get(s.q);
      if (q && q.img && q.lic.includes(lic)) signs.push({ q: q.id, img: q.img, meaning: q.a[q.c], cue: s.cue, unit: q.u });
    }
    if (signs.length >= 2) out.push({ id: g.id, title: g.title, tip: g.tip, signs, order: out.length });
  }
  return out;
}

/** every question (valid for the license) that shows one of the group's pictures: the practice pool of the group */
export function questionIds(group, lic, questions = D.questions) {
  const idx = imgIndex(questions), seen = new Set(), ids = [];
  for (const s of group.signs) for (const id of idx.get(s.img) || []) {
    if (seen.has(id)) continue;
    seen.add(id);
    const q = D.byId.get(id);
    if (q && q.lic.includes(lic)) ids.push(id);
  }
  return ids.sort((a, b) => a - b);
}

/** the group(s) that contain the picture of this question (for the "similar signs" link) */
export function groupsForQuestion(q, lic, groups = resolveGroups(lic)) {
  if (!q || !q.img) return [];
  return groups.filter((g) => g.signs.some((s) => s.img === q.img));
}

/** how the learner stands on a group's questions */
export function groupStats(group, lic, st = store) {
  const ids = questionIds(group, lic), today = st.today();
  const s = { total: ids.length, weak: 0, due: 0, fresh: 0, strong: 0, mistakes: 0 };
  for (const id of ids) {
    const status = st.statusOf(id);
    if (status === 'new') { s.fresh++; continue; }
    if (status === 'weak') s.weak++;
    else if (status === 'strong') s.strong++;
    if (status !== 'weak' && st.isDue(id, today)) s.due++;
    s.mistakes += (st.rec(id) || {}).w || 0;
  }
  return s;
}

/** the mistake-heavy groups first (for the "worth another look" list) */
export const weakGroups = (groups, lic, st = store) => groups.filter((g) => groupStats(g, lic, st).weak > 0);

/**
 * The smart drill: fill `limit` questions from the groups that need the most attention. A group's score is its questions
 * that were answered wrongly last time (3 each), reviews that are due (1.5) and new material (0.3, capped), and the
 * curated order breaks ties. Questions of one group stay together so that the look-alike signs meet one after another.
 * Returns { ids, parts: [{ group, ids }], basis: 'mistakes' | 'due' | 'new' }.
 */
export function drillPlan(lic, { limit = 15, perGroup = 6, groups = resolveGroups(lic), st = store } = {}) {
  const scored = groups.map((g) => {
    const s = groupStats(g, lic, st);
    return { g, s, score: s.weak * 3 + s.due * 1.5 + Math.min(s.fresh, perGroup) * 0.3 };
  }).filter((x) => x.s.total > 0).sort((a, b) => b.score - a.score || a.g.order - b.g.order);
  const parts = [], used = new Set();
  let ids = [];
  for (const { g } of scored) {
    if (ids.length >= limit) break;
    const pool = questionIds(g, lic).filter((id) => !used.has(id));
    const take = smartOrder(pool, Math.min(perGroup, limit - ids.length, pool.length), 0.35);
    if (!take.length) continue;
    take.forEach((id) => used.add(id));
    parts.push({ group: g, ids: take });
    ids = ids.concat(take);
  }
  const top = scored[0];
  const basis = !top ? 'new' : top.s.weak > 0 ? 'mistakes' : top.s.due > 0 ? 'due' : 'new';
  return { ids, parts, basis };
}

/**
 * Rounds of the "which one?" game: each sign of the group is asked once (in random order), shown as its official meaning,
 * and the player picks the sign among up to `options` signs of the group (always including the right one).
 */
export function buildRounds(group, { options = 4, max = 8, rnd = Math.random } = {}) {
  const signs = group.signs;
  return shuffle(signs, rnd).slice(0, max).map((target) => {
    const others = shuffle(signs.filter((s) => s !== target), rnd).slice(0, Math.max(1, Math.min(options, signs.length) - 1));
    return { target, options: shuffle([target, ...others], rnd) };
  });
}
