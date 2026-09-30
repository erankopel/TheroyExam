// Pure maths for the stopping-distance infographic (no DOM, unit-tested).
// The numbers are an ILLUSTRATION of the rules in the question bank (stopping distance = reaction distance + braking
// distance; both grow with speed): reaction distance = speed x reaction time, braking distance = v^2 / (2 x mu x g).
export const G = 9.81;
export const CAR_LENGTH_M = 4.5;
export const CONDITIONS = { dry: { label: 'כביש יבש', mu: 0.7 }, wet: { label: 'כביש רטוב', mu: 0.4 } };
export const DRIVERS = { alert: { label: 'נהג ערני', t: 1.0 }, tired: { label: 'עייף או תחת השפעה', t: 2.0 } };
export const SPEEDS = { min: 30, max: 130, step: 10 };

/** distances in metres for a speed in km/h */
export function stoppingDistance(kmh, { t = 1, mu = 0.7 } = {}) {
  const v = Math.max(0, kmh) / 3.6;
  const reaction = v * t, braking = (v * v) / (2 * mu * G);
  return { reaction, braking, total: reaction + braking, carLengths: (reaction + braking) / CAR_LENGTH_M };
}
