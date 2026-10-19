import { describe, expect, it } from 'vitest';
import { R_MAX, R_MIN, YEAR_MIN, YEAR_PER_GAME } from '../src/config.js';
import { vec } from '../src/vec.js';
import { buildWorld, compareYearKeys, placeGame, railAt, railTangent, yearKey } from '../src/world.js';

const game = (uuid, year, cx = 0.5, cy = 0.25) => ({
  uuid,
  year,
  constellation: {
    cx,
    cy,
    shine: 1.5,
    extent: 12,
    stars: [
      { x: 0, y: 0, r: 3 },
      { x: 10, y: 0, r: 2 },
      { x: 0, y: -8, r: 1 },
    ],
    links: [
      [0, 1],
      [0, 2],
    ],
  },
});

describe('rail', () => {
  it('is straight by default', () => {
    const noSignedZero = (a) => a.map((x) => x + 0); // sin(0) * 0 is -0, which toEqual distinguishes
    expect(noSignedZero(railAt(0))).toEqual([0, 0]);
    expect(noSignedZero(railAt(12345))).toEqual([0, 0]);
    expect(noSignedZero(railTangent(500))).toEqual([0, 0, 1]);
  });
});

describe('year keys', () => {
  it('maps an unknown year to TBA and sorts it last', () => {
    expect(yearKey({ year: null })).toBe('TBA');
    expect(yearKey({ year: 2001 })).toBe(2001);
    expect([2010, 'TBA', 1999, 2005].sort(compareYearKeys)).toEqual([1999, 2005, 2010, 'TBA']);
  });
});

describe('buildWorld', () => {
  const world = buildWorld([game('a', 2001), game('b', null), game('c', 1999), game('d', 2001, 0.9, 0.8)]);

  it('makes one band per year, chronological, TBA last', () => {
    expect(world.bands.map((b) => b.key)).toEqual([1999, 2001, 'TBA']);
    expect(world.bands.map((b) => b.games.length)).toEqual([1, 2, 1]);
  });

  it('lays the bands end to end, longer when busier', () => {
    const [b1999, b2001, tba] = world.bands;
    expect(b1999.z0).toBe(0);
    expect(b1999.depth).toBe(YEAR_MIN + YEAR_PER_GAME);
    expect(b2001.z0).toBe(b1999.depth);
    expect(b2001.depth).toBe(YEAR_MIN + 2 * YEAR_PER_GAME);
    expect(tba.z0).toBe(b1999.depth + b2001.depth);
    expect(world.depth).toBe(tba.z0 + tba.depth);
  });

  it('places every game inside its band, at a distance from the rail within the configured range', () => {
    for (const b of world.bands) {
      for (const g of b.games) {
        expect(g.band).toBe(b);
        expect(g.a[2]).toBeGreaterThanOrEqual(b.z0);
        expect(g.a[2]).toBeLessThanOrEqual(b.z0 + b.depth);
        expect(g.r).toBeGreaterThanOrEqual(R_MIN);
        expect(g.r).toBeLessThanOrEqual(R_MAX);
        expect(Math.hypot(g.a[0], g.a[1])).toBeCloseTo(g.r);
      }
    }
  });

  it('gives each game one point per star and an orthonormal plane whose normal faces the rail', () => {
    for (const b of world.bands) {
      for (const g of b.games) {
        expect(g.pts).toHaveLength(g.constellation.stars.length);
        expect(vec.dot(g.u, g.w)).toBeCloseTo(0);
        expect(vec.len(g.n)).toBeCloseTo(1);
        expect(vec.dot(g.n, [g.a[0], g.a[1], 0])).toBeLessThanOrEqual(0);
        expect(g.pts[0]).toEqual(g.a); // the main star is at the anchor
      }
    }
  });

  it('is deterministic: the same uuid always lands at the same place', () => {
    const band = { z0: 100, depth: 500 };
    const g1 = placeGame(game('same', 2000), band);
    const g2 = placeGame(game('same', 2000), band);
    expect(g1.a).toEqual(g2.a);
    expect(g1.n).toEqual(g2.n);
    const other = placeGame(game('other', 2000), band);
    expect(other.a).not.toEqual(g1.a);
  });
});
