// Loads the question bank + unit definitions and builds lookup indexes.
import { CAT_ORDER } from './config.js';

export const D = { questions: [], byId: new Map(), units: [], unitByKey: new Map(), catUnits: {}, ready: false };

export async function loadData() {
  const [qs, us] = await Promise.all([
    fetch('data/questions.json').then((r) => { if (!r.ok) throw new Error('questions'); return r.json(); }),
    fetch('data/units.json').then((r) => { if (!r.ok) throw new Error('units'); return r.json(); }),
  ]);
  D.questions = qs;
  D.byId = new Map(qs.map((q) => [q.id, q]));
  D.units = us.units.slice().sort((a, b) => CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat) || a.order - b.order);
  D.unitByKey = new Map(D.units.map((u) => [u.key, u]));
  D.catUnits = {};
  for (const u of D.units) { (D.catUnits[u.cat] ||= []).push(u); u.qids = []; }
  for (const q of qs) { const u = D.unitByKey.get(q.u); if (u) u.qids.push(q.id); }
  D.ready = true;
  return D;
}

export const imgUrl = (q) => (q.img ? `img/q/${q.img}` : null);
export const unitIcon = (u) => `img/units/${u.key}.svg`;

/** ids of the questions valid for a license class */
export function idsForLic(lic, filterFn) {
  const out = [];
  for (const q of D.questions) if (q.lic.includes(lic) && (!filterFn || filterFn(q))) out.push(q.id);
  return out;
}
export function unitIdsForLic(unit, lic) {
  return unit.qids.filter((id) => D.byId.get(id).lic.includes(lic));
}
/** Units that contain at least one question for this license */
export function unitsForLic(lic, cat) {
  return (cat ? D.catUnits[cat] || [] : D.units).filter((u) => unitIdsForLic(u, lic).length > 0);
}
