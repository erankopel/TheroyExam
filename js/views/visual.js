// Explanatory infographics: index page + one page per infographic.
import { h, icon } from '../ui.js';
import { D } from '../data.js';
import { go } from '../ctx.js';
import { licOf } from '../progress.js';
import { startPractice } from '../session.js';
import { VISUALS, visualByKey, allRefs } from '../visual-data.js';
import { BUILDERS } from '../visuals.js';
import { openQuestion, questionRow } from './browse.js';

export function visualIndexView() {
  const el = h('section', { class: 'page' },
    h('div', { class: 'page-head' }, h('h1', null, 'איורי הסבר'), h('p', { class: 'muted' }, 'נושאים שקל יותר להבין בתמונה. כל איור מבוסס על שאלות המאגר, ומראה מאילו שאלות הוא בא.')),
    h('div', { class: 'grid unit-grid' }, VISUALS.map((v) => h('a', { class: 'card visual-card', href: `#/visual/${v.key}` },
      h('span', { class: 'visual-ic', 'aria-hidden': 'true' }, icon(v.icon)),
      h('div', { class: 'uc-body' }, h('b', null, v.title), h('small', { class: 'muted' }, v.blurb)),
      icon('chevL')))));
  return { el, title: 'איורי הסבר' };
}

export function visualView({ key }) {
  const v = visualByKey(key);
  if (!v) { queueMicrotask(() => go('/visual', true)); return { el: h('div') }; }
  const lic = licOf();
  const ids = allRefs(v).filter((id) => D.byId.get(id)?.lic.includes(lic));
  const others = VISUALS.filter((x) => x.key !== key);
  const el = h('section', { class: 'page visual-page' },
    h('a', { class: 'back-link', href: '#/visual' }, icon('prev'), 'איורי הסבר'),
    h('div', { class: 'page-head' }, h('h1', null, v.title), h('p', { class: 'muted' }, v.intro)),
    BUILDERS[v.key](),
    v.facts.length ? h('div', { class: 'card' }, h('h2', { class: 'sub' }, 'מה חשוב לזכור'),
      h('ul', { class: 'facts' }, v.facts.map((f) => h('li', null, h('span', null, f.t),
        h('button', { class: 'fact-src', 'aria-label': `הצגת שאלת מקור ${f.refs[0]}`, onclick: () => openQuestion(f.refs[0], f.refs.filter((id) => D.byId.has(id))) }, `מקור: שאלה ${f.refs[0]}`)))),
      h('p', { class: 'fineprint muted' }, 'הכללים נאספו מהשאלות והתשובות הרשמיות. בכל ספק התשובה הנכונה במאגר היא הקובעת.')) : null,
    ids.length ? h('div', { class: 'card' },
      h('div', { class: 'section-head tight' }, h('h2', { class: 'sub' }, `שאלות מהמאגר בנושא (${ids.length})`),
        h('button', { class: 'btn btn-primary', onclick: () => startPractice({ title: v.title, ids, mode: 'smart', limit: 15, back: `/visual/${key}` }) }, icon('play'), 'תרגול')),
      h('div', { class: 'qlist' }, ids.map((id) => questionRow(D.byId.get(id), ids)))) : null,
    h('div', { class: 'row gap wrap' }, others.map((o) => h('a', { class: 'btn btn-ghost', href: `#/visual/${o.key}` }, icon(o.icon), o.title))));
  return { el, title: v.title };
}
