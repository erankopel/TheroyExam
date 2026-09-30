// Ad-hoc screenshot helper: node tests/e2e/shot.mjs <outDir> <route> [route...]   (env: W,H, DARK=1, PRESET=<js file exporting seed fn>)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [outDir, ...routes] = process.argv.slice(2);
const W = +(process.env.W || 390), H = +(process.env.H || 800);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, colorScheme: process.env.DARK ? 'dark' : 'light', locale: 'he-IL' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('requestfailed', (r) => errors.push('reqfail: ' + r.url()));
await page.goto('http://localhost:8123/index.html');
await page.waitForSelector('#view .page, #view .session', { timeout: 15000 });
if (process.env.SEED) { await page.evaluate(process.env.SEED); await page.reload(); await page.waitForSelector('#view .page, #view .session'); }
for (const r of routes) {
  await page.evaluate((r) => { location.hash = r; }, r);
  await page.waitForTimeout(700);
  const name = r.replace(/[^\w]+/g, '_') || 'home';
  await page.screenshot({ path: `${outDir}/${name}${process.env.DARK ? '_dark' : ''}_${W}.png`, fullPage: !process.env.VIEWPORT });
  console.log('shot', name);
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
