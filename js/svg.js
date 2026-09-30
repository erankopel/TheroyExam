// Tiny SVG element builder shared by the infographics (no libraries).
const NS = 'http://www.w3.org/2000/svg';
/** s('rect', {x: 1, class: 'a'}, child, 'text') */
export function s(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) el.setAttribute(k, v);
  kids.flat().forEach((k) => k != null && k !== false && el.append(k.nodeType ? k : document.createTextNode(String(k))));
  return el;
}
/** points of a wedge (view cone) from an origin: angles in degrees, 0 = right, 90 = down (SVG y grows downwards) */
export function wedge(ox, oy, a0, a1, len) {
  const p = (a) => [ox + len * Math.cos((a * Math.PI) / 180), oy + len * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `${ox},${oy} ${x0.toFixed(1)},${y0.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
}
