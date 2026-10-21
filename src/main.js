/**
 * @file Entry point: builds the page from the data, wires the UI and starts the frame loop.
 * @module main
 */
import { browsePose, focus, solvePose, travel } from './app.js';
import { project, updateBasis } from './camera.js';
import { initCoach } from './coach.js';
import { FOCUS_AT } from './config.js';
import { games } from './data.js';
import { initDetail } from './detail.js';
import { initInput } from './input.js';
import { playIntro } from './intro.js';
import { initOverlays, isExplainOpen, isLegendOpen } from './overlays.js';
import { startRender } from './render.js';
import { currentSlug } from './router.js';
import { bands, lastYearBand } from './scene.js';
import { initSearch } from './search.js';
import { cam, mouse } from './state.js';
import { initTilt, tiltUsable } from './tilt.js';
import { onResize, resize } from './viewport.js';
import { updateYearPicker } from './years.js';

/** The band the home starts at, for today's date. */
const homeBand = () => travel.homeBand(new Date().getFullYear());

/** Boot sequence, in order: layout, start position, UI, intro, frame loop, deep link. */
function boot() {
  document.documentElement.style.setProperty('--focus-x', `${FOCUS_AT[0] * 100}%`);
  document.getElementById('count').textContent = `${games.length} games · ${bands[0].label} – ${lastYearBand().label}`;
  onResize(updateYearPicker);
  window.addEventListener('resize', resize);
  resize();

  const deepLink = currentSlug() !== null;
  if (!deepLink) travel.toBand(homeBand(), false);
  Object.assign(cam, browsePose());
  updateBasis();

  initOverlays();
  initInput();
  initTilt(mouse);
  initCoach(() => focus.phase === 'browse' && !isLegendOpen() && !isExplainOpen(), tiltUsable);
  initDetail();
  initSearch(games, focus.open);
  document.getElementById('loading').classList.add('is-done');

  // Intro sequence on the homepage only: a deep link (or reduced motion) goes straight to the full page.
  if (!deepLink && !matchMedia('(prefers-reduced-motion: reduce)').matches) playIntro();
  else document.body.classList.remove('is-loading');

  startRender();
  // A deep link opens its game; later, back, forward and an edited URL are followed by the focus itself.
  focus.follow();
  // The brand is the way home: it closes an open game, or flies back to the home year when browsing.
  document.querySelector('.brand').addEventListener('click', (event) => {
    event.preventDefault();
    if (focus.phase !== 'browse') focus.close();
    else travel.toBand(homeBand());
  });

  // Handles for the browser console and the automated checks.
  window.SGG_DEBUG = {
    cam,
    project,
    focusCamera: solvePose,
    games,
    bands,
    playIntro,
    get focus() {
      return focus.game;
    },
  };
}

boot();
