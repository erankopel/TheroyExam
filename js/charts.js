// Minimal SVG/DOM charts (no libraries).
import { h } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  kids.forEach((k) => k != null && el.append(k.nodeType ? k : document.createTextNode(k)));
  return el;
};

/** Circular progress. frac 0..1 */
export function ringSvg(frac, { size = 64, stroke = 8, label = '', sub = '', tone = 'brand', color } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
  const svg = s('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: 'ring-svg', 'aria-hidden': 'true' },
    s('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', 'stroke-width': stroke, class: 'ring-track' }),
    s('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', 'stroke-width': stroke, class: 'ring-val', 'stroke-linecap': 'round',
      'stroke-dasharray': `${c * f} ${c}`, transform: `rotate(-90 ${size / 2} ${size / 2})`, ...(color ? { style: `stroke:${color}` } : {}) }));
  return h('div', { class: `ring tone-${tone}`, style: { width: size + 'px', height: size + 'px' } }, svg,
    label || sub ? h('div', { class: 'ring-text' }, h('b', null, label), sub ? h('small', null, sub) : null) : null);
}

/** Semicircle gauge 0..1 with zones */
export function gaugeSvg(frac, { label = '', sub = '', tone = 'brand', mark = null } = {}) {
  const W = 220, H = 128, cx = 110, cy = 112, r = 92, sw = 16;
  const pt = (t) => { const a = Math.PI * (1 - t); return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
  const arc = (t0, t1) => { const [x0, y0] = pt(t0), [x1, y1] = pt(t1); return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`; };
  const f = Math.max(0.001, Math.min(1, frac));
  const [nx, ny] = pt(f);
  const markLine = (t) => { const a = Math.PI * (1 - t), r0 = r - sw / 2 - 5, r1 = r + sw / 2 + 5; return s('line', { x1: cx + r0 * Math.cos(a), y1: cy - r0 * Math.sin(a), x2: cx + r1 * Math.cos(a), y2: cy - r1 * Math.sin(a), class: 'gauge-mark', 'stroke-width': 3, 'stroke-linecap': 'round' }); };
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'gauge-svg', role: 'img', 'aria-label': `${label} ${sub}` },
    s('path', { d: arc(0, 1), class: 'gauge-track', fill: 'none', 'stroke-width': sw, 'stroke-linecap': 'round' }),
    s('path', { d: arc(0, f), class: `gauge-val tone-${tone}`, fill: 'none', 'stroke-width': sw, 'stroke-linecap': 'round' }),
    mark != null ? markLine(mark) : null,
    s('circle', { cx: nx, cy: ny, r: 7, class: 'gauge-dot' }));
  return h('div', { class: 'gauge' }, svg, h('div', { class: 'gauge-text' }, h('b', null, label), h('small', null, sub)));
}

/** Stacked status bar for a set of questions */
export function statusBar(c, total) {
  const seg = (k, n) => n ? h('i', { class: `seg seg-${k}`, style: { flexGrow: n }, title: `${{ strong: 'שולטים', learning: 'בלמידה', weak: 'טעויות', new: 'חדשות' }[k]}: ${n}` }) : null;
  return h('div', { class: 'statusbar', role: 'img', 'aria-label': `שולטים ${c.strong} מתוך ${total}` },
    seg('strong', c.strong), seg('learning', c.learning), seg('weak', c.weak), seg('new', c.new));
}

/** GitHub-style activity heatmap for the last `weeks` weeks (columns), Sunday first. */
export function heatmap(log, { weeks = 15, goal = 20, now = Date.now() } = {}) {
  const DAY = 86400000, today = new Date(now); today.setHours(12, 0, 0, 0);
  const startOfWeek = new Date(today.getTime() - today.getDay() * DAY);
  const start = new Date(startOfWeek.getTime() - (weeks - 1) * 7 * DAY);
  const pad = (n) => String(n).padStart(2, '0');
  const cols = [];
  for (let w = 0; w < weeks; w++) {
    const col = h('div', { class: 'hm-col' });
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start.getTime() + (w * 7 + d) * DAY);
      if (dt > today) { col.append(h('i', { class: 'hm-cell hm-future' })); continue; }
      const key = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
      const n = log[key]?.n || 0;
      const lvl = n === 0 ? 0 : n < goal / 4 ? 1 : n < goal / 2 ? 2 : n < goal ? 3 : 4;
      col.append(h('i', { class: `hm-cell hm-${lvl}`, title: `${dt.getDate()}/${dt.getMonth() + 1}: ${n} שאלות` }));
    }
    cols.push(col);
  }
  return h('div', { class: 'heatmap', role: 'img', 'aria-label': 'פעילות בשבועות האחרונים' }, cols);
}

/** Bars of exam scores with the pass line. exams: [{correct,total}] */
export function examBars(exams, pass = 26, max = 30) {
  const W = 320, H = 130, pad = 22, n = Math.max(exams.length, 1), gap = 6;
  const bw = Math.min(28, (W - pad * 2 - gap * (n - 1)) / n);
  const total = bw * n + gap * (n - 1), x0 = (W - total) / 2;
  const y = (v) => H - 20 - (v / max) * (H - 40);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'exam-bars', role: 'img', 'aria-label': 'תוצאות מבחני דמה' },
    s('line', { x1: 6, x2: W - 6, y1: y(pass), y2: y(pass), class: 'passline' }),
    s('text', { x: W - 8, y: y(pass) - 4, class: 'passtext', 'text-anchor': 'end' }, `עובר: ${pass}`));
  exams.forEach((e, i) => {
    const x = x0 + i * (bw + gap), yy = y(e.correct);
    svg.append(s('rect', { x, y: yy, width: bw, height: H - 20 - yy, rx: 5, class: e.correct >= pass ? 'bar-good' : 'bar-bad' }),
      s('text', { x: x + bw / 2, y: yy - 4, 'text-anchor': 'middle', class: 'bar-label' }, e.correct));
  });
  return svg;
}
