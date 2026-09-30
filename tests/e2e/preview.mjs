// The v2 preview lives under /preview/ of the real site (same origin). This test proves that the two never interfere.
// Serve a combined site (the real site in the root + the output of preview/build_preview.py in /preview/), then run:
//   NODE_PATH=$(npm root -g) node tests/e2e/preview.mjs [http://localhost:8125] [shots-dir]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = (process.argv[2] || 'http://localhost:8125').replace(/\/$/, ''), SHOTS = process.argv[3] || null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let failed = 0;
const check = (name, ok, extra = '') => { console.log(ok ? '✓' : '✗', name, ok ? '' : extra); if (!ok) failed++; };
const errors = [];
const newPage = async (ctx) => { const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(e.message)); return p; };
const boot = async (p, path) => { await p.goto(BASE + path); await p.waitForSelector('#view .page, .onboard, .sheet', { timeout: 15000 }); };
const swInfo = (p) => p.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  return { scopes: regs.map((r) => r.scope).sort(), controller: navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : null, caches: (await caches.keys()).sort() };
});
const waitActive = (p) => p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
const seed = { v: 1, created: Date.now(), profile: { name: 'נועה', lic: 'B', onboarded: true, shuffle: true }, q: { 27: { b: 2, d: 0, r: 3, w: 1, l: 1, t: Date.now() }, 121: { b: 0, d: 0, r: 0, w: 2, l: 0, t: Date.now() } }, xp: 55, exams: [], flags: [7], log: {}, badges: {}, activeExam: null };

// ---- 1. the real site is used first (learner with progress), then the preview is opened in the same browser ----
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
  const v1 = await newPage(ctx);
  await v1.addInitScript((s) => { if (location.pathname === '/' || location.pathname.endsWith('/index.html')) { if (!localStorage.getItem('road26.v1')) localStorage.setItem('road26.v1', JSON.stringify(s)); } }, seed);
  await boot(v1, '/');
  await waitActive(v1); await v1.reload(); await boot(v1, '/');
  const before = await v1.evaluate(() => localStorage.getItem('road26.v1'));
  const sw1 = await swInfo(v1);
  check('real site: service worker with root scope is active and controls the page', sw1.scopes.length === 1 && sw1.scopes[0] === BASE + '/' && (sw1.controller || '').endsWith('/sw.js') && !(sw1.controller || '').includes('/preview/'), JSON.stringify(sw1));
  check('real site: has no explanation card (v1 content untouched)', await v1.evaluate(async () => (await fetch('data/explanations.json')).status === 404));
  const v1Caches = sw1.caches;

  const pv = await newPage(ctx);
  await boot(pv, '/preview/');
  check('preview: badge shown', /גרסת תצוגה/.test(await pv.textContent('#preview-badge')));
  check('preview: starts with its OWN empty progress (welcome screen, no borrowed state)', await pv.evaluate(() => {
    const raw = localStorage.getItem('road26pv.v1'); const s = raw ? JSON.parse(raw) : null;
    return !s || (!s.profile?.onboarded && Object.keys(s.q || {}).length === 0);
  }));
  check('preview: never wrote the real progress key', await pv.evaluate((b) => localStorage.getItem('road26.v1') === b, before));
  // give the preview its own learner and answer a question
  await pv.evaluate((s) => localStorage.setItem('road26pv.v1', JSON.stringify({ ...s, q: {}, xp: 0, flags: [], profile: { ...s.profile, name: 'תצוגה' } })), seed);
  await pv.reload(); await boot(pv, '/preview/');
  await pv.evaluate(async () => { const m = await import('./js/session.js'); m.startPractice({ title: 't', ids: [121], mode: 'seq', back: '/learn', kind: 'practice' }); });
  await pv.waitForSelector('.qcard');
  const qid = +(await pv.getAttribute('.qcard', 'data-id'));
  for (const b of await pv.$$('.answer')) { if ((+(await b.getAttribute('data-i'))) !== 2) { await b.click(); break; } }
  await pv.waitForSelector('.expl');
  check('preview: explanations are there', (await pv.textContent('.expl .expl-text')).length > 20);
  await pv.waitForTimeout(400);
  const pvState = JSON.parse(await pv.evaluate(() => localStorage.getItem('road26pv.v1')));
  check('preview: its own progress was recorded', !!pvState.q[qid]);
  check('real progress is byte-for-byte unchanged after playing in the preview', await pv.evaluate((b) => localStorage.getItem('road26.v1') === b, before));
  check('preview picture-download flags use their own keys', await pv.evaluate(() => Object.keys(localStorage).every((k) => !k.startsWith('road26.') || k === 'road26.v1')));

  // service workers: two registrations, the preview page is controlled by ITS worker after the first reload
  await waitActive(pv); await pv.reload(); await boot(pv, '/preview/');
  const swp = await swInfo(pv);
  check('two service workers with separate scopes', swp.scopes.length === 2 && swp.scopes.includes(BASE + '/') && swp.scopes.includes(BASE + '/preview/'), JSON.stringify(swp.scopes));
  check('the preview page is controlled by the preview worker', (swp.controller || '') === BASE + '/preview/sw.js', String(swp.controller));
  check('real site caches survived (the preview worker did not delete them)', v1Caches.every((c) => swp.caches.includes(c)), JSON.stringify({ v1Caches, now: swp.caches }));
  check('preview caches use the road26pv prefix only', swp.caches.filter((c) => !v1Caches.includes(c)).every((c) => c.startsWith('road26pv-')), JSON.stringify(swp.caches));
  if (SHOTS) await pv.screenshot({ path: `${SHOTS}/preview-expl.png` });

  // back on the real site: still fine, still no preview marks, still controlled by its own worker, progress intact
  await v1.reload(); await boot(v1, '/');
  const swb = await swInfo(v1);
  check('real site: still controlled by the root worker after the preview was installed', (swb.controller || '') === BASE + '/sw.js', String(swb.controller));
  check('real site: progress intact and no preview badge', (await v1.evaluate(() => localStorage.getItem('road26.v1'))) === before && (await v1.$('#preview-badge')) === null);
  check('real site: answering shows no explanation card', await (async () => {
    await v1.evaluate(async () => { const m = await import('./js/session.js'); m.startPractice({ title: 't', ids: [121], mode: 'seq', back: '/learn', kind: 'practice' }); });
    await v1.waitForSelector('.qcard'); for (const b of await v1.$$('.answer')) { if ((+(await b.getAttribute('data-i'))) !== 2) { await b.click(); break; } }
    await v1.waitForSelector('.fb-next'); await v1.waitForTimeout(400); return (await v1.$$('.expl')).length === 0;
  })());

  // offline: both keep working
  await ctx.setOffline(true);
  await pv.reload(); await boot(pv, '/preview/');
  check('preview boots offline', true);
  await v1.reload(); await boot(v1, '/');
  check('real site boots offline', true);
  await ctx.setOffline(false);
  await ctx.close();
}

// ---- 2. a visitor who opens the preview FIRST (no real-site worker yet) ----
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'he-IL' });
  const pv = await newPage(ctx);
  await boot(pv, '/preview/'); await waitActive(pv); await pv.reload(); await boot(pv, '/preview/');
  const s = await swInfo(pv);
  check('preview-first visit: only the preview worker exists and controls the page', s.scopes.length === 1 && s.scopes[0] === BASE + '/preview/' && s.controller === BASE + '/preview/sw.js', JSON.stringify(s));
  const v1 = await newPage(ctx);
  await v1.addInitScript(() => { if (!localStorage.getItem('road26.v1')) localStorage.setItem('road26.v1', JSON.stringify({ v: 1, profile: { onboarded: true, lic: 'B' } })); });
  await boot(v1, '/');
  check('real site opens fine afterwards', (await v1.$('#preview-badge')) === null);
  await ctx.close();
}
check('no page errors', errors.length === 0, JSON.stringify(errors.slice(0, 3)));
await browser.close();
console.log(failed ? `${failed} FAILED` : 'all preview isolation checks passed');
process.exit(failed ? 1 : 0);
