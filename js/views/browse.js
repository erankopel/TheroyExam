// Read-only question viewer (answer revealed) shown in a sheet; used from unit lists, search, review.
import { h, icon, sheet, add } from '../ui.js';
import { D } from '../data.js';
import { store } from '../ctx.js';
import { questionCard } from '../quiz.js';

const STATUS_LABEL = { new: 'טרם נענתה', weak: 'טעיתם לאחרונה', learning: 'בלמידה', strong: 'שולטים' };

export function openQuestion(id, ids = [id]) {
  let i = Math.max(0, ids.indexOf(id));
  sheet((body, close) => {
    const paint = () => {
      body.textContent = '';
      const q = D.byId.get(ids[i]);
      const card = questionCard(q, {
        order: q.a.map((_, k) => k), picked: q.c, reveal: true, flagged: store.isFlagged(q.id),
        onFlag: () => store.toggleFlag(q.id), showTts: store.state.profile.tts,
      });
      const rec = store.rec(q.id);
      add(body, card.el,
        h('div', { class: 'browse-meta' },
          h('span', { class: `dot dot-${store.statusOf(q.id)}` }), STATUS_LABEL[store.statusOf(q.id)],
          rec ? h('span', { class: 'muted' }, ` · ${rec.r} נכון, ${rec.w} שגוי`) : null),
        ids.length > 1 ? h('div', { class: 'row between', style: { marginTop: '12px' } },
          h('button', { class: 'btn btn-ghost', disabled: i === 0, onclick: () => { i--; paint(); } }, icon('prev'), 'הקודמת'),
          h('span', { class: 'muted small' }, `${i + 1} / ${ids.length}`),
          h('button', { class: 'btn btn-ghost', disabled: i === ids.length - 1, onclick: () => { i++; paint(); } }, 'הבאה', icon('next'))) : null);
    };
    paint();
  }, { title: 'שאלה ותשובה' });
}

export function questionRow(q, ids) {
  const st = store.statusOf(q.id);
  return h('button', { class: 'qrow', onclick: () => openQuestion(q.id, ids) },
    h('span', { class: `dot dot-${st}`, title: STATUS_LABEL[st] }),
    q.img ? h('img', { class: 'qrow-img', src: `img/q/${q.img}`, alt: '', loading: 'lazy' }) : null,
    h('span', { class: 'qrow-text' }, h('span', { class: 'qrow-q' }, q.q), h('span', { class: 'qrow-a' }, q.a[q.c])),
    h('span', { class: 'qrow-num' }, `#${q.id}`));
}
