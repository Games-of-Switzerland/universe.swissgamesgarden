/**
 * @file Years: the year picker and the big year label, both following the band the ship is in.
 * @module years
 */
import { travel } from './app.js';
import { bands, lastYearBand } from './scene.js';
import { cam, view } from './state.js';

/** The year picker element. */
const pickerElement = () => document.getElementById('yearPicker');

/** The band the ship is in. */
const currentBand = () => travel.bandAt(cam.p[2]);

/** Rebuilds the year picker: every year when the window is tall, every 2nd or 5th year when it is short. */
export function updateYearPicker() {
  const picker = pickerElement();
  picker.innerHTML = '';
  const step = view.vh < 700 ? 5 : view.vh < 900 ? 2 : 1;
  const last = lastYearBand();
  const current = currentBand();
  bands.forEach((band, index) => {
    if (band.key !== 'TBA' && index % step !== 0 && band !== last) return;
    const button = document.createElement('button');
    button.textContent = band.label;
    button.dataset.key = band.key;
    // updateYearLabel only toggles on a year change, so a rebuilt picker marks the current year itself.
    if (band === current) button.classList.add('is-active');
    button.addEventListener('click', () => travel.toBand(band));
    picker.appendChild(button);
  });
}

/** Keeps the big year label and the active year picker button in sync with the ship. */
export function updateYearLabel() {
  const current = currentBand();
  const label = document.getElementById('yearLabel');
  if (label.textContent === current.label) return;
  label.textContent = current.label;
  for (const button of pickerElement().querySelectorAll('button')) {
    button.classList.toggle('is-active', button.dataset.key === String(current.key));
  }
}
