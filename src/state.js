/**
 * @file The few mutable things shared by the modules. Everything else is derived or local.
 * @module state
 */
import { MOBILE_MAX_WIDTH } from './config.js';

// Viewport: size in px, device pixel ratio, focal length f in px and the projection centre in px.
export const view = { vw: 0, vh: 0, dpr: 1, f: 1, px: 0, py: 0 };

// The ship: position, unit forward vector and the basis (right / up / fwd) derived from it.
export const cam = { p: [0, 0, 0], fwd: [0, 0, 1], basis: null };

// Last mouse position, in px and normalised to [-1, 1] from the centre of the viewport.
export const mouse = { x: 0, y: 0, nx: 0, ny: 0, active: false };

// Interaction: the hovered game and the start of the intro. The focused game lives in the focus (focus.js).
export const state = {
  hovered: null,
  introStart: null,
};

/** True when the viewport is narrow enough for the mobile layout. */
export const isMobile = () => view.vw <= MOBILE_MAX_WIDTH;
