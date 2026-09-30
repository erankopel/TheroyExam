import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [outDir, seedFile, ...routes] = process.argv.slice(2);
const W = +(process.env.W || 390), H = +(process.env.H || 800);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, colorScheme: process.env.DARK ? 'dark' : 'light', locale: 'he-IL' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push('console: ' + m.text()); });
const seed = readFileSync(seedFile, 'utf8');
await page.addInitScript((s) => { if (!localStorage.getItem('road26.v1')) localStorage.setItem('road26.v1', s); }, seed);
await page.goto('http://localhost:8123/index.html');
await page.waitForSelector('#view .page');
for (const r of routes) {
  await page.evaluate((r) => { location.hash = r; }, r);
  await page.waitForTimeout(900);
  const name = 's_' + (r.replace(/[^\w]+/g, '_') || 'home') + (process.env.DARK ? '_dark' : '') + '_' + W;
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: !!process.env.FULL });
  console.log('shot', name);
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
