import { describe, expect, it } from 'vitest';
import { createTilt } from '../src/tilt.js';

/** Reads the same orientation until the smoothing has caught up, returns the look. */
function settle(tilt, alpha, beta, gamma, angle = 0) {
  let look;
  for (let i = 0; i < 80; i++) look = tilt.read(alpha, beta, gamma, angle);
  return look;
}

/** A tilt whose straight ahead is the given orientation. */
function heldAt(alpha, beta, gamma, angle = 0) {
  const tilt = createTilt();
  tilt.read(alpha, beta, gamma, angle);
  return tilt;
}

describe('tilt', () => {
  it('starts straight ahead, however the phone is held', () => {
    expect(createTilt().read(120, 55, -8, 0)).toEqual({ nx: 0, ny: 0 });
  });

  it('looks right when the right edge goes up, and down when the top goes away', () => {
    expect(settle(heldAt(0, 55, 0), 0, 55, -11).nx).toBeCloseTo(0.5, 2);
    const away = settle(heldAt(0, 55, 0), 0, 44, 0);
    expect(away.ny).toBeCloseTo(0.5, 2);
    expect(away.nx).toBeCloseTo(0, 2);
  });

  it('held upright, turning the phone to the right looks right, without looking up or down', () => {
    // Upright, beta is near 90°, where beta and gamma alone cannot tell a turn from a tilt.
    const look = settle(heldAt(0, 90, 0), -11, 90, 0);
    expect(look.nx).toBeCloseTo(0.5, 2);
    expect(look.ny).toBeCloseTo(0, 2);
  });

  it('does not jump when the angles flip past upright', () => {
    // The same orientation, as browsers report it on either side of upright: (a, b, g) and (a + 180, 180 - b, g + 180).
    const before = settle(heldAt(0, 85, 0), 0, 88, 5);
    const after = settle(heldAt(0, 85, 0), 180, 92, -175);
    expect(after.nx).toBeCloseTo(before.nx, 5);
    expect(after.ny).toBeCloseTo(before.ny, 5);
  });

  it('never looks further than the mouse can', () => {
    const look = settle(heldAt(0, 90, 0), -60, 40, 0);
    expect(look.nx).toBeCloseTo(1, 6);
    expect(look.ny).toBeCloseTo(1, 6);
  });

  it('follows the screen orientation', () => {
    // In landscape (top of the phone on the left), lowering its top is raising the screen's right edge.
    expect(settle(heldAt(0, 0, 0, 90), 0, -11, 0, 90).nx).toBeCloseTo(0.5, 2);
    expect(settle(heldAt(0, 0, 0, 270), 0, 11, 0, 270).nx).toBeCloseTo(0.5, 2);
  });

  it('starts from straight ahead again when the screen turns, or when asked', () => {
    const tilt = heldAt(0, 55, 0);
    settle(tilt, 0, 55, 15);
    expect(tilt.read(0, 10, 70, 90)).toEqual({ nx: 0, ny: 0 });
    tilt.recentre();
    expect(tilt.read(0, 30, 5, 90)).toEqual({ nx: 0, ny: 0 });
  });

  it('keeps the same straight ahead: the same tilt always looks the same way', () => {
    const tilt = heldAt(0, 55, 0);
    const first = settle(tilt, 0, 55, -15).nx;
    settle(tilt, 0, 70, 10);
    expect(settle(tilt, 0, 55, -15).nx).toBeCloseTo(first, 6);
  });

  it('smooths the jitter: one reading goes only part of the way', () => {
    const tilt = heldAt(0, 55, 0);
    const step = tilt.read(0, 55, -11).nx;
    expect(step).toBeGreaterThan(0);
    expect(step).toBeLessThan(0.25);
  });
});
