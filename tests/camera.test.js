import { describe, expect, it } from 'vitest';
import { aimAt, basisFor, focusBoxFor, focusCamera, projectWith } from '../src/camera.js';
import { FOCUS_AT, FOCUS_HEIGHT, FOCUS_WIDTH, FOV, MOBILE_FOCUS_MIN_HEIGHT } from '../src/config.js';
import { vec } from '../src/vec.js';
import { buildWorld } from '../src/world.js';

/** A view of that size, as viewport.js computes it. Each test makes its own: none touches state.view. */
const makeView = (vw, vh) => ({
  vw,
  vh,
  dpr: 1,
  f: vh / 2 / Math.tan(((FOV / 2) * Math.PI) / 180),
  px: vw / 2,
  py: vh / 2,
});

describe('basisFor', () => {
  it('gives an orthonormal right-handed basis with world up', () => {
    const b = basisFor([0, 0, 1]);
    expect(b.right).toEqual([1, 0, 0]);
    expect(b.up).toEqual([0, 1, 0]);
    for (const fwd of [
      [0, 0, 1],
      [1, 0, 1],
      [0.2, -0.3, 0.9],
    ]) {
      const { right, up, fwd: f } = basisFor(fwd);
      expect(vec.dot(right, up)).toBeCloseTo(0);
      expect(vec.dot(right, f)).toBeCloseTo(0);
      expect(vec.dot(up, f)).toBeCloseTo(0);
      expect(vec.len(right)).toBeCloseTo(1);
      expect(vec.len(up)).toBeCloseTo(1);
    }
  });

  it('does not degenerate when looking straight up', () => {
    const b = basisFor([0, 1, 0]);
    expect(Number.isFinite(b.right[0])).toBe(true);
    expect(vec.len(b.right)).toBeCloseTo(1);
  });
});

describe('focusBoxFor', () => {
  it('frames the right half on desktop', () => {
    expect(focusBoxFor({ vw: 1440, vh: 900 })).toEqual({ at: FOCUS_AT, width: FOCUS_WIDTH, height: FOCUS_HEIGHT });
  });

  it('centres the band between the brand and the text sheet on a phone', () => {
    const box = focusBoxFor({ vw: 400, vh: 800, brandBottom: 52, sheetTop: 366 });
    const top = 52 + 36;
    const bottom = 366 - 60;
    expect(box.at[0]).toBe(0.5);
    expect(box.at[1]).toBeCloseTo((top + bottom) / 2 / 800);
    expect(box.height).toBeCloseTo((bottom - top) / 800);
  });

  it('never collapses on a short viewport (phone in landscape)', () => {
    const box = focusBoxFor({ vw: 667, vh: 375, brandBottom: 50, sheetTop: 172 });
    expect(box.height).toBe(MOBILE_FOCUS_MIN_HEIGHT);
    expect(Number.isFinite(box.at[1])).toBe(true);
    const tiny = focusBoxFor({ vw: 568, vh: 320, brandBottom: 50, sheetTop: 100 });
    expect(tiny.height).toBe(MOBILE_FOCUS_MIN_HEIGHT);
  });
});

describe('aimAt', () => {
  it('turns the camera so the target lands on the focus box centre', () => {
    const view = makeView(1000, 800);
    const g = { n: [0, 0, -1] }; // figure facing the rail, i.e. toward -z
    const T = [120, -40, 1000];
    const box = { at: [0.72, 0.5], width: 0.3, height: 0.6 };
    const c = aimAt(g, view, T, 90, box);
    expect(vec.len(vec.sub(c.p, T))).toBeCloseTo(90);
    const s = projectWith(view, c.p, basisFor(c.fwd), T);
    expect(s[0]).toBeCloseTo(0.72 * 1000, 3);
    expect(s[1]).toBeCloseTo(0.5 * 800, 3);
    expect(s[2]).toBeGreaterThan(0);
  });
});

/** A stored game with stars at those sky positions, placed in its band by world.js. */
const figure = (uuid, points, cy = 0.3) => {
  const stars = points.map(([x, y]) => ({ x, y, r: 2 }));
  const extent = Math.max(...points.map(([x, y]) => Math.hypot(x, y)));
  return {
    uuid,
    year: 2020,
    constellation: { cx: 0.5, cy, shine: 1, extent, stars, links: stars.slice(1).map((_, i) => [i, i + 1]) },
  };
};

const lone = figure('lone', [[0, 0]]);
const wide = figure('wide', [
  [0, 0],
  [60, 0],
  [-50, 10],
  [20, -30],
]);
const chain = figure(
  'chain',
  [
    [0, 0],
    [16, 4],
    [40, 20],
    [70, 18],
    [90, 50],
    [30, 64],
  ],
  0.8,
);
buildWorld([lone, wide, chain]);

/** On-screen bounding box of a game's stars for a pose. */
function screenBox(view, game, pose) {
  const basis = basisFor(pose.fwd);
  const projected = game.pts.map((point) => projectWith(view, pose.p, basis, point));
  const xs = projected.map((screen) => screen[0]);
  const ys = projected.map((screen) => screen[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

describe('focusCamera', () => {
  const desktop = makeView(1440, 900);
  const phone = makeView(390, 844);
  const cases = [
    ['desktop', desktop, focusBoxFor(desktop)],
    ['phone', phone, focusBoxFor({ vw: phone.vw, vh: phone.vh, brandBottom: 52, sheetTop: 420 })],
  ];

  describe.each(cases)('on %s', (_name, view, box) => {
    it.each([wide, chain])('centres $uuid on the focus box and fills it without overflowing', (game) => {
      const pose = focusCamera(game, view, box);
      const { minX, maxX, minY, maxY } = screenBox(view, game, pose);
      expect(Math.abs((minX + maxX) / 2 - box.at[0] * view.vw)).toBeLessThan(2);
      expect(Math.abs((minY + maxY) / 2 - box.at[1] * view.vh)).toBeLessThan(2);
      const widthFill = (maxX - minX) / (box.width * view.vw);
      const heightFill = (maxY - minY) / (box.height * view.vh);
      expect(Math.max(widthFill, heightFill)).toBeGreaterThan(0.95);
      expect(Math.max(widthFill, heightFill)).toBeLessThan(1.05);
    });

    it('keeps its distance from a one-star figure', () => {
      const pose = focusCamera(lone, view, box);
      expect(vec.len(vec.sub(pose.p, lone.a))).toBeGreaterThanOrEqual(45 - 1e-6);
      const { minX, minY } = screenBox(view, lone, pose);
      expect(minX).toBeCloseTo(box.at[0] * view.vw, 0);
      expect(minY).toBeCloseTo(box.at[1] * view.vh, 0);
    });
  });

  it('is pure: the same inputs give the same pose', () => {
    const box = focusBoxFor(desktop);
    expect(focusCamera(wide, desktop, box)).toEqual(focusCamera(wide, desktop, box));
  });
});
