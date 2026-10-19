import { describe, expect, it } from 'vitest';
import { FOG_FAR, PX_PER_UNIT } from '../src/config.js';
import { createTravel } from '../src/travel.js';
import { buildWorld } from '../src/world.js';

const game = (uuid, year, cx = 0.5) => ({
  uuid,
  year,
  constellation: { cx, cy: 0.25, shine: 1, extent: 10, stars: [{ x: 0, y: 0, r: 2 }], links: [] },
});

const { bands, depth: worldDepth } = buildWorld([
  game('a', 2010),
  game('b', 2011),
  game('c', 2011, 0.9),
  game('d', 2015),
  game('e', null),
]);
const [y2010, y2011, y2015, tba] = bands;

/** A page scroll that records where it was sent. */
function fakeScroll(top = 0) {
  const moves = [];
  return {
    moves,
    top: () => top,
    to(next, smooth = false) {
      top = next;
      moves.push({ top: next, smooth });
    },
  };
}

describe('travel', () => {
  it('converts the scroll into the depth of the ship', () => {
    const travel = createTravel(bands, fakeScroll(600));
    expect(travel.depth()).toBe(600 / PX_PER_UNIT);
  });

  it('makes the page tall enough to reach the end of the world', () => {
    const travel = createTravel(bands, fakeScroll());
    expect(travel.pageHeight(800)).toBe(worldDepth * PX_PER_UNIT + 800);
  });

  it('says which band the point just ahead of the ship is in', () => {
    const travel = createTravel(bands, fakeScroll());
    expect(travel.bandAt(0)).toBe(y2010);
    expect(travel.bandAt(y2011.z0 - 181)).toBe(y2010);
    expect(travel.bandAt(y2011.z0 - 180)).toBe(y2011);
    expect(travel.bandAt(tba.z0)).toBe(tba);
    expect(travel.bandAt(worldDepth + 1000)).toBe(tba);
  });

  it('moves smoothly to a band, a bit before its start', () => {
    const scroll = fakeScroll();
    createTravel(bands, scroll).toBand(y2015);
    expect(scroll.moves).toEqual([{ top: (y2015.z0 - 120) * PX_PER_UNIT, smooth: true }]);
  });

  it('steps one year at a time, and stops at the first and the last band', () => {
    const scroll = fakeScroll();
    const travel = createTravel(bands, scroll);
    travel.stepYear(y2011, 1);
    travel.stepYear(y2010, -1);
    travel.stepYear(tba, 1);
    expect(scroll.moves.map((move) => move.top)).toEqual(
      [y2015, y2010, tba].map((band) => Math.max(0, (band.z0 - 120) * PX_PER_UNIT)),
    );
  });

  it('starts home ten years back, or at the first band when the data is younger', () => {
    const travel = createTravel(bands, fakeScroll());
    expect(travel.homeBand(2021)).toBe(y2011);
    expect(travel.homeBand(2025)).toBe(y2015);
    expect(travel.homeBand(2015)).toBe(y2010);
    expect(travel.homeBand(2040)).toBe(y2010);
  });

  it('jumps next to a far game, and stays put when the game is ahead within sight', () => {
    const scroll = fakeScroll();
    const travel = createTravel(bands, scroll);
    const near = { a: [0, 0, FOG_FAR - 1] };
    const far = { a: [0, 0, FOG_FAR + 500] };
    expect(travel.jumpNear(near)).toBe(false);
    expect(scroll.moves).toEqual([]);
    expect(travel.jumpNear(far)).toBe(true);
    expect(scroll.moves).toEqual([{ top: (far.a[2] - 350) * PX_PER_UNIT, smooth: false }]);
    // Behind the ship counts as far too.
    expect(createTravel(bands, fakeScroll(far.a[2] * PX_PER_UNIT)).jumpNear({ a: [0, 0, 10] })).toBe(true);
  });
});
