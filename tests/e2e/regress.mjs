// Targeted regression checks for issues found in review. Run against the local server (http://localhost:8123).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const SEED = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : null;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let failed = 0;
const check = (name, ok, extra = '') => { console.log(ok ? '✓' : '✗', name, ok ? '' : extra); if (!ok) failed++; };
const newCtx = async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
  await ctx.addInitScript((seed) => { if (!localStorage.getItem('road26.v1')) localStorage.setItem('road26.v1', seed || JSON.stringify({ v: 1, profile: { onboarded: true, lic: 'B' } })); }, SEED);
  return ctx;
};
const load = async (ctx) => { const p = await ctx.newPage(); p.on('pageerror', (e) => { if (/Access is denied/.test(e.message)) return; console.log('pageerror', e.message); failed++; }); await p.goto('http://localhost:8123/index.html'); await p.waitForSelector('#view .page'); return p; };
const state = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('road26.v1') || '{}'));
const q = (p, id) => p.evaluate(async (id) => (await (await fetch('data/questions.json')).json()).find((x) => x.id === id), id);
async function answer(p, right = true) {
  const id = +(await p.getAttribute('.qcard', 'data-id')); const qq = await q(p, id);
  for (const b of await p.$$('.answer')) { if (((+(await b.getAttribute('data-i'))) === qq.c) === right) { await b.click(); return id; } }
}

// 1. no literal "null" in the review screens and question sheet
{
  const ctx = await newCtx(); const p = await load(ctx);
  await p.evaluate(() => { location.hash = '#/learn/vehicle'; }); await p.waitForSelector('.unit-card'); await p.click('.unit-card >> nth=0'); await p.click('text=/התחלת תרגול|המשך תרגול/');
  await p.waitForSelector('.qcard'); await answer(p, false); await p.click('.fb-next');
  await p.evaluate(() => { location.hash = '#/review/weak'; }); await p.waitForSelector('.qlist');
  check('review page shows no literal "null"', !(await p.textContent('main')).includes('null'));
  await p.click('.qrow >> nth=0'); await p.waitForSelector('.sheet');
  check('question sheet shows no literal "null"', !(await p.textContent('.sheet')).includes('null'));
  await ctx.close();
}
// 2. Back is not trapped after finishing an exam; sheets close on navigation; practice re-entry does not double count
{
  const ctx = await newCtx(); const p = await load(ctx);
  await p.evaluate(() => { location.hash = '#/exam'; }); await p.click('text=מבחן מלא'); await p.waitForSelector('.exam .qcard');
  for (let i = 0; i < 30; i++) { await answer(p, true); if (i < 29) await p.click('.exam-foot .btn:last-child'); }
  await p.click('.exam-foot .btn-primary:has-text("סיום מבחן")'); await p.click('.sheet .btn-primary'); await p.waitForSelector('.result-hero');
  const seen = [];
  for (let i = 0; i < 3; i++) { await p.goBack(); await p.waitForTimeout(250); seen.push(await p.evaluate(() => location.hash)); }
  check('Back after an exam is not trapped on the exam screens', new Set(seen).size > 1, JSON.stringify(seen));
  await p.goto('http://localhost:8123/index.html'); await p.waitForSelector('#view .page');
  await p.evaluate(() => { location.hash = '#/learn/law'; }); await p.waitForSelector('.unit-card'); await p.click('.unit-card >> nth=0'); await p.waitForSelector('.qrow'); await p.click('.qrow >> nth=0'); await p.waitForSelector('.sheet-back');
  await p.goBack(); await p.waitForTimeout(400);
  check('an open question sheet is closed when navigating', (await p.$$('.sheet-back')).length === 0);
  await p.evaluate(() => { location.hash = '#/learn/law'; }); await p.click('.unit-card >> nth=0'); await p.click('text=/התחלת תרגול|המשך תרגול/'); await p.waitForSelector('.qcard');
  const before = (await state(p)).log; const n0 = Object.values(before).reduce((s, d) => s + d.n, 0);
  await answer(p); await p.waitForSelector('.fb-next'); await p.goBack(); await p.waitForTimeout(300); await p.goForward(); await p.waitForTimeout(500);
  const shown = await p.$('.qcard .answer:not([disabled])');
  await p.waitForTimeout(400);
  const n1 = Object.values((await state(p)).log).reduce((s, d) => s + d.n, 0);
  check('practice resumes after the answered question (no re-answer, no double count)', n1 === n0 + 1 && (await p.$('.summary')) === null && shown !== null && (await p.textContent('.session-count')).startsWith('2/'), `n0=${n0} n1=${n1} count=${await p.textContent('.session-count')}`);
  await ctx.close();
}
// 3. two tabs never lose progress
{
  const ctx = await newCtx(); const a = await load(ctx); const b = await load(ctx);
  await b.evaluate(() => { location.hash = '#/learn/law'; }); await b.click('.unit-card >> nth=0'); await b.click('text=/התחלת תרגול|המשך תרגול/'); await b.waitForSelector('.qcard');
  for (let i = 0; i < 3; i++) { await answer(b); await b.click('.fb-next'); }
  await b.waitForTimeout(400);
  const saved = Object.keys((await state(b)).q).length;
  await a.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await a.waitForTimeout(300);
  check('an idle second tab does not overwrite progress', Object.keys((await state(b)).q).length === saved && saved >= 3);
  await ctx.close();
}
// 4. restore-from-backup asks for confirmation and rejects invalid files
{
  const ctx = await newCtx(); const p = await load(ctx);
  await p.evaluate(() => { location.hash = '#/settings'; }); await p.waitForSelector('input[type=file]', { state: 'attached' });
  await p.setInputFiles('input[type=file]', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ profile: { lic: 'B' }, q: {}, xp: 5 })) });
  await p.waitForSelector('.sheet'); check('restore shows a confirmation dialog', (await p.textContent('.sheet')).includes('לשחזר'));
  await p.click('.sheet .btn-ghost'); await p.waitForTimeout(400);
  await p.setInputFiles('input[type=file]', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":1}') });
  await p.waitForSelector('.toast'); check('invalid backup is rejected with a message', (await p.textContent('#toasts')).includes('אינו גיבוי תקין'));
  await ctx.close();
}
// 5. offline + missing picture -> explanatory note instead of a broken image
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'he-IL', serviceWorkers: 'block' });
  await ctx.addInitScript(() => localStorage.setItem('road26.v1', JSON.stringify({ v: 1, profile: { onboarded: true, lic: 'B' } })));
  const p = await ctx.newPage();
  await p.route('**/img/q/**', (r) => r.abort());
  await p.goto('http://localhost:8123/index.html'); await p.waitForSelector('#view .page');
  await p.evaluate(() => { location.hash = '#/unit/signs-markings'; }); await p.waitForSelector('.unit-hero'); await p.click('text=/התחלת תרגול|המשך תרגול/'); await p.waitForSelector('.qcard');
  await p.waitForSelector('.qimg-missing', { timeout: 5000 }).catch(() => null); // the note appears once the picture request has failed
  check('missing picture shows a note instead of a broken image', (await p.$('.qimg-missing')) !== null, await p.evaluate(() => document.querySelector('.qimg')?.innerHTML.slice(0, 200)));
  await ctx.close();
}
// 6. exam countdown is calendar-day exact across the DST change
{
  const ctx = await newCtx();
  const seed = JSON.stringify({ v: 1, profile: { onboarded: true, lic: 'B', examDate: '2026-10-30' } });
  await ctx.addInitScript((s) => { localStorage.setItem('road26.v1', s); }, seed);
  const p = await ctx.newPage(); await p.clock.install({ time: new Date('2026-09-30T10:00:00+03:00') });
  await p.goto('http://localhost:8123/index.html'); await p.waitForSelector('.exam-date');
  check('countdown to 30 Oct from 30 Sep is 30 days', (await p.textContent('.exam-date')).includes('30 ימים'), await p.textContent('.exam-date'));
  await ctx.close();
}
await browser.close();
console.log(failed ? `${failed} FAILED` : 'all regression checks passed');
process.exit(failed ? 1 : 0);
