// Validates the database the viewer ships with. Like color-names' tests on its CSV: the data is the
// product, so it is checked as strictly as the code.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const db = JSON.parse(readFileSync(new URL('../data/games.json', import.meta.url), 'utf8'));
const games = db.games;
const STATES = new Set(['released', 'development', 'prototype', 'canceled', '', null, undefined]);
const KINDS = new Set(['game', 'platform', 'studio', 'person', 'store', 'award']);

describe('database', () => {
  it('has the expected shape', () => {
    expect(db.algorithm_version).toBeGreaterThanOrEqual(3);
    expect(typeof db.updated).toBe('string');
    expect(games.length).toBeGreaterThan(1000);
  });

  it('keeps the parameters of every algorithm version, the header being the latest', () => {
    const versions = Object.keys(db.params).map(Number);
    expect(db.algorithm_version).toBe(Math.max(...versions));
    for (const g of games) expect(db.params[g.constellation.v], `${g.title} (v${g.constellation.v})`).toBeTruthy();
  });

  it('publishes every number the explainer shows', () => {
    for (const params of Object.values(db.params)) {
      for (const key of [
        'main_radius_min',
        'main_radius_per_credit',
        'main_radius_max',
        'shine_base',
        'shine_per_award',
        'shine_max',
      ]) {
        expect(typeof params[key], key).toBe('number');
      }
    }
  });

  it('has unique uuids and paths', () => {
    expect(new Set(games.map((g) => g.uuid)).size).toBe(games.length);
    expect(new Set(games.map((g) => g.path)).size).toBe(games.length);
  });

  it('is sorted by year then uuid, unknown years last (so a rebuild is reproducible)', () => {
    const key = (g) => [g.year ?? 9999, g.uuid];
    for (let i = 1; i < games.length; i++) {
      const [ya, ua] = key(games[i - 1]);
      const [yb, ub] = key(games[i]);
      expect(ya < yb || (ya === yb && ua <= ub)).toBe(true);
    }
  });

  it.each(games.map((g) => [g.title, g]))('%s is a valid record', (_title, g) => {
    expect(g.title).toBeTruthy();
    expect(g.path).toMatch(/^\/games\/.+/);
    expect(g.url).toBe(`https://swissgames.garden${g.path}`);
    expect(g.year === null || Number.isInteger(g.year)).toBe(true);
    expect(STATES.has(g.first_release.state)).toBe(true);
    if (g.first_release.date) expect(g.first_release.date).toMatch(/^\d{4}-\d{2}-\d{2}/);
    for (const key of [
      'releases',
      'studios',
      'people',
      'cantons',
      'locations',
      'stores',
      'awards',
      'genres',
      'languages',
    ]) {
      expect(Array.isArray(g[key])).toBe(true);
    }
  });

  it.each(games.map((g) => [g.title, g.constellation]))('%s has a valid constellation', (_title, c) => {
    expect(c.v).toBeGreaterThanOrEqual(3);
    expect(c.v).toBeLessThanOrEqual(db.algorithm_version);
    expect(c.cx).toBeGreaterThanOrEqual(0);
    expect(c.cx).toBeLessThanOrEqual(1);
    expect(c.cy).toBeGreaterThanOrEqual(0);
    expect(c.cy).toBeLessThanOrEqual(1);
    expect(c.shine).toBeGreaterThanOrEqual(1);
    expect(c.shine).toBeLessThanOrEqual(3);
    expect(c.extent).toBeGreaterThan(0);
    expect(c.stars.length).toBeGreaterThanOrEqual(1);
    expect(c.stars[0].kind).toBe('game');
    expect(c.stars[0].parent).toBeNull();
    c.stars.forEach((st, i) => {
      expect(KINDS.has(st.kind)).toBe(true);
      expect(Number.isFinite(st.x) && Number.isFinite(st.y)).toBe(true);
      expect(st.r).toBeGreaterThan(0);
      expect(st.twinkle.rate).toBeGreaterThan(0);
      if (i > 0) {
        expect(st.parent).toBeGreaterThanOrEqual(0);
        expect(st.parent).toBeLessThan(i); // parents come before their children
      }
    });
    expect(c.links).toHaveLength(c.stars.length - 1);
    for (const [a, b] of c.links) {
      expect(c.stars[b].parent).toBe(a);
    }
  });
});
