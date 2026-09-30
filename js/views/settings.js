import { h, icon, toast, confirmDialog, clear } from '../ui.js';
import { D } from '../data.js';
import { store, applyProfile, go } from '../ctx.js';
import { APP, LICENSES } from '../config.js';
import { ttsSupported } from '../quiz.js';

export function settingsView() {
  const p = () => store.state.profile;
  const set = (patch) => { store.setProfile(patch); applyProfile(); };

  const seg = (opts, cur, onPick) => h('div', { class: 'seg-ctl', role: 'radiogroup' }, opts.map(([v, t]) => h('button', { role: 'radio', 'aria-checked': String(cur === v), class: cur === v ? 'on' : '', onclick: () => onPick(v) }, t)));
  const toggle = (label, hint, key) => {
    const b = h('button', { class: 'switch', role: 'switch', 'aria-checked': String(!!p()[key]), 'aria-label': label, onclick: () => { set({ [key]: !p()[key] }); b.setAttribute('aria-checked', String(!!p()[key])); } }, h('i'));
    return h('div', { class: 'setting' }, h('div', { class: 'grow' }, h('b', null, label), hint ? h('div', { class: 'muted small' }, hint) : null), b);
  };

  const licGrid = h('div', { class: 'lic-grid', role: 'radiogroup', 'aria-label': 'סוג רישיון' });
  const paintLic = () => { clear(licGrid); LICENSES.forEach((l) => licGrid.append(h('button', { role: 'radio', 'aria-checked': String(p().lic === l.key), class: `lic-opt ${p().lic === l.key ? 'on' : ''}`, onclick: () => { if (p().lic !== l.key) { set({ lic: l.key }); paintLic(); toast(`הוגדר: ${l.label}`, { tone: 'good' }); } } }, h('span', { class: 'lic-e' }, l.icon), h('b', null, l.short), h('small', null, l.label)))); };
  paintLic();

  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { store.importJSON(await f.text()); applyProfile(); toast('הנתונים שוחזרו', { tone: 'good', icon: 'check' }); go('/'); }
    catch (err) { toast('הקובץ אינו גיבוי תקין', { tone: 'bad' }); }
  } });

  const offlineStatus = h('div', { class: 'muted small' }), offlineBar = h('div', { class: 'dl-bar', hidden: true }, h('i'));
  async function downloadAll() {
    if (!('caches' in window) || !navigator.serviceWorker?.controller) return toast('מצב לא מקוון זמין לאחר טעינה שנייה של האתר', { tone: 'warn' });
    const urls = [...new Set(D.questions.filter((q) => q.img).map((q) => `img/q/${q.img}`))];
    offlineBar.hidden = false; let done = 0, fail = 0; const bar = offlineBar.firstChild;
    const worker = async () => { while (urls.length) { const u = urls.pop(); try { const r = await fetch(u); if (!r.ok) fail++; } catch { fail++; } done++; bar.style.width = `${(done / (done + urls.length)) * 100}%`; offlineStatus.textContent = `הורדה… ${done} תמונות`; } };
    await Promise.all(Array.from({ length: 6 }, worker));
    offlineStatus.textContent = fail ? `הסתיים עם ${fail} תקלות – נסו שוב עם חיבור יציב` : `✅ הכל שמור במכשיר – האפליקציה עובדת גם ללא אינטרנט`;
    if (!fail) toast('האפליקציה מוכנה לשימוש ללא אינטרנט', { tone: 'good', icon: 'wifi' });
  }

  let deferred = window.__installPrompt;
  const installBtn = h('button', { class: 'btn btn-ghost', hidden: !deferred, onclick: async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; window.__installPrompt = deferred = null; installBtn.hidden = true; } }, icon('download'), 'התקנה כאפליקציה');
  const iosHint = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone ? h('p', { class: 'muted small' }, 'באייפון: כפתור השיתוף ← "הוספה למסך הבית".') : null;

  const el = h('section', { class: 'page' },
    h('div', { class: 'page-head' }, h('h1', null, 'הגדרות')),
    h('div', { class: 'card' }, h('h3', null, 'פרופיל'),
      h('label', { class: 'field' }, h('span', null, 'שם (להצגה במסך הבית)'), h('input', { type: 'text', value: p().name, maxlength: 24, placeholder: 'לא חובה', oninput: (e) => store.setProfile({ name: e.target.value.trim() }) })),
      h('label', { class: 'field' }, h('span', null, 'תאריך המבחן (לקבלת תוכנית לימוד)'), h('input', { type: 'date', value: p().examDate, onchange: (e) => store.setProfile({ examDate: e.target.value }) })),
      h('div', { class: 'field' }, h('span', null, 'יעד יומי (שאלות)'), seg([[10, '10'], [20, '20'], [30, '30'], [50, '50']], p().dailyGoal, (v) => { set({ dailyGoal: v }); go('/settings'); }))),
    h('div', { class: 'card' }, h('h3', null, 'סוג הרישיון'), h('p', { class: 'muted small' }, 'קובע אילו שאלות מוצגות בלימוד ובמבחן הדמה.'), licGrid),
    h('div', { class: 'card' }, h('h3', null, 'תרגול'),
      toggle('ערבוב סדר התשובות', 'מונע שינון של מיקום התשובה הנכונה. שאלות עם "כל התשובות נכונות" נשארות בסדר הרשמי.', 'shuffle'),
      ttsSupported() ? toggle('הקראה אוטומטית של השאלות', 'קריאה בקול בעברית (תלוי בקולות המותקנים במכשיר)', 'tts') : null),
    h('div', { class: 'card' }, h('h3', null, 'מבחן דמה'),
      h('div', { class: 'field' }, h('span', null, 'תוספת זמן'), seg([[0, 'ללא'], [25, '+25%'], [50, '+50%']], p().examExtra || 0, (v) => { set({ examExtra: v }); go('/settings'); })),
      h('p', { class: 'muted small' }, 'במבחן הרשמי אפשר לקבל התאמות (למשל תוספת זמן) בהתאם לאישור מתאים. כאן אפשר להתאמן באותן תנאים.')),
    h('div', { class: 'card' }, h('h3', null, 'תצוגה'),
      h('div', { class: 'field' }, h('span', null, 'ערכת נושא'), seg([['auto', 'אוטומטי'], ['light', 'בהיר'], ['dark', 'כהה']], p().theme, (v) => { set({ theme: v }); go('/settings'); })),
      h('div', { class: 'field' }, h('span', null, 'גודל טקסט'), seg([[1, 'רגיל'], [1.15, 'גדול'], [1.3, 'גדול מאוד']], p().fontScale, (v) => { set({ fontScale: v }); go('/settings'); }))),
    h('div', { class: 'card' }, h('h3', null, 'שימוש ללא אינטרנט'),
      h('p', { class: 'muted small' }, 'הטקסטים נשמרים אוטומטית. כדי שגם כל ~440 התמונות יהיו זמינות בלי חיבור – הורידו אותן פעם אחת (כ־9MB).'),
      h('div', { class: 'row gap wrap' }, h('button', { class: 'btn btn-ghost', onclick: downloadAll }, icon('download'), 'הורדת התמונות למכשיר'), installBtn), offlineBar, offlineStatus, iosHint),
    h('div', { class: 'card' }, h('h3', null, 'הנתונים שלי'),
      h('p', { class: 'muted small' }, 'ההתקדמות נשמרת בדפדפן הזה בלבד. כדי להעביר למכשיר אחר – ייצאו גיבוי ויבאו אותו שם.'),
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn btn-ghost', onclick: () => { const blob = new Blob([store.exportJSON()], { type: 'application/json' }); const a = h('a', { href: URL.createObjectURL(blob), download: `road26-backup-${new Date().toISOString().slice(0, 10)}.json` }); document.body.append(a); a.click(); a.remove(); toast('הגיבוי הורד', { tone: 'good', icon: 'check' }); } }, icon('download'), 'ייצוא גיבוי'),
        h('button', { class: 'btn btn-ghost', onclick: () => fileIn.click() }, icon('upload'), 'שחזור מגיבוי'), fileIn,
        h('button', { class: 'btn btn-danger-ghost', onclick: async () => { if (await confirmDialog({ title: 'למחוק את כל ההתקדמות?', text: 'כל התשובות, התגים וההיסטוריה יימחקו. אי אפשר לבטל.', ok: 'מחיקה', danger: true })) { store.reset(); applyProfile(); toast('הכל נמחק'); go('/'); } } }, icon('trash'), 'איפוס'))),
    h('div', { class: 'card about' }, h('h3', null, 'על האפליקציה'),
      h('p', { class: 'muted small' }, `${APP.name} · גרסה ${APP.version}`),
      h('p', { class: 'muted small' }, 'השאלות, התשובות והתמונות: ', h('a', { href: APP.sourceUrl, target: '_blank', rel: 'noopener' }, APP.sourceNote), '. האפליקציה היא כלי עזר ללימוד בלבד ואינה רשמית; המבחן הרשמי נקבע על ידי משרד התחבורה.'),
      h('p', { class: 'muted small' }, `${D.questions.length} שאלות · ${D.units.length} יחידות · אין מעקב, אין פרסומות, אין שרת – הכל נשאר אצלכם.`)));
  return { el };
}
