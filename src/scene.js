/**
 * @file The one world instance the viewer flies through.
 * @module scene
 */
import { games } from './data.js';
import { buildWorld } from './world.js';

// The bands and the total depth, built once from the database.
export const world = buildWorld(games);

// One band per year, chronological, TBA last.
export const bands = world.bands;

// Depth of the whole universe in world units.
export const WORLD_DEPTH = world.depth;

/** The last band that is a real year (the final one may be TBA). */
export const lastYearBand = () => [...bands].reverse().find((band) => band.key !== 'TBA') || bands[bands.length - 1];
