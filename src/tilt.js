/**
 * @file Tilt: on phones, tilting the device looks around, like moving the mouse does on a desktop.
 * The way the phone is held when the first reading arrives is "straight ahead", and it stays so: the same
 * tilt always looks the same way. Only a turn of the screen or coming back to the page sets it again.
 * Pure apart from initTilt(), which wires the sensor.
 * @module tilt
 */

// Degrees of tilt away from straight ahead that look all the way to the side (or up and down).
const TILT_RANGE = 22;

/** Clamps to [-1, 1]. */
const clampUnit = (value) => Math.max(-1, Math.min(1, value));

/**
 * Device tilt, as the screen sees it: [right, down] in degrees for the screen orientation `angle`.
 * Tilting the right edge up looks right; tilting the top away from you looks down.
 */
function screenTilt(beta, gamma, angle) {
  switch (((angle % 360) + 360) % 360) {
    case 90:
      return [-beta, gamma];
    case 180:
      return [gamma, beta];
    case 270:
      return [beta, -gamma];
    default:
      return [-gamma, -beta];
  }
}

/**
 * Creates the tilt look. `read(beta, gamma, angle)` takes one device orientation reading and returns the
 * look { nx, ny } in [-1, 1], the same scale as the mouse (right and down are positive).
 */
export function createTilt() {
  let centre = null;
  let lastAngle = null;
  return {
    read(beta, gamma, angle = 0) {
      const tilt = screenTilt(beta, gamma, angle);
      // A new screen orientation is a new way of holding the phone: start from straight ahead again.
      if (!centre || angle !== lastAngle) centre = tilt.slice();
      lastAngle = angle;
      const look = {
        nx: clampUnit((tilt[0] - centre[0]) / TILT_RANGE),
        ny: clampUnit((tilt[1] - centre[1]) / TILT_RANGE),
      };
      return look;
    },
    /** Forgets straight ahead: the next reading is the new one. */
    recentre() {
      centre = null;
    },
  };
}

/**
 * Looks around with the device tilt on touch devices, writing the shared mouse look. iOS asks for permission,
 * which needs a user gesture: the first tap asks. Skipped when the user prefers reduced motion.
 */
export function initTilt(mouse) {
  if (typeof DeviceOrientationEvent === 'undefined') return;
  if (!matchMedia('(pointer: coarse)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const tilt = createTilt();
  const onReading = (event) => {
    if (event.beta === null || event.gamma === null) return;
    const look = tilt.read(event.beta, event.gamma, screen.orientation?.angle ?? window.orientation ?? 0);
    mouse.nx = look.nx;
    mouse.ny = look.ny;
    mouse.active = true;
  };
  const listen = () => window.addEventListener('deviceorientation', onReading);
  // Coming back to the page, the phone is probably held differently.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tilt.recentre();
  });
  if (typeof DeviceOrientationEvent.requestPermission !== 'function') {
    listen();
    return;
  }
  const ask = () => {
    DeviceOrientationEvent.requestPermission()
      .then((answer) => {
        if (answer === 'granted') listen();
      })
      .catch(() => {});
  };
  window.addEventListener('touchend', ask, { once: true });
}
