/**
 * @file The live Travel and Focus of the page, wired to the window: the scroll, the history and the clock.
 * @module app
 */
import { browseCamera, focusBox, focusCamera } from './camera.js';
import { TWEEN_MS } from './config.js';
import { games } from './data.js';
import { createFocus } from './focus.js';
import { createUrlHistory } from './router.js';
import { bands } from './scene.js';
import { cam, mouse, view } from './state.js';
import { createTravel } from './travel.js';

// The page scroll, which drives the ship along the rail.
const windowScroll = {
  top: () => window.scrollY,
  to: (top, smooth = false) => window.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' }),
};

export const travel = createTravel(bands, windowScroll);

/** The ship pose framing a game in the current viewport. */
export const solvePose = (game) => focusCamera(game, view, focusBox());

/** The ship pose while browsing: on the rail at the scroll depth, looking where the mouse points. */
export const browsePose = () => browseCamera(travel.depth(), mouse);

export const focus = createFocus({
  cam,
  mouse,
  history: createUrlHistory(games),
  scroll: windowScroll,
  clock: () => performance.now(),
  jumpNear: travel.jumpNear,
  solvePose,
  browsePose,
  duration: TWEEN_MS,
});
