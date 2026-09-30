import { h, icon, clear } from '../ui.js';
import { D } from '../data.js';
import { store } from '../ctx.js';
import { CATS } from '../config.js';
import { openQuestion } from './browse.js';

const norm = (s) => s.toLowerCase().replace(/[֑-ׇ"'׳״()\-–,.?!:;]/g, '').replace(/\s+/g, ' ').trim();
let index = null;
function buildIndex() {
  index = D.questions.map((q) => ({ q, t: norm(q.q + ' ' + q.a.join(' ')), id: String(q.id) }));
}

export function searchView() {
  if (!index) buildIndex();
  const lic = store.state.profile.lic;
  let onlyLic = true;
  const input = h('input', { class: 'search-input', type: 'search', placeholder: 'חיפוש שאלה, תמרור או נושא…', 'aria-label': 'חיפוש', autocomplete: 'off', enterkeyhint: 'search' });
  const out = h('div', { class: 'results' });
  const chk = h('input', { type: 'checkbox', checked: true, onchange: () => { onlyLic = chk.checked; run(); } });
  function run() {
    clear(out);
    const raw = input.value.trim(); if (raw.length < 2) { out.append(h('p', { class: 'muted center' }, 'הקלידו לפחות שתי אותיות. אפשר גם לחפש לפי מספר שאלה.')); return; }
    const terms = norm(raw).split(' ').filter(Boolean);
    const hits = [];
    for (const it of index) {
      if (onlyLic && !it.q.lic.includes(lic)) continue;
      if (/^\d+$/.test(raw) && it.id === raw) { hits.unshift(it.q); continue; }
      if (terms.every((t) => it.t.includes(t))) hits.push(it.q);
      if (hits.length > 300) break;
    }
    out.append(h('p', { class: 'muted small' }, hits.length === 0 ? 'לא נמצאו תוצאות' : hits.length === 1 ? 'תוצאה אחת' : `${hits.length >= 300 ? '300+' : hits.length} תוצאות`));
    const ids = hits.slice(0, 60).map((q) => q.id);
    hits.slice(0, 60).forEach((q) => out.append(h('button', { class: 'card result-row', onclick: () => openQuestion(q.id, ids) },
      h('span', { class: 'chip chip-cat', style: { '--cc': CATS[q.cat]?.color } }, D.unitByKey.get(q.u)?.title || CATS[q.cat]?.title),
      h('span', { class: 'rr-q' }, q.q), h('span', { class: 'rr-a' }, icon('check'), q.a[q.c]))));
  }
  input.addEventListener('input', () => { clearTimeout(input._t); input._t = setTimeout(run, 120); });
  run();
  queueMicrotask(() => input.focus({ preventScroll: true }));
  return { el: h('section', { class: 'page' }, h('div', { class: 'page-head' }, h('h1', null, 'חיפוש במאגר')),
    h('div', { class: 'searchbar card' }, icon('search'), input),
    h('label', { class: 'check' }, chk, h('span', null, `רק שאלות לסוג הרישיון שלי (${lic})`)), out) };
}
