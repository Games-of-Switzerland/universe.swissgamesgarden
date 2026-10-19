/**
 * @file Perspective camera: projection, the browse camera that follows the mouse, and the focus camera
 * that frames one constellation on screen.
 * @module camera
 */
import {
  FIG,
  FOCUS_AT,
  FOCUS_HEIGHT,
  FOCUS_WIDTH,
  FOG_FAR,
  FOG_NEAR,
  MAX_PITCH,
  MAX_YAW,
  MOBILE_FOCUS_MIN_HEIGHT,
  MOBILE_FOCUS_WIDTH,
  MOBILE_MAX_WIDTH,
  NEAR,
} from './config.js';
import { bands } from './scene.js';
import { cam, view } from './state.js';
import { clamp01, rot, vec } from './vec.js';
import { railAt, railTangent } from './world.js';

/** Orthonormal basis { right, up, fwd } for a forward vector, with world up unless looking straight up or down. */
export function basisFor(forward) {
  const fwd = vec.norm(forward);
  let up = [0, 1, 0];
  if (Math.abs(vec.dot(fwd, up)) > 0.98) up = [0, 0, -1];
  const right = vec.norm(vec.cross(up, fwd));
  up = vec.cross(fwd, right);
  return { right, up, fwd };
}

/** Recomputes the ship's basis after its forward vector changed. */
export function updateBasis() {
  cam.basis = basisFor(cam.fwd);
}

/** Browse camera: on the rail at depth z, looking where the mouse `look` points (linear mapping). */
export function browseCamera(z, look) {
  const yaw = ((look.active ? look.nx : 0) * MAX_YAW * Math.PI) / 180;
  const pitch = (-(look.active ? look.ny : 0) * MAX_PITCH * Math.PI) / 180;
  const rail = railAt(z);
  const tangent = railTangent(z);
  const basis = basisFor(tangent);
  // Mouse right means look right, mouse up means look up.
  let fwd = rot(tangent, basis.up, yaw);
  fwd = rot(fwd, vec.norm(vec.cross(basis.up, fwd)), -pitch);
  return { p: [rail[0], rail[1], z], fwd: vec.norm(fwd) };
}

/** Projects a world point to [screenX, screenY, depth], or null when it is behind the camera. */
export function project(point) {
  const offset = vec.sub(point, cam.p);
  const depth = vec.dot(offset, cam.basis.fwd);
  if (depth < NEAR) return null;
  return [
    view.px + (view.f * vec.dot(offset, cam.basis.right)) / depth,
    view.py - (view.f * vec.dot(offset, cam.basis.up)) / depth,
    depth,
  ];
}

/** Same projection for any view, camera and basis, without near clipping: used by the focus solver. */
export function projectWith(view, cameraPosition, basis, point) {
  const offset = vec.sub(point, cameraPosition);
  const depth = vec.dot(offset, basis.fwd);
  return [
    view.px + (view.f * vec.dot(offset, basis.right)) / depth,
    view.py - (view.f * vec.dot(offset, basis.up)) / depth,
    depth,
  ];
}

/** Brightness factor for a depth: 1 up to FOG_NEAR, fading to 0 at FOG_FAR. */
export const fog = (depth) => clamp01(1 - (depth - FOG_NEAR) / (FOG_FAR - FOG_NEAR));

/** Brightness factor that hides things flying through the camera. */
export const nearFade = (depth) => clamp01((depth - NEAR) / 80);

/**
 * Where the focused figure is framed, as fractions of the viewport: { at: [x, y], width, height }.
 * Desktop: the right half, next to the text. Mobile: centred in the free band between the brand and
 * the text sheet, with margins for the star halos and the "why" pill, never thinner than a minimum.
 */
export function focusBoxFor({ vw, vh, brandBottom = 50, sheetTop = vh * 0.46 }) {
  if (vw > MOBILE_MAX_WIDTH) return { at: FOCUS_AT, width: FOCUS_WIDTH, height: FOCUS_HEIGHT };
  const top = brandBottom + 36;
  const bottom = sheetTop - 60;
  const height = Math.max(MOBILE_FOCUS_MIN_HEIGHT, (bottom - top) / vh);
  return { at: [0.5, (top + bottom) / 2 / vh], width: MOBILE_FOCUS_WIDTH, height };
}

/** focusBoxFor() measured from the page; it forces a reflow, so call it once per solve. */
export function focusBox() {
  if (view.vw > MOBILE_MAX_WIDTH) return focusBoxFor(view);
  const brand = document.querySelector('.brand');
  const sheet = document.querySelector('.detail-text');
  return focusBoxFor({
    vw: view.vw,
    vh: view.vh,
    brandBottom: brand ? brand.getBoundingClientRect().bottom : undefined,
    sheetTop: sheet ? sheet.getBoundingClientRect().top || undefined : undefined,
  });
}

/**
 * Camera at `distance` from `target` along the figure's normal, turned so the target lands on the box centre.
 * The camera basis depends on the forward vector, so it solves the small fixed point
 * fwd = normalize(normal - right * dx - up * dy) by iteration.
 */
export function aimAt(game, view, target, distance, box) {
  const position = vec.add(target, vec.mul(game.n, -distance));
  const [boxX, boxY] = box.at;
  // Direction of the box centre in camera space.
  const direction = vec.norm([((boxX - 0.5) * view.vw) / view.f, (-(boxY - 0.5) * view.vh) / view.f, 1]);
  let fwd = game.n;
  for (let i = 0; i < 16; i++) {
    const basis = basisFor(fwd);
    fwd = vec.norm(vec.sub(game.n, vec.add(vec.mul(basis.right, direction[0]), vec.mul(basis.up, direction[1]))));
  }
  return { p: position, fwd };
}

/**
 * Focus camera for a game seen in `view`: refines the aim point and the distance against the real
 * projection, so the figure's on-screen bounding box is centred on the focus box and spans its width
 * (or height). Pure: the view and the box are inputs, focusBox() measures the box from the page.
 */
export function focusCamera(game, view, box) {
  const [boxX, boxY] = box.at;
  let target = game.a.slice();
  let distance = Math.max(45, (2 * Math.max(18, game.constellation.extent * FIG) * view.f) / (box.width * view.vw));
  let candidate = aimAt(game, view, target, distance, box);
  for (let iteration = 0; iteration < 8; iteration++) {
    const basis = basisFor(candidate.fwd);
    const projected = game.pts.map((point) => projectWith(view, candidate.p, basis, point));
    const xs = projected.map((screen) => screen[0]);
    const ys = projected.map((screen) => screen[1]);
    const centreX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centreY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const width = Math.max(1, Math.max(...xs) - Math.min(...xs));
    const height = Math.max(1, Math.max(...ys) - Math.min(...ys));
    // Move the aim point by the on-screen error, converted to world units at the target depth.
    const targetDepth = vec.dot(vec.sub(target, candidate.p), basis.fwd);
    const errorX = ((centreX - boxX * view.vw) * targetDepth) / view.f;
    const errorY = (-(centreY - boxY * view.vh) * targetDepth) / view.f;
    target = vec.add(target, vec.add(vec.mul(basis.right, errorX), vec.mul(basis.up, errorY)));
    // Scale the distance so the box fits the wanted width and never exceeds the wanted height.
    const ratio = Math.max(width / (box.width * view.vw), height / (box.height * view.vh));
    distance = Math.max(45, distance * ratio);
    candidate = aimAt(game, view, target, distance, box);
  }
  return candidate;
}

/** Projected radius in px of a constellation at a depth. */
export const screenExtent = (game, depth) => (game.constellation.extent * FIG * view.f) / depth;

/** True when a screen point is on a constellation (plus some slack in px). */
export function hitTest(screenX, screenY, game, slack = 28) {
  const screen = project(game.a);
  if (!screen) return false;
  return Math.hypot(screenX - screen[0], screenY - screen[1]) <= screenExtent(game, screen[2]) + slack;
}

/** Bands close enough to the ship to be drawn or picked. */
export function visibleBands() {
  const from = cam.p[2] - 400;
  const to = cam.p[2] + FOG_FAR;
  return bands.filter((band) => band.z0 + band.depth >= from && band.z0 <= to);
}

/** Closest constellation to a screen point, within `slack` px of its projected extent, or null. */
export function nearest(screenX, screenY, slack) {
  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const band of visibleBands()) {
    for (const game of band.games) {
      const screen = project(game.a);
      if (!screen || screen[2] > 2200) continue;
      const distance = Math.hypot(screenX - screen[0], screenY - screen[1]) - screenExtent(game, screen[2]);
      if (distance < slack && distance < bestDistance) {
        best = game;
        bestDistance = distance;
      }
    }
  }
  return best;
}
