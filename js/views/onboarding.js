// First-run welcome sheet: name, license class, exam date, daily goal. Closing it also counts as "done".
import { h, icon, sheet, keepFocus } from '../ui.js';
import { store, applyProfile } from '../ctx.js';
import { APP, LICENSES } from '../config.js';

export function maybeOnboard(rerender) {
  if (store.state.profile.onboarded) return;
  let lic = store.state.profile.lic, goal = store.state.profile.dailyGoal, name = '', date = '';
  let closed = false;
  const finish = () => { if (closed) return; closed = true; store.setProfile({ onboarded: true, name, examDate: date, lic, dailyGoal: goal }); applyProfile(); rerender && rerender(); };
  sheet((body, close) => {
    const licBox = h('div', { class: 'lic-grid compact', role: 'group' });
    const paint = () => keepFocus(licBox, paintInner);
    const paintInner = () => { licBox.textContent = ''; LICENSES.forEach((l) => licBox.append(h('button', { type: 'button', 'aria-pressed': String(lic === l.key), class: `lic-opt ${lic === l.key ? 'on' : ''}`, onclick: () => { lic = l.key; paint(); } }, h('span', { class: 'lic-e' }, l.icon), h('b', null, l.short), h('small', null, l.label)))); };
    paint();
    body.append(
      h('div', { class: 'welcome' },
        h('div', { class: 'welcome-sign', 'aria-hidden': 'true' }, '26'),
        h('h2', null, `ברוכים הבאים אל ${APP.name}`),
        h('p', { class: 'muted' }, `כדי לעבור את מבחן התיאוריה צריך ${APP.exam.passScore} תשובות נכונות מתוך ${APP.exam.questions}. כאן מתרגלים את כל השאלות הרשמיות, יחידה אחר יחידה, עד שזה יושב.`)),
      h('label', { class: 'field stacked' }, h('span', null, 'איך קוראים לכם? (לא חובה)'), h('input', { type: 'text', autocomplete: 'nickname', maxlength: 24, placeholder: 'שם', oninput: (e) => { name = e.target.value.trim(); } })),
      h('div', { class: 'field stacked' }, h('span', null, 'לאיזה רישיון מתכוננים?'), licBox),
      h('label', { class: 'field stacked' }, h('span', null, 'מתי המבחן? (לא חובה – נבנה תוכנית לימוד)'), h('input', { type: 'date', onchange: (e) => { date = e.target.value; } })),
      h('div', { class: 'field stacked' }, h('span', null, 'כמה שאלות ביום?'), h('div', { class: 'seg-ctl' }, [10, 20, 30, 50].map((g) => h('button', { type: 'button', class: g === goal ? 'on' : '', onclick: (e) => { goal = g; e.target.parentNode.querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.textContent === g)); } }, g)))),
      h('div', { class: 'sheet-cta' }, h('button', { class: 'btn btn-lg btn-primary btn-block', onclick: () => { finish(); close(); } }, 'יוצאים לדרך', icon('next'))));
  }, { title: '', label: 'ברוכים הבאים', onClose: finish });
}
