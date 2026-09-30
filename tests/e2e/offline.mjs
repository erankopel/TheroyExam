// Verifies the PWA works offline after the first visit.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'he-IL' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:8123/index.html');
await page.waitForSelector('#view .page');
await page.evaluate(async () => { await navigator.serviceWorker.ready; });
await page.waitForTimeout(1500);
// visit a page with a picture so it is cached lazily
await page.evaluate(() => { location.hash = '#/signs'; });
await page.waitForSelector('.sign-card img');
await page.waitForTimeout(1000);
await ctx.setOffline(true);
await page.reload();
await page.waitForSelector('#view .page', { timeout: 10000 });
const title = await page.textContent('.brand b');
await page.evaluate(() => { location.hash = '#/learn'; });
await page.waitForSelector('.unit-card');
console.log('offline OK:', title, '| errors:', errors.length ? errors : 'none');
await browser.close();
