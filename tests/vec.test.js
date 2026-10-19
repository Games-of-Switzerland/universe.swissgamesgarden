import { describe, expect, it } from 'vitest';
import { easeCubicInOut, easeCubicOut, hash01, rot, seededRandom, vec } from '../src/vec.js';

const close = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);

describe('vector toolbox', () => {
  it('normalises and keeps the zero vector finite', () => {
    expect(close(vec.norm([3, 4, 0]), [0.6, 0.8, 0])).toBe(true);
    expect(vec.norm([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('cross product follows the right-hand rule', () => {
    expect(vec.cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
  });

  it('rotates with Rodrigues formula', () => {
    expect(close(rot([1, 0, 0], [0, 0, 1], Math.PI / 2), [0, 1, 0])).toBe(true);
    expect(close(rot([0, 1, 0], [1, 0, 0], Math.PI), [0, -1, 0])).toBe(true);
    expect(vec.len(rot([1, 2, 3], vec.norm([1, 1, 1]), 0.7))).toBeCloseTo(vec.len([1, 2, 3]));
  });

  it('lerps', () => {
    expect(vec.lerp([0, 0, 0], [10, 20, 30], 0.5)).toEqual([5, 10, 15]);
  });
});

describe('hash01', () => {
  it('is deterministic and in [0, 1)', () => {
    expect(hash01('abc')).toBe(hash01('abc'));
    expect(hash01('abc')).not.toBe(hash01('abd'));
    for (const s of ['', 'a', 'uuid:r', 'uuid:spin']) {
      expect(hash01(s)).toBeGreaterThanOrEqual(0);
      expect(hash01(s)).toBeLessThan(1);
    }
  });
});

describe('seededRandom', () => {
  it('gives the same sequence for the same seed', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const seq = Array.from({ length: 5 }, () => a());
    expect(seq).toEqual(Array.from({ length: 5 }, () => b()));
    for (const x of seq) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(seededRandom(43)()).not.toBe(seededRandom(42)());
  });
});

describe('easings', () => {
  it('start at 0 and end at 1', () => {
    expect(easeCubicOut(0)).toBe(0);
    expect(easeCubicOut(1)).toBe(1);
    expect(easeCubicInOut(0)).toBe(0);
    expect(easeCubicInOut(0.5)).toBe(0.5);
    expect(easeCubicInOut(1)).toBe(1);
  });
});
