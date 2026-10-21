/**
 * @file Mouse, touch and keyboard.
 * @module input
 */
import { focus, travel } from './app.js';
import { hitTest, nearest } from './camera.js';
import { coachDid } from './coach.js';
import { PINCH_SCROLL } from './config.js';
import { isExplainOpen, isLegendOpen, toggleExplain, toggleLegend } from './overlays.js';
import { shineNear } from './shines.js';
import { cam, mouse, state, view } from './state.js';
import { canvas } from './viewport.js';

/** Sticky hover: keeps the current target while the cursor stays close to it, even if the scene drifted. */
function pickHover() {
  const candidate = nearest(mouse.x, mouse.y, 18);
  if (candidate) state.hovered = candidate;
  else if (!(state.hovered && hitTest(mouse.x, mouse.y, state.hovered, 70))) state.hovered = null;
  canvas.classList.toggle('is-hovering', !!state.hovered);
}

/** Wires every pointer and keyboard listener. */
export function initInput() {
  let lastShineCheck = 0;
  canvas.addEventListener('mousemove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.active = true;
    mouse.nx = (event.clientX / view.vw - 0.5) * 2;
    mouse.ny = (event.clientY / view.vh - 0.5) * 2;
    document.getElementById('hint').classList.add('is-hidden');
    if (focus.phase === 'browse') pickHover();
    if (performance.now() - lastShineCheck > 60) {
      lastShineCheck = performance.now();
      shineNear(event.clientX, event.clientY);
    }
  });
  // Leaving the window keeps the camera where it was: only the hover target is dropped.
  canvas.addEventListener('mouseleave', () => {
    state.hovered = null;
    canvas.classList.remove('is-hovering');
  });
  canvas.addEventListener('click', (event) => {
    // Clicks during a flight are requests like any other: the focus keeps the latest one for the landing.
    if (focus.game) {
      if (!hitTest(event.clientX, event.clientY, focus.game)) focus.close();
      return;
    }
    // Use the constellation hovered at the last mouse move: the scene drifts a little while the
    // camera turns toward the cursor, so re-picking at click time would miss what the user aimed at.
    if (state.hovered) focus.open(state.hovered);
  });
  // Pinch: spreading two fingers flies forward like scrolling down, bringing them together flies back.
  let pinch = null;
  let pinchStart = 0;
  let pinched = false;
  const spread = (touches) =>
    Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  canvas.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length === 1) {
        mouse.x = event.touches[0].clientX;
        mouse.y = event.touches[0].clientY;
        pinched = false;
      }
      if (event.touches.length === 2) {
        pinch = spread(event.touches);
        pinchStart = pinch;
        pinched = true;
      }
    },
    { passive: true },
  );
  canvas.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length !== 2 || pinch === null) return;
      // Two fingers belong to the pinch: no native two-finger pan meanwhile.
      event.preventDefault();
      const now = spread(event.touches);
      if (focus.phase === 'browse') window.scrollBy(0, (now - pinch) * PINCH_SCROLL);
      if (Math.abs(now - pinchStart) > 40) coachDid('pinch');
      pinch = now;
    },
    { passive: false },
  );
  canvas.addEventListener('touchcancel', () => {
    pinch = null;
  });
  canvas.addEventListener('touchend', (event) => {
    if (event.touches.length < 2) pinch = null;
    // Lifting the fingers of a pinch is not a tap.
    if (pinched) return;
    if (focus.game && focus.phase !== 'closing') return;
    const touch = event.changedTouches[0];
    // A finger that moved was a scroll, not a tap.
    if (Math.hypot(touch.clientX - mouse.x, touch.clientY - mouse.y) > 10) return;
    const game = nearest(touch.clientX, touch.clientY, 36);
    if (game) focus.open(game);
  });
  // iOS Safari ignores user-scalable=no: its pinch gesture is cancelled here instead.
  document.addEventListener('gesturestart', (event) => event.preventDefault());
  // The page is locked while a game is open; its own panels (detail sheet, overlays) still scroll.
  window.addEventListener(
    'wheel',
    (event) => {
      if (focus.phase !== 'browse' && !event.target.closest('#detail, #explain, #legend')) event.preventDefault();
    },
    { passive: false },
  );
  window.addEventListener('keydown', (event) => {
    if (event.target === document.getElementById('searchInput')) return;
    if (event.key === 'Escape') {
      if (isLegendOpen()) toggleLegend(false);
      else if (isExplainOpen()) toggleExplain(false);
      else focus.close();
    }
    if (focus.phase !== 'browse') return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight' || event.key === 'j') {
      event.preventDefault();
      travel.stepYear(travel.bandAt(cam.p[2]), 1);
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft' || event.key === 'k') {
      event.preventDefault();
      travel.stepYear(travel.bandAt(cam.p[2]), -1);
    }
  });
  document.getElementById('detailClose').addEventListener('click', focus.close);
}
