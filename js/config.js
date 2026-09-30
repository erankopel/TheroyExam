// Central configuration. Edit here to rename the app or change exam rules.
export const APP = {
  name: 'הדרך ל־26',
  tagline: 'הכנה למבחן התיאוריה',
  version: '1.0.0',
  storageKey: 'road26.v1',
  exam: { questions: 30, minutes: 40, passScore: 26 }, // official computerized theory test
  streakMinAnswers: 5, // answers needed for a day to count towards the streak
  sourceNote: 'מאגר השאלות והתשובות הרשמי – משרד התחבורה והבטיחות בדרכים',
  sourceUrl: 'https://www.gov.il/he/pages/theoretical_test_qa_database',
};

export const LICENSES = [
  { key: 'B', label: 'רכב פרטי', short: 'B', icon: '🚗' },
  { key: 'A', label: 'אופנוע', short: 'A', icon: '🏍️' },
  { key: 'C1', label: 'משאית עד 12 טון', short: 'C1', icon: '🚚' },
  { key: 'C', label: 'משאית מעל 12 טון', short: 'C', icon: '🚛' },
  { key: 'D', label: 'אוטובוס / מונית', short: 'D', icon: '🚌' },
  { key: '1', label: 'טרקטור', short: '1', icon: '🚜' },
];

// Official categories of the question bank.
export const CATS = {
  law:     { key: 'law',     title: 'חוקי התנועה', short: 'חוקים',   color: 'var(--c-law)',     emoji: '⚖️' },
  safety:  { key: 'safety',  title: 'בטיחות',       short: 'בטיחות',  color: 'var(--c-safety)',  emoji: '🛟' },
  signs:   { key: 'signs',   title: 'תמרורים',      short: 'תמרורים', color: 'var(--c-signs)',   emoji: '🛑' },
  vehicle: { key: 'vehicle', title: 'הכרת הרכב',    short: 'הרכב',    color: 'var(--c-vehicle)', emoji: '🔧' },
};
export const CAT_ORDER = ['law', 'signs', 'safety', 'vehicle'];

// Hebrew answer letters: א ב ג ד
export const LETTERS = ['א', 'ב', 'ג', 'ד'];
