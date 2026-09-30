// Infographics: routes, interaction, entry points, accessibility. Run against http://localhost:8123:
//   NODE_PATH=$(npm root -g) node tests/e2e/visual.mjs [shots-dir] [path/to/axe.min.js]
import { createRequire } from 'node:module';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const SHOTS = process.argv[2] || null, AXE = process.argv[3] && existsSync(process.argv[3]) ? readFileSync(process.argv[3], 'utf8') : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let failed = 0;
const QS = JSON.parse(readFileSync(new URL('../../data/questions.json', import.meta.url), 'utf8'));
const check = (name, ok, extra = '') => { console.log(ok ? '✓' : '✗', name, ok ? '' : extra); if (!ok) failed++; };

async function open(theme = 'light', width = 390) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, locale: 'he-IL', colorScheme: theme, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { if (!localStorage.getItem('road26.v1')) localStorage.setItem('road26.v1', JSON.stringify({ v: 1, profile: { onboarded: true, lic: 'B' } })); });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/index.html'); await p.waitForSelector('#view .page');
  return { ctx, p, errs };
}
const go = async (p, hash) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(250); };
const axe = async (p, name) => { if (!AXE) return; await p.evaluate(AXE); const r = await p.evaluate(() => axe.run(document, { resultTypes: ['violations'] })); check(`${name}: axe clean`, r.violations.length === 0, JSON.stringify(r.violations.map((v) => [v.id, v.nodes.slice(0, 2).map((n) => n.target)]))); };

for (const theme of ['light', 'dark']) {
  const { ctx, p, errs } = await open(theme);
  // entry points
  await go(p, '#/learn');
  check(`${theme}: Learn page links to the infographics`, (await p.$('a.visual-strip[href="#/visual"]')) !== null);
  await go(p, '#/unit/safety-speed-gap');
  check(`${theme}: the speed unit links to the stopping-distance infographic`, (await p.$('a[href="#/visual/stopping"]')) !== null);
  await go(p, '#/unit/safety-park-reverse');
  check(`${theme}: the reversing unit links to the blind-spots infographic`, (await p.$('a[href="#/visual/blind-spots"]')) !== null);
  await go(p, '#/unit/vehicle-safety-systems');
  check(`${theme}: the safety-systems unit links to its infographic`, (await p.$('a[href="#/visual/safety-systems"]')) !== null);
  await go(p, '#/visual'); await p.waitForSelector('.visual-card');
  check(`${theme}: index lists three infographics`, (await p.$$('.visual-card')).length === 3);
  check(`${theme}: index cards are laid out as rows (flex)`, await p.$eval('.visual-card', (e) => getComputedStyle(e).display === 'flex'));
  await axe(p, `${theme}: index`);

  // --- stopping distance
  await go(p, '#/visual/stopping'); await p.waitForSelector('.vz-stop-svg');
  const tile = async (k) => (await p.textContent(`.vz-tile-${k} .vz-tile-v`)).replace(/[^\d]/g, '');
  const r60 = +(await tile('r')), b60 = +(await tile('b')), t60 = +(await tile('t'));
  check(`${theme}: stopping: total = reaction + braking (within rounding)`, Math.abs(t60 - (r60 + b60)) <= 1, `${r60}+${b60}=${t60}`);
  await p.fill('#vz-speed', '110'); await p.dispatchEvent('#vz-speed', 'input');
  const r110 = +(await tile('r')), b110 = +(await tile('b')), t110 = +(await tile('t'));
  check(`${theme}: stopping: faster means longer reaction, braking and stopping distance`, r110 > r60 && b110 > b60 && t110 > t60, `${r60}/${b60}/${t60} -> ${r110}/${b110}/${t110}`);
  check(`${theme}: stopping: speed label and aria-valuetext follow the slider`, /110/.test(await p.textContent('#vz-speed-val')) && /110/.test(await p.getAttribute('#vz-speed', 'aria-valuetext')));
  await p.click('.vz-controls .seg-ctl >> nth=0 >> button:has-text("כביש רטוב")');
  const bWet = +(await tile('b')); check(`${theme}: stopping: a wet road lengthens braking only`, bWet > b110 && +(await tile('r')) === r110, `${b110} -> ${bWet}`);
  await p.click('.vz-controls .seg-ctl >> nth=1 >> button:has-text("עייף")');
  check(`${theme}: stopping: a tired driver lengthens the reaction distance`, +(await tile('r')) > r110);
  check(`${theme}: stopping: the pressed state is exposed to assistive tech`, (await p.getAttribute('.vz-controls .seg-ctl >> nth=0 >> button:has-text("כביש רטוב")', 'aria-pressed')) === 'true');
  const label = await p.getAttribute('.vz-stop-svg', 'aria-label');
  check(`${theme}: stopping: the figure has a text alternative with the numbers`, /מרחק תגובה/.test(label) && /\d/.test(label));
  await p.click('.vz-presets .chip-btn >> nth=0');
  check(`${theme}: stopping: presets set the speed`, (await p.inputValue('#vz-speed')) === '50');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/${theme}-stopping.png`, fullPage: true });
  await axe(p, `${theme}: stopping`);
  // the fact source opens the question
  await p.click('.fact-src >> nth=0'); await p.waitForSelector('.sheet .qcard');
  check(`${theme}: stopping: "source" opens the question viewer`, true);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);

  // --- blind spots
  await go(p, '#/visual/blind-spots'); await p.waitForSelector('.vz-blind-fig');
  const dead = () => p.$$eval('.vz-dead', (n) => n.filter((x) => x.classList.contains('is-covered')).length);
  check(`${theme}: blind spots: the car starts with 3 uncovered dead zones`, (await p.$$('.vz-dead')).length === 3 && (await dead()) === 0);
  await p.click('.vz-controls .chip-btn[data-k=head]'); check(`${theme}: blind spots: head turn covers the two side zones`, (await dead()) === 2);
  await p.click('.vz-controls .chip-btn[data-k=camera]'); check(`${theme}: blind spots: rear camera covers the rear zone`, (await dead()) === 3);
  check(`${theme}: blind spots: status text says all covered`, /מכוסים/.test(await p.textContent('.vz-status')));
  await p.click('.vz-controls .chip-btn[data-k=mirrors]'); check(`${theme}: blind spots: mirrors toggle hides the mirror cones`, (await p.$$('.vz-cover')).length === 0);
  await p.click('.vz-controls .seg-ctl button:has-text("משאית")'); await p.waitForTimeout(100);
  check(`${theme}: blind spots: truck view has a note and no head-turn chip`, (await p.isVisible('.vz-truck-note')) && !(await p.isVisible('.chip-btn[data-k=head]')));
  check(`${theme}: blind spots: truck rear zone is bigger than the car's`, await p.$$eval('.vz-dead[data-k=rear]', (n) => { const b = n[0].getBBox(); return b.height * b.width > 8000; }));
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/${theme}-blind.png`, fullPage: true });
  await axe(p, `${theme}: blind spots`);

  // --- safety systems
  await go(p, '#/visual/safety-systems'); await p.waitForSelector('.vz-sys');
  check(`${theme}: systems: seven systems in three groups`, (await p.$$('.vz-sys')).length === 7 && (await p.$$('.vz-sys-group')).length === 3);
  await p.click('.vz-sys[data-id=abs]');
  check(`${theme}: systems: choosing a system updates the detail and the highlighted dot`, /ABS/.test(await p.textContent('.vz-detail h3')) && (await p.$$eval('.vz-dot.on', (n) => n.length)) === 1 && (await p.getAttribute('.vz-sys[data-id=abs]', 'aria-pressed')) === 'true');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/${theme}-systems.png`, fullPage: true });
  await axe(p, `${theme}: systems`);
  await p.click('button:has-text("תרגול")'); await p.waitForSelector('.qcard');
  check(`${theme}: systems: practice starts from the infographic`, true);

  // explanation card links to the infographic
  await p.evaluate(async () => { const m = await import('./js/session.js'); m.startPractice({ title: 't', ids: [811], mode: 'seq', back: '/learn', kind: 'practice' }); });
  await p.waitForSelector('.qcard');
  // a WRONG answer (answers may be shuffled), so the explanation is open and its link is visible
  const right = QS.find((q) => q.id === 811).c;
  for (const b of await p.$$('.answer')) { if ((+(await b.getAttribute('data-i'))) !== right) { await b.click(); break; } }
  await p.waitForSelector('.expl a.expl-vis');
  check(`${theme}: the explanation of question 811 links to the stopping-distance infographic`, (await p.getAttribute('.expl a.expl-vis', 'href')) === '#/visual/stopping');
  check(`${theme}: no page errors`, errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  await ctx.close();
}
// desktop width
{
  const { ctx, p } = await open('light', 1280);
  await go(p, '#/visual/stopping'); await p.waitForSelector('.vz-stop-svg');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/desktop-stopping.png`, fullPage: true });
  check('desktop: no horizontal scroll', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await ctx.close();
}
{
  const { ctx, p } = await open('light', 320);
  for (const k of ['stopping', 'blind-spots', 'safety-systems']) { await go(p, `#/visual/${k}`); await p.waitForTimeout(150); check(`320px: ${k} has no horizontal scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)); }
  await ctx.close();
}
await browser.close();
console.log(failed ? `${failed} FAILED` : 'all infographic checks passed');
process.exit(failed ? 1 : 0);
