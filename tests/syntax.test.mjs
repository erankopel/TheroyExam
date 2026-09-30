import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// `node --check file.js` treats .js as CommonJS and can miss ES-module syntax errors; check every module as an ES module.
const dirs = ['../js', '../js/views'];
for (const d of dirs) {
  for (const f of readdirSync(new URL(d + '/', import.meta.url)).filter((n) => n.endsWith('.js'))) {
    test(`syntax: ${d.slice(3)}/${f}`, () => {
      const src = readFileSync(new URL(`${d}/${f}`, import.meta.url), 'utf8');
      const r = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: src, encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
    });
  }
}
test('syntax: service worker', () => {
  const r = spawnSync(process.execPath, ['--check', new URL('../sw.js', import.meta.url).pathname], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});
