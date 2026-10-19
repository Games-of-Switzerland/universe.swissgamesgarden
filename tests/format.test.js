import { describe, expect, it } from 'vitest';
import { fmtDate, plural, subtitleText } from '../src/format.js';

describe('fmtDate', () => {
  it('returns null without a date', () => {
    expect(fmtDate(null)).toBeNull();
    expect(fmtDate('')).toBeNull();
  });

  it('shows January 1st as the year only (the archive uses it when only the year is known)', () => {
    expect(fmtDate('2020-01-01')).toBe('2020');
  });

  it('formats full dates in British English', () => {
    expect(fmtDate('2020-10-30')).toBe('30 October 2020');
    expect(fmtDate('1974-08-05')).toBe('5 August 1974');
  });
});

describe('plural', () => {
  it('adds an s except for one', () => {
    expect(plural(1, 'award')).toBe('1 award');
    expect(plural(3, 'award')).toBe('3 awards');
    expect(plural(0, 'award')).toBe('0 awards');
  });
});

describe('subtitleText: every variant of the detail subtitle', () => {
  const cases = [
    [
      { state: 'released', date: '1974-08-05', platform: 'Custom Hardware' },
      'First released 5 August 1974 on Custom Hardware',
    ],
    [{ state: 'released', date: '1967-01-01', platform: 'CDC 1604' }, 'First released 1967 on CDC 1604'],
    [{ state: 'released', date: null, platform: 'Mac OS' }, 'Unknown release date on Mac OS'],
    [{ state: 'released', date: null, platform: null }, 'Unknown release date'],
    [{ state: null, date: '2001-03-04', platform: 'PC' }, 'First released 4 March 2001 on PC'],
    [{ state: 'development', date: null, platform: 'Windows' }, 'Under development on Windows'],
    [
      { state: 'development', date: '2026-05-19', platform: 'Browser' },
      'Under development, planned 19 May 2026 on Browser',
    ],
    [{ state: 'prototype', date: '2011-03-15', platform: 'Xbox360' }, 'Prototype, 15 March 2011 on Xbox360'],
    [{ state: 'prototype', date: '1998-01-01', platform: 'Windows' }, 'Prototype, 1998 on Windows'],
    [{ state: 'prototype', date: null, platform: 'Windows' }, 'Prototype, TBA on Windows'],
    [{ state: 'canceled', date: '2011-12-01', platform: 'iPhone' }, 'Canceled, 2011 on iPhone'],
    [{ state: 'canceled', date: '1988-01-01', platform: 'Amiga' }, 'Canceled, 1988 on Amiga'],
    [{ state: 'canceled', date: null, platform: 'Windows' }, 'Canceled on Windows'],
  ];
  it.each(cases)('%o -> %s', (fr, expected) => {
    expect(subtitleText(fr)).toBe(expected);
  });

  it('never says "Unknown date"', () => {
    for (const [fr] of cases) expect(subtitleText(fr)).not.toContain('Unknown date');
  });
});
