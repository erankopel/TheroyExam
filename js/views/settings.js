import { h, icon, toast, confirmDialog, clear, fmtNum, keepFocus } from '../ui.js';
import { D } from '../data.js';
import { store, applyProfile, go } from '../ctx.js';
import { APP, LICENSES } from '../config.js';
import { ttsSupported } from '../quiz.js';
import { imagesReady, canCache, downloadAllImages } from '../offline.js';

export function settingsView() {
  const p = () => store.state.profile;
  const set = (patch) => { store.setProfile(patch); applyProfile(); };

  const seg = (opts, cur, onPick, label = '') => {
    const box = h('div', { class: 'seg-ctl', role: 'group', 'aria-label': label || null });
    opts.forEach(([v, t]) => box.append(h('button', { type: 'button', 'aria-pressed': String(cur === v), class: cur === v ? 'on' : '', onclick: (e) => {
      onPick(v);
      [...box.children].forEach((b) => { const on = b === e.currentTarget; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    } }, t)));
    return box;
  };
  const toggle = (label, hint, key) => {
    const b = h('button', { class: 'switch', role: 'switch', 'aria-checked': String(!!p()[key]), 'aria-label': label, onclick: () => { set({ [key]: !p()[key] }); b.setAttribute('aria-checked', String(!!p()[key])); } }, h('i'));
    return h('div', { class: 'setting' }, h('div', { class: 'grow' }, h('b', null, label), hint ? h('div', { class: 'muted small' }, hint) : null), b);
  };

  const licGrid = h('div', { class: 'lic-grid', role: 'group', 'aria-label': 'סוג רישיון' });
  const paintLic = () => keepFocus(licGrid, paintLicInner);
  const paintLicInner = () => { clear(licGrid); LICENSES.forEach((l) => licGrid.append(h('button', { 'aria-pressed': String(p().lic === l.key), class: `lic-opt ${p().lic === l.key ? 'on' : ''}`, onclick: () => { if (p().lic !== l.key) { set({ lic: l.key }); paintLic(); toast(`הוגדר: ${l.label}`, { tone: 'good' }); } } }, h('span', { class: 'lic-e' }, l.icon), h('b', null, l.short), h('small', null, l.label)))); };
  paintLic();

  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    let next;
    try { next = store.parseBackup(await f.text()); } catch (err) { return toast('הקובץ אינו גיבוי תקין', { tone: 'bad' }); }
    const answered = Object.keys(next.q).length;
    const ok = await confirmDialog({ title: 'לשחזר מגיבוי?', text: `ההתקדמות הנוכחית תוחלף בנתוני הקובץ (${answered} שאלות שנענו, ${next.xp} נקודות). אי אפשר לבטל.`, ok: 'שחזור', danger: true });
    if (!ok) return;
    store.applyState(next); applyProfile(); toast('הנתונים שוחזרו', { tone: 'good', icon: 'check' }); go('/');
  } });

  const offlineStatus = h('div', { class: 'muted small' }, imagesReady() ? '✅ התמונות שמורות במכשיר – האפליקציה עובדת גם ללא אינטרנט' : ''), offlineBar = h('div', { class: 'dl-bar', hidden: true }, h('i'));
  async function downloadAll() {
    if (!canCache()) return toast('מצב לא מקוון זמין לאחר טעינה שנייה של האתר', { tone: 'warn' });
    offlineBar.hidden = false; const bar = offlineBar.firstChild;
    const { fail } = await downloadAllImages((done, total) => { bar.style.width = `${(done / total) * 100}%`; offlineStatus.textContent = `הורדה… ${done} מתוך ${total} תמונות`; });
    offlineStatus.textContent = fail ? `הסתיים עם ${fail} תקלות – נסו שוב עם חיבור יציב` : '✅ הכל שמור במכשיר – האפליקציה עובדת גם ללא אינטרנט';
    if (!fail) toast('האפליקציה מוכנה לשימוש ללא אינטרנט', { tone: 'good', icon: 'wifi' });
  }

  let deferred = window.__installPrompt;
  const installBtn = h('button', { class: 'btn btn-ghost', hidden: !deferred, onclick: async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; window.__installPrompt = deferred = null; installBtn.hidden = true; } }, icon('download'), 'התקנה כאפליקציה');
  const iosHint = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone ? h('p', { class: 'muted small' }, 'באייפון: כפתור השיתוף ← "הוספה למסך הבית".') : null;

  const el = h('section', { class: 'page' },
    h('div', { class: 'page-head' }, h('h1', null, 'הגדרות')),
    h('div', { class: 'card' }, h('h2', { class: 'sub' }, 'פרופיל'),
      h('label', { class: 'field' }, h('span', null, 'שם (להצגה במסך הבית)'), h('input', { type: 'text', autocomplete: 'nickname', value: p().name, maxlength: 24, placeholder: 'לא חובה', oninput: (e) => store.setProfile({ name: e.target.value.trim() }) })),
      h('label', { class: 'field' }, h('span', null, 'תאריך המבחן (לקבלת תוכנית לימוד)'), h('input', { type: 'date', value: p().examDate, onchange: (e) => store.setProfile({ examDate: e.target.value }) })),
      h('div', { class: 'field' }, h('span', null, 'יעד יומי (שאלות)'), seg([[10, '10'], [20, '20'], [30, '30'], [50, '50']], p().dailyGoal, (v) => { set({ dailyGoal: v }); }, 'יעד יומי'))),
    h('div', { class: 'card' }, h('h2', { class: 'sub' }, 'סוג הרישיון'), h('p', { class: 'muted small' }, 'קובע אילו שאלות מוצגות בלימוד ובמבחן הדמה.'), licGrid),
    h('div', { class: 'card' }, h('h2', { class: 'sub' }, 'תרגול'),
      toggle('ערבוב סדר התשובות', 'מונע שינון של מיקום התשובה הנכונה. שאלות עם "כל התשובות נכונות" נשארות בסדר הרשמי.', 'shuffle'),
      ttsSupported() ? toggle('הקראה אוטומטית של השאלות', 'קריאה בקול בעברית (תלוי בקולות המותקנים במכשיר)', 'tts') : null),
    h('div', { class: 'card' }, h('h2', { class: 'sub' }, 'מבחן דמה'),
      h('div', { class: 'field' }, h('span', null, 'תוספת זמן'), seg([[0, 'ללא'], [25, '\u200e+25%'], [50, '\u200e+50%']], p().examExtra || 0, (v) => { set({ examExtra: v }); }, 'תוספת זמן')),
      h('p', { class: 'muted small' }, 'במבחן הרשמי אפשר לקבל התאמות (למשל תוספת זמן) בהתאם לאישור מתאים. כאן אפשר להתאמן באותן תנאים.')),
    h('div', { class: 'card' }, h('h2', { class: 'sub' }, 'תצוגה'),
      h('div', { class: 'field' }, h('span', null, 'ערכת נושא'), seg([['auto', 'אוטומטי'], ['light', 'בהיר'], ['dark', 'כהה']], p().theme, (v) => { set({ theme: v }); }, 'ערכת נושא')),
      h('div', { class: 'field' }, h('span', null, 'גודל טקסט'), seg([[1, 'רגיל'], [1.15, 'גדול'], [1.3, 'גדול מאוד']], p().fontScale, (v) => { set({ fontScale: v }); }, 'גודל טקסט'))),
    h('div', { class: 'card' }, h('h2', { class: 'sub' }, 'שימוש ללא אינטרנט'),
      h('p', { class: 'muted small' }, 'הטקסטים נשמרים אוטומטית. כדי שגם כל כ־440 התמונות יהיו זמינות בלי חיבור – הורידו אותן פעם אחת (כ־9MB).'),
      h('div', { class: 'row gap wrap' }, h('button', { class: 'btn btn-ghost', onclick: downloadAll }, icon('download'), 'הורדת התמונות למכשיר'), installBtn), offlineBar, offlineStatus, iosHint),
    h('div', { class: 'card' }, h('h2', { class: 'sub' }, 'הנתונים שלי'),
      h('p', { class: 'muted small' }, 'ההתקדמות נשמרת בדפדפן הזה בלבד. כדי להעביר למכשיר אחר – לחצו על "ייצוא גיבוי", ובמכשיר החדש על "שחזור מגיבוי".'),
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn btn-ghost', onclick: () => { const blob = new Blob([store.exportJSON()], { type: 'application/json' }); const a = h('a', { href: URL.createObjectURL(blob), download: `road26-backup-${new Date().toISOString().slice(0, 10)}.json` }); document.body.append(a); a.click(); a.remove(); toast('הגיבוי הורד', { tone: 'good', icon: 'check' }); } }, icon('download'), 'ייצוא גיבוי'),
        h('button', { class: 'btn btn-ghost', onclick: () => fileIn.click() }, icon('upload'), 'שחזור מגיבוי'), fileIn,
        h('button', { class: 'btn btn-danger-ghost', onclick: async () => { if (await confirmDialog({ title: 'למחוק את כל ההתקדמות?', text: 'כל התשובות, התגים וההיסטוריה יימחקו. אי אפשר לבטל.', ok: 'מחיקה', danger: true })) { store.reset(); applyProfile(); toast('הכל נמחק'); go('/'); } } }, icon('trash'), 'איפוס'))),
    h('div', { class: 'card about' }, h('h2', { class: 'sub' }, 'על האפליקציה'),
      h('p', { class: 'muted small' }, `${APP.name} · גרסה ${APP.version}`),
      h('p', { class: 'muted small' }, 'מקור השאלות, התשובות והתמונות: ', h('a', { href: APP.sourceUrl, target: '_blank', rel: 'noopener' }, APP.sourceNote), '. האפליקציה היא כלי עזר ללימוד בלבד ואינה רשמית; המבחן הרשמי נקבע על ידי משרד התחבורה.'),
      h('p', { class: 'muted small' }, `${fmtNum(D.questions.length)} שאלות · ${D.units.length} יחידות · אין מעקב, אין פרסומות, אין שרת – הכל נשאר אצלכם.`)));
  return { el };
}
