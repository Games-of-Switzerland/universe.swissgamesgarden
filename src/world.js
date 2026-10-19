/**
 * @file The world: years are consecutive stretches of tunnel ("bands") along z, and every game is placed
 * in the band of its release year from its stored constellation values. Pure: no DOM, no globals.
 * @module world
 */
import { FIG, R_MAX, R_MIN, RAIL_AMP, RAIL_LEN, TILT_MAX, YEAR_MIN, YEAR_PER_GAME } from './config.js';
import { hash01, rot, vec } from './vec.js';

// Key of the band holding the games whose year is unknown.
export const TBA = 'TBA';

/** Rail position [x, y] at depth z; straight when RAIL_AMP is [0, 0]. */
export function railAt(z) {
  return [
    RAIL_AMP[0] * Math.sin((z / RAIL_LEN[0]) * Math.PI * 2),
    RAIL_AMP[1] * Math.cos((z / RAIL_LEN[1]) * Math.PI * 2 + 1.3),
  ];
}

/** Unit direction of travel at depth z. */
export function railTangent(z) {
  const before = railAt(z - 1);
  const after = railAt(z + 1);
  return vec.norm([(after[0] - before[0]) / 2, (after[1] - before[1]) / 2, 1]);
}

/** Year key of a game: its year, or TBA when unknown. */
export const yearKey = (game) => (game.year === null || game.year === undefined ? TBA : game.year);

/** Sorts year keys chronologically, TBA last. */
export function compareYearKeys(first, second) {
  if (first === TBA) return 1;
  if (second === TBA) return -1;
  return first - second;
}

/** Places one game in its band: anchor `a`, plane (`u`, `w`, normal `n`) and one world point per star in `pts`. */
export function placeGame(game, band) {
  const constellation = game.constellation;
  // The stored cy is the angle around the ship, the stored cx the depth in the year.
  const angle = constellation.cy * Math.PI * 2;
  // The distance from the rail is hashed from the uuid: nothing more is stored.
  const distance = R_MIN + (R_MAX - R_MIN) * hash01(`${game.uuid}:r`) ** 0.75;
  const z = band.z0 + constellation.cx * band.depth;
  const rail = railAt(z);
  // Unit vector from the rail outward, at that angle.
  const radial = [Math.sin(angle), Math.cos(angle), 0];
  game.a = [rail[0] + radial[0] * distance, rail[1] + radial[1] * distance, z];
  game.r = distance;
  game.band = band;
  game.shine = constellation.shine || 1;
  // The figure's own plane: start facing the rail (u around the ring, w along time), spin it in its
  // plane and tilt it by seeded angles, so figures are not all parallel to the tunnel.
  const spin = hash01(`${game.uuid}:spin`) * Math.PI * 2;
  const tilt = ((hash01(`${game.uuid}:tilt`) * 2 - 1) * TILT_MAX * Math.PI) / 180;
  const tiltAxisAngle = hash01(`${game.uuid}:axis`) * Math.PI * 2;
  let planeU = [Math.cos(angle), -Math.sin(angle), 0];
  let planeW = [0, 0, 1];
  let normal = vec.cross(planeU, planeW);
  [planeU, planeW] = [rot(planeU, normal, spin), rot(planeW, normal, spin)];
  const tiltAxis = vec.norm(
    vec.add(vec.mul(planeU, Math.cos(tiltAxisAngle)), vec.mul(planeW, Math.sin(tiltAxisAngle))),
  );
  [planeU, planeW, normal] = [rot(planeU, tiltAxis, tilt), rot(planeW, tiltAxis, tilt), rot(normal, tiltAxis, tilt)];
  // The normal points toward the rail: the focus camera backs off along it.
  if (vec.dot(normal, radial) > 0) normal = vec.mul(normal, -1);
  game.n = normal;
  game.u = planeU;
  game.w = planeW;
  game.pts = constellation.stars.map((star) =>
    vec.add(game.a, vec.add(vec.mul(planeU, star.x * FIG), vec.mul(planeW, star.y * FIG))),
  );
  return game;
}

/** Builds the bands from a list of games and places every game; returns { bands, depth }. */
export function buildWorld(list) {
  const gamesByYear = new Map();
  for (const game of list) {
    const key = yearKey(game);
    if (!gamesByYear.has(key)) gamesByYear.set(key, []);
    gamesByYear.get(key).push(game);
  }
  const bands = [];
  let z = 0;
  for (const key of [...gamesByYear.keys()].sort(compareYearKeys)) {
    const games = gamesByYear.get(key);
    const band = { key, label: String(key), z0: z, depth: YEAR_MIN + YEAR_PER_GAME * games.length, games };
    for (const game of games) placeGame(game, band);
    bands.push(band);
    z += band.depth;
  }
  return { bands, depth: z };
}
