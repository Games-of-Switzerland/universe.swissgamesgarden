import { describe, expect, it } from 'vitest';
import { normalize, rankSearch } from '../src/search.js';

const games = ['Swiss Games Garden', 'Garden Party', 'Mygarden', 'Été Indien', 'Tell', 'x (y)', 'Zelda'].map(
  (title) => ({ title }),
);

describe('normalize', () => {
  it('lowercases and strips accents', () => {
    expect(normalize('Été Indien')).toBe('ete indien');
    expect(normalize('Zürich')).toBe('zurich');
  });
});

describe('rankSearch', () => {
  it('returns nothing for an empty query', () => {
    expect(rankSearch(games, '')).toEqual([]);
    expect(rankSearch(games, '   ')).toEqual([]);
  });

  it('ranks word-start matches before plain substring matches, each group alphabetical', () => {
    expect(rankSearch(games, 'garden').map((g) => g.title)).toEqual(['Garden Party', 'Swiss Games Garden', 'Mygarden']);
  });

  it('ignores accents in both the query and the titles', () => {
    expect(rankSearch(games, 'ete').map((g) => g.title)).toEqual(['Été Indien']);
    expect(rankSearch(games, 'Été').map((g) => g.title)).toEqual(['Été Indien']);
  });

  it('is safe with regular expression characters', () => {
    expect(rankSearch(games, 'x (y').map((g) => g.title)).toEqual(['x (y)']);
    expect(() => rankSearch(games, '[')).not.toThrow();
  });

  it('caps the number of results', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ title: `Game ${i}` }));
    expect(rankSearch(many, 'game')).toHaveLength(8);
    expect(rankSearch(many, 'game', 3)).toHaveLength(3);
  });

  it('uses a precomputed key when present', () => {
    expect(rankSearch([{ title: 'Hidden', key: 'visible' }], 'vis')).toHaveLength(1);
  });
});
