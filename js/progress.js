// Aggregations of learner progress per unit / category.
import { D, unitIdsForLic, idsForLic } from './data.js';
import { store } from './ctx.js';

export function countStatus(ids) {
  const c = { strong: 0, learning: 0, weak: 0, new: 0, total: ids.length, due: 0 };
  const today = store.today();
  for (const id of ids) {
    const st = store.statusOf(id);
    c[st]++;
    if (st !== 'new' && st !== 'weak' && store.isDue(id, today)) c.due++; // mistakes are counted as `weak`
  }
  c.seen = c.total - c.new;
  return c;
}
export const licOf = () => store.state.profile.lic;
export const unitCounts = (u) => countStatus(unitIdsForLic(u, licOf()));
export const catCounts = (cat) => countStatus(idsForLic(licOf(), (q) => q.cat === cat));
export const allCounts = () => countStatus(idsForLic(licOf()));

/** accuracy over all recorded attempts for a set of ids (null if none) */
export function accuracy(ids) {
  let r = 0, w = 0;
  for (const id of ids) { const x = store.rec(id); if (x) { r += x.r; w += x.w; } }
  return r + w ? { acc: r / (r + w), n: r + w } : null;
}

/** Suggested next unit: prefer in-progress units, else first untouched */
export function nextUnit(units) {
  let firstNew = null;
  for (const u of units) {
    const c = unitCounts(u);
    if (c.new === 0) continue;
    if (c.seen > 0) return u;
    if (!firstNew) firstNew = u;
  }
  return firstNew;
}
