// Mock theory exam: intro, run (timer, navigation, flagging) and result review.
import { h, icon, clear, sheet, confirmDialog, fmtTime, fmtDuration, shuffle, toast, countHe, fmtNum, keepFocus } from '../ui.js';
import { D, idsForLic } from '../data.js';
import { store, go } from '../ctx.js';
import { APP, LICENSES, CATS, CAT_ORDER } from '../config.js';
import { questionCard, makeOrder, stopSpeaking } from '../quiz.js';
import { startPractice } from '../session.js';
import { checkBadges } from '../badges.js';
import { confetti } from '../fx.js';
import { ringSvg } from '../charts.js';
import { wrongItem } from './practice.js';

const { questions: N, minutes: BASE_MIN, passScore: PASS } = APP.exam;
const minutesFor = () => Math.round(BASE_MIN * (1 + (store.state.profile.examExtra || 0) / 100));

/** Weighted sampling without replacement. */
function weightedSample(ids, weightOf, n) {
  const pool = ids.map((id) => ({ id, w: weightOf(id) }));
  const out = [];
  while (out.length < n && pool.length) {
    const tot = pool.reduce((s, p) => s + p.w, 0);
    let r = Math.random() * tot, k = 0;
    for (; k < pool.length - 1; k++) { r -= pool[k].w; if (r <= 0) break; }
    out.push(pool.splice(k, 1)[0].id);
  }
  return out;
}

function buildExam(kind) {
  const lic = store.state.profile.lic;
  const pool = idsForLic(lic);
  let ids;
  if (kind === 'focus') {
    const w = { weak: 6, due: 3, new: 3, learning: 2, strong: 0.4 };
    ids = weightedSample(pool, (id) => { const st = store.statusOf(id); return w[st === 'learning' && store.isDue(id) ? 'due' : st]; }, N);
  } else ids = shuffle(pool).slice(0, N);
  ids = shuffle(ids);
  const orders = {};
  ids.forEach((id) => { orders[id] = makeOrder(D.byId.get(id), store.state.profile.shuffle); });
  const start = Date.now(), mins = minutesFor();
  return { kind, lic, start, mins, deadline: start + mins * 60000, ids, orders, picks: {}, marks: {}, i: 0 };
}

// ---------------------------------------------------------------------------------
export function examIntroView() {
  const st = store.state, lic = LICENSES.find((l) => l.key === st.profile.lic);
  const active = st.activeExam;
  const pool = idsForLic(st.profile.lic).length;
  const hist = st.exams.slice(-5).reverse();
  const el = h('section', { class: 'page' },
    h('div', { class: 'page-head' }, h('h1', null, 'מבחן דמה'), h('p', { class: 'muted' }, 'בדיוק כמו במבחן הרשמי – בלי רמזים ובלי משוב עד הסוף')),
    h('div', { class: 'card exam-rules' },
      h('div', { class: 'rule' }, h('b', null, N), h('span', null, 'שאלות')),
      h('div', { class: 'rule' }, h('b', null, minutesFor()), h('span', null, minutesFor() !== BASE_MIN ? `דקות (כולל תוספת זמן)` : 'דקות')),
      h('div', { class: 'rule rule-pass' }, h('b', null, PASS), h('span', null, `נכונות לפחות (עד ${N - PASS} טעויות)`))),
    h('div', { class: 'card lic-line' }, h('span', { class: 'lic-emoji' }, lic.icon), h('div', { class: 'grow' }, h('b', null, `סוג רישיון: ${lic.label} (${lic.short})`), h('div', { class: 'muted small' }, `השאלות נבחרות אקראית מתוך ${fmtNum(pool)} שאלות רלוונטיות`)), h('a', { class: 'btn btn-ghost', href: '#/settings' }, 'שינוי')),
    active ? h('div', { class: 'card resume-card' },
      h('div', null, h('b', null, 'יש מבחן פתוח'), h('div', { class: 'muted small' }, `נענו ${Object.keys(active.picks).length} מתוך ${active.ids.length}`)),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn btn-ghost', onclick: async () => { if (await confirmDialog({ title: 'לבטל את המבחן הפתוח?', text: 'המבחן לא יישמר בהיסטוריה.', ok: 'כן, לבטל', cancel: 'חזרה', danger: true })) { store.setActiveExam(null); go('/exam'); } } }, 'ביטול המבחן'),
        h('button', { class: 'btn btn-primary', onclick: () => go('/exam/run') }, 'המשך מבחן', icon('next')))) : null,
    h('div', { class: 'grid grid-2' },
      h('button', { class: 'card choice', onclick: () => start('full') },
        h('span', { class: 'choice-ic', style: { '--cc': 'var(--brand)' } }, icon('exam')), h('b', null, 'מבחן מלא'), h('span', { class: 'muted' }, 'שאלות אקראיות מכל המאגר – כמו במבחן האמיתי')),
      h('button', { class: 'card choice', onclick: () => start('focus') },
        h('span', { class: 'choice-ic', style: { '--cc': 'var(--c-safety)' } }, icon('target')), h('b', null, 'מבחן ממוקד'), h('span', { class: 'muted' }, 'דגש על שאלות שטעיתם בהן או שעוד לא ראיתם'))),
    hist.length ? h('div', { class: 'card' }, h('h2', { class: 'sub' }, 'מבחנים אחרונים'),
      h('ul', { class: 'hist' }, ...hist.map((e, i) => {
        const idx = st.exams.length - 1 - i;
        return h('li', null, h('a', { href: `#/exam/result/${idx}`, class: `hist-row ${e.passed ? 'ok' : 'no'}` },
          h('span', { class: 'hist-badge' }, icon(e.passed ? 'check' : 'x')),
          h('span', { class: 'grow' }, `${e.correct}/${e.total}`, h('small', { class: 'muted' }, ` · ${new Date(e.ts).toLocaleDateString('he-IL')}`)),
          h('small', { class: 'muted' }, fmtDuration(e.secs)), icon('chevL')));
      }))) : null);
  function start(kind) {
    if (pool < N) return toast('אין מספיק שאלות לסוג הרישיון הזה', { tone: 'bad' });
    const go2 = () => { store.setActiveExam(buildExam(kind)); go('/exam/run'); };
    if (active) confirmDialog({ title: 'להתחיל מבחן חדש?', text: 'המבחן הפתוח יימחק.', ok: 'מבחן חדש' }).then((ok) => ok && go2()); else go2();
  }
  return { el };
}

// ---------------------------------------------------------------------------------
export function examRunView() {
  const root = h('section', { class: 'session exam' });
  const E = store.state.activeExam;
  let card = null, timer = null, keyHandler = null, finished = false;
  if (!E) { queueMicrotask(() => go('/exam', true)); return { el: root }; }
  if (Date.now() >= E.deadline) { queueMicrotask(() => finish(true)); return { el: root }; }

  const timeEl = h('span', { class: 'timer-t' }), timerBox = h('div', { class: 'timer', role: 'timer', 'aria-label': 'זמן שנותר' }, icon('clock'), timeEl);
  const count = h('button', { class: 'btn btn-ghost session-count nav-btn', 'aria-label': 'ניווט בין שאלות', onclick: openNav });
  const top = h('header', { class: 'session-top' },
    h('button', { class: 'btn btn-icon btn-ghost', 'aria-label': 'יציאה', onclick: leave }, icon('x')),
    timerBox, h('div', { class: 'grow' }), count);
  const body = h('div', { class: 'session-body' });
  const foot = h('footer', { class: 'session-foot exam-foot' });
  root.append(h('h1', { class: 'sr-only' }, 'מבחן דמה'), top, body, foot);

  function tick() {
    const left = Math.max(0, Math.round((E.deadline - Date.now()) / 1000));
    timeEl.textContent = fmtTime(left);
    timerBox.classList.toggle('warn', left <= 300); timerBox.classList.toggle('crit', left <= 60);
    if (left <= 0) finish(true);
  }
  timer = setInterval(tick, 500); tick();

  async function leave() {
    const ok = await confirmDialog({ title: 'לצאת מהמבחן?', text: 'המבחן נשמר והשעון ממשיך לרוץ. אפשר לחזור אליו מהמסך "מבחן דמה".', ok: 'יציאה', cancel: 'להישאר' });
    if (ok) go('/exam');
  }

  function show() {
    stopSpeaking();
    const id = E.ids[E.i], q = D.byId.get(id);
    clear(body); clear(foot);
    count.textContent = `${E.i + 1}/${E.ids.length}`;
    count.setAttribute('aria-label', `שאלה ${E.i + 1} מתוך ${E.ids.length}. פתיחת ניווט בין שאלות`);
    card = questionCard(q, {
      order: E.orders[id], picked: E.picks[id] ?? null, tag: false,
      onPick: (oi) => { E.picks[id] = oi; store.saveActiveExamSilently(E); card.update({ picked: oi }); paintFoot(); },
    });
    body.append(card.el);
    paintFoot();
    window.scrollTo({ top: 0 });
    const stem = card.el.querySelector('.stem'); if (stem) { stem.tabIndex = -1; stem.focus({ preventScroll: true }); } // announce the new question
  }
  function paintFoot() { keepFocus(foot, paintFootInner); }
  function paintFootInner() {
    clear(foot);
    const id = E.ids[E.i], last = E.i === E.ids.length - 1, marked = !!E.marks[id];
    foot.append(
      h('button', { class: 'btn btn-ghost', disabled: E.i === 0, onclick: () => go_(E.i - 1) }, icon('prev'), 'הקודמת'),
      h('button', { class: `btn btn-ghost mark-btn ${marked ? 'on' : ''}`, 'aria-pressed': String(marked), onclick: () => { if (marked) delete E.marks[id]; else E.marks[id] = 1; store.saveActiveExamSilently(E); paintFoot(); } }, icon('flag'), marked ? 'מסומנת' : 'סימון'),
      last ? h('button', { class: 'btn btn-primary', onclick: () => finish(false) }, 'סיום מבחן', icon('check'))
        : h('button', { class: `btn ${E.picks[id] != null ? 'btn-primary' : 'btn-ghost'}`, onclick: () => go_(E.i + 1) }, 'הבאה', icon('next')));
  }
  function go_(i) { E.i = Math.max(0, Math.min(E.ids.length - 1, i)); store.saveActiveExamSilently(E); show(); }

  function openNav() {
    sheet((b, close) => {
      const unanswered = E.ids.filter((id) => E.picks[id] == null).length;
      b.append(
        h('div', { class: 'nav-legend' }, h('span', { class: 'lg lg-a' }, 'נענתה'), h('span', { class: 'lg lg-m' }, 'מסומנת'), h('span', { class: 'lg lg-n' }, 'לא נענתה')),
        h('div', { class: 'nav-grid' }, E.ids.map((id, i) => h('button', {
          class: `nav-dot ${E.picks[id] != null ? 'ans' : ''} ${E.marks[id] ? 'marked' : ''} ${i === E.i ? 'cur' : ''}`, 'aria-current': i === E.i ? 'true' : null,
          'aria-label': `שאלה ${i + 1}${E.picks[id] != null ? ', נענתה' : ''}${E.marks[id] ? ', מסומנת' : ''}`,
          onclick: () => { close(); go_(i); } }, i + 1))),
        h('div', { class: 'row gap end', style: { marginTop: '16px' } },
          h('span', { class: 'muted grow' }, unanswered ? `${countHe(unanswered, 'שאלה אחת', 'שתי שאלות', 'שאלות')} עדיין ללא תשובה` : 'כל השאלות נענו'),
          h('button', { class: 'btn btn-primary', onclick: () => { close(); finish(false); } }, 'סיום מבחן')));
    }, { title: 'ניווט במבחן' });
  }

  async function finish(auto) {
    if (finished) return;
    if (!auto) {
      const un = E.ids.filter((id) => E.picks[id] == null).length;
      const ok = await confirmDialog({ title: 'לסיים את המבחן?', text: un ? `${un === 1 ? 'נותרה שאלה אחת' : un === 2 ? 'נותרו שתי שאלות' : `נותרו ${un} שאלות`} ללא תשובה. שאלה ללא תשובה נחשבת כטעות.` : 'אחרי הסיום אי אפשר לשנות תשובות.', ok: 'סיום והצגת ציון', cancel: 'חזרה למבחן' });
      if (!ok || finished) return; // the timer may have ended the exam while the dialog was open
    }
    finished = true; clearInterval(timer); document.removeEventListener('keydown', keyHandler);
    const qs = E.ids.map((id) => { const q = D.byId.get(id), p = E.picks[id]; return [id, p == null ? -1 : p, p === q.c ? 1 : 0]; });
    const correct = qs.reduce((s, x) => s + x[2], 0);
    const secs = Math.min((E.mins || BASE_MIN) * 60, Math.round((Date.now() - E.start) / 1000));
    const result = { ts: Date.now(), lic: E.lic, kind: E.kind, total: E.ids.length, correct, secs, passed: correct >= PASS, qs };
    const answered = qs.filter((x) => x[1] >= 0).length, per = answered ? Math.round((secs * 1000) / answered) : 0;
    qs.forEach(([id, p, ok]) => { if (p >= 0) store.recordAnswer(id, !!ok, { ms: per }); });
    const idx = store.addExam(result);
    checkBadges(store, { exam: result });
    go(`/exam/result/${idx}`, true);
  }

  keyHandler = (e) => {
    if (document.querySelector('.sheet-back') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[1-4]$/.test(e.key) && card) { const b = card.buttons[+e.key - 1]; if (b) b.click(); }
    else if (e.key === 'ArrowLeft') go_(E.i + 1);
    else if (e.key === 'ArrowRight') go_(E.i - 1);
  };
  document.addEventListener('keydown', keyHandler);
  show();
  return { el: root, focus: true, destroy() { clearInterval(timer); document.removeEventListener('keydown', keyHandler); stopSpeaking(); } };
}

// ---------------------------------------------------------------------------------
export function examResultView({ idx }) {
  const e = store.state.exams[+idx];
  if (!e) { queueMicrotask(() => go('/exam', true)); return { el: h('div') }; }
  const wrong = e.qs.filter((x) => !x[2]);
  const missing = Math.max(0, PASS - e.correct);
  if (e.passed && +idx === store.state.exams.length - 1 && Date.now() - e.ts < 8000) confetti(1.4);
  const byCat = {};
  e.qs.forEach(([id, , ok]) => { const c = D.byId.get(id).cat; (byCat[c] ||= { n: 0, r: 0 }); byCat[c].n++; byCat[c].r += ok; });
  let filter = 'wrong';
  const list = h('div', { class: 'review-list' });
  const tabs = h('div', { class: 'seg-ctl', role: 'group', 'aria-label': 'סינון' });
  function paint() { keepFocus(tabs, paintInner); }
  function paintInner() {
    clear(list); clear(tabs);
    [['wrong', `טעויות (${wrong.length})`], ['all', `כל השאלות (${e.qs.length})`]].forEach(([k, t]) => tabs.append(h('button', { 'aria-pressed': String(filter === k), class: filter === k ? 'on' : '', onclick: () => { filter = k; paint(); } }, t)));
    const rows = filter === 'wrong' ? wrong : e.qs;
    if (!rows.length) list.append(h('p', { class: 'muted center' }, 'אין טעויות – מבחן מושלם! 🏆'));
    rows.forEach(([id, pick, ok]) => list.append(reviewRow(D.byId.get(id), pick, !!ok)));
  }
  paint();
  const tone = e.passed ? 'good' : 'bad';
  const el = h('section', { class: 'page' },
    h('div', { class: `card result-hero ${tone}` },
      ringSvg(e.correct / e.total, { size: 150, stroke: 13, label: `${e.correct}/${e.total}`, sub: 'תשובות נכונות', tone }),
      h('div', { class: 'result-text' },
        h('h1', null, e.passed ? 'עברתם את מבחן הדמה!' : 'עוד לא הפעם'),
        h('p', null, e.passed
          ? (e.correct === e.total ? 'ציון מושלם. אין מה להוסיף.' : e.correct === PASS ? 'עברתם בדיוק על הסף. כדאי להמשיך לתרגל כדי לצבור ביטחון.' : `עברתם עם ${countHe(e.correct - PASS, 'תשובה אחת', 'שתי תשובות', 'תשובות')} מעל הסף. המשיכו לתרגל כדי לשמור על הרמה.`)
          : `${missing === 1 ? 'חסרה תשובה נכונה אחת' : missing === 2 ? 'חסרות שתי תשובות נכונות' : `חסרות ${missing} תשובות נכונות`} כדי להגיע ל־${PASS}. הטעויות למטה הן ההזדמנות ללמוד.`),
        h('div', { class: 'chips' }, h('span', { class: 'chip' }, icon('clock'), fmtDuration(e.secs)), h('span', { class: 'chip' }, new Date(e.ts).toLocaleDateString('he-IL')), e.kind === 'focus' ? h('span', { class: 'chip' }, 'מבחן ממוקד') : null))),
    h('div', { class: 'card' }, h('h2', { class: 'sub' }, 'לפי נושא'),
      h('div', { class: 'cat-bars' }, CAT_ORDER.filter((c) => byCat[c]).map((c) => h('div', { class: 'cat-bar', style: { '--cc': CATS[c].color } },
        h('span', { class: 'cb-name' }, CATS[c].title), h('span', { class: 'cb-track' }, h('i', { style: { width: `${(byCat[c].r / byCat[c].n) * 100}%` } })), h('span', { class: 'cb-val' }, `${byCat[c].r}/${byCat[c].n}`))))),
    h('div', { class: 'result-actions' },
      wrong.length ? h('button', { class: 'btn btn-lg btn-primary', onclick: () => startPractice({ title: 'טעויות מהמבחן', ids: wrong.map((x) => x[0]), mode: 'random', back: `/exam/result/${idx}`, kind: 'mistakes' }) }, icon('refresh'), 'תרגול הטעויות') : null,
      h('a', { class: 'btn btn-lg btn-ghost', href: '#/exam' }, 'מבחן נוסף'),
      h('a', { class: 'btn btn-lg btn-ghost', href: '#/' }, 'למסך הבית')),
    h('div', { class: 'card' }, tabs, list));
  return { el };
}

function reviewRow(q, pick, ok) {
  const d = wrongItem(q, pick);
  d.classList.add(ok ? 'is-ok' : 'is-no');
  if (pick === -1) d.querySelector('.wi-body').prepend(h('p', { class: 'wi-yours' }, icon('x'), h('span', null, 'לא נענתה')));
  if (ok) { const s = d.querySelector('summary'); s.prepend(h('span', { class: 'wi-state' }, icon('check'))); }
  else d.querySelector('summary').prepend(h('span', { class: 'wi-state bad' }, icon('x')));
  return d;
}
