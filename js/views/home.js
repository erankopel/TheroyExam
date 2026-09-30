import { h, icon, fmtNum, countHe } from '../ui.js';
import { dayNum } from '../store.js';
import { shouldPrompt, dismissPrompt, downloadAllImages } from '../offline.js';
import { toast } from '../ui.js';
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
  const est = estimate(ids, st.q, store.today(), st.exams.filter((e) => e.lic === lic));
  const lab = readinessLabel(est.pass);
  const today = store.todayLog(), goal = p.dailyGoal || 20;
  const streak = store.streak(), lv = store.level();
  const all = countStatus(ids);
  const licInfo = LICENSES.find((l) => l.key === lic);

  const hi = p.name ? `שלום ${p.name}` : 'שלום';
  // calendar-day arithmetic: a plain ms/86400000 division is off by one across the daylight-saving change
  const daysLeft = p.examDate ? dayNum(new Date(p.examDate + 'T00:00:00').getTime()) - store.today() : null;
  const remaining = all.new + all.weak;

  const nu = nextUnit(unitsForLic(lic));
  const weakUnits = unitsForLic(lic).map((u) => ({ u, a: accuracy(u.qids.filter((id) => D.byId.get(id).lic.includes(lic))) }))
    .filter((x) => x.a && x.a.n >= 5).sort((a, b) => a.a.acc - b.a.acc).slice(0, 3).filter((x) => x.a.acc < 0.85);

  const smartAll = () => startPractice({ title: 'תרגול חכם', ids, mode: 'smart', limit: 15, back: '/' });
  const dueIds = ids.filter((id) => st.q[id] && store.statusOf(id) !== 'weak' && store.isDue(id));
  const weakIds = ids.filter((id) => store.statusOf(id) === 'weak');

  const earned = BADGES.filter((b) => st.badges[b.key]).sort((a, b) => st.badges[b.key] - st.badges[a.key]).slice(0, 6);

  let offlineCard = null;
  if (shouldPrompt()) {
    const btn = h('button', { class: 'btn btn-primary', onclick: async () => {
      btn.disabled = true;
      const { fail } = await downloadAllImages((d, t) => { btn.textContent = `${Math.round((d / t) * 100)}%`; });
      offlineCard.remove();
      toast(fail ? 'חלק מהתמונות לא ירדו – אפשר לנסות שוב בהגדרות' : 'האפליקציה מוכנה לשימוש ללא אינטרנט', { tone: fail ? 'warn' : 'good', icon: 'wifi' });
    } }, 'הורדה');
    offlineCard = h('div', { class: 'card offline-card' }, icon('wifi'),
      h('div', { class: 'grow' }, h('b', null, 'לעבוד גם בלי אינטרנט?'), h('div', { class: 'muted small' }, 'הורדה חד־פעמית של כל התמונות למכשיר (כ־9MB).')),
      h('button', { class: 'btn btn-ghost', onclick: () => { dismissPrompt(); offlineCard.remove(); } }, 'לא עכשיו'), btn);
  }

  const el = h('section', { class: 'page home' },
    h('div', { class: 'home-top' },
      h('div', null, h('h1', { class: 'greet' }, hi, ' 👋'), h('p', { class: 'muted' }, `${licInfo.icon} רישיון ${licInfo.label} · ${fmtNum(ids.length)} שאלות רלוונטיות`)),
      h('div', { class: 'row gap' },
        h('a', { class: 'pill streak', href: '#/stats', title: 'ימים ברצף', 'aria-label': `${countHe(streak, 'יום אחד', 'יומיים', 'ימים')} ברצף` }, icon('flame'), h('b', null, streak)),
        h('a', { class: 'pill xp', href: '#/stats', title: 'רמה', 'aria-label': `רמה ${lv.level}` }, icon('star'), h('b', null, `רמה ${lv.level}`)))),

    // Readiness
    h('div', { class: 'card hero' },
      h('div', { class: 'hero-gauge' }, gaugeSvg(est.expected / APP.exam.questions, { label: est.expected.toFixed(1), sub: `ציון צפוי מתוך ${APP.exam.questions}`, tone: lab.tone, mark: APP.exam.passScore / APP.exam.questions })),
      h('div', { class: 'hero-text' },
        h('span', { class: `chip tone-${lab.tone}` }, lab.text),
        h('p', null, 'סיכוי משוער לעבור: ', h('b', null, `${Math.round(est.pass * 100)}%`), ` · נדרש ${APP.exam.passScore} נכונות`),
        h('div', { class: 'hero-cov' }, statusBar(all, all.total), h('small', { class: 'muted' }, `שולטים ב־${fmtNum(all.strong)} · בלמידה ${fmtNum(all.learning)} · טעויות ${fmtNum(all.weak)} · חדשות ${fmtNum(all.new)}`)),
        daysLeft != null && daysLeft >= 0 ? h('div', { class: 'exam-date' }, icon('calendar'), h('div', null, h('b', null, daysLeft === 0 ? 'המבחן היום! בהצלחה 🍀' : daysLeft === 1 ? 'נשאר יום אחד למבחן' : daysLeft === 2 ? 'נשארו יומיים למבחן' : `נשארו ${daysLeft} ימים למבחן`), planLine(remaining, daysLeft))) : h('a', { class: 'link small', href: '#/settings' }, 'קבעו תאריך מבחן לקבלת תוכנית לימוד'),
        h('p', { class: 'fineprint muted' }, 'ההערכה מבוססת על ההיסטוריה שלכם באפליקציה ואינה מבטיחה תוצאה.'))),

    // Today
    h('div', { class: 'grid grid-2' },
      h('div', { class: 'card today' },
        ringSvg(Math.min(1, today.n / goal), { size: 84, stroke: 9, label: `${today.n}`, sub: `מתוך ${goal}`, tone: today.n >= goal ? 'good' : 'brand' }),
        h('div', null, h('b', null, today.n >= goal ? 'יעד היום הושג! 🎉' : 'יעד יומי'), h('p', { class: 'muted small' }, today.n >= goal ? 'כל שאלה נוספת היא בונוס.' : `עוד ${countHe(goal - today.n, 'שאלה אחת', 'שתי שאלות', 'שאלות')} להשלמת היעד`),
          h('p', { class: 'muted small' }, `יום נספר אחרי ${APP.streakMinAnswers} שאלות`))),
      h('button', { class: 'card cta', onclick: () => nu ? go(`/unit/${nu.key}`) : smartAll() },
        h('span', { class: 'cta-ic' }, nu ? h('img', { src: unitIcon(nu), alt: '', onerror: (e) => { e.target.replaceWith(h('span', null, nu.emoji || '📘')); } }) : icon('trophy')),
        h('span', { class: 'cta-text' }, h('small', null, nu ? (unitCounts(nu).seen ? 'להמשיך ללמוד' : 'היחידה הבאה') : 'סיימתם הכל'), h('b', null, nu ? nu.title : 'רק לחזור ולחזק'), nu ? h('small', { class: 'muted' }, `${unitCounts(nu).seen}/${unitCounts(nu).total} נענו`) : null),
        icon('chevL'))),

    // Quick actions
    h('div', { class: 'grid grid-4 tiles' },
      tile('bolt', 'תרגול חכם', '15 שאלות לפי מה שצריך', 'var(--brand)', smartAll),
      tile('refresh', 'חזרה מרווחת', dueIds.length ? (dueIds.length === 1 ? 'שאלה אחת מחכה' : `${countHe(dueIds.length, '', 'שתי שאלות', 'שאלות')} מחכות`) : 'הכל מעודכן', 'var(--c-vehicle)', () => dueIds.length ? startPractice({ title: 'חזרה מרווחת', ids: dueIds, mode: 'smart', limit: 20, back: '/', kind: 'due' }) : go('/review')),
      tile('x', 'טעויות', weakIds.length ? `${weakIds.length} לתיקון` : 'אין טעויות פתוחות', 'var(--c-safety)', () => weakIds.length ? startPractice({ title: 'תיקון טעויות', ids: weakIds, mode: 'random', limit: 20, back: '/', kind: 'mistakes' }) : go('/review')),
      tile('exam', 'מבחן דמה', `${APP.exam.questions} שאלות · ${Math.round(APP.exam.minutes * (1 + (p.examExtra || 0) / 100))} דק׳`, 'var(--c-signs)', () => go('/exam'))),

    offlineCard,

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

    weakUnits.length ? h('div', { class: 'card' }, h('h2', { class: 'sub' }, 'כדאי לחזק'),
      h('div', { class: 'weak-list' }, weakUnits.map(({ u, a }) => h('a', { class: 'weak-row', href: `#/unit/${u.key}` },
        h('span', { class: 'grow' }, u.title), h('span', { class: 'chip tone-bad' }, `${Math.round(a.acc * 100)}% הצלחה`), icon('chevL'))))) : null,

    earned.length ? h('div', { class: 'card' }, h('div', { class: 'section-head tight' }, h('h2', { class: 'sub' }, 'תגים אחרונים'), h('a', { class: 'link', href: '#/stats' }, 'הכל')),
      h('div', { class: 'badge-row', tabindex: '0', role: 'group', 'aria-label': 'תגים אחרונים' }, earned.map((b) => h('div', { class: 'badge', title: b.desc }, h('span', { class: 'badge-e' }, b.emoji), h('small', null, b.name))))) : null,

    h('p', { class: 'fineprint muted center' }, 'מקור: ', h('a', { href: APP.sourceUrl, target: '_blank', rel: 'noopener' }, APP.sourceNote), '. האפליקציה אינה רשמית ואינה מחליפה את המאגר הרשמי.'));

  return { el };
}

/** Study-plan hint: only genuinely new questions per day (reviews come on top); no number when the time is clearly too short. */
function planLine(remaining, daysLeft) {
  if (!remaining || daysLeft <= 0) return null;
  const perDay = Math.ceil(remaining / daysLeft);
  if (perDay > 60) return h('div', { class: 'muted small' }, 'הזמן קצר לכל החומר – כדאי להתמקד בטעויות, בנושאים החלשים ובמבחני דמה');
  return h('div', { class: 'muted small' }, perDay === 1 ? 'שאלה חדשה אחת ביום, בנוסף לחזרות' : `כ־${perDay} שאלות חדשות ביום, בנוסף לחזרות`);
}

function tile(ic, title, sub, color, onclick) {
  return h('button', { class: 'card tile', style: { '--cc': color }, onclick }, h('span', { class: 'tile-ic' }, icon(ic)), h('b', null, title), h('small', { class: 'muted' }, sub));
}
