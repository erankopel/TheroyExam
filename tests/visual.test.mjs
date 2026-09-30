import test from 'node:test';
import assert from 'node:assert/strict';
import { stoppingDistance, CONDITIONS, DRIVERS, SPEEDS } from '../js/visual-math.js';

test('stopping distance = reaction distance + braking distance', () => {
  const d = stoppingDistance(90, { t: 1, mu: 0.7 });
  assert.ok(Math.abs(d.total - (d.reaction + d.braking)) < 1e-9);
  assert.ok(d.reaction > 0 && d.braking > 0);
});
test('reaction distance is linear and braking distance quadratic in speed', () => {
  const a = stoppingDistance(50), b = stoppingDistance(100);
  assert.ok(Math.abs(b.reaction / a.reaction - 2) < 1e-9);
  assert.ok(Math.abs(b.braking / a.braking - 4) < 1e-9);
});
test('every distance grows with speed, on a wet road and for a tired driver (bank questions 805, 809, 1497)', () => {
  for (const c of Object.values(CONDITIONS)) for (const dr of Object.values(DRIVERS)) {
    let prev = null;
    for (let v = SPEEDS.min; v <= SPEEDS.max; v += SPEEDS.step) {
      const d = stoppingDistance(v, { t: dr.t, mu: c.mu });
      if (prev) { assert.ok(d.reaction > prev.reaction && d.braking > prev.braking && d.total > prev.total); }
      prev = d;
    }
  }
});
test('a wet road lengthens braking, a slower reaction lengthens the reaction distance only', () => {
  const dry = stoppingDistance(80, { mu: CONDITIONS.dry.mu }), wet = stoppingDistance(80, { mu: CONDITIONS.wet.mu });
  assert.ok(wet.braking > dry.braking && Math.abs(wet.reaction - dry.reaction) < 1e-9);
  const alert = stoppingDistance(80, { t: DRIVERS.alert.t }), tired = stoppingDistance(80, { t: DRIVERS.tired.t });
  assert.ok(tired.reaction > alert.reaction && Math.abs(tired.braking - alert.braking) < 1e-9);
});
test('plausible magnitudes (50 km/h dry, alert: about 28 m)', () => {
  const d = stoppingDistance(50, { t: 1, mu: 0.7 });
  assert.ok(d.total > 25 && d.total < 32, String(d.total));
});
