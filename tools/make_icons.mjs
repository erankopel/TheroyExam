// Renders img/app/icon.svg into the PNG sizes needed by the manifest / iOS. Usage: NODE_PATH=$(npm root -g) node tools/make_icons.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(path.join(root, 'img/app/icon.svg'), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const page = await browser.newPage();
async function shot(size, file, { pad = 0, bg = 'transparent', round = true } = {}) {
  await page.setViewportSize({ width: size, height: size });
  const inner = size - pad * 2;
  const body = svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `);
  await page.setContent(`<body style="margin:0;background:${bg};display:grid;place-items:center;width:${size}px;height:${size}px">${body}</body>`);
  await page.screenshot({ path: path.join(root, 'img/app', file), omitBackground: bg === 'transparent' });
  console.log('wrote', file);
}
await shot(192, 'icon-192.png');
await shot(512, 'icon-512.png');
await shot(180, 'icon-180.png', { bg: '#1b3fb8' });
await shot(512, 'icon-maskable-512.png', { pad: 64, bg: '#2a55d6' });
await browser.close();
