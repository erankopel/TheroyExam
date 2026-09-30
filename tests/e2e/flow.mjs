// End-to-end smoke flow: learn -> practice (right + wrong) -> exam -> result -> other screens. Fails on any console/page error.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = process.argv[2] || '/tmp';
const W = +(process.env.W || 390), H = +(process.env.H || 800);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, colorScheme: process.env.DARK ? 'dark' : 'light', locale: 'he-IL' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const shot = (n) => page.screenshot({ path: `${OUT}/${n}_${W}${process.env.DARK ? '_dark' : ''}.png` });
const step = (s) => console.log('•', s);
const q = (id) => page.evaluate(async (id) => (await (await fetch('data/questions.json')).json()).find((x) => x.id === id), id);

await page.goto('http://localhost:8123/index.html');
await page.waitForSelector('#view .page');
step('home'); await shot('01_home');

// --- learn + unit
await page.click('a.tab.nav-learn, .rail-link.nav-learn >> visible=true');
await page.waitForSelector('.unit-card'); step('learn'); await shot('02_learn');
await page.click('.unit-card >> nth=0');
await page.waitForSelector('.unit-hero'); step('unit'); await shot('03_unit');

// --- practice: answer 1st correctly, 2nd wrongly (using data to know the right answer)
await page.click('text=התחלת תרגול');
await page.waitForSelector('.qcard');
async function answer(right) {
  const id = +(await page.getAttribute('.qcard', 'data-id'));
  const qq = await q(id);
  const btns = await page.$$('.answer');
  let target = null;
  for (const b of btns) { const oi = +(await b.getAttribute('data-i')); if ((oi === qq.c) === right) { target = b; break; } }
  await target.click();
  return id;
}
await answer(true); await page.waitForSelector('.fb-good'); step('practice right'); await shot('04_practice_right');
await page.click('.fb-next'); await page.waitForTimeout(250);
await answer(false); await page.waitForSelector('.fb-bad'); step('practice wrong'); await shot('05_practice_wrong');
await page.click('.fb-next');
for (let i = 0; i < 40; i++) {
  if (await page.$('.summary')) break;
  await page.waitForSelector('.qcard');
  await answer(true); await page.click('.fb-next'); await page.waitForTimeout(80);
}
await page.waitForSelector('.summary'); step('summary'); await shot('06_summary');
await page.click('.summary-actions .btn:last-child');

// --- exam
await page.evaluate(() => { location.hash = '#/exam'; });
await page.waitForSelector('.exam-rules'); step('exam intro'); await shot('07_exam_intro');
await page.click('text=מבחן מלא');
await page.waitForSelector('.exam .qcard'); step('exam run'); await shot('08_exam_q');
for (let i = 0; i < 30; i++) {
  await page.waitForSelector('.exam .qcard');
  const id = +(await page.getAttribute('.qcard', 'data-id')); const qq = await q(id);
  const wrong = i % 10 === 3; // 3 mistakes -> 27/30 -> pass
  const btns = await page.$$('.answer');
  for (const b of btns) { const oi = +(await b.getAttribute('data-i')); if ((oi === qq.c) === !wrong) { await b.click(); break; } }
  if (i === 5) { await page.click('.mark-btn'); }
  if (i === 6) { await page.click('.nav-btn'); await page.waitForSelector('.nav-grid'); await shot('09_exam_nav'); await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  if (i < 29) await page.click('.exam-foot .btn:last-child'); await page.waitForTimeout(40);
}
await page.click('.exam-foot .btn-primary:has-text("סיום מבחן")');
await page.waitForSelector('.sheet');
await page.click('.sheet .btn-primary');
await page.waitForSelector('.result-hero'); step('result'); await page.waitForTimeout(1800); await shot('10_result');

for (const [r, n] of [['#/', '11_home_after'], ['#/stats', '12_stats'], ['#/review', '13_review'], ['#/signs', '14_signs'], ['#/search', '15_search'], ['#/settings', '16_settings']]) {
  await page.evaluate((r) => { location.hash = r; }, r); await page.waitForTimeout(800); await shot(n); step(r);
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);
