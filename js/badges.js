import { D, unitIdsForLic } from './data.js';
import { toast } from './ui.js';

export const BADGES = [
  { key: 'first',    emoji: '🚦', name: 'יוצאים לדרך',       desc: 'המענה הראשון על שאלה' },
  { key: 'q100',     emoji: '💯', name: 'מאה ראשונות',       desc: '100 שאלות נענו' },
  { key: 'q500',     emoji: '🛣️', name: '500 שאלות',         desc: '500 שאלות נענו' },
  { key: 'q1000',    emoji: '🏁', name: 'אלף שאלות',         desc: '1,000 שאלות נענו' },
  { key: 'streak3',  emoji: '🔥', name: '3 ימים ברצף',       desc: 'לימוד שלושה ימים רצופים' },
  { key: 'streak7',  emoji: '🔥', name: 'שבוע ברצף',         desc: 'לימוד שבעה ימים רצופים' },
  { key: 'streak14', emoji: '⚡', name: 'שבועיים ברצף',      desc: 'לימוד 14 ימים רצופים' },
  { key: 'streak30', emoji: '👑', name: 'חודש ברצף',         desc: 'לימוד 30 ימים רצופים' },
  { key: 'combo10',  emoji: '🎯', name: '10 נכונות ברצף',    desc: 'עשר תשובות נכונות ברצף בסבב אחד' },
  { key: 'exam1',    emoji: '📝', name: 'מבחן דמה ראשון',    desc: 'סיום מבחן דמה' },
  { key: 'examPass', emoji: '✅', name: 'מבחן דמה עובר',     desc: '26 תשובות נכונות ומעלה' },
  { key: 'exam30',   emoji: '🏆', name: '30 מתוך 30',        desc: 'מבחן דמה ללא טעויות' },
  { key: 'unit1',    emoji: '⭐', name: 'יחידה נשלטת',       desc: 'שליטה בכל השאלות ביחידה' },
  { key: 'unit5',    emoji: '🌟', name: 'חמש יחידות נשלטות', desc: 'שליטה בכל השאלות בחמש יחידות' },
];
export const badgeByKey = Object.fromEntries(BADGES.map((b) => [b.key, b]));

export function totalAnswered(store) { return Object.values(store.state.log).reduce((s, d) => s + d.n, 0); }

export function masteredUnits(store) {
  const lic = store.state.profile.lic;
  return D.units.filter((u) => {
    const ids = unitIdsForLic(u, lic);
    return ids.length >= 5 && ids.every((id) => store.statusOf(id) === 'strong');
  }).length;
}

/** Evaluate all badge conditions; toast the new ones. ctx: { combo, exam } */
export function checkBadges(store, ctx = {}) {
  const earned = [];
  const give = (k) => { if (store.award(k)) earned.push(badgeByKey[k]); };
  const n = totalAnswered(store);
  if (n >= 1) give('first'); if (n >= 100) give('q100'); if (n >= 500) give('q500'); if (n >= 1000) give('q1000');
  const s = store.streak();
  if (s >= 3) give('streak3'); if (s >= 7) give('streak7'); if (s >= 14) give('streak14'); if (s >= 30) give('streak30');
  if ((ctx.combo || 0) >= 10) give('combo10');
  if (ctx.exam) {
    give('exam1');
    if (ctx.exam.passed) give('examPass');
    if (ctx.exam.correct === ctx.exam.total) give('exam30');
  }
  if (ctx.units !== false) { const m = masteredUnits(store); if (m >= 1) give('unit1'); if (m >= 5) give('unit5'); }
  for (const b of earned) toast(`${b.emoji} תג חדש: ${b.name}`, { tone: 'good', ms: 3800 });
  return earned;
}
