/**
 * @file The canvas and the viewport metrics: size, focal length, projection centre.
 * @module viewport
 */
import { focus, travel } from './app.js';
import { FOV, MOBILE_MAX_WIDTH } from './config.js';
import { view } from './state.js';

// The one canvas the sky is drawn on, and its 2D context.
export const canvas = document.getElementById('stage');
export const ctx = canvas.getContext('2d');

// Functions to run after every resize.
const resizeHooks = [];

/** Registers a function to run after every resize (the year rail re-thins itself, for instance). */
export const onResize = (hook) => resizeHooks.push(hook);

/** Fits the canvas to the window and recomputes the focal length and the projection centre. */
export function resize() {
  // On mobile, while a game is open, a height-only resize (the browser bar collapsing on scroll) keeps
  // the focal length and the projection centre, so the framed figure does not change size under the
  // finger. Desktop windows can be resized in height on purpose, so they always re-fit.
  const heightOnly =
    focus.phase !== 'browse' && view.vw > 0 && view.vw <= MOBILE_MAX_WIDTH && window.innerWidth === view.vw;
  view.vw = window.innerWidth;
  view.vh = window.innerHeight;
  view.dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = view.vw * view.dpr;
  canvas.height = view.vh * view.dpr;
  canvas.style.width = `${view.vw}px`;
  canvas.style.height = `${view.vh}px`;
  if (!heightOnly) {
    view.f = view.vh / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);
    view.px = view.vw / 2;
    view.py = view.vh / 2;
  }
  document.body.style.height = `${travel.pageHeight(view.vh)}px`;
  if (!heightOnly) focus.resize();
  for (const hook of resizeHooks) hook();
}

// Back in browse, adopt the viewport height the mobile freeze may have ignored.
focus.onPhase((phase) => {
  if (phase === 'browse') resize();
});
