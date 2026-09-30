// "Mistakes notebook": weak questions, spaced-repetition queue, bookmarks, unseen.
import { h, icon, clear, add } from '../ui.js';
import { D, idsForLic } from '../data.js';
import { store } from '../ctx.js';
import { startPractice } from '../session.js';
import { questionRow } from './browse.js';

export function reviewView({ tab } = {}) {
  const lic = store.state.profile.lic;
  const ids = idsForLic(lic);
  const sets = {
    weak: { title: 'טעויות', icon: 'x', ids: ids.filter((id) => store.statusOf(id) === 'weak'), empty: 'אין טעויות פתוחות. כל הכבוד!', hint: 'שאלות שהתשובה האחרונה עליהן הייתה שגויה. עד שלא עונים נכון – הן נשארות כאן.' },
    due: { title: 'חזרה מרווחת', icon: 'refresh', ids: ids.filter((id) => store.rec(id) && store.statusOf(id) !== 'weak' && store.isDue(id)), empty: 'אין שאלות שמחכות לחזרה כרגע.', hint: 'שאלות שהגיע הזמן לרענן. ככל שעונים נכון פעמים רצופות – המרווח גדל (יום, 3, שבוע, שבועיים, חודש).' },
    flag: { title: 'מסומנות', icon: 'bookmark', ids: store.state.flags.filter((id) => D.byId.get(id)?.lic.includes(lic)), empty: 'עוד לא סימנתם שאלות. סמנו שאלה עם סמל הסימנייה בזמן תרגול.', hint: 'שאלות ששמרתם לחזרה.' },
    new: { title: 'טרם נענו', icon: 'layers', ids: ids.filter((id) => store.statusOf(id) === 'new'), empty: 'ענו על כל השאלות!', hint: 'שאלות שעוד לא ראיתם.' },
  };
  let cur = sets[tab] ? tab : (sets.weak.ids.length ? 'weak' : sets.due.ids.length ? 'due' : 'weak');
  const tabs = h('div', { class: 'cat-tabs sm', role: 'tablist' }), body = h('div');
  function paint() {
    clear(tabs); clear(body);
    Object.entries(sets).forEach(([k, s]) => tabs.append(h('button', { role: 'tab', 'aria-selected': String(k === cur), class: `cat-tab ${k === cur ? 'on' : ''}`, onclick: () => { cur = k; paint(); } }, icon(s.icon), h('span', { class: 'ct-t' }, s.title), h('small', null, s.ids.length))));
    const s = sets[cur];
    body.append(h('p', { class: 'muted' }, s.hint));
    if (!s.ids.length) { body.append(h('div', { class: 'empty card' }, h('div', { class: 'empty-e' }, '✨'), h('p', null, s.empty))); return; }
    add(body, h('div', { class: 'row gap wrap', style: { margin: '12px 0' } },
      h('button', { class: 'btn btn-lg btn-primary', onclick: () => startPractice({ title: s.title, ids: s.ids, mode: cur === 'due' ? 'smart' : 'random', limit: 20, back: '/review', kind: cur === 'weak' ? 'mistakes' : cur }) }, icon('play'), `תרגול ${Math.min(20, s.ids.length)} שאלות`),
      cur === 'flag' ? h('button', { class: 'btn btn-lg btn-ghost', onclick: () => { s.ids.forEach((id) => store.toggleFlag(id)); sets.flag.ids = []; paint(); } }, icon('trash'), 'ניקוי הסימונים') : null),
      h('div', { class: 'card' }, h('div', { class: 'qlist' }, s.ids.slice(0, 200).map((id) => questionRow(D.byId.get(id), s.ids)))),
      s.ids.length > 200 ? h('p', { class: 'muted center small' }, `מוצגות 200 מתוך ${s.ids.length}`) : null);
  }
  paint();
  return { el: h('section', { class: 'page' }, h('div', { class: 'page-head' }, h('h1', null, 'מחברת חזרה'), h('p', { class: 'muted' }, 'המקום לחזור על מה שעדיין לא יושב')), tabs, body) };
}
