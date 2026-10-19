/**
 * @file The two full-screen overlays: the general legend ("?") and the per-game explainer ("Why this constellation?").
 * @module overlays
 */

/** Shorthand for an element by id. */
const byId = (id) => document.getElementById(id);

/** True while the legend overlay is shown. */
export const isLegendOpen = () => byId('legend').classList.contains('is-open');

/** True while the explainer overlay is shown. */
export const isExplainOpen = () => byId('explain').classList.contains('is-open');

/** Shows or hides the legend. */
export function toggleLegend(open) {
  byId('legend').classList.toggle('is-open', open);
}

/** Shows, hides or flips the explainer, keeping the "why" pill's active state in sync. */
export function toggleExplain(open) {
  const explain = byId('explain');
  const isOpen = open === undefined ? !explain.classList.contains('is-open') : open;
  explain.classList.toggle('is-open', isOpen);
  explain.setAttribute('aria-hidden', String(!isOpen));
  byId('whyBtn').classList.toggle('is-active', isOpen);
  byId('whyBtn').setAttribute('aria-expanded', String(isOpen));
}

/** Wires every button and backdrop of the two overlays. */
export function initOverlays() {
  byId('helpBtn').addEventListener('click', () => toggleLegend(true));
  byId('legendClose').addEventListener('click', () => toggleLegend(false));
  byId('legendX').addEventListener('click', () => toggleLegend(false));
  byId('legend').addEventListener('click', (event) => {
    if (event.target.id === 'legend') toggleLegend(false);
  });
  byId('whyBtn').addEventListener('click', () => toggleExplain());
  byId('explainClose').addEventListener('click', () => toggleExplain(false));
  byId('explainX').addEventListener('click', () => toggleExplain(false));
  byId('explain').addEventListener('click', (event) => {
    if (event.target.id === 'explain') toggleExplain(false);
  });
  byId('xLegend').addEventListener('click', (event) => {
    event.preventDefault();
    toggleExplain(false);
    toggleLegend(true);
  });
}
