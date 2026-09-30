// Contact-sheet renderer for unit icons.  NODE_PATH=$(npm root -g) node tools/render_svg.mjs out.png a.svg b.svg ...
// Each icon is drawn at 192px on the same light tinted tile the app uses, in a grid, with its file name underneath.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const [out, ...files] = process.argv.slice(2);
const TILE = { law: '#dfe7fd', signs: '#ebe4fd', safety: '#fdebdb', vehicle: '#d9f2ef' };
const cell = (f) => {
  const svg = readFileSync(f, 'utf8').replace(/<svg /, '<svg width="150" height="150" ');
  const key = path.basename(f, '.svg'), cat = key.split('-')[0];
  return `<figure><div class="t" style="background:${TILE[cat] || '#eee'}">${svg}</div><div class="s" style="background:${TILE[cat] || '#eee'}">${svg.replace('width="150" height="150"', 'width="40" height="40"')}</div><figcaption>${key}</figcaption></figure>`;
};
const html = `<body style="margin:0;padding:16px;background:#fff;font:12px sans-serif"><div style="display:grid;grid-template-columns:repeat(4,200px);gap:14px">${files.map(cell).join('')}</div>
<style>figure{margin:0;text-align:center}.t{width:180px;height:180px;border-radius:38px;display:grid;place-items:center;margin:0 auto 6px;border:1px solid #0002}.s{width:52px;height:52px;border-radius:14px;display:grid;place-items:center;margin:0 auto 4px;border:1px solid #0002}figcaption{direction:ltr;color:#345}</style></body>`;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 940, height: 300 } });
await page.setContent(html);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('wrote', out);
