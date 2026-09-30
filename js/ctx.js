// Application singletons shared by all views.
import { createStore, safeStorage } from './store.js';
import { APP } from './config.js';

export const store = createStore(safeStorage());

/** Navigate. Guard redirects and "you are done here" jumps pass replace=true so the Back button is not trapped. */
export const go = (path, replace = false) => {
  const h = '#' + path;
  if (location.hash === h) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else if (replace) location.replace(h);
  else location.hash = h;
};

// Another tab/window (e.g. the installed app) saved progress: continue from its state instead of overwriting it later.
if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === APP.storageKey) store.reloadFromStorage(); });

export function applyProfile() {
  const p = store.state.profile;
  const root = document.documentElement;
  const dark = p.theme === 'dark' || (p.theme === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.style.setProperty('--fs', String(p.fontScale || 1));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0e1424' : '#2456e6');
}
