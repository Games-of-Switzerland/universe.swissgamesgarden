/**
 * @file The frame loop: moves the camera, then draws the sky, the year gates, the constellations and the shines.
 * @module render
 */
import { browsePose, focus } from './app.js';
import { fog, nearFade, project, screenExtent, updateBasis, visibleBands } from './camera.js';
import { BG_PER_TILE, BG_TILE, FOG_FAR, LABEL_ALPHA, LOOK_EASE, RING_R, YEAR_LABEL_RANGE } from './config.js';
import { introAlpha, introFor, introProgress } from './intro.js';
import { ambientShine, drawShines } from './shines.js';
import { cam, state, view } from './state.js';
import { rgba, seededRandom, vec } from './vec.js';
import { ctx } from './viewport.js';
import { railAt } from './world.js';
import { updateYearLabel } from './years.js';

// Colours of the stars and of the lines between them.
const WHITE = [255, 255, 255];
const PINK = [255, 125, 175];

// Nearer stars are drawn bigger: radius factor = STAR_SCALE_DEPTH / depth, between the two bounds.
const STAR_SCALE_DEPTH = 520;
const STAR_SCALE_MIN = 0.6;
const STAR_SCALE_MAX = 6;

// Halo radius = star radius × (HALO_BASE + HALO_PER_SHINE × shine); bigger on the hovered or focused figure.
const HALO_BASE = 2.2;
const HALO_PER_SHINE = 0.9;
const HALO_STRONG = 1.2;

// Twinkle: brightness breathes between 0.72 - 0.28 and 0.72 + 0.28.
const TWINKLE_BASE = 0.72;
const TWINKLE_AMPLITUDE = 0.28;

// A constellation title starts to appear at TITLE_FAR depth and is fully visible TITLE_FADE units closer.
const TITLE_FAR = 1150;
const TITLE_FADE = 650;

// Halo sprite: a white radial fade drawn once, then stamped with drawImage and globalAlpha for every star,
// instead of creating a gradient object per star per frame.
const HALO_SPRITE_SIZE = 64;
const haloSprite = createHaloSprite();

/** Draws the white radial fade used for every star halo. */
function createHaloSprite() {
  const sprite = document.createElement('canvas');
  sprite.width = HALO_SPRITE_SIZE;
  sprite.height = HALO_SPRITE_SIZE;
  const spriteCtx = sprite.getContext('2d');
  const half = HALO_SPRITE_SIZE / 2;
  const fade = spriteCtx.createRadialGradient(half, half, 0, half, half, half);
  fade.addColorStop(0, 'rgba(255,255,255,1)');
  fade.addColorStop(1, 'rgba(255,255,255,0)');
  spriteCtx.fillStyle = fade;
  spriteCtx.fillRect(0, 0, HALO_SPRITE_SIZE, HALO_SPRITE_SIZE);
  return sprite;
}

// The fraction of the browse camera position adopted per frame.
const MOVE_EASE = 0.16;

// Background starfield: one seeded tile of 3D points, repeated along z.
const random = seededRandom(42);
const backgroundStars = Array.from({ length: BG_PER_TILE }, () => {
  const angle = random() * Math.PI * 2;
  const distance = 40 + 1100 * Math.sqrt(random());
  return {
    p: [Math.sin(angle) * distance, Math.cos(angle) * distance, random() * BG_TILE],
    r: 0.5 + random() * 1.4,
    a: 0.3 + random() * 0.6,
    ph: random() * 6.28,
    rate: 0.2 + random() * 0.6,
  };
});

/** Advances the camera: along the focus flight, or easing toward the browse camera when no game is focused. */
function moveCamera(now) {
  focus.tick(now);
  if (focus.phase === 'browse') {
    const target = browsePose();
    cam.p = vec.lerp(cam.p, target.p, MOVE_EASE);
    cam.fwd = vec.norm(vec.lerp(cam.fwd, target.fwd, LOOK_EASE));
  }
  updateBasis();
}

/** Paints the sky gradient and the background starfield. */
function drawBackground(time, dim) {
  const { vw, vh } = view;
  const gradient = ctx.createRadialGradient(vw / 2, vh / 2, 0, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
  gradient.addColorStop(0, '#0b0640');
  gradient.addColorStop(1, '#040120');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, vw, vh);
  const firstTile = Math.floor((cam.p[2] - 600) / BG_TILE);
  const lastTile = Math.floor((cam.p[2] + FOG_FAR) / BG_TILE);
  for (let tile = firstTile; tile <= lastTile; tile++) {
    for (const star of backgroundStars) {
      const screen = project([star.p[0], star.p[1], star.p[2] + tile * BG_TILE]);
      if (!screen || screen[0] < -4 || screen[0] > vw + 4 || screen[1] < -4 || screen[1] > vh + 4) continue;
      const twinkle = 0.7 + 0.3 * Math.sin(time * star.rate * 6.28 + star.ph);
      const alpha = star.a * fog(screen[2]) * nearFade(screen[2]) * twinkle * dim;
      if (alpha < 0.02) continue;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(screen[0], screen[1], star.r * Math.min(1.6, 600 / screen[2] + 0.4), 0, 6.28);
      ctx.fill();
    }
  }
}

/** Draws a big faded year at the entrance of each visible year, below the rail: one at a time. */
function drawYearGates(visible, dim) {
  for (const band of visible) {
    const rail = railAt(band.z0);
    const screen = project([rail[0], rail[1] - RING_R * 0.55, band.z0]);
    if (!screen || screen[2] > YEAR_LABEL_RANGE) continue;
    const size = Math.min(700, (170 * view.f) / screen[2]);
    // Appears gently, and leaves before the next one shows up.
    const fadeIn = Math.min(1, (YEAR_LABEL_RANGE - screen[2]) / 300);
    const fadeOut = Math.max(0, Math.min(1, (screen[2] - 120) / 180));
    const alpha = 0.22 * fadeIn * fadeOut * dim;
    if (alpha < 0.01 || size < 6) continue;
    ctx.fillStyle = `rgba(255,125,175,${alpha})`;
    ctx.font = `800 ${size}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(band.label, screen[0], screen[1]);
  }
}

/** Draws one constellation: links, stars with halos, and the title when close enough (unless hidden). */
export function drawConstellation(game, screen, time, baseAlpha, strong, hideTitle) {
  const depth = screen[2];
  const isFocus = game === focus.game;
  // The focused figure is close by design: no near fade for it.
  const alpha = baseAlpha * (isFocus ? 1 : fog(depth) * nearFade(depth));
  if (alpha < 0.015) return;
  const extent = screenExtent(game, depth);
  const { vw, vh } = view;
  if (
    screen[0] + extent < -60 ||
    screen[0] - extent > vw + 60 ||
    screen[1] + extent < -80 ||
    screen[1] - extent > vh + 80
  )
    return;
  const constellation = game.constellation;
  const shine = game.shine;
  const projectedStars = game.pts.map(project);
  const radiusScale = Math.max(STAR_SCALE_MIN, Math.min(STAR_SCALE_MAX, STAR_SCALE_DEPTH / depth));

  if (constellation.links.length) {
    ctx.strokeStyle = rgba(PINK, (strong ? 1 : 0.45) * alpha);
    ctx.lineWidth = strong ? 1.8 : 1;
    ctx.beginPath();
    for (const [from, to] of constellation.links) {
      const start = projectedStars[from];
      const end = projectedStars[to];
      if (!start || !end) continue;
      ctx.moveTo(start[0], start[1]);
      ctx.lineTo(end[0], end[1]);
    }
    ctx.stroke();
  }
  constellation.stars.forEach((star, index) => {
    const position = projectedStars[index];
    if (!position) return;
    const twinkle = TWINKLE_BASE + TWINKLE_AMPLITUDE * Math.sin(time * star.twinkle.rate * 6.28 + star.twinkle.phase);
    const radius = Math.max(0.8, star.r * radiusScale) * (strong ? 1.15 : 1);
    // Halo: wider and brighter for award winners (shine) and for the hovered or focused figure.
    const haloRadius = radius * (HALO_BASE + HALO_PER_SHINE * shine) * (strong ? HALO_STRONG : 1);
    ctx.globalAlpha = Math.min(1, (0.3 + 0.18 * shine) * twinkle) * alpha;
    ctx.drawImage(haloSprite, position[0] - haloRadius, position[1] - haloRadius, haloRadius * 2, haloRadius * 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(WHITE, Math.min(1, (strong ? 0.9 : 0.6) + 0.4 * twinkle) * alpha);
    ctx.beginPath();
    ctx.arc(position[0], position[1], radius, 0, 6.28);
    ctx.fill();
  });
  if (hideTitle) return;
  const titleAlpha = (strong ? 1 : LABEL_ALPHA * Math.max(0, Math.min(1, (TITLE_FAR - depth) / TITLE_FADE))) * alpha;
  if (titleAlpha <= 0.03) return;
  ctx.fillStyle = `rgba(255,255,255,${titleAlpha})`;
  ctx.font = `${strong ? 600 : 400} ${Math.max(9, Math.min(13, (9 * 500) / depth + 6))}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(game.title, screen[0], screen[1] + extent + 6);
}

/** One frame: move the camera, draw everything far to near, update the year label. */
function frame(now) {
  requestAnimationFrame(frame);
  const time = now / 1000;
  moveCamera(now);
  const focused = focus.game;
  const intro = introProgress(now);
  // Everything but the focused figure is dimmed while a game is focused, deeper once it is open.
  const dim = (focus.phase === 'browse' ? 1 : focus.phase === 'open' ? 0.08 : 0.5) * introAlpha(intro);

  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  drawBackground(time, dim);
  const visible = visibleBands();
  drawYearGates(visible, dim);

  const drawList = [];
  for (const band of visible) {
    for (const game of band.games) {
      if (game === focused) continue;
      const screen = project(game.a);
      if (screen) drawList.push([game, screen]);
    }
  }
  drawList.sort((first, second) => second[1][2] - first[1][2]);
  for (const [game, screen] of drawList) {
    const hovered = game === state.hovered;
    drawConstellation(game, screen, time, (hovered ? 1 : 0.85) * dim * introFor(game, intro), hovered, false);
  }
  if (focused) {
    const screen = project(focused.a);
    if (screen) drawConstellation(focused, screen, time, 1, true, focus.phase === 'open');
  }

  drawShines(ctx, now);
  ambientShine(now);
  updateYearLabel();
}

/** Starts the frame loop. */
export function startRender() {
  requestAnimationFrame(frame);
}
