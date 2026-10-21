import { describe, expect, it } from 'vitest';
import { createCoach } from '../src/coach.js';

describe('coach', () => {
  it('teaches the steps in order', () => {
    const coach = createCoach(['pinch', 'tilt']);
    expect(coach.step).toBe('pinch');
    coach.did('pinch');
    expect(coach.step).toBe('tilt');
    coach.did('tilt');
    expect(coach.step).toBeNull();
  });

  it('skips a gesture already done before its turn', () => {
    const coach = createCoach(['scroll', 'look']);
    coach.did('look');
    expect(coach.step).toBe('scroll');
    coach.did('scroll');
    expect(coach.step).toBeNull();
  });

  it('ignores gestures that are not its own', () => {
    const coach = createCoach(['scroll', 'look']);
    coach.did('pinch');
    expect(coach.step).toBe('scroll');
  });
});
