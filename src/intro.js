/**
 * @file Intro: the logo shows first, then the sky fades in, then the UI slides in from outside the screen.
 * @module intro
 */
import { INTRO } from './config.js';
import { state } from './state.js';
import { clamp01, easeCubicOut, hash01 } from './vec.js';

/** Starts the intro timeline: body classes drive the UI, `state.introStart` drives the sky. */
export function playIntro() {
  document.body.classList.add('is-loading');
  state.introStart = performance.now();
  setTimeout(() => {
    document.body.classList.add('is-entering');
    document.body.classList.remove('is-loading');
  }, INTRO.uiAt);
  setTimeout(() => document.body.classList.remove('is-entering'), INTRO.uiAt + INTRO.settleMs);
}

/** Progress of the sky fade for a frame time, 0 at the start and 1 (or more) once it is over. */
export function introProgress(now) {
  if (state.introStart === null) return 1;
  const progress = Math.max(0, (now - state.introStart - INTRO.sceneAt) / INTRO.sceneMs);
  if (progress >= 1) state.introStart = null;
  return progress;
}

/** Global sky alpha for a progress value. */
export const introAlpha = (progress) => (progress >= 1 ? 1 : easeCubicOut(clamp01(progress)));

/** Per-constellation alpha: each one lights up on its own slightly different beat. */
export const introFor = (game, progress) =>
  progress >= 1 ? 1 : easeCubicOut(clamp01((progress - hash01(`${game.uuid}:in`) * 0.5) / 0.5));
