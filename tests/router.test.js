import { describe, expect, it } from 'vitest';
import { currentSlug, findBySlug, slugOf } from '../src/router.js';

describe('hash routing', () => {
  it('reads the slug from the hash', () => {
    expect(currentSlug('#swordship')).toBe('swordship');
    expect(currentSlug('#a%20b')).toBe('a b');
  });

  it('treats no hash, an empty hash and a malformed one as the home', () => {
    expect(currentSlug('')).toBeNull();
    expect(currentSlug('#')).toBeNull();
    expect(currentSlug('#%E0')).toBeNull();
  });

  it('round-trips a game path', () => {
    const games = [{ path: '/games/tell' }, { path: '/games/witches-x-warlocks' }];
    expect(slugOf(games[1])).toBe('witches-x-warlocks');
    expect(findBySlug(games, 'tell')).toBe(games[0]);
    expect(findBySlug(games, 'nope')).toBeNull();
  });
});
