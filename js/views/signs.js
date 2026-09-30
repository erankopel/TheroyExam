// Sign dictionary: every road sign / marking that appears in the bank with its official meaning. Study mode hides the meaning.
import { h, icon, clear, shuffle, keepFocus } from '../ui.js';
import { D, imgUrl } from '../data.js';
import { store } from '../ctx.js';
import { CATS } from '../config.js';
import { startPractice } from '../session.js';
import { openQuestion } from './browse.js';

let quizMode = false;

function signItems(lic) {
  const seen = new Map();
  for (const q of D.questions) {
    if (!q.sg || !q.img || !q.lic.includes(lic)) continue;
    const k = q.img;
    if (!seen.has(k)) seen.set(k, { q, unit: q.u });
  }
  return [...seen.values()];
}

export function signsView({ key } = {}) {
  const lic = store.state.profile.lic;
  const items = signItems(lic);
  const units = D.catUnits.signs || [];
  const inUnits = units.filter((u) => items.some((i) => i.unit === u.key));
  let unitKey = inUnits.some((u) => u.key === key) ? key : 'all';
  let text = '';
  const grid = h('div', { class: 'sign-grid' }), chips = h('div', { class: 'chip-scroll', role: 'group', 'aria-label': 'סינון' });
  const info = h('p', { class: 'muted small' });

  function paint() { keepFocus(chips, paintInner); }
  function paintInner() {
    clear(grid); clear(chips);
    chips.append(chip('all', 'הכל', items.length), ...inUnits.map((u) => chip(u.key, u.title, items.filter((i) => i.unit === u.key).length)));
    const t = text.trim();
    const shown = items.filter((i) => (unitKey === 'all' || i.unit === unitKey) && (!t || i.q.a[i.q.c].includes(t) || String(i.q.id) === t));
    info.textContent = shown.length === 1 ? 'תמרור אחד' : `${shown.length} תמרורים וסימונים`;
    shown.forEach((i) => grid.append(card(i, shown)));
    if (!shown.length) grid.append(h('p', { class: 'muted center' }, 'לא נמצאו תמרורים'));
  }
  const chip = (k, t, n) => h('button', { 'aria-pressed': String(unitKey === k), class: `chip-btn ${unitKey === k ? 'on' : ''}`, onclick: () => { unitKey = k; paint(); } }, t, h('small', null, n));

  function card(it, all) {
    const q = it.q, meaning = q.a[q.c];
    const meaningEl = h('span', { class: 'sc-meaning' }, meaning);
    const c = h('button', { class: `sign-card ${quizMode ? 'hidden' : ''}`, 'aria-label': quizMode ? 'לחצו לחשיפת המשמעות' : meaning,
      onclick: () => { if (quizMode && c.classList.contains('hidden')) { c.classList.remove('hidden'); c.setAttribute('aria-label', `${meaning}. לחצו לפרטים`); c.querySelector('img').alt = `תמרור: ${meaning}`; } else openQuestion(q.id, all.map((x) => x.q.id)); } },
      h('img', { src: imgUrl(q), alt: quizMode ? 'תמרור' : `תמרור: ${meaning}`, loading: 'lazy', decoding: 'async' }), meaningEl,
      h('span', { class: 'sc-reveal' }, icon('eye'), 'מה המשמעות?'));
    return c;
  }

  const modeBtn = h('button', { class: 'btn btn-ghost', 'aria-pressed': String(quizMode), onclick: () => { quizMode = !quizMode; modeBtn.classList.toggle('on', quizMode); modeBtn.setAttribute('aria-pressed', String(quizMode)); paint(); } }, icon('cards'), 'מצב כרטיסיות');
  modeBtn.classList.toggle('on', quizMode);
  const search = h('input', { class: 'search-input', type: 'search', placeholder: 'חיפוש לפי משמעות…', 'aria-label': 'חיפוש תמרור', oninput: (e) => { text = e.target.value; paint(); } });
  paint();
  return { el: h('section', { class: 'page' },
    h('div', { class: 'page-head' }, h('h1', null, 'מילון התמרורים'), h('p', { class: 'muted' }, 'כל תמרור וסימון דרך מהמאגר עם המשמעות הרשמית. במצב כרטיסיות המשמעות מוסתרת – נסו לנחש ואז לחצו.')),
    D.confusable.length ? h('a', { class: 'card visual-strip', href: '#/confusable' }, icon('cards'), h('div', { class: 'grow' }, h('b', null, 'תמרורים מבלבלים'), h('small', { class: 'muted' }, 'קבוצות של תמרורים דומים, משחק זיהוי ותרגול לפי הטעויות שלכם')), icon('chevL')) : null,
    h('div', { class: 'searchbar card' }, icon('search'), search),
    h('div', { class: 'row gap wrap' }, modeBtn,
      h('button', { class: 'btn btn-primary', onclick: () => startPractice({ title: 'חידון תמרורים', ids: items.filter((i) => unitKey === 'all' || i.unit === unitKey).map((i) => i.q.id), mode: 'random', limit: 15, back: '/signs' }) }, icon('play'), 'חידון')),
    chips, info, grid) };
}
