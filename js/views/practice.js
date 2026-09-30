// Practice runner: one question at a time with instant feedback + end-of-round summary.
import { h, icon, clear, fmtDuration, confirmDialog, announce } from '../ui.js';
import { D } from '../data.js';
import { store, go } from '../ctx.js';
import { session, startPractice, restart } from '../session.js';
import { questionCard, makeOrder, speakQuestion, stopSpeaking } from '../quiz.js';
import { checkBadges } from '../badges.js';
import { confetti } from '../fx.js';
import { CATS } from '../config.js';
import { ringSvg } from '../charts.js';

const PRAISE = ['נכון!', 'מצוין!', 'יפה מאוד!', 'בדיוק!', 'כל הכבוד!', 'ידע מעולה!'];
const OOPS = ['לא בדיוק', 'לא נורא', 'עוד נחזור לזה', 'טעות שווה ללמוד ממנה'];

export function practiceView() {
  const S = session.current;
  const root = h('section', { class: 'session' });
  if (!S) { queueMicrotask(() => go('/learn', true)); return { el: root }; }
  // Back/Forward (or a reload of the tab) can re-enter a session that already has answers: resume after the last answered question.
  if (!S.done && S.results.length > S.i) { S.i = S.results.length; if (S.i >= S.queue.length) S.done = true; }
  let card = null, t0 = 0, answered = false, keyHandler = null;

  const bar = h('div', { class: 'session-fill' });
  const count = h('span', { class: 'session-count' });
  const top = h('header', { class: 'session-top' },
    h('button', { class: 'btn btn-icon btn-ghost', 'aria-label': 'יציאה', onclick: exit }, icon('x')),
    h('div', { class: 'session-bar', role: 'progressbar', 'aria-label': 'התקדמות בסבב', 'aria-valuemin': 0 }, bar),
    count);
  const body = h('div', { class: 'session-body' });
  const foot = h('footer', { class: 'session-foot' });
  root.append(h('h1', { class: 'sr-only' }, 'תרגול'), top, body, foot);

  async function exit() {
    if (S.results.length && !S.done) {
      const ok = await confirmDialog({ title: 'לצאת מהסבב?', text: 'התשובות שכבר נענו נשמרו. אפשר להמשיך אחר כך.', ok: 'יציאה', cancel: 'להישאר' });
      if (!ok) return;
    }
    stopSpeaking(); go(S.back);
  }

  function show() {
    stopSpeaking();
    answered = false; t0 = Date.now();
    const id = S.queue[S.i]; const q = D.byId.get(id);
    const order = makeOrder(q, store.state.profile.shuffle);
    clear(body); clear(foot); foot.className = 'session-foot';
    const total = S.queue.length;
    count.textContent = `${S.i + 1}/${total}`;
    top.querySelector('.session-bar').setAttribute('aria-valuetext', `שאלה ${S.i + 1} מתוך ${total}`);
    bar.style.width = `${(S.i / total) * 100}%`;
    top.querySelector('.session-bar').setAttribute('aria-valuenow', S.i); top.querySelector('.session-bar').setAttribute('aria-valuemax', total);
    card = questionCard(q, {
      order, showTts: store.state.profile.tts, flagged: store.isFlagged(id),
      onFlag: () => store.toggleFlag(id),
      onPick: (oi) => pick(q, oi),
    });
    if (S.retried.has(id) && S.results.some((r) => r.id === id)) body.append(h('div', { class: 'retry-note' }, icon('refresh'), 'חזרה על שאלה שטעיתם בה'));
    body.append(card.el);
    foot.append(h('div', { class: 'foot-hint' }, 'בחרו תשובה  ·  מקשים 1-4'));
    window.scrollTo({ top: 0 });
    const stem = card.el.querySelector('.stem'); if (stem) { stem.tabIndex = -1; stem.focus({ preventScroll: true }); } // read the new question first
    if (store.state.profile.tts && card) speakQuestion(q, order);
  }

  function pick(q, oi) {
    if (answered) return; answered = true;
    const ok = oi === q.c;
    card.update({ picked: oi, reveal: true });
    const res = store.recordAnswer(q.id, ok, { ms: Date.now() - t0 });
    S.results.push({ id: q.id, ok, pick: oi }); S.xp += res.xp;
    S.combo = ok ? S.combo + 1 : 0; S.bestCombo = Math.max(S.bestCombo, S.combo);
    if (!ok && !S.retried.has(q.id)) { S.queue.push(q.id); S.retried.add(q.id); }
    checkBadges(store, { combo: S.bestCombo, units: S.i % 5 === 4 });
    if (navigator.vibrate && !ok) navigator.vibrate(60);
    announce(ok ? 'נכון' : `לא נכון. התשובה הנכונה: ${q.a[q.c]}`);
    const last = S.i + 1 >= S.queue.length;
    clear(foot); foot.className = `session-foot fb ${ok ? 'fb-good' : 'fb-bad'}`;
    foot.append(
      h('div', { class: 'fb-msg' },
        h('span', { class: 'fb-ic' }, icon(ok ? 'check' : 'x')),
        h('div', null,
          h('strong', null, ok ? PRAISE[S.results.length % PRAISE.length] : OOPS[S.results.length % OOPS.length]),
          ok ? h('span', { class: 'fb-xp' }, h('bdi', { dir: 'ltr' }, `+${res.xp}`), ' נק׳') : h('span', { class: 'fb-sub' }, 'התשובה הנכונה מסומנת בירוק'))),
      h('button', { class: 'btn btn-lg btn-primary fb-next', onclick: next, autofocus: true }, last ? 'לסיכום' : 'המשך', icon('next')));
    foot.querySelector('.fb-next').focus({ preventScroll: true });
    if (S.combo && S.combo % 5 === 0) confetti(0.6);
  }

  function next() {
    S.i++;
    if (S.i >= S.queue.length) return finish();
    show();
  }

  function finish() {
    S.done = true; stopSpeaking();
    document.removeEventListener('keydown', keyHandler);
    checkBadges(store, { combo: S.bestCombo });
    summary();
  }

  function summary() {
    clear(body); clear(foot); foot.className = 'session-foot'; foot.style.display = 'none';
    top.style.display = 'none';
    const total = S.results.length, right = S.results.filter((r) => r.ok).length;
    const first = new Map(); S.results.forEach((r) => { if (!first.has(r.id)) first.set(r.id, r); });
    const uniq = [...first.values()], uRight = uniq.filter((r) => r.ok).length;
    const p = uniq.length ? uRight / uniq.length : 0;
    const wrongIds = uniq.filter((r) => !r.ok).map((r) => r.id);
    if (p >= 0.8) confetti(1);
    const msg = p === 1 ? 'סבב מושלם!' : p >= 0.8 ? 'סבב מצוין!' : p >= 0.6 ? 'התקדמות יפה' : 'כל סבב מקרב אתכם למבחן';
    body.append(
      h('div', { class: 'summary card' },
        h('div', { class: 'summary-ring' }, ringSvg(p, { size: 132, stroke: 12, label: `${Math.round(p * 100)}%`, sub: 'נכון בניסיון ראשון', tone: p >= 0.8 ? 'good' : p >= 0.6 ? 'warn' : 'bad' })),
        h('h2', null, msg),
        h('div', { class: 'stat-row' },
          stat(`${uRight}/${uniq.length}`, 'תשובות נכונות'),
          stat(h('bdi', { dir: 'ltr' }, `+${S.xp}`), 'נקודות'),
          stat(fmtDuration((Date.now() - S.startedAt) / 1000), 'זמן')),
        wrongIds.length ? h('div', { class: 'wrong-list' },
          h('h2', { class: 'sub' }, wrongIds.length === 1 ? 'שאלה אחת לחזרה' : `${wrongIds.length} שאלות לחזרה`),
          ...wrongIds.map((id) => wrongItem(D.byId.get(id), first.get(id).pick))) : h('p', { class: 'muted' }, 'אין טעויות בסבב הזה 🎉')));
    body.append(h('div', { class: 'summary-actions' },
      S.kind !== 'mistakes' ? h('button', { class: 'btn btn-lg btn-primary', onclick: () => restart() }, 'סבב נוסף', icon('next')) : null,
      wrongIds.length ? h('button', { class: 'btn btn-lg btn-ghost', onclick: () => startPractice({ title: 'חזרה על טעויות הסבב', ids: wrongIds, mode: 'random', back: S.back, kind: 'mistakes' }) }, icon('refresh'), 'תרגול טעויות') : null,
      h('button', { class: 'btn btn-lg btn-ghost', onclick: () => go(S.back) }, 'סיום')));
    window.scrollTo({ top: 0 });
  }

  keyHandler = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('.sheet-back')) return;
    if (S.done) return;
    if (!answered && /^[1-4]$/.test(e.key) && card) {
      const b = card.buttons[+e.key - 1]; if (b) { e.preventDefault(); b.click(); }
    } else if (answered && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowLeft')) {
      // Enter/Space on a focused control (bookmark, exit, zoom...) must do that control's job; only the arrow key is a global "next"
      if (e.key !== 'ArrowLeft' && e.target && e.target.closest && e.target.closest('button, a, input, select, textarea, summary')) return;
      e.preventDefault(); next();
    }
  };
  document.addEventListener('keydown', keyHandler);

  if (S.done) summary(); else show();
  return { el: root, destroy() { document.removeEventListener('keydown', keyHandler); stopSpeaking(); }, focus: true };
}

const stat = (v, l) => h('div', { class: 'stat' }, h('div', { class: 'stat-v' }, v), h('div', { class: 'stat-l' }, l));

/** A collapsed mistake row: stem, and the correct answer. */
export function wrongItem(q, pick) {
  const cat = CATS[q.cat];
  return h('details', { class: 'wrong-item', style: { '--cc': cat?.color } },
    h('summary', null, h('span', { class: 'wi-num' }, `#${q.id}`), h('span', { class: 'wi-q' }, q.q), icon('chevL', 'wi-chev')),
    h('div', { class: 'wi-body' },
      q.img ? h('img', { class: 'wi-img', src: `img/q/${q.img}`, alt: 'איור לשאלה', loading: 'lazy' }) : null,
      pick != null && pick >= 0 && pick !== q.c ? h('p', { class: 'wi-yours' }, icon('x'), h('span', null, 'הבחירה שלכם: ', q.a[pick])) : null,
      h('p', { class: 'wi-right' }, icon('check'), h('span', null, 'התשובה הנכונה: ', h('strong', null, q.a[q.c])))));
}
