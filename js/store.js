// Persistent learner state + spaced-repetition (Leitner boxes). Pure logic, storage is injected so it can be unit-tested.
import { APP } from './config.js';

const DAY = 86400000;
export const INTERVALS = [0, 1, 3, 7, 14, 30]; // days until next review, per Leitner box 0..5
export const MAX_BOX = 5;
export const XP = { right: 10, wrong: 2 };

export const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
// Local calendar day as an integer (days since epoch, in local time) – stable across DST.
export const dayNum = (ts) => { const d = new Date(ts); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY); };

export const defaultState = () => ({
  v: 1,
  created: Date.now(),
  profile: { name: '', lic: 'B', shuffle: true, tts: false, theme: 'auto', dailyGoal: 20, examDate: '', fontScale: 1, onboarded: false, examExtra: 0 },
  q: {},          // id -> { b: box, d: due day, r: right, w: wrong, l: last result 1/0, t: last ts }
  flags: [],      // bookmarked question ids
  exams: [],      // finished exam results
  log: {},        // 'YYYY-MM-DD' -> { n: answered, r: right, x: xp, ms: time }
  xp: 0,
  badges: {},     // key -> ts earned
  activeExam: null,
});

export function createStore(storage, now = () => Date.now()) {
  const KEY = APP.storageKey;
  let state = load();
  const listeners = new Set();

  function load() {
    try {
      const raw = storage && storage.getItem(KEY);
      if (raw) return migrate(JSON.parse(raw));
    } catch (e) { /* corrupted or blocked storage: start fresh */ }
    return defaultState();
  }
  function migrate(s) {
    const d = defaultState();
    return {
      ...d, ...s,
      profile: { ...d.profile, ...(s.profile || {}) },
      q: s.q || {}, flags: s.flags || [], exams: s.exams || [], log: s.log || {}, badges: s.badges || {},
    };
  }
  let saveTimer = null;
  function persist(immediate = false) {
    const write = () => { saveTimer = null; try { storage && storage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* quota / private mode */ } };
    if (immediate) { if (saveTimer) clearTimeout(saveTimer); write(); return; }
    if (!saveTimer) saveTimer = setTimeout(write, 150);
  }
  function emit() { listeners.forEach((fn) => fn(state)); }
  function commit(immediate) { persist(immediate); emit(); }

  const api = {
    get state() { return state; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    flush() { persist(true); },
    today() { return dayNum(now()); },

    // ---- profile -------------------------------------------------------
    setProfile(patch) { state.profile = { ...state.profile, ...patch }; commit(true); },

    // ---- answers / spaced repetition ----------------------------------
    rec(id) { return state.q[id]; },
    statusOf(id) {
      const r = state.q[id];
      if (!r) return 'new';
      if (r.l === 0) return 'weak';
      return r.b >= 3 ? 'strong' : 'learning';
    },
    isDue(id, today = api.today()) { const r = state.q[id]; return !!r && r.d <= today; },

    /** Record one answer. Returns { xp, rec } */
    recordAnswer(id, ok, { ms = 0, xpBonus = 0 } = {}) {
      const t = now(), today = dayNum(t);
      const r = state.q[id] || (state.q[id] = { b: 0, d: today, r: 0, w: 0, l: -1, t: 0 });
      if (ok) { r.r++; r.b = Math.min(MAX_BOX, r.b + 1); r.d = today + INTERVALS[r.b]; }
      else { r.w++; r.b = 0; r.d = today; }
      r.l = ok ? 1 : 0; r.t = t;
      const gain = (ok ? XP.right : XP.wrong) + xpBonus;
      state.xp += gain;
      const k = dayKey(t);
      const day = state.log[k] || (state.log[k] = { n: 0, r: 0, x: 0, ms: 0 });
      day.n++; if (ok) day.r++; day.x += gain; day.ms += Math.min(ms, 120000);
      commit(false);
      return { xp: gain, rec: r };
    },

    // ---- bookmarks -----------------------------------------------------
    isFlagged(id) { return state.flags.includes(id); },
    toggleFlag(id) {
      const i = state.flags.indexOf(id);
      if (i >= 0) state.flags.splice(i, 1); else state.flags.push(id);
      commit(true);
      return i < 0;
    },

    // ---- exams ---------------------------------------------------------
    setActiveExam(e) { state.activeExam = e; commit(true); },
    saveActiveExamSilently(e) { state.activeExam = e; persist(false); },
    addExam(result) { state.exams.push(result); state.activeExam = null; commit(true); return state.exams.length - 1; },

    // ---- streaks & daily activity ---------------------------------------
    todayLog() { return state.log[dayKey(now())] || { n: 0, r: 0, x: 0, ms: 0 }; },
    streak() {
      const min = APP.streakMinAnswers;
      const counted = (ts) => (state.log[dayKey(ts)]?.n || 0) >= min;
      let t = now(), s = 0;
      if (!counted(t)) t -= DAY; // today may not have reached the minimum yet – the streak is still alive
      while (counted(t)) { s++; t -= DAY; if (s > 4000) break; }
      return s;
    },
    bestStreak() {
      const days = Object.keys(state.log).filter((k) => state.log[k].n >= APP.streakMinAnswers).sort();
      let best = 0, run = 0, prev = null;
      for (const k of days) {
        const [y, m, d] = k.split('-').map(Number);
        const n = Math.round(Date.UTC(y, m - 1, d) / DAY);
        run = prev !== null && n === prev + 1 ? run + 1 : 1;
        best = Math.max(best, run); prev = n;
      }
      return best;
    },
    level() { // level n needs 100*n*(n-1)/2 xp  -> 0,100,300,600,...
      let l = 1; while (state.xp >= 50 * (l + 1) * l) l++;
      const floor = 50 * l * (l - 1), ceil = 50 * (l + 1) * l;
      return { level: l, into: state.xp - floor, span: ceil - floor };
    },

    // ---- badges --------------------------------------------------------
    award(key) { if (state.badges[key]) return false; state.badges[key] = now(); commit(true); return true; },

    // ---- backup --------------------------------------------------------
    exportJSON() { return JSON.stringify({ app: APP.storageKey, exported: now(), state }, null, 1); },
    importJSON(text) {
      const obj = JSON.parse(text);
      const s = obj && obj.state ? obj.state : obj;
      if (!s || typeof s !== 'object' || typeof s.q !== 'object' || !s.profile) throw new Error('invalid backup file');
      state = migrate(s);
      commit(true);
    },
    reset() { state = defaultState(); commit(true); },
  };
  return api;
}

/** Safe wrapper: localStorage may throw (private mode, blocked cookies) -> fall back to memory. */
export function safeStorage() {
  try {
    const k = '__t'; window.localStorage.setItem(k, '1'); window.localStorage.removeItem(k);
    return window.localStorage;
  } catch (e) {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  }
}
