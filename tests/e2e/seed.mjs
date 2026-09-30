// Builds a realistic localStorage state for screenshots: node tests/e2e/seed.mjs > seed.json
const now = Date.now(), DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const key = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const day = (t) => Math.round(Date.UTC(new Date(t).getFullYear(), new Date(t).getMonth(), new Date(t).getDate()) / DAY);
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const q = {}, log = {};
for (let id = 1; id <= 1800; id++) {
  if (rnd() > 0.32) continue;
  const r = rnd(); const b = r < .15 ? 0 : r < .45 ? 1 : r < .7 ? 2 : r < .9 ? 3 : 5;
  const right = b === 0 ? 1 : b + Math.floor(rnd() * 3), wrong = b === 0 ? 2 : Math.floor(rnd() * 2);
  q[id] = { b, d: day(now) + (rnd() < .2 ? -2 : 1 + Math.floor(rnd() * 20)), r: right, w: wrong, l: b === 0 ? 0 : 1, t: now - Math.floor(rnd() * 5) * DAY };
}
for (let i = 0; i < 26; i++) { if (i > 8 && rnd() < .4) continue; const n = Math.floor(5 + rnd() * 40); log[key(now - i * DAY)] = { n, r: Math.floor(n * .8), x: n * 9, ms: n * 18000 }; }
const exams = [21, 23, 24, 22, 26, 27, 25, 28].map((c, i) => ({ ts: now - (9 - i) * 2 * DAY, lic: 'B', kind: 'full', total: 30, correct: c, secs: 1500 + i * 30, passed: c >= 26, qs: [] }));
const state = { v: 1, created: now - 30 * DAY, profile: { name: 'נועה', lic: 'B', shuffle: true, tts: false, theme: 'auto', dailyGoal: 20, examDate: key(now + 12 * DAY), fontScale: 1, onboarded: true },
  q, flags: [12, 55, 130], exams, log, xp: 1840, badges: { first: now, q100: now, streak3: now, exam1: now, examPass: now, combo10: now }, activeExam: null };
console.log(JSON.stringify(state));
