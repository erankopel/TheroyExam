// Application singletons shared by all views.
import { createStore, safeStorage } from './store.js';

export const store = createStore(safeStorage());

export const go = (path) => { const h = '#' + path; if (location.hash === h) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = h; };

export function applyProfile() {
  const p = store.state.profile;
  const root = document.documentElement;
  const dark = p.theme === 'dark' || (p.theme === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.style.setProperty('--fs', String(p.fontScale || 1));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0e1424' : '#2456e6');
}
