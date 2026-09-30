// Offline pictures: the text data is precached by the service worker; the ~440 question pictures are cached on demand
// or all at once (Settings / one-time prompt on Home).
import { D } from './data.js';

const FLAG = 'road26.imgs', PROMPT = 'road26.imgsPrompt';
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } } };

export const imagesReady = () => ls.get(FLAG) === '1';
export const canCache = () => typeof caches !== 'undefined' && !!navigator.serviceWorker?.controller;
/** Show the Home prompt only once per two weeks, and only when it can actually work. */
export const shouldPrompt = () => canCache() && !imagesReady() && Date.now() - (Number(ls.get(PROMPT)) || 0) > 14 * 86400000;
export const dismissPrompt = () => ls.set(PROMPT, String(Date.now()));

/** Fetch every question picture once (the service worker stores them). Resolves with { done, fail, total }. */
export async function downloadAllImages(onProgress) {
  const urls = [...new Set(D.questions.filter((q) => q.img).map((q) => `img/q/${q.img}`))];
  let i = 0, done = 0, fail = 0;
  const worker = async () => {
    while (i < urls.length) {
      const u = urls[i++];
      try { const r = await fetch(u); if (!r.ok) fail++; } catch (e) { fail++; }
      done++; onProgress && onProgress(done, urls.length, fail);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  if (!fail) ls.set(FLAG, '1');
  return { done, fail, total: urls.length };
}
