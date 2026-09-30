import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const qs = JSON.parse(readFileSync(new URL('../data/questions.json', import.meta.url), 'utf8'));
const { units } = JSON.parse(readFileSync(new URL('../data/units.json', import.meta.url), 'utf8'));

test('question bank is complete and well-formed', () => {
  assert.equal(qs.length, 1802);
  assert.equal(new Set(qs.map((q) => q.id)).size, qs.length);
  for (const q of qs) {
    assert.equal(q.a.length, 4, `q${q.id} answers`);
    assert.ok(q.c >= 0 && q.c < 4, `q${q.id} correct index`);
    assert.ok(q.q.length > 3 && q.a.every((a) => a.length > 0), `q${q.id} text`);
    assert.ok(q.lic.length > 0, `q${q.id} licences`);
    if (q.img) assert.ok(existsSync(new URL(`../img/q/${q.img}`, import.meta.url)), `q${q.id} image ${q.img}`);
  }
});

test('every question belongs to a known unit of its own category', () => {
  const byKey = new Map(units.map((u) => [u.key, u]));
  for (const q of qs) { const u = byKey.get(q.u); assert.ok(u, `q${q.id} unit ${q.u}`); assert.equal(u.cat, q.cat, `q${q.id} category`); }
});

test('the B-license pool is large enough for a 30-question exam and every category', () => {
  const b = qs.filter((q) => q.lic.includes('B'));
  assert.ok(b.length > 1000);
  for (const cat of ['law', 'signs', 'safety', 'vehicle']) assert.ok(b.some((q) => q.cat === cat), cat);
});

test('summary facts cite existing questions', () => {
  const ids = new Set(qs.map((q) => q.id));
  for (const u of units) for (const f of u.summary || []) { assert.ok(f.t && f.t.length > 5); for (const r of f.refs || []) assert.ok(ids.has(r), `${u.key} ref ${r}`); }
});
