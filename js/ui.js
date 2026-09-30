// Tiny DOM helpers, inline icon set, toasts and bottom sheets. No dependencies.

/** h('div', {class:'x', onclick: fn, dataset:{a:1}}, 'text', childNode, [more]) */
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sv == null) continue; if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
      else if (k === 'html') el.innerHTML = v; // only ever used with trusted, build-time strings
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, kids);
  return el;
}
/** Null-safe append (the DOM's own append() would print the text "null"). */
export function add(parent, ...kids) { append(parent, kids); return parent; }
function append(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

// ---- icons (24x24, stroke based) -------------------------------------------------
const P = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  book: '<path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z"/><path d="M12 6v14"/>',
  exam: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9z"/><path d="M9 14l2 2 4-4"/>',
  sign: '<path d="M12 3l10 18H2z"/><path d="M12 10v4.5"/><path d="M12 17.6h.01"/>',
  chart: '<path d="M4 20V11"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
  sliders: '<path d="M4 6h9"/><path d="M19 6h1"/><circle cx="16" cy="6" r="2.2"/><path d="M4 12h1"/><path d="M11 12h9"/><circle cx="8" cy="12" r="2.2"/><path d="M4 18h9"/><path d="M19 18h1"/><circle cx="16" cy="18" r="2.2"/>',
  flame: '<path d="M12 3c.6 3 4.6 5 4.6 9.6a4.6 4.6 0 0 1-9.2 0c0-1.8.9-3.2 2-4.1.1 1.6.8 2.6 1.9 2.9C11 8.8 10.6 6 12 3z"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  speaker: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 9a4 4 0 0 1 0 6"/><path d="M19 6.5a8 8 0 0 1 0 11"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  next: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',      // arrow pointing left (= "forward" in RTL)
  prev: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',       // arrow pointing right (= "back" in RTL)
  chevL: '<path d="M15 5l-7 7 7 7"/>',
  chevR: '<path d="M9 5l7 7-7 7"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  download: '<path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>',
  upload: '<path d="M12 16V4"/><path d="M7 8l5-5 5 5"/><path d="M4 20h16"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a4 4 0 0 0 4 4"/><path d="M17 6h3v1a4 4 0 0 1-4 4"/><path d="M12 14v4"/><path d="M8 21h8"/><path d="M9 18h6"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  shuffle: '<path d="M3 7h3.5c3 0 4.5 2 6 5s3 5 6 5H21"/><path d="M18 14l3 3-3 3"/><path d="M3 17h3.5c1.5 0 2.6-.5 3.6-1.4"/><path d="M13 8.2C14 7.4 15.100 7 16.500 7H21"/><path d="M18 4l3 3-3 3"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  cards: '<rect x="4" y="6" width="13" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v12"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.800l7.600-4.400M8.200 13.200l7.600 4.400"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17"/><path d="M8 3v4M16 3v4"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  eye: '<path d="M2 12s3.600-7 10-7 10 7 10 7-3.600 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  wifi: '<path d="M2 9a15 15 0 0 1 20 0"/><path d="M5.500 12.500a10 10 0 0 1 13 0"/><path d="M9 16a5 5 0 0 1 6 0"/><path d="M12 19.500h.01"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-9 9"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.500 6.500l4 4"/>',
};
export function icon(name, cls = '', size) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'ic ' + cls);
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  if (size) { s.setAttribute('width', size); s.setAttribute('height', size); }
  s.innerHTML = P[name] || '';
  return s;
}

// ---- toasts --------------------------------------------------------------------
export function toast(msg, { tone = 'info', ms = 2600, icon: ic } = {}) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const t = h('div', { class: `toast toast-${tone}`, role: 'status' }, ic ? icon(ic) : null, h('span', null, msg));
  host.append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, ms);
}

// ---- modal / bottom sheet ---------------------------------------------------------
const openSheets = []; // stack of { close } – the last one is the top-most
export function closeAllSheets() { [...openSheets].forEach((s) => s.close(true)); }

export function sheet(build, { title = '', onClose } = {}) {
  const host = document.getElementById('overlay');
  const opener = document.activeElement;
  let closed = false;
  const entry = { close: (instant) => {
    if (closed) return; closed = true;
    const i = openSheets.indexOf(entry); if (i >= 0) openSheets.splice(i, 1);
    document.removeEventListener('keydown', onKey);
    const done = () => { back.remove(); onClose && onClose(); if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true }); };
    if (instant) done(); else { back.classList.remove('in'); setTimeout(done, 200); }
  } };
  const close = () => entry.close(false);
  // Only the top-most sheet reacts to Escape; Tab is kept inside the dialog.
  const onKey = (e) => {
    if (openSheets[openSheets.length - 1] !== entry) return;
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key === 'Tab') {
      const f = [...panel.querySelectorAll('button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')].filter((n) => !n.disabled && n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    }
  };
  const body = h('div', { class: 'sheet-body' });
  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'חלון', tabindex: '-1' },
    h('div', { class: 'sheet-head' }, h('h3', null, title), h('button', { class: 'btn btn-icon btn-ghost', 'aria-label': 'סגירה', onclick: close }, icon('x'))),
    body);
  const back = h('div', { class: 'sheet-back', onclick: (e) => { if (e.target === back) close(); } }, panel);
  host.append(back);
  openSheets.push(entry);
  build(body, close);
  requestAnimationFrame(() => { back.classList.add('in'); panel.focus({ preventScroll: true }); });
  document.addEventListener('keydown', onKey);
  return close;
}

export function confirmDialog({ title, text, ok = 'אישור', cancel = 'ביטול', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v, close) => { if (done) return; done = true; close(); resolve(v); };
    sheet((body, close) => {
      body.append(
        h('p', { class: 'sheet-text' }, text),
        h('div', { class: 'row gap end' },
          h('button', { class: 'btn btn-ghost', onclick: () => finish(false, close) }, cancel),
          h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, onclick: () => finish(true, close) }, ok)));
    }, { title, onClose: () => { if (!done) { done = true; resolve(false); } } });
  });
}

// ---- formatting ---------------------------------------------------------------
export const fmtNum = (n) => new Intl.NumberFormat('he-IL').format(Math.round(n));
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
export function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}
export function fmtDuration(sec) {
  sec = Math.round(sec);
  if (sec < 60) return `${sec} שנ׳`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} דק׳`;
  return `${Math.floor(m / 60)} ש׳ ${m % 60} דק׳`;
}
export function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function plural(n, one, many, two) {
  if (n === 1) return one;
  if (n === 2 && two) return two;
  return many;
}

/** Hebrew counted noun: countHe(1,'שאלה אחת','שתי שאלות','שאלות') -> 'שאלה אחת'; 2 -> 'שתי שאלות'; 7 -> '7 שאלות'. */
export function countHe(n, one, two, many) { return n === 1 ? one : n === 2 ? two : `${n} ${many}`; }
