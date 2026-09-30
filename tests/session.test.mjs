import test from 'node:test';
import assert from 'node:assert/strict';
import { smartOrder } from '../js/session.js';
import { store } from '../js/ctx.js';
import { D } from '../js/data.js';

test('smart sessions reserve room for new questions, but reviews and mistakes still come first', () => {
  D.questions = []; D.byId = new Map();
  const ids = Array.from({ length: 200 }, (_, i) => i + 1);
  for (const id of ids.slice(0, 120)) store.recordAnswer(id, id % 5 !== 0); // 24 mistakes, the rest learning
  const weak = ids.filter((id) => store.statusOf(id) === 'weak'), fresh = ids.filter((id) => store.statusOf(id) === 'new');
  assert.equal(weak.length, 24); assert.equal(fresh.length, 80);
  const s15 = smartOrder(ids, 15, 0.35);
  assert.equal(s15.length, 15); assert.equal(new Set(s15).size, 15);
  const nNew = s15.filter((id) => fresh.includes(id)).length, nWeak = s15.filter((id) => weak.includes(id)).length;
  assert.equal(nNew, 6);            // ceil(15 * 0.35)
  assert.equal(nWeak, 9);           // the remaining slots go to mistakes first
  assert.equal(smartOrder(ids).length, 200);   // no limit: every question, weakest first
  assert.ok(smartOrder(ids)[0] && store.statusOf(smartOrder(ids)[0]) === 'weak');
  // small pools: never returns more than exist
  assert.equal(smartOrder(fresh.slice(0, 4), 15).length, 4);
});
