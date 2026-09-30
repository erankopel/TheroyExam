// Practice-session model: queue building + the shared "current session" object.
import { D } from './data.js';
import { store, go } from './ctx.js';
import { shuffle } from './ui.js';

export const session = { current: null };

const RANK = { weak: 0, due: 1, new: 2, learning: 3, strong: 4 };

/** Order ids for a smart session: mistakes first, then due for review, unseen, then the rest. */
export function smartOrder(ids) {
  const today = store.today();
  const buckets = [[], [], [], [], []];
  for (const id of ids) {
    const st = store.statusOf(id);
    const key = st === 'weak' ? 'weak' : st === 'new' ? 'new' : store.isDue(id, today) ? 'due' : st;
    buckets[RANK[key]].push(id);
  }
  return buckets.flatMap((b) => shuffle(b));
}

/**
 * @param o { title, ids, mode: 'smart'|'seq'|'random', limit, back, kind }
 */
export function startPractice(o) {
  let ids = o.ids.slice();
  if (!ids.length) return false;
  const mode = o.mode || 'smart';
  if (mode === 'seq') ids.sort((a, b) => a - b);
  else if (mode === 'random') ids = shuffle(ids);
  else ids = smartOrder(ids);
  if (o.limit && ids.length > o.limit) ids = ids.slice(0, o.limit);
  session.current = {
    title: o.title || 'תרגול', kind: o.kind || 'practice', spec: { ...o, ids: o.ids },
    queue: ids, i: 0, results: [], retried: new Set(), xp: 0, combo: 0, bestCombo: 0,
    back: o.back || '/learn', startedAt: Date.now(), done: false,
  };
  go('/practice');
  return true;
}

export function restart() {
  const s = session.current; if (!s) return;
  startPractice({ ...s.spec });
}
