// Shared question card used by practice, exam, review and the single-question viewer.
import { h, icon, sheet } from './ui.js';
import { LETTERS, CATS } from './config.js';
import { D, imgUrl, explanationOf } from './data.js';
import { visualForQuestion } from './visual-data.js';
import { shuffle } from './ui.js';

/** Display order of the 4 answers (array of original indexes). Position-dependent questions keep the official order. */
export function makeOrder(q, doShuffle) {
  const idx = q.a.map((_, i) => i);
  return doShuffle && !q.ns ? shuffle(idx) : idx;
}

// ---- text to speech -----------------------------------------------------------
export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
export function speakQuestion(q, order, withAnswers = true) {
  if (!ttsSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const parts = [q.q];
  if (withAnswers) order.forEach((oi, pos) => parts.push(`${LETTERS[pos]}. ${q.a[oi]}`));
  const u = new SpeechSynthesisUtterance(parts.join('. '));
  u.lang = 'he-IL'; u.rate = 0.95;
  synth.speak(u);
}
export const stopSpeaking = () => { if (ttsSupported()) window.speechSynthesis.cancel(); };

// ---- card -----------------------------------------------------------------------
/**
 * @param q     question
 * @param o     { order, picked (original index|null), reveal (bool), locked (bool), onPick(origIdx), flagged, onFlag(), showTts, tag (bool) }
 * @returns {el, update(patch)} – update() re-renders answer states without rebuilding the image
 */
export function questionCard(q, o) {
  const st = { picked: null, reveal: false, locked: false, flagged: false, ...o };
  const u = D.unitByKey.get(q.u);
  const cat = CATS[q.cat];

  const flagBtn = st.onFlag ? h('button', { class: 'btn btn-icon btn-ghost flag-btn', 'aria-label': 'סימון שאלה לחזרה', 'aria-pressed': String(!!st.flagged), onclick: () => { st.flagged = st.onFlag(); paintFlag(); } }, icon('bookmark')) : null;
  const paintFlag = () => { if (!flagBtn) return; flagBtn.classList.toggle('on', !!st.flagged); flagBtn.setAttribute('aria-pressed', String(!!st.flagged)); };
  const ttsBtn = st.showTts && ttsSupported() ? h('button', { class: 'btn btn-icon btn-ghost', 'aria-label': 'הקראה', onclick: () => speakQuestion(q, st.order) }, icon('speaker')) : null;

  const src = imgUrl(q);
  let fig = null;
  if (src) {
    // Offline and not cached: say so instead of showing a broken-image icon (the question cannot be answered without it).
    const missing = () => fig.replaceChildren(h('div', { class: 'qimg-missing', role: 'note' }, icon('wifi'), h('span', null, 'התמונה אינה זמינה ללא חיבור לאינטרנט.'), h('a', { class: 'link', href: '#/settings' }, 'להורדת כל התמונות')));
    fig = h('figure', { class: 'qimg' },
      h('button', { class: 'qimg-btn', 'aria-label': 'הגדלת התמונה', onclick: () => sheet((b) => b.append(h('img', { class: 'qimg-big', src, alt: 'איור לשאלה' })), { title: 'איור לשאלה' }) },
        h('img', { src, alt: 'איור לשאלה ' + q.id, decoding: 'async', width: 350, height: 230, onerror: missing })));
  }

  const btns = st.order.map((oi, pos) => h('button', {
    class: 'answer', type: 'button', dataset: { i: oi, pos },
    onclick: () => { if (!st.locked && !st.reveal) st.onPick && st.onPick(oi); },
  }, h('span', { class: 'letter' }, LETTERS[pos]), h('span', { class: 'atext' }, q.a[oi]), h('span', { class: 'mark' })));

  const head = h('div', { class: 'qhead' },
    h('div', { class: 'qmeta' },
      st.tag !== false ? h('span', { class: 'chip chip-cat', style: { '--cc': cat?.color } }, u ? u.title : cat?.title) : null,
      h('span', { class: 'qnum' }, `#${q.id}`)),
    h('div', { class: 'row' }, ttsBtn, flagBtn));

  const el = h('article', { class: 'qcard', dataset: { id: q.id } }, head, h('h2', { class: 'stem' }, q.q), fig, h('div', { class: 'answers', role: 'group', 'aria-label': 'תשובות' }, btns));

  function paint() {
    btns.forEach((b) => {
      const oi = +b.dataset.i;
      const isPicked = st.picked === oi, isRight = oi === q.c;
      b.classList.toggle('is-picked', isPicked && !st.reveal);
      b.classList.toggle('is-correct', st.reveal && isRight);
      b.classList.toggle('is-wrong', st.reveal && isPicked && !isRight);
      b.classList.toggle('is-dim', st.reveal && !isRight && !isPicked);
      b.disabled = st.reveal || st.locked;
      b.setAttribute('aria-pressed', String(isPicked));
      const mark = b.querySelector('.mark'); mark.textContent = '';
      if (st.reveal && isRight) { mark.append(icon('check')); mark.setAttribute('aria-label', 'תשובה נכונה'); }
      else if (st.reveal && isPicked) { mark.append(icon('x')); mark.setAttribute('aria-label', 'תשובה שגויה'); }
      else mark.removeAttribute('aria-label');
    });
    paintFlag();
  }
  paint();

  return {
    el,
    get state() { return st; },
    update(patch) { Object.assign(st, patch); paint(); },
    buttons: btns,
  };
}

// ---- explanation ------------------------------------------------------------------
/**
 * The study explanation of a question (unofficial, written from the bank), or null when there is none.
 * @param o { open: expanded by default, plain: no collapsible wrapper (used inside lists) }
 */
export function explanationBox(q, { open = false, plain = false } = {}) {
  const x = explanationOf(q.id);
  if (!x || !x.e) return null;
  const body = [
    h('p', { class: 'expl-text' }, x.e),
    x.k ? h('p', { class: 'expl-k' }, h('strong', null, 'לזכור: '), x.k) : null,
    (() => { const v = visualForQuestion(q.id); return v ? h('a', { class: 'expl-vis link', href: `#/visual/${v.key}` }, icon('eye'), `לאיור: ${v.title}`) : null; })(),
    h('p', { class: 'expl-note' }, 'הסבר לימודי לא רשמי, שנכתב על בסיס המאגר. במקרה של סתירה המאגר הרשמי קובע.'),
  ];
  if (plain) return h('div', { class: 'expl expl-plain' }, h('div', { class: 'expl-head' }, icon('bulb'), h('span', null, 'הסבר')), ...body);
  return h('details', { class: 'expl', open },
    h('summary', null, icon('bulb'), h('span', null, 'הסבר'), icon('chevL', 'expl-chev')),
    h('div', { class: 'expl-body' }, ...body));
}
