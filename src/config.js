/**
 * @file Every tunable of the viewer. The universe is a tunnel along the z axis where z is time:
 * you fly on a rail (x = 0, y = 0) and the constellations hang around you.
 * @module config
 */

// World units of a year that has no game.
export const YEAR_MIN = 480;

// Extra depth per game, so busy years are longer flights.
export const YEAR_PER_GAME = 8;

// A year label only appears when its gate is closer than this (world units).
export const YEAR_LABEL_RANGE = 700;

// Reference distance from the rail, used to place the year labels below the ship.
export const RING_R = 260;

// Constellations are scattered between these two distances from the rail,
// so the universe reads as a star field rather than a tube.
export const R_MIN = 55;
export const R_MAX = 620;

// Rail curvature amplitudes on x and y: [0, 0] is a straight rail.
export const RAIL_AMP = [0, 0];

// Wavelengths of the rail curvature on x and y (world units), only used when RAIL_AMP is not zero.
export const RAIL_LEN = [2600, 1900];

// Degrees: each figure's plane is tilted away from facing the rail by up to this.
export const TILT_MAX = 50;

// Sky units (the constellation algorithm) to world units.
export const FIG = 1.0;

// Vertical field of view, degrees.
export const FOV = 62;

// Nothing closer than this to the camera is drawn (world units).
export const NEAR = 30;

// Fog: full brightness up to FOG_NEAR, invisible beyond FOG_FAR.
export const FOG_NEAR = 500;
export const FOG_FAR = 3200;

// Mouse look-around in degrees: the cursor position maps linearly to the view angle,
// like 50-jahre-hitparade.ch.
export const MAX_YAW = 52;
export const MAX_PITCH = 40;

// The camera turns toward the mouse by this fraction per frame.
export const LOOK_EASE = 0.1;

// Scroll pixels per world unit.
export const PX_PER_UNIT = 0.6;

// On touch screens, scroll pixels per pixel the two fingers of a pinch move apart (forward) or together (back).
export const PINCH_SCROLL = 3;

// Viewport width in px at or below which the detail is a page: figure on top, text below.
export const MOBILE_MAX_WIDTH = 720;

// Intro timeline, in ms after boot: the logo, then the sky fades in, then the UI slides in.
export const INTRO = { sceneAt: 500, sceneMs: 1400, uiAt: 1500, settleMs: 1400 };

// Desktop: where the focused figure sits on screen, as fractions of the viewport.
export const FOCUS_AT = [0.72, 0.5];

// Desktop: the focused figure spans this fraction of the viewport width...
export const FOCUS_WIDTH = 0.3;

// ...and never more than this fraction of the height.
export const FOCUS_HEIGHT = 0.6;

// Mobile: the focused figure spans this fraction of the viewport width.
export const MOBILE_FOCUS_WIDTH = 0.7;

// Mobile: short viewports (phone in landscape) keep at least this fraction of the height for the figure.
export const MOBILE_FOCUS_MIN_HEIGHT = 0.2;

// Opacity of a constellation title when close enough to read it.
export const LABEL_ALPHA = 0.5;

// Duration of a sparkle, ms.
export const SHINE_MS = 750;

// Background starfield: one seeded tile of this many points, repeated every BG_TILE world units.
export const BG_TILE = 2400;
export const BG_PER_TILE = 420;

// Duration of the camera flight to or from a constellation, ms.
export const TWEEN_MS = 1100;
