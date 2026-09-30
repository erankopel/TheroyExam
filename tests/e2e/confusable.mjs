// Confusable-signs practice: index, compare page, "which one?" game, smart drill, links. Run against http://localhost:8123:
//   NODE_PATH=$(npm root -g) node tests/e2e/confusable.mjs [shots-dir] [path/to/axe.min.js]
import { createRequire } from 'node:module';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const SHOTS = process.argv[2] || null, AXE = process.argv[3] && existsSync(process.argv[3]) ? readFileSync(process.argv[3], 'utf8') : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let failed = 0;
const check = (name, ok, extra = '') => { console.log(ok ? '✓' : '✗', name, ok ? '' : extra); if (!ok) failed++; };
const QS = JSON.parse(readFileSync(new URL('../../data/questions.json', import.meta.url), 'utf8'));
const CF = JSON.parse(readFileSync(new URL('../../data/confusable.json', import.meta.url), 'utf8')).groups;
const qById = new Map(QS.map((q) => [q.id, q]));
const groupPool = (g) => { const imgs = new Set(g.signs.map((s) => qById.get(s.q).img)); return QS.filter((q) => q.cat === 'signs' && imgs.has(q.img) && q.lic.includes('B')).map((q) => q.id); };
const overtaking = CF.find((g) => g.id === 'overtaking'), otPool = groupPool(overtaking);

async function open(theme = 'light', width = 390, state = { v: 1, profile: { onboarded: true, lic: 'B', shuffle: true } }) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, locale: 'he-IL', colorScheme: theme, serviceWorkers: 'block' });
  await ctx.addInitScript((s) => { if (!localStorage.getItem('road26.v1')) localStorage.setItem('road26.v1', JSON.stringify(s)); }, state);
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/index.html'); await p.waitForSelector('#view .page');
  return { ctx, p, errs };
}
const go = async (p, hash) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(250); };
const axe = async (p, name) => { if (!AXE) return; await p.evaluate(AXE); const r = await p.evaluate(() => axe.run(document, { resultTypes: ['violations'] })); check(`${name}: axe clean`, r.violations.length === 0, JSON.stringify(r.violations.map((v) => [v.id, v.nodes.slice(0, 2).map((n) => n.target)]))); };
const noOverflow = (p) => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const now = Date.now();
const withMistakes = { v: 1, profile: { onboarded: true, lic: 'B', shuffle: true }, q: Object.fromEntries(otPool.slice(0, 2).map((id) => [id, { b: 0, d: 0, r: 0, w: 1, l: 0, t: now }])), xp: 0, exams: [], flags: [], log: {}, badges: {}, activeExam: null };

for (const theme of ['light', 'dark']) {
  // ---------- a fresh learner
  {
    const { ctx, p, errs } = await open(theme);
    await go(p, '#/signs');
    check(`${theme}: the sign dictionary links to the practice`, (await p.$('a.visual-strip[href="#/confusable"]')) !== null);
    await go(p, '#/unit/signs-priority');
    check(`${theme}: sign units link to the practice`, (await p.$('a[href="#/confusable"]')) !== null);
    await go(p, '#/confusable'); await p.waitForSelector('.conf-card');
    check(`${theme}: index lists every group`, (await p.$$('.conf-card')).length === CF.length, String((await p.$$('.conf-card')).length));
    check(`${theme}: the "signs" tab stays highlighted`, await p.$eval('.tabbar [data-tab=signs]', (a) => a.classList.contains('active')));
    check(`${theme}: group cards are laid out as rows (flex)`, await p.$eval('.conf-card', (e) => getComputedStyle(e).display === 'flex'));
    check(`${theme}: a fresh learner has no "worth another look" list`, (await p.$$('.has-weak')).length === 0);
    check(`${theme}: the drill card shows the number of questions`, /התחלה \(\d+ שאלות\)/.test(await p.textContent('.conf-drill .btn-primary')));
    await axe(p, `${theme}: index`);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/${theme}-index.png` });

    // compare page
    const g = CF.find((x) => x.id === 'stop-yield');
    await p.click(`a.conf-card[href="#/confusable/${g.id}"]`); await p.waitForSelector('.conf-sign');
    check(`${theme}: group page shows every sign and the tip`, (await p.$$('.conf-sign')).length === g.signs.length && (await p.textContent('.conf-tip')).includes('איך מבדילים'));
    check(`${theme}: each picture has a text alternative from its cue`, await p.$$eval('.conf-sign img', (imgs) => imgs.every((i) => i.alt.length > 3)));
    check(`${theme}: page title is the group title`, (await p.title()).startsWith(g.title));
    await p.click('.conf-sign >> nth=0'); await p.waitForSelector('.sheet');
    check(`${theme}: a sign opens its question`, /תמרור|מה מורה|משמעות/.test(await p.textContent('.sheet .qtext, .sheet')));
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    await axe(p, `${theme}: group`);

    // the game: answer the first round wrong on purpose, the rest right; the score is shown at the end
    await p.click('.conf-game .btn-primary'); await p.waitForSelector('.conf-opt');
    const total = g.signs.length;
    check(`${theme}: game shows one round per sign`, /1 מתוך /.test(await p.textContent('.conf-game .section-head')) && (await p.textContent('.conf-game .section-head')).includes(`מתוך ${total}`));
    let right = 0;
    for (let r = 0; r < total; r++) {
      await p.waitForSelector('.conf-opt:not([disabled])');
      const meaning = (await p.textContent('.conf-prompt')).trim();
      const sign = g.signs.map((s) => ({ s, q: qById.get(s.q) })).find((x) => x.q.a[x.q.c] === meaning);
      const opts = await p.$$('.conf-opt');
      const target = [];
      for (const o of opts) if ((await o.$eval('img', (i) => i.getAttribute('src'))).endsWith(sign.q.img)) target.push(o);
      check(`${theme}: round ${r + 1} shows the right sign among the options`, target.length === 1);
      let pick = target[0];
      if (r === 0) pick = opts.find((o) => o !== target[0]) || pick; // one deliberate mistake
      else right++;
      await pick.click();
      await p.waitForSelector('.conf-next button');
      if (r === 0) {
        check(`${theme}: a wrong pick marks both the pick and the right sign`, (await p.$$('.conf-opt.wrong')).length === 1 && (await p.$$('.conf-opt.right')).length === 1);
        check(`${theme}: the feedback names the right sign`, /התמרור הנכון/.test(await p.textContent('.conf-fb')));
        await axe(p, `${theme}: game feedback`);
        if (SHOTS) await p.screenshot({ path: `${SHOTS}/${theme}-game.png` });
      } else check(`${theme}: a right pick is confirmed`, (await p.$$('.conf-opt.right')).length === 1 && (await p.$$('.conf-opt.wrong')).length === 0 && /נכון/.test(await p.textContent('.conf-fb')));
      check(`${theme}: options are locked after the pick`, await p.$$eval('.conf-opt', (bs) => bs.every((b) => b.disabled)));
      await p.click('.conf-next button');
    }
    await p.waitForSelector('.conf-result');
    check(`${theme}: the score is reported`, (await p.textContent('.conf-result')).includes(`${right} מתוך ${total}`));
    await p.click('.conf-game .btn-primary'); await p.waitForSelector('.conf-opt');
    check(`${theme}: "another round" starts again`, /1 מתוך /.test(await p.textContent('.conf-game .section-head')));

    // practice from the group
    await p.click('.conf-practice .btn-primary'); await p.waitForSelector('.qcard');
    check(`${theme}: group practice shows a question of the group`, groupPool(g).includes(+(await p.getAttribute('.qcard', 'data-id'))));
    // a wrong answer on a sign question links back to the group
    const id = +(await p.getAttribute('.qcard', 'data-id')), q = qById.get(id);
    for (const b of await p.$$('.answer')) if ((+(await b.getAttribute('data-i'))) !== q.c) { await b.click(); break; }
    await p.waitForSelector('.expl');
    const link = await p.$('.expl a.expl-vis[href^="#/confusable/"]');
    check(`${theme}: the explanation links to the group of similar signs`, link !== null && (await link.getAttribute('href')) === `#/confusable/${g.id}`);
    check(`${theme}: no page errors (fresh learner)`, errs.length === 0, JSON.stringify(errs.slice(0, 3)));
    await ctx.close();
  }
  // ---------- a learner who made mistakes on look-alike signs
  {
    const { ctx, p, errs } = await open(theme, 390, withMistakes);
    await go(p, '#/confusable'); await p.waitForSelector('.conf-card');
    check(`${theme}: the group with mistakes is listed first under "worth another look"`, (await p.$$('.has-weak')).length >= 1 && /כדאי לחזור/.test(await p.textContent('.conf-section h2')));
    check(`${theme}: the drill explains that it follows the mistakes`, /הטעויות שלכם/.test(await p.textContent('.conf-drill small')));
    await p.click('.conf-drill .btn-primary'); await p.waitForSelector('.qcard');
    const first = +(await p.getAttribute('.qcard', 'data-id'));
    check(`${theme}: the drill starts with the group of the mistakes`, otPool.includes(first), String(first));
    check(`${theme}: the drill is a short set of sign questions from the groups, without repeats`, await p.evaluate(async () => {
      const { session } = await import('./js/session.js'); const { resolveGroups, questionIds } = await import('./js/confusable.js');
      const q = session.current.queue, groups = resolveGroups('B');
      return q.length >= 8 && q.length <= 15 && new Set(q).size === q.length && q.every((id) => groups.some((g) => questionIds(g, 'B').includes(id)));
    }));
    check(`${theme}: no page errors (learner with mistakes)`, errs.length === 0, JSON.stringify(errs.slice(0, 3)));
    await ctx.close();
  }
}
// ---------- narrow screen
{
  const { ctx, p } = await open('light', 320);
  for (const h of ['#/confusable', '#/confusable/speed', '#/confusable/start-end']) { await go(p, h); await p.waitForSelector('.conf-card, .conf-sign'); check(`320px: ${h} has no horizontal scroll`, await noOverflow(p)); }
  await p.click('.conf-game .btn-primary'); await p.waitForSelector('.conf-opt');
  check('320px: the game has no horizontal scroll', await noOverflow(p));
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/narrow-game.png`, fullPage: true });
  await ctx.close();
}
// ---------- desktop
{
  const { ctx, p } = await open('light', 1280);
  await go(p, '#/confusable/no-entry-type'); await p.waitForSelector('.conf-sign');
  check('desktop: no horizontal scroll', await noOverflow(p));
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/desktop-group.png`, fullPage: true });
  await ctx.close();
}
// ---------- unknown group id goes back to the index
{
  const { ctx, p } = await open('light');
  await go(p, '#/confusable/no-such-group'); await p.waitForSelector('.conf-card');
  check('unknown group: back on the index', (await p.evaluate(() => location.hash)) === '#/confusable');
  await ctx.close();
}
await browser.close();
console.log(failed ? `${failed} FAILED` : 'all confusable-signs checks passed');
process.exit(failed ? 1 : 0);
