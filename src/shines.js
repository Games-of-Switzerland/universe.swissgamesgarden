/**
 * @file Shines: the little sparkles on stars near the cursor, and the occasional ambient one.
 * @module shines
 */
import { focus } from './app.js';
import { fog, project, visibleBands } from './camera.js';
import { SHINE_MS } from './config.js';

// Running sparkles: { g: game, i: star index, t0: start time }.
const shines = [];

/** True when that star is already sparkling. */
const isShining = (game, starIndex) => shines.some((shine) => shine.g === game && shine.i === starIndex);

/** Sparkles a few stars around a screen point. */
export function shineNear(screenX, screenY) {
  const now = performance.now();
  for (const band of visibleBands()) {
    for (const game of band.games) {
      if (focus.game && game !== focus.game) continue;
      const screen = project(game.a);
      if (!screen || screen[2] > 2000) continue;
      if (Math.abs(screen[0] - screenX) > 220 || Math.abs(screen[1] - screenY) > 220) continue;
      game.pts.forEach((point, starIndex) => {
        const star = project(point);
        if (!star || Math.hypot(star[0] - screenX, star[1] - screenY) >= 160) return;
        if (Math.random() < 0.08 && !isShining(game, starIndex)) shines.push({ g: game, i: starIndex, t0: now });
      });
    }
  }
}

/** Now and then, a random visible star sparkles on its own. */
export function ambientShine(now) {
  if (Math.random() > 0.04 || focus.game) return;
  const visible = visibleBands();
  if (!visible.length) return;
  const band = visible[Math.floor(Math.random() * visible.length)];
  if (!band.games.length) return;
  const game = band.games[Math.floor(Math.random() * band.games.length)];
  const starIndex = Math.floor(Math.random() * game.pts.length);
  if (!isShining(game, starIndex)) shines.push({ g: game, i: starIndex, t0: now });
}

/** Draws the running sparkles and forgets the finished ones. */
export function drawShines(ctx, now) {
  for (let index = shines.length - 1; index >= 0; index--) {
    const shine = shines[index];
    const progress = (now - shine.t0) / SHINE_MS;
    if (progress >= 1) {
      shines.splice(index, 1);
      continue;
    }
    const star = project(shine.g.pts[shine.i]);
    if (!star) continue;
    const size =
      (7 + shine.g.constellation.stars[shine.i].r * 2) *
      Math.min(2.2, 500 / star[2] + 0.5) *
      Math.sin(progress * Math.PI);
    const alpha = (1 - progress) * fog(star[2]) * (focus.game && shine.g !== focus.game ? 0.2 : 1);
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(star[0] - size, star[1]);
    ctx.lineTo(star[0] + size, star[1]);
    ctx.moveTo(star[0], star[1] - size);
    ctx.lineTo(star[0], star[1] + size);
    ctx.moveTo(star[0] - size * 0.35, star[1] - size * 0.35);
    ctx.lineTo(star[0] + size * 0.35, star[1] + size * 0.35);
    ctx.moveTo(star[0] + size * 0.35, star[1] - size * 0.35);
    ctx.lineTo(star[0] - size * 0.35, star[1] + size * 0.35);
    ctx.stroke();
  }
}
