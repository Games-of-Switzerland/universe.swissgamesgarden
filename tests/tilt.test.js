import { describe, expect, it } from 'vitest';
import { createTilt } from '../src/tilt.js';

describe('tilt', () => {
  it('starts straight ahead, however the phone is held', () => {
    expect(createTilt().read(55, -8, 0)).toEqual({ nx: 0, ny: 0 });
  });

  it('looks right when the right edge goes up, and down when the top goes away', () => {
    const tilt = createTilt();
    tilt.read(55, 0, 0);
    expect(tilt.read(55, -11, 0).nx).toBeCloseTo(0.5, 1);
    const away = tilt.read(44, 0, 0);
    expect(away.ny).toBeGreaterThan(0.4);
  });

  it('never looks further than the mouse can', () => {
    const tilt = createTilt();
    tilt.read(55, 0, 0);
    expect(tilt.read(-30, -80, 0)).toEqual({ nx: 1, ny: 1 });
  });

  it('follows the screen orientation', () => {
    const tilt = createTilt();
    tilt.read(0, 60, 90);
    // In landscape (top of the phone on the left), lowering its top is raising the screen's right edge.
    expect(tilt.read(-11, 60, 90).nx).toBeCloseTo(0.5, 1);
    const flipped = createTilt();
    flipped.read(0, -60, 270);
    expect(flipped.read(11, -60, 270).nx).toBeCloseTo(0.5, 1);
  });

  it('starts from straight ahead again when the screen turns, or when asked', () => {
    const tilt = createTilt();
    tilt.read(55, 0, 0);
    tilt.read(55, 15, 0);
    expect(tilt.read(10, 70, 90)).toEqual({ nx: 0, ny: 0 });
    tilt.recentre();
    expect(tilt.read(30, 5, 90)).toEqual({ nx: 0, ny: 0 });
  });

  it('keeps the same straight ahead: the same tilt always looks the same way', () => {
    const tilt = createTilt();
    tilt.read(55, 0, 0);
    const first = tilt.read(55, -15, 0).nx;
    for (let i = 0; i < 600; i++) tilt.read(70, 10, 0);
    expect(tilt.read(55, -15, 0).nx).toBe(first);
  });
});
