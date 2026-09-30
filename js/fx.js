// Small celebratory effects. Respect prefers-reduced-motion.
const reduce = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function confetti(intensity = 1) {
  if (reduce()) return;
  const cv = document.createElement('canvas');
  cv.className = 'confetti';
  cv.width = innerWidth; cv.height = innerHeight;
  document.body.append(cv);
  const ctx = cv.getContext('2d');
  const colors = ['#2456e6', '#ffc21a', '#12a06a', '#f08a1c', '#7c4dff', '#e0416a'];
  const n = Math.round(90 * intensity);
  const ps = Array.from({ length: n }, () => ({
    x: cv.width * (0.2 + Math.random() * 0.6), y: cv.height * 0.35,
    vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 11 - 3,
    w: 6 + Math.random() * 6, h: 4 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    c: colors[(Math.random() * colors.length) | 0],
  }));
  let frames = 0;
  (function tick() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const p of ps) {
      p.vy += 0.32; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vx *= 0.99;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (++frames < 110) requestAnimationFrame(tick); else cv.remove();
  })();
}
