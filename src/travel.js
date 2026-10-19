/**
 * @file Travel: where the ship is along the rail, as driven by the page scroll. Owns every conversion between
 * the scroll position and the depth, and every move of the page to a band or a game. Pure: the window comes
 * in through a scroll adapter, and the ship's depth is passed in by the caller.
 * @module travel
 */
import { FOG_FAR, PX_PER_UNIT } from './config.js';
import { TBA } from './world.js';

// Moving to a band stops this far before its start, so the whole year is ahead of the ship.
const YEAR_LEAD = 120;

// The band "you are in" is the one of the point this far ahead of the ship.
const LOOKAHEAD = 180;

// Jumping to a game stops this far before it, so the flight to it is short.
const GAME_APPROACH = 350;

// The home band is this many years before the current year.
const HOME_YEARS_BACK = 10;

/**
 * Creates the travel along these bands.
 * - scroll: { top(), to(top, smooth) }, the page scroll in px.
 */
export function createTravel(bands, scroll) {
  const last = bands[bands.length - 1];
  const worldDepth = last ? last.z0 + last.depth : 0;

  /** Scroll position that puts the ship at depth z. */
  const scrollTopFor = (z) => Math.max(0, z * PX_PER_UNIT);

  /** Depth of the ship on the rail for the current scroll. */
  const depth = () => scroll.top() / PX_PER_UNIT;

  /** The band of the point just ahead of depth z. */
  function bandAt(z) {
    const ahead = z + LOOKAHEAD;
    let current = bands[0];
    for (const band of bands) {
      if (band.z0 <= ahead) current = band;
      else break;
    }
    return current;
  }

  /** Moves the page to a band, a bit before its start; smoothly unless told otherwise. */
  function toBand(band, smooth = true) {
    scroll.to(scrollTopFor(band.z0 - YEAR_LEAD), smooth);
  }

  return {
    depth,
    bandAt,
    toBand,

    /** Height of the page in px that lets the ship scroll through the whole world. */
    pageHeight: (viewportHeight) => worldDepth * PX_PER_UNIT + viewportHeight,

    /** Moves to the next (+1) or previous (-1) band from `band`, staying within the first and last. */
    stepYear(band, direction) {
      const index = bands.indexOf(band);
      toBand(bands[Math.max(0, Math.min(bands.length - 1, index + direction))]);
    },

    /** The band the home starts at: ten years before `year`, or the first band when the data is younger. */
    homeBand: (year) => bands.find((band) => band.key !== TBA && band.key >= year - HOME_YEARS_BACK) || bands[0],

    /** Jumps the page next to a game that is not ahead within sight; true when the page moved. */
    jumpNear(game) {
      const distance = game.a[2] - depth();
      if (distance >= 0 && distance <= FOG_FAR) return false;
      scroll.to(scrollTopFor(game.a[2] - GAME_APPROACH), false);
      return true;
    },
  };
}
