// Bootstrap: data loading, hash router, app shell, service worker.
import { h, icon, clear, toast, $, closeAllSheets } from './ui.js';
import { loadData, D } from './data.js';
import { store, applyProfile } from './ctx.js';
import { APP } from './config.js';
import { homeView } from './views/home.js';
import { learnView, unitView } from './views/learn.js';
import { practiceView } from './views/practice.js';
import { examIntroView, examRunView, examResultView } from './views/exam.js';
import { reviewView } from './views/review.js';
import { signsView } from './views/signs.js';
import { statsView } from './views/stats.js';
import { searchView } from './views/search.js';
import { settingsView } from './views/settings.js';
import { maybeOnboard } from './views/onboarding.js';

const ROUTES = [
  ['/', homeView, 'home'],
  ['/learn', learnView, 'learn'], ['/learn/:cat', learnView, 'learn'],
  ['/unit/:key', unitView, 'learn'],
  ['/practice', practiceView, 'learn', true],
  ['/exam', examIntroView, 'exam'], ['/exam/run', examRunView, 'exam', true], ['/exam/result/:idx', examResultView, 'exam'],
  ['/review', reviewView, 'review'], ['/review/:tab', reviewView, 'review'],
  ['/signs', signsView, 'signs'], ['/signs/:key', signsView, 'signs'],
  ['/stats', statsView, 'stats'], ['/search', searchView, 'search'], ['/settings', settingsView, 'settings'],
].map(([path, view, tab, focus]) => ({ view, tab, focus: !!focus, keys: [...path.matchAll(/:(\w+)/g)].map((m) => m[1]), re: new RegExp('^' + path.replace(/:\w+/g, '([^/]+)') + '$') }));

const NAV = [
  ['home', '/', 'home', 'בית'], ['learn', '/learn', 'book', 'לימוד'], ['signs', '/signs', 'sign', 'תמרורים'],
  ['exam', '/exam', 'exam', 'מבחן דמה'], ['review', '/review', 'refresh', 'חזרה'],
];
const NAV_MORE = [['stats', '/stats', 'chart', 'התקדמות'], ['search', '/search', 'search', 'חיפוש'], ['settings', '/settings', 'sliders', 'הגדרות']];

let current = null, viewEl;

function logo() {
  return h('span', { class: 'logo', 'aria-hidden': 'true', html: '<svg viewBox="0 0 40 40"><rect width="40" height="40" rx="11" fill="#2456e6"/><path d="M14 33 18 7h4l4 26z" fill="#2b3350"/><path d="M20 10v4M20 18v4M20 26v4" stroke="#ffc21a" stroke-width="2.4" stroke-linecap="round"/></svg>' });
}

function shell() {
  const app = $('#app'); clear(app);
  const link = ([k, path, ic, label], cls) => h('a', { class: `${cls} nav-${k}`, href: '#' + path, dataset: { tab: k } }, icon(ic), h('span', null, label));
  app.append(
    h('header', { class: 'topbar' },
      h('a', { class: 'brand', href: '#/' }, logo(), h('span', null, h('b', null, APP.name), h('small', null, APP.tagline))),
      h('nav', { class: 'top-actions', 'aria-label': 'קיצורים' }, NAV_MORE.map(([k, path, ic, label]) => h('a', { class: 'btn btn-icon btn-ghost', href: '#' + path, 'aria-label': label, title: label, dataset: { tab: k } }, icon(ic))))),
    h('div', { class: 'layout' },
      h('nav', { class: 'rail', 'aria-label': 'ניווט ראשי' }, NAV.map((n) => link(n, 'rail-link')), h('hr'), NAV_MORE.map((n) => link(n, 'rail-link'))),
      h('main', { id: 'view', tabindex: '-1' })),
    h('nav', { class: 'tabbar', 'aria-label': 'ניווט ראשי' }, NAV.map((n) => link(n, 'tab'))));
  viewEl = $('#view');
}

function match(path) {
  for (const r of ROUTES) { const m = r.re.exec(path); if (m) { const params = {}; r.keys.forEach((k, i) => { try { params[k] = decodeURIComponent(m[i + 1]); } catch (e) { params[k] = m[i + 1]; } }); return { r, params }; } }
  return null;
}

let lastPath = null;
function render() {
  const path = (location.hash.replace(/^#/, '') || '/').split('?')[0];
  const m = match(path) || match('/');
  closeAllSheets(); // a dialog belongs to the screen that opened it
  if (current && current.destroy) { try { current.destroy(); } catch (e) { console.error(e); } }
  clear(viewEl);
  let out;
  try { out = m.r.view(m.params); } catch (e) { console.error(e); out = { el: h('div', { class: 'page' }, h('div', { class: 'card' }, h('h2', null, 'אופס, משהו השתבש'), h('p', { class: 'muted' }, String(e.message || e)), h('a', { class: 'btn btn-primary', href: '#/' }, 'למסך הבית'))) }; }
  current = out;
  viewEl.append(out.el);
  document.body.classList.toggle('focus', m.r.focus);
  document.body.dataset.route = m.r.tab;
  document.querySelectorAll('[data-tab]').forEach((a) => a.classList.toggle('active', a.dataset.tab === m.r.tab));
  document.querySelectorAll('[data-tab]').forEach((a) => (a.dataset.tab === m.r.tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  const changed = path !== lastPath;
  if (changed) window.scrollTo({ top: 0 });
  lastPath = path;
  const T = { learn: 'לימוד', exam: 'מבחן דמה', review: 'חזרה', signs: 'מילון תמרורים', stats: 'התקדמות', search: 'חיפוש', settings: 'הגדרות' };
  document.title = T[m.r.tab] ? `${T[m.r.tab]} · ${APP.name}` : `${APP.name} – ${APP.tagline}`;
  if (changed && !m.r.focus) viewEl.focus({ preventScroll: true });
}

async function boot() {
  applyProfile();
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', applyProfile);
  shell();
  viewEl.append(h('div', { class: 'boot' }, h('div', { class: 'spinner' }), h('p', { class: 'muted' }, 'טוען את מאגר השאלות…')));
  try { await loadData(); }
  catch (e) {
    console.error(e);
    clear(viewEl).append(h('div', { class: 'page' }, h('div', { class: 'card' }, h('h2', null, 'לא הצלחנו לטעון את המאגר'), h('p', { class: 'muted' }, 'בדקו את החיבור לאינטרנט ונסו שוב.'), h('button', { class: 'btn btn-primary', onclick: () => location.reload() }, 'ניסיון חוזר'))));
    return;
  }
  // The user may have picked a license that has no questions (should not happen) – guard.
  window.addEventListener('hashchange', render);
  render();
  registerSW();
  maybeOnboard(render);
}

// make sure the debounced save reaches storage when the tab is hidden/closed
window.addEventListener('pagehide', () => store.flush());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') store.flush(); });

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installPrompt = e; });

function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          const t = h('button', { class: 'btn btn-primary', onclick: () => location.reload() }, 'רענון');
          toast('יש גרסה חדשה של האפליקציה', { tone: 'info', ms: 12000 });
          document.getElementById('toasts').lastChild?.append(t);
        }
      });
    });
  }).catch(() => {});
}

boot();
