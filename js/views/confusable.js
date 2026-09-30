// Practice for signs that are easy to mix up: an index of groups, a compare page per group, a "which one?" game
// and a smart drill that starts from the learner's own mistakes.
import { h, icon, clear } from '../ui.js';
import { go } from '../ctx.js';
import { licOf } from '../progress.js';
import { startPractice } from '../session.js';
import { resolveGroups, questionIds, groupStats, drillPlan, buildRounds } from '../confusable.js';
import { openQuestion } from './browse.js';

const signImg = (s, cls = '') => h('img', { class: cls, src: `img/q/${s.img}`, alt: '', loading: 'lazy', decoding: 'async' });

function statsLine(g, s) {
  const bits = [`${g.signs.length} תמרורים`];
  if (s.weak) bits.push(s.weak === 1 ? 'טעיתם בשאלה אחת' : `טעיתם ב־${s.weak} שאלות`);
  else if (s.total - s.fresh === 0) bits.push('טרם תורגלה');
  else if (s.due) bits.push(s.due === 1 ? 'שאלה אחת לחזרה' : `${s.due} שאלות לחזרה`);
  else bits.push('הכול במעקב');
  return bits.join(' · ');
}

function groupCard(g, lic) {
  const s = groupStats(g, lic);
  return h('a', { class: `card conf-card ${s.weak ? 'has-weak' : ''}`, href: `#/confusable/${g.id}` },
    h('div', { class: 'conf-thumbs', 'aria-hidden': 'true' }, g.signs.slice(0, 4).map((x) => signImg(x))),
    h('div', { class: 'uc-body' }, h('b', null, g.title), h('small', { class: 'muted' }, statsLine(g, s))),
    icon('chevL'));
}

export function confusableIndexView() {
  const lic = licOf();
  const groups = resolveGroups(lic);
  const plan = drillPlan(lic, { groups });
  const stats = new Map(groups.map((g) => [g.id, groupStats(g, lic)]));
  const weak = groups.filter((g) => stats.get(g.id).weak > 0);
  const basisText = { mistakes: 'נבחר לפי הטעויות שלכם, כשהתמרורים הדומים באים זה אחרי זה.', due: 'נבחר לפי חזרות שהגיע זמנן, כשהתמרורים הדומים באים זה אחרי זה.', new: 'עוד אין טעויות, אז מתחילים מהקבוצות הנפוצות. התמרורים הדומים באים זה אחרי זה.' }[plan.basis];
  const el = h('section', { class: 'page' },
    h('a', { class: 'back-link', href: '#/signs' }, icon('prev'), 'מילון התמרורים'),
    h('div', { class: 'page-head' }, h('h1', null, 'תמרורים מבלבלים'), h('p', { class: 'muted' }, 'קבוצות של תמרורים וסימונים שקל להחליף ביניהם. משווים, בודקים את עצמכם ומתרגלים שאלות מהמאגר.')),
    plan.ids.length ? h('div', { class: 'card conf-drill' },
      h('div', { class: 'conf-drill-head' }, h('span', { class: 'visual-ic', 'aria-hidden': 'true' }, icon('target')), h('div', null, h('b', null, 'תרגול חכם'), h('small', { class: 'muted' }, basisText))),
      h('button', { class: 'btn btn-lg btn-primary', onclick: () => startPractice({ title: 'תמרורים מבלבלים', ids: plan.ids, mode: 'ordered', back: '/confusable' }) }, icon('play'), `התחלה (${plan.ids.length} שאלות)`)) : null,
    weak.length ? h('div', { class: 'conf-section' }, h('h2', { class: 'sub' }, `כדאי לחזור (${weak.length})`), h('div', { class: 'grid unit-grid' }, weak.map((g) => groupCard(g, lic)))) : null,
    h('div', { class: 'conf-section' }, h('h2', { class: 'sub' }, `כל הקבוצות (${groups.length})`), h('div', { class: 'grid unit-grid' }, groups.map((g) => groupCard(g, lic)))));
  return { el, title: 'תמרורים מבלבלים' };
}

// ------------------------------------------------------------------ "which one?" game
function gameCard(g) {
  const host = h('div', { class: 'card conf-game' });
  let rounds = [], i = 0, score = 0;
  const start = () => { rounds = buildRounds(g); i = 0; score = 0; paint(); };

  function paint(focusNext) {
    clear(host);
    if (i >= rounds.length) {
      host.append(h('h2', { class: 'sub' }, 'איך היה?'),
        h('p', { class: 'conf-result', role: 'status' }, `זיהיתם נכון ${score} מתוך ${rounds.length}.`, score === rounds.length ? ' כל הכבוד!' : ' כדאי לחזור על הסימנים ולנסות שוב.'),
        h('button', { class: 'btn btn-primary', onclick: start }, icon('refresh'), 'עוד סיבוב'));
      return;
    }
    const r = rounds[i];
    const fb = h('div', { class: 'conf-fb', role: 'status' });
    const nextWrap = h('div', { class: 'conf-next' });
    const opts = r.options.map((o) => h('button', { type: 'button', class: 'conf-opt', 'aria-label': o.cue, onclick: () => pick(o) }, signImg(o)));
    function pick(o) {
      const ok = o === r.target;
      if (ok) score++;
      opts.forEach((b, k) => {
        b.disabled = true;
        const isT = r.options[k] === r.target;
        b.classList.toggle('right', isT); b.classList.toggle('wrong', !isT && r.options[k] === o);
        if (isT) b.setAttribute('aria-label', `התמרור הנכון: ${r.options[k].cue}`);
      });
      fb.textContent = ok ? `נכון. ${r.target.cue}.` : `לא זה. התמרור הנכון: ${r.target.cue}.`;
      fb.classList.add(ok ? 'ok' : 'bad');
      const next = h('button', { class: 'btn btn-primary', onclick: () => { i++; paint(true); } }, i + 1 < rounds.length ? 'הבא' : 'לסיכום', icon('chevL'));
      nextWrap.append(next); next.focus();
    }
    host.append(
      h('div', { class: 'section-head tight' }, h('h2', { class: 'sub' }, 'מי מהם?'), h('small', { class: 'muted' }, `${i + 1} מתוך ${rounds.length}`)),
      h('p', { class: 'conf-prompt' }, r.target.meaning),
      h('div', { class: 'conf-options', role: 'group', 'aria-label': 'בחרו את התמרור שמתאים למשמעות' }, opts),
      fb, nextWrap);
    if (focusNext) { const p = host.querySelector('.conf-prompt'); p.tabIndex = -1; p.focus({ preventScroll: true }); }
  }
  const intro = () => host.append(h('div', { class: 'section-head tight' }, h('h2', { class: 'sub' }, 'מי מהם?')),
    h('p', { class: 'muted' }, 'תראו משמעות ותבחרו את התמרור שמתאים לה מבין התמרורים הדומים בקבוצה.'),
    h('button', { class: 'btn btn-primary', onclick: start }, icon('play'), 'התחלה'));
  intro();
  return host;
}

// ------------------------------------------------------------------ one group
export function confusableView({ id } = {}) {
  const lic = licOf();
  const groups = resolveGroups(lic);
  const idx = groups.findIndex((g) => g.id === id);
  if (idx < 0) { queueMicrotask(() => go('/confusable', true)); return { el: h('div') }; }
  const g = groups[idx], ids = questionIds(g, lic), s = groupStats(g, lic);
  const prev = groups[idx - 1], next = groups[idx + 1];
  const nav = (o, dir) => o ? h('a', { class: 'btn btn-ghost', href: `#/confusable/${o.id}` }, dir === 'next' ? [o.title, icon('chevL')] : [icon('chevR'), o.title]) : null;
  const el = h('section', { class: 'page conf-page' },
    h('a', { class: 'back-link', href: '#/confusable' }, icon('prev'), 'תמרורים מבלבלים'),
    h('div', { class: 'page-head' }, h('h1', null, g.title)),
    h('p', { class: 'callout conf-tip' }, h('b', null, 'איך מבדילים: '), g.tip),
    h('div', { class: 'conf-signs' }, g.signs.map((x) => h('button', { class: 'conf-sign', onclick: () => openQuestion(x.q, g.signs.map((y) => y.q)), 'aria-label': `${x.meaning} (לפתיחת השאלה)` },
      h('img', { src: `img/q/${x.img}`, alt: x.cue, loading: 'lazy', decoding: 'async' }),
      h('span', { class: 'conf-cue' }, x.cue),
      h('span', { class: 'conf-meaning' }, x.meaning)))),
    gameCard(g),
    ids.length ? h('div', { class: 'card conf-practice' },
      h('div', null, h('b', null, `שאלות מהמאגר על התמרורים האלה (${ids.length})`), h('small', { class: 'muted' }, s.weak ? (s.weak === 1 ? 'טעיתם באחת מהן לאחרונה.' : `טעיתם ב־${s.weak} מהן לאחרונה.`) : s.total - s.fresh === 0 ? 'עוד לא ענו עליהן.' : 'מסודרות כך שטעויות וחזרות באות קודם.')),
      h('button', { class: 'btn btn-primary', onclick: () => startPractice({ title: g.title, ids, mode: 'smart', limit: 15, back: `/confusable/${g.id}` }) }, icon('play'), 'תרגול')) : null,
    h('div', { class: 'row gap wrap conf-nav' }, nav(prev, 'prev'), nav(next, 'next')));
  return { el, title: g.title };
}
