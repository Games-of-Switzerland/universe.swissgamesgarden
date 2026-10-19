/**
 * @file Small 3D vector toolbox plus the hashes and easings the viewer needs. Vectors are plain [x, y, z] arrays.
 * @module vec
 */

/** Vector operations, kept on one object so call sites read as `vec.add(a, b)`. */
export const vec = {
  /** Sum of two vectors. */
  add: (first, second) => [first[0] + second[0], first[1] + second[1], first[2] + second[2]],
  /** Difference first - second. */
  sub: (first, second) => [first[0] - second[0], first[1] - second[1], first[2] - second[2]],
  /** Vector scaled by a number. */
  mul: (vector, scale) => [vector[0] * scale, vector[1] * scale, vector[2] * scale],
  /** Dot product. */
  dot: (first, second) => first[0] * second[0] + first[1] * second[1] + first[2] * second[2],
  /** Cross product (right-hand rule). */
  cross: (first, second) => [
    first[1] * second[2] - first[2] * second[1],
    first[2] * second[0] - first[0] * second[2],
    first[0] * second[1] - first[1] * second[0],
  ],
  /** Length of a vector. */
  len: (vector) => Math.hypot(vector[0], vector[1], vector[2]),
  /** Unit vector in the same direction; the zero vector stays zero. */
  norm: (vector) => {
    const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
    return [vector[0] / length, vector[1] / length, vector[2] / length];
  },
  /** Point between two vectors: t = 0 gives the first, t = 1 the second. */
  lerp: (from, to, t) => [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ],
};

/** Rotates a vector around a unit axis by an angle in radians (Rodrigues formula). */
export function rot(vector, axis, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return vec.add(
    vec.add(vec.mul(vector, cos), vec.mul(vec.cross(axis, vector), sin)),
    vec.mul(axis, vec.dot(axis, vector) * (1 - cos)),
  );
}

/** Deterministic hash of a string to [0, 1) (FNV-1a): scatters things without storing anything. */
export function hash01(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10007) / 10007;
}

/** Seeded pseudo random generator (mulberry32): same seed, same sequence of numbers in [0, 1). */
export function seededRandom(seed) {
  let current = seed >>> 0;
  return () => {
    current = (current + 0x6d2b79f5) >>> 0;
    let mixed = current;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** Clamps a number to [0, 1]. */
export const clamp01 = (value) => Math.max(0, Math.min(1, value));

/** Easing that starts fast and settles gently. */
export const easeCubicOut = (t) => 1 - (1 - t) ** 3;

/** Easing that accelerates then decelerates, for camera flights. */
export const easeCubicInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** CSS colour string from an [r, g, b] triple and an alpha. */
export const rgba = (color, alpha) => `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
