import { h, icon, fmtNum, plural } from '../ui.js';
import { D, idsForLic, unitsForLic, unitIcon } from '../data.js';
import { store, go } from '../ctx.js';
import { APP, CATS, CAT_ORDER, LICENSES } from '../config.js';
import { estimate, readinessLabel } from '../readiness.js';
import { gaugeSvg, ringSvg, statusBar } from '../charts.js';
import { catCounts, unitCounts, accuracy, nextUnit, countStatus } from '../progress.js';
import { startPractice } from '../session.js';
import { BADGES } from '../badges.js';

export function homeView() {
  const st = store.state, p = st.profile;
  const lic = p.lic, ids = idsForLic(lic);
  const est = estimate(ids, st.q, store.today());
  const lab = readinessLabel(est.pass);
  const today = store.todayLog(), goal = p.dailyGoal || 20;
  const streak = store.streak(), lv = store.level();
  const all = countStatus(ids);
  const licInfo = LICENSES.find((l) => l.key === lic);

  const hi = p.name ? `שלום ${p.name}` : 'שלום';
  const daysLeft = p.examDate ? Math.ceil((new Date(p.examDate + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000) : null;
  const remaining = all.new + all.weak;

  const nu = nextUnit(unitsForLic(lic));
  const weakUnits = unitsForLic(lic).map((u) => ({ u, a: accuracy(u.qids.filter((id) => D.byId.get(id).lic.includes(lic))) }))
    .filter((x) => x.a && x.a.n >= 5).sort((a, b) => a.a.acc - b.a.acc).slice(0, 3).filter((x) => x.a.acc < 0.85);

  const smartAll = () => startPractice({ title: 'תרגול חכם', ids, mode: 'smart', limit: 15, back: '/' });
  const dueIds = ids.filter((id) => st.q[id] && store.isDue(id));
  const weakIds = ids.filter((id) => store.statusOf(id) === 'weak');

  const earned = BADGES.filter((b) => st.badges[b.key]).sort((a, b) => st.badges[b.key] - st.badges[a.key]).slice(0, 6);

  const el = h('section', { class: 'page home' },
    h('div', { class: 'home-top' },
      h('div', null, h('h1', { class: 'greet' }, hi, ' 👋'), h('p', { class: 'muted' }, `${licInfo.icon} רישיון ${licInfo.label} · ${fmtNum(ids.length)} שאלות רלוונטיות`)),
      h('div', { class: 'row gap' },
        h('a', { class: 'pill streak', href: '#/stats', title: 'ימים ברצף', 'aria-label': `${streak} ימים ברצף` }, icon('flame'), h('b', null, streak)),
        h('a', { class: 'pill xp', href: '#/stats', title: 'רמה', 'aria-label': `רמה ${lv.level}` }, icon('star'), h('b', null, `רמה ${lv.level}`)))),

    // Readiness
    h('div', { class: 'card hero' },
      h('div', { class: 'hero-gauge' }, gaugeSvg(est.expected / APP.exam.questions, { label: est.expected.toFixed(1), sub: `ציון צפוי מתוך ${APP.exam.questions}`, tone: lab.tone, mark: APP.exam.passScore / APP.exam.questions })),
      h('div', { class: 'hero-text' },
        h('span', { class: `chip tone-${lab.tone}` }, lab.text),
        h('p', null, 'סיכוי משוער לעבור: ', h('b', null, `${Math.round(est.pass * 100)}%`), ` · נדרש ${APP.exam.passScore} נכונות`),
        h('div', { class: 'hero-cov' }, statusBar(all, all.total), h('small', { class: 'muted' }, `שולטים ב־${all.strong} · בלמידה ${all.learning} · לחזרה ${all.weak} · חדשות ${all.new}`)),
        daysLeft != null && daysLeft >= 0 ? h('div', { class: 'exam-date' }, icon('calendar'), h('div', null, h('b', null, daysLeft === 0 ? 'המבחן היום! בהצלחה 🍀' : `עוד ${daysLeft} ${plural(daysLeft, 'יום', 'ימים', 'יומיים')} למבחן`), remaining && daysLeft > 0 ? h('div', { class: 'muted small' }, `~${Math.ceil(remaining / daysLeft)} שאלות ביום מכסות את כל החומר`) : null)) : h('a', { class: 'link small', href: '#/settings' }, 'קבעו תאריך מבחן לקבלת תוכנית לימוד'),
        h('p', { class: 'fineprint muted' }, 'ההערכה מבוססת על ההיסטוריה שלכם באפליקציה ואינה מבטיחה תוצאה.'))),

    // Today
    h('div', { class: 'grid grid-2' },
      h('div', { class: 'card today' },
        ringSvg(Math.min(1, today.n / goal), { size: 84, stroke: 9, label: `${today.n}`, sub: `מתוך ${goal}`, tone: today.n >= goal ? 'good' : 'brand' }),
        h('div', null, h('b', null, today.n >= goal ? 'יעד היום הושג! 🎉' : 'יעד יומי'), h('p', { class: 'muted small' }, today.n >= goal ? 'כל שאלה נוספת היא בונוס.' : `עוד ${goal - today.n} שאלות להשלמת היעד`),
          h('p', { class: 'muted small' }, `יום נספר אחרי ${APP.streakMinAnswers} שאלות`))),
      h('button', { class: 'card cta', onclick: () => nu ? go(`/unit/${nu.key}`) : smartAll() },
        h('span', { class: 'cta-ic' }, nu ? h('img', { src: unitIcon(nu), alt: '', onerror: (e) => { e.target.replaceWith(h('span', null, nu.emoji || '📘')); } }) : icon('trophy')),
        h('span', { class: 'cta-text' }, h('small', null, nu ? (unitCounts(nu).seen ? 'להמשיך ללמוד' : 'היחידה הבאה') : 'סיימתם הכל'), h('b', null, nu ? nu.title : 'רק לחזור ולחזק'), nu ? h('small', { class: 'muted' }, `${unitCounts(nu).seen}/${unitCounts(nu).total} נענו`) : null),
        icon('chevL'))),

    // Quick actions
    h('div', { class: 'grid grid-4 tiles' },
      tile('bolt', 'תרגול חכם', '15 שאלות לפי מה שצריך', 'var(--brand)', smartAll),
      tile('refresh', 'חזרה מרווחת', dueIds.length ? `${dueIds.length} שאלות מחכות` : 'הכל מעודכן', 'var(--c-vehicle)', () => dueIds.length ? startPractice({ title: 'חזרה מרווחת', ids: dueIds, mode: 'smart', limit: 20, back: '/', kind: 'due' }) : go('/review')),
      tile('x', 'טעויות', weakIds.length ? `${weakIds.length} לתיקון` : 'אין טעויות פתוחות', 'var(--c-safety)', () => weakIds.length ? startPractice({ title: 'תיקון טעויות', ids: weakIds, mode: 'random', limit: 20, back: '/', kind: 'mistakes' }) : go('/review')),
      tile('exam', 'מבחן דמה', `${APP.exam.questions} שאלות · ${APP.exam.minutes} דק׳`, 'var(--c-signs)', () => go('/exam'))),

    // Categories
    h('div', { class: 'section-head' }, h('h2', null, 'נושאי הלימוד'), h('a', { class: 'link', href: '#/learn' }, 'לכל היחידות')),
    h('div', { class: 'grid grid-2' }, CAT_ORDER.map((c) => {
      const cc = catCounts(c), cat = CATS[c];
      if (!cc.total) return null;
      return h('a', { class: 'card catcard', href: `#/learn/${c}`, style: { '--cc': cat.color } },
        h('span', { class: 'cat-emoji' }, cat.emoji),
        h('div', { class: 'grow' }, h('b', null, cat.title), h('small', { class: 'muted' }, `${cc.seen}/${cc.total} נענו · ${cc.strong} בשליטה`), statusBar(cc, cc.total)),
        icon('chevL'));
    })),

    weakUnits.length ? h('div', { class: 'card' }, h('h3', null, 'כדאי לחזק'),
      h('div', { class: 'weak-list' }, weakUnits.map(({ u, a }) => h('a', { class: 'weak-row', href: `#/unit/${u.key}` },
        h('span', { class: 'grow' }, u.title), h('span', { class: 'chip tone-bad' }, `${Math.round(a.acc * 100)}% הצלחה`), icon('chevL'))))) : null,

    earned.length ? h('div', { class: 'card' }, h('div', { class: 'section-head tight' }, h('h3', null, 'תגים אחרונים'), h('a', { class: 'link', href: '#/stats' }, 'הכל')),
      h('div', { class: 'badge-row' }, earned.map((b) => h('div', { class: 'badge', title: b.desc }, h('span', { class: 'badge-e' }, b.emoji), h('small', null, b.name))))) : null,

    h('p', { class: 'fineprint muted center' }, 'שאלות ותשובות: ', h('a', { href: APP.sourceUrl, target: '_blank', rel: 'noopener' }, APP.sourceNote), '. האפליקציה אינה רשמית ואינה מחליפה את המאגר הרשמי.'));

  return { el };
}

function tile(ic, title, sub, color, onclick) {
  return h('button', { class: 'card tile', style: { '--cc': color }, onclick }, h('span', { class: 'tile-ic' }, icon(ic)), h('b', null, title), h('small', { class: 'muted' }, sub));
}
