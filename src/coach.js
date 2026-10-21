/**
 * @file Coach: a small card in the middle of the home that shows how to move and how to look around.
 * It shows up when, a few seconds after the page loads, the visitor has not moved from the start: on every load, since
 * whoever does not move may not know how to. It teaches one gesture at a time (a gesture counts only while the card
 * asks for it), then leaves until the next load. Touch screens: pinch, then tilt. Others: scroll, then the mouse. Pure apart from initCoach(), which wires the page.
 * @module coach
 */
import { COACH_IDLE_MS } from './config.js';

const TEXT = {
  pinch: 'Pinch to move',
  tilt: 'Tilt your phone to explore',
  scroll: 'Scroll to move',
  look: 'Move the mouse to explore',
};
// Scroll pixels away from the start position that count as having moved.
const MOVED = 40;
// Pixels the mouse travels before looking around counts as done.
const LOOK_DISTANCE = 300;

/** Creates the coach for `steps`, in teaching order: `step` is the first one not done yet, null once all are. */
export function createCoach(steps) {
  const done = new Set();
  return {
    did(step) {
      if (steps.includes(step)) done.add(step);
    },
    get step() {
      return steps.find((step) => !done.has(step)) ?? null;
    },
  };
}

// The live coach of the page, null when there is nothing (left) to teach; `shown` once the card is on screen.
let coach = null;
let shown = false;
let changed = () => {};

/** The gesture the card is asking for right now, or null. */
export const coachStep = () => (coach && shown ? coach.step : null);

/** Tells the coach a gesture was done (from wherever it is detected): it counts if the card is asking for it. */
export function coachDid(step) {
  if (step !== coachStep()) return;
  coach.did(step);
  changed();
}

/**
 * Wires the coach. `free()` says whether the home is free for it (no game, no overlay open); `tiltUsable()` whether
 * the device tilt can look around: without it, no tilt step.
 */
export function initCoach(free, tiltUsable) {
  const touch = matchMedia('(pointer: coarse)').matches;
  coach = createCoach(touch ? ['pinch', 'tilt'] : ['scroll', 'look']);
  const card = document.getElementById('coach');
  const text = card.querySelector('.coach-text');

  const finish = () => {
    coach = null;
    card.classList.add('is-leaving');
    setTimeout(() => {
      card.hidden = true;
    }, 400);
  };
  const show = () => {
    if (coach.step === 'tilt' && !tiltUsable()) coach.did('tilt');
    if (!coach.step) return finish();
    card.dataset.step = coach.step;
    text.textContent = TEXT[coach.step];
    card.hidden = false;
    shown = true;
  };
  // The card stays and moves on to the next gesture.
  changed = () => (coach.step ? show() : finish());

  // COACH_IDLE_MS after the intro, still at the start position on the free home (no game, no overlay): show.
  // Moved, or busy elsewhere: not on this load.
  const start = window.scrollY;
  const wait = () => {
    setTimeout(() => {
      if (document.body.classList.contains('is-loading')) wait();
      else if (Math.abs(window.scrollY - start) <= MOVED && free()) show();
      else coach = null;
    }, COACH_IDLE_MS);
  };
  wait();

  // Touch gestures are reported by input.js (pinch) and tilt.js (tilt); the desktop ones are seen here.
  if (touch) return;
  window.addEventListener('wheel', () => coachDid('scroll'), { passive: true });
  window.addEventListener('keydown', (event) => {
    if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'j', 'k'].includes(event.key)) coachDid('scroll');
  });
  let last = null;
  let travelled = 0;
  window.addEventListener('mousemove', (event) => {
    // Only the travel while the card asks for it.
    if (coachStep() !== 'look') {
      last = null;
      travelled = 0;
      return;
    }
    if (last) travelled += Math.hypot(event.clientX - last[0], event.clientY - last[1]);
    last = [event.clientX, event.clientY];
    if (travelled > LOOK_DISTANCE) coachDid('look');
  });
}
