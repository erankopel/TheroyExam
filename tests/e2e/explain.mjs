// Explanation UI checks. Run against the local server (http://localhost:8123):
//   NODE_PATH=$(npm root -g) node tests/e2e/explain.mjs [shots-dir] [path/to/axe.min.js]
import { createRequire } from 'node:module';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const SHOTS = process.argv[2] || null, AXE = process.argv[3] && existsSync(process.argv[3]) ? readFileSync(process.argv[3], 'utf8') : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let failed = 0;
const check = (name, ok, extra = '') => { console.log(ok ? '✓' : '✗', name, ok ? '' : extra); if (!ok) failed++; };
const ex = JSON.parse(readFileSync(new URL('../../data/explanations.json', import.meta.url), 'utf8'));
const qs = JSON.parse(readFileSync(new URL('../../data/questions.json', import.meta.url), 'utf8'));
const withEx = qs.filter((q) => ex[q.id]).map((q) => q.id).sort((a, b) => a - b);
if (!withEx.length) { console.log('no explanations in data/explanations.json'); process.exit(1); }
// One question is served WITHOUT an explanation (the file is complete, so the browser gets a copy with the last id removed).
const without = qs.reduce((m, q) => (q.id > m.id ? q : m), qs[0]); // practice runs in ascending id order, so it comes last
const exMinus = { ...ex }; delete exMinus[without.id];

async function open(theme = 'light', width = 390) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, locale: 'he-IL', timezoneId: 'Asia/Jerusalem', colorScheme: theme, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { if (!localStorage.getItem('road26.v1')) localStorage.setItem('road26.v1', JSON.stringify({ v: 1, profile: { onboarded: true, lic: 'B', shuffle: true } })); });
  await ctx.route('**/data/explanations.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(exMinus) }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { console.log('pageerror', e.message); failed++; });
  await p.goto('http://localhost:8123/index.html'); await p.waitForSelector('#view .page');
  return { ctx, p };
}
const practice = (p, ids) => p.evaluate(async (ids) => { const m = await import('./js/session.js'); m.startPractice({ title: 't', ids, mode: 'seq', back: '/learn', kind: 'practice' }); }, ids);
const answerBtn = async (p, right) => {
  const id = +(await p.getAttribute('.qcard', 'data-id')); const q = qs.find((x) => x.id === id);
  for (const b of await p.$$('.answer')) if (((+(await b.getAttribute('data-i'))) === q.c) === right) { await b.click(); return id; }
};

for (const theme of ['light', 'dark']) {
  const { ctx, p } = await open(theme);
  const id = withEx[0], id2 = withEx[1];
  await practice(p, [id, id2, without.id]);
  await p.waitForSelector('.qcard');
  check(`${theme}: no explanation before answering`, (await p.$$('.expl')).length === 0);
  await answerBtn(p, false); await p.waitForSelector('.expl');
  check(`${theme}: explanation is open after a mistake`, await p.$eval('.expl', (d) => d.open));
  check(`${theme}: explanation text matches the data`, (await p.textContent('.expl .expl-text')).trim() === ex[id].e);
  check(`${theme}: unofficial note is shown`, /לא רשמי/.test(await p.textContent('.expl')));
  await p.waitForTimeout(700); // smooth scroll
  check(`${theme}: explanation is scrolled above the feedback bar`, await p.evaluate(() => document.querySelector('.expl').getBoundingClientRect().bottom <= document.querySelector('.session-foot').getBoundingClientRect().top + 1));
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/${theme}-wrong.png` });
  if (AXE) { await p.evaluate(AXE); const r = await p.evaluate(() => axe.run(document, { resultTypes: ['violations'] })); check(`${theme}: axe clean with explanation open`, r.violations.length === 0, JSON.stringify(r.violations.map((v) => [v.id, v.nodes.map((n) => n.target)]))); }
  await p.click('.fb-next'); await p.waitForSelector('.qcard');
  check(`${theme}: explanation of the previous question is gone`, (await p.$$('.expl')).length === 0);
  await answerBtn(p, true); await p.waitForSelector('.expl');
  check(`${theme}: explanation is collapsed after a correct answer`, !(await p.$eval('.expl', (d) => d.open)));
  await p.click('.expl summary'); check(`${theme}: it can be opened`, await p.$eval('.expl', (d) => d.open));
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/${theme}-right.png` });
  await p.click('.fb-next'); await p.waitForSelector('.qcard');
  await answerBtn(p, false); await p.waitForTimeout(200);
  check(`${theme}: question without an explanation shows none`, (await p.$$('.expl')).length === 0);
  // mistakes are queued again at the end of the round: answer those correctly to reach the summary
  for (let i = 0; i < 6 && !(await p.$('.summary')); i++) { await p.click('.fb-next'); if (await p.$('.summary')) break; await p.waitForSelector('.qcard'); if (!(await p.$('.answer[disabled]'))) await answerBtn(p, true); }
  await p.waitForSelector('.summary');
  check(`${theme}: summary lists the mistake with its explanation`, (await p.$$('.wrong-item')).length >= 1);
  await p.click('.wrong-item >> nth=0 >> summary');
  check(`${theme}: summary row shows the explanation`, (await p.$$('.wrong-item .expl-plain')).length >= 1);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/${theme}-summary.png`, fullPage: true });
  // read-only question viewer
  await p.evaluate(async (id) => { const m = await import('./js/views/browse.js'); m.openQuestion(id); }, id);
  await p.waitForSelector('.sheet .expl');
  check(`${theme}: question viewer shows the explanation open`, await p.$eval('.sheet .expl', (d) => d.open));
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/${theme}-viewer.png` });
  await ctx.close();
}
// desktop layout
{
  const { ctx, p } = await open('light', 1280);
  await practice(p, [withEx[0]]); await p.waitForSelector('.qcard'); await answerBtn(p, false); await p.waitForSelector('.expl');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/desktop-wrong.png` });
  await ctx.close();
}
// offline-before-cache: a failed fetch must not break answering
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'he-IL', serviceWorkers: 'block' });
  await ctx.addInitScript(() => localStorage.setItem('road26.v1', JSON.stringify({ v: 1, profile: { onboarded: true, lic: 'B' } })));
  await ctx.route('**/data/explanations.json', (r) => r.abort());
  const p = await ctx.newPage(); p.on('pageerror', (e) => { console.log('pageerror', e.message); failed++; });
  await p.goto('http://localhost:8123/index.html'); await p.waitForSelector('#view .page');
  await practice(p, [withEx[0]]); await p.waitForSelector('.qcard'); await answerBtn(p, false); await p.waitForSelector('.fb-next');
  check('answering works when the explanations file is unavailable', (await p.$$('.expl')).length === 0);
  await ctx.close();
}
await browser.close();
console.log(failed ? `${failed} FAILED` : 'all explanation checks passed');
process.exit(failed ? 1 : 0);
