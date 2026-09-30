// The interactive infographics (DOM builders). Content and bank references live in visual-data.js.
import { h, announce, fmtNum } from './ui.js';
import { s, wedge } from './svg.js';
import { stoppingDistance, CONDITIONS, DRIVERS, SPEEDS } from './visual-math.js';
import { visualByKey } from './visual-data.js';

const ltr = (text) => h('bdi', { dir: 'ltr' }, text);
const km = (n) => `${fmtNum(n)} קמ״ש`;

/** segmented buttons (aria-pressed) that keep focus while the selection changes */
function segmented(label, id, options, get, set) {
  const btns = Object.entries(options).map(([k, o]) => h('button', { type: 'button', dataset: { k }, onclick: () => { set(k); paint(); } }, o.label));
  const paint = () => btns.forEach((b) => { const on = get() === b.dataset.k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  paint();
  return h('div', { class: 'vz-ctl' }, h('span', { class: 'vz-lab', id }, label), h('div', { class: 'seg-ctl', role: 'group', 'aria-labelledby': id }, btns));
}

// ============================================================================================================
// 1. stopping distance
// ============================================================================================================
const SCALE_M = 250, X0 = 620, PX = 2.4;   // 250 m across the road, the car starts at the right and drives left
const xAt = (m) => X0 - m * PX;

function stopSvg(d, label) {
  const r = d.reaction, b = d.braking, xr = xAt(r), xs = xAt(r + b);
  const ticks = [0, 50, 100, 150, 200, 250].map((m) => s('g', null,
    s('line', { x1: xAt(m), x2: xAt(m), y1: 108, y2: 116, class: 'vz-tick' }),
    s('text', { x: xAt(m), y: 132, class: 'vz-num', 'text-anchor': 'middle' }, m === 0 ? '0' : `${m}`)));
  const car = (x, cls) => s('g', { class: cls },
    s('rect', { x, y: 70, width: 36, height: 20, rx: 6 }), s('rect', { x: x + 6, y: 74, width: 10, height: 12, rx: 2, class: 'vz-win' }), s('rect', { x: x + 20, y: 74, width: 10, height: 12, rx: 2, class: 'vz-win' }));
  return s('svg', { viewBox: '0 0 640 150', class: 'vz-stop-svg', role: 'img', 'aria-label': label, preserveAspectRatio: 'xMidYMid meet' },
    s('rect', { x: 20, y: 60, width: 600, height: 44, rx: 6, class: 'vz-road' }),
    s('line', { x1: 24, x2: 616, y1: 82, y2: 82, class: 'vz-lane' }),
    s('rect', { x: xr, y: 64, width: Math.max(1, X0 - xr), height: 36, class: 'vz-seg-r' }),
    s('rect', { x: xs, y: 64, width: Math.max(1, xr - xs), height: 36, class: 'vz-seg-b' }),
    ticks,
    // moment 1: the danger is noticed
    s('g', { class: 'vz-mark' }, s('path', { d: `M${X0} 22 l12 -1 l-6 -17 z`, class: 'vz-warn' }), s('line', { x1: X0, x2: X0, y1: 26, y2: 60, class: 'vz-stem' })),
    // moment 2: the brake is pressed
    s('g', { class: 'vz-mark' }, s('circle', { cx: xr, cy: 24, r: 8, class: 'vz-brake' }), s('line', { x1: xr, x2: xr, y1: 32, y2: 60, class: 'vz-stem' })),
    // moment 3: the car stops
    car(xs, 'vz-car-stop'),
    s('line', { x1: xs, x2: xs, y1: 52, y2: 108, class: 'vz-stopline' }),
    car(X0 - 36, 'vz-car'));
}

export function buildStopping() {
  const st = { kmh: 60, cond: 'dry', drv: 'alert' };
  const opts = () => ({ t: DRIVERS[st.drv].t, mu: CONDITIONS[st.cond].mu });
  const svgHost = h('div', { class: 'vz-svg' });
  const out = h('output', { class: 'vz-speed-val', id: 'vz-speed-val', for: 'vz-speed' });
  const slider = h('input', { type: 'range', id: 'vz-speed', min: SPEEDS.min, max: SPEEDS.max, step: SPEEDS.step, value: st.kmh, 'aria-describedby': 'vz-speed-val' });
  const tiles = ['r', 'b', 't'].map((k) => h('div', { class: `vz-tile vz-tile-${k}` }, h('small', null, { r: 'מרחק תגובה', b: 'מרחק בלימה', t: 'מרחק עצירה' }[k]), h('b', { class: 'vz-tile-v' })));
  const cars = h('p', { class: 'vz-cars muted' }), half = h('p', { class: 'vz-half' });
  const summary = () => {
    const d = stoppingDistance(st.kmh, opts());
    return `במהירות ${km(st.kmh)}, ${CONDITIONS[st.cond].label}, ${DRIVERS[st.drv].label}: מרחק תגובה ${fmtNum(d.reaction)} מטרים, מרחק בלימה ${fmtNum(d.braking)} מטרים, מרחק עצירה כולל ${fmtNum(d.total)} מטרים.`;
  };
  function paint() {
    const d = stoppingDistance(st.kmh, opts());
    out.textContent = km(st.kmh);
    slider.setAttribute('aria-valuetext', km(st.kmh));
    svgHost.replaceChildren(stopSvg(d, summary()));
    [d.reaction, d.braking, d.total].forEach((v, i) => tiles[i].querySelector('.vz-tile-v').replaceChildren(ltr(`${fmtNum(v)} מ׳`)));
    cars.textContent = `בערך ${fmtNum(d.carLengths)} אורכי רכב (רכב פרטי הוא כ־4.5 מטרים).`;
    const hv = Math.max(SPEEDS.min / 2, Math.round(st.kmh / 2 / 5) * 5), dh = stoppingDistance(hv, opts());
    half.replaceChildren(`בחצי מהירות (${km(hv)}) מרחק העצירה הוא `, ltr(`${fmtNum(dh.total)} מ׳`), ' בלבד, כלומר ', `קצר ב־${fmtNum((1 - dh.total / stoppingDistance(hv * 2, opts()).total) * 100)}%`, '. מרחק הבלימה קטן יותר מפי שניים.');
    presets.forEach((b) => b.classList.toggle('on', +b.dataset.v === st.kmh));
  }
  const presets = [50, 70, 90, 110].map((v) => h('button', { type: 'button', class: 'chip-btn', dataset: { v }, onclick: () => { st.kmh = v; slider.value = v; paint(); announce(summary()); } }, km(v)));
  slider.addEventListener('input', () => { st.kmh = +slider.value; paint(); });
  slider.addEventListener('change', () => announce(summary()));
  const el = h('div', { class: 'vz vz-stop' },
    h('div', { class: 'card vz-controls' },
      h('div', { class: 'vz-ctl' }, h('label', { class: 'vz-lab', for: 'vz-speed' }, 'מהירות הנסיעה'), h('div', { class: 'vz-slider' }, slider, out)),
      h('div', { class: 'chips vz-presets' }, presets),
      segmented('מצב הכביש', 'vz-l-cond', CONDITIONS, () => st.cond, (k) => { st.cond = k; paint(); announce(summary()); }),
      segmented('מצב הנהג', 'vz-l-drv', DRIVERS, () => st.drv, (k) => { st.drv = k; paint(); announce(summary()); })),
    h('div', { class: 'card vz-figure' },
      svgHost,
      h('ul', { class: 'vz-legend' },
        h('li', null, h('i', { class: 'sw sw-r' }), 'מרחק התגובה: הרכב ממשיך לנסוע בזמן שהנהג מבחין ומחליט'),
        h('li', null, h('i', { class: 'sw sw-b' }), 'מרחק הבלימה: מהלחיצה על הבלם ועד עצירה מלאה')),
      h('div', { class: 'vz-tiles' }, tiles), cars, half,
      h('p', { class: 'fineprint muted' }, 'איור להמחשה: המספרים משוערים (זמן תגובה של שנייה לנהג ערני ושתי שניות לנהג עייף או אחרי אלכוהול, כביש יבש או רטוב) ואינם נדרשים במבחן. מה שחשוב הוא הקשרים בין המרחקים.')));
  paint();
  return el;
}

// ============================================================================================================
// 2. blind spots
// ============================================================================================================
const BLIND = {
  car: {
    box: '-10 130 340 290', body: { x: 128, y: 150, w: 64, h: 140 }, cab: null,
    cones: [['interior', 160, 190, 75, 105, 220], ['left', 126, 176, 98, 128, 220], ['right', 194, 176, 52, 82, 220]],
    zones: [['left', 'wedge', 126, 206, 130, 172, 120, 'head'], ['right', 'wedge', 194, 206, 8, 50, 120, 'head'], ['rear', 'poly', '124,292 196,292 208,340 112,340', null, null, null, 'camera']],
    things: [['bike', 82, 262], ['bike', 238, 262], ['person', 160, 322]],
    alt: 'מבט מלמעלה על רכב פרטי: המראות מכסות את הדרך שמאחור ובצדדים, ושלושה אזורים נשארים סמויים: אלכסון שמאלי, אלכסון ימני והשטח שממש מאחורי הרכב.',
  },
  truck: {
    box: '0 80 320 430', body: { x: 126, y: 100, w: 68, h: 250 }, cab: { x: 126, y: 100, w: 68, h: 60 },
    cones: [['left', 122, 130, 100, 122, 200], ['right', 198, 130, 58, 80, 200]],
    zones: [['left', 'wedge', 120, 170, 126, 172, 170, null], ['right', 'wedge', 200, 170, 8, 54, 170, null], ['rear', 'poly', '118,352 202,352 220,486 100,486', null, null, null, 'camera']],
    things: [['car', 78, 300], ['person', 160, 430]],
    alt: 'מבט מלמעלה על משאית ארוכה: השטחים המתים בצדדים ובעיקר שטח מת גדול מאחורי הרכב, שבו יכולים להיות כלי רכב קטנים והולכי רגל.',
  },
};

function thing(kind, x, y) {
  if (kind === 'person') return s('g', { class: 'vz-thing', transform: `translate(${x} ${y})` }, s('circle', { cx: 0, cy: -9, r: 5 }), s('path', { d: 'M-7 10 v-11 q0 -4 7 -4 q7 0 7 4 v11 z' }));
  if (kind === 'bike') return s('g', { class: 'vz-thing', transform: `translate(${x} ${y}) rotate(90)` }, s('circle', { cx: -9, cy: 0, r: 5, fill: 'none', 'stroke-width': 2 }), s('circle', { cx: 9, cy: 0, r: 5, fill: 'none', 'stroke-width': 2 }), s('path', { d: 'M-9 0 L0 -6 L9 0 M0 -6 v-3', fill: 'none', 'stroke-width': 2 }));
  return s('g', { class: 'vz-thing', transform: `translate(${x} ${y})` }, s('rect', { x: -8, y: -15, width: 16, height: 30, rx: 5 }));
}

export function buildBlindSpots() {
  const st = { vehicle: 'car', mirrors: true, head: false, camera: false };
  const host = h('div', { class: 'vz-svg vz-blind-svg' });
  const status = h('p', { class: 'vz-status', role: 'status' });
  const draw = () => {
    const v = BLIND[st.vehicle], b = v.body;
    const covered = (tag) => (tag === 'head' && st.head && st.vehicle === 'car') || (tag === 'camera' && st.camera);
    const parts = [];
    if (st.mirrors) v.cones.forEach(([k, ox, oy, a0, a1, len]) => parts.push(s('polygon', { points: wedge(ox, oy, a0, a1, len), class: 'vz-cover', 'data-k': k })));
    v.zones.forEach(([k, kind, ...p]) => {
      const tag = p[p.length - 1], on = covered(tag);
      const pts = kind === 'poly' ? p[0] : wedge(p[0], p[1], p[2], p[3], p[4]);
      parts.push(s('polygon', { points: pts, class: `vz-dead ${on ? 'is-covered' : ''}`, 'data-k': k }));
    });
    const body = [s('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 14, class: 'vz-vehicle' })];
    if (v.cab) body.push(s('rect', { x: v.cab.x, y: v.cab.y, width: v.cab.w, height: v.cab.h, rx: 10, class: 'vz-cab' }));
    else body.push(s('rect', { x: b.x + 8, y: b.y + 30, width: b.w - 16, height: 26, rx: 6, class: 'vz-glass' }), s('rect', { x: b.x + 8, y: b.y + 92, width: b.w - 16, height: 22, rx: 6, class: 'vz-glass' }));
    // mirrors
    v.cones.filter(([k]) => k !== 'interior').forEach(([, ox]) => body.push(s('rect', { x: ox < 160 ? ox - 8 : ox, y: (v.cab ? 128 : 172), width: 8, height: 14, rx: 3, class: 'vz-mirror' })));
    parts.push(...body, ...v.things.map(([k, x, y]) => thing(k, x, y)));
    host.replaceChildren(s('svg', { viewBox: v.box, class: 'vz-blind-fig', role: 'img', 'aria-label': v.alt }, ...parts));
    const uncovered = v.zones.filter(([, , ...p]) => !covered(p[p.length - 1])).length;
    status.textContent = uncovered ? `נשארו ${uncovered} שטחים מתים שלא מכוסים. אפשר לראות מה קורה בהם רק אם מפעילים אמצעי נוסף או בודקים לפני שמתחילים לנסוע.` : 'כל השטחים המתים באיור מכוסים כרגע. בפועל תמיד כדאי לבדוק שוב לפני שמתחילים.';
  };
  const chips = [
    ['mirrors', 'מראות', 'המראות מכסות את הדרך שמאחור ואת הדרך שבצדי הרכב'],
    ['head', 'סיבוב הראש', 'סיבוב הראש לכיוון הנסיעה מגלה את האלכסונים בצדדים'],
    ['camera', 'מצלמה אחורית', 'המצלמה מגלה את השטח המת שמאחורי הרכב'],
  ];
  const chipEls = chips.map(([k, label, hint]) => h('button', { type: 'button', class: 'chip-btn', dataset: { k }, title: hint, onclick: () => { st[k] = !st[k]; sync(); } }, label));
  const vehSeg = segmented('סוג הרכב', 'vz-l-veh', { car: { label: 'רכב פרטי' }, truck: { label: 'משאית ארוכה' } }, () => st.vehicle, (k) => { st.vehicle = k; sync(); });
  const note = h('p', { class: 'vz-truck-note callout' }, 'ברכב גדול השטחים המתים גדולים יותר, והגדול שבהם מאחור. לכן נהג בודק לפני שמניע (ובאוטובוס: אם יש עוברי דרך בשטחים המתים). בסיבוב ראש לבדו לא מספיק לכסות אותם.');
  function sync() {
    chipEls.forEach((b, i) => {
      const k = chips[i][0], off = st.vehicle === 'truck' && k === 'head';
      b.hidden = off; b.setAttribute('aria-pressed', String(!!st[k])); b.classList.toggle('on', !!st[k]);
    });
    note.hidden = st.vehicle !== 'truck';
    draw();
  }
  const el = h('div', { class: 'vz vz-blind' },
    h('div', { class: 'card vz-controls' }, vehSeg,
      h('div', { class: 'vz-ctl' }, h('span', { class: 'vz-lab', id: 'vz-l-aids' }, 'מה מפעילים כדי לראות'), h('div', { class: 'chips', role: 'group', 'aria-labelledby': 'vz-l-aids' }, chipEls))),
    h('div', { class: 'card vz-figure' },
      host,
      h('ul', { class: 'vz-legend' },
        h('li', null, h('i', { class: 'sw sw-cover' }), 'אזור שרואים במראות'),
        h('li', null, h('i', { class: 'sw sw-dead' }), 'שטח מת: לא רואים'),
        h('li', null, h('i', { class: 'sw sw-ok' }), 'שטח מת שהאמצעי שבחרתם מגלה')),
      status, note,
      h('p', { class: 'fineprint muted' }, 'איור להמחשה, לא בקנה מידה. צורת השטחים המתים משתנה מרכב לרכב.')));
  sync();
  return el;
}

// ============================================================================================================
// 3. safety systems
// ============================================================================================================
function carSideSvg(systems, sel) {
  const dots = systems.map((y) => s('g', { class: `vz-dot ${y.id === sel ? 'on' : ''}`, transform: `translate(${y.x} ${y.y})` },
    s('circle', { r: y.id === sel ? 11 : 8.5 }), s('text', { y: 4, 'text-anchor': 'middle' }, `${y.n}`)));
  return s('svg', { viewBox: '0 0 360 170', class: 'vz-side', 'aria-hidden': 'true' },
    s('path', { class: 'vz-body', d: 'M18 122 Q18 106 34 102 L70 94 Q92 66 130 62 L228 62 Q262 64 284 90 L322 98 Q342 102 342 118 L342 132 L18 132 Z' }),
    s('path', { class: 'vz-glass', d: 'M96 94 Q108 72 134 70 L168 70 L168 94 Z M178 70 L226 70 Q246 74 262 94 L178 94 Z' }),
    s('circle', { class: 'vz-wheel', cx: 92, cy: 134, r: 22 }), s('circle', { class: 'vz-hub', cx: 92, cy: 134, r: 9 }),
    s('circle', { class: 'vz-wheel', cx: 268, cy: 134, r: 22 }), s('circle', { class: 'vz-hub', cx: 268, cy: 134, r: 9 }),
    // the driver
    s('rect', { class: 'vz-seat', x: 208, y: 72, width: 12, height: 36, rx: 5 }),
    s('circle', { class: 'vz-person', cx: 196, cy: 78, r: 9 }), s('path', { class: 'vz-person-b', d: 'M196 88 L200 108' }),
    s('line', { class: 'vz-belt', x1: 206, y1: 76, x2: 192, y2: 108 }),
    s('path', { class: 'vz-bag', d: 'M170 84 a13 13 0 1 0 0.1 0' }), s('line', { class: 'vz-wheelbar', x1: 176, y1: 84, x2: 182, y2: 100 }),
    dots);
}

export function buildSafetySystems() {
  const v = visualByKey('safety-systems');
  let sel = 'belts';
  const host = h('div', { class: 'vz-svg' });
  const detail = h('div', { class: 'card vz-detail', role: 'region', 'aria-live': 'polite', 'aria-label': 'פרטי המערכת שנבחרה' });
  const list = h('div', { class: 'vz-sys-groups' });
  const groupBtns = new Map();
  Object.entries(v.groups).forEach(([g, gname]) => {
    const btns = v.systems.filter((y) => y.group === g).map((y) => {
      const b = h('button', { type: 'button', class: 'vz-sys', dataset: { id: y.id }, onclick: () => { sel = y.id; paint(); } }, h('span', { class: 'vz-sys-n', 'aria-hidden': 'true' }, y.n), h('span', null, y.name));
      groupBtns.set(y.id, b); return b;
    });
    list.append(h('div', { class: 'vz-sys-group' }, h('h2', { class: 'vz-gh' }, gname), h('div', { class: 'vz-sys-row' }, btns)));
  });
  function paint() {
    const y = v.systems.find((z) => z.id === sel);
    host.replaceChildren(carSideSvg(v.systems, sel));
    groupBtns.forEach((b, id) => { b.classList.toggle('on', id === sel); b.setAttribute('aria-pressed', String(id === sel)); });
    detail.replaceChildren(
      h('div', { class: 'vz-detail-head' }, h('span', { class: 'vz-sys-n big', 'aria-hidden': 'true' }, y.n), h('div', null, h('h3', null, y.name), h('small', { class: 'muted' }, v.groups[y.group]))),
      h('p', { class: 'vz-does' }, y.does),
      h('p', { class: 'callout' }, h('b', null, 'חשוב לזכור: '), y.remember));
  }
  paint();
  return h('div', { class: 'vz vz-systems' }, h('div', { class: 'card vz-figure' }, host, h('p', { class: 'fineprint muted' }, 'איור להמחשה. מיקום המערכות משוער.')), list, detail);
}

export const BUILDERS = { stopping: buildStopping, 'blind-spots': buildBlindSpots, 'safety-systems': buildSafetySystems };
