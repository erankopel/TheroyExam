import { h, icon, fmtNum, fmtDuration, pct, toast, countHe } from '../ui.js';
import { D, idsForLic, unitsForLic, unitIdsForLic } from '../data.js';
import { store } from '../ctx.js';
import { APP, CATS, CAT_ORDER } from '../config.js';
import { estimate } from '../readiness.js';
import { heatmap, examBars, statusBar } from '../charts.js';
import { accuracy, catCounts, unitCounts } from '../progress.js';
import { BADGES, totalAnswered } from '../badges.js';
import { openQuestion } from './browse.js';

export function statsView() {
  const st = store.state, lic = st.profile.lic, ids = idsForLic(lic);
  const log = Object.values(st.log);
  const answered = log.reduce((s, d) => s + d.n, 0), right = log.reduce((s, d) => s + d.r, 0), ms = log.reduce((s, d) => s + (d.ms || 0), 0);
  const est = estimate(ids, st.q, store.today());
  const exams = st.exams.filter((e) => e.lic === lic).slice(-12);
  const days = Object.keys(st.log).filter((k) => st.log[k].n > 0).length;
  const tough = ids.map((id) => ({ id, r: st.q[id] })).filter((x) => x.r && x.r.w >= 2).sort((a, b) => b.r.w - a.r.w || a.r.r - b.r.r).slice(0, 8);
  const unitRows = unitsForLic(lic).map((u) => ({ u, a: accuracy(unitIdsForLic(u, lic)), c: unitCounts(u) })).filter((x) => x.a);
  unitRows.sort((a, b) => a.a.acc - b.a.acc);

  const shareText = () => {
    const c = catCounts('law'); const all = ids.reduce((s, id) => s + (st.q[id] ? 1 : 0), 0);
    const last = st.exams.slice(-1)[0];
    return [`📊 ${APP.name} – סיכום התקדמות${st.profile.name ? ' של ' + st.profile.name : ''}`,
      `• נענו ${fmtNum(answered)} שאלות (${pct(right, answered)}% נכון)`, `• כיסוי המאגר: ${pct(all, ids.length)}%`,
      `• סיכוי משוער לעבור: ${Math.round(est.pass * 100)}% (ציון צפוי ${est.expected.toFixed(1)}/${APP.exam.questions})`,
      last ? `• מבחן דמה אחרון: ${last.correct}/${last.total} ${last.passed ? '✅' : '❌'}` : null,
      `• רצף נוכחי: ${countHe(store.streak(), 'יום אחד', 'יומיים', 'ימים')}`].filter(Boolean).join('\n');
  };
  async function share() {
    const text = shareText();
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); toast('הסיכום הועתק ללוח', { tone: 'good', icon: 'check' }); } catch (e) { toast('לא ניתן להעתיק', { tone: 'bad' }); }
  }

  const el = h('section', { class: 'page' },
    h('div', { class: 'page-head row between' }, h('div', null, h('h1', null, 'התקדמות'), h('p', { class: 'muted' }, 'תמונת מצב מלאה')), h('button', { class: 'btn btn-ghost', onclick: share }, icon('share'), 'שיתוף סיכום')),
    h('div', { class: 'grid grid-4 kpis' },
      kpi(fmtNum(answered), 'שאלות נענו'), kpi(answered ? pct(right, answered) + '%' : '–', 'אחוז הצלחה'),
      kpi(`${store.streak()}`, 'ימים ברצף', `שיא: ${store.bestStreak()}`), kpi(fmtDuration(ms / 1000), 'זמן לימוד', days === 1 ? 'יום לימוד אחד' : `${days} ימי לימוד`)),
    h('div', { class: 'card' }, h('h2', { class: 'sub' }, 'פעילות'), heatmap(st.log, { goal: st.profile.dailyGoal }), h('div', { class: 'hm-legend' }, h('small', { class: 'muted' }, 'פחות'), ...[0, 1, 2, 3, 4].map((l) => h('i', { class: `hm-cell hm-${l}` })), h('small', { class: 'muted' }, 'יותר'))),
    h('div', { class: 'card' }, h('h2', { class: 'sub' }, 'מבחני דמה'),
      exams.length ? [examBars(exams), h('p', { class: 'chart-note' }, 'הקו המקווקו הוא ציון עובר (26). מהישן לחדש משמאל לימין.'), h('p', { class: 'muted small' }, exams.length === 1 ? `${exams[0].passed ? 'עברתם' : 'עוד לא עברתם'} את מבחן הדמה · ציון ${exams[0].correct}/${exams[0].total}` : `${exams.filter((e) => e.passed).length} מתוך ${exams.length} מבחנים אחרונים עברו · ציון ממוצע ${(exams.reduce((s, e) => s + e.correct, 0) / exams.length).toFixed(1)}`)] : h('p', { class: 'muted' }, 'עוד לא בוצע מבחן דמה. ', h('a', { class: 'link', href: '#/exam' }, 'למבחן דמה ראשון'))),
    h('div', { class: 'card' }, h('h2', { class: 'sub' }, 'לפי נושא'),
      h('div', { class: 'cat-bars' }, CAT_ORDER.map((c) => {
        const cc = catCounts(c); if (!cc.total) return null;
        const a = accuracy(idsForLic(lic, (q) => q.cat === c));
        return h('div', { class: 'cat-row', style: { '--cc': CATS[c].color } }, h('div', { class: 'row between' }, h('b', null, CATS[c].title), h('small', { class: 'muted' }, a ? `${Math.round(a.acc * 100)}% הצלחה · ` : '', `${cc.seen}/${cc.total} נענו`)), statusBar(cc, cc.total));
      }))),
    unitRows.length ? h('div', { class: 'card' }, h('h2', { class: 'sub' }, 'יחידות – מהחלשה לחזקה'),
      h('div', { class: 'unit-acc' }, unitRows.slice(0, 40).map(({ u, a }) => h('a', { class: 'ua-row', href: `#/unit/${u.key}`, style: { '--cc': CATS[u.cat].color } },
        h('span', { class: 'ua-name' }, u.title), h('span', { class: 'ua-track' }, h('i', { style: { width: `${a.acc * 100}%` } })), h('span', { class: 'ua-val' }, `${Math.round(a.acc * 100)}%`))))) : null,
    tough.length ? h('div', { class: 'card' }, h('h2', { class: 'sub' }, 'השאלות הקשות שלכם'),
      h('div', { class: 'qlist' }, tough.map(({ id, r }) => { const q = D.byId.get(id); return h('button', { class: 'qrow', onclick: () => openQuestion(id, tough.map((x) => x.id)) }, h('span', { class: 'dot dot-weak' }), h('span', { class: 'qrow-text' }, h('span', { class: 'qrow-q' }, q.q), h('span', { class: 'qrow-a' }, `שגיאות: ${r.w} · הצלחות: ${r.r}`)), h('span', { class: 'qrow-num' }, `#${id}`)); }))) : null,
    h('div', { class: 'card' }, h('h2', { class: 'sub' }, 'תגים'),
      h('div', { class: 'badge-grid' }, BADGES.map((b) => { const got = st.badges[b.key]; return h('div', { class: `badge ${got ? '' : 'locked'}`, title: b.desc }, h('span', { class: 'badge-e' }, got ? b.emoji : '🔒'), h('small', null, b.name), h('small', { class: 'muted' }, b.desc)); }))));
  return { el };
}

const kpi = (v, l, sub) => h('div', { class: 'card kpi' }, h('div', { class: 'kpi-v' }, v), h('div', { class: 'kpi-l' }, l), sub ? h('div', { class: 'muted small' }, sub) : null);
