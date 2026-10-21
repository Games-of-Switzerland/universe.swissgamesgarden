/**
 * @file Tilt: on phones, tilting the device looks around, like moving the mouse does on a desktop.
 * The way the phone is held when the first reading arrives is "straight ahead", and it stays so: the same
 * tilt always looks the same way. Only a turn of the screen or coming back to the page sets it again.
 *
 * The three angles of a reading (alpha, beta, gamma) are not read one by one: held upright, beta nears 90°
 * and gamma jumps by 180°, and the two axes mix. They are combined into one rotation instead, and the look is
 * where the back of the phone points now, seen from where it pointed straight ahead.
 * Pure apart from initTilt(), which wires the sensor and the compass.
 * @module tilt
 */

import { coachDid, coachStep } from './coach.js';
import { MAX_YAW } from './config.js';

// Degrees of tilt away from straight ahead that look all the way to the side (or up and down).
const TILT_RANGE = 22;
// Look change, in mouse look units, since the coach asked for the tilt, at which it counts as learnt.
const TILT_LEARNT = 0.35;
// Share of the way to the new look taken at each reading: smooths the sensor's jitter.
const SMOOTHING = 0.25;

const RAD = Math.PI / 180;

/** Clamps to [-1, 1]. */
const clampUnit = (value) => Math.max(-1, Math.min(1, value));

/** 3 × 3 matrix product, row-major arrays of rows. */
const multiply = (a, b) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
const transpose = (m) => [0, 1, 2].map((i) => [m[0][i], m[1][i], m[2][i]]);

const rotX = (t) => [
  [1, 0, 0],
  [0, Math.cos(t), -Math.sin(t)],
  [0, Math.sin(t), Math.cos(t)],
];
const rotY = (t) => [
  [Math.cos(t), 0, Math.sin(t)],
  [0, 1, 0],
  [-Math.sin(t), 0, Math.cos(t)],
];
const rotZ = (t) => [
  [Math.cos(t), -Math.sin(t), 0],
  [Math.sin(t), Math.cos(t), 0],
  [0, 0, 1],
];

/**
 * The screen's axes (x right, y up, z towards the viewer) in the earth frame, for a device orientation reading
 * and the screen orientation `angle`. The device rotation is Z(alpha)·X(beta)·Y(gamma) (W3C), and a turned
 * screen is the device turned back by `angle` around its own z.
 */
function screenRotation(alpha, beta, gamma, angle) {
  const device = multiply(multiply(rotZ(alpha * RAD), rotX(beta * RAD)), rotY(gamma * RAD));
  return multiply(device, rotZ(-angle * RAD));
}

/**
 * Creates the tilt look. `read(alpha, beta, gamma, angle)` takes one device orientation reading and returns the
 * look { nx, ny } in [-1, 1], the same scale as the mouse (right and down are positive).
 */
export function createTilt() {
  let centre = null;
  let lastAngle = null;
  let look = { nx: 0, ny: 0 };
  return {
    read(alpha, beta, gamma, angle = 0) {
      const now = screenRotation(alpha ?? 0, beta, gamma, angle);
      let right = 0;
      let down = 0;
      // A new screen orientation is a new way of holding the phone: start from straight ahead again.
      // The look eases back to the centre rather than jumping there.
      if (!centre || angle !== lastAngle) {
        centre = now;
        lastAngle = angle;
      } else {
        // Where the back of the phone (the screen's -z) points, in the screen axes of straight ahead.
        const relative = multiply(transpose(centre), now);
        const [x, y, z] = [-relative[0][2], -relative[1][2], -relative[2][2]];
        right = Math.atan2(x, -z) / RAD;
        down = Math.asin(Math.max(-1, Math.min(1, -y))) / RAD;
      }
      look = {
        nx: look.nx + (clampUnit(right / TILT_RANGE) - look.nx) * SMOOTHING,
        ny: look.ny + (clampUnit(down / TILT_RANGE) - look.ny) * SMOOTHING,
      };
      return look;
    },
    /** Forgets straight ahead: the next reading is the new one. */
    recentre() {
      centre = null;
    },
  };
}

// Whether the device tilt can look around: readings arrive, or (iOS) motion access may still be granted.
let usable = false;
export const tiltUsable = () => usable;

/**
 * Looks around with the device tilt on touch devices, writing the shared mouse look. iOS asks for permission,
 * which needs a user gesture: the first tap asks. Skipped when the user prefers reduced motion.
 * The compass shows up with the first reading (on iOS from the start, off until the permission is granted): its
 * needle points straight ahead, and tapping it makes the way the phone is held now straight ahead.
 */
export function initTilt(mouse) {
  if (typeof DeviceOrientationEvent === 'undefined') return;
  if (!matchMedia('(pointer: coarse)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const tilt = createTilt();
  const compass = document.getElementById('compass');
  const needle = compass.querySelector('.compass-needle');
  // The look when the coach started asking for the tilt.
  let asked = null;
  const onReading = (event) => {
    if (event.beta === null || event.gamma === null) return;
    const angle = screen.orientation?.angle ?? window.orientation ?? 0;
    const look = tilt.read(event.alpha, event.beta, event.gamma, angle);
    mouse.nx = look.nx;
    mouse.ny = look.ny;
    mouse.active = true;
    compass.hidden = false;
    usable = true;
    if (coachStep() !== 'tilt') asked = null;
    else if (!asked) asked = look;
    else if (Math.hypot(look.nx - asked.nx, look.ny - asked.ny) > TILT_LEARNT) coachDid('tilt');
    // Looking right, straight ahead is on the left.
    needle.style.transform = `rotate(${-look.nx * MAX_YAW}deg)`;
  };
  const listen = () => window.addEventListener('deviceorientation', onReading);
  // Coming back to the page, the phone is probably held differently.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tilt.recentre();
  });
  if (typeof DeviceOrientationEvent.requestPermission !== 'function') {
    compass.addEventListener('click', () => tilt.recentre());
    listen();
    return;
  }
  // iOS: the compass shows from the start, off, so there is always a tap that asks. A scroll is not a tap for
  // iOS, so the first touch of the page may not be able to ask.
  let permission = 'unknown';
  usable = true;
  compass.hidden = false;
  compass.classList.add('is-off');
  const ask = () => {
    if (permission !== 'unknown') return;
    permission = 'asking';
    DeviceOrientationEvent.requestPermission()
      .then((answer) => {
        permission = answer;
        window.removeEventListener('touchend', ask);
        if (answer === 'granted') {
          compass.classList.remove('is-off');
          listen();
        } else {
          compass.hidden = true;
          usable = false;
          // Nothing to teach without the sensor.
          coachDid('tilt');
        }
      })
      // Not from a tap: ask again on the next one.
      .catch(() => {
        permission = 'unknown';
      });
  };
  compass.addEventListener('click', () => (permission === 'granted' ? tilt.recentre() : ask()));
  window.addEventListener('touchend', ask);
}
