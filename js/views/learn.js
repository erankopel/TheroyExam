// Learning hub: units by category + unit detail page.
import { h, icon, fmtNum, clear, keepFocus } from '../ui.js';
import { D, unitIdsForLic, unitsForLic, unitIcon } from '../data.js';
import { store, go } from '../ctx.js';
import { CATS, CAT_ORDER } from '../config.js';
import { unitCounts, catCounts, licOf } from '../progress.js';
import { statusBar } from '../charts.js';
import { startPractice } from '../session.js';
import { openQuestion, questionRow } from './browse.js';
import { visualForUnit, VISUALS } from '../visual-data.js';

export function unitIconEl(u, cls = '') {
  const cat = CATS[u.cat];
  const img = h('img', { src: unitIcon(u), alt: '', loading: 'lazy', decoding: 'async', onerror: () => img.replaceWith(h('span', { class: 'uicon-emoji' }, u.emoji || cat.emoji)) });
  return h('span', { class: `uicon ${cls}`, style: { '--cc': cat.color } }, img);
}

export function learnView({ cat } = {}) {
  const lic = licOf();
  const active = CAT_ORDER.includes(cat) ? cat : 'law';
  const tabs = h('nav', { class: 'cat-tabs', 'aria-label': 'נושאי לימוד' }, CAT_ORDER.map((c) => {
    const cc = catCounts(c);
    return h('a', { 'aria-current': c === active ? 'page' : null, class: `cat-tab ${c === active ? 'on' : ''}`, href: `#/learn/${c}`, style: { '--cc': CATS[c].color } },
      h('span', { class: 'ct-e' }, CATS[c].emoji), h('span', { class: 'ct-t' }, CATS[c].short), h('small', null, `${cc.strong}/${cc.total}`));
  }));
  const units = unitsForLic(lic, active);
  const cc = catCounts(active);
  const el = h('section', { class: 'page' },
    h('div', { class: 'page-head' }, h('h1', null, 'לימוד לפי יחידות'), h('p', { class: 'muted' }, 'כל נושא מחולק ליחידות קצרות. מתחילים מהראשונה ומתקדמים.')),
    h('a', { class: 'card visual-strip', href: '#/visual' }, icon('eye'), h('div', { class: 'grow' }, h('b', null, 'איורי הסבר'), h('small', { class: 'muted' }, VISUALS.map((v) => v.title).join(' · '))), icon('chevL')),
    tabs,
    h('div', { class: 'cat-summary card', style: { '--cc': CATS[active].color } },
      h('div', { class: 'grow' }, h('b', null, CATS[active].title), h('div', { class: 'cat-meta muted' }, h('span', null, units.length === 1 ? 'יחידה אחת' : `${units.length} יחידות`), h('span', null, `${fmtNum(cc.total)} שאלות`)), statusBar(cc, cc.total)),
      h('button', { class: 'btn btn-primary', onclick: () => startPractice({ title: CATS[active].title, ids: units.flatMap((u) => unitIdsForLic(u, lic)), mode: 'smart', limit: 15, back: `/learn/${active}` }) }, icon('bolt'), 'תרגול מעורב')),
    h('div', { class: 'grid unit-grid' }, units.map((u, i) => unitCard(u, i + 1))));
  return { el };
}

function unitCard(u, n) {
  const c = unitCounts(u), done = c.strong === c.total && c.total > 0;
  return h('a', { class: `card unit-card ${done ? 'done' : ''}`, href: `#/unit/${u.key}`, style: { '--cc': CATS[u.cat].color } },
    unitIconEl(u),
    h('div', { class: 'uc-body' },
      h('div', { class: 'uc-title' }, h('span', { class: 'uc-n' }, n), h('b', null, u.title), done ? h('span', { class: 'uc-done', 'aria-label': 'הושלמה' }, icon('check')) : null),
      h('small', { class: 'muted uc-blurb' }, u.blurb),
      statusBar(c, c.total),
      h('div', { class: 'uc-meta' }, h('small', null, `${c.total} שאלות`), c.weak ? h('small', { class: 'tag-weak' }, `${c.weak === 1 ? 'טעות אחת' : `${c.weak} טעויות`}`) : c.due ? h('small', { class: 'tag-due' }, `${c.due} לחזרה מרווחת`) : c.new ? h('small', { class: 'muted' }, c.new === 1 ? 'שאלה חדשה אחת' : `${c.new} חדשות`) : null)));
}

// ---------------------------------------------------------------------------------
export function unitView({ key }) {
  const u = D.unitByKey.get(key);
  if (!u) { queueMicrotask(() => go('/learn', true)); return { el: h('div') }; }
  const lic = licOf(), cat = CATS[u.cat];
  const ids = unitIdsForLic(u, lic);
  const c = unitCounts(u);
  const idx = unitsForLic(lic, u.cat).findIndex((x) => x.key === key);
  const siblings = unitsForLic(lic, u.cat);
  const nextU = siblings[idx + 1];
  let filter = 'all';
  const list = h('div', { class: 'qlist' }), ftabs = h('div', { class: 'seg-ctl' });
  const paintList = () => keepFocus(ftabs, paintListInner);
  const paintListInner = () => {
    clear(list); clear(ftabs);
    const f = { all: () => true, weak: (id) => store.statusOf(id) === 'weak', new: (id) => store.statusOf(id) === 'new' };
    [['all', `הכל (${ids.length})`], ['weak', `טעויות (${c.weak})`], ['new', `חדשות (${c.new})`]].forEach(([k, t]) =>
      ftabs.append(h('button', { class: filter === k ? 'on' : '', onclick: () => { filter = k; paintList(); } }, t)));
    const shown = ids.filter(f[filter]);
    if (!shown.length) list.append(h('p', { class: 'muted center' }, 'אין שאלות בסינון הזה'));
    shown.forEach((id) => list.append(questionRow(D.byId.get(id), shown)));
  };
  paintList();

  const signs = u.cat === 'signs' && D.questions.some((q) => q.u === u.key && q.sg);
  const el = h('section', { class: 'page unit-page', style: { '--cc': cat.color } },
    h('a', { class: 'back-link', href: `#/learn/${u.cat}` }, icon('prev'), cat.title),
    h('div', { class: 'card unit-hero' },
      unitIconEl(u, 'big'),
      h('div', { class: 'grow' }, h('h1', null, u.title), h('p', { class: 'muted' }, u.blurb),
        statusBar(c, c.total),
        h('div', { class: 'chips' }, h('span', { class: 'chip' }, `יחידה ${idx + 1} מתוך ${siblings.length}`), h('span', { class: 'chip' }, `${ids.length} שאלות`), c.total ? h('span', { class: 'chip tone-good' }, `${Math.round((c.strong / c.total) * 100)}% שליטה`) : null))),
    h('div', { class: 'statusline card' },
      stat('strong', c.strong, 'בשליטה'), stat('learning', c.learning, 'בלמידה'), stat('weak', c.weak, 'טעויות'), stat('new', c.new, 'חדשות')),
    h('div', { class: 'row gap wrap actions' },
      h('button', { class: 'btn btn-lg btn-primary', onclick: () => startPractice({ title: u.title, ids, mode: 'smart', limit: 15, back: `/unit/${key}` }) }, icon('play'), c.seen ? 'המשך תרגול' : 'התחלת תרגול'),
      h('button', { class: 'btn btn-lg btn-ghost', onclick: () => startPractice({ title: u.title, ids, mode: 'seq', back: `/unit/${key}` }) }, icon('list'), 'כל היחידה לפי הסדר'),
      c.weak ? h('button', { class: 'btn btn-lg btn-ghost', onclick: () => startPractice({ title: `טעויות – ${u.title}`, ids: ids.filter((id) => store.statusOf(id) === 'weak'), mode: 'random', back: `/unit/${key}`, kind: 'mistakes' }) }, icon('refresh'), 'תיקון טעויות') : null,
      signs ? h('a', { class: 'btn btn-lg btn-ghost', href: `#/signs/${key}` }, icon('cards'), 'מילון התמרורים') : null,
      signs && D.confusable.length ? h('a', { class: 'btn btn-lg btn-ghost', href: '#/confusable' }, icon('target'), 'תמרורים מבלבלים') : null,
      visualForUnit(key).map((v) => h('a', { class: 'btn btn-lg btn-ghost', href: `#/visual/${v.key}` }, icon('eye'), `איור: ${v.title}`))),
    summaryCard(u),
    h('div', { class: 'card' }, h('div', { class: 'section-head tight' }, h('h2', { class: 'sub' }, 'כל השאלות ביחידה'), ftabs), list),
    nextU ? h('a', { class: 'card next-unit', href: `#/unit/${nextU.key}` }, h('span', { class: 'muted small' }, 'היחידה הבאה'), h('b', null, nextU.title), icon('chevL')) : null);
  return { el };
}

const stat = (k, v, l) => h('div', { class: `st st-${k}` }, h('span', { class: `dot dot-${k}` }), h('b', null, v), h('small', null, l));

function summaryCard(u) {
  if (!u.summary || !u.summary.length) return null;
  return h('details', { class: 'card summary-card', open: true },
    h('summary', null, icon('bolt'), h('h2', { class: 'sub' }, 'הכללים החשובים ביחידה'), icon('chevL', 'sum-chev')),
    h('ul', { class: 'facts' }, u.summary.map((f) => h('li', null,
      h('span', null, f.t),
      f.refs && f.refs.length ? h('button', { class: 'fact-src', title: 'שאלות מקור', 'aria-label': 'הצגת שאלת מקור', onclick: () => openQuestion(f.refs[0], f.refs.filter((id) => D.byId.has(id))) }, `מקור: שאלה ${f.refs[0]}`) : null))),
    h('p', { class: 'fineprint muted' }, 'הסיכום נאסף מהשאלות והתשובות הרשמיות ביחידה זו. בכל ספק – התשובה הנכונה במאגר היא הקובעת.'));
}
